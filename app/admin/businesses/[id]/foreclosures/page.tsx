import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ForeclosureDashboard } from "@/components/admin/businesses/ForeclosureDashboard";
import { PageHeader } from "@/components/admin/ui";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import {
  FORECLOSURE_STATE_COMPLIANCE,
  allForeclosureStateCodes,
  parseAttestations
} from "@/lib/dealhawk/foreclosure-state-compliance";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function ForeclosureDashboardPage({ params }: PageProps) {
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
  const preCfg = cfg?.preForeclosure as Record<string, unknown> | undefined;
  const addonEnabled = preCfg?.enabled === true;
  const glba = preCfg?.glbaAttestation as { signedAt?: string } | undefined;

  // Pull recent foreclosure records — last 500 within 90 days OR with
  // an upcoming auction. Big enough to drive the dashboard's
  // "auction imminent" view; pagination lands in a follow-up.
  const records = await db.foreclosureRecord.findMany({
    where: {
      businessId: params.id,
      deletedAt: null
    },
    select: {
      id: true,
      propertyAddress: true,
      state: true,
      county: true,
      ownerName: true,
      foreclosureStage: true,
      documentType: true,
      filingDate: true,
      auctionDate: true,
      scoreSnapshot: true,
      enrichmentStatus: true,
      sourceType: true,
      caseNumber: true,
      lenderName: true,
      reinstatementAmount: true
    },
    orderBy: [{ auctionDate: "asc" }, { scoreSnapshot: "desc" }],
    take: 500
  });

  const totalRecordCount = await db.foreclosureRecord.count({
    where: { businessId: params.id, deletedAt: null }
  });

  // Compliance summary.
  const attestations = parseAttestations(business.config);
  const allCodes = allForeclosureStateCodes();
  const attestedStates = allCodes.filter((c) => Boolean(attestations[c]?.attestedAt)).length;
  const criminalCodes = allCodes.filter(
    (c) => FORECLOSURE_STATE_COMPLIANCE[c].tier === "criminal_exposure"
  );
  const criminalAttested = criminalCodes.filter(
    (c) => Boolean(attestations[c]?.attestedAt)
  ).length;

  // Integration status — the 8 most-relevant for this addon.
  const integrationRows = await db.integration.findMany({
    where: {
      organizationId: session.organizationId,
      key: {
        in: [
          "attom",
          "browserbase",
          "apify",
          "firecrawl",
          "lob",
          "batch_skip",
          "smarty",
          "rentcast"
        ]
      }
    },
    select: { key: true, status: true }
  });
  const statusByKey = new Map(integrationRows.map((i) => [i.key, i.status]));
  const integrations = [
    { key: "attom", name: "ATTOM Foreclosure Feed" },
    { key: "lob", name: "Lob (direct mail)" },
    { key: "batch_skip", name: "BatchSkipTracing" },
    { key: "smarty", name: "Smarty (address)" },
    { key: "browserbase", name: "Browserbase" },
    { key: "apify", name: "Apify" },
    { key: "firecrawl", name: "Firecrawl" },
    { key: "rentcast", name: "RentCast (AVM)" }
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
        eyebrow="Dealhawk · Pre-Foreclosure"
        title="Pre-foreclosure pipeline"
        description={
          "Auction-imminent leads, compliance readiness, and integration status. The daily sweep ingests from ATTOM (when wired) + county-direct (commit-2 follow-up) + CSV upload. Outreach is gated behind per-state attestation + GLBA attestation."
        }
      />

      <ForeclosureDashboard
        businessId={business.id}
        businessName={business.name}
        addonEnabled={addonEnabled}
        records={records.map((r) => ({
          ...r,
          filingDate: r.filingDate.toISOString(),
          auctionDate: r.auctionDate ? r.auctionDate.toISOString() : null,
          reinstatementAmount: r.reinstatementAmount
            ? r.reinstatementAmount.toString()
            : null
        }))}
        totalRecordCount={totalRecordCount}
        compliance={{
          totalStates: allCodes.length,
          attestedStates,
          criminalAttested,
          criminalTotal: criminalCodes.length,
          glbaSigned: Boolean(glba?.signedAt)
        }}
        integrations={integrations}
      />
    </div>
  );
}
