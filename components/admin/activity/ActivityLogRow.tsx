"use client";

import { useState } from "react";
import {
  Activity,
  Archive,
  Bot,
  CheckSquare,
  ChevronDown,
  GitBranch,
  Info,
  Settings,
  Shield,
  AlertTriangle
} from "lucide-react";

import { formatRelativeTime } from "@/components/admin/ActivityFeed";
import { JsonViewer } from "@/components/admin/JsonViewer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ActivityEntryRecord = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  status: string | null;
  metadata?: unknown;
  createdAt: Date | string;
  business?: {
    id: string;
    name: string;
  } | null;
};

type LogEventRecord = {
  id: string;
  level: string;
  message: string;
  action: string | null;
  metadata?: unknown;
  businessId?: string | null;
  createdAt: Date | string;
};

type AuditEventRecord = {
  id: string;
  actorEmail: string | null;
  eventType: string;
  entityType: string;
  entityId: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ipAddress: string | null;
  createdAt: Date | string;
};

type ActivityLogRowProps = {
  entry: ActivityEntryRecord | LogEventRecord | AuditEventRecord;
  type: "activity" | "log" | "audit";
  businessLabel?: string | null;
};

function getActivityTypeMeta(type: string) {
  switch (type) {
    case "workflow":
      return {
        icon: GitBranch,
        className: "text-brand-cyan"
      };
    case "approval":
      return {
        icon: CheckSquare,
        className: "text-brand-amber"
      };
    case "backup":
      return {
        icon: Archive,
        className: "text-slate-300"
      };
    case "agent":
      return {
        icon: Bot,
        className: "text-status-info"
      };
    case "system":
      return {
        icon: Settings,
        className: "text-slate-300"
      };
    default:
      return {
        icon: Activity,
        className: "text-slate-300"
      };
  }
}

function getLogLevelMeta(level: string) {
  switch (level) {
    case "error":
      return {
        icon: AlertTriangle,
        className: "text-status-error",
        tint: "bg-status-error/5"
      };
    case "warning":
      return {
        icon: AlertTriangle,
        className: "text-brand-amber",
        tint: "bg-brand-amber/5"
      };
    default:
      return {
        icon: Info,
        className: "text-status-info",
        tint: ""
      };
  }
}

function asDate(value: Date | string) {
  return typeof value === "string" ? new Date(value) : value;
}

export function ActivityLogRow({
  entry,
  type,
  businessLabel
}: ActivityLogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const createdAt = asDate(entry.createdAt);
  const activityMeta =
    type === "activity"
      ? getActivityTypeMeta((entry as ActivityEntryRecord).type)
      : null;
  const logMeta =
    type === "log" ? getLogLevelMeta((entry as LogEventRecord).level) : null;
  const Icon =
    type === "activity"
      ? activityMeta?.icon ?? Activity
      : type === "log"
        ? logMeta?.icon ?? Info
        : Shield;
  const title =
    type === "activity"
      ? (entry as ActivityEntryRecord).title
      : type === "log"
        ? (entry as LogEventRecord).message
        : (entry as AuditEventRecord).eventType.replaceAll("_", " ");
  const detail =
    type === "activity"
      ? (entry as ActivityEntryRecord).detail
      : type === "log"
        ? (entry as LogEventRecord).action
        : `${(entry as AuditEventRecord).entityType} ${(entry as AuditEventRecord).entityId ?? ""}`.trim();

  return (
    <div
      className={cn(
        "rounded-xl border border-ghost-border bg-ghost-surface transition-colors hover:bg-ghost-raised/40",
        type === "log" ? logMeta?.tint : undefined
      )}
    >
      <button
        type="button"
        className="grid w-full gap-3 px-4 py-4 text-left lg:grid-cols-[180px_32px_minmax(0,1fr)_160px_140px_20px] lg:items-start"
        onClick={() => setExpanded((current) => !current)}
      >
        <div
          className="text-xs font-medium text-slate-500"
          title={createdAt.toLocaleString()}
        >
          {formatRelativeTime(createdAt)}
        </div>

        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            type === "activity"
              ? "bg-ghost-black"
              : type === "log"
                ? "bg-ghost-black"
                : "bg-ghost-black"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              type === "activity"
                ? activityMeta?.className
                : type === "log"
                  ? logMeta?.className
                  : "text-slate-300"
            )}
          />
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{title}</div>
          {detail ? (
            <div className="truncate text-xs text-slate-400">{detail}</div>
          ) : null}
        </div>

        <div className="text-xs text-slate-500">
          {type === "audit" ? (entry as AuditEventRecord).actorEmail ?? "System" : ""}
        </div>

        <div>
          {businessLabel ? (
            <Badge className="bg-ghost-black text-slate-300">{businessLabel}</Badge>
          ) : null}
        </div>

        <div className="flex items-center justify-end text-slate-500">
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded ? "rotate-180" : "")}
          />
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-ghost-border px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <div className="text-sm font-medium text-white">Details</div>
              <div className="rounded-xl border border-ghost-border bg-ghost-black/60 p-4 text-sm leading-6 text-slate-300">
                {detail || "No additional detail recorded."}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-white">Metadata</div>
              <JsonViewer
                data={
                  type === "activity"
                    ? (entry as ActivityEntryRecord).metadata ?? {}
                    : type === "log"
                      ? (entry as LogEventRecord).metadata ?? {}
                      : {
                          before: (entry as AuditEventRecord).beforeJson ?? null,
                          after: (entry as AuditEventRecord).afterJson ?? null,
                          ipAddress: (entry as AuditEventRecord).ipAddress ?? null
                        }
                }
                collapsed
                collapsedLabel="Show details"
                expandedLabel="Hide details"
                maxHeight={240}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
