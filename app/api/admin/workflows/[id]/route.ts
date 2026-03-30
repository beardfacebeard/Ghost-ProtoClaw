import { NextRequest, NextResponse } from "next/server";

import { workflowUpdateApiSchema } from "@/components/admin/workflows/schema";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";
import {
  deleteWorkflow,
  getWorkflowById,
  updateWorkflow
} from "@/lib/repository/workflows";
import { validateCronExpression } from "@/lib/workflows/schedule-parser";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const workflow = await getWorkflowById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!workflow) {
      throw notFound("Workflow not found.");
    }

    return addSecurityHeaders(
      NextResponse.json({
        workflow
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getWorkflowById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Workflow not found.");
    }

    const body = workflowUpdateApiSchema.parse(await request.json());
    const scopedBusinessId = body.businessId ?? existing.businessId;

    if (session.role === "admin") {
      requireBusinessAccess(session, scopedBusinessId);
    }

    const nextTrigger = body.trigger ?? existing.trigger;
    const nextScheduleMode = body.scheduleMode ?? existing.scheduleMode;
    const nextCronExpression = body.cronExpression ?? existing.cronExpression;

    if (nextTrigger === "scheduled" && nextScheduleMode === "cron") {
      const validation = validateCronExpression(nextCronExpression ?? "");
      if (!validation.valid) {
        throw badRequest(validation.error || "Invalid cron expression.");
      }
    }

    const workflow = await updateWorkflow(params.id, session.organizationId, {
      ...body,
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

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getWorkflowById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Workflow not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    await deleteWorkflow(params.id, session.organizationId, {
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
