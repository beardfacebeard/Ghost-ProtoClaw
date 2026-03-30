import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  approveRequest,
  getApprovalById
} from "@/lib/repository/approvals";

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
    const session = getSessionFromHeaders(request.headers);

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
      body.reason
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
