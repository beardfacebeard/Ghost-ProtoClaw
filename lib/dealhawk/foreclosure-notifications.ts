/**
 * Dealhawk Pre-Foreclosure — auction-imminent notifications.
 *
 * Per decision #12: fire Telegram + Email when score >= 75 AND auction
 * < 30 days. Idempotent — uses ForeclosureRecord.auctionAlertedAt as the
 * already-fired flag. Co-runs with the daily sweep so the operator gets
 * one consolidated batch of imminent-auction pings in the morning.
 */

import { db } from "@/lib/db";
import { notifyOperator } from "@/lib/alerts/dispatcher";
import { getLogger } from "@/lib/observability/logger";

const log = getLogger("foreclosure-notifications");

const SCORE_THRESHOLD = 75;
const AUCTION_WINDOW_DAYS = 30;

export type AuctionAlertResult = {
  businessId: string;
  candidatesFound: number;
  alerted: number;
  errors: string[];
};

/**
 * Find records that crossed both thresholds (scoreSnapshot >= 75 AND
 * auctionDate within 30 days) AND haven't been alerted yet. Fire one
 * Telegram + Email per qualifying record. Stamp auctionAlertedAt on
 * success so subsequent ticks skip.
 */
export async function runAuctionImminentAlerts(
  businessId: string
): Promise<AuctionAlertResult> {
  const result: AuctionAlertResult = {
    businessId,
    candidatesFound: 0,
    alerted: 0,
    errors: []
  };

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      config: true,
      globalPaused: true
    }
  });
  if (!business || business.globalPaused) return result;

  // Gate on the addon being enabled. Defensive — the scheduler caller
  // already checks this but a programmatic re-entry could skip.
  const cfg = business.config as Record<string, unknown> | null;
  const preCfg = cfg?.preForeclosure as { enabled?: unknown } | undefined;
  if (preCfg?.enabled !== true) return result;

  const windowEnd = new Date(Date.now() + AUCTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const candidates = await db.foreclosureRecord.findMany({
    where: {
      businessId,
      deletedAt: null,
      auctionAlertedAt: null,
      auctionDate: { gte: now, lte: windowEnd },
      scoreSnapshot: { gte: SCORE_THRESHOLD }
    },
    select: {
      id: true,
      propertyAddress: true,
      state: true,
      county: true,
      ownerName: true,
      foreclosureStage: true,
      auctionDate: true,
      scoreSnapshot: true,
      lenderName: true,
      caseNumber: true
    },
    orderBy: [{ auctionDate: "asc" }],
    take: 20 // hard cap per business per day so a sudden ingest spike
    //          doesn't fire 100 pings simultaneously
  });

  result.candidatesFound = candidates.length;
  if (candidates.length === 0) return result;

  for (const record of candidates) {
    const days = record.auctionDate
      ? Math.ceil((record.auctionDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;
    try {
      await notifyOperator({
        organizationId: business.organizationId,
        source: "foreclosure-auction-imminent",
        // Per-record dedup key (belt + suspenders alongside the DB flag).
        key: `auction:${record.id}`,
        severity: "high",
        // decision #12 explicitly requires BOTH Telegram + Email even
        // though the dispatcher's "high" default is Telegram-only.
        channels: ["telegram", "email"],
        title: `Auction in ${days}d — ${record.propertyAddress}`,
        message: [
          `${business.name} foreclosure pipeline: a high-score lead has an auction inside the 30-day window.`,
          ``,
          `Property: ${record.propertyAddress} (${record.county}, ${record.state})`,
          `Owner: ${record.ownerName}`,
          `Stage: ${record.foreclosureStage}`,
          `Auction date: ${record.auctionDate?.toISOString().slice(0, 10) ?? "n/a"} (${days} days)`,
          `Score: ${record.scoreSnapshot}/100`,
          record.lenderName ? `Lender: ${record.lenderName}` : "",
          record.caseNumber ? `Case #: ${record.caseNumber}` : "",
          ``,
          `Decide whether to act. The Outreach Prep Agent can draft a compliant first-touch mailer — every draft routes through the State Compliance Review Agent + your /admin/approvals queue before firing.`
        ]
          .filter(Boolean)
          .join("\n"),
        context: {
          businessId,
          foreclosureRecordId: record.id,
          state: record.state,
          score: record.scoreSnapshot,
          auctionDays: days
        }
      });

      await db.foreclosureRecord.update({
        where: { id: record.id },
        data: { auctionAlertedAt: new Date() }
      });
      result.alerted++;
    } catch (err) {
      result.errors.push(
        `record ${record.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  log.info("auction-imminent alerts ran", {
    businessId,
    name: business.name,
    candidatesFound: result.candidatesFound,
    alerted: result.alerted,
    errorCount: result.errors.length
  });

  return result;
}

// ── Daily Deal Digest extension ────────────────────────────────────
// Returns a structured summary of the top auction-imminent leads
// suitable for inclusion in the existing Daily Deal Digest workflow
// output. Co-runs with the digest generation — the Deal Ops Lead can
// call this via an agent tool or the digest renderer can pull it
// directly. Pulls the same data the dashboard renders but pre-aggregates
// for a digest format.

export type AuctionCountdownDigest = {
  businessId: string;
  generatedAt: string;
  totalAuctionsInWindow: number;
  byBand: {
    next7Days: number;
    next30Days: number;
    next90Days: number;
  };
  topLeads: Array<{
    id: string;
    propertyAddress: string;
    state: string;
    county: string;
    ownerName: string;
    foreclosureStage: string;
    auctionDate: string | null;
    daysUntilAuction: number | null;
    score: number | null;
    lenderName: string | null;
    caseNumber: string | null;
  }>;
};

/**
 * Build the auction-countdown digest section for one business. Pulls
 * up to 10 highest-score auction-imminent leads (<90 days) ordered by
 * auction date asc. Returns null when there's nothing to show so the
 * digest renderer can skip the section cleanly.
 */
export async function getAuctionCountdownDigest(
  businessId: string
): Promise<AuctionCountdownDigest | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, config: true }
  });
  if (!business) return null;
  const cfg = business.config as Record<string, unknown> | null;
  const pre = cfg?.preForeclosure as { enabled?: unknown } | undefined;
  if (pre?.enabled !== true) return null;

  const now = new Date();
  const windowEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const candidates = await db.foreclosureRecord.findMany({
    where: {
      businessId,
      deletedAt: null,
      auctionDate: { gte: now, lte: windowEnd }
    },
    select: {
      id: true,
      propertyAddress: true,
      state: true,
      county: true,
      ownerName: true,
      foreclosureStage: true,
      auctionDate: true,
      scoreSnapshot: true,
      lenderName: true,
      caseNumber: true
    },
    orderBy: [{ scoreSnapshot: "desc" }, { auctionDate: "asc" }],
    take: 30
  });

  if (candidates.length === 0) return null;

  let next7 = 0;
  let next30 = 0;
  let next90 = 0;
  for (const r of candidates) {
    if (!r.auctionDate) continue;
    const days = Math.ceil((r.auctionDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days <= 7) next7++;
    if (days <= 30) next30++;
    if (days <= 90) next90++;
  }

  return {
    businessId,
    generatedAt: new Date().toISOString(),
    totalAuctionsInWindow: candidates.length,
    byBand: { next7Days: next7, next30Days: next30, next90Days: next90 },
    topLeads: candidates.slice(0, 10).map((r) => ({
      id: r.id,
      propertyAddress: r.propertyAddress,
      state: r.state,
      county: r.county,
      ownerName: r.ownerName,
      foreclosureStage: r.foreclosureStage,
      auctionDate: r.auctionDate ? r.auctionDate.toISOString() : null,
      daysUntilAuction: r.auctionDate
        ? Math.ceil((r.auctionDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null,
      score: r.scoreSnapshot,
      lenderName: r.lenderName,
      caseNumber: r.caseNumber
    }))
  };
}

/**
 * Render the digest section as plain-text suitable for the Daily Deal
 * Digest workflow output (which the Deal Ops Lead summarizes for the
 * operator's morning briefing).
 */
export function renderAuctionCountdownDigest(
  digest: AuctionCountdownDigest | null
): string {
  if (!digest || digest.totalAuctionsInWindow === 0) {
    return "── PRE-FORECLOSURE AUCTION COUNTDOWN ──\nNo auctions in the 90-day window.";
  }
  const lines = [
    `── PRE-FORECLOSURE AUCTION COUNTDOWN (${digest.totalAuctionsInWindow} in 90d window) ──`,
    `  Next 7 days: ${digest.byBand.next7Days}  ·  Next 30 days: ${digest.byBand.next30Days}  ·  Next 90 days: ${digest.byBand.next90Days}`,
    "",
    "Top 10 by score:"
  ];
  for (const lead of digest.topLeads) {
    lines.push(
      `  · ${lead.daysUntilAuction ?? "?"}d  score ${lead.score ?? "—"}  ${lead.propertyAddress} (${lead.county}, ${lead.state})  owner: ${lead.ownerName}  stage: ${lead.foreclosureStage}`
    );
  }
  return lines.join("\n");
}
