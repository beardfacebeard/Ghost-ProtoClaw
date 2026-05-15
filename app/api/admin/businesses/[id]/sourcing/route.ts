/**
 * Dealhawk sourcing buy-box config.
 *
 * GET  → return the current buy-box JSON.
 * PUT  → replace the buy-box JSON (zod-validated).
 * POST → trigger a manual sweep right now (operator's "Run sweep now"
 *        button on the buy-box page).
 *
 * Routes through the per-business pause/scope guards already used by
 * sibling routes under /api/admin/businesses/[id]/*.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const buyBoxSchema = z.object({
  markets: z.array(z.string().trim().min(1)).max(50).optional(),
  priceMin: z.number().int().min(0).optional(),
  priceMax: z.number().int().min(0).optional(),
  propertyTypes: z
    .array(
      z.enum([
        "sfr",
        "multi_family",
        "condo",
        "townhouse",
        "mobile",
        "land",
        "commercial"
      ])
    )
    .optional(),
  distressSignals: z
    .array(
      z.enum([
        "pre_foreclosure",
        "tax_delinquent",
        "probate",
        "divorce",
        "code_violation",
        "vacancy",
        "absentee",
        "eviction",
        "expired_listing",
        "delisted_underwater"
      ])
    )
    .optional(),
  minMotivationScore: z.number().int().min(0).max(100).optional(),
  dailyIngestCap: z.number().int().min(1).max(1000).optional(),
  sweepHourLocal: z.number().int().min(0).max(23).optional()
});

async function loadBusiness(id: string, organizationId: string) {
  return db.business.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true, sourcingBuyBox: true }
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await loadBusiness(params.id, session.organizationId);
    if (!business) throw notFound("Business not found.");

    return addSecurityHeaders(
      NextResponse.json({
        buyBox: business.sourcingBuyBox ?? null,
        businessId: business.id,
        businessName: business.name
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await loadBusiness(params.id, session.organizationId);
    if (!business) throw notFound("Business not found.");

    const body = buyBoxSchema.parse(await request.json());

    const updated = await db.business.update({
      where: { id: params.id },
      data: { sourcingBuyBox: body as object },
      select: { sourcingBuyBox: true }
    });

    return addSecurityHeaders(NextResponse.json({ buyBox: updated.sourcingBuyBox }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await loadBusiness(params.id, session.organizationId);
    if (!business) throw notFound("Business not found.");

    const { runSourcingSweepForBusiness } = await import(
      "@/lib/dealhawk/sourcing-sweep"
    );
    const result = await runSourcingSweepForBusiness(business.id);

    return addSecurityHeaders(NextResponse.json({ result }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
