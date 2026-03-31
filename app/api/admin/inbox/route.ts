import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const tab = request.nextUrl.searchParams.get("tab") ?? "all";

    const businessScope =
      session.role === "admin"
        ? { businessId: { in: session.businessIds } }
        : {};

    const businessOrgScope = {
      business: {
        organizationId: session.organizationId,
        ...(session.role === "admin"
          ? { id: { in: session.businessIds } }
          : {})
      }
    };

    const [pendingApprovals, failedRuns, recentActivity, agentErrors] =
      await Promise.all([
        db.approvalRequest.findMany({
          where: {
            ...businessOrgScope,
            status: "pending"
          },
          include: {
            business: { select: { name: true } },
            agent: { select: { displayName: true } },
            workflow: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 20
        }),
        db.actionRun.findMany({
          where: {
            ...businessOrgScope,
            status: "failed"
          },
          include: {
            agent: { select: { displayName: true } },
            workflow: { select: { name: true } },
            business: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 20
        }),
        db.activityEntry.findMany({
          where: {
            business: {
              organizationId: session.organizationId,
              ...(session.role === "admin"
                ? { id: { in: session.businessIds } }
                : {})
            }
          },
          orderBy: { createdAt: "desc" },
          take: 30
        }),
        db.agent.count({
          where: {
            organizationId: session.organizationId,
            status: "warning",
            ...businessScope
          }
        })
      ]);

    const items = [];

    for (const approval of pendingApprovals) {
      items.push({
        id: `approval-${approval.id}`,
        type: "approval" as const,
        title: `Approval needed: ${approval.actionType}`,
        detail: [
          approval.workflow?.name,
          approval.agent?.displayName,
          approval.business?.name
        ]
          .filter(Boolean)
          .join(" / "),
        status: approval.status,
        createdAt: approval.createdAt,
        href: "/admin/approvals"
      });
    }

    for (const run of failedRuns) {
      items.push({
        id: `run-${run.id}`,
        type: "failed_run" as const,
        title: `Run failed: ${run.workflow?.name ?? run.agent?.displayName ?? "Unknown"}`,
        detail: run.error ?? "No error details available.",
        status: "failed",
        createdAt: run.completedAt ?? run.createdAt,
        href: run.workflowId
          ? `/admin/workflows/${run.workflowId}`
          : run.agentId
            ? `/admin/agents/${run.agentId}`
            : "/admin/activity"
      });
    }

    if (agentErrors > 0) {
      items.push({
        id: "agent-errors",
        type: "alert" as const,
        title: `${agentErrors} agent${agentErrors === 1 ? "" : "s"} with warnings`,
        detail: "Review agent status and resolve issues.",
        status: "warning",
        createdAt: new Date(),
        href: "/admin/agents"
      });
    }

    for (const entry of recentActivity) {
      items.push({
        id: `activity-${entry.id}`,
        type: "activity" as const,
        title: entry.title,
        detail: entry.detail,
        status: entry.type,
        createdAt: entry.createdAt,
        href: "/admin/activity"
      });
    }

    let filtered = items;
    if (tab === "approvals") {
      filtered = items.filter((i) => i.type === "approval");
    } else if (tab === "alerts") {
      filtered = items.filter(
        (i) => i.type === "failed_run" || i.type === "alert"
      );
    }

    filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return addSecurityHeaders(
      NextResponse.json({
        items: filtered,
        counts: {
          all: items.length,
          approvals: pendingApprovals.length,
          alerts: failedRuns.length + (agentErrors > 0 ? 1 : 0)
        }
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
