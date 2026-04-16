import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, forbidden, notFound, unauthorized } from "@/lib/errors";
import { getWorkflowById, runWorkflowManually } from "@/lib/repository/workflows";

const runWorkflowSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional()
});

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

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

    if (workflow.trigger !== "manual" && session.role !== "super_admin") {
      throw forbidden("Only manual workflows can be run on demand.");
    }

    const body = runWorkflowSchema.parse(await request.json().catch(() => ({})));
    const result = await runWorkflowManually(params.id, session.userId, body.payload);

    return addSecurityHeaders(
      NextResponse.json(
        "requiresApproval" in result
          ? result
          : {
              run: result
            }
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
