import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CodeViolationFiltersForm } from "@/components/admin/businesses/CodeViolationFiltersForm";
import { PageHeader } from "@/components/admin/ui";
import { listScraperSummaries } from "@/lib/dealhawk/code-scrapers/registry";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

export default async function CodeViolationFiltersPage({ params }: PageProps) {
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
  const cv = cfg?.codeViolation as Record<string, unknown> | undefined;
  const addonEnabled = cv?.enabled === true;

  const initialFilters = {
    cities: Array.isArray(cv?.cities) ? (cv?.cities as string[]) : [],
    severityFilter: Array.isArray(cv?.severityFilter)
      ? (cv?.severityFilter as number[])
      : [1, 2, 3],
    dailyIngestCap:
      typeof cv?.dailyIngestCap === "number"
        ? (cv?.dailyIngestCap as number)
        : 500
  };

  const tier1Cities = listScraperSummaries().flatMap((s) =>
    s.cities.flatMap((city) =>
      s.states.map((state) => ({
        value: `${city}, ${state}`,
        label: `${city}, ${state}`,
        scraperId: s.id,
        scraperLabel: s.label
      }))
    )
  );

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/businesses/${business.id}/code-violations`}
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted transition-colors hover:text-steel-bright"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to {business.name} code-violation pipeline
      </Link>

      <PageHeader
        eyebrow="Code Violations · Filters"
        title="Sourcing filters"
        description={
          "Narrow what the daily sweep ingests: which Tier-1 cities, which severity tiers, and the per-sweep hard cap. The city allowlist is a soft filter (Tier-2 customAdapters always run). Severity is enforced before the record is written."
        }
      />

      {!addonEnabled ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          <strong>Code-violation addon is not enabled for this business.</strong>{" "}
          Filters recorded here only take effect once the addon is enabled.
          Enable it from the{" "}
          <Link
            href={`/admin/businesses/${business.id}/code-violations`}
            className="underline hover:text-white"
          >
            code-violation dashboard
          </Link>
          .
        </div>
      ) : null}

      <CodeViolationFiltersForm
        businessId={business.id}
        initialFilters={initialFilters}
        catalogs={{
          tier1Cities,
          severityTiers: [
            { value: 1, label: "Tier 1 — Extreme (condemned, demolition ordered)" },
            { value: 2, label: "Tier 2 — Strong (unsafe, vacant, scheduled hearing)" },
            { value: 3, label: "Tier 3 — Moderate (open violation w/ fine)" },
            { value: 4, label: "Tier 4 — Low (minor, often noise — skip by default)" }
          ]
        }}
      />
    </div>
  );
}
