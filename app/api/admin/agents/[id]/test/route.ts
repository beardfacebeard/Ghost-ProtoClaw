import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  getSystemDefaultModel,
  resolveAgentModel
} from "@/lib/models/agent-models";
import {
  chatCompletion,
  isConfigured,
  type ChatMessage
} from "@/lib/openclaw/client";
import { getAgentById } from "@/lib/repository/agents";

const testSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(4000)
});

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

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

    if (!isConfigured()) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "OpenClaw not configured",
            hint: "Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN in your environment variables. Check Settings > System for details."
          },
          { status: 400 }
        )
      );
    }

    const systemDefault = getSystemDefaultModel();
    const resolved = resolveAgentModel(agent, agent.business, systemDefault);

    // Build the system prompt from the agent's configuration
    const systemPromptParts = [
      agent.role ? `Role: ${agent.role}` : "",
      agent.purpose ? `Purpose: ${agent.purpose}` : "",
      agent.displayName ? `You are "${agent.displayName}".` : "",
      "Respond helpfully and concisely."
    ].filter(Boolean);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPromptParts.join("\n")
      },
      {
        role: "user",
        content: body.message
      }
    ];

    // Use the OpenAI-compatible chat completions endpoint.
    // x-openclaw-model overrides the backend model while
    // keeping agent routing semantics intact.
    const result = await chatCompletion(
      {
        messages,
        backendModel: resolved.model,
        sessionKey: `agent-test:${agent.id}`
      },
      60_000
    );

    if (!result.success) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: result.error || "Agent test failed",
            hint: "Check your OpenClaw connection and gateway token."
          },
          { status: 502 }
        )
      );
    }

    const responseText =
      result.data?.choices?.[0]?.message?.content ??
      "OpenClaw responded without a message payload.";

    return addSecurityHeaders(
      NextResponse.json({
        response: responseText,
        latencyMs: result.latencyMs,
        model: result.data?.model || resolved.model
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
