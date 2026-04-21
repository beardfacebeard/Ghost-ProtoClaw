"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send, X, FileText, Image as ImageIcon } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { MessageBubble } from "@/components/admin/chat/MessageBubble";
import { VoiceInputButton } from "@/components/admin/chat/VoiceInputButton";

type Attachment = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  latencyMs?: number | null;
  createdAt: string;
  metadata?: {
    toolsUsed?: string[];
    attachments?: Attachment[];
  } | null;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function MessageThread({
  conversationId,
  agent,
  initialMessages,
  conversationStatus
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Rehydrate messages from the API on mount and whenever we switch
  // conversations. Next.js's router cache can serve a stale RSC payload when
  // navigating back to this route, which causes initialMessages to lag behind
  // what the user just sent. Fetching fresh on mount keeps the view correct.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/chat/conversations/${conversationId}/messages?limit=100`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: Array<{
            id: string;
            role: "user" | "assistant" | "system";
            content: string;
            model?: string | null;
            latencyMs?: number | null;
            createdAt: string;
            metadata?: { toolsUsed?: string[]; attachments?: Attachment[] } | null;
          }>;
        };
        if (cancelled || !Array.isArray(data.messages)) return;
        setMessages(data.messages);
      } catch {
        // Swallow — we already rendered initialMessages as a fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large. Max 10MB per file.`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetchWithCsrf("/api/admin/chat/upload", {
          method: "POST",
          body: formData
        });

        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || `Failed to upload ${file.name}`);
          continue;
        }

        const data = await res.json();
        setPendingFiles((prev) => [...prev, data.attachment]);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(id: string) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleSend() {
    const trimmed = input.trim();
    if ((!trimmed && pendingFiles.length === 0) || sending) return;

    // Build message content with file references
    let content = trimmed;
    if (pendingFiles.length > 0) {
      const fileList = pendingFiles
        .map((f) => `[Attached: ${f.fileName} (${formatFileSize(f.fileSize)})]`)
        .join("\n");
      content = content ? `${content}\n\n${fileList}` : fileList;
    }

    // Optimistic user message
    const optimisticId = `temp-${Date.now()}`;
    const userMsg: Message = {
      id: optimisticId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      metadata: pendingFiles.length > 0 ? { attachments: [...pendingFiles] } : null
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const currentFiles = [...pendingFiles];
    setPendingFiles([]);
    setSending(true);

    try {
      const res = await fetchWithCsrf(
        `/api/admin/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setInput(trimmed);
        setPendingFiles(currentFiles);
        return;
      }

      // Replace optimistic message with real one, add assistant response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        data.userMessage,
        data.assistantMessage
      ]);

      if (data.toolsUsed?.length) {
        toast.success(`Agent used tools: ${data.toolsUsed.join(", ")}`);
      }

      if (data.budgetWarning) {
        toast.warning(data.budgetWarning);
      }
    } catch {
      toast.error("Failed to send message. Check your connection.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(trimmed);
      setPendingFiles(currentFiles);
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
              <div className="text-sm text-ink-secondary">{agent.role}</div>
              <div className="text-sm text-ink-muted">
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
            toolsUsed={message.metadata?.toolsUsed}
          />
        ))}

        {sending && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg-surface-2 text-base">
              {agent.emoji || "🤖"}
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3 text-sm text-ink-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {agent.displayName} is thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-line-subtle bg-bg-surface px-4 py-3">
        {isCompleted ? (
          <div className="py-2 text-center text-sm text-ink-muted">
            This conversation has been completed. Start a new conversation to
            continue chatting.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Pending file attachments */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded-lg border border-line-subtle bg-bg-surface-2 px-3 py-1.5 text-xs"
                  >
                    {file.fileType.startsWith("image/") ? (
                      <ImageIcon className="h-3.5 w-3.5 text-steel-bright" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-state-warning" />
                    )}
                    <span className="max-w-[150px] truncate text-ink-primary">
                      {file.fileName}
                    </span>
                    <span className="text-ink-muted">
                      {formatFileSize(file.fileSize)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(file.id)}
                      className="text-ink-muted hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={sending || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-11 w-11 shrink-0"
                title="Attach file"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${agent.displayName}...`}
                disabled={sending}
                rows={1}
                className="min-h-[44px] max-h-[160px] resize-none border-line-subtle bg-bg-surface-2"
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
                disabled={(!input.trim() && pendingFiles.length === 0) || sending}
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
        )}
      </div>
    </div>
  );
}
