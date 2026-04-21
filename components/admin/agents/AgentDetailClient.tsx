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

import { EmptyState } from "@/components/admin/EmptyState";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function getMemoryTierMeta(tier: string) {
  switch (tier) {
    case "hot":
      return "bg-steel/15 text-steel-bright";
    case "warm":
      return "bg-state-warning/15 text-state-warning";
    case "cold":
    default:
      return "bg-bg-surface-2 text-ink-primary";
  }
}

function getActionStatusMeta(status: string) {
  switch (status) {
    case "completed":
      return "bg-state-success/15 text-state-success";
    case "failed":
      return "bg-state-danger/15 text-state-danger";
    case "running":
      return "bg-steel/15 text-steel-bright";
    case "pending":
      return "bg-state-warning/15 text-state-warning";
    default:
      return "bg-bg-surface-2 text-ink-primary";
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
      <Copy className="mr-2 h-4 w-4" />
      Copy
    </Button>
  );
}

function ReadOnlyPromptBlock({
  title,
  value,
  monospace = false
}: {
  title: string;
  value: string | null;
  monospace?: boolean;
}) {
  return (
    <Card className="border-line-subtle bg-bg-surface">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base text-white">{title}</CardTitle>
        {value ? <CopyButton value={value} /> : null}
      </CardHeader>
      <CardContent>
        {value ? (
          <ScrollArea className="max-h-80 rounded-2xl border border-line-subtle bg-bg-surface-2/40">
            <div
              className={cn(
                "whitespace-pre-wrap p-4 text-sm leading-6 text-ink-primary",
                monospace && "font-mono"
              )}
            >
              {value}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm italic text-ink-muted">Not configured yet.</p>
        )}
      </CardContent>
    </Card>
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
  const status = getAgentStatusMeta(agent.status);
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

  return (
    <div className="space-y-6">
      <Link
        href="/admin/agents"
        className="inline-flex items-center gap-2 text-sm text-ink-secondary transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Agents
      </Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-bg-surface-2 text-4xl">
            {agent.emoji || "🤖"}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{agent.displayName}</h1>
              <AgentTypeBadge type={agent.type as "main" | "specialist" | "global"} />
              <Badge className={status.badgeClassName}>
                <span
                  className={cn("mr-2 inline-block h-2 w-2 rounded-full", status.dotClassName)}
                />
                {status.label}
              </Badge>
              {agent.business ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/businesses/${agent.business.id}`}>
                    {agent.business.name}
                  </Link>
                </Button>
              ) : null}
            </div>
            <p className="text-sm leading-6 text-ink-secondary">{agent.role}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href={`/admin/agents/${agent.id}/edit`}>Edit</Link>
          </Button>
          <AgentTestPanel
            agent={agent}
            business={agent.business}
            systemDefault={systemDefaultModel}
            trigger={<Button variant="outline">Test Agent</Button>}
          />
          {agent.businessId && (
            <Button
              asChild
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
              <button type="button">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </button>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-sm text-ink-secondary">Memory entries</div>
              <div className="mt-2 text-3xl font-bold text-white">
                {agent._count.agentMemories}
              </div>
            </div>
            <Brain className="h-5 w-5 text-steel-bright" />
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-sm text-ink-secondary">Conversations</div>
              <div className="mt-2 text-3xl font-bold text-white">
                {agent._count.conversationLogs}
              </div>
            </div>
            <MessageSquare className="h-5 w-5 text-steel-bright" />
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-sm text-ink-secondary">Action runs</div>
              <div className="mt-2 text-3xl font-bold text-white">
                {agent._count.actionRuns}
              </div>
            </div>
            <Zap className="h-5 w-5 text-state-warning" />
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-sm text-ink-secondary">Last active</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {agent.lastSeen ? formatRelativeTime(agent.lastSeen) : "Never"}
              </div>
            </div>
            <Clock className="h-5 w-5 text-ink-secondary" />
          </CardContent>
        </Card>
      </div>

      <ModelInheritanceDisplay
        agent={agent}
        business={agent.business}
        systemDefault={systemDefaultModel}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="activity">
            Runs
            {agent.actionRuns.some((r) => r.status === "running") ? (
              <span className="ml-1.5 inline-flex h-2 w-2 animate-pulse rounded-full bg-steel" />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
            <Card className="border-line-subtle bg-bg-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-ink-primary">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                    Purpose
                  </div>
                  <p className="mt-2 whitespace-pre-wrap leading-6">
                    {agent.purpose || "No purpose has been added yet."}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-line-subtle bg-bg-surface-2/30 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                      Created
                    </div>
                    <div className="mt-2 text-white">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line-subtle bg-bg-surface-2/30 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                      Updated
                    </div>
                    <div className="mt-2 text-white">
                      {new Date(agent.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line-subtle bg-bg-surface-2/30 p-4 md:col-span-2">
                    <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                      Workspace path
                    </div>
                    <div className="mt-2 break-all font-mono text-sm text-white">
                      {agent.workspacePath || "Not configured yet"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-line-subtle bg-bg-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">Quick stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-ink-secondary">
                <div className="flex items-center justify-between">
                  <span>Primary model</span>
                  <span className="text-white">{formatModelName(agent.primaryModel || agent.business?.primaryModel)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fallback model</span>
                  <span className="text-white">{formatModelName(agent.fallbackModel || agent.business?.fallbackModel)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Enabled tools</span>
                  <span className="text-white">{enabledTools.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Business</span>
                  <span className="text-white">
                    {agent.business?.name || "Global agent"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <ReadOnlyPromptBlock
            title="System Prompt"
            value={agent.systemPrompt}
            monospace
          />
          <ReadOnlyPromptBlock
            title="Role Instructions"
            value={agent.roleInstructions}
          />
          <ReadOnlyPromptBlock title="Output Style" value={agent.outputStyle} />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <ReadOnlyPromptBlock title="Constraints" value={agent.constraints} />
          <ReadOnlyPromptBlock
            title="Escalation Rules"
            value={agent.escalationRules}
          />
          <ReadOnlyPromptBlock
            title="Ask Before Doing"
            value={agent.askBeforeDoing}
          />
        </TabsContent>

        <TabsContent value="tools">
          {enabledTools.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-6 w-6" />}
              title="No tools configured"
              description="Add tools to this agent so it can take action across your connected systems."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {enabledTools.map((tool) => {
                const Icon = tool.icon;

                return (
                  <Card key={tool.key} className="border-line-subtle bg-bg-surface">
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-surface-2 text-steel-bright">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {formatToolLabel(tool.key)}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-ink-secondary">
                          {tool.description}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="memory">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-line-subtle bg-bg-surface">
                <CardContent className="p-4">
                  <div className="text-sm text-steel-bright">Hot</div>
                  <div className="mt-2 text-2xl font-bold text-white">{memoryStats.hot}</div>
                </CardContent>
              </Card>
              <Card className="border-line-subtle bg-bg-surface">
                <CardContent className="p-4">
                  <div className="text-sm text-state-warning">Warm</div>
                  <div className="mt-2 text-2xl font-bold text-white">{memoryStats.warm}</div>
                </CardContent>
              </Card>
              <Card className="border-line-subtle bg-bg-surface">
                <CardContent className="p-4">
                  <div className="text-sm text-ink-primary">Cold</div>
                  <div className="mt-2 text-2xl font-bold text-white">{memoryStats.cold}</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink-secondary">
                Memory helps the agent retain context, preferences, and important outcomes.
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setClearOpen(true)}
                disabled={memoriesState.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Memories
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                type="button"
                size="sm"
                variant={memoryTierFilter === "all" ? "default" : "outline"}
                onClick={() => setMemoryTierFilter("all")}
              >
                All
              </Button>
              <Button
                type="button"
                size="sm"
                variant={memoryTierFilter === "hot" ? "default" : "outline"}
                onClick={() => setMemoryTierFilter("hot")}
              >
                Hot
              </Button>
              <Button
                type="button"
                size="sm"
                variant={memoryTierFilter === "warm" ? "default" : "outline"}
                onClick={() => setMemoryTierFilter("warm")}
              >
                Warm
              </Button>
              <Button
                type="button"
                size="sm"
                variant={memoryTierFilter === "cold" ? "default" : "outline"}
                onClick={() => setMemoryTierFilter("cold")}
              >
                Cold
              </Button>
            </div>

            {filteredMemories.length === 0 ? (
              <EmptyState
                icon={<Brain className="h-6 w-6" />}
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
              icon={<Zap className="h-6 w-6" />}
              title="No runs yet"
              description="This agent has not executed any tracked actions yet."
            />
          ) : (
            <div className="space-y-4">
              {/* Run Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Total",
                    count: agent.actionRuns.length,
                    cls: "text-white"
                  },
                  {
                    label: "Completed",
                    count: agent.actionRuns.filter(
                      (r) => r.status === "completed"
                    ).length,
                    cls: "text-state-success"
                  },
                  {
                    label: "Running",
                    count: agent.actionRuns.filter(
                      (r) => r.status === "running"
                    ).length,
                    cls: "text-steel-bright"
                  },
                  {
                    label: "Failed",
                    count: agent.actionRuns.filter(
                      (r) => r.status === "failed"
                    ).length,
                    cls: "text-state-danger"
                  }
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-line-subtle bg-bg-surface-2 px-3 py-2"
                  >
                    <div className="text-xs text-ink-muted">{stat.label}</div>
                    <div className={cn("text-lg font-bold", stat.cls)}>
                      {stat.count}
                    </div>
                  </div>
                ))}
              </div>

              {/* Run List */}
              <div className="grid gap-2">
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
                    <Card
                      key={run.id}
                      className={cn(
                        "border-line-subtle bg-bg-surface transition-colors",
                        isRunning && "border-steel/30"
                      )}
                    >
                      <CardContent className="space-y-2 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          {isRunning ? (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-steel opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-steel" />
                            </span>
                          ) : null}
                          <div className="text-sm font-semibold text-white">
                            {run.action}
                          </div>
                          <Badge className={getActionStatusMeta(run.status)}>
                            {run.status}
                          </Badge>
                          {duration !== null ? (
                            <span className="flex items-center gap-1 text-xs text-ink-muted">
                              <Clock className="h-3 w-3" />
                              {duration < 60
                                ? `${duration}s`
                                : `${Math.floor(duration / 60)}m ${duration % 60}s`}
                            </span>
                          ) : null}
                          <span className="ml-auto text-xs text-ink-muted">
                            {formatRelativeTime(
                              run.completedAt || run.createdAt
                            )}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-ink-secondary">
                          {summarizeResult(run.result, run.error)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear all agent memories?"
        description="This removes the saved memory entries for this agent. It does not delete the agent itself."
        confirmLabel="Clear Memories"
        variant="danger"
        loading={clearing}
        onConfirm={clearMemories}
      />
    </div>
  );
}
