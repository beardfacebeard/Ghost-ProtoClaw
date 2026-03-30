import { Prisma, type McpServer } from "@prisma/client";

import { getEncryptionKey } from "@/lib/auth/config";
import { encryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

export type InstallMcpServerParams = AuditContext & {
  organizationId: string;
  businessId?: string;
  definitionId: string;
  name: string;
  config: Record<string, string>;
  secrets: Record<string, string>;
};

export type UpdateMcpServerParams = AuditContext & {
  name?: string;
  businessId?: string | null;
  config?: Record<string, string>;
  secrets?: Record<string, string>;
};

export type SafeMcpServer = Omit<McpServer, "encryptedConfig"> & {
  hasSecrets: boolean;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readStringRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function normalizeStringRecord(input: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter((entry) => entry[1].length > 0)
  );
}

function sanitizeMcpForAudit(server: McpServer | null) {
  if (!server) {
    return Prisma.JsonNull;
  }

  return toJsonValue({
    id: server.id,
    organizationId: server.organizationId,
    businessId: server.businessId,
    definitionId: server.definitionId,
    name: server.name,
    status: server.status,
    config: server.config,
    healthStatus: server.healthStatus,
    lastHealthCheck: server.lastHealthCheck,
    hasSecrets: Boolean(server.encryptedConfig),
    createdAt: server.createdAt,
    updatedAt: server.updatedAt
  });
}

async function writeMcpAuditTrail(params: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  server: McpServer;
  previous: McpServer | null;
  eventType: string;
  activityTitle: string;
  activityDetail: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
}) {
  await params.tx.auditEvent.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId ?? null,
      actorEmail: params.actorEmail ?? null,
      ipAddress: params.ipAddress ?? null,
      eventType: params.eventType,
      entityType: "mcp_server",
      entityId: params.server.id,
      beforeJson: sanitizeMcpForAudit(params.previous),
      afterJson: sanitizeMcpForAudit(params.server)
    }
  });

  await params.tx.activityEntry.create({
    data: {
      businessId: params.server.businessId ?? null,
      type: "system",
      title: params.activityTitle,
      detail: params.activityDetail,
      status: params.server.status,
      metadata: {
        mcpServerId: params.server.id,
        definitionId: params.server.definitionId
      }
    }
  });
}

export function toSafeMcpServer(server: McpServer): SafeMcpServer {
  const { encryptedConfig: _encryptedConfig, ...rest } = server;

  return {
    ...rest,
    hasSecrets: Boolean(server.encryptedConfig)
  };
}

export function canAccessMcpServerForBusinesses(
  server: Pick<McpServer, "businessId">,
  businessIds: string[]
) {
  return !server.businessId || businessIds.includes(server.businessId);
}

export async function listMcpServers(organizationId: string) {
  return db.mcpServer.findMany({
    where: {
      organizationId
    },
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
}

export async function getMcpServerById(id: string, organizationId: string) {
  return db.mcpServer.findFirst({
    where: {
      id,
      organizationId
    }
  });
}

export async function installMcpServer(params: InstallMcpServerParams) {
  const normalizedConfig = normalizeStringRecord(params.config);
  const normalizedSecrets = normalizeStringRecord(params.secrets);
  const encryptedConfig =
    Object.keys(normalizedSecrets).length > 0
      ? Object.fromEntries(
          Object.entries(normalizedSecrets).map(([key, value]) => [
            key,
            encryptSecret(value, getEncryptionKey())
          ])
        )
      : null;

  const server = await db.$transaction(async (tx) => {
    const created = await tx.mcpServer.create({
      data: {
        organizationId: params.organizationId,
        businessId: params.businessId ?? null,
        definitionId: params.definitionId,
        name: params.name.trim(),
        status: "installing",
        config: toJsonValue(normalizedConfig),
        encryptedConfig: encryptedConfig ? toJsonValue(encryptedConfig) : Prisma.JsonNull
      }
    });

    await writeMcpAuditTrail({
      tx,
      organizationId: params.organizationId,
      server: created,
      previous: null,
      eventType: "mcp_installed",
      activityTitle: "MCP server installed",
      activityDetail: `${created.name} is being installed for your agents.`,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      ipAddress: params.ipAddress
    });

    return created;
  });

  return server;
}

export async function updateMcpServer(
  id: string,
  organizationId: string,
  params: UpdateMcpServerParams
) {
  const existing = await getMcpServerById(id, organizationId);

  if (!existing) {
    throw notFound("MCP server not found.");
  }

  const nextConfig = params.config
    ? {
        ...readStringRecord(existing.config),
        ...normalizeStringRecord(params.config)
      }
    : readStringRecord(existing.config);
  const existingEncrypted = readStringRecord(existing.encryptedConfig);
  const nextEncryptedSecrets = params.secrets
    ? {
        ...existingEncrypted,
        ...Object.fromEntries(
          Object.entries(normalizeStringRecord(params.secrets)).map(([key, value]) => [
            key,
            encryptSecret(value, getEncryptionKey())
          ])
        )
      }
    : existingEncrypted;

  const updated = await db.$transaction(async (tx) => {
    const server = await tx.mcpServer.update({
      where: {
        id
      },
      data: {
        ...(params.name !== undefined ? { name: params.name.trim() } : {}),
        ...(params.businessId !== undefined ? { businessId: params.businessId } : {}),
        ...(params.config !== undefined ? { config: toJsonValue(nextConfig) } : {}),
        ...(params.secrets !== undefined
          ? {
              encryptedConfig:
                Object.keys(nextEncryptedSecrets).length > 0
                  ? toJsonValue(nextEncryptedSecrets)
                  : Prisma.JsonNull
            }
          : {})
      }
    });

    await writeMcpAuditTrail({
      tx,
      organizationId,
      server,
      previous: existing,
      eventType: "mcp_updated",
      activityTitle: "MCP server updated",
      activityDetail: `${server.name} configuration was updated.`,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      ipAddress: params.ipAddress
    });

    return server;
  });

  return updated;
}

export async function updateMcpServerStatus(
  id: string,
  status: string,
  healthStatus?: object
) {
  return db.mcpServer.update({
    where: {
      id
    },
    data: {
      status,
      healthStatus: healthStatus ? toJsonValue(healthStatus) : undefined,
      lastHealthCheck: new Date()
    }
  });
}

export async function removeMcpServer(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
) {
  const existing = await getMcpServerById(id, organizationId);

  if (!existing) {
    throw notFound("MCP server not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.mcpServer.delete({
      where: {
        id
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "mcp_removed",
        entityType: "mcp_server",
        entityId: existing.id,
        beforeJson: sanitizeMcpForAudit(existing),
        afterJson: Prisma.JsonNull
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId ?? null,
        type: "system",
        title: "MCP server removed",
        detail: `${existing.name} was removed from Mission Control.`,
        status: "removed",
        metadata: {
          mcpServerId: existing.id,
          definitionId: existing.definitionId
        }
      }
    });
  });
}
