import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";
import { flattenAllOandaPositions } from "@/lib/trading/flatten-positions";
import { flattenAllTradovatePositions } from "@/lib/trading/flatten-tradovate-positions";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * Flatten every open position at every connected broker WITHOUT firing
 * the full kill switch (which also expires pending approvals, cancels
 * activity entries, and forces tradingMode back to research).
 *
 * This is the "close everything now, but keep trading" button on the
 * Forex Operations dashboard. For the nuclear-option flatten-plus-
 * halt, use POST /kill-switch.
 *
 * Research mode → refused. Paper / Live → proceeds with per-broker
 * flatten helpers; per-instrument outcomes surface in the response.
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
      select: { id: true, tradingMode: true }
    });
    if (!business) {
      throw notFound("Business not found.");
    }

    const mode = business.tradingMode ?? "research";
    if (mode === "research") {
      throw badRequest(
        "Trading mode is Research. Nothing to flatten at a broker. This endpoint is paper / live only."
      );
    }

    const [oanda, tradovate] = await Promise.all([
      flattenAllOandaPositions(params.id),
      flattenAllTradovatePositions(params.id)
    ]);

    await db.auditEvent.create({
      data: {
        organizationId: session.organizationId,
        actorEmail: session.email,
        eventType: "forex_desk_flatten_all",
        entityType: "business",
        entityId: params.id,
        beforeJson: {},
        afterJson: {
          tradingMode: mode,
          oandaAttempted: oanda.attempted,
          oandaClosed: oanda.closed,
          oandaFailed: oanda.failed,
          tradovateAttempted: tradovate.attempted,
          tradovateClosed: tradovate.closed,
          tradovateFailed: tradovate.failed,
          oandaSkipReason: oanda.skipReason ?? null,
          tradovateSkipReason: tradovate.skipReason ?? null
        }
      }
    });

    const parts: string[] = [];
    if (oanda.skipReason) parts.push(`OANDA skipped: ${oanda.skipReason}`);
    else if (oanda.attempted > 0)
      parts.push(
        `OANDA ${oanda.closed}/${oanda.attempted} closed${oanda.failed > 0 ? `, ${oanda.failed} failed` : ""}.`
      );
    if (tradovate.skipReason) parts.push(`Tradovate skipped: ${tradovate.skipReason}`);
    else if (tradovate.attempted > 0)
      parts.push(
        `Tradovate ${tradovate.closed}/${tradovate.attempted} closed${tradovate.failed > 0 ? `, ${tradovate.failed} failed` : ""}.`
      );

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        message:
          parts.length > 0
            ? parts.join(" ")
            : "No open broker positions found. Nothing to flatten.",
        oanda,
        tradovate
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
