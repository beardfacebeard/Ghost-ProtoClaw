"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  GitBranch,
  TrendingUp,
  XCircle,
  Zap
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CostData = {
  overview: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    pendingRuns: number;
    successRate: number;
  };
  byAgent: Array<{
    agentId: string;
    name: string;
    emoji: string | null;
    count: number;
  }>;
  byWorkflow: Array<{
    workflowId: string;
    name: string;
    count: number;
  }>;
  recentRuns: Array<{
    id: string;
    action: string;
    status: string;
    error: string | null;
    agentName: string | null;
    agentEmoji: string | null;
    workflowName: string | null;
    businessName: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};

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

function getStatusMeta(status: string) {
  switch (status) {
    case "completed":
      return { color: "text-status-active", bg: "bg-status-active/15", label: "Completed" };
    case "failed":
      return { color: "text-red-400", bg: "bg-red-400/15", label: "Failed" };
    case "running":
      return { color: "text-brand-cyan", bg: "bg-brand-cyan/15", label: "Running" };
    case "pending":
      return { color: "text-brand-amber", bg: "bg-brand-amber/15", label: "Pending" };
    default:
      return { color: "text-zinc-400", bg: "bg-ghost-raised", label: status };
  }
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/costs", {
        credentials: "same-origin"
      });

      if (response.ok) {
        setData(await response.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Usage & Costs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track agent runs, workflow execution, and operational metrics.
          </p>
        </div>
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const overview = data?.overview ?? {
    totalRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
    pendingRuns: 0,
    successRate: 0
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Usage & Costs
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Track agent runs, workflow execution, and operational metrics.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
                <Zap className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <div className="text-xs text-zinc-500">Total Runs</div>
                <div className="text-xl font-bold text-white">
                  {overview.totalRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-active/10">
                <CheckCircle2 className="h-5 w-5 text-status-active" />
              </div>
              <div>
                <div className="text-xs text-zinc-500">Completed</div>
                <div className="text-xl font-bold text-status-active">
                  {overview.completedRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-400/10">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <div className="text-xs text-zinc-500">Failed</div>
                <div className="text-xl font-bold text-red-400">
                  {overview.failedRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-amber/10">
                <Clock className="h-5 w-5 text-brand-amber" />
              </div>
              <div>
                <div className="text-xs text-zinc-500">Pending</div>
                <div className="text-xl font-bold text-brand-amber">
                  {overview.pendingRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10">
                <TrendingUp className="h-5 w-5 text-brand-cyan" />
              </div>
              <div>
                <div className="text-xs text-zinc-500">Success Rate</div>
                <div className="text-xl font-bold text-brand-cyan">
                  {overview.successRate}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Agent & Workflow */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-ghost-border bg-ghost-card">
          <CardHeader className="border-b border-ghost-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-brand-primary" />
              Runs by Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.byAgent.length ? (
              <div className="divide-y divide-ghost-border">
                {data.byAgent.map((item) => {
                  const pct =
                    overview.totalRuns > 0
                      ? (item.count / overview.totalRuns) * 100
                      : 0;

                  return (
                    <div
                      key={item.agentId}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <span className="text-lg">
                        {item.emoji ?? "🤖"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {item.name}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ghost-raised">
                          <div
                            className="h-full rounded-full bg-brand-primary"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-zinc-300">
                        {item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-zinc-500">
                No agent runs recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-ghost-border bg-ghost-card">
          <CardHeader className="border-b border-ghost-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 text-brand-cyan" />
              Runs by Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.byWorkflow.length ? (
              <div className="divide-y divide-ghost-border">
                {data.byWorkflow.map((item) => {
                  const pct =
                    overview.totalRuns > 0
                      ? (item.count / overview.totalRuns) * 100
                      : 0;

                  return (
                    <div
                      key={item.workflowId}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <GitBranch className="h-4 w-4 shrink-0 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {item.name}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ghost-raised">
                          <div
                            className="h-full rounded-full bg-brand-cyan"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-zinc-300">
                        {item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-zinc-500">
                No workflow runs recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card className="border-ghost-border bg-ghost-card">
        <CardHeader className="border-b border-ghost-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-brand-amber" />
            Recent Runs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.recentRuns.length ? (
            <div className="divide-y divide-ghost-border">
              {data.recentRuns.map((run) => {
                const meta = getStatusMeta(run.status);
                const duration =
                  run.completedAt && run.createdAt
                    ? Math.round(
                        (new Date(run.completedAt).getTime() -
                          new Date(run.createdAt).getTime()) /
                          1000
                      )
                    : null;

                return (
                  <div key={run.id} className="flex items-center gap-3 px-5 py-3">
                    {run.status === "running" ? (
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-cyan opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-cyan" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          meta.color === "text-status-active"
                            ? "bg-status-active"
                            : meta.color === "text-red-400"
                              ? "bg-red-400"
                              : meta.color === "text-brand-amber"
                                ? "bg-brand-amber"
                                : "bg-zinc-500"
                        )}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {run.action}
                        </span>
                        <Badge className={cn("text-[10px]", meta.bg, meta.color)}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        {run.agentName ? (
                          <span>
                            {run.agentEmoji ?? "🤖"} {run.agentName}
                          </span>
                        ) : null}
                        {run.workflowName ? (
                          <span>{run.workflowName}</span>
                        ) : null}
                        {run.businessName ? (
                          <span className="text-zinc-600">
                            {run.businessName}
                          </span>
                        ) : null}
                        {duration !== null ? (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {duration < 60
                              ? `${duration}s`
                              : `${Math.floor(duration / 60)}m ${duration % 60}s`}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span className="shrink-0 text-xs text-zinc-600">
                      {formatRelativeTime(run.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-zinc-500">
              No runs recorded yet. Runs will appear here as agents and
              workflows execute actions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
