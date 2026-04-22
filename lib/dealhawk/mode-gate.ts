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

/**
 * Contract types where attorney review is strongly recommended. These are
 * the creative-finance structures where paperwork is not standard title-
 * company fare and mistakes carry real legal risk (DOS triggering on
 * Sub-To, Dodd-Frank on seller-carry, state executory-contract rules on
 * lease-options, etc.). Wholesale assignments and double-closes are NOT
 * in this set — the title company handles standard closing paperwork.
 */
const RISKY_CONTRACT_TYPES = new Set([
  "sub_to",
  "novation",
  "wrap",
  "lease_option",
  "contract_for_deed",
]);

/**
 * States with statutory wholesaler-disclosure, registration, or licensing
 * rules where attorney review is strongly recommended regardless of
 * contract type. Source: lib/dealhawk/state-disclosures.ts (tiers
 * "disclosure" | "registration" | "license" | "strict"). Kept in sync
 * manually here to avoid an async state-disclosure lookup in a hot-path
 * gate decision.
 */
const ATTORNEY_RECOMMENDED_STATES = new Set([
  "CA", "CO", "CT", "DC", "HI", "IL", "KY", "LA", "MA", "MD",
  "MN", "NC", "NJ", "NY", "OH", "OK", "OR", "PA", "SC", "TN",
  "TX", "VA", "WA",
]);

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
      } | null;
      warnings: string[];
    };

/**
 * Decide whether a binding-contract action (purchase agreement, assignment,
 * LOI, Sub-To package, disposition blast) may fire for a business in a
 * specific property state.
 *
 * Gate posture (Option C — advisory, not blocking):
 *   - Rejects only when dealMode != "contract". That is the single hard
 *     rail: research / outreach modes never produce binding contracts.
 *   - In "contract" mode, always allows. An active AttorneyProfile for the
 *     property's state is looked up and returned (so the agent can cite
 *     it in generated paperwork), but its ABSENCE does not block
 *     generation.
 *   - Warnings are attached for: (a) risky contract types (Sub-To,
 *     novation, wraps, lease-options, contract-for-deed) with no attorney
 *     on file, and (b) attorney-recommended states (IL / OK / NJ / NY /
 *     etc. — statute-heavy) with no attorney on file.
 *
 * Agents consuming this decision should render the warnings as disclaimer
 * text in their output — they are not silent. The disclaimer language is
 * the firewall, not the gate.
 */
export async function decideContractAction(
  mode: DealMode,
  businessId: string,
  propertyState: string,
  contractType?: string
): Promise<ContractDecision> {
  if (mode !== "contract") {
    return {
      mode,
      action: "reject",
      reason:
        "Deal mode is " +
        (mode === "research" ? "Research" : "Outreach") +
        ". Binding contracts are NEVER generated outside Contract mode. Upgrade to Contract from the business's Dealhawk Desk panel.",
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
  const warnings: string[] = [];
  if (!attorney) {
    if (contractType && RISKY_CONTRACT_TYPES.has(contractType)) {
      warnings.push(
        `No attorney on file for ${normalizedState}. ${contractType.replace("_", "-")} contracts carry meaningful legal risk (DOS on Sub-To, Dodd-Frank on seller-carry, state executory-contract rules on lease-options). Attorney review strongly recommended before executing.`
      );
    }
    if (ATTORNEY_RECOMMENDED_STATES.has(normalizedState)) {
      warnings.push(
        `${normalizedState} has statutory wholesaler-disclosure, registration, or licensing rules. Attorney review recommended in this state regardless of contract type.`
      );
    }
  }
  return {
    mode,
    action: "allow",
    attorney,
    warnings,
  };
}
