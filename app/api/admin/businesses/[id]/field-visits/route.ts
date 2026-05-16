/**
 * FieldVisitNote CRUD — shared between code_violation and pre_foreclosure
 * modules (decision #9). Operators log drive-by visits from the
 * unified /distress-leads/visits surface.
 *
 * GET  → list recent visits (filterable by module / record / date).
 * POST → record a new visit. Operator-supplied outcome + signage +
 *        photo URLs + notes. No server-side face-blur per decision #3
 *        (operator-discipline rule only).
 */

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const postSchema = z.object({
  codeViolationRecordId: z.string().optional().nullable(),
  foreclosureRecordId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  outcome: z.enum([
    "no_answer",
    "declined",
    "conversation",
    "leave_behind",
    "vacant_confirmed",
    "occupied_confirmed",
    "unsafe",
    "inaccessible",
    "no_knock_signage"
  ]),
  signageObserved: z
    .array(
      z.enum([
        "no_soliciting",
        "no_trespassing",
        "beware_of_dog",
        "for_sale_by_owner",
        "no_signage_observed"
      ])
    )
    .default([]),
  photos: z.array(z.string().url()).max(8).default([]),
  notes: z.string().max(4000).optional(),
  visitLat: z.number().optional(),
  visitLng: z.number().optional(),
  sourceModule: z
    .enum(["code_violation", "pre_foreclosure", "manual"])
    .default("manual")
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true }
    });
    if (!business) throw notFound("Business not found.");

    const url = new URL(request.url);
    const moduleFilter = url.searchParams.get("module");
    const take = Math.min(200, parseInt(url.searchParams.get("take") ?? "50", 10));

    const visits = await db.fieldVisitNote.findMany({
      where: {
        businessId: business.id,
        deletedAt: null,
        ...(moduleFilter ? { sourceModule: moduleFilter } : {})
      },
      orderBy: { visitedAt: "desc" },
      take,
      include: {
        codeViolationRecord: {
          select: {
            id: true,
            propertyAddress: true,
            city: true,
            state: true,
            severityTier: true,
            scoreSnapshot: true
          }
        },
        foreclosureRecord: {
          select: {
            id: true,
            propertyAddress: true,
            state: true,
            scoreSnapshot: true,
            auctionDate: true
          }
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        visits: visits.map((v) => ({
          ...v,
          visitedAt: v.visitedAt.toISOString(),
          createdAt: v.createdAt.toISOString(),
          updatedAt: v.updatedAt.toISOString(),
          codeViolationRecord: v.codeViolationRecord ?? null,
          foreclosureRecord: v.foreclosureRecord
            ? {
                ...v.foreclosureRecord,
                auctionDate: v.foreclosureRecord.auctionDate
                  ? v.foreclosureRecord.auctionDate.toISOString()
                  : null
              }
            : null
        }))
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const body = postSchema.parse(await request.json());

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true }
    });
    if (!business) throw notFound("Business not found.");

    // At least one of the three FK fields must be set so the visit
    // can be linked back to a record.
    if (!body.codeViolationRecordId && !body.foreclosureRecordId && !body.dealId) {
      throw badRequest(
        "Provide at least one of codeViolationRecordId / foreclosureRecordId / dealId so the visit can be linked to a record."
      );
    }

    const note = await db.fieldVisitNote.create({
      data: {
        businessId: business.id,
        codeViolationRecordId: body.codeViolationRecordId ?? null,
        foreclosureRecordId: body.foreclosureRecordId ?? null,
        dealId: body.dealId ?? null,
        operatorUserId: session.userId ?? null,
        outcome: body.outcome,
        signageObserved: body.signageObserved as unknown as Prisma.InputJsonValue,
        photos: body.photos as unknown as Prisma.InputJsonValue,
        notes: body.notes,
        visitLat: body.visitLat,
        visitLng: body.visitLng,
        sourceModule: body.sourceModule
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        id: note.id,
        message: "Field visit logged."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
