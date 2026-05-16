"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type CityOption = {
  value: string;
  label: string;
  scraperId: string;
  scraperLabel: string;
};

type SeverityTierOption = { value: number; label: string };

type Props = {
  businessId: string;
  initialFilters: {
    cities: string[];
    severityFilter: number[];
    dailyIngestCap: number;
  };
  catalogs: {
    tier1Cities: CityOption[];
    severityTiers: SeverityTierOption[];
  };
};

export function CodeViolationFiltersForm({
  businessId,
  initialFilters,
  catalogs
}: Props) {
  const router = useRouter();
  const [cities, setCities] = useState<string[]>(initialFilters.cities);
  const [severityFilter, setSeverityFilter] = useState<number[]>(
    initialFilters.severityFilter
  );
  const [dailyIngestCap, setDailyIngestCap] = useState<string>(
    String(initialFilters.dailyIngestCap)
  );
  const [saving, setSaving] = useState(false);

  function toggleCity(value: string) {
    setCities((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  function toggleSeverity(value: number) {
    setSeverityFilter((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function selectAllCities() {
    setCities(catalogs.tier1Cities.map((c) => c.value));
  }

  function clearCities() {
    setCities([]);
  }

  async function save() {
    setSaving(true);
    try {
      const cap = parseInt(dailyIngestCap, 10);
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/code-violations/filters`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cities,
            severityFilter,
            dailyIngestCap: Number.isFinite(cap) ? cap : 500
          })
        }
      );
      const payload = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "Save failed.");
      }
      toast.success(payload.message ?? "Filters saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-white">
            Target cities (Tier-1 scrapers)
          </CardTitle>
          <div className="flex gap-2 text-xs">
            <Button variant="ghost" size="sm" onClick={selectAllCities}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={clearCities}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-muted">
            Pick which cities the daily sweep targets. Leaving empty means
            &quot;all Tier-1 cities&quot;. Tier-2 generic Socrata/ArcGIS adapters
            (operator-added cities) always run if configured in
            <code className="ml-1 font-mono text-white">
              Business.config.codeViolation.customAdapters
            </code>
            .
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalogs.tier1Cities.map((c) => {
              const selected = cities.includes(c.value);
              return (
                <button
                  type="button"
                  key={`${c.scraperId}:${c.value}`}
                  onClick={() => toggleCity(c.value)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-steel/40 bg-steel/15 text-white"
                      : "border-line-subtle bg-bg-surface-2/40 text-ink-muted hover:text-white"
                  }`}
                >
                  <div>
                    <div>{c.value}</div>
                    <div className="text-[10.5px] text-ink-muted">
                      {c.scraperLabel}
                    </div>
                  </div>
                  {selected ? (
                    <span className="font-mono text-xs text-emerald-300">●</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-ink-muted">
            Selected: {cities.length}/{catalogs.tier1Cities.length}
          </div>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Severity tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-muted">
            Which severity tiers to ingest. Default skips Tier 4 (minor noise
            — late lawn cuts, signage violations). For an investor focused on
            distressed acquisition opportunities, Tier 1 + 2 is the highest-
            signal subset.
          </p>
          <div className="space-y-2">
            {catalogs.severityTiers.map((t) => {
              const selected = severityFilter.includes(t.value);
              return (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => toggleSeverity(t.value)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-steel/40 bg-steel/15 text-white"
                      : "border-line-subtle bg-bg-surface-2/40 text-ink-muted hover:text-white"
                  }`}
                >
                  <span>{t.label}</span>
                  {selected ? (
                    <span className="font-mono text-xs text-emerald-300">●</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Daily ingest cap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-ink-muted">
            Hard cap on records written per business per sweep. Default 500.
            Code-violation feeds can be voluminous (NYC alone ships 1000+
            daily) — the cap is the cost-control + spike-protection knob.
          </p>
          <Input
            type="number"
            min={0}
            max={2000}
            value={dailyIngestCap}
            onChange={(e) => setDailyIngestCap(e.target.value)}
            className="max-w-[180px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save filters
        </Button>
      </div>
    </div>
  );
}
