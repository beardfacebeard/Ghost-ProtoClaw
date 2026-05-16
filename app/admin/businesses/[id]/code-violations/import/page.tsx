import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ImportCodeViolationsForm } from "@/components/admin/businesses/ImportCodeViolationsForm";
import { PageHeader } from "@/components/admin/ui";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type ImportPageProps = { params: { id: string } };

export default async function ImportCodeViolationsPage({ params }: ImportPageProps) {
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
  const cvCfg = cfg?.codeViolation as { enabled?: unknown } | undefined;
  const addonEnabled = cvCfg?.enabled === true;

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
        eyebrow="Code Violation · CSV Import"
        title="Import code-violation records from CSV"
        description={
          "Upload city-portal exports, FOIA responses, PropStream lists, or any CSV with one code-violation case per row. Each row creates a CodeViolationRecord, severity-classified at insert. Outreach is gated separately behind Fair Housing audit + State Compliance Review."
        }
      />

      {!addonEnabled ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          <strong>Code-violation addon is not enabled for this business.</strong> Enable the
          addon before importing. The unified distress-leads dashboard (Commit 3) will surface
          the enable flow; for now you can flip{" "}
          <code className="font-mono">Business.config.codeViolation.enabled</code> to{" "}
          <code className="font-mono">true</code> via the admin DB tools.
        </div>
      ) : (
        <ImportCodeViolationsForm
          businessId={business.id}
          businessName={business.name}
        />
      )}
    </div>
  );
}
