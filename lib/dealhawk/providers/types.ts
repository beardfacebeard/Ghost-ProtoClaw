/**
 * Dealhawk Empire — property-search provider interface.
 *
 * The template is explicitly data-source-agnostic per the research doc:
 * point the sourcing agents at whatever provider the operator has
 * subscribed to (BatchData, PropStream, REsimpli, Tracerfy, custom MCP
 * endpoint...) and they pull, dedupe, and stack. Every provider
 * implements this interface and the agents / UI don't care which is
 * active.
 *
 * The first two concrete implementations:
 *   - DemoProvider       — realistic synthetic data, zero external deps.
 *                           Shipped enabled for every Dealhawk business
 *                           so first-search has something to show.
 *   - BatchDataProvider  — BatchData REST API. Requires BATCHDATA_API_KEY
 *                           env var or a stored credential on the
 *                           Business.currentIntegrations JSON field.
 *
 * Future: PropStream adapter, REsimpli, Podio / REI BlackBook bridges,
 * and MCP-based providers for emerging 2026 data sources.
 */

import type { DistressSignalType } from "@/lib/dealhawk/distress-score";

export type ProviderKey = "demo" | "batchdata";

export type ProviderSearchQuery = {
  /** City name (or null for state-wide searches). */
  city?: string | null;
  /** 2-letter USPS state code. Required. */
  state: string;
  /** Optional zip-code filter. */
  zips?: string[];
  /** Which distress signals the operator wants to target. If empty, all. */
  signalTypes?: DistressSignalType[];
  /** Minimum motivation score to return. */
  minMotivation?: number;
  /** Cap on results returned. Provider may round down. */
  maxResults?: number;
};

export type ProviderSignal = {
  signalType: DistressSignalType;
  sourceRef?: string | null;
  /** Date the signal was cited from its source (filing date, etc.). */
  citedDate?: string | null;
  notes?: string | null;
};

export type ProviderSearchResult = {
  /** Provider-specific ID for the property (for dedup / re-fetch). */
  providerRef: string;
  propertyAddress: string;
  propertyCity: string;
  /** 2-letter USPS state code, uppercased. */
  propertyState: string;
  propertyZip: string;
  propertyType?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  livingSqft?: number | null;
  yearBuilt?: number | null;
  ownerName?: string | null;
  ownerMailingAddress?: string | null;
  ownerEntityType?: string | null;
  /** Estimated percent equity (owner share of ARV). 0-100. */
  equityPercent?: number | null;
  /** Years the current owner has held the property. */
  tenureYears?: number | null;
  /** Rough ARV estimate (provider's automated valuation). */
  arvEstimate?: number | null;
  /** Stacked distress signals per the provider's data tier. */
  signals: ProviderSignal[];
  /** Motivation score 0-100. If the provider has its own score, use it
   *  directly; otherwise the resolver computes it from the signals +
   *  multipliers via lib/dealhawk/distress-score.ts. */
  motivationScore?: number;
};

export type ProviderSkipTraceInput = {
  ownerName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
};

export type ProviderSkipTraceResult = {
  phones: Array<{ number: string; type?: string; confidence?: string }>;
  emails: Array<{ address: string; confidence?: string }>;
  otherAddresses?: string[];
};

export type ProviderHealth = {
  provider: ProviderKey;
  ok: boolean;
  /** Latency in ms from test-ping, or null if not measured. */
  latencyMs: number | null;
  /** Human-readable status string. */
  message: string;
};

export interface PropertySearchProvider {
  readonly key: ProviderKey;
  readonly label: string;

  /**
   * Returns true when the provider has credentials / is ready to serve
   * live queries. Demo always returns true.
   */
  isConfigured(): boolean;

  /**
   * Test ping — cheap round-trip to verify credentials + latency. Never
   * throws; returns a ProviderHealth describing the outcome.
   */
  health(): Promise<ProviderHealth>;

  /**
   * Search for distressed properties in a target market. Returns up to
   * query.maxResults (provider-capped). Throws on credential / network
   * failure; the API route is responsible for surfacing the error to
   * the operator.
   */
  search(query: ProviderSearchQuery): Promise<ProviderSearchResult[]>;

  /**
   * Skip-trace — look up contact info for a known owner. Not all
   * providers support this; those that don't throw a UnsupportedFeature
   * error which the API route converts to a 501.
   */
  skipTrace?(input: ProviderSkipTraceInput): Promise<ProviderSkipTraceResult>;
}

export class UnsupportedFeatureError extends Error {
  constructor(provider: ProviderKey, feature: string) {
    super(
      `Provider "${provider}" does not support feature "${feature}". Use a different provider or implement the capability on the adapter.`
    );
    this.name = "UnsupportedFeatureError";
  }
}

export class ProviderCredentialError extends Error {
  constructor(provider: ProviderKey, hint?: string) {
    super(
      `Provider "${provider}" is not configured. ${
        hint ?? "Set the provider's API key in Business integrations or the corresponding env var."
      }`
    );
    this.name = "ProviderCredentialError";
  }
}
