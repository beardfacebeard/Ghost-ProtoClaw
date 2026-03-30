"use client";

import { useMemo, useState } from "react";
import { Flame, Snowflake, Thermometer, Trash2 } from "lucide-react";

import { formatMemoryType } from "@/lib/brain/memory";
import { formatMemoryTier } from "@/lib/brain/workspace";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

type AgentMemoryRecord = {
  id: string;
  agentId: string;
  businessId: string;
  type: string;
  content: string;
  importance: number;
  tier: string;
  expiresAt: Date | string | null;
  metadata?: unknown;
  createdAt: Date | string;
  agent: {
    id: string;
    displayName: string;
    emoji: string | null;
  } | null;
};

type MemoryCardProps = {
  memory: AgentMemoryRecord;
  onTierChange: (memory: AgentMemoryRecord, tier: "hot" | "warm" | "cold") => Promise<void> | void;
  onDelete: (memory: AgentMemoryRecord) => Promise<void> | void;
};

function getTierAccentClassName(tier: string) {
  switch (tier) {
    case "hot":
      return "border-brand-primary";
    case "warm":
      return "border-brand-amber";
    default:
      return "border-[#444444]";
  }
}

function getTierBadgeClassName(tier: string) {
  switch (tier) {
    case "hot":
      return "bg-brand-primary/15 text-brand-primary";
    case "warm":
      return "bg-brand-amber/15 text-brand-amber";
    default:
      return "bg-ghost-raised text-slate-300";
  }
}

function getTypeBadgeClassName(type: string) {
  switch (type) {
    case "conversation_summary":
      return "bg-status-info/15 text-status-info";
    case "learned_preference":
      return "bg-brand-cyan/15 text-brand-cyan";
    case "contact_note":
      return "bg-status-active/15 text-status-active";
    case "task_outcome":
      return "bg-brand-amber/15 text-brand-amber";
    default:
      return "bg-ghost-raised text-slate-300";
  }
}

function getExpiryLabel(expiresAt: Date | string | null) {
  if (!expiresAt) {
    return null;
  }

  const target = new Date(expiresAt);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: "Expired",
      className: "text-status-error"
    };
  }

  if (diffDays < 7) {
    return {
      label: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      className: "text-brand-amber"
    };
  }

  return {
    label: `Expires in ${diffDays} days`,
    className: "text-slate-500"
  };
}

export function MemoryCard({ memory, onTierChange, onDelete }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expiryMeta = getExpiryLabel(memory.expiresAt);
  const metadataText =
    memory.metadata === undefined || memory.metadata === null
      ? null
      : JSON.stringify(memory.metadata, null, 2);
  const contentTooLong = memory.content.length > 280;
  const importanceBars = Array.from({ length: 10 }, (_, index) => index < memory.importance);

  async function handleDelete() {
    try {
      setDeleting(true);
      await onDelete(memory);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className={`rounded-lg border-l-[3px] ${getTierAccentClassName(memory.tier)} border-ghost-border bg-ghost-surface`}>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-start gap-2">
            <Badge className={getTierBadgeClassName(memory.tier)}>
              {memory.tier === "hot" ? (
                <Flame className="mr-1 h-3.5 w-3.5" />
              ) : memory.tier === "warm" ? (
                <Thermometer className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Snowflake className="mr-1 h-3.5 w-3.5" />
              )}
              {formatMemoryTier(memory.tier)}
            </Badge>
            <Badge className={getTypeBadgeClassName(memory.type)}>
              {formatMemoryType(memory.type)}
            </Badge>

            <div className="flex items-center gap-2 rounded-full bg-ghost-raised px-3 py-1 text-xs text-slate-300">
              <span>Importance</span>
              <div className="flex gap-1">
                {importanceBars.map((active, index) => (
                  <span
                    key={index}
                    className={`h-2 w-1.5 rounded-full ${active ? "bg-brand-primary" : "bg-ghost-border"}`}
                  />
                ))}
              </div>
              <span>{memory.importance}/10</span>
            </div>

            {memory.agent ? (
              <Badge className="bg-ghost-raised text-slate-300">
                {memory.agent.emoji ? `${memory.agent.emoji} ` : ""}
                {memory.agent.displayName}
              </Badge>
            ) : null}

            <span className="ml-auto text-xs text-slate-500">
              {new Date(memory.createdAt).toLocaleDateString()}
            </span>
          </div>

          <div className="space-y-2">
            <p
              className={[
                "whitespace-pre-wrap text-sm leading-6 text-slate-300",
                expanded ? "" : "line-clamp-6"
              ].join(" ")}
            >
              {memory.content}
            </p>
            {contentTooLong ? (
              <button
                type="button"
                className="text-xs font-medium text-brand-cyan transition-colors hover:text-white"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            ) : null}
          </div>

          {metadataText ? (
            <div className="rounded-xl border border-ghost-border bg-ghost-raised/30 p-3">
              <button
                type="button"
                className="text-xs font-medium text-slate-300 transition-colors hover:text-white"
                onClick={() => setMetadataOpen((current) => !current)}
              >
                {metadataOpen ? "Hide metadata" : "Show metadata"}
              </button>
              {metadataOpen ? (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                  {metadataText}
                </pre>
              ) : null}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-col items-start justify-between gap-3 border-t border-ghost-border pt-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {(["hot", "warm", "cold"] as const).map((tier) => (
              <Button
                key={tier}
                type="button"
                size="sm"
                variant={memory.tier === tier ? "default" : "outline"}
                onClick={() => void onTierChange(memory, tier)}
                disabled={memory.tier === tier}
              >
                Move to {formatMemoryTier(tier)}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {expiryMeta ? (
              <span className={`text-xs ${expiryMeta.className}`}>{expiryMeta.label}</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete memory"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this memory?"
        description="This permanently removes the memory record from the agent's history."
        confirmLabel="Delete Memory"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
