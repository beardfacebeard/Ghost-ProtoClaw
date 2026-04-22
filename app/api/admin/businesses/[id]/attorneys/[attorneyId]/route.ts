import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  archiveAttorney,
  updateAttorney,
} from "@/lib/dealhawk/attorney";
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
    attorneyId: string;
  };
};

const updateSchema = z.object({
  state: z.string().min(2).max(2).optional(),
  name: z.string().min(1).optional(),
  firmName: z.string().optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  barNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  licenseVerifiedAt: z
    .union([z.string().datetime(), z.null()])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value === null
          ? null
          : new Date(value)
    ),
});

async function authorize(
  request: NextRequest,
  businessId: string
): Promise<string> {
  const session = await getVerifiedSession(request);
  if (!session?.organizationId) {
    throw unauthorized();
  }
  if (session.role === "admin") {
    requireBusinessAccess(session, businessId);
  }
  const business = await db.business.findFirst({
    where: { id: businessId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!business) {
    throw notFound("Business not found.");
  }
  return session.organizationId;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    await authorize(request, params.id);
    const body = updateSchema.parse(await request.json());
    try {
      const attorney = await updateAttorney({
        attorneyId: params.attorneyId,
        businessId: params.id,
        data: body,
      });
      return addSecurityHeaders(NextResponse.json({ attorney }));
    } catch (err) {
      throw badRequest(
        err instanceof Error ? err.message : "Failed to update attorney profile."
      );
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await authorize(request, params.id);
    try {
      const attorney = await archiveAttorney({
        attorneyId: params.attorneyId,
        businessId: params.id,
      });
      return addSecurityHeaders(
        NextResponse.json({
          attorney,
          message: `Attorney ${attorney.name} archived for ${attorney.state}.`,
        })
      );
    } catch (err) {
      throw badRequest(
        err instanceof Error ? err.message : "Failed to archive attorney profile."
      );
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
