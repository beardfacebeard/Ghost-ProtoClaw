/**
 * Dealhawk Empire — Pre-Foreclosure CSV import helpers.
 *
 * Operators with existing PropStream / county-export / paralegal CSV
 * dumps can upload a file at /admin/businesses/[id]/foreclosures/import.
 * This library parses the file, maps the columns to the
 * ForeclosureRecord shape, and returns the rows + parse errors. The API
 * route writes them in a single transaction.
 *
 * Designed to be tolerant of column-naming variation across data
 * sources. Required columns: propertyAddress, county, state, ownerName,
 * filingDate, foreclosureStage (or documentType). Everything else is
 * optional.
 */

import { parseCsv } from "@/lib/dealhawk/csv-import";

// ── Column alias tables ────────────────────────────────────────────────

const ADDRESS_ALIASES = [
  "propertyaddress",
  "property_address",
  "address",
  "streetaddress",
  "street_address",
  "site_address",
  "property"
];
const COUNTY_ALIASES = ["county", "propertycounty", "property_county"];
const STATE_ALIASES = ["state", "propertystate", "property_state", "st"];
const APN_ALIASES = ["apn", "parcel", "parcel_id", "parcel_number", "parcelno"];

const OWNER_NAME_ALIASES = [
  "ownername",
  "owner_name",
  "owner",
  "borrower",
  "borrowername",
  "borrower_name",
  "trustor",
  "defendant",
  "full_name"
];
const OWNER_ADDR_ALIASES = [
  "ownermailingaddress",
  "owner_mailing_address",
  "mailingaddress",
  "mailing_address",
  "owner_address",
  "ownermailing"
];

const STAGE_ALIASES = ["foreclosurestage", "stage", "phase", "status"];
const DOCTYPE_ALIASES = [
  "documenttype",
  "document_type",
  "doctype",
  "doc_type",
  "type"
];
const FILING_DATE_ALIASES = [
  "filingdate",
  "filing_date",
  "noddate",
  "nod_date",
  "recordingdate",
  "recording_date",
  "lispendensdate",
  "lis_pendens_date"
];
const AUCTION_DATE_ALIASES = [
  "auctiondate",
  "auction_date",
  "saledate",
  "sale_date",
  "trusteesaledate",
  "trustee_sale_date"
];
const CASE_NUMBER_ALIASES = [
  "casenumber",
  "case_number",
  "case_no",
  "caseno",
  "court_case_number",
  "docket"
];

const TRUSTEE_ALIASES = ["trusteename", "trustee_name", "trustee"];
const LENDER_ALIASES = [
  "lendername",
  "lender_name",
  "lender",
  "beneficiary",
  "plaintiff"
];
const ATTORNEY_ALIASES = [
  "plaintiffattorney",
  "plaintiff_attorney",
  "attorney",
  "counsel"
];

const REINSTATEMENT_ALIASES = [
  "reinstatementamount",
  "reinstatement_amount",
  "amountinarrears",
  "amount_in_arrears",
  "arrears"
];
const JUDGMENT_ALIASES = [
  "judgmentamount",
  "judgment_amount",
  "judgment"
];

const SOURCE_URL_ALIASES = ["sourceurl", "source_url", "url", "courthouse_url"];
const SOURCE_DOC_URL_ALIASES = [
  "sourcedocumenturl",
  "source_document_url",
  "documenturl",
  "document_url",
  "pdf_url"
];

// Maps the variety of free-form values operators put in stage/doctype
// columns to our normalized vocab. Case-insensitive substring match.
const STAGE_VOCAB: Array<{ match: RegExp; stage: string; documentType: string }> = [
  { match: /lis\s*pendens|^lp$/i, stage: "lis_pendens", documentType: "LP" },
  {
    match: /notice\s*of\s*default|^nod$/i,
    stage: "notice_of_default",
    documentType: "NOD"
  },
  {
    match: /notice\s*of\s*trustee\s*sale|^nots$|^nts$/i,
    stage: "notice_of_trustee_sale",
    documentType: "NOTS"
  },
  {
    match: /judgment.*foreclosure|^jf$/i,
    stage: "judgment_of_foreclosure",
    documentType: "JF"
  },
  { match: /notice\s*of\s*sale|^ns$/i, stage: "notice_of_sale", documentType: "NS" },
  {
    match: /sheriff.*sale|^ts$/i,
    stage: "sheriffs_sale",
    documentType: "TS"
  },
  {
    match: /auction\s*scheduled|^asn$/i,
    stage: "auction_scheduled",
    documentType: "ASN"
  }
];

// ── Helpers ─────────────────────────────────────────────────────────────

function pickAlias(
  row: Record<string, string>,
  aliases: readonly string[]
): string | undefined {
  for (const a of aliases) {
    for (const k of Object.keys(row)) {
      if (k.toLowerCase().replace(/[^a-z0-9_]/g, "_") === a) {
        const v = row[k]?.trim();
        if (v) return v;
      }
    }
  }
  return undefined;
}

function parseDateLoose(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  // US m/d/yyyy
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const fallback = new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10));
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }
  return undefined;
}

function parseMoneyLoose(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function inferStage(
  stageStr: string | undefined,
  docTypeStr: string | undefined
): { stage: string; documentType: string } | null {
  const candidate = (stageStr || docTypeStr || "").trim();
  if (!candidate) return null;
  for (const entry of STAGE_VOCAB) {
    if (entry.match.test(candidate)) {
      return { stage: entry.stage, documentType: entry.documentType };
    }
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────

export type ForeclosureImportRow = {
  propertyAddress: string;
  county: string;
  state: string;
  apn?: string;
  ownerName: string;
  ownerMailingAddress?: string;
  foreclosureStage: string;
  documentType: string;
  filingDate: Date;
  auctionDate?: Date;
  caseNumber?: string;
  trusteeName?: string;
  lenderName?: string;
  plaintiffAttorney?: string;
  reinstatementAmount?: number;
  judgmentAmount?: number;
  sourceType: string;
  sourceUrl?: string;
  sourceDocumentUrl?: string;
};

export type ForeclosureImportError = {
  rowNumber: number;
  message: string;
};

export type ForeclosureMapResult = {
  rows: ForeclosureImportRow[];
  errors: ForeclosureImportError[];
};

export function mapForeclosureDataset(
  dataset: Record<string, string>[],
  sourceTypeLabel: string = "csv_import"
): ForeclosureMapResult {
  const rows: ForeclosureImportRow[] = [];
  const errors: ForeclosureImportError[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const raw = dataset[i];
    const rowNumber = i + 2; // +1 for header, +1 for 1-indexing

    const propertyAddress = pickAlias(raw, ADDRESS_ALIASES);
    const county = pickAlias(raw, COUNTY_ALIASES);
    const state = pickAlias(raw, STATE_ALIASES);
    const ownerName = pickAlias(raw, OWNER_NAME_ALIASES);
    const filingDateStr = pickAlias(raw, FILING_DATE_ALIASES);
    const stageStr = pickAlias(raw, STAGE_ALIASES);
    const docTypeStr = pickAlias(raw, DOCTYPE_ALIASES);

    if (!propertyAddress) {
      errors.push({ rowNumber, message: "missing propertyAddress / address column" });
      continue;
    }
    if (!county) {
      errors.push({ rowNumber, message: "missing county column" });
      continue;
    }
    if (!state || state.length !== 2) {
      errors.push({
        rowNumber,
        message: `missing or invalid state (need 2-letter USPS code; got "${state ?? ""}")`
      });
      continue;
    }
    if (!ownerName) {
      errors.push({ rowNumber, message: "missing ownerName / borrower column" });
      continue;
    }
    if (!filingDateStr) {
      errors.push({ rowNumber, message: "missing filingDate / NOD date column" });
      continue;
    }
    const filingDate = parseDateLoose(filingDateStr);
    if (!filingDate) {
      errors.push({
        rowNumber,
        message: `unparseable filingDate "${filingDateStr}" (use YYYY-MM-DD or M/D/YYYY)`
      });
      continue;
    }

    const inferred = inferStage(stageStr, docTypeStr);
    if (!inferred) {
      errors.push({
        rowNumber,
        message:
          "could not infer foreclosureStage from stage/documentType column — expected NOD / NOTS / LP / Judgment / Notice of Sale / Sheriff Sale"
      });
      continue;
    }

    rows.push({
      propertyAddress,
      county,
      state: state.toUpperCase(),
      apn: pickAlias(raw, APN_ALIASES),
      ownerName,
      ownerMailingAddress: pickAlias(raw, OWNER_ADDR_ALIASES),
      foreclosureStage: inferred.stage,
      documentType: inferred.documentType,
      filingDate,
      auctionDate: parseDateLoose(pickAlias(raw, AUCTION_DATE_ALIASES)),
      caseNumber: pickAlias(raw, CASE_NUMBER_ALIASES),
      trusteeName: pickAlias(raw, TRUSTEE_ALIASES),
      lenderName: pickAlias(raw, LENDER_ALIASES),
      plaintiffAttorney: pickAlias(raw, ATTORNEY_ALIASES),
      reinstatementAmount: parseMoneyLoose(pickAlias(raw, REINSTATEMENT_ALIASES)),
      judgmentAmount: parseMoneyLoose(pickAlias(raw, JUDGMENT_ALIASES)),
      sourceType: sourceTypeLabel,
      sourceUrl: pickAlias(raw, SOURCE_URL_ALIASES),
      sourceDocumentUrl: pickAlias(raw, SOURCE_DOC_URL_ALIASES)
    });
  }

  return { rows, errors };
}

// Re-export so route handlers don't have to import from csv-import.ts.
export { parseCsv };
