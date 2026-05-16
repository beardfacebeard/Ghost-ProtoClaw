/**
 * Dealhawk Empire — Code Violation Daily Sweep (Commit 1, ships dark).
 *
 * Runs once per day per business that has the code_violation_distress
 * addon enabled (Business.config.codeViolation.enabled === true).
 * Co-scheduled with the existing Dealhawk + pre_foreclosure sweeps at
 * the same sweepHourLocal.
 *
 * Source priority per the plan's 3-tier strategy:
 *   (1) Tier 1 pre-built city scrapers — registered in
 *       lib/dealhawk/code-scrapers/registry.ts
 *   (2) Tier 2 generic Socrata + ArcGIS adapters — read from
 *       Business.config.codeViolation.customAdapters at runtime
 *   (3) CSV upload (handled by the import route, not this sweep)
 *
 * No outreach fires here. This sweep only WRITES CodeViolationRecord
 * rows with enrichmentStatus="enriched" — the rest of the pipeline
 * (severity scoring, compliance review, outreach prep) lands in
 * subsequent commits.
 */

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getLogger } from "@/lib/observability/logger";
import {
  runCodeViolationScrapers,
  type CodeRunnerInput
} from "@/lib/dealhawk/code-scrapers/runner";
import type {
  SocrataScraperConfig
} from "@/lib/dealhawk/code-scrapers/generic-socrata";
import type {
  ArcgisScraperConfig
} from "@/lib/dealhawk/code-scrapers/generic-arcgis";

const log = getLogger("code-violation-sweep");

// ── Config shape (lives in Business.config.codeViolation) ────────────

export type CodeViolationConfig = {
  enabled: boolean;
  /** Operator-configured city allowlist — items are "City, ST" strings.
   *  Empty = all Tier-1 cities run. */
  cities?: string[];
  /** Tier-2 generic-adapter configs the operator has added. */
  customAdapters?: {
    socrata?: SocrataScraperConfig[];
    arcgis?: ArcgisScraperConfig[];
  };
  /** Severity tiers to ingest. Default [1, 2, 3] (skip tier-4 noise). */
  severityFilter?: number[];
  /** Hard ingest cap per sweep. Default 500. */
  dailyIngestCap?: number;
  /** Fair Housing audit metadata (decision-default = quarterly). */
  fairHousingAuditedAt?: string;
  fairHousingAuditedBy?: string;
};

function parseCodeViolationConfig(
  raw: unknown
): CodeViolationConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const cfg = (raw as Record<string, unknown>).codeViolation;
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return null;
  const obj = cfg as Record<string, unknown>;
  const adapters =
    obj.customAdapters && typeof obj.customAdapters === "object" && !Array.isArray(obj.customAdapters)
      ? (obj.customAdapters as Record<string, unknown>)
      : {};
  return {
    enabled: obj.enabled === true,
    cities: Array.isArray(obj.cities)
      ? obj.cities.filter((c): c is string => typeof c === "string")
      : [],
    customAdapters: {
      socrata: Array.isArray(adapters.socrata)
        ? (adapters.socrata as SocrataScraperConfig[])
        : [],
      arcgis: Array.isArray(adapters.arcgis)
        ? (adapters.arcgis as ArcgisScraperConfig[])
        : []
    },
    severityFilter: Array.isArray(obj.severityFilter)
      ? (obj.severityFilter as number[])
      : [1, 2, 3],
    dailyIngestCap:
      typeof obj.dailyIngestCap === "number" ? (obj.dailyIngestCap as number) : 500,
    fairHousingAuditedAt: obj.fairHousingAuditedAt as string | undefined,
    fairHousingAuditedBy: obj.fairHousingAuditedBy as string | undefined
  };
}

// ── Sweep entry point ────────────────────────────────────────────────

export type CodeViolationSweepResult = {
  businessId: string;
  candidatesFound: number;
  duplicatesSkipped: number;
  severityFilterSkipped: number;
  inserted: number;
  errors: string[];
  perScraperStatus: Array<{
    id: string;
    label: string;
    ok: boolean;
    recordCount: number;
    error?: string;
  }>;
};

export async function runCodeViolationSweepForBusiness(
  businessId: string
): Promise<CodeViolationSweepResult> {
  const result: CodeViolationSweepResult = {
    businessId,
    candidatesFound: 0,
    duplicatesSkipped: 0,
    severityFilterSkipped: 0,
    inserted: 0,
    errors: [],
    perScraperStatus: []
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
  if (!business || business.globalPaused) return result;

  const cfg = parseCodeViolationConfig(business.config);
  if (!cfg || !cfg.enabled) return result;

  const ingestCap = cfg.dailyIngestCap ?? 500;
  const severityAllow = new Set(cfg.severityFilter ?? [1, 2, 3]);

  // Run all configured scrapers.
  const runnerInput: CodeRunnerInput = {
    organizationId: business.organizationId,
    cities: cfg.cities ?? [],
    states: [],
    customSocrataAdapters: cfg.customAdapters?.socrata,
    customArcgisAdapters: cfg.customAdapters?.arcgis,
    maxRecordsPerScraper: Math.min(100, ingestCap),
    sinceDays: 30
  };
  const scraperResult = await runCodeViolationScrapers(runnerInput);
  result.perScraperStatus = scraperResult.perScraper.map((s) => ({
    id: s.id,
    label: s.label,
    ok: s.ok,
    recordCount: s.recordCount,
    error: s.error
  }));

  result.candidatesFound = scraperResult.records.length;
  if (result.candidatesFound === 0) {
    log.info("no candidates", { businessId, name: business.name });
    return result;
  }

  // Dedup against existing rows using the unique key.
  const existing = await db.codeViolationRecord.findMany({
    where: {
      businessId,
      caseNumber: {
        in: scraperResult.records
          .map((r) => r.caseNumber)
          .filter((c): c is string => Boolean(c))
      }
    },
    select: { sourceType: true, sourceUrl: true, caseNumber: true }
  });
  const existingKeys = new Set(
    existing.map(
      (e) => `${e.sourceType}|${e.sourceUrl ?? ""}|${e.caseNumber ?? ""}`
    )
  );

  let inserted = 0;
  for (const candidate of scraperResult.records) {
    if (inserted >= ingestCap) break;

    if (!severityAllow.has(candidate.severityTier)) {
      result.severityFilterSkipped += 1;
      continue;
    }

    // Source-type pulled from the scraper-kind that produced it. The
    // runner returns records with `parserRawJson` but no explicit
    // sourceType field, so we derive it from the matching scraper id.
    const scraperEntry = scraperResult.perScraper.find(
      (s) => s.recordCount > 0
    );
    const sourceType = scraperEntry?.id.includes("arcgis")
      ? "arcgis"
      : scraperEntry?.id.includes("socrata")
        ? "socrata"
        : "city_custom";

    const dedupKey = `${sourceType}|${candidate.sourceUrl ?? ""}|${candidate.caseNumber ?? ""}`;
    if (existingKeys.has(dedupKey)) {
      result.duplicatesSkipped += 1;
      continue;
    }

    try {
      await db.codeViolationRecord.create({
        data: {
          businessId: business.id,
          propertyAddress: candidate.propertyAddress,
          apn: candidate.apn,
          city: candidate.city,
          county: candidate.county,
          state: candidate.state,
          violationCode: candidate.violationCode,
          violationDescription: candidate.violationDescription,
          severityTier: candidate.severityTier,
          status: candidate.status,
          filingDate: candidate.filingDate,
          lastActionDate: candidate.lastActionDate,
          hearingDate: candidate.hearingDate,
          caseNumber: candidate.caseNumber,
          ownerName: candidate.ownerName,
          ownerMailingAddress: candidate.ownerMailingAddress,
          inspectorId: candidate.inspectorId,
          fineAmount: candidate.fineAmount
            ? new Prisma.Decimal(candidate.fineAmount)
            : null,
          sourceType,
          sourceUrl: candidate.sourceUrl,
          sourceTimestamp: new Date(),
          parserConfidence: candidate.parserConfidence,
          parserRawText: candidate.parserRawText,
          parserRawJson:
            (candidate.parserRawJson as Prisma.InputJsonValue | undefined) ??
            undefined,
          enrichmentStatus: "enriched"
        }
      });
      inserted += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("Unique constraint") ||
        message.includes("unique constraint")
      ) {
        result.duplicatesSkipped += 1;
      } else {
        result.errors.push(
          `insert failed for ${candidate.propertyAddress}: ${message.slice(0, 200)}`
        );
      }
    }
  }
  result.inserted = inserted;

  log.info("code-violation sweep complete", { ...result, name: business.name });

  if (inserted > 0 || result.errors.length > 0) {
    await db.activityEntry
      .create({
        data: {
          businessId: business.id,
          type: "workflow",
          title: "Daily Code Violation Sweep",
          detail: `Ingested ${inserted} code-violation records from ${result.candidatesFound} candidates. ${result.duplicatesSkipped} duplicates skipped, ${result.severityFilterSkipped} below severity filter.`,
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
