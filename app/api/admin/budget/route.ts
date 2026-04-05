import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const budgetSchema = z.object({
  monthlyLimitUsd: z.number().min(1).max(100000),
  alertThresholdPct: z.number().int().min(0).max(100).default(80),
  hardStop: z.boolean().default(false),
  enabled: z.boolean().default(true),
  businessId: z.string().optional()
});

/**
 * GET /api/admin/budget — fetch current budget config
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const configs = await db.budgetConfig.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" }
    });

    return addSecurityHeaders(NextResponse.json({ configs }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * POST /api/admin/budget — create or update budget config
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = budgetSchema.parse(await request.json());

    // Find existing config or create new one
    const existing = await db.budgetConfig.findFirst({
      where: {
        organizationId: session.organizationId,
        businessId: body.businessId ?? null
      }
    });

    const config = existing
      ? await db.budgetConfig.update({
          where: { id: existing.id },
          data: {
            monthlyLimitUsd: body.monthlyLimitUsd,
            alertThresholdPct: body.alertThresholdPct,
            hardStop: body.hardStop,
            enabled: body.enabled
          }
        })
      : await db.budgetConfig.create({
          data: {
            organizationId: session.organizationId,
            businessId: body.businessId ?? null,
            monthlyLimitUsd: body.monthlyLimitUsd,
            alertThresholdPct: body.alertThresholdPct,
            hardStop: body.hardStop,
            enabled: body.enabled
          }
        });

    return addSecurityHeaders(NextResponse.json({ config }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
