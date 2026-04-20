"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  MinusCircle,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
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

/**
 * Human-friendly label for common detail keys. Kept out of the component
 * body so we can tweak copy in one place.
 */
const DETAIL_LABELS: Record<string, string> = {
  url: "URL",
  error: "Error",
  setupHint: "How to fix",
  impact: "What this affects",
  pendingCount: "Pending items",
  expiredCount: "Expired items",
  key: "Integration key",
  scope: "Scope",
  assignedBusinessIds: "Assigned businesses"
};

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "(none)" : value.map(String).join(", ");
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function HealthCheckCard({ check }: HealthCheckCardProps) {
  const statusMeta = getStatusMeta(check.status);
  const Icon = statusMeta.icon;
  const details = check.details ?? {};
  const latencyMeta =
    typeof check.latencyMs === "number" ? getLatencyMeta(check.latencyMs) : null;

  const hasActionableDetails = Object.keys(details).length > 0;
  // Auto-expand anything that's not fully operational so the user sees
  // WHY something's broken without an extra click.
  const shouldDefaultOpen =
    check.status === "error" ||
    check.status === "warning" ||
    check.status === "unconfigured";
  const [open, setOpen] = useState(shouldDefaultOpen);

  // Order detail rows — setupHint + impact first (the actionable parts),
  // then error + url (the diagnostic), then everything else.
  const priorityKeys = ["setupHint", "impact", "error", "url"];
  const orderedEntries: Array<[string, unknown]> = [];
  for (const key of priorityKeys) {
    if (key in details) orderedEntries.push([key, details[key]]);
  }
  for (const [key, value] of Object.entries(details)) {
    if (priorityKeys.includes(key)) continue;
    orderedEntries.push([key, value]);
  }

  async function copyDiagnostic() {
    const lines = [
      `${check.name} — ${check.status.toUpperCase()}`,
      check.message
    ];
    if (typeof check.latencyMs === "number") {
      lines.push(`latencyMs: ${check.latencyMs}`);
    }
    for (const [key, value] of orderedEntries) {
      lines.push(`${key}: ${formatDetailValue(value)}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Diagnostic copied to clipboard.");
    } catch {
      toast.error("Clipboard not available.");
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-ghost-border bg-ghost-surface p-5",
        statusMeta.borderClass
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white">{check.name}</div>
          <div className="mt-1 text-sm text-slate-400">{check.message}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={statusMeta.badgeClass}>{statusMeta.badge}</Badge>
          <Icon
            className={cn(
              "h-5 w-5",
              check.status === "error"
                ? "animate-pulse text-brand-primary"
                : "text-current"
            )}
          />
        </div>
      </div>

      {latencyMeta ? (
        <div className="mt-4">
          <Badge className={latencyMeta.className}>{latencyMeta.label}</Badge>
        </div>
      ) : null}

      {hasActionableDetails ? (
        <div className="mt-4">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-white"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Show details
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-ghost-border bg-ghost-black/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">
                  Details
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={copyDiagnostic}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Hide
                  </button>
                </div>
              </div>
              <dl className="space-y-2 text-xs">
                {orderedEntries.map(([key, value]) => {
                  const label = DETAIL_LABELS[key] ?? key;
                  const highlight = key === "setupHint" || key === "impact";
                  const isError = key === "error";
                  return (
                    <div key={key} className="space-y-0.5">
                      <dt
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          highlight
                            ? "text-brand-cyan"
                            : isError
                              ? "text-brand-primary"
                              : "text-slate-500"
                        )}
                      >
                        {label}
                      </dt>
                      <dd
                        className={cn(
                          "whitespace-pre-wrap break-words",
                          highlight
                            ? "text-slate-200 leading-5"
                            : isError
                              ? "text-slate-300 font-mono text-[11px]"
                              : "text-slate-400 font-mono text-[11px]"
                        )}
                      >
                        {formatDetailValue(value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
