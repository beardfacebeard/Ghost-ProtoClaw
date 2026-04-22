import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { updateBusiness } from "@/lib/repository/businesses";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { flattenAllOandaPositions } from "@/lib/trading/flatten-positions";
import { flattenAllTradovatePositions } from "@/lib/trading/flatten-tradovate-positions";

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

    // Broker-side auto-flatten across every connected broker. Run in
    // parallel; each helper is best-effort and never throws. Per-broker
    // outcomes surface in the response so the operator can spot-check
    // and manually close anything that didn't clear.
    const [oandaFlatten, tradovateFlatten] = await Promise.all([
      flattenAllOandaPositions(params.id),
      flattenAllTradovatePositions(params.id)
    ]);
    const flatten = {
      oanda: oandaFlatten,
      tradovate: tradovateFlatten,
      attempted: oandaFlatten.attempted + tradovateFlatten.attempted,
      closed: oandaFlatten.closed + tradovateFlatten.closed,
      failed: oandaFlatten.failed + tradovateFlatten.failed,
      skipReason: null as string | null
    };

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

    const flattenSummaryParts: string[] = [];
    if (oandaFlatten.skipReason) {
      flattenSummaryParts.push(`OANDA skipped (${oandaFlatten.skipReason}).`);
    } else if (oandaFlatten.attempted > 0) {
      flattenSummaryParts.push(
        `OANDA: ${oandaFlatten.closed}/${oandaFlatten.attempted} closed${oandaFlatten.failed > 0 ? `, ${oandaFlatten.failed} failed` : ""}.`
      );
    }
    if (tradovateFlatten.skipReason) {
      flattenSummaryParts.push(`Tradovate skipped (${tradovateFlatten.skipReason}).`);
    } else if (tradovateFlatten.attempted > 0) {
      flattenSummaryParts.push(
        `Tradovate: ${tradovateFlatten.closed}/${tradovateFlatten.attempted} closed${tradovateFlatten.failed > 0 ? `, ${tradovateFlatten.failed} failed` : ""}.`
      );
    }
    const flattenSummary =
      flattenSummaryParts.length > 0
        ? flattenSummaryParts.join(" ")
        : "No open broker positions to flatten.";

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        message: `Kill switch fired. Trading mode forced to Research. ${flattenSummary}`,
        expiredApprovals: expiredApprovals.count,
        cancelledEntries: cancelledEntries.count,
        flatten,
        openPositionsNote:
          flatten.failed > 0
            ? "Some positions may still be open at one or more brokers. Check OANDA / Tradovate directly and close manually where the flatten reported 'failed'. IBKR flatten lands in a separate broker-integration phase."
            : "OANDA + Tradovate positions closed. IBKR flatten lands in a separate broker-integration phase — if you have positions there, close manually."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
