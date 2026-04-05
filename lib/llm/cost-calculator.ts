/**
 * Cost Calculator — estimates USD cost from token counts and model pricing.
 *
 * Uses pricing data from model-definitions.ts. Falls back to conservative
 * defaults when a model isn't in the catalog.
 */

import { getModelById } from "@/lib/models/model-definitions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostEstimate {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

// ---------------------------------------------------------------------------
// Defaults for unknown models (conservative — roughly GPT-4o pricing)
// ---------------------------------------------------------------------------

const DEFAULT_INPUT_COST_PER_1K = 0.005;
const DEFAULT_OUTPUT_COST_PER_1K = 0.015;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate estimated cost in USD for a given token usage and model.
 */
export function calculateCost(
  usage: TokenUsage,
  modelId: string,
): CostEstimate {
  const model = getModelById(modelId);

  const inputRate = model?.inputCostPer1k ?? DEFAULT_INPUT_COST_PER_1K;
  const outputRate = model?.outputCostPer1k ?? DEFAULT_OUTPUT_COST_PER_1K;

  const inputCostUsd = (usage.promptTokens / 1000) * inputRate;
  const outputCostUsd = (usage.completionTokens / 1000) * outputRate;

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

/**
 * Quick estimate for a single call — returns total cost in USD.
 */
export function estimateCostUsd(
  promptTokens: number,
  completionTokens: number,
  modelId: string,
): number {
  return calculateCost(
    { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
    modelId,
  ).totalCostUsd;
}
