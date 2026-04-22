"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BookOpen,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileText,
  GitBranch,
  ListChecks,
  Radar,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
  Youtube
} from "lucide-react";

import { Panel, PanelBody, PanelHeader, StatBlock, StatusDot } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Template-aware business dashboard panel. Renders under the "Dashboard" tab
 * on the business detail page. Hydrates from /api/admin/businesses/[id]/dashboard
 * on mount; each specialty template gets its own widget block below the shared
 * metric row.
 *
 * Dealhawk has its own pipeline-powered dashboard (see DealhawkDashboardPanel);
 * this panel is for the other specialty templates where the data signal is
 * sparser but still worth surfacing as "this is a real business."
 */

type DashboardData = {
  business: {
    id: string;
    name: string;
    status: string;
    templateId: string | null;
    createdAt: string;
  };
  metrics: {
    agents: number;
    workflows: number;
    activeWorkflows: number;
    knowledgeItems: number;
    workspaceDocs: number;
    pendingApprovals: number;
    openTodos: number;
    learningEntries: number;
  };
  runs: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    last7: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    detail: string | null;
    status: string | null;
    createdAt: string;
  }>;
  recentActionRuns: Array<{
    id: string;
    action: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    agent: { displayName: string; emoji: string | null } | null;
    workflow: { name: string } | null;
  }>;
  templateData: Record<string, unknown>;
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return date.toLocaleDateString();
}

function runStatusTone(status: string): "success" | "warning" | "muted" {
  if (status === "completed") return "success";
  if (status === "failed") return "warning";
  return "muted";
}

export function TemplateDashboardPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/businesses/${businessId}/dashboard`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const payload = (await res.json()) as DashboardData;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    },
    [businessId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <Panel>
        <PanelBody>
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Loading dashboard…
          </div>
        </PanelBody>
      </Panel>
    );
  }

  if (error || !data) {
    return (
      <Panel variant="danger">
        <PanelBody>
          <div className="flex items-center gap-2 text-sm text-state-danger">
            <AlertCircle className="h-4 w-4" />
            {error ?? "No dashboard data available."}
          </div>
        </PanelBody>
      </Panel>
    );
  }

  const { metrics, runs, recentActivity, recentActionRuns, templateData } = data;
  const successRate =
    runs.total > 0 ? Math.round((runs.completed / runs.total) * 100) : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          label="Runs (30d)"
          value={String(runs.total)}
          subtext={`${runs.last7} in last 7d`}
          icon={<Activity className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Success rate"
          value={successRate === null ? "—" : `${successRate}%`}
          subtext={`${runs.completed} ok · ${runs.failed} failed`}
          icon={<TrendingUp className="h-4 w-4" />}
          mono
          tone={
            successRate !== null && successRate < 70
              ? "warning"
              : "default"
          }
        />
        <StatBlock
          label="Open approvals"
          value={String(metrics.pendingApprovals)}
          subtext={`${metrics.openTodos} todos open`}
          icon={<ListChecks className="h-4 w-4" />}
          mono
          tone={metrics.pendingApprovals > 0 ? "warning" : "default"}
          href={
            metrics.pendingApprovals > 0
              ? `/admin/approvals?businessId=${businessId}`
              : undefined
          }
        />
        <StatBlock
          label="Learning log"
          value={String(metrics.learningEntries)}
          subtext={`${metrics.knowledgeItems} KB items`}
          icon={<Sparkles className="h-4 w-4" />}
          mono
        />
      </section>

      {data.business.templateId ? (
        <TemplateSpecificWidgets
          businessId={businessId}
          templateId={data.business.templateId}
          templateData={templateData}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader label="Recent agent runs" />
          <PanelBody className="p-0">
            {recentActionRuns.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-muted">
                No agent runs yet. Trigger a workflow to get started.
              </div>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {recentActionRuns.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm text-ink-primary">
                        <span className="text-base">
                          {run.agent?.emoji ?? "🤖"}
                        </span>
                        <span className="truncate font-medium">
                          {run.workflow?.name ?? run.action}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                        <span>
                          {run.agent?.displayName ?? "Unassigned"}
                        </span>
                        <span>·</span>
                        <span>{formatDate(run.createdAt)}</span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
                      <StatusDot tone={runStatusTone(run.status)} />
                      {run.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            label="Activity stream"
            action={
              <Link
                href={`/admin/activity?businessId=${businessId}`}
                className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted hover:text-steel-bright"
              >
                View all
              </Link>
            }
          />
          <PanelBody className="p-0">
            {recentActivity.length === 0 ? (
              <div className="px-4 py-6 text-sm text-ink-muted">
                No activity yet.
              </div>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="flex gap-3 px-4 py-3">
                    <div className="mt-0.5">
                      <ActivityIcon type={entry.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink-primary">
                        {entry.title}
                      </div>
                      {entry.detail ? (
                        <div className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                          {entry.detail}
                        </div>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-muted">
                        <span>{entry.type}</span>
                        <span>·</span>
                        <span>{formatDate(entry.createdAt)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          label="Agents"
          value={String(metrics.agents)}
          icon={<Bot className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Workflows"
          value={`${metrics.activeWorkflows}/${metrics.workflows}`}
          subtext={`${metrics.activeWorkflows} enabled`}
          icon={<GitBranch className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Knowledge"
          value={String(metrics.knowledgeItems)}
          icon={<BookOpen className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Workspace docs"
          value={String(metrics.workspaceDocs)}
          icon={<FileText className="h-4 w-4" />}
          mono
        />
      </section>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5 text-ink-muted";
  switch (type) {
    case "workflow":
      return <GitBranch className={cls} />;
    case "approval":
      return <ShieldCheck className={cls} />;
    case "agent":
      return <Bot className={cls} />;
    case "integration":
      return <Radar className={cls} />;
    default:
      return <Activity className={cls} />;
  }
}

/** Per-template widgets rendered between metrics and activity. */
function TemplateSpecificWidgets({
  businessId,
  templateId,
  templateData
}: {
  businessId: string;
  templateId: string;
  templateData: Record<string, unknown>;
}) {
  if (templateId === "tiktok_shop") {
    return <TikTokShopWidgets businessId={businessId} data={templateData} />;
  }
  if (templateId === "faceless_youtube") {
    return <FacelessYoutubeWidgets businessId={businessId} data={templateData} />;
  }
  if (templateId === "forex_trading_desk") {
    return <ForexDeskWidgets businessId={businessId} data={templateData} />;
  }
  if (templateId === "ghost_operator") {
    return <GhostOperatorWidgets businessId={businessId} data={templateData} />;
  }
  return null;
}

// ─── TikTok Shop ─────────────────────────────────────────────────────────
function TikTokShopWidgets({
  businessId,
  data
}: {
  businessId: string;
  data: Record<string, unknown>;
}) {
  const adCloneProjects = Number(data.adCloneProjects ?? 0);
  const byStatus =
    (data.adCloneByStatus as Record<string, number> | undefined) ?? {};
  const productLadderDocId = data.productLadderDocId as string | null;
  const productLadderUpdatedAt = data.productLadderUpdatedAt as string | null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          label="Ad Clone pipeline"
          action={
            <Link
              href="/admin/ad-clone"
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted hover:text-steel-bright"
            >
              Open tool
            </Link>
          }
        />
        <PanelBody>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StatusRow label="Total projects" value={adCloneProjects} />
            <StatusRow label="Draft" value={byStatus.draft ?? 0} />
            <StatusRow label="In progress" value={byStatus.in_progress ?? 0} />
            <StatusRow label="Finalized" value={byStatus.finalized ?? 0} />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader label="Product ladder" />
        <PanelBody>
          {productLadderDocId ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-primary">
                Your ladder is live. Agents reference this doc when planning
                lead magnets, low-ticket products, and high-ticket upsells.
              </p>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>
                  Last updated {formatDate(productLadderUpdatedAt)}
                </span>
                <Link
                  href={`/admin/workspace?businessId=${businessId}`}
                  className="font-mono uppercase tracking-[0.22em] text-steel-bright hover:underline"
                >
                  Open
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              The Product Ladder Tracker workspace doc hasn&apos;t been
              created yet. Re-materialize the template or create
              PRODUCT_LADDER.md.
            </p>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

// ─── Faceless YouTube ────────────────────────────────────────────────────
function FacelessYoutubeWidgets({
  businessId,
  data
}: {
  businessId: string;
  data: Record<string, unknown>;
}) {
  const series =
    (data.ytQuotaSeries as
      | Array<{ date: string; unitsUsed: number }>
      | undefined) ?? [];
  const today = series[0];
  const quotaUsed = today?.unitsUsed ?? 0;
  const quotaCap = 10_000;
  const quotaPct = Math.min(100, Math.round((quotaUsed / quotaCap) * 100));
  const identityDocId = data.channelIdentityBibleDocId as string | null;
  const identityUpdatedAt = data.channelIdentityUpdatedAt as string | null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          label="YouTube API quota"
          action={
            <Link
              href="/admin/logs?source=youtube"
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted hover:text-steel-bright"
            >
              Logs
            </Link>
          }
        />
        <PanelBody>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl text-white">
                {quotaUsed.toLocaleString()}
              </span>
              <span className="text-xs text-ink-muted">
                / {quotaCap.toLocaleString()} units today
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
              <div
                className={cn(
                  "h-full",
                  quotaPct < 70
                    ? "bg-state-success"
                    : quotaPct < 90
                      ? "bg-state-warning"
                      : "bg-state-danger"
                )}
                style={{ width: `${quotaPct}%` }}
              />
            </div>
            <div className="text-xs text-ink-muted">
              One upload costs 1,600 units · metadata update 50 · analytics ~0
            </div>
            {series.length > 1 ? (
              <div className="grid grid-cols-7 gap-1 pt-2">
                {series
                  .slice(0, 14)
                  .reverse()
                  .map((row, idx) => {
                    const pct = Math.min(
                      100,
                      Math.round((row.unitsUsed / quotaCap) * 100)
                    );
                    return (
                      <div
                        key={idx}
                        title={`${new Date(row.date).toLocaleDateString()}: ${row.unitsUsed}`}
                        className="h-10 flex flex-col justify-end rounded-sm bg-bg-surface-2"
                      >
                        <div
                          className="bg-steel"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader label="Channel Identity Bible" />
        <PanelBody>
          {identityDocId ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-primary">
                Every content-producing agent references this doc before
                generating. Fill it in before Video 1.
              </p>
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>Last updated {formatDate(identityUpdatedAt)}</span>
                <Link
                  href={`/admin/workspace?businessId=${businessId}`}
                  className="font-mono uppercase tracking-[0.22em] text-steel-bright hover:underline"
                >
                  Open
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              Create CHANNEL_IDENTITY_BIBLE.md in the workspace — it&apos;s
              the single source of truth for voice, avatar, palette, and
              HITL.
            </p>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

// ─── Forex Desk ──────────────────────────────────────────────────────────
function ForexDeskWidgets({
  businessId: _businessId,
  data
}: {
  businessId: string;
  data: Record<string, unknown>;
}) {
  const tradingMode = (data.tradingMode as string) ?? "research";
  const jurisdiction = (data.jurisdiction as string | null) ?? null;
  const propFirm = data.propFirm as
    | {
        planName: string;
        firmKey: string;
        startingBalance: number;
        highWaterMark: number;
        status: string;
      }
    | null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <PanelHeader label="Desk status" />
        <PanelBody>
          <div className="space-y-3 text-sm">
            <StatusRow
              label="Trading mode"
              value={
                <Badge
                  className={cn(
                    "font-mono text-[10px] uppercase",
                    tradingMode === "live_approval" &&
                      "bg-state-danger text-white",
                    tradingMode === "paper" && "bg-state-warning text-bg-app",
                    tradingMode === "research" &&
                      "bg-state-success text-white"
                  )}
                >
                  {tradingMode.replace("_", " ")}
                </Badge>
              }
            />
            <StatusRow
              label="Jurisdiction"
              value={jurisdiction ? jurisdiction.toUpperCase() : "Not set"}
            />
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader label="Prop firm challenge" />
        <PanelBody>
          {propFirm ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Plan</span>
                <span className="text-ink-primary">{propFirm.planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Starting balance</span>
                <span className="font-mono text-ink-primary">
                  ${propFirm.startingBalance.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">High-water mark</span>
                <span className="font-mono text-ink-primary">
                  ${propFirm.highWaterMark.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Status</span>
                <Badge
                  className={cn(
                    "font-mono text-[10px] uppercase",
                    propFirm.status === "active" && "bg-state-success text-white",
                    propFirm.status === "warning" &&
                      "bg-state-warning text-bg-app",
                    propFirm.status === "busted" && "bg-state-danger text-white"
                  )}
                >
                  {propFirm.status}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              No active prop firm profile. The Prop-Firm Compliance agent will
              run in vanilla mode until you attach one.
            </p>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

// ─── Ghost Operator ──────────────────────────────────────────────────────
function GhostOperatorWidgets({
  businessId,
  data
}: {
  businessId: string;
  data: Record<string, unknown>;
}) {
  const coreDocs =
    (data.coreDocs as
      | Array<{
          id: string;
          filePath: string;
          updatedAt: string;
          syncStatus: string;
        }>
      | undefined) ?? [];
  const bySlug = new Map(coreDocs.map((d) => [d.filePath, d]));
  const docs = [
    {
      file: "BUSINESS_PLAN.md",
      label: "Business Plan",
      icon: <ListChecks className="h-3.5 w-3.5" />
    },
    {
      file: "LEARNING_LOG.md",
      label: "Learning Log",
      icon: <Sparkles className="h-3.5 w-3.5" />
    },
    {
      file: "BUILD_LOG.md",
      label: "Build Log",
      icon: <GitBranch className="h-3.5 w-3.5" />
    },
    {
      file: "REVENUE_LOG.md",
      label: "Revenue Log",
      icon: <TrendingUp className="h-3.5 w-3.5" />
    }
  ];

  return (
    <Panel>
      <PanelHeader
        label="Operator workspace"
        action={
          <Link
            href={`/admin/workspace?businessId=${businessId}`}
            className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted hover:text-steel-bright"
          >
            Open workspace
          </Link>
        }
      />
      <PanelBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {docs.map((doc) => {
            const entry = bySlug.get(doc.file);
            return (
              <div
                key={doc.file}
                className={cn(
                  "rounded-md border border-line-subtle bg-bg-surface-2 p-3",
                  !entry && "opacity-60"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-ink-primary">
                  {doc.icon}
                  {doc.label}
                </div>
                <div className="mt-2 text-xs text-ink-muted">
                  {entry
                    ? `Updated ${formatDate(entry.updatedAt)}`
                    : "Not yet created"}
                </div>
                {entry ? (
                  <div className="mt-1 flex items-center gap-1 text-[10.5px] font-mono uppercase tracking-[0.16em] text-ink-muted">
                    <StatusDot
                      tone={
                        entry.syncStatus === "synced" ? "success" : "muted"
                      }
                    />
                    {entry.syncStatus}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </PanelBody>
    </Panel>
  );
}

function StatusRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink-primary">{value}</span>
    </div>
  );
}
