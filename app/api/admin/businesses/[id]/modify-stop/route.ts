import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";
import { modifyOandaStopNow } from "@/lib/trading/modify-stop";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const bodySchema = z.object({
  broker: z.enum(["oanda"]),
  instrument: z.string().trim().min(1),
  direction: z.enum(["long", "short"]),
  newStopPrice: z.number().positive(),
  newTakeProfitPrice: z.number().positive().nullable().optional(),
  reason: z.string().trim().min(1, "A reason is required.")
});

/**
 * Operator-driven modify-stop from the Forex Operations dashboard.
 *
 * Tradovate modify-stop is not yet implemented — the bracket structure
 * is non-trivial and a separate phase. For now the endpoint only
 * accepts broker=oanda.
 *
 * Mode gates match close-position: research refuses, paper modifies
 * immediately, live queues a modify_forex_order approval.
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
        "Trading mode is Research. Stop modifications fire at the broker and need Paper or Live mode."
      );
    }

    const intent = {
      action: "modify_stop",
      broker: body.broker,
      instrument: body.instrument,
      direction: body.direction,
      newStopPrice: body.newStopPrice,
      newTakeProfitPrice: body.newTakeProfitPrice ?? null,
      reason: body.reason,
      initiatedBy: "operator",
      operatorEmail: session.email,
      tradingMode: mode,
      submittedAt: new Date().toISOString()
    };

    if (mode === "live_approval") {
      const activityEntry = await db.activityEntry.create({
        data: {
          businessId: params.id,
          type: "forex_order",
          title: `MODIFY STOP ${body.instrument} (${body.direction}) → ${body.newStopPrice.toFixed(5)}`,
          detail: body.reason,
          status: "pending",
          metadata: intent
        }
      });
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);
      const approval = await db.approvalRequest.create({
        data: {
          businessId: params.id,
          actionType: "modify_forex_order",
          actionDetail: { ...intent, activityEntryId: activityEntry.id },
          status: "pending",
          expiresAt
        }
      });
      return addSecurityHeaders(
        NextResponse.json({
          mode: "queued",
          approvalId: approval.id,
          message:
            "Live modify queued to Approvals (2h expiry). Click Approve in /admin/approvals to fire."
        })
      );
    }

    // Paper — modify immediately.
    const result = await modifyOandaStopNow({
      businessId: params.id,
      instrument: body.instrument,
      direction: body.direction,
      newStopPrice: body.newStopPrice,
      newTakeProfitPrice: body.newTakeProfitPrice ?? null,
      liveMode: false
    });

    await db.activityEntry.create({
      data: {
        businessId: params.id,
        type: "forex_order",
        title: `[PAPER MODIFY] ${body.instrument} (${body.direction}) → ${body.newStopPrice.toFixed(5)}`,
        detail: body.reason,
        status: result.ok ? "completed" : "failed",
        metadata: {
          ...intent,
          modifiedCount: result.modified,
          errors: result.errors,
          detail: result.detail
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        mode: "paper",
        ok: result.ok,
        modified: result.modified,
        errors: result.errors,
        detail: result.detail
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
