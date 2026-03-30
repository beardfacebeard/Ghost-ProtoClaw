import Link from "next/link";
import { ArrowLeft, BookOpen, Bot, CheckSquare, GitBranch } from "lucide-react";
import { notFound } from "next/navigation";

import { BusinessDetailTabs } from "@/components/admin/businesses/BusinessDetailTabs";
import { BusinessHeaderActions } from "@/components/admin/businesses/BusinessHeaderActions";
import { getBusinessStatusMeta } from "@/components/admin/businesses/utils";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/StatCard";
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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/admin/businesses"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Businesses
        </Link>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{business.name}</h1>
              <Badge className={status.className}>{status.label}</Badge>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-400">
              {business.summary ||
                "This business is ready for setup. Add the brand voice, goals, and AI configuration to bring it online."}
            </p>
          </div>

          <BusinessHeaderActions businessId={business.id} />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Agents"
          value={stats.agentCount}
          icon={<Bot className="h-5 w-5" />}
          iconColor="text-status-info"
        />
        <StatCard
          title="Workflows"
          value={`${stats.activeWorkflows}/${stats.workflowCount}`}
          icon={<GitBranch className="h-5 w-5" />}
          iconColor="text-brand-cyan"
        />
        <StatCard
          title="Knowledge Items"
          value={stats.knowledgeItems}
          icon={<BookOpen className="h-5 w-5" />}
          iconColor="text-brand-amber"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<CheckSquare className="h-5 w-5" />}
          iconColor={stats.pendingApprovals > 0 ? "text-brand-amber" : "text-slate-400"}
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
