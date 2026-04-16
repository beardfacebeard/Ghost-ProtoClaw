import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  getVerifiedSession,
  requireBusinessAccess
} from "@/lib/auth/rbac";
import {
  apiErrorResponse,
  forbidden,
  notFound,
  unauthorized
} from "@/lib/errors";
import { toSafeMcpPayload } from "@/lib/integrations/safe";
import {
  getMcpServerById,
  removeMcpServer,
  toSafeMcpServer,
  updateMcpServer
} from "@/lib/repository/mcp-servers";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  businessId: z.string().trim().nullable().optional(),
  config: z.record(z.string(), z.string()).optional(),
  secrets: z.record(z.string(), z.string()).optional()
});

function ensureAccess(
  session: NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>,
  businessId: string | null
) {
  if (!businessId) {
    if (session.role !== "super_admin") {
      throw forbidden("Organization-wide MCP servers require super admin access.");
    }

    return;
  }

  requireBusinessAccess(session, businessId);
}

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const server = await getMcpServerById(context.params.id, session.organizationId);

    if (!server) {
      throw notFound("MCP server not found.");
    }

    ensureAccess(session, server.businessId);

    return addSecurityHeaders(
      NextResponse.json({
        server: toSafeMcpPayload(toSafeMcpServer(server))
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getMcpServerById(context.params.id, session.organizationId);

    if (!existing) {
      throw notFound("MCP server not found.");
    }

    ensureAccess(session, existing.businessId);

    const body = updateSchema.parse(await request.json());

    if (body.businessId) {
      ensureAccess(session, body.businessId);
    } else if (body.businessId === null && session.role !== "super_admin") {
      throw forbidden("Only super admins can create organization-wide MCP servers.");
    }

    const server = await updateMcpServer(context.params.id, session.organizationId, {
      name: body.name,
      businessId: body.businessId,
      config: body.config,
      secrets: body.secrets,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        server: toSafeMcpPayload(toSafeMcpServer(server))
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getMcpServerById(context.params.id, session.organizationId);

    if (!existing) {
      throw notFound("MCP server not found.");
    }

    ensureAccess(session, existing.businessId);

    await removeMcpServer(context.params.id, session.organizationId, {
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
