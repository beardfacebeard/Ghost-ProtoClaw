import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(200),
  productId: z.string().optional(),
  brandId: z.string().optional(),
});

/** GET — List ad-clone projects for a business */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const status = url.searchParams.get("status");
    const productId = url.searchParams.get("productId");
    const brandId = url.searchParams.get("brandId");

    if (!businessId) {
      return addSecurityHeaders(
        NextResponse.json({ error: "businessId is required." }, { status: 400 })
      );
    }

    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
      businessId,
    };
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (brandId) where.brandId = brandId;

    const projects = await db.adCloneProject.findMany({
      where,
      include: { product: true, brand: true },
      orderBy: { createdAt: "desc" },
    });

    return addSecurityHeaders(NextResponse.json({ projects }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** POST — Create an ad-clone project */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = await request.json();
    const data = createSchema.parse(body);

    const project = await db.adCloneProject.create({
      data: {
        organizationId: session.organizationId,
        businessId: data.businessId,
        name: data.name,
        productId: data.productId || null,
        brandId: data.brandId || null,
      },
      include: { product: true, brand: true },
    });

    return addSecurityHeaders(
      NextResponse.json({ project }, { status: 201 })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
