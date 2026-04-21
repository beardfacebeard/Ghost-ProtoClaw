"use client";

import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  role: "user" | "assistant" | "system";
  content: string;
  agentName?: string;
  agentEmoji?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  createdAt?: string | Date;
  toolsUsed?: string[];
};

function formatTime(date: string | Date | undefined) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
  role,
  content,
  agentName,
  agentEmoji,
  model,
  latencyMs,
  createdAt,
  toolsUsed
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg-surface-2 text-base">
          {agentEmoji || "🤖"}
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] space-y-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        {!isUser && agentName && (
          <div className="px-1 text-xs font-medium text-ink-secondary">
            {agentName}
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
            isUser
              ? "bg-steel/15 text-white"
              : "border border-line-subtle bg-bg-surface text-ink-primary"
          )}
        >
          {content}
        </div>

        <div
          className={cn(
            "flex gap-2 px-1 text-[10px] text-ink-muted",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          {createdAt && <span>{formatTime(createdAt)}</span>}
          {!isUser && model && (
            <span className="text-slate-700">{model.split("/").pop()}</span>
          )}
          {!isUser && latencyMs != null && (
            <span className="text-slate-700">{(latencyMs / 1000).toFixed(1)}s</span>
          )}
          {!isUser && toolsUsed && toolsUsed.length > 0 && (
            <span className="text-state-warning" title={toolsUsed.join(", ")}>
              used {toolsUsed.length} tool{toolsUsed.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-steel/20 text-xs font-bold text-steel-bright">
          You
        </div>
      )}
    </div>
  );
}
