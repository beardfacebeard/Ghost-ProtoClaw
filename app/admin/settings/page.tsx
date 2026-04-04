"use client";

import { useEffect, useState } from "react";
import {
  Save,
  User,
  Server,
  Brain,
  Key,
  Mail,
  HardDrive,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from "lucide-react";

import { ApiKeysSettings } from "@/components/admin/settings/ApiKeysSettings";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type ProfileData = {
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
};

type SystemConfig = {
  openclaw: {
    gatewayUrl: string | null;
    status: "connected" | "missing" | "partial";
    gatewayToken: string | null;
    webhookSecret: string | null;
    mirrorMode: string;
  };
  ai: {
    openrouter: { status: "connected" | "missing"; key: string | null };
    anthropic: { status: "connected" | "missing"; key: string | null };
    openai: { status: "connected" | "missing"; key: string | null };
    defaultModel: string | null;
  };
  email: {
    status: "connected" | "missing";
    key: string | null;
    fromEmail: string | null;
  };
  storage: {
    status: "connected" | "partial" | "missing";
    bucket: string | null;
    region: string | null;
  };
  app: {
    url: string | null;
    nodeEnv: string;
    seedOnStart: boolean;
  };
};

function StatusBadge({
  status = "missing"
}: {
  status?: "connected" | "missing" | "partial";
}) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </span>
    );
  }

  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Partial
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
      <XCircle className="h-3 w-3" />
      Not configured
    </span>
  );
}

function ConfigRow({
  label,
  value,
  hint
}: {
  label: string;
  value: string | null | undefined;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-40 shrink-0 text-sm text-slate-400">{label}</span>
      <span className="text-sm text-zinc-300">
        {value || (
          <span className="text-zinc-500">{hint || "Not set"}</span>
        )}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [system, setSystem] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    openrouter: { configured: boolean; source: "db" | "env" | "none" };
    openai: { configured: boolean; source: "db" | "env" | "none" };
    anthropic: { configured: boolean; source: "db" | "env" | "none" };
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch("/api/admin/settings", {
          credentials: "same-origin"
        });

        if (!profileRes.ok) {
          throw new Error("Failed to load profile.");
        }

        const data = (await profileRes.json()) as ProfileData & { organizationId?: string };
        setProfile(data);
        setDisplayName(data.displayName);
        setIsSuperAdmin(data.role === "super_admin");
        if (data.organizationId) {
          setOrganizationId(data.organizationId);
        }

        if (data.role === "super_admin") {
          const [systemRes, keysRes] = await Promise.all([
            fetch("/api/admin/settings/system", {
              credentials: "same-origin"
            }),
            fetch("/api/admin/settings/api-keys", {
              credentials: "same-origin"
            })
          ]);

          if (systemRes.ok) {
            setSystem(await systemRes.json());
          }

          if (keysRes.ok) {
            setApiKeyStatus(await keysRes.json());
          }
        }
      } catch {
        toast.error("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleSave() {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetchWithCsrf("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ displayName: displayName.trim() })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message ?? "Failed to update profile.");
      }

      toast.success("Your display name has been saved.");
      setProfile((prev) =>
        prev ? { ...prev, displayName: displayName.trim() } : prev
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your account and system configuration.
          </p>
        </div>
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasChanges = profile && displayName.trim() !== profile.displayName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your account and system configuration.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="api-keys">
              <Key className="mr-2 h-4 w-4" />
              API Keys
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="system">
              <Server className="mr-2 h-4 w-4" />
              System
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-ghost-border bg-ghost-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="h-5 w-5 text-brand-primary" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="displayName"
                  className="text-sm text-slate-300"
                >
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="max-w-md border-ghost-border bg-ghost-raised text-white placeholder:text-zinc-500 focus-visible:ring-brand-primary"
                />
                <p className="text-xs text-zinc-500">
                  This is the name shown in the sidebar and dashboard greeting.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Email</Label>
                <p className="text-sm text-zinc-400">
                  {profile?.email ?? "---"}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Role</Label>
                <p className="text-sm text-zinc-400">
                  {profile?.role === "super_admin" ? "Super Admin" : "Admin"}
                </p>
              </div>

              {profile?.createdAt ? (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">Member Since</Label>
                  <p className="text-sm text-zinc-400">
                    {new Date(profile.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </p>
                </div>
              ) : null}

              <div className="pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperAdmin && apiKeyStatus && (
          <TabsContent value="api-keys">
            <ApiKeysSettings
              initialKeys={apiKeyStatus}
              organizationId={organizationId}
            />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="system">
            <div className="space-y-4">
              {/* OpenClaw Runtime */}
              <Card className="border-ghost-border bg-ghost-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-brand-primary" />
                      OpenClaw Runtime
                    </span>
                    <StatusBadge status={system?.openclaw.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ConfigRow
                    label="Gateway URL"
                    value={system?.openclaw.gatewayUrl}
                    hint="Set OPENCLAW_GATEWAY_URL in your environment"
                  />
                  <ConfigRow
                    label="Gateway Token"
                    value={system?.openclaw.gatewayToken}
                    hint="Set OPENCLAW_GATEWAY_TOKEN for authenticated API calls"
                  />
                  <ConfigRow
                    label="Webhook Secret"
                    value={system?.openclaw.webhookSecret}
                  />
                  <ConfigRow
                    label="Mirror Mode"
                    value={system?.openclaw.mirrorMode}
                  />
                  {system?.openclaw.status === "missing" && (
                    <p className="mt-2 rounded-lg bg-amber-500/5 p-3 text-xs leading-5 text-amber-400">
                      OpenClaw is not connected. Set{" "}
                      <code className="rounded bg-ghost-raised px-1 py-0.5">
                        OPENCLAW_GATEWAY_URL
                      </code>{" "}
                      and{" "}
                      <code className="rounded bg-ghost-raised px-1 py-0.5">
                        OPENCLAW_GATEWAY_TOKEN
                      </code>{" "}
                      in your environment variables to connect your AI runtime.
                      If deployed on Railway, these are auto-configured.
                    </p>
                  )}
                  {system?.openclaw.status === "partial" && (
                    <p className="mt-2 rounded-lg bg-amber-500/5 p-3 text-xs leading-5 text-amber-400">
                      OpenClaw URL is set but the gateway token is missing. Set{" "}
                      <code className="rounded bg-ghost-raised px-1 py-0.5">
                        OPENCLAW_GATEWAY_TOKEN
                      </code>{" "}
                      to authenticate API calls. Without it, requests will be
                      rejected by the gateway.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* AI Providers */}
              <Card className="border-ghost-border bg-ghost-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Brain className="h-5 w-5 text-brand-primary" />
                    AI Providers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-ghost-raised/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        OpenRouter
                      </p>
                      <p className="text-xs text-zinc-500">
                        {system?.ai.openrouter.key || "Not configured"}
                      </p>
                    </div>
                    <StatusBadge
                      status={system?.ai.openrouter.status}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ghost-raised/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Anthropic
                      </p>
                      <p className="text-xs text-zinc-500">
                        {system?.ai.anthropic.key || "Optional"}
                      </p>
                    </div>
                    <StatusBadge
                      status={system?.ai.anthropic.status}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-ghost-raised/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">OpenAI</p>
                      <p className="text-xs text-zinc-500">
                        {system?.ai.openai.key || "Optional"}
                      </p>
                    </div>
                    <StatusBadge
                      status={system?.ai.openai.status}
                    />
                  </div>
                  <ConfigRow
                    label="Default Model"
                    value={system?.ai.defaultModel}
                    hint="Set MISSION_CONTROL_PROMPT_ASSIST_MODEL"
                  />
                </CardContent>
              </Card>

              {/* Email */}
              <Card className="border-ghost-border bg-ghost-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-brand-primary" />
                      Email (Resend)
                    </span>
                    <StatusBadge status={system?.email.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ConfigRow label="API Key" value={system?.email.key} />
                  <ConfigRow
                    label="From Email"
                    value={system?.email.fromEmail}
                    hint="Set RESEND_FROM_EMAIL (defaults to onboarding@resend.dev)"
                  />
                </CardContent>
              </Card>

              {/* Storage */}
              <Card className="border-ghost-border bg-ghost-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-brand-primary" />
                      Storage (S3)
                    </span>
                    <StatusBadge
                      status={system?.storage.status}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ConfigRow
                    label="Bucket"
                    value={system?.storage.bucket}
                    hint="Optional — set AWS_S3_BUCKET to enable file storage"
                  />
                  <ConfigRow label="Region" value={system?.storage.region} />
                </CardContent>
              </Card>

              {/* App Info */}
              <Card className="border-ghost-border bg-ghost-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Globe className="h-5 w-5 text-brand-primary" />
                    Application
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ConfigRow label="App URL" value={system?.app.url} />
                  <ConfigRow label="Environment" value={system?.app.nodeEnv} />
                  <ConfigRow
                    label="Auto-seed"
                    value={system ? (system.app.seedOnStart ? "Enabled" : "Disabled") : null}
                  />
                </CardContent>
              </Card>

              <Card className="border-ghost-border bg-ghost-surface">
                <CardContent className="py-4">
                  <p className="text-xs leading-5 text-zinc-500">
                    System settings are controlled by environment variables. To
                    change them, update your Railway service variables or your
                    local <code>.env</code> file and restart the application.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
