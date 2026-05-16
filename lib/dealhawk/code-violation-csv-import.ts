/**
 * Dealhawk Code Violation — CSV import helpers.
 *
 * Mirrors lib/dealhawk/foreclosure-csv-import.ts. Operator uploads a
 * CSV exported from a city portal, FOIA response, PropStream, or
 * paralegal pull; this library parses + maps columns to the
 * CodeViolationRecord shape.
 *
 * Required columns: propertyAddress, city, state, violationDescription,
 * filingDate. Everything else optional + alias-driven.
 */

import { parseCsv } from "@/lib/dealhawk/csv-import";
import {
  classifySeverity,
  type SeverityTier
} from "@/lib/dealhawk/code-violation-severity";

// ── Column alias tables ────────────────────────────────────────────────

const ADDRESS_ALIASES = [
  "propertyaddress",
  "property_address",
  "address",
  "streetaddress",
  "street_address",
  "site_address"
];
const CITY_ALIASES = ["city", "propertycity", "property_city"];
const STATE_ALIASES = ["state", "propertystate", "property_state", "st"];
const COUNTY_ALIASES = ["county", "propertycounty"];
const APN_ALIASES = ["apn", "parcel", "parcel_id", "parcel_number", "parcelno"];

const VIOLATION_CODE_ALIASES = [
  "violationcode",
  "violation_code",
  "code",
  "violation_type_code"
];
const DESCRIPTION_ALIASES = [
  "violationdescription",
  "violation_description",
  "description",
  "violation",
  "violation_type",
  "novdescription",
  "complaint_description"
];
const STATUS_ALIASES = [
  "status",
  "casestatus",
  "case_status",
  "violation_status",
  "currentstatus",
  "current_status"
];
const FILING_DATE_ALIASES = [
  "filingdate",
  "filing_date",
  "issued_date",
  "open_date",
  "casecreateddate",
  "case_created_date",
  "novissueddate",
  "issue_date"
];
const LAST_ACTION_DATE_ALIASES = [
  "lastactiondate",
  "last_action_date",
  "lastinspectiondate",
  "violation_last_modified_date"
];
const HEARING_DATE_ALIASES = ["hearingdate", "hearing_date"];
const CASE_NUMBER_ALIASES = [
  "casenumber",
  "case_number",
  "complaint_number",
  "violationid",
  "ticket_id",
  "id"
];

const OWNER_NAME_ALIASES = [
  "ownername",
  "owner_name",
  "owner",
  "violator",
  "full_name",
  "ownerfullname"
];
const OWNER_ADDR_ALIASES = [
  "ownermailingaddress",
  "owner_mailing_address",
  "mailingaddress",
  "mailing_address",
  "owner_address"
];

const FINE_AMOUNT_ALIASES = [
  "fineamount",
  "fine_amount",
  "judgmentamt",
  "judgment_amount",
  "amount_due"
];

const SOURCE_URL_ALIASES = ["sourceurl", "source_url", "url", "source"];

// Maps free-form severity strings (when present) to tier numbers.
const SEVERITY_TIER_VOCAB: Array<{ match: RegExp; tier: SeverityTier }> = [
  { match: /tier\s*1\b|extreme|unsafe|condemn|demolition/i, tier: 1 },
  { match: /tier\s*2\b|strong|vacant|structural|repeat/i, tier: 2 },
  { match: /tier\s*3\b|moderate|maintenance|overgrown|debris/i, tier: 3 },
  { match: /tier\s*4\b|low|minor|resolved/i, tier: 4 }
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

function normalizeStatus(raw: string | undefined): string {
  if (!raw) return "open";
  const upper = raw.trim().toUpperCase();
  if (upper.includes("CLOSED") || upper === "C") return "closed";
  if (upper.includes("OPEN") || upper === "O") return "open";
  if (upper.includes("COMPLIANCE")) return "in_compliance";
  if (upper.includes("HEARING")) return "scheduled_hearing";
  if (upper.includes("CONDEMN")) return "condemned";
  if (upper.includes("DEMOLITION")) return "demolition_ordered";
  if (upper.includes("VACATED")) return "vacated";
  return raw.trim().toLowerCase();
}

function inferSeverity(
  row: Record<string, string>,
  description: string,
  filingDate: Date,
  city: string,
  state: string
): SeverityTier {
  // Operator-provided severity tier wins (when the CSV has one).
  for (const k of Object.keys(row)) {
    const lower = k.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (lower === "severity" || lower === "tier" || lower === "severitytier") {
      const val = row[k]?.trim();
      if (val) {
        for (const entry of SEVERITY_TIER_VOCAB) {
          if (entry.match.test(val)) return entry.tier;
        }
        const n = parseInt(val, 10);
        if (n >= 1 && n <= 4) return n as SeverityTier;
      }
    }
  }
  // Fall back to the dictionary + keyword classifier.
  const code = pickAlias(row, VIOLATION_CODE_ALIASES);
  const result = classifySeverity({
    violationCode: code,
    violationDescription: description,
    filingDate,
    city,
    state
  });
  return result.tier as SeverityTier;
}

// ── Public API ──────────────────────────────────────────────────────────

export type CodeViolationImportRow = {
  propertyAddress: string;
  city: string;
  state: string;
  county?: string;
  apn?: string;
  violationCode?: string;
  violationDescription: string;
  severityTier: SeverityTier;
  status: string;
  filingDate: Date;
  lastActionDate?: Date;
  hearingDate?: Date;
  caseNumber?: string;
  ownerName?: string;
  ownerMailingAddress?: string;
  fineAmount?: number;
  sourceType: string;
  sourceUrl?: string;
};

export type CodeViolationImportError = {
  rowNumber: number;
  message: string;
};

export type CodeViolationMapResult = {
  rows: CodeViolationImportRow[];
  errors: CodeViolationImportError[];
};

export function mapCodeViolationDataset(
  dataset: Record<string, string>[],
  sourceTypeLabel: string = "csv_import"
): CodeViolationMapResult {
  const rows: CodeViolationImportRow[] = [];
  const errors: CodeViolationImportError[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const raw = dataset[i];
    const rowNumber = i + 2; // +1 header, +1 1-indexing

    const propertyAddress = pickAlias(raw, ADDRESS_ALIASES);
    const city = pickAlias(raw, CITY_ALIASES);
    const state = pickAlias(raw, STATE_ALIASES);
    const description = pickAlias(raw, DESCRIPTION_ALIASES);
    const filingDateStr = pickAlias(raw, FILING_DATE_ALIASES);

    if (!propertyAddress) {
      errors.push({ rowNumber, message: "missing propertyAddress / address column" });
      continue;
    }
    if (!city) {
      errors.push({ rowNumber, message: "missing city column" });
      continue;
    }
    if (!state || state.length !== 2) {
      errors.push({
        rowNumber,
        message: `missing or invalid state (need 2-letter USPS code; got "${state ?? ""}")`
      });
      continue;
    }
    if (!description) {
      errors.push({
        rowNumber,
        message: "missing violationDescription / description column"
      });
      continue;
    }
    if (!filingDateStr) {
      errors.push({
        rowNumber,
        message: "missing filingDate / issued_date column"
      });
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

    const severityTier = inferSeverity(raw, description, filingDate, city, state);

    rows.push({
      propertyAddress,
      city,
      state: state.toUpperCase(),
      county: pickAlias(raw, COUNTY_ALIASES),
      apn: pickAlias(raw, APN_ALIASES),
      violationCode: pickAlias(raw, VIOLATION_CODE_ALIASES),
      violationDescription: description,
      severityTier,
      status: normalizeStatus(pickAlias(raw, STATUS_ALIASES)),
      filingDate,
      lastActionDate: parseDateLoose(pickAlias(raw, LAST_ACTION_DATE_ALIASES)),
      hearingDate: parseDateLoose(pickAlias(raw, HEARING_DATE_ALIASES)),
      caseNumber: pickAlias(raw, CASE_NUMBER_ALIASES),
      ownerName: pickAlias(raw, OWNER_NAME_ALIASES),
      ownerMailingAddress: pickAlias(raw, OWNER_ADDR_ALIASES),
      fineAmount: parseMoneyLoose(pickAlias(raw, FINE_AMOUNT_ALIASES)),
      sourceType: sourceTypeLabel,
      sourceUrl: pickAlias(raw, SOURCE_URL_ALIASES)
    });
  }

  return { rows, errors };
}

export { parseCsv };
