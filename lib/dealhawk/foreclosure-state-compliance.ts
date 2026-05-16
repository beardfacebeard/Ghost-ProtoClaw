/**
 * Dealhawk Empire — Pre-Foreclosure State Compliance Matrix.
 *
 * Per-state rules for foreclosure-related outreach + equity-purchase
 * activity. Ground truth for what the State Compliance Review Agent
 * enforces. See DEALHAWK_PRE_FORECLOSURE_MODULE_PLAN.md §9 for the
 * underlying research.
 *
 * SCOPE: This file encodes the *direction* of each state's foreclosure
 * statute plus a required notice template. It is NOT a substitute for
 * counsel review (decision #5 in the plan: counsel is OPTIONAL). KB
 * entries surface the verbatim statutory notices the operator
 * acknowledges; this file is the programmatic gate.
 *
 * Tiers:
 *   - low                — universal disclaimers + HUD-counselor referral
 *   - state_disclosure   — additional state-specific notice required
 *                          before/with outreach (no rescission contract)
 *   - rescission         — state requires a rescission period (3-5 days)
 *                          + conspicuous statutory notice on any
 *                          equity-purchase contract
 *   - criminal_exposure  — non-compliance carries criminal liability
 *                          (CA / MD / IL / MN / CO + FL fraudulent
 *                          transfer)
 *
 * Operator attestation: every state requires the operator to acknowledge
 * the ship-default notice template (or substitute counsel-reviewed
 * language) before outreach can fire for leads in that state.
 * Attestation is stored in Business.config.preForeclosure.attestations.
 *
 * MAINTENANCE: state legislatures move quarterly. Each entry has a
 * `lastReviewedAt` date; the UI surfaces entries older than 12 months
 * for re-review.
 */

export type ForeclosureComplianceTier =
  | "low"
  | "state_disclosure"
  | "rescission"
  | "criminal_exposure";

export type ForeclosureStateCompliance = {
  /** 2-letter USPS state code (or "DC"). */
  state: string;
  /** Full state name. */
  fullName: string;
  tier: ForeclosureComplianceTier;
  /** Foreclosure regime (drives which document types appear at the
   *  county recorder vs the court docket). */
  regime: "judicial" | "non_judicial" | "hybrid" | "mixed_with_oversight";
  /** Required rescission period in days, when applicable. Null when the
   *  state has no statutory rescission requirement for equity-purchase
   *  contracts. Counted in calendar days unless `rescissionBusinessDays`
   *  is set. */
  rescissionDays: number | null;
  rescissionBusinessDays?: boolean;
  /** Required statutory notice template. Operator acknowledges + may
   *  substitute counsel-reviewed language via per-state override. */
  statutoryNotice: string | null;
  /** Cap on operator's exposure description (for the State Compliance
   *  Review Agent + dashboard surface). */
  exposureSummary: string;
  /** Statute citations verified at lastReviewedAt. */
  references: string[];
  /** ISO date (YYYY-MM-DD) this entry was last researched. */
  lastReviewedAt: string;
};

// ── Universal disclaimers (apply to all 50 states + DC) ──────────────

export const UNIVERSAL_DISCLAIMERS = [
  "I am a private real estate investor, not a lender, attorney, real estate agent, or government representative.",
  "I am not offering legal, tax, or financial advice.",
  "You have the right to speak with a HUD-approved housing counselor for free at 1-800-569-4287 or hud.gov/findacounselor before making any decision."
];

// ── State-specific notices ────────────────────────────────────────────

// CA Civ. Code §§ 1695 & 2945 — Home Equity Sales Contract Act +
// Mortgage Foreclosure Consultants Act. 5-day right of rescission for
// equity-purchase contracts. § 2945.7 carries criminal exposure
// (up to 1 yr jail + $25K) for non-compliant foreclosure consultants.
// Notice text below is the ship-default; operators with counsel
// should substitute counsel-reviewed language.
const CA_STATUTORY_NOTICE = `\
NOTICE REQUIRED BY CALIFORNIA LAW (Civil Code § 1695.5)

Until your right to cancel this contract has ended, [BUYER NAME OR COMPANY]
or anyone working for [BUYER NAME OR COMPANY] CANNOT ask you to sign or have
you sign any deed or any other document.

You may cancel this contract for the sale of your house WITHOUT ANY PENALTY
OR OBLIGATION at any time before [DATE — at least 5 business days after the
date the contract is signed, or 8:00 a.m. on the day scheduled for the sale
of your property, whichever occurs first].

See the attached notice of cancellation form for an explanation of this right.

[OPERATOR — replace bracketed placeholders. Verify the cancellation form
under Civ. Code § 1695.6 is attached to every contract.]`;

// MD Real Prop. § 7-301 et seq. — PHIFA. 5-day rescission, criminal
// up to 5 yrs / $25K.
const MD_STATUTORY_NOTICE = `\
NOTICE REQUIRED BY MARYLAND LAW (Real Prop. § 7-310)

YOU HAVE THE RIGHT TO CANCEL THIS CONTRACT AT ANY TIME BEFORE MIDNIGHT
OF THE FIFTH BUSINESS DAY AFTER THE DATE YOU SIGN THE CONTRACT, OR ON THE
DATE BEFORE THE SALE OF THE PROPERTY UNDER THE FORECLOSURE PROCEEDING,
WHICHEVER OCCURS FIRST.

SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION OF THIS RIGHT.

[OPERATOR — Maryland-specific. PHIFA requires this notice in 14-point bold,
upper-case type, on the first page of every contract. Verify with counsel.]`;

// IL 765 ILCS 940 — Mortgage Rescue Fraud Act. 5-day rescission, Class
// 4 felony for knowing violation.
const IL_STATUTORY_NOTICE = `\
NOTICE REQUIRED BY ILLINOIS LAW (765 ILCS 940)

YOU MAY CANCEL THIS CONTRACT, WITHOUT ANY PENALTY OR OBLIGATION, AT ANY TIME
BEFORE MIDNIGHT OF THE FIFTH BUSINESS DAY AFTER THE DATE YOU SIGN THIS
CONTRACT. SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION
OF THIS RIGHT.

[OPERATOR — Illinois Mortgage Rescue Fraud Act. Required language in 14-point
bold per 765 ILCS 940/40(c). Verify with counsel.]`;

// MN § 325N.10 / Subd. 5b. 5 BUSINESS-day rescission. 14-pt bold notice.
// Felony for material violations.
const MN_STATUTORY_NOTICE = `\
NOTICE REQUIRED BY MINNESOTA LAW (§ 325N.10 Subd. 5b)

YOU MAY CANCEL THIS CONTRACT FOR THE SALE OF YOUR HOUSE WITHOUT ANY PENALTY
OR OBLIGATION AT ANY TIME BEFORE [DATE AND TIME OF DAY], OR BY 2:00 P.M. ON
THE DAY AFTER THE FORECLOSURE SALE, WHICHEVER OCCURS FIRST.

SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION OF THIS RIGHT.

[OPERATOR — Minnesota. Required in 14-point bold type. Date is 5 business
days after signing. Verify with counsel.]`;

// CO C.R.S. § 6-1-1101 — Colorado Foreclosure Protection Act.
// 5-day rescission. $1,500/violation civil statutory damages.
const CO_STATUTORY_NOTICE = `\
NOTICE REQUIRED BY COLORADO LAW (C.R.S. § 6-1-1101 et seq.)

YOU MAY CANCEL THIS CONTRACT FOR THE SALE OF YOUR HOUSE WITHOUT ANY PENALTY
OR OBLIGATION AT ANY TIME BEFORE MIDNIGHT ON THE FIFTH BUSINESS DAY AFTER THE
DATE YOU SIGNED THIS CONTRACT.

SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION OF THIS RIGHT.

[OPERATOR — Colorado FPA. Required language in 12-point bold per statute.
Verify with counsel.]`;

// NY RPL § 265-a — Home Equity Theft Prevention Act. 5-day rescission.
const NY_STATUTORY_NOTICE = `\
NOTICE REQUIRED BY NEW YORK LAW (Real Property Law § 265-a)

YOU MAY CANCEL THIS CONTRACT AT ANY TIME BEFORE MIDNIGHT OF THE FIFTH
BUSINESS DAY AFTER THE DAY YOU SIGNED THIS CONTRACT, OR ANY TIME PRIOR TO
THE TRANSFER OF THE PROPERTY, WHICHEVER COMES FIRST.

SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION OF THIS RIGHT.

[OPERATOR — NY HETPA. Required language. Operator must also file a "covered
contract" with the county clerk per § 265-a(8). Verify with counsel.]`;

// FL Ch. 501.1377 — Foreclosure Rescue Fraud Prevention Act. 3-day
// rescission. Potential 3rd-degree felony for fraudulent transfer.
const FL_STATUTORY_NOTICE = `\
NOTICE REQUIRED BY FLORIDA LAW (Fla. Stat. § 501.1377)

YOU MAY CANCEL THIS CONTRACT AT ANY TIME BEFORE MIDNIGHT OF THE THIRD
BUSINESS DAY AFTER THE DATE YOU SIGNED THIS CONTRACT.

SEE THE ATTACHED NOTICE OF CANCELLATION FORM FOR AN EXPLANATION OF THIS RIGHT.

[OPERATOR — Florida FRFPA. Required language. Verify with counsel — FDUTPA
exposure layered on top.]`;

// ── Baseline notice for the remaining 43 states + DC ─────────────────

const BASELINE_NOTICE = `\
NOTICE TO HOMEOWNER

This communication is from a private real estate investor. It is not from
your lender, the government, a foreclosure-prevention counselor, an attorney,
or a real estate agent.

You have the right to speak with a HUD-approved housing counselor for free
at 1-800-569-4287 or hud.gov/findacounselor before making any decision about
your property.

You are under no obligation to respond to this communication. To stop further
contact, reply with "STOP" or contact us directly to be removed from our list.

[OPERATOR — This is the ship-default notice for states without a specific
foreclosure-consultant or equity-purchaser statute. If your state has a
specific notice requirement that is not listed here, substitute it via the
per-state template override.]`;

// ── Per-state matrix ──────────────────────────────────────────────────

const REVIEWED = "2026-05-16";

function lowRow(
  state: string,
  fullName: string,
  regime: ForeclosureStateCompliance["regime"]
): ForeclosureStateCompliance {
  return {
    state,
    fullName,
    tier: "low",
    regime,
    rescissionDays: null,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "Universal disclaimers + HUD-counselor referral. No state-specific foreclosure-consultant or equity-purchaser statute on file. Operator attestation acknowledges the ship-default template.",
    references: [],
    lastReviewedAt: REVIEWED
  };
}

export const FORECLOSURE_STATE_COMPLIANCE: Record<
  string,
  ForeclosureStateCompliance
> = {
  CA: {
    state: "CA",
    fullName: "California",
    tier: "criminal_exposure",
    regime: "non_judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: CA_STATUTORY_NOTICE,
    exposureSummary:
      "Civ. Code §§ 1695 (Home Equity Sales Contract Act) + 2945 (Mortgage Foreclosure Consultants Act). Equity purchasers must provide a written contract with a 5-business-day right of rescission and the statutory notice in 14-point bold. Foreclosure consultants must be licensed RE brokers with a $100K bond. § 2945.7 carries criminal liability up to 1 yr jail + $25K fine per violation.",
    references: ["Cal. Civ. Code § 1695", "Cal. Civ. Code § 2945", "Cal. Bus. & Prof. § 10131.2"],
    lastReviewedAt: REVIEWED
  },
  MD: {
    state: "MD",
    fullName: "Maryland",
    tier: "criminal_exposure",
    regime: "mixed_with_oversight",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: MD_STATUTORY_NOTICE,
    exposureSummary:
      "Real Prop. § 7-301 et seq. (Protection of Homeowners in Foreclosure Act — PHIFA). Equity purchaser written contract + 5-business-day rescission + arms-length value + recording delay. Criminal exposure up to 5 years + $25K. Treble damages + attorney's fees.",
    references: ["Md. Real Prop. § 7-301 et seq.", "Md. Real Prop. § 7-105.1"],
    lastReviewedAt: REVIEWED
  },
  IL: {
    state: "IL",
    fullName: "Illinois",
    tier: "criminal_exposure",
    regime: "judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: IL_STATUTORY_NOTICE,
    exposureSummary:
      "765 ILCS 940 (Mortgage Rescue Fraud Act). 'Distressed property purchaser' and 'distressed property consultant' both regulated. 5-business-day rescission. No upfront fees for rescue services. Class 4 felony for knowing violation. SEPARATE wholesaler-license statute: 225 ILCS 454/5-32 requires a real-estate license for 2+ wholesale deals per 12-month period.",
    references: ["765 ILCS 940", "225 ILCS 454/5-32"],
    lastReviewedAt: REVIEWED
  },
  MN: {
    state: "MN",
    fullName: "Minnesota",
    tier: "criminal_exposure",
    regime: "non_judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: MN_STATUTORY_NOTICE,
    exposureSummary:
      "§ 325N.10 et seq. (Mortgage Foreclosure Consultants Act + Subd. 5b Equity Purchasers). 5-business-day rescission extending to 2 PM the day after foreclosure sale if signed within the 5 days. 14-point bold conspicuous notice. Felony for material violations. Treble damages.",
    references: ["Minn. Stat. § 325N.10 et seq."],
    lastReviewedAt: REVIEWED
  },
  CO: {
    state: "CO",
    fullName: "Colorado",
    tier: "criminal_exposure",
    regime: "non_judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: CO_STATUTORY_NOTICE,
    exposureSummary:
      "C.R.S. § 6-1-1101 et seq. (Foreclosure Protection Act). Triggered when a Notice of Election & Demand (NED) is recorded. 5-business-day rescission. Equity purchaser: written contract + conspicuous notice + arms-length + no leaseback bad-faith. Civil statutory damages $1,500/violation. Possible criminal.",
    references: ["C.R.S. § 6-1-1101 et seq."],
    lastReviewedAt: REVIEWED
  },
  NY: {
    state: "NY",
    fullName: "New York",
    tier: "criminal_exposure",
    regime: "judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: NY_STATUTORY_NOTICE,
    exposureSummary:
      "RPL § 265-a (Home Equity Theft Prevention Act). 5-business-day rescission. Covered contracts must be recorded with the county clerk. Civil and criminal exposure. NY judicial foreclosure averages 2+ years — leads are 'cold' by national standards, calibrate outreach cadence accordingly.",
    references: ["N.Y. Real Prop. Law § 265-a"],
    lastReviewedAt: REVIEWED
  },
  FL: {
    state: "FL",
    fullName: "Florida",
    tier: "criminal_exposure",
    regime: "judicial",
    rescissionDays: 3,
    rescissionBusinessDays: true,
    statutoryNotice: FL_STATUTORY_NOTICE,
    exposureSummary:
      "Fla. Stat. § 501.1377 (Foreclosure Rescue Fraud Prevention Act). 3-business-day rescission. Written agreement + conspicuous notice + prohibition on title transfer until rescission expires. Per-violation up to $15K civil + FDUTPA. Potential 3rd-degree felony for fraudulent transfer. State wholesaler-licensing exposure also evolving — verify per AG advisory.",
    references: ["Fla. Stat. § 501.1377", "Fla. Stat. Ch. 475"],
    lastReviewedAt: REVIEWED
  },
  // ── Rescission states (lower exposure than the 7 above but still
  //    require rescission + state-specific notice). ────────────────
  MA: {
    state: "MA",
    fullName: "Massachusetts",
    tier: "rescission",
    regime: "non_judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "M.G.L. c. 244 § 35A + 940 CMR 25.00 (AG Foreclosure Rescue Schemes). AG rules: written contract, 5-day rescission, no upfront fees. Ch. 93A UDAP exposure. Verify with counsel before substituting the baseline notice.",
    references: ["M.G.L. c. 244 § 35A", "940 CMR 25.00"],
    lastReviewedAt: REVIEWED
  },
  MO: {
    state: "MO",
    fullName: "Missouri",
    tier: "rescission",
    regime: "non_judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "§ 407.935 et seq. (Foreclosure Consultant Act). No upfront fees, written contract, rescission. Civil + Class D felony.",
    references: ["Mo. Rev. Stat. § 407.935"],
    lastReviewedAt: REVIEWED
  },
  NV: {
    state: "NV",
    fullName: "Nevada",
    tier: "rescission",
    regime: "non_judicial",
    rescissionDays: 5,
    rescissionBusinessDays: true,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "NRS Ch. 645F (covered service providers / loan modification consultants). Written contract, rescission, bond, license. Civil + criminal.",
    references: ["Nev. Rev. Stat. Ch. 645F"],
    lastReviewedAt: REVIEWED
  },
  OR: {
    state: "OR",
    fullName: "Oregon",
    tier: "rescission",
    regime: "non_judicial",
    rescissionDays: 5,
    rescissionBusinessDays: false,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "ORS 646A.730 (foreclosure-rescue services). Written contract + rescission + no upfront fees.",
    references: ["Or. Rev. Stat. § 646A.730"],
    lastReviewedAt: REVIEWED
  },
  WA: {
    state: "WA",
    fullName: "Washington",
    tier: "state_disclosure",
    regime: "non_judicial",
    rescissionDays: null,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "RCW 61.34 (Equity Skimming Prevention). Anti-equity-skimming; no leaseback to former owner with intent to defraud lender. Class B felony.",
    references: ["RCW 61.34"],
    lastReviewedAt: REVIEWED
  },
  GA: {
    state: "GA",
    fullName: "Georgia",
    tier: "state_disclosure",
    regime: "non_judicial",
    rescissionDays: null,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "O.C.G.A. § 10-1-393(b)(20) (Fair Business Practices). Disclosure-heavy regime for foreclosure-rescue services. UDAP / civil exposure.",
    references: ["O.C.G.A. § 10-1-393(b)(20)"],
    lastReviewedAt: REVIEWED
  },
  AZ: {
    state: "AZ",
    fullName: "Arizona",
    tier: "state_disclosure",
    regime: "non_judicial",
    rescissionDays: null,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "HB 2766 (2024) tightened foreclosure-consultant + wholesaler advertising rules. HB 2747 (2022) prior baseline. Verify with counsel.",
    references: ["Ariz. Rev. Stat. (HB 2766, HB 2747)"],
    lastReviewedAt: REVIEWED
  },
  MI: {
    state: "MI",
    fullName: "Michigan",
    tier: "state_disclosure",
    regime: "non_judicial",
    rescissionDays: null,
    statutoryNotice: BASELINE_NOTICE,
    exposureSummary:
      "MCL 445.1822 (foreclosure-rescue agreements). Disclosure + rescission requirements. Verify with counsel.",
    references: ["MCL 445.1822"],
    lastReviewedAt: REVIEWED
  },
  // ── Baseline (low-exposure) states ────────────────────────────────
  AL: lowRow("AL", "Alabama", "non_judicial"),
  AK: lowRow("AK", "Alaska", "non_judicial"),
  AR: lowRow("AR", "Arkansas", "non_judicial"),
  CT: lowRow("CT", "Connecticut", "judicial"),
  DE: lowRow("DE", "Delaware", "judicial"),
  DC: lowRow("DC", "District of Columbia", "non_judicial"),
  HI: lowRow("HI", "Hawaii", "hybrid"),
  ID: lowRow("ID", "Idaho", "non_judicial"),
  IN: lowRow("IN", "Indiana", "judicial"),
  IA: lowRow("IA", "Iowa", "judicial"),
  KS: lowRow("KS", "Kansas", "judicial"),
  KY: lowRow("KY", "Kentucky", "judicial"),
  LA: lowRow("LA", "Louisiana", "judicial"),
  ME: lowRow("ME", "Maine", "judicial"),
  MS: lowRow("MS", "Mississippi", "non_judicial"),
  MT: lowRow("MT", "Montana", "non_judicial"),
  NE: lowRow("NE", "Nebraska", "hybrid"),
  NH: lowRow("NH", "New Hampshire", "non_judicial"),
  NJ: lowRow("NJ", "New Jersey", "judicial"),
  NM: lowRow("NM", "New Mexico", "judicial"),
  NC: lowRow("NC", "North Carolina", "non_judicial"),
  ND: lowRow("ND", "North Dakota", "judicial"),
  OH: lowRow("OH", "Ohio", "judicial"),
  OK: lowRow("OK", "Oklahoma", "hybrid"),
  PA: lowRow("PA", "Pennsylvania", "judicial"),
  RI: lowRow("RI", "Rhode Island", "non_judicial"),
  SC: lowRow("SC", "South Carolina", "judicial"),
  SD: lowRow("SD", "South Dakota", "hybrid"),
  TN: lowRow("TN", "Tennessee", "non_judicial"),
  TX: lowRow("TX", "Texas", "non_judicial"),
  UT: lowRow("UT", "Utah", "non_judicial"),
  VT: lowRow("VT", "Vermont", "judicial"),
  VA: lowRow("VA", "Virginia", "non_judicial"),
  WV: lowRow("WV", "West Virginia", "non_judicial"),
  WI: lowRow("WI", "Wisconsin", "judicial"),
  WY: lowRow("WY", "Wyoming", "non_judicial")
};

// ── Public API ────────────────────────────────────────────────────────

export function getForeclosureCompliance(
  state: string | null | undefined
): ForeclosureStateCompliance | null {
  if (!state) return null;
  const key = state.trim().toUpperCase();
  return FORECLOSURE_STATE_COMPLIANCE[key] ?? null;
}

export function allForeclosureStateCodes(): string[] {
  return Object.keys(FORECLOSURE_STATE_COMPLIANCE).sort();
}

/** Operator attestation shape stored on
 *  Business.config.preForeclosure.attestations[state]. */
export type StateAttestation = {
  attestedAt: string; // ISO datetime
  attestedBy: string; // email or user id
  /** Optional operator-supplied counsel-reviewed notice that overrides
   *  the ship-default statutoryNotice for this state. */
  templateOverride?: string;
};

/** Parse the attestation map off a Business.config blob. Returns an
 *  empty object when missing or malformed. */
export function parseAttestations(
  config: unknown
): Record<string, StateAttestation> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  const pre = (config as Record<string, unknown>).preForeclosure;
  if (!pre || typeof pre !== "object" || Array.isArray(pre)) return {};
  const att = (pre as Record<string, unknown>).attestations;
  if (!att || typeof att !== "object" || Array.isArray(att)) return {};
  return att as Record<string, StateAttestation>;
}

/** Predicate: does this state have an active operator attestation in
 *  this business's config? */
export function hasStateAttestation(
  config: unknown,
  state: string
): boolean {
  const map = parseAttestations(config);
  const key = state.trim().toUpperCase();
  return Boolean(map[key]?.attestedAt);
}

/** Predicate: does this state require an attestation before outreach
 *  can fire? Per decision #1 (all 50 states with per-state gating),
 *  the answer is always yes — but `tier` drives the depth of the gate
 *  (criminal_exposure states have additional warnings in the UI). */
export function requiresAttestation(
  state: string | null | undefined
): boolean {
  return getForeclosureCompliance(state) !== null;
}

/** Resolve the effective statutory notice for this state: operator's
 *  counsel-reviewed override (when present) or the ship-default. */
export function resolveStatutoryNotice(
  config: unknown,
  state: string
): string | null {
  const entry = getForeclosureCompliance(state);
  if (!entry) return null;
  const map = parseAttestations(config);
  const att = map[state.trim().toUpperCase()];
  return att?.templateOverride?.trim() || entry.statutoryNotice;
}

// ── Compliance review entry point ─────────────────────────────────────

export type ComplianceReviewInput = {
  state: string;
  /** Outreach channel — drives which compliance layer applies
   *  most heavily. */
  channel: "mail" | "email" | "sms" | "call" | "voicemail";
  /** Optional foreclosure-record context. When present, the state's
   *  statutory-notice trigger is considered active (NOD / LP / etc.
   *  has been recorded). When absent, the review still runs but the
   *  EP/FC statute may not yet be triggered. */
  foreclosureRecorded: boolean;
  /** The draft outreach copy to review. */
  draft: string;
  /** Operator's attestation map for the business. */
  attestations: Record<string, StateAttestation>;
};

export type ComplianceReviewResult = {
  decision: "PASS" | "PASS_WITH_NOTICE" | "BLOCK";
  /** When PASS_WITH_NOTICE, the agent should append this required
   *  notice text to the outreach before sending. */
  requiredNotice?: string;
  /** Operator-facing rationale + remediation list. */
  rationale: string[];
  /** Hard blockers that the draft must be rewritten to clear. */
  blockers: string[];
};

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /URGENT:?\s*Foreclosure\s+Notice|URGENT[^a-z]+/i,
    reason: "Artificial urgency / government-impersonation pattern. Drop 'URGENT' framing."
  },
  {
    pattern: /\b(HUD|HAMP|HARP)\b|Government\s+Program|federal\s+program/i,
    reason:
      "Government / federal-program impersonation. Never imply affiliation with HUD/HAMP/HARP or any government program. Keep the 1-800-569-4287 HUD-counselor referral, but never claim to BE the program."
  },
  {
    pattern: /we\s+can\s+stop\s+your\s+foreclosure|stop\s+the\s+foreclosure/i,
    reason:
      "Foreclosure-consultant statute trigger. Never promise to 'stop' foreclosure — that crosses into FC territory in CA/MD/IL/MN/CO/NY/FL and other states."
  },
  {
    pattern: /your\s+lender\s+(has\s+)?authorized|lender\s+sent\s+us/i,
    reason:
      "False authority / impersonation. Never claim lender authorization."
  },
  {
    pattern:
      /(respond|reply|call)\s+within\s+24\s+hours|act\s+now|limited\s+time|today\s+only/i,
    reason: "Artificial urgency. Distressed-homeowner outreach must not pressure-tactic."
  },
  {
    pattern: /(licensed|certified)\s+(housing\s+)?counselor/i,
    reason:
      "Implied licensure / counselor status. State 'I am not a HUD-approved housing counselor' explicitly."
  },
  {
    pattern: /Department\s+of|U\.S\.\s+Government|Treasury|FHFA/i,
    reason: "Government-agency look-alike. Avoid Treasury / FHFA / Department-of references."
  }
];

const REQUIRED_DISCLAIMERS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /private\s+real\s+estate\s+investor|real\s+estate\s+investor/i,
    reason:
      "Missing identity disclaimer: 'I am a private real estate investor, not a lender / attorney / agent / government representative.'"
  },
  {
    pattern: /not\s+(offering|providing)\s+(legal|financial|tax)\s+advice/i,
    reason:
      "Missing advice disclaimer: 'I am not offering legal, tax, or financial advice.'"
  },
  {
    pattern: /1-800-569-4287|hud\.gov/i,
    reason:
      "Missing HUD-counselor referral: 'You have the right to speak with a HUD-approved housing counselor for free at 1-800-569-4287 or hud.gov/findacounselor before making any decision.'"
  }
];

export function reviewOutreachDraft(
  input: ComplianceReviewInput
): ComplianceReviewResult {
  const blockers: string[] = [];
  const rationale: string[] = [];

  const compliance = getForeclosureCompliance(input.state);
  if (!compliance) {
    return {
      decision: "BLOCK",
      blockers: [`Unknown state code "${input.state}" — cannot review.`],
      rationale: [
        "State compliance entry is missing. The State Compliance Review Agent refuses to clear outreach for an unmapped state. Operator: verify the state code (2-letter USPS) on the ForeclosureRecord and/or add a custom state entry."
      ]
    };
  }

  const key = input.state.trim().toUpperCase();
  const attestation = input.attestations[key];

  // Hard gate: operator must have attested for this state.
  if (!attestation?.attestedAt) {
    blockers.push(
      `Operator has not attested for ${compliance.fullName}. Outreach to leads in ${key} is blocked until attestation is recorded at /admin/businesses/[id]/foreclosures/compliance.`
    );
  }

  // SMS gate (decision #4: default OFF, opt-in per state).
  if (input.channel === "sms" && !attestation?.templateOverride) {
    rationale.push(
      `Cold SMS is OFF by default at the template level (decision #4 in DEALHAWK_PRE_FORECLOSURE_MODULE_PLAN.md). To enable SMS for ${compliance.fullName}, the operator must explicitly opt in per-state AND complete 10DLC + RND scrub setup. Until then, the State Compliance Review Agent refuses SMS drafts.`
    );
    blockers.push(
      "SMS channel disabled for pre-foreclosure outreach. Switch the draft to mail (Lob) or email (Resend), or have the operator enable SMS for this state."
    );
  }

  // Voicemail (ringless) is never allowed.
  if (input.channel === "voicemail") {
    blockers.push(
      "Ringless voicemail (RVM) is treated as a TCPA call by the FCC. The platform refuses RVM for pre-foreclosure outreach across all states."
    );
  }

  // Forbidden patterns in the draft.
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(input.draft)) {
      blockers.push(reason);
    }
  }

  // Required disclaimers.
  const missingDisclaimers: string[] = [];
  for (const { pattern, reason } of REQUIRED_DISCLAIMERS) {
    if (!pattern.test(input.draft)) {
      missingDisclaimers.push(reason);
    }
  }
  if (missingDisclaimers.length > 0) {
    blockers.push(...missingDisclaimers);
  }

  if (blockers.length > 0) {
    return {
      decision: "BLOCK",
      blockers,
      rationale: [
        `State: ${compliance.fullName} (tier: ${compliance.tier}, regime: ${compliance.regime}). Exposure: ${compliance.exposureSummary}`,
        ...rationale
      ]
    };
  }

  // Resolve required statutory notice for PASS_WITH_NOTICE outcomes
  // when the state has one AND the foreclosure has been recorded
  // (statute trigger is active).
  if (compliance.statutoryNotice && input.foreclosureRecorded) {
    const overrideOrDefault =
      attestation?.templateOverride?.trim() || compliance.statutoryNotice;
    return {
      decision: "PASS_WITH_NOTICE",
      requiredNotice: overrideOrDefault,
      rationale: [
        `State: ${compliance.fullName} (tier: ${compliance.tier}). Operator-attested.`,
        `Rescission: ${
          compliance.rescissionDays
            ? `${compliance.rescissionDays} ${compliance.rescissionBusinessDays ? "business " : ""}days`
            : "n/a"
        }. The required statutory notice has been appended to the draft. Operator must verify rescission timing is correctly calculated relative to contract execution.`,
        `Citations: ${compliance.references.join("; ") || "(none on file)"}`
      ],
      blockers: []
    };
  }

  return {
    decision: "PASS",
    rationale: [
      `State: ${compliance.fullName} (tier: ${compliance.tier}). Operator-attested.`,
      "No outstanding statutory-notice requirement for this draft. Baseline disclaimers present."
    ],
    blockers: []
  };
}
