/**
 * Runtime Registry
 *
 * Resolves agent runtime strings to concrete RuntimeGateway implementations.
 * New runtimes are registered here as adapters are built.
 */

import type { RuntimeGateway } from "./gateway";
import { ClaudeCodeAdapter } from "./claude-adapter";
import { CodexAdapter } from "./codex-adapter";
import { HermesAdapter } from "./hermes-adapter";
import { OpenClawAdapter } from "./openclaw-adapter";

const adapters: Record<string, RuntimeGateway> = {};

function ensureLoaded() {
  if (Object.keys(adapters).length === 0) {
    const openclaw = new OpenClawAdapter();
    const hermes = new HermesAdapter();
    const claude = new ClaudeCodeAdapter();
    const codex = new CodexAdapter();

    adapters[openclaw.id] = openclaw;
    adapters[hermes.id] = hermes;
    adapters[claude.id] = claude;
    adapters[codex.id] = codex;
  }
}

/**
 * Register a custom runtime adapter.
 * Used by plugins or future built-in runtimes (Hermes, Codex, Claude Code).
 */
export function registerRuntime(adapter: RuntimeGateway) {
  adapters[adapter.id] = adapter;
}

/**
 * Get a runtime adapter by id.
 * Falls back to OpenClaw if the requested runtime is not registered.
 */
export function getRuntime(runtimeId?: string | null): RuntimeGateway {
  ensureLoaded();
  const id = runtimeId ?? "openclaw";
  return adapters[id] ?? adapters.openclaw;
}

/**
 * List all registered runtimes.
 */
export function listRuntimes(): RuntimeGateway[] {
  ensureLoaded();
  return Object.values(adapters);
}

/**
 * Check if a specific runtime is available and configured.
 */
export function isRuntimeAvailable(runtimeId: string): boolean {
  ensureLoaded();
  const adapter = adapters[runtimeId];
  return adapter ? adapter.isConfigured() : false;
}
