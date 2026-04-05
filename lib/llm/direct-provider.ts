/**
 * Direct LLM provider completion — calls provider APIs without the OpenClaw
 * gateway.  Supports OpenAI, Anthropic, and OpenRouter.  Google is stubbed
 * out for now.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DirectCompletionParams {
  messages: ChatMessage[];
  model: string;
  apiKey: string;
  provider: string;
  timeoutMs?: number;
}

interface DirectCompletionResult {
  success: boolean;
  content?: string;
  model?: string;
  latencyMs: number;
  error?: string;
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
): Promise<DirectCompletionResult & { _start: number }> {
  const start = Date.now();
  const bareModel = stripPrefix(model, "openai");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: bareModel,
      messages,
    }),
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
  const content: string | undefined =
    json?.choices?.[0]?.message?.content ?? undefined;

  return {
    success: true,
    content,
    model: json?.model ?? bareModel,
    latencyMs,
    _start: start,
  };
}

async function callAnthropic(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<DirectCompletionResult & { _start: number }> {
  const start = Date.now();
  const bareModel = stripPrefix(model, "anthropic");

  // Anthropic requires system prompt in a dedicated field, not in messages.
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const systemText =
    systemMessages.map((m) => m.content).join("\n\n") || undefined;

  const body: Record<string, unknown> = {
    model: bareModel,
    max_tokens: 4096,
    messages: nonSystemMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };
  if (systemText) {
    body.system = systemText;
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
  // Anthropic returns content as an array of content blocks.
  const content: string | undefined =
    json?.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("") || undefined;

  return {
    success: true,
    content,
    model: json?.model ?? bareModel,
    latencyMs,
    _start: start,
  };
}

async function callOpenRouter(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<DirectCompletionResult & { _start: number }> {
  const start = Date.now();

  // OpenRouter uses the full prefixed model ID (e.g. `openai/gpt-4o`).
  const res = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
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
  const content: string | undefined =
    json?.choices?.[0]?.message?.content ?? undefined;

  return {
    success: true,
    content,
    model: json?.model ?? model,
    latencyMs,
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
        result = await callOpenAI(messages, model, apiKey, signal);
        break;
      case "anthropic":
        result = await callAnthropic(messages, model, apiKey, signal);
        break;
      case "openrouter":
        result = await callOpenRouter(messages, model, apiKey, signal);
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
