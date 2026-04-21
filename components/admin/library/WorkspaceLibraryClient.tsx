"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Eye, Loader2, Search, Square } from "lucide-react";

import { LibraryCard } from "@/components/admin/library/LibraryCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { formatWorkspaceCategory } from "@/lib/brain/workspace";
import type { WorkspaceLibraryItem } from "@/lib/library/workspace-library";

type BusinessOption = {
  id: string;
  name: string;
};

type Props = {
  items: WorkspaceLibraryItem[];
  categories: string[];
  sources: string[];
  businesses: BusinessOption[];
  defaultBusinessId: string | null;
};

const ALL = "__all__";

export function WorkspaceLibraryClient({
  items,
  categories,
  sources,
  businesses,
  defaultBusinessId
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [source, setSource] = useState<string>(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetBusinessId, setTargetBusinessId] = useState<string>(
    defaultBusinessId ?? ""
  );
  const [onConflict, setOnConflict] = useState<"skip" | "rename">("rename");
  const [installing, setInstalling] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== ALL && item.category !== category) return false;
      if (source !== ALL && item.source !== source) return false;
      if (!q) return true;
      const hay = [
        item.title,
        item.filePath,
        item.description,
        item.content,
        ...item.tags
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, category, source]);

  const previewItem = useMemo(
    () => items.find((item) => item.id === previewId) ?? null,
    [items, previewId]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of filtered) next.add(item.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function install() {
    if (selected.size === 0) {
      toast.error("Pick at least one document to install.");
      return;
    }
    if (!targetBusinessId) {
      toast.error("Choose a target business.");
      return;
    }
    setInstalling(true);
    try {
      const response = await fetchWithCsrf(
        "/api/admin/library/workspace/install",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: targetBusinessId,
            itemIds: Array.from(selected),
            onConflict
          })
        }
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Install failed");
      }
      const result = (await response.json()) as {
        businessName: string;
        created: number;
        renamed: number;
        skippedDuplicates: number;
        skippedUnknown: number;
      };
      const parts: string[] = [];
      if (result.created > 0) parts.push(`${result.created} added`);
      if (result.renamed > 0) parts.push(`${result.renamed} renamed`);
      if (result.skippedDuplicates > 0)
        parts.push(`${result.skippedDuplicates} skipped`);
      if (result.skippedUnknown > 0)
        parts.push(`${result.skippedUnknown} not found`);
      toast.success(
        `Workspace files added to ${result.businessName}: ${
          parts.length > 0 ? parts.join(", ") : "nothing"
        }.`
      );
      clearSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Install failed.");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <Label htmlFor="ws-library-search" className="text-xs">
            Search
          </Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              id="ws-library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by path, title, or content…"
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {formatWorkspaceCategory(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="mt-1 w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllVisible}
            disabled={filtered.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Select all ({filtered.length})
          </Button>
          {selected.size > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              <Square className="h-4 w-4 mr-1" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <div className="text-xs text-ink-muted">
        {filtered.length} of {items.length} documents
        {selected.size > 0 ? ` • ${selected.size} selected` : ""}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-ink-muted">
          No documents match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <LibraryCard
              key={item.id}
              id={item.id}
              title={item.title}
              subtitle={`${item.filePath} · ${formatWorkspaceCategory(item.category)} · ${item.tier}`}
              description={item.description}
              badges={[item.tier, ...item.tags]}
              source={item.source}
              selected={selected.has(item.id)}
              onToggle={toggle}
              footer={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] underline-offset-2 hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewId(item.id);
                  }}
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
              }
            />
          ))}
        </div>
      )}

      {selected.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl rounded-xl border bg-background shadow-lg p-3 flex flex-wrap items-center gap-3">
          <div className="font-medium text-sm pr-2 border-r">
            {selected.size} selected
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Add to</Label>
            <Select
              value={targetBusinessId}
              onValueChange={setTargetBusinessId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Choose a business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">On conflict</Label>
            <Select
              value={onConflict}
              onValueChange={(v) => setOnConflict(v as "skip" | "rename")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rename">Rename as copy</SelectItem>
                <SelectItem value="skip">Skip existing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={installing || !targetBusinessId}
              onClick={install}
            >
              {installing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Installing…
                </>
              ) : (
                `Install ${selected.size}`
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          {previewItem ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-sm">
                  {previewItem.filePath}
                </DialogTitle>
                <DialogDescription>
                  {previewItem.description} · {previewItem.source}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] rounded border bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">
                  {previewItem.content}
                </pre>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPreviewId(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    toggle(previewItem.id);
                    setPreviewId(null);
                  }}
                >
                  {selected.has(previewItem.id)
                    ? "Remove from selection"
                    : "Add to selection"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
