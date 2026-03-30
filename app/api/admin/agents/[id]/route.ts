import { NextRequest, NextResponse } from "next/server";

import { agentUpdateApiSchema } from "@/components/admin/agents/schema";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, forbidden, notFound, unauthorized } from "@/lib/errors";
import { deleteAgent, getAgentById, updateAgent } from "@/lib/repository/agents";

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

    const agent = await getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!agent) {
      throw notFound("Agent not found.");
    }

    return addSecurityHeaders(
      NextResponse.json({
        agent
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Agent not found.");
    }

    const body = agentUpdateApiSchema.parse(await request.json());

    if (session.role === "admin") {
      if (body.type === "global") {
        throw forbidden("Global agents require super admin access.");
      }

      const scopedBusinessId =
        body.businessId ?? existing.businessId ?? undefined;

      if (scopedBusinessId) {
        requireBusinessAccess(session, scopedBusinessId);
      }
    }

    const updated = await updateAgent(params.id, session.organizationId, {
      ...body,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        agent: updated
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Agent not found.");
    }

    await deleteAgent(params.id, session.organizationId, {
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
