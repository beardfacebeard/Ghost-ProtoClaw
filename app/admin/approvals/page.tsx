import { PageHeader } from "@/components/admin/ui";
import { ApprovalsPageClient } from "@/components/admin/approvals/ApprovalsPageClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import {
  countApprovalRequests,
  getPendingCount,
  listApprovalRequests
} from "@/lib/repository/approvals";

export const dynamic = "force-dynamic";

type ApprovalsPageProps = {
  searchParams?: {
    status?: string;
    businessId?: string;
    workflowId?: string;
    agentId?: string;
    startDate?: string;
    endDate?: string;
  };
};

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function ApprovalsPage({
  searchParams
}: ApprovalsPageProps) {
  const session = await requireServerSession();
  if (!session.organizationId) return null;

  const status = searchParams?.status ?? "pending";
  const businessId = searchParams?.businessId;
  const workflowId = searchParams?.workflowId;
  const agentId = searchParams?.agentId;
  const startDate = parseDate(searchParams?.startDate);
  const endDate = parseDate(searchParams?.endDate);
  const businessIds =
    session.role === "admin" ? session.businessIds : undefined;

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: { in: session.businessIds }
        }
      : { organizationId: session.organizationId };

  const [businesses, workflows, agents, approvals, total, pendingCount] =
    await Promise.all([
      db.business.findMany({
        where: businessWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      db.workflow.findMany({
        where: { business: businessWhere },
        select: { id: true, name: true, businessId: true },
        orderBy: { name: "asc" }
      }),
      db.agent.findMany({
        where:
          session.role === "admin"
            ? { businessId: { in: session.businessIds } }
            : {
                OR: [
                  { business: { organizationId: session.organizationId } },
                  { organizationId: session.organizationId }
                ]
              },
        select: {
          id: true,
          displayName: true,
          emoji: true,
          businessId: true
        },
        orderBy: { displayName: "asc" }
      }),
      listApprovalRequests({
        organizationId: session.organizationId,
        status,
        businessId,
        workflowId,
        agentId,
        startDate,
        endDate,
        limit: 100,
        businessIds
      }),
      countApprovalRequests({
        organizationId: session.organizationId,
        status,
        businessId,
        workflowId,
        agentId,
        startDate,
        endDate,
        businessIds
      }),
      getPendingCount(session.organizationId, businessIds)
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Work · Approvals"
        title="Decisions waiting on you."
        description="Every agent-requested action that needs a human sign-off before it fires. Clear these and your agents keep moving."
        actions={
          pendingCount > 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-state-warning/30 bg-state-warning/10 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-state-warning animate-pulse-steel" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-state-warning">
                {pendingCount} pending
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-state-success/25 bg-state-success/10 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-state-success" />
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-state-success">
                all clear
              </span>
            </div>
          )
        }
      />

      <ApprovalsPageClient
        approvals={approvals}
        total={total}
        pendingCount={pendingCount}
        isSuperAdmin={session.role === "super_admin"}
        filters={{
          status,
          businessId: businessId ?? "all",
          workflowId: workflowId ?? "all",
          agentId: agentId ?? "all",
          startDate: searchParams?.startDate ?? "",
          endDate: searchParams?.endDate ?? ""
        }}
        businesses={businesses}
        workflows={workflows}
        agents={agents}
      />
    </div>
  );
}
