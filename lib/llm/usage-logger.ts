/**
 * Token Usage Logger — fire-and-forget logging of LLM token consumption.
 *
 * Writes to the `TokenUsageLog` table without blocking the main request.
 * Errors are silently caught to ensure logging never breaks LLM calls.
 */

import { db } from "@/lib/db";

import { estimateCostUsd, type TokenUsage } from "./cost-calculator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogTokenUsageParams {
  organizationId: string;
  businessId?: string | null;
  agentId?: string | null;
  model: string;
  provider: string;
  usage: TokenUsage;
  endpoint?: string;
  success?: boolean;
  latencyMs?: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log token usage in a fire-and-forget manner.
 *
 * This function returns immediately — the database write happens
 * asynchronously. Errors are silently swallowed so that logging
 * never interferes with the main request flow.
 */
export function logTokenUsage(params: LogTokenUsageParams): void {
  const costUsd = estimateCostUsd(
    params.usage.promptTokens,
    params.usage.completionTokens,
    params.model,
  );

  // Fire-and-forget — don't await
  db.tokenUsageLog
    .create({
      data: {
        organizationId: params.organizationId,
        businessId: params.businessId ?? null,
        agentId: params.agentId ?? null,
        model: params.model,
        provider: params.provider,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
        totalTokens: params.usage.totalTokens,
        estimatedCostUsd: costUsd,
        endpoint: params.endpoint ?? null,
        success: params.success ?? true,
        latencyMs: params.latencyMs ?? null,
      },
    })
    .catch((err) => {
      // Silently log — never throw from fire-and-forget
      console.error("[usage-logger] Failed to log token usage:", err?.message);
    });
}
