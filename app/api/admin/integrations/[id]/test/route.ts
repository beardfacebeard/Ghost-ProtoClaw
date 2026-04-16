import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import {
  apiErrorResponse,
  forbidden,
  notFound,
  unauthorized
} from "@/lib/errors";
import {
  canAccessIntegrationForBusinesses,
  getIntegrationById,
  testIntegrationConnection
} from "@/lib/repository/integrations";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const session = await getVerifiedSession(request);

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

    if (
      session.role !== "super_admin" &&
      (integration.scope === "organization" ||
        !canAccessIntegrationForBusinesses(integration, session.businessIds))
    ) {
      throw forbidden("You do not have access to this integration.");
    }

    const result = await testIntegrationConnection(
      integration.id,
      session.organizationId
    );

    return addSecurityHeaders(
      NextResponse.json({
        success: result.success,
        message: result.success
          ? result.details || "Connection successful."
          : result.error || "Connection failed."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
