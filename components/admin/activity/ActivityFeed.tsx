"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Cog,
  GitBranch,
  Loader2,
  MessageSquare,
  Play,
  Plug,
  Square,
  Trash2,
  Wrench,
  XCircle
} from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import type {
  ActivityEvent,
  ActivityEventKind
} from "@/components/admin/activity/types";

export type { ActivityEvent };

type BusinessOption = { id: string; name: string };

type ActivityFeedProps = {
  businesses: BusinessOption[];
};

const KIND_META: Record<
  ActivityEventKind,
  { label: string; icon: typeof Bot; color: string }
> = {
  workflow: { label: "Workflow", icon: GitBranch, color: "text-steel-bright" },
  approval: { label: "Approval", icon: CheckCircle2, color: "text-state-warning" },
  backup: { label: "Backup", icon: Archive, color: "text-ink-secondary" },
  integration: { label: "Integration", icon: Plug, color: "text-steel-bright" },
  agent: { label: "Agent", icon: Bot, color: "text-steel-bright" },
  system: { label: "System", icon: Cog, color: "text-ink-secondary" },
  action_run: { label: "Action", icon: Play, color: "text-state-success" },
  tool_call: { label: "Tool", icon: Wrench, color: "text-state-warning" },
  message: { label: "Message", icon: MessageSquare, color: "text-ink-secondary" }
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
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchStream(controller.signal);
    return () => controller.abort();
  }, [fetchStream]);

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

  // Every row is deletable from Pulse — messages, action runs, activity
  // entries. Deleting a message here removes it from the conversation too;
  // deleting a pending/running action just drops the log row (the in-flight
  // work completes in memory and writes back to a missing row, which the
  // existing try/catch absorbs).
  const deletableIds = useMemo(() => events.map((e) => e.id), [events]);
  const allDeletableChecked =
    deletableIds.length > 0 && deletableIds.every((id) => checkedIds.has(id));
  const someChecked = checkedIds.size > 0;

  function toggleOne(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setCheckedIds((prev) => {
      if (allDeletableChecked) return new Set();
      return new Set(deletableIds);
    });
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      const ids = Array.from(checkedIds);
      const res = await fetchWithCsrf("/api/admin/activity/delete", {
        method: "POST",
        body: JSON.stringify({ ids })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error || "Failed to delete events.");
        return;
      }
      toast.success(data.message || `Deleted ${ids.length} event(s).`);
      setCheckedIds(new Set());
      setSelectedId((current) =>
        current && checkedIds.has(current) ? null : current
      );
      await fetchStream();
    } catch {
      toast.error("Failed to delete events.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    // h-full + overflow-hidden on the root so nested scrollers are bounded.
    <div className="flex h-full gap-4 overflow-hidden">
      {/* Center column — independently scrollable list */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-bg-surface px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <span className={cn("relative flex h-2 w-2")}>
              {!paused ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-state-success opacity-75" />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  paused ? "bg-slate-500" : "bg-state-success"
                )}
              />
            </span>
            {paused ? "Paused" : "Live"}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {someChecked ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {checkedIds.size}
              </Button>
            ) : null}
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

        {/* Select-all row — also shows retention note so users know old
            events auto-delete after 30 days. */}
        {deletableIds.length > 0 ? (
          <div className="flex shrink-0 items-center gap-3 border-b border-line-subtle bg-bg-app/60 px-5 py-2 text-[11px] text-ink-muted">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-2 rounded px-1 py-1 text-ink-secondary hover:text-white"
              aria-label={
                allDeletableChecked ? "Deselect all" : "Select all visible"
              }
            >
              {allDeletableChecked ? (
                <CheckSquare className="h-3.5 w-3.5 text-steel-bright" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              <span>
                {someChecked ? `${checkedIds.size} selected` : "Select all"}
              </span>
            </button>
            <span className="ml-auto text-[10px] text-ink-muted">
              Events older than 30 days are auto-deleted.
            </span>
          </div>
        ) : null}

        {/* THE scrollable list. min-h-0 on every ancestor is what makes the
            overflow-y-auto actually clip instead of pushing the parent page. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && events.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-secondary">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading activity…
            </div>
          ) : events.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="space-y-2">
                <CircleDot className="mx-auto h-8 w-8 text-ink-muted" />
                <div className="text-sm text-ink-secondary">
                  No activity matches these filters yet.
                </div>
                <div className="text-xs text-ink-muted">
                  Agents, workflows, and tool calls will show up here as they
                  happen.
                </div>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {events.map((event) => {
                const meta = KIND_META[event.kind] ?? KIND_META.system;
                const Icon = meta.icon;
                const isSelected = event.id === selectedId;
                const isFailed =
                  event.status === "failed" || event.status === "error";
                const isChecked = checkedIds.has(event.id);
                // Outreach drafts + video clips use status="pending" to
                // mean "awaiting human review" — NOT "a job is running".
                // Without this carve-out, Pulse renders a spinner that
                // looks stuck forever on every draft/clip the agents
                // produce.
                const isOutreachDraft =
                  event.kind === ("outreach_target" as unknown as typeof event.kind) ||
                  event.kind === ("reddit_target" as unknown as typeof event.kind);
                const isVideoClip =
                  event.kind === ("video_clip" as unknown as typeof event.kind);
                const isReviewable = isOutreachDraft || isVideoClip;
                const reviewHref = isVideoClip
                  ? "/admin/clips"
                  : "/admin/targets";
                const reviewLabel = isVideoClip
                  ? "Review in Clips →"
                  : "Review in Targets →";
                const showSpinner =
                  !isReviewable &&
                  (event.status === "pending" ||
                    event.status === "running");
                return (
                  <li
                    key={event.id}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3 transition-colors hover:bg-bg-surface",
                      isSelected && "bg-bg-surface",
                      isChecked && "bg-steel/5"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOne(event.id);
                      }}
                      className="mt-1 rounded p-0.5 text-ink-muted hover:text-white"
                      aria-label={isChecked ? "Unselect" : "Select"}
                    >
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4 text-steel-bright" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-surface-2",
                          meta.color,
                          isFailed && "text-state-danger"
                        )}
                      >
                        {isFailed ? (
                          <XCircle className="h-4 w-4" />
                        ) : showSpinner ? (
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
                            className="text-[10px] text-ink-secondary"
                          >
                            {meta.label}
                          </Badge>
                          {isReviewable && event.status === "pending" ? (
                            <Badge
                              variant="amber"
                              className="text-[10px]"
                            >
                              awaiting review
                            </Badge>
                          ) : (
                            <StatusBadge status={event.status} />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-muted">
                          {event.businessName ? (
                            <span>{event.businessName}</span>
                          ) : null}
                          {event.agentName ? (
                            <span>
                              {event.agentEmoji ?? "🤖"} {event.agentName}
                            </span>
                          ) : null}
                          <span>{formatRelative(event.createdAt)}</span>
                          {isReviewable ? (
                            <a
                              href={reviewHref}
                              onClick={(e) => e.stopPropagation()}
                              className="text-steel-bright hover:underline"
                            >
                              {reviewLabel}
                            </a>
                          ) : null}
                        </div>
                        {event.detail ? (
                          <div
                            className={cn(
                              "line-clamp-2 text-xs",
                              isFailed ? "text-state-danger" : "text-ink-muted"
                            )}
                          >
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

      {/* Right column — independently scrollable details. Always visible
          (no lg:flex gate) so the details panel is never silently hidden
          on mid-width viewports. On very narrow screens it still shares
          the flex row; shrink-0 keeps it at w-80 minimum. */}
      <aside className="flex min-h-0 w-80 shrink-0 flex-col border-l border-line-subtle bg-bg-app xl:w-96">
        <div className="shrink-0 border-b border-line-subtle px-5 py-3 text-sm font-semibold text-white">
          {selected ? "Event details" : "Select an event"}
        </div>
        {selected ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-ink-muted">
                Title
              </div>
              <div className="text-white">{selected.title}</div>
            </div>
            {selected.detail ? (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-ink-muted">
                  Detail
                </div>
                <div className="whitespace-pre-wrap text-ink-primary">
                  {selected.detail}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-ink-muted">
                  Type
                </div>
                <div className="text-ink-primary">
                  {KIND_META[selected.kind]?.label ?? selected.kind}
                </div>
              </div>
              {selected.status ? (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-ink-muted">
                    Status
                  </div>
                  <div className="text-ink-primary">{selected.status}</div>
                </div>
              ) : null}
              {selected.businessName ? (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-ink-muted">
                    Business
                  </div>
                  <div className="text-ink-primary">{selected.businessName}</div>
                </div>
              ) : null}
              {selected.agentName ? (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-ink-muted">
                    Agent
                  </div>
                  <div className="text-ink-primary">
                    {selected.agentEmoji ?? "🤖"} {selected.agentName}
                  </div>
                </div>
              ) : null}
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-ink-muted">
                  When
                </div>
                <div className="text-ink-primary">
                  {new Date(selected.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            {selected.metadata &&
            Object.keys(selected.metadata).length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-ink-muted">
                  Metadata
                </div>
                <pre className="overflow-x-auto rounded-lg border border-line-subtle bg-bg-surface-2 p-3 text-[11px] text-ink-primary">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Pick an event on the left to see full details.
            </div>
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${checkedIds.size} event${checkedIds.size === 1 ? "" : "s"}?`}
        description="These events will be permanently removed. Pending/running runs get cancelled cleanly — any in-flight LLM call still finishes but writes back to nothing. Deleting a message event also removes that message from the conversation thread."
        confirmLabel="Delete events"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
