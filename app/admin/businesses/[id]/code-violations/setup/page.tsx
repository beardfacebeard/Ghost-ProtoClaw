/**
 * Code-violation first-enable walkthrough.
 *
 * 8-step checklist mirrors the foreclosure setup walkthrough but with
 * code-violation-specific gates: Fair Housing audit (the heaviest single
 * lift) + city selection + Lob (recommended primary channel) +
 * BatchSkipTracing/Smarty (enrichment vendors).
 *
 * Server-rendered (no client state) — refresh picks up live status.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle
} from "lucide-react";

import { PageHeader } from "@/components/admin/ui";
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

export default async function CodeViolationSetupPage({ params }: PageProps) {
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
  const templateId = typeof cfg?.templateId === "string" ? (cfg.templateId as string) : null;
  const cv = cfg?.codeViolation as
    | {
        enabled?: unknown;
        cities?: string[];
        fairHousingAuditedAt?: string;
      }
    | undefined;
  const addonEnabled = cv?.enabled === true;

  const pre = cfg?.preForeclosure as
    | { glbaAttestation?: { signedAt?: string } }
    | undefined;
  const glbaSigned = Boolean(pre?.glbaAttestation?.signedAt);

  const fhAuditedAt = cv?.fairHousingAuditedAt;
  const fhAgeDays = fhAuditedAt
    ? Math.floor(
        (Date.now() - new Date(fhAuditedAt).getTime()) / (24 * 60 * 60 * 1000)
      )
    : null;
  const fhStale = fhAgeDays === null || fhAgeDays > 90;

  const cities = Array.isArray(cv?.cities) ? cv.cities : [];

  const recordCount = addonEnabled
    ? await db.codeViolationRecord.count({
        where: { businessId: business.id, deletedAt: null }
      })
    : 0;

  const integrations = await db.integration.findMany({
    where: {
      organizationId: session.organizationId,
      key: { in: ["lob", "batch_skip", "smarty", "firecrawl", "propstream"] }
    },
    select: { key: true, status: true }
  });
  const intMap = new Map(integrations.map((i) => [i.key, i.status]));
  const wired = (key: string) => intMap.get(key) === "connected";

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
        "The code-violation addon only works on dealhawk_empire businesses. If you started from another template, you'll need to re-materialize this business.",
      status: templateId === "dealhawk_empire" ? "done" : "warning",
      statusLabel:
        templateId === "dealhawk_empire" ? "Confirmed" : `Template is "${templateId ?? "unknown"}"`,
      cta:
        templateId === "dealhawk_empire"
          ? undefined
          : { href: `/admin/businesses/${business.id}/edit`, label: "Edit business" }
    },
    {
      n: 2,
      title: "Enable the addon",
      blurb:
        "Activates the daily code-violation sweep + the addon's 6 agents. Reversible — disabling preserves attestations, filters, and audit history.",
      status: addonEnabled ? "done" : "pending",
      statusLabel: addonEnabled ? "Addon enabled" : "Addon not enabled yet",
      cta: {
        href: `/admin/businesses/${business.id}/code-violations`,
        label: "Open dashboard"
      }
    },
    {
      n: 3,
      title: "Sign the Fair Housing audit",
      blurb:
        "Highest single risk for this module. Code-violation density correlates with race / national origin in many MSAs — disparate-impact exposure under Inclusive Communities (2015) + HUD/CFPB 2024 algorithmic-targeting guidance. Audit your lead-selection algorithm + outreach lists by census tract; record the audit here. Quarterly cadence enforced — the dashboard surfaces a warning when >90 days old.",
      status: !fhStale ? "done" : fhAuditedAt ? "warning" : "pending",
      statusLabel: fhAuditedAt
        ? fhStale
          ? `Stale (${fhAgeDays} days old)`
          : `OK (${fhAgeDays} days old)`
        : "Not signed",
      cta: {
        href: `/admin/businesses/${business.id}/code-violations/fair-housing-audit`,
        label: "Sign audit"
      }
    },
    {
      n: 4,
      title: "Sign the GLBA / DPPA attestation (shared with pre-foreclosure)",
      blurb:
        "Required before any skip-trace fires. ONE attestation covers both modules — if you've already signed it for pre-foreclosure, you're done. Otherwise, sign at the foreclosure compliance page.",
      status: glbaSigned ? "done" : "pending",
      statusLabel: glbaSigned ? "Signed" : "Not signed",
      cta: {
        href: `/admin/businesses/${business.id}/foreclosures/compliance`,
        label: "Sign GLBA"
      }
    },
    {
      n: 5,
      title: "Pick target cities + severity tiers",
      blurb:
        "The daily sweep ingests from 10 pre-built Tier-1 cities (Chicago, NYC HPD/DOB, LA, Philly, SF, Detroit, Cincinnati, Columbus, Baltimore County) when no city allowlist is set. The Sourcing Filters page lets you narrow to specific cities, pick severity tiers (default skips Tier-4 noise), and set the daily ingest cap. To add cities outside the Tier-1 list, register Tier-2 generic Socrata/ArcGIS adapters in Business.config.codeViolation.customAdapters.",
      status: cities.length > 0 ? "done" : "pending",
      statusLabel:
        cities.length > 0
          ? `${cities.length} cities allowlisted`
          : "All Tier-1 cities (default)",
      cta: {
        href: `/admin/businesses/${params.id}/code-violations/filters`,
        label: "Configure filters"
      }
    },
    {
      n: 6,
      title: "Wire skip-trace + address + Lob",
      blurb:
        "BatchSkipTracing (~$0.15/record) for owner contact resolution. Smarty (free tier OK) for address normalization. Lob (~$0.85/postcard) for direct mail outreach. These are shared with the pre_foreclosure addon — if you've already wired them, you're set.",
      status:
        wired("batch_skip") && wired("smarty") && wired("lob")
          ? "done"
          : wired("batch_skip") || wired("smarty") || wired("lob")
            ? "warning"
            : "pending",
      statusLabel:
        [
          wired("batch_skip") ? "BatchSkip" : null,
          wired("smarty") ? "Smarty" : null,
          wired("lob") ? "Lob" : null
        ]
          .filter(Boolean)
          .join(" · ") || "None wired",
      cta: { href: `/admin/integrations`, label: "Wire integrations" }
    },
    {
      n: 7,
      title: "Wire Firecrawl for scraping (optional)",
      blurb:
        "Firecrawl powers operator-added Tier-2 city scrapers (any Socrata or ArcGIS Hub city auto-discovers via Firecrawl + the generic adapter). Optional — Tier-1 cities work without Firecrawl because their APIs are open. Add Firecrawl when you expand beyond the 10 launch cities.",
      status: wired("firecrawl") ? "done" : "pending",
      statusLabel: wired("firecrawl") ? "Firecrawl connected" : "Optional — not connected",
      cta: { href: `/admin/integrations`, label: "Wire Firecrawl" }
    },
    {
      n: 8,
      title: "Upload your first CSV (optional)",
      blurb:
        "If you have an existing list (PropStream export, FOIA response, city-portal export), upload it via the CSV import. Otherwise, the daily sweep will populate the pipeline from open-data feeds at the next sweep hour.",
      status: recordCount > 0 ? "done" : "pending",
      statusLabel:
        recordCount > 0
          ? `${recordCount} records on file`
          : "No records yet (sweep pending)",
      cta: {
        href: `/admin/businesses/${business.id}/code-violations/import`,
        label: "Open CSV import"
      }
    }
  ];

  const completed = steps.filter((s) => s.status === "done").length;

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
        eyebrow="Code Violation · Setup walkthrough"
        title={`Setup — ${completed}/${steps.length} steps complete`}
        description={
          "Take this business from zero to a working code-violation pipeline. Every step is reversible. Skip vendor wiring (steps 6-7) if you only want CSV-upload + scoring; outreach requires Lob; skip-trace requires BatchSkip + Smarty."
        }
      />

      {recordCount > 0 ? (
        <div className="rounded-md border border-emerald-700/40 bg-emerald-700/10 p-4 text-sm text-emerald-300">
          ✓ <strong>First records ingested</strong> — {recordCount}{" "}
          CodeViolationRecord rows on file. Pipeline is already live.
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
        <strong className="text-white">Outreach pre-flight checklist</strong> — before
        approving the first Lob mail piece, verify: (1) Fair Housing audit is current
        (&lt;90 days), (2) draft passes State Compliance Review's forbidden-pattern filter
        (no "we saw your violations", no government impersonation, no neighborhood targeting),
        (3) draft includes the universal disclaimers, (4) Lob's verified return address
        matches your operator identity. The State Compliance Review Agent enforces most of
        these automatically — this is the human spot-check.
      </div>
    </div>
  );
}
