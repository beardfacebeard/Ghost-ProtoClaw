import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, forbidden, unauthorized } from "@/lib/errors";
import { activateBusiness } from "@/lib/repository/businesses";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    // Only super_admin or admins with access to this business
    if (
      session.role !== "super_admin" &&
      !session.businessIds.includes(params.id)
    ) {
      throw forbidden("You do not have access to this business.");
    }

    const activated = await activateBusiness(
      params.id,
      session.organizationId,
      {
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    );

    return addSecurityHeaders(
      NextResponse.json({ business: activated })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
