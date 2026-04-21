"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { formatKnowledgeCategory } from "@/lib/brain/knowledge";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

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

function getCategoryBadgeClassName(category: string) {
  switch (category) {
    case "about_business":
      return "bg-steel/15 text-steel-bright";
    case "products_services":
      return "bg-steel/15 text-steel-bright";
    case "pricing":
      return "bg-state-warning/15 text-state-warning";
    case "policies":
      return "bg-steel/15 text-steel-bright";
    case "faqs":
      return "bg-state-success/15 text-state-success";
    case "contacts":
      return "bg-sky-400/15 text-sky-300";
    case "brand_voice":
      return "bg-rose-400/15 text-rose-300";
    case "processes":
      return "bg-orange-400/15 text-orange-300";
    default:
      return "bg-bg-surface-2 text-ink-primary";
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
  const previewText = expanded ? item.content : item.content;

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
      <Card className="relative overflow-hidden rounded-xl border-line-subtle bg-bg-surface">
        {!item.enabled ? (
          <div className="pointer-events-none absolute inset-0 bg-bg-app/35" />
        ) : null}

        <CardHeader className="gap-3 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getCategoryBadgeClassName(item.category)}>
                {formatKnowledgeCategory(item.category)}
              </Badge>
              {!item.enabled ? (
                <Badge className="bg-bg-app/80 text-ink-primary">Disabled</Badge>
              ) : null}
            </div>
            <Switch
              checked={item.enabled}
              onCheckedChange={(checked) => void onToggle?.(item, checked)}
              aria-label={item.enabled ? "Disable knowledge item" : "Enable knowledge item"}
            />
          </div>

          <div className="text-base font-semibold text-white">{item.title}</div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p
            className={[
              "whitespace-pre-wrap text-sm leading-6 text-ink-secondary",
              expanded ? "" : "line-clamp-4"
            ].join(" ")}
          >
            {previewText}
          </p>

          {item.content.length > 180 ? (
            <button
              type="button"
              className="text-xs font-medium text-steel-bright transition-colors hover:text-white"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Badge className="bg-bg-surface-2 text-ink-primary">
              ~{item.tokenCount ?? 0} tokens
            </Badge>
            {item.sourceType !== "knowledge_base" ? (
              <Badge className="bg-bg-surface-2 text-ink-primary">
                {item.sourceType.replaceAll("_", " ")}
              </Badge>
            ) : null}
            <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
          </div>

          <div className="flex items-center gap-2">
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
              >
                <Pencil className="mr-2 h-4 w-4" />
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
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>

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
