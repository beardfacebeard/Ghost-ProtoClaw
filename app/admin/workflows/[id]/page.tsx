import Link from "next/link";
import { ArrowLeft, CheckSquare, Clock, GitBranch, PlayCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { StatCard } from "@/components/admin/StatCard";
import { WorkflowDetailActions } from "@/components/admin/workflows/WorkflowDetailActions";
import { WorkflowDetailTabs } from "@/components/admin/workflows/WorkflowDetailTabs";
import { TriggerBadge } from "@/components/admin/workflows/TriggerBadge";
import { Badge } from "@/components/ui/badge";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { getWorkflowById } from "@/lib/repository/workflows";
import { getNextRunTime } from "@/lib/workflows/schedule-parser";
import { formatWorkflowDate, getWorkflowEnabledMeta } from "@/components/admin/workflows/utils";

export const dynamic = "force-dynamic";

type WorkflowDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function WorkflowDetailPage({
  params
}: WorkflowDetailPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    notFound();
  }

  const workflow = await getWorkflowById(
    params.id,
    session.organizationId,
    session.role === "admin" ? session.businessIds : undefined
  );

  if (!workflow) {
    notFound();
  }

  const [
    totalRuns,
    completedRuns,
    pendingApprovals,
    webhookEndpoint,
    webhookEvents,
    runs
  ] = await Promise.all([
    db.actionRun.count({
      where: {
        workflowId: workflow.id
      }
    }),
    db.actionRun.count({
      where: {
        workflowId: workflow.id,
        status: "completed"
      }
    }),
    db.approvalRequest.count({
      where: {
        workflowId: workflow.id,
        status: "pending"
      }
    }),
    workflow.trigger === "webhook"
      ? db.webhookEndpoint.findFirst({
          where: {
            workflowId: workflow.id
          },
          select: {
            id: true,
            provider: true,
            enabled: true,
            totalReceived: true,
            lastReceivedAt: true,
            encryptedSecret: true,
            secret: true
          }
        })
      : null,
    workflow.trigger === "webhook" &&
    workflow.webhookEndpoints.length > 0
      ? db.webhookEvent.findMany({
          where: {
            endpointId: workflow.webhookEndpoints[0].id
          },
          select: {
            id: true,
            eventType: true,
            verified: true,
            status: true,
            createdAt: true,
            payload: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 10
        })
      : [],
    db.actionRun.findMany({
      where: {
        workflowId: workflow.id
      },
      select: {
        id: true,
        status: true,
        action: true,
        reason: true,
        result: true,
        error: true,
        startedAt: true,
        completedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    })
  ]);

  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  const nextRun = getNextRunTime(workflow);
  const enabledMeta = getWorkflowEnabledMeta(workflow.enabled);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/admin/workflows"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Workflows
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{workflow.name}</h1>
              <TriggerBadge trigger={workflow.trigger} />
              <Badge className={enabledMeta.className}>{enabledMeta.label}</Badge>
              {workflow.business ? (
                <Badge className="bg-brand-cyan/15 text-brand-cyan">
                  {workflow.business.name}
                </Badge>
              ) : null}
              {workflow.agent ? (
                <Badge className="bg-status-info/15 text-status-info">
                  {workflow.agent.emoji || "Agent"} {workflow.agent.displayName}
                </Badge>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-400">
              {workflow.description || "This workflow is ready to automate a business process."}
            </p>
          </div>

          <WorkflowDetailActions
            workflowId={workflow.id}
            enabled={workflow.enabled}
            canRunNow={
              workflow.trigger === "manual" || session.role === "super_admin"
            }
          />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Runs"
          value={totalRuns}
          icon={<GitBranch className="h-5 w-5" />}
          iconColor="text-brand-cyan"
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={<CheckSquare className="h-5 w-5" />}
          iconColor="text-status-active"
        />
        <StatCard
          title="Last Run"
          value={formatWorkflowDate(workflow.lastRunAt)}
          icon={<PlayCircle className="h-5 w-5" />}
          iconColor="text-slate-400"
        />
        <StatCard
          title="Next Run"
          value={
            workflow.trigger === "manual"
              ? "On demand"
              : workflow.trigger === "webhook"
                ? "Via webhook"
                : nextRun
                  ? formatWorkflowDate(nextRun)
                  : "Not scheduled"
          }
          icon={<Clock className="h-5 w-5" />}
          iconColor="text-brand-amber"
        />
      </section>

      <WorkflowDetailTabs
        workflow={workflow}
        runs={runs}
        pendingApprovals={pendingApprovals}
        canRunNow={workflow.trigger === "manual" || session.role === "super_admin"}
        appUrl={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
        initialWebhookEndpoint={
          webhookEndpoint
            ? {
                id: webhookEndpoint.id,
                provider: webhookEndpoint.provider,
                enabled: webhookEndpoint.enabled,
                totalReceived: webhookEndpoint.totalReceived,
                lastReceivedAt: webhookEndpoint.lastReceivedAt,
                hasSecret: Boolean(webhookEndpoint.secret || webhookEndpoint.encryptedSecret)
              }
            : null
        }
        initialWebhookEvents={webhookEvents}
      />
    </div>
  );
}
