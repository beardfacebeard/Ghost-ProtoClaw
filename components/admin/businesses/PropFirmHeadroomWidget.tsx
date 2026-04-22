"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type RuleHeadroom = {
  name: string;
  label: string;
  capPct: number;
  capUsd: number;
  consumedUsd: number;
  consumedPct: number;
  remainingUsd: number;
  remainingPct: number;
  warning: "ok" | "watch" | "near" | "bust";
  note?: string;
};

type HeadroomSummary = {
  profileId: string;
  firmKey: string;
  planName: string;
  startingBalance: number;
  highWaterMark: number;
  currentEquity: number;
  rules: RuleHeadroom[];
  overallWarning: "ok" | "watch" | "near" | "bust";
  tradingDaysSoFar: number;
  minTradingDays: number;
};

type Props = {
  businessId: string;
};

function warningPill(warning: RuleHeadroom["warning"]) {
  switch (warning) {
    case "ok":
      return "border-state-success/30 bg-state-success/10 text-state-success";
    case "watch":
      return "border-steel/30 bg-steel/10 text-steel-bright";
    case "near":
      return "border-state-warning/30 bg-state-warning/10 text-state-warning";
    case "bust":
      return "border-state-danger/30 bg-state-danger/10 text-state-danger";
  }
}

function barColor(warning: RuleHeadroom["warning"]) {
  switch (warning) {
    case "ok":
      return "bg-state-success";
    case "watch":
      return "bg-steel";
    case "near":
      return "bg-state-warning";
    case "bust":
      return "bg-state-danger";
  }
}

export function PropFirmHeadroomWidget({ businessId }: Props) {
  const [summary, setSummary] = useState<HeadroomSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/businesses/${businessId}/prop-firm/headroom`,
          { credentials: "same-origin" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { summary: HeadroomSummary | null };
        if (alive) setSummary(data.summary);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [businessId]);

  if (loading && !summary) {
    return null;
  }

  if (!summary) {
    return null;
  }

  return (
    <Panel variant={summary.overallWarning === "bust" ? "danger" : "default"}>
      <PanelHeader
        label="Prop-firm headroom"
        action={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide",
              warningPill(summary.overallWarning)
            )}
          >
            {summary.overallWarning === "bust" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Activity className="h-3 w-3" />
            )}
            {summary.overallWarning}
          </span>
        }
      />
      <PanelBody className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricCell
            label="Equity"
            value={`$${summary.currentEquity.toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}`}
          />
          <MetricCell
            label="High-water mark"
            value={`$${summary.highWaterMark.toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}`}
          />
          <MetricCell
            label="Trading days"
            value={`${summary.tradingDaysSoFar}${
              summary.minTradingDays > 0 ? ` / ${summary.minTradingDays}` : ""
            }`}
          />
        </div>

        {summary.rules.length === 0 ? (
          <p className="text-[12px] text-ink-secondary">
            The active profile has no structured rules to track.
          </p>
        ) : (
          <div className="space-y-2">
            {summary.rules.map((rule) => (
              <RuleBar key={rule.name} rule={rule} />
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13px] font-semibold text-ink-primary">
        {value}
      </div>
    </div>
  );
}

function RuleBar({ rule }: { rule: RuleHeadroom }) {
  const pct = Math.min(1, Math.max(0, rule.consumedPct)) * 100;
  return (
    <div className="rounded-md border border-line-subtle bg-bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-medium text-ink-primary">
          {rule.label}
        </div>
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
            warningPill(rule.warning)
          )}
        >
          {(rule.consumedPct * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-surface-2">
        <div
          className={cn("h-full transition-all", barColor(rule.warning))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-secondary">
        <span>
          Cap: ${rule.capUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          {" · "}
          Used: ${rule.consumedUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span className="font-mono text-ink-muted">
          ${rule.remainingUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} left
        </span>
      </div>
      {rule.note ? (
        <div className="mt-1 text-[10.5px] text-ink-muted">{rule.note}</div>
      ) : null}
    </div>
  );
}
