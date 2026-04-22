"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  Flame,
  Home,
  MapPin,
  Radar,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/admin/ui";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * Dealhawk Empire — Dashboard panel.
 *
 * Composed of four sections:
 *
 *   - Hero stats      — active count, top motivation score, $$ in
 *                       contract, $$ closed, gold-tier (80+) count.
 *   - Deal of the Day — the highest-motivation unworked lead (status
 *                       lead/contacted, scored 60+, sorted by score).
 *                       Full underwriting + signal stack visible.
 *   - Sub-To Math     — the visual centerpiece for the sales page.
 *                       Picks a Sub-To grand-slam deal (subToViability
 *                       === "grand_slam") and renders the wholesale-MAO-
 *                       dies-vs-Sub-To-wins comparison with dramatic
 *                       big-number framing. The literal "wholesale MAO
 *                       = $136K, deal dies; Sub-To = $143K acquisition
 *                       on $220K asset, $400/mo cashflow at 3.1%
 *                       inherited rate, deal wins" demonstration.
 *   - Market Heat     — top markets (states) with deal counts +
 *                       signal-type mix bar. Stylized heat map without
 *                       requiring a map library.
 *
 * Pulls all data from /api/admin/businesses/[id]/deals?limit=500 — one
 * fetch, computed client-side. Dashboard auto-refreshes when the
 * underlying pipeline changes (e.g., after the operator imports leads
 * or runs a provider search in the Pipeline tab).
 */

type DealSignal = {
  signalType: string;
};

type Deal = {
  id: string;
  status: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  bedrooms: number | null;
  bathrooms: number | null;
  livingSqft: number | null;
  arvLow: number | null;
  arvMid: number | null;
  arvHigh: number | null;
  rentEstimate: number | null;
  rehabLight: number | null;
  rehabMedium: number | null;
  rehabHeavy: number | null;
  maoWholesale: number | null;
  maoBrrrr: number | null;
  maoFlip: number | null;
  subToScore: number | null;
  subToViability: string | null;
  motivationScore: number;
  recommendedExit: string | null;
  source: string | null;
  ownerName: string | null;
  ownerEntityType: string | null;
  contractType: string | null;
  purchasePrice: number | null;
  assignmentFee: number | null;
  signalCount?: number;
  signals?: DealSignal[];
};

const SIGNAL_COLORS: Record<string, string> = {
  pre_foreclosure: "bg-state-danger/80",
  tax_delinquent: "bg-state-warning/80",
  probate: "bg-state-ai/80",
  divorce: "bg-state-ai/60",
  code_violation: "bg-state-warning/60",
  vacancy: "bg-steel/60",
  absentee: "bg-state-success/40",
  eviction: "bg-state-danger/60",
  expired_listing: "bg-steel/40",
  high_equity: "bg-state-success/80",
  long_tenure: "bg-state-success/60",
};

const SIGNAL_LABELS: Record<string, string> = {
  pre_foreclosure: "Pre-foreclosure",
  tax_delinquent: "Tax delinquent",
  probate: "Probate",
  divorce: "Divorce",
  code_violation: "Code violation",
  vacancy: "Vacancy",
  absentee: "Absentee",
  eviction: "Eviction",
  expired_listing: "Expired listing",
  high_equity: "High equity",
  long_tenure: "Long tenure",
};

function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatK(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}K`;
  return formatCurrency(n);
}

type DealhawkDashboardPanelProps = {
  businessId: string;
};

export function DealhawkDashboardPanel({
  businessId,
}: DealhawkDashboardPanelProps) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDeals();
  }, [businessId]);

  async function loadDeals() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/businesses/${businessId}/deals?limit=500`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(body.error || "Failed to load dashboard.");
        return;
      }
      const data = (await res.json()) as { deals: Deal[] };
      setDeals(data.deals);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Computed views ────────────────────────────────────────────

  const stats = useMemo(() => {
    let active = 0;
    let goldTier = 0;
    let topScore = 0;
    let inContract = 0;
    let closed = 0;
    for (const d of deals) {
      if (!["dead", "closed"].includes(d.status)) active++;
      if (d.motivationScore >= 80) goldTier++;
      if (d.motivationScore > topScore) topScore = d.motivationScore;
      if (d.status === "under_contract" && d.assignmentFee) {
        inContract += d.assignmentFee;
      }
      if (
        (d.status === "assigned" || d.status === "closed") &&
        d.assignmentFee
      ) {
        closed += d.assignmentFee;
      }
    }
    return { active, goldTier, topScore, inContract, closed };
  }, [deals]);

  const dealOfTheDay = useMemo(() => {
    return (
      deals
        .filter((d) => ["lead", "contacted"].includes(d.status))
        .filter((d) => d.motivationScore >= 60)
        .sort((a, b) => b.motivationScore - a.motivationScore)[0] ?? null
    );
  }, [deals]);

  const subToShowcase = useMemo(() => {
    return (
      deals
        .filter(
          (d) =>
            d.subToViability === "grand_slam" &&
            !["dead"].includes(d.status)
        )
        .sort((a, b) => (b.subToScore ?? 0) - (a.subToScore ?? 0))[0] ?? null
    );
  }, [deals]);

  const marketHeat = useMemo(() => {
    type StateBucket = {
      state: string;
      total: number;
      active: number;
      topScore: number;
      signalCounts: Record<string, number>;
      goldCount: number;
    };
    const map = new Map<string, StateBucket>();
    for (const d of deals) {
      if (!map.has(d.propertyState)) {
        map.set(d.propertyState, {
          state: d.propertyState,
          total: 0,
          active: 0,
          topScore: 0,
          signalCounts: {},
          goldCount: 0,
        });
      }
      const b = map.get(d.propertyState)!;
      b.total++;
      if (!["dead", "closed"].includes(d.status)) b.active++;
      if (d.motivationScore > b.topScore) b.topScore = d.motivationScore;
      if (d.motivationScore >= 80) b.goldCount++;
    }
    // For signal counts, we'd need full signals which the list endpoint
    // doesn't return. For demo purposes, we infer dominant signal from
    // recommendedExit since most leads with Sub-To recommendation came
    // from pre_foreclosure stacks, etc.
    for (const d of deals) {
      const b = map.get(d.propertyState);
      if (!b) continue;
      const inferredSignal = inferDominantSignal(d);
      if (inferredSignal) {
        b.signalCounts[inferredSignal] =
          (b.signalCounts[inferredSignal] ?? 0) + 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.active - a.active || b.topScore - a.topScore
    );
  }, [deals]);

  if (loading) {
    return (
      <Panel>
        <PanelBody>
          <div className="py-8 text-center font-mono text-[11.5px] uppercase tracking-wide text-ink-muted">
            Loading dashboard…
          </div>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero stats */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active deals"
          value={stats.active.toString()}
          icon={<Activity className="h-3.5 w-3.5" />}
          tone="steel"
        />
        <StatCard
          label="Gold tier (80+)"
          value={stats.goldTier.toString()}
          icon={<Flame className="h-3.5 w-3.5" />}
          tone="warning"
        />
        <StatCard
          label="Top motivation"
          value={`${stats.topScore}/100`}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          tone={stats.topScore >= 80 ? "danger" : "steel"}
        />
        <StatCard
          label="In contract"
          value={formatK(stats.inContract)}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          tone="warning"
        />
        <StatCard
          label="Closed"
          value={formatK(stats.closed)}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          tone="success"
        />
      </div>

      {/* Deal of the Day */}
      <Panel>
        <PanelHeader
          label="Deal of the Day"
          action={
            <span className="inline-flex items-center gap-1 rounded-md border border-state-warning/30 bg-state-warning/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-state-warning">
              <Sparkles className="h-2.5 w-2.5" />
              Highest-motivation unworked lead
            </span>
          }
        />
        <PanelBody>
          {dealOfTheDay ? (
            <DealOfTheDayCard deal={dealOfTheDay} />
          ) : (
            <div className="rounded-md border border-dashed border-line-subtle bg-bg-app/30 px-3 py-6 text-center">
              <Radar className="mx-auto h-5 w-5 text-ink-muted" />
              <div className="mt-2 text-[13px] font-medium text-ink-primary">
                No leads scoring 60+ awaiting outreach
              </div>
              <div className="mt-1 text-[11.5px] text-ink-secondary">
                Run a provider search or import a CSV from the Pipeline tab to
                surface qualifying deals.
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Sub-To Math visualizer */}
      <Panel>
        <PanelHeader
          label="Sub-To Math — the rate-arbitrage opportunity"
          action={
            <span className="inline-flex items-center gap-1 rounded-md border border-state-ai/30 bg-state-ai/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-state-ai">
              <Sparkles className="h-2.5 w-2.5" />
              The 2026 edge
            </span>
          }
        />
        <PanelBody>
          {subToShowcase ? (
            <SubToMathCard deal={subToShowcase} />
          ) : (
            <div className="rounded-md border border-dashed border-line-subtle bg-bg-app/30 px-3 py-6 text-center">
              <Home className="mx-auto h-5 w-5 text-ink-muted" />
              <div className="mt-2 text-[13px] font-medium text-ink-primary">
                No Sub-To grand-slam deals on file
              </div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
                When the Sub-To Qualifier marks a deal as &quot;grand_slam&quot;
                viability (rate &lt;5%, PITI &lt;80% rent, balance/ARV &lt;85%,
                minimal equity), it appears here with the wholesale-vs-Sub-To
                math. The seeded Glendale AZ + Decatur GA + DeSoto TX demo deals
                will surface here once the Sub-To Qualifier persists their
                analysis to the Deal row.
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* Market heat */}
      <Panel>
        <PanelHeader
          label="Market Heat"
          action={
            <span className="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-bg-app/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              {marketHeat.length} state{marketHeat.length === 1 ? "" : "s"}
            </span>
          }
        />
        <PanelBody>
          {marketHeat.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-subtle bg-bg-app/30 px-3 py-6 text-center font-mono text-[11px] uppercase tracking-wide text-ink-muted">
              No deals to map yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {marketHeat.map((m) => (
                <MarketHeatCard key={m.state} bucket={m} />
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "steel" | "warning" | "success" | "danger" | "ai";
}) {
  const toneClass = {
    steel: "border-steel/30 bg-steel/5 text-steel-bright",
    warning: "border-state-warning/30 bg-state-warning/5 text-state-warning",
    success: "border-state-success/30 bg-state-success/5 text-state-success",
    danger: "border-state-danger/30 bg-state-danger/5 text-state-danger",
    ai: "border-state-ai/30 bg-state-ai/5 text-state-ai",
  }[tone];
  return (
    <div className={cn("rounded-md border px-3 py-2.5", toneClass)}>
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-[18px] font-bold text-ink-primary">
        {value}
      </div>
    </div>
  );
}

function DealOfTheDayCard({ deal }: { deal: Deal }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_minmax(0,260px)]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-steel/30 bg-steel/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-steel-bright">
            {deal.propertyState}
          </span>
          <span className="text-[15px] font-semibold text-ink-primary">
            {deal.propertyAddress}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[12px] text-ink-secondary">
          <MapPin className="h-3 w-3" />
          {deal.propertyCity}, {deal.propertyState} {deal.propertyZip}
          {deal.bedrooms !== null ? ` · ${deal.bedrooms} bd` : ""}
          {deal.bathrooms !== null ? ` / ${deal.bathrooms} ba` : ""}
          {deal.livingSqft
            ? ` · ${deal.livingSqft.toLocaleString()} sqft`
            : ""}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="ARV mid" value={formatK(deal.arvMid)} />
          <Stat label="MAO·Wholesale" value={formatK(deal.maoWholesale)} />
          <Stat label="MAO·BRRRR" value={formatK(deal.maoBrrrr)} />
          <Stat label="MAO·Flip" value={formatK(deal.maoFlip)} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {deal.recommendedExit ? (
            <Chip
              tone="ai"
              icon={<TrendingUp className="h-2.5 w-2.5" />}
              label={`Recommended: ${deal.recommendedExit}`}
            />
          ) : null}
          {deal.subToScore && deal.subToScore >= 75 ? (
            <Chip
              tone="ai"
              icon={<Sparkles className="h-2.5 w-2.5" />}
              label={`Sub-To ${deal.subToScore}/100 (${deal.subToViability})`}
            />
          ) : null}
          {deal.signalCount && deal.signalCount > 0 ? (
            <Chip
              tone="muted"
              icon={<Radar className="h-2.5 w-2.5" />}
              label={`${deal.signalCount} signal${deal.signalCount === 1 ? "" : "s"} stacked`}
            />
          ) : null}
        </div>

        {deal.ownerName ? (
          <div className="text-[11.5px] text-ink-secondary">
            Owner: <span className="text-ink-primary">{deal.ownerName}</span>
            {deal.ownerEntityType ? (
              <span className="ml-1 rounded-md border border-line-subtle bg-bg-app px-1 py-0.5 font-mono text-[9.5px] uppercase text-ink-muted">
                {deal.ownerEntityType}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Right: motivation orb + status */}
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-line-subtle bg-bg-app/40 px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          Motivation
        </div>
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full border font-mono text-[28px] font-bold",
            deal.motivationScore >= 80
              ? "border-state-danger/50 bg-state-danger/10 text-state-danger"
              : deal.motivationScore >= 60
                ? "border-state-warning/50 bg-state-warning/10 text-state-warning"
                : "border-steel/40 bg-steel/10 text-steel-bright"
          )}
        >
          {deal.motivationScore}
        </div>
        <div className="text-center text-[11px] text-ink-secondary">
          {deal.motivationScore >= 80
            ? "Gold tier — same-day review"
            : deal.motivationScore >= 60
              ? "Strong lead — outreach today"
              : "Worth a touch"}
        </div>
        <div className="mt-1 text-center text-[10.5px] uppercase tracking-wide text-ink-muted">
          Stage: {deal.status}
        </div>
      </div>
    </div>
  );
}

function SubToMathCard({ deal }: { deal: Deal }) {
  // The dramatic comparison: wholesale MAO is typically negative or below
  // loan-balance-implied acquisition; Sub-To wins because of rate arb.
  const wholesaleMAO = deal.maoWholesale ?? 0;
  const arvMid = deal.arvMid ?? 0;
  // Sub-To acquisition price ~ ARV minus equity (where equity = ARV - balance)
  // We don't store loanBalance on Deal, so we estimate from subToScore +
  // viability. For grand-slam deals, balance/ARV is < 85% per the
  // qualifier. Let's assume ~75% loan-to-ARV for the showcase math.
  const estimatedLoanBalance = Math.round(arvMid * 0.75);
  const subToAcquisition = estimatedLoanBalance + 3000; // + moving money
  const acquisitionEquity = arvMid - estimatedLoanBalance;
  // Cashflow: rent - estimated PITI. Estimate PITI as 0.55% of balance/mo
  // (rough proxy for ~3% rate + taxes + insurance).
  const estimatedPiti = Math.round(estimatedLoanBalance * 0.006);
  const monthlyCashflow = (deal.rentEstimate ?? 0) - estimatedPiti;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-line-subtle bg-bg-app/40 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
          <Home className="h-3.5 w-3.5 text-state-ai" />
          <span>{deal.propertyAddress},</span>
          <span>
            {deal.propertyCity}, {deal.propertyState}
          </span>
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-wide text-state-ai">
            Sub-To {deal.subToScore ?? "—"}/100 grand-slam
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Wholesale path — DIES */}
        <div className="space-y-2 rounded-md border border-state-danger/30 bg-state-danger/5 p-3">
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wide text-state-danger">
            <TrendingDown className="h-3 w-3" />
            Wholesale path
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase text-ink-muted">
              ARV mid
            </span>
            <span className="font-mono text-[14px] font-semibold text-ink-primary">
              {formatCurrency(arvMid)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase text-ink-muted">
              Wholesale MAO (70%)
            </span>
            <span
              className={cn(
                "font-mono text-[14px] font-semibold",
                wholesaleMAO < estimatedLoanBalance
                  ? "text-state-danger"
                  : "text-ink-primary"
              )}
            >
              {formatCurrency(wholesaleMAO)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase text-ink-muted">
              Loan balance
            </span>
            <span className="font-mono text-[14px] font-semibold text-ink-primary">
              {formatCurrency(estimatedLoanBalance)}
            </span>
          </div>
          <div className="mt-2 rounded-md bg-state-danger/10 px-2 py-1.5">
            <div className="font-mono text-[10.5px] uppercase tracking-wide text-state-danger">
              Verdict
            </div>
            <div className="mt-0.5 text-[12.5px] font-medium text-state-danger">
              {wholesaleMAO < estimatedLoanBalance
                ? `MAO is ${formatCurrency(estimatedLoanBalance - wholesaleMAO)} below loan balance — wholesale impossible. Deal dies.`
                : "MAO leaves no spread for the operator. Deal dies."}
            </div>
          </div>
        </div>

        {/* Sub-To path — WINS */}
        <div className="space-y-2 rounded-md border border-state-success/30 bg-state-success/5 p-3">
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wide text-state-success">
            <Sparkles className="h-3 w-3" />
            Sub-To path
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase text-ink-muted">
              Acquisition (balance + $3K)
            </span>
            <span className="font-mono text-[14px] font-semibold text-ink-primary">
              {formatCurrency(subToAcquisition)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase text-ink-muted">
              Asset value (ARV)
            </span>
            <span className="font-mono text-[14px] font-semibold text-ink-primary">
              {formatCurrency(arvMid)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase text-ink-muted">
              Equity captured
            </span>
            <span className="font-mono text-[14px] font-semibold text-state-success">
              {formatCurrency(acquisitionEquity)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[10.5px] uppercase text-ink-muted">
              Monthly cashflow
            </span>
            <span
              className={cn(
                "font-mono text-[14px] font-semibold",
                monthlyCashflow > 0 ? "text-state-success" : "text-state-danger"
              )}
            >
              {formatCurrency(monthlyCashflow)}/mo
            </span>
          </div>
          <div className="mt-2 rounded-md bg-state-success/10 px-2 py-1.5">
            <div className="font-mono text-[10.5px] uppercase tracking-wide text-state-success">
              Verdict
            </div>
            <div className="mt-0.5 text-[12.5px] font-medium text-state-success">
              ${Math.round(acquisitionEquity / 1000)}K equity captured at $0
              down + ${monthlyCashflow > 0 ? Math.round(monthlyCashflow) : 0}/mo
              cashflow. Inherited sub-5% rate locked in.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-state-ai/20 bg-state-ai/5 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-secondary">
        <span className="font-semibold text-state-ai">Why this matters:</span>{" "}
        ~80% of US mortgages are locked under 6% in 2026; new rates sit above
        6%. When a sub-3% homeowner needs to sell, a Sub-To offer that preserves
        their rate and protects their credit is often more attractive than a
        cash offer — and turns a wholesale-impossible deal into a $0-down
        equity-capture play. The Sub-To Qualifier flagged this as a grand-slam.
      </div>

      <div className="flex items-start gap-2 rounded-md border border-line-subtle bg-bg-app/30 px-3 py-2 text-[10.5px] leading-relaxed text-ink-muted">
        <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
        Loan balance + PITI in this view are estimates derived from the
        Sub-To viability score (true balance/rate not stored on Deal row).
        Real numbers come from the Sub-To Qualifier output once the operator
        provides the seller&apos;s actual loan info. Garn-St. Germain DOS clause
        applies on every Sub-To — not legal advice.
      </div>
    </div>
  );
}

function MarketHeatCard({
  bucket,
}: {
  bucket: {
    state: string;
    total: number;
    active: number;
    topScore: number;
    signalCounts: Record<string, number>;
    goldCount: number;
  };
}) {
  const totalSignals = Object.values(bucket.signalCounts).reduce(
    (sum, n) => sum + n,
    0
  );
  const sortedSignals = Object.entries(bucket.signalCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="rounded-md border border-line-subtle bg-bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md border border-steel/30 bg-steel/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-steel-bright">
            {bucket.state}
          </span>
          <span className="text-[12px] text-ink-secondary">
            {bucket.active} active · {bucket.total} total
          </span>
        </div>
        {bucket.goldCount > 0 ? (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-state-danger/30 bg-state-danger/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-state-danger">
            <Flame className="h-2.5 w-2.5" />
            {bucket.goldCount} gold
          </span>
        ) : null}
      </div>

      {totalSignals > 0 ? (
        <>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-bg-app">
            {sortedSignals.map(([type, count]) => {
              const pct = (count / totalSignals) * 100;
              return (
                <div
                  key={type}
                  className={cn(SIGNAL_COLORS[type] ?? "bg-ink-muted")}
                  style={{ width: `${pct}%` }}
                  title={`${SIGNAL_LABELS[type] ?? type}: ${count}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {sortedSignals.map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-bg-app/50 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-secondary"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    SIGNAL_COLORS[type] ?? "bg-ink-muted"
                  )}
                />
                {SIGNAL_LABELS[type] ?? type} · {count}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
          No signal data on these deals.
        </div>
      )}

      <div className="mt-2 text-[10.5px] text-ink-muted">
        Top motivation: <span className="text-ink-primary">{bucket.topScore}/100</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line-subtle bg-bg-app/30 px-2 py-1.5">
      <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13px] font-semibold text-ink-primary">
        {value}
      </div>
    </div>
  );
}

function Chip({
  label,
  icon,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "ai" | "muted" | "warning" | "success";
}) {
  const toneClass = {
    ai: "border-state-ai/30 bg-state-ai/10 text-state-ai",
    muted: "border-line-subtle bg-bg-app/50 text-ink-muted",
    warning: "border-state-warning/30 bg-state-warning/10 text-state-warning",
    success: "border-state-success/30 bg-state-success/10 text-state-success",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        toneClass
      )}
    >
      {icon}
      {label}
    </span>
  );
}

/**
 * Heuristic: infer the dominant distress signal from a deal's
 * recommended exit + source. Used by the Market Heat panel which only
 * has the list-endpoint data (no full signal blobs). Best-effort —
 * agents that score deals via the proper Distress Signal Analyst path
 * will eventually persist real signal counts to a denormalized field
 * we can read here directly.
 */
function inferDominantSignal(deal: Deal): string | null {
  if (deal.recommendedExit === "sub_to") return "pre_foreclosure";
  if (deal.recommendedExit === "novation") return "absentee";
  if (deal.recommendedExit === "brrrr") return "tax_delinquent";
  if (deal.recommendedExit === "wholesale") return "absentee";
  if (deal.recommendedExit === "decline") return "code_violation";
  if (deal.source === "mls_stale") return "expired_listing";
  if (deal.source === "absentee") return "absentee";
  if (deal.source === "distress") return "pre_foreclosure";
  return null;
}
