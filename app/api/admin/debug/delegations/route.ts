import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint for the delegation queue.
 *
 * GET: Returns every delegation ConversationLog in this org along with its
 *   executorState, age, target agent, and delegator. Lets you see
 *   immediately whether the executor is running things ("done") or whether
 *   delegations are piling up as "pending" — the symptom of the scheduler
 *   not firing at all.
 *
 * POST: Manually trigger one pass of the delegation executor right now,
 *   bypassing the 30s tick. Returns how many delegations were executed.
 *   Useful for confirming the executor CODE works independent of whether
 *   the scheduler is actually ticking on this host.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const rows = await db.conversationLog.findMany({
      where: {
        channel: "delegation",
        business: { organizationId: session.organizationId }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        agent: {
          select: { id: true, displayName: true, status: true, type: true }
        },
        business: { select: { id: true, name: true } }
      }
    });

    const now = Date.now();
    const delegations = rows.map((row) => {
      const meta =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      return {
        id: row.id,
        title: row.title,
        status: row.status,
        executorState: meta.executorState ?? null,
        claimedAt: meta.claimedAt ?? null,
        finishedAt: meta.finishedAt ?? null,
        executorNote: meta.executorNote ?? null,
        executorError: meta.executorError ?? null,
        createdAt: row.createdAt.toISOString(),
        ageSeconds: Math.floor((now - row.createdAt.getTime()) / 1000),
        messageCount: row.messageCount,
        targetAgent: row.agent
          ? {
              id: row.agent.id,
              displayName: row.agent.displayName,
              status: row.agent.status,
              type: row.agent.type
            }
          : null,
        business: row.business,
        delegatedBy: meta.delegatedBy ?? null,
        delegatedByAgentId: meta.delegatedByAgentId ?? null,
        originalTask:
          typeof meta.originalTask === "string"
            ? meta.originalTask.slice(0, 200)
            : null,
        priority: meta.priority ?? null
      };
    });

    const summary = {
      total: delegations.length,
      pending: delegations.filter((d) => d.executorState === "pending" || d.executorState === null).length,
      running: delegations.filter((d) => d.executorState === "running").length,
      done: delegations.filter((d) => d.executorState === "done").length,
      failed: delegations.filter((d) => d.executorState === "failed").length
    };

    return addSecurityHeaders(
      NextResponse.json({
        summary,
        delegations,
        scheduler: {
          nodeEnv: process.env.NODE_ENV ?? null,
          nextRuntime: process.env.NEXT_RUNTIME ?? null
        }
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const { runPendingDelegations } = await import(
      "@/lib/workflows/delegation-executor"
    );
    const executed = await runPendingDelegations();

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        executed,
        message: `Delegation executor ran synchronously. ${executed} delegation(s) picked up and processed.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
