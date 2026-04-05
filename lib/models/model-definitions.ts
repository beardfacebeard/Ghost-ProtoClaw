export type ModelDefinition = {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google" | "deepseek" | "openrouter" | "custom";
  description: string;
  contextWindow: number;
  inputCostPer1k?: number;
  outputCostPer1k?: number;
  capabilities: string[];
  recommended?: boolean;
  free?: boolean;
  requiresKey: string;
  tags: string[];
};

// ---------------------------------------------------------------------------
// All model IDs verified against OpenRouter /api/v1/models — April 2026
// ---------------------------------------------------------------------------

export const SUPPORTED_MODELS: ModelDefinition[] = [
  // -------------------------------------------------------------------------
  // OpenAI — GPT-5 series
  // -------------------------------------------------------------------------
  {
    id: "openai/gpt-5.4",
    name: "GPT-5.4",
    provider: "openai",
    description: "Latest OpenAI flagship — frontier multimodal intelligence and reasoning.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "latest", "premium"]
  },
  {
    id: "openai/gpt-5.4-pro",
    name: "GPT-5.4 Pro",
    provider: "openai",
    description: "Extended GPT-5.4 with higher limits for complex, long-running tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.02,
    outputCostPer1k: 0.08,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "premium", "complex"]
  },
  {
    id: "openai/gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    provider: "openai",
    description: "Fast, cost-efficient GPT-5.4 variant for everyday tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.008,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["fast", "budget"]
  },
  {
    id: "openai/gpt-5.3-chat",
    name: "GPT-5.3 Chat",
    provider: "openai",
    description: "GPT-5.3 optimized for conversational interactions.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "premium"]
  },
  {
    id: "openai/gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    provider: "openai",
    description: "GPT-5.3 optimized for code generation, debugging, and technical tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "code", "premium"]
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description: "GPT-5 — advanced multimodal reasoning and long context.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "premium"]
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Compact GPT-5 for fast, affordable tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.008,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["fast", "budget"]
  },
  {
    id: "openai/gpt-5-codex",
    name: "GPT-5 Codex",
    provider: "openai",
    description: "GPT-5 optimized for code generation and technical tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["code", "premium"]
  },

  // -------------------------------------------------------------------------
  // OpenAI — GPT-4 series
  // -------------------------------------------------------------------------
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "Latest GPT-4 generation — strong coding and instruction following.",
    contextWindow: 1000000,
    inputCostPer1k: 0.002,
    outputCostPer1k: 0.008,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["balanced", "coding"]
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Fast, affordable GPT-4.1 for day-to-day automation.",
    contextWindow: 1000000,
    inputCostPer1k: 0.0004,
    outputCostPer1k: 0.0016,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["budget", "fast"]
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Ultra-fast, ultra-cheap for simple classification and routing.",
    contextWindow: 1000000,
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0.0004,
    capabilities: ["chat", "function_calling"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["budget", "fast", "cheap"]
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Fast flagship multimodal model — great for business operations.",
    contextWindow: 128000,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["multimodal", "balanced"]
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Fast, affordable option for day-to-day automation and support.",
    contextWindow: 128000,
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["budget", "fast", "multimodal"]
  },

  // -------------------------------------------------------------------------
  // OpenAI — Reasoning models
  // -------------------------------------------------------------------------
  {
    id: "openai/o4-mini",
    name: "o4 Mini",
    provider: "openai",
    description: "Latest reasoning model — fast, cost-effective multi-step analysis.",
    contextWindow: 200000,
    inputCostPer1k: 0.0011,
    outputCostPer1k: 0.0044,
    capabilities: ["chat", "function_calling", "code"],
    recommended: true,
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "latest", "budget"]
  },
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    description: "Advanced reasoning model for complex analysis and problem solving.",
    contextWindow: 200000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "flagship", "premium"]
  },
  {
    id: "openai/o3-pro",
    name: "o3 Pro",
    provider: "openai",
    description: "Extended reasoning with higher compute for the hardest problems.",
    contextWindow: 200000,
    inputCostPer1k: 0.02,
    outputCostPer1k: 0.08,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "premium", "complex"]
  },
  {
    id: "openai/o3-mini",
    name: "o3 Mini",
    provider: "openai",
    description: "Cost-efficient reasoning for structured analysis tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.0011,
    outputCostPer1k: 0.0044,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "budget"]
  },
  {
    id: "openai/o1",
    name: "o1",
    provider: "openai",
    description: "Deep reasoning model — excels at math, science, and complex logic.",
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.06,
    capabilities: ["chat", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "premium"]
  },
  {
    id: "openai/o1-pro",
    name: "o1 Pro",
    provider: "openai",
    description: "Extended o1 with more compute for the hardest reasoning tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.15,
    outputCostPer1k: 0.6,
    capabilities: ["chat", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "premium", "complex"]
  },

  // -------------------------------------------------------------------------
  // Anthropic — Claude 4 series
  // -------------------------------------------------------------------------
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Current Anthropic flagship — best-in-class reasoning, writing, and code.",
    contextWindow: 200000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "vision", "code"],
    recommended: true,
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["flagship", "reasoning", "writing", "latest"]
  },
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description: "Most powerful Anthropic model — sustained performance on complex tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    capabilities: ["chat", "vision", "code"],
    recommended: true,
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["premium", "flagship", "complex", "latest"]
  },
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Strong reasoning and writing model — reliable for business operations.",
    contextWindow: 200000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["reasoning", "writing", "premium"]
  },
  {
    id: "anthropic/claude-opus-4.5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "High-capability model for demanding analysis and workflows.",
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["premium", "complex"]
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "Solid Claude model — reliable reasoning and coding at good value.",
    contextWindow: 200000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["reasoning", "writing"]
  },
  {
    id: "anthropic/claude-opus-4",
    name: "Claude Opus 4",
    provider: "anthropic",
    description: "High-capability Claude model for complex, sustained tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["premium", "complex"]
  },
  {
    id: "anthropic/claude-opus-4.1",
    name: "Claude Opus 4.1",
    provider: "anthropic",
    description: "Upgraded Opus — strong for long-running agentic tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["premium", "complex"]
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and cost-efficient Claude for lighter tasks and high volume.",
    contextWindow: 200000,
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.004,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["fast", "budget"]
  },
  {
    id: "anthropic/claude-3.7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "anthropic",
    description: "Previous-gen Claude with extended thinking capabilities.",
    contextWindow: 200000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["reasoning", "writing"]
  },
  {
    id: "anthropic/claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    description: "Fast, cheap Claude for simple tasks and routing.",
    contextWindow: 200000,
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.004,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["fast", "budget", "cheap"]
  },

  // -------------------------------------------------------------------------
  // DeepSeek
  // -------------------------------------------------------------------------
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    description: "Latest DeepSeek flagship — strong coding, math, and general reasoning.",
    contextWindow: 163840,
    inputCostPer1k: 0.0003,
    outputCostPer1k: 0.0012,
    capabilities: ["chat", "function_calling", "code"],
    recommended: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["flagship", "latest", "budget", "coding"]
  },
  {
    id: "deepseek/deepseek-v3.2-speciale",
    name: "DeepSeek V3.2 Speciale",
    provider: "deepseek",
    description: "Enhanced V3.2 variant with improved instruction following.",
    contextWindow: 163840,
    inputCostPer1k: 0.0003,
    outputCostPer1k: 0.0012,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["flagship", "coding"]
  },
  {
    id: "deepseek/deepseek-r1-0528",
    name: "DeepSeek R1",
    provider: "deepseek",
    description: "Deep reasoning model — competitive with o1/o3 at a fraction of the cost.",
    contextWindow: 163840,
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.002,
    capabilities: ["chat", "code"],
    recommended: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["reasoning", "budget", "flagship"]
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1 (Original)",
    provider: "deepseek",
    description: "Original R1 reasoning model — great value for complex analysis.",
    contextWindow: 64000,
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.002,
    capabilities: ["chat", "code"],
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["reasoning", "budget"]
  },
  {
    id: "deepseek/deepseek-chat-v3.1",
    name: "DeepSeek V3.1 Chat",
    provider: "deepseek",
    description: "Fast conversational model — great for chat-heavy agent roles.",
    contextWindow: 32768,
    inputCostPer1k: 0.0003,
    outputCostPer1k: 0.0012,
    capabilities: ["chat", "code"],
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["fast", "budget", "chat"]
  },
  {
    id: "deepseek/deepseek-v3.1-terminus",
    name: "DeepSeek V3.1 Terminus",
    provider: "deepseek",
    description: "V3.1 optimized for structured output and tool use.",
    contextWindow: 163840,
    inputCostPer1k: 0.0003,
    outputCostPer1k: 0.0012,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["coding", "tools"]
  },
  {
    id: "deepseek/deepseek-r1-distill-llama-70b",
    name: "DeepSeek R1 Distill 70B",
    provider: "deepseek",
    description: "Distilled R1 reasoning on Llama 70B — fast reasoning at low cost.",
    contextWindow: 131072,
    inputCostPer1k: 0.0002,
    outputCostPer1k: 0.0004,
    capabilities: ["chat", "code"],
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["reasoning", "budget", "fast"]
  },

  // -------------------------------------------------------------------------
  // Google — Gemini series
  // -------------------------------------------------------------------------
  {
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "google",
    description: "Latest Google flagship — cutting-edge reasoning and multimodal.",
    contextWindow: 1000000,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "GOOGLE_API_KEY",
    tags: ["flagship", "latest", "large-context"]
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash",
    provider: "google",
    description: "Fast next-gen Google model for everyday tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
    capabilities: ["chat", "function_calling", "vision"],
    requiresKey: "GOOGLE_API_KEY",
    tags: ["fast", "latest"]
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Google's proven workhorse — large context and strong reasoning.",
    contextWindow: 1000000,
    inputCostPer1k: 0.0035,
    outputCostPer1k: 0.0105,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "GOOGLE_API_KEY",
    tags: ["flagship", "large-context", "research"]
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast, affordable Google model for everyday tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.00035,
    outputCostPer1k: 0.00105,
    capabilities: ["chat", "function_calling", "vision"],
    requiresKey: "GOOGLE_API_KEY",
    tags: ["fast", "budget", "large-context"]
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    description: "Ultra-lightweight Google model for high-volume, low-cost tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0.0004,
    capabilities: ["chat", "vision"],
    requiresKey: "GOOGLE_API_KEY",
    tags: ["fast", "budget", "cheap"]
  },
  {
    id: "google/gemini-2.0-flash-001",
    name: "Gemini 2.0 Flash",
    provider: "google",
    description: "Stable Gemini 2.0 release — reliable for production workloads.",
    contextWindow: 1000000,
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0.0004,
    capabilities: ["chat", "function_calling", "vision"],
    requiresKey: "GOOGLE_API_KEY",
    tags: ["fast", "budget", "stable"]
  },

  // -------------------------------------------------------------------------
  // OpenRouter — Free models
  // -------------------------------------------------------------------------
  {
    id: "google/gemma-3-27b-it:free",
    name: "Gemma 3 27B",
    provider: "openrouter",
    description: "Free Google Gemma model — solid for drafting and general chat.",
    contextWindow: 96000,
    capabilities: ["chat", "code"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter"]
  },
  {
    id: "google/gemma-3-12b-it:free",
    name: "Gemma 3 12B",
    provider: "openrouter",
    description: "Free, fast Gemma model for lightweight tasks.",
    contextWindow: 96000,
    capabilities: ["chat"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter", "fast"]
  },
  {
    id: "openai/gpt-oss-120b:free",
    name: "GPT OSS 120B",
    provider: "openrouter",
    description: "Free open-source GPT model — great for testing and drafting.",
    contextWindow: 128000,
    capabilities: ["chat", "code"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter"]
  },
  {
    id: "openai/gpt-oss-20b:free",
    name: "GPT OSS 20B",
    provider: "openrouter",
    description: "Free, compact open-source GPT for lightweight tasks.",
    contextWindow: 128000,
    capabilities: ["chat"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter", "fast"]
  },

  // -------------------------------------------------------------------------
  // OpenRouter — Premium routed models
  // -------------------------------------------------------------------------
  {
    id: "openrouter/openai/gpt-4o",
    name: "GPT-4o via OpenRouter",
    provider: "openrouter",
    description: "Routes GPT-4o through OpenRouter with provider flexibility.",
    contextWindow: 128000,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["openrouter", "premium", "multimodal"]
  },
  {
    id: "openrouter/anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet via OpenRouter",
    provider: "openrouter",
    description: "Routes Claude Sonnet through OpenRouter for unified billing.",
    contextWindow: 200000,
    capabilities: ["chat", "vision", "code"],
    recommended: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["openrouter", "reasoning", "writing"]
  },
  {
    id: "openrouter/google/gemini-pro-1.5",
    name: "Gemini Pro via OpenRouter",
    provider: "openrouter",
    description: "Routes Gemini Pro through OpenRouter for large-context tasks.",
    contextWindow: 1000000,
    capabilities: ["chat", "vision", "function_calling"],
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["openrouter", "large-context"]
  }
];

export function getModelById(id: string) {
  return SUPPORTED_MODELS.find((model) => model.id === id);
}

export function getModelsByProvider(provider: string) {
  return SUPPORTED_MODELS.filter((model) => model.provider === provider);
}

export function getFreeModels() {
  return SUPPORTED_MODELS.filter((model) => model.free);
}

export function getRecommendedModels() {
  return SUPPORTED_MODELS.filter((model) => model.recommended);
}
