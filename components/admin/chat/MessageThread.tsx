"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { MessageBubble } from "@/components/admin/chat/MessageBubble";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  latencyMs?: number | null;
  createdAt: string;
};

type ConversationAgent = {
  id: string;
  displayName: string;
  emoji: string | null;
  role: string;
};

type MessageThreadProps = {
  conversationId: string;
  agent: ConversationAgent;
  initialMessages: Message[];
  conversationStatus: string;
};

export function MessageThread({
  conversationId,
  agent,
  initialMessages,
  conversationStatus
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    // Optimistic user message
    const optimisticId = `temp-${Date.now()}`;
    const userMsg: Message = {
      id: optimisticId,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetchWithCsrf(
        `/api/admin/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content: trimmed })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send message");
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setInput(trimmed);
        return;
      }

      // Replace optimistic message with real one, add assistant response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        data.userMessage,
        data.assistantMessage
      ]);

      if (data.budgetWarning) {
        toast.warning(data.budgetWarning);
      }
    } catch {
      toast.error("Failed to send message. Check your connection.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(trimmed);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  const isCompleted = conversationStatus === "completed";

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-6"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="space-y-3 text-center">
              <div className="text-4xl">{agent.emoji || "🤖"}</div>
              <div className="text-lg font-semibold text-white">
                {agent.displayName}
              </div>
              <div className="text-sm text-slate-400">{agent.role}</div>
              <div className="text-sm text-slate-500">
                Send a message to start the conversation.
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            agentName={agent.displayName}
            agentEmoji={agent.emoji}
            model={message.model}
            latencyMs={message.latencyMs}
            createdAt={message.createdAt}
          />
        ))}

        {sending && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ghost-raised text-base">
              {agent.emoji || "🤖"}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-ghost-border bg-ghost-surface px-4 py-3 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {agent.displayName} is thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-ghost-border bg-ghost-surface px-4 py-3">
        {isCompleted ? (
          <div className="py-2 text-center text-sm text-slate-500">
            This conversation has been completed. Start a new conversation to
            continue chatting.
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agent.displayName}...`}
              disabled={sending}
              rows={1}
              className="min-h-[44px] max-h-[160px] resize-none border-ghost-border bg-ghost-raised"
            />
            <Button
              type="button"
              size="icon"
              disabled={!input.trim() || sending}
              onClick={() => void handleSend()}
              className="h-11 w-11 shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
