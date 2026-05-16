/**
 * Pre-foreclosure first-enable walkthrough.
 *
 * 8-step checklist that takes a new operator from zero to a working
 * pipeline. Each step is a card with: status badge, what it does,
 * deep link to fix. Server-rendered (no client state) — every refresh
 * picks up the live status from the DB.
 *
 * Persona-7 expansion: written for "existing Dealhawk operator OR
 * new investor onboarding" — assumes baseline REI literacy but spells
 * out the compliance gates carefully.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  XCircle
} from "lucide-react";

import { PageHeader } from "@/components/admin/ui";
import {
  FORECLOSURE_STATE_COMPLIANCE,
  allForeclosureStateCodes,
  parseAttestations
} from "@/lib/dealhawk/foreclosure-state-compliance";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

type Status = "done" | "pending" | "warning";

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === "warning") return <AlertTriangle className="h-5 w-5 text-yellow-300" />;
  return <Circle className="h-5 w-5 text-ink-muted" />;
}

export default async function ForeclosureSetupPage({ params }: PageProps) {
  const session = await requireServerSession();
  if (session.role === "admin" && !session.businessIds.includes(params.id)) {
    notFound();
  }
  if (!session.organizationId) notFound();

  const business = await db.business.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    select: {
      id: true,
      name: true,
      config: true,
      dealMode: true,
      tcpaAttestedAt: true
    }
  });
  if (!business) notFound();

  const cfg = business.config as Record<string, unknown> | null;
  const templateId = typeof cfg?.templateId === "string" ? (cfg.templateId as string) : null;
  const pre = cfg?.preForeclosure as Record<string, unknown> | undefined;
  const addonEnabled = pre?.enabled === true;
  const glba = pre?.glbaAttestation as { signedAt?: string } | undefined;
  const filters = {
    states: Array.isArray(pre?.states) ? (pre?.states as string[]) : [],
    documentTypes: Array.isArray(pre?.documentTypes)
      ? (pre?.documentTypes as string[])
      : ["NOD", "LP"]
  };

  // Compliance summary.
  const attestations = parseAttestations(business.config);
  const allCodes = allForeclosureStateCodes();
  const criminalCodes = allCodes.filter(
    (c) => FORECLOSURE_STATE_COMPLIANCE[c].tier === "criminal_exposure"
  );
  const attestedCriminalCount = criminalCodes.filter((c) => Boolean(attestations[c]?.attestedAt))
    .length;
  const totalAttested = allCodes.filter((c) => Boolean(attestations[c]?.attestedAt)).length;

  // Integration status — the 4 most-load-bearing for a new operator.
  const integrations = await db.integration.findMany({
    where: {
      organizationId: session.organizationId,
      key: { in: ["attom", "lob", "batch_skip", "smarty", "twilio", "dnc_scrub"] }
    },
    select: { key: true, status: true }
  });
  const intMap = new Map(integrations.map((i) => [i.key, i.status]));
  const integrationsConnected = (key: string) => intMap.get(key) === "connected";

  // Record count — proxy for "first sweep ran".
  const recordCount = addonEnabled
    ? await db.foreclosureRecord.count({ where: { businessId: business.id, deletedAt: null } })
    : 0;

  const steps: Array<{
    n: number;
    title: string;
    blurb: string;
    status: Status;
    statusLabel: string;
    cta?: { href: string; label: string };
  }> = [
    {
      n: 1,
      title: "Templated from Dealhawk Empire",
      blurb:
        "The pre-foreclosure addon only works on businesses materialized from the Dealhawk Empire template. If you started from another template, you'll need to re-materialize this business.",
      status: templateId === "dealhawk_empire" ? "done" : "warning",
      statusLabel:
        templateId === "dealhawk_empire" ? "Dealhawk template confirmed" : `Template is "${templateId ?? "unknown"}"`,
      cta:
        templateId === "dealhawk_empire"
          ? undefined
          : { href: `/admin/businesses/${business.id}/edit`, label: "Edit business" }
    },
    {
      n: 2,
      title: "Enable the addon",
      blurb:
        "Flips Business.config.preForeclosure.enabled. Activates the daily sweep + the addon's 6 agents. Reversible — disabling preserves attestations + filters in place.",
      status: addonEnabled ? "done" : "pending",
      statusLabel: addonEnabled ? "Addon enabled" : "Addon not enabled yet",
      cta: { href: `/admin/businesses/${business.id}/foreclosures`, label: "Open dashboard" }
    },
    {
      n: 3,
      title: "Sign the GLBA / DPPA attestation",
      blurb:
        "Required before any skip-trace fires. Records your acknowledgment that you understand the permissible-purpose framework and will record a valid purposeCode on every query. Stays optional until you actually want skip-trace; only blocks the Skip Trace Agent.",
      status: glba?.signedAt ? "done" : "pending",
      statusLabel: glba?.signedAt ? `Signed ${new Date(glba.signedAt).toLocaleDateString()}` : "Not signed",
      cta: {
        href: `/admin/businesses/${business.id}/foreclosures/compliance`,
        label: "Sign GLBA"
      }
    },
    {
      n: 4,
      title: "Attest for each state you'll operate in",
      blurb:
        "Per-state attestations gate outreach. The 7 criminal-exposure states (CA, MD, IL, MN, CO, NY, FL) carry felony liability for non-compliant foreclosure outreach — verify the ship-default statutory notice (or paste your counsel-reviewed override) before signing each.",
      status:
        totalAttested === allCodes.length
          ? "done"
          : attestedCriminalCount === criminalCodes.length
            ? "done"
            : totalAttested > 0
              ? "warning"
              : "pending",
      statusLabel: `${totalAttested}/${allCodes.length} states attested · ${attestedCriminalCount}/${criminalCodes.length} criminal-exposure states`,
      cta: {
        href: `/admin/businesses/${business.id}/foreclosures/compliance`,
        label: "Attest states"
      }
    },
    {
      n: 5,
      title: "Wire your data source",
      blurb:
        "ATTOM (~$1-2k/mo) is the canonical national pre-foreclosure feed and the lowest-friction path. Without ATTOM, the sweep runs in CSV-upload-only mode. Direct county scraping is a follow-up commit — your operators can use CSV today.",
      status: integrationsConnected("attom") ? "done" : "warning",
      statusLabel: integrationsConnected("attom")
        ? "ATTOM connected"
        : "ATTOM not connected (CSV-only sweep)",
      cta: { href: `/admin/integrations`, label: "Wire integrations" }
    },
    {
      n: 6,
      title: "Wire skip-trace + address + DNC vendors",
      blurb:
        "BatchSkipTracing (~$0.15/record), Smarty (free tier OK), Twilio Lookup (~$0.005/call), and RealPhoneValidation (DNC + reassigned). The Skip Trace Agent runs Smarty → BatchSkip → Twilio Lookup → DNC scrub for every owner. Required only when you want skip-trace; outreach via direct mail doesn't need any of these.",
      status:
        integrationsConnected("batch_skip") &&
        integrationsConnected("smarty") &&
        integrationsConnected("twilio")
          ? "done"
          : integrationsConnected("batch_skip") ||
              integrationsConnected("smarty") ||
              integrationsConnected("twilio")
            ? "warning"
            : "pending",
      statusLabel:
        [
          integrationsConnected("batch_skip") ? "BatchSkip" : null,
          integrationsConnected("smarty") ? "Smarty" : null,
          integrationsConnected("twilio") ? "Twilio" : null,
          integrationsConnected("dnc_scrub") ? "DNC" : null
        ]
          .filter(Boolean)
          .join(" · ") || "None wired",
      cta: { href: `/admin/integrations`, label: "Wire integrations" }
    },
    {
      n: 7,
      title: "Wire Lob for direct mail",
      blurb:
        "Direct mail is the recommended primary outreach channel — TCPA-exempt, highest-response on distressed-homeowner audiences (~$0.85/postcard, ~$1.20/letter). Lob takes ~10 minutes: sign up, verify a return address, paste the Live API key. Drafts queue in /admin/approvals; firing requires operator approval (always — even on businesses with autoApproveExternalActions on).",
      status: integrationsConnected("lob") ? "done" : "pending",
      statusLabel: integrationsConnected("lob") ? "Lob connected" : "Not connected",
      cta: { href: `/admin/integrations`, label: "Wire Lob" }
    },
    {
      n: 8,
      title: "Configure sourcing filters",
      blurb:
        "Narrow the sweep to states you operate in + the document types you want. NOD + Lis Pendens (LP) is the default early-stage set. Daily ingest cap defaults to 200 — bump it up only after the first few sweeps look right.",
      status: filters.states.length > 0 ? "done" : "pending",
      statusLabel:
        filters.states.length > 0
          ? `${filters.states.length} states · ${filters.documentTypes.length} doc types`
          : "No state allowlist set (sweep ingests all states)",
      cta: {
        href: `/admin/businesses/${business.id}/foreclosures/filters`,
        label: "Configure filters"
      }
    }
  ];

  const completed = steps.filter((s) => s.status === "done").length;

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
        eyebrow="Pre-Foreclosure · Setup walkthrough"
        title={`Setup — ${completed}/${steps.length} steps complete`}
        description={
          "Take this business from zero to a working pre-foreclosure pipeline. Every step is reversible. Skip vendor wiring (steps 5-7) if you only want CSV-upload + scoring; outreach requires Lob; skip-trace requires BatchSkip + Smarty + DNC."
        }
      />

      {recordCount > 0 ? (
        <div className="rounded-md border border-emerald-700/40 bg-emerald-700/10 p-4 text-sm text-emerald-300">
          ✓ <strong>First sweep has produced records</strong> — {recordCount}{" "}
          ForeclosureRecord rows on file. You can return to setup later; the pipeline is
          already live.
        </div>
      ) : null}

      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.n}
            className={`rounded-lg border p-4 transition-colors ${
              step.status === "done"
                ? "border-emerald-700/40 bg-emerald-700/5"
                : step.status === "warning"
                  ? "border-yellow-500/30 bg-yellow-500/5"
                  : "border-line-subtle bg-bg-surface"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5">
                <StatusIcon status={step.status} />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                      Step {step.n}
                    </div>
                    <div className="text-sm font-medium text-white">{step.title}</div>
                  </div>
                  <div className="text-xs text-ink-muted">{step.statusLabel}</div>
                </div>
                <p className="text-sm text-ink-muted">{step.blurb}</p>
                {step.cta && step.status !== "done" ? (
                  <Link
                    href={step.cta.href}
                    className="inline-flex items-center gap-1.5 text-xs text-steel-bright transition-colors hover:text-white"
                  >
                    {step.cta.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-4 text-xs text-ink-muted">
        <strong className="text-white">Outreach pre-flight checklist</strong> — before you
        approve your first Lob mail piece, verify: (1) the lead's state is attested, (2) the
        draft includes the universal disclaimers + HUD-counselor referral, (3) for criminal-
        exposure states, the statutory notice is appended verbatim, (4) Lob's verified return
        address matches your operator identity. The State Compliance Review Agent enforces
        most of these automatically — this is the human spot-check.
      </div>
    </div>
  );
}
