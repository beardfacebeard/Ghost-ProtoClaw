export type ModelDefinition = {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google" | "openrouter" | "custom";
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

export const SUPPORTED_MODELS: ModelDefinition[] = [
  {
    id: "openai/gpt-5.3",
    name: "GPT-5.3",
    provider: "openai",
    description: "Latest GPT-5 series — frontier multimodal intelligence and reasoning.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "latest", "premium"]
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
    recommended: true,
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "latest", "code", "premium"]
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description: "GPT-5 base model — advanced multimodal reasoning and long context.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "premium"]
  },
  {
    id: "openai/gpt-5.0",
    name: "GPT-5.0",
    provider: "openai",
    description: "GPT-5.0 release — multimodal reasoning and long context.",
    contextWindow: 1000000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "premium"]
  },
  {
    id: "openai/gpt-4.5-preview",
    name: "GPT-4.5",
    provider: "openai",
    description: "Most powerful GPT-4 series model — creative writing, nuanced understanding, and broad knowledge.",
    contextWindow: 128000,
    inputCostPer1k: 0.075,
    outputCostPer1k: 0.15,
    capabilities: ["chat", "function_calling", "vision", "code"],
    recommended: true,
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "premium", "creative"]
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Fast flagship multimodal model for high-quality business operations.",
    contextWindow: 128000,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["flagship", "multimodal", "balanced"]
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
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    description: "Advanced reasoning model for complex analysis and multi-step problem solving.",
    contextWindow: 200000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.04,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "flagship", "premium"]
  },
  {
    id: "openai/o3-mini",
    name: "o3 Mini",
    provider: "openai",
    description: "Cost-efficient reasoning model for structured analysis tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.0011,
    outputCostPer1k: 0.0044,
    capabilities: ["chat", "function_calling", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "budget"]
  },
  {
    id: "openai/gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    description: "Strong reasoning model for detailed planning and analysis.",
    contextWindow: 128000,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["reasoning", "analysis"]
  },
  {
    id: "openai/gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    description: "Low-cost fallback for lightweight tasks and drafts.",
    contextWindow: 16000,
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
    capabilities: ["chat", "function_calling"],
    requiresKey: "OPENAI_API_KEY",
    tags: ["cheap", "fallback", "fast"]
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Current Anthropic flagship — best-in-class reasoning, writing, and code generation.",
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
    description: "Most powerful Anthropic model — sustained performance on complex, long-running tasks.",
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
    description: "Strong reasoning and writing model — previous flagship generation.",
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
    description: "High-capability Anthropic model for demanding analysis and workflows.",
    contextWindow: 200000,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.075,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["premium", "complex"]
  },
  {
    id: "anthropic/claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    description: "Strong writing and reasoning model for complex operator tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["reasoning", "writing"]
  },
  {
    id: "anthropic/claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    description: "Fast and cost-efficient Anthropic option for lighter tasks.",
    contextWindow: 200000,
    inputCostPer1k: 0.0008,
    outputCostPer1k: 0.004,
    capabilities: ["chat", "vision", "code"],
    requiresKey: "ANTHROPIC_API_KEY",
    tags: ["fast", "budget"]
  },
  {
    id: "google/gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    description: "Large-context Google model for research and document-heavy tasks.",
    contextWindow: 1000000,
    inputCostPer1k: 0.0035,
    outputCostPer1k: 0.0105,
    capabilities: ["chat", "function_calling", "vision", "code"],
    requiresKey: "GOOGLE_API_KEY",
    tags: ["large-context", "research"]
  },
  {
    id: "google/gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    description: "Fast Google model for lightweight automation and summaries.",
    contextWindow: 1000000,
    inputCostPer1k: 0.00035,
    outputCostPer1k: 0.00105,
    capabilities: ["chat", "function_calling", "vision"],
    requiresKey: "GOOGLE_API_KEY",
    tags: ["fast", "budget", "large-context"]
  },
  {
    id: "openrouter/meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B Instruct",
    provider: "openrouter",
    description: "Free OpenRouter option for lightweight chats and drafting.",
    contextWindow: 128000,
    capabilities: ["chat"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter"]
  },
  {
    id: "openrouter/mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B Instruct",
    provider: "openrouter",
    description: "Free, fast OpenRouter model for basic operator tasks.",
    contextWindow: 32000,
    capabilities: ["chat"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter", "fast"]
  },
  {
    id: "openrouter/google/gemma-2-9b-it:free",
    name: "Gemma 2 9B IT",
    provider: "openrouter",
    description: "Free OpenRouter model for lightweight drafting and replies.",
    contextWindow: 8000,
    capabilities: ["chat"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter"]
  },
  {
    id: "openrouter/qwen/qwen-2-7b-instruct:free",
    name: "Qwen 2 7B Instruct",
    provider: "openrouter",
    description: "Free OpenRouter model for low-cost general business support.",
    contextWindow: 32000,
    capabilities: ["chat"],
    free: true,
    requiresKey: "OPENROUTER_API_KEY",
    tags: ["free", "openrouter"]
  },
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
    name: "Gemini 1.5 Pro via OpenRouter",
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
