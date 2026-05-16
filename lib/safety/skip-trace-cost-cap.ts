/**
 * Skip-trace monthly cost cap.
 *
 * Distress-lead skip-trace tools (BatchSkip, Twilio Lookup, DNC scrub,
 * OpenCorporates, Smarty) each charge per-query. The Skip Trace Agent's
 * prompt promises "every query queues an ApprovalRequest" at the
 * default $0/month cap. This module implements that promise.
 *
 * Behavior:
 *   - Read `Business.config.preForeclosure.spendCeilings.skipTraceMonthlyCents`.
 *     Missing/undefined defaults to 0 (every query queues approval).
 *   - Sum cents in `SkipTraceResult.costCents` for this business this
 *     calendar month (UTC month boundary).
 *   - If `currentSpend + estimatedNextCallCost > cap`, create an
 *     ApprovalRequest (or reuse a recent identical one) and return
 *     blocked. Returns allowed=true when the call fits in the budget.
 *
 * This runs INDEPENDENT of `approval-gate.ts`'s DANGEROUS_TOOLS path.
 * `Business.autoApproveExternalActions` does NOT bypass this cap — the
 * cap is the explicit dollar gate, separate from the action-type gate.
 */

import { db } from "@/lib/db";

/**
 * Per-call cents estimate. Used pre-flight when the actual vendor cost
 * is unknown. Smarty is intentionally NOT gated — it's a sub-cent
 * address-normalization that the skip-trace chain depends on upstream
 * of the privacy-sensitive vendors; gating it at the default $0 cap
 * would make Outreach Prep + the field-visit prep flow unusable.
 */
const VENDOR_COST_CENTS: Record<string, number> = {
  batch_skip_lookup: 15,
  twilio_lookup_phone: 2,
  dnc_scrub: 1,
  opencorporates_search: 5
};

export type SkipTraceCostCapResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "monthly_cap_exceeded" | "no_business_context";
      message: string;
      approvalId?: string;
      capCents?: number;
      spentCents?: number;
      requestedCents?: number;
    };

type GateInput = {
  toolName: string;
  businessId: string;
  organizationId: string;
  agentId?: string | null;
  conversationId?: string | null;
  arguments: Record<string, unknown>;
};

/**
 * Check whether a skip-trace tool call fits within the business's monthly
 * cost cap. If not, creates an ApprovalRequest and returns blocked.
 */
export async function gateSkipTraceCost(
  ctx: GateInput
): Promise<SkipTraceCostCapResult> {
  const estCost = VENDOR_COST_CENTS[ctx.toolName] ?? 0;
  if (estCost === 0) return { allowed: true };

  const business = await db.business.findUnique({
    where: { id: ctx.businessId },
    select: { name: true, config: true }
  });
  if (!business) {
    // Upstream handlers will reject anyway, but be explicit.
    return {
      allowed: false,
      reason: "no_business_context",
      message: `Cannot run ${ctx.toolName}: business not found.`
    };
  }

  const cfg =
    business.config && typeof business.config === "object" && !Array.isArray(business.config)
      ? (business.config as Record<string, unknown>)
      : {};
  const pre =
    cfg.preForeclosure && typeof cfg.preForeclosure === "object" && !Array.isArray(cfg.preForeclosure)
      ? (cfg.preForeclosure as Record<string, unknown>)
      : {};
  const ceilings =
    pre.spendCeilings && typeof pre.spendCeilings === "object" && !Array.isArray(pre.spendCeilings)
      ? (pre.spendCeilings as Record<string, unknown>)
      : {};
  const rawCap = ceilings.skipTraceMonthlyCents;
  const capCents =
    typeof rawCap === "number" && Number.isFinite(rawCap) && rawCap >= 0
      ? Math.floor(rawCap)
      : 0;

  // Calendar-month start in UTC (Railway runs UTC).
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );

  const agg = await db.skipTraceResult.aggregate({
    where: {
      businessId: ctx.businessId,
      queriedAt: { gte: monthStart }
    },
    _sum: { costCents: true }
  });
  const spentCents = agg._sum.costCents ?? 0;

  if (spentCents + estCost <= capCents) {
    return { allowed: true };
  }

  // Cap exceeded. Queue approval (with 5-min dedup against same tool+args).
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const cleanArgs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx.arguments)) {
    if (!k.startsWith("_")) cleanArgs[k] = v;
  }
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
    const detail = existing.actionDetail as
      | { toolName?: string; argsKey?: string }
      | null;
    if (detail && detail.toolName === ctx.toolName && detail.argsKey === argsKey) {
      return buildBlocked({
        approvalId: existing.id,
        businessName: business.name,
        toolName: ctx.toolName,
        capCents,
        spentCents,
        requestedCents: estCost
      });
    }
  }

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
        conversationId: ctx.conversationId ?? null,
        capReason: "skip_trace_monthly_cap_exceeded",
        capCents,
        spentCents,
        requestedCents: estCost
      },
      expiresAt
    }
  });

  await db.activityEntry
    .create({
      data: {
        businessId: ctx.businessId,
        type: "approval",
        title: `Skip-trace cap exceeded — ${humanize(ctx.toolName)} pending approval`,
        detail: `Monthly cap $${(capCents / 100).toFixed(2)}; already spent $${(spentCents / 100).toFixed(2)}; this call $${(estCost / 100).toFixed(2)}.`,
        status: "pending",
        metadata: { approvalId: approval.id }
      }
    })
    .catch(() => {});

  return buildBlocked({
    approvalId: approval.id,
    businessName: business.name,
    toolName: ctx.toolName,
    capCents,
    spentCents,
    requestedCents: estCost
  });
}

function buildBlocked(args: {
  approvalId: string;
  businessName: string;
  toolName: string;
  capCents: number;
  spentCents: number;
  requestedCents: number;
}): SkipTraceCostCapResult {
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  return {
    allowed: false,
    reason: "monthly_cap_exceeded",
    approvalId: args.approvalId,
    capCents: args.capCents,
    spentCents: args.spentCents,
    requestedCents: args.requestedCents,
    message: [
      `Skip-trace blocked: monthly cap exceeded for ${args.businessName}.`,
      `Cap: ${fmt(args.capCents)} · Spent: ${fmt(args.spentCents)} · This call: ${fmt(args.requestedCents)}.`,
      `Approval ID: ${args.approvalId}`,
      `An operator must approve at /admin/approvals, OR raise the cap at /admin/businesses/[id]/foreclosures/compliance (Business.config.preForeclosure.spendCeilings.skipTraceMonthlyCents). Do not retry the same tool call in this turn.`
    ].join("\n")
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function humanize(toolName: string): string {
  return toolName.replaceAll("_", " ");
}
