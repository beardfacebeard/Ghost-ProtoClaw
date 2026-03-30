import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  MEMORY_TIERS,
  validateWorkspaceFilePath,
  WORKSPACE_CATEGORIES
} from "@/lib/brain/workspace";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";
import {
  deleteWorkspaceDocument,
  getWorkspaceDocumentById,
  updateWorkspaceDocument
} from "@/lib/repository/workspace";

const bodySchema = z
  .object({
    agentId: z.string().trim().min(1).nullable().optional(),
    filePath: z.string().trim().min(1).optional(),
    content: z.string().optional(),
    category: z
      .enum(Object.keys(WORKSPACE_CATEGORIES) as [string, ...string[]])
      .optional(),
    tier: z.enum(Object.keys(MEMORY_TIERS) as [string, ...string[]]).optional()
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
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const document = await getWorkspaceDocumentById(params.id, session.organizationId);

    if (!document) {
      throw notFound("Workspace file not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, document.businessId);
    }

    return addSecurityHeaders(
      NextResponse.json({
        document
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

    const existing = await getWorkspaceDocumentById(params.id, session.organizationId);

    if (!existing) {
      throw notFound("Workspace file not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    const body = bodySchema.parse(await request.json());

    if (body.filePath) {
      const validation = validateWorkspaceFilePath(body.filePath);

      if (!validation.valid) {
        throw badRequest(validation.error);
      }

      body.filePath = validation.normalized;
    }

    const document = await updateWorkspaceDocument(params.id, session.organizationId, {
      ...body,
      agentId: body.agentId ?? undefined,
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

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getWorkspaceDocumentById(params.id, session.organizationId);

    if (!existing) {
      throw notFound("Workspace file not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    await deleteWorkspaceDocument(params.id, session.organizationId, {
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
