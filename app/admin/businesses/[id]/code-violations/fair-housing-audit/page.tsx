import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FairHousingAuditForm } from "@/components/admin/businesses/FairHousingAuditForm";
import { PageHeader } from "@/components/admin/ui";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

const FAIR_HOUSING_PHRASE = "I COMPLETED A FAIR HOUSING DISPARATE IMPACT REVIEW";

export default async function FairHousingAuditPage({ params }: PageProps) {
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
        fairHousingAuditedBy?: string;
        fairHousingAuditNotes?: string;
      }
    | undefined;
  const addonEnabled = cv?.enabled === true;

  const ageDays = cv?.fairHousingAuditedAt
    ? Math.floor(
        (Date.now() - new Date(cv.fairHousingAuditedAt).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    : null;

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
        eyebrow="Code Violation · Fair Housing Audit"
        title="Fair Housing disparate-impact audit"
        description={
          "Quarterly self-attestation that you have reviewed the code-violation lead-selection algorithm + outreach lists for disparate impact. Required by HUD/CFPB algorithmic-targeting guidance (April 2024). Soft warning on every outreach draft when audit is >90 days old. Retained 5 years."
        }
      />

      {!addonEnabled ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          <strong>Code-violation addon is not enabled for this business.</strong> Audits
          recorded here will only take effect once the addon is enabled.
        </div>
      ) : null}

      <FairHousingAuditForm
        businessId={business.id}
        attestationPhrase={FAIR_HOUSING_PHRASE}
        audit={{
          signedAt: cv?.fairHousingAuditedAt ?? null,
          signedBy: cv?.fairHousingAuditedBy ?? null,
          notes: cv?.fairHousingAuditNotes ?? null,
          ageDays,
          stale: ageDays === null || ageDays > 90,
          dueAt: cv?.fairHousingAuditedAt
            ? new Date(
                new Date(cv.fairHousingAuditedAt).getTime() +
                  90 * 24 * 60 * 60 * 1000
              ).toISOString()
            : null
        }}
      />
    </div>
  );
}
