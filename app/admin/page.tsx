import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Cpu,
  FileText,
  FolderKanban,
  GitBranch,
  HeartPulse,
  Plug,
  Sparkles,
  Star
} from "lucide-react";

import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { StatCard } from "@/components/admin/StatCard";
import { getDisplayName } from "@/components/admin/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function ChecklistItem({
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
        "flex items-center gap-4 rounded-xl border border-ghost-border px-4 py-4 transition-colors",
        complete ? "bg-ghost-raised/30" : "bg-ghost-surface"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          complete ? "bg-status-active/15 text-status-active" : "bg-ghost-raised text-slate-400"
        )}
      >
        {complete ? <CheckCircle2 className="h-5 w-5" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-medium",
            complete ? "text-slate-300 line-through" : "text-white"
          )}
        >
          {title}
        </div>
        <div className="text-sm text-slate-400">{description}</div>
      </div>
      {complete ? (
        <Check className="h-4 w-4 text-status-active" />
      ) : (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-brand-primary transition-colors hover:text-white"
        >
          Open
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await requireServerSession();

  const [adminUser, organization, stats, checklistStatus, recentActivity, health, issueStats, projectCount] =
    await Promise.all([
      db.missionControlAdminUser.findUnique({
        where: {
          id: session.userId
        },
        select: {
          displayName: true
        }
      }),
      session.organizationId
        ? db.organization.findUnique({
            where: {
              id: session.organizationId
            },
            select: {
              createdAt: true,
              config: true
            }
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
            businessIds: session.role === "admin" ? session.businessIds : undefined
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
        : Promise.resolve(0)
    ]);

  const displayName = getDisplayName(session.email, adminUser?.displayName);
  const showChecklist =
    !organization || isRecent(organization.createdAt) || stats.activeBusinesses < 1;
  const showConciergeBanner =
    session.planTier === "founding_concierge" &&
    !isConciergeIntakeComplete(organization?.config);

  const databaseHealth = health?.checks.find((check) => check.name === "Database");
  const openclawHealth = health?.checks.find(
    (check) => check.name === "OpenClaw Runtime"
  );
  const emailHealth = health?.checks.find((check) => check.name === "Email Provider");
  const pendingApprovalHealth = health?.checks.find(
    (check) => check.name === "Pending Approvals"
  );

  const quickActions = [
    {
      href: "/admin/businesses/create",
      label: "New Business",
      icon: Building2,
      className: "text-status-active"
    },
    {
      href: "/admin/agents/create",
      label: "New Agent",
      icon: Bot,
      className: "text-status-info"
    },
    {
      href: "/admin/workflows/create",
      label: "New Workflow",
      icon: GitBranch,
      className: "text-brand-cyan"
    },
    {
      href: "/admin/integrations",
      label: "Connect Service",
      icon: Plug,
      className: "text-brand-amber"
    },
    {
      href: "/admin/logs",
      label: "View Logs",
      icon: FileText,
      className: "text-slate-400"
    },
    {
      href: "/admin/health",
      label: "Run Health Check",
      icon: HeartPulse,
      className: "text-brand-primary"
    }
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back, {displayName}!
          </h1>
          <span className="inline-flex items-center rounded-full border border-brand-primary/25 bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary">
            {session.role === "super_admin" ? "Super Admin" : "Admin"}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          {session.role === "super_admin"
            ? "You have full admin access to all features."
            : "You have scoped access to the businesses assigned to your account."}
        </p>
      </section>

      {showConciergeBanner ? (
        <section className="rounded-2xl border border-brand-amber/30 bg-brand-amber/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-amber text-ghost-black">
                <Star className="h-5 w-5 fill-current" />
              </div>
              <div className="space-y-1">
                <div className="text-lg font-semibold text-white">
                  Your Concierge Experience Awaits
                </div>
                <div className="text-sm text-slate-300">
                  Review your business setup so white-glove onboarding can move forward.
                </div>
              </div>
            </div>
            <Button asChild>
              <Link href="/admin/businesses">Review Businesses</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active Businesses"
          value={stats.activeBusinesses}
          icon={<Building2 className="h-5 w-5" />}
          iconColor="text-status-active"
        />
        <StatCard
          title="Total Agents"
          value={stats.totalAgents}
          icon={<Bot className="h-5 w-5" />}
          iconColor="text-status-info"
        />
        <StatCard
          title="Workflows Running"
          value={stats.workflowsEnabled}
          icon={<GitBranch className="h-5 w-5" />}
          iconColor="text-brand-cyan"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<CheckSquare className="h-5 w-5" />}
          iconColor="text-brand-amber"
          badge={
            stats.pendingApprovals > 0 ? (
              <span className="inline-flex rounded-full border border-brand-amber/25 bg-brand-amber/15 px-2 py-0.5 text-xs font-medium text-brand-amber">
                Needs review
              </span>
            ) : undefined
          }
          href={stats.pendingApprovals > 0 ? "/admin/approvals" : undefined}
        />
      </section>

      {/* Issues & Projects row */}
      {(() => {
        const openIssues = issueStats.find((s) => s.status === "open")?._count.id ?? 0;
        const inProgressIssues = issueStats.find((s) => s.status === "in_progress")?._count.id ?? 0;
        const totalIssues = issueStats.reduce((sum, s) => sum + s._count.id, 0);

        return totalIssues > 0 || projectCount > 0 ? (
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Open Issues"
              value={openIssues}
              icon={<CircleDot className="h-5 w-5" />}
              iconColor="text-zinc-400"
              href="/admin/issues?status=open"
            />
            <StatCard
              title="In Progress"
              value={inProgressIssues}
              icon={<CircleDot className="h-5 w-5" />}
              iconColor="text-brand-cyan"
              href="/admin/issues?status=in_progress"
            />
            <StatCard
              title="Active Projects"
              value={projectCount}
              icon={<FolderKanban className="h-5 w-5" />}
              iconColor="text-brand-primary"
              href="/admin/projects"
            />
          </section>
        ) : null;
      })()}

      {showChecklist ? (
        <section className="rounded-2xl border border-ghost-border bg-ghost-surface p-5">
          <SectionHeader
            title="Get started with Ghost ProtoClaw"
            description="Complete the essentials to bring your first Ghost ProtoClaw business online."
            className="mb-5 border-b-0 pb-0"
          />
          <div className="grid gap-3">
            <ChecklistItem
              complete={checklistStatus.hasBusinesses}
              title="Create your first business"
              description="Set up the business profile that powers your agents and workflows."
              href="/admin/businesses/create"
              icon={<Building2 className="h-5 w-5" />}
            />
            <ChecklistItem
              complete={checklistStatus.hasAgents}
              title="Configure an agent"
              description="Create the operator or specialist agents your business will use."
              href="/admin/agents/create"
              icon={<Bot className="h-5 w-5" />}
            />
            <ChecklistItem
              complete={checklistStatus.hasIntegrations}
              title="Connect an integration"
              description="Link the tools and services your operation depends on."
              href="/admin/integrations"
              icon={<Plug className="h-5 w-5" />}
            />
            <ChecklistItem
              complete={checklistStatus.hasWorkflows}
              title="Set up a workflow"
              description="Automate recurring tasks with guarded, operator-friendly flows."
              href="/admin/workflows"
              icon={<GitBranch className="h-5 w-5" />}
            />
            <ChecklistItem
              complete={checklistStatus.hasModels}
              title="Set model defaults"
              description="Configure business-level primary and fallback models before launch."
              href="/admin/businesses"
              icon={<Cpu className="h-5 w-5" />}
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <div>
          <ActivityFeed items={recentActivity} showViewAll />
        </div>

        <Card className="border-ghost-border bg-ghost-surface">
          <CardHeader className="border-b border-ghost-border">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-xl border border-ghost-border bg-ghost-raised/40 p-4 transition-all hover:border-ghost-border-strong hover:bg-ghost-raised"
                >
                  <div
                    className={cn(
                      "mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-ghost-surface",
                      action.className
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-white">
                    {action.label}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border border-ghost-border bg-ghost-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-cyan" />
              <span className="text-sm font-semibold text-white">
                System Health Summary
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    databaseHealth?.status === "ok"
                      ? "bg-status-active"
                      : databaseHealth?.status === "warning"
                        ? "bg-brand-amber"
                        : "bg-brand-primary"
                  )}
                />
                <span>
                  Database{" "}
                  {databaseHealth?.status === "ok"
                    ? "operational"
                    : databaseHealth?.status === "warning"
                      ? "degraded"
                      : "error"}
                </span>
                {databaseHealth?.latencyMs ? (
                  <span className="text-slate-500">
                    {databaseHealth.latencyMs}ms
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    openclawHealth?.status === "ok"
                      ? "bg-status-active"
                      : openclawHealth?.status === "unconfigured"
                        ? "bg-slate-500"
                        : "bg-brand-primary"
                  )}
                />
                <span>
                  OpenClaw Runtime{" "}
                  {openclawHealth?.status === "ok"
                    ? "connected"
                    : openclawHealth?.status === "unconfigured"
                      ? "unconfigured"
                      : "error"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    emailHealth?.status === "ok"
                      ? "bg-status-active"
                      : emailHealth?.status === "unconfigured"
                        ? "bg-slate-500"
                        : "bg-brand-primary"
                  )}
                />
                <span>
                  Email{" "}
                  {emailHealth?.status === "ok"
                    ? "ready"
                    : emailHealth?.status === "unconfigured"
                      ? "not configured"
                      : "issue detected"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    pendingApprovalHealth?.status === "ok"
                      ? "bg-status-active"
                      : "bg-brand-amber"
                  )}
                />
                <span>
                  Approvals{" "}
                  {pendingApprovalHealth?.status === "ok"
                    ? "clear"
                    : "need review"}
                </span>
              </div>
            </div>
          </div>

          <Button variant="outline" asChild>
            <Link href="/admin/health">View Details</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
