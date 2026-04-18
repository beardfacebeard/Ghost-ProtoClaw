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
import { buildWorkflowContext } from "@/lib/prompts/build-system-prompt";

type RunWorkflowParams = {
  workflowId: string;
  businessId: string;
  agentId?: string | null;
  trigger: string;
  payload?: Record<string, unknown>;
};

async function resolveWorkflowContext(params: RunWorkflowParams) {
  // Fetch agent and business context for rich prompt injection
  const [agent, business] = await Promise.all([
    params.agentId
      ? db.agent.findUnique({
          where: { id: params.agentId },
          select: {
            displayName: true,
            role: true,
            purpose: true,
            systemPrompt: true,
            roleInstructions: true,
            outputStyle: true,
            escalationRules: true
          }
        })
      : null,
    db.business.findUnique({
      where: { id: params.businessId },
      select: {
        name: true,
        summary: true,
        brandVoice: true,
        mainGoals: true,
        coreOffers: true,
        systemPrompt: true,
        guardrails: true,
        offerAndAudienceNotes: true,
        bannedClaims: true,
        safetyMode: true
      }
    })
  ]);

  return { agent, business };
}

function buildWorkflowPrompt(
  params: RunWorkflowParams,
  contextBlock: string
): string {
  const payloadSummary =
    params.payload && Object.keys(params.payload).length > 0
      ? `\n\nIncoming payload:\n${JSON.stringify(params.payload, null, 2)}`
      : "";

  return [
    contextBlock,
    "",
    `Execute workflow ${params.workflowId}.`,
    `Trigger: ${params.trigger}.`,
    `Process the task described by this workflow and return a structured result.`,
    payloadSummary
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runWorkflowOnOpenClaw(params: RunWorkflowParams) {
  const { agent, business } = await resolveWorkflowContext(params);
  const contextBlock = buildWorkflowContext(agent, business);
  const prompt = buildWorkflowPrompt(params, contextBlock);

  // Prefer OpenClaw when it's configured and reachable — it's the intended
  // runtime for long-running / isolated workflow executions. If OpenClaw
  // returns an error, fall through to the in-process path instead of failing
  // the whole run; that way a flaky gateway doesn't block manual runs.
  if (isConfigured()) {
    const result = await hooksAgent(
      {
        message: prompt,
        sessionKey: `workflow:${params.workflowId}`
      },
      30_000
    );

    if (result.success) {
      return {
        success: true,
        runtimeJobId: result.data?.jobId as string | undefined,
        result: result.data,
        error: undefined,
        latencyMs: result.latencyMs
      };
    }

    // Fall through to in-process execution on OpenClaw failure.
  }

  return executeWorkflowInProcess(params, prompt);
}

/**
 * In-process workflow execution. Runs the workflow through the same
 * executeAgentChat pipeline that powers the chat UI, which means the agent
 * has access to the full tool set — including send_telegram_message,
 * memory_recall, and anything else registered as a built-in or MCP tool.
 *
 * This is the fallback path when OpenClaw isn't configured (which is the
 * default on minimal deploys) or when the gateway call fails. Without this
 * fallback, manual "Run Now" and scheduled workflow runs would silently
 * return 0% success rate.
 */
async function executeWorkflowInProcess(
  params: RunWorkflowParams,
  prompt: string
) {
  const startedAt = performance.now();

  if (!params.agentId) {
    return {
      success: false as const,
      error:
        "Cannot run workflow in-process: no agent assigned. Pick an agent on the workflow and try again, or configure OpenClaw to run agentless workflows.",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }

  const agent = await db.agent.findUnique({
    where: { id: params.agentId },
    include: { business: true }
  });

  if (!agent) {
    return {
      success: false as const,
      error: `Assigned agent ${params.agentId} was not found.`,
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }

  const business =
    agent.business ??
    (await db.business.findUnique({ where: { id: params.businessId } }));

  const organizationId =
    agent.organizationId ?? business?.organizationId ?? null;

  if (!organizationId) {
    return {
      success: false as const,
      error:
        "Cannot resolve organization for this workflow. Re-assign the workflow to an agent attached to a business.",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }

  const { executeAgentChat, buildChatMessages } = await import(
    "@/lib/llm/agent-chat"
  );

  const { messages, tools } = await buildChatMessages(
    agent as Record<string, unknown>,
    business as Record<string, unknown> | null,
    [],
    prompt,
    organizationId,
    agent.businessId
  );

  const result = await executeAgentChat({
    agent: agent as unknown as Parameters<typeof executeAgentChat>[0]["agent"],
    business: business as unknown as Parameters<
      typeof executeAgentChat
    >[0]["business"],
    messages: messages as ChatMessage[],
    organizationId,
    endpoint: "workflow_run",
    tools
  });

  const latencyMs = Math.round(performance.now() - startedAt);

  if (!result.success) {
    return {
      success: false as const,
      error: result.error || "Workflow run failed",
      latencyMs
    };
  }

  return {
    success: true as const,
    runtimeJobId: undefined,
    result: {
      response: result.response,
      model: result.model,
      toolsUsed: result.toolsUsed,
      via: "in_process"
    },
    error: undefined,
    latencyMs
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
