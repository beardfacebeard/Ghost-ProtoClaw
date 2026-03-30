import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  countApprovalRequests,
  getPendingCount,
  listApprovalRequests
} from "@/lib/repository/approvals";

const querySchema = z.object({
  status: z.string().optional(),
  businessId: z.string().trim().min(1).optional(),
  workflowId: z.string().trim().min(1).optional(),
  agentId: z.string().trim().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (session.role === "admin" && query.businessId) {
      requireBusinessAccess(session, query.businessId);
    }

    const params = {
      organizationId: session.organizationId,
      status: query.status,
      businessId: query.businessId,
      workflowId: query.workflowId,
      agentId: query.agentId,
      startDate: parseDate(query.startDate),
      endDate: parseDate(query.endDate),
      limit: query.limit,
      offset: query.offset,
      businessIds: session.role === "admin" ? session.businessIds : undefined
    };

    const [approvals, total, pendingCount] = await Promise.all([
      listApprovalRequests(params),
      countApprovalRequests(params),
      getPendingCount(
        session.organizationId,
        session.role === "admin" ? session.businessIds : undefined
      )
    ]);

    return addSecurityHeaders(
      NextResponse.json({
        approvals,
        total,
        pendingCount
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
