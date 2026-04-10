"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function ConversationSidebar({
  conversations: initialConversations,
  agents
}: ConversationSidebarProps) {
  const pathname = usePathname();
  const [conversations] = useState(initialConversations);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-ghost-border bg-ghost-base">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ghost-border px-4 py-4">
        <h2 className="text-sm font-semibold text-white">Conversations</h2>
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

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="space-y-3 px-4 py-8 text-center">
            <div className="text-2xl">💬</div>
            <div className="text-sm text-slate-400">No conversations yet</div>
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              Start your first conversation
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {conversations.map((conv) => {
              const isActive = pathname === `/admin/chat/${conv.id}`;

              return (
                <Link
                  key={conv.id}
                  href={`/admin/chat/${conv.id}`}
                  className={cn(
                    "block rounded-xl px-3 py-3 transition-colors",
                    isActive
                      ? "bg-ghost-raised border border-ghost-border-strong"
                      : "hover:bg-ghost-surface"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ghost-surface text-base">
                      {conv.agent.emoji || "🤖"}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {conv.title || conv.agent.displayName}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-600">
                          {formatRelativeTime(conv.updatedAt)}
                        </span>
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {getPreview(conv)}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {conv.business.name}
                      </div>
                    </div>
                  </div>
                </Link>
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
    </aside>
  );
}
