import Link from "next/link";
import { ArrowLeft, CheckSquare, Clock, GitBranch, PlayCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { WorkflowDetailActions } from "@/components/admin/workflows/WorkflowDetailActions";
import { WorkflowDetailTabs } from "@/components/admin/workflows/WorkflowDetailTabs";
import { TriggerBadge } from "@/components/admin/workflows/TriggerBadge";
import { PageHeader, StatBlock, StatusDot } from "@/components/admin/ui";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { getWorkflowById } from "@/lib/repository/workflows";
import { getNextRunTime } from "@/lib/workflows/schedule-parser";
import { LocalTime } from "@/components/admin/workflows/LocalTime";

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

  const eyebrowSegments = [
    "Automate",
    "Workflows",
    workflow.business?.name ?? "Global"
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/workflows"
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted transition-colors hover:text-steel-bright"
      >
        <ArrowLeft className="h-3 w-3" />
        All workflows
      </Link>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <PageHeader
            eyebrow={eyebrowSegments.join(" · ")}
            title={workflow.name}
            description={
              workflow.description ||
              "This workflow is ready to automate a business process."
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <TriggerBadge trigger={workflow.trigger} />
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-secondary">
              <StatusDot tone={workflow.enabled ? "success" : "muted"} />
              {workflow.enabled ? "Enabled" : "Disabled"}
            </span>
            {workflow.business ? (
              <Link
                href={`/admin/businesses/${workflow.business.id}`}
                className="inline-flex items-center rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-secondary transition-colors hover:border-line hover:text-steel-bright"
              >
                {workflow.business.name}
              </Link>
            ) : null}
            {workflow.agent ? (
              <Link
                href={`/admin/agents/${workflow.agent.id}`}
                className="inline-flex items-center gap-1 rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-secondary transition-colors hover:border-line hover:text-steel-bright"
              >
                {workflow.agent.emoji ? (
                  <span aria-hidden>{workflow.agent.emoji}</span>
                ) : null}
                {workflow.agent.displayName}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex-shrink-0">
          <WorkflowDetailActions
            workflowId={workflow.id}
            enabled={workflow.enabled}
            canRunNow={
              workflow.trigger === "manual" || session.role === "super_admin"
            }
          />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock
          label="Total runs"
          value={String(totalRuns)}
          icon={<GitBranch className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Success rate"
          value={`${successRate}%`}
          icon={<CheckSquare className="h-4 w-4" />}
          mono
          tone={
            totalRuns === 0
              ? "default"
              : successRate >= 90
                ? "success"
                : successRate >= 60
                  ? "warning"
                  : "danger"
          }
          subtext={
            totalRuns > 0 ? `${completedRuns} of ${totalRuns} completed` : undefined
          }
        />
        <StatBlock
          label="Last run"
          value={
            workflow.lastRunAt ? (
              <LocalTime value={workflow.lastRunAt} />
            ) : (
              "Never"
            )
          }
          icon={<PlayCircle className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Next run"
          value={
            workflow.trigger === "manual"
              ? "On demand"
              : workflow.trigger === "webhook"
                ? "Via webhook"
                : nextRun
                  ? <LocalTime value={nextRun} />
                  : "Not scheduled"
          }
          icon={<Clock className="h-4 w-4" />}
          mono
          tone={
            workflow.trigger === "manual" || workflow.trigger === "webhook"
              ? "default"
              : nextRun
                ? "warning"
                : "default"
          }
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
