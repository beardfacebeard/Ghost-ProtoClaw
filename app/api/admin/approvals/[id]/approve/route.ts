import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  approveRequest,
  getApprovalById
} from "@/lib/repository/approvals";
import { fireApprovedForexOrder } from "@/lib/trading/fire-approved-order";
import { fireApprovedFuturesOrder } from "@/lib/trading/fire-approved-futures-order";
import {
  closeOandaPositionNow,
  closeTradovatePositionNow
} from "@/lib/trading/close-position";
import { modifyOandaStopNow } from "@/lib/trading/modify-stop";
import { db } from "@/lib/db";

const bodySchema = z.object({
  reason: z.string().trim().max(500).optional()
});

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getApprovalById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Approval request not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    const body = bodySchema.parse(await request.json());
    const approval = await approveRequest(
      params.id,
      session.email,
      session.organizationId,
      body.reason,
      session.role === "admin" ? session.businessIds : undefined
    );

    // Broker-side fires dispatch by actionType. We run AFTER approveRequest
    // so the DB state is consistent even if the broker call fails — the
    // operator approved, which is what matters; the fill result is reported
    // but does not retroactively un-approve.
    let executionNote: string | null = null;
    const detail = approval.actionDetail ?? existing.actionDetail;
    if (approval.actionType === "place_forex_order") {
      const fired = await fireApprovedForexOrder({
        approvalId: approval.id,
        businessId: existing.businessId,
        actionDetail: detail
      });
      executionNote = fired.detail;
    } else if (approval.actionType === "place_futures_order") {
      const fired = await fireApprovedFuturesOrder({
        approvalId: approval.id,
        businessId: existing.businessId,
        actionDetail: detail
      });
      executionNote = fired.detail;
    } else if (
      approval.actionType === "close_forex_position" ||
      approval.actionType === "close_futures_position"
    ) {
      const asRecord = (detail ?? {}) as Record<string, unknown>;
      const broker =
        approval.actionType === "close_futures_position"
          ? "tradovate"
          : typeof asRecord.broker === "string"
            ? asRecord.broker
            : "oanda";
      const instrument =
        typeof asRecord.instrument === "string" ? asRecord.instrument : "";
      const sideRaw = typeof asRecord.side === "string" ? asRecord.side : "both";
      const side =
        sideRaw === "long" || sideRaw === "short" || sideRaw === "both"
          ? sideRaw
          : "both";
      const units =
        typeof asRecord.units === "string" ? asRecord.units : undefined;
      const activityEntryId =
        typeof asRecord.activityEntryId === "string"
          ? asRecord.activityEntryId
          : null;

      const result =
        broker === "tradovate"
          ? await closeTradovatePositionNow({
              businessId: existing.businessId,
              instrument,
              liveMode: true
            })
          : await closeOandaPositionNow({
              businessId: existing.businessId,
              instrument,
              side,
              units,
              liveMode: true
            });

      if (activityEntryId) {
        await db.activityEntry.update({
          where: { id: activityEntryId },
          data: {
            status: result.ok ? "completed" : "failed",
            metadata: {
              ...asRecord,
              firedByApprovalId: approval.id,
              firedAt: new Date().toISOString(),
              brokerResponse: result.brokerResponse ?? null,
              detail: result.detail
            }
          }
        });
      }
      executionNote = result.detail;
    } else if (approval.actionType === "modify_forex_order") {
      const asRecord = (detail ?? {}) as Record<string, unknown>;
      const instrument =
        typeof asRecord.instrument === "string" ? asRecord.instrument : "";
      const direction =
        asRecord.direction === "long" || asRecord.direction === "short"
          ? (asRecord.direction as "long" | "short")
          : null;
      const newStopPrice =
        typeof asRecord.newStopPrice === "number" ? asRecord.newStopPrice : NaN;
      const newTakeProfitPrice =
        typeof asRecord.newTakeProfitPrice === "number"
          ? asRecord.newTakeProfitPrice
          : null;
      const activityEntryId =
        typeof asRecord.activityEntryId === "string"
          ? asRecord.activityEntryId
          : null;

      let result: { ok: boolean; detail: string; modified: number; errors: string[] };
      if (!instrument || !direction || !Number.isFinite(newStopPrice)) {
        result = {
          ok: false,
          detail:
            "modify_forex_order approval is missing required fields. Won't fire.",
          modified: 0,
          errors: []
        };
      } else {
        result = await modifyOandaStopNow({
          businessId: existing.businessId,
          instrument,
          direction,
          newStopPrice,
          newTakeProfitPrice,
          liveMode: true
        });
      }

      if (activityEntryId) {
        await db.activityEntry.update({
          where: { id: activityEntryId },
          data: {
            status: result.ok ? "completed" : "failed",
            metadata: {
              ...asRecord,
              firedByApprovalId: approval.id,
              firedAt: new Date().toISOString(),
              modifiedCount: result.modified,
              errors: result.errors,
              detail: result.detail
            }
          }
        });
      }
      executionNote = result.detail;
    }

    return addSecurityHeaders(
      NextResponse.json({
        approval,
        executionNote
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
