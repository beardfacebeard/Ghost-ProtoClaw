"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";

import type { AgentWithBusiness } from "@/lib/repository/agents";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { resolveAgentModel } from "@/lib/models/agent-models";
import { cn } from "@/lib/utils";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AgentRoleIcon, getAgentRoleFromAgent } from "@/components/admin/agents/AgentRoleIcon";
import { AgentTestPanel } from "@/components/admin/agents/AgentTestPanel";
import { AgentTypeBadge } from "@/components/admin/agents/AgentTypeBadge";
import {
  formatModelName,
  getAgentStatusMeta,
  getModelSourceMeta
} from "@/components/admin/agents/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";

type AgentCardProps = {
  agent: AgentWithBusiness;
  showBusiness?: boolean;
  systemDefault: string;
};

export function AgentCard({
  agent,
  showBusiness = false,
  systemDefault
}: AgentCardProps) {
  const router = useRouter();
  const [disableOpen, setDisableOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const resolved = resolveAgentModel(agent, agent.business, systemDefault);
  const status = getAgentStatusMeta(agent.status);
  const sourceMeta = getModelSourceMeta(resolved.source);

  async function handleDisable() {
    try {
      setDisabling(true);

      const response = await fetchWithCsrf(`/api/admin/agents/${agent.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to disable agent.");
      }

      toast.success("Agent disabled.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to disable agent."
      );
      throw error;
    } finally {
      setDisabling(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border bg-ghost-surface p-4 transition-all hover:-translate-y-[1px] hover:border-ghost-border-strong",
          agent.type === "main"
            ? "border-l-4 border-l-brand-primary border-ghost-border"
            : "border-ghost-border"
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="relative shrink-0">
              <AgentRoleIcon role={getAgentRoleFromAgent(agent)} className="h-12 w-12" />
              {agent.type === "main" ? (
                <div className="absolute -right-1 -top-1 rounded-full bg-brand-amber px-1.5 py-0.5 text-[10px] text-ghost-black">
                  👑
                </div>
              ) : null}
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-white">
                  {agent.displayName}
                </div>
                <AgentTypeBadge type={agent.type as "main" | "specialist" | "global"} />
                {showBusiness && agent.business ? (
                  <Badge className="bg-brand-cyan/15 text-brand-cyan">
                    {agent.business.name}
                  </Badge>
                ) : null}
              </div>
              <div className="text-sm text-slate-400">{agent.role}</div>
              {agent.purpose ? (
                <div className="line-clamp-2 text-sm leading-6 text-slate-500">
                  {agent.purpose}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-3">
            <div className="space-y-2 text-right">
              <div className="inline-flex items-center gap-2 text-sm text-slate-400">
                <span className="relative flex h-2.5 w-2.5">
                  {agent.status === "active" ? (
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                        status.dotClassName
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative inline-flex h-2.5 w-2.5 rounded-full",
                      status.dotClassName
                    )}
                  />
                </span>
                <span>{status.label}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-ghost-border bg-ghost-raised/50 px-3 py-1 text-xs text-slate-300">
                <span>{sourceMeta.icon}</span>
                <span className="font-medium text-white">
                  {formatModelName(resolved.model)}
                </span>
                <span className="text-slate-500">·</span>
                <span>{sourceMeta.label}</span>
              </div>
              <div className="text-xs text-slate-500">
                {agent.sessionsCount} sessions
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push(`/admin/agents/${agent.id}`)}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push(`/admin/agents/${agent.id}/edit`)}>
                  Edit Agent
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    router.push(`/admin/agents/create?duplicateFrom=${agent.id}`)
                  }
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-brand-primary focus:text-brand-primary"
                  onSelect={() => setDisableOpen(true)}
                >
                  Disable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ghost-border pt-4">
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{agent._count.agentMemories} memories</span>
            <span>{agent._count.conversationLogs} conversations</span>
            <span>{agent._count.actionRuns} action runs</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/agents/${agent.id}`}>View</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/agents/${agent.id}/edit`}>Edit</Link>
            </Button>
            <AgentTestPanel
              agent={agent}
              business={agent.business}
              systemDefault={systemDefault}
              trigger={
                <Button size="sm" variant="outline">
                  Test
                </Button>
              }
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable this agent?"
        description="This will stop the agent from running. You can re-enable it later by editing the record."
        confirmLabel="Disable Agent"
        variant="danger"
        loading={disabling}
        onConfirm={handleDisable}
      />
    </>
  );
}
