import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ImportForeclosuresForm } from "@/components/admin/businesses/ImportForeclosuresForm";
import { PageHeader } from "@/components/admin/ui";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type ImportPageProps = { params: { id: string } };

export default async function ImportForeclosuresPage({ params }: ImportPageProps) {
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

  // Pre-foreclosure addon must be enabled for this page to be useful.
  // We still render the page when disabled so the operator sees the
  // gate explanation instead of a 404.
  const cfg = business.config as Record<string, unknown> | null;
  const preCfg = cfg?.preForeclosure as { enabled?: unknown } | undefined;
  const addonEnabled = preCfg?.enabled === true;

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
        eyebrow="Pre-Foreclosure · CSV Import"
        title="Import foreclosure records from CSV"
        description={
          "Upload county-direct exports, paralegal pulls, PropStream foreclosure lists, or any CSV with one foreclosure filing per row. Each row creates a ForeclosureRecord. Outreach is gated separately behind per-state operator attestation (lands in commit 2)."
        }
      />

      {!addonEnabled ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          <strong>Pre-foreclosure addon is not enabled for this business.</strong> Enable the
          addon in business settings before importing. The dashboard surface and per-state
          compliance attestation flow land in a later commit; for now you can flip the
          {" "}<code className="font-mono">Business.config.preForeclosure.enabled</code> flag
          to <code className="font-mono">true</code> via the admin DB tools or wait for the
          surface UI.
        </div>
      ) : (
        <ImportForeclosuresForm businessId={business.id} businessName={business.name} />
      )}
    </div>
  );
}
