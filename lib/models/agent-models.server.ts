/**
 * Server-only agent model helpers that depend on node:crypto via key resolution.
 *
 * Import this file only from server components, API routes, or other server-side code.
 * Never import from client components — use `agent-models.ts` instead.
 */
import { resolveKeyForModel } from "@/lib/keys";
import type { ResolvedKey } from "@/lib/keys";
import { getSystemDefaultModel, resolveAgentModel } from "./agent-models";

type ModelCarrier = {
  primaryModel?: string | null;
  fallbackModel?: string | null;
};

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
