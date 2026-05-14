import Link from "next/link";
import { ArrowLeft, BookOpen, Bot, CheckSquare, GitBranch } from "lucide-react";
import { notFound } from "next/navigation";

import { BusinessDetailTabs } from "@/components/admin/businesses/BusinessDetailTabs";
import { BusinessHeaderActions } from "@/components/admin/businesses/BusinessHeaderActions";
import { getBusinessStatusMeta } from "@/components/admin/businesses/utils";
import { PageHeader, StatBlock, StatusDot } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/auth/server-session";
import { getBusinessStats } from "@/lib/repository/businesses";
import { listKnowledgeItems } from "@/lib/repository/knowledge";
import { listWorkspaceDocuments } from "@/lib/repository/workspace";

export const dynamic = "force-dynamic";

type BusinessDetailPageProps = {
  params: {
    id: string;
  };
};

function getBusinessStatusTone(status: string): "success" | "warning" | "muted" {
  switch (status) {
    case "active":
      return "success";
    case "planning":
      return "warning";
    case "paused":
    case "archived":
    default:
      return "muted";
  }
}

export default async function BusinessDetailPage({
  params
}: BusinessDetailPageProps) {
  const session = await requireServerSession();

  if (
    session.role === "admin" &&
    !session.businessIds.includes(params.id)
  ) {
    notFound();
  }

  if (!session.organizationId) {
    notFound();
  }

  const [business, stats, agents, workflows, knowledgeItems, workspaceDocuments] =
    await Promise.all([
      db.business.findFirst({
        where: {
          id: params.id,
          organizationId: session.organizationId
        }
      }),
      getBusinessStats(params.id),
      db.agent.findMany({
        where: {
          businessId: params.id
        },
        select: {
          id: true,
          displayName: true,
          emoji: true,
          role: true,
          status: true,
          type: true
        },
        orderBy: [{ defaultAgent: "desc" }, { createdAt: "asc" }]
      }),
      db.workflow.findMany({
        where: {
          businessId: params.id
        },
        select: {
          id: true,
          name: true,
          trigger: true,
          output: true,
          enabled: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }),
      listKnowledgeItems({
        businessId: params.id,
        organizationId: session.organizationId
      }),
      listWorkspaceDocuments({
        businessId: params.id,
        organizationId: session.organizationId
      })
    ]);

  if (!business) {
    notFound();
  }

  const status = getBusinessStatusMeta(business.status);
  const statusTone = getBusinessStatusTone(business.status);
  const workflowsAttention =
    stats.workflowCount > 0 && stats.activeWorkflows < stats.workflowCount;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/businesses"
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted transition-colors hover:text-steel-bright"
      >
        <ArrowLeft className="h-3 w-3" />
        All businesses
      </Link>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <PageHeader
            eyebrow="Work · Businesses"
            title={business.name}
            description={
              business.summary ||
              "This business is ready for setup. Add the brand voice, goals, and AI configuration to bring it online."
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-secondary">
              <StatusDot tone={statusTone} />
              {status.label}
            </span>
            {business.slug ? (
              <span className="inline-flex items-center rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 font-mono text-[10.5px] tracking-wide text-ink-muted">
                {business.slug}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex-shrink-0">
          <BusinessHeaderActions
            businessId={business.id}
            businessName={business.name}
            businessStatus={business.status}
            businessGlobalPaused={business.globalPaused ?? false}
          />
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock
          label="Agents"
          value={String(stats.agentCount)}
          icon={<Bot className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Workflows"
          value={`${stats.activeWorkflows}/${stats.workflowCount}`}
          icon={<GitBranch className="h-4 w-4" />}
          mono
          tone={workflowsAttention ? "warning" : "default"}
          subtext={
            stats.workflowCount > 0
              ? `${stats.activeWorkflows} enabled`
              : undefined
          }
        />
        <StatBlock
          label="Knowledge items"
          value={String(stats.knowledgeItems)}
          icon={<BookOpen className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Pending approvals"
          value={String(stats.pendingApprovals)}
          icon={<CheckSquare className="h-4 w-4" />}
          mono
          tone={stats.pendingApprovals > 0 ? "warning" : "default"}
          href={
            stats.pendingApprovals > 0
              ? `/admin/approvals?businessId=${business.id}`
              : undefined
          }
        />
      </section>

      <BusinessDetailTabs
        business={business}
        stats={stats}
        agents={agents}
        workflows={workflows}
        knowledgeItems={knowledgeItems}
        workspaceDocuments={workspaceDocuments}
      />
    </div>
  );
}
