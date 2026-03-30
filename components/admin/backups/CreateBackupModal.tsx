"use client";

import { useState } from "react";
import { Database, FolderOpen, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CreateBackupModalProps = {
  open: boolean;
  businesses: Array<{
    id: string;
    name: string;
  }>;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: {
    businessId?: string;
    sourceType: "gateway_config" | "workspace_snapshot" | "export_bundle";
    reason?: string;
  }) => Promise<void> | void;
};

const backupTypes = [
  {
    value: "gateway_config" as const,
    title: "Business Config",
    description: "Snapshot org settings and integration config without secrets.",
    icon: Database
  },
  {
    value: "workspace_snapshot" as const,
    title: "Workspace Snapshot",
    description: "Save every workspace file for a single business.",
    icon: FolderOpen
  },
  {
    value: "export_bundle" as const,
    title: "Export Bundle",
    description:
      "Complete business export with config, agents, workflows, knowledge, and workspace files.",
    icon: Package
  }
];

export function CreateBackupModal({
  open,
  businesses,
  onOpenChange,
  onCreate
}: CreateBackupModalProps) {
  const [sourceType, setSourceType] = useState<
    "gateway_config" | "workspace_snapshot" | "export_bundle"
  >("gateway_config");
  const [businessId, setBusinessId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const requiresBusiness = sourceType !== "gateway_config";

  async function handleCreate() {
    if (requiresBusiness && !businessId) {
      return;
    }

    try {
      setSaving(true);
      await onCreate({
        sourceType,
        businessId: requiresBusiness ? businessId : undefined,
        reason: reason.trim() || undefined
      });
      setReason("");
      setBusinessId("");
      setSourceType("gateway_config");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Backup</DialogTitle>
          <DialogDescription>
            Manual backups capture a restorable snapshot without including secrets or API keys.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <Label>Backup Type</Label>
            <div className="grid gap-3">
              {backupTypes.map((option) => {
                const Icon = option.icon;
                const active = sourceType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      active
                        ? "border-brand-primary bg-brand-primary/10"
                        : "border-ghost-border bg-ghost-surface hover:border-ghost-border-strong"
                    )}
                    onClick={() => setSourceType(option.value)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          active ? "bg-brand-primary text-white" : "bg-ghost-black text-slate-300"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{option.title}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Business</Label>
            <Select
              value={businessId}
              onValueChange={setBusinessId}
              disabled={!requiresBusiness}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    requiresBusiness
                      ? "Select a business"
                      : "Not required for config backups"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={business.id}>
                    {business.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are you creating this backup?"
              className="min-h-[96px]"
            />
          </div>

          <div className="rounded-xl border border-ghost-border bg-ghost-surface p-4 text-sm text-slate-400">
            Secrets and API keys are never included in backups.
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || (requiresBusiness && !businessId)}
          >
            {saving ? "Creating..." : "Create Backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
