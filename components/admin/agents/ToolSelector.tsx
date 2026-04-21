"use client";

import {
  Calendar,
  CreditCard,
  FileSearch,
  FolderOpen,
  Github,
  ImageIcon,
  Mail,
  MessageSquare,
  Search,
  Send,
  Users,
  Workflow
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ToolDefinition = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const AVAILABLE_AGENT_TOOLS: ToolDefinition[] = [
  {
    key: "web_search",
    label: "Web Search",
    description: "Research current information across the public web.",
    icon: Search
  },
  {
    key: "send_email",
    label: "Send Email",
    description: "Draft and send outbound email messages.",
    icon: Send
  },
  {
    key: "read_email",
    label: "Read Email",
    description: "Review incoming email threads and pull context.",
    icon: Mail
  },
  {
    key: "calendar_read",
    label: "Read Calendar",
    description: "Inspect events, availability, and scheduling context.",
    icon: Calendar
  },
  {
    key: "calendar_write",
    label: "Write Calendar",
    description: "Create or update calendar events and meetings.",
    icon: Calendar
  },
  {
    key: "crm_read",
    label: "Read CRM",
    description: "Read contact, pipeline, and account details.",
    icon: Users
  },
  {
    key: "crm_write",
    label: "Write CRM",
    description: "Update contacts, deals, and CRM notes.",
    icon: Users
  },
  {
    key: "file_read",
    label: "Read Files",
    description: "Open workspace files and reference documents.",
    icon: FolderOpen
  },
  {
    key: "file_write",
    label: "Write Files",
    description: "Create or update workspace documents.",
    icon: FolderOpen
  },
  {
    key: "slack_message",
    label: "Send Slack Message",
    description: "Post updates to Slack channels or teammates.",
    icon: MessageSquare
  },
  {
    key: "stripe_read",
    label: "Read Stripe Data",
    description: "Inspect payments, subscriptions, and invoices.",
    icon: CreditCard
  },
  {
    key: "github_read",
    label: "Read GitHub",
    description: "Read repos, issues, PRs, and code context from GitHub.",
    icon: Github
  },
  {
    key: "telegram_message",
    label: "Send Telegram",
    description: "Send Telegram messages and approvals updates.",
    icon: Send
  },
  {
    key: "generate_image",
    label: "Generate Image",
    description: "Create images for content or campaign support.",
    icon: ImageIcon
  },
  {
    key: "run_workflow",
    label: "Trigger Workflow",
    description: "Kick off other workflows from this agent.",
    icon: Workflow
  }
];

type ToolSelectorProps = {
  value: string[];
  onChange: (tools: string[]) => void;
};

export function ToolSelector({ value, onChange }: ToolSelectorProps) {
  function toggleTool(toolKey: string, checked: boolean) {
    if (checked) {
      onChange([...value, toolKey]);
      return;
    }

    onChange(value.filter((item) => item !== toolKey));
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {AVAILABLE_AGENT_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const checked = value.includes(tool.key);

          return (
            <label
              key={tool.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
                checked
                  ? "border-steel bg-steel/10"
                  : "border-line-subtle bg-bg-surface-2/30 hover:border-line"
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => toggleTool(tool.key, next === true)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-app/40 text-steel-bright">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-medium text-white">
                    {tool.label}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <p className="line-clamp-2 text-xs leading-5 text-ink-secondary">
                    {tool.description}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-full border border-line-subtle px-2 py-0.5 text-[10px] text-ink-muted transition-colors hover:text-white"
                      >
                        info
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs leading-5">
                      {tool.description}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
