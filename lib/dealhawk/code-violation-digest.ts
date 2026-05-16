/**
 * Daily Deal Digest extension — code-violation tier-1 leads added today.
 *
 * Mirrors lib/dealhawk/foreclosure-notifications.ts getAuctionCountdownDigest
 * for the code-violation side. Returns a structured summary the Deal Ops
 * Lead can include in the morning briefing, and a plain-text renderer
 * for the digest output.
 */

import { db } from "@/lib/db";

export type CodeViolationDigest = {
  businessId: string;
  generatedAt: string;
  newToday: number;
  tier1Today: number;
  tier1Pending: number;
  topLeads: Array<{
    id: string;
    propertyAddress: string;
    city: string;
    state: string;
    ownerName: string | null;
    severityTier: number;
    score: number | null;
    violationDescription: string;
    needsForeclosureRescueReview: boolean;
  }>;
};

/**
 * Build the digest section for one business. Returns null when the
 * code-violation addon is disabled OR there's nothing to surface, so
 * the digest renderer can skip the section cleanly.
 */
export async function getCodeViolationDigest(
  businessId: string
): Promise<CodeViolationDigest | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, config: true }
  });
  if (!business) return null;
  const cfg = business.config as Record<string, unknown> | null;
  const cv = cfg?.codeViolation as { enabled?: unknown } | undefined;
  if (cv?.enabled !== true) return null;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newToday, tier1Today, tier1Pending, topLeads] = await Promise.all([
    db.codeViolationRecord.count({
      where: {
        businessId,
        deletedAt: null,
        createdAt: { gte: oneDayAgo }
      }
    }),
    db.codeViolationRecord.count({
      where: {
        businessId,
        deletedAt: null,
        severityTier: 1,
        createdAt: { gte: oneDayAgo }
      }
    }),
    db.codeViolationRecord.count({
      where: {
        businessId,
        deletedAt: null,
        severityTier: 1,
        status: { in: ["open", "scheduled_hearing", "condemned"] }
      }
    }),
    db.codeViolationRecord.findMany({
      where: {
        businessId,
        deletedAt: null,
        severityTier: { lte: 2 }
      },
      orderBy: [{ severityTier: "asc" }, { scoreSnapshot: "desc" }],
      take: 10,
      select: {
        id: true,
        propertyAddress: true,
        city: true,
        state: true,
        ownerName: true,
        severityTier: true,
        scoreSnapshot: true,
        violationDescription: true,
        needsForeclosureRescueReview: true
      }
    })
  ]);

  if (newToday === 0 && tier1Pending === 0) return null;

  return {
    businessId,
    generatedAt: new Date().toISOString(),
    newToday,
    tier1Today,
    tier1Pending,
    topLeads: topLeads.map((l) => ({
      id: l.id,
      propertyAddress: l.propertyAddress,
      city: l.city,
      state: l.state,
      ownerName: l.ownerName,
      severityTier: l.severityTier,
      score: l.scoreSnapshot,
      violationDescription: l.violationDescription,
      needsForeclosureRescueReview: l.needsForeclosureRescueReview
    }))
  };
}

/**
 * Plain-text rendering for the Daily Deal Digest workflow.
 */
export function renderCodeViolationDigest(
  digest: CodeViolationDigest | null
): string {
  if (!digest) {
    return "── CODE-VIOLATION DISTRESS LEADS ──\nNo new code-violation leads in the last 24h.";
  }
  const lines = [
    `── CODE-VIOLATION DISTRESS LEADS (${digest.newToday} added today, ${digest.tier1Today} tier-1) ──`,
    `  Tier-1 open cases pending action: ${digest.tier1Pending}`,
    "",
    "Top tier-1 + tier-2 leads:"
  ];
  for (const lead of digest.topLeads) {
    const mdFlag = lead.needsForeclosureRescueReview ? " [MD-PHIFA-REVIEW]" : "";
    lines.push(
      `  · T${lead.severityTier} · score ${lead.score ?? "—"} · ${lead.propertyAddress} (${lead.city}, ${lead.state})${mdFlag}`
    );
    lines.push(
      `      ${lead.violationDescription.slice(0, 100)}${lead.violationDescription.length > 100 ? "…" : ""}`
    );
    if (lead.ownerName) lines.push(`      owner: ${lead.ownerName}`);
  }
  return lines.join("\n");
}
