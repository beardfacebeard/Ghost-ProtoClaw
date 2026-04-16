import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireSuperAdmin } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { toSafeIntegrationPayload } from "@/lib/integrations/safe";
import {
  assignIntegrationToBusinesses,
  toSafeIntegration
} from "@/lib/repository/integrations";

const bodySchema = z.object({
  businessIds: z.array(z.string()).default([])
});

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

    requireSuperAdmin(session);

    const body = bodySchema.parse(await request.json());
    const integration = await assignIntegrationToBusinesses(
      context.params.id,
      session.organizationId,
      body.businessIds,
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    );

    return addSecurityHeaders(
      NextResponse.json({
        integration: toSafeIntegrationPayload(toSafeIntegration(integration))
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
