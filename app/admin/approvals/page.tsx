import { SectionHeader } from "@/components/admin/SectionHeader";
import { ApprovalsPageClient } from "@/components/admin/approvals/ApprovalsPageClient";
import { Badge } from "@/components/ui/badge";
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
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function ApprovalsPage({
  searchParams
}: ApprovalsPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const status = searchParams?.status ?? "pending";
  const businessId = searchParams?.businessId;
  const workflowId = searchParams?.workflowId;
  const agentId = searchParams?.agentId;
  const startDate = parseDate(searchParams?.startDate);
  const endDate = parseDate(searchParams?.endDate);
  const businessIds = session.role === "admin" ? session.businessIds : undefined;

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

  const [businesses, workflows, agents, approvals, total, pendingCount] =
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
      db.workflow.findMany({
        where: {
          business: businessWhere
        },
        select: {
          id: true,
          name: true,
          businessId: true
        },
        orderBy: {
          name: "asc"
        }
      }),
      db.agent.findMany({
        where:
          session.role === "admin"
            ? {
                businessId: {
                  in: session.businessIds
                }
              }
            : {
                OR: [
                  {
                    business: {
                      organizationId: session.organizationId
                    }
                  },
                  {
                    organizationId: session.organizationId
                  }
                ]
              },
        select: {
          id: true,
          displayName: true,
          emoji: true,
          businessId: true
        },
        orderBy: {
          displayName: "asc"
        }
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
      <SectionHeader
        title="Approvals"
        description="Review and action requests that require your approval before proceeding"
        action={
          pendingCount > 0 ? (
            <Badge className="bg-state-warning px-3 py-1 text-sm text-bg-app">
              {pendingCount} pending
            </Badge>
          ) : undefined
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
