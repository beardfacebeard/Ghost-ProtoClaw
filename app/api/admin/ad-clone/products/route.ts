import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

/** GET — List ad-clone products for a business */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    if (!businessId) {
      return addSecurityHeaders(
        NextResponse.json({ error: "businessId is required." }, { status: 400 })
      );
    }

    const products = await db.adCloneProduct.findMany({
      where: {
        organizationId: session.organizationId,
        businessId,
      },
      orderBy: { createdAt: "desc" },
    });

    return addSecurityHeaders(NextResponse.json({ products }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** POST — Create an ad-clone product */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const body = await request.json();
    const data = createSchema.parse(body);

    const product = await db.adCloneProduct.create({
      data: {
        organizationId: session.organizationId,
        businessId: data.businessId,
        name: data.name,
        notes: data.notes || null,
      },
    });

    return addSecurityHeaders(
      NextResponse.json({ product }, { status: 201 })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
