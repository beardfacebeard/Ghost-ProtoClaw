/**
 * Pre-foreclosure sourcing filters — operator-managed shape that the
 * daily sweep reads from Business.config.preForeclosure.
 *
 * GET → returns current filters + the option catalogs the UI renders.
 * PUT → writes the filters back. Idempotent + additive — leaves the
 *       enabled flag and attestations untouched.
 */

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  allForeclosureStateCodes
} from "@/lib/dealhawk/foreclosure-state-compliance";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const DOCUMENT_TYPES = [
  "NOD",
  "NOTS",
  "LP",
  "JF",
  "NS",
  "TS",
  "ASN"
] as const;

const putSchema = z.object({
  states: z.array(z.string().length(2)).max(51).optional(),
  documentTypes: z.array(z.enum(DOCUMENT_TYPES)).optional(),
  priorityCounties: z.array(z.string()).max(50).optional(),
  dailyIngestCap: z.number().int().min(0).max(2000).optional()
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, name: true, config: true }
    });
    if (!business) throw notFound("Business not found.");

    const cfg = business.config as Record<string, unknown> | null;
    const pre = cfg?.preForeclosure as Record<string, unknown> | undefined;
    const filters = {
      enabled: pre?.enabled === true,
      states: Array.isArray(pre?.states) ? (pre?.states as string[]) : [],
      documentTypes: Array.isArray(pre?.documentTypes)
        ? (pre?.documentTypes as string[])
        : ["NOD", "LP"],
      priorityCounties: Array.isArray(pre?.priorityCounties)
        ? (pre?.priorityCounties as string[])
        : [],
      dailyIngestCap:
        typeof pre?.dailyIngestCap === "number" ? (pre?.dailyIngestCap as number) : 200
    };

    return addSecurityHeaders(
      NextResponse.json({
        businessId: business.id,
        businessName: business.name,
        filters,
        catalogs: {
          allStateCodes: allForeclosureStateCodes(),
          documentTypes: DOCUMENT_TYPES.map((t) => ({
            value: t,
            label:
              t === "NOD"
                ? "Notice of Default (NOD)"
                : t === "NOTS"
                  ? "Notice of Trustee Sale (NOTS)"
                  : t === "LP"
                    ? "Lis Pendens (LP)"
                    : t === "JF"
                      ? "Judgment of Foreclosure"
                      : t === "NS"
                        ? "Notice of Sale"
                        : t === "TS"
                          ? "Sheriff's Sale"
                          : "Auction Scheduled"
          }))
        }
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

    const body = putSchema.parse(await request.json());

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, config: true }
    });
    if (!business) throw notFound("Business not found.");

    const existingConfig =
      business.config && typeof business.config === "object" && !Array.isArray(business.config)
        ? (business.config as Record<string, unknown>)
        : {};
    const existingPre =
      existingConfig.preForeclosure && typeof existingConfig.preForeclosure === "object" && !Array.isArray(existingConfig.preForeclosure)
        ? (existingConfig.preForeclosure as Record<string, unknown>)
        : {};

    const newPre: Record<string, unknown> = {
      ...existingPre,
      ...(body.states !== undefined ? { states: body.states.map((s) => s.toUpperCase()) } : {}),
      ...(body.documentTypes !== undefined ? { documentTypes: body.documentTypes } : {}),
      ...(body.priorityCounties !== undefined ? { priorityCounties: body.priorityCounties } : {}),
      ...(body.dailyIngestCap !== undefined ? { dailyIngestCap: body.dailyIngestCap } : {})
    };

    const newConfig = { ...existingConfig, preForeclosure: newPre };
    await db.business.update({
      where: { id: params.id },
      data: { config: newConfig as Prisma.InputJsonValue }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        message: "Pre-foreclosure filters saved. Next sweep applies the new filters."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
