/**
 * Dealhawk Empire — underwriting library.
 *
 * Pure functions for the two load-bearing underwriting computations:
 *
 *   - computeFourMAOs(input) — Wholesale / BRRRR / Fix-and-flip MAOs for
 *     a property. The agent computes all three simultaneously (plus
 *     Sub-To via qualifySubTo) so the winning exit surfaces per the
 *     2026 "Sophisticated Wholesaler" operating rule: match the
 *     structure to the deal, don't force the deal into a structure.
 *
 *   - qualifySubTo(input) — 0-100 Sub-To fit score, viability tier,
 *     monthly cashflow, acquisition equity, DOS risk notes, and a
 *     recommended structure. Every output carries the attorney
 *     disclaimer — hard-coded per the Section-14 failure rule.
 *
 * Both functions are used by:
 *   - The dealhawk_compute_mao / dealhawk_qualify_sub_to agent tools.
 *   - The provider-search normalizer in app/api/admin/businesses/[id]/
 *     deals/search/route.ts for ingest-time heuristics.
 *   - Any future backfill script that needs to re-underwrite deals.
 *
 * Every number returned is rounded to a whole dollar (or a whole
 * percentage point where applicable) — the LLM never sees fractional
 * values that could get stored back into the DB with floating-point
 * drift.
 */

// ── Four-MAO Calculator ──────────────────────────────────────────

export type MarketTemper = "hot" | "normal" | "cold";

export type MAOInput = {
  /** ARV mid estimate. Required. */
  arv: number;
  /** Rehab estimate — conservative end of the range. Required. */
  rehab: number;
  /** Monthly market-rent estimate. Required for BRRRR; omittable for
   *  wholesale-only / flip-only analyses. */
  rent?: number;
  /** Market temper — tilts wholesale pct. Default "normal". */
  market?: MarketTemper;
};

export type MAOResult = {
  wholesale: number | null;
  brrrr: number | null;
  flip: number | null;
  /** The wholesale pct used, for operator transparency. */
  wholesalePctApplied: number;
  /** Human-readable rationale entries — explains adjustments applied. */
  notes: string[];
};

export function computeFourMAOs(input: MAOInput): MAOResult {
  const notes: string[] = [];
  const arv = input.arv;
  const rehab = input.rehab;
  const market = input.market ?? "normal";

  // Wholesale: 70% rule with market + price-tier adjustments (per the
  // research doc — Section 10 "The 2026 reality check on the 70% rule").
  let wholesalePct: number;
  if (arv < 100_000) {
    wholesalePct = 0.65;
    notes.push(
      "Wholesale pct dropped to 65% — below-$100K ARV can't carry standard margins (fixed costs don't scale down)."
    );
  } else if (market === "hot") {
    wholesalePct = 0.78;
    notes.push(
      "Hot-market adjustment: wholesale pct bumped to 78% — flippers are paying up in tight inventory."
    );
  } else if (market === "cold") {
    wholesalePct = 0.68;
    notes.push(
      "Cold-market adjustment: wholesale pct trimmed to 68% — buyer pool thinner, margin protection required."
    );
  } else {
    wholesalePct = 0.70;
  }
  const wholesale = Math.round(arv * wholesalePct - rehab);

  // Fix-and-flip: 75% rule with 10% carry/sell overhead absorbed into
  // the formula. Agent should adjust carry if the deal has unusual
  // holding-time assumptions.
  const flipOverhead = Math.round(arv * 0.10);
  const flip = Math.round(arv * 0.75 - rehab - flipOverhead);
  notes.push(
    "Fix-and-flip MAO includes 10% of ARV as built-in carry + sell overhead (taxes, insurance, utilities, financing, commissions, closing). Adjust if your holding assumptions differ."
  );

  // BRRRR: research doc's formulation = (rent * 12 * 5) - rehab. That's
  // a 20% cap-rate-anchored proxy — aggressive, but the operator should
  // refine against local rental demand + actual DSCR refi math per
  // Section 10. Null out when rent isn't provided rather than invent.
  let brrrr: number | null = null;
  if (typeof input.rent === "number" && input.rent > 0) {
    brrrr = Math.round(input.rent * 12 * 5 - rehab);
    notes.push(
      "BRRRR MAO = (monthly rent × 60 months) − rehab. This is a 20% cap-rate proxy; refine against local DSCR loan terms (typically 70% LTV refi) and actual OpEx before committing."
    );
  } else {
    notes.push(
      "BRRRR MAO skipped — market-rent estimate not provided. Re-run with a rent input to score BRRRR viability."
    );
  }

  return {
    wholesale,
    brrrr,
    flip,
    wholesalePctApplied: wholesalePct,
    notes,
  };
}

// ── Sub-To Qualifier ─────────────────────────────────────────────

/** Standard Garn-St. Germain + attorney-review disclaimer appended to
 *  every Sub-To analysis output. Load-bearing — not removable. */
export const SUB_TO_ATTORNEY_DISCLAIMER =
  "This Sub-To analysis is not legal advice. The operator must engage a real-estate attorney licensed in the property's state before executing any Sub-To agreement. DOS clause enforcement is rare on performing loans but is a real contractual right of the lender under 12 U.S.C. § 1701j-3 (Garn-St. Germain Act). Insurance restructuring, HELOC handling, and performance-agreement language must be reviewed by counsel before closing.";

export type AssumptionClauseStatus =
  | "unknown"
  | "none"
  | "transfer_to_llc_prohibited"
  | "prohibited";

export type SubToInput = {
  /** ARV mid estimate. Required. */
  arv: number;
  /** Monthly market-rent estimate. Required. */
  rent: number;
  /** Outstanding loan balance. Required. */
  loanBalance: number;
  /** Existing loan rate as a decimal percentage (e.g., 3.125 for 3.125%). */
  loanRate: number;
  /** Monthly PITI — principal, interest, taxes, insurance. Required. */
  piti: number;
  /** True if the seller has an open HELOC with available equity — the
   *  single biggest DOS trap per the research doc. */
  hasHeloc?: boolean;
  /** True if the seller refinanced within the last 2 years — recent
   *  refi = tighter lender scrutiny. */
  recentRefi?: boolean;
  /** Assumption / transfer-clause status on the existing loan. Default
   *  "unknown" if the operator hasn't pulled the loan docs yet. */
  assumptionClause?: AssumptionClauseStatus;
  /** True if the loan is in active forbearance or modification — the
   *  lender is already watching. */
  inForbearance?: boolean;
  /** True if the loan is a VA loan — assumability interacts unusually
   *  with DOS. Flag for attorney review regardless of other factors. */
  isVaLoan?: boolean;
};

export type SubToViability =
  | "grand_slam"
  | "good"
  | "marginal"
  | "decline";

export type SubToStructure =
  | "straight_sub_to"
  | "sub_to_plus_carry"
  | "sub_to_plus_wrap"
  | "decline";

export type SubToResult = {
  /** 0-100. Higher is better fit. */
  score: number;
  viability: SubToViability;
  /** Monthly positive cashflow (rent − PITI). Negative = not cashflow-
   *  positive; agent should flag prominently. */
  monthlyCashflow: number;
  /** Difference between ARV and loan balance. If large, the seller has
   *  equity to pay out — may require sub_to_plus_carry. */
  acquisitionEquity: number;
  /** Ratio of loan balance to ARV as a percentage (0-100+). */
  loanToArvPercent: number;
  /** DOS-risk factors flagged during the analysis. If non-empty, the
   *  agent's response must call them out explicitly. */
  dosRiskNotes: string[];
  /** Which of the four ideal-deal conditions were satisfied. */
  idealDealConditionsMet: {
    rateUnder5Pct: boolean;
    pitiUnderRentBy20Plus: boolean;
    balanceToArvUnder85: boolean;
    minimalEquityOrDistressed: boolean;
  };
  /** Recommended structure given the inputs. */
  recommendedStructure: SubToStructure;
  /** Attorney disclaimer — ALWAYS included. */
  attorneyDisclaimer: string;
};

export function qualifySubTo(input: SubToInput): SubToResult {
  const arv = input.arv;
  const rent = input.rent;
  const loanBalance = input.loanBalance;
  const piti = input.piti;

  // Ideal-deal conditions per the research doc Section 6 (Sub-To
  // Qualifier agent sketch).
  const rateUnder5Pct = input.loanRate < 5;
  const pitiUnderRentBy20Plus = piti <= rent * 0.8;
  const loanToArvPercent = Math.round((loanBalance / arv) * 100);
  const balanceToArvUnder85 = loanToArvPercent < 85;
  const equityPercent = Math.round(((arv - loanBalance) / arv) * 100);
  const minimalEquityOrDistressed = equityPercent < 25; // simple proxy

  const idealDealConditionsMet = {
    rateUnder5Pct,
    pitiUnderRentBy20Plus,
    balanceToArvUnder85,
    minimalEquityOrDistressed,
  };
  const conditionsHit =
    Number(rateUnder5Pct) +
    Number(pitiUnderRentBy20Plus) +
    Number(balanceToArvUnder85) +
    Number(minimalEquityOrDistressed);

  // DOS risk factors — each drops the score and/or pushes viability
  // toward "decline" / "marginal" regardless of how good the deal looks.
  const dosRiskNotes: string[] = [];
  if (input.hasHeloc) {
    dosRiskNotes.push(
      "HELOC on file. Critical DOS trap — if the seller draws on it post-close, the operator is on the hook for the payment. Recommend paying off and closing the HELOC at closing, or walking away."
    );
  }
  if (input.recentRefi) {
    dosRiskNotes.push(
      "Recent refinance (within last 2 years). Lender is more likely to scrutinize title transfers on recently-originated loans."
    );
  }
  if (input.assumptionClause === "prohibited") {
    dosRiskNotes.push(
      "Loan explicitly prohibits transfer. Sub-To is not appropriate — recommend decline or seller-carry instead."
    );
  } else if (input.assumptionClause === "transfer_to_llc_prohibited") {
    dosRiskNotes.push(
      "Loan prohibits transfer to LLC. Land-trust structure may mitigate but requires attorney review in the property's state."
    );
  }
  if (input.inForbearance) {
    dosRiskNotes.push(
      "Loan in active forbearance or modification. Lender is already watching; DOS-enforcement risk is materially elevated."
    );
  }
  if (input.isVaLoan) {
    dosRiskNotes.push(
      "VA loan — VA-loan assumability interacts unusually with DOS. VA has approved-assumption paths that may be preferable to Sub-To. Attorney review required before structuring."
    );
  }

  // Score: 25 points per condition met, minus 15 per DOS risk note,
  // clamped 0-100.
  let score = conditionsHit * 25 - dosRiskNotes.length * 15;
  score = Math.max(0, Math.min(100, score));

  // Explicit "decline" triggers — these override the score.
  let declineOverride = false;
  if (input.assumptionClause === "prohibited") declineOverride = true;
  if (input.hasHeloc && conditionsHit < 3) declineOverride = true;

  let viability: SubToViability;
  if (declineOverride) viability = "decline";
  else if (score >= 85) viability = "grand_slam";
  else if (score >= 65) viability = "good";
  else if (score >= 40) viability = "marginal";
  else viability = "decline";

  // Recommended structure.
  let recommendedStructure: SubToStructure;
  const acquisitionEquity = arv - loanBalance;
  if (viability === "decline") {
    recommendedStructure = "decline";
  } else if (acquisitionEquity <= 5000) {
    // Seller has essentially no equity — pure Sub-To.
    recommendedStructure = "straight_sub_to";
  } else if (acquisitionEquity < 25000) {
    // Small equity piece — pay seller a small cash sum + take over the
    // loan (straight Sub-To with moving money).
    recommendedStructure = "straight_sub_to";
  } else {
    // Material equity — the seller needs to be paid out over time or
    // the operator wraps a second-position note.
    recommendedStructure = "sub_to_plus_carry";
  }
  // Wrap variant: if the seller wants monthly income rather than a
  // lump sum, and there's enough margin on the deal, wrap works.
  if (
    recommendedStructure === "sub_to_plus_carry" &&
    rent - piti >= 500 &&
    acquisitionEquity < arv * 0.30
  ) {
    recommendedStructure = "sub_to_plus_wrap";
  }

  return {
    score,
    viability,
    monthlyCashflow: Math.round(rent - piti),
    acquisitionEquity: Math.round(acquisitionEquity),
    loanToArvPercent,
    dosRiskNotes,
    idealDealConditionsMet,
    recommendedStructure,
    attorneyDisclaimer: SUB_TO_ATTORNEY_DISCLAIMER,
  };
}
