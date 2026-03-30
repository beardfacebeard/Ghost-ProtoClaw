"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  Siren,
  XCircle
} from "lucide-react";

import { SectionHeader } from "@/components/admin/SectionHeader";
import { JsonViewer } from "@/components/admin/JsonViewer";
import { HealthCheckCard } from "@/components/admin/health/HealthCheckCard";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type HealthCheckResult = {
  name: string;
  status: "ok" | "warning" | "error" | "unconfigured";
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
  checkedAt: string;
};

type SystemHealthReport = {
  overall: "healthy" | "degraded" | "critical";
  checkedAt: string;
  checks: HealthCheckResult[];
};

function getBannerMeta(status: SystemHealthReport["overall"]) {
  switch (status) {
    case "critical":
      return {
        icon: XCircle,
        className: "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
        label: "Critical issues require attention"
      };
    case "degraded":
      return {
        icon: AlertTriangle,
        className: "border-brand-amber/30 bg-brand-amber/10 text-brand-amber",
        label: "Some issues detected - review below"
      };
    default:
      return {
        icon: CheckCircle2,
        className: "border-status-active/30 bg-status-active/10 text-status-active",
        label: "All systems operational"
      };
  }
}

export default function HealthPage() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(60);

  async function loadHealthReport() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/health/full", {
        method: "GET",
        cache: "no-store"
      });
      const payload = (await response.json()) as SystemHealthReport & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load health report.");
      }

      setReport(payload);
      setCountdown(60);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load health report."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealthReport();
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          void loadHealthReport();
          return 60;
        }

        return current - 1;
      });
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [autoRefresh]);

  const coreChecks = useMemo(
    () =>
      report?.checks.filter((check) =>
        [
          "Database",
          "OpenClaw Runtime",
          "Email Provider",
          "Storage Provider"
        ].includes(check.name)
      ) ?? [],
    [report]
  );
  const integrationChecks = useMemo(
    () => report?.checks.filter((check) => check.name.startsWith("Integration: ")) ?? [],
    [report]
  );
  const operationalChecks = useMemo(
    () =>
      report?.checks.filter((check) =>
        ["Pending Approvals", "Expired Approvals"].includes(check.name)
      ) ?? [],
    [report]
  );

  const bannerMeta = report ? getBannerMeta(report.overall) : null;
  const BannerIcon = bannerMeta?.icon ?? Activity;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="System Health"
        description="Real-time status of all system components"
        action={
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              Last checked{" "}
              {report ? new Date(report.checkedAt).toLocaleString() : "waiting..."}
            </div>
            <Button type="button" variant="outline" onClick={() => void loadHealthReport()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      {report && bannerMeta ? (
        <div className={`rounded-2xl border p-4 ${bannerMeta.className}`}>
          <div className="flex items-center gap-3 font-medium">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
            <BannerIcon className="h-5 w-5" />
            <span>{bannerMeta.label}</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          icon={<Siren className="h-6 w-6" />}
          title="Health report unavailable"
          description={error}
          action={
            <Button type="button" onClick={() => void loadHealthReport()}>
              Retry
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {coreChecks.map((check) => (
          <HealthCheckCard key={check.name} check={check} />
        ))}
      </div>

      <section className="space-y-4">
        <div>
          <div className="text-lg font-semibold text-white">Connected Integrations</div>
          <div className="text-sm text-slate-400">
            Status pulled from your integration registry.
          </div>
        </div>

        {integrationChecks.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-6 w-6" />}
            title="No integrations connected"
            description="Connect integrations to see their runtime status here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {integrationChecks.map((check) => (
              <HealthCheckCard key={check.name} check={check} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-lg font-semibold text-white">Operational Checks</div>
          <div className="text-sm text-slate-400">
            Approval queue status and automatic expiry housekeeping.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {operationalChecks.map((check) => (
            <HealthCheckCard key={check.name} check={check} />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ghost-border bg-ghost-surface p-4">
        <div>
          <div className="text-sm font-medium text-white">
            Auto-refresh every 60 seconds
          </div>
          <div className="text-sm text-slate-400">
            {autoRefresh
              ? `Next refresh in ${countdown}s`
              : "Auto-refresh is paused."}
          </div>
        </div>
        <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
      </div>

      <div className="rounded-2xl border border-ghost-border bg-ghost-surface p-4">
        <JsonViewer
          data={report ?? { loading }}
          collapsed
          collapsedLabel="View raw health data"
          expandedLabel="Hide raw health data"
          maxHeight={360}
        />
      </div>
    </div>
  );
}
