import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  archiveConversation,
  getConversationById,
  updateConversation
} from "@/lib/repository/conversations";

const updateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  status: z.enum(["active", "completed", "escalated"]).optional()
});

export const dynamic = "force-dynamic";

type RouteContext = { params: { conversationId: string } };

/** Get a single conversation with metadata. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const conversation = await getConversationById(
      params.conversationId,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!conversation) {
      throw notFound("Conversation not found.");
    }

    return addSecurityHeaders(NextResponse.json({ conversation }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** Update conversation title or status. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = updateSchema.parse(await request.json());
    const updated = await updateConversation(
      params.conversationId,
      session.organizationId,
      body
    );

    if (!updated) {
      throw notFound("Conversation not found.");
    }

    return addSecurityHeaders(NextResponse.json({ conversation: updated }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** Archive (soft-delete) a conversation. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const archived = await archiveConversation(
      params.conversationId,
      session.organizationId
    );

    if (!archived) {
      throw notFound("Conversation not found.");
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
