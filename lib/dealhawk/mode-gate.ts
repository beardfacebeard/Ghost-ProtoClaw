import { db } from "@/lib/db";

/**
 * Dealhawk Empire — dealMode gate (parallel to lib/trading/mode-gate.ts).
 *
 * Three tiers, safest first:
 *   research  — signal building + KB research only. Agents MUST refuse to
 *               generate seller outreach or binding contracts.
 *   outreach  — TCPA-compliant seller contact (SMS / mail / cold calls).
 *               Requires a prior TCPA attestation on the Business record.
 *   contract  — binding agreements (purchase agreement, assignment, LOI,
 *               Sub-To package, disposition blast). Every contract action
 *               re-verifies an AttorneyProfile on file for the property's
 *               state; dealMode = "contract" is a necessary but not
 *               sufficient condition.
 *
 * Every outreach / contract-producing handler MUST call these decide*
 * helpers BEFORE doing anything user-visible — they are the authoritative
 * gate, not UI affordances.
 */

export type DealMode = "research" | "outreach" | "contract";

/**
 * Resolves the current dealMode for a business. Returns "research" if the
 * business doesn't exist or has no dealMode set — the safest tier.
 */
export async function getBusinessDealMode(
  businessId: string
): Promise<DealMode> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { dealMode: true },
  });
  const raw = business?.dealMode ?? "research";
  if (raw === "outreach" || raw === "contract") return raw;
  return "research";
}

export type OutreachDecision =
  | {
      mode: DealMode;
      action: "reject";
      reason: string;
    }
  | {
      mode: "outreach" | "contract";
      action: "allow";
    };

/**
 * Decide whether a seller-outreach action (SMS / letter / cold-call script)
 * may fire for a business. Research mode always rejects; outreach and
 * contract modes allow. The Seller Outreach Agent and the SMS Blast
 * Sequencer call this before every touch.
 *
 * Note: this does NOT check TCPA attestation separately — attestation is a
 * precondition of the research → outreach transition in the API route. If
 * dealMode is "outreach" at this point, attestation has already occurred.
 */
export function decideOutreachAction(mode: DealMode): OutreachDecision {
  if (mode === "research") {
    return {
      mode,
      action: "reject",
      reason:
        "Deal mode is Research. Seller outreach is NEVER generated in Research mode. Upgrade to Outreach from the business's Dealhawk Desk panel after attesting to TCPA compliance.",
    };
  }
  return { mode, action: "allow" };
}

export type ContractDecision =
  | {
      mode: DealMode;
      action: "reject";
      reason: string;
    }
  | {
      mode: "contract";
      action: "allow";
      attorney: {
        id: string;
        name: string;
        state: string;
      };
    };

/**
 * Decide whether a binding-contract action (purchase agreement, assignment,
 * LOI, Sub-To package, disposition blast) may fire for a business in a
 * specific property state. Rejects unless dealMode is "contract" AND an
 * active AttorneyProfile exists for the property's state.
 *
 * This is the contract-generation gate. Every binding-output handler must
 * call this before producing a contract artifact.
 */
export async function decideContractAction(
  mode: DealMode,
  businessId: string,
  propertyState: string
): Promise<ContractDecision> {
  if (mode === "research" || mode === "outreach") {
    return {
      mode,
      action: "reject",
      reason:
        "Deal mode is " +
        (mode === "research" ? "Research" : "Outreach") +
        ". Binding contracts are NEVER generated outside Contract mode. Upgrade to Contract from the business's Dealhawk Desk panel after confirming an attorney is on file for each state you'll close in.",
    };
  }
  const normalizedState = propertyState.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedState)) {
    return {
      mode,
      action: "reject",
      reason: `Contract generation requires a valid 2-letter USPS state code for the property; received "${propertyState}".`,
    };
  }
  const attorney = await db.attorneyProfile.findFirst({
    where: {
      businessId,
      state: normalizedState,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      state: true,
    },
  });
  if (!attorney) {
    return {
      mode,
      action: "reject",
      reason: `No active attorney on file for ${normalizedState}. Add a licensed real-estate attorney for that state in the Dealhawk Desk panel before generating any binding contract for a property there. This is a hard safety rail.`,
    };
  }
  return {
    mode,
    action: "allow",
    attorney,
  };
}
