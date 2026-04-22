import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(500)
});

const FOREX_ACTION_TYPES = [
  "place_forex_order",
  "place_futures_order",
  "close_forex_position",
  "close_futures_position",
  "modify_forex_order"
];

/**
 * Bulk-reject every pending forex approval on a business. Useful when an
 * agent queues a bad batch of proposals and the operator wants to clear
 * them in one click instead of rejecting N times from /admin/approvals.
 *
 * Also cancels the linked ActivityEntry (if one was logged) so the
 * Operations panel's "pending" row disappears.
 *
 * Doesn't touch non-forex approvals — those are managed per-entry from
 * the Approvals page.
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
      select: { id: true }
    });
    if (!business) {
      throw notFound("Business not found.");
    }

    const now = new Date();

    // Find the pending approvals first so we can grab their linked
    // activityEntryIds for cancellation.
    const pending = await db.approvalRequest.findMany({
      where: {
        businessId: params.id,
        status: "pending",
        actionType: { in: FOREX_ACTION_TYPES }
      },
      select: { id: true, actionType: true, actionDetail: true }
    });

    if (pending.length === 0) {
      return addSecurityHeaders(
        NextResponse.json({
          rejected: 0,
          cancelledEntries: 0,
          message: "No pending forex approvals to reject."
        })
      );
    }

    // Pull activityEntryIds out of the detail JSON.
    const activityEntryIds: string[] = [];
    for (const approval of pending) {
      const detail = approval.actionDetail as Record<string, unknown> | null;
      if (detail && typeof detail.activityEntryId === "string") {
        activityEntryIds.push(detail.activityEntryId);
      }
    }

    const [rejectedRes, cancelledRes] = await db.$transaction([
      db.approvalRequest.updateMany({
        where: { id: { in: pending.map((a) => a.id) } },
        data: {
          status: "rejected",
          reviewedBy: session.email,
          reviewedAt: now,
          reason: `Bulk-rejected via Forex Operations panel: ${body.reason}`
        }
      }),
      activityEntryIds.length > 0
        ? db.activityEntry.updateMany({
            where: { id: { in: activityEntryIds } },
            data: { status: "cancelled" }
          })
        : db.activityEntry.updateMany({
            where: { id: "__none__" },
            data: { status: "cancelled" }
          })
    ]);

    await db.auditEvent.create({
      data: {
        organizationId: session.organizationId,
        actorEmail: session.email,
        eventType: "forex_desk_bulk_reject",
        entityType: "business",
        entityId: params.id,
        beforeJson: {},
        afterJson: {
          rejectedApprovals: rejectedRes.count,
          cancelledEntries: cancelledRes.count,
          reason: body.reason
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        rejected: rejectedRes.count,
        cancelledEntries: cancelledRes.count,
        message: `Rejected ${rejectedRes.count} pending forex approvals.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
