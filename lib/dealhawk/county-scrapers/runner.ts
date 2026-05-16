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

  // Run scrapers in parallel — each hits a different county / source and
  // there's no shared rate-limit to coordinate. Sequential ran the full
  // pre-foreclosure batch in ~30-60s for 3 scrapers; parallel is bounded
  // by the slowest single endpoint.
  const settled = await Promise.allSettled(
    scrapers.map(async (scraper) => {
      const missing = scraper.requiresCredentials.filter((k) => !credentials[k]);
      if (missing.length > 0) {
        return {
          entry: {
            id: scraper.id,
            label: scraper.label,
            ok: false as const,
            recordCount: 0,
            error: `Missing credentials: ${missing.join(", ")}. Wire ${missing.join(" + ")} at /admin/integrations.`,
            retryable: false
          },
          records: [] as ScrapedForeclosureRecord[]
        };
      }
      const result = await scraper.run({
        sinceFilingDate,
        maxRecords: input.maxRecordsPerScraper,
        credentials
      });
      if (result.ok) {
        log.info("scraper ran", {
          id: scraper.id,
          recordCount: result.records.length,
          warningCount: result.warnings?.length ?? 0
        });
        return {
          entry: {
            id: scraper.id,
            label: scraper.label,
            ok: true as const,
            recordCount: result.records.length,
            warnings: result.warnings
          },
          records: result.records
        };
      }
      log.warn("scraper failed", {
        id: scraper.id,
        error: result.error,
        retryable: result.retryable
      });
      return {
        entry: {
          id: scraper.id,
          label: scraper.label,
          ok: false as const,
          recordCount: 0,
          error: result.error,
          retryable: result.retryable
        },
        records: [] as ScrapedForeclosureRecord[]
      };
    })
  );

  for (let i = 0; i < settled.length; i += 1) {
    const outcome = settled[i];
    const scraper = scrapers[i];
    if (outcome.status === "fulfilled") {
      perScraper.push(outcome.value.entry);
      allRecords.push(...outcome.value.records);
    } else {
      perScraper.push({
        id: scraper.id,
        label: scraper.label,
        ok: false,
        recordCount: 0,
        error: `unhandled exception: ${
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason)
        }`,
        retryable: true
      });
      log.error("scraper threw", { id: scraper.id, err: outcome.reason });
    }
  }

  return { records: allRecords, perScraper };
}
