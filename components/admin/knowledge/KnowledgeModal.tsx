"use client";

import { useMemo, useState } from "react";
import { FileText, Sparkles } from "lucide-react";

import {
  estimateTokenCount,
  KNOWLEDGE_CATEGORY_OPTIONS
} from "@/lib/brain/knowledge";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type KnowledgeModalProps = {
  mode: "create" | "edit";
  item?: {
    id: string;
    category: string;
    title: string;
    content: string;
    enabled: boolean;
    tier?: string;
    assignedAgentIds?: string[];
  };
  businessId: string;
  businessAgents?: Array<{ id: string; displayName: string; emoji: string | null }>;
  onSave: (payload: {
    businessId: string;
    category: string;
    title: string;
    content: string;
    enabled: boolean;
    tier: "hot" | "warm" | "cold";
    assignedAgentIds: string[];
  }) => Promise<void> | void;
  onClose: () => void;
};

const TIER_OPTIONS: Array<{
  value: "hot" | "warm" | "cold";
  label: string;
  description: string;
}> = [
  {
    value: "hot",
    label: "🔥 Hot — always loaded",
    description:
      "Injected into every agent's system prompt on every turn. Use sparingly — brand voice, red-line rules, one-page pitch."
  },
  {
    value: "warm",
    label: "🌤️ Warm — loaded for assigned agents",
    description:
      "Auto-loaded only for the agents you assign below. If no agents are assigned, behaves like the old default (every agent sees it)."
  },
  {
    value: "cold",
    label: "❄️ Cold — on-demand only",
    description:
      "Never auto-loaded. Agents pull via the knowledge_lookup tool when a question actually needs it. Use for deep reference: case studies, long SOPs, full policy docs."
  }
];

const templateOptions = [
  {
    label: "FAQ format",
    value: "Q: [question]\nA: [answer]"
  },
  {
    label: "Policy format",
    value: "Policy: [name]\n\nRules:\n1. ...\n2. ..."
  },
  {
    label: "Product format",
    value: "Product: [name]\nPrice: \nDescription: \nKey benefits: "
  },
  {
    label: "Contact format",
    value: "Name: \nRole: \nEmail: \nPhone: \nNotes: "
  }
];

export function KnowledgeModal({
  mode,
  item,
  businessId,
  businessAgents = [],
  onSave,
  onClose
}: KnowledgeModalProps) {
  const [category, setCategory] = useState(item?.category ?? "about_business");
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [enabled, setEnabled] = useState(item?.enabled ?? true);
  const [tier, setTier] = useState<"hot" | "warm" | "cold">(
    (item?.tier as "hot" | "warm" | "cold" | undefined) ?? "warm"
  );
  const [assignedAgentIds, setAssignedAgentIds] = useState<string[]>(
    item?.assignedAgentIds ?? []
  );
  const [saving, setSaving] = useState(false);
  const tierMeta = TIER_OPTIONS.find((option) => option.value === tier);
  const characterCount = content.length;
  const tokenCount = estimateTokenCount(content);
  const selectedCategory = KNOWLEDGE_CATEGORY_OPTIONS.find(
    (option) => option.value === category
  );
  const canSave = title.trim().length >= 2 && content.trim().length >= 1;

  async function handleSave() {
    if (!canSave) {
      return;
    }

    try {
      setSaving(true);
      await onSave({
        businessId,
        category,
        title: title.trim(),
        content: content.trim(),
        enabled,
        tier,
        assignedAgentIds: tier === "warm" ? assignedAgentIds : []
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleAgent(agentId: string) {
    setAssignedAgentIds((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId]
    );
  }

  function insertTemplate(value: string) {
    setContent((current) => (current.trim().length === 0 ? value : `${current}\n\n${value}`));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b border-ghost-border">
          <DialogTitle>
            {mode === "create" ? "Add Knowledge" : "Edit Knowledge"}
          </DialogTitle>
          <DialogDescription>
            Structured knowledge gives your agents factual, reusable business context.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-6 py-4 flex-1">
          <div className="space-y-2">
            <Label htmlFor="knowledge-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="knowledge-category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory ? (
              <p className="text-xs text-slate-500">{selectedCategory.description}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="knowledge-title">Title</Label>
            <Input
              id="knowledge-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. What is your return policy?"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label htmlFor="knowledge-content">Knowledge Content</Label>
                <p className="mt-1 text-xs text-slate-500">
                  Write this as clear, factual information your agent can reference. Plain prose works best.
                </p>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Content Templates
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-2">
                  {templateOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      className="w-full rounded-lg border border-ghost-border bg-ghost-raised/50 px-3 py-3 text-left transition-colors hover:border-ghost-border-strong hover:bg-ghost-raised"
                      onClick={() => insertTemplate(option.value)}
                    >
                      <div className="text-sm font-medium text-white">{option.label}</div>
                      <div className="mt-1 whitespace-pre-wrap text-xs text-slate-400">
                        {option.value}
                      </div>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            <Textarea
              id="knowledge-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[200px] resize-y font-mono text-[13px]"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{characterCount} characters</span>
              <span>~{tokenCount} tokens</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="knowledge-tier">Loading tier</Label>
            <Select
              value={tier}
              onValueChange={(value) =>
                setTier(value as "hot" | "warm" | "cold")
              }
            >
              <SelectTrigger id="knowledge-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tierMeta ? (
              <p className="text-xs text-slate-500">{tierMeta.description}</p>
            ) : null}
          </div>

          {tier === "warm" && businessAgents.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-ghost-border bg-ghost-raised/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-white">
                  Assign to specific agents
                </Label>
                <span className="text-[11px] text-slate-500">
                  {assignedAgentIds.length === 0
                    ? "All agents on this business"
                    : `${assignedAgentIds.length} selected`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Leave empty to share with every agent. Pick specific agents to
                keep this item out of others&apos; context and save tokens.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {businessAgents.map((agent) => {
                  const selected = assignedAgentIds.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => toggleAgent(agent.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        selected
                          ? "border-brand-cyan bg-brand-cyan/15 text-brand-cyan"
                          : "border-ghost-border bg-ghost-raised text-slate-400 hover:text-white"
                      }`}
                    >
                      {agent.emoji ?? "🤖"} {agent.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-xl border border-ghost-border bg-ghost-raised/30 px-4 py-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">Include in agent context</div>
              <div className="text-xs text-slate-500">
                Disabled items stay stored but are not loaded into prompts.
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 shrink-0 border-t border-ghost-border bg-ghost-surface">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave || saving}>
            <FileText className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : `Save (~${tokenCount} tokens)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
