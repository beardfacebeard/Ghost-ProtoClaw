"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  CircleDot,
  Cog,
  GitBranch,
  Loader2,
  MessageSquare,
  Play,
  Plug,
  Wrench,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ActivityEventKind =
  | "workflow"
  | "approval"
  | "backup"
  | "integration"
  | "agent"
  | "system"
  | "action_run"
  | "tool_call"
  | "message";

export type ActivityEvent = {
  id: string;
  kind: ActivityEventKind;
  title: string;
  detail: string | null;
  status: string | null;
  businessId: string | null;
  businessName: string | null;
  agentId: string | null;
  agentName: string | null;
  agentEmoji: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

type BusinessOption = { id: string; name: string };

type ActivityFeedProps = {
  businesses: BusinessOption[];
};

const KIND_META: Record<
  ActivityEventKind,
  { label: string; icon: typeof Bot; color: string }
> = {
  workflow: { label: "Workflow", icon: GitBranch, color: "text-brand-cyan" },
  approval: { label: "Approval", icon: CheckCircle2, color: "text-brand-amber" },
  backup: { label: "Backup", icon: Archive, color: "text-slate-400" },
  integration: { label: "Integration", icon: Plug, color: "text-brand-cyan" },
  agent: { label: "Agent", icon: Bot, color: "text-brand-primary" },
  system: { label: "System", icon: Cog, color: "text-slate-400" },
  action_run: { label: "Action", icon: Play, color: "text-status-active" },
  tool_call: { label: "Tool", icon: Wrench, color: "text-brand-amber" },
  message: { label: "Message", icon: MessageSquare, color: "text-slate-400" }
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const variant: "active" | "error" | "amber" | "default" =
    status === "completed" || status === "enabled" || status === "active"
      ? "active"
      : status === "failed" || status === "error"
        ? "error"
        : status === "pending" || status === "running"
          ? "amber"
          : "default";
  return (
    <Badge variant={variant} className="text-[10px]">
      {status}
    </Badge>
  );
}

export function ActivityFeed({ businesses }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessFilter, setBusinessFilter] = useState<string>("__all__");
  const [kindFilter, setKindFilter] = useState<string>("__all__");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStream = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const qs = new URLSearchParams();
        if (businessFilter !== "__all__") qs.set("businessId", businessFilter);
        if (kindFilter !== "__all__") qs.set("kind", kindFilter);
        qs.set("limit", "75");
        const res = await fetch(`/api/admin/activity/stream?${qs}`, {
          cache: "no-store",
          signal
        });
        if (!res.ok) return;
        const data = (await res.json()) as { events: ActivityEvent[] };
        setEvents(data.events ?? []);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("activity stream fetch failed", err);
        }
      } finally {
        setLoading(false);
      }
    },
    [businessFilter, kindFilter]
  );

  // Initial load + refetch when filters change
  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchStream(controller.signal);
    return () => controller.abort();
  }, [fetchStream]);

  // Live polling
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      void fetchStream();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStream, paused]);

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  );

  return (
    <div className="flex h-full gap-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-ghost-border bg-ghost-surface px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className={cn("relative flex h-2 w-2")}>
              {!paused ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-active opacity-75" />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  paused ? "bg-slate-500" : "bg-status-active"
                )}
              />
            </span>
            {paused ? "Paused" : "Live"}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={businessFilter} onValueChange={setBusinessFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="All businesses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All businesses</SelectItem>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="All event types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All events</SelectItem>
                <SelectItem value="tool_call">Tool calls</SelectItem>
                <SelectItem value="action_run">Action runs</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="approval">Approvals</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="integration">Integrations</SelectItem>
                <SelectItem value="backup">Backups</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && events.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading activity…
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="space-y-2">
                <CircleDot className="mx-auto h-8 w-8 text-slate-600" />
                <div className="text-sm text-slate-400">
                  No activity matches these filters yet.
                </div>
                <div className="text-xs text-slate-600">
                  Agents, workflows, and tool calls will show up here as they
                  happen.
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-ghost-border">
              {events.map((event) => {
                const meta = KIND_META[event.kind] ?? KIND_META.system;
                const Icon = meta.icon;
                const isSelected = event.id === selectedId;
                const isFailed =
                  event.status === "failed" || event.status === "error";
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-ghost-surface",
                        isSelected && "bg-ghost-surface"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ghost-raised",
                          meta.color,
                          isFailed && "text-status-error"
                        )}
                      >
                        {isFailed ? (
                          <XCircle className="h-4 w-4" />
                        ) : event.status === "pending" ||
                          event.status === "running" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-white">
                            {event.title}
                          </span>
                          <Badge
                            variant="default"
                            className="text-[10px] text-slate-400"
                          >
                            {meta.label}
                          </Badge>
                          <StatusBadge status={event.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                          {event.businessName ? (
                            <span>{event.businessName}</span>
                          ) : null}
                          {event.agentName ? (
                            <span>
                              {event.agentEmoji ?? "🤖"} {event.agentName}
                            </span>
                          ) : null}
                          <span>{formatRelative(event.createdAt)}</span>
                        </div>
                        {event.detail ? (
                          <div className="truncate text-xs text-slate-500">
                            {event.detail}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="hidden w-96 shrink-0 flex-col border-l border-ghost-border bg-ghost-base lg:flex">
        <div className="border-b border-ghost-border px-5 py-3 text-sm font-semibold text-white">
          {selected ? "Event details" : "Select an event"}
        </div>
        {selected ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Title
              </div>
              <div className="text-white">{selected.title}</div>
            </div>
            {selected.detail ? (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Detail
                </div>
                <div className="whitespace-pre-wrap text-slate-200">
                  {selected.detail}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Type
                </div>
                <div className="text-slate-200">
                  {KIND_META[selected.kind]?.label ?? selected.kind}
                </div>
              </div>
              {selected.status ? (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Status
                  </div>
                  <div className="text-slate-200">{selected.status}</div>
                </div>
              ) : null}
              {selected.businessName ? (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Business
                  </div>
                  <div className="text-slate-200">{selected.businessName}</div>
                </div>
              ) : null}
              {selected.agentName ? (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Agent
                  </div>
                  <div className="text-slate-200">
                    {selected.agentEmoji ?? "🤖"} {selected.agentName}
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  When
                </div>
                <div className="text-slate-200">
                  {new Date(selected.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            {selected.metadata &&
            Object.keys(selected.metadata).length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Metadata
                </div>
                <pre className="overflow-x-auto rounded-lg border border-ghost-border bg-ghost-raised p-3 text-[11px] text-slate-300">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-8 text-center text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pick an event on the left to see full details.
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
