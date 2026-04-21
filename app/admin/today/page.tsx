import Link from "next/link";
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  GitBranch,
  Inbox,
  Lightbulb,
  Plus,
  Target
} from "lucide-react";

import { PageHeader, Panel, PanelHeader, StatBlock, StatusDot, EmptyState, DataRow } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatRelative(date: Date): string {
  const delta = Date.now() - date.getTime();
  const abs = Math.abs(delta);
  const dir = delta < 0 ? "in " : "";
  const suffix = delta < 0 ? "" : " ago";
  const minutes = Math.round(abs / 60000);
  if (minutes < 60) return `${dir}${minutes}m${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${dir}${hours}h${suffix}`;
  const days = Math.round(hours / 24);
  return `${dir}${days}d${suffix}`;
}

export default async function TodayPage() {
  const session = await requireServerSession();
  if (!session.organizationId) return null;

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: { in: session.businessIds }
        }
      : { organizationId: session.organizationId };

  const businesses = await db.business.findMany({
    where: businessWhere,
    select: { id: true, name: true }
  });
  const businessIds = businesses.map((b) => b.id);
  const nameById = new Map(businesses.map((b) => [b.id, b.name]));

  const nowDate = new Date();
  const weekdayLabel = nowDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  if (businessIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={`Today · ${weekdayLabel}`}
          title="Your triage screen."
          description="Every decision and action waiting on you — in one place."
        />
        <EmptyState
          icon={Inbox}
          title="No businesses yet."
          description="Create your first business to unlock Today. It becomes the single screen you check in the morning."
          action={{ label: "Create a business", href: "/admin/businesses/create" }}
        />
      </div>
    );
  }

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [
    pendingApprovals,
    dueTodos,
    capturedTodos,
    activeTodos,
    proposedByAgent,
    overdueWorkflows,
    pendingIdeas
  ] = await Promise.all([
    db.approvalRequest.findMany({
      where: { businessId: { in: businessIds }, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    db.todo.findMany({
      where: {
        organizationId: session.organizationId,
        businessId: { in: businessIds },
        status: { in: ["captured", "active"] },
        type: "todo",
        dueAt: { lte: endOfDay, not: null }
      },
      orderBy: { dueAt: "asc" },
      take: 10
    }),
    db.todo.findMany({
      where: {
        organizationId: session.organizationId,
        businessId: { in: businessIds },
        status: "captured",
        type: "todo"
      },
      orderBy: { createdAt: "desc" },
      take: 15
    }),
    db.todo.findMany({
      where: {
        organizationId: session.organizationId,
        businessId: { in: businessIds },
        status: "active",
        type: "todo"
      },
      orderBy: { activatedAt: "desc" },
      take: 15
    }),
    db.todo.findMany({
      where: {
        organizationId: session.organizationId,
        businessId: { in: businessIds },
        status: "captured",
        createdByAgentId: { not: null }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    db.workflow.findMany({
      where: {
        business: businessWhere,
        trigger: "scheduled",
        enabled: true,
        nextRunAt: { lt: now }
      },
      orderBy: { nextRunAt: "asc" },
      take: 10
    }),
    db.todo.findMany({
      where: {
        organizationId: session.organizationId,
        businessId: { in: businessIds },
        type: "idea",
        status: { in: ["captured", "active"] }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    })
  ]);

  const dueSoon = [
    ...dueTodos,
    ...capturedTodos.filter((t) => t.dueAt && t.dueAt <= in24h)
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Today · ${weekdayLabel}`}
        title="Your triage screen."
        description="Every decision and action waiting on you — in one place. Clear these and your day is won."
        actions={
          <Link
            href="/admin/todos"
            className="inline-flex items-center gap-1.5 rounded-md border border-steel/30 bg-steel/10 px-3 py-1.5 text-[12px] font-medium text-steel-bright transition hover:border-steel/60 hover:bg-steel/20"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Capture todo
          </Link>
        }
      />

      {/* ── Triage bento: 6 quick-look stats ──────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatBlock
          label="Pending approvals"
          value={String(pendingApprovals.length)}
          icon={<CheckSquare className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/approvals"
          tone={pendingApprovals.length > 0 ? "warning" : "default"}
          subtext={
            pendingApprovals.length > 0
              ? "Agent-requested decisions"
              : "All clear"
          }
        />
        <StatBlock
          label="Due today / soon"
          value={String(dueSoon.length)}
          icon={<AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/todos"
          tone={dueSoon.length > 0 ? "warning" : "default"}
          subtext="Within the next 24 hours"
        />
        <StatBlock
          label="Agent-proposed"
          value={String(proposedByAgent.length)}
          icon={<Lightbulb className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/todos"
          subtext={
            proposedByAgent.length > 0
              ? "Suggestions waiting"
              : "Nothing proposed"
          }
        />
        <StatBlock
          label="Active delegations"
          value={String(activeTodos.length)}
          icon={<Target className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/todos"
          subtext="Running now — results auto-post"
        />
        <StatBlock
          label="Captured backlog"
          value={String(capturedTodos.length)}
          icon={<Clock className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/todos"
          subtext="Brain-dump queue"
        />
        <StatBlock
          label="Overdue workflows"
          value={String(overdueWorkflows.length)}
          icon={<GitBranch className="h-3.5 w-3.5" strokeWidth={1.5} />}
          href="/admin/workflows"
          tone={overdueWorkflows.length > 0 ? "danger" : "default"}
          subtext="Past their scheduled time"
        />
      </div>

      {/* ── Pending approvals ──────────────────────────────────────── */}
      {pendingApprovals.length > 0 ? (
        <Panel variant="live">
          <PanelHeader
            label="Pending Approvals"
            action={
              <Link
                href="/admin/approvals"
                className="text-[11px] text-ink-muted transition hover:text-steel-bright"
              >
                View all →
              </Link>
            }
          />
          <ul className="divide-y divide-line-subtle">
            {pendingApprovals.map((approval) => (
              <li key={approval.id}>
                <Link
                  href={`/admin/approvals#approval-${approval.id}`}
                  className="block px-4 py-3 transition hover:bg-bg-surface-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusDot tone="warning" />
                    <Badge className="border-state-warning/30 bg-state-warning/15 text-[10px] font-medium text-state-warning">
                      {approval.actionType.replaceAll("_", " ")}
                    </Badge>
                    <span className="text-[11px] text-ink-muted">
                      {nameById.get(approval.businessId) ?? "Unknown"}
                    </span>
                    <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
                      {formatRelative(approval.createdAt)}
                    </span>
                  </div>
                  {approval.reason ? (
                    <div className="mt-1.5 line-clamp-2 text-[13px] text-ink-secondary">
                      {approval.reason}
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* ── Agent-proposed todos ──────────────────────────────────── */}
      {proposedByAgent.length > 0 ? (
        <Panel>
          <PanelHeader
            label="Agent-Proposed Todos"
            action={
              <Link
                href="/admin/todos"
                className="text-[11px] text-ink-muted transition hover:text-steel-bright"
              >
                View all →
              </Link>
            }
          />
          <ul className="divide-y divide-line-subtle">
            {proposedByAgent.map((todo) => (
              <li key={todo.id}>
                <Link
                  href="/admin/todos"
                  className="block px-4 py-3 transition hover:bg-bg-surface-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Lightbulb
                      className="h-3.5 w-3.5 text-state-ai"
                      strokeWidth={1.5}
                    />
                    <span className="text-[13px] font-medium text-ink-primary">
                      {todo.title}
                    </span>
                    <Badge
                      variant="default"
                      className="border-line bg-bg-surface-2 text-[10px] text-ink-secondary"
                    >
                      {todo.priority}
                    </Badge>
                    <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
                      {formatRelative(todo.createdAt)}
                    </span>
                  </div>
                  {todo.description ? (
                    <div className="mt-1 line-clamp-2 text-[11px] text-ink-muted">
                      {todo.description}
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* ── Idea backlog ───────────────────────────────────────────── */}
      {pendingIdeas.length > 0 ? (
        <Panel>
          <PanelHeader
            label="Idea Backlog"
            action={
              <Link
                href="/admin/todos"
                className="text-[11px] text-ink-muted transition hover:text-steel-bright"
              >
                View all →
              </Link>
            }
          />
          <ul className="divide-y divide-line-subtle">
            {pendingIdeas.map((todo) => (
              <li key={todo.id}>
                <DataRow
                  leading={<StatusDot tone="muted" />}
                  title={<span>💡 {todo.title}</span>}
                  trailing={formatRelative(todo.createdAt)}
                  href="/admin/todos"
                />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* ── Fully clear state ─────────────────────────────────────── */}
      {pendingApprovals.length === 0 &&
      proposedByAgent.length === 0 &&
      dueSoon.length === 0 &&
      overdueWorkflows.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nothing waiting. Go build something."
          description="Today's queue is empty. Your agents are caught up, your approvals are clear, and no workflows are overdue."
          action={{ label: "Open your CEO agent", href: "/admin/chat" }}
        />
      ) : null}
    </div>
  );
}
