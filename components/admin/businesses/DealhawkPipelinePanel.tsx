"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Filter,
  Flame,
  Home,
  MapPin,
  Radar,
  Scale,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

import { usStateOptions } from "@/components/admin/businesses/schema";
import { Panel, PanelBody, PanelHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type DealSignal = {
  id: string;
  signalType: string;
  sourceType: string;
  sourceRef: string | null;
  citedDate: string | null;
  weight: number;
  confidence: string;
  notes: string | null;
};

type Deal = {
  id: string;
  status: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  livingSqft: number | null;
  yearBuilt: number | null;
  ownerName: string | null;
  ownerMailingAddress: string | null;
  ownerEntityType: string | null;
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
  sellerResponseState: string | null;
  firstContactAt: string | null;
  lastContactAt: string | null;
  nextTouchAt: string | null;
  contactAttempts: number;
  contractType: string | null;
  purchasePrice: number | null;
  assignmentFee: number | null;
  notes: string | null;
  updatedAt: string;
  signalCount?: number;
  signals?: DealSignal[];
};

type PipelineStage = {
  key: string;
  label: string;
  statuses: string[];
  tone: "muted" | "steel" | "warning" | "success" | "live" | "danger";
};

const STAGES: PipelineStage[] = [
  { key: "lead", label: "Lead", statuses: ["lead"], tone: "muted" },
  { key: "contacted", label: "Contacted", statuses: ["contacted"], tone: "steel" },
  { key: "qualified", label: "Qualified", statuses: ["qualified"], tone: "warning" },
  { key: "under_contract", label: "Under Contract", statuses: ["under_contract"], tone: "live" },
  { key: "closed", label: "Closed", statuses: ["assigned", "closed"], tone: "success" },
  { key: "dead", label: "Dead", statuses: ["dead"], tone: "danger" },
];

const EXIT_STRATEGY_LABELS: Record<string, string> = {
  wholesale: "Wholesale",
  brrrr: "BRRRR",
  flip: "Fix-and-flip",
  sub_to: "Subject-To",
  novation: "Novation",
  wrap: "Wraparound",
  lease_option: "Lease-option",
  contract_for_deed: "Contract-for-deed",
  decline: "Decline",
};

const EXIT_STRATEGY_TONE: Record<string, string> = {
  wholesale: "border-steel/30 bg-steel/10 text-steel-bright",
  brrrr: "border-state-success/30 bg-state-success/10 text-state-success",
  flip: "border-state-warning/30 bg-state-warning/10 text-state-warning",
  sub_to: "border-state-ai/30 bg-state-ai/10 text-state-ai",
  novation: "border-state-ai/30 bg-state-ai/10 text-state-ai",
  wrap: "border-state-ai/30 bg-state-ai/10 text-state-ai",
  lease_option: "border-state-ai/30 bg-state-ai/10 text-state-ai",
  contract_for_deed: "border-state-ai/30 bg-state-ai/10 text-state-ai",
  decline: "border-state-danger/30 bg-state-danger/10 text-state-danger",
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  pre_foreclosure: "Pre-foreclosure",
  tax_delinquent: "Tax delinquent",
  probate: "Probate",
  divorce: "Divorce",
  code_violation: "Code violation",
  vacancy: "Vacancy",
  absentee: "Absentee",
  eviction: "Eviction",
  expired_listing: "Expired listing",
  high_equity: "High equity (×1.5)",
  long_tenure: "Long tenure (×1.3)",
};

const RESPONSE_STATE_LABELS: Record<string, string> = {
  no_response: "No response",
  not_interested: "Not interested",
  wanted_time: "Wanted time",
  objection: "Had objection",
  warm: "Warm",
  closed: "Closed",
};

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function daysFromToday(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  } catch {
    return null;
  }
}

function motivationTone(score: number): string {
  if (score >= 80) return "border-state-danger/40 bg-state-danger/10 text-state-danger";
  if (score >= 60) return "border-state-warning/40 bg-state-warning/10 text-state-warning";
  if (score >= 40) return "border-steel/30 bg-steel/10 text-steel-bright";
  return "border-line-subtle bg-bg-app text-ink-muted";
}

type DealhawkPipelinePanelProps = {
  businessId: string;
};

export function DealhawkPipelinePanel({ businessId }: DealhawkPipelinePanelProps) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [exitFilter, setExitFilter] = useState<string>("all");
  const [minMotivation, setMinMotivation] = useState<number>(0);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadDeals();
  }, [businessId, stateFilter, exitFilter, minMotivation]);

  useEffect(() => {
    if (selectedDealId) {
      void loadDealDetail(selectedDealId);
    } else {
      setSelectedDeal(null);
    }
  }, [selectedDealId]);

  async function loadDeals() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stateFilter !== "all") params.set("state", stateFilter);
      if (exitFilter !== "all") params.set("exit", exitFilter);
      if (minMotivation > 0) params.set("minMotivation", String(minMotivation));
      const res = await fetch(
        `/api/admin/businesses/${businessId}/deals?${params.toString()}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error || "Failed to load deals.");
        return;
      }
      const data = (await res.json()) as { deals: Deal[] };
      setDeals(data.deals);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deals.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDealDetail(dealId: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/admin/businesses/${businessId}/deals/${dealId}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        toast.error("Failed to load deal.");
        return;
      }
      const data = (await res.json()) as { deal: Deal };
      setSelectedDeal(data.deal);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deal.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function patchDeal(
    dealId: string,
    updates: {
      status?: string;
      sellerResponseState?: string | null;
      notes?: string;
      nextTouchAt?: string | null;
    }
  ) {
    setSaving(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/deals/${dealId}`,
        { method: "PATCH", body: JSON.stringify(updates) }
      );
      const data = (await res.json()) as {
        deal?: Deal;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Update failed.");
        return;
      }
      toast.success("Deal updated.");
      await loadDeals();
      if (selectedDealId) await loadDealDetail(selectedDealId);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  // Group deals into pipeline columns.
  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of STAGES) {
      map.set(stage.key, []);
    }
    for (const deal of deals) {
      const stage = STAGES.find((s) => s.statuses.includes(deal.status));
      if (stage) map.get(stage.key)!.push(deal);
    }
    return map;
  }, [deals]);

  const availableStates = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) set.add(d.propertyState);
    return Array.from(set).sort();
  }, [deals]);

  // Totals — shown in the panel header.
  const totals = useMemo(() => {
    let activeCount = 0;
    let underContractValue = 0;
    let assignedFees = 0;
    for (const deal of deals) {
      if (!["dead", "closed"].includes(deal.status)) activeCount++;
      if (deal.status === "under_contract" && deal.assignmentFee) {
        underContractValue += deal.assignmentFee;
      }
      if (
        (deal.status === "assigned" || deal.status === "closed") &&
        deal.assignmentFee
      ) {
        assignedFees += deal.assignmentFee;
      }
    }
    return { activeCount, underContractValue, assignedFees };
  }, [deals]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          label="Deal Pipeline"
          action={
            <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
              <span className="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-bg-app/50 px-1.5 py-0.5">
                <Activity className="h-2.5 w-2.5" />
                {totals.activeCount} active
              </span>
              {totals.underContractValue > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-state-warning/30 bg-state-warning/10 px-1.5 py-0.5 text-state-warning">
                  <DollarSign className="h-2.5 w-2.5" />
                  {formatCurrency(totals.underContractValue)} in contract
                </span>
              ) : null}
              {totals.assignedFees > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-state-success/30 bg-state-success/10 px-1.5 py-0.5 text-state-success">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {formatCurrency(totals.assignedFees)} closed
                </span>
              ) : null}
            </div>
          }
        />
        <PanelBody className="space-y-4">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line-subtle bg-bg-app/30 px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
              <Filter className="h-3 w-3" />
              Filters
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="h-8 min-w-[140px] text-[12px]">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {availableStates.length > 0 ? (
                    availableStates.map((s) => {
                      const stateOption = usStateOptions.find((o) => o.value === s);
                      return (
                        <SelectItem key={s} value={s}>
                          {stateOption?.label ?? s} ({s})
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="__none__" disabled>
                      No deals yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Select value={exitFilter} onValueChange={setExitFilter}>
                <SelectTrigger className="h-8 min-w-[140px] text-[12px]">
                  <SelectValue placeholder="All exits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All exit strategies</SelectItem>
                  {Object.entries(EXIT_STRATEGY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
                  Min score
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minMotivation}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setMinMotivation(
                      Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
                    );
                  }}
                  className="h-8 w-[70px] text-[12px]"
                />
              </div>

              {(stateFilter !== "all" || exitFilter !== "all" || minMotivation > 0) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setStateFilter("all");
                    setExitFilter("all");
                    setMinMotivation(0);
                  }}
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {/* Kanban columns */}
          {loading ? (
            <div className="py-8 text-center font-mono text-[11.5px] uppercase tracking-wide text-ink-muted">
              Loading pipeline…
            </div>
          ) : deals.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-subtle bg-bg-app/30 px-3 py-8 text-center">
              <Radar className="mx-auto h-5 w-5 text-ink-muted" />
              <div className="mt-2 text-[13px] font-medium text-ink-primary">
                No deals match these filters
              </div>
              <div className="mt-1 text-[11.5px] text-ink-secondary">
                Clear filters or widen the motivation threshold. Seeded Dealhawk
                businesses start with 15 demo deals across Dallas, Phoenix, and
                Atlanta.
              </div>
            </div>
          ) : (
            <div className="grid gap-2 overflow-x-auto pb-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {STAGES.map((stage) => {
                const stageDeals = dealsByStage.get(stage.key) ?? [];
                return (
                  <div
                    key={stage.key}
                    className="flex min-w-[220px] flex-col gap-2 rounded-md border border-line-subtle bg-bg-app/30 p-2"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                        {stage.label}
                      </span>
                      <span className="rounded-md border border-line-subtle bg-bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary">
                        {stageDeals.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {stageDeals.length === 0 ? (
                        <div className="rounded-md border border-dashed border-line-subtle bg-bg-surface/30 px-2 py-3 text-center font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                          Empty
                        </div>
                      ) : (
                        stageDeals.map((deal) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            onSelect={() => setSelectedDealId(deal.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Sheet
        open={!!selectedDealId}
        onOpenChange={(open) => !open && setSelectedDealId(null)}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {detailLoading ? (
            <div className="py-8 text-center font-mono text-[11.5px] uppercase tracking-wide text-ink-muted">
              Loading…
            </div>
          ) : selectedDeal ? (
            <DealDetailContent
              deal={selectedDeal}
              saving={saving}
              onPatchStatus={(status) => patchDeal(selectedDeal.id, { status })}
              onPatchResponseState={(sellerResponseState) =>
                patchDeal(selectedDeal.id, { sellerResponseState })
              }
              onPatchNotes={(notes) => patchDeal(selectedDeal.id, { notes })}
              onPatchNextTouch={(nextTouchAt) =>
                patchDeal(selectedDeal.id, { nextTouchAt })
              }
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DealCard({ deal, onSelect }: { deal: Deal; onSelect: () => void }) {
  const touchDays = daysFromToday(deal.nextTouchAt);
  const overdueTouch = touchDays !== null && touchDays < 0;
  const imminentTouch = touchDays !== null && touchDays >= 0 && touchDays <= 1;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col gap-1.5 rounded-md border border-line-subtle bg-bg-surface px-2.5 py-2 text-left transition-colors hover:border-steel/40 hover:bg-bg-surface-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-ink-primary">
            {deal.propertyAddress}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-secondary">
            <MapPin className="h-2.5 w-2.5" />
            {deal.propertyCity}, {deal.propertyState}
          </div>
        </div>
        <div
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border font-mono text-[11px] font-bold",
            motivationTone(deal.motivationScore)
          )}
          title={`Motivation score: ${deal.motivationScore}/100`}
        >
          {deal.motivationScore}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {deal.recommendedExit ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide",
              EXIT_STRATEGY_TONE[deal.recommendedExit] ??
                "border-line-subtle bg-bg-app text-ink-muted"
            )}
          >
            {EXIT_STRATEGY_LABELS[deal.recommendedExit] ?? deal.recommendedExit}
          </span>
        ) : null}
        {deal.subToScore && deal.subToScore >= 75 ? (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-state-ai/30 bg-state-ai/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-state-ai">
            <Sparkles className="h-2 w-2" />
            Sub-To {deal.subToScore}
          </span>
        ) : null}
        {deal.signalCount && deal.signalCount > 0 ? (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-line-subtle bg-bg-app/50 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-muted">
            <Radar className="h-2 w-2" />
            {deal.signalCount}
          </span>
        ) : null}
      </div>

      {deal.arvMid ? (
        <div className="grid grid-cols-3 gap-1 rounded-md border border-line-subtle bg-bg-app/40 px-1.5 py-1 font-mono text-[9.5px]">
          <div>
            <div className="text-ink-muted">ARV</div>
            <div className="text-ink-secondary">
              {deal.arvMid >= 1000
                ? `$${Math.round(deal.arvMid / 1000)}K`
                : formatCurrency(deal.arvMid)}
            </div>
          </div>
          <div>
            <div className="text-ink-muted">MAO·W</div>
            <div className="text-ink-secondary">
              {deal.maoWholesale && deal.maoWholesale >= 1000
                ? `$${Math.round(deal.maoWholesale / 1000)}K`
                : formatCurrency(deal.maoWholesale)}
            </div>
          </div>
          <div>
            <div className="text-ink-muted">Rent</div>
            <div className="text-ink-secondary">
              {formatCurrency(deal.rentEstimate)}
            </div>
          </div>
        </div>
      ) : null}

      {deal.status === "under_contract" && deal.assignmentFee ? (
        <div className="inline-flex items-center gap-1 rounded-md border border-state-warning/30 bg-state-warning/10 px-1.5 py-0.5 font-mono text-[10px] text-state-warning">
          <DollarSign className="h-2.5 w-2.5" />
          {formatCurrency(deal.assignmentFee)} assignment fee
        </div>
      ) : null}

      {deal.status === "assigned" || deal.status === "closed" ? (
        deal.assignmentFee ? (
          <div className="inline-flex items-center gap-1 rounded-md border border-state-success/30 bg-state-success/10 px-1.5 py-0.5 font-mono text-[10px] text-state-success">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {formatCurrency(deal.assignmentFee)} collected
          </div>
        ) : null
      ) : null}

      {deal.nextTouchAt ? (
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide",
            overdueTouch
              ? "border-state-danger/30 bg-state-danger/10 text-state-danger"
              : imminentTouch
                ? "border-state-warning/30 bg-state-warning/10 text-state-warning"
                : "border-line-subtle bg-bg-app/50 text-ink-muted"
          )}
        >
          <Calendar className="h-2.5 w-2.5" />
          {overdueTouch
            ? `Overdue ${Math.abs(touchDays!)}d`
            : imminentTouch
              ? touchDays === 0
                ? "Touch today"
                : "Touch tomorrow"
              : `Touch ${formatDate(deal.nextTouchAt)}`}
        </div>
      ) : null}
    </button>
  );
}

function DealDetailContent({
  deal,
  saving,
  onPatchStatus,
  onPatchResponseState,
  onPatchNotes,
  onPatchNextTouch,
}: {
  deal: Deal;
  saving: boolean;
  onPatchStatus: (status: string) => void;
  onPatchResponseState: (state: string | null) => void;
  onPatchNotes: (notes: string) => void;
  onPatchNextTouch: (iso: string | null) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(deal.notes ?? "");
  const [nextTouchDraft, setNextTouchDraft] = useState(
    deal.nextTouchAt ? deal.nextTouchAt.slice(0, 10) : ""
  );

  useEffect(() => {
    setNotesDraft(deal.notes ?? "");
    setNextTouchDraft(deal.nextTouchAt ? deal.nextTouchAt.slice(0, 10) : "");
  }, [deal.id, deal.notes, deal.nextTouchAt]);

  const nextStatus = useMemo(() => {
    switch (deal.status) {
      case "lead":
        return { value: "contacted", label: "Mark Contacted" };
      case "contacted":
        return { value: "qualified", label: "Mark Qualified" };
      case "qualified":
        return { value: "under_contract", label: "Mark Under Contract" };
      case "under_contract":
        return { value: "assigned", label: "Mark Assigned" };
      case "assigned":
        return { value: "closed", label: "Mark Closed" };
      default:
        return null;
    }
  }, [deal.status]);

  return (
    <>
      <SheetHeader className="space-y-1 border-b border-line-subtle pb-3">
        <div className="flex items-center gap-1.5">
          <Home className="h-3.5 w-3.5 text-steel-bright" />
          <span className="inline-flex items-center rounded-md border border-steel/30 bg-steel/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-steel-bright">
            {deal.propertyState}
          </span>
          <SheetTitle className="text-[15px] font-semibold text-ink-primary">
            {deal.propertyAddress}
          </SheetTitle>
        </div>
        <SheetDescription className="text-[12px] text-ink-secondary">
          {deal.propertyCity}, {deal.propertyState} {deal.propertyZip} ·{" "}
          {deal.bedrooms ?? "—"} bd / {deal.bathrooms ?? "—"} ba ·{" "}
          {deal.livingSqft ? `${deal.livingSqft.toLocaleString()} sqft` : "—"} ·{" "}
          {deal.yearBuilt ?? "—"}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-4 space-y-4">
        {/* Motivation + signals */}
        <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
              Motivation & signal stack
            </div>
            <div
              className={cn(
                "flex h-8 w-10 items-center justify-center rounded-md border font-mono text-[12px] font-bold",
                motivationTone(deal.motivationScore)
              )}
            >
              {deal.motivationScore}
            </div>
          </div>
          {deal.signals && deal.signals.length > 0 ? (
            <div className="mt-2 space-y-1">
              {deal.signals.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-start gap-2 rounded-sm bg-bg-surface/50 px-2 py-1"
                >
                  <Flame className="mt-0.5 h-3 w-3 flex-shrink-0 text-state-warning" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      <span className="font-medium text-ink-primary">
                        {SIGNAL_TYPE_LABELS[signal.signalType] ?? signal.signalType}
                      </span>
                      <span className="font-mono text-[9.5px] uppercase text-ink-muted">
                        +{signal.weight} weight · {signal.confidence} conf
                      </span>
                      {signal.sourceRef ? (
                        <span className="font-mono text-[9.5px] text-ink-muted">
                          {signal.sourceRef}
                        </span>
                      ) : null}
                    </div>
                    {signal.notes ? (
                      <div className="mt-0.5 text-[10.5px] text-ink-secondary">
                        {signal.notes}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[11.5px] text-ink-muted">
              No signals attached.
            </div>
          )}
        </div>

        {/* Underwriting */}
        <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Four-MAO underwriting
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            <Stat label="ARV (low/mid/high)" value={
              deal.arvLow && deal.arvHigh
                ? `${formatCurrency(deal.arvLow)} / ${formatCurrency(deal.arvMid)} / ${formatCurrency(deal.arvHigh)}`
                : "—"
            } />
            <Stat label="Rent est." value={`${formatCurrency(deal.rentEstimate)}/mo`} />
            <Stat label="Rehab (L / M / H)" value={
              deal.rehabLight
                ? `${formatCurrency(deal.rehabLight)} / ${formatCurrency(deal.rehabMedium)} / ${formatCurrency(deal.rehabHeavy)}`
                : "—"
            } />
            <Stat
              label={
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Recommended
                </span>
              }
              value={
                deal.recommendedExit
                  ? EXIT_STRATEGY_LABELS[deal.recommendedExit] ?? deal.recommendedExit
                  : "—"
              }
            />
            <Stat label="MAO · Wholesale" value={formatCurrency(deal.maoWholesale)} />
            <Stat label="MAO · BRRRR" value={formatCurrency(deal.maoBrrrr)} />
            <Stat label="MAO · Fix-and-flip" value={formatCurrency(deal.maoFlip)} />
            <Stat
              label="Sub-To viability"
              value={
                deal.subToScore !== null
                  ? `${deal.subToViability ?? "—"} (${deal.subToScore}/100)`
                  : "—"
              }
            />
          </div>
        </div>

        {/* Owner */}
        <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Owner of record
          </div>
          <div className="mt-1 text-[12px] text-ink-primary">
            {deal.ownerName ?? "—"}{" "}
            {deal.ownerEntityType ? (
              <span className="ml-1 rounded-md border border-line-subtle bg-bg-app px-1 py-0.5 font-mono text-[9.5px] uppercase text-ink-muted">
                {deal.ownerEntityType}
              </span>
            ) : null}
          </div>
          {deal.ownerMailingAddress ? (
            <div className="mt-0.5 text-[11px] text-ink-secondary">
              Mailing: {deal.ownerMailingAddress}
            </div>
          ) : null}
        </div>

        {/* Stage transition */}
        <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Pipeline stage
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-steel/30 bg-steel/10 px-2 py-0.5 text-[12px] font-medium text-steel-bright">
              {STAGES.find((s) => s.statuses.includes(deal.status))?.label ??
                deal.status}
            </span>
            {nextStatus ? (
              <Button
                size="sm"
                onClick={() => onPatchStatus(nextStatus.value)}
                disabled={saving}
              >
                <ArrowRight className="mr-1 h-3 w-3" />
                {nextStatus.label}
              </Button>
            ) : null}
            {deal.status !== "dead" && deal.status !== "closed" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPatchStatus("dead")}
                disabled={saving}
              >
                <Archive className="mr-1 h-3 w-3" />
                Mark dead
              </Button>
            ) : null}
          </div>

          <div className="mt-3 space-y-1.5">
            <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
              Seller response state
            </label>
            <Select
              value={deal.sellerResponseState ?? "__none__"}
              onValueChange={(v) =>
                onPatchResponseState(v === "__none__" ? null : v)
              }
              disabled={saving}
            >
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— not set —</SelectItem>
                {Object.entries(RESPONSE_STATE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 space-y-1.5">
            <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
              Next touch date
            </label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={nextTouchDraft}
                onChange={(e) => setNextTouchDraft(e.target.value)}
                className="h-8 text-[12px]"
                disabled={saving}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onPatchNextTouch(
                    nextTouchDraft ? new Date(nextTouchDraft).toISOString() : null
                  )
                }
                disabled={saving}
              >
                Save
              </Button>
              {deal.nextTouchAt ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNextTouchDraft("");
                    onPatchNextTouch(null);
                  }}
                  disabled={saving}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="text-[10.5px] text-ink-muted">
              Contacts so far: {deal.contactAttempts}
              {deal.firstContactAt
                ? ` · First contact ${formatDate(deal.firstContactAt)}`
                : ""}
              {deal.lastContactAt
                ? ` · Last ${formatDate(deal.lastContactAt)}`
                : ""}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Operator notes
          </div>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            className="mt-2 min-h-[120px] text-[12px]"
            disabled={saving}
            placeholder="Per-deal notes: seller context, attorney details, deal-specific terms, objections raised and handled..."
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => onPatchNotes(notesDraft)}
              disabled={saving || notesDraft === (deal.notes ?? "")}
            >
              Save notes
            </Button>
          </div>
        </div>

        {/* Contract (read-only; set via contract endpoints in Phase 5) */}
        {deal.contractType ? (
          <div className="rounded-md border border-state-success/30 bg-state-success/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-state-success" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-state-success">
                Contract on file
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <Stat label="Contract type" value={deal.contractType} />
              <Stat label="Purchase price" value={formatCurrency(deal.purchasePrice)} />
              <Stat label="Assignment fee" value={formatCurrency(deal.assignmentFee)} />
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-muted" />
            <div className="text-[11.5px] leading-relaxed text-ink-secondary">
              No binding contract on this deal. Contract generation requires
              dealMode = &quot;contract&quot; and an active AttorneyProfile for
              {" "}
              <span className="font-mono text-ink-primary">
                {deal.propertyState}
              </span>
              . Manage both in the Dealhawk Desk panel (Overview tab).
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 text-[12.5px] text-ink-primary">{value}</div>
    </div>
  );
}
