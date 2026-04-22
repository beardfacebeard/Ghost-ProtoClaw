import { getStateDisclosure } from "@/lib/dealhawk/state-disclosures";
import {
  qualifySubTo,
  type SubToInput,
  type SubToResult,
} from "@/lib/dealhawk/underwriting";

/**
 * Dealhawk Empire — creative-finance architect library.
 *
 * For deals where straight wholesale doesn't pencil, the Creative
 * Finance Architect agent (Agent 14) matches the seller situation to
 * the right structure from:
 *   - straight Sub-To
 *   - Sub-To + seller carry (wraps a 2nd-position note on top of the
 *     inherited 1st)
 *   - novation partnership (list + light rehab + retail resale, upside
 *     split)
 *   - wraparound mortgage (new higher-rate loan on top of the inherited
 *     sub-5%)
 *   - contract for deed / land contract
 *   - lease-option (tenant-with-option, faster eviction than foreclosure
 *     if default)
 *
 * Outputs a structured recommendation + contracts needed + 3-paragraph
 * risk memo (upside / downside / what can go wrong) + state-specific
 * warnings + the always-appended attorney / Dodd-Frank / RESPA
 * disclaimer.
 */

export type CreativeStructure =
  | "straight_sub_to"
  | "sub_to_plus_carry"
  | "novation"
  | "wrap"
  | "lease_option"
  | "contract_for_deed"
  | "decline";

export const CREATIVE_FINANCE_ATTORNEY_DISCLAIMER =
  "This recommendation is not legal advice. The operator must engage a real-estate attorney licensed in the property's state before executing any creative finance agreement. Dodd-Frank may apply if this deal involves seller-financing on a consumer-owner-occupied residence (the Loan Originator Compensation Rule and the Ability-to-Repay rule have specific exemptions for individual sellers but the thresholds matter). RESPA may apply if mortgage payments pass through third parties (escrow / servicing requirements). State-specific executory-contract rules (notably Texas Property Code Chapter 5) heavily regulate residential lease-options and contract-for-deed. Consult counsel before closing.";

export type CreativeFinanceInput = {
  // Property + market
  arv: number;
  rentEstimate: number;
  propertyState: string;
  propertyType?: string;
  // Seller situation
  loanBalance?: number | null;
  loanRate?: number | null;
  piti?: number | null;
  hasHeloc?: boolean;
  recentRefi?: boolean;
  isVaLoan?: boolean;
  inForbearance?: boolean;
  /** Seller's stated minimum cash-at-close target. */
  sellerCashTarget?: number | null;
  /** Seller's risk profile. "risk_averse" — wants tenant + eviction
   *  fast-path. "income_seeker" — wants monthly income over time.
   *  "credit_protector" — primary goal is avoiding foreclosure on
   *  record. "free_and_clear" — no loan, owns outright. */
  sellerProfile?:
    | "risk_averse"
    | "income_seeker"
    | "credit_protector"
    | "free_and_clear"
    | "unknown";
  /** Wholesale MAO — already-computed by the Comp Analyst. */
  wholesaleMao?: number | null;
};

export type CreativeFinanceResult = {
  recommendedStructure: CreativeStructure;
  /** Sub-To analysis if applicable (recommendedStructure starts with
   *  "straight_sub_to" / "sub_to_plus_carry"). */
  subToAnalysis: SubToResult | null;
  /** Deal math summary — populated per structure. */
  dealMath: {
    /** Cash to seller at close. */
    sellerCashAtClose: number | null;
    /** Operator's projected monthly cashflow (rent − PITI for Sub-To,
     *  rent − wrap-payment for wraps, rent − note-payment for carry). */
    operatorMonthlyCashflow: number | null;
    /** Estimated equity captured by the operator at acquisition. */
    operatorEquityAtAcquisition: number | null;
    /** For wraps: spread between operator-collected payment and
     *  underlying-loan payment per month. */
    monthlySpread: number | null;
  };
  /** Contracts the operator must have prepared for this structure. */
  contractsNeeded: string[];
  /** Three-paragraph risk memo — upside / downside / what-can-go-wrong. */
  riskMemo: {
    upside: string;
    downside: string;
    whatCanGoWrong: string;
  };
  /** State-specific warnings. */
  stateWarnings: string[];
  attorneyDisclaimer: string;
};

export function recommendCreativeStructure(
  input: CreativeFinanceInput
): CreativeFinanceResult {
  const stateWarnings = collectStateWarnings(input);

  // Sub-To path: only viable if seller has an existing loan.
  let subToAnalysis: SubToResult | null = null;
  if (
    typeof input.loanBalance === "number" &&
    typeof input.loanRate === "number" &&
    typeof input.piti === "number"
  ) {
    const subToInput: SubToInput = {
      arv: input.arv,
      rent: input.rentEstimate,
      loanBalance: input.loanBalance,
      loanRate: input.loanRate,
      piti: input.piti,
      hasHeloc: input.hasHeloc,
      recentRefi: input.recentRefi,
      inForbearance: input.inForbearance,
      isVaLoan: input.isVaLoan,
    };
    subToAnalysis = qualifySubTo(subToInput);
  }

  // Decision tree per the research doc.
  const wholesalePencils =
    typeof input.wholesaleMao === "number" && input.wholesaleMao > 0;
  const sellerWantsCashFast =
    input.sellerCashTarget !== undefined &&
    input.sellerCashTarget !== null &&
    input.sellerCashTarget > 10000;

  let recommendedStructure: CreativeStructure;

  if (input.sellerProfile === "free_and_clear") {
    // No existing loan — Sub-To not possible. Pivot to seller-carry
    // structures. Free-and-clear sellers usually want income over time
    // (otherwise they'd just list traditionally), so default to wrap;
    // decline if they're demanding a large cash payout.
    recommendedStructure = sellerWantsCashFast ? "decline" : "wrap";
  } else if (
    subToAnalysis &&
    subToAnalysis.viability === "grand_slam" &&
    subToAnalysis.recommendedStructure !== "decline"
  ) {
    // Sub-To grand-slam wins.
    recommendedStructure =
      subToAnalysis.recommendedStructure === "sub_to_plus_wrap"
        ? "wrap"
        : (subToAnalysis.recommendedStructure as CreativeStructure);
  } else if (
    wholesalePencils &&
    !sellerWantsCashFast &&
    !subToAnalysis
  ) {
    // No existing-loan info but wholesale pencils — still wholesale, but
    // operator might consider novation if margins are tight.
    recommendedStructure = "novation";
  } else if (
    subToAnalysis &&
    (subToAnalysis.viability === "good" ||
      subToAnalysis.viability === "marginal")
  ) {
    // Sub-To possible but not grand-slam. If seller wants cash, layer
    // a carry. Otherwise straight Sub-To with margin protection.
    recommendedStructure = sellerWantsCashFast
      ? "sub_to_plus_carry"
      : (subToAnalysis.recommendedStructure as CreativeStructure);
  } else if (input.sellerProfile === "risk_averse") {
    // Seller wants tenant-with-option fast-path.
    recommendedStructure = "lease_option";
  } else if (
    input.sellerProfile === "income_seeker" &&
    typeof input.loanRate === "number" &&
    input.loanRate < 5
  ) {
    // Wrap on top of inherited sub-5%.
    recommendedStructure = "wrap";
  } else {
    recommendedStructure = "decline";
  }

  // Compute deal math per structure.
  const sellerEquity =
    typeof input.loanBalance === "number"
      ? input.arv - input.loanBalance
      : input.arv;

  const dealMath: CreativeFinanceResult["dealMath"] = {
    sellerCashAtClose: null,
    operatorMonthlyCashflow: null,
    operatorEquityAtAcquisition: null,
    monthlySpread: null,
  };

  if (
    recommendedStructure === "straight_sub_to" ||
    recommendedStructure === "sub_to_plus_carry"
  ) {
    dealMath.sellerCashAtClose =
      recommendedStructure === "straight_sub_to" ? 3000 : sellerEquity;
    dealMath.operatorMonthlyCashflow = subToAnalysis?.monthlyCashflow ?? null;
    dealMath.operatorEquityAtAcquisition =
      subToAnalysis?.acquisitionEquity ?? null;
  } else if (recommendedStructure === "wrap") {
    if (typeof input.loanBalance === "number" && typeof input.piti === "number") {
      // Operator wraps a higher-rate note. Assume operator-collected
      // payment is rent (income-seeker seller scenario).
      dealMath.sellerCashAtClose = 0;
      dealMath.operatorMonthlyCashflow = Math.round(
        input.rentEstimate - input.piti
      );
      dealMath.monthlySpread = dealMath.operatorMonthlyCashflow;
      dealMath.operatorEquityAtAcquisition = sellerEquity;
    } else if (input.sellerProfile === "free_and_clear") {
      dealMath.sellerCashAtClose = Math.round(input.arv * 0.05); // small downstroke
      dealMath.operatorMonthlyCashflow = Math.round(input.rentEstimate * 0.4);
      dealMath.operatorEquityAtAcquisition = Math.round(input.arv * 0.95);
    }
  } else if (recommendedStructure === "novation") {
    // Operator + seller partner on a retail listing post-light-rehab.
    // Upside split — assume 50/50 of the spread above wholesale price.
    if (typeof input.wholesaleMao === "number") {
      dealMath.sellerCashAtClose = Math.round(input.wholesaleMao);
      dealMath.operatorEquityAtAcquisition = Math.round(
        (input.arv - input.wholesaleMao) * 0.5
      );
    }
  } else if (recommendedStructure === "lease_option") {
    dealMath.sellerCashAtClose = Math.round(input.arv * 0.04); // option fee
    dealMath.operatorMonthlyCashflow = Math.round(input.rentEstimate * 0.2);
  } else if (recommendedStructure === "contract_for_deed") {
    dealMath.sellerCashAtClose = Math.round(input.arv * 0.05);
    dealMath.operatorMonthlyCashflow = Math.round(input.rentEstimate * 0.3);
  }

  return {
    recommendedStructure,
    subToAnalysis,
    dealMath,
    contractsNeeded: contractsForStructure(recommendedStructure),
    riskMemo: riskMemoForStructure(recommendedStructure, input),
    stateWarnings,
    attorneyDisclaimer: CREATIVE_FINANCE_ATTORNEY_DISCLAIMER,
  };
}

function contractsForStructure(structure: CreativeStructure): string[] {
  switch (structure) {
    case "straight_sub_to":
      return [
        "Purchase agreement with Sub-To language",
        "Sub-To disclosure (seller acknowledges DOS risk + loan stays in their name)",
        "Limited Power of Attorney for mortgage-related matters",
        "Sub-To performance agreement (specifies operator-default consequences)",
        "Authorization to release information to lender",
        "Insurance restructuring documentation",
      ];
    case "sub_to_plus_carry":
      return [
        ...contractsForStructure("straight_sub_to"),
        "Promissory note (2nd-position) for the seller-equity piece",
        "Deed of trust / mortgage securing the note",
        "Servicing agreement for the carry payment stream",
      ];
    case "wrap":
      return [
        "Purchase agreement with wrap language",
        "Wrap promissory note (operator → seller)",
        "Wrap deed of trust / mortgage",
        "Servicing agreement (operator collects, forwards underlying payment)",
        "Insurance restructuring documentation",
        "Disclosure to seller of underlying-loan DOS risk",
      ];
    case "novation":
      return [
        "Original purchase agreement (wholesale-tier price)",
        "Novation agreement adding the retail-buyer scenario with upside split",
        "Listing agreement with the partnered agent",
        "Light-rehab scope of work (if applicable)",
        "Distribution waterfall agreement (how upside is split)",
      ];
    case "lease_option":
      return [
        "Lease agreement",
        "Option agreement (separate document — bundling can re-classify as executory contract in some states)",
        "Option fee receipt (3-5% of purchase price typical, non-refundable)",
        "Rent-credit schedule (portion of monthly rent applied to option strike)",
      ];
    case "contract_for_deed":
      return [
        "Contract for deed / land contract (state-specific form required)",
        "Promissory note (operator → seller)",
        "Mandatory consumer-protection disclosures (especially in TX, MN, WA)",
        "Recorded notice of contract (per state requirement)",
      ];
    case "decline":
      return [
        "(No structure recommended. Operator should walk away or revisit in 6 months.)",
      ];
  }
}

function riskMemoForStructure(
  structure: CreativeStructure,
  input: CreativeFinanceInput
): { upside: string; downside: string; whatCanGoWrong: string } {
  switch (structure) {
    case "straight_sub_to":
      return {
        upside: `Acquire a $${Math.round(input.arv / 1000)}K-ARV asset with $0 down (plus ~$3K moving money), inherit the existing sub-5% rate, and produce monthly positive cashflow from day one. Equity capture at acquisition is the difference between ARV and current loan balance.`,
        downside:
          "Loan stays in seller's name — seller's credit is exposed if the operator defaults. Insurance must be carefully restructured. Lender retains DOS rights under Garn-St. Germain even if rarely exercised.",
        whatCanGoWrong:
          "Operator misses a payment → seller's credit destroyed + foreclosure on a home they no longer own. Lender notices the title transfer (rare but possible if the new insurance policy raises a flag) → calls the loan due, full balance owed within ~30 days. Seller takes out a HELOC after closing → operator on the hook for that payment too if not closed at acquisition.",
      };
    case "sub_to_plus_carry":
      return {
        upside:
          "Same Sub-To upside (rate inheritance + cashflow + equity capture) but the seller-equity piece is paid out over time as a 2nd-position note — operator preserves cash, seller gets monthly income.",
        downside:
          "Two payment streams to manage (underlying 1st + carry 2nd). Default risk compounds: missing the carry payment damages the seller relationship without triggering the underlying-loan DOS. Underlying lender doesn't know about the 2nd lien and may not approve if it learns.",
        whatCanGoWrong:
          "Operator can't service both payments → seller forecloses on the 2nd, takes back possession, and the underlying 1st remains in seller's name with operator's failed payment history attached.",
      };
    case "wrap":
      return {
        upside: `Operator collects monthly payment from end-buyer at higher rate; underlying inherited loan continues to receive its lower-rate payment from the operator. Spread is the operator's monthly income — typically $300-600/mo on a residential wrap with realistic rate-spread.`,
        downside:
          "End-buyer credit risk now rests with the operator. Underlying-loan DOS is the same as Sub-To. Servicing the wrap (collecting + forwarding) creates RESPA exposure if not done correctly.",
        whatCanGoWrong:
          "End-buyer defaults → operator must continue paying the underlying or face foreclosure. Operator under-resourced for default-cure cash. Underlying lender notices and accelerates.",
      };
    case "novation":
      return {
        upside:
          "Captures retail-resale spread instead of wholesale margin. Seller often nets more than they would have on a straight wholesale (if the retail listing exceeds the original cash offer). Light rehab + agent listing converts a wholesale dud into a flip-tier outcome with 50/50 upside split.",
        downside:
          "Holding period 60-180 days vs. wholesale's 14-30. Operator funds the light rehab + carries through listing. Market risk during the hold — if the comp value drops, the upside vanishes.",
        whatCanGoWrong:
          "Listing sits, comps drop, novation period expires before sale. Seller backs out of the novation extension. Light rehab uncovers heavy-rehab issues mid-project.",
      };
    case "lease_option":
      return {
        upside:
          "Operator gets tenant-with-option control without title transfer (no DOS risk on any underlying loan). Faster recourse if default — eviction in weeks, not months/years. Option fee is non-refundable income.",
        downside:
          "Operator doesn't accumulate equity during the lease — appreciation flows to the seller. Tenant may not exercise → operator never owns. Some states (Texas notably) re-classify long-lease-options as executory contracts and apply heavy consumer-protection rules.",
        whatCanGoWrong:
          "Tenant exercises in a flat market → operator captures no upside. Tenant defaults → operator loses month-to-month cashflow + must evict. State re-classifies the structure → operator faces consumer-protection penalties.",
      };
    case "contract_for_deed":
      return {
        upside:
          "Buyer takes possession + equitable title without bank financing. Seller retains legal title as security — fast recourse on default. Useful on properties that don't qualify for traditional financing (mobile homes in parks, low-value rurals).",
        downside:
          "Heavy state-by-state regulation, especially in TX (Tex. Prop. Code Ch. 5) and MN. Recording requirements strict. Buyer has fewer rights than under traditional financing — opens consumer-protection exposure if the buyer is a consumer.",
        whatCanGoWrong:
          "Operator structures contract incorrectly under state law → contract void or buyer-favorable. Buyer claims consumer-protection violation → state AG action.",
      };
    case "decline":
      return {
        upside:
          "(N/A — no structure recommended for this deal under current inputs.)",
        downside:
          "(N/A — declining a marginal deal preserves operator capital + reputation for the next opportunity.)",
        whatCanGoWrong:
          "Walking away is the right call when the deal math doesn't pencil. Re-visit in 6 months — seller circumstances change.",
      };
  }
}

function collectStateWarnings(input: CreativeFinanceInput): string[] {
  const warnings: string[] = [];
  const state = input.propertyState.trim().toUpperCase();
  const stateInfo = getStateDisclosure(state);
  if (stateInfo && stateInfo.tier !== "permissive") {
    warnings.push(
      `${stateInfo.fullName} (${state}) is a "${stateInfo.tier}"-tier wholesaling state. Creative-finance structures (especially Sub-To, wraps, contract-for-deed, lease-options) face heightened scrutiny. Pull the state-specific contract template with attorney review before signing.`
    );
  }
  if (state === "TX") {
    warnings.push(
      "Texas Property Code Chapter 5 heavily regulates 'executory contracts' on residential property — applies to contract-for-deed and lease-options longer than 180 days. Heavy consumer-protection requirements; do NOT use generic templates."
    );
  }
  if (state === "MN") {
    warnings.push(
      "Minnesota Home Equity Conversion Act (Minn. Stat. § 325N) imposes additional disclosures on pre-foreclosure purchases — applies to many Sub-To deals. Review with MN counsel."
    );
  }
  if (state === "CA") {
    warnings.push(
      "California Civil Code § 1695 (Home Equity Sales Contract Act) applies to distressed-property purchases. 5-day cancellation right may apply. Review with CA-licensed attorney."
    );
  }
  if (state === "WA") {
    warnings.push(
      "Washington's distressed-home-consulting (RCW 61.34) and equity-skimming statutes are aggressive on pre-foreclosure transactions. Attorney review essential."
    );
  }
  return warnings;
}
