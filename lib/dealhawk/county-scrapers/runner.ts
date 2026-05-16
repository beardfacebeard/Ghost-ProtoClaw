/**
 * County-scraper runner — orchestrates the registered scrapers against
 * the operator's state allowlist + integration credentials.
 *
 * Called by foreclosure-sweep.ts alongside the ATTOM feed pull. Scrapers
 * are independent — one failure doesn't block another. All credentials
 * come from the org's Integration table (resolved per-business at the
 * sweep entry point and passed in here).
 */

import { resolveIntegrationCredentials } from "@/lib/integrations/resolve";
import { getLogger } from "@/lib/observability/logger";
import {
  findScrapersForState,
  listAllScrapers
} from "./registry";
import type { ScrapedForeclosureRecord, ScraperCredentials } from "./types";

const log = getLogger("county-scrapers");

export type RunnerInput = {
  organizationId: string;
  /** Operator's state allowlist. Empty = all states (all scrapers run). */
  states: string[];
  /** Hard cap on records per scraper. */
  maxRecordsPerScraper: number;
  /** Days back from now to query. */
  sinceDays: number;
};

export type RunnerResult = {
  records: ScrapedForeclosureRecord[];
  perScraper: Array<{
    id: string;
    label: string;
    ok: boolean;
    recordCount: number;
    error?: string;
    warnings?: string[];
    retryable?: boolean;
  }>;
};

async function resolveCredentials(
  organizationId: string
): Promise<ScraperCredentials> {
  const [firecrawl, browserbase, apify] = await Promise.all([
    resolveIntegrationCredentials(organizationId, "firecrawl", {
      api_key: "FIRECRAWL_API_KEY"
    }),
    resolveIntegrationCredentials(organizationId, "browserbase", {
      api_key: "BROWSERBASE_API_KEY",
      project_id: "BROWSERBASE_PROJECT_ID"
    }),
    resolveIntegrationCredentials(organizationId, "apify", {
      api_key: "APIFY_API_KEY"
    })
  ]);
  return {
    firecrawl: firecrawl.api_key ? { api_key: firecrawl.api_key } : undefined,
    browserbase:
      browserbase.api_key && browserbase.project_id
        ? { api_key: browserbase.api_key, project_id: browserbase.project_id }
        : undefined,
    apify: apify.api_key ? { api_key: apify.api_key } : undefined
  };
}

export async function runCountyScrapers(
  input: RunnerInput
): Promise<RunnerResult> {
  const credentials = await resolveCredentials(input.organizationId);

  // Pick scrapers: when the state allowlist is set, run only those that
  // cover at least one allowed state. Otherwise run all registered
  // scrapers.
  const scrapers =
    input.states.length > 0
      ? Array.from(
          new Set(
            input.states.flatMap((s) => findScrapersForState(s))
          )
        )
      : listAllScrapers();

  const sinceFilingDate = new Date(
    Date.now() - input.sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const allRecords: ScrapedForeclosureRecord[] = [];
  const perScraper: RunnerResult["perScraper"] = [];

  for (const scraper of scrapers) {
    // Skip when credentials aren't configured for this scraper's needs.
    const missing = scraper.requiresCredentials.filter((k) => !credentials[k]);
    if (missing.length > 0) {
      perScraper.push({
        id: scraper.id,
        label: scraper.label,
        ok: false,
        recordCount: 0,
        error: `Missing credentials: ${missing.join(", ")}. Wire ${missing.join(" + ")} at /admin/integrations.`,
        retryable: false
      });
      continue;
    }

    try {
      const result = await scraper.run({
        sinceFilingDate,
        maxRecords: input.maxRecordsPerScraper,
        credentials
      });
      if (result.ok) {
        allRecords.push(...result.records);
        perScraper.push({
          id: scraper.id,
          label: scraper.label,
          ok: true,
          recordCount: result.records.length,
          warnings: result.warnings
        });
        log.info("scraper ran", {
          id: scraper.id,
          recordCount: result.records.length,
          warningCount: result.warnings?.length ?? 0
        });
      } else {
        perScraper.push({
          id: scraper.id,
          label: scraper.label,
          ok: false,
          recordCount: 0,
          error: result.error,
          retryable: result.retryable
        });
        log.warn("scraper failed", {
          id: scraper.id,
          error: result.error,
          retryable: result.retryable
        });
      }
    } catch (err) {
      perScraper.push({
        id: scraper.id,
        label: scraper.label,
        ok: false,
        recordCount: 0,
        error: `unhandled exception: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true
      });
      log.error("scraper threw", { id: scraper.id, err });
    }
  }

  return { records: allRecords, perScraper };
}
