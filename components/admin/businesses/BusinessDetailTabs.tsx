"use client";

import Link from "next/link";
import { BookOpen, Bot, FolderOpen, GitBranch, Settings2 } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { formatRelativeTime } from "@/components/admin/ActivityFeed";
import { BusinessKnowledgeSection } from "@/components/admin/businesses/BusinessKnowledgeSection";
import { BusinessWorkspaceSection } from "@/components/admin/businesses/BusinessWorkspaceSection";
import {
  formatBusinessDate,
  getBusinessStatusMeta
} from "@/components/admin/businesses/utils";
import { getSafetyModeLabel } from "@/components/admin/businesses/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BusinessDetailTabsProps = {
  business: {
    id: string;
    name: string;
    slug: string;
    status: string;
    summary: string | null;
    brandVoice: string | null;
    mainGoals: string | null;
    coreOffers: string | null;
    offerAndAudienceNotes: string | null;
    systemPrompt: string | null;
    guardrails: string | null;
    bannedClaims: string | null;
    safetyMode: string | null;
    primaryModel: string | null;
    fallbackModel: string | null;
    modelSource: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  stats: {
    agentCount: number;
    workflowCount: number;
    activeWorkflows: number;
    knowledgeItems: number;
    workspaceDocuments: number;
    pendingApprovals: number;
    lastActivity: Date | null;
  };
  agents: Array<{
    id: string;
    displayName: string;
    emoji: string | null;
    role: string;
    status: string;
    type: string;
  }>;
  workflows: Array<{
    id: string;
    name: string;
    trigger: string;
    output: string;
    enabled: boolean;
  }>;
  knowledgeItems: Array<{
    id: string;
    businessId: string;
    content: string;
    title: string;
    category: string;
    sourceType: string;
    enabled: boolean;
    tokenCount: number | null;
    updatedAt: Date | string;
  }>;
  workspaceDocuments: Array<{
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
  }>;
};

function ReadOnlyBlock({
  label,
  value,
  expandable = false
}: {
  label: string;
  value: string | null | undefined;
  expandable?: boolean;
}) {
  return (
    <Card className="border-ghost-border bg-ghost-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-300">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {value ? (
          expandable ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-sm leading-6 text-slate-300 transition-colors group-open:text-white">
                <span className="line-clamp-3">{value}</span>
                <span className="mt-2 inline-block text-xs text-brand-primary">
                  Show more
                </span>
              </summary>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {value}
              </div>
            </details>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {value}
            </p>
          )
        ) : (
          <p className="text-sm italic text-slate-500">Not set yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function BusinessDetailTabs({
  business,
  stats,
  agents,
  workflows,
  knowledgeItems,
  workspaceDocuments
}: BusinessDetailTabsProps) {
  const status = getBusinessStatusMeta(business.status);

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="agents">Agents</TabsTrigger>
        <TabsTrigger value="workflows">Workflows</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        <TabsTrigger value="workspace">Workspace</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <div className="space-y-4">
            <ReadOnlyBlock label="Summary" value={business.summary} />
            <ReadOnlyBlock label="Brand Voice" value={business.brandVoice} />
            <ReadOnlyBlock label="Main Goals" value={business.mainGoals} />
            <ReadOnlyBlock label="Core Offers" value={business.coreOffers} />

            <Card className="border-ghost-border bg-ghost-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  AI Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReadOnlyBlock
                  label="System Prompt"
                  value={business.systemPrompt}
                  expandable
                />
                <ReadOnlyBlock
                  label="Guardrails"
                  value={business.guardrails}
                  expandable
                />
                <ReadOnlyBlock
                  label="Banned Claims"
                  value={business.bannedClaims}
                  expandable
                />
                <ReadOnlyBlock
                  label="Offer and Audience Notes"
                  value={business.offerAndAudienceNotes}
                  expandable
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadOnlyBlock
                    label="Safety Mode"
                    value={getSafetyModeLabel(business.safetyMode)}
                  />
                  <ReadOnlyBlock
                    label="Primary Model"
                    value={business.primaryModel || "System default"}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-ghost-border bg-ghost-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Business Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-400">
                <div className="flex items-center justify-between gap-4">
                  <span>Status</span>
                  <Badge className={status.className}>{status.label}</Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Created</span>
                  <span>{formatBusinessDate(business.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Last updated</span>
                  <span>{formatBusinessDate(business.updatedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Slug</span>
                  <span className="font-mono text-xs text-slate-300">
                    {business.slug}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Last activity</span>
                  <span>
                    {stats.lastActivity
                      ? formatRelativeTime(stats.lastActivity)
                      : "No activity yet"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-ghost-border bg-ghost-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild variant="outline" className="justify-start">
                  <Link href={`/admin/agents/create?businessId=${business.id}`}>
                    Create Agent
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href={`/admin/workflows/create?businessId=${business.id}`}>
                    Create Workflow
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <Link href={`/admin/logs?businessId=${business.id}`}>
                    View Logs
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="agents">
        {agents.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title="No agents yet"
            description="This business does not have any agents yet."
            action={
              <Button asChild>
                <Link href={`/admin/agents/create?businessId=${business.id}`}>
                  Add Agent
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="border-ghost-border bg-ghost-surface">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ghost-raised text-xl">
                      {agent.emoji || "🤖"}
                    </div>
                    <div>
                      <Link
                        href={`/admin/agents/${agent.id}`}
                        className="text-sm font-semibold text-white hover:underline"
                      >
                        {agent.displayName}
                      </Link>
                      <div className="text-sm text-slate-400">{agent.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={
                          agent.status === "active"
                            ? "bg-status-active text-white"
                            : agent.status === "warning"
                              ? "bg-brand-amber text-ghost-black"
                              : "bg-ghost-raised text-slate-300"
                        }
                      >
                        {agent.status}
                      </Badge>
                      <Badge className="bg-ghost-raised text-slate-300">
                        {agent.type}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/agents/${agent.id}`}>View</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/agents/${agent.id}/edit`}>Edit</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="workflows">
        {workflows.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="h-6 w-6" />}
            title="No workflows yet"
            description="This business does not have any workflows yet."
            action={
              <Button asChild>
                <Link href={`/admin/workflows/create?businessId=${business.id}`}>
                  Add Workflow
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {workflows.map((workflow) => (
              <Card
                key={workflow.id}
                className="border-ghost-border bg-ghost-surface"
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-white">
                      {workflow.name}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge className="bg-ghost-raised text-slate-300">
                        {workflow.trigger}
                      </Badge>
                      <Badge className="bg-ghost-raised text-slate-300">
                        {workflow.output}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <span>{workflow.enabled ? "Enabled" : "Disabled"}</span>
                    <Switch checked={workflow.enabled} disabled />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="knowledge">
        <BusinessKnowledgeSection businessId={business.id} items={knowledgeItems} />
      </TabsContent>

      <TabsContent value="workspace">
        {workspaceDocuments.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-6 w-6" />}
            title="No workspace files yet"
            description="This business does not have any shared runtime files yet."
            action={
              <Button asChild>
                <Link href={`/admin/workspace?businessId=${business.id}`}>
                  Add File
                </Link>
              </Button>
            }
          />
        ) : (
          <BusinessWorkspaceSection
            businessId={business.id}
            docs={workspaceDocuments}
            agents={agents}
          />
        )}
      </TabsContent>

      <TabsContent value="settings">
        <div className="grid gap-4 xl:grid-cols-2">
          <ReadOnlyBlock label="Status" value={status.label} />
          <ReadOnlyBlock label="Safety Mode" value={getSafetyModeLabel(business.safetyMode)} />
          <ReadOnlyBlock
            label="Primary Model"
            value={business.primaryModel || "System default"}
          />
          <ReadOnlyBlock
            label="Fallback Model"
            value={business.fallbackModel || "Not set"}
          />
          <ReadOnlyBlock
            label="Model Source"
            value={business.modelSource || "system"}
          />
          <Card className="border-ghost-border bg-ghost-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Settings2 className="h-4 w-4 text-brand-cyan" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-400">
              <div className="flex items-center justify-between">
                <span>Workspace documents</span>
                <span className="text-slate-300">{stats.workspaceDocuments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending approvals</span>
                <span className="text-slate-300">{stats.pendingApprovals}</span>
              </div>
              <Button asChild className="w-full">
                <Link href={`/admin/businesses/${business.id}/edit`}>
                  Edit Business
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
