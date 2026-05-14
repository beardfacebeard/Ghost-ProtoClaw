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
import { getLogger } from "@/lib/observability/logger";
import { checkPauseState } from "@/lib/safety/pause-state";
import { getNextRunTime } from "@/lib/workflows/schedule-parser";

const log = getLogger("scheduler");

const TICK_INTERVAL_MS = 30_000;
const MAX_WORKFLOWS_PER_TICK = 25;
/** A single hung workflow used to freeze the entire tick loop because the
 *  for-loop awaited each claimAndRun() serially with no upper bound. This
 *  cap converts hangs into per-workflow failures the operator can see in
 *  the activity feed, while letting healthy workflows keep firing. */
const WORKFLOW_RUN_TIMEOUT_MS = 60_000;
/** Parallelism cap inside a single tick. Workflows are independent across
 *  businesses; running them in parallel cuts tick latency. Each business
 *  gets at most one workflow per tick anyway (atomic claim on nextRunAt)
 *  so cross-tenant contention stays bounded. */
const WORKFLOW_PARALLEL_LIMIT = 5;

let tickTimer: NodeJS.Timeout | null = null;
let tickInFlight = false;
let started = false;

/** Start the scheduler's tick loop. Safe to call multiple times — subsequent calls are no-ops. */
export function startWorkflowScheduler() {
  if (started) return;
  started = true;

  log.info("scheduler starting", { tickIntervalMs: TICK_INTERVAL_MS });

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
        sweepStuckActionRuns,
        sweepOldActivity
      } = await import("@/lib/workflows/delegation-executor");
      await sweepStuckDelegations();
      await sweepStuckActionRuns();
      await sweepOldActivity();
      await runPendingDelegations();
    } catch (err) {
      log.error("delegation executor failed during tick", { err });
    }

    // Todo due-date reminders. Finds todos where the due date is in the
    // next 24h (or just went overdue), the item still needs attention,
    // and we haven't already nudged — then Telegrams the user ONCE per
    // item. Non-fatal: a reminder failure doesn't poison the rest of
    // the tick.
    try {
      const { runTodoReminders } = await import(
        "@/lib/workflows/todo-reminders"
      );
      await runTodoReminders();
    } catch (err) {
      log.error("todo reminders failed during tick", { err });
    }

    // expiresAt sweep. AgentMemory has supported expiresAt since its
    // first migration but nothing ever enforced it; the May 2026 audit
    // flagged it as a leak. We also reuse the existing expireStaleApprovals
    // here so both lifecycle-managed tables get cleaned on every tick.
    try {
      const { sweepExpiredMemories } = await import("@/lib/repository/memory");
      const { expireStaleApprovals } = await import("@/lib/repository/approvals");
      const [memCount, approvalCount] = await Promise.all([
        sweepExpiredMemories(),
        expireStaleApprovals()
      ]);
      if (memCount > 0 || approvalCount > 0) {
        log.info("expiresAt sweep ran", {
          memoriesDeleted: memCount,
          approvalsExpired: approvalCount
        });
      }
    } catch (err) {
      log.error("expiresAt sweep failed", { err });
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

    // Run in bounded-parallel chunks. Per-run timeout wraps claimAndRun so
    // one hung workflow can't freeze the loop or its peers in the same
    // chunk — it gets recorded as failed and the next chunk proceeds.
    for (let i = 0; i < due.length; i += WORKFLOW_PARALLEL_LIMIT) {
      const chunk = due.slice(i, i + WORKFLOW_PARALLEL_LIMIT);
      await Promise.allSettled(
        chunk.map((workflow) => runWithTimeout(workflow))
      );
    }
  } catch (err) {
    log.error("scheduler tick failed", { err });
  } finally {
    tickInFlight = false;
  }
}

/**
 * Wrap claimAndRun in a hard timeout so a single hung workflow can't freeze
 * the scheduler. On timeout the workflow is marked failed with a clear
 * reason; the operator sees it in the activity feed and can investigate.
 *
 * The underlying claimAndRun() may still be running in the background when
 * we return — that's fine. The next tick won't re-pick the same row
 * because the atomic claim already advanced nextRunAt.
 */
async function runWithTimeout(workflow: Workflow) {
  let timedOut = false;
  const timeoutPromise = new Promise<"timeout">((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve("timeout");
    }, WORKFLOW_RUN_TIMEOUT_MS).unref?.();
  });

  try {
    const result = await Promise.race([claimAndRun(workflow), timeoutPromise]);
    if (result === "timeout") {
      log.error("workflow run exceeded timeout budget — marking failed", {
        workflowId: workflow.id,
        workflowName: workflow.name,
        timeoutMs: WORKFLOW_RUN_TIMEOUT_MS,
        businessId: workflow.businessId
      });

      // Operator alert — a hung workflow is a "you'd want to know" event.
      // Fire-and-forget so the timeout cleanup below doesn't wait on it.
      void (async () => {
        try {
          const business = workflow.businessId
            ? await db.business.findUnique({
                where: { id: workflow.businessId },
                select: { organizationId: true, name: true }
              })
            : null;
          if (business?.organizationId) {
            const { notifyOperator } = await import("@/lib/alerts/dispatcher");
            await notifyOperator({
              organizationId: business.organizationId,
              source: "scheduler",
              key: `workflow_timeout:${workflow.id}`,
              severity: "high",
              title: `Workflow timed out: ${workflow.name}`,
              message: `The workflow "${workflow.name}" for ${business.name} exceeded the ${
                WORKFLOW_RUN_TIMEOUT_MS / 1000
              }s scheduler budget. It has been marked failed; the next regularly-scheduled fire will retry.`,
              context: {
                workflowId: workflow.id,
                businessId: workflow.businessId
              }
            });
          }
        } catch (err) {
          log.warn("workflow-timeout alert dispatch failed", {
            workflowId: workflow.id,
            err
          });
        }
      })();
      // Record the timeout so the operator can find it in /admin/activity.
      // Best-effort — if this DB write fails we still continue.
      try {
        await db.actionRun.create({
          data: {
            businessId: workflow.businessId,
            agentId: workflow.agentId,
            workflowId: workflow.id,
            action: "run_workflow",
            status: "failed",
            reason: "Scheduler timeout",
            error: `Workflow exceeded the ${
              WORKFLOW_RUN_TIMEOUT_MS / 1000
            }s per-run budget and was abandoned by the scheduler.`,
            startedAt: new Date(),
            completedAt: new Date()
          }
        });
        await db.activityEntry.create({
          data: {
            businessId: workflow.businessId,
            type: "workflow",
            title: "Workflow timed out",
            detail: `${workflow.name} hit the ${
              WORKFLOW_RUN_TIMEOUT_MS / 1000
            }s scheduler budget and was abandoned.`,
            status: "failed",
            metadata: {
              workflowId: workflow.id,
              timeoutMs: WORKFLOW_RUN_TIMEOUT_MS
            }
          }
        });
      } catch (err) {
        log.error("failed to record workflow timeout", {
          workflowId: workflow.id,
          err
        });
      }
    }
  } catch (err) {
    if (!timedOut) {
      log.error("workflow run threw", { workflowId: workflow.id, err });
    }
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

  // Honor the operator kill switch. If either the workflow's business or
  // its parent org is paused, we still advance nextRunAt (so we don't pile
  // up overdue firings while paused) but skip the actual run. When the
  // pause is cleared, the next regularly-scheduled firing executes.
  if (workflow.businessId) {
    const pause = await checkPauseState({
      businessId: workflow.businessId
    });
    if (pause.paused) {
      const advanced = getNextRunTime({
        trigger: workflow.trigger,
        scheduleMode: workflow.scheduleMode,
        frequency: workflow.frequency,
        cronExpression: workflow.cronExpression,
        timezone: workflow.timezone,
        enabled: workflow.enabled,
        lastRunAt: new Date()
      });
      await db.workflow.updateMany({
        where: { id: workflow.id, nextRunAt: workflow.nextRunAt },
        data: { nextRunAt: advanced ?? null }
      });
      log.info("skipping workflow — paused", {
        workflowId: workflow.id,
        pauseScope: pause.scope,
        businessId: workflow.businessId
      });
      return;
    }
  }

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
      log.error("backfill of nextRunAt failed", { workflowId: wf.id, err });
    }
  }

  if (candidates.length > 0) {
    log.info("backfilled nextRunAt", { count: candidates.length });
  }
}

/** Exposed for test/inspection only. */
export const __test = { tick, backfillNextRunAt };
