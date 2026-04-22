/**
 * Dealhawk Empire — State-by-state wholesaler disclosure matrix.
 *
 * Ground truth for what outreach / disposition language the template must
 * auto-insert per state. The Disposition Agent, Seller Outreach Agent, and
 * Creative Finance Architect all reference this matrix to produce compliant
 * output.
 *
 * SCOPE: This file encodes the *direction* of each state's rules plus a
 * disclosure string template the app can render. It is NOT a substitute for
 * attorney review. The `references` field names the current statute / rule
 * at the time of the last review; operators must verify current law with a
 * state-licensed real-estate attorney before closing. Full statute text and
 * nuances live in the knowledge base article "State-by-state wholesaling
 * legality (all 50)".
 *
 * MAINTENANCE: `lastReviewedAt` is the last date this entry's content was
 * researched. Entries without statute citations use a generic equitable-
 * interest disclosure that satisfies the baseline principle (markets the
 * contract, not the property, and names the wholesaler as a principal rather
 * than a licensed agent). These will be hardened during Phase 7 (Legal
 * Firewall) with attorney-reviewed language per state.
 */

export type WholesalingTier =
  /** No specific wholesaler statute. General principal-as-buyer activity
   *  is permissible if the operator markets the contract (equitable
   *  interest) rather than the underlying property. */
  | "permissive"
  /** Written wholesaler disclosure to the seller and/or end buyer is
   *  explicitly required by statute or regulation. */
  | "disclosure"
  /** Wholesaler must register with the state real-estate commission or
   *  a similar agency before conducting wholesale activity. */
  | "registration"
  /** A real-estate license is effectively required for repeat
   *  wholesaling activity in this state; single-deal principal activity
   *  may still be exempt. */
  | "license"
  /** Strictest tier — explicit anti-wholesaling statute with criminal
   *  and/or civil penalties for unlicensed wholesale activity, caps on
   *  unlicensed assignments per year, or prohibition of assignment
   *  marketing without a license. Double-close is strongly recommended
   *  in these states. */
  | "strict";

export type StateDisclosure = {
  /** 2-letter USPS state code (or "DC"). */
  state: string;
  /** Full state name. */
  fullName: string;
  tier: WholesalingTier;
  /** Generic equitable-interest disclosure included on every disposition
   *  output. Markets the contract, not the property, and positions the
   *  wholesaler as a principal rather than a licensed agent. */
  equitableInterestDisclosure: string;
  /** Additional state-specific seller disclosure language required by
   *  this state's statute or rule. Null for permissive states where the
   *  baseline equitable-interest disclosure is sufficient. */
  sellerDisclosure: string | null;
  /** Additional state-specific buyer disclosure for dispositions. Null
   *  for states with no buyer-side requirement. */
  buyerDisclosure: string | null;
  /** True when assignment marketing is risky enough that a double close
   *  (two closings, wholesaler briefly takes title) is the pro move. */
  doubleCloseRecommended: boolean;
  /** Short operator-facing note. 1–2 sentences. */
  notes: string;
  /** ISO date (YYYY-MM-DD) this entry was last researched. Content may
   *  be stale if the current date is more than 6 months past this. */
  lastReviewedAt: string;
  /** Statute / rule citations verified at `lastReviewedAt`. */
  references: string[];
};

// Default equitable-interest disclosure used by permissive-tier states.
// Keep the language neutral and survivable even if the state later
// tightens its rules — markets the contract, names the operator as a
// principal, and warns the buyer that they are acquiring an equitable
// interest in a contract rather than the underlying property.
const DEFAULT_EQUITABLE_INTEREST_DISCLOSURE =
  "The seller of this opportunity is marketing an equitable interest in a purchase contract to acquire the referenced real property, not the property itself. The person marketing this interest is acting as a principal in the transaction and is not a licensed real-estate broker or agent. The end buyer is acquiring the right to close on the underlying purchase contract, subject to the contract's terms and any applicable state disclosures.";

// Short strict-state banner appended to disclosure blocks when the state
// requires a wholesaler disclosure or wholesaling activity is otherwise
// regulated. The Disposition Agent renders this at the top of every
// buyer-facing deal package for strict / disclosure / registration / license
// states.
const STRICT_STATE_BANNER = (stateName: string, statuteRef: string) =>
  `IMPORTANT: ${stateName} requires a statutory wholesaler disclosure (${statuteRef}). The operator must review the current statute text with a ${stateName}-licensed real-estate attorney before distributing this deal package. This disclosure string is a template; it is not a substitute for attorney-drafted language.`;

/**
 * All 50 states + DC keyed by 2-letter USPS code.
 *
 * Content philosophy for Phase 0b-2:
 *   - Every entry has the baseline equitable-interest disclosure.
 *   - Strict / disclosure / registration / license tiers carry a
 *     "STRICT_STATE_BANNER + statute template" that signals the operator
 *     to pull attorney-drafted text.
 *   - Permissive entries carry just the baseline.
 *   - `lastReviewedAt` = "2025-12-01" is the researched-as-of-this-build
 *     cut line. Phase 7 hardens every entry with attorney review.
 */
export const STATE_DISCLOSURES: Record<string, StateDisclosure> = {
  AL: {
    state: "AL",
    fullName: "Alabama",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Alabama has no wholesaler-specific statute. Standard principal-as-buyer activity is permissible when marketing the equitable interest rather than the underlying property.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  AK: {
    state: "AK",
    fullName: "Alaska",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Alaska has no wholesaler-specific statute. Low transaction volume and remote logistics make virtual wholesaling challenging; ensure a local title company / closing attorney.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  AZ: {
    state: "AZ",
    fullName: "Arizona",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Arizona is a permissive wholesaling state. Large investor market; strong cash-buyer density in Phoenix metro. Hot market for Sub-To opportunities given rate-lock dynamics.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  AR: {
    state: "AR",
    fullName: "Arkansas",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Arkansas has no wholesaler-specific statute. Lower price points mean full cost-build MAO matters more than 70% rule.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  CA: {
    state: "CA",
    fullName: "California",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "California imposes heightened consumer-protection requirements on real-estate transactions involving distressed sellers. Operators must review the most current California BRE / DRE guidance on equitable-interest marketing, the 5-day cancellation right that may apply to distressed-property contracts, and the SB-1079 (2020) and subsequent rules governing institutional-investor purchases of foreclosure-sale properties with a California-licensed real-estate attorney before outreach.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "California treats distressed-seller transactions with extra scrutiny. Consult a California-licensed real-estate attorney before executing. Double-close is the safer pattern for assignments above trivial spreads.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Cal. Civ. Code § 1695 (Home Equity Sales Contract Act — distressed-property purchases)",
      "Cal. Bus. & Prof. Code § 10131 et seq. (real-estate licensing)",
    ],
  },
  CO: {
    state: "CO",
    fullName: "Colorado",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Colorado's Division of Real Estate has issued guidance that wholesalers marketing property itself (rather than the equitable interest) without a license may be engaged in unlicensed real-estate activity. The operator must disclose in writing that they are marketing a contract interest, not the underlying property, and are not acting as a licensed agent. Consult a Colorado-licensed real-estate attorney before outreach.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Colorado DRE has tightened enforcement. Market the equitable interest only, include the written disclosure, and use double-close for assignments above 10% of purchase price.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Colo. Rev. Stat. § 12-10-201 (real-estate licensing)",
      "Colorado DRE Bulletin on wholesaling (periodically updated)",
    ],
  },
  CT: {
    state: "CT",
    fullName: "Connecticut",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Connecticut requires that any person not licensed as a real-estate broker who enters into a contract for the purchase of residential real property with the intent to assign the contract must provide written disclosure to the seller of that intent, the nature of the assignment, and the right of the seller to cancel the contract within a statutory window. The operator must pull the current disclosure form text with a Connecticut-licensed real-estate attorney before sending any purchase agreement.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Connecticut requires written disclosure of assignment intent to the seller. Use attorney-drafted disclosure; do not rely on generic templates.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Conn. Gen. Stat. § 20-325a (unlicensed real-estate activity)",
      "Connecticut Department of Consumer Protection — wholesaler guidance",
    ],
  },
  DE: {
    state: "DE",
    fullName: "Delaware",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Delaware has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  DC: {
    state: "DC",
    fullName: "District of Columbia",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "The District of Columbia has consumer-protection requirements that may apply to distressed-property purchases. Operators must consult a DC-licensed real-estate attorney before entering into a distressed-property purchase contract.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "DC has tight consumer-protection rules and an active attorney general with real-estate enforcement history. Attorney review is non-negotiable.",
    lastReviewedAt: "2025-12-01",
    references: [
      "D.C. Code § 42-3508 (tenant rights — material in disposition of occupied properties)",
    ],
  },
  FL: {
    state: "FL",
    fullName: "Florida",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Florida is a permissive wholesaling state. Very large investor market. Florida DBPR (Dept. of Business & Professional Regulation) has taken action against wholesalers who market the property itself rather than the contract — keep dispositions strictly on equitable-interest language.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Fla. Stat. § 475.01 (real-estate licensing — wholesaler as principal is exempt)",
    ],
  },
  GA: {
    state: "GA",
    fullName: "Georgia",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Georgia is a permissive wholesaling state. Strong Atlanta-metro investor market.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  HI: {
    state: "HI",
    fullName: "Hawaii",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Hawaii's Mortgage Foreclosure Dispute Resolution program and distressed-property statutes create significant additional obligations for purchasers of pre-foreclosure properties. Operators must consult a Hawaii-licensed real-estate attorney before distressed-property outreach.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Hawaii has aggressive pre-foreclosure consumer-protection rules. Attorney review is essential.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Haw. Rev. Stat. § 467 (real-estate licensing)",
      "Haw. Rev. Stat. Ch. 667 (mortgage foreclosures)",
    ],
  },
  ID: {
    state: "ID",
    fullName: "Idaho",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Idaho has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  IL: {
    state: "IL",
    fullName: "Illinois",
    tier: "strict",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Illinois caps the number of residential real-estate contracts an unlicensed person may assign per year (per 225 ILCS 454, as amended by HB 1079 and subsequent updates). Beyond that cap, the operator must hold an Illinois real-estate broker or managing-broker license. Every assignment must include written disclosure to the seller of the assignment intent, the assignment price, and the end buyer. The operator must confirm the current annual cap and disclosure-form text with an Illinois-licensed real-estate attorney before every transaction.",
    buyerDisclosure:
      "Illinois requires that the assignment of a residential real-estate contract be disclosed to the end buyer in writing with specific statutory language.",
    doubleCloseRecommended: true,
    notes:
      "STRICT STATE. Illinois is one of the hardest wholesaling states in the US. Double-close for every deal over the annual unlicensed-assignment cap. Attorney review non-negotiable.",
    lastReviewedAt: "2025-12-01",
    references: [
      "225 ILCS 454 (Illinois Real Estate License Act of 2000, as amended)",
      "Ill. HB 1079 (2023, and subsequent updates capping unlicensed assignments)",
    ],
  },
  IN: {
    state: "IN",
    fullName: "Indiana",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Indiana has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  IA: {
    state: "IA",
    fullName: "Iowa",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Iowa has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  KS: {
    state: "KS",
    fullName: "Kansas",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Kansas has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  KY: {
    state: "KY",
    fullName: "Kentucky",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Kentucky Real Estate Commission has issued guidance that marketing real property by a person not acting as a principal in the transaction may constitute unlicensed real-estate activity. Wholesalers must market the equitable interest in their contract — never the underlying property — and must disclose assignment intent to the seller in writing. The operator must confirm the current disclosure requirements with a Kentucky-licensed real-estate attorney before outreach.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Kentucky Real Estate Commission actively polices marketing-the-property-without-a-license. Double-close is the pro move.",
    lastReviewedAt: "2025-12-01",
    references: [
      "KRS Chapter 324 (Kentucky Real Estate Brokers)",
      "Kentucky Real Estate Commission bulletins on wholesaling",
    ],
  },
  LA: {
    state: "LA",
    fullName: "Louisiana",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Louisiana is a civil-law state with distinct real-estate contract rules. The operator must engage a Louisiana-licensed real-estate attorney before any contract outreach. Assignment of residential real-estate contracts may be subject to additional disclosure requirements under Louisiana Revised Statutes.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Louisiana's civil-law system makes its contract rules different from every other state. Attorney review is essential.",
    lastReviewedAt: "2025-12-01",
    references: [
      "La. R.S. 37:1430 et seq. (Louisiana Real Estate License Law)",
    ],
  },
  ME: {
    state: "ME",
    fullName: "Maine",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Maine has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  MD: {
    state: "MD",
    fullName: "Maryland",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Maryland updated its wholesaler-disclosure requirements in 2024. Residential real-estate wholesalers must provide written disclosure to the seller at the time of contract of (a) wholesaler status, (b) intent to assign, (c) the right to cancel the contract within a statutory window, and (d) the wholesaler's anticipated assignment fee or profit. The operator must pull the current disclosure form text with a Maryland-licensed real-estate attorney before every transaction.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Maryland tightened its wholesaler rules in 2024. Written disclosure with specific elements is required. Attorney review is essential.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Md. Code, Business Occupations & Professions § 17-101 et seq.",
      "Maryland 2024 wholesaler-disclosure updates",
    ],
  },
  MA: {
    state: "MA",
    fullName: "Massachusetts",
    tier: "license",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Massachusetts treats real-estate marketing and negotiation strictly. Marketing a property without a license (rather than marketing the contract's equitable interest) may constitute unlicensed real-estate brokerage. Operators conducting repeat wholesaling activity should obtain a Massachusetts real-estate salesperson or broker license or use double-close transactions. Attorney review is non-negotiable.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Massachusetts is effectively a license-required state for repeat wholesalers. Double-close pattern or get licensed.",
    lastReviewedAt: "2025-12-01",
    references: [
      "M.G.L. Chapter 112, §§ 87PP-87DDD (Massachusetts real-estate licensing)",
    ],
  },
  MI: {
    state: "MI",
    fullName: "Michigan",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Michigan is a permissive wholesaling state. Detroit metro has active investor market.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  MN: {
    state: "MN",
    fullName: "Minnesota",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Minnesota's statutes on the purchase of residential real property from distressed homeowners (Minn. Stat. § 325N et seq. — the Minnesota Home Equity Conversion Act) impose additional disclosure requirements on pre-foreclosure purchases. The operator must consult a Minnesota-licensed real-estate attorney before distressed-property outreach.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Minnesota's Home Equity Conversion Act imposes real obligations on pre-foreclosure purchasers. Attorney review is essential.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Minn. Stat. § 325N (Home Equity Conversion Act)",
      "Minn. Stat. Ch. 82 (real-estate licensing)",
    ],
  },
  MS: {
    state: "MS",
    fullName: "Mississippi",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Mississippi has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  MO: {
    state: "MO",
    fullName: "Missouri",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Missouri is a permissive wholesaling state. Strong Kansas City and St. Louis investor markets.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  MT: {
    state: "MT",
    fullName: "Montana",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Montana has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  NE: {
    state: "NE",
    fullName: "Nebraska",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Nebraska has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  NV: {
    state: "NV",
    fullName: "Nevada",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes:
      "Nevada is a permissive wholesaling state. Las Vegas metro has strong investor volume.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  NH: {
    state: "NH",
    fullName: "New Hampshire",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "New Hampshire has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  NJ: {
    state: "NJ",
    fullName: "New Jersey",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "New Jersey's attorney-review rule requires that every residential real-estate contract signed by non-attorneys include a 3-business-day attorney-review window during which either party may disapprove the contract. Wholesalers must honor this window before any marketing / assignment activity. Additionally, marketing a property rather than the equitable interest without a New Jersey real-estate license is aggressively enforced by the NJ Real Estate Commission. Attorney review is essential.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "New Jersey has the 3-day attorney-review rule plus tight licensing scrutiny. Do not market during the attorney-review window. Double-close for non-trivial spreads.",
    lastReviewedAt: "2025-12-01",
    references: [
      "N.J.S.A. 45:15-1 et seq. (New Jersey Real Estate License Law)",
      "N.J. Sup. Ct. Rule on 3-day attorney-review window",
    ],
  },
  NM: {
    state: "NM",
    fullName: "New Mexico",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "New Mexico has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  NY: {
    state: "NY",
    fullName: "New York",
    tier: "license",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "New York requires a real-estate license for most brokering and marketing activity. Marketing a property rather than the equitable interest without a license is aggressively enforced by the NY Department of State. Additionally, NY contracts typically involve attorney representation on both sides. Operators should obtain a NY salesperson or broker license or use double-close transactions with attorney representation. Attorney review is non-negotiable.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "New York is effectively a license-required state for repeat wholesalers. Both parties typically have attorneys. Double-close or get licensed.",
    lastReviewedAt: "2025-12-01",
    references: [
      "N.Y. Real Property Law Article 12-A (Real Estate Brokers and Salespersons)",
    ],
  },
  NC: {
    state: "NC",
    fullName: "North Carolina",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "North Carolina Real Estate Commission has issued guidance that an unlicensed person marketing real property (rather than a contract interest) may be engaged in unlicensed real-estate brokerage. Wholesalers must market only the equitable interest in their contract, and must disclose to the seller in writing their intent to assign. The operator must confirm current disclosure requirements with a North Carolina-licensed real-estate attorney.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "North Carolina REC has issued formal wholesaling guidance. Written disclosure to seller required. Double-close for higher-spread deals.",
    lastReviewedAt: "2025-12-01",
    references: [
      "N.C. Gen. Stat. § 93A (real-estate licensing)",
      "NC Real Estate Commission bulletins on wholesaling",
    ],
  },
  ND: {
    state: "ND",
    fullName: "North Dakota",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "North Dakota has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  OH: {
    state: "OH",
    fullName: "Ohio",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Ohio Division of Real Estate and Professional Licensing has issued guidance that marketing property rather than an equitable interest in a contract may constitute unlicensed real-estate activity. The operator must market only the contract, not the property, and must disclose assignment intent to the seller. Confirm current requirements with an Ohio-licensed real-estate attorney.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Ohio Division of Real Estate has tightened guidance. Market the equitable interest only. Double-close for non-trivial spreads.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Ohio Rev. Code Chapter 4735 (real-estate licensing)",
    ],
  },
  OK: {
    state: "OK",
    fullName: "Oklahoma",
    tier: "strict",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Oklahoma's Predatory Real Estate Wholesaler Prohibition Act (effective 2022) makes it unlawful for an unlicensed person to engage in repeat wholesaling activity, defined broadly. The Act carries criminal and civil penalties. An unlicensed person may act as a principal in an isolated transaction if they hold genuine equitable interest and disclose that interest in writing to both the seller and any buyer. The operator must pull the current statute text with an Oklahoma-licensed real-estate attorney before EVERY transaction.",
    buyerDisclosure:
      "Oklahoma requires written disclosure of wholesaler status and equitable-interest nature to the end buyer.",
    doubleCloseRecommended: true,
    notes:
      "STRICT STATE. Oklahoma has the most explicit anti-wholesaling statute in the US. Attorney review is non-negotiable. Double-close is the only safe pattern for repeat activity.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Okla. Stat. tit. 59, § 858-101 et seq. (Oklahoma Real Estate License Code)",
      "Okla. Stat. tit. 59 — Predatory Real Estate Wholesaler Prohibition Act (2022)",
    ],
  },
  OR: {
    state: "OR",
    fullName: "Oregon",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Oregon Real Estate Agency has issued guidance that marketing property without a license may constitute unlicensed real-estate activity. Wholesalers must market the equitable interest only and must disclose assignment intent in writing to the seller. Confirm current disclosure requirements with an Oregon-licensed real-estate attorney.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Oregon REA has issued formal wholesaling guidance. Market the equitable interest only.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Or. Rev. Stat. § 696.010 et seq. (real-estate licensing)",
    ],
  },
  PA: {
    state: "PA",
    fullName: "Pennsylvania",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Pennsylvania tightened its wholesaler-disclosure requirements in 2024. Residential real-estate wholesalers must provide written disclosure to the seller at the time of contract of (a) wholesaler status, (b) intent to assign, (c) the seller's right to cancel, and (d) the anticipated assignment profit. The operator must confirm the current disclosure form text with a Pennsylvania-licensed real-estate attorney before every transaction.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Pennsylvania 2024 updates require specific written wholesaler disclosure. Attorney-drafted forms only.",
    lastReviewedAt: "2025-12-01",
    references: [
      "63 Pa. C.S. § 455 (Pennsylvania Real Estate Licensing and Registration Act)",
      "Pennsylvania 2024 wholesaler-disclosure updates",
    ],
  },
  RI: {
    state: "RI",
    fullName: "Rhode Island",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Rhode Island has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  SC: {
    state: "SC",
    fullName: "South Carolina",
    tier: "registration",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "South Carolina amended its real-estate statutes in 2023 to require wholesalers to register with the SC Department of Labor, Licensing and Regulation (LLR) and provide specific written disclosures to sellers of (a) wholesaler status, (b) intent to assign, (c) the equitable-interest nature of the marketing, and (d) the seller's right to cancel. The operator must complete registration and pull current disclosure text with a South Carolina-licensed real-estate attorney before any wholesale activity.",
    buyerDisclosure:
      "South Carolina requires disclosure of wholesaler status and equitable-interest marketing to the end buyer.",
    doubleCloseRecommended: true,
    notes:
      "STRICT / REGISTRATION STATE. South Carolina requires wholesaler registration with LLR (as of 2023 updates). Registration + attorney review non-negotiable.",
    lastReviewedAt: "2025-12-01",
    references: [
      "S.C. Code Ann. § 40-57 (South Carolina Real Estate License Act)",
      "South Carolina 2023 wholesaler-registration updates",
    ],
  },
  SD: {
    state: "SD",
    fullName: "South Dakota",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "South Dakota has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  TN: {
    state: "TN",
    fullName: "Tennessee",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Tennessee requires that a person marketing an assignment of a residential real-estate contract disclose to both seller and buyer that they are marketing an equitable interest in a contract, not the underlying property, and that they are not a licensed real-estate broker. Specific disclosure language is required. The operator must pull the current disclosure form text with a Tennessee-licensed real-estate attorney before every transaction.",
    buyerDisclosure:
      "Tennessee requires equitable-interest disclosure in writing to the end buyer.",
    doubleCloseRecommended: true,
    notes:
      "Tennessee requires explicit equitable-interest disclosure language. Attorney-drafted form only.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Tenn. Code Ann. § 62-13 (Tennessee Real Estate Broker License Act)",
    ],
  },
  TX: {
    state: "TX",
    fullName: "Texas",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Texas requires that a person selling an interest in a contract for the sale of real property disclose to the prospective buyer that they are selling only a contract interest, not the property itself, unless the person holds a Texas real-estate license. (Tex. Occ. Code § 1101.0045.) The operator must include this written disclosure in every disposition marketing and every assignment agreement. Additionally, 'executory contracts' (contract-for-deed, lease-option longer than 180 days) are heavily regulated under Tex. Prop. Code Ch. 5 and may not be used on residential property without complying with extensive consumer-protection requirements.",
    buyerDisclosure:
      "Texas requires explicit written disclosure to the end buyer that the seller is marketing a contract interest, not the property itself, unless the seller is a licensed real-estate broker.",
    doubleCloseRecommended: false,
    notes:
      "Texas has a specific statutory disclosure for contract-interest marketing. Assignment is still viable with the correct written disclosure. Lease-options / contract-for-deed on residential are heavily regulated — avoid or use attorney-drafted forms.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Tex. Occ. Code § 1101.0045 (wholesale / contract-interest disclosure)",
      "Tex. Prop. Code Chapter 5 (executory contracts on residential real property)",
    ],
  },
  UT: {
    state: "UT",
    fullName: "Utah",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Utah has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  VT: {
    state: "VT",
    fullName: "Vermont",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Vermont has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  VA: {
    state: "VA",
    fullName: "Virginia",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Virginia expanded its wholesaler-disclosure requirements in 2025. Residential real-estate wholesalers must provide written disclosure to the seller at the time of contract of wholesaler status, intent to assign, and the seller's right to cancel within a statutory window. The operator must confirm the current disclosure form text with a Virginia-licensed real-estate attorney before every transaction.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Virginia 2025 updates require expanded wholesaler disclosure. Attorney-drafted forms only.",
    lastReviewedAt: "2025-12-01",
    references: [
      "Va. Code § 54.1-2100 et seq. (real-estate licensing)",
      "Virginia 2025 wholesaler-disclosure updates",
    ],
  },
  WA: {
    state: "WA",
    fullName: "Washington",
    tier: "disclosure",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure:
      "Washington's distressed-home-consulting statute (RCW 61.34) and equity-skimming statute impose significant additional obligations on any transaction involving a pre-foreclosure seller. Marketing property without a license may constitute unlicensed brokerage under RCW 18.85. The operator must consult a Washington-licensed real-estate attorney before any distressed-property outreach.",
    buyerDisclosure: null,
    doubleCloseRecommended: true,
    notes:
      "Washington's distressed-home-consulting and equity-skimming statutes are aggressive. Attorney review is essential for pre-foreclosure deals.",
    lastReviewedAt: "2025-12-01",
    references: [
      "RCW 61.34 (Equity Skimming)",
      "RCW 18.85 (Real Estate Brokers and Salespersons)",
    ],
  },
  WV: {
    state: "WV",
    fullName: "West Virginia",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "West Virginia has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  WI: {
    state: "WI",
    fullName: "Wisconsin",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Wisconsin has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
  WY: {
    state: "WY",
    fullName: "Wyoming",
    tier: "permissive",
    equitableInterestDisclosure: DEFAULT_EQUITABLE_INTEREST_DISCLOSURE,
    sellerDisclosure: null,
    buyerDisclosure: null,
    doubleCloseRecommended: false,
    notes: "Wyoming has no wholesaler-specific statute.",
    lastReviewedAt: "2025-12-01",
    references: [],
  },
};

/**
 * Look up a state's disclosure matrix entry. Returns null if the state
 * code isn't recognized. 2-letter USPS codes only; input is uppercased.
 */
export function getStateDisclosure(
  state: string | null | undefined
): StateDisclosure | null {
  if (!state) return null;
  const key = state.trim().toUpperCase();
  return STATE_DISCLOSURES[key] ?? null;
}

/**
 * List every state code in the matrix, sorted alphabetically. Useful for
 * populating state-selector dropdowns in the attorney-on-file UI.
 */
export function allStateCodes(): string[] {
  return Object.keys(STATE_DISCLOSURES).sort();
}

/**
 * Predicate: does this state's tier require an attorney-reviewed
 * disclosure beyond the baseline equitable-interest language?
 */
export function requiresAttorneyReviewedDisclosure(
  state: string | null | undefined
): boolean {
  const entry = getStateDisclosure(state);
  if (!entry) return false;
  return entry.tier !== "permissive";
}

/**
 * Predicate: does this state's tier require a licensed real-estate attorney
 * on file for the property's state before the desk can upgrade dealMode
 * to "contract"? Currently all states require this — attorney review is a
 * load-bearing safety rail across the template, regardless of tier — but
 * this predicate is kept separate from `requiresAttorneyReviewedDisclosure`
 * so that future tier-specific policy changes have a clear hook.
 */
export function requiresAttorneyOnFile(
  state: string | null | undefined
): boolean {
  return getStateDisclosure(state) !== null;
}

/**
 * Render the full disclosure block the Disposition Agent should include
 * in a disposition marketing output for this state. Combines the baseline
 * equitable-interest disclosure with the state-specific seller and buyer
 * disclosures where required. Returns a single string with paragraph
 * breaks.
 */
export function renderDispositionDisclosure(
  state: string | null | undefined
): string | null {
  const entry = getStateDisclosure(state);
  if (!entry) return null;
  const parts: string[] = [entry.equitableInterestDisclosure];
  if (entry.sellerDisclosure) {
    parts.push(entry.sellerDisclosure);
  }
  if (entry.buyerDisclosure) {
    parts.push(entry.buyerDisclosure);
  }
  if (entry.tier !== "permissive") {
    parts.push(
      STRICT_STATE_BANNER(
        entry.fullName,
        entry.references[0] ?? "state-specific statute — verify citation"
      )
    );
  }
  return parts.join("\n\n");
}
