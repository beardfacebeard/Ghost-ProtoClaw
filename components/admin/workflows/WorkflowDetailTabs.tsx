"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { JsonViewer } from "@/components/admin/JsonViewer";
import { ApprovalModeBadge } from "@/components/admin/workflows/ApprovalModeBadge";
import { OutputBadge } from "@/components/admin/workflows/OutputBadge";
import { TriggerBadge } from "@/components/admin/workflows/TriggerBadge";
import {
  formatRunDuration,
  formatWorkflowDate,
  getRunStatusMeta
} from "@/components/admin/workflows/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { formatScheduleDisplay } from "@/lib/workflows/schedule-parser";
import { toast } from "@/components/ui/toast";

type WorkflowDetailTabsProps = {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    trigger: string;
    output: string;
    scheduleMode: string | null;
    frequency: string | null;
    timezone: string | null;
    cronExpression: string | null;
    approvalMode: string | null;
    safetyMode: string | null;
    actionType: string | null;
    runtimeJobId: string | null;
    business: { id: string; name: string } | null;
    agent: { id: string; displayName: string; emoji: string | null } | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  runs: Array<{
    id: string;
    status: string;
    action: string;
    reason: string | null;
    result: unknown;
    error: string | null;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
    createdAt: Date | string;
  }>;
  pendingApprovals: number;
  canRunNow: boolean;
  appUrl: string;
  initialWebhookEndpoint?: {
    id: string;
    provider: string;
    enabled: boolean;
    totalReceived: number;
    lastReceivedAt: Date | string | null;
    hasSecret: boolean;
  } | null;
  initialWebhookEvents?: Array<{
    id: string;
    eventType: string;
    verified: boolean;
    status: string;
    createdAt: Date | string;
    payload: unknown;
  }>;
};

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function WorkflowDetailTabs({
  workflow,
  runs,
  pendingApprovals,
  canRunNow,
  appUrl,
  initialWebhookEndpoint,
  initialWebhookEvents = []
}: WorkflowDetailTabsProps) {
  const router = useRouter();
  const [expandedRunId, setExpandedRunId] = useState<string>();
  const [payloadInput, setPayloadInput] = useState("");
  const [runResult, setRunResult] = useState<unknown>();
  const [running, setRunning] = useState(false);
  const [webhookEndpoint, setWebhookEndpoint] = useState(initialWebhookEndpoint);
  const [webhookEvents, setWebhookEvents] = useState(initialWebhookEvents);
  const [provider, setProvider] = useState(initialWebhookEndpoint?.provider || "generic");
  const [secretInput, setSecretInput] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [copied, setCopied] = useState(false);
  const webhookUrl = useMemo(
    () =>
      webhookEndpoint
        ? `${appUrl.replace(/\/$/, "")}/api/webhooks/${webhookEndpoint.id}`
        : "",
    [appUrl, webhookEndpoint]
  );

  async function refreshWebhookState() {
    const response = await fetch(`/api/admin/workflows/${workflow.id}/webhook`, {
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = (await response.json()) as {
      endpoint?: WorkflowDetailTabsProps["initialWebhookEndpoint"];
      recentEvents?: WorkflowDetailTabsProps["initialWebhookEvents"];
    };

    if (response.ok) {
      setWebhookEndpoint(payload.endpoint ?? null);
      setWebhookEvents(payload.recentEvents ?? []);
      setProvider(payload.endpoint?.provider || "generic");
    }
  }

  async function copyWebhookUrl() {
    if (!webhookUrl) {
      return;
    }

    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function generateSecret() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setSecretInput(
      Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  async function handleRunNow() {
    try {
      setRunning(true);

      const parsedPayload = payloadInput.trim()
        ? (JSON.parse(payloadInput) as Record<string, unknown>)
        : {};
      const response = await fetchWithCsrf(`/api/admin/workflows/${workflow.id}/run`, {
        method: "POST",
        body: JSON.stringify({
          payload: parsedPayload
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        requiresApproval?: boolean;
        approvalId?: string;
        run?: {
          result?: unknown;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to run workflow.");
      }

      if (payload.requiresApproval) {
        toast.success("Approval request created.");
        router.push(`/admin/approvals?approvalId=${payload.approvalId}`);
        return;
      }

      setRunResult(payload.run?.result ?? { message: "Workflow started." });
      toast.success("Workflow started.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to run workflow."
      );
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveWebhook() {
    try {
      setSavingWebhook(true);

      const response = await fetchWithCsrf(`/api/admin/workflows/${workflow.id}/webhook`, {
        method: "PATCH",
        body: JSON.stringify({
          provider,
          secret: secretInput.trim().length > 0 ? secretInput.trim() : undefined
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        endpoint?: {
          generatedSecret?: string;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save webhook settings.");
      }

      if (payload.endpoint?.generatedSecret) {
        setSecretInput(payload.endpoint.generatedSecret);
      }

      toast.success("Webhook settings saved.");
      await refreshWebhookState();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save webhook settings."
      );
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleTestWebhook() {
    try {
      if (!webhookUrl || !webhookEndpoint) {
        return;
      }

      if (webhookEndpoint.hasSecret && secretInput.trim().length === 0) {
        toast.error("Re-enter or generate the signing secret before testing this secured endpoint.");
        return;
      }

      const samplePayload = JSON.stringify({
        event: "mission_control.test",
        workflowId: workflow.id,
        businessId: workflow.business?.id,
        createdAt: new Date().toISOString()
      });
      const headers = new Headers({
        "Content-Type": "application/json"
      });

      if (secretInput.trim()) {
        if (provider === "stripe") {
          const timestamp = Math.floor(Date.now() / 1000);
          const signature = await hmacHex(
            secretInput.trim(),
            `${timestamp}.${samplePayload}`
          );
          headers.set("stripe-signature", `t=${timestamp},v1=${signature}`);
        } else if (provider === "github") {
          const signature = await hmacHex(secretInput.trim(), samplePayload);
          headers.set("x-hub-signature-256", `sha256=${signature}`);
          headers.set("x-github-event", "ping");
        } else {
          const signature = await hmacHex(secretInput.trim(), samplePayload);
          headers.set("x-signature", signature);
        }
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: samplePayload
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Webhook test failed.");
      }

      toast.success("Webhook test sent.");
      await refreshWebhookState();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Webhook test failed."
      );
    }
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="configuration">Configuration</TabsTrigger>
        <TabsTrigger value="runs">Runs</TabsTrigger>
        {workflow.trigger === "webhook" ? (
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <div className="space-y-4">
            <Card className="border-ghost-border bg-ghost-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-slate-300">
                {workflow.description || "No description set yet."}
              </CardContent>
            </Card>

            <Card className="border-ghost-border bg-ghost-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">Trigger Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex flex-wrap gap-2">
                  <TriggerBadge trigger={workflow.trigger} />
                  <OutputBadge output={workflow.output} />
                  <ApprovalModeBadge mode={workflow.approvalMode || "auto"} />
                </div>
                <div>{formatScheduleDisplay(workflow)}</div>
                {workflow.cronExpression ? (
                  <div className="rounded-xl border border-ghost-border bg-ghost-black px-4 py-3 font-mono text-xs text-slate-300">
                    {workflow.cronExpression}
                  </div>
                ) : null}
                {workflow.timezone ? (
                  <div className="text-xs text-slate-500">
                    Timezone: {workflow.timezone}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {canRunNow ? (
              <Card className="border-ghost-border bg-ghost-surface">
                <CardHeader>
                  <CardTitle className="text-base text-white">Run Now</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    rows={5}
                    value={payloadInput}
                    onChange={(event) => setPayloadInput(event.target.value)}
                    placeholder='Optional payload JSON, e.g. {"source":"dashboard"}'
                    className="font-mono text-sm"
                  />
                  <Button onClick={() => void handleRunNow()} disabled={running}>
                    {running ? "Running..." : "Run Workflow"}
                  </Button>
                  {runResult !== undefined ? <JsonViewer data={runResult} /> : null}
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-ghost-border bg-ghost-surface">
              <CardHeader>
                <CardTitle className="text-base text-white">Approval Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Pending approvals</span>
                  <Badge className="bg-brand-amber/15 text-brand-amber">
                    {pendingApprovals}
                  </Badge>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/admin/approvals?workflowId=${workflow.id}`}>
                    View approvals
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="configuration" className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-ghost-border bg-ghost-surface">
            <CardHeader>
              <CardTitle className="text-base text-white">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span>Business</span>
                <span>{workflow.business?.name || "Unknown business"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Agent</span>
                <span>
                  {workflow.agent
                    ? `${workflow.agent.emoji || "Agent"} ${workflow.agent.displayName}`
                    : "Any available agent"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Safety mode</span>
                <span>{workflow.safetyMode || "Business default"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-ghost-border bg-ghost-surface">
            <CardHeader>
              <CardTitle className="text-base text-white">Runtime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4">
                <span>Schedule</span>
                <span>{formatScheduleDisplay(workflow)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Action type</span>
                <span>{workflow.actionType || "Not set"}</span>
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Runtime Job ID
                </div>
                <div className="rounded-xl border border-ghost-border bg-ghost-black px-4 py-3 font-mono text-xs text-slate-300">
                  {workflow.runtimeJobId || "Not assigned"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="runs" className="space-y-4">
        {runs.length === 0 ? (
          <EmptyState
            icon={<Copy className="h-6 w-6" />}
            title="No runs yet"
            description="Run this workflow manually or wait for its trigger to fire to see run history."
          />
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const status = getRunStatusMeta(run.status);
              const expanded = expandedRunId === run.id;

              return (
                <Card key={run.id} className="border-ghost-border bg-ghost-surface">
                  <CardContent className="space-y-4 p-4">
                    <button
                      type="button"
                      className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
                      onClick={() =>
                        setExpandedRunId((current) =>
                          current === run.id ? undefined : run.id
                        )
                      }
                    >
                      <div className="grid gap-3 md:grid-cols-5 md:items-center md:gap-4">
                        <Badge className={status.className}>{status.label}</Badge>
                        <span className="text-sm text-slate-300">{run.action}</span>
                        <span className="text-sm text-slate-400">
                          {formatWorkflowDate(run.startedAt || run.createdAt)}
                        </span>
                        <span className="text-sm text-slate-400">
                          {formatRunDuration(run.startedAt, run.completedAt)}
                        </span>
                        <span className="line-clamp-1 text-sm text-slate-400">
                          {run.error || run.reason || "No summary"}
                        </span>
                      </div>
                    </button>

                    {expanded ? (
                      <JsonViewer
                        data={run.result || { error: run.error || "No result payload." }}
                        collapsed={false}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>
      {workflow.trigger === "webhook" ? (
        <TabsContent value="webhook" className="space-y-6">
          <Card className="border-ghost-border bg-ghost-surface">
            <CardHeader>
              <CardTitle className="text-base text-white">Webhook URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-ghost-border bg-ghost-black px-4 py-4 font-mono text-sm text-slate-300">
                {webhookUrl || "Webhook endpoint will appear after creation."}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyWebhookUrl()}
                  disabled={!webhookUrl}
                >
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied" : "Copy URL"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleTestWebhook()}
                  disabled={!webhookUrl}
                >
                  Test this URL
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-ghost-border bg-ghost-surface">
            <CardHeader>
              <CardTitle className="text-base text-white">Provider</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Generic</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="github">GitHub</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm leading-6 text-slate-400">
                {provider === "stripe"
                  ? "Use this URL in Stripe Dashboard -> Developers -> Webhooks."
                  : provider === "github"
                    ? "Add this URL in your repository Settings -> Webhooks."
                    : "POST JSON to this URL from any system."}
              </div>
            </CardContent>
          </Card>

          <Card className="border-ghost-border bg-ghost-surface">
            <CardHeader>
              <CardTitle className="text-base text-white">Signing Secret</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  className={
                    webhookEndpoint?.hasSecret
                      ? "bg-status-active/15 text-status-active"
                      : "bg-brand-amber/15 text-brand-amber"
                  }
                >
                  {webhookEndpoint?.hasSecret ? "Secured" : "Unsecured"}
                </Badge>
                <span className="text-sm text-slate-400">
                  {webhookEndpoint?.hasSecret
                    ? "A signing secret is configured."
                    : "This endpoint accepts requests without verification until you save a secret."}
                </span>
              </div>

              {!webhookEndpoint?.hasSecret ? (
                <div className="rounded-2xl border border-brand-amber/30 bg-brand-amber/10 px-4 py-4 text-sm leading-6 text-slate-200">
                  This endpoint accepts all requests without verification. Add a signing secret to secure it.
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="workflow-secret" className="text-sm text-white">
                  Signing Secret
                </Label>
                <div className="flex gap-3">
                  <Input
                    id="workflow-secret"
                    type={secretVisible ? "text" : "password"}
                    value={secretInput}
                    onChange={(event) => setSecretInput(event.target.value)}
                    placeholder={
                      webhookEndpoint?.hasSecret
                        ? "Re-enter or rotate the signing secret"
                        : "Paste or generate a signing secret"
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSecretVisible((current) => !current)}
                  >
                    {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={generateSecret}>
                  Generate
                </Button>
                <Button type="button" onClick={() => void handleSaveWebhook()} disabled={savingWebhook}>
                  {savingWebhook ? "Saving..." : "Save Secret"}
                </Button>
              </div>

              <div className="text-xs text-slate-500">
                Save this now - it won&apos;t be shown again after leaving this page.
              </div>
            </CardContent>
          </Card>

          <Card className="border-ghost-border bg-ghost-surface">
            <CardHeader>
              <CardTitle className="text-base text-white">Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              {webhookEvents.length === 0 ? (
                <EmptyState
                  icon={<Copy className="h-6 w-6" />}
                  title="No webhook events yet"
                  description="Send a test request or connect a provider to start seeing inbound events."
                  className="min-h-[180px]"
                />
              ) : (
                <div className="space-y-3">
                  {webhookEvents.map((event) => (
                    <Card key={event.id} className="border-ghost-border bg-ghost-raised/30">
                      <CardContent className="space-y-4 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {event.eventType}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatWorkflowDate(event.createdAt)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className={
                                event.verified
                                  ? "bg-status-active/15 text-status-active"
                                  : "bg-brand-amber/15 text-brand-amber"
                              }
                            >
                              {event.verified ? "Verified" : "Unverified"}
                            </Badge>
                            <Badge className={getRunStatusMeta(event.status).className}>
                              {event.status}
                            </Badge>
                          </div>
                        </div>
                        <JsonViewer data={event.payload} collapsed />
                      </CardContent>
                    </Card>
                  ))}
                  {webhookEndpoint?.id ? (
                    <Button asChild variant="outline">
                      <Link href={`/admin/logs?type=webhook&endpoint=${webhookEndpoint.id}`}>
                        View all events
                      </Link>
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
