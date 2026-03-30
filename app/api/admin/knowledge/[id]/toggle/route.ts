import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  getKnowledgeItemById,
  toggleKnowledgeItem
} from "@/lib/repository/knowledge";

const bodySchema = z.object({
  enabled: z.boolean()
});

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getKnowledgeItemById(params.id, session.organizationId);

    if (!existing) {
      throw notFound("Knowledge item not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    const body = bodySchema.parse(await request.json());
    const item = await toggleKnowledgeItem(
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
        item
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
