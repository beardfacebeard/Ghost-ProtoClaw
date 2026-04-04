export { providerForModel } from "./provider-for-model";
export type { Provider } from "./provider-for-model";

export { resolveApiKey, clearKeyCache } from "./resolve";
export type { KeySource, ResolvedKey } from "./resolve";

// ---------------------------------------------------------------------------
// Convenience helper
// ---------------------------------------------------------------------------

import { providerForModel } from "./provider-for-model";
import { resolveApiKey } from "./resolve";
import type { ResolvedKey } from "./resolve";

/**
 * One-call helper that maps a model ID to its provider and then resolves
 * an API key using the standard priority chain (org DB -> env -> OpenRouter
 * fallback).
 */
export async function resolveKeyForModel(
  model: string,
  organizationId: string
): Promise<ResolvedKey | null> {
  const provider = providerForModel(model);
  return resolveApiKey({ provider, organizationId });
}
