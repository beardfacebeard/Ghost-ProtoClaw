/**
 * Direct LLM provider completion — calls provider APIs without the OpenClaw
 * gateway.  Supports OpenAI, Anthropic, and OpenRouter.  Google is stubbed
 * out for now.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCallMessage[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCallMessage {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface DirectCompletionParams {
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  provider: string;
  timeoutMs?: number;
  maxTokens?: number;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

interface TokenUsageData {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface DirectCompletionResult {
  success: boolean;
  content?: string;
  model?: string;
  latencyMs: number;
  error?: string;
  usage?: TokenUsageData;
  toolCalls?: ToolCallMessage[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;

/** Strip a known provider prefix from a model id (e.g. `openai/gpt-4o` → `gpt-4o`). */
function stripPrefix(model: string, prefix: string): string {
  const lower = model.toLowerCase();
  if (lower.startsWith(`${prefix}/`)) {
    return model.slice(prefix.length + 1);
  }
  return model;
}

/**
 * Map friendly Anthropic model names to actual API model IDs.
 * OpenRouter accepts the friendly names, but Anthropic's API needs the real ones.
 */
const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-opus-4.7": "claude-opus-4-7",
  "claude-sonnet-4.6": "claude-sonnet-4-20250514",
  "claude-opus-4.6": "claude-opus-4-20250514",
  "claude-sonnet-4.5": "claude-sonnet-4-20250514",
  "claude-opus-4.5": "claude-opus-4-20250514",
  "claude-sonnet-4": "claude-sonnet-4-20250514",
  "claude-opus-4": "claude-opus-4-20250514",
  "claude-opus-4.1": "claude-opus-4-20250514",
  "claude-haiku-4.5": "claude-haiku-4-20250414",
  "claude-3.7-sonnet": "claude-3-7-sonnet-20250219",
  "claude-3.5-haiku": "claude-3-5-haiku-20241022",
};

function resolveAnthropicModel(model: string): string {
  const bare = stripPrefix(model, "anthropic");
  return ANTHROPIC_MODEL_MAP[bare] || bare;
}

/** Build an `AbortSignal` that fires after `ms` milliseconds. */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

// ---------------------------------------------------------------------------
// Provider-specific callers
// ---------------------------------------------------------------------------

async function callOpenAI(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  signal: AbortSignal,
  maxTokens?: number,
  tools?: DirectCompletionParams["tools"],
): Promise<DirectCompletionResult & { _start: number }> {
  const start = Date.now();
  const bareModel = stripPrefix(model, "openai");

  const body: Record<string, unknown> = {
    model: bareModel,
    messages,
  };
  if (maxTokens) body.max_tokens = maxTokens;
  if (tools && tools.length > 0) body.tools = tools;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      success: false,
      latencyMs,
      error: `OpenAI API error ${res.status}: ${body}`,
      _start: start,
    };
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message;
  const content: string | undefined = message?.content ?? undefined;
  const toolCalls: ToolCallMessage[] | undefined = message?.tool_calls ?? undefined;

  const usage: TokenUsageData | undefined = json?.usage
    ? {
        promptTokens: json.usage.prompt_tokens ?? 0,
        completionTokens: json.usage.completion_tokens ?? 0,
        totalTokens: json.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    success: true,
    content,
    model: json?.model ?? bareModel,
    latencyMs,
    usage,
    toolCalls,
    _start: start,
  };
}

async function callAnthropic(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  signal: AbortSignal,
  maxTokens?: number,
  tools?: DirectCompletionParams["tools"],
): Promise<DirectCompletionResult & { _start: number }> {
  const start = Date.now();
  const bareModel = resolveAnthropicModel(model);

  // Anthropic requires system prompt in a dedicated field, not in messages.
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const systemText =
    systemMessages.map((m) => m.content).join("\n\n") || undefined;

  // Convert messages — handle tool role for Anthropic format
  const anthropicMessages = nonSystemMessages.map((m) => {
    if (m.role === "tool") {
      // Anthropic expects tool results as user messages with tool_result content
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: m.tool_call_id || "",
            content: m.content
          }
        ]
      };
    }
    if (m.tool_calls && m.tool_calls.length > 0) {
      // Assistant message with tool calls → Anthropic tool_use blocks
      const content: Array<Record<string, unknown>> = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      for (const tc of m.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}")
        });
      }
      return { role: "assistant" as const, content };
    }
    return { role: m.role as "user" | "assistant", content: m.content };
  });

  const body: Record<string, unknown> = {
    model: bareModel,
    max_tokens: maxTokens ?? 4096,
    messages: anthropicMessages,
  };
  if (systemText) {
    body.system = systemText;
  }
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }));
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      success: false,
      latencyMs,
      error: `Anthropic API error ${res.status}: ${text}`,
      _start: start,
    };
  }

  const json = await res.json();

  // Extract text content
  const content: string | undefined =
    json?.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("") || undefined;

  // Extract tool use blocks → convert to OpenAI format for uniform handling
  const toolUseBlocks = (json?.content || []).filter(
    (b: { type: string }) => b.type === "tool_use"
  );
  const toolCalls: ToolCallMessage[] | undefined =
    toolUseBlocks.length > 0
      ? toolUseBlocks.map(
          (b: { id: string; name: string; input: Record<string, unknown> }) => ({
            id: b.id,
            type: "function" as const,
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input)
            }
          })
        )
      : undefined;

  const usage: TokenUsageData | undefined = json?.usage
    ? {
        promptTokens: json.usage.input_tokens ?? 0,
        completionTokens: json.usage.output_tokens ?? 0,
        totalTokens: (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0),
      }
    : undefined;

  return {
    success: true,
    content,
    model: json?.model ?? bareModel,
    latencyMs,
    usage,
    toolCalls,
    _start: start,
  };
}

async function callOpenRouter(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  signal: AbortSignal,
  maxTokens?: number,
  tools?: DirectCompletionParams["tools"],
): Promise<DirectCompletionResult & { _start: number }> {
  const start = Date.now();

  // Strip the "openrouter/" prefix on models we've registered in the
  // selector as explicitly routed through OpenRouter (e.g.
  // "openrouter/anthropic/claude-opus-4.7" → "anthropic/claude-opus-4.7").
  // OpenRouter itself expects the provider/model form without our prefix.
  const bareModel = stripPrefix(model, "openrouter");

  const body: Record<string, unknown> = {
    model: bareModel,
    messages,
  };
  if (maxTokens) body.max_tokens = maxTokens;
  if (tools && tools.length > 0) body.tools = tools;

  // OpenRouter uses the full prefixed model ID (e.g. `openai/gpt-4o`).
  const res = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    },
  );

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      success: false,
      latencyMs,
      error: `OpenRouter API error ${res.status}: ${body}`,
      _start: start,
    };
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message;
  const content: string | undefined = message?.content ?? undefined;
  const toolCalls: ToolCallMessage[] | undefined = message?.tool_calls ?? undefined;

  const usage: TokenUsageData | undefined = json?.usage
    ? {
        promptTokens: json.usage.prompt_tokens ?? 0,
        completionTokens: json.usage.completion_tokens ?? 0,
        totalTokens: json.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    success: true,
    content,
    model: json?.model ?? model,
    latencyMs,
    usage,
    toolCalls,
    _start: start,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function directProviderCompletion(
  params: DirectCompletionParams,
): Promise<DirectCompletionResult> {
  const {
    messages,
    model,
    apiKey,
    provider,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxTokens,
    tools,
  } = params;

  if (!messages?.length) {
    return { success: false, latencyMs: 0, error: "No messages provided." };
  }
  if (!apiKey) {
    return { success: false, latencyMs: 0, error: "No API key provided." };
  }

  const signal = timeoutSignal(timeoutMs);

  try {
    let result: DirectCompletionResult & { _start: number };

    switch (provider) {
      case "openai":
        result = await callOpenAI(messages, model, apiKey, signal, maxTokens, tools);
        break;
      case "anthropic":
        result = await callAnthropic(messages, model, apiKey, signal, maxTokens, tools);
        break;
      case "openrouter":
        result = await callOpenRouter(messages, model, apiKey, signal, maxTokens, tools);
        break;
      case "google":
        return {
          success: false,
          latencyMs: 0,
          error:
            "Google provider is not yet supported for direct completions. Use OpenRouter as a fallback.",
        };
      default:
        return {
          success: false,
          latencyMs: 0,
          error: `Unknown provider "${provider}".`,
        };
    }

    // Strip internal field before returning.
    const { _start: _, ...clean } = result;
    return clean;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        success: false,
        latencyMs: timeoutMs,
        error: `Request timed out after ${timeoutMs}ms.`,
      };
    }

    const message =
      err instanceof Error ? err.message : "Unknown error during LLM call.";
    return { success: false, latencyMs: 0, error: message };
  }
}
