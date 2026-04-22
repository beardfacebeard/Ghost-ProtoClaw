"use client";

import Link from "next/link";
import { BookOpen, Bot, FolderOpen, GitBranch, Settings2 } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { formatRelativeTime } from "@/components/admin/ActivityFeed";
import { BusinessKnowledgeSection } from "@/components/admin/businesses/BusinessKnowledgeSection";
import { BusinessWorkspaceSection } from "@/components/admin/businesses/BusinessWorkspaceSection";
import { DealhawkDashboardPanel } from "@/components/admin/businesses/DealhawkDashboardPanel";
import { DealhawkDeskPanel } from "@/components/admin/businesses/DealhawkDeskPanel";
import { DealhawkPipelinePanel } from "@/components/admin/businesses/DealhawkPipelinePanel";
import { ForexDeskPanel } from "@/components/admin/businesses/ForexDeskPanel";
import { TemplateDashboardPanel } from "@/components/admin/businesses/TemplateDashboardPanel";
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
    jurisdiction?: string | null;
    tradingMode?: string | null;
    dealMode?: string | null;
    tcpaAttestedAt?: Date | string | null;
    tcpaAttestedBy?: string | null;
    // The config JSON carries templateId (set at creation time) which we use
    // to scope template-specific UI to the right businesses.
    config?: unknown;
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
    <Card className="border-line-subtle bg-bg-surface">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-ink-primary">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {value ? (
          expandable ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-sm leading-6 text-ink-primary transition-colors group-open:text-white">
                <span className="line-clamp-3">{value}</span>
                <span className="mt-2 inline-block text-xs text-steel-bright">
                  Show more
                </span>
              </summary>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-primary">
                {value}
              </div>
            </details>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6 text-ink-primary">
              {value}
            </p>
          )
        ) : (
          <p className="text-sm italic text-ink-muted">Not set yet.</p>
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

  // Detect Forex Research & Execution Desk businesses so we can surface the
  // trading-mode panel. The config blob carries templateId at creation time.
  const templateId =
    business.config &&
    typeof business.config === "object" &&
    !Array.isArray(business.config) &&
    typeof (business.config as { templateId?: unknown }).templateId === "string"
      ? ((business.config as { templateId: string }).templateId)
      : null;
  const isForexDesk = templateId === "forex_trading_desk";
  const isDealhawkDesk = templateId === "dealhawk_empire";
  // Specialty templates that get the generic TemplateDashboardPanel.
  // Dealhawk has its own pipeline-powered dashboard; the other four get the
  // shared aggregator panel wired to /api/admin/businesses/[id]/dashboard.
  const showGenericDashboard =
    templateId === "ghost_operator" ||
    templateId === "tiktok_shop" ||
    templateId === "faceless_youtube" ||
    templateId === "forex_trading_desk";

  const dealMode = (business.dealMode ?? "research") as
    | "research"
    | "outreach"
    | "contract";
  const tcpaAttestedAt =
    business.tcpaAttestedAt instanceof Date
      ? business.tcpaAttestedAt.toISOString()
      : business.tcpaAttestedAt ?? null;

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {isDealhawkDesk || showGenericDashboard ? (
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        ) : null}
        {isDealhawkDesk ? (
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        ) : null}
        <TabsTrigger value="agents">Agents</TabsTrigger>
        <TabsTrigger value="workflows">Workflows</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
        <TabsTrigger value="workspace">Workspace</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {isForexDesk ? (
          <ForexDeskPanel
            businessId={business.id}
            tradingMode={business.tradingMode ?? "research"}
            jurisdiction={business.jurisdiction ?? null}
          />
        ) : null}

        {isDealhawkDesk ? (
          <DealhawkDeskPanel
            businessId={business.id}
            dealMode={dealMode}
            tcpaAttestedAt={tcpaAttestedAt}
            tcpaAttestedBy={business.tcpaAttestedBy ?? null}
          />
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <div className="space-y-4">
            <ReadOnlyBlock label="Summary" value={business.summary} />
            <ReadOnlyBlock label="Brand Voice" value={business.brandVoice} />
            <ReadOnlyBlock label="Main Goals" value={business.mainGoals} />
            <ReadOnlyBlock label="Core Offers" value={business.coreOffers} />

            <Card className="border-line-subtle bg-bg-surface">
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
            <Card className="border-line-subtle bg-bg-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">
                  Business Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-ink-secondary">
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
                  <span className="font-mono text-xs text-ink-primary">
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

            <Card className="border-line-subtle bg-bg-surface">
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

      {isDealhawkDesk ? (
        <TabsContent value="dashboard" className="space-y-6">
          <DealhawkDashboardPanel businessId={business.id} />
        </TabsContent>
      ) : showGenericDashboard ? (
        <TabsContent value="dashboard" className="space-y-6">
          <TemplateDashboardPanel businessId={business.id} />
        </TabsContent>
      ) : null}

      {isDealhawkDesk ? (
        <TabsContent value="pipeline" className="space-y-6">
          <DealhawkPipelinePanel businessId={business.id} />
        </TabsContent>
      ) : null}

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
              <Card key={agent.id} className="border-line-subtle bg-bg-surface">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg-surface-2 text-xl">
                      {agent.emoji || "🤖"}
                    </div>
                    <div>
                      <Link
                        href={`/admin/agents/${agent.id}`}
                        className="text-sm font-semibold text-white hover:underline"
                      >
                        {agent.displayName}
                      </Link>
                      <div className="text-sm text-ink-secondary">{agent.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={
                          agent.status === "active"
                            ? "bg-state-success text-white"
                            : agent.status === "paused"
                              ? "bg-blue-400 text-white"
                              : agent.status === "warning"
                                ? "bg-state-warning text-bg-app"
                                : "bg-bg-surface-2 text-ink-primary"
                        }
                      >
                        {agent.status}
                      </Badge>
                      <Badge className="bg-bg-surface-2 text-ink-primary">
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
                className="border-line-subtle bg-bg-surface"
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-white">
                      {workflow.name}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge className="bg-bg-surface-2 text-ink-primary">
                        {workflow.trigger}
                      </Badge>
                      <Badge className="bg-bg-surface-2 text-ink-primary">
                        {workflow.output}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-ink-secondary">
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
          <Card className="border-line-subtle bg-bg-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Settings2 className="h-4 w-4 text-steel-bright" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-ink-secondary">
              <div className="flex items-center justify-between">
                <span>Workspace documents</span>
                <span className="text-ink-primary">{stats.workspaceDocuments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending approvals</span>
                <span className="text-ink-primary">{stats.pendingApprovals}</span>
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
