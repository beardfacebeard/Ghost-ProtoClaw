/**
 * Sub-Agent Spawning Policy
 *
 * Controls whether agents can programmatically create child agents,
 * delegate tasks, and how deep the hierarchy can go.
 *
 * The feature is off by default and must be explicitly enabled at the
 * organization or business level before any agent can spawn sub-agents.
 */

type JsonRecord = Record<string, unknown>;

export type SubAgentPolicy = {
  /** Master toggle — when false, no sub-agent features are available. */
  enabled: boolean;

  /** Maximum nesting depth. A top-level agent is depth 0, its child is 1, etc. */
  maxDepth: number;

  /** Maximum number of sub-agents a single parent can spawn. */
  maxChildrenPerAgent: number;

  /** Maximum total sub-agents across the entire business. */
  maxSubAgentsPerBusiness: number;

  /** Whether sub-agents inherit the parent's model or use the cheapest available. */
  defaultModelStrategy: "inherit" | "cheapest";

  /** Whether a human must approve each sub-agent creation before it takes effect. */
  requireHumanApproval: boolean;

  /** Whether sub-agents can themselves spawn further sub-agents. */
  allowRecursiveSpawning: boolean;

  /** Auto-disable sub-agents after this many minutes of inactivity (0 = never). */
  autoDisableAfterMinutes: number;
};

const DEFAULT_SUB_AGENT_POLICY: SubAgentPolicy = {
  enabled: false,
  maxDepth: 2,
  maxChildrenPerAgent: 3,
  maxSubAgentsPerBusiness: 10,
  defaultModelStrategy: "cheapest",
  requireHumanApproval: true,
  allowRecursiveSpawning: false,
  autoDisableAfterMinutes: 60,
};

/** Hard limits that cannot be overridden by any configuration. */
const HARD_LIMITS = {
  maxDepth: 5,
  maxChildrenPerAgent: 10,
  maxSubAgentsPerBusiness: 50,
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Parse a sub-agent policy from a stored JSON config blob.
 * Applies hard limits to prevent unsafe overrides.
 */
export function parseSubAgentPolicy(config: unknown): SubAgentPolicy {
  const record = isRecord(config) ? config : {};
  const subAgents = isRecord(record.subAgents) ? record.subAgents : {};

  return {
    enabled: subAgents.enabled === true,
    maxDepth: clampInt(
      subAgents.maxDepth,
      1,
      HARD_LIMITS.maxDepth,
      DEFAULT_SUB_AGENT_POLICY.maxDepth
    ),
    maxChildrenPerAgent: clampInt(
      subAgents.maxChildrenPerAgent,
      1,
      HARD_LIMITS.maxChildrenPerAgent,
      DEFAULT_SUB_AGENT_POLICY.maxChildrenPerAgent
    ),
    maxSubAgentsPerBusiness: clampInt(
      subAgents.maxSubAgentsPerBusiness,
      1,
      HARD_LIMITS.maxSubAgentsPerBusiness,
      DEFAULT_SUB_AGENT_POLICY.maxSubAgentsPerBusiness
    ),
    defaultModelStrategy:
      subAgents.defaultModelStrategy === "inherit" ? "inherit" : "cheapest",
    requireHumanApproval: subAgents.requireHumanApproval !== false,
    allowRecursiveSpawning: subAgents.allowRecursiveSpawning === true,
    autoDisableAfterMinutes: clampInt(
      subAgents.autoDisableAfterMinutes,
      0,
      1440,
      DEFAULT_SUB_AGENT_POLICY.autoDisableAfterMinutes
    ),
  };
}

/** Serialize a policy back to a JSON-safe object for storage. */
export function serializeSubAgentPolicy(policy: SubAgentPolicy): JsonRecord {
  return {
    subAgents: {
      enabled: policy.enabled,
      maxDepth: policy.maxDepth,
      maxChildrenPerAgent: policy.maxChildrenPerAgent,
      maxSubAgentsPerBusiness: policy.maxSubAgentsPerBusiness,
      defaultModelStrategy: policy.defaultModelStrategy,
      requireHumanApproval: policy.requireHumanApproval,
      allowRecursiveSpawning: policy.allowRecursiveSpawning,
      autoDisableAfterMinutes: policy.autoDisableAfterMinutes,
    },
  };
}

export function getDefaultSubAgentPolicy(): SubAgentPolicy {
  return { ...DEFAULT_SUB_AGENT_POLICY };
}

export function getHardLimits() {
  return { ...HARD_LIMITS };
}

export type SubAgentValidationResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Validate whether a parent agent is allowed to spawn a sub-agent
 * given the current policy and state.
 */
export function validateSubAgentSpawn(input: {
  policy: SubAgentPolicy;
  parentDepth: number;
  parentChildCount: number;
  businessSubAgentCount: number;
  parentIsSubAgent: boolean;
}): SubAgentValidationResult {
  if (!input.policy.enabled) {
    return {
      allowed: false,
      reason:
        "Sub-agent spawning is disabled for this business. An admin can enable it in Settings.",
    };
  }

  if (input.parentIsSubAgent && !input.policy.allowRecursiveSpawning) {
    return {
      allowed: false,
      reason:
        "Recursive spawning is disabled. Only top-level agents can create sub-agents. An admin can change this in Settings.",
    };
  }

  const nextDepth = input.parentDepth + 1;

  if (nextDepth > input.policy.maxDepth) {
    return {
      allowed: false,
      reason: `Maximum nesting depth of ${input.policy.maxDepth} would be exceeded. The new agent would be at depth ${nextDepth}.`,
    };
  }

  if (input.parentChildCount >= input.policy.maxChildrenPerAgent) {
    return {
      allowed: false,
      reason: `This agent already has ${input.parentChildCount} sub-agents, which is the maximum allowed (${input.policy.maxChildrenPerAgent}).`,
    };
  }

  if (
    input.businessSubAgentCount >= input.policy.maxSubAgentsPerBusiness
  ) {
    return {
      allowed: false,
      reason: `This business already has ${input.businessSubAgentCount} sub-agents, which is the maximum allowed (${input.policy.maxSubAgentsPerBusiness}).`,
    };
  }

  return { allowed: true };
}
