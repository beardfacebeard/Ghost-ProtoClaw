"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, User2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  model?: string;
};

const SUGGESTED_PROMPTS = [
  "How do I create my first business?",
  "Help me write a good system prompt for a customer-service agent",
  "What cron expression means every weekday at 9am?",
  "How do I make sure I get future updates?",
];

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm the Help Assistant, powered by Claude Opus 4.6. I can help you with this app (features, setup, workflows, updates, troubleshooting) and with the broader work you're doing — writing prompts, explaining technical concepts, suggesting approaches, general questions. Ask me anything.",
};

export function HelpAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const payload = {
        messages: next
          .filter((m) => m.role === "user" || m.role === "assistant")
          .filter((_, idx, arr) => !(idx === 0 && arr[0].role === "assistant"))
          .map((m) => ({ role: m.role, content: m.content })),
      };

      const response = await fetchWithCsrf("/api/admin/help/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Something went wrong while asking the Help Assistant.",
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.content ?? "(no response)",
          model: data.model,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The Help Assistant is unavailable right now.",
      );
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex h-[620px] flex-col rounded border border-line-subtle bg-bg-surface shadow-surface">
      <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-steel/15 text-steel-bright">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            Help Assistant
          </div>
          <div className="text-xs text-ink-muted">
            Claude Opus 4.6 · app help + general knowledge
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, idx) => (
          <MessageRow key={idx} message={m} />
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}

        {error && (
          <div className="rounded border border-status-error/40 bg-state-danger/10 px-3 py-2 text-xs text-state-danger">
            {error}
          </div>
        )}

        {messages.length === 1 && !sending && (
          <div className="space-y-2 pt-2">
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">
              Try asking
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void send(prompt)}
                  className="rounded-full border border-line-subtle bg-bg-surface-2 px-3 py-1.5 text-xs text-ink-primary transition-colors hover:border-steel/40 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t border-line-subtle px-3 py-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about anything in the Help articles…"
          rows={1}
          disabled={sending}
          className="min-h-[40px] resize-none"
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg-surface-2 text-steel-bright">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className="max-w-[85%] space-y-1">
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-steel/15 text-white"
              : "border border-line-subtle bg-bg-surface-2 text-ink-primary",
          )}
        >
          {message.content}
        </div>
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-steel/20 text-steel-bright">
          <User2 className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
