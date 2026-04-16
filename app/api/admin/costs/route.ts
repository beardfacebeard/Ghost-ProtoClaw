import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

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

    const monthStart = startOfMonth();

    // Run all queries in parallel
    const [
      totalRuns,
      completedRuns,
      failedRuns,
      runsByAgent,
      runsByWorkflow,
      recentRuns,
      // Token usage queries
      monthlySpend,
      costByModel,
      costByAgent,
      totalTokens,
      budgetConfig
    ] = await Promise.all([
      // --- ActionRun queries (existing) ---
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
      }),

      // --- TokenUsageLog queries (new) ---
      // Monthly spend aggregate
      db.tokenUsageLog.aggregate({
        where: {
          organizationId: session.organizationId,
          createdAt: { gte: monthStart }
        },
        _sum: {
          estimatedCostUsd: true,
          promptTokens: true,
          completionTokens: true,
          totalTokens: true
        },
        _count: { id: true }
      }),
      // Cost by model (this month)
      db.tokenUsageLog.groupBy({
        by: ["model"],
        where: {
          organizationId: session.organizationId,
          createdAt: { gte: monthStart }
        },
        _sum: {
          estimatedCostUsd: true,
          totalTokens: true
        },
        _count: { id: true },
        orderBy: { _sum: { estimatedCostUsd: "desc" } },
        take: 10
      }),
      // Cost by agent (this month)
      db.tokenUsageLog.groupBy({
        by: ["agentId"],
        where: {
          organizationId: session.organizationId,
          agentId: { not: null },
          createdAt: { gte: monthStart }
        },
        _sum: {
          estimatedCostUsd: true,
          totalTokens: true
        },
        _count: { id: true },
        orderBy: { _sum: { estimatedCostUsd: "desc" } },
        take: 10
      }),
      // All-time totals
      db.tokenUsageLog.aggregate({
        where: {
          organizationId: session.organizationId
        },
        _sum: {
          estimatedCostUsd: true,
          totalTokens: true
        },
        _count: { id: true }
      }),
      // Budget config
      db.budgetConfig.findFirst({
        where: {
          organizationId: session.organizationId,
          businessId: null,
          enabled: true
        }
      })
    ]);

    // Resolve agent names for groupBy results
    const agentIds = runsByAgent
      .map((r) => r.agentId)
      .filter((id): id is string => id !== null);

    const costAgentIds = costByAgent
      .map((r) => r.agentId)
      .filter((id): id is string => id !== null);

    const allAgentIds = [...new Set([...agentIds, ...costAgentIds])];

    const agents = allAgentIds.length
      ? await db.agent.findMany({
          where: { id: { in: allAgentIds } },
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
        // New: token usage & cost data
        tokenUsage: {
          monthlySpendUsd: monthlySpend._sum.estimatedCostUsd ?? 0,
          monthlyPromptTokens: monthlySpend._sum.promptTokens ?? 0,
          monthlyCompletionTokens: monthlySpend._sum.completionTokens ?? 0,
          monthlyTotalTokens: monthlySpend._sum.totalTokens ?? 0,
          monthlyCallCount: monthlySpend._count.id ?? 0,
          allTimeSpendUsd: totalTokens._sum.estimatedCostUsd ?? 0,
          allTimeTotalTokens: totalTokens._sum.totalTokens ?? 0,
          allTimeCallCount: totalTokens._count.id ?? 0,
          budget: budgetConfig
            ? {
                monthlyLimitUsd: budgetConfig.monthlyLimitUsd,
                alertThresholdPct: budgetConfig.alertThresholdPct,
                hardStop: budgetConfig.hardStop
              }
            : null
        },
        costByModel: costByModel.map((r) => ({
          model: r.model,
          costUsd: r._sum.estimatedCostUsd ?? 0,
          totalTokens: r._sum.totalTokens ?? 0,
          callCount: r._count.id
        })),
        costByAgent: costByAgent.map((r) => {
          const agent = agents.find((a) => a.id === r.agentId);
          return {
            agentId: r.agentId,
            name: agent?.displayName ?? "Unknown",
            emoji: agent?.emoji ?? null,
            costUsd: r._sum.estimatedCostUsd ?? 0,
            totalTokens: r._sum.totalTokens ?? 0,
            callCount: r._count.id
          };
        }),
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
