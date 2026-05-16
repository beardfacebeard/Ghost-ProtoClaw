"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type DocTypeOption = { value: string; label: string };

type Props = {
  businessId: string;
  initialFilters: {
    states: string[];
    documentTypes: string[];
    priorityCounties: string[];
    dailyIngestCap: number;
  };
  catalogs: {
    allStateCodes: string[];
    documentTypes: DocTypeOption[];
  };
};

export function PreForeclosureFiltersForm({
  businessId,
  initialFilters,
  catalogs
}: Props) {
  const router = useRouter();
  const [states, setStates] = useState<string[]>(initialFilters.states);
  const [documentTypes, setDocumentTypes] = useState<string[]>(
    initialFilters.documentTypes
  );
  const [counties, setCounties] = useState<string[]>(initialFilters.priorityCounties);
  const [countyInput, setCountyInput] = useState("");
  const [dailyIngestCap, setDailyIngestCap] = useState<string>(
    String(initialFilters.dailyIngestCap)
  );
  const [saving, setSaving] = useState(false);

  function toggleState(code: string) {
    setStates((prev) => (prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]));
  }

  function toggleDocType(value: string) {
    setDocumentTypes((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function addCounty() {
    const trimmed = countyInput.trim();
    if (!trimmed) return;
    if (counties.includes(trimmed)) {
      toast.error("County already in list.");
      return;
    }
    setCounties((prev) => [...prev, trimmed]);
    setCountyInput("");
  }

  function removeCounty(c: string) {
    setCounties((prev) => prev.filter((county) => county !== c));
  }

  function selectAllStates() {
    setStates(catalogs.allStateCodes);
  }

  function clearStates() {
    setStates([]);
  }

  async function save() {
    setSaving(true);
    try {
      const cap = parseInt(dailyIngestCap, 10);
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/foreclosures/filters`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            states,
            documentTypes,
            priorityCounties: counties,
            dailyIngestCap: Number.isFinite(cap) ? cap : 200
          })
        }
      );
      const payload = (await res.json()) as { ok?: boolean; message?: string; error?: string };
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
          <CardTitle className="text-base text-white">States allowlist</CardTitle>
          <div className="flex gap-2 text-xs">
            <Button variant="ghost" size="sm" onClick={selectAllStates}>
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={clearStates}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-muted">
            Restrict the daily sweep to leads in these states. Leaving empty means "all states".
            Outreach for a lead still requires the per-state attestation regardless of this
            allowlist.
          </p>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {catalogs.allStateCodes.map((code) => {
              const selected = states.includes(code);
              return (
                <button
                  type="button"
                  key={code}
                  onClick={() => toggleState(code)}
                  className={`rounded-md border px-2 py-1.5 text-center font-mono text-xs transition-colors ${
                    selected
                      ? "border-steel/40 bg-steel/15 text-white"
                      : "border-line-subtle bg-bg-surface-2/40 text-ink-muted hover:text-white"
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-ink-muted">
            Selected: {states.length}/{catalogs.allStateCodes.length}
          </div>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Document types</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-muted">
            Which foreclosure document types should be ingested. Early-stage (NOD, LP) is the
            usual default — longer lead-time before auction. Late-stage (NOTS, NS) has too
            short a window for soft-touch acquisition. Auction bidding is out of scope.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {catalogs.documentTypes.map((d) => {
              const selected = documentTypes.includes(d.value);
              return (
                <button
                  type="button"
                  key={d.value}
                  onClick={() => toggleDocType(d.value)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-steel/40 bg-steel/15 text-white"
                      : "border-line-subtle bg-bg-surface-2/40 text-ink-muted hover:text-white"
                  }`}
                >
                  <span>{d.label}</span>
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
          <CardTitle className="text-base text-white">Priority counties (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-ink-muted">
            Counties the County Records Scraper Agent should hit directly when scraping scripts
            are wired (commit-3 follow-up). One per row. Format: "Maricopa, AZ" or
            "Miami-Dade, FL". Today the County Records Scraper Agent runs via ATTOM and CSV; this
            list configures the priority order for direct scraping when the scripts go live.
          </p>
          <div className="flex gap-2">
            <Input
              value={countyInput}
              onChange={(e) => setCountyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCounty();
                }
              }}
              placeholder="Maricopa, AZ"
              className="flex-1 font-mono text-xs"
            />
            <Button type="button" onClick={addCounty}>
              Add
            </Button>
          </div>
          {counties.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {counties.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-surface-2/40 px-2 py-1 font-mono text-xs text-white"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCounty(c)}
                    className="text-ink-muted hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Daily ingest cap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-ink-muted">
            Hard cap on records written per business per sweep. Default 200. Stops the sweep
            the moment the cap is hit even if more candidates are available — cost-control + spike
            protection.
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
