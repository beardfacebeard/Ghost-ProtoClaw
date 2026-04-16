import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { KNOWLEDGE_CATEGORIES } from "@/lib/brain/knowledge";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  deleteKnowledgeItem,
  getKnowledgeItemById,
  updateKnowledgeItem
} from "@/lib/repository/knowledge";

const bodySchema = z
  .object({
    category: z
      .enum(Object.keys(KNOWLEDGE_CATEGORIES) as [string, ...string[]])
      .optional(),
    title: z.string().trim().min(2).max(120).optional(),
    content: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update."
  });

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const item = await getKnowledgeItemById(params.id, session.organizationId);

    if (!item) {
      throw notFound("Knowledge item not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, item.businessId);
    }

    return addSecurityHeaders(
      NextResponse.json({
        item
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

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
    const item = await updateKnowledgeItem(params.id, session.organizationId, {
      ...body,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        item
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

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

    await deleteKnowledgeItem(params.id, session.organizationId, {
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
