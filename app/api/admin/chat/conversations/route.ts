import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";
import {
  createConversation,
  listConversations
} from "@/lib/repository/conversations";
import { getAgentById } from "@/lib/repository/agents";

const createSchema = z.object({
  agentId: z.string().trim().min(1),
  title: z.string().trim().max(200).optional()
});

export const dynamic = "force-dynamic";

/** List conversations for the current user. */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const businessId = url.searchParams.get("businessId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Number(url.searchParams.get("offset")) || 0;

    const conversations = await listConversations({
      organizationId: session.organizationId,
      adminUserId: session.userId,
      agentId,
      businessId,
      status,
      limit,
      offset,
      businessIds:
        session.role === "admin" ? session.businessIds : undefined
    });

    return addSecurityHeaders(NextResponse.json({ conversations }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** Create a new conversation with an agent. */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = createSchema.parse(await request.json());

    // Validate agent exists and user has access
    const agent = await getAgentById(
      body.agentId,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!agent) {
      throw notFound("Agent not found.");
    }

    if (!agent.businessId) {
      throw badRequest("Cannot start a conversation with a global agent.");
    }

    const conversation = await createConversation({
      agentId: agent.id,
      businessId: agent.businessId,
      organizationId: session.organizationId,
      adminUserId: session.userId,
      title: body.title
    });

    return addSecurityHeaders(
      NextResponse.json({ conversation }, { status: 201 })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
