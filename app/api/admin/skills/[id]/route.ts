import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  getSkillById,
  updateSkill,
  deleteSkill,
  assignSkillToAgent,
  removeSkillFromAgent
} from "@/lib/repository/skills";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).optional(),
  instructions: z.string().max(10000).nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
  isRequired: z.boolean().optional(),
  status: z.enum(["active", "archived"]).optional()
});

const assignSchema = z.object({
  action: z.enum(["assign", "unassign"]),
  agentId: z.string().min(1),
  enabled: z.boolean().optional()
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const skill = await getSkillById(params.id, session.organizationId);
    if (!skill) throw notFound("Skill not found.");

    return addSecurityHeaders(NextResponse.json(skill));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getSkillById(params.id, session.organizationId);
    if (!existing) throw notFound("Skill not found.");

    const body = await request.json();
    const data = updateSchema.parse(body);

    const skill = await updateSkill(params.id, {
      ...data,
      config: data.config === undefined
        ? undefined
        : data.config === null
          ? undefined
          : (data.config as Prisma.InputJsonValue)
    });

    return addSecurityHeaders(NextResponse.json(skill));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getSkillById(params.id, session.organizationId);
    if (!existing) throw notFound("Skill not found.");

    const body = await request.json();
    const data = assignSchema.parse(body);

    if (data.action === "assign") {
      const result = await assignSkillToAgent(
        data.agentId,
        params.id,
        data.enabled ?? true
      );
      return addSecurityHeaders(NextResponse.json(result));
    } else {
      await removeSkillFromAgent(data.agentId, params.id);
      return addSecurityHeaders(
        NextResponse.json({ message: "Skill unassigned." })
      );
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const existing = await getSkillById(params.id, session.organizationId);
    if (!existing) throw notFound("Skill not found.");

    await deleteSkill(params.id);

    return addSecurityHeaders(
      NextResponse.json({ message: "Skill archived." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
