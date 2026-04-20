import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";
import { executeTool } from "@/lib/mcp/tool-executor";
import { getTodoById } from "@/lib/repository/todos";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

/**
 * Activate a captured todo. Creates a delegation to the assigned
 * agent (or the business's main agent if unassigned) via the same
 * delegate_task flow everything else uses. Result auto-posts back to
 * the conversation that the delegating agent lives in — no manual
 * follow-up needed.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const todo = await getTodoById(params.id, session.organizationId);
    if (!todo) throw notFound("Todo not found.");
    if (session.role === "admin") {
      requireBusinessAccess(session, todo.businessId);
    }
    if (todo.type !== "todo") {
      throw badRequest(
        "Promote this idea to a todo first (it still needs shape)."
      );
    }
    if (todo.status === "active" || todo.status === "done") {
      throw badRequest(`Todo is already ${todo.status}.`);
    }

    // Resolve delegating agent. Prefer user's choice; fall back to the
    // business's main agent.
    let delegateToAgentId = todo.agentId ?? null;
    if (!delegateToAgentId) {
      const main = await db.agent.findFirst({
        where: { businessId: todo.businessId, type: "main" },
        select: { id: true }
      });
      delegateToAgentId = main?.id ?? null;
    }
    if (!delegateToAgentId) {
      throw badRequest(
        "No agent available to delegate to. Assign an agent to the todo or add a main agent to the business."
      );
    }

    const targetAgent = await db.agent.findUnique({
      where: { id: delegateToAgentId },
      select: { id: true, displayName: true, role: true }
    });
    if (!targetAgent) throw badRequest("Assigned agent not found.");

    const taskBody = [
      todo.title,
      todo.description ? `\n\n${todo.description}` : "",
      todo.dueAt ? `\n\nDue: ${todo.dueAt.toISOString()}` : "",
      todo.recurringPattern ? `\n\nRecurring: ${todo.recurringPattern}` : ""
    ]
      .filter(Boolean)
      .join("");

    // Use the built-in delegate_task tool handler so delegation
    // metadata, ActivityEntry, executor state all line up with the
    // rest of the app.
    const delegation = await executeTool({
      toolName: "delegate_task",
      arguments: {
        agent_id: targetAgent.id,
        agent_name: targetAgent.displayName,
        task: taskBody,
        priority: todo.priority === "urgent" ? "high" : todo.priority,
        context: `Activated from todo id=${todo.id}. ${todo.tags.length ? `Tags: ${todo.tags.join(", ")}.` : ""}`
      },
      mcpServerId: "__builtin__",
      organizationId: session.organizationId,
      agentId: targetAgent.id,
      businessId: todo.businessId
    });

    if (!delegation.success) {
      throw badRequest(delegation.error ?? "Delegation failed.");
    }

    // Find the delegated conversation id from the delegation output.
    // Executor already logged an ActivityEntry so Pulse shows it;
    // we just need a link back for the UI.
    const match = delegation.output.match(/Conversation ID:\s*([\w-]+)/);
    const delegatedConversationId = match?.[1] ?? null;

    const updated = await db.todo.update({
      where: { id: todo.id },
      data: {
        status: "active",
        agentId: targetAgent.id,
        activatedAt: new Date(),
        delegatedConversationId
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        todo: updated,
        agent: targetAgent,
        delegatedConversationId
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
