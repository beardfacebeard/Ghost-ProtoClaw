import type { Prisma } from "@prisma/client";

import {
  BASE_WEIGHTS,
  computeMotivationScore,
  recommendExit,
  type DistressSignalType,
  type ScoreInputSignal,
} from "@/lib/dealhawk/distress-score";

/**
 * Dealhawk Empire — CSV / JSON lead-import helpers.
 *
 * Operators with an existing PropStream / BatchData / REsimpli export can
 * paste a CSV or upload a .csv file into the Pipeline tab's Import Leads
 * modal; this library parses the file, maps the columns to the Deal +
 * DealSignal shape, scores each row via lib/dealhawk/distress-score.ts,
 * and creates the rows in a single transaction.
 *
 * Column aliasing: every field accepts multiple common header variants
 * (propertyAddress | address | property_address | street_address, etc.)
 * so operator exports from different platforms work without pre-cleaning.
 *
 * Signal flags: recognized column names map to distress signals. The value
 * can be anything that parses as truthy — "true" / "yes" / "1" / "Y" — and
 * maps to a DealSignal row with sourceType = "manual".
 */

const ADDRESS_ALIASES = [
  "propertyaddress",
  "address",
  "property_address",
  "streetaddress",
  "street_address",
  "site_address",
];
const CITY_ALIASES = ["propertycity", "city", "property_city"];
const STATE_ALIASES = ["propertystate", "state", "property_state", "st"];
const ZIP_ALIASES = [
  "propertyzip",
  "zip",
  "zipcode",
  "property_zip",
  "property_zipcode",
  "postal_code",
  "postalcode",
];
const TYPE_ALIASES = [
  "propertytype",
  "property_type",
  "type",
  "usecode",
  "use_code",
];
const BEDS_ALIASES = ["bedrooms", "beds", "bed"];
const BATHS_ALIASES = ["bathrooms", "baths", "bath"];
const SQFT_ALIASES = [
  "livingsqft",
  "living_sqft",
  "sqft",
  "square_feet",
  "building_sqft",
  "sqft_living",
];
const LOT_SQFT_ALIASES = ["lotsqft", "lot_sqft", "lot_size", "lotsize"];
const YEAR_ALIASES = ["yearbuilt", "year_built", "year"];

const OWNER_NAME_ALIASES = [
  "ownername",
  "owner_name",
  "owner",
  "full_name",
  "ownerfullname",
];
const OWNER_ADDR_ALIASES = [
  "ownermailingaddress",
  "owner_mailing_address",
  "mailingaddress",
  "mailing_address",
  "owner_address",
];
const OWNER_PHONE_ALIASES = [
  "ownerphone",
  "owner_phone",
  "phone",
  "phone_1",
  "phone1",
];
const OWNER_EMAIL_ALIASES = ["owneremail", "owner_email", "email"];
const OWNER_ENTITY_ALIASES = [
  "ownerentitytype",
  "owner_entity_type",
  "entity",
  "owner_type",
];

const ARV_LOW_ALIASES = ["arvlow", "arv_low"];
const ARV_MID_ALIASES = ["arvmid", "arv_mid", "arv", "after_repair_value"];
const ARV_HIGH_ALIASES = ["arvhigh", "arv_high"];
const RENT_ALIASES = [
  "rentestimate",
  "rent_estimate",
  "rent",
  "estimated_rent",
  "market_rent",
];

const EQUITY_ALIASES = [
  "equitypercent",
  "equity_percent",
  "equity_pct",
  "equity",
];
const TENURE_ALIASES = [
  "tenureyears",
  "tenure_years",
  "years_owned",
  "ownership_years",
];

/**
 * Column-name → distress signal type. Any truthy value in the column
 * attaches a DealSignal row for that signal.
 */
const SIGNAL_FLAG_COLUMNS: Record<string, DistressSignalType> = {
  preforeclosure: "pre_foreclosure",
  pre_foreclosure: "pre_foreclosure",
  nod: "pre_foreclosure",
  foreclosure: "pre_foreclosure",
  taxdelinquent: "tax_delinquent",
  tax_delinquent: "tax_delinquent",
  taxlien: "tax_delinquent",
  tax_lien: "tax_delinquent",
  probate: "probate",
  divorce: "divorce",
  codeviolation: "code_violation",
  code_violation: "code_violation",
  codeviolations: "code_violation",
  vacancy: "vacancy",
  vacant: "vacancy",
  absentee: "absentee",
  eviction: "eviction",
  expiredlisting: "expired_listing",
  expired_listing: "expired_listing",
  expired: "expired_listing",
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function pick(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const normalized = alias.toLowerCase();
    if (row[normalized] !== undefined && row[normalized].trim() !== "") {
      return row[normalized].trim();
    }
  }
  return undefined;
}

function parseFloatOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const stripped = value.replace(/[$,\s]/g, "");
  const n = Number.parseFloat(stripped);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(value: string | undefined): number | null {
  const n = parseFloatOrNull(value);
  return n === null ? null : Math.round(n);
}

function parseTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return (
    v === "true" ||
    v === "yes" ||
    v === "1" ||
    v === "y" ||
    v === "t" ||
    v === "x"
  );
}

/**
 * Parse a CSV string into row objects. Basic RFC-4180-ish — handles
 * double-quoted fields with embedded commas and escaped quotes ("").
 * Does NOT handle multi-line fields inside quotes (those are rare in RE
 * exports). First non-empty line is the header row.
 */
export function parseCsv(input: string): Record<string, string>[] {
  const lines = input.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeKey);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export type ImportedRow = {
  /** 1-indexed row number in the original file, for error reporting. */
  rowNumber: number;
  /** Shaped Deal fields ready for tx.deal.create. */
  deal: Omit<
    Prisma.DealCreateInput,
    "organization" | "business" | "signals"
  >;
  /** DealSignal inputs to create and attach to the deal. */
  signals: Array<{
    signalType: DistressSignalType;
    weight: number;
    confidence: "high" | "medium" | "low";
    sourceRef: string | null;
    notes: string | null;
  }>;
};

export type RowError = {
  rowNumber: number;
  message: string;
};

/**
 * Map one parsed row (header → value) to a shaped Deal + signals. Returns
 * a RowError with the 1-indexed row number if required fields are missing
 * or malformed.
 */
export function mapRowToDeal(
  row: Record<string, string>,
  rowNumber: number,
  defaultSource: string = "manual_import"
): ImportedRow | RowError {
  const address = pick(row, ADDRESS_ALIASES);
  const city = pick(row, CITY_ALIASES);
  const stateRaw = pick(row, STATE_ALIASES);
  const zip = pick(row, ZIP_ALIASES);

  if (!address) {
    return { rowNumber, message: "Missing property address column." };
  }
  if (!city) {
    return { rowNumber, message: "Missing property city column." };
  }
  if (!stateRaw) {
    return { rowNumber, message: "Missing property state column." };
  }
  const state = stateRaw.toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) {
    return {
      rowNumber,
      message: `State "${stateRaw}" is not a 2-letter USPS code.`,
    };
  }
  if (!zip) {
    return { rowNumber, message: "Missing property zip column." };
  }

  const equityPercent = parseFloatOrNull(pick(row, EQUITY_ALIASES));
  const tenureYears = parseFloatOrNull(pick(row, TENURE_ALIASES));

  const signals: ScoreInputSignal[] = [];
  const signalRows: ImportedRow["signals"] = [];

  for (const [rawKey, signalType] of Object.entries(SIGNAL_FLAG_COLUMNS)) {
    const value = row[rawKey];
    if (parseTruthy(value)) {
      signals.push({ signalType });
      signalRows.push({
        signalType,
        weight: BASE_WEIGHTS[signalType],
        confidence: "medium",
        sourceRef: null,
        notes: `Imported via CSV/JSON ingestion.`,
      });
    }
  }

  // Multiplier signals are tracked as DealSignal rows too (weight = 0 per
  // BASE_WEIGHTS), so the operator can see WHY the motivation score was
  // elevated when they view the detail drawer.
  if (equityPercent !== null && equityPercent >= 40) {
    signalRows.push({
      signalType: "high_equity",
      weight: 0,
      confidence: "medium",
      sourceRef: null,
      notes: `Multiplier — ${Math.round(equityPercent)}% equity × 1.5.`,
    });
  }
  if (tenureYears !== null && tenureYears >= 7) {
    signalRows.push({
      signalType: "long_tenure",
      weight: 0,
      confidence: "medium",
      sourceRef: null,
      notes: `Multiplier — ${Math.round(tenureYears)}-year tenure × 1.3.`,
    });
  }

  const { score: motivationScore } = computeMotivationScore({
    signals,
    equityPercent: equityPercent ?? undefined,
    tenureYears: tenureYears ?? undefined,
  });

  const arvLow = parseFloatOrNull(pick(row, ARV_LOW_ALIASES));
  const arvMid = parseFloatOrNull(pick(row, ARV_MID_ALIASES));
  const arvHigh = parseFloatOrNull(pick(row, ARV_HIGH_ALIASES));
  const rentEstimate = parseFloatOrNull(pick(row, RENT_ALIASES));

  // Compute a coarse wholesale MAO if ARV is known: 0.70 * ARV (the import
  // endpoint uses this for recommended-exit heuristics; the Comp Analyst
  // agent overrides with a proper four-MAO analysis later).
  const maoWholesale = arvMid !== null ? Math.round(arvMid * 0.7) : null;

  const recommendedExit = recommendExit({
    motivationScore,
    maoWholesale,
    maoBrrrr: null,
    maoFlip: arvMid !== null ? Math.round(arvMid * 0.75) : null,
    arvMid,
    rentEstimate,
  });

  const deal: ImportedRow["deal"] = {
    status: "lead",
    propertyAddress: address,
    propertyCity: city,
    propertyState: state,
    propertyZip: zip,
    propertyType: pick(row, TYPE_ALIASES) ?? "sfr",
    bedrooms: parseIntOrNull(pick(row, BEDS_ALIASES)),
    bathrooms: parseFloatOrNull(pick(row, BATHS_ALIASES)),
    livingSqft: parseIntOrNull(pick(row, SQFT_ALIASES)),
    lotSqft: parseIntOrNull(pick(row, LOT_SQFT_ALIASES)),
    yearBuilt: parseIntOrNull(pick(row, YEAR_ALIASES)),
    ownerName: pick(row, OWNER_NAME_ALIASES) ?? null,
    ownerMailingAddress: pick(row, OWNER_ADDR_ALIASES) ?? null,
    ownerPhone: pick(row, OWNER_PHONE_ALIASES) ?? null,
    ownerEmail: pick(row, OWNER_EMAIL_ALIASES) ?? null,
    ownerEntityType: pick(row, OWNER_ENTITY_ALIASES) ?? null,
    arvLow,
    arvMid,
    arvHigh,
    rentEstimate,
    maoWholesale,
    motivationScore,
    recommendedExit,
    source: defaultSource,
    notes: `Imported ${new Date().toISOString().slice(0, 10)}. Row ${rowNumber}.`,
    config: {
      importedAt: new Date().toISOString(),
      rowNumber,
    } as Prisma.InputJsonValue,
  };

  return { rowNumber, deal, signals: signalRows };
}

/**
 * Transform a parsed dataset (CSV rows or JSON array of objects) into
 * normalized ImportedRow / RowError results. Caller persists in a
 * transaction.
 */
export function mapDataset(
  dataset: Record<string, string>[],
  defaultSource?: string
): { rows: ImportedRow[]; errors: RowError[] } {
  const rows: ImportedRow[] = [];
  const errors: RowError[] = [];
  dataset.forEach((row, idx) => {
    const result = mapRowToDeal(row, idx + 1, defaultSource);
    if ("deal" in result) {
      rows.push(result);
    } else {
      errors.push(result);
    }
  });
  return { rows, errors };
}
