/**
 * Dealhawk Daily Lead Sourcing Sweep.
 *
 * Runs once per day (operator-configurable hour) against each business
 * that has Dealhawk Empire as its template and a sourcing buy-box on
 * file. Queries the structured property-data providers the operator has
 * connected (RentCast / Axesso Zillow / Realie) for fresh leads matching
 * the buy-box, dedupes against the existing pipeline, scores via the
 * distress signal scorer, and drops survivors into the Deal table.
 *
 * The downstream Daily Deal Digest workflow then surfaces the top 10 in
 * the operator's morning briefing at 7am.
 *
 * Cost-control: hard cap on ingest volume per sweep (operator-configurable,
 * default 100). Stops the moment the cap is hit even if more candidates
 * are available.
 */

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { executeTool } from "@/lib/mcp/tool-executor";
import { getLogger } from "@/lib/observability/logger";
import {
  BASE_WEIGHTS,
  computeMotivationScore,
  recommendExit,
  type DistressSignalType
} from "@/lib/dealhawk/distress-score";

const log = getLogger("sourcing-sweep");

// ── BuyBox shape ──────────────────────────────────────────────────

export type SourcingBuyBox = {
  /** ["Memphis, TN", "38103", "Wayne County, MI", ...] */
  markets?: string[];
  priceMin?: number;
  priceMax?: number;
  /** "sfr" | "multi_family" | "condo" | "townhouse" | "mobile" | "land" | "commercial" */
  propertyTypes?: string[];
  /** Distress signals the agent should prioritize. */
  distressSignals?: string[];
  /** Default 60. Leads below this score don't get ingested. */
  minMotivationScore?: number;
  /** Default 100. Hard cap per sweep — operator-tunable. */
  dailyIngestCap?: number;
  /** 24h local hour. Default 6. */
  sweepHourLocal?: number;
};

function parseBuyBox(raw: unknown): SourcingBuyBox | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  return {
    markets: Array.isArray(obj.markets) ? obj.markets.filter((m): m is string => typeof m === "string") : [],
    priceMin: typeof obj.priceMin === "number" ? obj.priceMin : undefined,
    priceMax: typeof obj.priceMax === "number" ? obj.priceMax : undefined,
    propertyTypes: Array.isArray(obj.propertyTypes)
      ? obj.propertyTypes.filter((t): t is string => typeof t === "string")
      : [],
    distressSignals: Array.isArray(obj.distressSignals)
      ? obj.distressSignals.filter((s): s is string => typeof s === "string")
      : [],
    minMotivationScore:
      typeof obj.minMotivationScore === "number" ? obj.minMotivationScore : 60,
    dailyIngestCap: typeof obj.dailyIngestCap === "number" ? obj.dailyIngestCap : 100,
    sweepHourLocal: typeof obj.sweepHourLocal === "number" ? obj.sweepHourLocal : 6
  };
}

// ── Market parsing ────────────────────────────────────────────────

/** Parse "Memphis, TN" / "38103" / "Wayne County, MI" → query params. */
function parseMarket(market: string): { city?: string; state?: string; zipCode?: string; county?: string } {
  const trimmed = market.trim();
  // Plain 5-digit ZIP
  if (/^\d{5}$/.test(trimmed)) return { zipCode: trimmed };
  // "<X> County, <State>"
  const countyMatch = trimmed.match(/^(.+?)\s+County,\s*([A-Z]{2})$/i);
  if (countyMatch) {
    return { county: countyMatch[1], state: countyMatch[2].toUpperCase() };
  }
  // "<City>, <State>"
  const cityMatch = trimmed.match(/^(.+?),\s*([A-Z]{2})$/i);
  if (cityMatch) {
    return { city: cityMatch[1], state: cityMatch[2].toUpperCase() };
  }
  // Fall-through: treat as a single-state query
  if (/^[A-Z]{2}$/i.test(trimmed)) return { state: trimmed.toUpperCase() };
  return {};
}

// ── Provider response normalization ───────────────────────────────

type NormalizedLead = {
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  livingSqft?: number;
  lotSqft?: number;
  yearBuilt?: number;
  ownerName?: string;
  ownerMailingAddress?: string;
  ownerEntityType?: string;
  arvMid?: number;
  rentEstimate?: number;
  /** Raw provider-specific data the agents may want later. */
  rawProvider: string;
  rawData: Record<string, unknown>;
  /** Inferred signal types (for scoring). */
  signals: DistressSignalType[];
};

function normalizeRealieRow(row: Record<string, unknown>): NormalizedLead | null {
  const address = (row.address || row.propertyAddress) as string | undefined;
  const state = row.state as string | undefined;
  if (!address || !state) return null;

  const signals: DistressSignalType[] = [];
  if (row.isDistressed) signals.push("pre_foreclosure");
  if (row.isTaxDelinquent) signals.push("tax_delinquent");
  if (row.isProbate) signals.push("probate");
  if (row.isAbsenteeOwner) signals.push("absentee");
  if (row.hasCodeViolation) signals.push("code_violation");

  return {
    propertyAddress: address,
    propertyCity: (row.city as string) ?? "",
    propertyState: String(state).toUpperCase().slice(0, 2),
    propertyZip: (row.zipCode || row.zip) as string ?? "",
    propertyType: (row.propertyType as string) ?? "sfr",
    bedrooms: (row.bedrooms as number) ?? undefined,
    bathrooms: (row.bathrooms as number) ?? undefined,
    livingSqft: (row.livingSqft || row.buildingSqft) as number ?? undefined,
    lotSqft: (row.lotSqft || row.lotSize) as number ?? undefined,
    yearBuilt: (row.yearBuilt as number) ?? undefined,
    ownerName: (row.ownerName as string) ?? undefined,
    ownerMailingAddress: (row.mailingAddress as string) ?? undefined,
    ownerEntityType: (row.ownerEntityType as string) ?? undefined,
    arvMid: (row.estimatedValue || row.value) as number ?? undefined,
    rentEstimate: (row.rentEstimate as number) ?? undefined,
    rawProvider: "realie",
    rawData: row,
    signals
  };
}

function normalizeRentcastRow(row: Record<string, unknown>): NormalizedLead | null {
  const address = (row.formattedAddress || row.addressLine1) as string | undefined;
  const state = row.state as string | undefined;
  if (!address || !state) return null;
  return {
    propertyAddress: address,
    propertyCity: (row.city as string) ?? "",
    propertyState: String(state).toUpperCase().slice(0, 2),
    propertyZip: (row.zipCode as string) ?? "",
    propertyType: (row.propertyType as string) ?? "sfr",
    bedrooms: (row.bedrooms as number) ?? undefined,
    bathrooms: (row.bathrooms as number) ?? undefined,
    livingSqft: (row.squareFootage as number) ?? undefined,
    lotSqft: (row.lotSize as number) ?? undefined,
    yearBuilt: (row.yearBuilt as number) ?? undefined,
    ownerName: (row.ownerName as string) ?? undefined,
    arvMid: (row.lastSalePrice as number) ?? undefined,
    rawProvider: "rentcast",
    rawData: row,
    signals: []
  };
}

// ── Provider query ────────────────────────────────────────────────

async function queryProvider(params: {
  organizationId: string;
  businessId: string;
  market: ReturnType<typeof parseMarket>;
  buyBox: SourcingBuyBox;
  cap: number;
}): Promise<NormalizedLead[]> {
  const out: NormalizedLead[] = [];

  // Realie first — it's the only provider with structured distressed-only
  // filtering, so when distress signals are requested we always try Realie.
  const wantDistressed = (params.buyBox.distressSignals?.length ?? 0) > 0;

  const toolName = wantDistressed ? "property_distressed_search" : "property_search";
  const args: Record<string, unknown> = {
    _organizationId: params.organizationId,
    _businessId: params.businessId,
    state: params.market.state,
    city: params.market.city,
    county: params.market.county,
    zipCode: params.market.zipCode,
    minValue: params.buyBox.priceMin,
    maxValue: params.buyBox.priceMax,
    limit: Math.min(params.cap, 100)
  };

  const result = await executeTool({
    toolName,
    arguments: args,
    mcpServerId: "",
    organizationId: params.organizationId,
    businessId: params.businessId,
    bypassApprovalGate: true
  });

  if (!result.success) {
    log.warn("property search failed; no provider configured or call errored", {
      market: params.market,
      error: result.error
    });
    return [];
  }

  // Defensive parsing — providers wrap arrays under different keys:
  // RentCast often returns a bare array; Realie wraps under `data` with
  // pagination; some APIs use `results`, `items`, `properties`, or
  // `records`. We try all common shapes before giving up.
  try {
    const parsed = JSON.parse(result.output);
    if (parsed === null || parsed === undefined) {
      return out;
    }
    let rows: Record<string, unknown>[] = [];
    if (Array.isArray(parsed)) {
      rows = parsed as Record<string, unknown>[];
    } else if (typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      for (const key of ["properties", "data", "results", "items", "records", "deals"]) {
        const candidate = obj[key];
        if (Array.isArray(candidate)) {
          rows = candidate as Record<string, unknown>[];
          break;
        }
      }
      // Some single-property endpoints return the property as the root.
      // Treat as a one-row array if it has the right shape.
      if (rows.length === 0 && (obj.address || obj.formattedAddress)) {
        rows = [obj];
      }
    }
    if (rows.length === 0) {
      log.debug("provider response had no recognizable rows", {
        sample: result.output.slice(0, 200)
      });
    }
    for (const row of rows) {
      // Try Realie shape first (richer field set), then RentCast as fallback.
      const lead =
        normalizeRealieRow(row as Record<string, unknown>) ??
        normalizeRentcastRow(row as Record<string, unknown>);
      if (lead) out.push(lead);
      if (out.length >= params.cap) break;
    }
  } catch (err) {
    log.warn("could not parse provider response", {
      err,
      sample: result.output.slice(0, 200)
    });
  }

  return out;
}

// ── Sweep orchestration ───────────────────────────────────────────

export type SweepResult = {
  businessId: string;
  marketsQueried: number;
  candidatesFound: number;
  duplicatesSkipped: number;
  belowThresholdSkipped: number;
  imported: number;
  errors: string[];
};

/**
 * Run the sourcing sweep for one business. Returns the count breakdown.
 * Failures on one market don't abort the sweep — they're collected and
 * logged. Safe to call multiple times in a day (dedup against existing
 * pipeline prevents duplicate ingestion).
 */
export async function runSourcingSweepForBusiness(
  businessId: string
): Promise<SweepResult> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      organizationId: true,
      sourcingBuyBox: true,
      name: true
    }
  });

  if (!business) {
    return {
      businessId,
      marketsQueried: 0,
      candidatesFound: 0,
      duplicatesSkipped: 0,
      belowThresholdSkipped: 0,
      imported: 0,
      errors: ["Business not found."]
    };
  }

  const buyBox = parseBuyBox(business.sourcingBuyBox);
  if (!buyBox || !buyBox.markets || buyBox.markets.length === 0) {
    return {
      businessId,
      marketsQueried: 0,
      candidatesFound: 0,
      duplicatesSkipped: 0,
      belowThresholdSkipped: 0,
      imported: 0,
      errors: ["No buy-box configured. Set markets at /admin/businesses/<id>/sourcing."]
    };
  }

  const cap = buyBox.dailyIngestCap ?? 100;
  const minScore = buyBox.minMotivationScore ?? 60;
  const errors: string[] = [];
  const allCandidates: NormalizedLead[] = [];

  for (const market of buyBox.markets) {
    if (allCandidates.length >= cap) break;
    const remaining = cap - allCandidates.length;
    try {
      const parsedMarket = parseMarket(market);
      const leads = await queryProvider({
        organizationId: business.organizationId,
        businessId: business.id,
        market: parsedMarket,
        buyBox,
        cap: remaining
      });
      allCandidates.push(...leads);
    } catch (err) {
      errors.push(
        `Market "${market}" failed: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  // Dedupe against existing pipeline (last 90 days).
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const existing = await db.deal.findMany({
    where: {
      businessId: business.id,
      createdAt: { gte: ninetyDaysAgo },
      propertyAddress: { in: allCandidates.map((c) => c.propertyAddress) }
    },
    select: { propertyAddress: true }
  });
  const existingAddresses = new Set(
    existing.map((d) => d.propertyAddress.toLowerCase().trim())
  );

  let duplicatesSkipped = 0;
  let belowThresholdSkipped = 0;
  let imported = 0;

  const propertyTypeFilter = new Set(buyBox.propertyTypes ?? []);

  for (const lead of allCandidates) {
    if (existingAddresses.has(lead.propertyAddress.toLowerCase().trim())) {
      duplicatesSkipped += 1;
      continue;
    }
    if (propertyTypeFilter.size > 0 && !propertyTypeFilter.has(lead.propertyType)) {
      continue;
    }

    // Score via the existing distress scorer.
    const { score: motivationScore } = computeMotivationScore({
      signals: lead.signals.map((t) => ({ signalType: t }))
    });

    if (motivationScore < minScore) {
      belowThresholdSkipped += 1;
      continue;
    }

    const maoWholesale = lead.arvMid ? Math.round(lead.arvMid * 0.7) : null;
    const recommendedExit = recommendExit({
      motivationScore,
      maoWholesale,
      maoBrrrr: null,
      maoFlip: lead.arvMid ? Math.round(lead.arvMid * 0.75) : null,
      arvMid: lead.arvMid ?? null,
      rentEstimate: lead.rentEstimate ?? null
    });

    try {
      const deal = await db.deal.create({
        data: {
          organizationId: business.organizationId,
          businessId: business.id,
          status: "lead",
          propertyAddress: lead.propertyAddress,
          propertyCity: lead.propertyCity,
          propertyState: lead.propertyState,
          propertyZip: lead.propertyZip,
          propertyType: lead.propertyType,
          bedrooms: lead.bedrooms ?? null,
          bathrooms: lead.bathrooms ?? null,
          livingSqft: lead.livingSqft ?? null,
          lotSqft: lead.lotSqft ?? null,
          yearBuilt: lead.yearBuilt ?? null,
          ownerName: lead.ownerName ?? null,
          ownerMailingAddress: lead.ownerMailingAddress ?? null,
          ownerEntityType: lead.ownerEntityType ?? null,
          arvMid: lead.arvMid ?? null,
          rentEstimate: lead.rentEstimate ?? null,
          maoWholesale,
          motivationScore,
          recommendedExit,
          source: `sweep_${lead.rawProvider}`,
          config: {
            sweepIngestedAt: new Date().toISOString(),
            provider: lead.rawProvider,
            raw: lead.rawData
          } as object
        }
      });

      // Attach signal rows so they show up in the deal detail drawer.
      for (const signalType of lead.signals) {
        await db.dealSignal.create({
          data: {
            organizationId: business.organizationId,
            dealId: deal.id,
            signalType,
            sourceType: lead.rawProvider,
            sourceRef: null,
            weight: BASE_WEIGHTS[signalType],
            confidence: "medium",
            notes: `Auto-ingested from ${lead.rawProvider} daily sweep.`
          }
        });
      }

      imported += 1;
    } catch (err) {
      errors.push(
        `Insert failed for ${lead.propertyAddress}: ${
          err instanceof Error ? err.message : "unknown"
        }`
      );
    }
  }

  log.info("sweep complete", {
    businessId,
    name: business.name,
    candidates: allCandidates.length,
    duplicatesSkipped,
    belowThresholdSkipped,
    imported,
    errorCount: errors.length
  });

  // Record an activity entry so it shows up in the daily digest.
  if (imported > 0 || errors.length > 0) {
    await db.activityEntry
      .create({
        data: {
          businessId: business.id,
          type: "workflow",
          title: "Daily Lead Sourcing Sweep",
          detail: `Ingested ${imported} new leads from ${allCandidates.length} candidates across ${buyBox.markets.length} markets. ${duplicatesSkipped} duplicates skipped. ${belowThresholdSkipped} below motivation threshold.`,
          status: imported > 0 ? "completed" : "skipped",
          metadata: {
            imported,
            candidates: allCandidates.length,
            duplicatesSkipped,
            belowThresholdSkipped,
            errors: errors.slice(0, 10),
            sweepRunAt: new Date().toISOString()
          }
        }
      })
      .catch(() => {});
  }

  return {
    businessId,
    marketsQueried: buyBox.markets.length,
    candidatesFound: allCandidates.length,
    duplicatesSkipped,
    belowThresholdSkipped,
    imported,
    errors
  };
}

/**
 * Run sweeps for every Dealhawk business that has a buy-box configured.
 * Called by the scheduled workflow at the operator's sweepHourLocal.
 */
export async function runAllSourcingSweeps(): Promise<SweepResult[]> {
  // Find every Dealhawk business with a non-null buy-box. We treat the
  // presence of sourcingBuyBox as the trigger — businesses without one
  // simply aren't part of the sweep.
  const businesses = await db.business.findMany({
    where: {
      sourcingBuyBox: { not: Prisma.DbNull },
      status: { in: ["active", "planning"] },
      globalPaused: false
    },
    select: { id: true }
  });

  const results: SweepResult[] = [];
  for (const b of businesses) {
    try {
      const r = await runSourcingSweepForBusiness(b.id);
      results.push(r);
    } catch (err) {
      log.error("sweep failed for business", { businessId: b.id, err });
    }
  }
  return results;
}

