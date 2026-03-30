"use client";

import { useMemo, useState } from "react";
import { FileText, Save } from "lucide-react";

import {
  estimateWorkspaceTokens,
  getWorkspaceSyncMode,
  MEMORY_TIER_OPTIONS,
  validateWorkspaceFilePath,
  WORKSPACE_CATEGORY_OPTIONS
} from "@/lib/brain/workspace";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

type WorkspaceDocumentEditor = {
  id: string;
  businessId: string;
  agentId: string | null;
  filePath: string;
  content: string;
  category: string;
  tier: string;
  syncStatus: string;
};

type WorkspaceFileEditorProps = {
  doc?: WorkspaceDocumentEditor;
  businessId: string;
  agents: Array<{
    id: string;
    displayName: string;
    emoji: string | null;
  }>;
  onSave: (payload: {
    businessId: string;
    agentId?: string | null;
    filePath: string;
    content: string;
    category: string;
    tier: string;
  }) => Promise<void> | void;
  onClose: () => void;
};

function getSyncStatusLabel(syncStatus?: string) {
  switch (syncStatus) {
    case "synced":
      return "Synced";
    case "unavailable":
      return "Unavailable";
    default:
      return "Pending sync";
  }
}

export function WorkspaceFileEditor({
  doc,
  businessId,
  agents,
  onSave,
  onClose
}: WorkspaceFileEditorProps) {
  const [filePath, setFilePath] = useState(doc?.filePath ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [category, setCategory] = useState(doc?.category ?? "other");
  const [tier, setTier] = useState(doc?.tier ?? "warm");
  const [agentId, setAgentId] = useState(doc?.agentId ?? "none");
  const [softWrap, setSoftWrap] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filePathError, setFilePathError] = useState<string | null>(null);

  const characterCount = content.length;
  const tokenEstimate = estimateWorkspaceTokens(content);
  const lineCount = content.length === 0 ? 1 : content.split(/\r?\n/).length;
  const dirty =
    filePath !== (doc?.filePath ?? "") ||
    content !== (doc?.content ?? "") ||
    category !== (doc?.category ?? "other") ||
    tier !== (doc?.tier ?? "warm") ||
    agentId !== (doc?.agentId ?? "none");

  async function handleSave() {
    const validation = validateWorkspaceFilePath(filePath);

    if (!validation.valid) {
      setFilePathError(validation.error);
      toast.error(validation.error);
      return;
    }

    try {
      setSaving(true);
      setFilePathError(null);
      await onSave({
        businessId,
        agentId: agentId === "none" ? null : agentId,
        filePath: validation.normalized,
        content,
        category,
        tier
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex h-full w-full max-w-3xl flex-col sm:max-w-3xl">
        <SheetHeader className="space-y-4 border-b border-ghost-border pb-4 pr-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate font-mono text-base">
                {doc?.filePath || "New workspace file"}
              </SheetTitle>
              <SheetDescription>
                Files your agents can read and write at runtime.
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              {dirty ? (
                <Badge className="bg-brand-amber/15 text-brand-amber">
                  Unsaved changes
                </Badge>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save File"}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 border-b border-ghost-border py-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.8fr))]">
            <div className="space-y-2">
              <Label htmlFor="workspace-file-path">File Path</Label>
              <Input
                id="workspace-file-path"
                value={filePath}
                onChange={(event) => setFilePath(event.target.value)}
                placeholder="agents/assistant/context.md"
                className="font-mono"
              />
              {filePathError ? (
                <p className="text-xs text-status-error">{filePathError}</p>
              ) : (
                <p className="text-xs text-slate-500">
                  Use a relative path with no leading slash or parent traversal.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKSPACE_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMORY_TIER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Agents</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.emoji ? `${agent.emoji} ` : ""}
                      {agent.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {lineCount} lines • {characterCount} characters • ~{tokenEstimate} tokens
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSoftWrap((current) => !current)}
            >
              {softWrap ? "Soft wrap on" : "Soft wrap off"}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col py-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>Editor</span>
            <span>{lineCount} lines</span>
          </div>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[420px] flex-1 resize-none border-ghost-border bg-ghost-black font-mono text-[13px] leading-6"
            wrap={softWrap ? "soft" : "off"}
          />
        </div>

        <div className="flex items-center justify-between border-t border-ghost-border pt-4 text-sm">
          <div className="text-slate-500">
            {characterCount} characters • ~{tokenEstimate} tokens
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-500">
              {getSyncStatusLabel(doc?.syncStatus)}
            </span>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              <FileText className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save File"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
