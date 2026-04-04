/**
 * Codex Runtime Adapter
 *
 * Adapter wrapper service for deep orchestration and approval workflows.
 * Implements the RuntimeGateway interface using direct fetch calls to
 * the Codex API endpoints.
 *
 * Env vars:
 *   CODEX_API_URL  — Base URL for the Codex service
 *   CODEX_API_KEY  — Bearer token for authentication
 *
 * Endpoints:
 *   POST /v1/chat/completions  — OpenAI-compatible chat completion
 *   POST /orchestrate           — Deep orchestration agent hook
 *   POST /approve               — Approval handling
 *   GET  /health                — Health check
 */

import type {
  RuntimeGateway,
  RuntimeCompletionRequest,
  RuntimeCompletionResponse,
  RuntimeHealthStatus,
  RuntimeHookRequest,
  RuntimeResult
} from "./gateway";

function getBaseUrl(): string {
  return process.env.CODEX_API_URL ?? "";
}

function getApiKey(): string {
  return process.env.CODEX_API_KEY ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey()}`
  };
}

export class CodexAdapter implements RuntimeGateway {
  readonly id = "codex";
  readonly name = "Codex";

  isConfigured(): boolean {
    return !!(getBaseUrl() && getApiKey());
  }

  async chatCompletion(
    request: RuntimeCompletionRequest,
    timeoutMs = 60_000
  ): Promise<RuntimeResult<RuntimeCompletionResponse>> {
    const start = performance.now();

    try {
      const headers = authHeaders();

      if (request.providerApiKey) {
        headers["x-provider-api-key"] = request.providerApiKey;
      }

      const res = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: request.messages,
          model: request.model,
          stream: request.stream ?? false
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      const latencyMs = performance.now() - start;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `Codex completion failed (${res.status}): ${body}`,
          latencyMs
        };
      }

      const data = await res.json();
      const choice = data.choices?.[0];

      return {
        success: true,
        data: {
          content: choice?.message?.content ?? "",
          model: data.model ?? request.model ?? "unknown",
          finishReason: choice?.finish_reason ?? "unknown",
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
              }
            : undefined
        },
        latencyMs
      };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "Codex completion request failed",
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
      const res = await fetch(`${getBaseUrl()}/orchestrate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          message: request.message,
          sessionKey: request.sessionKey,
          approvalRequired: false
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      const latencyMs = performance.now() - start;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `Codex orchestrate failed (${res.status}): ${body}`,
          latencyMs
        };
      }

      const data = await res.json();

      return {
        success: true,
        data: data as Record<string, unknown>,
        latencyMs
      };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Codex orchestrate request failed",
        latencyMs: performance.now() - start
      };
    }
  }

  async healthCheck(timeoutMs = 5_000): Promise<RuntimeHealthStatus> {
    const start = performance.now();

    try {
      const res = await fetch(`${getBaseUrl()}/health`, {
        method: "GET",
        headers: authHeaders(),
        signal: AbortSignal.timeout(timeoutMs)
      });

      const latencyMs = performance.now() - start;

      if (!res.ok) {
        return {
          healthy: false,
          latencyMs,
          error: `Codex health check failed (${res.status})`
        };
      }

      const data = await res.json().catch(() => ({}));

      return {
        healthy: true,
        latencyMs,
        details: data as Record<string, unknown>
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: performance.now() - start,
        error:
          err instanceof Error ? err.message : "Codex health check failed"
      };
    }
  }
}
