"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Power,
  Search,
  ShieldCheck,
  XCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type ForeclosureRecordRow = {
  id: string;
  propertyAddress: string;
  state: string;
  county: string;
  ownerName: string;
  foreclosureStage: string;
  documentType: string;
  filingDate: string;
  auctionDate: string | null;
  scoreSnapshot: number | null;
  enrichmentStatus: string;
  sourceType: string;
  caseNumber: string | null;
  lenderName: string | null;
  reinstatementAmount: string | null;
};

type ComplianceSummary = {
  totalStates: number;
  attestedStates: number;
  criminalAttested: number;
  criminalTotal: number;
  glbaSigned: boolean;
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
  records: ForeclosureRecordRow[];
  totalRecordCount: number;
  compliance: ComplianceSummary;
  integrations: IntegrationStatus[];
};

const STAGE_LABEL: Record<string, string> = {
  lis_pendens: "Lis Pendens",
  notice_of_default: "Notice of Default",
  notice_of_trustee_sale: "Notice of Trustee Sale",
  judgment_of_foreclosure: "Judgment of Foreclosure",
  notice_of_sale: "Notice of Sale",
  sheriffs_sale: "Sheriff's Sale",
  auction_scheduled: "Auction Scheduled",
  post_sale_redemption: "Post-Sale Redemption"
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function auctionBand(days: number | null): {
  label: string;
  color: string;
} {
  if (days === null) return { label: "no auction set", color: "text-ink-muted" };
  if (days < 0) return { label: `${Math.abs(days)}d past`, color: "text-ink-muted" };
  if (days <= 7) return { label: `${days}d`, color: "text-red-400" };
  if (days <= 30) return { label: `${days}d`, color: "text-yellow-300" };
  if (days <= 90) return { label: `${days}d`, color: "text-blue-300" };
  return { label: `${days}d`, color: "text-ink-muted" };
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-ink-muted";
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-blue-300";
  if (score >= 35) return "text-yellow-300";
  return "text-ink-muted";
}

export function ForeclosureDashboard(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"auction_imminent" | "all" | "needs_enrichment">(
    "auction_imminent"
  );

  const sorted = useMemo(() => {
    const filtered = props.records.filter((r) => {
      if (filter === "auction_imminent") {
        const days = daysUntil(r.auctionDate);
        return days !== null && days <= 60 && days >= -7;
      }
      if (filter === "needs_enrichment") return r.enrichmentStatus !== "enriched";
      return true;
    });
    return filtered.sort((a, b) => {
      // Auction date ascending (closest first), nulls at end.
      const da = a.auctionDate ? new Date(a.auctionDate).getTime() : Infinity;
      const db_ = b.auctionDate ? new Date(b.auctionDate).getTime() : Infinity;
      if (da !== db_) return da - db_;
      return (b.scoreSnapshot ?? 0) - (a.scoreSnapshot ?? 0);
    });
  }, [props.records, filter]);

  async function toggleAddon(next: boolean) {
    setSubmitting(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${props.businessId}/foreclosures/enable`,
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
              Pre-foreclosure addon is disabled
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-ink-muted">
              The pre-foreclosure module sources distressed leads from county public records (NOD,
              Notice of Trustee Sale, Lis Pendens, Judgment of Foreclosure) and routes outreach
              through the State Compliance Review Agent. Enabling activates the daily sweep + the
              6 pre-foreclosure agents on this business.
            </p>
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 text-xs text-yellow-200">
              <strong>Before enabling, read DEALHAWK_PRE_FORECLOSURE_MODULE_PLAN.md.</strong>{" "}
              Foreclosure outreach in CA, MD, IL, MN, CO, NY, and FL carries criminal exposure for
              non-compliance. The addon won't fire outreach until you complete per-state
              attestations — but enabling means the County Records Scraper Agent + the Daily
              Pre-Foreclosure Sweep start writing rows.
            </div>
            <Button onClick={() => toggleAddon(true)} disabled={submitting}>
              {submitting ? "Enabling…" : "Enable pre-foreclosure addon"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <Link href={`/admin/businesses/${props.businessId}/foreclosures/compliance`}>
            <Button variant="outline" size="sm">
              <ShieldCheck className="mr-2 h-3 w-3" />
              State attestations
            </Button>
          </Link>
          <Link href={`/admin/businesses/${props.businessId}/foreclosures/import`}>
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="mr-2 h-3 w-3" />
              CSV import
            </Button>
          </Link>
          <Link href={`/admin/businesses/${props.businessId}/sourcing`}>
            <Button variant="outline" size="sm">
              <Search className="mr-2 h-3 w-3" />
              Buy-box config
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">Total records</div>
            <div className="text-2xl font-semibold text-white">{props.totalRecordCount}</div>
            <div className="text-xs text-ink-muted">ForeclosureRecord rows on file</div>
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              Auction &lt;30d
            </div>
            <div className="text-2xl font-semibold text-white">
              {
                props.records.filter((r) => {
                  const d = daysUntil(r.auctionDate);
                  return d !== null && d >= 0 && d <= 30;
                }).length
              }
            </div>
            <div className="text-xs text-ink-muted">leads within the window</div>
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              State attestations
            </div>
            <div className="text-2xl font-semibold text-white">
              {props.compliance.attestedStates} / {props.compliance.totalStates}
            </div>
            <div className="text-xs text-ink-muted">
              criminal-exposure: {props.compliance.criminalAttested} / {props.compliance.criminalTotal}
            </div>
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs uppercase tracking-wider text-ink-muted">GLBA / DPPA</div>
            <div
              className={`text-2xl font-semibold ${
                props.compliance.glbaSigned ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {props.compliance.glbaSigned ? "Signed" : "Not signed"}
            </div>
            <div className="text-xs text-ink-muted">skip-trace attestation</div>
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

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-white">Foreclosure pipeline</CardTitle>
          <div className="flex gap-2 text-xs">
            <Button
              variant={filter === "auction_imminent" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("auction_imminent")}
            >
              <Clock className="mr-2 h-3 w-3" />
              Auction imminent (60d)
            </Button>
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "needs_enrichment" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("needs_enrichment")}
            >
              <AlertTriangle className="mr-2 h-3 w-3" />
              Needs enrichment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-8 text-center text-sm text-ink-muted">
              <div>No records match the current filter.</div>
              <div className="mt-2">
                The daily sweep runs at the same hour as the existing Dealhawk sourcing sweep. You
                can also{" "}
                <Link
                  href={`/admin/businesses/${props.businessId}/foreclosures/import`}
                  className="underline hover:text-white"
                >
                  upload a CSV
                </Link>{" "}
                manually.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-xs">
                <thead>
                  <tr className="border-b border-line-subtle text-left text-ink-muted">
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Auction</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Score</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Stage</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Property</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Owner</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">State</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Source</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 100).map((r) => {
                    const days = daysUntil(r.auctionDate);
                    const band = auctionBand(days);
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-line-subtle/50 hover:bg-bg-surface-2/30"
                      >
                        <td className="px-3 py-2">
                          <div className={`flex items-center gap-1.5 ${band.color}`}>
                            <Calendar className="h-3 w-3" />
                            <span className="font-mono">{band.label}</span>
                          </div>
                          {r.auctionDate ? (
                            <div className="text-[10px] text-ink-muted/70">
                              {new Date(r.auctionDate).toLocaleDateString()}
                            </div>
                          ) : null}
                        </td>
                        <td className={`px-3 py-2 font-mono ${scoreColor(r.scoreSnapshot)}`}>
                          {r.scoreSnapshot ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-ink-muted">
                          {STAGE_LABEL[r.foreclosureStage] ?? r.foreclosureStage}
                          <div className="text-[10px] text-ink-muted/70">{r.documentType}</div>
                        </td>
                        <td className="px-3 py-2 text-white">
                          {r.propertyAddress}
                          <div className="text-[10px] text-ink-muted/70">{r.county}</div>
                        </td>
                        <td className="px-3 py-2 text-white">{r.ownerName}</td>
                        <td className="px-3 py-2 font-mono text-ink-muted">{r.state}</td>
                        <td className="px-3 py-2 text-ink-muted">{r.sourceType}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              r.enrichmentStatus === "enriched"
                                ? "text-emerald-400"
                                : r.enrichmentStatus === "failed"
                                  ? "text-red-400"
                                  : "text-ink-muted"
                            }
                          >
                            {r.enrichmentStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
              <span>Sign the GLBA / DPPA attestation to unlock skip-trace</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          {props.compliance.attestedStates < props.compliance.criminalTotal ? (
            <Link
              href={`/admin/businesses/${props.businessId}/foreclosures/compliance`}
              className="flex items-center justify-between rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-yellow-200 hover:bg-yellow-500/10"
            >
              <span>
                Complete attestations for the 7 criminal-exposure states (CA / MD / IL / MN / CO /
                NY / FL)
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          {!props.integrations.find((i) => i.key === "attom")?.connected ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-3 text-ink-muted">
              ATTOM is not wired — the daily sweep is running on CSV-upload + county-direct paths
              only. Connect ATTOM at /admin/integrations for national pre-foreclosure feed
              coverage.
            </div>
          ) : null}
          {!props.integrations.find((i) => i.key === "lob")?.connected ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-3 text-ink-muted">
              Lob is not wired — direct mail drafts will queue in /admin/approvals but won't fire.
              Connect Lob at /admin/integrations to unblock the recommended primary outreach
              channel.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
