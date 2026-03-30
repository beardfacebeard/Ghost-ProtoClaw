import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  countActivityEntries,
  listActivityEntries
} from "@/lib/repository/activity";

const querySchema = z.object({
  businessId: z.string().trim().min(1).optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
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
      businessId: query.businessId,
      type: query.type,
      search: query.search,
      startDate: parseDate(query.startDate),
      endDate: parseDate(query.endDate),
      limit: query.limit,
      offset: query.offset,
      businessIds: session.role === "admin" ? session.businessIds : undefined
    };

    const [entries, total] = await Promise.all([
      listActivityEntries(params),
      countActivityEntries(params)
    ]);

    return addSecurityHeaders(
      NextResponse.json({
        entries,
        total
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
