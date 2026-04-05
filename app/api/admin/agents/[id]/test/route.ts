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

/**
 * Attempt to find any usable API key.
 *
 * Priority:
 * 1. Standard resolution chain (DB → env → OpenRouter fallback)
 * 2. Direct OPENROUTER_API_KEY env var (most users have this)
 * 3. Other provider env vars as last resort
 *
 * When the resolution chain returns a non-OpenRouter provider key we
 * still prefer to route through OpenRouter if a key is available, since
 * OpenRouter handles all models and is more likely to work.
 */
async function findApiKey(
  model: string,
  organizationId: string
): Promise<{ apiKey: string; provider: string } | null> {
  // 1. Standard resolution chain (DB → env → OpenRouter fallback)
  const resolved = await resolveKeyForModel(model, organizationId);
  if (resolved) {
    // If the chain found a key through the OpenRouter fallback, or if the
    // key IS for the native provider, return it.
    return { apiKey: resolved.apiKey, provider: resolved.provider };
  }

  // 2. Direct OpenRouter env var — most common single-key setup
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return { apiKey: openRouterKey, provider: "openrouter" };
  }

  // 3. Fallback to direct provider env vars
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return { apiKey: openAiKey, provider: "openai" };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return { apiKey: anthropicKey, provider: "anthropic" };
  }

  return null;
}

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
        content:
          systemPrompt ||
          "You are a helpful assistant. Respond helpfully and concisely."
      },
      ...(body.history ?? []),
      {
        role: "user",
        content: body.message
      }
    ];

    // Try to find an API key
    const key = await findApiKey(resolvedModel.model, session.organizationId);
    const openClawReady = isConfigured();

    // Priority 1: Direct provider call when we have a key
    if (key) {
      const result = await directProviderCompletion({
        provider: key.provider,
        model: resolvedModel.model,
        apiKey: key.apiKey,
        messages
      });

      if (result.success) {
        return addSecurityHeaders(
          NextResponse.json({
            response: result.content ?? "Provider responded without content.",
            latencyMs: result.latencyMs,
            model: result.model || resolvedModel.model
          })
        );
      }

      // If the first provider failed and it wasn't OpenRouter, retry via
      // OpenRouter as a universal fallback — it can route any model.
      if (key.provider !== "openrouter") {
        const orKey =
          process.env.OPENROUTER_API_KEY?.trim() ||
          (await resolveKeyForModel("openrouter/any", session.organizationId))
            ?.apiKey;

        if (orKey) {
          const retry = await directProviderCompletion({
            provider: "openrouter",
            model: resolvedModel.model,
            apiKey: orKey,
            messages
          });

          if (retry.success) {
            return addSecurityHeaders(
              NextResponse.json({
                response:
                  retry.content ?? "Provider responded without content.",
                latencyMs: retry.latencyMs,
                model: retry.model || resolvedModel.model
              })
            );
          }
        }
      }

      // Both paths failed — show a helpful error
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: result.error || "Agent test failed",
            hint: `Call to ${key.provider} failed for model "${resolvedModel.model}". Try changing the agent's model in the edit page, or check your API key in Settings > API Keys.`
          },
          { status: 502 }
        )
      );
    }

    // Priority 2: OpenClaw gateway
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
          error: "No AI provider configured",
          hint: "Go to Settings > API Keys and add your OpenRouter API key. That's all you need to start chatting with your agents."
        },
        { status: 400 }
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
