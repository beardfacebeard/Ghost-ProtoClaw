/**
 * Dealhawk Empire — Pre-Foreclosure Daily Sweep (Commit 1, ships dark).
 *
 * Runs once per day per business that has the pre_foreclosure addon
 * enabled (Business.config.preForeclosure.enabled === true). Co-scheduled
 * with the existing Dealhawk sourcing sweep at the same sweepHourLocal so
 * the two operate as a single morning batch and don't fight for the same
 * time window (decision #11 in DEALHAWK_PRE_FORECLOSURE_MODULE_PLAN.md).
 *
 * Source priority per the plan:
 *   (1) ATTOM API when wired — canonical national feed, fastest coverage
 *   (2) Direct county scraping (Browserbase / Apify / Firecrawl) — TODO
 *       commit 2 (per-county script library)
 *   (3) State legal-notice aggregators — TODO commit 2
 *   (4) CSV upload — always-on fallback, handled by the import route
 *
 * Commit 1 implements (1) only — the always-on CSV path plus ATTOM when
 * wired. (2) and (3) are wired in commit 2 alongside the County Records
 * Scraper Agent's interactive tooling.
 *
 * No outreach fires here. This sweep only WRITES ForeclosureRecord rows
 * with enrichmentStatus="pending" — the rest of the pre-foreclosure
 * pipeline (skip-trace, scoring, compliance review, outreach prep) lands
 * in commits 2 and 3.
 */

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { preForeclosureScore } from "@/lib/dealhawk/distress-score";
import {
  hasStateAttestation,
  parseAttestations
} from "@/lib/dealhawk/foreclosure-state-compliance";
import { resolveIntegrationCredentials } from "@/lib/integrations/resolve";
import { getLogger } from "@/lib/observability/logger";

const log = getLogger("foreclosure-sweep");

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function computePropertyEquityPercent(
  estimatedValue: number | undefined,
  loanBalance: number | undefined
): number | null {
  if (!estimatedValue || !loanBalance) return null;
  if (estimatedValue <= 0) return null;
  return Math.max(-100, ((estimatedValue - loanBalance) / estimatedValue) * 100);
}

// ── Config shape (lives in Business.config.preForeclosure) ───────────

export type PreForeclosureConfig = {
  /** Master toggle. When false, the sweep is a no-op for this business. */
  enabled: boolean;
  /** Operator-configured priority counties — e.g.
   *  ["Maricopa, AZ", "Dallas, TX", "Miami-Dade, FL"]. Used by commit 2's
   *  per-county scrapers; ATTOM ignores this list and pulls by state. */
  priorityCounties?: string[];
  /** State allowlist. When set, ForeclosureRecord rows whose `state` is
   *  not in this list are dropped (operator can't legally pursue them).
   *  Empty / unset = all states allowed. The State Compliance Review
   *  Agent (commit 2) is the hard gate; this is the soft gate at ingest. */
  states?: string[];
  /** Document-type allowlist. Defaults to all early-stage docs (NOD, LP).
   *  Late-stage docs (NOTS, Notice of Sale) are operator opt-in because
   *  the lead time is too short for typical acquisition. */
  documentTypes?: string[];
  /** Operator's per-state attestation map (commit 2 surface). */
  attestations?: Record<string, boolean>;
  /** GLBA/DPPA attestation for skip-trace authorization (commit 2). */
  glbaAttestation?: {
    signedAt: string;
    signedBy: string;
  };
  /** Hard ingest cap per sweep. Default 200. */
  dailyIngestCap?: number;
};

function parsePreForeclosureConfig(
  raw: unknown
): PreForeclosureConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const cfg = (raw as Record<string, unknown>).preForeclosure;
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return null;
  const obj = cfg as Record<string, unknown>;
  return {
    enabled: obj.enabled === true,
    priorityCounties: Array.isArray(obj.priorityCounties)
      ? obj.priorityCounties.filter((c): c is string => typeof c === "string")
      : [],
    states: Array.isArray(obj.states)
      ? obj.states.filter((s): s is string => typeof s === "string")
      : [],
    documentTypes: Array.isArray(obj.documentTypes)
      ? obj.documentTypes.filter((d): d is string => typeof d === "string")
      : ["NOD", "LP"],
    attestations:
      obj.attestations && typeof obj.attestations === "object"
        ? (obj.attestations as Record<string, boolean>)
        : {},
    glbaAttestation:
      obj.glbaAttestation && typeof obj.glbaAttestation === "object"
        ? (obj.glbaAttestation as { signedAt: string; signedBy: string })
        : undefined,
    dailyIngestCap:
      typeof obj.dailyIngestCap === "number" ? obj.dailyIngestCap : 200
  };
}

// ── Normalized record shape (sweep output before DB write) ───────────

type NormalizedForeclosureRecord = {
  propertyAddress: string;
  county: string;
  state: string;
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
  sourceType: string;
  sourceUrl?: string;
  sourceDocumentUrl?: string;
  parserConfidence?: number;
  parserRawText?: string;
};

// ── ATTOM provider ────────────────────────────────────────────────────

const ATTOM_BASE = "https://api.gateway.attomdata.com";

/**
 * Pull pre-foreclosure records from ATTOM. Optional — degrades to no-op
 * when ATTOM is not configured. The actual ATTOM endpoint paths vary by
 * subscription tier (Foreclosure bundle vs Property bundle); this commit
 * targets the documented /propertyapi/v4/foreclosure/snapshot endpoint
 * shape but operators must verify their bundle covers it. Returns the
 * parsed records or an empty array when the credential isn't present.
 *
 * Coverage caveat: ATTOM's foreclosure dataset is reseller-restricted;
 * downstream surfacing of raw ATTOM records to end-users requires a
 * separate license. We treat the records as internal sourcing input,
 * never as direct display.
 */
async function fetchAttomPreForeclosure(
  organizationId: string,
  states: string[]
): Promise<NormalizedForeclosureRecord[]> {
  const creds = await resolveIntegrationCredentials(organizationId, "attom", {
    api_key: "ATTOM_API_KEY"
  });
  const apiKey = creds.api_key;
  if (!apiKey) {
    log.debug("attom not configured — skipping", { organizationId });
    return [];
  }

  const results: NormalizedForeclosureRecord[] = [];
  const targetStates = states.length > 0 ? states : ["ALL"];

  for (const state of targetStates) {
    try {
      const params = new URLSearchParams();
      if (state !== "ALL") params.set("state", state);
      params.set("pagesize", "100");
      const url = `${ATTOM_BASE}/propertyapi/v4/foreclosure/snapshot?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          apikey: apiKey,
          Accept: "application/json"
        }
      });
      if (!res.ok) {
        log.warn("attom non-200", {
          state,
          status: res.status,
          body: (await res.text().catch(() => "")).slice(0, 200)
        });
        continue;
      }
      const body = (await res.json().catch(() => null)) as
        | { property?: Array<Record<string, unknown>>; foreclosure?: Array<Record<string, unknown>> }
        | null;
      const rows = body?.foreclosure ?? body?.property ?? [];
      for (const row of rows) {
        const norm = normalizeAttomRow(row);
        if (norm) results.push(norm);
      }
    } catch (err) {
      log.error("attom fetch threw", {
        state,
        err: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return results;
}

/**
 * Normalize an ATTOM foreclosure-feed row into our ForeclosureRecord
 * shape. Response shapes vary across ATTOM bundles — this is the best-
 * effort shape based on the documented snapshot endpoint. Operators with
 * different bundle access may need to adjust the field paths.
 */
function normalizeAttomRow(
  row: Record<string, unknown>
): NormalizedForeclosureRecord | null {
  const addr = row.address as Record<string, unknown> | undefined;
  const fcl = row.foreclosure as Record<string, unknown> | undefined;
  const owner = row.owner as Record<string, unknown> | undefined;
  const parcel = row.parcel as Record<string, unknown> | undefined;

  const propertyAddress =
    (addr?.line1 as string | undefined) ||
    (row.propertyAddress as string | undefined) ||
    "";
  if (!propertyAddress) return null;

  const state =
    (addr?.countrySubd as string | undefined) ||
    (row.state as string | undefined) ||
    "";
  if (!state) return null;

  const county =
    (addr?.county as string | undefined) ||
    (row.county as string | undefined) ||
    "";

  const docType = String(
    fcl?.foreclosureDocType ?? fcl?.docType ?? row.documentType ?? "LP"
  ).toUpperCase();
  // Map ATTOM doc types to our normalized vocab.
  const stageByDoc: Record<string, string> = {
    NOD: "notice_of_default",
    NOTS: "notice_of_trustee_sale",
    NTS: "notice_of_trustee_sale",
    LP: "lis_pendens",
    LIS: "lis_pendens",
    JF: "judgment_of_foreclosure",
    NS: "notice_of_sale",
    TS: "sheriffs_sale"
  };

  const filingDateStr = (fcl?.filingDate ?? fcl?.recordingDate ?? row.filingDate) as
    | string
    | undefined;
  if (!filingDateStr) return null;
  const filingDate = new Date(filingDateStr);
  if (Number.isNaN(filingDate.getTime())) return null;

  const auctionDateStr = (fcl?.auctionDate ?? fcl?.saleDate) as string | undefined;
  const auctionDate = auctionDateStr ? new Date(auctionDateStr) : undefined;

  const ownerName =
    (owner?.fullName as string | undefined) ||
    (row.ownerName as string | undefined) ||
    (owner?.lastName as string | undefined) ||
    "";
  if (!ownerName) return null;

  const reinstatement =
    typeof fcl?.reinstatementAmount === "number"
      ? (fcl.reinstatementAmount as number)
      : typeof fcl?.amountInArrears === "number"
        ? (fcl.amountInArrears as number)
        : undefined;

  return {
    propertyAddress,
    county,
    state,
    apn: (parcel?.apn as string | undefined) || (row.apn as string | undefined),
    foreclosureStage: stageByDoc[docType] ?? "lis_pendens",
    documentType: docType,
    filingDate,
    auctionDate: auctionDate && !Number.isNaN(auctionDate.getTime()) ? auctionDate : undefined,
    caseNumber: fcl?.caseNumber as string | undefined,
    ownerName,
    ownerMailingAddress: owner?.mailingAddress as string | undefined,
    trusteeName: fcl?.trustee as string | undefined,
    lenderName: fcl?.lender as string | undefined,
    plaintiffAttorney: fcl?.attorney as string | undefined,
    reinstatementAmount: reinstatement,
    judgmentAmount: fcl?.judgmentAmount as number | undefined,
    estimatedPropertyValue: row.estimatedValue as number | undefined,
    sourceType: "attom_feed",
    sourceUrl: row.sourceUrl as string | undefined,
    sourceDocumentUrl: fcl?.documentUrl as string | undefined,
    parserConfidence: 0.95,
    parserRawText: JSON.stringify(row).slice(0, 4000)
  };
}

// ── Sweep entry point ────────────────────────────────────────────────

export type ForeclosureSweepResult = {
  businessId: string;
  attomFetched: number;
  candidates: number;
  duplicatesSkipped: number;
  stateAllowlistSkipped: number;
  documentTypeSkipped: number;
  inserted: number;
  errors: string[];
};

export async function runPreForeclosureSweepForBusiness(
  businessId: string
): Promise<ForeclosureSweepResult> {
  const result: ForeclosureSweepResult = {
    businessId,
    attomFetched: 0,
    candidates: 0,
    duplicatesSkipped: 0,
    stateAllowlistSkipped: 0,
    documentTypeSkipped: 0,
    inserted: 0,
    errors: []
  };

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      config: true,
      globalPaused: true,
      status: true
    }
  });
  if (!business) {
    result.errors.push("business not found");
    return result;
  }
  if (business.globalPaused) {
    log.info("business paused — skipping", { businessId });
    return result;
  }

  const cfg = parsePreForeclosureConfig(business.config);
  if (!cfg || !cfg.enabled) {
    log.debug("pre-foreclosure not enabled — skipping", { businessId });
    return result;
  }

  const ingestCap = cfg.dailyIngestCap ?? 200;
  const stateAllowlist = new Set(cfg.states ?? []);
  const documentTypeAllowlist = new Set(cfg.documentTypes ?? ["NOD", "LP"]);

  // (1) ATTOM feed — when configured, when allowed states are listed,
  // pull state-by-state. Falls back to ALL when the allowlist is empty
  // (operator hasn't constrained yet).
  const attomRecords = await fetchAttomPreForeclosure(
    business.organizationId,
    Array.from(stateAllowlist)
  );
  result.attomFetched = attomRecords.length;

  // (2) County-direct scraping + state legal-notice aggregators. Each
  // scraper is independent; failure of one doesn't block the others.
  // Skipped silently when Firecrawl (or other required creds) aren't
  // configured for the organization.
  let scraperRecords: typeof attomRecords = [];
  try {
    const { runCountyScrapers } = await import(
      "@/lib/dealhawk/county-scrapers/runner"
    );
    const scraperResult = await runCountyScrapers({
      organizationId: business.organizationId,
      states: Array.from(stateAllowlist),
      maxRecordsPerScraper: Math.min(50, ingestCap),
      sinceDays: 30
    });
    // Adapt the scraper-record shape (ScrapedForeclosureRecord) to the
    // sweep's NormalizedForeclosureRecord shape so the dedup + write
    // path can treat them uniformly. Map sourceType to a per-scraper
    // identifier so the audit trail shows where each row came from.
    scraperRecords = scraperResult.records.map((r) => ({
      propertyAddress: r.propertyAddress,
      county: r.county,
      state: r.state,
      apn: r.apn,
      foreclosureStage: r.foreclosureStage,
      documentType: r.documentType,
      filingDate: r.filingDate,
      auctionDate: r.auctionDate,
      caseNumber: r.caseNumber,
      ownerName: r.ownerName,
      ownerMailingAddress: r.ownerMailingAddress,
      trusteeName: r.trusteeName,
      lenderName: r.lenderName,
      plaintiffAttorney: r.plaintiffAttorney,
      reinstatementAmount: r.reinstatementAmount,
      judgmentAmount: r.judgmentAmount,
      estimatedPropertyValue: r.estimatedPropertyValue,
      loanBalanceEstimate: r.loanBalanceEstimate,
      sourceType:
        scraperResult.perScraper.find((s) => s.recordCount > 0)?.id ??
        "county_recorder",
      sourceUrl: r.sourceUrl,
      sourceDocumentUrl: r.sourceDocumentUrl,
      parserConfidence: r.parserConfidence,
      parserRawText: r.parserRawText
    }));
    if (scraperResult.perScraper.length > 0) {
      log.info("county scrapers ran", {
        businessId,
        perScraper: scraperResult.perScraper
      });
    }
  } catch (err) {
    result.errors.push(
      `county-scrapers failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const allCandidates = [...attomRecords, ...scraperRecords];
  result.candidates = allCandidates.length;

  if (allCandidates.length === 0) {
    log.info("no candidates", { businessId, attomConfigured: result.attomFetched > 0 });
    return result;
  }

  // Dedup against existing ForeclosureRecord rows by the unique key
  // (businessId + sourceType + sourceUrl + filingDate). The DB has a unique
  // constraint so the actual insert would fail anyway; we pre-check to
  // count + report cleanly.
  const existing = await db.foreclosureRecord.findMany({
    where: {
      businessId,
      sourceType: "attom_feed",
      filingDate: { in: allCandidates.map((c) => c.filingDate) }
    },
    select: { sourceUrl: true, filingDate: true }
  });
  const existingKeys = new Set(
    existing.map(
      (e) => `${e.sourceUrl ?? ""}|${e.filingDate.toISOString()}`
    )
  );

  // Compliance posture inputs (used in preForeclosureScore) — derived
  // once per sweep, not per record.
  const attestations = parseAttestations(business.config);
  const pre = (business.config as Record<string, unknown> | null)?.preForeclosure as
    | { glbaAttestation?: { signedAt?: string } }
    | undefined;
  const glbaAttested = Boolean(pre?.glbaAttestation?.signedAt);

  let inserted = 0;
  for (const candidate of allCandidates) {
    if (inserted >= ingestCap) break;

    // State allowlist gate.
    if (stateAllowlist.size > 0 && !stateAllowlist.has(candidate.state)) {
      result.stateAllowlistSkipped += 1;
      continue;
    }

    // Document type gate.
    if (!documentTypeAllowlist.has(candidate.documentType)) {
      result.documentTypeSkipped += 1;
      continue;
    }

    // Duplicate gate.
    const key = `${candidate.sourceUrl ?? ""}|${candidate.filingDate.toISOString()}`;
    if (existingKeys.has(key)) {
      result.duplicatesSkipped += 1;
      continue;
    }

    // Score the candidate so the dashboard's auction-imminent view can
    // sort + filter without a follow-up scoring pass.
    const equityPct = computePropertyEquityPercent(
      candidate.estimatedPropertyValue,
      candidate.loanBalanceEstimate
    );
    const scoreResult = preForeclosureScore({
      foreclosureStage: candidate.foreclosureStage,
      daysUntilAuction: daysUntil(candidate.auctionDate),
      equityPercent: equityPct,
      ownerOccupied: candidate.ownerMailingAddress
        ? candidate.ownerMailingAddress.toLowerCase().trim() ===
          candidate.propertyAddress.toLowerCase().trim()
        : null,
      stateAttested: hasStateAttestation(business.config, candidate.state),
      glbaAttested,
      sourceCount: 1
    });

    try {
      await db.foreclosureRecord.create({
        data: {
          businessId: business.id,
          propertyAddress: candidate.propertyAddress,
          county: candidate.county,
          state: candidate.state,
          apn: candidate.apn,
          foreclosureStage: candidate.foreclosureStage,
          documentType: candidate.documentType,
          filingDate: candidate.filingDate,
          auctionDate: candidate.auctionDate,
          caseNumber: candidate.caseNumber,
          ownerName: candidate.ownerName,
          ownerMailingAddress: candidate.ownerMailingAddress,
          trusteeName: candidate.trusteeName,
          lenderName: candidate.lenderName,
          plaintiffAttorney: candidate.plaintiffAttorney,
          reinstatementAmount: candidate.reinstatementAmount
            ? new Prisma.Decimal(candidate.reinstatementAmount)
            : null,
          judgmentAmount: candidate.judgmentAmount
            ? new Prisma.Decimal(candidate.judgmentAmount)
            : null,
          estimatedPropertyValue: candidate.estimatedPropertyValue
            ? new Prisma.Decimal(candidate.estimatedPropertyValue)
            : null,
          loanBalanceEstimate: candidate.loanBalanceEstimate
            ? new Prisma.Decimal(candidate.loanBalanceEstimate)
            : null,
          sourceType: candidate.sourceType,
          sourceUrl: candidate.sourceUrl,
          sourceDocumentUrl: candidate.sourceDocumentUrl,
          sourceTimestamp: new Date(),
          parserConfidence: candidate.parserConfidence,
          parserRawText: candidate.parserRawText,
          enrichmentStatus: "enriched",
          scoreSnapshot: scoreResult.total
        }
      });
      inserted += 1;
    } catch (err) {
      // Likely a unique-constraint hit despite the pre-check (race).
      // Treat as a soft dup so the sweep keeps moving.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Unique constraint")) {
        result.duplicatesSkipped += 1;
      } else {
        result.errors.push(
          `insert failed for ${candidate.propertyAddress}: ${message.slice(0, 200)}`
        );
      }
    }
  }
  result.inserted = inserted;

  log.info("pre-foreclosure sweep complete", { ...result, name: business.name });

  if (inserted > 0 || result.errors.length > 0) {
    await db.activityEntry
      .create({
        data: {
          businessId: business.id,
          type: "workflow",
          title: "Daily Pre-Foreclosure Sweep",
          detail: `Ingested ${inserted} foreclosure records from ${allCandidates.length} candidates (ATTOM: ${result.attomFetched}). ${result.duplicatesSkipped} duplicates skipped, ${result.stateAllowlistSkipped} outside state allowlist, ${result.documentTypeSkipped} outside document-type allowlist.`,
          status: inserted > 0 ? "completed" : "skipped",
          metadata: {
            ...result,
            errors: result.errors.slice(0, 10),
            sweepRunAt: new Date().toISOString()
          }
        }
      })
      .catch(() => {});
  }

  return result;
}

/**
 * Run sweeps for every Dealhawk business with the pre-foreclosure addon
 * enabled. Called from the scheduler at the same hour as the existing
 * Dealhawk sourcing sweep (decision #11). Each business is gated on
 * Business.config.preForeclosure.enabled === true.
 */
export async function runAllPreForeclosureSweeps(): Promise<
  ForeclosureSweepResult[]
> {
  const businesses = await db.business.findMany({
    where: {
      config: { not: Prisma.DbNull },
      status: { in: ["active", "planning"] },
      globalPaused: false
    },
    select: { id: true, config: true }
  });

  const enabledIds = businesses
    .map((b) => ({ id: b.id, cfg: parsePreForeclosureConfig(b.config) }))
    .filter((b) => b.cfg?.enabled === true)
    .map((b) => b.id);

  const results: ForeclosureSweepResult[] = [];
  for (const id of enabledIds) {
    try {
      results.push(await runPreForeclosureSweepForBusiness(id));
    } catch (err) {
      results.push({
        businessId: id,
        attomFetched: 0,
        candidates: 0,
        duplicatesSkipped: 0,
        stateAllowlistSkipped: 0,
        documentTypeSkipped: 0,
        inserted: 0,
        errors: [err instanceof Error ? err.message : String(err)]
      });
    }
  }
  return results;
}
