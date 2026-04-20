import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  unauthorized
} from "@/lib/errors";
import { executeTool } from "@/lib/mcp/tool-executor";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  todoIds: z.array(z.string().trim().min(1)).min(1).max(50)
});

/**
 * Batch-activate a set of todos. Same flow as the single activate
 * endpoint, applied N times. Reports per-todo success/failure so the
 * UI can show what landed and what didn't.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = bodySchema.parse(await request.json());
    const todos = await db.todo.findMany({
      where: {
        id: { in: body.todoIds },
        organizationId: session.organizationId
      }
    });
    if (todos.length === 0) throw badRequest("No matching todos found.");

    const businessIds = new Set(todos.map((t) => t.businessId));
    if (session.role === "admin") {
      for (const bid of businessIds) requireBusinessAccess(session, bid);
    }

    // Cache main agent lookups per-business so we don't query N times.
    const mainByBusiness = new Map<string, string | null>();

    type Outcome = {
      todoId: string;
      status: "activated" | "skipped" | "failed";
      message?: string;
      delegatedConversationId?: string | null;
    };
    const outcomes: Outcome[] = [];

    for (const todo of todos) {
      if (todo.type !== "todo") {
        outcomes.push({
          todoId: todo.id,
          status: "skipped",
          message: "Ideas must be promoted first."
        });
        continue;
      }
      if (todo.status === "active" || todo.status === "done") {
        outcomes.push({
          todoId: todo.id,
          status: "skipped",
          message: `Already ${todo.status}.`
        });
        continue;
      }

      let delegateToAgentId = todo.agentId;
      if (!delegateToAgentId) {
        let cached = mainByBusiness.get(todo.businessId);
        if (cached === undefined) {
          const main = await db.agent.findFirst({
            where: { businessId: todo.businessId, type: "main" },
            select: { id: true }
          });
          cached = main?.id ?? null;
          mainByBusiness.set(todo.businessId, cached);
        }
        delegateToAgentId = cached;
      }
      if (!delegateToAgentId) {
        outcomes.push({
          todoId: todo.id,
          status: "failed",
          message: "No agent available."
        });
        continue;
      }

      const targetAgent = await db.agent.findUnique({
        where: { id: delegateToAgentId },
        select: { id: true, displayName: true }
      });
      if (!targetAgent) {
        outcomes.push({
          todoId: todo.id,
          status: "failed",
          message: "Agent not found."
        });
        continue;
      }

      const task = [
        todo.title,
        todo.description ? `\n\n${todo.description}` : "",
        todo.dueAt ? `\n\nDue: ${todo.dueAt.toISOString()}` : ""
      ]
        .filter(Boolean)
        .join("");

      const delegation = await executeTool({
        toolName: "delegate_task",
        arguments: {
          agent_id: targetAgent.id,
          agent_name: targetAgent.displayName,
          task,
          priority: todo.priority === "urgent" ? "high" : todo.priority,
          context: `Bulk-activated from todo id=${todo.id}.`
        },
        mcpServerId: "__builtin__",
        organizationId: session.organizationId,
        agentId: targetAgent.id,
        businessId: todo.businessId
      });

      if (!delegation.success) {
        outcomes.push({
          todoId: todo.id,
          status: "failed",
          message: delegation.error ?? "Delegation failed."
        });
        continue;
      }

      const match = delegation.output.match(/Conversation ID:\s*([\w-]+)/);
      const delegatedConversationId = match?.[1] ?? null;
      await db.todo.update({
        where: { id: todo.id },
        data: {
          status: "active",
          agentId: targetAgent.id,
          activatedAt: new Date(),
          delegatedConversationId
        }
      });
      outcomes.push({
        todoId: todo.id,
        status: "activated",
        delegatedConversationId
      });
    }

    return addSecurityHeaders(
      NextResponse.json({
        activated: outcomes.filter((o) => o.status === "activated").length,
        skipped: outcomes.filter((o) => o.status === "skipped").length,
        failed: outcomes.filter((o) => o.status === "failed").length,
        outcomes
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
