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
