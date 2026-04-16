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
  font: z.string().max(200).optional(),
  colors: z.string().max(500).optional(),
  website: z.string().url().max(500).optional(),
  logoUrl: z.string().max(1000).optional(),
});

/** GET — List ad-clone brands for a business */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    if (!businessId) {
      return addSecurityHeaders(
        NextResponse.json({ error: "businessId is required." }, { status: 400 })
      );
    }

    const brands = await db.adCloneBrand.findMany({
      where: {
        organizationId: session.organizationId,
        businessId,
      },
      orderBy: { createdAt: "desc" },
    });

    return addSecurityHeaders(NextResponse.json({ brands }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** POST — Create an ad-clone brand */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = await request.json();
    const data = createSchema.parse(body);

    const brand = await db.adCloneBrand.create({
      data: {
        organizationId: session.organizationId,
        businessId: data.businessId,
        name: data.name,
        font: data.font || null,
        colors: data.colors || null,
        website: data.website || null,
        logoUrl: data.logoUrl || null,
      },
    });

    return addSecurityHeaders(
      NextResponse.json({ brand }, { status: 201 })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
