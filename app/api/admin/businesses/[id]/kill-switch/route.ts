import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { updateBusiness } from "@/lib/repository/businesses";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * Emergency kill switch for the Forex Research & Execution Desk.
 *
 * Phase 2b semantics (intentionally conservative):
 * 1. Force the business's tradingMode to "research" — every agent stops
 *    being able to propose new orders immediately because the Risk Gate
 *    rejects in research mode.
 * 2. Expire every pending ApprovalRequest with actionType "place_forex_order"
 *    on this business. If the operator had orders waiting for a click,
 *    those auto-close with status "expired" so they can't fire later.
 * 3. Mark every pending / running forex_order ActivityEntry as "cancelled".
 * 4. Log an AuditEvent with the actor so super-admins can see who hit it.
 *
 * Phase 2c will add the broker-side flatten (close every open OANDA /
 * Tradovate / IBKR position) — this endpoint already returns an
 * "open_positions_note" string the client can surface.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
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
      select: { id: true, name: true }
    });

    if (!business) {
      throw notFound("Business not found.");
    }

    const now = new Date();

    const [expiredApprovals, cancelledEntries] = await db.$transaction([
      db.approvalRequest.updateMany({
        where: {
          businessId: params.id,
          actionType: "place_forex_order",
          status: "pending"
        },
        data: {
          status: "expired",
          reason: "Kill switch fired by operator.",
          reviewedAt: now,
          reviewedBy: session.email
        }
      }),
      db.activityEntry.updateMany({
        where: {
          businessId: params.id,
          type: "forex_order",
          status: { in: ["pending", "running"] }
        },
        data: {
          status: "cancelled"
        }
      })
    ]);

    await updateBusiness(params.id, session.organizationId, {
      tradingMode: "research",
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    await db.auditEvent.create({
      data: {
        organizationId: session.organizationId,
        actorEmail: session.email,
        eventType: "forex_desk_kill_switch_fired",
        entityType: "business",
        entityId: params.id,
        beforeJson: {},
        afterJson: {
          tradingMode: "research",
          expiredApprovals: expiredApprovals.count,
          cancelledEntries: cancelledEntries.count
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        message:
          "Kill switch fired. Trading mode forced to Research. Pending forex approvals expired. Forex activity entries cancelled. Existing broker positions are NOT automatically flattened in Phase 2b — open a broker session and flatten manually if needed.",
        expiredApprovals: expiredApprovals.count,
        cancelledEntries: cancelledEntries.count,
        openPositionsNote:
          "The Phase 2b kill switch does not auto-flatten existing broker positions. Check OANDA (or your broker) directly and close manually if you want the account fully flat. Phase 2c will auto-close via the broker API."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
