import { performance } from "node:perf_hooks";

import type { Workflow } from "@prisma/client";

import { db } from "@/lib/db";

type RunWorkflowParams = {
  workflowId: string;
  businessId: string;
  agentId?: string | null;
  trigger: string;
  payload?: Record<string, unknown>;
  openclawUrl?: string;
  openclawToken?: string;
};

export async function runWorkflowOnOpenClaw(params: RunWorkflowParams) {
  const openclawUrl =
    params.openclawUrl ||
    process.env.OPENCLAW_API_URL ||
    process.env.OPENCLAW_GATEWAY_URL;

  if (!openclawUrl) {
    return {
      success: false,
      error: "OpenClaw not configured",
      latencyMs: 0
    };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(
      `${openclawUrl.replace(/\/$/, "")}/workflows/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(params.openclawToken || process.env.OPENCLAW_GATEWAY_TOKEN
            ? {
                Authorization: `Bearer ${params.openclawToken || process.env.OPENCLAW_GATEWAY_TOKEN}`
              }
            : {})
        },
        body: JSON.stringify({
          workflowId: params.workflowId,
          businessId: params.businessId,
          agentId: params.agentId ?? undefined,
          trigger: params.trigger,
          payload: params.payload ?? {}
        }),
        signal: AbortSignal.timeout(30_000)
      }
    );

    const payload = (await response.json().catch(() => null)) as
      | {
          runtimeJobId?: string;
          result?: unknown;
          error?: string;
        }
      | null;

    return {
      success: response.ok,
      runtimeJobId: payload?.runtimeJobId,
      result: payload?.result,
      error: response.ok ? undefined : payload?.error || "Workflow run failed",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unable to reach OpenClaw",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

export async function syncWorkflowSchedule(workflow: Workflow) {
  const openclawUrl =
    process.env.OPENCLAW_API_URL || process.env.OPENCLAW_GATEWAY_URL;

  if (!openclawUrl) {
    return {
      synced: false,
      error: "OpenClaw not configured"
    };
  }

  try {
    const response = await fetch(
      `${openclawUrl.replace(/\/$/, "")}/workflows/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.OPENCLAW_GATEWAY_TOKEN
            ? {
                Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`
              }
            : {})
        },
        body: JSON.stringify({
          workflowId: workflow.id,
          businessId: workflow.businessId,
          agentId: workflow.agentId,
          trigger: workflow.trigger,
          enabled: workflow.enabled,
          scheduleMode: workflow.scheduleMode,
          cronExpression: workflow.cronExpression,
          frequency: workflow.frequency,
          timezone: workflow.timezone
        }),
        signal: AbortSignal.timeout(15_000)
      }
    );

    const payload = (await response.json().catch(() => null)) as
      | {
          runtimeJobId?: string;
          error?: string;
        }
      | null;

    if (!response.ok || !payload?.runtimeJobId) {
      return {
        synced: false,
        error: payload?.error || "Schedule sync failed"
      };
    }

    await db.workflow.update({
      where: {
        id: workflow.id
      },
      data: {
        runtimeJobId: payload.runtimeJobId
      }
    });

    return {
      synced: true,
      runtimeJobId: payload.runtimeJobId
    };
  } catch (error) {
    return {
      synced: false,
      error:
        error instanceof Error ? error.message : "Unable to sync workflow schedule"
    };
  }
}
