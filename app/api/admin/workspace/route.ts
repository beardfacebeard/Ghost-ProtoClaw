import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  MEMORY_TIERS,
  validateWorkspaceFilePath,
  WORKSPACE_CATEGORIES
} from "@/lib/brain/workspace";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import {
  createWorkspaceDocument,
  listWorkspaceDocuments
} from "@/lib/repository/workspace";

const querySchema = z.object({
  businessId: z.string().trim().min(1),
  category: z.string().optional(),
  tier: z.string().optional(),
  agentId: z.string().optional(),
  search: z.string().optional()
});

const bodySchema = z.object({
  businessId: z.string().trim().min(1),
  agentId: z.string().trim().min(1).optional(),
  filePath: z.string().trim().min(1),
  content: z.string(),
  category: z
    .enum(Object.keys(WORKSPACE_CATEGORIES) as [string, ...string[]])
    .optional(),
  tier: z.enum(Object.keys(MEMORY_TIERS) as [string, ...string[]]).optional()
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

    if (session.role === "admin") {
      requireBusinessAccess(session, query.businessId);
    }

    const documents = await listWorkspaceDocuments({
      businessId: query.businessId,
      organizationId: session.organizationId,
      category: query.category,
      tier: query.tier,
      agentId: query.agentId,
      search: query.search
    });

    return addSecurityHeaders(
      NextResponse.json({
        documents
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = bodySchema.parse(await request.json());
    const validation = validateWorkspaceFilePath(body.filePath);

    if (!validation.valid) {
      throw badRequest(validation.error);
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    const document = await createWorkspaceDocument({
      ...body,
      filePath: validation.normalized,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        document
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
