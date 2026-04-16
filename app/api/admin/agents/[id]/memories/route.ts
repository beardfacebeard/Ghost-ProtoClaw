import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { getAgentById } from "@/lib/repository/agents";
import { clearAgentMemories } from "@/lib/repository/memory";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const agent = await getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!agent) {
      throw notFound("Agent not found.");
    }

    const deleted = await clearAgentMemories({
      agentId: params.id,
      businessId: agent.businessId ?? undefined,
      organizationId: session.organizationId,
      businessIds: session.role === "admin" ? session.businessIds : undefined,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        deleted: deleted.count
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
