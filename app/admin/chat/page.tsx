import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-surface">
          <MessageSquare className="h-8 w-8 text-ink-muted" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white">
            Agent Chat
          </h2>
          <p className="max-w-sm text-sm leading-6 text-ink-secondary">
            Select a conversation from the sidebar or start a new one to chat
            with your agents. Messages are saved and agents remember the full
            conversation context.
          </p>
        </div>
      </div>
    </div>
  );
}
