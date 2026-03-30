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
  };
  businessId: string;
  onSave: (payload: {
    businessId: string;
    category: string;
    title: string;
    content: string;
    enabled: boolean;
  }) => Promise<void> | void;
  onClose: () => void;
};

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
  onSave,
  onClose
}: KnowledgeModalProps) {
  const [category, setCategory] = useState(item?.category ?? "about_business");
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [enabled, setEnabled] = useState(item?.enabled ?? true);
  const [saving, setSaving] = useState(false);
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
        enabled
      });
    } finally {
      setSaving(false);
    }
  }

  function insertTemplate(value: string) {
    setContent((current) => (current.trim().length === 0 ? value : `${current}\n\n${value}`));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Knowledge" : "Edit Knowledge"}
          </DialogTitle>
          <DialogDescription>
            Structured knowledge gives your agents factual, reusable business context.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
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

        <DialogFooter>
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
