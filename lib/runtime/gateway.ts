/**
 * RuntimeGateway — Standardized interface for all AI runtimes.
 *
 * Every runtime adapter (OpenClaw, Hermes, OpenCode, Codex, Claude Code)
 * implements this contract so agents can switch runtimes without changing
 * any business logic.
 */

export type RuntimeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type RuntimeCompletionRequest = {
  messages: RuntimeMessage[];
  model?: string;
  agentId?: string;
  sessionKey?: string;
  stream?: boolean;
  /** Organization ID — used by key resolution to look up stored API keys. */
  organizationId?: string;
  /** Pre-resolved provider API key (bypasses env var lookup). */
  providerApiKey?: string;
};

export type RuntimeCompletionResponse = {
  content: string;
  model: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export type RuntimeHealthStatus = {
  healthy: boolean;
  latencyMs: number;
  error?: string;
  details?: Record<string, unknown>;
};

export type RuntimeResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  latencyMs: number;
};

export type RuntimeHookRequest = {
  message: string;
  sessionKey?: string;
};

export interface RuntimeGateway {
  /** Unique identifier for this runtime */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Whether this runtime is configured and ready to use */
  isConfigured(): boolean;

  /** Send a chat completion request */
  chatCompletion(
    request: RuntimeCompletionRequest,
    timeoutMs?: number
  ): Promise<RuntimeResult<RuntimeCompletionResponse>>;

  /** Trigger an isolated agent turn (for workflow execution) */
  hookAgent(
    request: RuntimeHookRequest,
    timeoutMs?: number
  ): Promise<RuntimeResult<Record<string, unknown>>>;

  /** Check runtime health */
  healthCheck(timeoutMs?: number): Promise<RuntimeHealthStatus>;
}
