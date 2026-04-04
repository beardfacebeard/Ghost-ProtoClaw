export type Provider = "openrouter" | "openai" | "anthropic" | "google";

/**
 * Maps a model ID string to the provider that serves it.
 *
 * Uses prefix conventions (e.g. `openai/gpt-4o`) and well-known model name
 * patterns. Falls back to `"openrouter"` for unrecognised models so they can
 * still be routed through the OpenRouter aggregator.
 */
export function providerForModel(model: string): Provider {
  const lower = model.toLowerCase();

  // Explicit provider prefix takes priority
  if (lower.startsWith("openai/")) return "openai";
  if (lower.startsWith("anthropic/")) return "anthropic";
  if (lower.startsWith("google/")) return "google";
  if (lower.startsWith("openrouter/")) return "openrouter";

  // Well-known model name patterns
  if (
    lower.startsWith("gpt-") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("o4")
  ) {
    return "openai";
  }

  if (lower.startsWith("claude-")) return "anthropic";
  if (lower.startsWith("gemini")) return "google";

  // Default: route through OpenRouter
  return "openrouter";
}
