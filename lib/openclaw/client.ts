/**
 * OpenClaw Gateway Client
 *
 * Wraps the real OpenClaw HTTP API surface:
 *   - POST /v1/chat/completions  (OpenAI-compatible agent messaging)
 *   - POST /hooks/agent           (isolated agent turns for workflows)
 *   - POST /hooks/wake            (enqueue system events)
 *   - POST /tools/invoke          (invoke a specific tool)
 *   - GET  /health                (gateway health check)
 *
 * Auth: Bearer token via OPENCLAW_GATEWAY_TOKEN env var.
 * Default port: 18789 (configurable via OPENCLAW_GATEWAY_URL).
 *
 * @see https://docs.openclaw.ai/gateway/openai-http-api
 * @see https://docs.openclaw.ai/gateway/tools-invoke-http-api
 * @see https://docs.openclaw.ai/automation/cron-jobs
 */

import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function getGatewayUrl(): string | null {
  const url =
    process.env.OPENCLAW_API_URL?.trim() ||
    process.env.OPENCLAW_GATEWAY_URL?.trim() ||
    null;

  return url ? url.replace(/\/$/, "") : null;
}

function loadGatewayToken(): string | null {
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (envToken) return envToken;

  const tokenFile = process.env.OPENCLAW_GATEWAY_TOKEN_FILE?.trim();
  if (tokenFile) {
    try {
      return readFileSync(tokenFile, "utf-8").trim();
    } catch {
      return null;
    }
  }

  return null;
}

let cachedToken: string | null | undefined;

export function getGatewayToken(): string | null {
  if (cachedToken === undefined) {
    cachedToken = loadGatewayToken();
  }
  return cachedToken;
}

/** Clears the cached token so it will be reloaded on next call. */
export function clearTokenCache() {
  cachedToken = undefined;
}

function authHeaders(): Record<string, string> {
  const token = getGatewayToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isConfigured(): boolean {
  const url = getGatewayUrl();
  // Require both a real URL (not just "https://") and a token
  return url !== null && url.length > 10 && getGatewayToken() !== null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** OpenAI-format tool calls from assistant messages */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** Tool result reference — matches a tool_call id */
  tool_call_id?: string;
  /** Tool name for tool result messages */
  name?: string;
};

export type ChatCompletionRequest = {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  /** Override backend model (bypasses agent-level routing). */
  backendModel?: string;
  /** Target a specific OpenClaw agent by id. */
  agentId?: string;
  /** Session key for context persistence. */
  sessionKey?: string;
  /** Pre-resolved provider API key for passthrough to the gateway. */
  providerApiKey?: string;
};

export type ChatCompletionChoice = {
  index: number;
  message: {
    role: "assistant";
    content: string;
  };
  finish_reason: string;
};

export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type HooksAgentRequest = {
  /** The prompt/instruction for the isolated agent turn. */
  message: string;
  /** Optional session key. Defaults to a new isolated session. */
  sessionKey?: string;
};

export type ToolInvokeRequest = {
  tool: string;
  action?: string;
  args?: Record<string, unknown>;
  sessionKey?: string;
};

export type OpenClawResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  latencyMs: number;
};

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Send a chat completion request to the OpenClaw gateway.
 * This is the primary way to interact with OpenClaw agents.
 *
 * Maps to: POST /v1/chat/completions
 */
export async function chatCompletion(
  request: ChatCompletionRequest,
  timeoutMs = 60_000
): Promise<OpenClawResult<ChatCompletionResponse>> {
  const url = getGatewayUrl();
  if (!url) {
    return { success: false, error: "OpenClaw not configured", latencyMs: 0 };
  }

  const startedAt = performance.now();

  try {
    const extraHeaders: Record<string, string> = {};
    if (request.backendModel) {
      extraHeaders["x-openclaw-model"] = request.backendModel;
    }
    if (request.agentId) {
      extraHeaders["x-openclaw-agent-id"] = request.agentId;
    }
    if (request.sessionKey) {
      extraHeaders["x-openclaw-session-key"] = request.sessionKey;
    }
    if (request.providerApiKey) {
      extraHeaders["x-provider-api-key"] = request.providerApiKey;
    }

    const response = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...extraHeaders
      },
      body: JSON.stringify({
        model: request.model ?? "openclaw/default",
        messages: request.messages,
        stream: request.stream ?? false
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let errorMessage = `OpenClaw returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
        errorMessage = parsed.error?.message || parsed.message || errorMessage;
      } catch {
        if (body) errorMessage = body.slice(0, 200);
      }

      return { success: false, error: errorMessage, latencyMs };
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return { success: true, data, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to reach OpenClaw",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

/**
 * Trigger an isolated agent turn via the hooks API.
 * Used for workflow execution and async tasks.
 *
 * Maps to: POST /hooks/agent
 */
export async function hooksAgent(
  request: HooksAgentRequest,
  timeoutMs = 30_000
): Promise<OpenClawResult<Record<string, unknown>>> {
  const url = getGatewayUrl();
  if (!url) {
    return { success: false, error: "OpenClaw not configured", latencyMs: 0 };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(`${url}/hooks/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify({
        message: request.message,
        ...(request.sessionKey ? { sessionKey: request.sessionKey } : {})
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `Hooks agent returned HTTP ${response.status}: ${body.slice(0, 200)}`,
        latencyMs
      };
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { success: true, data, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to reach OpenClaw hooks",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

/**
 * Enqueue a system event via the wake hook.
 *
 * Maps to: POST /hooks/wake
 */
export async function hooksWake(
  payload: Record<string, unknown>,
  timeoutMs = 10_000
): Promise<OpenClawResult<Record<string, unknown>>> {
  const url = getGatewayUrl();
  if (!url) {
    return { success: false, error: "OpenClaw not configured", latencyMs: 0 };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(`${url}/hooks/wake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `Hooks wake returned HTTP ${response.status}: ${body.slice(0, 200)}`,
        latencyMs
      };
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { success: true, data, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to reach OpenClaw hooks",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

/**
 * Invoke a specific tool on the OpenClaw gateway.
 *
 * Maps to: POST /tools/invoke
 */
export async function toolsInvoke(
  request: ToolInvokeRequest,
  timeoutMs = 30_000
): Promise<OpenClawResult<Record<string, unknown>>> {
  const url = getGatewayUrl();
  if (!url) {
    return { success: false, error: "OpenClaw not configured", latencyMs: 0 };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(`${url}/tools/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      },
      body: JSON.stringify({
        tool: request.tool,
        action: request.action ?? "json",
        args: request.args ?? {},
        sessionKey: request.sessionKey ?? "main"
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `Tools invoke returned HTTP ${response.status}: ${body.slice(0, 200)}`,
        latencyMs
      };
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { success: true, data, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to reach OpenClaw",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}

/**
 * Check if the OpenClaw gateway is reachable.
 *
 * Maps to: GET /health
 */
export async function healthCheck(
  timeoutMs = 5_000
): Promise<OpenClawResult<Record<string, unknown>>> {
  const url = getGatewayUrl();
  if (!url) {
    return { success: false, error: "OpenClaw not configured", latencyMs: 0 };
  }

  const startedAt = performance.now();

  try {
    const response = await fetch(`${url}/health`, {
      method: "GET",
      cache: "no-store",
      headers: authHeaders(),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      return {
        success: false,
        error: `OpenClaw returned HTTP ${response.status}`,
        latencyMs
      };
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { success: true, data, latencyMs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to reach OpenClaw",
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }
}
