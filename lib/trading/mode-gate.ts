import { db } from "@/lib/db";

/**
 * Resolves the current tradingMode for a business. Returns "research" if
 * the business doesn't exist or has no tradingMode set — the safest tier.
 *
 * Called by every order-placement handler BEFORE it touches broker APIs.
 */
export async function getBusinessTradingMode(
  businessId: string
): Promise<"research" | "paper" | "live_approval"> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { tradingMode: true }
  });
  const raw = business?.tradingMode ?? "research";
  if (raw === "paper" || raw === "live_approval") return raw;
  return "research";
}

/**
 * Decide what to do with an order proposal based on the business's trading
 * mode. The handler implements each branch:
 *
 *   "reject"   — return a research-mode-only error to the agent
 *   "execute"  — fire the order (paper: practice endpoint; live: live endpoint)
 *   "queue"    — create an ApprovalRequest and wait for a human click
 */
export type TradingModeDecision =
  | { mode: "research"; action: "reject"; reason: string }
  | { mode: "paper"; action: "execute"; endpoint: "practice" }
  | { mode: "live_approval"; action: "queue"; reason: string };

export function decideTradingAction(
  mode: "research" | "paper" | "live_approval"
): TradingModeDecision {
  if (mode === "research") {
    return {
      mode,
      action: "reject",
      reason:
        "Trading mode is Research. Orders are NEVER placed in Research mode. Upgrade to Paper from the business's Forex Desk panel to simulate on a broker demo account."
    };
  }
  if (mode === "paper") {
    return { mode, action: "execute", endpoint: "practice" };
  }
  return {
    mode,
    action: "queue",
    reason:
      "Trading mode is Live with per-trade approval. The order has been queued to the Approvals queue and will fire only on your explicit click."
  };
}

/**
 * Count of completed forex-order ActivityEntries for a business. Used by
 * the paper → live upgrade gate (requires 30+ completed paper trades with
 * non-negative expectancy before Live mode is allowed).
 */
export async function getPaperTradeCount(
  businessId: string
): Promise<number> {
  return db.activityEntry.count({
    where: {
      businessId,
      type: "forex_order",
      status: "completed",
      metadata: {
        path: ["tradingMode"],
        equals: "paper"
      }
    }
  });
}
