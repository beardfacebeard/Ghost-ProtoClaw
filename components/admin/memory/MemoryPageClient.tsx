"use client";

import { useEffect, useState, useTransition } from "react";
import { Brain, ChevronUp, Flame, Snowflake, Thermometer, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MEMORY_TYPE_OPTIONS } from "@/lib/brain/memory";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { MemoryCard } from "@/components/admin/memory/MemoryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
};

type MemoryRecord = {
  id: string;
  agentId: string;
  businessId: string;
  type: string;
  content: string;
  importance: number;
  tier: string;
  expiresAt: Date | string | null;
  metadata?: unknown;
  createdAt: Date | string;
  agent: {
    id: string;
    displayName: string;
    emoji: string | null;
  } | null;
};

type MemoryPageClientProps = {
  businesses: Array<{
    id: string;
    name: string;
  }>;
  agents: AgentOption[];
  selectedBusinessId: string | null;
  memories: MemoryRecord[];
};

function buildTierStats(memories: MemoryRecord[]) {
  return {
    total: memories.length,
    hot: memories.filter((memory) => memory.tier === "hot").length,
    warm: memories.filter((memory) => memory.tier === "warm").length,
    cold: memories.filter((memory) => memory.tier === "cold").length
  };
}

export function MemoryPageClient({
  businesses,
  agents,
  selectedBusinessId,
  memories
}: MemoryPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [memoriesState, setMemoriesState] = useState(memories);
  const [infoOpen, setInfoOpen] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState("all");
  const [selectedTier, setSelectedTier] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [search, setSearch] = useState("");
  const [clearTarget, setClearTarget] = useState<{
    title: string;
    description: string;
    count: number;
    agentId?: string;
    tier?: "hot" | "warm" | "cold";
  } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMemoriesState(memories);
    setSelectedAgentId("all");
    setSelectedTier("all");
    setSelectedType("all");
    setSearch("");
  }, [memories]);

  const stats = buildTierStats(memoriesState);
  const filteredMemories = memoriesState.filter((memory) => {
    if (selectedAgentId !== "all" && memory.agentId !== selectedAgentId) {
      return false;
    }
    if (selectedTier !== "all" && memory.tier !== selectedTier) {
      return false;
    }
    if (selectedType !== "all" && memory.type !== selectedType) {
      return false;
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      return memory.content.toLowerCase().includes(query);
    }

    return true;
  });

  function handleBusinessChange(businessId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("businessId", businessId);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  async function handleTierChange(memory: MemoryRecord, tier: "hot" | "warm" | "cold") {
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
      const result = (await response.json()) as {
        error?: string;
        memory?: MemoryRecord;
      };

      if (!response.ok || !result.memory) {
        throw new Error(result.error ?? "Unable to update memory tier.");
      }

      setMemoriesState((current) =>
        current.map((entry) => (entry.id === result.memory?.id ? result.memory : entry))
      );
      toast.success("Memory tier updated.");
      startTransition(() => router.refresh());
    } catch (error) {
      setMemoriesState(previous);
      toast.error(
        error instanceof Error ? error.message : "Unable to update memory tier."
      );
    }
  }

  async function handleDelete(memory: MemoryRecord) {
    try {
      const response = await fetchWithCsrf(`/api/admin/memory/${memory.id}`, {
        method: "DELETE"
      });
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete memory.");
      }

      setMemoriesState((current) => current.filter((entry) => entry.id !== memory.id));
      toast.success("Memory deleted.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete memory.");
      throw error;
    }
  }

  async function handleClearMemories() {
    if (!selectedBusinessId || !clearTarget) {
      return;
    }

    try {
      const response = await fetchWithCsrf("/api/admin/memory/clear", {
        method: "POST",
        body: JSON.stringify({
          businessId: selectedBusinessId,
          agentId: clearTarget.agentId,
          tier: clearTarget.tier
        })
      });
      const result = (await response.json()) as {
        error?: string;
        count?: number;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to clear memories.");
      }

      setMemoriesState((current) =>
        current.filter((entry) => {
          if (clearTarget.agentId && entry.agentId !== clearTarget.agentId) {
            return true;
          }
          if (clearTarget.tier && entry.tier !== clearTarget.tier) {
            return true;
          }
          return false;
        })
      );
      setClearTarget(null);
      toast.success(`${result.count ?? 0} memories cleared.`);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to clear memories.");
      throw error;
    }
  }

  function openClearDialog(options: {
    agentId?: string;
    tier?: "hot" | "warm" | "cold";
  }) {
    const count = memoriesState.filter((memory) => {
      if (options.agentId && memory.agentId !== options.agentId) {
        return false;
      }
      if (options.tier && memory.tier !== options.tier) {
        return false;
      }
      return true;
    }).length;

    const agentName =
      options.agentId === undefined
        ? "this business"
        : agents.find((agent) => agent.id === options.agentId)?.displayName ?? "this agent";
    const title =
      options.tier === undefined
        ? `Clear memories for ${agentName}?`
        : `Clear ${options.tier} memories for ${agentName}?`;

    setClearTarget({
      ...options,
      count,
      title,
      description: `This will permanently delete ${count} memories. This cannot be undone.`
    });
  }

  if (!selectedBusinessId && businesses.length > 0) {
    return (
      <EmptyState
        icon={<Brain className="h-6 w-6" />}
        title="Select a business"
        description="Choose a business to review the memory records its agents are carrying forward."
      />
    );
  }

  if (!selectedBusinessId && businesses.length === 0) {
    return (
      <EmptyState
        icon={<Brain className="h-6 w-6" />}
        title="No businesses yet"
        description="Create a business first, then review the memories its agents build over time."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-steel-bright">
            <Flame className="h-4 w-4" />
            Hot Memory
          </div>
          <div className="mt-3 text-3xl font-bold text-white">{stats.hot}</div>
        </div>
        <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-state-warning">
            <Thermometer className="h-4 w-4" />
            Warm Memory
          </div>
          <div className="mt-3 text-3xl font-bold text-white">{stats.warm}</div>
        </div>
        <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-ink-primary">
            <Snowflake className="h-4 w-4" />
            Cold Memory
          </div>
          <div className="mt-3 text-3xl font-bold text-white">{stats.cold}</div>
        </div>
      </div>

      <div className="text-sm text-ink-muted">Total memories across all tiers: {stats.total}</div>

      <div className="rounded-2xl border border-line-subtle bg-bg-surface">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
          onClick={() => setInfoOpen((current) => !current)}
        >
          <div>
            <div className="text-sm font-semibold text-white">How agent memory works</div>
            <div className="mt-1 text-xs text-ink-muted">
              What gets loaded automatically versus kept for later recall.
            </div>
          </div>
          <ChevronUp
            className={`h-4 w-4 text-ink-secondary transition-transform ${infoOpen ? "" : "rotate-180"}`}
          />
        </button>
        {infoOpen ? (
          <div className="border-t border-line-subtle px-4 py-4 text-sm leading-6 text-ink-primary">
            <p>Hot memories are loaded into every conversation. Keep this tier small and highly relevant.</p>
            <p className="mt-3">Warm memories are available but not auto-loaded. Agents can access these on request.</p>
            <p className="mt-3">Cold memories are archived. Agents do not load these automatically. Use them for historical records.</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Memories
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => openClearDialog({ agentId: selectedAgentId === "all" ? undefined : selectedAgentId })}>
              Clear all visible scope
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openClearDialog({ agentId: selectedAgentId === "all" ? undefined : selectedAgentId, tier: "hot" })}>
              Clear hot memories
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openClearDialog({ agentId: selectedAgentId === "all" ? undefined : selectedAgentId, tier: "warm" })}>
              Clear warm memories
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openClearDialog({ agentId: selectedAgentId === "all" ? undefined : selectedAgentId, tier: "cold" })}>
              Clear cold memories
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,0.8fr))]">
        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Business</div>
          <Select value={selectedBusinessId ?? undefined} onValueChange={handleBusinessChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a business" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((business) => (
                <SelectItem key={business.id} value={business.id}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Agent</div>
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.emoji ? `${agent.emoji} ` : ""}
                  {agent.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Search</div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search memory content"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          variant={selectedTier === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTier("all")}
        >
          All Tiers
        </Button>
        <Button
          type="button"
          variant={selectedTier === "hot" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTier("hot")}
        >
          Hot
        </Button>
        <Button
          type="button"
          variant={selectedTier === "warm" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTier("warm")}
        >
          Warm
        </Button>
        <Button
          type="button"
          variant={selectedTier === "cold" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedTier("cold")}
        >
          Cold
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Button
          type="button"
          variant={selectedType === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType("all")}
        >
          All Types
        </Button>
        {MEMORY_TYPE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={selectedType === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {(selectedAgentId !== "all" || selectedTier !== "all") && selectedBusinessId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-4">
          <div className="text-sm text-ink-primary">
            {selectedTier !== "all" ? `${selectedTier} memories` : "All memories"} for{" "}
            {selectedAgentId !== "all"
              ? agents.find((agent) => agent.id === selectedAgentId)?.displayName ?? "selected agent"
              : "this business"}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              openClearDialog({
                agentId: selectedAgentId === "all" ? undefined : selectedAgentId,
                tier: selectedTier === "all" ? undefined : (selectedTier as "hot" | "warm" | "cold")
              })
            }
          >
            Clear {selectedTier !== "all" ? selectedTier : "filtered"} memories
          </Button>
        </div>
      ) : null}

      {filteredMemories.length === 0 ? (
        <EmptyState
          icon={<Brain className="h-6 w-6" />}
          title="No memories found"
          description="No memory records match the current filters."
        />
      ) : (
        <div className="grid gap-3">
          {filteredMemories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onTierChange={handleTierChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={clearTarget !== null}
        onOpenChange={(open) => !open && setClearTarget(null)}
        title={clearTarget?.title ?? "Clear memories?"}
        description={clearTarget?.description ?? "This action cannot be undone."}
        confirmLabel={`Delete ${clearTarget?.count ?? 0} memories`}
        variant="danger"
        onConfirm={handleClearMemories}
      />
    </div>
  );
}
