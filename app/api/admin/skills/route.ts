import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { listSkills, createSkill } from "@/lib/repository/skills";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).optional(),
  instructions: z.string().max(10000).nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
  isRequired: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const skills = await listSkills(session.organizationId);

    return addSecurityHeaders(NextResponse.json({ skills }));
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

    const skill = await createSkill({
      ...data,
      config: data.config ? (data.config as Prisma.InputJsonValue) : undefined,
      organizationId: session.organizationId
    });

    return addSecurityHeaders(NextResponse.json(skill, { status: 201 }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
