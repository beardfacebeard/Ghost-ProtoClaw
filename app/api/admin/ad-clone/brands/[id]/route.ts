import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  font: z.string().max(200).nullable().optional(),
  colors: z.string().max(500).nullable().optional(),
  website: z.string().url().max(500).nullable().optional(),
  logoUrl: z.string().max(1000).nullable().optional(),
});

/** PATCH — Update an ad-clone brand */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await db.adCloneBrand.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });
    if (!existing) throw notFound("Brand not found.");

    const body = await request.json();
    const data = updateSchema.parse(body);

    const brand = await db.adCloneBrand.update({
      where: { id: params.id },
      data,
    });

    return addSecurityHeaders(NextResponse.json({ brand }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** DELETE — Delete an ad-clone brand (only if no linked projects) */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await db.adCloneBrand.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: { _count: { select: { adCloneProjects: true } } },
    });
    if (!existing) throw notFound("Brand not found.");

    if (existing._count.adCloneProjects > 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Cannot delete brand that has linked projects." },
          { status: 409 }
        )
      );
    }

    await db.adCloneBrand.delete({ where: { id: params.id } });

    return addSecurityHeaders(
      NextResponse.json({ message: "Brand deleted." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
