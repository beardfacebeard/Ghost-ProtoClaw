/**
 * Shared LLM execution logic for agent conversations.
 *
 * Used by both the test endpoint (ephemeral) and persistent chat endpoint
 * to avoid duplicating the key resolution / rate limiting / provider
 * fallback chain.
 *
 * Now includes full agentic tool-use loop:
 *   1. Build messages with system prompt + tool descriptions
 *   2. Send to LLM with tool schemas
 *   3. If LLM returns tool_calls → execute tools → append results → loop
 *   4. When LLM returns text content → return final response
 */

import { llmRateLimiter, agentLlmRateLimiter } from "@/lib/api/rate-limit";
import { resolveKeyForModel } from "@/lib/keys";
import { checkBudget } from "@/lib/llm/budget-guard";
import { directProviderCompletion, type ToolCallMessage } from "@/lib/llm/direct-provider";
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
import {
  getToolsForAgent,
  buildToolsDescription,
  toOpenAITools,
  type InstalledTool,
  type ToolSchema
} from "@/lib/mcp/tool-registry";
import { executeTool, findToolByName } from "@/lib/mcp/tool-executor";
import { db } from "@/lib/db";

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
  /** Pre-loaded tools — if not provided, will be fetched from DB */
  tools?: InstalledTool[];
};

export type AgentChatResult =
  | {
      success: true;
      response: string;
      model: string;
      latencyMs: number;
      budgetWarning?: string;
      toolsUsed?: string[];
    }
  | {
      success: false;
      error: string;
      hint: string;
      statusCode: number;
    };

// ── Constants ─────────────────────────────────────────────────────

/** Max tool-call rounds before forcing a text response */
const MAX_TOOL_ROUNDS = 8;

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

// ── Tool-aware LLM call ───────────────────────────────────────────

async function callWithTools(params: {
  provider: string;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
  tools: ToolSchema[];
  maxTokens?: number;
}): Promise<{
  success: boolean;
  content?: string;
  toolCalls?: ToolCallMessage[];
  model?: string;
  latencyMs: number;
  error?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  return directProviderCompletion({
    provider: params.provider,
    model: params.model,
    apiKey: params.apiKey,
    messages: params.messages,
    maxTokens: params.maxTokens,
    tools: params.tools.length > 0 ? params.tools : undefined
  });
}

// ── Main execution ─────────────────────────────────────────────────

/**
 * Execute a chat turn with an agent.
 *
 * Handles: model resolution → rate limiting → budget check → tool loading →
 * provider selection → agentic tool loop → fallback → usage logging.
 *
 * Caller is responsible for building the messages array (system prompt +
 * history + new user message).
 */
export async function executeAgentChat(
  input: AgentChatInput
): Promise<AgentChatResult> {
  const { agent, business, organizationId } = input;
  let { messages } = input;
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

  // ── Load tools ────────────────────────────────────────────────
  const installedTools =
    input.tools ?? (await getToolsForAgent(organizationId, agent.businessId));
  const toolSchemas = toOpenAITools(installedTools);

  // ── Provider selection ─────────────────────────────────────────
  const key = await findApiKey(resolvedModel.model, organizationId);
  const openClawReady = isConfigured();

  // Priority 1: Direct provider with tool loop
  if (key) {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    let currentMessages = [...messages];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await callWithTools({
        provider: key.provider,
        model: resolvedModel.model,
        apiKey: key.apiKey,
        messages: currentMessages,
        tools: toolSchemas,
        maxTokens: agent.maxTokensPerCall ?? undefined
      });

      if (!result.success) {
        // Try OpenRouter fallback on first failure
        if (round === 0 && key.provider !== "openrouter") {
          const orKey =
            process.env.OPENROUTER_API_KEY?.trim() ||
            (await resolveKeyForModel("openrouter/any", organizationId))?.apiKey;

          if (orKey) {
            const retry = await callWithTools({
              provider: "openrouter",
              model: resolvedModel.model,
              apiKey: orKey,
              messages: currentMessages,
              tools: toolSchemas,
              maxTokens: agent.maxTokensPerCall ?? undefined
            });

            if (retry.success) {
              if (retry.usage) {
                totalUsage.promptTokens += retry.usage.promptTokens;
                totalUsage.completionTokens += retry.usage.completionTokens;
                totalUsage.totalTokens += retry.usage.totalTokens;
              }

              // Check for tool calls in retry
              if (retry.toolCalls && retry.toolCalls.length > 0) {
                // Process tool calls (continue loop)
                currentMessages.push({
                  role: "assistant",
                  content: retry.content || "",
                  tool_calls: retry.toolCalls
                } as ChatMessage);

                for (const tc of retry.toolCalls) {
                  const tool = findToolByName(installedTools, tc.function.name);
                  const toolResult = await executeTool({
                    toolName: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments || "{}"),
                    mcpServerId: tool?.mcpServerId || "",
                    organizationId
                  });

                  toolsUsed.push(tc.function.name);

                  currentMessages.push({
                    role: "tool",
                    content: toolResult.success
                      ? toolResult.output
                      : `Error: ${toolResult.error}`,
                    tool_call_id: tc.id,
                    name: tc.function.name
                  } as ChatMessage);
                }

                continue;
              }

              // No tool calls — return text response
              const totalLatency = Date.now() - startTime;
              logTokenUsage({
                organizationId,
                businessId: agent.businessId,
                agentId: agent.id,
                model: retry.model || resolvedModel.model,
                provider: "openrouter",
                usage: totalUsage,
                endpoint,
                success: true,
                latencyMs: totalLatency
              });

              return {
                success: true,
                response: retry.content ?? "Provider responded without content.",
                model: retry.model || resolvedModel.model,
                latencyMs: totalLatency,
                ...(toolsUsed.length > 0 ? { toolsUsed } : {}),
                ...(budgetCheck.warning ? { budgetWarning: budgetCheck.message } : {})
              };
            }
          }
        }

        // Both paths failed
        const totalLatency = Date.now() - startTime;
        logTokenUsage({
          organizationId,
          businessId: agent.businessId,
          agentId: agent.id,
          model: resolvedModel.model,
          provider: key.provider,
          usage: totalUsage,
          endpoint,
          success: false,
          latencyMs: totalLatency
        });

        return {
          success: false,
          error: result.error || "Agent call failed",
          hint: `Call to ${key.provider} failed for model "${resolvedModel.model}". Try changing the agent's model, or check your API key in Settings > API Keys.`,
          statusCode: 502
        };
      }

      // Track usage
      if (result.usage) {
        totalUsage.promptTokens += result.usage.promptTokens;
        totalUsage.completionTokens += result.usage.completionTokens;
        totalUsage.totalTokens += result.usage.totalTokens;
      }

      // ── Check for tool calls ──────────────────────────────────
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Add assistant message with tool calls to conversation
        currentMessages.push({
          role: "assistant",
          content: result.content || "",
          tool_calls: result.toolCalls
        } as ChatMessage);

        // Execute each tool call
        for (const tc of result.toolCalls) {
          const tool = findToolByName(installedTools, tc.function.name);

          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || "{}");
          } catch {
            parsedArgs = {};
          }

          const toolResult = await executeTool({
            toolName: tc.function.name,
            arguments: parsedArgs,
            mcpServerId: tool?.mcpServerId || "",
            organizationId
          });

          toolsUsed.push(tc.function.name);

          // Add tool result to messages
          currentMessages.push({
            role: "tool",
            content: toolResult.success
              ? toolResult.output
              : `Error: ${toolResult.error}`,
            tool_call_id: tc.id,
            name: tc.function.name
          } as ChatMessage);
        }

        // Continue the loop — LLM will see tool results and either
        // call more tools or produce a text response
        continue;
      }

      // ── No tool calls — we have a final text response ─────────
      const totalLatency = Date.now() - startTime;

      logTokenUsage({
        organizationId,
        businessId: agent.businessId,
        agentId: agent.id,
        model: result.model || resolvedModel.model,
        provider: key.provider,
        usage: totalUsage,
        endpoint,
        success: true,
        latencyMs: totalLatency
      });

      return {
        success: true,
        response: result.content ?? "Provider responded without content.",
        model: result.model || resolvedModel.model,
        latencyMs: totalLatency,
        ...(toolsUsed.length > 0 ? { toolsUsed } : {}),
        ...(budgetCheck.warning ? { budgetWarning: budgetCheck.message } : {})
      };
    }

    // Exceeded max rounds — return whatever we have
    const totalLatency = Date.now() - startTime;
    return {
      success: true,
      response:
        "I attempted to complete the task but hit the maximum number of tool-use steps. Here's what I've done so far with tools: " +
        toolsUsed.join(", ") +
        ". Please let me know how to proceed.",
      model: resolvedModel.model,
      latencyMs: totalLatency,
      toolsUsed
    };
  }

  // Priority 2: OpenClaw gateway (no tool support yet)
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
 * Includes system prompt + tool awareness + conversation history + new user message.
 */
export async function buildChatMessages(
  agent: Record<string, unknown>,
  business: Record<string, unknown> | null,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  organizationId?: string,
  businessId?: string | null
): Promise<{ messages: ChatMessage[]; tools: InstalledTool[] }> {
  // Build base system prompt
  const systemPrompt = buildAgentSystemPrompt(agent, business);

  // Load installed tools
  let tools: InstalledTool[] = [];
  if (organizationId) {
    tools = await getToolsForAgent(organizationId, businessId ?? null);
  }

  // Load brand assets for business context
  let brandAssetsSection = "";
  if (organizationId && businessId) {
    try {
      const assets = await db.brandAsset.findMany({
        where: { organizationId, businessId },
        select: { fileName: true, fileType: true, category: true, description: true, url: true },
        take: 50,
        orderBy: { createdAt: "desc" }
      });

      if (assets.length > 0) {
        const assetList = assets
          .map(
            (a) =>
              `- ${a.fileName} (${a.category}${a.description ? `: ${a.description}` : ""}) — ${a.url || "available in filesystem"}`
          )
          .join("\n");
        brandAssetsSection = `── BRAND ASSETS ──\nYou have access to the following brand assets (images, documents, etc.). Reference them when relevant:\n${assetList}`;
      }
    } catch {
      // Brand assets table may not exist yet — skip silently
    }
  }

  // Build tool-aware system prompt
  const toolsDescription = buildToolsDescription(tools);
  const promptParts = [systemPrompt, toolsDescription, brandAssetsSection].filter(Boolean);
  const fullSystemPrompt = promptParts.join("\n\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        fullSystemPrompt ||
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

  return { messages, tools };
}
