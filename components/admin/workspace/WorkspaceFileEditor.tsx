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
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {/* ── Sticky header ────────────────────────────────────────── */}
        <SheetHeader className="flex-shrink-0 space-y-4 border-b border-line-subtle px-6 py-4 pr-14">
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
                <Badge className="border-state-warning/30 bg-state-warning/15 text-state-warning">
                  Unsaved changes
                </Badge>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* ── Scrollable body ──────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
        <div className="space-y-4 border-b border-line-subtle py-4">
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
                <p className="text-xs text-state-danger">{filePathError}</p>
              ) : (
                <p className="text-xs text-ink-muted">
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
            <div className="text-xs text-ink-muted">
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
          <div className="mb-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-muted">
            <span>Editor</span>
            <span>{lineCount} lines</span>
          </div>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[300px] flex-1 resize-y border-line-subtle bg-bg-app font-mono text-[13px] leading-6"
            wrap={softWrap ? "soft" : "off"}
          />
        </div>
        </div>

        {/* ── Sticky footer ────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-line-subtle px-6 py-3 text-[12px]">
          <div className="font-mono text-ink-muted">
            {characterCount} chars · ~{tokenEstimate} tokens
          </div>
          <div className="flex items-center gap-3">
            <span className="text-ink-muted">
              {getSyncStatusLabel(doc?.syncStatus)}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save File"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
