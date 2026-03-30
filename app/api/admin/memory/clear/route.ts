import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MEMORY_TIERS } from "@/lib/brain/workspace";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { clearAgentMemories } from "@/lib/repository/memory";

const bodySchema = z.object({
  businessId: z.string().trim().min(1),
  agentId: z.string().trim().min(1).optional(),
  tier: z.enum(Object.keys(MEMORY_TIERS) as [string, ...string[]]).optional()
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    if (session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    const result = await clearAgentMemories({
      ...body,
      organizationId: session.organizationId,
      businessIds: session.role === "admin" ? session.businessIds : undefined,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
