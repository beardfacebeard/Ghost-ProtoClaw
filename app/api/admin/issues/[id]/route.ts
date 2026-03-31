import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  getIssueById,
  updateIssue,
  deleteIssue
} from "@/lib/repository/issues";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z
    .enum(["open", "in_progress", "review", "done", "cancelled"])
    .optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  projectId: z.string().nullable().optional(),
  assigneeAgentId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional()
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const issue = await getIssueById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!issue) throw notFound("Issue not found.");

    return addSecurityHeaders(NextResponse.json(issue));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getIssueById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );
    if (!existing) throw notFound("Issue not found.");

    const body = await request.json();
    const data = updateSchema.parse(body);

    const issue = await updateIssue(params.id, {
      ...data,
      dueDate:
        data.dueDate === undefined
          ? undefined
          : data.dueDate
            ? new Date(data.dueDate)
            : null
    });

    return addSecurityHeaders(NextResponse.json(issue));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getIssueById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );
    if (!existing) throw notFound("Issue not found.");

    await deleteIssue(params.id);

    return addSecurityHeaders(
      NextResponse.json({ message: "Issue deleted." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
