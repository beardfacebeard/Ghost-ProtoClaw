import { IntegrationsClient } from "@/components/admin/integrations/IntegrationsClient";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { INTEGRATION_DEFINITIONS } from "@/lib/integrations/integration-definitions";
import { toSafeIntegrationPayload } from "@/lib/integrations/safe";
import {
  canAccessIntegrationForBusinesses,
  listIntegrations,
  toSafeIntegration
} from "@/lib/repository/integrations";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
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

  const [businesses, integrations] = await Promise.all([
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
    listIntegrations(session.organizationId)
  ]);

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
        title="Integrations"
        description="Connect external services to power your agents and workflows"
      />

      <IntegrationsClient
        definitions={INTEGRATION_DEFINITIONS}
        integrations={visibleIntegrations.map((integration) =>
          toSafeIntegrationPayload(toSafeIntegration(integration))
        )}
        businesses={businesses}
        sessionRole={session.role}
      />
    </div>
  );
}
