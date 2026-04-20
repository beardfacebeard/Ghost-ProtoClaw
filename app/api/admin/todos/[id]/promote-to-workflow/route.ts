import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";
import { getTodoById } from "@/lib/repository/todos";
import { createWorkflow } from "@/lib/repository/workflows";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  frequency: z.string().trim().min(1).max(60).optional(),
  cronExpression: z.string().trim().min(1).max(200).optional(),
  scheduleMode: z.enum(["every", "cron"]).optional()
});

type RouteContext = { params: { id: string } };

/**
 * Promote a recurring todo into a scheduled workflow. If the todo has a
 * recurringPattern, use it as the default frequency; caller can override.
 * Keeps the todo row around (marked as done) so history is preserved.
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

    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const scheduleMode = body.scheduleMode ?? (body.cronExpression ? "cron" : "every");
    const frequency = body.frequency ?? todo.recurringPattern ?? "weekly";

    if (scheduleMode === "cron" && !body.cronExpression) {
      throw badRequest("scheduleMode=cron requires cronExpression.");
    }

    const description = [
      `Promoted from todo id=${todo.id}.`,
      todo.description ? `\n\nOriginal description:\n${todo.description}` : ""
    ]
      .filter(Boolean)
      .join("");

    const workflow = await createWorkflow({
      organizationId: session.organizationId,
      businessId: todo.businessId,
      agentId: todo.agentId ?? null,
      name: todo.title.slice(0, 100),
      description,
      trigger: "scheduled",
      output: "chat",
      outputs: ["chat"],
      scheduleMode,
      frequency: scheduleMode === "every" ? frequency : null,
      cronExpression: scheduleMode === "cron" ? body.cronExpression ?? null : null,
      timezone: null,
      approvalMode: "review_after",
      enabled: true,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    const updatedTodo = await db.todo.update({
      where: { id: todo.id },
      data: {
        status: "done",
        completedAt: new Date(),
        metadata: {
          ...(typeof todo.metadata === "object" && todo.metadata
            ? (todo.metadata as Record<string, unknown>)
            : {}),
          promotedToWorkflowId: workflow.id
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({ workflow, todo: updatedTodo })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
