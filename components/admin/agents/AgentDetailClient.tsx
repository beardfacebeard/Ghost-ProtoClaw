"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Clock,
  Copy,
  MessageSquare,
  Trash2,
  Zap
} from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { AgentTestPanel } from "@/components/admin/agents/AgentTestPanel";
import { AgentTypeBadge } from "@/components/admin/agents/AgentTypeBadge";
import { MemoryCard } from "@/components/admin/memory/MemoryCard";
import { ModelInheritanceDisplay } from "@/components/admin/agents/ModelInheritanceDisplay";
import {
  formatModelName,
  formatToolLabel,
  getAgentStatusMeta
} from "@/components/admin/agents/utils";
import { AVAILABLE_AGENT_TOOLS } from "@/components/admin/agents/ToolSelector";
import { formatRelativeTime } from "@/components/admin/ActivityFeed";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatBlock,
  StatusDot
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type MemoryItem = {
  id: string;
  agentId: string;
  businessId: string;
  type: string;
  content: string;
  tier: string;
  importance: number;
  expiresAt: Date | string | null;
  metadata?: unknown;
  createdAt: Date | string;
  agent: {
    id: string;
    displayName: string;
    emoji: string | null;
  } | null;
};

type ActionRunItem = {
  id: string;
  action: string;
  status: string;
  result: unknown;
  error: string | null;
  createdAt: Date | string;
  completedAt?: Date | string | null;
};

type AgentDetailClientProps = {
  agent: {
    id: string;
    businessId: string | null;
    displayName: string;
    emoji: string | null;
    role: string;
    purpose: string | null;
    type: string;
    status: string;
    systemPrompt: string | null;
    roleInstructions: string | null;
    outputStyle: string | null;
    constraints: string | null;
    escalationRules: string | null;
    askBeforeDoing: string | null;
    tools: unknown;
    workspacePath: string | null;
    primaryModel: string | null;
    fallbackModel: string | null;
    safetyMode: string | null;
    lastSeen: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    business: {
      id: string;
      name: string;
      slug: string;
      primaryModel: string | null;
      fallbackModel: string | null;
      safetyMode: string | null;
    } | null;
    _count: {
      agentMemories: number;
      conversationLogs: number;
      actionRuns: number;
    };
    actionRuns: ActionRunItem[];
  };
  memories: MemoryItem[];
  systemDefaultModel: string;
};

function getActionStatusTone(status: string): "success" | "danger" | "live" | "warning" | "muted" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "running":
      return "live";
    case "pending":
      return "warning";
    default:
      return "muted";
  }
}

function getActionStatusBadgeClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-state-success/15 text-state-success border border-state-success/30";
    case "failed":
      return "bg-state-danger/15 text-state-danger border border-state-danger/30";
    case "running":
      return "bg-steel/15 text-steel-bright border border-steel/30";
    case "pending":
      return "bg-state-warning/15 text-state-warning border border-state-warning/30";
    default:
      return "bg-bg-surface-2 text-ink-secondary border border-line-subtle";
  }
}

function getStatusTone(status: string): "live" | "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "muted";
    case "warning":
      return "warning";
    case "disabled":
      return "muted";
    default:
      return "muted";
  }
}

function summarizeResult(result: unknown, error: string | null) {
  if (error) {
    return error;
  }

  if (!result) {
    return "No result details recorded.";
  }

  if (typeof result === "string") {
    return result;
  }

  try {
    const serialized = JSON.stringify(result);
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
  } catch {
    return "Result recorded.";
  }
}

function CopyButton({ value }: { value: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Copied.");
        } catch {
          toast.error("Unable to copy.");
        }
      }}
    >
      <Copy className="mr-2 h-3.5 w-3.5" />
      Copy
    </Button>
  );
}

function PromptPanel({
  title,
  value,
  monospace = false
}: {
  title: string;
  value: string | null;
  monospace?: boolean;
}) {
  return (
    <Panel>
      <PanelHeader
        label={title}
        action={value ? <CopyButton value={value} /> : null}
      />
      <PanelBody className="p-0">
        {value ? (
          <ScrollArea className="max-h-96">
            <div
              className={cn(
                "whitespace-pre-wrap px-4 py-4 text-[13px] leading-6 text-ink-primary",
                monospace && "font-mono text-[12px]"
              )}
            >
              {value}
            </div>
          </ScrollArea>
        ) : (
          <div className="px-4 py-6 text-[13px] italic text-ink-muted">
            Not configured yet.
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

export function AgentDetailClient({
  agent,
  memories,
  systemDefaultModel
}: AgentDetailClientProps) {
  const router = useRouter();
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [memoriesState, setMemoriesState] = useState(memories);
  const [memoryTierFilter, setMemoryTierFilter] = useState("all");
  const statusMeta = getAgentStatusMeta(agent.status);
  const statusTone = getStatusTone(agent.status);
  const toolKeys = Array.isArray(agent.tools)
    ? agent.tools.filter((entry): entry is string => typeof entry === "string")
    : [];
  const enabledTools = toolKeys.length > 0
    ? AVAILABLE_AGENT_TOOLS.filter((tool) => toolKeys.includes(tool.key))
    : [];
  const memoryStats = {
    hot: memoriesState.filter((memory) => memory.tier === "hot").length,
    warm: memoriesState.filter((memory) => memory.tier === "warm").length,
    cold: memoriesState.filter((memory) => memory.tier === "cold").length
  };
  const filteredMemories =
    memoryTierFilter === "all"
      ? memoriesState
      : memoriesState.filter((memory) => memory.tier === memoryTierFilter);

  const eyebrowSegments = [
    "Team",
    "Agents",
    agent.business?.name ?? "Global"
  ];

  useEffect(() => {
    setMemoriesState(memories);
  }, [memories]);

  async function handleMemoryTierChange(
    memory: MemoryItem,
    tier: "hot" | "warm" | "cold"
  ) {
    const previous = memoriesState;
    setMemoriesState((current) =>
      current.map((entry) =>
        entry.id === memory.id ? { ...entry, tier } : entry
      )
    );

    try {
      const response = await fetchWithCsrf(`/api/admin/memory/${memory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tier
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        memory?: MemoryItem;
      };

      if (!response.ok || !payload.memory) {
        throw new Error(payload.error ?? "Unable to update memory tier.");
      }

      setMemoriesState((current) =>
        current.map((entry) => (entry.id === payload.memory?.id ? payload.memory : entry))
      );
      toast.success("Memory tier updated.");
      router.refresh();
    } catch (error) {
      setMemoriesState(previous);
      toast.error(
        error instanceof Error ? error.message : "Unable to update memory tier."
      );
    }
  }

  async function handleDeleteMemory(memory: MemoryItem) {
    try {
      const response = await fetchWithCsrf(`/api/admin/memory/${memory.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete memory.");
      }

      setMemoriesState((current) => current.filter((entry) => entry.id !== memory.id));
      toast.success("Memory deleted.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete memory."
      );
      throw error;
    }
  }

  async function clearMemories() {
    try {
      setClearing(true);

      const response = await fetchWithCsrf(`/api/admin/agents/${agent.id}/memories`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to clear memories.");
      }

      setMemoriesState([]);
      toast.success("Agent memories cleared.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to clear memories."
      );
      throw error;
    } finally {
      setClearing(false);
    }
  }

  const agentEmoji = agent.emoji || "🤖";
  const runningCount = agent.actionRuns.filter((run) => run.status === "running").length;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/agents"
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted transition-colors hover:text-steel-bright"
      >
        <ArrowLeft className="h-3 w-3" />
        All agents
      </Link>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-bg-surface-2 text-3xl"
            aria-hidden
          >
            {agentEmoji}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <PageHeader
              eyebrow={eyebrowSegments.join(" · ")}
              title={agent.displayName}
              description={agent.role}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <AgentTypeBadge type={agent.type as "main" | "specialist" | "global"} />
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-secondary">
                <StatusDot tone={statusTone} />
                {statusMeta.label}
              </span>
              {agent.business ? (
                <Link
                  href={`/admin/businesses/${agent.business.id}`}
                  className="inline-flex items-center rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-secondary transition-colors hover:border-line hover:text-steel-bright"
                >
                  {agent.business.name}
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/agents/${agent.id}/edit`}>Edit</Link>
          </Button>
          <AgentTestPanel
            agent={agent}
            business={agent.business}
            systemDefault={systemDefaultModel}
            trigger={
              <Button variant="outline" size="sm">
                Test
              </Button>
            }
          />
          {agent.businessId ? (
            <Button
              size="sm"
              onClick={async () => {
                const res = await fetchWithCsrf("/api/admin/chat/conversations", {
                  method: "POST",
                  body: JSON.stringify({ agentId: agent.id })
                });
                const data = await res.json();
                if (res.ok && data.conversation?.id) {
                  router.push(`/admin/chat/${data.conversation.id}`);
                }
              }}
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Chat
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock
          label="Memory entries"
          value={String(agent._count.agentMemories)}
          icon={<Brain className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Conversations"
          value={String(agent._count.conversationLogs)}
          icon={<MessageSquare className="h-4 w-4" />}
          mono
        />
        <StatBlock
          label="Action runs"
          value={String(agent._count.actionRuns)}
          icon={<Zap className="h-4 w-4" />}
          mono
          tone={runningCount > 0 ? "warning" : "default"}
          subtext={runningCount > 0 ? `${runningCount} running now` : undefined}
        />
        <StatBlock
          label="Last active"
          value={agent.lastSeen ? formatRelativeTime(agent.lastSeen) : "Never"}
          icon={<Clock className="h-4 w-4" />}
          mono
        />
      </div>

      <ModelInheritanceDisplay
        agent={agent}
        business={agent.business}
        systemDefault={systemDefaultModel}
      />

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="activity">
            Runs
            {runningCount > 0 ? (
              <StatusDot tone="live" className="ml-2" />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
            <Panel>
              <PanelHeader label="Purpose" />
              <PanelBody className="space-y-5">
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink-primary">
                  {agent.purpose || "No purpose has been added yet."}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                      Created
                    </div>
                    <div className="mt-1 font-mono text-[12px] text-ink-primary">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                      Updated
                    </div>
                    <div className="mt-1 font-mono text-[12px] text-ink-primary">
                      {new Date(agent.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5 md:col-span-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                      Workspace path
                    </div>
                    <div className="mt-1 break-all font-mono text-[12px] text-ink-primary">
                      {agent.workspacePath || "Not configured"}
                    </div>
                  </div>
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader label="Configuration" />
              <PanelBody className="space-y-0 p-0">
                <ConfigRow
                  label="Primary model"
                  value={formatModelName(agent.primaryModel || agent.business?.primaryModel)}
                />
                <ConfigRow
                  label="Fallback model"
                  value={formatModelName(agent.fallbackModel || agent.business?.fallbackModel)}
                />
                <ConfigRow
                  label="Enabled tools"
                  value={String(enabledTools.length)}
                  mono
                />
                <ConfigRow
                  label="Business"
                  value={agent.business?.name || "Global agent"}
                  isLast
                />
              </PanelBody>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-3">
          <PromptPanel
            title="System prompt"
            value={agent.systemPrompt}
            monospace
          />
          <PromptPanel
            title="Role instructions"
            value={agent.roleInstructions}
          />
          <PromptPanel title="Output style" value={agent.outputStyle} />
        </TabsContent>

        <TabsContent value="rules" className="space-y-3">
          <PromptPanel title="Constraints" value={agent.constraints} />
          <PromptPanel
            title="Escalation rules"
            value={agent.escalationRules}
          />
          <PromptPanel
            title="Ask before doing"
            value={agent.askBeforeDoing}
          />
        </TabsContent>

        <TabsContent value="tools">
          {enabledTools.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No tools configured"
              description="Add tools to this agent so it can take action across your connected systems."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {enabledTools.map((tool) => {
                const Icon = tool.icon;

                return (
                  <Panel key={tool.key}>
                    <PanelBody className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line-subtle bg-bg-surface-2 text-steel-bright">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-ink-primary">
                          {formatToolLabel(tool.key)}
                        </div>
                        <div className="mt-1 text-[11.5px] leading-5 text-ink-secondary">
                          {tool.description}
                        </div>
                      </div>
                    </PanelBody>
                  </Panel>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="memory">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <StatBlock label="Hot" value={String(memoryStats.hot)} mono />
              <StatBlock
                label="Warm"
                value={String(memoryStats.warm)}
                mono
                tone={memoryStats.warm > 0 ? "warning" : "default"}
              />
              <StatBlock label="Cold" value={String(memoryStats.cold)} mono />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-ink-secondary">
                Memory helps the agent retain context, preferences, and important outcomes.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setClearOpen(true)}
                disabled={memoriesState.length === 0}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear all
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {(["all", "hot", "warm", "cold"] as const).map((tier) => (
                <Button
                  key={tier}
                  type="button"
                  size="sm"
                  variant={memoryTierFilter === tier ? "default" : "outline"}
                  onClick={() => setMemoryTierFilter(tier)}
                >
                  {tier === "all" ? "All" : tier.charAt(0).toUpperCase() + tier.slice(1)}
                </Button>
              ))}
            </div>

            {filteredMemories.length === 0 ? (
              <EmptyState
                icon={Brain}
                title={
                  memoriesState.length === 0 ? "No memories yet" : "No memories in this tier"
                }
                description={
                  memoriesState.length === 0
                    ? "This agent has not stored any memory entries yet."
                    : "Try another tier filter to review the rest of this agent's memory history."
                }
              />
            ) : (
              <div className="grid gap-3">
                {filteredMemories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onTierChange={handleMemoryTierChange}
                    onDelete={handleDeleteMemory}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          {agent.actionRuns.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No runs yet"
              description="This agent has not executed any tracked actions yet."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBlock
                  label="Total"
                  value={String(agent.actionRuns.length)}
                  mono
                />
                <StatBlock
                  label="Completed"
                  value={String(
                    agent.actionRuns.filter((r) => r.status === "completed").length
                  )}
                  mono
                  tone="success"
                />
                <StatBlock
                  label="Running"
                  value={String(runningCount)}
                  mono
                  tone={runningCount > 0 ? "warning" : "default"}
                />
                <StatBlock
                  label="Failed"
                  value={String(
                    agent.actionRuns.filter((r) => r.status === "failed").length
                  )}
                  mono
                  tone={
                    agent.actionRuns.some((r) => r.status === "failed")
                      ? "danger"
                      : "default"
                  }
                />
              </div>

              <Panel variant={runningCount > 0 ? "live" : "default"}>
                <PanelHeader
                  label="Run history"
                  action={
                    <span className="font-mono text-[10.5px] text-ink-muted">
                      {agent.actionRuns.length} total
                    </span>
                  }
                />
                <div className="divide-y divide-line-subtle">
                  {agent.actionRuns.map((run) => {
                    const isRunning = run.status === "running";
                    const duration =
                      run.completedAt && run.createdAt
                        ? Math.round(
                            (new Date(run.completedAt).getTime() -
                              new Date(run.createdAt).getTime()) /
                              1000
                          )
                        : null;

                    return (
                      <div
                        key={run.id}
                        className={cn(
                          "px-4 py-3 transition-colors",
                          isRunning && "bg-steel/5"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <StatusDot tone={getActionStatusTone(run.status)} />
                          <div className="text-[13px] font-medium text-ink-primary">
                            {run.action}
                          </div>
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              getActionStatusBadgeClass(run.status)
                            )}
                          >
                            {run.status}
                          </span>
                          {duration !== null ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-ink-muted">
                              <Clock className="h-3 w-3" />
                              {duration < 60
                                ? `${duration}s`
                                : `${Math.floor(duration / 60)}m ${duration % 60}s`}
                            </span>
                          ) : null}
                          <span className="ml-auto font-mono text-[10.5px] text-ink-muted">
                            {formatRelativeTime(run.completedAt || run.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12px] leading-5 text-ink-secondary">
                          {summarizeResult(run.result, run.error)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all agent memories?"
        description="This removes the saved memory entries for this agent. It does not delete the agent itself."
        confirmLabel="Clear memories"
        variant="danger"
        loading={clearing}
        onConfirm={clearMemories}
      />
    </div>
  );
}

function ConfigRow({
  label,
  value,
  mono,
  isLast
}: {
  label: string;
  value: string;
  mono?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2.5",
        !isLast && "border-b border-line-subtle"
      )}
    >
      <span className="text-[12px] text-ink-secondary">{label}</span>
      <span
        className={cn(
          "truncate text-[12.5px] text-ink-primary",
          mono && "font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}
