/**
 * Unified distress-leads dashboard (decision #8).
 *
 * Reads from BOTH ForeclosureRecord and CodeViolationRecord tables and
 * presents a combined high-priority view. Module-specific
 * deep-dive surfaces remain at /admin/businesses/[id]/foreclosures and
 * /admin/businesses/[id]/code-violations — this is the unified entry
 * point that operators see first.
 *
 * Query filter `?type=foreclosure` or `?type=code_violation` narrows
 * to one module. Default = both.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Map, Power } from "lucide-react";

import { PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
  searchParams: { type?: string };
};

type UnifiedRow = {
  id: string;
  module: "pre_foreclosure" | "code_violation";
  propertyAddress: string;
  state: string;
  city: string | null;
  ownerName: string | null;
  signalLabel: string;
  scoreSnapshot: number | null;
  filingDate: string;
  detailHref: string;
};

const TIER_LABEL: Record<number, string> = {
  1: "Extreme",
  2: "Strong",
  3: "Moderate",
  4: "Low"
};

export default async function UnifiedDistressLeadsPage({
  params,
  searchParams
}: PageProps) {
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
  const fcEnabled =
    (cfg?.preForeclosure as { enabled?: unknown } | undefined)?.enabled === true;
  const cvEnabled =
    (cfg?.codeViolation as { enabled?: unknown } | undefined)?.enabled === true;

  const typeFilter = searchParams?.type ?? null;
  const showForeclosure = !typeFilter || typeFilter === "foreclosure";
  const showCodeViolation = !typeFilter || typeFilter === "code_violation";

  const rows: UnifiedRow[] = [];

  if (showForeclosure && fcEnabled) {
    const fcRecords = await db.foreclosureRecord.findMany({
      where: { businessId: params.id, deletedAt: null },
      orderBy: [{ auctionDate: "asc" }, { scoreSnapshot: "desc" }],
      take: 200,
      select: {
        id: true,
        propertyAddress: true,
        state: true,
        county: true,
        ownerName: true,
        foreclosureStage: true,
        scoreSnapshot: true,
        filingDate: true
      }
    });
    for (const r of fcRecords) {
      rows.push({
        id: r.id,
        module: "pre_foreclosure",
        propertyAddress: r.propertyAddress,
        state: r.state,
        city: r.county,
        ownerName: r.ownerName,
        signalLabel: r.foreclosureStage.replace(/_/g, " "),
        scoreSnapshot: r.scoreSnapshot,
        filingDate: r.filingDate.toISOString(),
        detailHref: `/admin/businesses/${params.id}/foreclosures`
      });
    }
  }

  if (showCodeViolation && cvEnabled) {
    const cvRecords = await db.codeViolationRecord.findMany({
      where: { businessId: params.id, deletedAt: null },
      orderBy: [{ severityTier: "asc" }, { scoreSnapshot: "desc" }],
      take: 200,
      select: {
        id: true,
        propertyAddress: true,
        state: true,
        city: true,
        ownerName: true,
        severityTier: true,
        scoreSnapshot: true,
        filingDate: true
      }
    });
    for (const r of cvRecords) {
      rows.push({
        id: r.id,
        module: "code_violation",
        propertyAddress: r.propertyAddress,
        state: r.state,
        city: r.city,
        ownerName: r.ownerName,
        signalLabel: `Tier ${r.severityTier} ${TIER_LABEL[r.severityTier]}`,
        scoreSnapshot: r.scoreSnapshot,
        filingDate: r.filingDate.toISOString(),
        detailHref: `/admin/businesses/${params.id}/code-violations`
      });
    }
  }

  // Cross-module sort: score descending, then recency.
  rows.sort((a, b) => {
    const sa = a.scoreSnapshot ?? -1;
    const sb = b.scoreSnapshot ?? -1;
    if (sa !== sb) return sb - sa;
    return new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime();
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
        eyebrow="Dealhawk · Distress Leads"
        title="Distress leads (unified)"
        description={
          "Cross-module distress-lead view — pre-foreclosure + code-violation in one place, sorted by score. Module-specific deep dives live at /foreclosures and /code-violations."
        }
      />

      {!fcEnabled && !cvEnabled ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Power className="h-4 w-4" />
              No distress-lead addons are enabled
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-ink-muted">
              Enable at least one addon to start ingesting distress leads. Both modules share
              skip-trace + Lob + State Compliance Review infrastructure.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/businesses/${params.id}/foreclosures`}>
                <Button variant="outline" size="sm">
                  Pre-Foreclosure addon
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
              <Link href={`/admin/businesses/${params.id}/code-violations`}>
                <Button variant="outline" size="sm">
                  Code-Violation addon
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href={`/admin/businesses/${params.id}/distress-leads`}>
          <Button variant={!typeFilter ? "default" : "ghost"} size="sm">
            Both modules ({rows.length})
          </Button>
        </Link>
        <Link href={`/admin/businesses/${params.id}/distress-leads?type=foreclosure`}>
          <Button variant={typeFilter === "foreclosure" ? "default" : "ghost"} size="sm">
            Pre-Foreclosure (
            {rows.filter((r) => r.module === "pre_foreclosure").length})
          </Button>
        </Link>
        <Link href={`/admin/businesses/${params.id}/distress-leads?type=code_violation`}>
          <Button variant={typeFilter === "code_violation" ? "default" : "ghost"} size="sm">
            Code Violation (
            {rows.filter((r) => r.module === "code_violation").length})
          </Button>
        </Link>
        <div className="ml-auto flex gap-2">
          <Link href={`/admin/businesses/${params.id}/distress-leads/visits`}>
            <Button variant="outline" size="sm">
              <Map className="mr-2 h-3 w-3" />
              Field visits
            </Button>
          </Link>
          <Link href={`/admin/businesses/${params.id}/foreclosures/import`}>
            <Button variant="ghost" size="sm">
              <FileSpreadsheet className="mr-2 h-3 w-3" />
              Foreclosure CSV
            </Button>
          </Link>
          <Link href={`/admin/businesses/${params.id}/code-violations/import`}>
            <Button variant="ghost" size="sm">
              <FileSpreadsheet className="mr-2 h-3 w-3" />
              Code-Violation CSV
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Top distress leads (cross-module, sorted by score)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-8 text-center text-sm text-ink-muted">
              No records yet — the daily sweep runs at the operator's configured
              sweepHourLocal. You can also upload a CSV directly via either module's import
              surface.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr className="border-b border-line-subtle text-left text-ink-muted">
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Module</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Score</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Property</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">City/State</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Owner</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Signal</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Filed</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr
                      key={`${r.module}:${r.id}`}
                      className="border-b border-line-subtle/50 hover:bg-bg-surface-2/30"
                    >
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
                            r.module === "pre_foreclosure"
                              ? "bg-red-700/20 text-red-300"
                              : "bg-blue-700/20 text-blue-300"
                          }`}
                        >
                          {r.module === "pre_foreclosure" ? "Pre-FC" : "Code"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-white">
                        {r.scoreSnapshot ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-white">{r.propertyAddress}</td>
                      <td className="px-3 py-2 font-mono text-ink-muted">
                        {r.city ? `${r.city}, ` : ""}
                        {r.state}
                      </td>
                      <td className="px-3 py-2 text-white">{r.ownerName ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-muted">{r.signalLabel}</td>
                      <td className="px-3 py-2 font-mono text-ink-muted">
                        {new Date(r.filingDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={r.detailHref}
                          className="text-steel-bright hover:text-white"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 ? (
                <div className="mt-3 text-center text-xs text-ink-muted">
                  Showing first 100 of {rows.length}. Filter by module to narrow.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
