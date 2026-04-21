import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Cpu,
  FolderKanban,
  GitBranch,
  HeartPulse,
  Plug,
  Sparkles,
  Star,
  Zap
} from "lucide-react";

import { DismissableChecklist } from "@/components/admin/DismissableChecklist";
import { getDisplayName } from "@/components/admin/utils";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/auth/server-session";
import {
  getChecklistStatus,
  getDashboardStats,
  getRecentActivity
} from "@/lib/repository/dashboard";
import { runFullHealthCheck } from "@/lib/health/system-health";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ── Small helpers ──────────────────────────────────────────────────────

function isChecklistDismissed(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }
  return Boolean(
    (config as Record<string, unknown>).checklist_dismissed === true
  );
}

function isConciergeIntakeComplete(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }
  return Boolean(
    (config as Record<string, unknown>).concierge_intake_complete === true
  );
}

function isRecent(date: Date) {
  return Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
}

function formatUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return "<$0.01";
  if (amount < 10) return `$${amount.toFixed(2)}`;
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  return `$${Math.round(amount).toLocaleString()}`;
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default async function AdminDashboardPage() {
  const session = await requireServerSession();

  // ── Data fetching ──────────────────────────────────────────────────
  // Keep the shared repository calls for the metrics that already power
  // the old dashboard. Add two new fetches: (1) TokenUsageLog aggregates
  // for today + this month, (2) active ActionRun count for "Now Running".

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(
    todayStart.getFullYear(),
    todayStart.getMonth(),
    1
  );

  const [
    adminUser,
    organization,
    stats,
    checklistStatus,
    recentActivity,
    health,
    issueStats,
    projectCount,
    costToday,
    costMonth,
    activeRuns
  ] = await Promise.all([
    db.missionControlAdminUser.findUnique({
      where: { id: session.userId },
      select: { displayName: true }
    }),
    session.organizationId
      ? db.organization.findUnique({
          where: { id: session.organizationId },
          select: { createdAt: true, config: true }
        })
      : Promise.resolve(null),
    session.organizationId
      ? getDashboardStats(
          session.organizationId,
          session.role,
          session.businessIds
        )
      : Promise.resolve({
          activeBusinesses: 0,
          totalAgents: 0,
          workflowsEnabled: 0,
          pendingApprovals: 0
        }),
    session.organizationId
      ? getChecklistStatus(
          session.organizationId,
          session.role,
          session.businessIds
        )
      : Promise.resolve({
          hasBusinesses: false,
          hasAgents: false,
          hasWorkflows: false,
          hasIntegrations: false,
          hasModels: false
        }),
    session.organizationId
      ? getRecentActivity(
          session.organizationId,
          10,
          session.role,
          session.businessIds
        )
      : Promise.resolve([]),
    session.organizationId
      ? runFullHealthCheck(session.organizationId, {
          businessIds:
            session.role === "admin" ? session.businessIds : undefined
        })
      : Promise.resolve(null),
    session.organizationId
      ? db.issue.groupBy({
          by: ["status"],
          where: {
            business: {
              organizationId: session.organizationId,
              ...(session.role === "admin"
                ? { id: { in: session.businessIds } }
                : {})
            }
          },
          _count: { id: true }
        })
      : Promise.resolve([]),
    session.organizationId
      ? db.project.count({
          where: {
            business: {
              organizationId: session.organizationId,
              ...(session.role === "admin"
                ? { id: { in: session.businessIds } }
                : {})
            },
            status: "active"
          }
        })
      : Promise.resolve(0),
    session.organizationId
      ? db.tokenUsageLog.aggregate({
          where: {
            organizationId: session.organizationId,
            createdAt: { gte: todayStart },
            ...(session.role === "admin"
              ? { businessId: { in: session.businessIds } }
              : {})
          },
          _sum: { estimatedCostUsd: true }
        })
      : Promise.resolve({ _sum: { estimatedCostUsd: 0 } }),
    session.organizationId
      ? db.tokenUsageLog.aggregate({
          where: {
            organizationId: session.organizationId,
            createdAt: { gte: monthStart },
            ...(session.role === "admin"
              ? { businessId: { in: session.businessIds } }
              : {})
          },
          _sum: { estimatedCostUsd: true }
        })
      : Promise.resolve({ _sum: { estimatedCostUsd: 0 } }),
    session.organizationId
      ? db.actionRun.findMany({
          where: {
            status: { in: ["running", "pending"] },
            business: {
              organizationId: session.organizationId,
              ...(session.role === "admin"
                ? { id: { in: session.businessIds } }
                : {})
            }
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            action: true,
            status: true,
            createdAt: true,
            startedAt: true,
            agent: { select: { displayName: true, emoji: true } },
            workflow: { select: { name: true } },
            business: { select: { name: true } }
          }
        })
      : Promise.resolve([])
  ]);

  const displayName = getDisplayName(session.email, adminUser?.displayName);
  const showChecklist =
    (!organization ||
      isRecent(organization.createdAt) ||
      stats.activeBusinesses < 1) &&
    !isChecklistDismissed(organization?.config);
  const showConciergeBanner =
    session.planTier === "founding_concierge" &&
    !isConciergeIntakeComplete(organization?.config);

  const databaseHealth = health?.checks.find((c) => c.name === "Database");
  const emailHealth = health?.checks.find((c) => c.name === "Email Provider");
  const pendingApprovalHealth = health?.checks.find(
    (c) => c.name === "Pending Approvals"
  );

  const openIssues =
    issueStats.find((s) => s.status === "open")?._count.id ?? 0;
  const inProgressIssues =
    issueStats.find((s) => s.status === "in_progress")?._count.id ?? 0;
  const totalIssues = issueStats.reduce((sum, s) => sum + s._count.id, 0);

  const costTodayValue = costToday._sum.estimatedCostUsd ?? 0;
  const costMonthValue = costMonth._sum.estimatedCostUsd ?? 0;
  const activeRunCount = activeRuns.length;

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header: tiny greeting + Super Admin corner pill ────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-0.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted">
            Today · {todayStart.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric"
            })}
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink-primary">
            Welcome back, {displayName}.
          </h1>
        </div>
        <span className="inline-flex items-center rounded-md border border-steel/25 bg-steel/8 px-2.5 py-1 text-[11px] font-medium text-steel-bright">
          {session.role === "super_admin" ? "Super Admin" : "Admin"}
        </span>
      </header>

      {/* ── Concierge banner (if applicable) ────────────────────────── */}
      {showConciergeBanner ? (
        <div className="rounded-lg border border-state-warning/30 bg-state-warning/8 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-state-warning/20 text-state-warning">
                <Star className="h-4 w-4 fill-current" strokeWidth={1.5} />
              </div>
              <div className="space-y-0.5">
                <div className="text-[14px] font-medium text-ink-primary">
                  Your concierge setup is waiting.
                </div>
                <div className="text-[12px] text-ink-secondary">
                  Review your business setup so white-glove onboarding can
                  move forward.
                </div>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/businesses">Review Businesses →</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {/* ── Stat bento: 4 headline metrics ──────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          label="Active businesses"
          value={String(stats.activeBusinesses)}
          icon={<Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/businesses"
        />
        <StatBlock
          label="Agents deployed"
          value={String(stats.totalAgents)}
          icon={<Bot className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/agents"
        />
        <StatBlock
          label="Workflows running"
          value={String(stats.workflowsEnabled)}
          icon={<GitBranch className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/workflows"
        />
        <StatBlock
          label="Pending approvals"
          value={String(stats.pendingApprovals)}
          icon={<CheckSquare className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/approvals"
          tone={stats.pendingApprovals > 0 ? "warning" : "default"}
        />
      </section>

      {/* ── Secondary row: Cost + Issues + Projects ─────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock
          label="Cost today"
          value={formatUsd(costTodayValue)}
          icon={<Zap className="h-3.5 w-3.5" strokeWidth={1.5} />}
          mono
          href="/admin/costs"
        />
        <StatBlock
          label="Cost this month"
          value={formatUsd(costMonthValue)}
          icon={<Zap className="h-3.5 w-3.5" strokeWidth={1.5} />}
          mono
          href="/admin/costs"
        />
        {totalIssues > 0 ? (
          <StatBlock
            label="Open issues"
            value={String(openIssues + inProgressIssues)}
            icon={<CircleDot className="h-3.5 w-3.5" strokeWidth={1.5} />}
            href="/admin/issues"
            subtext={
              inProgressIssues > 0
                ? `${inProgressIssues} in progress`
                : undefined
            }
          />
        ) : (
          <StatBlock
            label="Open issues"
            value="0"
            icon={<CircleDot className="h-3.5 w-3.5" strokeWidth={1.5} />}
            subtext="All clear"
          />
        )}
        <StatBlock
          label="Active projects"
          value={String(projectCount)}
          icon={<FolderKanban className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/projects"
        />
      </section>

      {/* ── Onboarding checklist (first-week only) ──────────────────── */}
      {showChecklist ? (
        <DismissableChecklist>
          <div className="grid gap-2.5">
            <ChecklistRow
              complete={checklistStatus.hasBusinesses}
              title="Create your first business"
              description="Set up the business profile that powers your agents and workflows."
              href="/admin/businesses/create"
              icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
            />
            <ChecklistRow
              complete={checklistStatus.hasAgents}
              title="Configure an agent"
              description="Create the operator or specialist agents your business will use."
              href="/admin/agents/create"
              icon={<Bot className="h-4 w-4" strokeWidth={1.5} />}
            />
            <ChecklistRow
              complete={checklistStatus.hasIntegrations}
              title="Connect an integration"
              description="Link the tools and services your operation depends on."
              href="/admin/integrations"
              icon={<Plug className="h-4 w-4" strokeWidth={1.5} />}
            />
            <ChecklistRow
              complete={checklistStatus.hasWorkflows}
              title="Set up a workflow"
              description="Automate recurring tasks with guarded, operator-friendly flows."
              href="/admin/workflows"
              icon={<GitBranch className="h-4 w-4" strokeWidth={1.5} />}
            />
            <ChecklistRow
              complete={checklistStatus.hasModels}
              title="Set model defaults"
              description="Configure primary and fallback models before launch."
              href="/admin/businesses"
              icon={<Cpu className="h-4 w-4" strokeWidth={1.5} />}
            />
          </div>
        </DismissableChecklist>
      ) : null}

      {/* ── Main content grid: Now Running + Recent Activity ────────── */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Now Running panel */}
        <Panel>
          <PanelHeader
            label="Now Running"
            action={
              <Link
                href="/admin/activity"
                className="inline-flex items-center gap-1 text-[11px] text-ink-muted transition hover:text-steel-bright"
              >
                View all <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
              </Link>
            }
          />
          {activeRunCount === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-2">
                <CircleDot
                  className="h-3.5 w-3.5 text-ink-muted"
                  strokeWidth={1.5}
                />
              </div>
              <div className="text-[13px] text-ink-secondary">
                Nothing running right now.
              </div>
              <div className="mt-0.5 text-[11px] text-ink-muted">
                Agents will show up here when they pick up work.
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {activeRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-bg-surface-2"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                      run.status === "running"
                        ? "bg-steel-bright shadow-[0_0_6px_var(--steel)]"
                        : "bg-state-warning"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink-primary">
                      {run.workflow?.name ??
                        run.agent?.displayName ??
                        run.action}
                    </div>
                    <div className="truncate text-[11px] text-ink-muted">
                      {run.business?.name ?? "—"} ·{" "}
                      {run.status === "running"
                        ? `running ${relativeTime(run.startedAt ?? run.createdAt)}`
                        : "queued"}
                    </div>
                  </div>
                  {run.agent?.emoji ? (
                    <span className="text-base">{run.agent.emoji}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent Activity panel */}
        <Panel>
          <PanelHeader
            label="Recent Activity"
            action={
              <Link
                href="/admin/activity"
                className="inline-flex items-center gap-1 text-[11px] text-ink-muted transition hover:text-steel-bright"
              >
                View all <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
              </Link>
            }
          />
          {recentActivity.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-ink-secondary">
              No activity yet.
            </div>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {recentActivity.slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-bg-surface-2"
                >
                  <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-ink-primary">
                      {item.title}
                    </div>
                    {item.detail ? (
                      <div className="truncate text-[11px] text-ink-muted">
                        {item.detail}
                      </div>
                    ) : null}
                  </div>
                  <time
                    className="flex-shrink-0 font-mono text-[10px] text-ink-muted"
                    dateTime={item.createdAt.toISOString?.() ?? ""}
                  >
                    {relativeTime(
                      item.createdAt instanceof Date
                        ? item.createdAt
                        : new Date(item.createdAt)
                    )}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* ── System Health strip ─────────────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-lg border border-line-subtle bg-bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles
              className="h-3.5 w-3.5 text-steel"
              strokeWidth={1.5}
            />
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              System Health
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-secondary">
            <HealthPill
              label="Database"
              status={databaseHealth?.status}
              detail={
                databaseHealth?.latencyMs
                  ? `${databaseHealth.latencyMs}ms`
                  : undefined
              }
            />
            <HealthPill label="Email" status={emailHealth?.status} />
            <HealthPill
              label="Approvals"
              status={pendingApprovalHealth?.status}
            />
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
              <HeartPulse className="h-3 w-3" strokeWidth={1.5} />
              <span>
                {health?.checks.filter((c) => c.status === "ok").length ?? 0}/
                {health?.checks.length ?? 0} healthy
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/health">
            View details <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

type StatBlockProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  mono?: boolean;
  href?: string;
  tone?: "default" | "warning";
  subtext?: string;
};

function StatBlock({
  label,
  value,
  icon,
  mono,
  href,
  tone = "default",
  subtext
}: StatBlockProps) {
  const inner = (
    <div
      className={cn(
        "group rounded-lg border bg-bg-surface p-4 transition-all duration-150",
        "border-line-subtle hover:border-line hover:bg-bg-surface-2",
        tone === "warning" && "border-state-warning/25"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          {label}
        </span>
        <span
          className={cn(
            "text-ink-muted transition group-hover:text-steel-bright",
            tone === "warning" && "text-state-warning"
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={cn(
          "text-[28px] font-semibold leading-none tracking-tight text-ink-primary",
          mono && "font-mono tracking-[-0.02em]"
        )}
      >
        {value}
      </div>
      {subtext ? (
        <div className="mt-1.5 text-[11px] text-ink-muted">{subtext}</div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-subtle bg-bg-surface">
      {children}
    </div>
  );
}

function PanelHeader({
  label,
  action
}: {
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line-subtle px-4 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
        {label}
      </span>
      {action}
    </div>
  );
}

function HealthPill({
  label,
  status,
  detail
}: {
  label: string;
  status?: string;
  detail?: string;
}) {
  const color =
    status === "ok"
      ? "bg-state-success"
      : status === "warning"
        ? "bg-state-warning"
        : status === "unconfigured"
          ? "bg-ink-muted"
          : "bg-state-danger";

  const label2 =
    status === "ok"
      ? "ok"
      : status === "warning"
        ? "warning"
        : status === "unconfigured"
          ? "off"
          : "error";

  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      <span className="text-ink-secondary">{label}</span>
      <span className="font-mono text-[10px] text-ink-muted">{label2}</span>
      {detail ? (
        <span className="font-mono text-[10px] text-ink-muted">{detail}</span>
      ) : null}
    </div>
  );
}

function ChecklistRow({
  complete,
  title,
  description,
  href,
  icon
}: {
  complete: boolean;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-3 transition",
        complete
          ? "border-line-subtle bg-bg-surface/50"
          : "border-line-subtle bg-bg-surface hover:border-line"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
          complete
            ? "bg-state-success/15 text-state-success"
            : "bg-bg-surface-2 text-ink-secondary"
        )}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[13px] font-medium",
            complete
              ? "text-ink-muted line-through"
              : "text-ink-primary"
          )}
        >
          {title}
        </div>
        <div className="text-[11px] text-ink-muted">{description}</div>
      </div>
      {complete ? (
        <Check className="h-3.5 w-3.5 text-state-success" />
      ) : (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[12px] text-steel-bright transition hover:text-ink-primary"
        >
          Open
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
