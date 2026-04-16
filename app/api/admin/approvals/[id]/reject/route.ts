import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  getApprovalById,
  rejectRequest
} from "@/lib/repository/approvals";

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(500)
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
    const approval = await rejectRequest(
      params.id,
      session.email,
      session.organizationId,
      body.reason,
      session.role === "admin" ? session.businessIds : undefined
    );

    return addSecurityHeaders(
      NextResponse.json({
        approval
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
