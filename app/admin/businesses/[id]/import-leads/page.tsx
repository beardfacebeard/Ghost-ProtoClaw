import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ImportLeadsForm } from "@/components/admin/businesses/ImportLeadsForm";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

type ImportLeadsPageProps = {
  params: { id: string };
};

export default async function ImportLeadsPage({ params }: ImportLeadsPageProps) {
  const session = await requireServerSession();

  if (session.role === "admin" && !session.businessIds.includes(params.id)) {
    notFound();
  }
  if (!session.organizationId) notFound();

  const business = await db.business.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    select: { id: true, name: true }
  });
  if (!business) notFound();

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
        eyebrow="Sourcing · CSV Import"
        title="Import leads from CSV"
        description={
          "Upload a property list exported from PropStream, BatchData, REISIFT, or any tool that exports CSV. The importer auto-detects column names and shapes each row into a Deal, scored by the Distress Signal Analyst at import time."
        }
      />

      <ImportLeadsForm businessId={business.id} businessName={business.name} />
    </div>
  );
}
