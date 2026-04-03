/**
 * Workflow Bridge — connects Mission Control workflows to the real OpenClaw API.
 *
 * Workflow execution uses POST /hooks/agent for isolated agent turns.
 * Schedule sync uses POST /v1/chat/completions to instruct the agent to
 * register a cron job via the built-in cron tool.
 */

import { performance } from "node:perf_hooks";

import type { Workflow } from "@prisma/client";

import { db } from "@/lib/db";
import {
  chatCompletion,
  hooksAgent,
  isConfigured,
  type ChatMessage
} from "@/lib/openclaw/client";

type RunWorkflowParams = {
  workflowId: string;
  businessId: string;
  agentId?: string | null;
  trigger: string;
  payload?: Record<string, unknown>;
};

function buildWorkflowPrompt(params: RunWorkflowParams): string {
  const payloadSummary =
    params.payload && Object.keys(params.payload).length > 0
      ? `\n\nIncoming payload:\n${JSON.stringify(params.payload, null, 2)}`
      : "";

  return [
    `Execute workflow ${params.workflowId} for business ${params.businessId}.`,
    `Trigger: ${params.trigger}.`,
    params.agentId ? `Agent: ${params.agentId}.` : "",
    `Process the task described by this workflow and return a structured result.`,
    payloadSummary
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runWorkflowOnOpenClaw(params: RunWorkflowParams) {
  if (!isConfigured()) {
    return {
      success: false,
      error: "OpenClaw not configured",
      latencyMs: 0
    };
  }

  const prompt = buildWorkflowPrompt(params);

  // Use /hooks/agent for an isolated one-shot agent turn.
  // This is the correct OpenClaw endpoint for running a task
  // that should not persist in a long-running conversation session.
  const result = await hooksAgent(
    {
      message: prompt,
      sessionKey: `workflow:${params.workflowId}`
    },
    30_000
  );

  return {
    success: result.success,
    runtimeJobId: result.data?.jobId as string | undefined,
    result: result.data,
    error: result.success ? undefined : result.error || "Workflow run failed",
    latencyMs: result.latencyMs
  };
}

/**
 * Sync a scheduled workflow to OpenClaw's cron system.
 *
 * OpenClaw manages cron jobs internally. We instruct the agent to
 * create or update a cron entry via the chat completions API,
 * or we can use the tools/invoke endpoint to call the cron tool directly.
 *
 * For now, we use /v1/chat/completions to ask the agent to register
 * the schedule. The agent has access to built-in cron tools.
 */
export async function syncWorkflowSchedule(workflow: Workflow) {
  if (!isConfigured()) {
    return {
      synced: false,
      error: "OpenClaw not configured"
    };
  }

  // Build a schedule description the agent can understand
  let scheduleDescription = "";
  if (workflow.scheduleMode === "cron" && workflow.cronExpression) {
    scheduleDescription = `cron expression: ${workflow.cronExpression}`;
  } else if (workflow.scheduleMode === "every" && workflow.frequency) {
    scheduleDescription = `every ${workflow.frequency}`;
  } else {
    // definition_only or no schedule — nothing to sync
    return {
      synced: true,
      runtimeJobId: workflow.runtimeJobId ?? undefined
    };
  }

  const timezone = workflow.timezone || "UTC";
  const enabledText = workflow.enabled ? "enabled" : "disabled (paused)";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You are a workflow scheduler. Register or update a cron job using the built-in cron tools.",
        "Respond only with the job ID or confirmation. Do not add commentary."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Register a scheduled job for workflow "${workflow.id}".`,
        `Schedule: ${scheduleDescription}.`,
        `Timezone: ${timezone}.`,
        `Status: ${enabledText}.`,
        `Business: ${workflow.businessId}.`,
        workflow.agentId ? `Agent: ${workflow.agentId}.` : "",
        `When triggered, execute the workflow task and report the result.`
      ]
        .filter(Boolean)
        .join("\n")
    }
  ];

  const result = await chatCompletion(
    {
      messages,
      sessionKey: `workflow-schedule:${workflow.id}`
    },
    15_000
  );

  if (!result.success) {
    return {
      synced: false,
      error: result.error || "Schedule sync failed"
    };
  }

  // Extract a job ID from the agent's response if present
  const responseText =
    result.data?.choices?.[0]?.message?.content ?? "";

  // Try to find a job ID pattern in the response (UUID or cron job id)
  const jobIdMatch = responseText.match(
    /(?:job[_\s-]*id[:\s]*)?([a-f0-9-]{8,36})/i
  );
  const runtimeJobId = jobIdMatch?.[1] || workflow.runtimeJobId;

  if (runtimeJobId && runtimeJobId !== workflow.runtimeJobId) {
    await db.workflow.update({
      where: { id: workflow.id },
      data: { runtimeJobId }
    });
  }

  return {
    synced: true,
    runtimeJobId: runtimeJobId ?? undefined
  };
}
