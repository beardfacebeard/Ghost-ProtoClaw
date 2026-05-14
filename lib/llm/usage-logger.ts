/**
 * Token Usage Logger — durable logging of LLM token consumption.
 *
 * Writes to the `TokenUsageLog` table for cost accounting and budget
 * enforcement. The audit (May 2026) flagged the previous fire-and-forget
 * write as a reliability hole: a transient DB blip silently dropped
 * accounting rows, and the same table is read by budget-guard.ts to
 * enforce hardStop — so under-counting means the cap is wrong.
 *
 * New behavior:
 *   - The DB write is awaited inside an inner promise. Failures are
 *     retried once after a short backoff (covers most transient blips).
 *   - On final failure we fall back to console.error so the operator sees
 *     it in the deploy logs, but we never throw — logging must never
 *     break LLM call paths.
 *   - The OUTER call is still non-blocking: callers fire-and-forget by
 *     not awaiting the returned Promise. Awaiting is opt-in for tests
 *     and for places that genuinely need to confirm the row landed.
 */

import { db } from "@/lib/db";
import { getLogger } from "@/lib/observability/logger";

import { estimateCostUsd, type TokenUsage } from "./cost-calculator";

const log = getLogger("usage-logger");

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

const RETRY_DELAY_MS = 500;

async function attemptInsert(params: LogTokenUsageParams, costUsd: number) {
  await db.tokenUsageLog.create({
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
      latencyMs: params.latencyMs ?? null
    }
  });
}

/**
 * Log token usage. Returns a Promise so callers that care can await it,
 * but the standard pattern is fire-and-forget — the function never throws.
 */
export function logTokenUsage(params: LogTokenUsageParams): Promise<void> {
  const costUsd = estimateCostUsd(
    params.usage.promptTokens,
    params.usage.completionTokens,
    params.model
  );

  return (async () => {
    try {
      await attemptInsert(params, costUsd);
    } catch (firstErr) {
      // One retry after a short delay covers connection blips, lock
      // contention, and brief Prisma reconnects. If the retry also fails
      // we surface to the logs so the operator can investigate.
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      try {
        await attemptInsert(params, costUsd);
      } catch (secondErr) {
        log.error("dropped TokenUsageLog row after retry", {
          model: params.model,
          endpoint: params.endpoint,
          organizationId: params.organizationId,
          businessId: params.businessId,
          costUsd,
          err: secondErr,
          firstErr:
            firstErr instanceof Error ? firstErr.message : String(firstErr)
        });
      }
    }
  })();
}
