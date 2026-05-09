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
      throw unauthorized();
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
      throw notFound();
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
      // Read which addons the operator opted into at create time. The
      // Organic Ladder addon is the only one today; when enabled it
      // adds the off-platform PRODUCT_LADDER.md tracker. Core sellers
      // who skip the addon get only SHOP_HEALTH.md.
      const selectedAddons =
        business.config &&
        typeof business.config === "object" &&
        !Array.isArray(business.config) &&
        Array.isArray(
          (business.config as { selectedAddons?: unknown }).selectedAddons
        )
          ? ((business.config as { selectedAddons: unknown[] })
              .selectedAddons.filter(
                (id): id is string => typeof id === "string"
              ))
          : [];
      const organicLadderEnabled = selectedAddons.includes("organic_ladder");

      const [adCloneProjects, adCloneByStatus, shopHealthDoc, ladderDoc] =
        await Promise.all([
          db.adCloneProject.count({ where: { businessId: business.id } }),
          db.adCloneProject.groupBy({
            by: ["status"],
            where: { businessId: business.id },
            _count: true
          }),
          db.workspaceDocument.findFirst({
            where: { businessId: business.id, filePath: "SHOP_HEALTH.md" },
            select: { id: true, updatedAt: true }
          }),
          organicLadderEnabled
            ? db.workspaceDocument.findFirst({
                where: {
                  businessId: business.id,
                  filePath: "PRODUCT_LADDER.md"
                },
                select: { id: true, updatedAt: true }
              })
            : Promise.resolve(null)
        ]);
      templateData = {
        adCloneProjects,
        adCloneByStatus: Object.fromEntries(
          adCloneByStatus.map((r) => [r.status, r._count])
        ),
        shopHealthDocId: shopHealthDoc?.id ?? null,
        shopHealthUpdatedAt: shopHealthDoc?.updatedAt ?? null,
        organicLadderEnabled,
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
    } else if (templateId === "tiptax_affiliate_engine") {
      // TipTax Affiliate Engine dashboard. Two tiers of widgets —
      // integration health + live webhook activity (Tier 1, "is it
      // actually working") and per-channel reply trends + Sendpilot
      // cap + 30-day discovery sparkline (Tier 2, "how's it performing").
      // Pipeline-specific widgets that need Prospect/SubAffiliate tables
      // are served as empty-state until those schemas exist.

      const REQUIRED_MCPS = [
        "social_media_mcp",
        "firecrawl_mcp",
        "postgres_mcp",
        "instantly_mcp",
        "sendpilot_mcp"
      ];
      const SUGGESTED_MCPS = [
        "reddit_mcp",
        "playwright_mcp",
        "whatsapp_cloud_mcp",
        "manychat_mcp",
        "hubspot_mcp",
        "gohighlevel_mcp",
        "smartlead_mcp"
      ];
      const WEBHOOK_PROVIDERS = [
        "instantly",
        "whatsapp_cloud",
        "sendpilot",
        "manychat"
      ];

      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );

      // Integration health: which MCPs are installed for this business's org.
      const installedMcpServers = await db.mcpServer.findMany({
        where: {
          organizationId: session.organizationId ?? "",
          definitionId: { in: [...REQUIRED_MCPS, ...SUGGESTED_MCPS] },
          OR: [{ businessId: null }, { businessId: business.id }]
        },
        select: {
          id: true,
          definitionId: true,
          status: true,
          updatedAt: true
        }
      });
      const installedMap = new Map<string, { status: string; updatedAt: Date }>(
        installedMcpServers.map((m) => [
          m.definitionId,
          { status: m.status, updatedAt: m.updatedAt }
        ])
      );

      // Integration health grid: last inbound event per provider, for the
      // webhook providers specifically. Use Prisma JSON path filter since
      // provider is nested under ActivityEntry.metadata.
      const lastWebhookByProvider = new Map<string, Date | null>();
      await Promise.all(
        WEBHOOK_PROVIDERS.map(async (provider) => {
          const entry = await db.activityEntry.findFirst({
            where: {
              businessId: business.id,
              type: "integration",
              metadata: {
                path: ["provider"],
                equals: provider
              }
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
          });
          lastWebhookByProvider.set(provider, entry?.createdAt ?? null);
        })
      );

      const integrationHealth = [...REQUIRED_MCPS, ...SUGGESTED_MCPS].map(
        (defId) => {
          const installed = installedMap.get(defId);
          const webhookProviderMap: Record<string, string> = {
            instantly_mcp: "instantly",
            whatsapp_cloud_mcp: "whatsapp_cloud",
            sendpilot_mcp: "sendpilot",
            manychat_mcp: "manychat"
          };
          const wp = webhookProviderMap[defId];
          return {
            definitionId: defId,
            required: REQUIRED_MCPS.includes(defId),
            installed: !!installed,
            status: installed?.status ?? "not_installed",
            updatedAt: installed?.updatedAt ?? null,
            lastWebhookAt: wp ? lastWebhookByProvider.get(wp) ?? null : null
          };
        }
      );

      // Recent webhook events across all four providers (Tier 1 live stream).
      const webhookEvents = await db.activityEntry.findMany({
        where: {
          businessId: business.id,
          type: "integration",
          OR: WEBHOOK_PROVIDERS.map((provider) => ({
            metadata: { path: ["provider"], equals: provider }
          }))
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          detail: true,
          status: true,
          metadata: true,
          createdAt: true
        }
      });

      // Per-channel inbound counts, last 30 days (Tier 2 reply-rate proxy).
      const inboundByChannelRaw = await Promise.all(
        WEBHOOK_PROVIDERS.map(async (provider) => {
          const count = await db.activityEntry.count({
            where: {
              businessId: business.id,
              type: "integration",
              status: "info",
              createdAt: { gte: since },
              metadata: { path: ["provider"], equals: provider }
            }
          });
          return [provider, count] as const;
        })
      );
      const inboundByChannel = Object.fromEntries(inboundByChannelRaw);

      // Sendpilot month-to-date cap gauge (AppSumo Tier 2: 3,000 leads/mo).
      const sendpilotMonthEvents = await db.activityEntry.count({
        where: {
          businessId: business.id,
          type: "integration",
          createdAt: { gte: startOfMonth },
          metadata: { path: ["provider"], equals: "sendpilot" }
        }
      });

      // 30-day prospect-discovery sparkline from ActionRun for the
      // Daily Prospect Discovery workflow. Bucket by day.
      const discoveryRuns = await db.actionRun.findMany({
        where: {
          businessId: business.id,
          createdAt: { gte: since },
          workflow: { name: "Daily Prospect Discovery" }
        },
        select: { createdAt: true, status: true }
      });
      const discoveryByDay: Record<string, { total: number; completed: number }> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        discoveryByDay[key] = { total: 0, completed: 0 };
      }
      for (const run of discoveryRuns) {
        const key = run.createdAt.toISOString().slice(0, 10);
        const entry = discoveryByDay[key];
        if (!entry) continue;
        entry.total += 1;
        if (run.status === "completed") entry.completed += 1;
      }
      const discoverySeries = Object.entries(discoveryByDay)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, counts]) => ({ date, ...counts }));

      // Compliance pending: ApprovalRequest rows for this business still
      // awaiting operator action. Already counted in shared metrics
      // (pendingApprovals) — include the most-recent few titles so the
      // widget can show what's queued.
      const recentComplianceFlags = await db.approvalRequest.findMany({
        where: { businessId: business.id, status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          actionType: true,
          reason: true,
          agent: { select: { displayName: true, emoji: true } },
          createdAt: true
        }
      });

      // Funnel drop-off summary — counts per stage + adjacent conversion
      // rates over the last 30 days. Drives the Funnel Drop-Off widget.
      // computeFunnelSummary returns null/empty arrays gracefully when
      // there are no prospects yet; widget renders empty-state.
      const { computeFunnelSummary } = await import(
        "@/lib/repository/prospects"
      );
      const funnelSummary = await computeFunnelSummary(business.id, 30);

      templateData = {
        integrationHealth,
        webhookEvents: webhookEvents.map((e) => {
          const md = (e.metadata ?? {}) as Record<string, unknown>;
          return {
            id: e.id,
            title: e.title,
            detail: e.detail,
            status: e.status,
            provider: typeof md.provider === "string" ? md.provider : null,
            createdAt: e.createdAt
          };
        }),
        inboundByChannel,
        sendpilotCap: {
          leadsMonthCap: 3000,
          eventsThisMonth: sendpilotMonthEvents,
          pctUsed: Math.min(
            100,
            Math.round((sendpilotMonthEvents / 3000) * 100)
          )
        },
        discoverySeries,
        recentComplianceFlags,
        funnelSummary
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
