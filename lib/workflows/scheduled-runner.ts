/**
 * Scheduled workflow runner.
 *
 * Split out from lib/workflows/scheduler.ts to keep the scheduler's hot path
 * free of heavier imports (OpenClaw bridge + agent-chat) that pull in LLM
 * provider code. The scheduler imports this lazily on first fire so the
 * initial module graph stays small.
 *
 * This replicates the non-approval path of runWorkflowManually from
 * lib/repository/workflows.ts but skips the approval gate (scheduled runs
 * can't interactively wait for approval) and attributes the run to the
 * scheduler rather than a user.
 */

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { runWorkflowOnOpenClaw } from "@/lib/openclaw/workflow-bridge";
import { checkPauseState, pauseMessage } from "@/lib/safety/pause-state";
import {
  maybeDeliverWorkflowToTelegram,
  resolveWorkflowOrganizationId
} from "@/lib/workflows/telegram-output";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Run a scheduled workflow. Assumes the scheduler has already claimed the
 * slot by advancing nextRunAt. Creates an ActionRun, executes the workflow,
 * and records the result. Does NOT advance nextRunAt — that's the scheduler's
 * job.
 */
export async function runWorkflowScheduled(workflowId: string) {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId }
  });

  if (!workflow) {
    console.warn(
      `[workflow-scheduler] skipping run — workflow ${workflowId} not found`
    );
    return;
  }

  if (!workflow.enabled) {
    // Scheduler already filtered on enabled, but check again in case the
    // workflow was disabled between claim and run.
    return;
  }

  // Defense-in-depth pause check. scheduler.tick already skips paused
  // businesses, but this path is also reachable from direct calls (replay,
  // tests, future webhook trigger) so we re-check here.
  if (workflow.businessId) {
    const pause = await checkPauseState({ businessId: workflow.businessId });
    if (pause.paused) {
      console.log(
        `[workflow-scheduler] skip scheduled run for workflow=${workflow.id} — ${pause.scope} paused`
      );
      await db.activityEntry.create({
        data: {
          businessId: workflow.businessId,
          type: "workflow",
          title: "Workflow skipped — paused",
          detail: pauseMessage(pause),
          status: "skipped",
          metadata: {
            workflowId: workflow.id,
            pauseScope: pause.scope
          }
        }
      });
      return;
    }
  }

  // S-9 (2026-05 audit) — Workflow re-run dedup. Skip this fire if there's
  // already an in-flight ActionRun for this workflow within the last 5
  // minutes. Catches the cases where:
  //   - operator manually fires the workflow seconds before the scheduler tick
  //   - a webhook trigger raced with the schedule
  //   - a backfill restored nextRunAt to "now" while a run is already going
  // The atomic claim in scheduler.ts handles tick-vs-tick races; this handles
  // tick-vs-other-trigger races.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existingInFlight = await db.actionRun.findFirst({
    where: {
      workflowId: workflow.id,
      status: { in: ["pending", "running"] },
      createdAt: { gte: fiveMinutesAgo }
    },
    select: { id: true, status: true, createdAt: true }
  });
  if (existingInFlight) {
    console.log(
      `[workflow-scheduler] skipping run — workflow ${workflow.id} already has an in-flight run ${existingInFlight.id} (status=${existingInFlight.status}, started=${existingInFlight.createdAt.toISOString()})`
    );
    return;
  }

  const run = await db.actionRun.create({
    data: {
      businessId: workflow.businessId,
      agentId: workflow.agentId,
      workflowId: workflow.id,
      action: "run_workflow",
      status: "pending",
      reason: "Scheduled trigger",
      startedAt: new Date()
    }
  });

  const runtimeResult = await runWorkflowOnOpenClaw({
    workflowId: workflow.id,
    businessId: workflow.businessId,
    agentId: workflow.agentId,
    trigger: "scheduled"
  });

  const status = runtimeResult.success ? "completed" : "failed";
  const resultSummary = runtimeResult.success
    ? runtimeResult.result ?? { message: "Workflow completed." }
    : { error: runtimeResult.error ?? "Workflow failed." };

  await db.actionRun.update({
    where: { id: run.id },
    data: {
      status,
      result: toJsonValue(resultSummary),
      error: runtimeResult.success
        ? null
        : runtimeResult.error ?? "Workflow failed",
      completedAt: new Date()
    }
  });

  await db.workflow.update({
    where: { id: workflow.id },
    data: {
      lastRunAt: new Date(),
      resultStatus: status,
      lastRunResult: toJsonValue(resultSummary),
      ...(runtimeResult.runtimeJobId
        ? { runtimeJobId: runtimeResult.runtimeJobId }
        : {})
    }
  });

  let telegramDeliveryStatus:
    | { attempted: false }
    | { attempted: true; delivered: boolean; error?: string; output?: string } = {
    attempted: false
  };
  const effectiveOutputs =
    workflow.outputs && workflow.outputs.length > 0
      ? workflow.outputs
      : [workflow.output];
  if (effectiveOutputs.includes("telegram")) {
    const organizationId = await resolveWorkflowOrganizationId(workflow);
    if (organizationId) {
      const delivery = await maybeDeliverWorkflowToTelegram({
        workflow,
        organizationId,
        success: runtimeResult.success,
        result: runtimeResult.result
      });
      telegramDeliveryStatus = { attempted: true, ...delivery };
    } else {
      telegramDeliveryStatus = {
        attempted: true,
        delivered: false,
        error: "Could not resolve organizationId for Telegram delivery."
      };
    }
  }

  await db.activityEntry.create({
    data: {
      businessId: workflow.businessId,
      type: "workflow",
      title: "Workflow ran on schedule",
      detail: runtimeResult.success
        ? `${workflow.name} completed successfully.`
        : `${workflow.name} failed to run.`,
      status,
      metadata: {
        workflowId: workflow.id,
        actionRunId: run.id,
        latencyMs: runtimeResult.latencyMs,
        via: "scheduler",
        telegramDelivery: telegramDeliveryStatus
      }
    }
  });
}
