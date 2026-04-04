/**
 * OpenClaw Runtime Adapter
 *
 * Wraps the existing OpenClaw gateway client (lib/openclaw/client.ts)
 * to implement the RuntimeGateway interface.
 */

import type {
  RuntimeGateway,
  RuntimeCompletionRequest,
  RuntimeCompletionResponse,
  RuntimeHealthStatus,
  RuntimeHookRequest,
  RuntimeResult
} from "./gateway";

import {
  chatCompletion,
  hooksAgent,
  healthCheck,
  isConfigured
} from "@/lib/openclaw/client";

export class OpenClawAdapter implements RuntimeGateway {
  readonly id = "openclaw";
  readonly name = "OpenClaw";

  isConfigured(): boolean {
    return isConfigured();
  }

  async chatCompletion(
    request: RuntimeCompletionRequest,
    timeoutMs = 60_000
  ): Promise<RuntimeResult<RuntimeCompletionResponse>> {
    const result = await chatCompletion(
      {
        messages: request.messages,
        model: request.model,
        backendModel: request.model,
        agentId: request.agentId,
        sessionKey: request.sessionKey,
        stream: request.stream,
        providerApiKey: request.providerApiKey
      },
      timeoutMs
    );

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error ?? "OpenClaw request failed",
        latencyMs: result.latencyMs
      };
    }

    const choice = result.data.choices[0];

    return {
      success: true,
      data: {
        content: choice?.message.content ?? "",
        model: result.data.model,
        finishReason: choice?.finish_reason ?? "unknown",
        usage: result.data.usage
          ? {
              promptTokens: result.data.usage.prompt_tokens,
              completionTokens: result.data.usage.completion_tokens,
              totalTokens: result.data.usage.total_tokens
            }
          : undefined
      },
      latencyMs: result.latencyMs
    };
  }

  async hookAgent(
    request: RuntimeHookRequest,
    timeoutMs = 30_000
  ): Promise<RuntimeResult<Record<string, unknown>>> {
    return hooksAgent(
      {
        message: request.message,
        sessionKey: request.sessionKey
      },
      timeoutMs
    );
  }

  async healthCheck(timeoutMs = 5_000): Promise<RuntimeHealthStatus> {
    const result = await healthCheck(timeoutMs);

    return {
      healthy: result.success,
      latencyMs: result.latencyMs,
      error: result.error,
      details: result.data
    };
  }
}
