import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ForeclosureComplianceManager } from "@/components/admin/businesses/ForeclosureComplianceManager";
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

const ATTESTATION_PHRASE = "I HAVE REVIEWED THE STATE NOTICE";
const GLBA_PHRASE = "I ACCEPT GLBA AND DPPA RESPONSIBILITY";

export default async function ForeclosureCompliancePage({ params }: PageProps) {
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
  const preCfg = cfg?.preForeclosure as
    | { enabled?: unknown; glbaAttestation?: Record<string, unknown> }
    | undefined;
  const addonEnabled = preCfg?.enabled === true;
  const glba = preCfg?.glbaAttestation as
    | { signedAt?: string; signedBy?: string }
    | undefined;

  const attestations = parseAttestations(business.config);
  const states = allForeclosureStateCodes().map((code) => {
    const entry = FORECLOSURE_STATE_COMPLIANCE[code];
    const attestation = attestations[code];
    return {
      state: entry.state,
      fullName: entry.fullName,
      tier: entry.tier,
      regime: entry.regime,
      rescissionDays: entry.rescissionDays,
      rescissionBusinessDays: entry.rescissionBusinessDays ?? false,
      statutoryNotice: entry.statutoryNotice,
      exposureSummary: entry.exposureSummary,
      references: entry.references,
      lastReviewedAt: entry.lastReviewedAt,
      attested: Boolean(attestation?.attestedAt),
      attestedAt: attestation?.attestedAt ?? null,
      attestedBy: attestation?.attestedBy ?? null,
      hasTemplateOverride: Boolean(attestation?.templateOverride?.trim())
    };
  });

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
        eyebrow="Pre-Foreclosure · Compliance"
        title="State attestations + GLBA / DPPA"
        description={
          "Per-state operator attestation for foreclosure outreach (all 50 states + DC, per decision #1). 7 states carry criminal exposure — CA, MD, IL, MN, CO, NY, FL. Counsel-reviewed notice templates can be substituted per state. Skip-trace requires the GLBA / DPPA attestation below."
        }
      />

      {!addonEnabled ? (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          <strong>Pre-foreclosure addon is not enabled for this business.</strong> Attestations
          recorded here only take effect once the addon is enabled. Flip
          {" "}<code className="font-mono">Business.config.preForeclosure.enabled = true</code>{" "}
          via admin DB tools or wait for the addon-management UI in commit 3.
        </div>
      ) : null}

      <ForeclosureComplianceManager
        businessId={business.id}
        businessName={business.name}
        attestationPhrase={ATTESTATION_PHRASE}
        states={states}
        glba={{
          signed: Boolean(glba?.signedAt),
          signedAt: glba?.signedAt ?? null,
          signedBy: glba?.signedBy ?? null,
          attestationPhrase: GLBA_PHRASE
        }}
      />
    </div>
  );
}
