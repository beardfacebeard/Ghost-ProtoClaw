"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  GitBranch,
  Layers,
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
  tokenUsage: {
    monthlySpendUsd: number;
    monthlyPromptTokens: number;
    monthlyCompletionTokens: number;
    monthlyTotalTokens: number;
    monthlyCallCount: number;
    allTimeSpendUsd: number;
    allTimeTotalTokens: number;
    allTimeCallCount: number;
    budget: {
      monthlyLimitUsd: number;
      alertThresholdPct: number;
      hardStop: boolean;
    } | null;
  };
  costByModel: Array<{
    model: string;
    costUsd: number;
    totalTokens: number;
    callCount: number;
  }>;
  costByAgent: Array<{
    agentId: string;
    name: string;
    emoji: string | null;
    costUsd: number;
    totalTokens: number;
    callCount: number;
  }>;
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

function formatUsd(amount: number) {
  if (amount < 0.01 && amount > 0) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}

function formatTokens(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function getStatusMeta(status: string) {
  switch (status) {
    case "completed":
      return { color: "text-state-success", bg: "bg-state-success/15", label: "Completed" };
    case "failed":
      return { color: "text-red-400", bg: "bg-red-400/15", label: "Failed" };
    case "running":
      return { color: "text-steel-bright", bg: "bg-steel/15", label: "Running" };
    case "pending":
      return { color: "text-state-warning", bg: "bg-state-warning/15", label: "Pending" };
    default:
      return { color: "text-ink-secondary", bg: "bg-bg-surface-2", label: status };
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
          <p className="mt-1 text-sm text-ink-secondary">
            Track token usage, spending, agent runs, and operational metrics.
          </p>
        </div>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-steel border-t-transparent" />
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

  const tokenUsage = data?.tokenUsage ?? {
    monthlySpendUsd: 0,
    monthlyPromptTokens: 0,
    monthlyCompletionTokens: 0,
    monthlyTotalTokens: 0,
    monthlyCallCount: 0,
    allTimeSpendUsd: 0,
    allTimeTotalTokens: 0,
    allTimeCallCount: 0,
    budget: null
  };

  const budgetPct = tokenUsage.budget
    ? Math.min(
        100,
        Math.round(
          (tokenUsage.monthlySpendUsd / tokenUsage.budget.monthlyLimitUsd) * 100
        )
      )
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Usage & Costs
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Track token usage, spending, agent runs, and operational metrics.
        </p>
      </div>

      {/* Spend Overview */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Monthly Spend</div>
                <div className="text-xl font-bold text-emerald-400">
                  {formatUsd(tokenUsage.monthlySpendUsd)}
                </div>
              </div>
            </div>
            {tokenUsage.budget && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-ink-muted">
                  <span>Budget: {formatUsd(tokenUsage.budget.monthlyLimitUsd)}</span>
                  <span>{budgetPct}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      budgetPct! >= 90
                        ? "bg-red-400"
                        : budgetPct! >= 70
                          ? "bg-state-warning"
                          : "bg-emerald-400"
                    )}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-steel/10">
                <Layers className="h-5 w-5 text-steel-bright" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Monthly Tokens</div>
                <div className="text-xl font-bold text-steel-bright">
                  {formatTokens(tokenUsage.monthlyTotalTokens)}
                </div>
                <div className="text-[10px] text-ink-muted">
                  {formatTokens(tokenUsage.monthlyPromptTokens)} in / {formatTokens(tokenUsage.monthlyCompletionTokens)} out
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-steel/10">
                <Zap className="h-5 w-5 text-steel-bright" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">LLM Calls (MTD)</div>
                <div className="text-xl font-bold text-white">
                  {tokenUsage.monthlyCallCount}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-500/10">
                <Coins className="h-5 w-5 text-ink-secondary" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">All-Time Spend</div>
                <div className="text-xl font-bold text-ink-primary">
                  {formatUsd(tokenUsage.allTimeSpendUsd)}
                </div>
                <div className="text-[10px] text-ink-muted">
                  {tokenUsage.allTimeCallCount} total calls
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown by Model & Agent */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader className="border-b border-line-subtle">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-steel-bright" />
              Cost by Model (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.costByModel.length ? (
              <div className="divide-y divide-line-subtle">
                {data.costByModel.map((item) => {
                  const maxCost = data.costByModel[0]?.costUsd ?? 1;
                  const pct = maxCost > 0 ? (item.costUsd / maxCost) * 100 : 0;

                  return (
                    <div
                      key={item.model}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {item.model}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-muted">
                          <span>{formatTokens(item.totalTokens)} tokens</span>
                          <span>{item.callCount} calls</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
                          <div
                            className="h-full rounded-full bg-steel"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-400">
                        {formatUsd(item.costUsd)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-ink-muted">
                No token usage recorded yet. Costs will appear here as you use your agents.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader className="border-b border-line-subtle">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-steel-bright" />
              Cost by Agent (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.costByAgent.length ? (
              <div className="divide-y divide-line-subtle">
                {data.costByAgent.map((item) => {
                  const maxCost = data.costByAgent[0]?.costUsd ?? 1;
                  const pct = maxCost > 0 ? (item.costUsd / maxCost) * 100 : 0;

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
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-muted">
                          <span>{formatTokens(item.totalTokens)} tokens</span>
                          <span>{item.callCount} calls</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
                          <div
                            className="h-full rounded-full bg-steel"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-400">
                        {formatUsd(item.costUsd)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-ink-muted">
                No agent cost data yet. Costs will appear as agents make LLM calls.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operational Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-steel/10">
                <Zap className="h-5 w-5 text-steel-bright" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Total Runs</div>
                <div className="text-xl font-bold text-white">
                  {overview.totalRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-state-success/10">
                <CheckCircle2 className="h-5 w-5 text-state-success" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Completed</div>
                <div className="text-xl font-bold text-state-success">
                  {overview.completedRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-400/10">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Failed</div>
                <div className="text-xl font-bold text-red-400">
                  {overview.failedRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-state-warning/10">
                <Clock className="h-5 w-5 text-state-warning" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Pending</div>
                <div className="text-xl font-bold text-state-warning">
                  {overview.pendingRuns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-steel/10">
                <TrendingUp className="h-5 w-5 text-steel-bright" />
              </div>
              <div>
                <div className="text-xs text-ink-muted">Success Rate</div>
                <div className="text-xl font-bold text-steel-bright">
                  {overview.successRate}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Agent & Workflow */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader className="border-b border-line-subtle">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-steel-bright" />
              Runs by Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.byAgent.length ? (
              <div className="divide-y divide-line-subtle">
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
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
                          <div
                            className="h-full rounded-full bg-steel"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink-primary">
                        {item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-ink-muted">
                No agent runs recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader className="border-b border-line-subtle">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 text-steel-bright" />
              Runs by Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.byWorkflow.length ? (
              <div className="divide-y divide-line-subtle">
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
                      <GitBranch className="h-4 w-4 shrink-0 text-ink-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">
                          {item.name}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
                          <div
                            className="h-full rounded-full bg-steel"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink-primary">
                        {item.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-ink-muted">
                No workflow runs recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader className="border-b border-line-subtle">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-state-warning" />
            Recent Runs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.recentRuns.length ? (
            <div className="divide-y divide-line-subtle">
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
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-steel opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-steel" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          meta.color === "text-state-success"
                            ? "bg-state-success"
                            : meta.color === "text-red-400"
                              ? "bg-red-400"
                              : meta.color === "text-state-warning"
                                ? "bg-state-warning"
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        {run.agentName ? (
                          <span>
                            {run.agentEmoji ?? "🤖"} {run.agentName}
                          </span>
                        ) : null}
                        {run.workflowName ? (
                          <span>{run.workflowName}</span>
                        ) : null}
                        {run.businessName ? (
                          <span className="text-ink-muted">
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

                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatRelativeTime(run.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-ink-muted">
              No runs recorded yet. Runs will appear here as agents and
              workflows execute actions.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
