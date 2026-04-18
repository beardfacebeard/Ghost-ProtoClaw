/**
 * Automatic Telegram delivery for workflows with output="telegram".
 *
 * When a workflow completes, the core runner previously only persisted the
 * result to the DB and left it to the agent to remember to call
 * send_telegram_message. That's fragile — the LLM could easily hallucinate
 * having "sent the summary" without ever invoking the tool.
 *
 * This helper takes the finished result and posts it to Telegram directly,
 * using the same send_telegram_message handler the agent would have. It
 * reuses all the target-resolution logic (explicit chat_id > chats paired
 * with the agent via /start > default integration chat_id).
 */

import type { Workflow } from "@prisma/client";

import { db } from "@/lib/db";
import { executeTool } from "@/lib/mcp/tool-executor";

type WorkflowResult = unknown;

/** Extract a plain-text response from a workflow result payload. */
function extractResponseText(result: WorkflowResult): string | null {
  if (!result || typeof result !== "object") return null;
  if (Array.isArray(result)) return null;
  const record = result as Record<string, unknown>;
  if (typeof record.response === "string" && record.response.trim().length > 0) {
    return record.response.trim();
  }
  // Fall back to a formatted JSON snippet so the Telegram message is never
  // empty when the runner returns something we don't know how to unwrap.
  try {
    const snippet = JSON.stringify(record, null, 2);
    return snippet.length > 3500 ? snippet.slice(0, 3500) + "…" : snippet;
  } catch {
    return null;
  }
}

/**
 * Deliver a completed workflow's result to Telegram. Safe to call for any
 * workflow; it no-ops unless output === "telegram" and the run succeeded.
 * Failures here don't fail the workflow — they're logged and surfaced in
 * the ActionRun metadata so the Pulse view can show them.
 */
export async function maybeDeliverWorkflowToTelegram(params: {
  workflow: Pick<
    Workflow,
    "id" | "output" | "businessId" | "agentId" | "name"
  >;
  organizationId: string;
  success: boolean;
  result: WorkflowResult;
}): Promise<{ delivered: boolean; error?: string; output?: string }> {
  if (!params.success) return { delivered: false };
  if (params.workflow.output !== "telegram") return { delivered: false };

  const text = extractResponseText(params.result);
  if (!text) {
    return {
      delivered: false,
      error:
        "Workflow output=telegram but the result had no text to deliver."
    };
  }

  // Prepend the workflow name so the user knows what generated this message.
  const framed = `📨 *${params.workflow.name}*\n\n${text}`;

  try {
    const toolResult = await executeTool({
      toolName: "send_telegram_message",
      arguments: { text: framed },
      mcpServerId: "__builtin__",
      organizationId: params.organizationId,
      agentId: params.workflow.agentId ?? undefined,
      businessId: params.workflow.businessId
    });

    if (!toolResult.success) {
      return { delivered: false, error: toolResult.error };
    }

    return { delivered: true, output: toolResult.output };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Resolve the organizationId for a workflow. The Workflow model has a
 * nullable organizationId column; fall back to the owning business when it's
 * unset so the Telegram helper always has a non-null org.
 */
export async function resolveWorkflowOrganizationId(
  workflow: Pick<Workflow, "organizationId" | "businessId">
): Promise<string | null> {
  if (workflow.organizationId) return workflow.organizationId;
  const business = await db.business.findUnique({
    where: { id: workflow.businessId },
    select: { organizationId: true }
  });
  return business?.organizationId ?? null;
}
