import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  getVerifiedSession,
  requireBusinessAccess
} from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, forbidden, unauthorized } from "@/lib/errors";
import { getMcpDefinitionById } from "@/lib/integrations/mcp-definitions";
import { toSafeMcpPayload } from "@/lib/integrations/safe";
import { getIntegrationByKey } from "@/lib/repository/integrations";
import {
  installMcpServer,
  listMcpServers,
  toSafeMcpServer,
  updateMcpServerStatus
} from "@/lib/repository/mcp-servers";

const installSchema = z.object({
  definitionId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(80),
  businessId: z.string().trim().optional(),
  config: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({})
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const servers = await listMcpServers(session.organizationId);
    const visibleServers =
      session.role === "super_admin"
        ? servers
        : servers.filter(
            (server) =>
              !server.businessId || session.businessIds.includes(server.businessId)
          );

    return addSecurityHeaders(
      NextResponse.json({
        servers: visibleServers.map((server) =>
          toSafeMcpPayload(toSafeMcpServer(server))
        )
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

    const body = installSchema.parse(await request.json());
    const definition = getMcpDefinitionById(body.definitionId);

    if (!definition) {
      throw badRequest("Unknown MCP server.");
    }

    if (body.businessId) {
      requireBusinessAccess(session, body.businessId);
    } else if (session.role !== "super_admin") {
      throw forbidden("Organization-wide MCP servers require super admin access.");
    }

    if (definition.requiresIntegration) {
      const integration = await getIntegrationByKey(
        session.organizationId,
        definition.requiresIntegration
      );

      if (!integration || integration.status !== "connected") {
        throw badRequest(
          `Connect ${definition.requiresIntegration} before installing this MCP server.`
        );
      }

      if (
        body.businessId &&
        integration.scope !== "organization" &&
        integration.assignedBusinessIds.length > 0 &&
        !integration.assignedBusinessIds.includes(body.businessId)
      ) {
        throw badRequest(
          `The required ${definition.requiresIntegration} integration is not assigned to this business.`
        );
      }
    }

    const server = await installMcpServer({
      organizationId: session.organizationId,
      businessId: body.businessId,
      definitionId: definition.id,
      name: body.name,
      config: body.config,
      secrets: body.secrets,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    const activated = await updateMcpServerStatus(server.id, "active", {
      installedAt: new Date().toISOString(),
      readiness: "ready"
    });

    return addSecurityHeaders(
      NextResponse.json({
        server: toSafeMcpPayload(toSafeMcpServer(activated))
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
