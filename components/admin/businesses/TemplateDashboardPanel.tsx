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
  if (templateId === "tiptax_affiliate_engine") {
    return <TipTaxAffiliateWidgets businessId={businessId} data={templateData} />;
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

// ─── TipTax Affiliate Engine ─────────────────────────────────────────────
//
// Operator cockpit. Tier 1 (is it working?): integration health grid,
// live webhook stream, Sendpilot cap gauge, compliance queue. Tier 2
// (how's it performing?): per-channel inbound trend, 30-day discovery
// sparkline, empty-state placeholders for UTM attribution + downline
// commissions + per-state volume (those widgets light up once
// Prospect/SubAffiliate data flows).

const TIPTAX_INTEGRATION_LABELS: Record<string, string> = {
  social_media_mcp: "Social Media Hub",
  firecrawl_mcp: "Firecrawl",
  postgres_mcp: "PostgreSQL",
  instantly_mcp: "Instantly (cold email)",
  sendpilot_mcp: "Sendpilot (LinkedIn)",
  reddit_mcp: "Reddit",
  playwright_mcp: "Playwright",
  whatsapp_cloud_mcp: "WhatsApp Cloud",
  manychat_mcp: "ManyChat (FB + IG)",
  hubspot_mcp: "HubSpot",
  gohighlevel_mcp: "GoHighLevel",
  smartlead_mcp: "Smartlead"
};

const TIPTAX_CHANNEL_LABELS: Record<string, string> = {
  instantly: "Instantly",
  whatsapp_cloud: "WhatsApp",
  sendpilot: "LinkedIn (Sendpilot)",
  manychat: "ManyChat (FB/IG)"
};

type TipTaxIntegrationHealth = {
  definitionId: string;
  required: boolean;
  installed: boolean;
  status: string;
  updatedAt: string | null;
  lastWebhookAt: string | null;
};

type TipTaxWebhookEvent = {
  id: string;
  title: string;
  detail: string | null;
  status: string | null;
  provider: string | null;
  createdAt: string;
};

type TipTaxComplianceFlag = {
  id: string;
  actionType: string;
  reason: string | null;
  agent: { displayName: string; emoji: string | null } | null;
  createdAt: string;
};

type TipTaxDiscoveryBucket = {
  date: string;
  total: number;
  completed: number;
};

function TipTaxAffiliateWidgets({
  businessId,
  data
}: {
  businessId: string;
  data: Record<string, unknown>;
}) {
  const integrationHealth =
    (data.integrationHealth as TipTaxIntegrationHealth[] | undefined) ?? [];
  const webhookEvents =
    (data.webhookEvents as TipTaxWebhookEvent[] | undefined) ?? [];
  const inboundByChannel =
    (data.inboundByChannel as Record<string, number> | undefined) ?? {};
  const sendpilotCap =
    (data.sendpilotCap as
      | { leadsMonthCap: number; eventsThisMonth: number; pctUsed: number }
      | undefined) ?? { leadsMonthCap: 3000, eventsThisMonth: 0, pctUsed: 0 };
  const discoverySeries =
    (data.discoverySeries as TipTaxDiscoveryBucket[] | undefined) ?? [];
  const recentComplianceFlags =
    (data.recentComplianceFlags as TipTaxComplianceFlag[] | undefined) ?? [];

  const requiredMissing = integrationHealth.filter(
    (h) => h.required && !h.installed
  ).length;
  const suggestedMissing = integrationHealth.filter(
    (h) => !h.required && !h.installed
  ).length;

  const discoveryMax = discoverySeries.reduce(
    (m, b) => Math.max(m, b.total),
    0
  );

  return (
    <div className="space-y-6">
      {/* TIER 1: Integration health + next-best-action */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            label="Integration health"
            action={
              <Link
                href="/admin/integrations/mcp"
                className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted hover:text-steel-bright"
              >
                Manage MCPs
              </Link>
            }
          />
          <PanelBody>
            <div className="mb-3 flex items-center gap-4 text-xs text-ink-muted">
              <span>
                {requiredMissing === 0 ? (
                  <span className="text-state-success">
                    All required MCPs installed
                  </span>
                ) : (
                  <span className="text-state-warning">
                    {requiredMissing} required MCP
                    {requiredMissing === 1 ? "" : "s"} missing
                  </span>
                )}
              </span>
              <span>{suggestedMissing} suggested not yet installed</span>
            </div>
            <div className="divide-y divide-line-subtle">
              {integrationHealth.map((h) => {
                const label = TIPTAX_INTEGRATION_LABELS[h.definitionId] ?? h.definitionId;
                const tone: "success" | "warning" | "muted" = !h.installed
                  ? h.required
                    ? "warning"
                    : "muted"
                  : h.status === "active" || h.status === "connected"
                    ? "success"
                    : "muted";
                return (
                  <div
                    key={h.definitionId}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot tone={tone} />
                      <span className="text-ink-primary">{label}</span>
                      {h.required ? (
                        <Badge variant="amber" className="text-[10px]">
                          required
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                      {h.installed ? (
                        <>
                          <span>{h.status}</span>
                          {h.lastWebhookAt ? (
                            <span>webhook: {formatDate(h.lastWebhookAt)}</span>
                          ) : h.definitionId in {
                              instantly_mcp: true,
                              whatsapp_cloud_mcp: true,
                              sendpilot_mcp: true,
                              manychat_mcp: true
                            } ? (
                            <span className="text-state-warning">
                              no webhook events yet
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span>
                          {h.required ? "install required" : "optional"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Next best action" />
          <PanelBody>
            <p className="mb-4 text-sm text-ink-muted">
              Fire the Recovery Ops Lead and ask for today&apos;s pipeline
              digest. It&apos;ll summarize both funnels, channel breakdown,
              and the one move that most likely moves the needle today.
            </p>
            <Link
              href={`/admin/businesses/${businessId}/chat`}
              className="inline-flex items-center gap-2 rounded-md bg-steel px-3 py-2 text-sm font-medium text-white hover:bg-steel-bright"
            >
              <Sparkles className="h-4 w-4" />
              Open Recovery Ops Lead chat
            </Link>
            <div className="mt-4 space-y-2 text-xs text-ink-muted">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" />
                <Link
                  href={`/admin/businesses/${businessId}/knowledge`}
                  className="hover:text-steel-bright"
                >
                  Setup Guide in KB
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                <Link
                  href={`/admin/approvals?businessId=${businessId}`}
                  className="hover:text-steel-bright"
                >
                  Approvals queue
                </Link>
              </div>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 1: Live webhook stream + Sendpilot cap */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            label="Unified inbox (recent webhook events)"
            action={
              <Link
                href={`/admin/businesses/${businessId}/activity`}
                className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted hover:text-steel-bright"
              >
                Full stream
              </Link>
            }
          />
          <PanelBody>
            {webhookEvents.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No webhook events yet. Once Instantly / WhatsApp / Sendpilot /
                ManyChat are configured and send events, they&apos;ll stream
                here for the Reply Triager to classify.
              </p>
            ) : (
              <div className="divide-y divide-line-subtle">
                {webhookEvents.map((e) => {
                  const providerLabel = e.provider
                    ? TIPTAX_CHANNEL_LABELS[e.provider] ?? e.provider
                    : "unknown";
                  const tone: "success" | "warning" | "muted" =
                    e.status === "error"
                      ? "warning"
                      : e.status === "warning"
                        ? "warning"
                        : "success";
                  return (
                    <div key={e.id} className="py-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <StatusDot tone={tone} />
                          <Badge
                            variant="info"
                            className="text-[10px] uppercase"
                          >
                            {providerLabel}
                          </Badge>
                          <span className="text-ink-primary">{e.title}</span>
                        </div>
                        <span className="text-[11px] text-ink-muted">
                          {formatDate(e.createdAt)}
                        </span>
                      </div>
                      {e.detail ? (
                        <p className="ml-5 mt-1 text-[11.5px] leading-5 text-ink-muted">
                          {e.detail.length > 160
                            ? `${e.detail.slice(0, 160)}…`
                            : e.detail}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Sendpilot monthly cap" />
          <PanelBody>
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-3xl font-mono text-ink-primary">
                {sendpilotCap.eventsThisMonth.toLocaleString()}
              </span>
              <span className="text-sm text-ink-muted">
                of {sendpilotCap.leadsMonthCap.toLocaleString()} events
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-surface-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  sendpilotCap.pctUsed >= 90
                    ? "bg-state-warning"
                    : sendpilotCap.pctUsed >= 70
                      ? "bg-steel-bright"
                      : "bg-steel"
                )}
                style={{ width: `${Math.min(100, sendpilotCap.pctUsed)}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-ink-muted">
              AppSumo Lifetime Tier 2 ships 3 senders + 3,000 leads/mo. Once
              this bar crosses 70% with days left in the month, slow the
              LinkedIn pace or upgrade. Events include DMs, connections, and
              replies attributed to Sendpilot.
            </p>
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 1: Compliance queue */}
      <Panel>
        <PanelHeader
          label="Compliance flags (operator review)"
          action={
            <Link
              href={`/admin/approvals?businessId=${businessId}`}
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted hover:text-steel-bright"
            >
              Approvals queue
            </Link>
          }
        />
        <PanelBody>
          {recentComplianceFlags.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No pending flags. Compliance Officer routes anything non-compliant
              here via delegate_task → approvalRequest; it&apos;s empty means the
              agents are shipping clean.
            </p>
          ) : (
            <div className="divide-y divide-line-subtle">
              {recentComplianceFlags.map((f) => (
                <div key={f.id} className="flex items-start gap-3 py-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 text-state-warning" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-ink-primary">
                      {f.agent?.emoji ? <span>{f.agent.emoji}</span> : null}
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                        {f.actionType}
                      </span>
                      {f.agent?.displayName ? (
                        <span className="text-[11px] text-ink-muted">
                          from {f.agent.displayName}
                        </span>
                      ) : null}
                    </div>
                    {f.reason ? (
                      <p className="mt-1 text-[11.5px] leading-5 text-ink-muted">
                        {f.reason.length > 200
                          ? `${f.reason.slice(0, 200)}…`
                          : f.reason}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-ink-muted">
                    {formatDate(f.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>

      {/* TIER 2: Per-channel inbound (last 30d) + Daily Discovery sparkline */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader label="Inbound by channel (30d)" />
          <PanelBody>
            <div className="space-y-2">
              {Object.keys(TIPTAX_CHANNEL_LABELS).map((provider) => {
                const count = inboundByChannel[provider] ?? 0;
                const maxForScale = Math.max(
                  1,
                  ...Object.values(inboundByChannel).map((n) => Number(n))
                );
                const pct = Math.round((count / maxForScale) * 100);
                return (
                  <div key={provider}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-primary">
                        {TIPTAX_CHANNEL_LABELS[provider]}
                      </span>
                      <span className="font-mono text-ink-muted">{count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
                      <div
                        className="h-full rounded-full bg-steel"
                        style={{ width: `${count === 0 ? 0 : Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-ink-muted">
              Count of webhook events received per provider over the last 30
              days. Used as a reply-rate proxy until the Data Analyst has
              per-campaign attribution.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Daily prospect discovery (30d)" />
          <PanelBody>
            {discoveryMax === 0 ? (
              <p className="text-sm text-ink-muted">
                No Daily Prospect Discovery runs yet. Once the workflow fires
                (check /admin/businesses/{businessId}/workflows), the
                30-day bars light up.
              </p>
            ) : (
              <div className="flex h-24 items-end gap-[2px]">
                {discoverySeries.map((b) => {
                  const h = b.total === 0 ? 2 : Math.max(4, (b.total / discoveryMax) * 100);
                  const tone =
                    b.completed === b.total && b.total > 0
                      ? "bg-steel"
                      : b.total > 0
                        ? "bg-steel/60"
                        : "bg-bg-surface-2";
                  return (
                    <div
                      key={b.date}
                      className={cn("flex-1 rounded-sm", tone)}
                      style={{ height: `${h}%` }}
                      title={`${b.date}: ${b.completed}/${b.total} runs`}
                    />
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted">
              <span>
                {discoverySeries.reduce((n, b) => n + b.total, 0)} runs total
              </span>
              <span>
                {discoverySeries.reduce((n, b) => n + b.completed, 0)}{" "}
                completed
              </span>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* TIER 2: Funnel drop-off + remaining empty-state placeholders */}
      <FunnelDropOffPanel data={data} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader label="UTM campaign attribution" />
          <PanelBody>
            <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-ink-muted">
              <TrendingUp className="mb-2 h-6 w-6 opacity-50" />
              <p>
                Populates once signed affiliates flow through the TipTax
                portal webhook.
              </p>
              <p className="mt-1">
                Data Analyst reads utm_source + utm_campaign per signed
                affiliate and ranks pitch registers by conversion.
              </p>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Downline commissions" />
          <PanelBody>
            <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-ink-muted">
              <GitBranch className="mb-2 h-6 w-6 opacity-50" />
              <p>
                Populates once the first sub-affiliate is recruited and
                tracked via a SubAffiliate record.
              </p>
              <p className="mt-1">
                See the Downline Playbook in the workspace for the structure.
              </p>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader label="Per-state volume" />
          <PanelBody>
            <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-ink-muted">
              <Radar className="mb-2 h-6 w-6 opacity-50" />
              <p>
                Populates once Prospect Hunter writes scored prospects to a
                Prospect table (not yet schema&apos;d).
              </p>
              <p className="mt-1">
                Until then: ask the Ops Lead for the daily digest which
                surfaces the top metros.
              </p>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

// ─── TipTax Funnel Drop-Off (Commit C) ──────────────────────────────

const FUNNEL_STAGE_LABELS: Record<string, string> = {
  sourced: "Sourced",
  qualified: "Qualified",
  contacted: "Contacted",
  replied: "Replied",
  engaged: "Engaged",
  link_sent: "Link Sent",
  form_started: "Form Started",
  form_completed: "Form Completed",
  accepted: "Accepted"
};

type FunnelSummary = {
  stageCounts: Record<string, number>;
  conversionRates: Array<{
    fromStage: string;
    toStage: string;
    fromCount: number;
    everReachedTo: number;
    conversionRate: number;
  }>;
  leakiestStage: {
    fromStage: string;
    toStage: string;
    conversionRate: number;
  } | null;
  windowDays: number;
};

function FunnelDropOffPanel({ data }: { data: Record<string, unknown> }) {
  const summary = data.funnelSummary as FunnelSummary | undefined;

  if (!summary) {
    return null;
  }

  const total = summary.stageCounts.sourced ?? 0;
  const hasData = total > 0;

  return (
    <Panel>
      <PanelHeader
        label={`Funnel drop-off (last ${summary.windowDays}d)`}
        action={
          summary.leakiestStage ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-state-warning">
              Leakiest: {FUNNEL_STAGE_LABELS[summary.leakiestStage.fromStage]} →{" "}
              {FUNNEL_STAGE_LABELS[summary.leakiestStage.toStage]} (
              {summary.leakiestStage.conversionRate}%)
            </span>
          ) : null
        }
      />
      <PanelBody>
        {!hasData ? (
          <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-ink-muted">
            <TrendingUp className="mb-2 h-6 w-6 opacity-50" />
            <p>
              No prospects sourced in the last {summary.windowDays} days yet.
            </p>
            <p className="mt-1">
              Once Prospect Hunter starts writing rows via{" "}
              <code className="rounded bg-bg-surface-2 px-1">
                prospect_record_source
              </code>
              , this fills with stage counts + conversion rates between
              adjacent stages.
            </p>
          </div>
        ) : (
          <>
            {/* Stage bars */}
            <div className="space-y-2">
              {Object.entries(FUNNEL_STAGE_LABELS).map(([stage, label]) => {
                const count = summary.stageCounts[stage] ?? 0;
                const pct = total === 0 ? 0 : Math.round((count / total) * 100);
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-primary">{label}</span>
                      <span className="font-mono text-ink-muted">
                        {count}{" "}
                        <span className="text-[10.5px] text-ink-muted">
                          ({pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-2">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          stage === "accepted"
                            ? "bg-state-success"
                            : "bg-steel"
                        )}
                        style={{ width: `${count === 0 ? 0 : Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conversion rates between stages */}
            <div className="mt-5 border-t border-line-subtle pt-4">
              <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-muted">
                Conversion between stages
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {summary.conversionRates.map((r) => {
                  const isLeak =
                    summary.leakiestStage &&
                    r.fromStage === summary.leakiestStage.fromStage &&
                    r.toStage === summary.leakiestStage.toStage;
                  return (
                    <div
                      key={`${r.fromStage}-${r.toStage}`}
                      className={cn(
                        "rounded-md border p-2",
                        isLeak
                          ? "border-state-warning/40 bg-state-warning/10"
                          : "border-line-subtle bg-bg-surface-2/30"
                      )}
                    >
                      <div className="text-[10.5px] text-ink-muted">
                        {FUNNEL_STAGE_LABELS[r.fromStage]} →{" "}
                        {FUNNEL_STAGE_LABELS[r.toStage]}
                      </div>
                      <div className="mt-1 font-mono text-sm text-ink-primary">
                        {r.conversionRate}%{" "}
                        <span className="text-[10.5px] text-ink-muted">
                          ({r.everReachedTo}/{r.fromCount})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-4 text-[11px] text-ink-muted">
              Counts prospects sourced in the window, regardless of their
              current stage. Conversion rate = % of prospects that reached
              the next stage (per ProspectStageEvent log). Leakiest stage
              flagged when from-count ≥ 5 to avoid noise.
            </p>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
