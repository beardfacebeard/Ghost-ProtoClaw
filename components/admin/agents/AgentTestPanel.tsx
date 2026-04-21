"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";
import { resolveAgentModel } from "@/lib/models/agent-models";

import { formatModelName } from "@/components/admin/agents/utils";

type TestAgent = {
  id: string;
  displayName: string;
  emoji: string | null;
  role: string;
  primaryModel?: string | null;
  fallbackModel?: string | null;
  safetyMode?: string | null;
};

type TestBusiness = {
  id: string;
  name: string;
  primaryModel?: string | null;
  fallbackModel?: string | null;
  safetyMode?: string | null;
} | null;

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
};

type AgentTestPanelProps = {
  agent: TestAgent;
  business: TestBusiness;
  systemDefault: string;
  trigger?: React.ReactNode;
};

export function AgentTestPanel({
  agent,
  business,
  systemDefault,
  trigger
}: AgentTestPanelProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [hint, setHint] = useState<string>();
  const resolved = useMemo(
    () => resolveAgentModel(agent, business, systemDefault),
    [agent, business, systemDefault]
  );

  async function sendMessage() {
    if (!message.trim()) {
      return;
    }

    const outbound: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: message.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, outbound]);
    setMessage("");
    setSubmitting(true);
    setHint(undefined);

    try {
      // Build conversation history from previous messages (excluding the current one)
      const history = messages
        .filter((m) => m.role === "user" || m.role === "agent")
        .map((m) => ({
          role: m.role === "agent" ? "assistant" as const : "user" as const,
          content: m.content
        }));

      const response = await fetchWithCsrf(`/api/admin/agents/${agent.id}/test`, {
        method: "POST",
        body: JSON.stringify({
          message: outbound.content,
          history
        })
      });
      const payload = (await response.json()) as {
        response?: string;
        error?: string;
        hint?: string;
      };

      if (!response.ok) {
        setHint(payload.hint || payload.error || "Unable to test this agent right now.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content:
            payload.response ||
            "Agent responded without content.",
          createdAt: new Date().toISOString()
        }
      ]);
    } catch (error) {
      setHint(
        error instanceof Error
          ? error.message
          : "Unable to test this agent right now."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || <Button variant="outline">Test</Button>}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-2xl flex-col gap-5 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-line-subtle px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-surface-2 text-2xl">
              {agent.emoji || "🤖"}
            </div>
            <div className="space-y-1">
              <SheetTitle className="flex items-center gap-2">
                <span>{agent.displayName}</span>
                <Badge className="bg-state-warning/20 text-state-warning">
                  Test Mode
                </Badge>
              </SheetTitle>
              <div className="text-sm text-ink-secondary">{agent.role}</div>
              <div className="text-xs text-ink-muted">
                Resolved model: {formatModelName(resolved.model)}
              </div>
            </div>
          </div>
        </SheetHeader>

        {hint ? (
          <div className="mx-6 rounded-2xl border border-steel/30 bg-steel/10 px-4 py-4 text-sm text-ink-primary">
            <div className="font-medium text-white">Setup needed</div>
            <div className="mt-2 leading-6">{hint}</div>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin/settings">Open Settings</Link>
            </Button>
          </div>
        ) : null}

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-6">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-subtle bg-bg-surface-2/20 px-5 py-6 text-sm leading-6 text-ink-secondary">
                Send a message to see how this agent responds in test mode.
              </div>
            ) : null}

            {messages.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex",
                  entry.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3",
                    entry.role === "user"
                      ? "bg-bg-surface-2 text-white"
                      : "border border-line-subtle bg-bg-surface text-ink-primary"
                  )}
                >
                  {entry.role === "agent" ? (
                    <div className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
                      <span>{agent.emoji || "🤖"}</span>
                      <span>{agent.displayName}</span>
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap text-sm leading-6">
                    {entry.content}
                  </div>
                  <div className="mt-2 text-[11px] text-ink-muted">
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </div>
                </div>
              </div>
            ))}

            {submitting ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-3 text-sm text-ink-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {agent.displayName} is thinking...
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="border-t border-line-subtle px-6 py-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a test message for this agent..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <Button onClick={() => void sendMessage()} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className="ml-2">Send</span>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-sm text-ink-secondary transition-colors hover:text-white"
                onClick={() => {
                  setMessages([]);
                  setHint(undefined);
                }}
              >
                Clear conversation
              </button>
              <div className="text-xs text-ink-muted">
                Test mode - not saved to memory or logs
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
