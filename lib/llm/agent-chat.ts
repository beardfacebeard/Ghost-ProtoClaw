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
import { getLogger } from "@/lib/observability/logger";
import { checkPauseState, pauseMessage } from "@/lib/safety/pause-state";

const log = getLogger("agent-chat");
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
import {
  executeTool,
  findToolByName,
  IMPLEMENTED_TOOL_NAMES
} from "@/lib/mcp/tool-executor";
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
  /** Originating conversation id. Threaded into tool calls as
   *  _conversationId so tools like delegate_task can record where to post
   *  results when their downstream work completes. */
  conversationId?: string;
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
 * Sentinel inserted between the stable and volatile portions of the system
 * prompt. The Anthropic adapter (and any future cache-aware adapter) splits
 * on this marker and marks the stable half with cache_control: ephemeral.
 * Exported so the adapter can pick it up without a circular import.
 */
export const CACHE_BOUNDARY = "\n\n<!--__GPC_PROMPT_CACHE_BOUNDARY__-->\n\n";

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

  // ── Global pause check ─────────────────────────────────────────
  // Operator-triggered kill switch. Either Organization.globalPaused or
  // Business.globalPaused short-circuits every agent run before any LLM
  // call is made. Cleared via /api/admin/pause-all.
  const pause = await checkPauseState({
    organizationId,
    businessId: agent.businessId ?? null
  });
  if (pause.paused) {
    return {
      success: false,
      error: "Paused",
      hint: pauseMessage(pause),
      statusCode: 423 // 423 Locked — semantically correct for a hold state.
    };
  }

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

  // Priority 1: Direct provider with tool loop + OpenRouter fallback.
  //
  // The fallback is deliberately "sticky": once the direct provider fails
  // for any reason (e.g. Anthropic 402 / out of credits, transient 5xx,
  // provider key rotated away), we swap activeKey to OpenRouter for the
  // REST of this run's tool loop. Prior implementation only retried on
  // round 0; that left us stuck on a dead provider whenever a tool-loop
  // round after the first failed (exactly the case users hit when their
  // Anthropic budget ran out mid-conversation).
  if (key) {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    let currentMessages = [...messages];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let activeKey: { apiKey: string; provider: string } = key;

    // Lazy-resolved OpenRouter credential, reused across rounds so we don't
    // re-query integrations on every failure.
    let orKeyCache: string | null | undefined;
    async function getOpenRouterKey(): Promise<string | null> {
      if (orKeyCache !== undefined) return orKeyCache;
      const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
      if (fromEnv) {
        orKeyCache = fromEnv;
        return fromEnv;
      }
      const fromIntegration = (
        await resolveKeyForModel("openrouter/any", organizationId)
      )?.apiKey;
      orKeyCache = fromIntegration ?? null;
      return orKeyCache;
    }

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let result = await callWithTools({
        provider: activeKey.provider,
        model: resolvedModel.model,
        apiKey: activeKey.apiKey,
        messages: currentMessages,
        tools: toolSchemas,
        maxTokens: agent.maxTokensPerCall ?? undefined
      });

      // Sticky fallback: any-round failure on a non-OpenRouter provider
      // swaps activeKey to OpenRouter and retries this same round. After
      // the swap subsequent rounds stay on OpenRouter automatically
      // because activeKey was reassigned.
      if (!result.success && activeKey.provider !== "openrouter") {
        const orKey = await getOpenRouterKey();
        if (orKey) {
          log.warn("primary provider failed — sticking to OpenRouter for run", {
            primaryProvider: activeKey.provider,
            primaryError: result.error ?? "unknown",
            agentId: agent.id,
            model: resolvedModel.model
          });
          activeKey = { apiKey: orKey, provider: "openrouter" };
          result = await callWithTools({
            provider: "openrouter",
            model: resolvedModel.model,
            apiKey: orKey,
            messages: currentMessages,
            tools: toolSchemas,
            maxTokens: agent.maxTokensPerCall ?? undefined
          });
        }
      }

      if (!result.success) {
        const totalLatency = Date.now() - startTime;
        logTokenUsage({
          organizationId,
          businessId: agent.businessId,
          agentId: agent.id,
          model: resolvedModel.model,
          provider: activeKey.provider,
          usage: totalUsage,
          endpoint,
          success: false,
          latencyMs: totalLatency
        });

        const triedOpenRouter =
          activeKey.provider === "openrouter" || key.provider === "openrouter";
        return {
          success: false,
          error: result.error || "Agent call failed",
          hint: triedOpenRouter
            ? `Both your primary provider and OpenRouter failed for model "${resolvedModel.model}". Check your API keys in Settings → API Keys and the agent's model choice.`
            : `Call to ${activeKey.provider} failed for "${resolvedModel.model}" and no OpenRouter key was available to fall back. Add your OpenRouter key in Settings → API Keys to enable automatic fallback.`,
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
            businessId: agent.businessId ?? undefined,
            conversationId: input.conversationId
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
        // Log the provider that ACTUALLY served the successful turn, not
        // the original one — activeKey reflects whether we fell back.
        provider: activeKey.provider,
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
  //
  // IMPORTANT: we then filter everything through IMPLEMENTED_TOOL_NAMES so
  // stub tools (handleNotImplemented — database_query, github_*, slack_*,
  // stripe_*, hubspot_*, browser_*, execute_code, reddit_*, crawl_website,
  // read_file/write_file/list_directory) are invisible to the LLM. An agent
  // can't propose or call what it can't see, which is how we stop the CEO
  // from reporting "our database is unavailable" every time the user asks
  // about data.
  let tools: InstalledTool[] = [];
  if (organizationId) {
    const agentType = agent.type as string | undefined;
    const mcpTools =
      agentType === "master"
        ? []
        : await getToolsForAgent(organizationId, businessId ?? null);
    // Extract templateId from the business's config blob so we can gate
    // template-specific built-in tools (Dealhawk Empire's sourcing tools,
    // future templates' specialized tools, etc.) without reaching into
    // the DB a second time.
    const businessConfig = business?.config;
    const templateId =
      businessConfig &&
      typeof businessConfig === "object" &&
      !Array.isArray(businessConfig) &&
      typeof (businessConfig as { templateId?: unknown }).templateId === "string"
        ? ((businessConfig as { templateId: string }).templateId)
        : null;
    // Pass the agent's tools[] array so getBuiltInTools can apply it as a
    // soft whitelist. Editing an agent's tools list in /admin/agents now
    // actually changes what the agent can call at runtime (was previously
    // metadata-only). Core tools (delegation, learning, KB lookup) remain
    // on regardless — see BUILTIN_ALWAYS_ON in tool-registry.
    const agentTools = Array.isArray(agent.tools)
      ? (agent.tools as string[])
      : null;
    const builtInTools = getBuiltInTools({
      type: agentType,
      depth: agent.depth as number | undefined,
      templateId,
      tools: agentTools
    });
    tools = [...mcpTools, ...builtInTools].filter((t) =>
      IMPLEMENTED_TOOL_NAMES.has(t.schema.function.name)
    );
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

  // Load business knowledge items with the three-tier filter:
  //   hot  — always included
  //   warm — included when assignedAgentIds is empty (default "share
  //          with everyone") OR explicitly includes this agent's id
  //   cold — never auto-injected; agent pulls on demand via the
  //          knowledge_lookup tool
  // This keeps agent token budgets under control once businesses grow
  // past the ~10k-token hot-path limit that degrades modern LLMs.
  let knowledgeSection = "";
  let coldCount = 0;
  const currentAgentId = typeof agent.id === "string" ? agent.id : "";
  if (businessId) {
    try {
      const allItems = await db.knowledgeItem.findMany({
        where: { businessId, enabled: true },
        select: {
          title: true,
          category: true,
          content: true,
          tier: true,
          assignedAgentIds: true
        },
        orderBy: [{ tier: "asc" }, { category: "asc" }, { updatedAt: "desc" }],
        take: 200
      });

      coldCount = allItems.filter(
        (item) => String(item.tier ?? "warm") === "cold"
      ).length;

      const items = allItems.filter((item) => {
        const tier = String(item.tier ?? "warm");
        if (tier === "cold") return false;
        if (tier === "hot") return true;
        const assigned = item.assignedAgentIds ?? [];
        if (assigned.length === 0) return true;
        return currentAgentId ? assigned.includes(currentAgentId) : true;
      });

      if (items.length > 0) {
        const grouped = new Map<string, typeof items>();
        for (const item of items) {
          const list = grouped.get(item.category) ?? [];
          list.push(item);
          grouped.set(item.category, list);
        }
        const lines: string[] = [];
        for (const [category, list] of grouped) {
          lines.push(`[${category}]`);
          for (const item of list) {
            const snippet = safeEllipsize(item.content, 400);
            lines.push(`- ${item.title}: ${snippet.replace(/\n+/g, " ")}`);
          }
        }
        const coldNote =
          coldCount > 0
            ? `\n\n(${coldCount} additional reference item${coldCount === 1 ? "" : "s"} available on demand — call knowledge_lookup with a short query when you need deeper info.)`
            : "";
        knowledgeSection =
          `── BUSINESS KNOWLEDGE ──\n` +
          `Facts, policies, offerings, and brand context the operator has recorded for this business. Treat these as authoritative — cite them when the user asks about products, pricing, processes, FAQs, or anything the operator has already documented. Do NOT invent new facts when a knowledge item covers the topic.\n\n` +
          lines.join("\n") +
          coldNote;
      } else if (coldCount > 0) {
        knowledgeSection =
          `── BUSINESS KNOWLEDGE ──\n` +
          `No items are auto-loaded for you, but ${coldCount} reference item${coldCount === 1 ? " is" : "s are"} available on demand. Call knowledge_lookup with a short query when a user question touches products, pricing, policies, or operator-documented facts.`;
      }
    } catch {
      // KnowledgeItem table unavailable — skip silently
    }
  }

  // Load workspace documents the operator has placed in the agent/business's
  // scope (drafts, templates, plans, knowledge docs, etc). Previously
  // admin-only — the /admin/workspace page showed them but the agent never
  // saw them. Now surfaced so the agent can reference docs the operator
  // explicitly put in its workspace.
  let workspaceSection = "";
  if (businessId) {
    try {
      const documents = await db.workspaceDocument.findMany({
        where: {
          businessId,
          // Scope to docs either unattached or attached to this agent, so
          // one agent's "private" docs don't leak to another.
          OR: [
            { agentId: null },
            { agentId: agent.id as string }
          ]
        },
        select: {
          filePath: true,
          category: true,
          content: true,
          tier: true
        },
        orderBy: [{ tier: "asc" }, { updatedAt: "desc" }],
        take: 20
      });

      if (documents.length > 0) {
        const lines = documents.map((doc) => {
          const snippet = safeEllipsize(doc.content, 500);
          return `- ${doc.filePath} [${doc.category}]: ${snippet.replace(/\n+/g, " ")}`;
        });
        workspaceSection =
          `── WORKSPACE DOCUMENTS ──\n` +
          `Documents the operator has placed in your workspace. Reference these when answering — they're part of your working context.\n\n` +
          lines.join("\n");
      }
    } catch {
      // WorkspaceDocument table unavailable — skip silently
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
          ? `\n\nAs ${currentAgentName}, you are the leader of this team. You can:\n- **Delegate tasks** with delegate_task — the delegation executor auto-runs the target agent within ~30 seconds. When it finishes, the system AUTOMATICALLY posts the result back into this conversation (and pushes it to Telegram if the user is chatting there). You do not have to remember to follow up — the runtime handles it.\n- **Check progress** with check_task_status — returns the real status of your delegations. Call this only if the user explicitly asks for progress.\n- **Suggest new agents** with suggest_agent_config, create_agent, edit_agent (user approval required).\n- **Optimize the knowledge base** with list_knowledge_items, get_knowledge_budget, update_knowledge_tiering. Every knowledge item carries a tier: hot = injected into every agent's prompt every turn; warm = injected only for specific assigned agents; cold = never auto-injected, available on demand via knowledge_lookup. Heavier KB = more tokens per turn = slower, pricier, and degraded quality past ~8k tokens. When the user asks you to "optimize tokens" or you notice the budget is heavy, audit with list_knowledge_items + get_knowledge_budget, then retier: keep brand voice and red-line rules HOT, move big SOPs and playbooks to COLD, pin role-specific items (CMO playbooks, Ops SOPs) to the one agent that needs them. ALWAYS explain your reasoning + before/after token numbers before calling update_knowledge_tiering. Never move brand voice or red-line rules to cold — agents need them every turn for compliance.\n\n── HONESTY RULES (non-negotiable) ──\n1. Do NOT fabricate timelines. Never say "results in a few hours," "I've scheduled it for tomorrow," or any ETA you didn't actually compute.\n2. Do NOT claim a tool call succeeded unless its result shows success=true. If a tool returned an error, tell the user the tool failed.\n3. **Never make follow-up promises you cannot keep.** BANNED phrases: "I'll update you", "I'll let you know", "I'll circle back", "I'll report back", "I'll keep you posted", "will reach out shortly". You do not run between turns — those phrases are lies. Instead say: "Queued for <agent> — the result will auto-post here when it lands." The delegation system will actually do it.\n4. When you delegate, describe what you queued and who owns it. Do not imply the agent is already working or will deliver by a specific time unless check_task_status confirms it.\n5. If the user has already rejected an idea (see YOUR MEMORIES), do not re-propose it.\n6. If a required capability is unavailable (tool returned "not implemented", integration not connected), SAY SO rather than pretending the work happened.\n7. **Social posts: third-party accept ≠ platform live.** When social_publish_post or social_list_posts returns success, that means the publishing middleman (Zernio/Ayrshare) accepted the job — NOT that Reddit/LinkedIn/X actually made the post visible. Reddit in particular silently shadow-bans API submissions all the time. BEFORE telling the user a post is "live" or "published on <platform>", you MUST verify: for Reddit, call verify_reddit_post with the returned URL (or reddit_get_user_posts with the account username) and confirm visible=true; for other platforms, tell the user explicitly "Zernio accepted this — please check your profile to confirm it's actually visible." If our internal logs say a post is published but the user reports not seeing it, trust the USER, not the logs. Approving a draft in /admin/approvals is NOT posting; it flips the target to "approved" in /admin/targets where the user marks it "posted" themselves after they've actually posted.`
          : `\n\nYou are part of a team. If a task is outside your area, suggest the user talk to the appropriate team member. Never claim a capability you don't have — say plainly when a tool failed or isn't available. Never promise a follow-up ("I'll update you", "I'll circle back") — you only run when invoked.`;

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

  // Build tool-aware system prompt.
  //
  // Split into a STABLE prefix and a VOLATILE suffix so the Anthropic
  // adapter can mark the stable prefix with cache_control: ephemeral and
  // hit the prompt cache on subsequent turns of the same conversation.
  // OpenAI also caches automatically when prefixes match (>= 1024 tokens),
  // so the same split helps both providers.
  //
  // Stable = base prompt, team roster, tools, integrations, brand assets,
  //          knowledge, workspace docs. These rarely change mid-conversation.
  // Volatile = cross-channel activity + memories. Memories may be written
  //          between turns by the agent or the false-delegation detector;
  //          cross-channel activity updates continuously.
  const toolsDescription = buildToolsDescription(tools);
  const stableParts = [
    systemPrompt,
    teamSection,
    agentBuildingSection,
    toolsDescription,
    integrationsSection,
    brandAssetsSection,
    knowledgeSection,
    workspaceSection
  ].filter(Boolean);
  const volatileParts = [crossChannelSection, memoriesSection].filter(Boolean);
  const stablePromptText = stableParts.join("\n\n");
  const volatilePromptText = volatileParts.join("\n\n");
  const fullSystemPrompt =
    volatilePromptText.length > 0
      ? `${stablePromptText}${CACHE_BOUNDARY}${volatilePromptText}`
      : stablePromptText;

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
