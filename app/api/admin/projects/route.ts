import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { listProjects, createProject } from "@/lib/repository/projects";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetDate: z.string().datetime().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const projects = await listProjects(
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    return addSecurityHeaders(NextResponse.json({ projects }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = await request.json();
    const data = createSchema.parse(body);

    const project = await createProject({
      ...data,
      targetDate: data.targetDate ? new Date(data.targetDate) : undefined
    });

    return addSecurityHeaders(NextResponse.json(project, { status: 201 }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
