import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  getSessionFromHeaders,
  requireBusinessAccess,
  requireSuperAdmin
} from "@/lib/auth/rbac";
import {
  apiErrorResponse,
  badRequest,
  forbidden,
  notFound,
  unauthorized
} from "@/lib/errors";
import {
  getIntegrationByKey as getIntegrationDefinitionByKey
} from "@/lib/integrations/integration-definitions";
import { toSafeIntegrationPayload } from "@/lib/integrations/safe";
import {
  canAccessIntegrationForBusinesses,
  disconnectIntegration,
  getIntegrationById,
  saveIntegration,
  toSafeIntegration
} from "@/lib/repository/integrations";

const updateSchema = z.object({
  scope: z.enum(["organization", "business"]).optional(),
  config: z.record(z.string(), z.string()).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
  assignedBusinessIds: z.array(z.string()).optional()
});

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

function ensureAccess(
  session: NonNullable<ReturnType<typeof getSessionFromHeaders>>,
  integration: NonNullable<Awaited<ReturnType<typeof getIntegrationById>>>
) {
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

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const integration = await getIntegrationById(
      context.params.id,
      session.organizationId
    );

    if (!integration) {
      throw notFound("Integration not found.");
    }

    ensureAccess(session, integration);

    return addSecurityHeaders(
      NextResponse.json({
        integration: toSafeIntegrationPayload(toSafeIntegration(integration))
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
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const integration = await getIntegrationById(
      context.params.id,
      session.organizationId
    );

    if (!integration) {
      throw notFound("Integration not found.");
    }

    ensureAccess(session, integration);

    const body = updateSchema.parse(await request.json());
    const definition = getIntegrationDefinitionByKey(integration.key);

    if (!definition) {
      throw badRequest("Unknown integration.");
    }

    const nextScope = body.scope ?? integration.scope;

    if (nextScope === "organization") {
      requireSuperAdmin(session);
    }

    const nextAssignedBusinessIds =
      nextScope === "organization"
        ? []
        : body.assignedBusinessIds ?? integration.assignedBusinessIds;

    if (session.role === "admin") {
      for (const businessId of nextAssignedBusinessIds) {
        requireBusinessAccess(session, businessId);
      }
    }

    const mergedValues = {
      ...readStringRecord(integration.config),
      ...(body.config ?? {}),
      ...(body.secrets ?? {})
    };
    const missingFields = definition.requiredFields.filter(
      (field) => !mergedValues[field]?.trim() && !integration.secretKeys.includes(field)
    );

    if (missingFields.length > 0) {
      throw badRequest(`Missing required fields: ${missingFields.join(", ")}`);
    }

    const saved = await saveIntegration({
      organizationId: session.organizationId,
      key: integration.key,
      name: integration.name,
      scope: nextScope,
      authType: integration.authType,
      config: body.config ?? {},
      secrets: body.secrets ?? {},
      assignedBusinessIds: nextAssignedBusinessIds,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        integration: toSafeIntegrationPayload(toSafeIntegration(saved))
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
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const integration = await getIntegrationById(
      context.params.id,
      session.organizationId
    );

    if (!integration) {
      throw notFound("Integration not found.");
    }

    ensureAccess(session, integration);

    await disconnectIntegration(context.params.id, session.organizationId, {
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
