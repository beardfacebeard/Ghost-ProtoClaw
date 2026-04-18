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
import { safeEllipsize } from "@/lib/llm/safe-text";
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
  getBuiltInTools,
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
const MAX_TOOL_ROUNDS = 20;

/**
 * Plain-English behavior notes for each integration, injected into the
 * agent's system context so it knows how a connection is actually used. Keys
 * match Integration.key values in the DB. When an integration has no direct
 * tool in the MCP registry (Telegram inbound, Resend via send_email, etc.),
 * the note must explicitly say so — otherwise the agent assumes the absence
 * of a tool means the integration isn't really connected.
 */
const INTEGRATION_BEHAVIOR_HINTS: Record<string, string> = {
  telegram:
    "Telegram is two-way for you. Inbound: users who /start your bot land in a Telegram thread and their messages arrive here as regular user turns. When you reply in an ongoing Telegram conversation, RESPOND AS PLAIN TEXT — the bot delivers your reply automatically. Do NOT call send_telegram_message to reply to a message you just received; that duplicates or drops the response. Only use send_telegram_message for proactive messages initiated from outside a Telegram conversation (daily summaries, workflow results, alerts). If asked whether you're on Telegram, answer yes. Never mention MCP or tool installs.",
  gmail:
    "Gmail is connected for reading and sending email. If you need to send an email and have a send_email tool available, use it; otherwise tell the user Gmail is connected but the email tool isn't wired in this runtime yet.",
  resend:
    "Resend is connected for outbound email. Use the send_email tool when it's available in your tool list.",
  twilio:
    "Twilio is connected for SMS. Use the send_sms tool when it's available in your tool list.",
  openai:
    "An OpenAI API key is connected. This powers model routing and voice transcription — no direct action from you is needed.",
  anthropic:
    "An Anthropic API key is connected for Claude model calls. No direct action from you is needed.",
  openrouter:
    "OpenRouter is connected as a multi-model gateway. No direct action from you is needed.",
  slack:
    "Slack is connected. Use the slack_send_message tool when it's available in your tool list.",
  stripe:
    "Stripe is connected. Use the stripe_* tools when available to look up payments, balances, or subscriptions.",
  hubspot:
    "HubSpot is connected. Use the hubspot_* tools when available for CRM lookups and contact creation."
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
                    organizationId,
                    agentId: agent.id,
                    businessId: agent.businessId ?? undefined
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
            organizationId,
            agentId: agent.id,
            businessId: agent.businessId ?? undefined
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

  // Load installed tools + built-in tools. Master agents are intentionally
  // not given MCP action tools — their only tools are the built-in
  // ask_ceo_agent / list_businesses pair, enforcing read-only delegation.
  let tools: InstalledTool[] = [];
  if (organizationId) {
    const agentType = agent.type as string | undefined;
    const mcpTools =
      agentType === "master"
        ? []
        : await getToolsForAgent(organizationId, businessId ?? null);
    const builtInTools = getBuiltInTools({
      type: agentType,
      depth: agent.depth as number | undefined
    });
    tools = [...mcpTools, ...builtInTools];
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

  // Load recent agent memories for context
  let memoriesSection = "";
  if (businessId) {
    try {
      const memories = await db.agentMemory.findMany({
        where: {
          agentId: agent.id as string,
          businessId
        },
        orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
        take: 20,
        select: { type: true, content: true, importance: true, createdAt: true }
      });

      if (memories.length > 0) {
        const memoryList = memories
          .map((m) => `- [${m.type}] ${m.content} (importance: ${m.importance}/10)`)
          .join("\n");
        memoriesSection = `── YOUR MEMORIES ──\nThese are your stored learnings and observations from past interactions. Use them to inform your decisions and avoid repeating mistakes:\n${memoryList}`;
      }
    } catch {
      // AgentMemory table may not exist yet — skip silently
    }
  }

  // Load team agents for awareness and delegation
  let teamSection = "";
  if (businessId) {
    try {
      const teamAgents = await db.agent.findMany({
        where: {
          businessId,
          status: { in: ["active", "paused"] },
          id: { not: agent.id as string }
        },
        select: {
          id: true,
          displayName: true,
          emoji: true,
          role: true,
          purpose: true,
          type: true,
          status: true,
          parentAgentId: true,
          depth: true,
          primaryModel: true,
          fallbackModel: true,
          runtime: true,
          safetyMode: true,
          systemPrompt: true,
          constraints: true
        },
        orderBy: [{ type: "asc" }, { depth: "asc" }, { displayName: "asc" }]
      });

      if (teamAgents.length > 0) {
        const currentAgentType = agent.type as string;
        const currentAgentName = agent.displayName as string;
        const isLeader = currentAgentType === "main" || (agent.depth as number) === 0;

        const agentList = teamAgents
          .map((a) => {
            const statusBadge = a.status === "active" ? "✅" : "⏸️";
            const hierarchy = a.parentAgentId === (agent.id as string) ? " (reports to you)" : "";
            const model = a.primaryModel || "system default";
            const fallback = a.fallbackModel ? ` → fallback: ${a.fallbackModel}` : "";
            const runtime = a.runtime || "openclaw";
            const safety = a.safetyMode || "ask_before_acting";
            const promptSnippet = a.systemPrompt
              ? `\n    Prompt: "${safeEllipsize(a.systemPrompt, 100, "...")}"`
              : "";
            const constraintSnippet = a.constraints
              ? `\n    Constraints: "${safeEllipsize(a.constraints, 100, "...")}"`
              : "";
            return `- ${a.emoji || "🤖"} **${a.displayName}** — ${a.role}${a.purpose ? ` | ${a.purpose}` : ""} [${statusBadge} ${a.status}]${hierarchy}
    Type: ${a.type} | Model: ${model}${fallback} | Runtime: ${runtime} | Safety: ${safety}${promptSnippet}${constraintSnippet}
    (ID: ${a.id})`;
          })
          .join("\n");

        const delegationNote = isLeader
          ? `\n\nAs ${currentAgentName}, you are the leader of this team. You can:\n- **Delegate tasks** to any team member using the delegate_task tool\n- **Suggest new agents** using suggest_agent_config when you identify a gap in the team\n- **Propose creating agents** using create_agent (requires user approval)\n- **Propose editing agents** using edit_agent to optimize team performance (requires user approval)\nWhen a task falls outside your expertise, assign it to the most appropriate team member. Coordinate the team to achieve business goals.`
          : `\n\nYou are part of a team. If a task is outside your area, suggest the user talk to the appropriate team member.`;

        teamSection = `── YOUR TEAM ──\nThese are the other agents in your business:\n${agentList}${delegationNote}`;
      }
    } catch {
      // Skip if agents can't be loaded
    }
  }

  // Build agent-building knowledge for leader agents
  let agentBuildingSection = "";
  const isLeader = (agent.type as string) === "main" || (agent.depth as number) === 0;
  if (isLeader) {
    agentBuildingSection = `── AGENT BUILDING KNOWLEDGE ──
You have the ability to suggest, create, and edit agents on your team. Use the suggest_agent_config, create_agent, and edit_agent tools. ALL agent creation and editing requires user approval — you propose, they confirm.

**Available LLM Models (by provider):**
• OpenAI GPT-5: openai/gpt-5.4, openai/gpt-5.4-pro, openai/gpt-5.4-mini, openai/gpt-5.3-chat, openai/gpt-5.3-codex, openai/gpt-5, openai/gpt-5-mini, openai/gpt-5-codex
• OpenAI GPT-4: openai/gpt-4.1, openai/gpt-4.1-mini, openai/gpt-4.1-nano, openai/gpt-4o, openai/gpt-4o-mini
• OpenAI Reasoning: openai/o4-mini, openai/o3, openai/o3-pro, openai/o3-mini, openai/o1, openai/o1-pro
• Anthropic Claude: anthropic/claude-opus-4.7, anthropic/claude-sonnet-4.6, anthropic/claude-opus-4.6, anthropic/claude-sonnet-4.5, anthropic/claude-opus-4.5, anthropic/claude-haiku-4.5, anthropic/claude-3.7-sonnet, anthropic/claude-3.5-haiku
• DeepSeek: deepseek/deepseek-v3.2, deepseek/deepseek-v3.2-speciale, deepseek/deepseek-r1-0528, deepseek/deepseek-r1, deepseek/deepseek-chat-v3.1
• Google Gemini: google/gemini-3.1-pro-preview, google/gemini-3-flash-preview, google/gemini-2.5-pro, google/gemini-2.5-flash, google/gemini-2.5-flash-lite
• Free (OpenRouter): google/gemma-3-27b-it:free, google/gemma-3-12b-it:free, openai/gpt-oss-120b:free, openai/gpt-oss-20b:free

**Model Selection Guide:**
- Best overall: anthropic/claude-sonnet-4.5 or openai/gpt-4.1 (great balance of speed/quality/cost)
- Best for complex reasoning: anthropic/claude-opus-4.7, openai/o3-pro, openai/gpt-5.4-pro
- Best for speed/cost: openai/gpt-4.1-mini, anthropic/claude-haiku-4.5, deepseek/deepseek-chat-v3.1
- Best for coding: openai/gpt-5.3-codex, openai/gpt-5-codex, deepseek/deepseek-v3.2-speciale
- Free options: google/gemma-3-27b-it:free, openai/gpt-oss-120b:free (good for testing/low-priority)

**Runtimes:**
- openclaw (default) — Multi-model orchestration. Best for general business agents, supports all features including tool use.
- hermes — Lightweight task runner. Best for simple, high-volume agents (data processing, notifications).
- opencode — Code-focused runtime. Best for agents that write/review code.
- codex — OpenAI's coding agent runtime. Best for OpenAI-model code agents.
- claude — Anthropic's Claude Code runtime. Best for Anthropic-model code agents.

**Agent Types:**
- main — Primary business operator/leader. Can delegate and manage other agents.
- specialist — Domain expert (e.g. Social Media Manager, Content Writer). Reports to a main agent.
- global — Org-wide utility with no business assignment (e.g. translation, scheduling).

**Safety Modes:**
- ask_before_acting — Safest. Agent asks before sending emails, posting, making changes. Best for new agents or high-stakes roles.
- auto_low_risk — Balanced. Agent runs safe tasks automatically but asks before risky ones. Best for trusted specialists.
- full_auto — Full autonomy. Agent acts without asking. Only for well-tested, low-risk agents.

**Configurable Fields:**
- displayName: Agent's name (2-60 chars)
- emoji: Icon (e.g. 📊, 🎨, 💼)
- role: Short title (2-80 chars)
- purpose: Detailed description of what the agent does
- systemPrompt: Core personality and instructions
- roleInstructions: Specific how-to-do-the-job instructions
- outputStyle: Format preferences (concise, detailed, bullet points, etc.)
- constraints: Hard rules (e.g. "Never share customer data", "Always cite sources")
- escalationRules: When to escalate to the leader or user
- maxTokensPerCall: Token budget (100-200000, default varies by model)

**Best Practices:**
- Always set a fallback model from a different provider than the primary
- Start with ask_before_acting safety mode, upgrade after the agent proves reliable
- Keep systemPrompt focused and concise — long prompts waste tokens every call
- Set appropriate constraints for the role (e.g. financial agents should have spending limits)
- Use escalationRules so specialists know when to involve you (the leader)`;
  }

  // Load connected integrations so the agent knows what's wired up. An
  // organization-scoped integration is visible to every business; a
  // business-scoped integration is only visible when its assignedBusinessIds
  // includes this business.
  //
  // The per-integration behavior hints below are important: without them the
  // agent tends to see a connection it has no direct tool for (e.g. Telegram
  // has no `telegram_send` tool because Telegram usage is inbound-only in
  // this app) and hallucinate that "the MCP connection is broken." The hints
  // tell the agent exactly what each integration means in practice.
  let integrationsSection = "";
  if (organizationId) {
    try {
      const integrations = await db.integration.findMany({
        where: {
          organizationId,
          status: "connected"
        },
        select: {
          key: true,
          name: true,
          description: true,
          scope: true,
          assignedBusinessIds: true
        }
      });

      const visible = integrations.filter((i) => {
        if (i.scope !== "business") return true;
        if (!businessId) return false;
        return (i.assignedBusinessIds ?? []).includes(businessId);
      });

      if (visible.length > 0) {
        const lines = visible.map((i) => {
          const scopeLabel =
            i.scope === "business" ? "this business" : "organization-wide";
          const hint = INTEGRATION_BEHAVIOR_HINTS[i.key];
          const fallback = i.description ? ` — ${i.description}` : "";
          return hint
            ? `- **${i.name}** (${i.key}) [${scopeLabel}] — ${hint}`
            : `- **${i.name}** (${i.key}) [${scopeLabel}]${fallback}`;
        });
        integrationsSection =
          `── CONNECTED INTEGRATIONS ──\n` +
          `These third-party services are already wired up for your business and working correctly. If a user asks whether an integration below is connected, confirm it is — do NOT say you need MCP, a tool install, or any setup step. If a user asks you to USE one, act according to the behavior note next to each entry:\n` +
          lines.join("\n");
      }
    } catch {
      // Integration table unavailable — skip silently
    }
  }

  // Cross-channel awareness: the agent's conversations are tracked per
  // channel (dashboard chat, Telegram thread, etc). Without this block, an
  // agent answering in dashboard chat has no idea what was said in its own
  // Telegram thread and vice versa — and will tell the user "I can only see
  // this conversation." Inject a lightweight summary of the agent's latest
  // exchanges from OTHER channels so cross-channel questions work without a
  // full merged-conversation refactor.
  let crossChannelSection = "";
  try {
    const agentId = agent.id as string | undefined;
    if (agentId) {
      const conversations = await db.conversationLog.findMany({
        where: { agentId },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          channel: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 2,
            select: { role: true, content: true, createdAt: true }
          }
        }
      });

      const lines: string[] = [];
      for (const conv of conversations) {
        if (conv.messages.length === 0) continue;
        const channel = conv.channel ?? "dashboard";
        const label =
          conv.title?.trim() || `${channel} conversation`;
        for (const msg of [...conv.messages].reverse()) {
          const who = msg.role === "user" ? "user" : "you";
          const snippet = safeEllipsize(msg.content, 160);
          lines.push(
            `- [${channel}] ${label} — ${who}: "${snippet.replace(/\n/g, " ")}"`
          );
        }
        if (lines.length >= 10) break;
      }

      if (lines.length > 0) {
        crossChannelSection =
          `── RECENT ACTIVITY ACROSS YOUR CHANNELS ──\n` +
          `These are recent exchanges from your own threads on every channel you're connected to (dashboard, Telegram, etc). If the user asks what was said or what happened in another channel — including "did I message you on Telegram?" — reference these lines directly. Never say "I can only see this conversation" if there's activity listed below.\n\n` +
          lines.join("\n");
      }
    }
  } catch {
    // Conversation table unavailable — skip silently
  }

  // Build tool-aware system prompt
  const toolsDescription = buildToolsDescription(tools);
  const promptParts = [
    systemPrompt,
    teamSection,
    agentBuildingSection,
    toolsDescription,
    integrationsSection,
    crossChannelSection,
    brandAssetsSection,
    memoriesSection
  ].filter(Boolean);
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
