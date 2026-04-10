/**
 * Shared LLM execution logic for agent conversations.
 *
 * Used by both the test endpoint (ephemeral) and persistent chat endpoint
 * to avoid duplicating the key resolution / rate limiting / provider
 * fallback chain.
 */

import { llmRateLimiter, agentLlmRateLimiter } from "@/lib/api/rate-limit";
import { resolveKeyForModel } from "@/lib/keys";
import { checkBudget } from "@/lib/llm/budget-guard";
import { directProviderCompletion } from "@/lib/llm/direct-provider";
import { logTokenUsage } from "@/lib/llm/usage-logger";
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

// ── Types ──────────────────────────────────────────────────────────

export type AgentChatInput = {
  agent: {
    id: string;
    businessId: string | null;
    displayName: string;
    primaryModel: string | null;
    fallbackModel: string | null;
    maxTokensPerCall: number | null;
    [key: string]: unknown;
  };
  business: {
    primaryModel: string | null;
    fallbackModel: string | null;
    modelSource: string;
    [key: string]: unknown;
  } | null;
  messages: ChatMessage[];
  organizationId: string;
  endpoint?: string;
};

export type AgentChatResult =
  | {
      success: true;
      response: string;
      model: string;
      latencyMs: number;
      budgetWarning?: string;
    }
  | {
      success: false;
      error: string;
      hint: string;
      statusCode: number;
    };

// ── Key resolution ─────────────────────────────────────────────────

async function findApiKey(
  model: string,
  organizationId: string
): Promise<{ apiKey: string; provider: string } | null> {
  const resolved = await resolveKeyForModel(model, organizationId);
  if (resolved) {
    return { apiKey: resolved.apiKey, provider: resolved.provider };
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return { apiKey: openRouterKey, provider: "openrouter" };
  }

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

// ── Main execution ─────────────────────────────────────────────────

/**
 * Execute a chat turn with an agent.
 *
 * Handles: model resolution → rate limiting → budget check → provider
 * selection → fallback → usage logging.
 *
 * Caller is responsible for building the messages array (system prompt +
 * history + new user message).
 */
export async function executeAgentChat(
  input: AgentChatInput
): Promise<AgentChatResult> {
  const { agent, business, messages, organizationId } = input;
  const endpoint = input.endpoint ?? "agent_chat";

  const systemDefault = getSystemDefaultModel();
  const resolvedModel = resolveAgentModel(agent, business, systemDefault);

  // ── Rate limiting ──────────────────────────────────────────────
  const orgRateCheck = llmRateLimiter.check(organizationId);
  if (!orgRateCheck.allowed) {
    return {
      success: false,
      error: "Rate limit exceeded",
      hint: `Too many LLM requests. Try again in ${orgRateCheck.retryAfter}s.`,
      statusCode: 429
    };
  }

  const agentRateCheck = agentLlmRateLimiter.check(agent.id);
  if (!agentRateCheck.allowed) {
    return {
      success: false,
      error: "Agent rate limit exceeded",
      hint: `This agent is making too many requests. Try again in ${agentRateCheck.retryAfter}s.`,
      statusCode: 429
    };
  }

  // ── Budget check ───────────────────────────────────────────────
  const budgetCheck = await checkBudget(organizationId, agent.businessId);
  if (!budgetCheck.allowed) {
    return {
      success: false,
      error: "Budget exceeded",
      hint: budgetCheck.message ?? "Budget limit reached.",
      statusCode: 402
    };
  }

  // Increment rate limit counters
  llmRateLimiter.increment(organizationId);
  agentLlmRateLimiter.increment(agent.id);

  // ── Provider selection ─────────────────────────────────────────
  const key = await findApiKey(resolvedModel.model, organizationId);
  const openClawReady = isConfigured();

  // Priority 1: Direct provider
  if (key) {
    const result = await directProviderCompletion({
      provider: key.provider,
      model: resolvedModel.model,
      apiKey: key.apiKey,
      messages,
      maxTokens: agent.maxTokensPerCall ?? undefined
    });

    if (result.success) {
      if (result.usage) {
        logTokenUsage({
          organizationId,
          businessId: agent.businessId,
          agentId: agent.id,
          model: result.model || resolvedModel.model,
          provider: key.provider,
          usage: result.usage,
          endpoint,
          success: true,
          latencyMs: result.latencyMs
        });
      }

      return {
        success: true,
        response: result.content ?? "Provider responded without content.",
        model: result.model || resolvedModel.model,
        latencyMs: result.latencyMs,
        ...(budgetCheck.warning ? { budgetWarning: budgetCheck.message } : {})
      };
    }

    // Retry via OpenRouter if the first provider failed
    if (key.provider !== "openrouter") {
      const orKey =
        process.env.OPENROUTER_API_KEY?.trim() ||
        (await resolveKeyForModel("openrouter/any", organizationId))?.apiKey;

      if (orKey) {
        const retry = await directProviderCompletion({
          provider: "openrouter",
          model: resolvedModel.model,
          apiKey: orKey,
          messages,
          maxTokens: agent.maxTokensPerCall ?? undefined
        });

        if (retry.success) {
          if (retry.usage) {
            logTokenUsage({
              organizationId,
              businessId: agent.businessId,
              agentId: agent.id,
              model: retry.model || resolvedModel.model,
              provider: "openrouter",
              usage: retry.usage,
              endpoint,
              success: true,
              latencyMs: retry.latencyMs
            });
          }

          return {
            success: true,
            response: retry.content ?? "Provider responded without content.",
            model: retry.model || resolvedModel.model,
            latencyMs: retry.latencyMs,
            ...(budgetCheck.warning
              ? { budgetWarning: budgetCheck.message }
              : {})
          };
        }
      }
    }

    // Both paths failed
    logTokenUsage({
      organizationId,
      businessId: agent.businessId,
      agentId: agent.id,
      model: resolvedModel.model,
      provider: key.provider,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      endpoint,
      success: false,
      latencyMs: result.latencyMs
    });

    return {
      success: false,
      error: result.error || "Agent call failed",
      hint: `Call to ${key.provider} failed for model "${resolvedModel.model}". Try changing the agent's model, or check your API key in Settings > API Keys.`,
      statusCode: 502
    };
  }

  // Priority 2: OpenClaw gateway
  if (openClawReady) {
    const result = await chatCompletion(
      {
        messages,
        backendModel: resolvedModel.model,
        sessionKey: `agent-chat:${agent.id}`
      },
      60_000
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Agent call failed",
        hint: "Check your OpenClaw connection and gateway token.",
        statusCode: 502
      };
    }

    const responseText =
      result.data?.choices?.[0]?.message?.content ??
      "OpenClaw responded without a message payload.";

    return {
      success: true,
      response: responseText,
      model: result.data?.model || resolvedModel.model,
      latencyMs: result.latencyMs
    };
  }

  // Neither path available
  return {
    success: false,
    error: "No AI provider configured",
    hint: "Go to Settings > API Keys and add your OpenRouter API key. That's all you need to start chatting with your agents.",
    statusCode: 400
  };
}

/**
 * Build the full messages array for an agent chat turn.
 * Includes system prompt + conversation history + new user message.
 */
export function buildChatMessages(
  agent: Record<string, unknown>,
  business: Record<string, unknown> | null,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): ChatMessage[] {
  const systemPrompt = buildAgentSystemPrompt(agent, business);

  return [
    {
      role: "system",
      content:
        systemPrompt ||
        "You are a helpful assistant. Respond helpfully and concisely."
    },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),
    {
      role: "user",
      content: userMessage
    }
  ];
}
