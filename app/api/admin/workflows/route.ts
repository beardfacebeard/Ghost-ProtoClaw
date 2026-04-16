import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { workflowCreateApiSchema } from "@/components/admin/workflows/schema";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import { createWorkflow, listWorkflows } from "@/lib/repository/workflows";
import { validateCronExpression } from "@/lib/workflows/schedule-parser";

const listQuerySchema = z.object({
  businessId: z.string().optional(),
  trigger: z.string().optional(),
  enabled: z.enum(["true", "false"]).optional(),
  search: z.string().optional()
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const query = listQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (session.role === "admin" && query.businessId) {
      requireBusinessAccess(session, query.businessId);
    }

    const workflows = await listWorkflows({
      organizationId: session.organizationId,
      businessId: query.businessId,
      trigger: query.trigger,
      enabled:
        query.enabled === undefined ? undefined : query.enabled === "true",
      search: query.search,
      businessIds: session.role === "admin" ? session.businessIds : undefined
    });

    return addSecurityHeaders(
      NextResponse.json({
        workflows
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = workflowCreateApiSchema.parse(await request.json());

    if (session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    if (body.trigger === "scheduled" && body.scheduleMode === "cron") {
      const validation = validateCronExpression(body.cronExpression ?? "");
      if (!validation.valid) {
        throw badRequest(validation.error || "Invalid cron expression.");
      }
    }

    const workflow = await createWorkflow({
      organizationId: session.organizationId,
      businessId: body.businessId,
      agentId: body.agentId,
      name: body.name,
      description: body.description,
      trigger: body.trigger,
      output: body.output,
      scheduleMode: body.scheduleMode,
      frequency: body.frequency,
      cronExpression: body.cronExpression,
      timezone: body.timezone,
      approvalMode: body.approvalMode,
      safetyMode: body.safetyMode,
      actionType: body.actionType,
      enabled: body.enabled,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        workflow
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
