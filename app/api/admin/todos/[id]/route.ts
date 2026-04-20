import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  apiErrorResponse,
  notFound,
  unauthorized
} from "@/lib/errors";
import {
  deleteTodo,
  getTodoById,
  updateTodo
} from "@/lib/repository/todos";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    type: z.enum(["idea", "todo"]).optional(),
    title: z.string().trim().min(1).max(240).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    status: z
      .enum(["captured", "active", "snoozed", "done", "dismissed"])
      .optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    agentId: z.string().trim().min(1).nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    snoozedUntil: z.string().datetime().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    recurringPattern: z.string().trim().max(60).nullable().optional()
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Provide at least one field."
  });

type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getTodoById(params.id, session.organizationId);
    if (!existing) throw notFound("Todo not found.");
    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    const body = patchSchema.parse(await request.json());
    const todo = await updateTodo(params.id, session.organizationId, {
      ...body,
      actorEmail: session.email,
      actorUserId: session.userId,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(NextResponse.json({ todo }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    const existing = await getTodoById(params.id, session.organizationId);
    if (!existing) throw notFound("Todo not found.");
    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }
    await deleteTodo(params.id, session.organizationId);
    return addSecurityHeaders(NextResponse.json({ ok: true }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
