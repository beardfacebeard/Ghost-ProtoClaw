import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { agentCreateApiSchema } from "@/components/admin/agents/schema";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, forbidden, unauthorized } from "@/lib/errors";
import { createAgent, listAgents } from "@/lib/repository/agents";

const listQuerySchema = z.object({
  businessId: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional()
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const query = listQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (session.role === "admin" && query.businessId) {
      requireBusinessAccess(session, query.businessId);
    }

    const agents = await listAgents({
      organizationId: session.organizationId,
      businessId: query.businessId,
      type: query.type,
      status: query.status,
      search: query.search,
      businessIds: session.role === "admin" ? session.businessIds : undefined
    });

    return addSecurityHeaders(
      NextResponse.json({
        agents
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

    const body = agentCreateApiSchema.parse(await request.json());

    if (body.type === "global" && session.role !== "super_admin") {
      throw forbidden("Global agents require super admin access.");
    }

    if (body.businessId && session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    const agent = await createAgent({
      organizationId: session.organizationId,
      businessId: body.type === "global" ? null : body.businessId,
      displayName: body.displayName,
      emoji: body.emoji,
      role: body.role,
      purpose: body.purpose,
      type: body.type,
      status: body.status,
      systemPrompt: body.systemPrompt,
      roleInstructions: body.roleInstructions,
      outputStyle: body.outputStyle,
      constraints: body.constraints,
      escalationRules: body.escalationRules,
      askBeforeDoing: body.askBeforeDoing,
      primaryModel: body.primaryModel,
      fallbackModel: body.fallbackModel,
      modelSource: body.modelSource,
      runtime: body.runtime,
      safetyMode: body.safetyMode,
      tools: body.tools,
      workspacePath: body.workspacePath,
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        agent
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
