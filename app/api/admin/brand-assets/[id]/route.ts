import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  category: z
    .enum([
      "logo",
      "brand_guide",
      "product_image",
      "marketing",
      "document",
      "general"
    ])
    .optional(),
  description: z.string().trim().max(1000).optional(),
  fileName: z.string().trim().min(1).max(200).optional()
});

type RouteContext = { params: { id: string } };

async function loadScoped(
  id: string,
  organizationId: string
) {
  return db.brandAsset.findFirst({
    where: { id, organizationId }
  });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const asset = await loadScoped(params.id, session.organizationId);
    if (!asset) throw notFound("Brand asset not found.");
    if (session.role === "admin") {
      requireBusinessAccess(session, asset.businessId);
    }

    const body = bodySchema.parse(await request.json());
    if (Object.keys(body).length === 0) {
      return addSecurityHeaders(NextResponse.json({ asset }));
    }

    const updated = await db.brandAsset.update({
      where: { id: asset.id },
      data: {
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.fileName !== undefined ? { fileName: body.fileName } : {})
      }
    });

    return addSecurityHeaders(NextResponse.json({ asset: updated }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const asset = await loadScoped(params.id, session.organizationId);
    if (!asset) throw notFound("Brand asset not found.");
    if (session.role === "admin") {
      requireBusinessAccess(session, asset.businessId);
    }

    await db.brandAsset.delete({ where: { id: asset.id } });
    return addSecurityHeaders(NextResponse.json({ ok: true }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
