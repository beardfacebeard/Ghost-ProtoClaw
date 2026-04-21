"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckSquare,
  GitBranch,
  Inbox as InboxIcon,
  RefreshCw,
  XCircle
} from "lucide-react";

import {
  PageHeader,
  Panel,
  PanelHeader,
  StatusDot,
  EmptyState
} from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InboxItem = {
  id: string;
  type: "approval" | "failed_run" | "alert" | "activity";
  title: string;
  detail: string | null;
  status: string;
  createdAt: string;
  href: string;
};

type InboxData = {
  items: InboxItem[];
  counts: {
    all: number;
    approvals: number;
    alerts: number;
  };
};

const TABS = [
  { key: "all", label: "All" },
  { key: "approvals", label: "Approvals" },
  { key: "alerts", label: "Alerts" }
];

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getItemIcon(type: string) {
  switch (type) {
    case "approval":
      return CheckSquare;
    case "failed_run":
      return XCircle;
    case "alert":
      return AlertTriangle;
    default:
      return GitBranch;
  }
}

function getItemTone(
  type: string
): "warning" | "danger" | "muted" | "live" {
  switch (type) {
    case "approval":
      return "warning";
    case "failed_run":
      return "danger";
    case "alert":
      return "warning";
    default:
      return "muted";
  }
}

function getItemBadge(type: string): {
  label: string;
  variant: "amber" | "error" | "default" | "info";
} {
  switch (type) {
    case "approval":
      return { label: "Pending", variant: "amber" };
    case "failed_run":
      return { label: "Failed", variant: "error" };
    case "alert":
      return { label: "Warning", variant: "amber" };
    default:
      return { label: "Activity", variant: "default" };
  }
}

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "all";
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(async (tab: string) => {
    try {
      const response = await fetch(`/api/admin/inbox?tab=${tab}`, {
        credentials: "same-origin"
      });
      if (response.ok) {
        const json = (await response.json()) as InboxData;
        setData(json);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox(activeTab);
  }, [activeTab, fetchInbox]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInbox(activeTab);
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchInbox]);

  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.push(`/admin/inbox${qs ? `?${qs}` : ""}`);
  }

  const hasItems = !!data && data.items.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work · Inbox"
        title="Signals worth a glance."
        description="Approvals, failed runs, alerts, and recent activity — in one stream. Auto-refreshes every 30 seconds."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchInbox(activeTab);
            }}
            className="border-line bg-bg-surface text-ink-secondary hover:border-steel/40 hover:text-ink-primary"
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")}
              strokeWidth={1.5}
            />
            Refresh
          </Button>
        }
      />

      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div className="inline-flex rounded-md border border-line-subtle bg-bg-surface p-1">
        {TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? data?.counts.all
              : tab.key === "approvals"
                ? data?.counts.approvals
                : data?.counts.alerts;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-sm px-3 py-1.5 text-[12px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-bg-surface-3 text-ink-primary"
                  : "text-ink-secondary hover:text-ink-primary"
              )}
            >
              {tab.label}
              {count !== undefined && count > 0 ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                    isActive
                      ? "bg-steel/20 text-steel-bright"
                      : "bg-bg-surface-2 text-ink-muted"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── Items ──────────────────────────────────────────────────── */}
      {loading && !data ? (
        <Panel>
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-steel border-t-transparent" />
          </div>
        </Panel>
      ) : !hasItems ? (
        <EmptyState
          icon={InboxIcon}
          title="All clear."
          description="No items need your attention right now. Agents will surface work here the moment anything needs a decision."
        />
      ) : (
        <Panel variant={data!.counts.alerts > 0 || data!.counts.approvals > 0 ? "live" : "default"}>
          <PanelHeader
            label={`${data!.items.length} ${data!.items.length === 1 ? "signal" : "signals"}`}
            action={
              <span className="font-mono text-[10.5px] text-ink-muted">
                auto-refresh 30s
              </span>
            }
          />
          <ul className="divide-y divide-line-subtle">
            {data!.items.map((item) => {
              const Icon = getItemIcon(item.type);
              const tone = getItemTone(item.type);
              const badge = getItemBadge(item.type);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => router.push(item.href)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-surface-2"
                  >
                    <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
                      <StatusDot tone={tone === "live" ? "live" : tone} />
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5",
                          tone === "danger" && "text-state-danger",
                          tone === "warning" && "text-state-warning",
                          tone === "muted" && "text-ink-muted"
                        )}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium text-ink-primary">
                          {item.title}
                        </p>
                        <span className="flex-shrink-0 font-mono text-[10.5px] text-ink-muted">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      {item.detail ? (
                        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-muted">
                          {item.detail}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        <span className="flex items-center gap-1 font-mono text-[10px] text-ink-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          open{" "}
                          <ArrowUpRight
                            className="h-3 w-3"
                            strokeWidth={1.5}
                          />
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
