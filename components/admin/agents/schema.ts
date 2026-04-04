import { z } from "zod";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().optional()
);

export const AGENT_SYSTEM_DEFAULT = "__inherit__";

export const agentTypeOptions = [
  {
    value: "main",
    label: "Main Agent",
    icon: "👑",
    description: "Primary operator for a business"
  },
  {
    value: "specialist",
    label: "Specialist",
    icon: "🎯",
    description: "Domain expert for a business"
  },
  {
    value: "global",
    label: "Global",
    icon: "🌐",
    description: "Org-wide utility with no business assignment"
  }
] as const;

export const agentStatusOptions = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "warning", label: "Warning" },
  { value: "disabled", label: "Disabled" }
] as const;

export const safetyModeOptions = [
  {
    value: "ask_before_acting",
    label: "Ask Before Acting",
    description: "Ask before sending, changing, or triggering something risky."
  },
  {
    value: "auto_low_risk",
    label: "Balanced",
    description: "Run safe tasks automatically and surface what happened."
  },
  {
    value: "full_auto",
    label: "Autonomous",
    description: "Run tasks automatically without waiting for approval."
  }
] as const;

export const runtimeOptions = [
  {
    value: "openclaw",
    label: "OpenClaw Gateway",
    description: "Multi-model orchestration runtime"
  },
  {
    value: "hermes",
    label: "Hermes",
    description: "Lightweight task runner"
  },
  {
    value: "opencode",
    label: "OpenCode",
    description: "Code-focused agent runtime"
  },
  {
    value: "codex",
    label: "Codex",
    description: "OpenAI's coding agent"
  },
  {
    value: "claude",
    label: "Claude Code",
    description: "Anthropic's coding agent"
  }
] as const;

export const commonAgentEmojiSuggestions = [
  "🤖",
  "👤",
  "🎯",
  "📊",
  "✍️",
  "🛍️",
  "💬",
  "📧",
  "🔍",
  "⚡"
] as const;

const agentFormBaseSchema = z.object({
  businessId: optionalText,
  displayName: z.string().trim().min(2, "Display name is required.").max(60),
  emoji: z
    .string()
    .trim()
    .max(8, "Use a short emoji only.")
    .optional()
    .or(z.literal("")),
  role: z.string().trim().min(2, "Role is required.").max(80),
  purpose: optionalText,
  type: z.enum(["main", "specialist", "global"]),
  status: optionalText,
  systemPrompt: optionalText,
  roleInstructions: optionalText,
  outputStyle: optionalText,
  constraints: optionalText,
  escalationRules: optionalText,
  askBeforeDoing: optionalText,
  primaryModel: optionalText,
  fallbackModel: optionalText,
  modelSource: optionalText,
  safetyMode: optionalText,
  tools: z.array(z.string()).default([]),
  workspacePath: optionalText,
  runtime: z.enum(["openclaw", "hermes", "opencode", "codex", "claude"]).default("openclaw")
});

export const agentFormSchema = agentFormBaseSchema
  .superRefine((values, context) => {
    if (values.type !== "global" && !values.businessId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessId"],
        message: "Choose a business for this agent."
      });
    }
  });

export const agentCreateApiSchema = agentFormSchema;
export const agentUpdateApiSchema = agentFormBaseSchema.partial();

export type AgentFormValues = z.infer<typeof agentFormSchema>;

export const defaultAgentFormValues: AgentFormValues = {
  businessId: "",
  displayName: "",
  emoji: "🤖",
  role: "",
  purpose: "",
  type: "specialist",
  status: "active",
  systemPrompt: "",
  roleInstructions: "",
  outputStyle: "",
  constraints: "",
  escalationRules: "",
  askBeforeDoing: "",
  primaryModel: "",
  fallbackModel: "",
  modelSource: "",
  safetyMode: "",
  tools: [],
  workspacePath: "",
  runtime: "openclaw"
};
