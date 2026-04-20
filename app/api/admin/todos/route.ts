import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { autoAssignTodo } from "@/lib/llm/todo-auto-assign";
import { createTodo, listTodos } from "@/lib/repository/todos";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  businessId: z.string().trim().min(1),
  type: z.enum(["idea", "todo"]).optional(),
  status: z.string().optional(),
  limit: z.string().optional()
});

const createSchema = z.object({
  businessId: z.string().trim().min(1),
  type: z.enum(["idea", "todo"]).optional(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  agentId: z.string().trim().min(1).optional(),
  dueAt: z.string().datetime().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  recurringPattern: z.string().trim().max(60).optional(),
  createdVia: z.string().trim().max(40).optional(),
  // When true, run the LLM auto-assign pass first and merge its
  // suggestions into the final todo. The caller's explicit fields
  // win if provided.
  autoAssign: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (session.role === "admin") {
      requireBusinessAccess(session, query.businessId);
    }
    const statuses = query.status
      ? (query.status.split(",").filter(Boolean) as Array<
          "captured" | "active" | "snoozed" | "done" | "dismissed"
        >)
      : undefined;
    const items = await listTodos({
      organizationId: session.organizationId,
      businessId: query.businessId,
      type: query.type,
      status: statuses && statuses.length > 1 ? statuses : statuses?.[0],
      limit: query.limit ? Number(query.limit) : undefined
    });
    return addSecurityHeaders(NextResponse.json({ items }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = createSchema.parse(await request.json());
    if (session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    let merged = {
      type: body.type,
      title: body.title,
      description: body.description ?? null,
      priority: body.priority,
      agentId: body.agentId ?? null,
      dueAt: body.dueAt ?? null,
      tags: body.tags ?? [],
      recurringPattern: body.recurringPattern ?? null
    };

    let rationale: string | null = null;
    let autoAssignSkipped: string | null = null;

    if (body.autoAssign) {
      const agents = await db.agent.findMany({
        where: {
          businessId: body.businessId,
          status: { not: "disabled" }
        },
        select: {
          id: true,
          displayName: true,
          role: true,
          purpose: true,
          type: true
        }
      });
      const result = await autoAssignTodo({
        rawText: `${body.title}\n\n${body.description ?? ""}`.trim(),
        organizationId: session.organizationId,
        agents
      });
      if (result.success) {
        const s = result.suggestion;
        merged = {
          type: body.type ?? s.type,
          title: body.title || s.title,
          description: body.description ?? s.description ?? null,
          priority: body.priority ?? s.priority,
          agentId: body.agentId ?? s.agentId,
          dueAt: body.dueAt ?? s.dueAt,
          tags: (body.tags ?? []).length > 0 ? body.tags ?? [] : s.tags,
          recurringPattern: body.recurringPattern ?? s.recurringPattern
        };
        rationale = s.rationale;
      } else {
        autoAssignSkipped = result.error;
      }
    }

    const todo = await createTodo({
      organizationId: session.organizationId,
      businessId: body.businessId,
      type: merged.type,
      title: merged.title,
      description: merged.description,
      priority: merged.priority,
      agentId: merged.agentId,
      dueAt: merged.dueAt,
      tags: merged.tags,
      recurringPattern: merged.recurringPattern,
      createdVia: body.createdVia ?? "web",
      actorEmail: session.email,
      actorUserId: session.userId,
      metadata: rationale ? { autoAssignRationale: rationale } : null
    });

    return addSecurityHeaders(
      NextResponse.json({ todo, rationale, autoAssignSkipped })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
