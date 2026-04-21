"use client";

import { useState } from "react";
import {
  Bot,
  Braces,
  File,
  FileText,
  Pencil,
  Table,
  Trash2
} from "lucide-react";

import { getWorkspaceExtension, formatWorkspaceCategory } from "@/lib/brain/workspace";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type WorkspaceDocumentCard = {
  id: string;
  businessId: string;
  agentId: string | null;
  filePath: string;
  content: string;
  category: string;
  tier: string;
  syncStatus: string;
  syncTarget: string;
  lastSyncAt: Date | string | null;
  updatedAt: Date | string;
};

type WorkspaceDocCardProps = {
  doc: WorkspaceDocumentCard;
  agent?: { id: string; displayName: string; emoji: string | null } | null;
  compact?: boolean;
  onEdit?: (doc: WorkspaceDocumentCard) => void;
  onDelete?: (doc: WorkspaceDocumentCard) => Promise<void> | void;
};

function getFileIcon(filePath: string) {
  switch (getWorkspaceExtension(filePath)) {
    case ".md":
      return {
        icon: FileText,
        className: "text-steel-bright"
      };
    case ".txt":
      return {
        icon: FileText,
        className: "text-ink-secondary"
      };
    case ".json":
      return {
        icon: Braces,
        className: "text-state-warning"
      };
    case ".csv":
      return {
        icon: Table,
        className: "text-state-success"
      };
    default:
      return {
        icon: File,
        className: "text-ink-secondary"
      };
  }
}

function getTierDotClassName(tier: string) {
  switch (tier) {
    case "hot":
      return "bg-steel animate-pulse";
    case "warm":
      return "bg-state-warning";
    default:
      return "bg-slate-500";
  }
}

function getTierBadgeClassName(tier: string) {
  switch (tier) {
    case "hot":
      return "bg-steel/15 text-steel-bright";
    case "warm":
      return "bg-state-warning/15 text-state-warning";
    default:
      return "bg-bg-surface-2 text-ink-primary";
  }
}

function getSyncStatusMeta(syncStatus: string) {
  switch (syncStatus) {
    case "synced":
      return {
        label: "Synced",
        className: "text-state-success"
      };
    case "pending":
      return {
        label: "Pending sync",
        className: "text-state-warning"
      };
    default:
      return {
        label: "Unavailable",
        className: "text-state-danger"
      };
  }
}

export function WorkspaceDocCard({
  doc,
  agent,
  compact = false,
  onEdit,
  onDelete
}: WorkspaceDocCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileMeta = getFileIcon(doc.filePath);
  const FileIcon = fileMeta.icon;
  const syncMeta = getSyncStatusMeta(doc.syncStatus);
  const pathSegments = doc.filePath.split("/");
  const directory = pathSegments.slice(0, -1).join("/");
  const filename = pathSegments[pathSegments.length - 1] ?? doc.filePath;

  async function handleDelete() {
    if (!onDelete) {
      return;
    }

    try {
      setDeleting(true);
      await onDelete(doc);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className="rounded-lg border-line-subtle bg-bg-surface">
        <CardContent className="flex items-start gap-4 p-4">
          <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-surface-2 ${fileMeta.className}`}>
            <FileIcon className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="min-w-0 font-mono text-sm text-white">
              {directory ? (
                <>
                  <span className="text-ink-muted">{directory}/</span>
                  <span className="font-semibold text-white">{filename}</span>
                </>
              ) : (
                <span className="font-semibold text-white">{filename}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-bg-surface-2 text-ink-primary">
                {formatWorkspaceCategory(doc.category)}
              </Badge>
              <Badge className={getTierBadgeClassName(doc.tier)}>{doc.tier}</Badge>
            </div>

            {agent ? (
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <Bot className="h-3.5 w-3.5" />
                <span>
                  {agent.emoji ? `${agent.emoji} ` : ""}
                  {agent.displayName}
                </span>
              </div>
            ) : null}

            <div className="line-clamp-2 text-xs leading-5 text-ink-muted">
              {doc.content.slice(0, 80) || "Empty file"}
            </div>

            <div className={`text-xs ${syncMeta.className}`}>
              {syncMeta.label}
              {doc.lastSyncAt ? ` • ${new Date(doc.lastSyncAt).toLocaleDateString()}` : ""}
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <span
              className={`mt-2 inline-flex h-2.5 w-2.5 rounded-full ${getTierDotClassName(doc.tier)}`}
            />
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onEdit(doc)}
                aria-label="Edit workspace file"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete workspace file"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this workspace file?"
        description="A backup will be created first, then this file will be permanently removed."
        confirmLabel="Delete File"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
