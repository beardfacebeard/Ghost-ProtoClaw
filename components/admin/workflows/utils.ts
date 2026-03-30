import {
  Bell,
  CalendarPlus,
  CheckSquare,
  Clock,
  Eye,
  FileText,
  Link2,
  Mail,
  MessageCircle,
  MessageSquare,
  PenLine,
  Play,
  UserPlus,
  Users,
  Webhook,
  Zap
} from "lucide-react";

export function getTriggerMeta(trigger: string) {
  switch (trigger) {
    case "manual":
      return {
        label: "Manual",
        icon: Play,
        className: "bg-ghost-raised text-slate-300",
        iconClassName: "text-slate-400"
      };
    case "scheduled":
      return {
        label: "Scheduled",
        icon: Clock,
        className: "bg-brand-cyan/15 text-brand-cyan",
        iconClassName: "text-brand-cyan"
      };
    case "webhook":
      return {
        label: "Webhook",
        icon: Webhook,
        className: "bg-brand-amber/15 text-brand-amber",
        iconClassName: "text-brand-amber"
      };
    case "new_email":
      return {
        label: "New Email",
        icon: Mail,
        className: "bg-status-info/15 text-status-info",
        iconClassName: "text-status-info"
      };
    case "new_lead":
      return {
        label: "New Lead",
        icon: UserPlus,
        className: "bg-status-active/15 text-status-active",
        iconClassName: "text-status-active"
      };
    case "new_comment":
      return {
        label: "New Comment",
        icon: MessageCircle,
        className: "bg-purple-500/15 text-purple-400",
        iconClassName: "text-purple-400"
      };
    default:
      return {
        label: trigger || "Workflow",
        icon: Link2,
        className: "bg-ghost-raised text-slate-300",
        iconClassName: "text-slate-400"
      };
  }
}

export function getOutputMeta(output: string) {
  switch (output) {
    case "chat":
      return {
        label: "Chat",
        icon: MessageSquare,
        className: "bg-ghost-raised text-slate-300"
      };
    case "report":
      return {
        label: "Report",
        icon: FileText,
        className: "bg-status-info/15 text-status-info"
      };
    case "draft":
      return {
        label: "Draft",
        icon: PenLine,
        className: "bg-brand-amber/15 text-brand-amber"
      };
    case "crm_note":
      return {
        label: "CRM Note",
        icon: Users,
        className: "bg-status-active/15 text-status-active"
      };
    case "content_queue":
      return {
        label: "Content Queue",
        icon: CalendarPlus,
        className: "bg-brand-cyan/15 text-brand-cyan"
      };
    default:
      return {
        label: output || "Output",
        icon: FileText,
        className: "bg-ghost-raised text-slate-300"
      };
  }
}

export function getApprovalModeMeta(mode: string) {
  switch (mode) {
    case "auto":
      return {
        label: "Auto",
        description: "Run immediately when triggered.",
        icon: Zap,
        className: "bg-ghost-raised text-slate-300"
      };
    case "notify":
      return {
        label: "Notify",
        description: "Run automatically and notify the owner.",
        icon: Bell,
        className: "bg-status-info/15 text-status-info"
      };
    case "approve_first":
      return {
        label: "Approval Required",
        description: "Create an approval request before running.",
        icon: CheckSquare,
        className: "bg-brand-amber/15 text-brand-amber"
      };
    case "review_after":
      return {
        label: "Review After",
        description: "Run automatically and queue the result for review.",
        icon: Eye,
        className: "bg-brand-cyan/15 text-brand-cyan"
      };
    default:
      return {
        label: mode || "Approval",
        description: "Workflow approval behavior",
        icon: Bell,
        className: "bg-ghost-raised text-slate-300"
      };
  }
}

export function getRunStatusMeta(status?: string | null) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-status-active/15 text-status-active"
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-status-error/15 text-status-error"
      };
    case "running":
      return {
        label: "Running",
        className: "bg-brand-cyan/15 text-brand-cyan"
      };
    case "pending":
      return {
        label: "Pending",
        className: "bg-brand-amber/15 text-brand-amber"
      };
    case "unsupported":
      return {
        label: "Unsupported",
        className: "bg-ghost-raised text-slate-300"
      };
    default:
      return {
        label: status || "Unknown",
        className: "bg-ghost-raised text-slate-300"
      };
  }
}

export function formatWorkflowDate(value?: Date | string | null) {
  if (!value) {
    return "Never";
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatRunDuration(
  startedAt?: Date | string | null,
  completedAt?: Date | string | null
) {
  if (!startedAt || !completedAt) {
    return "Pending";
  }

  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  const durationMs = Math.max(completed - started, 0);

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1000)}s`;
  }

  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function getWorkflowEnabledMeta(enabled: boolean) {
  return enabled
    ? {
        label: "Enabled",
        className: "bg-status-active/15 text-status-active"
      }
    : {
        label: "Disabled",
        className: "bg-ghost-raised text-slate-300"
      };
}
