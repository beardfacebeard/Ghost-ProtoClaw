/**
 * Org-wide kill switch.
 *
 * POST   /api/admin/pause-all   { reason? }   → pause the entire organization
 * DELETE /api/admin/pause-all                 → clear the pause
 * GET    /api/admin/pause-all                 → current pause state
 *
 * When paused, every agent run, scheduled workflow, delegation, and
 * master-agent call short-circuits via lib/safety/pause-state.ts.
 * Only org owners can trip the switch; admins with scoped business access
 * cannot pause the whole org (they have the per-business endpoint for that).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireSuperAdmin } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

const pauseBodySchema = z.object({
  reason: z.string().trim().max(500).optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const org = await db.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        globalPaused: true,
        pausedAt: true,
        pausedBy: true,
        pausedReason: true
      }
    });
    return addSecurityHeaders(NextResponse.json({ pause: org ?? null }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    requireSuperAdmin(session);

    const body = pauseBodySchema.parse(await request.json().catch(() => ({})));

    const updated = await db.organization.update({
      where: { id: session.organizationId },
      data: {
        globalPaused: true,
        pausedAt: new Date(),
        pausedBy: session.email ?? session.userId ?? "owner",
        pausedReason: body.reason ?? null
      },
      select: {
        globalPaused: true,
        pausedAt: true,
        pausedBy: true,
        pausedReason: true
      }
    });

    // Audit trail — operator actions on the kill switch are always logged.
    await db.auditEvent.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        actorEmail: session.email,
        eventType: "org_paused",
        entityType: "organization",
        entityId: session.organizationId,
        afterJson: updated as unknown as object,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    });

    return addSecurityHeaders(NextResponse.json({ pause: updated }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    requireSuperAdmin(session);

    const updated = await db.organization.update({
      where: { id: session.organizationId },
      data: {
        globalPaused: false,
        pausedAt: null,
        pausedBy: null,
        pausedReason: null
      },
      select: {
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
        eventType: "org_unpaused",
        entityType: "organization",
        entityId: session.organizationId,
        afterJson: updated as unknown as object,
        ipAddress: request.headers.get("x-forwarded-for")
      }
    });

    return addSecurityHeaders(NextResponse.json({ pause: updated }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
