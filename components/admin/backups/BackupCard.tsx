"use client";

import { useMemo, useState } from "react";
import {
  Clock3,
  Database,
  FileText,
  FolderOpen,
  Package,
  Settings
} from "lucide-react";

import { formatRelativeTime } from "@/components/admin/ActivityFeed";
import { JsonViewer } from "@/components/admin/JsonViewer";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

type BackupRecord = {
  id: string;
  businessId: string | null;
  sourceType: string;
  scopeType: string | null;
  scopeId: string | null;
  status: string;
  payload: unknown;
  triggeredBy: string | null;
  reason: string | null;
  createdAt: Date | string;
  business: {
    id: string;
    name: string;
  } | null;
};

type BackupCardProps = {
  backup: BackupRecord;
  onRestore: (backup: BackupRecord) => Promise<void> | void;
  isSuperAdmin: boolean;
};

function getSourceMeta(sourceType: string) {
  switch (sourceType) {
    case "gateway_config":
      return {
        icon: Settings,
        className: "bg-brand-cyan/15 text-brand-cyan",
        label: "Config"
      };
    case "workspace_file":
      return {
        icon: FileText,
        className: "bg-brand-amber/15 text-brand-amber",
        label: "Workspace File"
      };
    case "workspace_snapshot":
      return {
        icon: FolderOpen,
        className: "bg-status-info/15 text-status-info",
        label: "Workspace Snapshot"
      };
    default:
      return {
        icon: Package,
        className: "bg-brand-primary/15 text-brand-primary",
        label: "Export Bundle"
      };
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-status-active/15 text-status-active";
    case "failed":
      return "bg-status-error/15 text-status-error";
    default:
      return "bg-brand-amber/15 text-brand-amber";
  }
}

function getScopeLabel(backup: BackupRecord) {
  if (backup.sourceType === "gateway_config") {
    return "Org config";
  }

  if (backup.sourceType === "workspace_file" && backup.scopeId) {
    return `Single file: ${backup.scopeId}`;
  }

  if (backup.sourceType === "workspace_snapshot") {
    return "Full workspace snapshot";
  }

  return "Full business snapshot";
}

export function BackupCard({
  backup,
  onRestore,
  isSuperAdmin
}: BackupCardProps) {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const sourceMeta = useMemo(() => getSourceMeta(backup.sourceType), [backup.sourceType]);
  const Icon = sourceMeta.icon;
  const payloadSizeKb = Math.max(
    1,
    Math.round(JSON.stringify(backup.payload ?? null).length / 1024)
  );

  async function handleRestore() {
    if (confirmText !== "RESTORE") {
      return;
    }

    try {
      setRestoring(true);
      await onRestore(backup);
      setRestoreOpen(false);
      setConfirmText("");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="rounded-xl border border-ghost-border bg-ghost-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              sourceMeta.className
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <Badge className="bg-ghost-raised text-white">{sourceMeta.label}</Badge>
          <Badge className={getStatusClass(backup.status)}>
            {backup.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock3 className="h-4 w-4" />
          <span title={new Date(backup.createdAt).toLocaleString()}>
            {formatRelativeTime(backup.createdAt)}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        {backup.business ? (
          <Badge className="bg-ghost-black text-slate-300">
            {backup.business.name}
          </Badge>
        ) : null}

        <div className="text-white">{getScopeLabel(backup)}</div>
        <div className="text-slate-400">
          Triggered by{" "}
          {backup.reason?.toLowerCase().includes("before")
            ? "Auto (before update)"
            : `Manual by ${backup.triggeredBy ?? "system"}`}
        </div>
        {backup.reason ? (
          <div className="italic text-slate-500">{backup.reason}</div>
        ) : null}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Database className="h-3.5 w-3.5" />
          <span>~{payloadSizeKb} KB</span>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-ghost-border pt-4">
        <JsonViewer
          data={backup.payload ?? {}}
          collapsed
          collapsedLabel="View contents"
          expandedLabel="Hide contents"
          maxHeight={260}
        />

        {isSuperAdmin && backup.status === "completed" ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-brand-amber/35 text-brand-amber hover:bg-brand-amber/10"
              onClick={() => setRestoreOpen(true)}
            >
              Restore
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore from this backup?</DialogTitle>
            <DialogDescription>
              This will overwrite current scope data. A backup of the current state will be created first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-slate-400">
              Type <span className="font-mono text-white">RESTORE</span> to confirm.
            </div>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="RESTORE"
              className="font-mono"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreOpen(false)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-brand-amber/35 text-brand-amber hover:bg-brand-amber/10"
              disabled={confirmText !== "RESTORE" || restoring}
              onClick={() => void handleRestore()}
            >
              {restoring ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
