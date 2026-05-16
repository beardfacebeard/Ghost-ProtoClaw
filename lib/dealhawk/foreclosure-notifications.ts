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
