import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).nullable().optional(),
  image: z.string().nullable().optional(),
});

/** PATCH — Update an ad-clone product */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const existing = await db.adCloneProduct.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });
    if (!existing) throw notFound("Product not found.");

    const body = await request.json();
    const data = updateSchema.parse(body);

    const product = await db.adCloneProduct.update({
      where: { id: params.id },
      data,
    });

    return addSecurityHeaders(NextResponse.json({ product }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** DELETE — Delete an ad-clone product (only if no linked projects) */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const existing = await db.adCloneProduct.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: { _count: { select: { adCloneProjects: true } } },
    });
    if (!existing) throw notFound("Product not found.");

    if (existing._count.adCloneProjects > 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Cannot delete product that has linked projects." },
          { status: 409 }
        )
      );
    }

    await db.adCloneProduct.delete({ where: { id: params.id } });

    return addSecurityHeaders(
      NextResponse.json({ message: "Product deleted." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
