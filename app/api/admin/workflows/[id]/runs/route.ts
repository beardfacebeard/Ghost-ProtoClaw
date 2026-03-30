import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { getWorkflowById, getWorkflowRuns } from "@/lib/repository/workflows";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const workflow = await getWorkflowById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!workflow) {
      throw notFound("Workflow not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, workflow.businessId);
    }

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    const runs = await getWorkflowRuns(params.id, query.limit);

    return addSecurityHeaders(
      NextResponse.json({
        runs
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
