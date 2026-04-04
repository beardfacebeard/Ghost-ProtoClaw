import { resolveKeyForModel } from "@/lib/keys";
import type { ResolvedKey } from "@/lib/keys";

export type ModelSource = "agent" | "business" | "system";

type ModelCarrier = {
  primaryModel?: string | null;
  fallbackModel?: string | null;
};

export function getSystemDefaultModel() {
  return process.env.DEFAULT_MODEL?.trim() || "openai/gpt-4o";
}

export function resolveAgentModel(
  agent: ModelCarrier,
  business: ModelCarrier | null,
  systemDefault: string
) {
  const primary = agent.primaryModel?.trim();
  const businessPrimary = business?.primaryModel?.trim();
  const fallback = agent.fallbackModel?.trim();
  const businessFallback = business?.fallbackModel?.trim();

  const model = primary || businessPrimary || systemDefault;
  const source: ModelSource =
    primary ? "agent" : businessPrimary ? "business" : "system";

  const fallbackModel = fallback || businessFallback || systemDefault;
  const fallbackSource: ModelSource =
    fallback ? "agent" : businessFallback ? "business" : "system";

  return {
    model,
    source,
    fallbackModel,
    fallbackSource
  };
}

/**
 * Resolves the agent model **and** the API key needed to call it.
 *
 * Uses the standard resolution chain: agent → business → system default,
 * then looks up the provider key via org DB → env → OpenRouter fallback.
 */
export async function resolveAgentModelWithKey(
  agent: ModelCarrier,
  business: ModelCarrier | null,
  organizationId: string
) {
  const systemDefault = getSystemDefaultModel();
  const resolution = resolveAgentModel(agent, business, systemDefault);

  let resolvedKey: ResolvedKey | null = null;

  if (organizationId) {
    resolvedKey = await resolveKeyForModel(resolution.model, organizationId);
  }

  return {
    ...resolution,
    providerApiKey: resolvedKey?.apiKey ?? undefined,
    keySource: resolvedKey?.source ?? null,
    keyProvider: resolvedKey?.provider ?? null
  };
}
