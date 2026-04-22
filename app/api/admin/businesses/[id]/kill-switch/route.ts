import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { updateBusiness } from "@/lib/repository/businesses";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { flattenAllOandaPositions } from "@/lib/trading/flatten-positions";

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

    // Phase 2c: broker-side auto-flatten. Best-effort — we never throw.
    // Any per-instrument failures are returned in the response so the
    // operator can spot-check and manually close anything that didn't
    // clear. Tradovate / IBKR flatten adds in Phase 2d.
    const flatten = await flattenAllOandaPositions(params.id);

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
          cancelledEntries: cancelledEntries.count,
          flattenAttempted: flatten.attempted,
          flattenClosed: flatten.closed,
          flattenFailed: flatten.failed,
          flattenSkipReason: flatten.skipReason ?? null
        }
      }
    });

    const flattenSummary = flatten.skipReason
      ? flatten.skipReason
      : `OANDA: ${flatten.closed}/${flatten.attempted} positions closed${flatten.failed > 0 ? `, ${flatten.failed} failed` : ""}.`;

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        message: `Kill switch fired. Trading mode forced to Research. ${flattenSummary}`,
        expiredApprovals: expiredApprovals.count,
        cancelledEntries: cancelledEntries.count,
        flatten,
        openPositionsNote:
          flatten.failed > 0 || flatten.skipReason
            ? "Some positions may still be open at the broker. Check OANDA (or your broker) directly and close manually. Tradovate + IBKR flatten ships in Phase 2d."
            : "OANDA positions closed. Tradovate + IBKR flatten ships in Phase 2d — if you have positions elsewhere, close manually."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
