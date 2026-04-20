"use client";

import { useEffect, useState, useTransition } from "react";
import { BookOpen, Info, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { KNOWLEDGE_CATEGORY_OPTIONS } from "@/lib/brain/knowledge";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

import { EmptyState } from "@/components/admin/EmptyState";
import { KnowledgeCard } from "@/components/admin/knowledge/KnowledgeCard";
import { KnowledgeModal } from "@/components/admin/knowledge/KnowledgeModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";

type KnowledgeItemRecord = {
  id: string;
  businessId: string;
  category: string;
  title: string;
  content: string;
  sourceType: string;
  enabled: boolean;
  tokenCount: number | null;
  tier?: string;
  assignedAgentIds?: string[];
  updatedAt: Date | string;
};

type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
};

type BusinessOption = {
  id: string;
  name: string;
};

type KnowledgeManagerProps = {
  businessId: string | null;
  items: KnowledgeItemRecord[];
  businesses?: BusinessOption[];
  agents?: AgentOption[];
  onBusinessChange?: (businessId: string) => void;
  showSummary?: boolean;
  showMobileFab?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

function getTokenBudgetMeta(totalTokens: number) {
  if (totalTokens < 2000) {
    return {
      label: "Lean",
      className: "bg-status-active/15 text-status-active",
      barClassName: "bg-status-active"
    };
  }

  if (totalTokens <= 6000) {
    return {
      label: "Moderate",
      className: "bg-brand-amber/15 text-brand-amber",
      barClassName: "bg-brand-amber"
    };
  }

  return {
    label: "Heavy - may impact performance",
    className: "bg-status-error/15 text-status-error",
    barClassName: "bg-status-error"
  };
}

function buildSummary(items: KnowledgeItemRecord[]) {
  const summary = {
    totalItems: items.length,
    enabledItems: 0,
    totalTokens: 0,
    // "autoInjected" = the worst-case token load for any single agent
    // (hot tier + warm-with-no-assignment). Warm items pinned to a
    // specific agent only hit that agent, so they don't count here.
    autoInjectedTokens: 0,
    tierTokens: { hot: 0, warm: 0, cold: 0 },
    tierCounts: { hot: 0, warm: 0, cold: 0 }
  };

  for (const item of items) {
    summary.totalTokens += item.tokenCount ?? 0;
    if (item.enabled) {
      summary.enabledItems += 1;
    }
    const tier = (item.tier ?? "warm") as "hot" | "warm" | "cold";
    const bucket =
      tier === "hot" || tier === "warm" || tier === "cold" ? tier : "warm";
    summary.tierTokens[bucket] += item.tokenCount ?? 0;
    summary.tierCounts[bucket] += 1;
    if (item.enabled) {
      if (bucket === "hot") {
        summary.autoInjectedTokens += item.tokenCount ?? 0;
      } else if (bucket === "warm") {
        const assigned = item.assignedAgentIds ?? [];
        if (assigned.length === 0) {
          summary.autoInjectedTokens += item.tokenCount ?? 0;
        }
      }
    }
  }

  return summary;
}

export function KnowledgeManager({
  businessId,
  items,
  businesses = [],
  agents = [],
  onBusinessChange,
  showSummary = true,
  showMobileFab = false,
  emptyTitle = "No knowledge items yet",
  emptyDescription = "Add structured business knowledge so your agents can answer questions clearly and consistently."
}: KnowledgeManagerProps) {
  const router = useRouter();
  const [itemsState, setItemsState] = useState(items);
  const [activeCategory, setActiveCategory] = useState("all");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItemRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItemsState(items);
  }, [items]);

  const summary = buildSummary(itemsState);
  const budgetMeta = getTokenBudgetMeta(summary.totalTokens);
  const filteredItems =
    activeCategory === "all"
      ? itemsState
      : itemsState.filter((item) => item.category === activeCategory);

  async function handleSave(payload: {
    businessId: string;
    category: string;
    title: string;
    content: string;
    enabled: boolean;
    tier: "hot" | "warm" | "cold";
    assignedAgentIds: string[];
  }) {
    try {
      const isEditing = modalMode === "edit" && selectedItem;
      const endpoint = isEditing
        ? `/api/admin/knowledge/${selectedItem.id}`
        : "/api/admin/knowledge";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchWithCsrf(endpoint, {
        method,
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as {
        error?: string;
        item?: KnowledgeItemRecord;
      };

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Unable to save knowledge item.");
      }

      const savedItem = result.item;

      setItemsState((current) => {
        if (isEditing) {
          return current.map((entry) =>
            entry.id === savedItem.id ? savedItem : entry
          );
        }

        return [...current, savedItem].sort((left, right) => {
          const categoryDiff = left.category.localeCompare(right.category);
          if (categoryDiff !== 0) {
            return categoryDiff;
          }

          return left.title.localeCompare(right.title);
        });
      });

      setModalMode(null);
      setSelectedItem(null);
      toast.success(isEditing ? "Knowledge updated." : "Knowledge added.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save knowledge item."
      );
      throw error;
    }
  }

  async function handleDelete(item: KnowledgeItemRecord) {
    try {
      const response = await fetchWithCsrf(`/api/admin/knowledge/${item.id}`, {
        method: "DELETE"
      });
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete knowledge item.");
      }

      setItemsState((current) => current.filter((entry) => entry.id !== item.id));
      toast.success("Knowledge item deleted.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete knowledge item."
      );
      throw error;
    }
  }

  async function handleToggle(item: KnowledgeItemRecord, enabled: boolean) {
    const previousItems = itemsState;
    setItemsState((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, enabled } : entry
      )
    );

    try {
      const response = await fetchWithCsrf(
        `/api/admin/knowledge/${item.id}/toggle`,
        {
          method: "POST",
          body: JSON.stringify({
            enabled
          })
        }
      );
      const result = (await response.json()) as {
        error?: string;
        item?: KnowledgeItemRecord;
      };

      if (!response.ok || !result.item) {
        throw new Error(result.error ?? "Unable to update knowledge item.");
      }

      const updatedItem = result.item;

      setItemsState((current) =>
        current.map((entry) => (entry.id === updatedItem.id ? updatedItem : entry))
      );
      toast.success(enabled ? "Knowledge enabled." : "Knowledge disabled.");
      startTransition(() => router.refresh());
    } catch (error) {
      setItemsState(previousItems);
      toast.error(
        error instanceof Error ? error.message : "Unable to update knowledge item."
      );
    }
  }

  function openCreateModal() {
    setSelectedItem(null);
    setModalMode("create");
  }

  function openEditModal(item: KnowledgeItemRecord) {
    setSelectedItem(item);
    setModalMode("edit");
  }

  if (!businessId && businesses.length > 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-6 w-6" />}
        title="Select a business"
        description="Choose a business to view and manage its knowledge base."
      />
    );
  }

  if (!businessId && businesses.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="h-6 w-6" />}
        title="No businesses yet"
        description="Create a business first, then add the knowledge your agents should carry into every run."
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {businesses.length > 1 && onBusinessChange ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-white">
              Select a business to manage its knowledge
            </div>
            <Select
              value={businessId ?? undefined}
              onValueChange={(value) => onBusinessChange(value)}
            >
              <SelectTrigger className="max-w-sm">
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
        ) : null}

        {showSummary && businessId ? (
          <div className="rounded-2xl border border-ghost-border bg-ghost-surface p-4 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Total Items
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {summary.totalItems}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Enabled
                  </div>
                  <div className="mt-2 text-2xl font-bold text-status-active">
                    {summary.enabledItems}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Auto-Loaded Tokens
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {summary.autoInjectedTokens.toLocaleString()}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    What lands in every agent&apos;s prompt each turn.
                  </div>
                </div>
              </div>

              <div className="w-full max-w-md space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={budgetMeta.className}>{budgetMeta.label}</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-ghost-border bg-ghost-raised text-slate-400 transition-colors hover:text-white"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Auto-loaded tokens = hot items + warm items without an
                      agent pin. Pin warm items to specific agents or move
                      heavy items to Cold to shrink this number. Cold items
                      stay available via the knowledge_lookup tool.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Progress
                  value={Math.min((summary.autoInjectedTokens / 8000) * 100, 100)}
                  className="bg-ghost-border"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 text-[12px]">
              <div className="rounded-lg border border-ghost-border bg-ghost-raised/40 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">🔥 Hot</span>
                  <span className="text-slate-500">
                    {summary.tierCounts.hot} {summary.tierCounts.hot === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="text-slate-400">
                  {summary.tierTokens.hot.toLocaleString()} tokens · loaded for every agent
                </div>
              </div>
              <div className="rounded-lg border border-ghost-border bg-ghost-raised/40 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">🌤️ Warm</span>
                  <span className="text-slate-500">
                    {summary.tierCounts.warm} {summary.tierCounts.warm === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="text-slate-400">
                  {summary.tierTokens.warm.toLocaleString()} tokens · loaded for assigned agents
                </div>
              </div>
              <div className="rounded-lg border border-ghost-border bg-ghost-raised/40 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">❄️ Cold</span>
                  <span className="text-slate-500">
                    {summary.tierCounts.cold} {summary.tierCounts.cold === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="text-slate-400">
                  {summary.tierTokens.cold.toLocaleString()} tokens · on-demand via knowledge_lookup
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            type="button"
            variant={activeCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory("all")}
          >
            All
          </Button>
          {KNOWLEDGE_CATEGORY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={activeCategory === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(option.value)}
            >
              {option.shortLabel}
            </Button>
          ))}
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title={activeCategory === "all" ? emptyTitle : "No knowledge in this category"}
            description={
              activeCategory === "all"
                ? emptyDescription
                : "Add a knowledge item in this category so your agents have the right context when they need it."
            }
            action={
              <Button type="button" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4" />
                Add Knowledge
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredItems.map((item) => (
              <KnowledgeCard
                key={item.id}
                item={item}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}

        {showMobileFab ? (
          <Button
            type="button"
            size="icon"
            className="fixed bottom-24 right-4 z-40 rounded-full shadow-brand md:hidden"
            onClick={openCreateModal}
          >
            <Plus className="h-5 w-5" />
          </Button>
        ) : null}

        {modalMode && businessId ? (
          <KnowledgeModal
            mode={modalMode}
            item={
              selectedItem
                ? {
                    ...selectedItem,
                    tier: selectedItem.tier ?? "warm",
                    assignedAgentIds: selectedItem.assignedAgentIds ?? []
                  }
                : undefined
            }
            businessId={businessId}
            businessAgents={agents}
            onSave={handleSave}
            onClose={() => {
              setModalMode(null);
              setSelectedItem(null);
            }}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
