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

    const businessFilter =
      session.role === "admin"
        ? { id: { in: session.businessIds } }
        : {};

    const orgFilter = {
      business: {
        organizationId: session.organizationId,
        ...businessFilter
      }
    };

    // Get run stats grouped by status
    const [totalRuns, completedRuns, failedRuns, runsByAgent, runsByWorkflow, recentRuns] =
      await Promise.all([
        db.actionRun.count({ where: orgFilter }),
        db.actionRun.count({
          where: { ...orgFilter, status: "completed" }
        }),
        db.actionRun.count({
          where: { ...orgFilter, status: "failed" }
        }),
        db.actionRun.groupBy({
          by: ["agentId"],
          where: { ...orgFilter, agentId: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10
        }),
        db.actionRun.groupBy({
          by: ["workflowId"],
          where: { ...orgFilter, workflowId: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10
        }),
        db.actionRun.findMany({
          where: orgFilter,
          include: {
            agent: { select: { displayName: true, emoji: true } },
            workflow: { select: { name: true } },
            business: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 20
        })
      ]);

    // Resolve agent names for groupBy results
    const agentIds = runsByAgent
      .map((r) => r.agentId)
      .filter((id): id is string => id !== null);
    const agents = agentIds.length
      ? await db.agent.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, displayName: true, emoji: true }
        })
      : [];

    const workflowIds = runsByWorkflow
      .map((r) => r.workflowId)
      .filter((id): id is string => id !== null);
    const workflows = workflowIds.length
      ? await db.workflow.findMany({
          where: { id: { in: workflowIds } },
          select: { id: true, name: true }
        })
      : [];

    const successRate =
      totalRuns > 0
        ? Math.round((completedRuns / totalRuns) * 100)
        : 0;

    return addSecurityHeaders(
      NextResponse.json({
        overview: {
          totalRuns,
          completedRuns,
          failedRuns,
          pendingRuns: totalRuns - completedRuns - failedRuns,
          successRate
        },
        byAgent: runsByAgent.map((r) => {
          const agent = agents.find((a) => a.id === r.agentId);
          return {
            agentId: r.agentId,
            name: agent?.displayName ?? "Unknown",
            emoji: agent?.emoji ?? null,
            count: r._count.id
          };
        }),
        byWorkflow: runsByWorkflow.map((r) => {
          const workflow = workflows.find((w) => w.id === r.workflowId);
          return {
            workflowId: r.workflowId,
            name: workflow?.name ?? "Unknown",
            count: r._count.id
          };
        }),
        recentRuns: recentRuns.map((r) => ({
          id: r.id,
          action: r.action,
          status: r.status,
          error: r.error,
          agentName: r.agent?.displayName ?? null,
          agentEmoji: r.agent?.emoji ?? null,
          workflowName: r.workflow?.name ?? null,
          businessName: r.business?.name ?? null,
          createdAt: r.createdAt,
          completedAt: r.completedAt
        }))
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
