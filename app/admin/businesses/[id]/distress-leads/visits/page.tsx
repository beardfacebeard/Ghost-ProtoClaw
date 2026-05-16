import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FieldVisitManager } from "@/components/admin/businesses/FieldVisitManager";
import { PageHeader } from "@/components/admin/ui";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

const TIER_LABEL: Record<number, string> = {
  1: "Extreme",
  2: "Strong",
  3: "Moderate",
  4: "Low"
};

export default async function FieldVisitsPage({ params }: PageProps) {
  const session = await requireServerSession();
  if (session.role === "admin" && !session.businessIds.includes(params.id)) {
    notFound();
  }
  if (!session.organizationId) notFound();

  const business = await db.business.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    select: { id: true, name: true, config: true }
  });
  if (!business) notFound();

  const cfg = business.config as Record<string, unknown> | null;
  const fcEnabled =
    (cfg?.preForeclosure as { enabled?: unknown } | undefined)?.enabled === true;
  const cvEnabled =
    (cfg?.codeViolation as { enabled?: unknown } | undefined)?.enabled === true;

  // Pull top-50 high-score candidates that haven't been visited
  // recently (last 30 days). Cross-module list, sorted by score.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const visitedRecordIds = await db.fieldVisitNote.findMany({
    where: { businessId: params.id, visitedAt: { gte: thirtyDaysAgo } },
    select: {
      codeViolationRecordId: true,
      foreclosureRecordId: true
    }
  });
  const visitedFcIds = new Set(
    visitedRecordIds
      .map((v) => v.foreclosureRecordId)
      .filter((id): id is string => Boolean(id))
  );
  const visitedCvIds = new Set(
    visitedRecordIds
      .map((v) => v.codeViolationRecordId)
      .filter((id): id is string => Boolean(id))
  );

  const candidates: Array<{
    id: string;
    module: "pre_foreclosure" | "code_violation";
    propertyAddress: string;
    city: string | null;
    state: string;
    ownerName: string | null;
    signalLabel: string;
    scoreSnapshot: number | null;
  }> = [];

  if (fcEnabled) {
    const fcRecords = await db.foreclosureRecord.findMany({
      where: {
        businessId: params.id,
        deletedAt: null,
        // Skip placeholder-address rows — they'd render as broken Google
        // Maps URLs when the operator clicks "open route".
        enrichmentStatus: { not: "needs_address" },
        ...(visitedFcIds.size > 0 ? { id: { notIn: Array.from(visitedFcIds) } } : {})
      },
      orderBy: [{ scoreSnapshot: "desc" }, { auctionDate: "asc" }],
      take: 30,
      select: {
        id: true,
        propertyAddress: true,
        state: true,
        county: true,
        ownerName: true,
        foreclosureStage: true,
        scoreSnapshot: true
      }
    });
    for (const r of fcRecords) {
      candidates.push({
        id: r.id,
        module: "pre_foreclosure",
        propertyAddress: r.propertyAddress,
        city: r.county,
        state: r.state,
        ownerName: r.ownerName,
        signalLabel: r.foreclosureStage.replace(/_/g, " "),
        scoreSnapshot: r.scoreSnapshot
      });
    }
  }

  if (cvEnabled) {
    const cvRecords = await db.codeViolationRecord.findMany({
      where: {
        businessId: params.id,
        deletedAt: null,
        // Skip placeholder-address rows — see foreclosure branch.
        enrichmentStatus: { not: "needs_address" },
        ...(visitedCvIds.size > 0 ? { id: { notIn: Array.from(visitedCvIds) } } : {})
      },
      orderBy: [{ severityTier: "asc" }, { scoreSnapshot: "desc" }],
      take: 30,
      select: {
        id: true,
        propertyAddress: true,
        state: true,
        city: true,
        ownerName: true,
        severityTier: true,
        scoreSnapshot: true
      }
    });
    for (const r of cvRecords) {
      candidates.push({
        id: r.id,
        module: "code_violation",
        propertyAddress: r.propertyAddress,
        city: r.city,
        state: r.state,
        ownerName: r.ownerName,
        signalLabel: `Tier ${r.severityTier} ${TIER_LABEL[r.severityTier]}`,
        scoreSnapshot: r.scoreSnapshot
      });
    }
  }

  // Sort cross-module by score desc and trim to 50.
  candidates.sort(
    (a, b) => (b.scoreSnapshot ?? -1) - (a.scoreSnapshot ?? -1)
  );
  const topCandidates = candidates.slice(0, 50);

  // Recent visits.
  const recentVisitRows = await db.fieldVisitNote.findMany({
    where: { businessId: params.id, deletedAt: null },
    orderBy: { visitedAt: "desc" },
    take: 30,
    include: {
      codeViolationRecord: { select: { propertyAddress: true } },
      foreclosureRecord: { select: { propertyAddress: true } }
    }
  });
  const recentVisits = recentVisitRows.map((v) => ({
    id: v.id,
    visitedAt: v.visitedAt.toISOString(),
    outcome: v.outcome,
    sourceModule: v.sourceModule,
    propertyAddress:
      v.codeViolationRecord?.propertyAddress ??
      v.foreclosureRecord?.propertyAddress ??
      "(no record)",
    signageObserved: Array.isArray(v.signageObserved)
      ? (v.signageObserved as unknown as string[])
      : [],
    notes: v.notes
  }));

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/businesses/${business.id}/distress-leads`}
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted transition-colors hover:text-steel-bright"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to distress leads dashboard
      </Link>

      <PageHeader
        eyebrow="Distress Leads · Field Visits"
        title="Field-visit module"
        description={
          "Pick up to 10 properties, build a Google Maps route, drive by, log observations. Visits are auto-suppressed for 30 days after a visit so you don't re-visit the same property. Shared between pre_foreclosure and code_violation modules — sourceModule tracks which one produced each candidate."
        }
      />

      <FieldVisitManager
        businessId={business.id}
        candidates={topCandidates}
        recentVisits={recentVisits}
      />
    </div>
  );
}
