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

    // place_forex_order is the first approval type that fires an external
    // broker-side action on approve. We do this AFTER approveRequest so the
    // DB state is consistent even if the broker call fails — the operator
    // approved, which is what matters; the fill result is reported but does
    // not retroactively un-approve.
    let executionNote: string | null = null;
    if (approval.actionType === "place_forex_order") {
      const fired = await fireApprovedForexOrder({
        approvalId: approval.id,
        businessId: existing.businessId,
        actionDetail: approval.actionDetail ?? existing.actionDetail
      });
      executionNote = fired.detail;
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
