/**
 * County-scraper registry.
 *
 * Lookup by id; iterable by state. Add a new scraper here to make it
 * discoverable to the runner without touching the foreclosure-sweep
 * code.
 */

import { dallasClerkScraper } from "./dallas-clerk";
import { floridaLegalNoticesScraper } from "./florida-legal-notices";
import { maricopaRecorderScraper } from "./maricopa-recorder";
import type { CountyScraper } from "./types";

const ALL: CountyScraper[] = [
  floridaLegalNoticesScraper,
  maricopaRecorderScraper,
  dallasClerkScraper
];

export function listAllScrapers(): CountyScraper[] {
  return ALL.slice();
}

export function findScrapersForState(state: string): CountyScraper[] {
  const key = state.trim().toUpperCase();
  return ALL.filter((s) => s.states.includes(key));
}

export function findScraperById(id: string): CountyScraper | undefined {
  return ALL.find((s) => s.id === id);
}

export function listScraperSummaries(): Array<{
  id: string;
  label: string;
  kind: string;
  states: string[];
  counties: string[];
  requiresCredentials: string[];
}> {
  return ALL.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    states: s.states,
    counties: s.counties ?? [],
    requiresCredentials: s.requiresCredentials
  }));
}
