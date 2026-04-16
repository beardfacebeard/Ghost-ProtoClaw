import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  getProjectById,
  updateProject,
  deleteProject
} from "@/lib/repository/projects";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  targetDate: z.string().datetime().nullable().optional()
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const project = await getProjectById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!project) throw notFound("Project not found.");

    return addSecurityHeaders(NextResponse.json(project));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getProjectById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );
    if (!existing) throw notFound("Project not found.");

    const body = await request.json();
    const data = updateSchema.parse(body);

    const project = await updateProject(params.id, {
      ...data,
      targetDate:
        data.targetDate === undefined
          ? undefined
          : data.targetDate
            ? new Date(data.targetDate)
            : null
    });

    return addSecurityHeaders(NextResponse.json(project));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getProjectById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );
    if (!existing) throw notFound("Project not found.");

    await deleteProject(params.id);

    return addSecurityHeaders(
      NextResponse.json({ message: "Project deleted." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
