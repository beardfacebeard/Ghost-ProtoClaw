import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireSuperAdmin } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  countAuditEvents,
  listAuditEvents
} from "@/lib/repository/activity";

const querySchema = z.object({
  actorEmail: z.string().optional(),
  entityType: z.string().optional(),
  eventType: z.string().optional(),
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
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    requireSuperAdmin(session);

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    const params = {
      organizationId: session.organizationId,
      actorEmail: query.actorEmail,
      entityType: query.entityType,
      eventType: query.eventType,
      startDate: parseDate(query.startDate),
      endDate: parseDate(query.endDate),
      limit: query.limit,
      offset: query.offset
    };

    const [events, total] = await Promise.all([
      listAuditEvents(params),
      countAuditEvents(params)
    ]);

    return addSecurityHeaders(
      NextResponse.json({
        events,
        total
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
