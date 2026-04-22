import {
  ProviderCredentialError,
  type PropertySearchProvider,
  type ProviderHealth,
  type ProviderSearchQuery,
  type ProviderSearchResult,
  type ProviderSignal,
  type ProviderSkipTraceInput,
  type ProviderSkipTraceResult,
} from "@/lib/dealhawk/providers/types";
import type { DistressSignalType } from "@/lib/dealhawk/distress-score";

/**
 * Dealhawk Empire — BatchData property-search provider.
 *
 * Wraps the BatchData REST API. BatchData is the recommended primary
 * data provider per the research doc (700+ data points per property,
 * MCP-ready). Requires a BatchData account + API key.
 *
 * Configuration resolution order:
 *   1. `credentials.apiKey` passed to the constructor (from
 *      Business.currentIntegrations.batchdata.apiKey).
 *   2. `process.env.BATCHDATA_API_KEY` as a global default.
 *   If neither is set, `isConfigured()` returns false and any search /
 *   skipTrace call throws a ProviderCredentialError with a clear hint.
 *
 * Endpoint caveat: BatchData's API surface has evolved; this adapter
 * targets the documented endpoints as of 2026-Q1. If a search starts
 * returning schema-unexpected responses, verify the endpoint names and
 * request shapes against the current BatchData docs and update the
 * URLs + mapping functions here. Search responses are mapped through
 * `mapResultFromBatchData` — the one funnel to fix.
 */

export type BatchDataCredentials = {
  apiKey?: string;
  /** Override the base URL — useful for sandbox / staging. */
  baseUrl?: string;
};

const DEFAULT_BASE_URL = "https://api.batchdata.com";

// BatchData's property-search endpoint accepts a rich JSON filter. This
// map converts Dealhawk's DistressSignalType enum to the corresponding
// BatchData filter keys. Values come from BatchData's documented property-
// search filter schema; adjust here if the API changes.
const SIGNAL_TO_BATCHDATA_FILTER: Record<DistressSignalType, string> = {
  pre_foreclosure: "foreclosures.active",
  tax_delinquent: "liens.tax.delinquent",
  probate: "owner.probate",
  divorce: "owner.divorce",
  code_violation: "property.code_violations",
  vacancy: "property.vacancy.long_term",
  absentee: "owner.absentee",
  eviction: "owner.evictions",
  expired_listing: "listings.expired",
  high_equity: "financials.equity_gte",
  long_tenure: "owner.tenure_gte",
};

export class BatchDataProvider implements PropertySearchProvider {
  readonly key = "batchdata" as const;
  readonly label = "BatchData";

  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(credentials?: BatchDataCredentials) {
    this.apiKey = credentials?.apiKey ?? process.env.BATCHDATA_API_KEY;
    this.baseUrl = credentials?.baseUrl ?? DEFAULT_BASE_URL;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  async health(): Promise<ProviderHealth> {
    if (!this.isConfigured()) {
      return {
        provider: this.key,
        ok: false,
        latencyMs: null,
        message:
          "No API key configured. Set BATCHDATA_API_KEY in the environment or save the key under Business integrations.",
      };
    }
    const started = Date.now();
    try {
      // BatchData exposes a billing/status endpoint suitable for health
      // pings. Using POST with empty body + auth verifies credentials
      // without consuming search credits.
      const res = await fetch(`${this.baseUrl}/api/v1/account/status`, {
        method: "GET",
        headers: this.authHeaders(),
        cache: "no-store",
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        return {
          provider: this.key,
          ok: false,
          latencyMs,
          message: `HTTP ${res.status} from BatchData /account/status. Verify API key and current endpoint URL.`,
        };
      }
      return {
        provider: this.key,
        ok: true,
        latencyMs,
        message: "BatchData credentials verified.",
      };
    } catch (err) {
      return {
        provider: this.key,
        ok: false,
        latencyMs: Date.now() - started,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async search(
    query: ProviderSearchQuery
  ): Promise<ProviderSearchResult[]> {
    if (!this.isConfigured()) {
      throw new ProviderCredentialError(
        this.key,
        "BatchData API key required. Set BATCHDATA_API_KEY or save under Business integrations.batchdata.apiKey."
      );
    }

    const state = query.state.trim().toUpperCase();
    const maxResults = Math.min(query.maxResults ?? 30, 200);

    // Build BatchData's filter JSON from the Dealhawk query. The exact
    // shape BatchData expects may evolve — this is the place to adjust
    // if the API starts rejecting these filters.
    const criteria: Record<string, unknown> = {
      address: {
        state,
        ...(query.city ? { city: query.city } : {}),
        ...(query.zips && query.zips.length > 0 ? { zip: query.zips } : {}),
      },
    };
    if (query.signalTypes && query.signalTypes.length > 0) {
      const filters: Record<string, unknown> = {};
      for (const type of query.signalTypes) {
        const batchKey = SIGNAL_TO_BATCHDATA_FILTER[type];
        if (batchKey) {
          setNested(filters, batchKey, true);
        }
      }
      Object.assign(criteria, filters);
    }

    const body = {
      searchCriteria: criteria,
      options: {
        take: maxResults,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/v1/property/search`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `BatchData search failed (${res.status}): ${text.slice(0, 300)}`
      );
    }
    const payload = (await res.json()) as {
      results?: Record<string, unknown>[];
      properties?: Record<string, unknown>[];
    };
    const rawResults = payload.results ?? payload.properties ?? [];
    const mapped = rawResults
      .map((raw, idx) => mapResultFromBatchData(raw, idx))
      .filter((r): r is ProviderSearchResult => r !== null);
    return mapped;
  }

  async skipTrace(
    input: ProviderSkipTraceInput
  ): Promise<ProviderSkipTraceResult> {
    if (!this.isConfigured()) {
      throw new ProviderCredentialError(this.key);
    }
    const body = {
      requests: [
        {
          name: { full: input.ownerName },
          address: {
            street: input.propertyAddress,
            city: input.propertyCity,
            state: input.propertyState,
            zip: input.propertyZip,
          },
        },
      ],
    };
    const res = await fetch(`${this.baseUrl}/api/v1/property/skip-trace`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `BatchData skip-trace failed (${res.status}): ${text.slice(0, 300)}`
      );
    }
    const payload = (await res.json()) as {
      results?: Array<{
        phones?: Array<{ number?: string; type?: string; score?: string }>;
        emails?: Array<{ email?: string; score?: string }>;
        addresses?: Array<{ full?: string }>;
      }>;
    };
    const first = payload.results?.[0];
    if (!first) {
      return { phones: [], emails: [] };
    }
    return {
      phones: (first.phones ?? [])
        .filter((p) => p.number)
        .map((p) => ({
          number: p.number!,
          type: p.type,
          confidence: p.score,
        })),
      emails: (first.emails ?? [])
        .filter((e) => e.email)
        .map((e) => ({
          address: e.email!,
          confidence: e.score,
        })),
      otherAddresses: (first.addresses ?? [])
        .map((a) => a.full)
        .filter((a): a is string => typeof a === "string"),
    };
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }
}

function setNested(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

/**
 * Map one raw BatchData property record to ProviderSearchResult. Returns
 * null if the record is missing the required address fields — BatchData
 * occasionally returns skeleton records that can't be placed.
 *
 * BatchData field names have varied across API generations. This mapper
 * checks the current documented field names first and falls back to
 * common legacy aliases. If a search returns results with unexpected
 * shapes, this is the place to extend the aliases list.
 */
function mapResultFromBatchData(
  raw: Record<string, unknown>,
  index: number
): ProviderSearchResult | null {
  const address = getNested(raw, "address.street") ?? getNested(raw, "street");
  const city = getNested(raw, "address.city") ?? getNested(raw, "city");
  const state = (getNested(raw, "address.state") ?? getNested(raw, "state")) as
    | string
    | null;
  const zip = (getNested(raw, "address.zip") ??
    getNested(raw, "address.zipCode") ??
    getNested(raw, "zip")) as string | null;

  if (!address || !city || !state || !zip) return null;

  const providerRef =
    (getNested(raw, "id") as string | null) ??
    (getNested(raw, "apn") as string | null) ??
    `BATCH-${String(state).toUpperCase()}-${index}`;

  const signals: ProviderSignal[] = [];
  // Walk the signal-to-field map in reverse: for every signal whose
  // BatchData flag is truthy in the record, attach a ProviderSignal.
  for (const [type, path] of Object.entries(SIGNAL_TO_BATCHDATA_FILTER)) {
    const value = getNested(raw, path);
    if (value) {
      signals.push({
        signalType: type as DistressSignalType,
        sourceRef:
          (getNested(raw, `${path}.caseNumber`) as string | null) ?? null,
        citedDate:
          (getNested(raw, `${path}.recordedDate`) as string | null) ?? null,
        notes:
          typeof value === "object"
            ? null
            : `Flag present on BatchData record: ${path}.`,
      });
    }
  }

  const equityPercent = getNested(raw, "financials.equity_percent") as
    | number
    | null;
  const tenureYears = getNested(raw, "owner.tenure_years") as number | null;
  const arvEstimate = getNested(raw, "valuation.estimated_value") as
    | number
    | null;
  const bedrooms = getNested(raw, "attributes.bedrooms") as number | null;
  const bathrooms = getNested(raw, "attributes.bathrooms") as number | null;
  const livingSqft = getNested(raw, "attributes.living_sqft") as
    | number
    | null;
  const yearBuilt = getNested(raw, "attributes.year_built") as number | null;

  return {
    providerRef: String(providerRef),
    propertyAddress: String(address),
    propertyCity: String(city),
    propertyState: String(state).toUpperCase(),
    propertyZip: String(zip),
    propertyType: (getNested(raw, "attributes.property_type") as string) ?? "sfr",
    bedrooms,
    bathrooms,
    livingSqft,
    yearBuilt,
    ownerName:
      (getNested(raw, "owner.name.full") as string) ??
      (getNested(raw, "owner.name") as string) ??
      null,
    ownerMailingAddress:
      (getNested(raw, "owner.mailing_address.full") as string) ?? null,
    ownerEntityType:
      (getNested(raw, "owner.entity_type") as string) ?? null,
    equityPercent,
    tenureYears,
    arvEstimate,
    signals,
  };
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let cursor: unknown = obj;
  for (const key of keys) {
    if (cursor === null || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[key];
    if (cursor === undefined) return null;
  }
  return cursor;
}
