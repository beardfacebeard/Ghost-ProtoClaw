import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { resolveKeyForModel } from "@/lib/keys";
import { providerForModel } from "@/lib/keys/provider-for-model";
import { directProviderCompletion } from "@/lib/llm/direct-provider";
import {
  getSystemDefaultModel,
  resolveAgentModel
} from "@/lib/models/agent-models";
import {
  chatCompletion,
  isConfigured,
  type ChatMessage
} from "@/lib/openclaw/client";
import { buildAgentSystemPrompt } from "@/lib/prompts/build-system-prompt";
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

    const systemDefault = getSystemDefaultModel();
    const resolvedModel = resolveAgentModel(agent, agent.business, systemDefault);

    // Build the full system prompt from agent config + business context
    const systemPrompt = buildAgentSystemPrompt(agent, agent.business);

    // Build messages array with optional conversation history
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: systemPrompt || "You are a helpful assistant. Respond helpfully and concisely."
      },
      ...(body.history ?? []),
      {
        role: "user",
        content: body.message
      }
    ];

    // Try to resolve an API key for the model
    const resolved = await resolveKeyForModel(
      resolvedModel.model,
      session.organizationId
    );

    const openClawReady = isConfigured();

    // Direct provider path: we have a key and OpenClaw is NOT configured
    if (resolved && !openClawReady) {
      const provider = providerForModel(resolvedModel.model);
      const result = await directProviderCompletion({
        provider,
        model: resolvedModel.model,
        apiKey: resolved.apiKey,
        messages
      });

      if (!result.success) {
        return addSecurityHeaders(
          NextResponse.json(
            {
              error: result.error || "Agent test failed",
              hint: `Direct ${provider} call failed. Check your API key or try configuring OpenClaw as a fallback.`
            },
            { status: 502 }
          )
        );
      }

      return addSecurityHeaders(
        NextResponse.json({
          response: result.content ?? "Provider responded without content.",
          latencyMs: result.latencyMs,
          model: result.model || resolvedModel.model
        })
      );
    }

    // OpenClaw path: gateway is configured (optionally pass provider key)
    if (openClawReady) {
      const result = await chatCompletion(
        {
          messages,
          backendModel: resolvedModel.model,
          sessionKey: `agent-test:${agent.id}`,
          ...(resolved ? { providerApiKey: resolved.apiKey } : {})
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
          model: result.data?.model || resolvedModel.model
        })
      );
    }

    // Neither path available
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: "No LLM provider configured",
          hint: "Add an API key for this model in Settings > Keys, or set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN in your environment variables."
        },
        { status: 400 }
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
