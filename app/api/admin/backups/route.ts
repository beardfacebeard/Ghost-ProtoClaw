import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  getSessionFromHeaders,
  requireBusinessAccess
} from "@/lib/auth/rbac";
import { apiErrorResponse, forbidden, unauthorized } from "@/lib/errors";
import {
  countBackups,
  createManualBackup,
  listBackups
} from "@/lib/repository/backups";

const querySchema = z.object({
  businessId: z.string().trim().min(1).optional(),
  sourceType: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const bodySchema = z.object({
  businessId: z.string().trim().min(1).optional(),
  sourceType: z.enum([
    "gateway_config",
    "workspace_snapshot",
    "export_bundle"
  ]),
  scopeType: z.string().trim().max(100).optional(),
  scopeId: z.string().trim().max(100).optional(),
  reason: z.string().trim().max(500).optional()
});

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
      sourceType: query.sourceType,
      status: query.status,
      limit: query.limit,
      businessIds: session.role === "admin" ? session.businessIds : undefined
    };

    const [backups, total] = await Promise.all([
      listBackups(params),
      countBackups(params)
    ]);

    return addSecurityHeaders(
      NextResponse.json({
        backups,
        total
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    if (session.role === "admin") {
      if (!body.businessId) {
        throw forbidden("Business-scoped admins can only back up assigned businesses.");
      }

      requireBusinessAccess(session, body.businessId);
    }

    const backup = await createManualBackup({
      organizationId: session.organizationId,
      businessId: body.businessId,
      sourceType: body.sourceType,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      triggeredBy: session.email,
      reason: body.reason
    });

    return addSecurityHeaders(
      NextResponse.json({
        backup
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
