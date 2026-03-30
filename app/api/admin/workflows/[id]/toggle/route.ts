import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { getWorkflowById, toggleWorkflow } from "@/lib/repository/workflows";

const toggleSchema = z.object({
  enabled: z.boolean()
});

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
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

    const body = toggleSchema.parse(await request.json());
    const updated = await toggleWorkflow(
      params.id,
      session.organizationId,
      body.enabled,
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    );

    return addSecurityHeaders(
      NextResponse.json({
        workflow: updated
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
