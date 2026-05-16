"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  Map,
  Power,
  ShieldCheck,
  Wand2,
  XCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import {
  SweepHistoryPanel,
  type SweepRun
} from "@/components/admin/businesses/SweepHistoryPanel";
import { toast } from "@/components/ui/toast";

type CodeViolationRow = {
  id: string;
  propertyAddress: string;
  city: string;
  state: string;
  ownerName: string | null;
  violationDescription: string;
  severityTier: number;
  status: string;
  filingDate: string;
  scoreSnapshot: number | null;
  sourceType: string;
  caseNumber: string | null;
  needsForeclosureRescueReview: boolean;
};

type ComplianceSummary = {
  glbaSigned: boolean;
  fairHousingAuditedAt: string | null;
  fairHousingAuditAgeDays: number | null;
  fairHousingAuditStale: boolean;
};

type IntegrationStatus = {
  key: string;
  name: string;
  connected: boolean;
};

type Props = {
  businessId: string;
  businessName: string;
  addonEnabled: boolean;
  records: CodeViolationRow[];
  totalRecordCount: number;
  compliance: ComplianceSummary;
  integrations: IntegrationStatus[];
  recentSweeps: SweepRun[];
};

const TIER_LABEL: Record<number, string> = {
  1: "Extreme",
  2: "Strong",
  3: "Moderate",
  4: "Low"
};

const TIER_COLOR: Record<number, string> = {
  1: "text-red-400",
  2: "text-yellow-300",
  3: "text-blue-300",
  4: "text-ink-muted"
};

function scoreColor(score: number | null): string {
  if (score === null) return "text-ink-muted";
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-blue-300";
  if (score >= 45) return "text-yellow-300";
  return "text-ink-muted";
}

export function CodeViolationDashboard(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"tier1" | "all" | "needs_review">("tier1");

  const sorted = useMemo(() => {
    const filtered = props.records.filter((r) => {
      if (filter === "tier1") return r.severityTier === 1;
      if (filter === "needs_review") return r.needsForeclosureRescueReview;
      return true;
    });
    return filtered.sort((a, b) => {
      // Severity tier ascending (extreme first), then score desc, then
      // filing date desc.
      if (a.severityTier !== b.severityTier) return a.severityTier - b.severityTier;
      const sa = a.scoreSnapshot ?? -1;
      const sb = b.scoreSnapshot ?? -1;
      if (sa !== sb) return sb - sa;
      return new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime();
    });
  }, [props.records, filter]);

  async function toggleAddon(next: boolean) {
    setSubmitting(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${props.businessId}/code-violations/enable`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled: next })
        }
      );
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Toggle failed.");
      }
      toast.success(payload.message ?? (next ? "Addon enabled." : "Addon disabled."));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toggle failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!props.addonEnabled) {
    return (
      <div className="space-y-6">
        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Power className="h-4 w-4" />
              Code-violation addon is disabled
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-ink-muted">
              The code-violation module sources distressed leads from city code-enforcement
              portals (Chicago, NYC HPD/DOB, LA, Philly, SF, Detroit, Cincinnati, Columbus,
              Baltimore County at launch + any other city via Socrata/ArcGIS auto-discovery) +
              CSV upload. Enabling activates the daily sweep + the 6 code-violation agents on
              this business.
            </p>
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-xs text-yellow-200">
              <strong>Before enabling, read DEALHAWK_CODE_VIOLATION_MODULE_PLAN.md.</strong>{" "}
              Code-violation outreach carries Fair Housing disparate-impact risk because
              violation density correlates with race / national origin in many MSAs. The
              State Compliance Review Agent enforces a forbidden-pattern filter + multi-factor
              selection rule, and the Fair Housing audit must be recorded quarterly. Outreach
              never auto-fires.
            </div>
            <Button onClick={() => toggleAddon(true)} disabled={submitting}>
              {submitting ? "Enabling…" : "Enable code-violation addon"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierCounts = {
    1: props.records.filter((r) => r.severityTier === 1).length,
    2: props.records.filter((r) => r.severityTier === 2).length,
    3: props.records.filter((r) => r.severityTier === 3).length,
    4: props.records.filter((r) => r.severityTier === 4).length
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleAddon(false)}
          disabled={submitting}
        >
          <Power className="mr-2 h-3 w-3" />
          {submitting ? "Disabling…" : "Disable addon"}
        </Button>
        <div className="flex flex-wrap gap-2 text-xs">
          <Link href={`/admin/businesses/${props.businessId}/code-violations/setup`}>
            <Button variant="outline" size="sm">
              <Wand2 className="mr-2 h-3 w-3" />
              Setup walkthrough
            </Button>
          </Link>
          <Link href={`/admin/businesses/${props.businessId}/code-violations/filters`}>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-3 w-3" />
              Sourcing filters
            </Button>
          </Link>
          <Link href={`/admin/businesses/${props.businessId}/code-violations/fair-housing-audit`}>
            <Button variant="outline" size="sm">
              <ShieldCheck className="mr-2 h-3 w-3" />
              Fair Housing audit
            </Button>
          </Link>
          <Link href={`/admin/businesses/${props.businessId}/code-violations/import`}>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-3 w-3" />
              CSV import
            </Button>
          </Link>
          <Link href={`/admin/businesses/${props.businessId}/distress-leads/visits`}>
            <Button variant="outline" size="sm">
              <Map className="mr-2 h-3 w-3" />
              Field visits
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">Total records</div>
            <div className="text-2xl font-semibold text-white">{props.totalRecordCount}</div>
            <div className="text-xs text-ink-muted">CodeViolationRecord rows on file</div>
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Severity breakdown
            </div>
            <div className="flex items-center gap-3 text-sm font-mono">
              <span className="text-red-400">T1 {tierCounts[1]}</span>
              <span className="text-yellow-300">T2 {tierCounts[2]}</span>
              <span className="text-blue-300">T3 {tierCounts[3]}</span>
              <span className="text-ink-muted">T4 {tierCounts[4]}</span>
            </div>
            <div className="text-xs text-ink-muted">recent ingest</div>
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Fair Housing audit
            </div>
            <div
              className={`text-2xl font-semibold ${
                props.compliance.fairHousingAuditStale ? "text-yellow-300" : "text-emerald-400"
              }`}
            >
              {props.compliance.fairHousingAuditedAt
                ? props.compliance.fairHousingAuditStale
                  ? `Stale (${props.compliance.fairHousingAuditAgeDays}d)`
                  : `OK (${props.compliance.fairHousingAuditAgeDays}d)`
                : "Not signed"}
            </div>
            <div className="text-xs text-ink-muted">quarterly cadence</div>
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">GLBA / DPPA</div>
            <div
              className={`text-2xl font-semibold ${props.compliance.glbaSigned ? "text-emerald-400" : "text-red-400"}`}
            >
              {props.compliance.glbaSigned ? "Signed" : "Not signed"}
            </div>
            <div className="text-xs text-ink-muted">shared with pre-foreclosure</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Integration status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4 text-xs">
          {props.integrations.map((i) => (
            <div
              key={i.key}
              className="flex items-center gap-2 rounded-md border border-line-subtle bg-bg-surface-2/40 px-3 py-2"
            >
              {i.connected ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-ink-muted" />
              )}
              <span className={i.connected ? "text-white" : "text-ink-muted"}>{i.name}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <SweepHistoryPanel
        moduleLabel="Code-violation"
        runs={props.recentSweeps}
      />

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-white">Code-violation pipeline</CardTitle>
          <div className="flex gap-2 text-xs">
            <Button
              variant={filter === "tier1" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("tier1")}
            >
              <AlertTriangle className="mr-2 h-3 w-3" />
              Tier 1 only
            </Button>
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "needs_review" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("needs_review")}
            >
              <Filter className="mr-2 h-3 w-3" />
              MD condemnation review
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-8 text-center text-sm text-ink-muted">
              <div>No records match the current filter.</div>
              <div className="mt-2">
                The daily sweep runs at the same hour as the existing Dealhawk sweeps. You can
                also{" "}
                <Link
                  href={`/admin/businesses/${props.businessId}/code-violations/import`}
                  className="underline hover:text-white"
                >
                  upload a CSV
                </Link>{" "}
                manually.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr className="border-b border-line-subtle text-left text-ink-muted">
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Tier</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Score</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Property</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">City</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Owner</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Violation</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 100).map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-line-subtle/50 hover:bg-bg-surface-2/30"
                    >
                      <td className={`px-3 py-2 font-mono ${TIER_COLOR[r.severityTier]}`}>
                        T{r.severityTier} {TIER_LABEL[r.severityTier]}
                      </td>
                      <td className={`px-3 py-2 font-mono ${scoreColor(r.scoreSnapshot)}`}>
                        {r.scoreSnapshot ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-white">{r.propertyAddress}</td>
                      <td className="px-3 py-2 font-mono text-ink-muted">
                        {r.city}, {r.state}
                      </td>
                      <td className="px-3 py-2 text-white">{r.ownerName ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-muted">
                        {r.violationDescription.length > 60
                          ? r.violationDescription.slice(0, 57) + "…"
                          : r.violationDescription}
                        {r.needsForeclosureRescueReview ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-mono uppercase text-yellow-200">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            MD review
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{r.status}</td>
                      <td className="px-3 py-2 font-mono text-ink-muted">
                        {new Date(r.filingDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sorted.length > 100 ? (
                <div className="mt-3 text-center text-xs text-ink-muted">
                  Showing first 100 of {sorted.length}. Use filters to narrow.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Next steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!props.compliance.glbaSigned ? (
            <Link
              href={`/admin/businesses/${props.businessId}/foreclosures/compliance`}
              className="flex items-center justify-between rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-yellow-200 hover:bg-yellow-500/10"
            >
              <span>
                Sign the GLBA / DPPA attestation (shared with pre-foreclosure) to unlock
                skip-trace
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          {props.compliance.fairHousingAuditStale ? (
            <Link
              href={`/admin/businesses/${props.businessId}/code-violations/fair-housing-audit`}
              className="flex items-center justify-between rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-yellow-200 hover:bg-yellow-500/10"
            >
              <span>
                Record a fresh Fair Housing audit (quarterly cadence; current audit{" "}
                {props.compliance.fairHousingAuditedAt
                  ? `is ${props.compliance.fairHousingAuditAgeDays} days old`
                  : "is missing"}
                )
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          {!props.integrations.find((i) => i.key === "lob")?.connected ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-3 text-ink-muted">
              Lob is not wired — direct mail drafts will queue in /admin/approvals but won't
              fire. Connect Lob at /admin/integrations to unblock the recommended primary
              outreach channel.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
