import Link from "next/link";
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  GitBranch,
  Lightbulb,
  Target
} from "lucide-react";

import { SectionHeader } from "@/components/admin/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  if (businessIds.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Today"
          description="Your single triage screen."
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No businesses yet. Create one to get started.
          </CardContent>
        </Card>
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
      where: {
        businessId: { in: businessIds },
        status: "pending"
      },
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

  const dueSoon = [...dueTodos, ...capturedTodos.filter((t) => t.dueAt && t.dueAt <= in24h)];

  const cards: Array<{
    title: string;
    href: string;
    count: number;
    tint: string;
    icon: typeof Clock;
    blurb: string;
  }> = [
    {
      title: "Pending Approvals",
      href: "/admin/approvals",
      count: pendingApprovals.length,
      tint: "text-brand-amber",
      icon: CheckSquare,
      blurb: "Agent-requested decisions waiting on you."
    },
    {
      title: "Due Today / Soon",
      href: "/admin/todos",
      count: dueSoon.length,
      tint: "text-status-error",
      icon: AlertTriangle,
      blurb: "Todos with due dates within 24h."
    },
    {
      title: "Agent-Proposed",
      href: "/admin/todos",
      count: proposedByAgent.length,
      tint: "text-brand-cyan",
      icon: Lightbulb,
      blurb: "Suggestions your agents want you to consider."
    },
    {
      title: "Active Delegations",
      href: "/admin/todos",
      count: activeTodos.length,
      tint: "text-status-active",
      icon: Target,
      blurb: "Running now; results auto-post to chat."
    },
    {
      title: "Captured (Unactivated)",
      href: "/admin/todos",
      count: capturedTodos.length,
      tint: "text-slate-300",
      icon: Clock,
      blurb: "Your brain-dump queue — activate when ready."
    },
    {
      title: "Overdue Workflows",
      href: "/admin/workflows",
      count: overdueWorkflows.length,
      tint: "text-status-error",
      icon: GitBranch,
      blurb: "Scheduled workflows past their nextRunAt."
    }
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Today"
        description="Your single triage screen. Everything waiting on a decision or action lives here."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href}>
              <Card className="h-full transition-all hover:border-ghost-border-strong">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${card.tint}`} />
                    <span className={`text-3xl font-bold ${card.tint}`}>
                      {card.count}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {card.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {card.blurb}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {pendingApprovals.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            <CheckSquare className="inline h-4 w-4 mr-1 text-brand-amber" />
            Pending approvals
          </h2>
          <Card>
            <CardContent className="p-0 divide-y divide-ghost-border">
              {pendingApprovals.map((approval) => (
                <Link
                  key={approval.id}
                  href={`/admin/approvals#approval-${approval.id}`}
                  className="block px-4 py-3 hover:bg-ghost-surface"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-brand-amber/15 text-brand-amber text-[10px]">
                      {approval.actionType.replaceAll("_", " ")}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {nameById.get(approval.businessId) ?? "Unknown"}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {formatRelative(approval.createdAt)}
                    </span>
                  </div>
                  {approval.reason ? (
                    <div className="mt-1 text-sm text-slate-300 line-clamp-2">
                      {approval.reason}
                    </div>
                  ) : null}
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {proposedByAgent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            <Lightbulb className="inline h-4 w-4 mr-1 text-brand-cyan" />
            Agent-proposed todos
          </h2>
          <Card>
            <CardContent className="p-0 divide-y divide-ghost-border">
              {proposedByAgent.map((todo) => (
                <Link
                  key={todo.id}
                  href="/admin/todos"
                  className="block px-4 py-3 hover:bg-ghost-surface"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{todo.title}</span>
                    <Badge variant="default" className="text-[10px]">
                      {todo.priority}
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatRelative(todo.createdAt)}
                    </span>
                  </div>
                  {todo.description ? (
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {todo.description}
                    </div>
                  ) : null}
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {pendingIdeas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            <Lightbulb className="inline h-4 w-4 mr-1" />
            Idea backlog
          </h2>
          <Card>
            <CardContent className="p-0 divide-y divide-ghost-border">
              {pendingIdeas.map((todo) => (
                <Link
                  key={todo.id}
                  href="/admin/todos"
                  className="block px-4 py-3 hover:bg-ghost-surface"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">💡 {todo.title}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatRelative(todo.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
