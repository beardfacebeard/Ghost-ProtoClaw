"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Database, FolderOpen, HardDrive, Plus, RefreshCcw, Rows3, TreePine } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MEMORY_TIER_OPTIONS, WORKSPACE_CATEGORY_OPTIONS } from "@/lib/brain/workspace";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

import { EmptyState } from "@/components/admin/EmptyState";
import { WorkspaceDocCard } from "@/components/admin/workspace/WorkspaceDocCard";
import { WorkspaceFileEditor } from "@/components/admin/workspace/WorkspaceFileEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

type WorkspaceDocumentRecord = {
  id: string;
  businessId: string;
  agentId: string | null;
  filePath: string;
  content: string;
  category: string;
  tier: string;
  syncStatus: string;
  syncTarget: string;
  lastSyncAt: Date | string | null;
  updatedAt: Date | string;
};

type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
};

type WorkspacePageClientProps = {
  businesses: Array<{
    id: string;
    name: string;
  }>;
  agents: AgentOption[];
  selectedBusinessId: string | null;
  documents: WorkspaceDocumentRecord[];
  syncMode: "database" | "disk";
};

function buildStats(documents: WorkspaceDocumentRecord[]) {
  return {
    total: documents.length,
    hot: documents.filter((doc) => doc.tier === "hot").length,
    warm: documents.filter((doc) => doc.tier === "warm").length,
    cold: documents.filter((doc) => doc.tier === "cold").length,
    pending: documents.filter((doc) => doc.syncStatus === "pending").length
  };
}

function groupByDirectory(documents: WorkspaceDocumentRecord[]) {
  const groups = new Map<string, WorkspaceDocumentRecord[]>();

  for (const document of documents) {
    const segments = document.filePath.split("/");
    const directory = segments.slice(0, -1).join("/") || "root";
    const bucket = groups.get(directory) ?? [];
    bucket.push(document);
    groups.set(directory, bucket);
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function WorkspacePageClient({
  businesses,
  agents,
  selectedBusinessId,
  documents,
  syncMode
}: WorkspacePageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [documentsState, setDocumentsState] = useState(documents);
  const [selectedAgentId, setSelectedAgentId] = useState("all");
  const [selectedTier, setSelectedTier] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [editorDoc, setEditorDoc] = useState<WorkspaceDocumentRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDocumentsState(documents);
    setSelectedAgentId("all");
    setSelectedTier("all");
    setSelectedCategory("all");
    setSearch("");
  }, [documents]);

  const filteredDocuments = documentsState.filter((document) => {
    if (selectedAgentId !== "all" && document.agentId !== selectedAgentId) {
      return false;
    }
    if (selectedTier !== "all" && document.tier !== selectedTier) {
      return false;
    }
    if (selectedCategory !== "all" && document.category !== selectedCategory) {
      return false;
    }
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      const haystack = `${document.filePath} ${document.content}`.toLowerCase();
      return haystack.includes(query);
    }

    return true;
  });

  const stats = buildStats(documentsState);
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
  const treeGroups = groupByDirectory(filteredDocuments);

  function handleBusinessChange(businessId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("businessId", businessId);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  async function handleSave(payload: {
    businessId: string;
    agentId?: string | null;
    filePath: string;
    content: string;
    category: string;
    tier: string;
  }) {
    try {
      const isEditing = Boolean(editorDoc);
      const endpoint = isEditing
        ? `/api/admin/workspace/${editorDoc?.id}`
        : "/api/admin/workspace";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetchWithCsrf(endpoint, {
        method,
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as {
        error?: string;
        document?: WorkspaceDocumentRecord;
      };

      if (!response.ok || !result.document) {
        throw new Error(result.error ?? "Unable to save workspace file.");
      }

      const savedDocument = result.document;

      setDocumentsState((current) => {
        if (!isEditing) {
          return [...current, savedDocument].sort((left, right) =>
            left.filePath.localeCompare(right.filePath)
          );
        }

        return current.map((entry) =>
          entry.id === savedDocument.id ? savedDocument : entry
        );
      });

      setEditorOpen(false);
      setEditorDoc(null);
      toast.success(isEditing ? "Workspace file updated." : "Workspace file created.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save workspace file."
      );
      throw error;
    }
  }

  async function handleDelete(document: WorkspaceDocumentRecord) {
    try {
      const response = await fetchWithCsrf(`/api/admin/workspace/${document.id}`, {
        method: "DELETE"
      });
      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete workspace file.");
      }

      setDocumentsState((current) => current.filter((entry) => entry.id !== document.id));
      toast.success("Workspace file deleted.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete workspace file."
      );
      throw error;
    }
  }

  if (!selectedBusinessId && businesses.length > 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="h-6 w-6" />}
        title="Select a business"
        description="Choose a business to view and manage its runtime workspace files."
      />
    );
  }

  if (!selectedBusinessId && businesses.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="h-6 w-6" />}
        title="No businesses yet"
        description="Create a business first, then add the workspace files your agents should use."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={[
          "rounded-2xl border p-4 text-sm",
          syncMode === "disk"
            ? "border-status-active/30 bg-status-active/10 text-status-active"
            : "border-ghost-border bg-ghost-surface text-slate-300"
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          {syncMode === "disk" ? (
            <HardDrive className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Database className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="leading-6">
            {syncMode === "disk"
              ? "Running in disk sync mode. Files are read directly from the mounted workspace volume."
              : "Running in database sync mode. Files are stored in the database and synced to agents at runtime. For disk-based sync, set WORKSPACE_SYNC_MODE=disk and mount a shared volume."}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-ghost-border bg-ghost-surface p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total files</div>
            <div className="mt-2 text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-ghost-border bg-ghost-surface p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Hot</div>
            <div className="mt-2 text-2xl font-bold text-brand-primary">{stats.hot}</div>
          </div>
          <div className="rounded-2xl border border-ghost-border bg-ghost-surface p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Warm</div>
            <div className="mt-2 text-2xl font-bold text-brand-amber">{stats.warm}</div>
          </div>
          <div className="rounded-2xl border border-ghost-border bg-ghost-surface p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Cold</div>
            <div className="mt-2 text-2xl font-bold text-slate-300">{stats.cold}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ghost-border bg-ghost-surface p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>Pending sync</span>
            <Badge
              className={
                stats.pending > 0
                  ? "bg-brand-amber/15 text-brand-amber"
                  : "bg-status-active/15 text-status-active"
              }
            >
              {stats.pending}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <Rows3 className="mr-2 h-4 w-4" />
              List
            </Button>
            <Button
              type="button"
              variant={viewMode === "tree" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("tree")}
            >
              <TreePine className="mr-2 h-4 w-4" />
              Tree
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditorDoc(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New File
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-ghost-border bg-ghost-surface p-4">
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
              placeholder="Search file path or content"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              type="button"
              variant={selectedTier === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTier("all")}
            >
              All Tiers
            </Button>
            {MEMORY_TIER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={selectedTier === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTier(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <Button
              type="button"
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
            >
              All Categories
            </Button>
            {WORKSPACE_CATEGORY_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={selectedCategory === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="No workspace files yet"
          description="Create your first runtime document so agents have briefs, templates, and working context to use."
          action={
            <Button
              type="button"
              onClick={() => {
                setEditorDoc(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New File
            </Button>
          }
        />
      ) : viewMode === "list" ? (
        <div className="grid gap-3">
          {filteredDocuments.map((document) => (
            <WorkspaceDocCard
              key={document.id}
              doc={document}
              agent={document.agentId ? agentMap.get(document.agentId) ?? null : null}
              onEdit={(nextDocument) => {
                setEditorDoc(nextDocument);
                setEditorOpen(true);
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {treeGroups.map(([directory, group]) => (
            <section key={directory} className="space-y-3">
              <div className="font-mono text-sm text-slate-400">
                {directory === "root" ? "/" : directory}
              </div>
              <div className="grid gap-3">
                {group.map((document) => (
                  <WorkspaceDocCard
                    key={document.id}
                    doc={document}
                    agent={document.agentId ? agentMap.get(document.agentId) ?? null : null}
                    onEdit={(nextDocument) => {
                      setEditorDoc(nextDocument);
                      setEditorOpen(true);
                    }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editorOpen && selectedBusinessId ? (
        <WorkspaceFileEditor
          doc={editorDoc ?? undefined}
          businessId={selectedBusinessId}
          agents={agents}
          onClose={() => {
            setEditorOpen(false);
            setEditorDoc(null);
          }}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
