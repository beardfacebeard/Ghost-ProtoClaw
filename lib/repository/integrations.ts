import { Prisma, type Integration } from "@prisma/client";

import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import {
  getIntegrationByKey as getIntegrationDefinitionByKey
} from "@/lib/integrations/integration-definitions";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

export type SaveIntegrationParams = AuditContext & {
  organizationId: string;
  key: string;
  name: string;
  scope: string;
  authType: string;
  config: Record<string, string>;
  secrets: Record<string, string>;
  assignedBusinessIds?: string[];
};

export type SafeIntegration = Omit<Integration, "encryptedSecrets" | "secretKeys"> & {
  hasSecrets: boolean;
  secretFieldCount: number;
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

function sanitizeIntegrationForAudit(integration: Integration | null) {
  if (!integration) {
    return Prisma.JsonNull;
  }

  return toJsonValue({
    id: integration.id,
    organizationId: integration.organizationId,
    key: integration.key,
    name: integration.name,
    description: integration.description,
    scope: integration.scope,
    status: integration.status,
    authType: integration.authType,
    config: integration.config,
    assignedBusinessIds: integration.assignedBusinessIds,
    hasSecrets: Boolean(integration.secretKeys.length),
    secretFieldCount: integration.secretKeys.length,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt
  });
}

function activityBusinessId(
  integration: Pick<Integration, "scope" | "assignedBusinessIds">
) {
  if (integration.scope === "organization") {
    return null;
  }

  return integration.assignedBusinessIds[0] ?? null;
}

async function writeIntegrationAuditTrail(params: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  integration: Integration;
  previous: Integration | null;
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
      entityType: "integration",
      entityId: params.integration.id,
      beforeJson: sanitizeIntegrationForAudit(params.previous),
      afterJson: sanitizeIntegrationForAudit(params.integration)
    }
  });

  await params.tx.activityEntry.create({
    data: {
      businessId: activityBusinessId(params.integration),
      type: "integration",
      title: params.activityTitle,
      detail: params.activityDetail,
      status: params.integration.status,
      metadata: {
        integrationId: params.integration.id,
        key: params.integration.key,
        scope: params.integration.scope
      }
    }
  });
}

async function fetchProviderTest(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store"
  });
}

async function getGoogleAccessToken(
  config: Record<string, string>,
  secrets: Record<string, string>
) {
  if (secrets.access_token) {
    return secrets.access_token;
  }

  const clientId =
    config.client_id ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GMAIL_CLIENT_ID;
  const clientSecret =
    secrets.client_secret ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = secrets.refresh_token || process.env.GMAIL_REFRESH_TOKEN;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/oauth/google/callback`;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const response = await fetchProviderTest("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: string;
  };

  return payload.access_token ?? null;
}

async function performConnectionTest(
  integration: Integration,
  config: Record<string, string>,
  secrets: Record<string, string>
) {
  switch (integration.key) {
    case "gmail": {
      const accessToken = await getGoogleAccessToken(config, secrets);
      if (!accessToken) {
        return {
          success: false,
          error: "Missing Google access credentials."
        };
      }

      const response = await fetchProviderTest(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return response.ok
        ? {
            success: true,
            details: "Gmail connection is active."
          }
        : {
            success: false,
            error: "Google rejected the Gmail credentials."
          };
    }
    case "google_calendar": {
      const accessToken = await getGoogleAccessToken(config, secrets);
      if (!accessToken) {
        return {
          success: false,
          error: "Missing Google access credentials."
        };
      }

      const response = await fetchProviderTest(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return response.ok
        ? {
            success: true,
            details: "Google Calendar connection is active."
          }
        : {
            success: false,
            error: "Google rejected the Calendar credentials."
          };
    }
    case "google_drive": {
      const accessToken = await getGoogleAccessToken(config, secrets);
      if (!accessToken) {
        return {
          success: false,
          error: "Missing Google access credentials."
        };
      }

      const response = await fetchProviderTest(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return response.ok
        ? {
            success: true,
            details: "Google Drive connection is active."
          }
        : {
            success: false,
            error: "Google rejected the Drive credentials."
          };
    }
    case "sendgrid": {
      const response = await fetchProviderTest(
        "https://api.sendgrid.com/v3/user/account",
        {
          headers: {
            Authorization: `Bearer ${secrets.api_key}`
          }
        }
      );

      return response.ok
        ? { success: true, details: "SendGrid accepted the API key." }
        : { success: false, error: "SendGrid rejected the API key." };
    }
    case "hubspot": {
      const response = await fetchProviderTest(
        "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
        {
          headers: {
            Authorization: `Bearer ${secrets.access_token}`
          }
        }
      );

      return response.ok
        ? { success: true, details: "HubSpot connection is active." }
        : { success: false, error: "HubSpot rejected the access token." };
    }
    case "pipedrive": {
      const domain = config.company_domain;
      const apiKey = secrets.api_key;
      if (!domain || !apiKey) {
        return { success: false, error: "Pipedrive credentials are incomplete." };
      }

      const response = await fetchProviderTest(
        `https://${domain}.pipedrive.com/api/v1/users/me?api_token=${encodeURIComponent(apiKey)}`
      );

      return response.ok
        ? { success: true, details: "Pipedrive connection is active." }
        : { success: false, error: "Pipedrive rejected the API key." };
    }
    case "gohighlevel": {
      if (!secrets.api_key || !config.location_id) {
        return {
          success: false,
          error: "GoHighLevel credentials are incomplete."
        };
      }

      const response = await fetchProviderTest(
        `https://services.leadconnectorhq.com/locations/${encodeURIComponent(config.location_id)}`,
        {
          headers: {
            Authorization: `Bearer ${secrets.api_key}`,
            Version: "2021-07-28"
          }
        }
      );

      return response.ok
        ? { success: true, details: "GoHighLevel connection is active." }
        : { success: false, error: "GoHighLevel rejected the credentials." };
    }
    case "stripe": {
      const response = await fetchProviderTest("https://api.stripe.com/v1/account", {
        headers: {
          Authorization: `Bearer ${secrets.secret_key}`
        }
      });

      return response.ok
        ? { success: true, details: "Stripe connection is active." }
        : { success: false, error: "Stripe rejected the secret key." };
    }
    case "slack": {
      const response = await fetchProviderTest("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secrets.bot_token}`
        }
      });

      if (!response.ok) {
        return { success: false, error: "Slack rejected the bot token." };
      }

      const payload = (await response.json()) as {
        ok?: boolean;
      };

      return payload.ok
        ? { success: true, details: "Slack connection is active." }
        : { success: false, error: "Slack rejected the bot token." };
    }
    case "telegram": {
      const response = await fetchProviderTest(
        `https://api.telegram.org/bot${encodeURIComponent(secrets.bot_token)}/getMe`
      );

      return response.ok
        ? { success: true, details: "Telegram bot connection is active." }
        : { success: false, error: "Telegram rejected the bot token." };
    }
    case "twilio": {
      const sid = config.account_sid;
      const token = secrets.auth_token;

      if (!sid || !token) {
        return { success: false, error: "Twilio credentials are incomplete." };
      }

      const response = await fetchProviderTest(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`
          }
        }
      );

      return response.ok
        ? { success: true, details: "Twilio connection is active." }
        : { success: false, error: "Twilio rejected the credentials." };
    }
    case "github": {
      const response = await fetchProviderTest("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${secrets.personal_access_token}`,
          "User-Agent": "Ghost-ProtoClaw-Mission-Control",
          Accept: "application/vnd.github+json"
        }
      });

      return response.ok
        ? { success: true, details: "GitHub connection is active." }
        : { success: false, error: "GitHub rejected the personal access token." };
    }
    case "openrouter": {
      const response = await fetchProviderTest("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${secrets.api_key}`
        }
      });

      return response.ok
        ? { success: true, details: "OpenRouter connection is active." }
        : { success: false, error: "OpenRouter rejected the API key." };
    }
    case "openai": {
      const response = await fetchProviderTest("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${secrets.api_key}`,
          ...(config.org_id
            ? {
                "OpenAI-Organization": config.org_id
              }
            : {})
        }
      });

      return response.ok
        ? { success: true, details: "OpenAI connection is active." }
        : { success: false, error: "OpenAI rejected the API key." };
    }
    case "anthropic": {
      const response = await fetchProviderTest("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": secrets.api_key,
          "anthropic-version": "2023-06-01"
        }
      });

      return response.ok
        ? { success: true, details: "Anthropic connection is active." }
        : { success: false, error: "Anthropic rejected the API key." };
    }
    default:
      return {
        success: Object.keys(secrets).length > 0 || Object.keys(config).length > 0,
        details:
          "Configuration is saved. A provider-specific connection test is not available yet."
      };
  }
}

export function toSafeIntegration(integration: Integration): SafeIntegration {
  const { encryptedSecrets: _encryptedSecrets, secretKeys, ...rest } = integration;

  return {
    ...rest,
    hasSecrets: secretKeys.length > 0,
    secretFieldCount: secretKeys.length
  };
}

export function canAccessIntegrationForBusinesses(
  integration: Pick<Integration, "scope" | "assignedBusinessIds">,
  businessIds: string[]
) {
  if (integration.scope === "organization") {
    return true;
  }

  if (integration.assignedBusinessIds.length === 0) {
    return integration.scope === "both";
  }

  return integration.assignedBusinessIds.some((businessId) =>
    businessIds.includes(businessId)
  );
}

export async function listIntegrations(organizationId: string) {
  return db.integration.findMany({
    where: {
      organizationId
    },
    orderBy: [{ status: "desc" }, { name: "asc" }]
  });
}

export async function getIntegrationByKey(
  organizationId: string,
  key: string
) {
  return db.integration.findUnique({
    where: {
      organizationId_key: {
        organizationId,
        key
      }
    }
  });
}

export async function getIntegrationById(
  id: string,
  organizationId: string
) {
  return db.integration.findFirst({
    where: {
      id,
      organizationId
    }
  });
}

export async function saveIntegration(params: SaveIntegrationParams) {
  const definition = getIntegrationDefinitionByKey(params.key);
  const normalizedConfig = normalizeStringRecord(params.config);
  const normalizedSecrets = normalizeStringRecord(params.secrets);
  const existing = await getIntegrationByKey(params.organizationId, params.key);

  const previousConfig = readStringRecord(existing?.config);
  const previousEncryptedSecrets = readStringRecord(existing?.encryptedSecrets);
  const nextEncryptedSecrets = { ...previousEncryptedSecrets };

  for (const [key, value] of Object.entries(normalizedSecrets)) {
    nextEncryptedSecrets[key] = encryptSecret(value, getEncryptionKey());
  }

  const nextConfig = {
    ...previousConfig,
    ...normalizedConfig
  };

  const nextAssignedBusinessIds =
    params.scope === "organization"
      ? []
      : params.assignedBusinessIds !== undefined
        ? [...new Set(params.assignedBusinessIds)]
        : existing?.assignedBusinessIds ?? [];

  const integration = await db.$transaction(async (tx) => {
    const saved = existing
      ? await tx.integration.update({
          where: {
            id: existing.id
          },
          data: {
            name: params.name,
            description: definition?.description ?? existing.description,
            scope: params.scope,
            status: "connected",
            authType: params.authType,
            config: toJsonValue(nextConfig),
            encryptedSecrets:
              Object.keys(nextEncryptedSecrets).length > 0
                ? toJsonValue(nextEncryptedSecrets)
                : Prisma.JsonNull,
            secretKeys: Object.keys(nextEncryptedSecrets),
            assignedBusinessIds: nextAssignedBusinessIds
          }
        })
      : await tx.integration.create({
          data: {
            organizationId: params.organizationId,
            key: params.key,
            name: params.name,
            description: definition?.description ?? null,
            scope: params.scope,
            status: "connected",
            authType: params.authType,
            config: toJsonValue(nextConfig),
            encryptedSecrets:
              Object.keys(nextEncryptedSecrets).length > 0
                ? toJsonValue(nextEncryptedSecrets)
                : Prisma.JsonNull,
            secretKeys: Object.keys(nextEncryptedSecrets),
            assignedBusinessIds: nextAssignedBusinessIds
          }
        });

    await writeIntegrationAuditTrail({
      tx,
      organizationId: params.organizationId,
      integration: saved,
      previous: existing,
      eventType: "integration_saved",
      activityTitle: existing ? "Integration updated" : "Integration connected",
      activityDetail: existing
        ? `${saved.name} settings were updated.`
        : `${saved.name} was connected successfully.`,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      ipAddress: params.ipAddress
    });

    return saved;
  });

  return integration;
}

export async function disconnectIntegration(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
) {
  const existing = await getIntegrationById(id, organizationId);

  if (!existing) {
    throw notFound("Integration not found.");
  }

  await db.$transaction(async (tx) => {
    const disconnected = await tx.integration.update({
      where: {
        id
      },
      data: {
        status: "disconnected",
        encryptedSecrets: Prisma.JsonNull,
        secretKeys: []
      }
    });

    await writeIntegrationAuditTrail({
      tx,
      organizationId,
      integration: disconnected,
      previous: existing,
      eventType: "integration_disconnected",
      activityTitle: "Integration disconnected",
      activityDetail: `${existing.name} was disconnected and its stored secrets were wiped.`,
      actorUserId: auditContext.actorUserId,
      actorEmail: auditContext.actorEmail,
      ipAddress: auditContext.ipAddress
    });
  });
}

export async function getDecryptedSecrets(id: string, organizationId: string) {
  const integration = await getIntegrationById(id, organizationId);

  if (!integration) {
    throw notFound("Integration not found.");
  }

  const encryptedSecrets = readStringRecord(integration.encryptedSecrets);
  const encryptionKey = getEncryptionKey();

  return Object.fromEntries(
    Object.entries(encryptedSecrets).map(([key, value]) => [
      key,
      decryptSecret(value, encryptionKey)
    ])
  );
}

export async function assignIntegrationToBusinesses(
  id: string,
  organizationId: string,
  businessIds: string[],
  auditContext: AuditContext = {}
) {
  const existing = await getIntegrationById(id, organizationId);

  if (!existing) {
    throw notFound("Integration not found.");
  }

  const assignedBusinessIds = [...new Set(businessIds)];

  const updated = await db.$transaction(async (tx) => {
    const integration = await tx.integration.update({
      where: {
        id
      },
      data: {
        assignedBusinessIds
      }
    });

    await writeIntegrationAuditTrail({
      tx,
      organizationId,
      integration,
      previous: existing,
      eventType: "integration_assigned",
      activityTitle: "Integration assignment updated",
      activityDetail: `${integration.name} business assignments were updated.`,
      actorUserId: auditContext.actorUserId,
      actorEmail: auditContext.actorEmail,
      ipAddress: auditContext.ipAddress
    });

    return integration;
  });

  return updated;
}

export async function testIntegrationConnection(
  id: string,
  organizationId: string
) {
  const integration = await getIntegrationById(id, organizationId);

  if (!integration) {
    throw notFound("Integration not found.");
  }

  const config = readStringRecord(integration.config);
  const secrets = await getDecryptedSecrets(id, organizationId);

  try {
    return await performConnectionTest(integration, config, secrets);
  } catch (error) {
    console.error("Integration test failed", {
      integrationId: id,
      key: integration.key,
      error
    });

    return {
      success: false,
      error:
        "The provider could not be reached or rejected the connection attempt."
    };
  }
}
