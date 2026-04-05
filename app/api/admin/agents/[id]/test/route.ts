import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { resolveKeyForModel } from "@/lib/keys";
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

    // Priority 1: Direct provider — when we have an API key, call the
    // provider directly.  This is the simplest path and doesn't need
    // OpenClaw to be deployed.
    //
    // Use the *resolved* provider (not the model's native provider)
    // because the key may have come from the OpenRouter fallback.
    // e.g. model is "openai/gpt-5.3" but key is an OpenRouter key.
    if (resolved) {
      const provider = resolved.provider;
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
              hint: `Direct ${provider} call failed. Check your API key in Settings > API Keys.`
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

    // Priority 2: OpenClaw gateway — when no API key is stored but
    // OpenClaw is fully configured (URL + token), route through the gateway.
    if (openClawReady) {
      const result = await chatCompletion(
        {
          messages,
          backendModel: resolvedModel.model,
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
          model: result.data?.model || resolvedModel.model
        })
      );
    }

    // Neither path available
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: "No LLM provider configured",
          hint: "Go to Settings > API Keys and add your OpenRouter, OpenAI, or Anthropic API key. That's all you need to start chatting with your agents."
        },
        { status: 400 }
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
