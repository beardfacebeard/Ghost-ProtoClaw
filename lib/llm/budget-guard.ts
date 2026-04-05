/**
 * Budget Guard — pre-flight check to enforce monthly spend limits.
 *
 * Before making an LLM call, call `checkBudget()` to verify the
 * organization hasn't exceeded its configured monthly spend limit.
 *
 * Returns an object indicating whether the call is allowed, the current
 * spend, and the limit. When `hardStop` is enabled in BudgetConfig and
 * the limit is exceeded, the call should be blocked.
 */

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BudgetCheckResult {
  allowed: boolean;
  currentSpendUsd: number;
  monthlyLimitUsd: number;
  percentUsed: number;
  warning: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the organization is within its monthly budget.
 *
 * @param organizationId — the org to check
 * @param businessId — optional, for business-level budgets
 * @returns BudgetCheckResult
 */
export async function checkBudget(
  organizationId: string,
  businessId?: string | null,
): Promise<BudgetCheckResult> {
  // Look up budget config — business-level first, then org-level
  const configs = await db.budgetConfig.findMany({
    where: {
      organizationId,
      enabled: true,
      OR: [
        { businessId: businessId ?? undefined },
        { businessId: null },
      ],
    },
    orderBy: { businessId: "desc" }, // business-specific first (non-null sorts after null? we reverse)
  });

  // Prefer business-specific config, fall back to org-level
  const config =
    configs.find((c) => c.businessId === businessId) ??
    configs.find((c) => c.businessId === null);

  if (!config) {
    // No budget configured — allow everything
    return {
      allowed: true,
      currentSpendUsd: 0,
      monthlyLimitUsd: Infinity,
      percentUsed: 0,
      warning: false,
    };
  }

  // Sum estimated cost for the current month
  const monthStart = startOfMonth();

  const whereClause: Record<string, unknown> = {
    organizationId,
    createdAt: { gte: monthStart },
  };
  if (businessId) {
    whereClause.businessId = businessId;
  }

  const agg = await db.tokenUsageLog.aggregate({
    where: whereClause,
    _sum: { estimatedCostUsd: true },
  });

  const currentSpendUsd = agg._sum.estimatedCostUsd ?? 0;
  const percentUsed =
    config.monthlyLimitUsd > 0
      ? Math.round((currentSpendUsd / config.monthlyLimitUsd) * 100)
      : 0;

  const overBudget = currentSpendUsd >= config.monthlyLimitUsd;
  const warning = percentUsed >= config.alertThresholdPct;

  if (overBudget && config.hardStop) {
    return {
      allowed: false,
      currentSpendUsd,
      monthlyLimitUsd: config.monthlyLimitUsd,
      percentUsed,
      warning: true,
      message: `Monthly budget of $${config.monthlyLimitUsd.toFixed(2)} exceeded ($${currentSpendUsd.toFixed(2)} used). LLM calls are blocked until next month or the budget is increased.`,
    };
  }

  return {
    allowed: true,
    currentSpendUsd,
    monthlyLimitUsd: config.monthlyLimitUsd,
    percentUsed,
    warning,
    message: warning
      ? `Budget alert: ${percentUsed}% of $${config.monthlyLimitUsd.toFixed(2)} monthly limit used ($${currentSpendUsd.toFixed(2)}).`
      : undefined,
  };
}
