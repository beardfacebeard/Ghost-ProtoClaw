"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckSquare,
  ExternalLink,
  GitBranch,
  Inbox as InboxIcon,
  RefreshCw,
  XCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function getItemColor(type: string) {
  switch (type) {
    case "approval":
      return "text-state-warning";
    case "failed_run":
      return "text-red-400";
    case "alert":
      return "text-orange-400";
    default:
      return "text-ink-muted";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Approvals, alerts, and recent activity in one place.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchInbox(activeTab);
          }}
          className="text-ink-secondary hover:text-white"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-line-subtle bg-bg-surface-2 p-1">
        {TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? data?.counts.all
              : tab.key === "approvals"
                ? data?.counts.approvals
                : data?.counts.alerts;

          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-bg-surface text-white shadow-sm"
                  : "text-ink-muted hover:text-ink-primary"
              )}
            >
              {tab.label}
              {count !== undefined && count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    activeTab === tab.key
                      ? "bg-steel/20 text-steel-bright"
                      : "bg-bg-surface text-ink-muted"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Items */}
      {loading && !data ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-steel border-t-transparent" />
          </CardContent>
        </Card>
      ) : !data?.items.length ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <InboxIcon className="h-10 w-10 text-ink-muted" />
            <div className="text-center">
              <p className="text-sm font-medium text-ink-secondary">All clear</p>
              <p className="mt-1 text-xs text-ink-muted">
                No items need your attention right now.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.items.map((item) => {
            const Icon = getItemIcon(item.type);
            const color = getItemColor(item.type);

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className="group flex w-full items-start gap-3 rounded-xl border border-line-subtle bg-bg-surface p-4 text-left transition-colors hover:border-line hover:bg-bg-surface-2"
              >
                <div className={cn("mt-0.5 shrink-0", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {item.title}
                    </p>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  {item.detail ? (
                    <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                      {item.detail}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant={
                        item.type === "approval"
                          ? "amber"
                          : item.type === "failed_run"
                            ? "error"
                            : item.type === "alert"
                              ? "amber"
                              : "default"
                      }
                      className="text-[10px]"
                    >
                      {item.type === "failed_run"
                        ? "Failed"
                        : item.type === "approval"
                          ? "Pending"
                          : item.type === "alert"
                            ? "Warning"
                            : "Activity"}
                    </Badge>
                    <span className="flex items-center gap-1 text-[10px] text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
                      View <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
