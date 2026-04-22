import {
  getStateDisclosure,
  renderDispositionDisclosure,
} from "@/lib/dealhawk/state-disclosures";

/**
 * Dealhawk Empire — disposition library.
 *
 * Generates the buyer-facing deal package the Disposition Agent (Agent
 * 13) blasts to the matched buyer A-list when a contract is locked up.
 *
 * Hard compliance rules baked in:
 *   - The package markets the operator's EQUITABLE INTEREST in the
 *     contract — never the underlying property. Fail-closed: if the
 *     package can't include this language, generation aborts.
 *   - State-specific wholesaler disclosure auto-inserted from
 *     lib/dealhawk/state-disclosures.ts. In strict-disclosure states
 *     (IL / OK / SC / etc.) the package adds a prominent banner
 *     advising double-close instead of assignment.
 *   - In strict states, the property address is fuzzed to "general area"
 *     in the marketing block per the equitable-interest principle.
 */

export type DealPackageInput = {
  // Property
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  livingSqft?: number | null;
  yearBuilt?: number | null;
  // Underwriting
  arvLow?: number | null;
  arvMid?: number | null;
  arvHigh?: number | null;
  rehabLight?: number | null;
  rehabMedium?: number | null;
  rehabHeavy?: number | null;
  rentEstimate?: number | null;
  maoWholesale?: number | null;
  maoBrrrr?: number | null;
  maoFlip?: number | null;
  // Contract terms (assumed signed)
  purchasePrice: number;
  assignmentFee: number;
  closingDate?: string | null;
  earnestMoneyDeposit?: number | null;
  // Operator
  operatorName: string;
  operatorContact: string;
  // Photos (optional — operator-provided URLs / file paths)
  photoUrls?: string[];
};

export type DealPackageResult = {
  /** Markdown body suitable for email or paste-into-FB-group. */
  markdown: string;
  /** Whether the property address was fuzzed to general-area-only per
   *  state requirements. */
  addressFuzzed: boolean;
  /** Compliance items added (state disclosure, equitable-interest
   *  language, double-close recommendation). */
  complianceNotes: string[];
};

const EQUITABLE_INTEREST_HEADER =
  "I have an equitable interest in a contract to purchase the property described below. I am marketing my contract rights, not the property itself. I am not a licensed real-estate broker.";

const STRICT_STATE_BANNER =
  "IMPORTANT: This deal is in a strict-disclosure state. End buyers in strict states should review the assignment vs. double-close option with their own counsel before placing earnest money.";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function k(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Build the deal-package markdown. Caller is responsible for invoking
 * decideContractAction first (the agent should already be in dealMode
 * "contract" before calling this — the gate is enforced upstream).
 */
export function buildDealPackage(
  input: DealPackageInput
): DealPackageResult {
  const stateDisclosure = getStateDisclosure(input.propertyState);
  const complianceNotes: string[] = [];

  // In strict-disclosure / registration / license / strict tiers, fuzz
  // the address to "general area" — full street address goes to the
  // signed-and-deposited end buyer only.
  const tier = stateDisclosure?.tier ?? "permissive";
  const addressFuzzed = tier !== "permissive";
  const displayAddress = addressFuzzed
    ? `${input.propertyCity}, ${input.propertyState} ${input.propertyZip} (full address released to signed end buyer)`
    : `${input.propertyAddress}, ${input.propertyCity}, ${input.propertyState} ${input.propertyZip}`;
  if (addressFuzzed) {
    complianceNotes.push(
      `Property address fuzzed to general-area-only in marketing copy — ${input.propertyState} is a "${tier}"-tier wholesaling state per lib/dealhawk/state-disclosures.ts.`
    );
  }

  // State disclosure block (assembled by state-disclosures library).
  const stateDisclosureBlock = renderDispositionDisclosure(
    input.propertyState
  );
  if (stateDisclosureBlock) {
    complianceNotes.push(
      `Inserted ${stateDisclosure?.fullName ?? input.propertyState} state-specific disclosure block.`
    );
  }

  // Strict-state banner.
  const isStrict = tier === "strict" || tier === "registration";
  if (isStrict && stateDisclosure?.doubleCloseRecommended) {
    complianceNotes.push(
      "Added strict-state double-close recommendation banner to top of package."
    );
  }

  // Property details block.
  const propertyDetails = [
    input.bedrooms !== undefined && input.bedrooms !== null
      ? `${input.bedrooms} bd`
      : null,
    input.bathrooms !== undefined && input.bathrooms !== null
      ? `${input.bathrooms} ba`
      : null,
    input.livingSqft
      ? `${input.livingSqft.toLocaleString()} sqft`
      : null,
    input.yearBuilt ? `built ${input.yearBuilt}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const photosBlock =
    input.photoUrls && input.photoUrls.length > 0
      ? `\n\n## Photos\n${input.photoUrls.map((u) => `- ${u}`).join("\n")}`
      : "";

  const numbersBlock = `## Numbers
| Metric | Value |
|---|---|
| ARV (low / mid / high) | ${k(input.arvLow)} / ${k(input.arvMid)} / ${k(input.arvHigh)} |
| Rehab (light / medium / heavy) | ${k(input.rehabLight)} / ${k(input.rehabMedium)} / ${k(input.rehabHeavy)} |
| Market rent estimate | ${fmt(input.rentEstimate)}/mo |
| Wholesale MAO | ${fmt(input.maoWholesale)} |
| BRRRR MAO | ${fmt(input.maoBrrrr)} |
| Fix-and-flip MAO | ${fmt(input.maoFlip)} |
| Purchase price (per signed contract) | ${fmt(input.purchasePrice)} |
| Assignment fee | ${fmt(input.assignmentFee)} |
| Earnest money required | ${fmt(input.earnestMoneyDeposit ?? 1000)} (non-refundable on assignment) |
| Closing date | ${input.closingDate ?? "TBD — within 21 days of assignment"} |`;

  const markdown = `${
    isStrict ? `> **${STRICT_STATE_BANNER}**\n\n` : ""
  }# Deal — ${displayAddress}

${EQUITABLE_INTEREST_HEADER}

**Property:** ${displayAddress}${
    propertyDetails ? `  \n**Details:** ${propertyDetails}` : ""
  }

${numbersBlock}${photosBlock}

## Contract terms

The operator has signed a purchase contract with the seller for the price shown above. End buyers acquire the right to close on the underlying contract via assignment (or double close in strict states). Standard terms:

- 14-day inspection period for the end buyer
- Earnest money: ${fmt(input.earnestMoneyDeposit ?? 1000)}, escrowed with title, non-refundable upon signing the assignment
- Title and closing handled through ${input.operatorName}'s standard closing partner unless the end buyer specifies otherwise
- Assignment fee is paid at closing as a separate disbursement on the HUD

## State disclosure

${stateDisclosureBlock ?? "(No state-specific disclosure required for this state.)"}

## Operator

**${input.operatorName}** — ${input.operatorContact}

This package is offered to a private buyer list. Please respect the deadline below. Reply to express interest; the operator will confirm allocation in order received.

---

*Not legal advice. End buyers should review the assignment / double-close path with their own real-estate attorney. The operator is acting as a principal in a contract, not as a licensed real-estate broker.*
`;

  return { markdown, addressFuzzed, complianceNotes };
}
