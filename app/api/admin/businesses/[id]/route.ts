import { NextRequest, NextResponse } from "next/server";

import { businessUpdateApiSchema } from "@/components/admin/businesses/schema";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  archiveBusiness,
  deleteBusiness,
  getBusinessById,
  getBusinessStats,
  updateBusiness
} from "@/lib/repository/businesses";
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

    const stats = await getBusinessStats(params.id);

    return addSecurityHeaders(
      NextResponse.json({
        business,
        stats
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }

    const body = businessUpdateApiSchema.parse(await request.json());
    const updated = await updateBusiness(params.id, session.organizationId, {
      ...body,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        business: updated
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }

    const permanent =
      request.nextUrl.searchParams.get("permanent") === "true";

    const auditContext = {
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    };

    if (permanent) {
      await deleteBusiness(params.id, session.organizationId, auditContext);
    } else {
      await archiveBusiness(params.id, session.organizationId, auditContext);
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        action: permanent ? "deleted" : "archived"
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
