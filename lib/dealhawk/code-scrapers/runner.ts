/**
 * Code-violation scraper runner.
 *
 * Orchestrates the Tier-1 city scrapers (registry.ts) + any
 * operator-added Tier-2 generic adapters (read from
 * Business.config.codeViolation.customAdapters at runtime) against
 * the operator's city allowlist.
 */

import { resolveIntegrationCredentials } from "@/lib/integrations/resolve";
import { getLogger } from "@/lib/observability/logger";
import {
  findScrapersForCity,
  findScrapersForState,
  listAllScrapers
} from "./registry";
import { buildSocrataScraper, type SocrataScraperConfig } from "./generic-socrata";
import { buildArcgisScraper, type ArcgisScraperConfig } from "./generic-arcgis";
import type {
  CodeScraperCredentials,
  ScrapedCodeViolationRecord
} from "./types";

const log = getLogger("code-scrapers");

export type CodeRunnerInput = {
  organizationId: string;
  /** Operator's city allowlist — items are "City, ST" strings.
   *  Empty = all Tier-1 cities run. */
  cities: string[];
  /** Operator's state allowlist — empty = no state filter beyond cities. */
  states: string[];
  /** Tier-2 generic-adapter configs read from
   *  Business.config.codeViolation.customAdapters. */
  customSocrataAdapters?: SocrataScraperConfig[];
  customArcgisAdapters?: ArcgisScraperConfig[];
  maxRecordsPerScraper: number;
  sinceDays: number;
};

export type CodeRunnerResult = {
  records: ScrapedCodeViolationRecord[];
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
): Promise<CodeScraperCredentials> {
  // Socrata app token is optional. Pull from a soft "socrata"
  // integration if the operator has registered one for higher rate
  // limits.
  const socrata = await resolveIntegrationCredentials(organizationId, "socrata", {
    app_token: "SOCRATA_APP_TOKEN"
  });
  const firecrawl = await resolveIntegrationCredentials(
    organizationId,
    "firecrawl",
    { api_key: "FIRECRAWL_API_KEY" }
  );
  return {
    socrata: socrata.app_token ? { app_token: socrata.app_token } : undefined,
    firecrawl: firecrawl.api_key ? { api_key: firecrawl.api_key } : undefined
  };
}

function parseCityState(entry: string): { city: string; state: string } | null {
  const m = entry.match(/^(.+?),\s*([A-Z]{2})$/i);
  if (!m) return null;
  return { city: m[1].trim(), state: m[2].trim().toUpperCase() };
}

export async function runCodeViolationScrapers(
  input: CodeRunnerInput
): Promise<CodeRunnerResult> {
  const credentials = await resolveCredentials(input.organizationId);

  // Build the set of scrapers to run.
  const customScrapers = [
    ...(input.customSocrataAdapters ?? []).map(buildSocrataScraper),
    ...(input.customArcgisAdapters ?? []).map(buildArcgisScraper)
  ];
  let scrapers = [...listAllScrapers(), ...customScrapers];

  // City allowlist applied if set.
  if (input.cities.length > 0) {
    const allowedCityScrapers = input.cities.flatMap((c) => {
      const parsed = parseCityState(c);
      if (!parsed) return [];
      return [
        ...findScrapersForCity(parsed.city, parsed.state),
        ...customScrapers.filter(
          (s) =>
            s.cities.some((sc) => sc.toLowerCase() === parsed.city.toLowerCase()) &&
            s.states.some((ss) => ss.toUpperCase() === parsed.state)
        )
      ];
    });
    scrapers = Array.from(new Set(allowedCityScrapers));
  } else if (input.states.length > 0) {
    // Fall back to state allowlist when no city is set but states are.
    scrapers = Array.from(
      new Set(input.states.flatMap((s) => findScrapersForState(s)))
    );
  }

  const sinceFilingDate = new Date(
    Date.now() - input.sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const allRecords: ScrapedCodeViolationRecord[] = [];
  const perScraper: CodeRunnerResult["perScraper"] = [];

  for (const scraper of scrapers) {
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
      } else {
        perScraper.push({
          id: scraper.id,
          label: scraper.label,
          ok: false,
          recordCount: 0,
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
      log.error("code-scraper threw", { id: scraper.id, err });
    }
  }

  return { records: allRecords, perScraper };
}
