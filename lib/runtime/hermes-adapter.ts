/**
 * Hermes Runtime Adapter
 *
 * Connects to a Hermes Railway service that exposes an OpenAI-compatible
 * API for task-based agents and scheduled jobs.
 *
 * Env vars:
 *   HERMES_API_URL  — base URL of the Hermes service (e.g. https://hermes.up.railway.app)
 *   HERMES_API_KEY  — bearer token for authentication
 */

import type {
  RuntimeGateway,
  RuntimeCompletionRequest,
  RuntimeCompletionResponse,
  RuntimeHealthStatus,
  RuntimeHookRequest,
  RuntimeResult,
} from "./gateway";

function getBaseUrl(): string {
  return (process.env.HERMES_API_URL ?? "").replace(/\/+$/, "");
}

function getApiKey(): string {
  return process.env.HERMES_API_KEY ?? "";
}

export class HermesAdapter implements RuntimeGateway {
  readonly id = "hermes";
  readonly name = "Hermes";

  isConfigured(): boolean {
    return Boolean(getBaseUrl() && getApiKey());
  }

  async chatCompletion(
    request: RuntimeCompletionRequest,
    timeoutMs = 60_000
  ): Promise<RuntimeResult<RuntimeCompletionResponse>> {
    const start = performance.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      };

      if (request.providerApiKey) {
        headers["x-provider-api-key"] = request.providerApiKey;
      }

      const res = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.model ?? "default",
          messages: request.messages,
          stream: request.stream ?? false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `Hermes ${res.status}: ${body || res.statusText}`,
          latencyMs,
        };
      }

      const json = await res.json();
      const choice = json.choices?.[0];

      return {
        success: true,
        data: {
          content: choice?.message?.content ?? "",
          model: json.model ?? request.model ?? "unknown",
          finishReason: choice?.finish_reason ?? "unknown",
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens ?? 0,
                completionTokens: json.usage.completion_tokens ?? 0,
                totalTokens: json.usage.total_tokens ?? 0,
              }
            : undefined,
        },
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const message =
        err instanceof DOMException && err.name === "TimeoutError"
          ? `Hermes request timed out after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : "Unknown Hermes error";

      return { success: false, error: message, latencyMs };
    }
  }

  async hookAgent(
    request: RuntimeHookRequest,
    timeoutMs = 30_000
  ): Promise<RuntimeResult<Record<string, unknown>>> {
    const start = performance.now();

    try {
      // Hermes has no dedicated hooks/agent endpoint.
      // We simulate it by sending a chat completion with a system prompt
      // instructing the model to act as a hook executor.
      const res = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
          model: "default",
          messages: [
            {
              role: "system",
              content:
                "You are a workflow hook executor. Process the following task and return a JSON object with the results. Always respond with valid JSON.",
            },
            {
              role: "user",
              content: request.message,
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          success: false,
          error: `Hermes hook ${res.status}: ${body || res.statusText}`,
          latencyMs,
        };
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content ?? "{}";

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { raw: content };
      }

      return { success: true, data: parsed, latencyMs };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const message =
        err instanceof DOMException && err.name === "TimeoutError"
          ? `Hermes hook timed out after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : "Unknown Hermes hook error";

      return { success: false, error: message, latencyMs };
    }
  }

  async healthCheck(timeoutMs = 5_000): Promise<RuntimeHealthStatus> {
    const start = performance.now();

    if (!this.isConfigured()) {
      return {
        healthy: false,
        latencyMs: 0,
        error: "Hermes is not configured (HERMES_API_URL or HERMES_API_KEY missing)",
      };
    }

    try {
      const res = await fetch(`${getBaseUrl()}/health`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok) {
        return {
          healthy: false,
          latencyMs,
          error: `Hermes health endpoint returned ${res.status}`,
        };
      }

      const details = await res.json().catch(() => ({}));

      return { healthy: true, latencyMs, details };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const message =
        err instanceof DOMException && err.name === "TimeoutError"
          ? `Hermes health check timed out after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : "Unknown error";

      return { healthy: false, latencyMs, error: message };
    }
  }
}
