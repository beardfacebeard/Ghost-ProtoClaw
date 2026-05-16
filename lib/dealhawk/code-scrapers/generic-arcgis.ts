/**
 * Generic ArcGIS Hub FeatureServer adapter for code-violation
 * datasets.
 *
 * Covers Esri/ArcGIS-shop cities — Detroit, Columbus OH, Baltimore
 * County, hundreds of smaller jurisdictions. Each city exposes a
 * FeatureServer /query endpoint that accepts standard parameters:
 *
 *   GET {featureserver}/query?where=...&outFields=*&f=json
 *
 * Default pagination cap is usually 1000-2000 records per query;
 * the runner uses `resultOffset` for pagination.
 *
 * Like the Socrata adapter, this is a factory — `buildArcgisScraper(config)`
 * returns a CodeScraper for the registry.
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

export type ArcgisFieldMap = {
  address: string;
  apn?: string;
  description: string;
  violationCode?: string;
  status: string;
  /** Esri date fields are epoch-millis numbers. */
  filingDate: string;
  lastActionDate?: string;
  caseNumber?: string;
  ownerName?: string;
  fineAmount?: string;
};

export type ArcgisScraperConfig = {
  id: string;
  label: string;
  city: string;
  state: string;
  /** FeatureServer base URL (without /query). E.g.:
   *  https://services2.arcgis.com/.../FeatureServer/0 */
  featureServerUrl: string;
  fieldMap: ArcgisFieldMap;
  /** SQL-style WHERE clause for "open" cases. Empty string = no filter
   *  (returns all records since filingDate). */
  openCasesWhere?: string;
  normalizeStatus?: (raw: string) => string;
  extractCode?: (attrs: Record<string, unknown>) => string | undefined;
};

const DEFAULT_NORMALIZE_STATUS = (raw: string): string => {
  const upper = raw.trim().toUpperCase();
  if (upper.includes("CLOSED") || upper === "C") return "closed";
  if (upper.includes("OPEN") || upper === "O") return "open";
  if (upper.includes("COMPLIANCE")) return "in_compliance";
  if (upper.includes("HEARING")) return "scheduled_hearing";
  if (upper.includes("CONDEMN")) return "condemned";
  if (upper.includes("DEMOLITION")) return "demolition_ordered";
  return raw.trim().toLowerCase();
};

async function fetchArcgisPage(
  featureServerUrl: string,
  whereClause: string,
  resultOffset: number,
  resultRecordCount: number
): Promise<{
  ok: boolean;
  status: number;
  features: Array<{ attributes: Record<string, unknown> }>;
  error?: string;
}> {
  const params = new URLSearchParams();
  params.set("where", whereClause);
  params.set("outFields", "*");
  params.set("f", "json");
  params.set("resultOffset", String(resultOffset));
  params.set("resultRecordCount", String(resultRecordCount));
  try {
    const res = await fetch(`${featureServerUrl}/query?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        features: [],
        error: (await res.text().catch(() => "")).slice(0, 200)
      };
    }
    const body = (await res.json().catch(() => ({}))) as {
      features?: Array<{ attributes: Record<string, unknown> }>;
      error?: { code: number; message: string };
    };
    if (body.error) {
      return {
        ok: false,
        status: res.status,
        features: [],
        error: `Esri ${body.error.code}: ${body.error.message}`
      };
    }
    return { ok: true, status: res.status, features: body.features ?? [] };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      features: [],
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function parseEsriDate(value: unknown): Date | null {
  // Esri date fields are typically epoch-milliseconds numbers.
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
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

export function buildArcgisScraper(config: ArcgisScraperConfig): CodeScraper {
  const normalizeStatus = config.normalizeStatus ?? DEFAULT_NORMALIZE_STATUS;
  return {
    id: config.id,
    label: config.label,
    kind: "city_arcgis",
    states: [config.state],
    cities: [config.city],
    requiresCredentials: [],
    async run(ctx: CodeScraperContext): Promise<CodeScraperResult> {
      // Esri WHERE uses Esri SQL-92 dialect. Date filters use a quoted
      // string like `filing_date > date '2026-04-01'`. We construct a
      // conservative filter compatible with most tenants.
      const sinceIso = ctx.sinceFilingDate.slice(0, 10);
      const sinceClause = `${config.fieldMap.filingDate} >= date '${sinceIso}'`;
      const openClause = config.openCasesWhere
        ? ` AND (${config.openCasesWhere})`
        : "";
      const whereClause = sinceClause + openClause;

      const pageSize = Math.min(2000, ctx.maxRecords);
      const result = await fetchArcgisPage(
        config.featureServerUrl,
        whereClause,
        0,
        pageSize
      );

      if (!result.ok) {
        return {
          ok: false,
          error: `ArcGIS ${result.status} on ${config.featureServerUrl}: ${result.error ?? "unknown"}`,
          retryable: result.status >= 500 || result.status === 429 || result.status === 0
        };
      }

      const fm = config.fieldMap;
      const warnings: string[] = [];
      const records: ScrapedCodeViolationRecord[] = [];
      for (const feature of result.features) {
        const attrs = feature.attributes ?? {};
        const address = attrs[fm.address] as string | undefined;
        const description = attrs[fm.description] as string | undefined;
        const filingDate = parseEsriDate(attrs[fm.filingDate]);
        if (!address || !description || !filingDate) continue;

        const status = normalizeStatus(String(attrs[fm.status] ?? ""));
        const code = config.extractCode
          ? config.extractCode(attrs)
          : fm.violationCode
            ? (attrs[fm.violationCode] as string | undefined)
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
          apn: fm.apn ? (attrs[fm.apn] as string | undefined) : undefined,
          violationCode: code,
          violationDescription: description.trim(),
          severityTier: severity.tier as SeverityTier,
          status,
          filingDate,
          lastActionDate: fm.lastActionDate
            ? parseEsriDate(attrs[fm.lastActionDate]) ?? undefined
            : undefined,
          caseNumber: fm.caseNumber ? (attrs[fm.caseNumber] as string | undefined) : undefined,
          ownerName: fm.ownerName ? (attrs[fm.ownerName] as string | undefined) : undefined,
          fineAmount: fm.fineAmount ? parseFieldNumber(attrs[fm.fineAmount]) : undefined,
          sourceUrl: config.featureServerUrl,
          parserConfidence: 0.85,
          parserRawJson: attrs
        });
      }

      if (records.length === 0 && result.features.length > 0) {
        warnings.push(
          `ArcGIS returned ${result.features.length} features but parser filtered out all — field map may be stale (city: ${config.city}).`
        );
      }

      return { ok: true, records, warnings };
    }
  };
}
