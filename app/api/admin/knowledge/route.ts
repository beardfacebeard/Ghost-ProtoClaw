import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { KNOWLEDGE_CATEGORIES } from "@/lib/brain/knowledge";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import {
  createKnowledgeItem,
  listKnowledgeItems
} from "@/lib/repository/knowledge";

const querySchema = z.object({
  businessId: z.string().trim().min(1),
  category: z.string().optional(),
  search: z.string().optional(),
  enabled: z.enum(["true", "false"]).optional()
});

const bodySchema = z.object({
  businessId: z.string().trim().min(1),
  category: z.enum(Object.keys(KNOWLEDGE_CATEGORIES) as [string, ...string[]]),
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(1),
  enabled: z.boolean().optional()
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (session.role === "admin") {
      requireBusinessAccess(session, query.businessId);
    }

    const items = await listKnowledgeItems({
      businessId: query.businessId,
      organizationId: session.organizationId,
      category: query.category,
      search: query.search,
      enabled:
        query.enabled === undefined ? undefined : query.enabled === "true"
    });

    return addSecurityHeaders(
      NextResponse.json({
        items
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

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

    const item = await createKnowledgeItem({
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
