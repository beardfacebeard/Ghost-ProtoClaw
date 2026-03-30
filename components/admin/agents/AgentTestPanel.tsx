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
      const response = await fetchWithCsrf(`/api/admin/agents/${agent.id}/test`, {
        method: "POST",
        body: JSON.stringify({
          message: outbound.content
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
            "OpenClaw responded without a message payload.",
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
        <SheetHeader className="border-b border-ghost-border px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ghost-raised text-2xl">
              {agent.emoji || "🤖"}
            </div>
            <div className="space-y-1">
              <SheetTitle className="flex items-center gap-2">
                <span>{agent.displayName}</span>
                <Badge className="bg-brand-amber/20 text-brand-amber">
                  Test Mode
                </Badge>
              </SheetTitle>
              <div className="text-sm text-slate-400">{agent.role}</div>
              <div className="text-xs text-slate-500">
                Resolved model: {formatModelName(resolved.model)}
              </div>
            </div>
          </div>
        </SheetHeader>

        {hint ? (
          <div className="mx-6 rounded-2xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-4 text-sm text-slate-200">
            <div className="font-medium text-white">OpenClaw setup needed</div>
            <div className="mt-2 leading-6">{hint}</div>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin/health">Open Health</Link>
            </Button>
          </div>
        ) : null}

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-6">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ghost-border bg-ghost-raised/20 px-5 py-6 text-sm leading-6 text-slate-400">
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
                      ? "bg-ghost-raised text-white"
                      : "border border-ghost-border bg-ghost-surface text-slate-200"
                  )}
                >
                  {entry.role === "agent" ? (
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                      <span>{agent.emoji || "🤖"}</span>
                      <span>{agent.displayName}</span>
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap text-sm leading-6">
                    {entry.content}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
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
                <div className="flex items-center gap-2 rounded-2xl border border-ghost-border bg-ghost-surface px-4 py-3 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {agent.displayName} is thinking...
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="border-t border-ghost-border px-6 py-5">
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
                className="text-sm text-slate-400 transition-colors hover:text-white"
                onClick={() => {
                  setMessages([]);
                  setHint(undefined);
                }}
              >
                Clear conversation
              </button>
              <div className="text-xs text-slate-500">
                Test mode - not saved to memory or logs
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
