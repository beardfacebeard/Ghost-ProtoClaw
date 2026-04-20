import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  apiErrorResponse,
  notFound,
  unauthorized
} from "@/lib/errors";
import {
  getTodoById,
  promoteIdeaToTodo
} from "@/lib/repository/todos";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getTodoById(params.id, session.organizationId);
    if (!existing) throw notFound("Todo not found.");
    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    const updated = await promoteIdeaToTodo(params.id, session.organizationId);
    return addSecurityHeaders(NextResponse.json({ todo: updated }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
