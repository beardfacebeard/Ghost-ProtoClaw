"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  Square,
  Trash2,
  X,
  Zap
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

import { TodoComposer } from "@/components/admin/todos/TodoComposer";

export type TodoRecord = {
  id: string;
  businessId: string;
  businessName: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  agentId: string | null;
  agentName: string | null;
  agentEmoji: string | null;
  dueAt: string | null;
  snoozedUntil: string | null;
  createdVia: string;
  createdBy: string | null;
  createdByAgentId: string | null;
  tags: string[];
  recurringPattern: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  delegatedConversationId: string | null;
  createdAt: string;
};

type BusinessOption = { id: string; name: string };
type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
  businessId: string;
};

type Props = {
  businesses: BusinessOption[];
  defaultBusinessId: string | null;
  todos: TodoRecord[];
  agents: AgentOption[];
};

type TabKey = "active_queue" | "ideas" | "snoozed" | "done";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-state-danger/15 text-state-danger",
  high: "bg-state-warning/15 text-state-warning",
  medium: "bg-bg-surface-2 text-ink-secondary",
  low: "bg-bg-surface-2 text-ink-muted"
};

function dueLabel(dueAt: string | null): {
  label: string;
  tone: "normal" | "warn" | "late";
} | null {
  if (!dueAt) return null;
  const dt = new Date(dueAt);
  const delta = dt.getTime() - Date.now();
  if (delta < 0) {
    return { label: `Overdue · ${dt.toLocaleDateString()}`, tone: "late" };
  }
  const h = Math.round(delta / 36e5);
  if (h < 24) return { label: `Due in ${h}h`, tone: "warn" };
  const d = Math.round(h / 24);
  return { label: `Due in ${d}d`, tone: "normal" };
}

export function TodosClient({
  businesses,
  defaultBusinessId,
  todos: initialTodos,
  agents
}: Props) {
  const router = useRouter();
  const [todos, setTodos] = useState<TodoRecord[]>(initialTodos);
  const [tab, setTab] = useState<TabKey>("active_queue");
  const [businessFilter, setBusinessFilter] = useState<string>(
    defaultBusinessId ?? "__all__"
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filtered = useMemo(() => {
    return todos.filter((t) => {
      if (businessFilter !== "__all__" && t.businessId !== businessFilter)
        return false;
      switch (tab) {
        case "active_queue":
          return (
            t.type === "todo" &&
            (t.status === "captured" || t.status === "active")
          );
        case "ideas":
          return t.type === "idea" && t.status !== "done" && t.status !== "dismissed";
        case "snoozed":
          return t.status === "snoozed";
        case "done":
          return t.status === "done" || t.status === "dismissed";
        default:
          return true;
      }
    });
  }, [todos, tab, businessFilter]);

  const counts = useMemo(() => {
    const out = { active_queue: 0, ideas: 0, snoozed: 0, done: 0 };
    for (const t of todos) {
      if (businessFilter !== "__all__" && t.businessId !== businessFilter)
        continue;
      if (t.status === "snoozed") out.snoozed += 1;
      else if (t.status === "done" || t.status === "dismissed") out.done += 1;
      else if (t.type === "idea") out.ideas += 1;
      else out.active_queue += 1;
    }
    return out;
  }, [todos, businessFilter]);

  function refreshAfter() {
    router.refresh();
  }

  async function updateStatus(
    todo: TodoRecord,
    nextStatus: "captured" | "snoozed" | "done" | "dismissed",
    extra?: Record<string, unknown>
  ) {
    setBusyId(todo.id);
    try {
      const response = await fetchWithCsrf(`/api/admin/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, ...extra })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Update failed.");
      setTodos((current) =>
        current.map((t) =>
          t.id === todo.id
            ? {
                ...t,
                status: nextStatus,
                snoozedUntil:
                  typeof extra?.snoozedUntil === "string"
                    ? extra.snoozedUntil
                    : t.snoozedUntil,
                completedAt:
                  nextStatus === "done" ? new Date().toISOString() : t.completedAt
              }
            : t
        )
      );
      toast.success(
        nextStatus === "done"
          ? "Marked done."
          : nextStatus === "snoozed"
            ? "Snoozed."
            : nextStatus === "dismissed"
              ? "Dismissed."
              : "Reopened."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function activateOne(todo: TodoRecord) {
    setBusyId(todo.id);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/todos/${todo.id}/activate`,
        { method: "POST" }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Activate failed.");
      setTodos((current) =>
        current.map((t) =>
          t.id === todo.id
            ? { ...t, status: "active", activatedAt: new Date().toISOString() }
            : t
        )
      );
      toast.success("Activated — result will auto-post to chat.");
      refreshAfter();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activate failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function promoteIdea(todo: TodoRecord) {
    setBusyId(todo.id);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/todos/${todo.id}/promote-idea`,
        { method: "POST" }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Promote failed.");
      setTodos((current) =>
        current.map((t) =>
          t.id === todo.id ? { ...t, type: "todo" } : t
        )
      );
      toast.success("Promoted to todo.");
      setTab("active_queue");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Promote failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function promoteToWorkflow(todo: TodoRecord) {
    if (
      !confirm(
        `Promote "${todo.title}" to a recurring workflow (${todo.recurringPattern ?? "weekly"})?`
      )
    )
      return;
    setBusyId(todo.id);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/todos/${todo.id}/promote-to-workflow`,
        {
          method: "POST",
          body: JSON.stringify({
            frequency: todo.recurringPattern ?? "weekly",
            scheduleMode: "every"
          })
        }
      );
      const result = (await response.json()) as {
        workflow?: { id: string; name: string };
        error?: string;
      };
      if (!response.ok || !result.workflow) {
        throw new Error(result.error ?? "Promote to workflow failed.");
      }
      setTodos((current) =>
        current.map((t) =>
          t.id === todo.id
            ? { ...t, status: "done", completedAt: new Date().toISOString() }
            : t
        )
      );
      toast.success(`Workflow created: ${result.workflow.name}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Promote to workflow failed."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTodo(todo: TodoRecord) {
    if (!confirm(`Delete "${todo.title}"?`)) return;
    setBusyId(todo.id);
    try {
      const response = await fetchWithCsrf(`/api/admin/todos/${todo.id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Delete failed.");
      setTodos((current) => current.filter((t) => t.id !== todo.id));
      toast.success("Deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function assignAgent(todo: TodoRecord, agentId: string | null) {
    setBusyId(todo.id);
    try {
      const response = await fetchWithCsrf(`/api/admin/todos/${todo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ agentId })
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Update failed.");
      const match = agents.find((a) => a.id === agentId);
      setTodos((current) =>
        current.map((t) =>
          t.id === todo.id
            ? {
                ...t,
                agentId,
                agentName: match?.displayName ?? null,
                agentEmoji: match?.emoji ?? null
              }
            : t
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkActivate() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const response = await fetchWithCsrf("/api/admin/todos/bulk-activate", {
        method: "POST",
        body: JSON.stringify({ todoIds: ids })
      });
      const result = (await response.json()) as {
        activated?: number;
        skipped?: number;
        failed?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Bulk activate failed.");
      toast.success(
        `Activated ${result.activated ?? 0}. Skipped ${result.skipped ?? 0}. Failed ${result.failed ?? 0}.`
      );
      setSelected(new Set());
      refreshAfter();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk activate failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const TABS: Array<{ key: TabKey; label: string; count: number; icon: typeof Zap }> = [
    { key: "active_queue", label: "Active", count: counts.active_queue, icon: Zap },
    { key: "ideas", label: "Ideas", count: counts.ideas, icon: Lightbulb },
    { key: "snoozed", label: "Snoozed", count: counts.snoozed, icon: CalendarClock },
    { key: "done", label: "Done", count: counts.done, icon: CheckCircle2 }
  ];

  return (
    <div className="space-y-5 pb-20">
      <TodoComposer
        businesses={businesses}
        defaultBusinessId={defaultBusinessId}
        onCreated={refreshAfter}
      />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              onClick={() => setTab(t.key)}
            >
              <Icon className="h-4 w-4 mr-1" />
              {t.label} ({t.count})
            </Button>
          );
        })}
        <div className="ml-auto">
          <Select value={businessFilter} onValueChange={setBusinessFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-ink-muted">
          {tab === "active_queue"
            ? "Nothing queued. Capture something above."
            : tab === "ideas"
              ? "No captured ideas — drop a brain-dump in the composer and pick Idea."
              : tab === "snoozed"
                ? "Nothing snoozed."
                : "Nothing done yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((todo) => {
            const due = dueLabel(todo.dueAt);
            const businessAgents = agents.filter(
              (a) => a.businessId === todo.businessId
            );
            const isIdea = todo.type === "idea";
            const isCaptured = todo.status === "captured";
            const canActivate = todo.type === "todo" && isCaptured;
            const isSelected = selected.has(todo.id);
            return (
              <Card key={todo.id}>
                <CardContent className="p-3 flex flex-wrap items-start gap-3">
                  {canActivate ? (
                    <button
                      type="button"
                      onClick={() => toggle(todo.id)}
                      className="mt-1 text-ink-secondary hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-steel-bright" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <div className="w-4" />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">
                        {isIdea ? "💡 " : ""}
                        {todo.title}
                      </span>
                      <Badge className={PRIORITY_COLOR[todo.priority] ?? ""}>
                        {todo.priority}
                      </Badge>
                      {todo.status !== "captured" ? (
                        <Badge variant="default">{todo.status}</Badge>
                      ) : null}
                      {todo.createdVia !== "web" ? (
                        <Badge variant="default" className="text-[10px]">
                          via {todo.createdVia}
                        </Badge>
                      ) : null}
                      {todo.recurringPattern ? (
                        <Badge variant="default" className="text-[10px]">
                          ↻ {todo.recurringPattern}
                        </Badge>
                      ) : null}
                      {due ? (
                        <Badge
                          className={
                            due.tone === "late"
                              ? "bg-state-danger/15 text-state-danger"
                              : due.tone === "warn"
                                ? "bg-state-warning/15 text-state-warning"
                                : "bg-bg-surface-2 text-ink-secondary"
                          }
                        >
                          {due.label}
                        </Badge>
                      ) : null}
                    </div>
                    {todo.description ? (
                      <p className="text-xs text-ink-muted whitespace-pre-wrap line-clamp-3">
                        {todo.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                      <span>{todo.businessName}</span>
                      {todo.tags.length > 0 ? (
                        <span>· {todo.tags.join(" / ")}</span>
                      ) : null}
                      {todo.createdByAgentId ? (
                        <span>· proposed by agent</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {canActivate || todo.status === "active" ? (
                      <Select
                        value={todo.agentId ?? ""}
                        onValueChange={(v) =>
                          assignAgent(todo, v === "__unassigned__" ? null : v)
                        }
                      >
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue placeholder="Assign agent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unassigned__">Unassigned</SelectItem>
                          {businessAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.emoji ?? "🤖"} {agent.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    <div className="flex flex-wrap gap-1 justify-end">
                      {isIdea && todo.status !== "done" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => promoteIdea(todo)}
                          disabled={busyId === todo.id}
                        >
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Promote to todo
                        </Button>
                      ) : null}
                      {canActivate ? (
                        <Button
                          size="sm"
                          onClick={() => activateOne(todo)}
                          disabled={busyId === todo.id}
                        >
                          {busyId === todo.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3 mr-1" />
                          )}
                          Activate
                        </Button>
                      ) : null}
                      {todo.recurringPattern && canActivate ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => promoteToWorkflow(todo)}
                          disabled={busyId === todo.id}
                        >
                          ↻ Workflow
                        </Button>
                      ) : null}
                      {todo.status === "captured" || todo.status === "active" ? (
                        <SnoozeButton
                          disabled={busyId === todo.id}
                          onSnooze={(iso) =>
                            updateStatus(todo, "snoozed", {
                              snoozedUntil: iso
                            })
                          }
                        />
                      ) : null}
                      {todo.status === "snoozed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(todo, "captured")}
                          disabled={busyId === todo.id}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Wake up
                        </Button>
                      ) : null}
                      {todo.status !== "done" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(todo, "done")}
                          disabled={busyId === todo.id}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Done
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(todo, "captured")}
                          disabled={busyId === todo.id}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reopen
                        </Button>
                      )}
                      {todo.status !== "dismissed" && todo.status !== "done" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateStatus(todo, "dismissed")}
                          disabled={busyId === todo.id}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-state-danger"
                        onClick={() => deleteTodo(todo)}
                        disabled={busyId === todo.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selected.size > 0 ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-lg rounded-xl border bg-background shadow-lg p-3 flex flex-wrap items-center gap-3">
          <div className="font-medium text-sm pr-2 border-r">
            {selected.size} selected
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            onClick={bulkActivate}
            disabled={bulkBusy}
          >
            {bulkBusy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Activating…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Activate {selected.size}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SnoozeButton({
  disabled,
  onSnooze
}: {
  disabled: boolean;
  onSnooze: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [iso, setIso] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <CalendarClock className="h-3 w-3 mr-1" />
        Snooze
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        type="datetime-local"
        value={iso}
        onChange={(event) => setIso(event.target.value)}
        className="h-8 w-[180px]"
      />
      <Button
        size="sm"
        onClick={() => {
          onSnooze(new Date(iso).toISOString());
          setOpen(false);
        }}
        disabled={disabled}
      >
        OK
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
