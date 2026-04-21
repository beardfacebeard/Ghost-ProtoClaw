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

import { JsonViewer } from "@/components/admin/JsonViewer";
import { HealthCheckCard } from "@/components/admin/health/HealthCheckCard";
import {
  PageHeader,
  Panel,
  PanelHeader,
  StatusDot,
  EmptyState as UiEmptyState
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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
        className:
          "border-state-danger/30 bg-state-danger/8 text-state-danger",
        dotTone: "danger" as const,
        label: "Critical issues require attention"
      };
    case "degraded":
      return {
        icon: AlertTriangle,
        className:
          "border-state-warning/30 bg-state-warning/8 text-state-warning",
        dotTone: "warning" as const,
        label: "Some issues detected — review below"
      };
    default:
      return {
        icon: CheckCircle2,
        className:
          "border-state-success/30 bg-state-success/8 text-state-success",
        dotTone: "success" as const,
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
        loadError instanceof Error
          ? loadError.message
          : "Unable to load health report."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHealthReport();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
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
    () =>
      report?.checks.filter((check) =>
        check.name.startsWith("Integration: ")
      ) ?? [],
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
  const healthyCount =
    report?.checks.filter((c) => c.status === "ok").length ?? 0;
  const totalCount = report?.checks.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System · Health"
        title="Mission control."
        description="Real-time status of every service, integration, and queue your agents depend on."
        actions={
          <>
            <div className="hidden items-center gap-2 text-[11px] text-ink-muted md:flex">
              <span className="font-mono">
                {report
                  ? new Date(report.checkedAt).toLocaleTimeString()
                  : "—"}
              </span>
              <span>•</span>
              <span>last checked</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadHealthReport()}
              className="border-line bg-bg-surface text-ink-secondary hover:border-steel/40 hover:text-ink-primary"
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
              Refresh
            </Button>
          </>
        }
      />

      {/* ── Banner + live counters ─────────────────────────────────── */}
      {report && bannerMeta ? (
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border p-4",
            bannerMeta.className
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusDot
              tone={bannerMeta.dotTone === "success" ? "live" : bannerMeta.dotTone}
            />
            <BannerIcon className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-[13px] font-medium">{bannerMeta.label}</span>
            <div className="ml-auto flex items-center gap-4 font-mono text-[11px]">
              <span>
                {healthyCount}/{totalCount} healthy
              </span>
              {autoRefresh ? (
                <span className="text-ink-muted">
                  next refresh in {countdown}s
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Error state ────────────────────────────────────────────── */}
      {error ? (
        <UiEmptyState
          icon={Siren}
          title="Health report unavailable"
          description={error}
          action={
            <Button
              type="button"
              size="sm"
              onClick={() => void loadHealthReport()}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {/* ── Core services ──────────────────────────────────────────── */}
      <section>
        <div className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">
          Core services
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {coreChecks.map((check) => (
            <HealthCheckCard key={check.name} check={check} />
          ))}
        </div>
      </section>

      {/* ── Integrations ───────────────────────────────────────────── */}
      <section>
        <div className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">
          Connected integrations
        </div>
        {integrationChecks.length === 0 ? (
          <UiEmptyState
            icon={Activity}
            title="No integrations connected"
            description="Connect integrations to see their runtime status here. Every connected service gets a live check at /api/admin/health/full."
            action={{
              label: "Open integrations",
              href: "/admin/integrations"
            }}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {integrationChecks.map((check) => (
              <HealthCheckCard key={check.name} check={check} />
            ))}
          </div>
        )}
      </section>

      {/* ── Operational queues ─────────────────────────────────────── */}
      <section>
        <div className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">
          Operational queues
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {operationalChecks.map((check) => (
            <HealthCheckCard key={check.name} check={check} />
          ))}
        </div>
      </section>

      {/* ── Auto-refresh toggle ─────────────────────────────────────── */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-[13px] font-medium text-ink-primary">
              Auto-refresh
            </div>
            <div className="mt-0.5 text-[11px] text-ink-muted">
              {autoRefresh
                ? `Every 60 seconds · next in ${countdown}s`
                : "Paused — click refresh manually."}
            </div>
          </div>
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
        </div>
      </Panel>

      {/* ── Raw JSON (for developers) ──────────────────────────────── */}
      <Panel>
        <PanelHeader label="Raw health payload" />
        <div className="px-4 py-3">
          <JsonViewer
            data={report ?? { loading }}
            collapsed
            collapsedLabel="View raw health data"
            expandedLabel="Hide raw health data"
            maxHeight={360}
          />
        </div>
      </Panel>
    </div>
  );
}
