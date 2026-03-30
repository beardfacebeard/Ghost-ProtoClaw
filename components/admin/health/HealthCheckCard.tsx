"use client";

import {
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthCheckResult = {
  name: string;
  status: "ok" | "warning" | "error" | "unconfigured";
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

type HealthCheckCardProps = {
  check: HealthCheckResult;
};

function getStatusMeta(status: HealthCheckResult["status"]) {
  switch (status) {
    case "ok":
      return {
        icon: CheckCircle2,
        badge: "Operational",
        badgeClass: "bg-status-active/15 text-status-active",
        borderClass: "border-l-[3px] border-l-status-active"
      };
    case "warning":
      return {
        icon: AlertTriangle,
        badge: "Degraded",
        badgeClass: "bg-brand-amber/15 text-brand-amber",
        borderClass: "border-l-[3px] border-l-brand-amber"
      };
    case "error":
      return {
        icon: XCircle,
        badge: "Error",
        badgeClass: "bg-brand-primary/15 text-brand-primary",
        borderClass: "border-l-[3px] border-l-brand-primary"
      };
    default:
      return {
        icon: MinusCircle,
        badge: "Not configured",
        badgeClass: "bg-ghost-raised text-slate-400",
        borderClass: "border-l-[3px] border-l-slate-600"
      };
  }
}

function getLatencyMeta(latencyMs: number) {
  if (latencyMs < 100) {
    return {
      label: `${latencyMs} ms fast`,
      className: "bg-status-active/15 text-status-active"
    };
  }

  if (latencyMs <= 500) {
    return {
      label: `${latencyMs} ms slow`,
      className: "bg-brand-amber/15 text-brand-amber"
    };
  }

  return {
    label: `${latencyMs} ms very slow`,
    className: "bg-brand-primary/15 text-brand-primary"
  };
}

export function HealthCheckCard({ check }: HealthCheckCardProps) {
  const statusMeta = getStatusMeta(check.status);
  const Icon = statusMeta.icon;
  const setupHint =
    typeof check.details?.setupHint === "string" ? check.details.setupHint : null;
  const latencyMeta =
    typeof check.latencyMs === "number" ? getLatencyMeta(check.latencyMs) : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-ghost-border bg-ghost-surface p-5",
        statusMeta.borderClass
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{check.name}</div>
          <div className="mt-1 text-sm text-slate-400">{check.message}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusMeta.badgeClass}>{statusMeta.badge}</Badge>
          <Icon
            className={cn(
              "h-5 w-5",
              check.status === "error" ? "animate-pulse text-brand-primary" : "text-current"
            )}
          />
        </div>
      </div>

      {latencyMeta ? (
        <div className="mt-4">
          <Badge className={latencyMeta.className}>{latencyMeta.label}</Badge>
        </div>
      ) : null}

      {check.status === "unconfigured" && setupHint ? (
        <div className="mt-4 text-xs leading-5 text-slate-500">{setupHint}</div>
      ) : null}
    </div>
  );
}
