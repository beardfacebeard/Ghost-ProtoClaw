/**
 * In-process scheduled-workflow runner.
 *
 * Design goals:
 *   - Zero new infrastructure. Runs inside the Next.js server container.
 *   - Survives restarts: the next firing time is persisted on the Workflow row,
 *     so a restart picks up any overdue runs on the next tick.
 *   - Concurrency-safe: each tick atomically claims a workflow by advancing
 *     its nextRunAt BEFORE invoking the run. If a second tick (or a second
 *     replica) tries to claim the same row at the same nextRunAt value, the
 *     UPDATE affects 0 rows and we skip it.
 *   - No tight loops: errors are caught per-workflow so a single bad workflow
 *     can't take down the whole scheduler.
 *
 * The scheduler is started from instrumentation.ts on Node server boot, so
 * it fires for both `next dev` and `next start`. It is a no-op on the Edge
 * runtime (which has no setInterval / DB access).
 */

import type { Workflow } from "@prisma/client";

import { db } from "@/lib/db";
import { getNextRunTime } from "@/lib/workflows/schedule-parser";

const TICK_INTERVAL_MS = 30_000;
const MAX_WORKFLOWS_PER_TICK = 25;

let tickTimer: NodeJS.Timeout | null = null;
let tickInFlight = false;
let started = false;

/** Start the scheduler's tick loop. Safe to call multiple times — subsequent calls are no-ops. */
export function startWorkflowScheduler() {
  if (started) return;
  started = true;

  console.log("[workflow-scheduler] starting with 30s tick interval");

  // Fire an immediate tick on startup so overdue workflows run without
  // waiting a full interval.
  setImmediate(() => void tick());

  tickTimer = setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);

  // Don't keep the Node process alive just for the scheduler — allow a
  // graceful shutdown when the Next server exits.
  tickTimer.unref?.();
}

/** Stop the scheduler. Exposed primarily for tests. */
export function stopWorkflowScheduler() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  started = false;
}

/**
 * One scheduling tick: find any scheduled+enabled workflows whose nextRunAt
 * is due, atomically claim each one, and invoke it. Catches errors per
 * workflow so one bad run can't poison the rest of the tick.
 */
async function tick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    // Run pending agent delegations first so new delegations surface in
    // the Pulse view / memory as quickly as the scheduled workflows do.
    // Also sweep zombie "running" entries so the Pulse view doesn't
    // accumulate tasks spinning forever after a crashed run.
    try {
      const {
        runPendingDelegations,
        sweepStuckDelegations,
        sweepStuckActionRuns
      } = await import("@/lib/workflows/delegation-executor");
      await sweepStuckDelegations();
      await sweepStuckActionRuns();
      await runPendingDelegations();
    } catch (err) {
      console.error(
        "[workflow-scheduler] delegation executor error:",
        err
      );
    }

    // Self-heal: any scheduled+enabled workflow with a null nextRunAt gets
    // one computed now. This covers every pathway that writes workflows
    // without going through maybeSyncSchedule — templates, backup restores,
    // bulk business (re)activation, direct DB edits, etc. Runs on every
    // tick so new rows are picked up within at most one interval.
    await backfillNextRunAt();

    const now = new Date();
    const due = await db.workflow.findMany({
      where: {
        trigger: "scheduled",
        enabled: true,
        nextRunAt: { lte: now, not: null }
      },
      orderBy: { nextRunAt: "asc" },
      take: MAX_WORKFLOWS_PER_TICK
    });

    for (const workflow of due) {
      try {
        await claimAndRun(workflow);
      } catch (err) {
        console.error(
          `[workflow-scheduler] run failed for workflow=${workflow.id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error("[workflow-scheduler] tick error:", err);
  } finally {
    tickInFlight = false;
  }
}

/**
 * Atomically claim a workflow by advancing nextRunAt to the NEXT firing time
 * (or null if there isn't one), then invoke the run. The atomic update is
 * the single source of truth for "who owns this firing" — if the UPDATE
 * affects 0 rows, another tick or replica beat us to it.
 */
async function claimAndRun(workflow: Workflow) {
  if (!workflow.nextRunAt) return;

  // Compute the next firing time AFTER the current one using lastRunAt=now
  // as the parser's reference point.
  const advanced = getNextRunTime({
    trigger: workflow.trigger,
    scheduleMode: workflow.scheduleMode,
    frequency: workflow.frequency,
    cronExpression: workflow.cronExpression,
    timezone: workflow.timezone,
    enabled: workflow.enabled,
    lastRunAt: new Date()
  });

  const claim = await db.workflow.updateMany({
    where: {
      id: workflow.id,
      // The race window: only claim if nextRunAt hasn't moved since the
      // findMany. Prisma serializes updates on the same row via PostgreSQL
      // so a second concurrent claim will match 0 rows.
      nextRunAt: workflow.nextRunAt,
      enabled: true
    },
    data: {
      nextRunAt: advanced ?? null
    }
  });

  if (claim.count === 0) {
    // Another tick or an admin edit took this slot.
    return;
  }

  // Lazy-import to avoid a circular dependency (workflows repo imports the
  // OpenClaw bridge which imports agent-chat — agent-chat doesn't import the
  // scheduler, so this works either way, but lazy is safer).
  const { runWorkflowScheduled } = await import(
    "@/lib/workflows/scheduled-runner"
  );

  await runWorkflowScheduled(workflow.id);
}

/**
 * Per-tick backfill: any scheduled+enabled workflow that has no nextRunAt
 * gets one computed now. Called on every tick so the scheduler self-heals
 * no matter how a workflow was created or re-enabled — templates, backup
 * restores, bulk business activation, direct DB edits, etc.
 */
async function backfillNextRunAt() {
  const candidates = await db.workflow.findMany({
    where: {
      trigger: "scheduled",
      enabled: true,
      nextRunAt: null
    },
    select: {
      id: true,
      scheduleMode: true,
      frequency: true,
      cronExpression: true,
      timezone: true,
      trigger: true,
      enabled: true,
      lastRunAt: true
    }
  });

  for (const wf of candidates) {
    const next = getNextRunTime(wf);
    if (!next) continue;
    try {
      await db.workflow.update({
        where: { id: wf.id },
        data: { nextRunAt: next }
      });
    } catch (err) {
      console.error(
        `[workflow-scheduler] backfill failed for workflow=${wf.id}:`,
        err
      );
    }
  }

  if (candidates.length > 0) {
    console.log(
      `[workflow-scheduler] backfilled nextRunAt for ${candidates.length} workflow(s)`
    );
  }
}

/** Exposed for test/inspection only. */
export const __test = { tick, backfillNextRunAt };
