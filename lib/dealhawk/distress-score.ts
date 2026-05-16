/**
 * Dealhawk Empire — distress-score computation.
 *
 * The Distress Signal Analyst agent (per the research doc) scores every
 * property on a 0-100 motivation scale by combining stacked public-record
 * signals. The scoring math is pure — no DB, no LLM — and lives here so
 * it can be called from:
 *
 *   - The CSV / JSON import endpoint (lib/dealhawk/csv-import.ts), where
 *     we compute motivationScore at ingestion time rather than waiting for
 *     the agent to run.
 *   - The Sub-To Qualifier + Comp Analyst agent tools in later phases.
 *   - Any backfill script that needs to re-score a set of deals after
 *     weight tuning.
 *
 * Weights + multipliers match the agent system prompt's sketch in
 * business-templates.ts (Distress Signal Analyst) and the seed data in
 * lib/dealhawk/seed.ts so that imported leads behave identically to
 * agent-sourced leads.
 */

export type DistressSignalType =
  | "pre_foreclosure"
  | "tax_delinquent"
  | "probate"
  | "divorce"
  | "code_violation"
  | "vacancy"
  | "absentee"
  | "eviction"
  | "expired_listing"
  | "high_equity"
  | "long_tenure";

export type ScoreInputSignal = {
  signalType: DistressSignalType;
  /** Optional weight override — if omitted, use BASE_WEIGHTS[signalType]. */
  weight?: number;
};

/** Base weight contribution to motivationScore for each distress signal. */
export const BASE_WEIGHTS: Record<DistressSignalType, number> = {
  pre_foreclosure: 40,
  tax_delinquent: 25,
  probate: 30,
  divorce: 25,
  code_violation: 15,
  vacancy: 15,
  absentee: 10,
  eviction: 20,
  expired_listing: 10,
  // Multipliers — zero base weight, applied via highEquityMultiplier /
  // longTenureMultiplier factors.
  high_equity: 0,
  long_tenure: 0,
};

/** Equity % threshold above which the high_equity multiplier fires. */
export const HIGH_EQUITY_THRESHOLD = 40;
/** Multiplier factor when high_equity is present. */
export const HIGH_EQUITY_MULTIPLIER = 1.5;

/** Tenure years threshold above which the long_tenure multiplier fires. */
export const LONG_TENURE_THRESHOLD = 7;
/** Multiplier factor when long_tenure is present. */
export const LONG_TENURE_MULTIPLIER = 1.3;

/** Default minimum score for the Seller Outreach gate (configurable). */
export const DEFAULT_OUTREACH_THRESHOLD = 40;

export type ComputeScoreInput = {
  /** Distress signals stacked on the property. */
  signals: ScoreInputSignal[];
  /** Optional equity percentage (0-100). Triggers high_equity multiplier. */
  equityPercent?: number;
  /** Optional years-of-ownership. Triggers long_tenure multiplier. */
  tenureYears?: number;
};

export type ComputeScoreResult = {
  /** Final motivation score, clamped 0-100. */
  score: number;
  /** Sum of base-signal weights before multipliers. */
  baseWeight: number;
  /** Composite multiplier applied (1.0 if neither high-equity nor long-tenure). */
  multiplier: number;
  /** Human-readable breakdown of what drove the score. */
  reasoning: string[];
};

/**
 * Compute a 0-100 motivation score from a set of stacked distress signals.
 *
 * Algorithm:
 *   1. Sum the base weights of every signal (one signal of a given type
 *      counted once — dupes collapse).
 *   2. Apply multipliers:
 *        equity > HIGH_EQUITY_THRESHOLD  → × 1.5
 *        tenure > LONG_TENURE_THRESHOLD  → × 1.3
 *      (Multipliers compose multiplicatively: 1.5 × 1.3 = 1.95.)
 *   3. Cap the result at 100.
 */
export function computeMotivationScore(
  input: ComputeScoreInput
): ComputeScoreResult {
  const reasoning: string[] = [];

  // Deduplicate by signalType — one signal per type gets counted.
  const seenTypes = new Set<DistressSignalType>();
  let baseWeight = 0;
  for (const signal of input.signals) {
    if (seenTypes.has(signal.signalType)) continue;
    seenTypes.add(signal.signalType);
    const weight =
      signal.weight !== undefined ? signal.weight : BASE_WEIGHTS[signal.signalType];
    if (weight > 0) {
      baseWeight += weight;
      reasoning.push(`+${weight} ${signal.signalType}`);
    }
  }

  let multiplier = 1.0;
  if (
    input.equityPercent !== undefined &&
    input.equityPercent >= HIGH_EQUITY_THRESHOLD
  ) {
    multiplier *= HIGH_EQUITY_MULTIPLIER;
    reasoning.push(
      `× ${HIGH_EQUITY_MULTIPLIER} high-equity (${Math.round(input.equityPercent)}%)`
    );
  }
  if (
    input.tenureYears !== undefined &&
    input.tenureYears >= LONG_TENURE_THRESHOLD
  ) {
    multiplier *= LONG_TENURE_MULTIPLIER;
    reasoning.push(
      `× ${LONG_TENURE_MULTIPLIER} long-tenure (${Math.round(input.tenureYears)} yrs)`
    );
  }

  const raw = baseWeight * multiplier;
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  return { score, baseWeight, multiplier, reasoning };
}

/**
 * Recommend an exit strategy from a scored deal's underwriting + signals.
 *
 * Rules (from the research doc's decision tree):
 *   1. Sub-To grand-slam: rate < 5% + PITI < market rent by 20%+ +
 *      balance/ARV < 85% + no HELOC risk.
 *   2. Wholesale: MAO > $5K spread above estimated acquisition, market cold.
 *   3. BRRRR: rent/price >= 1% + operator has long-hold capital (assumed).
 *   4. Flip: flip MAO penciled.
 *   5. Novation: seller motivation > 70 but no MAO pencils.
 *   6. Decline: nothing pencils.
 *
 * This is a first-pass heuristic used at import time; the Sub-To Qualifier
 * and Comp Analyst agents produce more nuanced recommendations at deal
 * qualification time.
 */
// ── Pre-foreclosure decomposed score (Commit 3) ──────────────────────
// Replaces the flat +40 "pre_foreclosure" weight in computeMotivationScore
// with a 10-sub-signal model that distinguishes a hot lead (NOD recorded,
// 30-day auction, 40%+ equity, attested state, contactable owner) from a
// cold one (Lis Pendens, 18-month judicial timeline, underwater equity,
// unknown contact). Sum of sub-signal weights = 100. The recommendation
// thresholds match DEALHAWK_PRE_FORECLOSURE_MODULE_PLAN.md §8.

export type PreForeclosureScoreInput = {
  /** "lis_pendens" | "notice_of_default" | "notice_of_trustee_sale"
   *  | "judgment_of_foreclosure" | "notice_of_sale" | "sheriffs_sale"
   *  | "auction_scheduled" | "post_sale_redemption" */
  foreclosureStage: string;
  /** Days until auction. Null when no auction is scheduled. */
  daysUntilAuction?: number | null;
  /** 0-100 equity percentage. Null when unknown. */
  equityPercent?: number | null;
  /** Inferred from mailing vs property address. Null when unknown. */
  ownerOccupied?: boolean | null;
  /** Years owned. Null when unknown. */
  tenureYears?: number | null;
  /** Whether the owner is also tax-delinquent (compound distress). */
  taxDelinquent?: boolean;
  /** True when property value falls inside the operator's buy-box. */
  insideBuyBox?: boolean;
  /** 0-1 confidence of contact info (phone + email + mailing). */
  contactabilityScore?: number | null;
  /** Whether the state's per-state attestation is on file. Drives the
   *  "compliance posture" sub-signal — a lead we can't legally pursue
   *  is downgraded so the operator isn't drawn to it. */
  stateAttested?: boolean;
  /** Whether the operator has signed the GLBA attestation (gates the
   *  "compliance posture" sub-signal alongside state attestation). */
  glbaAttested?: boolean;
  /** Number of independent sources corroborating the filing (ATTOM,
   *  county scrape, legal-notice aggregator, etc). */
  sourceCount?: number;
};

export type PreForeclosureScoreResult = {
  /** 0-100 aggregate. */
  total: number;
  /** Per-sub-signal breakdown for the operator dashboard. */
  breakdown: Record<string, number>;
  /** "drop" | "watch" | "outreach_ready" | "auction_critical" */
  recommendation: "drop" | "watch" | "outreach_ready" | "auction_critical";
  /** Plain-English rationale strings. */
  reasoning: string[];
};

const STAGE_WEIGHTS: Record<string, number> = {
  lis_pendens: 10,
  notice_of_default: 20,
  notice_of_trustee_sale: 25,
  judgment_of_foreclosure: 20,
  notice_of_sale: 15,
  sheriffs_sale: 12,
  auction_scheduled: 12,
  post_sale_redemption: 5
};

function auctionProximityWeight(days: number | null | undefined): number {
  if (days === null || days === undefined) return 5;
  if (days < 14) return 8;
  if (days < 30) return 15;
  if (days < 60) return 12;
  if (days < 180) return 10;
  return 5;
}

function equityWeight(pct: number | null | undefined): number {
  if (pct === null || pct === undefined) return 5;
  if (pct < 0) return 0;
  if (pct < 20) return 5;
  if (pct < 40) return 10;
  return 15;
}

function occupancyWeight(occupied: boolean | null | undefined): number {
  if (occupied === true) return 8;
  if (occupied === false) return 4;
  return 2;
}

function tenureWeight(years: number | null | undefined): number {
  if (years === null || years === undefined) return 0;
  if (years >= 10) return 5;
  if (years >= 5) return 3;
  return 1;
}

function contactabilityWeight(score: number | null | undefined): number {
  if (score === null || score === undefined) return 0;
  if (score >= 0.7) return 10;
  if (score >= 0.3) return 4;
  return 0;
}

function complianceWeight(state: boolean | undefined, glba: boolean | undefined): number {
  if (state === true && glba === true) return 7;
  if (state === true || glba === true) return 4;
  return 0;
}

export function preForeclosureScore(
  input: PreForeclosureScoreInput
): PreForeclosureScoreResult {
  const stage = STAGE_WEIGHTS[input.foreclosureStage] ?? 8;
  const auction = auctionProximityWeight(input.daysUntilAuction);
  const equity = equityWeight(input.equityPercent);
  const occupancy = occupancyWeight(input.ownerOccupied);
  const tenure = tenureWeight(input.tenureYears);
  const tax = input.taxDelinquent ? 5 : 0;
  const buyBox = input.insideBuyBox === false ? 0 : input.insideBuyBox === true ? 5 : 3;
  const contact = contactabilityWeight(input.contactabilityScore);
  const compliance = complianceWeight(input.stateAttested, input.glbaAttested);
  const corroboration = (input.sourceCount ?? 1) >= 2 ? 5 : 2;

  const breakdown = {
    foreclosure_stage: stage,
    auction_proximity: auction,
    equity: equity,
    owner_occupied: occupancy,
    length_of_ownership: tenure,
    tax_delinquency: tax,
    property_value_tier: buyBox,
    contactability: contact,
    compliance_posture: compliance,
    multi_source_corroboration: corroboration
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  let recommendation: PreForeclosureScoreResult["recommendation"];
  if (total >= 75) recommendation = "auction_critical";
  else if (total >= 55) recommendation = "outreach_ready";
  else if (total >= 35) recommendation = "watch";
  else recommendation = "drop";

  const reasoning: string[] = [];
  reasoning.push(`stage=${input.foreclosureStage} (+${stage})`);
  if (input.daysUntilAuction !== undefined && input.daysUntilAuction !== null) {
    reasoning.push(`auction in ${input.daysUntilAuction}d (+${auction})`);
  }
  if (input.equityPercent !== undefined && input.equityPercent !== null) {
    reasoning.push(`equity ${Math.round(input.equityPercent)}% (+${equity})`);
  }
  if (input.ownerOccupied !== undefined && input.ownerOccupied !== null) {
    reasoning.push(`${input.ownerOccupied ? "owner-occupied" : "absentee"} (+${occupancy})`);
  }
  if (compliance === 0) {
    reasoning.push(
      "compliance: state and/or GLBA attestation missing — lead cannot be pursued until operator attests"
    );
  }

  return { total, breakdown, recommendation, reasoning };
}

/**
 * Recommend an exit strategy from a scored deal's underwriting + signals.
 * (Restored — Commit 3 inadvertently overlapped this declaration during
 * the preForeclosureScore insertion.)
 */
export function recommendExit(args: {
  motivationScore: number;
  maoWholesale?: number | null;
  maoBrrrr?: number | null;
  maoFlip?: number | null;
  arvMid?: number | null;
  rentEstimate?: number | null;
  subToViability?: string | null;
}): string {
  if (args.subToViability === "grand_slam") return "sub_to";
  if (args.motivationScore < 40) return "decline";

  const rentToPriceRatio =
    args.rentEstimate && args.arvMid
      ? (args.rentEstimate * 12) / args.arvMid
      : 0;

  if (rentToPriceRatio >= 0.12 && args.maoBrrrr) return "brrrr";
  if (args.maoWholesale && args.maoWholesale > 0) return "wholesale";
  if (args.maoFlip && args.maoFlip > 0) return "flip";
  if (args.motivationScore >= 70) return "novation";
  return "decline";
}
