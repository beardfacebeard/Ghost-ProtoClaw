/**
 * Code-violation scraping framework — types.
 *
 * Parallel to lib/dealhawk/county-scrapers/ (foreclosure scrapers) but
 * with a code-violation-specific output shape. Each scraper implements
 * a uniform contract so the runner can fan-out scrapes in parallel,
 * normalize results, and feed them into the same insert path as
 * CSV imports.
 *
 * Per the plan's 3-tier national-coverage strategy:
 *   - "city_socrata"      — generic Socrata adapter, auto-discovers
 *                           dataset by URL + field-map config
 *   - "city_arcgis"       — generic ArcGIS Hub FeatureServer adapter
 *   - "city_custom"       — hand-tuned scraper for a specific city
 *                           (Philly Carto, NYC HPD-with-class, etc.)
 *
 * Adding a new city: either register a generic adapter instance with
 * the city's dataset URL + field map (covers Socrata + ArcGIS cities
 * cleanly), or implement a city-specific scraper for harder formats.
 */

import type { SeverityTier } from "@/lib/dealhawk/code-violation-severity";

export type CodeScraperKind =
  | "city_socrata"
  | "city_arcgis"
  | "city_custom";

export type CodeScraperCredentials = {
  firecrawl?: { api_key: string };
  /** Socrata app tokens raise rate limits but aren't required.
   *  Operators can paste one per-org if they hit Socrata rate limits. */
  socrata?: { app_token?: string };
};

export type CodeScraperContext = {
  /** ISO date string — only return records filed on or after this date. */
  sinceFilingDate: string;
  /** Hard cap on records the scraper should return. */
  maxRecords: number;
  credentials: CodeScraperCredentials;
};

export type ScrapedCodeViolationRecord = {
  propertyAddress: string;
  apn?: string;
  city: string;
  county?: string;
  state: string; // 2-letter USPS
  violationCode?: string;
  violationDescription: string;
  /** Inferred per the severity dictionary; can be re-classified
   *  server-side after the scraper returns. */
  severityTier: SeverityTier;
  /** "open" | "closed" | "in_compliance" | "scheduled_hearing"
   *    | "demolition_ordered" | "condemned" | "vacated" */
  status: string;
  filingDate: Date;
  lastActionDate?: Date;
  hearingDate?: Date;
  caseNumber?: string;
  ownerName?: string;
  ownerMailingAddress?: string;
  inspectorId?: string;
  fineAmount?: number;
  sourceUrl?: string;
  parserConfidence?: number;
  parserRawText?: string;
  parserRawJson?: Record<string, unknown>;
};

export type CodeScraperResult =
  | { ok: true; records: ScrapedCodeViolationRecord[]; warnings?: string[] }
  | {
      ok: false;
      error: string;
      retryable: boolean;
    };

export type CodeScraper = {
  /** Stable id used as the registry key. */
  id: string;
  /** Human-readable label for the dashboard. */
  label: string;
  kind: CodeScraperKind;
  /** US states this scraper covers (usually one). */
  states: string[];
  /** Cities this scraper covers. */
  cities: string[];
  /** Which credentials must be configured for this scraper to run. */
  requiresCredentials: Array<keyof CodeScraperCredentials>;
  /** Run the scrape. Receives a context with date range + creds. */
  run(ctx: CodeScraperContext): Promise<CodeScraperResult>;
};
