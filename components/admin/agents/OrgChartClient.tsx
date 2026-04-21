"use client";

import Link from "next/link";
import { ArrowLeft, Bot, GitBranch } from "lucide-react";

import { AgentRoleIcon, getAgentRoleFromAgent } from "@/components/admin/agents/AgentRoleIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OrgAgent = {
  id: string;
  displayName: string;
  emoji: string | null;
  role: string;
  type: string;
  status: string;
  parentAgentId: string | null;
  depth: number;
  business: { id: string; name: string } | null;
  _count: { agentMemories: number; actionRuns: number };
};

type OrgChartClientProps = {
  agents: OrgAgent[];
};

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-state-success";
    case "warning":
      return "bg-state-warning";
    case "disabled":
      return "bg-zinc-500";
    default:
      return "bg-zinc-500";
  }
}

function AgentNode({ agent, children }: { agent: OrgAgent; children?: React.ReactNode }) {
  const isMain = agent.type === "main";

  return (
    <div className="flex flex-col items-center">
      <Link
        href={`/admin/agents/${agent.id}`}
        className={cn(
          "group relative w-56 rounded-2xl border bg-bg-surface p-4 transition-all hover:-translate-y-[1px] hover:border-line",
          isMain
            ? "border-l-4 border-l-brand-primary border-line-subtle"
            : "border-line-subtle"
        )}
      >
        {/* Status indicator */}
        <span className="absolute -right-1 -top-1">
          <span className="relative flex h-3 w-3">
            {agent.status === "active" ? (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  getStatusColor(agent.status)
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative inline-flex h-3 w-3 rounded-full",
                getStatusColor(agent.status)
              )}
            />
          </span>
        </span>

        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <AgentRoleIcon role={getAgentRoleFromAgent(agent)} className="h-10 w-10" />
            {isMain ? (
              <span className="absolute -left-1 -top-1 text-sm">👑</span>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {agent.displayName}
            </div>
            <div className="truncate text-xs text-ink-muted">{agent.role}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge
            className={cn(
              "text-[10px]",
              agent.type === "main"
                ? "bg-steel/15 text-steel-bright"
                : agent.type === "global"
                  ? "bg-steel/15 text-steel-bright"
                  : "bg-bg-surface-2 text-ink-secondary"
            )}
          >
            {agent.type}
          </Badge>
          {agent.business ? (
            <Badge className="bg-bg-surface-2 text-[10px] text-ink-secondary">
              {agent.business.name}
            </Badge>
          ) : null}
        </div>

        <div className="mt-2 flex gap-3 text-[10px] text-ink-muted">
          <span>{agent._count.actionRuns} runs</span>
          <span>{agent._count.agentMemories} memories</span>
        </div>
      </Link>

      {children ? (
        <div className="mt-4 flex flex-col items-center">
          {/* Connector line */}
          <div className="h-6 w-px bg-ghost-border" />
          <div className="flex items-start gap-4">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function OrgChartClient({ agents }: OrgChartClientProps) {
  // Build tree structure
  const rootAgents = agents.filter((a) => !a.parentAgentId);
  const childMap = new Map<string, OrgAgent[]>();

  for (const agent of agents) {
    if (agent.parentAgentId) {
      const existing = childMap.get(agent.parentAgentId) ?? [];
      existing.push(agent);
      childMap.set(agent.parentAgentId, existing);
    }
  }

  // Group root agents by business
  const businessGroups = new Map<string, OrgAgent[]>();
  const globalAgents: OrgAgent[] = [];

  for (const agent of rootAgents) {
    if (agent.business) {
      const existing = businessGroups.get(agent.business.id) ?? [];
      existing.push(agent);
      businessGroups.set(agent.business.id, existing);
    } else {
      globalAgents.push(agent);
    }
  }

  function renderAgentTree(agent: OrgAgent): React.ReactNode {
    const children = childMap.get(agent.id);

    return (
      <AgentNode key={agent.id} agent={agent}>
        {children?.length ? (
          <>
            {children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {renderAgentTree(child)}
              </div>
            ))}
          </>
        ) : undefined}
      </AgentNode>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Agent Org Chart
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Visual hierarchy of your agent organization.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/agents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line-subtle bg-bg-surface py-16">
          <Bot className="h-10 w-10 text-ink-muted" />
          <div className="text-center">
            <p className="text-sm font-medium text-ink-secondary">No agents yet</p>
            <p className="mt-1 text-xs text-ink-muted">
              Create agents to see them in the org chart.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-10 overflow-x-auto pb-8">
          {/* Global agents */}
          {globalAgents.length > 0 ? (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-steel-bright" />
                <h2 className="text-sm font-semibold text-ink-secondary">
                  Global Agents
                </h2>
              </div>
              <div className="flex flex-wrap items-start gap-6">
                {globalAgents.map((agent) => renderAgentTree(agent))}
              </div>
            </div>
          ) : null}

          {/* Business groups */}
          {Array.from(businessGroups.entries()).map(([businessId, bizAgents]) => {
            const businessName = bizAgents[0]?.business?.name ?? "Unknown";

            return (
              <div key={businessId}>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-steel" />
                  <h2 className="text-sm font-semibold text-ink-secondary">
                    {businessName}
                  </h2>
                  <span className="text-xs text-ink-muted">
                    {bizAgents.length} agent
                    {bizAgents.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-6">
                  {bizAgents.map((agent) => renderAgentTree(agent))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
