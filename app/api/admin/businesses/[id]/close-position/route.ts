import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";
import {
  closeOandaPositionNow,
  closeTradovatePositionNow
} from "@/lib/trading/close-position";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const bodySchema = z.object({
  broker: z.enum(["oanda", "tradovate"]),
  instrument: z.string().trim().min(1),
  side: z.enum(["long", "short", "both"]).optional(),
  units: z.string().optional(),
  reason: z.string().trim().min(1, "A reason is required.")
});

/**
 * Operator-driven close-position from the Forex Operations dashboard.
 *
 * tradingMode behavior mirrors the agent tools:
 *   - research → refused
 *   - paper    → closed immediately against the broker demo endpoint
 *   - live_approval → queued as a close_* approval (must click Approve
 *     in /admin/approvals to actually fire)
 *
 * Keeps the operator inside the same gates the agent tools respect —
 * a live close is still a broker-side action and goes through the
 * approval layer.
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

    const body = bodySchema.parse(await request.json());

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
        "Trading mode is Research. No broker actions can fire. Upgrade to Paper or Live first."
      );
    }

    const side = body.side ?? "both";

    // Live-mode closes go through the approval queue for parity with
    // agent-initiated closes. The operator sees it in /admin/approvals
    // and clicks Approve to fire.
    if (mode === "live_approval") {
      const actionType =
        body.broker === "tradovate"
          ? "close_futures_position"
          : "close_forex_position";
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const activityEntry = await db.activityEntry.create({
        data: {
          businessId: params.id,
          type: "forex_order",
          title: `CLOSE ${body.instrument} · ${side} · operator-initiated`,
          detail: body.reason,
          status: "pending",
          metadata: {
            action: "close_position",
            broker: body.broker,
            instrument: body.instrument,
            side,
            units: body.units ?? "ALL",
            reason: body.reason,
            initiatedBy: "operator",
            operatorEmail: session.email,
            tradingMode: mode,
            submittedAt: new Date().toISOString()
          }
        }
      });
      const approval = await db.approvalRequest.create({
        data: {
          businessId: params.id,
          actionType,
          actionDetail: {
            broker: body.broker,
            instrument: body.instrument,
            side,
            units: body.units ?? "ALL",
            reason: body.reason,
            initiatedBy: "operator",
            operatorEmail: session.email,
            activityEntryId: activityEntry.id
          },
          status: "pending",
          expiresAt
        }
      });
      return addSecurityHeaders(
        NextResponse.json({
          mode: "queued",
          approvalId: approval.id,
          message:
            "Live close queued to Approvals (2h expiry). Click Approve in /admin/approvals to fire."
        })
      );
    }

    // Paper mode — close immediately.
    const result =
      body.broker === "oanda"
        ? await closeOandaPositionNow({
            businessId: params.id,
            instrument: body.instrument,
            side,
            units: body.units,
            liveMode: false
          })
        : await closeTradovatePositionNow({
            businessId: params.id,
            instrument: body.instrument,
            liveMode: false
          });

    await db.activityEntry.create({
      data: {
        businessId: params.id,
        type: "forex_order",
        title: `[PAPER CLOSE] ${body.instrument} · ${side} · operator-initiated`,
        detail: body.reason,
        status: result.ok ? "completed" : "failed",
        metadata: {
          action: "close_position",
          broker: body.broker,
          instrument: body.instrument,
          side,
          units: body.units ?? "ALL",
          reason: body.reason,
          initiatedBy: "operator",
          operatorEmail: session.email,
          tradingMode: mode,
          brokerResponse: result.brokerResponse ?? null,
          detail: result.detail
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        mode: "paper",
        ok: result.ok,
        detail: result.detail
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
