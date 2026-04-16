import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { executeAgentChat, buildChatMessages } from "@/lib/llm/agent-chat";
import { getAgentById } from "@/lib/repository/agents";

const testSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })
    )
    .max(50)
    .optional()
});

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = testSchema.parse(await request.json());
    const agent = await getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!agent) {
      throw notFound("Agent not found.");
    }

    // Build messages with tool awareness
    const { messages, tools } = await buildChatMessages(
      agent as Record<string, unknown>,
      agent.business as Record<string, unknown> | null,
      body.history ?? [],
      body.message,
      session.organizationId,
      agent.businessId
    );

    // Use shared agent chat execution (handles rate limiting, budget, tools, fallback)
    const result = await executeAgentChat({
      agent: agent as any,
      business: agent.business as any,
      messages,
      organizationId: session.organizationId,
      endpoint: "agent_test",
      tools
    });

    if (!result.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: result.error, hint: result.hint },
          { status: result.statusCode }
        )
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        response: result.response,
        latencyMs: result.latencyMs,
        model: result.model,
        ...(result.toolsUsed?.length ? { toolsUsed: result.toolsUsed } : {}),
        ...(result.budgetWarning
          ? { budgetWarning: result.budgetWarning }
          : {})
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
