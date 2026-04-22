import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const VALID_STATUSES = new Set([
  "lead",
  "contacted",
  "qualified",
  "under_contract",
  "assigned",
  "closed",
  "dead",
]);

const VALID_EXITS = new Set([
  "wholesale",
  "brrrr",
  "flip",
  "sub_to",
  "novation",
  "wrap",
  "lease_option",
  "contract_for_deed",
  "decline",
]);

/**
 * GET — list deals for a business, with optional filters.
 *
 * Query params:
 *   status           — comma-separated pipeline stages to include
 *   state            — 2-letter USPS code to filter by propertyState
 *   exit             — comma-separated recommendedExit values
 *   minMotivation    — integer 0-100, filters motivationScore >= N
 *   limit            — cap on rows returned (default 250, max 500)
 *
 * Each row includes a signalCount aggregate so the pipeline UI can show
 * signal-stack density without loading every signal blob.
 */
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

    const url = request.nextUrl;
    const statusParam = url.searchParams.get("status");
    const stateParam = url.searchParams.get("state");
    const exitParam = url.searchParams.get("exit");
    const minMotivationParam = url.searchParams.get("minMotivation");
    const limitParam = url.searchParams.get("limit");

    const where: Prisma.DealWhereInput = { businessId: params.id };

    if (statusParam) {
      const statuses = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => VALID_STATUSES.has(s));
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    if (stateParam) {
      const state = stateParam.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(state)) {
        where.propertyState = state;
      }
    }

    if (exitParam) {
      const exits = exitParam
        .split(",")
        .map((e) => e.trim())
        .filter((e) => VALID_EXITS.has(e));
      if (exits.length > 0) {
        where.recommendedExit = { in: exits };
      }
    }

    if (minMotivationParam) {
      const min = Number.parseInt(minMotivationParam, 10);
      if (Number.isFinite(min) && min >= 0 && min <= 100) {
        where.motivationScore = { gte: min };
      }
    }

    const limit = Math.min(
      500,
      Math.max(1, Number.parseInt(limitParam ?? "250", 10) || 250)
    );

    const deals = await db.deal.findMany({
      where,
      take: limit,
      orderBy: [{ motivationScore: "desc" }, { updatedAt: "desc" }],
      include: {
        _count: {
          select: { signals: true },
        },
      },
    });

    return addSecurityHeaders(
      NextResponse.json({
        deals: deals.map((d) => ({
          ...d,
          signalCount: d._count.signals,
          _count: undefined,
        })),
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
