import Link from "next/link";
import { Clock, GitBranch, PlayCircle, Webhook } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { WorkflowCard } from "@/components/admin/workflows/WorkflowCard";
import { WorkflowsFilterBar } from "@/components/admin/workflows/WorkflowsFilterBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { listWorkflows } from "@/lib/repository/workflows";

export const dynamic = "force-dynamic";

type WorkflowsPageProps = {
  searchParams?: {
    businessId?: string;
    trigger?: string;
    status?: string;
    search?: string;
  };
};

function toEnabledFilter(status?: string) {
  if (status === "disabled") {
    return false;
  }

  if (status === "all") {
    return undefined;
  }

  return true;
}

export default async function WorkflowsPage({
  searchParams
}: WorkflowsPageProps) {
  const session = await requireServerSession();
  const businessFilter = searchParams?.businessId;
  const trigger = searchParams?.trigger ?? "all";
  const status = searchParams?.status ?? "active";
  const search = searchParams?.search ?? "";

  if (!session.organizationId) {
    return null;
  }

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: {
            in: session.businessIds
          }
        }
      : {
          organizationId: session.organizationId
        };

  const [businesses, workflows, totalCount, enabledCount, scheduledCount, webhookCount, pendingRuns] =
    await Promise.all([
      db.business.findMany({
        where: businessWhere,
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: "asc"
        }
      }),
      listWorkflows({
        organizationId: session.organizationId,
        businessId: businessFilter,
        trigger,
        enabled: toEnabledFilter(status),
        search,
        businessIds: session.role === "admin" ? session.businessIds : undefined
      }),
      db.workflow.count({
        where: {
          business: businessWhere
        }
      }),
      db.workflow.count({
        where: {
          business: businessWhere,
          enabled: true
        }
      }),
      db.workflow.count({
        where: {
          business: businessWhere,
          trigger: "scheduled"
        }
      }),
      db.workflow.count({
        where: {
          business: businessWhere,
          trigger: "webhook"
        }
      }),
      db.actionRun.count({
        where: {
          workflow: {
            business: businessWhere
          },
          status: "pending"
        }
      })
    ]);

  const groups = businesses
    .map((business) => ({
      business,
      workflows: workflows.filter((workflow) => workflow.businessId === business.id)
    }))
    .filter((group) => group.workflows.length > 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Workflows"
        description="Automate your business operations with scheduled, triggered, and event-driven workflows"
        action={
          <Button asChild>
            <Link href="/admin/workflows/create">New Workflow</Link>
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-ghost-border bg-ghost-surface">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Total
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{totalCount}</div>
            </div>
            <GitBranch className="h-5 w-5 text-slate-400" />
          </CardContent>
        </Card>
        <Card className="border-ghost-border bg-ghost-surface">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Active
              </div>
              <div className="mt-2 text-2xl font-bold text-status-active">
                {enabledCount}
              </div>
            </div>
            <PlayCircle className="h-5 w-5 text-status-active" />
          </CardContent>
        </Card>
        <Card className="border-ghost-border bg-ghost-surface">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Scheduled
              </div>
              <div className="mt-2 text-2xl font-bold text-brand-cyan">
                {scheduledCount}
              </div>
            </div>
            <Clock className="h-5 w-5 text-brand-cyan" />
          </CardContent>
        </Card>
        <Card className="border-ghost-border bg-ghost-surface">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Webhook
              </div>
              <div className="mt-2 text-2xl font-bold text-brand-amber">
                {webhookCount}
              </div>
            </div>
            <Webhook className="h-5 w-5 text-brand-amber" />
          </CardContent>
        </Card>
        <Card className="border-ghost-border bg-ghost-surface">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Pending Runs
              </div>
              <div className="mt-2 text-2xl font-bold text-status-error">
                {pendingRuns}
              </div>
            </div>
            <GitBranch className="h-5 w-5 text-status-error" />
          </CardContent>
        </Card>
      </div>

      <WorkflowsFilterBar
        initialSearch={search}
        currentBusinessId={businessFilter ?? "all"}
        currentTrigger={trigger}
        currentStatus={status}
        businesses={businesses}
      />

      {workflows.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-6 w-6" />}
          title="No workflows yet"
          description="Create your first workflow to automate recurring tasks, inbound events, and operator routines."
          action={
            <Button asChild>
              <Link href="/admin/workflows/create">Create Workflow</Link>
            </Button>
          }
        />
      ) : businessFilter ? (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              canRunNow={
                workflow.trigger === "manual" || session.role === "super_admin"
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ business, workflows: groupedWorkflows }) => (
            <section key={business.id} className="space-y-4">
              <div>
                <Link
                  href={`/admin/businesses/${business.id}`}
                  className="text-lg font-semibold text-white transition-colors hover:text-brand-cyan"
                >
                  {business.name}
                </Link>
                <div className="text-sm text-slate-500">
                  {groupedWorkflows.length} workflow
                  {groupedWorkflows.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="grid gap-4">
                {groupedWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    canRunNow={
                      workflow.trigger === "manual" ||
                      session.role === "super_admin"
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
