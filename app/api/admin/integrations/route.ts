import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  getVerifiedSession,
  requireBusinessAccess,
  requireSuperAdmin
} from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, forbidden, unauthorized } from "@/lib/errors";
import {
  getIntegrationByKey as getIntegrationDefinitionByKey
} from "@/lib/integrations/integration-definitions";
import { toSafeIntegrationPayload } from "@/lib/integrations/safe";
import {
  canAccessIntegrationForBusinesses,
  getIntegrationByKey,
  listIntegrations,
  saveIntegration,
  toSafeIntegration
} from "@/lib/repository/integrations";

const requestSchema = z.object({
  key: z.string().trim().min(1),
  scope: z.enum(["organization", "business"]),
  config: z.record(z.string(), z.string()).default({}),
  secrets: z.record(z.string(), z.string()).default({}),
  assignedBusinessIds: z.array(z.string()).optional()
});

function mergeRecords(...records: Array<Record<string, string>>) {
  return Object.assign({}, ...records);
}

function readStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function getRequiredMissingFields(
  requiredFields: string[],
  values: Record<string, string>
) {
  return requiredFields.filter((field) => !values[field]?.trim());
}

function validateScope(
  scope: string,
  definitionScope: "organization" | "business" | "both"
) {
  if (definitionScope === "both") {
    return true;
  }

  return scope === definitionScope;
}

function ensureIntegrationAccess(
  session: NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>,
  integration: Awaited<ReturnType<typeof getIntegrationByKey>>
) {
  if (!integration) {
    throw badRequest("Integration not found.");
  }

  if (session.role === "super_admin") {
    return;
  }

  if (
    integration.scope === "organization" ||
    !canAccessIntegrationForBusinesses(integration, session.businessIds)
  ) {
    throw forbidden("You do not have access to this integration.");
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const integrations = await listIntegrations(session.organizationId);
    const visibleIntegrations =
      session.role === "super_admin"
        ? integrations
        : integrations.filter((integration) => {
            if (integration.scope === "organization") {
              return true;
            }

            return canAccessIntegrationForBusinesses(
              integration,
              session.businessIds
            );
          });

    return addSecurityHeaders(
      NextResponse.json({
        integrations: visibleIntegrations.map((integration) =>
          toSafeIntegrationPayload(toSafeIntegration(integration))
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

    const body = requestSchema.parse(await request.json());
    const definition = getIntegrationDefinitionByKey(body.key);

    if (!definition) {
      throw badRequest("Unknown integration.");
    }

    if (!validateScope(body.scope, definition.scope)) {
      throw badRequest("This integration does not support that scope.");
    }

    if (body.scope === "organization") {
      requireSuperAdmin(session);
    } else if (session.role === "admin") {
      const assignedBusinessIds = body.assignedBusinessIds ?? [];

      if (assignedBusinessIds.length === 0) {
        throw badRequest("Choose at least one business for this integration.");
      }

      for (const businessId of assignedBusinessIds) {
        requireBusinessAccess(session, businessId);
      }
    }

    const existing = await getIntegrationByKey(session.organizationId, body.key);
    if (existing) {
      ensureIntegrationAccess(session, existing);
    }

    const mergedValues = mergeRecords(
      readStringRecord(existing?.config),
      body.config,
      body.secrets
    );
    const missingFields = getRequiredMissingFields(
      definition.requiredFields,
      mergedValues
    ).filter((field) => !(existing?.secretKeys ?? []).includes(field));

    if (missingFields.length > 0) {
      throw badRequest(`Missing required fields: ${missingFields.join(", ")}`);
    }

    const integration = await saveIntegration({
      organizationId: session.organizationId,
      key: definition.key,
      name: definition.name,
      scope: body.scope,
      authType: definition.authType,
      config: body.config,
      secrets: body.secrets,
      assignedBusinessIds:
        body.scope === "organization" ? [] : body.assignedBusinessIds ?? [],
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        integration: toSafeIntegrationPayload(toSafeIntegration(integration))
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
