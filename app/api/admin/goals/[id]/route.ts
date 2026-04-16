import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  getGoalById,
  updateGoal,
  deleteGoal
} from "@/lib/repository/goals";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  parentGoalId: z.string().nullable().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  targetDate: z.string().datetime().nullable().optional()
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const goal = await getGoalById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!goal) throw notFound("Goal not found.");

    return addSecurityHeaders(NextResponse.json(goal));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getGoalById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );
    if (!existing) throw notFound("Goal not found.");

    const body = await request.json();
    const data = updateSchema.parse(body);

    const goal = await updateGoal(params.id, {
      ...data,
      targetDate:
        data.targetDate === undefined
          ? undefined
          : data.targetDate
            ? new Date(data.targetDate)
            : null
    });

    return addSecurityHeaders(NextResponse.json(goal));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getGoalById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );
    if (!existing) throw notFound("Goal not found.");

    await deleteGoal(params.id);

    return addSecurityHeaders(
      NextResponse.json({ message: "Goal deleted." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
