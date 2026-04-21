"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronRight,
  MessageSquarePlus,
  RefreshCw,
  Trash2
} from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { NewConversationDialog } from "@/components/admin/chat/NewConversationDialog";

type ConversationItem = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
  agent: {
    id: string;
    displayName: string;
    emoji: string | null;
    role: string;
  };
  business: {
    id: string;
    name: string;
  };
  messages?: Array<{
    content: string;
    role: string;
    createdAt: string;
  }>;
};

type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
  role: string;
  businessId: string | null;
  businessName: string;
  status: string;
};

type ConversationSidebarProps = {
  conversations: ConversationItem[];
  agents: AgentOption[];
};

function formatRelativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function getPreview(conversation: ConversationItem) {
  const lastMessage = conversation.messages?.[0];
  if (!lastMessage) return "No messages yet";
  const prefix = lastMessage.role === "user" ? "You: " : "";
  const text = lastMessage.content;
  return `${prefix}${text.length > 60 ? text.slice(0, 60) + "..." : text}`;
}

type BusinessGroup = {
  id: string;
  name: string;
  conversations: ConversationItem[];
};

function groupByBusiness(conversations: ConversationItem[]): BusinessGroup[] {
  const map = new Map<string, BusinessGroup>();
  for (const conv of conversations) {
    const existing = map.get(conv.business.id);
    if (existing) {
      existing.conversations.push(conv);
    } else {
      map.set(conv.business.id, {
        id: conv.business.id,
        name: conv.business.name,
        conversations: [conv]
      });
    }
  }
  // Preserve source order (conversations come back updatedAt desc), so the
  // business whose latest message is most recent appears first.
  return Array.from(map.values());
}

export function ConversationSidebar({
  conversations: initialConversations,
  agents
}: ConversationSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<ConversationItem | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const groups = useMemo(() => groupByBusiness(conversations), [conversations]);

  function toggle(businessId: string) {
    setCollapsed((prev) => ({ ...prev, [businessId]: !prev[businessId] }));
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const response = await fetchWithCsrf(
        `/api/admin/chat/conversations/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Delete failed");
      toast.success("Conversation deleted");
      // If we're currently viewing the deleted conversation, navigate away.
      if (pathname === `/admin/chat/${deleteTarget.id}`) {
        router.push("/admin/chat");
      }
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      router.refresh();
    } catch {
      toast.error("Failed to delete conversation");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-line-subtle bg-bg-app">
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-4">
        <h2 className="text-sm font-semibold text-white">Conversations</h2>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={handleRefresh}
            className="h-8 w-8"
            title="Refresh conversations"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="space-y-3 px-4 py-8 text-center">
            <div className="text-2xl">💬</div>
            <div className="text-sm text-ink-secondary">No conversations yet</div>
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              Start your first conversation
            </Button>
          </div>
        ) : (
          <div className="p-2">
            {groups.map((group) => {
              const isCollapsed = !!collapsed[group.id];
              return (
                <div key={group.id} className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggle(group.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted hover:bg-bg-surface hover:text-ink-primary"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 transition-transform",
                        !isCollapsed && "rotate-90"
                      )}
                    />
                    <span className="truncate">{group.name}</span>
                    <span className="ml-auto text-ink-muted">
                      {group.conversations.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {group.conversations.map((conv) => {
                        const isActive = pathname === `/admin/chat/${conv.id}`;
                        return (
                          <div
                            key={conv.id}
                            className={cn(
                              "group relative rounded-xl transition-colors",
                              isActive
                                ? "bg-bg-surface-2 border border-line"
                                : "hover:bg-bg-surface"
                            )}
                          >
                            <Link
                              href={`/admin/chat/${conv.id}`}
                              className="block px-3 py-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-base">
                                  {conv.agent.emoji || "🤖"}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1 pr-6">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-medium text-white">
                                      {conv.title || conv.agent.displayName}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-ink-muted">
                                      {formatRelativeTime(conv.updatedAt)}
                                    </span>
                                  </div>
                                  <div className="truncate text-xs text-ink-muted">
                                    {getPreview(conv)}
                                  </div>
                                </div>
                              </div>
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteTarget(conv);
                              }}
                              className="absolute right-2 top-2 rounded p-1 text-ink-muted transition-colors hover:bg-bg-surface-2 hover:text-steel-bright focus:text-steel-bright"
                              title="Delete conversation"
                              aria-label="Delete conversation"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete this conversation?"
        description={
          deleteTarget
            ? `All messages in "${deleteTarget.title || deleteTarget.agent.displayName}" will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete Conversation"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </aside>
  );
}
