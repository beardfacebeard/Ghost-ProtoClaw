import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { listGoals, createGoal } from "@/lib/repository/goals";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  businessId: z.string().min(1),
  parentGoalId: z.string().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  targetDate: z.string().datetime().nullable().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const goals = await listGoals(
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    return addSecurityHeaders(NextResponse.json({ goals }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const body = await request.json();
    const data = createSchema.parse(body);

    const goal = await createGoal({
      ...data,
      targetDate: data.targetDate ? new Date(data.targetDate) : undefined
    });

    return addSecurityHeaders(NextResponse.json(goal, { status: 201 }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
