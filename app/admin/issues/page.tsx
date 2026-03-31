"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Kanban,
  List,
  Loader2,
  Plus,
  Search,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { NewIssueDialog } from "@/components/admin/issues/NewIssueDialog";

type Issue = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  labels: string[];
  dueDate: string | null;
  createdAt: string;
  assigneeAgent: { id: string; displayName: string; emoji: string | null } | null;
  project: { id: string; name: string } | null;
  business: { id: string; name: string } | null;
};

type IssueStats = {
  open: number;
  inProgress: number;
  review: number;
  done: number;
  total: number;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Circle; color: string; bg: string }
> = {
  open: {
    label: "Open",
    icon: Circle,
    color: "text-zinc-400",
    bg: "bg-ghost-raised"
  },
  in_progress: {
    label: "In Progress",
    icon: Loader2,
    color: "text-brand-cyan",
    bg: "bg-brand-cyan/10"
  },
  review: {
    label: "Review",
    icon: Eye,
    color: "text-brand-amber",
    bg: "bg-brand-amber/10"
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    color: "text-status-active",
    bg: "bg-status-active/10"
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-zinc-500",
    bg: "bg-ghost-raised"
  }
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "text-red-400 bg-red-400/10" },
  high: { label: "High", color: "text-orange-400 bg-orange-400/10" },
  medium: { label: "Medium", color: "text-brand-amber bg-brand-amber/10" },
  low: { label: "Low", color: "text-zinc-400 bg-ghost-raised" }
};

const KANBAN_COLUMNS = ["open", "in_progress", "review", "done"] as const;

export default function IssuesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") ?? "all"
  );
  const [priorityFilter, setPriorityFilter] = useState(
    searchParams.get("priority") ?? "all"
  );
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (search) params.set("search", search);

      const [issuesRes, statsRes] = await Promise.all([
        fetch(`/api/admin/issues?${params}`, { credentials: "same-origin" }),
        fetch("/api/admin/issues?stats=true", { credentials: "same-origin" })
      ]);

      if (issuesRes.ok) {
        const data = await issuesRes.json();
        setIssues(data.issues);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  async function handleStatusChange(issueId: string, newStatus: string) {
    try {
      const response = await fetchWithCsrf(`/api/admin/issues/${issueId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error("Failed to update.");

      toast.success("Issue updated.");
      fetchIssues();
    } catch {
      toast.error("Failed to update issue status.");
    }
  }

  function IssueRow({ issue }: { issue: Issue }) {
    const statusCfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.open;
    const priorityCfg = PRIORITY_CONFIG[issue.priority] ?? PRIORITY_CONFIG.medium;
    const StatusIcon = statusCfg.icon;

    return (
      <div className="group flex items-start gap-3 rounded-xl border border-ghost-border bg-ghost-card p-4 transition-colors hover:border-ghost-border-strong">
        <button
          onClick={() => {
            const next =
              issue.status === "open"
                ? "in_progress"
                : issue.status === "in_progress"
                  ? "review"
                  : issue.status === "review"
                    ? "done"
                    : "open";
            handleStatusChange(issue.id, next);
          }}
          className={cn("mt-0.5 shrink-0", statusCfg.color)}
          title={`Status: ${statusCfg.label} (click to advance)`}
        >
          <StatusIcon className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white">{issue.title}</p>
            <Badge className={cn("shrink-0 text-[10px]", priorityCfg.color)}>
              {issue.priority === "urgent" ? (
                <AlertCircle className="mr-1 h-3 w-3" />
              ) : issue.priority === "high" ? (
                <ArrowUp className="mr-1 h-3 w-3" />
              ) : issue.priority === "low" ? (
                <ArrowDown className="mr-1 h-3 w-3" />
              ) : null}
              {priorityCfg.label}
            </Badge>
          </div>

          {issue.description ? (
            <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
              {issue.description}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {issue.assigneeAgent ? (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                <span>{issue.assigneeAgent.emoji ?? "🤖"}</span>
                {issue.assigneeAgent.displayName}
              </span>
            ) : null}
            {issue.project ? (
              <Badge variant="default" className="text-[10px]">
                {issue.project.name}
              </Badge>
            ) : null}
            {issue.business ? (
              <span className="text-[10px] text-zinc-600">
                {issue.business.name}
              </span>
            ) : null}
            {issue.dueDate ? (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Clock className="h-3 w-3" />
                {new Date(issue.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric"
                })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function KanbanColumn({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
    const columnIssues = issues.filter((i) => i.status === status);
    const Icon = cfg.icon;

    return (
      <div className="flex min-w-[260px] flex-1 flex-col rounded-xl border border-ghost-border bg-ghost-raised/50">
        <div className="flex items-center gap-2 border-b border-ghost-border px-3 py-2.5">
          <Icon className={cn("h-4 w-4", cfg.color)} />
          <span className="text-sm font-medium text-white">{cfg.label}</span>
          <span className="ml-auto rounded-full bg-ghost-surface px-1.5 py-0.5 text-[10px] text-zinc-500">
            {columnIssues.length}
          </span>
        </div>
        <div className="flex-1 space-y-2 p-2">
          {columnIssues.map((issue) => {
            const priorityCfg =
              PRIORITY_CONFIG[issue.priority] ?? PRIORITY_CONFIG.medium;

            return (
              <div
                key={issue.id}
                className="rounded-lg border border-ghost-border bg-ghost-card p-3 transition-colors hover:border-ghost-border-strong"
              >
                <p className="text-sm font-medium text-white">{issue.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn("text-[10px]", priorityCfg.color)}
                  >
                    {priorityCfg.label}
                  </Badge>
                  {issue.assigneeAgent ? (
                    <span className="text-[10px] text-zinc-400">
                      {issue.assigneeAgent.emoji ?? "🤖"}{" "}
                      {issue.assigneeAgent.displayName}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {columnIssues.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-600">
              No issues
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Issues
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track tasks and issues across your businesses.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-brand-primary text-white hover:bg-brand-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Issue
        </Button>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Total", count: stats.total, cls: "text-white" },
            { label: "Open", count: stats.open, cls: "text-zinc-400" },
            {
              label: "In Progress",
              count: stats.inProgress,
              cls: "text-brand-cyan"
            },
            { label: "Review", count: stats.review, cls: "text-brand-amber" },
            { label: "Done", count: stats.done, cls: "text-status-active" }
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
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-ghost-border bg-ghost-raised pl-9 text-white placeholder:text-zinc-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] border-ghost-border bg-ghost-raised text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px] border-ghost-border bg-ghost-raised text-white">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-1 rounded-lg border border-ghost-border bg-ghost-raised p-0.5">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-ghost-surface text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "kanban"
                ? "bg-ghost-surface text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Kanban className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((status) => (
            <KanbanColumn key={status} status={status} />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <CheckCircle2 className="h-10 w-10 text-zinc-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">
                No issues found
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Create your first issue to start tracking work.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Issue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      <NewIssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          fetchIssues();
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
