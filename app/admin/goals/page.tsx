"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Flag,
  Loader2,
  Plus,
  Target,
  Trophy
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Goal = {
  id: string;
  businessId: string;
  parentGoalId: string | null;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  targetDate: string | null;
  createdAt: string;
  business?: { id: string; name: string };
  children?: Goal[];
  _count: { children: number };
};

type Business = { id: string; name: string };

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Circle }
> = {
  active: { label: "Active", color: "text-brand-cyan", icon: Target },
  completed: {
    label: "Completed",
    color: "text-status-active",
    icon: CheckCircle2
  },
  archived: { label: "Archived", color: "text-zinc-500", icon: Circle }
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Form state
  const [formBusinessId, setFormBusinessId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetDate, setFormTargetDate] = useState("");
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/goals", {
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        setGoals(data.goals);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBusinesses = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/businesses", {
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        setBusinesses(data.businesses ?? data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchGoals();
    fetchBusinesses();
  }, [fetchGoals, fetchBusinesses]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!formBusinessId || !formTitle.trim()) return;
    setSaving(true);

    try {
      const response = await fetchWithCsrf("/api/admin/goals", {
        method: "POST",
        body: JSON.stringify({
          businessId: formBusinessId,
          parentGoalId: formParentId,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          targetDate: formTargetDate || null
        })
      });

      if (!response.ok) throw new Error("Failed to create goal.");

      toast.success("Goal created.");
      setCreateOpen(false);
      resetForm();
      fetchGoals();
    } catch {
      toast.error("Failed to create goal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleProgressUpdate(goalId: string, progress: number) {
    try {
      const updates: Record<string, unknown> = { progress };
      if (progress === 100) updates.status = "completed";

      const response = await fetchWithCsrf(`/api/admin/goals/${goalId}`, {
        method: "PUT",
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error();
      fetchGoals();
    } catch {
      toast.error("Failed to update progress.");
    }
  }

  function resetForm() {
    setFormBusinessId("");
    setFormTitle("");
    setFormDescription("");
    setFormTargetDate("");
    setFormParentId(null);
  }

  // Build tree: top-level goals (no parent) with nested children
  const topLevelGoals = goals.filter((g) => !g.parentGoalId);
  const childMap = new Map<string, Goal[]>();
  for (const g of goals) {
    if (g.parentGoalId) {
      const siblings = childMap.get(g.parentGoalId) ?? [];
      siblings.push(g);
      childMap.set(g.parentGoalId, siblings);
    }
  }

  // Stats
  const activeCount = goals.filter((g) => g.status === "active").length;
  const completedCount = goals.filter((g) => g.status === "completed").length;
  const avgProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0;

  function GoalRow({ goal, depth = 0 }: { goal: Goal; depth?: number }) {
    const cfg = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.active;
    const StatusIcon = cfg.icon;
    const children = childMap.get(goal.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(goal.id);

    return (
      <>
        <div
          className="group flex items-center gap-3 rounded-xl border border-ghost-border bg-ghost-card p-4 transition-colors hover:border-ghost-border-strong"
          style={{ marginLeft: depth * 24 }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpand(goal.id)}
              className="shrink-0 text-zinc-500 hover:text-zinc-300"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <StatusIcon className={cn("h-4 w-4 shrink-0", cfg.color)} />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-white">{goal.title}</p>
              <div className="flex items-center gap-2">
                {goal.targetDate ? (
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Flag className="h-3 w-3" />
                    {new Date(goal.targetDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </span>
                ) : null}
                <Badge
                  className={cn(
                    "text-[10px]",
                    cfg.color,
                    goal.status === "completed"
                      ? "bg-status-active/10"
                      : goal.status === "archived"
                        ? "bg-ghost-raised"
                        : "bg-brand-cyan/10"
                  )}
                >
                  {cfg.label}
                </Badge>
              </div>
            </div>

            {goal.description ? (
              <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                {goal.description}
              </p>
            ) : null}

            <div className="mt-2 flex items-center gap-3">
              {goal.business ? (
                <span className="text-[10px] text-zinc-600">
                  {goal.business.name}
                </span>
              ) : null}

              {/* Progress bar */}
              <div className="flex flex-1 items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-ghost-raised">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      goal.progress === 100
                        ? "bg-status-active"
                        : goal.progress > 50
                          ? "bg-brand-cyan"
                          : "bg-brand-primary"
                    )}
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-zinc-400">
                  {goal.progress}%
                </span>
              </div>

              {/* Quick progress buttons */}
              {goal.status === "active" ? (
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => handleProgressUpdate(goal.id, p)}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] transition-colors",
                        goal.progress >= p
                          ? "bg-brand-primary/20 text-brand-primary"
                          : "bg-ghost-raised text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {isExpanded &&
          children.map((child) => (
            <GoalRow key={child.id} goal={child} depth={depth + 1} />
          ))}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Goals
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Set and track goals across your businesses.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-brand-primary text-white hover:bg-brand-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Goals", count: goals.length, cls: "text-white" },
          { label: "Active", count: activeCount, cls: "text-brand-cyan" },
          {
            label: "Completed",
            count: completedCount,
            cls: "text-status-active"
          },
          { label: "Avg Progress", count: `${avgProgress}%`, cls: "text-brand-primary" }
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-ghost-border bg-ghost-raised px-3 py-2"
          >
            <div className="text-xs text-zinc-500">{s.label}</div>
            <div className={cn("text-lg font-bold", s.cls)}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Goal Tree */}
      {loading ? (
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </CardContent>
        </Card>
      ) : topLevelGoals.length === 0 ? (
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Trophy className="h-10 w-10 text-zinc-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">
                No goals yet
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Create your first goal to start tracking progress.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {topLevelGoals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="border-ghost-border bg-ghost-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">New Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Business *
              </label>
              <Select value={formBusinessId} onValueChange={setFormBusinessId}>
                <SelectTrigger className="border-ghost-border bg-ghost-raised text-white">
                  <SelectValue placeholder="Select business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Parent Goal
              </label>
              <Select
                value={formParentId ?? "none"}
                onValueChange={(v) => setFormParentId(v === "none" ? null : v)}
              >
                <SelectTrigger className="border-ghost-border bg-ghost-raised text-white">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {goals
                    .filter((g) => g.status === "active")
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Title *
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Increase revenue by 20%"
                className="border-ghost-border bg-ghost-raised text-white placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Description
              </label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe this goal..."
                rows={3}
                className="border-ghost-border bg-ghost-raised text-white placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Target Date
              </label>
              <Input
                type="date"
                value={formTargetDate}
                onChange={(e) => setFormTargetDate(e.target.value)}
                className="border-ghost-border bg-ghost-raised text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formBusinessId || !formTitle.trim() || saving}
                className="bg-brand-primary text-white hover:bg-brand-primary/90"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
