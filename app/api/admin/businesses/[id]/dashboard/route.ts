import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * Per-business, template-aware dashboard aggregator.
 *
 * Returns a compact JSON payload the TemplateDashboardPanel client component
 * hydrates from — metric counts, recent-activity windows, and the template-
 * specific widgets each specialty template needs. Shape of the payload is
 * always the same; template-specific fields appear under `templateData`.
 *
 * Kept in one route so the panel hits a single endpoint; the existing
 * Dealhawk dashboard has its own pipeline route and is not touched here.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session) {
      return unauthorized();
    }
    requireBusinessAccess(session, params.id);

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId ?? undefined },
      select: {
        id: true,
        name: true,
        status: true,
        config: true,
        createdAt: true,
        updatedAt: true,
        tradingMode: true,
        jurisdiction: true,
        dealMode: true
      }
    });

    if (!business) {
      return notFound();
    }

    const templateId =
      business.config &&
      typeof business.config === "object" &&
      !Array.isArray(business.config) &&
      typeof (business.config as { templateId?: unknown }).templateId === "string"
        ? ((business.config as { templateId: string }).templateId)
        : null;

    // Thirty-day horizon for "recent" aggregations.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      agentCount,
      workflowCount,
      activeWorkflowCount,
      knowledgeCount,
      workspaceDocCount,
      pendingApprovals,
      actionRuns30d,
      recentActivity,
      recentActionRuns,
      todosOpen,
      learningEntries
    ] = await Promise.all([
      db.agent.count({ where: { businessId: business.id } }),
      db.workflow.count({ where: { businessId: business.id } }),
      db.workflow.count({ where: { businessId: business.id, enabled: true } }),
      db.knowledgeItem.count({ where: { businessId: business.id } }),
      db.workspaceDocument.count({ where: { businessId: business.id } }),
      db.approvalRequest.count({
        where: { businessId: business.id, status: "pending" }
      }),
      db.actionRun.findMany({
        where: { businessId: business.id, createdAt: { gte: since } },
        select: { status: true, createdAt: true, action: true }
      }),
      db.activityEntry.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          type: true,
          title: true,
          detail: true,
          status: true,
          createdAt: true
        }
      }),
      db.actionRun.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          status: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          agent: { select: { displayName: true, emoji: true } },
          workflow: { select: { name: true } }
        }
      }),
      db.todo.count({
        where: {
          businessId: business.id,
          status: { in: ["captured", "active", "snoozed"] }
        }
      }),
      db.agentMemory.count({
        where: {
          businessId: business.id,
          type: "task_outcome"
        }
      })
    ]);

    const runCounts = {
      total: actionRuns30d.length,
      completed: actionRuns30d.filter((r) => r.status === "completed").length,
      failed: actionRuns30d.filter((r) => r.status === "failed").length,
      pending: actionRuns30d.filter((r) => r.status === "pending").length,
      last7: actionRuns30d.filter((r) => r.createdAt >= sevenDaysAgo).length
    };

    // Template-specific data blocks. Each specialty template gets the
    // widgets its agents actually produce against.
    let templateData: Record<string, unknown> = {};

    if (templateId === "tiktok_shop") {
      const [adCloneProjects, adCloneByStatus] = await Promise.all([
        db.adCloneProject.count({ where: { businessId: business.id } }),
        db.adCloneProject.groupBy({
          by: ["status"],
          where: { businessId: business.id },
          _count: true
        })
      ]);
      const ladderDoc = await db.workspaceDocument.findFirst({
        where: { businessId: business.id, filePath: "PRODUCT_LADDER.md" },
        select: { id: true, updatedAt: true }
      });
      templateData = {
        adCloneProjects,
        adCloneByStatus: Object.fromEntries(
          adCloneByStatus.map((r) => [r.status, r._count])
        ),
        productLadderDocId: ladderDoc?.id ?? null,
        productLadderUpdatedAt: ladderDoc?.updatedAt ?? null
      };
    } else if (templateId === "faceless_youtube") {
      const quotaRows = await db.youTubeQuotaUsage.findMany({
        where: { organizationId: session.organizationId ?? "" },
        orderBy: { date: "desc" },
        take: 14
      });
      const identityBible = await db.workspaceDocument.findFirst({
        where: {
          businessId: business.id,
          filePath: "CHANNEL_IDENTITY_BIBLE.md"
        },
        select: { id: true, updatedAt: true }
      });
      templateData = {
        ytQuotaSeries: quotaRows.map((row) => ({
          date: row.date,
          unitsUsed: row.unitsUsed
        })),
        channelIdentityBibleDocId: identityBible?.id ?? null,
        channelIdentityUpdatedAt: identityBible?.updatedAt ?? null
      };
    } else if (templateId === "forex_trading_desk") {
      const propFirm = await db.propFirmProfile.findFirst({
        where: { businessId: business.id, isActive: true },
        select: {
          id: true,
          firmKey: true,
          planName: true,
          status: true,
          startingBalance: true,
          highWaterMark: true,
          rules: true,
          updatedAt: true
        }
      });
      templateData = {
        propFirm,
        tradingMode: business.tradingMode ?? "research",
        jurisdiction: business.jurisdiction ?? null
      };
    } else if (templateId === "ghost_operator") {
      const coreDocs = await db.workspaceDocument.findMany({
        where: {
          businessId: business.id,
          filePath: {
            in: [
              "BUSINESS_PLAN.md",
              "LEARNING_LOG.md",
              "BUILD_LOG.md",
              "REVENUE_LOG.md"
            ]
          }
        },
        select: {
          id: true,
          filePath: true,
          updatedAt: true,
          syncStatus: true
        }
      });
      templateData = {
        coreDocs,
        dealMode: null
      };
    } else if (templateId === "dealhawk_empire") {
      const [activeDeals, goldDeals] = await Promise.all([
        db.deal.count({
          where: {
            businessId: business.id,
            status: { notIn: ["dead", "closed"] }
          }
        }),
        db.deal.count({
          where: { businessId: business.id, motivationScore: { gte: 80 } }
        })
      ]);
      templateData = {
        activeDeals,
        goldDeals,
        dealMode: business.dealMode ?? "research"
      };
    }

    const response = NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        status: business.status,
        templateId,
        createdAt: business.createdAt
      },
      metrics: {
        agents: agentCount,
        workflows: workflowCount,
        activeWorkflows: activeWorkflowCount,
        knowledgeItems: knowledgeCount,
        workspaceDocs: workspaceDocCount,
        pendingApprovals,
        openTodos: todosOpen,
        learningEntries
      },
      runs: runCounts,
      recentActivity,
      recentActionRuns,
      templateData
    });

    return addSecurityHeaders(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
