import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CodeViolationDashboard } from "@/components/admin/businesses/CodeViolationDashboard";
import { PageHeader } from "@/components/admin/ui";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function CodeViolationDashboardPage({ params }: PageProps) {
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
  const cv = cfg?.codeViolation as
    | {
        enabled?: unknown;
        fairHousingAuditedAt?: string;
      }
    | undefined;
  const addonEnabled = cv?.enabled === true;

  const pre = cfg?.preForeclosure as
    | { glbaAttestation?: { signedAt?: string } }
    | undefined;
  const glbaSigned = Boolean(pre?.glbaAttestation?.signedAt);

  const fairHousingAuditedAt = cv?.fairHousingAuditedAt ?? null;
  const fairHousingAuditAgeDays = fairHousingAuditedAt
    ? Math.floor(
        (Date.now() - new Date(fairHousingAuditedAt).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    : null;
  const fairHousingAuditStale =
    fairHousingAuditAgeDays === null || fairHousingAuditAgeDays > 90;

  const records = await db.codeViolationRecord.findMany({
    where: { businessId: params.id, deletedAt: null },
    select: {
      id: true,
      propertyAddress: true,
      city: true,
      state: true,
      ownerName: true,
      violationDescription: true,
      severityTier: true,
      status: true,
      filingDate: true,
      scoreSnapshot: true,
      sourceType: true,
      caseNumber: true,
      needsForeclosureRescueReview: true
    },
    orderBy: [
      { severityTier: "asc" },
      { scoreSnapshot: "desc" },
      { filingDate: "desc" }
    ],
    take: 500
  });

  const totalRecordCount = await db.codeViolationRecord.count({
    where: { businessId: params.id, deletedAt: null }
  });

  const recentSweepEvents = await db.logEvent.findMany({
    where: { businessId: params.id, action: "code_violation_sweep" },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  const recentSweeps = recentSweepEvents.map((e) => {
    const md = (e.metadata as Record<string, unknown> | null) ?? {};
    const errors = Array.isArray(md.errors) ? (md.errors as string[]) : [];
    return {
      id: e.id,
      ranAt: e.createdAt.toISOString(),
      level: e.level,
      message: e.message,
      inserted: typeof md.inserted === "number" ? (md.inserted as number) : 0,
      candidates:
        typeof md.candidatesFound === "number"
          ? (md.candidatesFound as number)
          : typeof md.candidates === "number"
            ? (md.candidates as number)
            : 0,
      duplicatesSkipped:
        typeof md.duplicatesSkipped === "number"
          ? (md.duplicatesSkipped as number)
          : 0,
      errors
    };
  });

  const integrationRows = await db.integration.findMany({
    where: {
      organizationId: session.organizationId,
      key: {
        in: [
          "socrata",
          "firecrawl",
          "lob",
          "batch_skip",
          "smarty",
          "propstream",
          "rentcast",
          "realie"
        ]
      }
    },
    select: { key: true, status: true }
  });
  const statusByKey = new Map(integrationRows.map((i) => [i.key, i.status]));
  const integrations = [
    { key: "socrata", name: "Socrata app token (opt)" },
    { key: "firecrawl", name: "Firecrawl (scraping)" },
    { key: "lob", name: "Lob (direct mail)" },
    { key: "batch_skip", name: "BatchSkipTracing" },
    { key: "smarty", name: "Smarty (address)" },
    { key: "propstream", name: "PropStream (CSV)" },
    { key: "rentcast", name: "RentCast (AVM)" },
    { key: "realie", name: "Realie (owner data)" }
  ].map((i) => ({ ...i, connected: statusByKey.get(i.key) === "connected" }));

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/businesses/${business.id}`}
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted transition-colors hover:text-steel-bright"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to {business.name}
      </Link>

      <PageHeader
        eyebrow="Dealhawk · Code Violations"
        title="Code-violation pipeline"
        description={
          "Severity-tiered code-enforcement leads. The daily sweep ingests from 10 Tier-1 cities (Chicago, NYC HPD/DOB, LA, Philly, SF, Detroit, Cincinnati, Columbus, Baltimore County) + any operator-added city via Socrata/ArcGIS auto-discovery + CSV upload. Outreach is gated behind Fair Housing audit + State Compliance Review's Fair Housing forbidden-pattern filter."
        }
      />

      <CodeViolationDashboard
        businessId={business.id}
        businessName={business.name}
        addonEnabled={addonEnabled}
        records={records.map((r) => ({
          ...r,
          filingDate: r.filingDate.toISOString()
        }))}
        totalRecordCount={totalRecordCount}
        compliance={{
          glbaSigned,
          fairHousingAuditedAt,
          fairHousingAuditAgeDays,
          fairHousingAuditStale
        }}
        integrations={integrations}
        recentSweeps={recentSweeps}
      />
    </div>
  );
}
