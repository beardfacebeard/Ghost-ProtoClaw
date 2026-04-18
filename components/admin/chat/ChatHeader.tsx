"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MoreVertical, Pencil, Trash2, X } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

type ChatHeaderProps = {
  conversationId: string;
  title: string | null;
  status: string;
  agent: {
    displayName: string;
    emoji: string | null;
    role: string;
  };
  businessName: string;
};

const statusStyles: Record<string, { variant: string; label: string }> = {
  active: { variant: "active", label: "Active" },
  completed: { variant: "default", label: "Completed" },
  escalated: { variant: "warning", label: "Escalated" },
  failed: { variant: "destructive", label: "Failed" }
};

export function ChatHeader({
  conversationId,
  title,
  status,
  agent,
  businessName
}: ChatHeaderProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title || "");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleRename() {
    if (!editValue.trim()) return;

    try {
      await fetchWithCsrf(
        `/api/admin/chat/conversations/${conversationId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: editValue.trim() })
        }
      );
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to rename conversation");
    }
  }

  async function handleMarkComplete() {
    try {
      await fetchWithCsrf(
        `/api/admin/chat/conversations/${conversationId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "completed" })
        }
      );
      toast.success("Conversation marked as completed");
      router.refresh();
    } catch {
      toast.error("Failed to update conversation");
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      const response = await fetchWithCsrf(
        `/api/admin/chat/conversations/${conversationId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Delete failed");
      toast.success("Conversation deleted");
      router.push("/admin/chat");
      router.refresh();
    } catch {
      toast.error("Failed to delete conversation");
    } finally {
      setDeleting(false);
    }
  }

  const statusMeta = statusStyles[status] || statusStyles.active;

  return (
    <div className="flex items-center justify-between border-b border-ghost-border bg-ghost-surface px-5 py-3">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ghost-raised text-xl">
          {agent.emoji || "🤖"}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {editing ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleRename();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  className="h-7 w-48 text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => void handleRename()}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setEditing(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm font-semibold text-white">
                  {title || agent.displayName}
                </span>
                <Badge
                  variant={statusMeta.variant as any}
                  className="text-[10px]"
                >
                  {statusMeta.label}
                </Badge>
              </>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {agent.role} &middot; {businessName}
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setEditValue(title || agent.displayName);
              setEditing(true);
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
          {status === "active" && (
            <DropdownMenuItem onClick={() => void handleMarkComplete()}>
              <Check className="mr-2 h-3.5 w-3.5" />
              Mark Complete
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-brand-primary focus:text-brand-primary"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this conversation?"
        description="All messages in this conversation will be permanently removed. This cannot be undone."
        confirmLabel="Delete Conversation"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
