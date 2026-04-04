import { getModelById } from "@/lib/models/model-definitions";
import type { ModelSource } from "@/lib/models/agent-models";

export function getAgentStatusMeta(status?: string | null) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        dotClassName: "bg-status-active",
        badgeClassName: "bg-status-active/15 text-status-active"
      };
    case "paused":
      return {
        label: "Paused",
        dotClassName: "bg-blue-400",
        badgeClassName: "bg-blue-400/15 text-blue-400"
      };
    case "warning":
      return {
        label: "Warning",
        dotClassName: "bg-brand-amber",
        badgeClassName: "bg-brand-amber/15 text-brand-amber"
      };
    case "disabled":
      return {
        label: "Disabled",
        dotClassName: "bg-slate-500",
        badgeClassName: "bg-ghost-raised text-slate-300"
      };
    default:
      return {
        label: status || "Unknown",
        dotClassName: "bg-slate-500",
        badgeClassName: "bg-ghost-raised text-slate-300"
      };
  }
}

export function getModelSourceMeta(source: ModelSource) {
  switch (source) {
    case "agent":
      return {
        icon: "🤖",
        label: "Agent",
        badgeClassName: "bg-brand-primary/15 text-brand-primary"
      };
    case "business":
      return {
        icon: "🏢",
        label: "Business",
        badgeClassName: "bg-brand-cyan/15 text-brand-cyan"
      };
    case "system":
    default:
      return {
        icon: "⚙️",
        label: "System",
        badgeClassName: "bg-ghost-raised text-slate-300"
      };
  }
}

export function formatModelName(modelId?: string | null) {
  if (!modelId) {
    return "Not set";
  }

  return getModelById(modelId)?.name ?? modelId;
}

export function formatToolLabel(tool: string) {
  return tool
    .replaceAll("_", " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getSafetyModeLabel(value?: string | null) {
  switch (value) {
    case "ask_before_acting":
      return "Ask Before Acting";
    case "auto_low_risk":
      return "Balanced";
    case "full_auto":
      return "Autonomous";
    default:
      return "System Default";
  }
}
