/**
 * Code-violation scraper registry.
 *
 * Tier 1: the 10 pre-built city scrapers (see cities.ts).
 * Tier 2: operator-added generic Socrata + ArcGIS adapter instances
 *         (registered at runtime via Business.config.codeViolation.customAdapters).
 *
 * Tier 2 adapter instances are NOT in this file — they're read from
 * the per-business config at runner time. Keep ALL static here.
 */

import { ALL_TIER1_SCRAPERS } from "./cities";
import type { CodeScraper } from "./types";

const ALL: CodeScraper[] = [...ALL_TIER1_SCRAPERS];

export function listAllScrapers(): CodeScraper[] {
  return ALL.slice();
}

export function findScrapersForState(state: string): CodeScraper[] {
  const key = state.trim().toUpperCase();
  return ALL.filter((s) =>
    s.states.some((sc) => sc.toUpperCase() === key)
  );
}

export function findScrapersForCity(
  city: string,
  state: string
): CodeScraper[] {
  const cityKey = city.trim().toLowerCase();
  const stateKey = state.trim().toUpperCase();
  return ALL.filter(
    (s) =>
      s.cities.some((c) => c.toLowerCase() === cityKey) &&
      s.states.some((st) => st.toUpperCase() === stateKey)
  );
}

export function findScraperById(id: string): CodeScraper | undefined {
  return ALL.find((s) => s.id === id);
}

export function listScraperSummaries(): Array<{
  id: string;
  label: string;
  kind: string;
  states: string[];
  cities: string[];
  requiresCredentials: string[];
}> {
  return ALL.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    states: s.states,
    cities: s.cities,
    requiresCredentials: s.requiresCredentials
  }));
}
