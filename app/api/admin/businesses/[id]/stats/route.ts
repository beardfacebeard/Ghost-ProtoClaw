import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { getBusinessById, getBusinessStats } from "@/lib/repository/businesses";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }

    const business = await getBusinessById(params.id, session.organizationId);

    if (!business) {
      throw notFound("Business not found.");
    }

    return addSecurityHeaders(NextResponse.json(await getBusinessStats(params.id)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
