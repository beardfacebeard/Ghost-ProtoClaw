/**
 * County-scraping framework — types.
 *
 * Each county / aggregator scraper implements a uniform contract so the
 * runner can fan-out scrapes in parallel, normalize results, and feed
 * them back into the same insert path as ATTOM + CSV imports.
 *
 * Three scraper kinds shipped today:
 *   - "state_legal_notice"  — scraping state press-association aggregator
 *                              sites (publicnoticeads.com,
 *                              floridapublicnotices.com, etc.).
 *                              Implemented via Firecrawl (low-friction).
 *   - "county_recorder"     — scraping county recorder portals for NOD
 *                              and NOTS filings. Implemented via
 *                              Browserbase (stateful, JS-heavy).
 *   - "county_court_docket" — scraping county clerk court-docket portals
 *                              for Lis Pendens + Judgment of Foreclosure.
 *                              Implemented via Browserbase.
 *
 * Adding a new scraper: implement the contract below, register it in
 * lib/dealhawk/county-scrapers/registry.ts. The runner discovers it
 * automatically.
 */

export type ScraperKind =
  | "state_legal_notice"
  | "county_recorder"
  | "county_court_docket";

export type ScraperCredentials = {
  firecrawl?: { api_key: string };
  browserbase?: { api_key: string; project_id: string };
  apify?: { api_key: string };
};

export type ScraperContext = {
  /** ISO date string — only return records filed on or after this date. */
  sinceFilingDate: string;
  /** Hard cap on records the scraper should return. */
  maxRecords: number;
  credentials: ScraperCredentials;
};

export type ScrapedForeclosureRecord = {
  propertyAddress: string;
  county: string;
  state: string; // 2-letter USPS
  apn?: string;
  foreclosureStage: string;
  documentType: string;
  filingDate: Date;
  auctionDate?: Date;
  caseNumber?: string;
  ownerName: string;
  ownerMailingAddress?: string;
  trusteeName?: string;
  lenderName?: string;
  plaintiffAttorney?: string;
  reinstatementAmount?: number;
  judgmentAmount?: number;
  estimatedPropertyValue?: number;
  loanBalanceEstimate?: number;
  sourceUrl?: string;
  sourceDocumentUrl?: string;
  parserConfidence?: number;
  parserRawText?: string;
};

export type ScraperResult =
  | { ok: true; records: ScrapedForeclosureRecord[]; warnings?: string[] }
  | {
      ok: false;
      error: string;
      // Hint to the runner: should it retry this scraper next tick, or
      // back off (e.g. CAPTCHA detected, portal redesign suspected)?
      retryable: boolean;
    };

export type CountyScraper = {
  /** Stable id used as the registry key. */
  id: string;
  /** Human-readable label for the dashboard. */
  label: string;
  kind: ScraperKind;
  /** US states this scraper covers (usually one; legal-notice
   *  aggregators may cover multiple). */
  states: string[];
  /** Counties this scraper covers when kind = "county_*". Empty for
   *  state aggregators. */
  counties?: string[];
  /** Which credentials must be configured for this scraper to run. */
  requiresCredentials: Array<keyof ScraperCredentials>;
  /** Run the scrape. Receives a context with date range + creds. */
  run(ctx: ScraperContext): Promise<ScraperResult>;
};
