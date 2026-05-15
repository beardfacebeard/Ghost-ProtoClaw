import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SourcingBuyBoxForm } from "@/components/admin/businesses/SourcingBuyBoxForm";
import { PageHeader } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

type SourcingPageProps = {
  params: { id: string };
};

export default async function SourcingPage({ params }: SourcingPageProps) {
  const session = await requireServerSession();

  if (session.role === "admin" && !session.businessIds.includes(params.id)) {
    notFound();
  }
  if (!session.organizationId) notFound();

  const business = await db.business.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    select: { id: true, name: true, sourcingBuyBox: true }
  });
  if (!business) notFound();

  // Provider connection status — show the operator which property
  // providers they have keys for so they understand which capabilities
  // will activate when the sweep runs.
  const integrations = await db.integration.findMany({
    where: {
      organizationId: session.organizationId,
      key: { in: ["rentcast", "axesso_zillow", "realie"] }
    },
    select: { key: true, status: true }
  });
  const connectedKeys = new Set(
    integrations.filter((i) => i.status === "connected").map((i) => i.key)
  );

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
        eyebrow="Sourcing · Daily Sweep"
        title="Sourcing buy-box"
        description={
          "Define what fresh leads the Daily Lead Sourcing Sweep should pull each morning. Markets, price range, property types, and distress signals to prioritize. The sweep dedupes against your existing pipeline before ingesting."
        }
      />

      <SourcingBuyBoxForm
        businessId={business.id}
        initialBuyBox={
          (business.sourcingBuyBox as Record<string, unknown> | null) ?? null
        }
        providers={{
          rentcast: connectedKeys.has("rentcast"),
          axesso_zillow: connectedKeys.has("axesso_zillow"),
          realie: connectedKeys.has("realie")
        }}
      />
    </div>
  );
}
