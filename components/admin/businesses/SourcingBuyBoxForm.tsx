"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PlayCircle,
  Plug,
  Save,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type ProviderStatus = {
  rentcast: boolean;
  axesso_zillow: boolean;
  realie: boolean;
};

type SourcingBuyBoxFormProps = {
  businessId: string;
  initialBuyBox: Record<string, unknown> | null;
  providers: ProviderStatus;
};

const PROPERTY_TYPE_OPTIONS = [
  { value: "sfr", label: "Single-family" },
  { value: "multi_family", label: "Multi-family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "mobile", label: "Mobile / manufactured" },
  { value: "land", label: "Land / lot" },
  { value: "commercial", label: "Commercial" }
] as const;

const DISTRESS_SIGNAL_OPTIONS = [
  { value: "pre_foreclosure", label: "Pre-foreclosure / NOD" },
  { value: "tax_delinquent", label: "Tax delinquent" },
  { value: "probate", label: "Probate / inherited" },
  { value: "divorce", label: "Divorce filing" },
  { value: "code_violation", label: "Code violation" },
  { value: "vacancy", label: "Vacancy signal" },
  { value: "absentee", label: "Absentee owner" },
  { value: "eviction", label: "Eviction filing" },
  { value: "expired_listing", label: "Expired listing" },
  { value: "delisted_underwater", label: "Delisted underwater" }
] as const;

export function SourcingBuyBoxForm({
  businessId,
  initialBuyBox,
  providers
}: SourcingBuyBoxFormProps) {
  const router = useRouter();

  const [markets, setMarkets] = useState<string[]>(
    (initialBuyBox?.markets as string[] | undefined) ?? []
  );
  const [marketInput, setMarketInput] = useState("");
  const [priceMin, setPriceMin] = useState<string>(
    initialBuyBox?.priceMin ? String(initialBuyBox.priceMin) : ""
  );
  const [priceMax, setPriceMax] = useState<string>(
    initialBuyBox?.priceMax ? String(initialBuyBox.priceMax) : ""
  );
  const [propertyTypes, setPropertyTypes] = useState<string[]>(
    (initialBuyBox?.propertyTypes as string[] | undefined) ?? ["sfr", "multi_family"]
  );
  const [distressSignals, setDistressSignals] = useState<string[]>(
    (initialBuyBox?.distressSignals as string[] | undefined) ?? [
      "pre_foreclosure",
      "tax_delinquent",
      "probate",
      "absentee",
      "delisted_underwater"
    ]
  );
  const [minMotivationScore, setMinMotivationScore] = useState<string>(
    String(initialBuyBox?.minMotivationScore ?? 60)
  );
  const [dailyIngestCap, setDailyIngestCap] = useState<string>(
    String(initialBuyBox?.dailyIngestCap ?? 100)
  );
  const [sweepHourLocal, setSweepHourLocal] = useState<string>(
    String(initialBuyBox?.sweepHourLocal ?? 6)
  );

  const [saving, setSaving] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [lastSweepResult, setLastSweepResult] = useState<
    | {
        imported: number;
        candidatesFound: number;
        duplicatesSkipped: number;
        belowThresholdSkipped: number;
        marketsQueried: number;
        errors: string[];
      }
    | null
  >(null);

  function toggleArrayMember(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  function addMarket() {
    const trimmed = marketInput.trim();
    if (!trimmed) return;
    if (markets.includes(trimmed)) {
      toast.error("Market already in list.");
      return;
    }
    setMarkets([...markets, trimmed]);
    setMarketInput("");
  }

  function removeMarket(market: string) {
    setMarkets(markets.filter((m) => m !== market));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        markets,
        priceMin: priceMin ? parseInt(priceMin, 10) : undefined,
        priceMax: priceMax ? parseInt(priceMax, 10) : undefined,
        propertyTypes,
        distressSignals,
        minMotivationScore: parseInt(minMotivationScore, 10),
        dailyIngestCap: parseInt(dailyIngestCap, 10),
        sweepHourLocal: parseInt(sweepHourLocal, 10)
      };
      const res = await fetchWithCsrf(`/api/admin/businesses/${businessId}/sourcing`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Save failed.");
      }
      toast.success("Buy-box saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function runSweepNow() {
    setSweeping(true);
    setLastSweepResult(null);
    try {
      const res = await fetchWithCsrf(`/api/admin/businesses/${businessId}/sourcing`, {
        method: "POST"
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Sweep failed.");
      }
      const data = (await res.json()) as { result: typeof lastSweepResult };
      setLastSweepResult(data.result);
      if (data.result && data.result.imported > 0) {
        toast.success(`Imported ${data.result.imported} new leads.`);
        router.refresh();
      } else {
        toast.error(
          "Sweep ran but no leads passed the filters. Check the result panel below."
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sweep failed.");
    } finally {
      setSweeping(false);
    }
  }

  const anyProviderConnected =
    providers.rentcast || providers.axesso_zillow || providers.realie;

  return (
    <div className="space-y-6">
      <Card
        className={
          anyProviderConnected
            ? "border-state-success/30 bg-state-success/5"
            : "border-state-warning/40 bg-state-warning/5"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Plug className="h-5 w-5" />
            Provider connections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!anyProviderConnected && (
            <div className="rounded-md border border-state-warning/40 bg-state-warning/10 p-3 text-state-warning">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium">
                    No property-data provider connected.
                  </div>
                  <div className="mt-1 text-xs text-state-warning/80">
                    Connect at least one of RentCast, Axesso Zillow, or Realie at{" "}
                    <Link
                      href="/admin/integrations"
                      className="underline hover:no-underline"
                    >
                      /admin/integrations
                    </Link>{" "}
                    to enable the daily sweep. Without one, agents fall back to web
                    search — slower and less reliable.
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <ProviderBadge label="RentCast" connected={providers.rentcast} />
            <ProviderBadge label="Axesso Zillow" connected={providers.axesso_zillow} />
            <ProviderBadge label="Realie" connected={providers.realie} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Target markets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-ink-muted">
            Add cities, zip codes, or counties. Formats accepted:
            <code className="mx-1 rounded bg-bg-surface-2 px-1.5 py-0.5">Memphis, TN</code>{" "}
            <code className="mx-1 rounded bg-bg-surface-2 px-1.5 py-0.5">38103</code>{" "}
            <code className="mx-1 rounded bg-bg-surface-2 px-1.5 py-0.5">Wayne County, MI</code>
          </div>
          <div className="flex gap-2">
            <Input
              value={marketInput}
              onChange={(e) => setMarketInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMarket();
                }
              }}
              placeholder="e.g. Memphis, TN"
              className="flex-1"
            />
            <Button type="button" onClick={addMarket} variant="outline">
              Add
            </Button>
          </div>
          {markets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {markets.map((market) => (
                <button
                  key={market}
                  type="button"
                  onClick={() => removeMarket(market)}
                  className="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-bg-surface-2 px-2 py-1 text-xs text-ink-primary transition-colors hover:border-state-danger/40 hover:text-state-danger"
                >
                  {market}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-ink-secondary">Price min ($)</label>
              <Input
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="40000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-secondary">Price max ($)</label>
              <Input
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="120000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-ink-secondary">Property types</label>
            <div className="flex flex-wrap gap-1.5">
              {PROPERTY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPropertyTypes(toggleArrayMember(propertyTypes, opt.value))}
                  className={
                    "rounded-md border px-3 py-1.5 text-xs transition-colors " +
                    (propertyTypes.includes(opt.value)
                      ? "border-steel bg-steel/10 text-steel-bright"
                      : "border-line-subtle bg-bg-surface-2 text-ink-muted hover:text-ink-primary")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-ink-secondary">
              Distress signals to prioritize
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DISTRESS_SIGNAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDistressSignals(toggleArrayMember(distressSignals, opt.value))
                  }
                  className={
                    "rounded-md border px-3 py-1.5 text-xs transition-colors " +
                    (distressSignals.includes(opt.value)
                      ? "border-state-warning bg-state-warning/10 text-state-warning"
                      : "border-line-subtle bg-bg-surface-2 text-ink-muted hover:text-ink-primary")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Sweep tuning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-ink-secondary">
                Min motivation score
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={minMotivationScore}
                onChange={(e) => setMinMotivationScore(e.target.value)}
              />
              <div className="text-[10px] text-ink-muted">
                Leads below this score don&apos;t get ingested.
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-secondary">Daily ingest cap</label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={dailyIngestCap}
                onChange={(e) => setDailyIngestCap(e.target.value)}
              />
              <div className="text-[10px] text-ink-muted">
                Hard cap per sweep — protects cost.
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-secondary">
                Sweep hour (24h local)
              </label>
              <Input
                type="number"
                min="0"
                max="23"
                value={sweepHourLocal}
                onChange={(e) => setSweepHourLocal(e.target.value)}
              />
              <div className="text-[10px] text-ink-muted">
                Fires once per day at or after this hour.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save buy-box
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={runSweepNow}
          disabled={sweeping || markets.length === 0 || !anyProviderConnected}
        >
          {sweeping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running sweep…
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Run sweep now
            </>
          )}
        </Button>
        {markets.length === 0 && (
          <span className="text-xs text-ink-muted">
            Add at least one market to enable sweep.
          </span>
        )}
      </div>

      {lastSweepResult && (
        <Card
          className={
            lastSweepResult.imported > 0
              ? "border-state-success/40 bg-state-success/5"
              : "border-state-warning/40 bg-state-warning/5"
          }
        >
          <CardHeader>
            <CardTitle className="text-base text-white">Last sweep result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <ResultStat label="Markets" value={lastSweepResult.marketsQueried} />
              <ResultStat label="Candidates" value={lastSweepResult.candidatesFound} />
              <ResultStat label="Duplicates" value={lastSweepResult.duplicatesSkipped} />
              <ResultStat
                label="Below score"
                value={lastSweepResult.belowThresholdSkipped}
              />
              <ResultStat
                label="Imported"
                value={lastSweepResult.imported}
                emphasis
              />
            </div>
            {lastSweepResult.errors.length > 0 && (
              <details className="text-xs text-ink-muted">
                <summary className="cursor-pointer hover:text-white">
                  {lastSweepResult.errors.length} error
                  {lastSweepResult.errors.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {lastSweepResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProviderBadge({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs " +
        (connected
          ? "border-state-success/40 bg-state-success/10 text-state-success"
          : "border-line-subtle bg-bg-surface-2 text-ink-muted")
      }
    >
      {connected ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
      <span className="font-medium">{label}</span>
      <span className="text-[10px] uppercase tracking-wide">
        {connected ? "connected" : "not connected"}
      </span>
    </div>
  );
}

function ResultStat({
  label,
  value,
  emphasis
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-md border border-line-subtle bg-bg-surface p-2 text-center">
      <div
        className={
          "font-mono text-2xl font-medium " +
          (emphasis ? "text-state-success" : "text-white")
        }
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}
