/**
 * Approval gate for dangerous tools.
 *
 * Any tool listed in DANGEROUS_TOOLS performs an external action with real
 * blast radius — sending an email, posting to social, replying on Reddit,
 * placing a forex order, charging a card. Before such a tool fires, the
 * gate creates an ApprovalRequest tied to the agent's business, returns a
 * pending-approval marker to the LLM (which surfaces it to the operator),
 * and lets the operator approve or reject the action in /admin/approvals.
 *
 * The gate is bypassed when Business.autoApproveExternalActions is true,
 * which an operator can flip per-business once they explicitly trust the
 * agent team for that surface.
 *
 * Approved tool calls are re-executed via executeApprovedToolCall(), invoked
 * by approveRequest() when the action type is "tool_call". The original
 * agentId/businessId/organizationId/conversationId are preserved on the
 * approval's actionDetail JSON so the re-execution lands in the same scope.
 */

import { db } from "@/lib/db";

// ── Dangerous-tool registry ───────────────────────────────────────

/**
 * Tools that require operator approval by default.
 *
 * Add tools here when their execution has any of:
 *   - external network side effect that can't be undone (sent email, posted
 *     content, charged card, placed trade order)
 *   - reputational risk (publishes under a customer's brand)
 *   - cost > a few cents per call
 *
 * Read-only tools (search, lookup, list) should NOT be on this list.
 * Internal-state tools (memory_store, propose_todo, log_*) should NOT be
 * on this list — they're either reversible or already audit-trailed.
 *
 * Trading order tools (oanda_place_order, tradovate_place_order,
 * oanda_close_position, oanda_modify_order) are NOT listed here because
 * they already have a dedicated approval flow gated by Business.tradingMode.
 * Adding them here would double-gate.
 */
export const DANGEROUS_TOOLS = new Set<string>([
  // Email / SMS
  "send_email",
  "send_sms",

  // Telegram outbound (proactive, not in-thread replies)
  "send_telegram_message",

  // Social publishing (Late / Ayrshare via the social-media MCP)
  "social_publish_post",

  // Reddit posting / replying
  "reddit_create_post",
  "reddit_reply_to_post",

  // Blotato publishing (multi-platform poster)
  "blotato_create_post",
  // Schedule mutations write to the queue Blotato will publish from, so
  // they're equivalent to scheduling a post.
  "blotato_update_schedule",
  "blotato_create_schedule_slots",
  "blotato_update_schedule_slot",
  "blotato_delete_schedule",
  "blotato_delete_schedule_slot",

  // Outbound prospecting / cold outreach (each fires a real message)
  "instantly_launch_campaign",
  "instantly_send_reply",
  "whatsapp_send_text_message",
  "whatsapp_send_template_message",
  "whatsapp_send_media_message",
  "sendpilot_send_dm",
  "sendpilot_send_connection_request",
  "manychat_send_content",
  "manychat_send_flow",
  "slack_outreach_invite_connect_by_email",
  "slack_outreach_post_message",

  // Video upload / publishing
  "youtube_upload_video",
  "youtube_post_community_update",

  // Dealhawk outbound — these draft + may auto-fire depending on mode
  "dealhawk_draft_outreach",
  "dealhawk_log_touch"
]);

/** Whether a tool requires approval before execution. */
export function requiresApproval(toolName: string): boolean {
  return DANGEROUS_TOOLS.has(toolName);
}

// ── Gate logic ─────────────────────────────────────────────────────

export type GateResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "approval_pending" | "approval_required" | "no_business_context";
      message: string;
      approvalId?: string;
    };

type GateContext = {
  toolName: string;
  arguments: Record<string, unknown>;
  agentId?: string | null;
  businessId?: string | null;
  organizationId: string;
  conversationId?: string | null;
};

/**
 * Check whether a dangerous tool call should proceed. When the business has
 * autoApproveExternalActions=true the gate is a no-op. Otherwise the call is
 * blocked and an ApprovalRequest is created (or reused if one is pending for
 * the same tool+args within the last 5 minutes).
 *
 * Returns allowed=true when:
 *   - the tool is not dangerous
 *   - the business has opted into auto-approval
 *   - this call is re-running an already-approved request (bypass=true)
 */
export async function gateToolCall(
  ctx: GateContext,
  options: { bypass?: boolean } = {}
): Promise<GateResult> {
  if (options.bypass) return { allowed: true };
  if (!requiresApproval(ctx.toolName)) return { allowed: true };

  // External actions are always tied to a business. Without one we can't
  // route the approval anywhere safe — block.
  if (!ctx.businessId) {
    return {
      allowed: false,
      reason: "no_business_context",
      message: `Cannot run ${ctx.toolName}: no business context. External-action tools must be invoked from a business-scoped agent.`
    };
  }

  // Bypass when the business opts in.
  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { autoApproveExternalActions: true, name: true }
  });
  if (!business) {
    return {
      allowed: false,
      reason: "no_business_context",
      message: `Cannot run ${ctx.toolName}: business not found.`
    };
  }
  if (business.autoApproveExternalActions) {
    return { allowed: true };
  }

  // Dedup: if an identical pending approval was created in the last 5 min,
  // reuse it rather than spamming the approvals inbox when the agent retries.
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const cleanArgs = stripContextKeys(ctx.arguments);
  const argsKey = stableStringify(cleanArgs);

  const existing = await db.approvalRequest.findFirst({
    where: {
      businessId: ctx.businessId,
      agentId: ctx.agentId ?? undefined,
      actionType: "tool_call",
      status: "pending",
      createdAt: { gte: fiveMinAgo }
    },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    const existingDetail = existing.actionDetail as
      | { toolName?: string; argsKey?: string }
      | null;
    if (
      existingDetail &&
      existingDetail.toolName === ctx.toolName &&
      existingDetail.argsKey === argsKey
    ) {
      return {
        allowed: false,
        reason: "approval_pending",
        approvalId: existing.id,
        message: pendingMessage(ctx.toolName, business.name, existing.id)
      };
    }
  }

  // Create a fresh approval. 7-day expiry — long enough that an operator
  // who steps away over a weekend can still act, short enough that stale
  // drafts get auto-expired and don't clutter the inbox forever.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const approval = await db.approvalRequest.create({
    data: {
      businessId: ctx.businessId,
      agentId: ctx.agentId ?? null,
      actionType: "tool_call",
      actionDetail: {
        toolName: ctx.toolName,
        argsKey,
        arguments: cleanArgs as unknown as object,
        organizationId: ctx.organizationId,
        conversationId: ctx.conversationId ?? null
      },
      expiresAt
    }
  });

  // Mirror to ActivityEntry so the action surfaces in the Today + Inbox
  // panels without the operator needing to open /admin/approvals.
  await db.activityEntry
    .create({
      data: {
        businessId: ctx.businessId,
        type: "approval",
        title: `${humanizeTool(ctx.toolName)} pending approval`,
        detail: summarizeArgs(ctx.toolName, cleanArgs),
        status: "pending",
        metadata: {
          approvalId: approval.id,
          actionType: "tool_call",
          toolName: ctx.toolName,
          agentId: ctx.agentId ?? null
        }
      }
    })
    .catch((err) => {
      import("@/lib/observability/logger").then(({ getLogger }) =>
        getLogger("approval-gate").warn("activity entry mirror failed", { err })
      );
    });

  return {
    allowed: false,
    reason: "approval_required",
    approvalId: approval.id,
    message: pendingMessage(ctx.toolName, business.name, approval.id)
  };
}

// ── Approved tool-call execution ──────────────────────────────────

export type ApprovedToolPayload = {
  toolName: string;
  arguments: Record<string, unknown>;
  organizationId: string;
  agentId?: string | null;
  businessId: string;
  conversationId?: string | null;
};

/** Extract the original tool-call payload from an approved ApprovalRequest. */
export function readApprovedToolPayload(
  actionType: string,
  actionDetail: unknown
): ApprovedToolPayload | null {
  if (actionType !== "tool_call") return null;
  if (!actionDetail || typeof actionDetail !== "object" || Array.isArray(actionDetail)) {
    return null;
  }
  const d = actionDetail as Record<string, unknown>;
  const toolName = typeof d.toolName === "string" ? d.toolName : null;
  const organizationId = typeof d.organizationId === "string" ? d.organizationId : null;
  const args =
    d.arguments && typeof d.arguments === "object" && !Array.isArray(d.arguments)
      ? (d.arguments as Record<string, unknown>)
      : null;
  if (!toolName || !organizationId || !args) return null;

  return {
    toolName,
    arguments: args,
    organizationId,
    agentId: typeof d.agentId === "string" ? d.agentId : null,
    businessId: "",
    conversationId: typeof d.conversationId === "string" ? d.conversationId : null
  };
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Drop ephemeral context keys that the executor injects so they don't show
 * up in the operator's approval detail or the dedup key.
 */
function stripContextKeys(args: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k.startsWith("_")) continue; // _agentId, _businessId, _organizationId, _conversationId
    cleaned[k] = v;
  }
  return cleaned;
}

/**
 * Deterministic JSON stringification used as the dedup key. Sorts object
 * keys recursively so {a:1,b:2} and {b:2,a:1} produce the same string.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function humanizeTool(toolName: string): string {
  return toolName.replaceAll("_", " ");
}

function summarizeArgs(toolName: string, args: Record<string, unknown>): string {
  // Pick the most useful field per tool for a quick glance in the inbox.
  const summaries: Array<[string, string]> = [
    ["send_email", "to"],
    ["send_sms", "to"],
    ["send_telegram_message", "chat_id"],
    ["social_publish_post", "content"],
    ["reddit_create_post", "title"],
    ["reddit_reply_to_post", "comment"],
    ["blotato_create_post", "text"],
    ["youtube_upload_video", "title"]
  ];

  for (const [tool, field] of summaries) {
    if (toolName === tool) {
      const v = args[field];
      if (typeof v === "string" && v.length > 0) {
        const trimmed = v.length > 200 ? `${v.slice(0, 200)}…` : v;
        return `${humanizeTool(toolName)}: ${trimmed}`;
      }
    }
  }

  const keys = Object.keys(args).slice(0, 3).join(", ");
  return keys
    ? `${humanizeTool(toolName)} (${keys})`
    : `${humanizeTool(toolName)}`;
}

function pendingMessage(toolName: string, businessName: string, approvalId: string): string {
  return [
    `Action queued for approval: ${humanizeTool(toolName)} for ${businessName}.`,
    `Approval ID: ${approvalId}`,
    `An operator must approve this at /admin/approvals before it executes. Tell the user this action is pending — do not retry the same tool call in this turn.`
  ].join("\n");
}
