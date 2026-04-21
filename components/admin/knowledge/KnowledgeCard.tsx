"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { formatKnowledgeCategory } from "@/lib/brain/knowledge";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusDot } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type KnowledgeItemCard = {
  id: string;
  businessId: string;
  category: string;
  title: string;
  content: string;
  sourceType: string;
  enabled: boolean;
  tokenCount: number | null;
  updatedAt: Date | string;
};

type KnowledgeCardProps = {
  item: KnowledgeItemCard;
  onEdit?: (item: KnowledgeItemCard) => void;
  onDelete?: (item: KnowledgeItemCard) => Promise<void> | void;
  onToggle?: (item: KnowledgeItemCard, enabled: boolean) => Promise<void> | void;
};

function getCategoryChipClass(category: string) {
  switch (category) {
    case "about_business":
    case "products_services":
    case "policies":
      return "border-steel/30 bg-steel/10 text-steel-bright";
    case "pricing":
      return "border-state-warning/30 bg-state-warning/10 text-state-warning";
    case "faqs":
      return "border-state-success/30 bg-state-success/10 text-state-success";
    case "brand_voice":
      return "border-state-ai/30 bg-state-ai/10 text-state-ai";
    default:
      return "border-line-subtle bg-bg-surface-2 text-ink-secondary";
  }
}

export function KnowledgeCard({
  item,
  onEdit,
  onDelete,
  onToggle
}: KnowledgeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!onDelete) {
      return;
    }

    try {
      setDeleting(true);
      await onDelete(item);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-line-subtle bg-bg-surface transition-colors",
          !item.enabled && "opacity-70"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]",
                getCategoryChipClass(item.category)
              )}
            >
              {formatKnowledgeCategory(item.category)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-secondary">
              <StatusDot tone={item.enabled ? "success" : "muted"} />
              {item.enabled ? "Live" : "Disabled"}
            </span>
          </div>
          <Switch
            checked={item.enabled}
            onCheckedChange={(checked) => void onToggle?.(item, checked)}
            aria-label={item.enabled ? "Disable knowledge item" : "Enable knowledge item"}
          />
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="text-[14px] font-semibold leading-snug text-ink-primary">
            {item.title}
          </div>
          <p
            className={cn(
              "whitespace-pre-wrap text-[12.5px] leading-6 text-ink-secondary",
              !expanded && "line-clamp-4"
            )}
          >
            {item.content}
          </p>

          {item.content.length > 180 ? (
            <button
              type="button"
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-steel-bright transition-colors hover:text-ink-primary"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-ink-muted">
            <span>~{item.tokenCount ?? 0} tok</span>
            {item.sourceType !== "knowledge_base" ? (
              <>
                <span className="text-ink-disabled">·</span>
                <span>{item.sourceType.replaceAll("_", " ")}</span>
              </>
            ) : null}
            <span className="text-ink-disabled">·</span>
            <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                Edit
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete knowledge item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this knowledge item?"
        description="This removes the knowledge item permanently. Agents will no longer load it into context."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
