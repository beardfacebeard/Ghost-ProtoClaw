import { McpClient } from "@/components/admin/mcp/McpClient";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { MCP_DEFINITIONS } from "@/lib/integrations/mcp-definitions";
import { toSafeMcpPayload, toSafeIntegrationPayload } from "@/lib/integrations/safe";
import {
  canAccessIntegrationForBusinesses,
  listIntegrations,
  toSafeIntegration
} from "@/lib/repository/integrations";
import {
  listMcpServers,
  toSafeMcpServer
} from "@/lib/repository/mcp-servers";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: { in: session.businessIds }
        }
      : {
          organizationId: session.organizationId
        };

  const [businesses, servers, integrations] = await Promise.all([
    db.business.findMany({
      where: businessWhere,
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    listMcpServers(session.organizationId),
    listIntegrations(session.organizationId)
  ]);

  const visibleServers =
    session.role === "super_admin"
      ? servers
      : servers.filter((server) => !server.businessId || session.businessIds.includes(server.businessId));
  const visibleIntegrations =
    session.role === "super_admin"
      ? integrations
      : integrations.filter((integration) => {
          if (integration.scope === "organization") {
            return true;
          }

          return canAccessIntegrationForBusinesses(integration, session.businessIds);
        });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Connect · MCP Servers"
        title="Model Context Protocol."
        description="MCP servers extend your agents with real-world tool capabilities — filesystem access, database queries, external APIs. Install from the catalog or configure your own."
      />

      <McpClient
        definitions={MCP_DEFINITIONS}
        servers={visibleServers.map((server) => toSafeMcpPayload(toSafeMcpServer(server)))}
        integrations={visibleIntegrations.map((integration) =>
          toSafeIntegrationPayload(toSafeIntegration(integration))
        )}
        businesses={businesses}
        sessionRole={session.role}
      />
    </div>
  );
}
