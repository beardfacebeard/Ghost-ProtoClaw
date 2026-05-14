/**
 * Pause-state helpers — the runtime check behind the global kill switch.
 *
 * Every agent run, scheduled workflow, delegation, and master-agent call
 * passes through one of these helpers before any LLM call or external
 * action. When either the organization or the specific business is paused,
 * the call short-circuits with a structured reason the caller can surface.
 *
 * Two scopes are independent:
 *   - Organization.globalPaused → halt every business in the org
 *   - Business.globalPaused     → halt one business only
 *
 * Either one being true is enough to stop work. Cleared from the same
 * /api/admin/pause-all endpoint that set them.
 */

import { db } from "@/lib/db";

export type PauseCheck =
  | { paused: false }
  | {
      paused: true;
      scope: "organization" | "business";
      reason: string | null;
      pausedAt: Date | null;
      pausedBy: string | null;
    };

/**
 * Resolve the pause state for an agent run. Pass whichever ids you have —
 * an agent acting on a business needs both; an org-only call (e.g.
 * master agent picking businesses) can pass just the orgId.
 *
 * Single DB round-trip when possible. Returns paused=false on any DB error
 * (fail-open) — the cost of failing-closed during a transient outage is
 * worse than the cost of a single tick of work proceeding. Operators see
 * the LogEvent and can act.
 */
export async function checkPauseState(params: {
  organizationId?: string | null;
  businessId?: string | null;
}): Promise<PauseCheck> {
  const { organizationId, businessId } = params;
  if (!organizationId && !businessId) {
    return { paused: false };
  }

  try {
    // Prefer business lookup when available — gives us both fields in one
    // query via the org relation.
    if (businessId) {
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: {
          globalPaused: true,
          pausedAt: true,
          pausedBy: true,
          pausedReason: true,
          organization: {
            select: {
              globalPaused: true,
              pausedAt: true,
              pausedBy: true,
              pausedReason: true
            }
          }
        }
      });

      if (!business) return { paused: false };

      if (business.organization.globalPaused) {
        return {
          paused: true,
          scope: "organization",
          reason: business.organization.pausedReason,
          pausedAt: business.organization.pausedAt,
          pausedBy: business.organization.pausedBy
        };
      }

      if (business.globalPaused) {
        return {
          paused: true,
          scope: "business",
          reason: business.pausedReason,
          pausedAt: business.pausedAt,
          pausedBy: business.pausedBy
        };
      }

      return { paused: false };
    }

    // Org-only path.
    const org = await db.organization.findUnique({
      where: { id: organizationId! },
      select: {
        globalPaused: true,
        pausedAt: true,
        pausedBy: true,
        pausedReason: true
      }
    });

    if (!org) return { paused: false };

    if (org.globalPaused) {
      return {
        paused: true,
        scope: "organization",
        reason: org.pausedReason,
        pausedAt: org.pausedAt,
        pausedBy: org.pausedBy
      };
    }

    return { paused: false };
  } catch (error) {
    // Fail-open: log and proceed. Operators get a LogEvent so they know
    // the gate took a brief outage.
    console.error("[pause-state] check failed; proceeding:", error);
    return { paused: false };
  }
}

/**
 * Human-readable message for surfacing to agents/operators when paused.
 */
export function pauseMessage(check: Extract<PauseCheck, { paused: true }>): string {
  const scope = check.scope === "organization" ? "the organization" : "this business";
  const who = check.pausedBy ? ` by ${check.pausedBy}` : "";
  const when = check.pausedAt
    ? ` at ${check.pausedAt.toISOString()}`
    : "";
  const why = check.reason ? ` — reason: ${check.reason}` : "";
  return `Paused: ${scope} is currently paused${who}${when}${why}. No agent actions will run until the pause is cleared.`;
}
