import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MEMORY_TIERS } from "@/lib/brain/workspace";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  deleteMemory,
  getAgentMemoryById,
  updateMemoryTier
} from "@/lib/repository/memory";

const bodySchema = z.object({
  tier: z.enum(Object.keys(MEMORY_TIERS) as [string, ...string[]])
});

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getAgentMemoryById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Memory not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    const body = bodySchema.parse(await request.json());
    const memory = await updateMemoryTier(
      params.id,
      session.organizationId,
      body.tier,
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    );

    return addSecurityHeaders(
      NextResponse.json({
        memory
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

    const existing = await getAgentMemoryById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Memory not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    await deleteMemory(params.id, session.organizationId, {
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
