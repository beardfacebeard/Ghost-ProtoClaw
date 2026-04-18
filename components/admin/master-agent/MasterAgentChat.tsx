"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { MessageBubble } from "@/components/admin/chat/MessageBubble";
import { VoiceInputButton } from "@/components/admin/chat/VoiceInputButton";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  model?: string | null;
  latencyMs?: number | null;
  toolsUsed?: string[];
};

type MasterAgent = {
  id: string;
  displayName: string;
  emoji: string | null;
  status: string;
};

type MasterAgentChatProps = {
  master: MasterAgent;
};

export function MasterAgentChat({ master }: MasterAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString()
    };

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetchWithCsrf("/api/admin/master-agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: trimmed, history })
      });

      const data = (await res.json()) as {
        response?: string;
        model?: string;
        latencyMs?: number;
        toolsUsed?: string[];
        error?: string;
        hint?: string;
      };

      if (!res.ok) {
        toast.error(data.error || "Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setInput(trimmed);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.response ?? "",
          createdAt: new Date().toISOString(),
          model: data.model,
          latencyMs: data.latencyMs,
          toolsUsed: data.toolsUsed
        }
      ]);

      if (data.toolsUsed?.length) {
        toast.success(`Master used: ${data.toolsUsed.join(", ")}`);
      }
    } catch {
      toast.error("Failed to send message.");
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
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

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-6"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md space-y-3 text-center">
              <div className="text-4xl">{master.emoji || "🛰️"}</div>
              <div className="text-lg font-semibold text-white">
                {master.displayName}
              </div>
              <div className="text-sm text-slate-400">
                I'm the master agent for your organization. I can talk to any
                of your business CEO agents on your behalf — ask me about a
                specific business, or for a roll-up across all of them.
              </div>
              <div className="text-xs text-slate-500">
                Conversation history is not persisted — refresh to start over.
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              agentName={master.displayName}
              agentEmoji={master.emoji}
              model={m.model}
              latencyMs={m.latencyMs}
              createdAt={m.createdAt}
              toolsUsed={m.toolsUsed}
            />
          ))
        )}

        {sending && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ghost-raised text-base">
              {master.emoji || "🛰️"}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-ghost-border bg-ghost-surface px-4 py-3 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {master.displayName} is consulting your CEO agents...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-ghost-border bg-ghost-surface px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${master.displayName}...`}
            disabled={sending}
            rows={1}
            className="min-h-[44px] max-h-[160px] resize-none border-ghost-border bg-ghost-raised"
          />
          <VoiceInputButton
            disabled={sending}
            onTranscript={(text) => {
              setInput((prev) =>
                prev.trim() ? `${prev.trimEnd()} ${text}` : text
              );
              textareaRef.current?.focus();
            }}
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
      </div>
    </div>
  );
}
