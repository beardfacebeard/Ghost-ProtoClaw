/**
 * Per-business kill switch.
 *
 * POST   /api/admin/businesses/[id]/pause   { reason? }  → pause one business
 * DELETE /api/admin/businesses/[id]/pause                → unpause
 * GET    /api/admin/businesses/[id]/pause                → current state
 *
 * Scoped admins with access to the business can use this without owning
 * the entire org. The org-wide kill switch lives at /api/admin/pause-all.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const pauseBodySchema = z.object({
  reason: z.string().trim().max(500).optional()
});

async function loadBusinessPause(
  businessId: string,
  organizationId: string
) {
  return db.business.findFirst({
    where: { id: businessId, organizationId },
    select: {
      id: true,
      name: true,
      globalPaused: true,
      pausedAt: true,
      pausedBy: true,
      pausedReason: true
    }
  });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await loadBusinessPause(params.id, session.organizationId);
    if (!business) throw notFound("Business not found.");
    return addSecurityHeaders(NextResponse.json({ pause: business }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const body = pauseBodySchema.parse(await request.json().catch(() => ({})));

    const existing = await loadBusinessPause(params.id, session.organizationId);
    if (!existing) throw notFound("Business not found.");

    const updated = await db.business.update({
      where: { id: params.id },
      data: {
        globalPaused: true,
        pausedAt: new Date(),
        pausedBy: session.email ?? session.userId ?? "admin",
        pausedReason: body.reason ?? null
      },
      select: {
        id: true,
        name: true,
        globalPaused: true,
        pausedAt: true,
        pausedBy: true,
        pausedReason: true
      }
    });

    await db.auditEvent.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        actorEmail: session.email,
        eventType: "business_paused",
        entityType: "business",
        entityId: params.id,
        beforeJson: existing as unknown as object,
        afterJson: updated as unknown as object,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    });

    return addSecurityHeaders(NextResponse.json({ pause: updated }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const existing = await loadBusinessPause(params.id, session.organizationId);
    if (!existing) throw notFound("Business not found.");

    const updated = await db.business.update({
      where: { id: params.id },
      data: {
        globalPaused: false,
        pausedAt: null,
        pausedBy: null,
        pausedReason: null
      },
      select: {
        id: true,
        name: true,
        globalPaused: true,
        pausedAt: true,
        pausedBy: true,
        pausedReason: true
      }
    });

    await db.auditEvent.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        actorEmail: session.email,
        eventType: "business_unpaused",
        entityType: "business",
        entityId: params.id,
        beforeJson: existing as unknown as object,
        afterJson: updated as unknown as object,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    });

    return addSecurityHeaders(NextResponse.json({ pause: updated }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
