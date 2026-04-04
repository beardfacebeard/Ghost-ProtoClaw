/**
 * Claude Code Runtime Adapter
 *
 * Implements the RuntimeGateway interface for the Claude Code SDK wrapper
 * service, targeting code-heavy agents and technical work.
 *
 * Env vars:
 *   CLAUDE_CODE_API_URL  — base URL of the Claude Code service
 *   CLAUDE_CODE_API_KEY  — bearer token for authentication
 */

import type {
  RuntimeGateway,
  RuntimeCompletionRequest,
  RuntimeCompletionResponse,
  RuntimeHealthStatus,
  RuntimeHookRequest,
  RuntimeResult
} from "./gateway";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getBaseUrl(): string {
  return process.env.CLAUDE_CODE_API_URL ?? "";
}

function getApiKey(): string {
  return process.env.CLAUDE_CODE_API_KEY ?? "";
}

/* ------------------------------------------------------------------ */
/*  Adapter                                                           */
/* ------------------------------------------------------------------ */

export class ClaudeCodeAdapter implements RuntimeGateway {
  readonly id = "claude";
  readonly name = "Claude Code";

  isConfigured(): boolean {
    return !!(getBaseUrl() && getApiKey());
  }

  async chatCompletion(
    request: RuntimeCompletionRequest,
    timeoutMs = 60_000
  ): Promise<RuntimeResult<RuntimeCompletionResponse>> {
    const start = performance.now();

    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`
        },
        body: JSON.stringify({
          model: request.model ?? "claude-sonnet-4-20250514",
          messages: request.messages,
          stream: request.stream ?? false
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      const latencyMs = performance.now() - start;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `Claude Code returned ${res.status}: ${body}`,
          latencyMs
        };
      }

      const json = await res.json();
      const choice = json.choices?.[0];

      return {
        success: true,
        data: {
          content: choice?.message?.content ?? "",
          model: json.model ?? request.model ?? "claude-sonnet-4-20250514",
          finishReason: choice?.finish_reason ?? "unknown",
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens,
                completionTokens: json.usage.completion_tokens,
                totalTokens: json.usage.total_tokens
              }
            : undefined
        },
        latencyMs
      };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Claude Code request failed",
        latencyMs: performance.now() - start
      };
    }
  }

  async hookAgent(
    request: RuntimeHookRequest,
    timeoutMs = 30_000
  ): Promise<RuntimeResult<Record<string, unknown>>> {
    const start = performance.now();

    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`
        },
        body: JSON.stringify({
          message: request.message,
          sessionKey: request.sessionKey
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      const latencyMs = performance.now() - start;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `Claude Code /execute returned ${res.status}: ${body}`,
          latencyMs
        };
      }

      const data = await res.json();

      return {
        success: true,
        data,
        latencyMs
      };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Claude Code hook execution failed",
        latencyMs: performance.now() - start
      };
    }
  }

  async healthCheck(timeoutMs = 5_000): Promise<RuntimeHealthStatus> {
    const start = performance.now();

    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getApiKey()}`
        },
        signal: AbortSignal.timeout(timeoutMs)
      });

      const latencyMs = performance.now() - start;

      if (!res.ok) {
        return {
          healthy: false,
          latencyMs,
          error: `Claude Code health check returned ${res.status}`
        };
      }

      const data = await res.json();

      return {
        healthy: true,
        latencyMs,
        details: data
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: performance.now() - start,
        error:
          err instanceof Error
            ? err.message
            : "Claude Code health check failed"
      };
    }
  }
}
