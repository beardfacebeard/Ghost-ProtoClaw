import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MEMORY_TIERS } from "@/lib/brain/workspace";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { getAgentById } from "@/lib/repository/agents";
import { listAgentMemories } from "@/lib/repository/memory";

const querySchema = z.object({
  businessId: z.string().optional(),
  agentId: z.string().optional(),
  tier: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (session.role === "admin" && query.businessId) {
      requireBusinessAccess(session, query.businessId);
    }

    if (session.role === "admin" && query.agentId && !query.businessId) {
      const agent = await getAgentById(
        query.agentId,
        session.organizationId,
        session.businessIds
      );

      if (agent?.businessId) {
        requireBusinessAccess(session, agent.businessId);
      }
    }

    const memories = await listAgentMemories({
      organizationId: session.organizationId,
      businessId: query.businessId,
      agentId: query.agentId,
      tier: query.tier,
      type: query.type,
      search: query.search,
      limit: query.limit,
      businessIds: session.role === "admin" ? session.businessIds : undefined
    });

    return addSecurityHeaders(
      NextResponse.json({
        memories
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
