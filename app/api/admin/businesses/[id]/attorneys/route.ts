import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { createAttorney, listAttorneys } from "@/lib/dealhawk/attorney";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized,
} from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const createSchema = z.object({
  state: z.string().min(2).max(2),
  name: z.string().min(1),
  firmName: z.string().optional().nullable(),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  barNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) {
      throw unauthorized();
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }
    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!business) {
      throw notFound("Business not found.");
    }
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "true";
    const attorneys = await listAttorneys(params.id, { includeArchived });
    return addSecurityHeaders(NextResponse.json({ attorneys }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) {
      throw unauthorized();
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }
    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, organizationId: true },
    });
    if (!business) {
      throw notFound("Business not found.");
    }
    const body = createSchema.parse(await request.json());
    try {
      const attorney = await createAttorney({
        businessId: business.id,
        organizationId: business.organizationId,
        data: body,
      });
      return addSecurityHeaders(
        NextResponse.json({
          attorney,
          message: `Attorney on file for ${attorney.state}: ${attorney.name}.`,
        })
      );
    } catch (err) {
      throw badRequest(
        err instanceof Error ? err.message : "Failed to create attorney profile."
      );
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
