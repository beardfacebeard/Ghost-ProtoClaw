import type { Integration, McpServer } from "@prisma/client";

import {
  getIntegrationByKey as getIntegrationDefinitionByKey
} from "@/lib/integrations/integration-definitions";
import { getMcpDefinitionById } from "@/lib/integrations/mcp-definitions";
import type { SafeIntegration } from "@/lib/repository/integrations";
import type { SafeMcpServer } from "@/lib/repository/mcp-servers";

export type SafeIntegrationPayload = SafeIntegration & {
  definition: ReturnType<typeof getIntegrationDefinitionByKey> | null;
};

export type SafeMcpServerPayload = SafeMcpServer & {
  definition: ReturnType<typeof getMcpDefinitionById> | null;
};

export function toSafeIntegrationPayload(
  integration: SafeIntegration | Integration
): SafeIntegrationPayload {
  const safeIntegration =
    "hasSecrets" in integration
      ? integration
      : {
          ...integration,
          hasSecrets: integration.secretKeys.length > 0,
          secretFieldCount: integration.secretKeys.length
        };

  return {
    ...safeIntegration,
    definition: getIntegrationDefinitionByKey(safeIntegration.key) ?? null
  };
}

export function toSafeMcpPayload(
  server: SafeMcpServer | McpServer
): SafeMcpServerPayload {
  const safeServer =
    "hasSecrets" in server
      ? server
      : {
          ...server,
          hasSecrets: Boolean(server.encryptedConfig)
        };

  return {
    ...safeServer,
    definition: getMcpDefinitionById(safeServer.definitionId) ?? null
  };
}
