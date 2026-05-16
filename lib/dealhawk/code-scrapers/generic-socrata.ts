/**
 * Generic Socrata SoQL adapter for code-violation datasets.
 *
 * Per the plan's 3-tier national-coverage strategy: this single adapter
 * covers any Socrata-hosted code-enforcement dataset (~25-40 US cities)
 * by accepting a dataset URL + field-map config. The auto-discovery
 * flow in the County / City Source Research Agent populates the
 * config when an operator adds a new city.
 *
 * Socrata API contract:
 *   GET https://{host}/resource/{dataset-id}.json?$where=...&$limit=...
 *   SoQL where clauses for filtering by date.
 *   Optional X-App-Token header raises rate limits.
 *
 * NOTE: this is NOT a CodeScraper instance directly — it's a factory.
 * `buildSocrataScraper(config)` returns a CodeScraper that the registry
 * can register. Each city gets its own scraper instance with its own
 * field map.
 */

import {
  classifySeverity,
  type SeverityTier
} from "@/lib/dealhawk/code-violation-severity";
import type {
  CodeScraper,
  CodeScraperContext,
  CodeScraperResult,
  ScrapedCodeViolationRecord
} from "./types";

export type SocrataFieldMap = {
  /** Source field name → our normalized field. Unset = field absent. */
  address: string;
  /** Optional — many feeds don't have it; recover via geocoder downstream. */
  apn?: string;
  /** Required — the violation description text. */
  description: string;
  /** Optional — when present, drives the severity classifier. */
  violationCode?: string;
  /** Required — case status field. */
  status: string;
  /** When the case was filed — the SoQL `$where` filter applies here. */
  filingDate: string;
  /** Optional — last action date. */
  lastActionDate?: string;
  /** Optional — case number. */
  caseNumber?: string;
  /** Optional — owner name (rare in feed; usually missing). */
  ownerName?: string;
  /** Optional — fine amount. */
  fineAmount?: string;
};

export type SocrataScraperConfig = {
  /** Stable id like "chicago-building-violations". */
  id: string;
  /** Human-readable label. */
  label: string;
  /** City name (no state suffix). */
  city: string;
  /** State 2-letter USPS code. */
  state: string;
  /** Socrata API URL — `https://data.cityofchicago.org/resource/22u3-xenr.json`. */
  endpointUrl: string;
  /** Field-map from source field names to our shape. */
  fieldMap: SocrataFieldMap;
  /** Operator's filter for "open" cases — e.g. `status_field != 'CLOSED'`.
   *  Provided as a SoQL `$where` fragment. */
  openCasesWhere?: string;
  /** Per-record status normalizer. Maps source-specific status values
   *  to our enum ("open" | "closed" | "in_compliance" | ...). */
  normalizeStatus?: (raw: string) => string;
  /** Optional — extracts the violation-code prefix for the severity
   *  dictionary when the field has structured codes like "CN130070". */
  extractCode?: (row: Record<string, unknown>) => string | undefined;
};

const DEFAULT_NORMALIZE_STATUS = (raw: string): string => {
  const upper = raw.trim().toUpperCase();
  if (upper.includes("CLOSED") || upper === "C") return "closed";
  if (upper.includes("OPEN") || upper === "O") return "open";
  if (upper.includes("COMPLIANCE")) return "in_compliance";
  if (upper.includes("HEARING")) return "scheduled_hearing";
  if (upper.includes("CONDEMN")) return "condemned";
  if (upper.includes("DEMOLITION")) return "demolition_ordered";
  if (upper.includes("VACATED")) return "vacated";
  return raw.trim().toLowerCase();
};

async function fetchSocrataPage(
  endpointUrl: string,
  whereClause: string,
  limit: number,
  appToken: string | undefined
): Promise<{ ok: boolean; status: number; rows: Record<string, unknown>[]; error?: string }> {
  const params = new URLSearchParams();
  params.set("$where", whereClause);
  params.set("$limit", String(limit));
  params.set("$order", "issued_date DESC");
  // Socrata accepts $order on any field; default to the configured
  // filing-date field via the where clause's implicit context. The
  // simple "$order=:created_at" fallback usually works too.
  const headers: Record<string, string> = { Accept: "application/json" };
  if (appToken) headers["X-App-Token"] = appToken;
  try {
    const res = await fetch(`${endpointUrl}?${params.toString()}`, {
      method: "GET",
      headers
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, rows: [], error: text.slice(0, 200) };
    }
    const body = (await res.json().catch(() => [])) as Record<string, unknown>[];
    if (!Array.isArray(body)) {
      return { ok: false, status: res.status, rows: [], error: "Unexpected response shape" };
    }
    return { ok: true, status: res.status, rows: body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      rows: [],
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function parseFieldDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function parseFieldNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[$,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Build a CodeScraper instance for a Socrata-hosted code-violation
 * dataset. The returned scraper is registered in
 * lib/dealhawk/code-scrapers/registry.ts.
 */
export function buildSocrataScraper(config: SocrataScraperConfig): CodeScraper {
  const normalizeStatus = config.normalizeStatus ?? DEFAULT_NORMALIZE_STATUS;
  return {
    id: config.id,
    label: config.label,
    kind: "city_socrata",
    states: [config.state],
    cities: [config.city],
    requiresCredentials: [],
    async run(ctx: CodeScraperContext): Promise<CodeScraperResult> {
      // Build the SoQL $where clause: filter by filing date >= since
      // AND the operator's open-cases filter.
      const sinceClause = `${config.fieldMap.filingDate} >= '${ctx.sinceFilingDate}'`;
      const openClause = config.openCasesWhere
        ? ` AND (${config.openCasesWhere})`
        : "";
      const whereClause = sinceClause + openClause;

      const appToken = ctx.credentials.socrata?.app_token;
      const result = await fetchSocrataPage(
        config.endpointUrl,
        whereClause,
        ctx.maxRecords,
        appToken
      );

      if (!result.ok) {
        return {
          ok: false,
          error: `Socrata ${result.status} on ${config.endpointUrl}: ${result.error ?? "unknown"}`,
          retryable: result.status >= 500 || result.status === 429 || result.status === 0
        };
      }

      const fm = config.fieldMap;
      const warnings: string[] = [];
      const records: ScrapedCodeViolationRecord[] = [];
      for (const row of result.rows) {
        const address = row[fm.address] as string | undefined;
        const description = row[fm.description] as string | undefined;
        const filingDate = parseFieldDate(row[fm.filingDate]);
        if (!address || !description || !filingDate) continue;

        const status = normalizeStatus(String(row[fm.status] ?? ""));
        const code = config.extractCode
          ? config.extractCode(row)
          : fm.violationCode
            ? (row[fm.violationCode] as string | undefined)
            : undefined;

        const severity = classifySeverity({
          violationCode: code,
          violationDescription: description,
          filingDate,
          city: config.city,
          state: config.state
        });

        records.push({
          propertyAddress: address.trim(),
          city: config.city,
          state: config.state,
          apn: fm.apn ? (row[fm.apn] as string | undefined) : undefined,
          violationCode: code,
          violationDescription: description.trim(),
          severityTier: severity.tier as SeverityTier,
          status,
          filingDate,
          lastActionDate: fm.lastActionDate
            ? parseFieldDate(row[fm.lastActionDate]) ?? undefined
            : undefined,
          caseNumber: fm.caseNumber ? (row[fm.caseNumber] as string | undefined) : undefined,
          ownerName: fm.ownerName ? (row[fm.ownerName] as string | undefined) : undefined,
          fineAmount: fm.fineAmount ? parseFieldNumber(row[fm.fineAmount]) : undefined,
          sourceUrl: config.endpointUrl,
          parserConfidence: 0.85,
          parserRawJson: row
        });
      }

      if (records.length === 0 && result.rows.length > 0) {
        warnings.push(
          `Socrata returned ${result.rows.length} rows but parser filtered out all — field map may be stale (city: ${config.city}).`
        );
      }

      return { ok: true, records, warnings };
    }
  };
}
