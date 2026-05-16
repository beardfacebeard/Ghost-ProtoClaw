import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PreForeclosureFiltersForm } from "@/components/admin/businesses/PreForeclosureFiltersForm";
import { PageHeader } from "@/components/admin/ui";
import {
  allForeclosureStateCodes
} from "@/lib/dealhawk/foreclosure-state-compliance";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

const DOCUMENT_TYPE_OPTIONS = [
  { value: "NOD", label: "Notice of Default (NOD)" },
  { value: "LP", label: "Lis Pendens (LP)" },
  { value: "NOTS", label: "Notice of Trustee Sale (NOTS)" },
  { value: "JF", label: "Judgment of Foreclosure" },
  { value: "NS", label: "Notice of Sale" },
  { value: "TS", label: "Sheriff's Sale" },
  { value: "ASN", label: "Auction Scheduled" }
];

export default async function ForeclosureFiltersPage({ params }: PageProps) {
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
  const pre = cfg?.preForeclosure as Record<string, unknown> | undefined;
  const addonEnabled = pre?.enabled === true;

  const initialFilters = {
    states: Array.isArray(pre?.states) ? (pre?.states as string[]) : [],
    documentTypes: Array.isArray(pre?.documentTypes)
      ? (pre?.documentTypes as string[])
      : ["NOD", "LP"],
    priorityCounties: Array.isArray(pre?.priorityCounties)
      ? (pre?.priorityCounties as string[])
      : [],
    dailyIngestCap:
      typeof pre?.dailyIngestCap === "number" ? (pre?.dailyIngestCap as number) : 200
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/businesses/${business.id}/foreclosures`}
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted transition-colors hover:text-steel-bright"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to {business.name} pre-foreclosure pipeline
      </Link>

      <PageHeader
        eyebrow="Pre-Foreclosure · Filters"
        title="Sourcing filters"
        description={
          "Narrow what the daily sweep ingests: which states, which document types, which priority counties, and the per-sweep hard cap. The state allowlist is a soft filter (records outside it skip ingest); per-state attestations are a separate hard gate on outreach."
        }
      />

      {!addonEnabled ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          <strong>Pre-foreclosure addon is not enabled for this business.</strong> Filters
          recorded here only take effect once the addon is enabled. Enable it from the{" "}
          <Link
            href={`/admin/businesses/${business.id}/foreclosures`}
            className="underline hover:text-white"
          >
            pre-foreclosure dashboard
          </Link>
          .
        </div>
      ) : null}

      <PreForeclosureFiltersForm
        businessId={business.id}
        initialFilters={initialFilters}
        catalogs={{
          allStateCodes: allForeclosureStateCodes(),
          documentTypes: DOCUMENT_TYPE_OPTIONS
        }}
      />
    </div>
  );
}
