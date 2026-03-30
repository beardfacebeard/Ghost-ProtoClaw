"use client";

import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { WorkspaceDocCard } from "@/components/admin/workspace/WorkspaceDocCard";
import { Button } from "@/components/ui/button";

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

type BusinessWorkspaceSectionProps = {
  businessId: string;
  docs: WorkspaceDocumentRecord[];
  agents: Array<{
    id: string;
    displayName: string;
    emoji: string | null;
  }>;
};

export function BusinessWorkspaceSection({
  businessId,
  docs,
  agents
}: BusinessWorkspaceSectionProps) {
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen className="h-6 w-6" />}
        title="No workspace files yet"
        description="Create your first shared file so agents have a place for briefs, templates, and working notes."
        action={
          <Button asChild>
            <Link href={`/admin/workspace?businessId=${businessId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Add File
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <Link href={`/admin/workspace?businessId=${businessId}`}>
            <Plus className="mr-2 h-4 w-4" />
            Add File
          </Link>
        </Button>
      </div>

      <div className="grid gap-3">
        {docs.map((doc) => (
          <WorkspaceDocCard
            key={doc.id}
            doc={doc}
            compact
            agent={doc.agentId ? agentMap.get(doc.agentId) ?? null : null}
          />
        ))}
      </div>
    </div>
  );
}
