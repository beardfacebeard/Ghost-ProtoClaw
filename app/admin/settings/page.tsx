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
  status = "missing",
  optionalLabel
}: {
  status?: "connected" | "missing" | "partial";
  optionalLabel?: string;
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

  if (optionalLabel) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-ink-muted">
        {optionalLabel}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
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
      <span className="w-40 shrink-0 text-sm text-ink-secondary">{label}</span>
      <span className="text-sm text-ink-primary">
        {value || (
          <span className="text-ink-muted">{hint || "Not set"}</span>
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
          <p className="mt-1 text-sm text-ink-secondary">
            Manage your account and system configuration.
          </p>
        </div>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-steel border-t-transparent" />
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
        <p className="mt-1 text-sm text-ink-secondary">
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
          <Card className="border-line-subtle bg-bg-surface">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="h-5 w-5 text-steel-bright" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="displayName"
                  className="text-sm text-ink-primary"
                >
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="max-w-md border-line-subtle bg-bg-surface-2 text-white placeholder:text-ink-muted focus-visible:ring-brand-primary"
                />
                <p className="text-xs text-ink-muted">
                  This is the name shown in the sidebar and dashboard greeting.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-ink-primary">Email</Label>
                <p className="text-sm text-ink-secondary">
                  {profile?.email ?? "---"}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-ink-primary">Role</Label>
                <p className="text-sm text-ink-secondary">
                  {profile?.role === "super_admin" ? "Super Admin" : "Admin"}
                </p>
              </div>

              {profile?.createdAt ? (
                <div className="space-y-2">
                  <Label className="text-sm text-ink-primary">Member Since</Label>
                  <p className="text-sm text-ink-secondary">
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
                  className="bg-steel text-white hover:bg-steel/90 disabled:opacity-50"
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
              {/* AI Providers — moved to the top since this is what users care about */}
              <Card className="border-line-subtle bg-bg-surface">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Brain className="h-5 w-5 text-steel-bright" />
                    AI Providers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs leading-5 text-ink-secondary">
                    Your agents use AI providers to generate responses. Only an
                    OpenRouter key is required — it gives access to all models.
                    Direct Anthropic and OpenAI keys are optional and only needed
                    if you prefer to call those providers without a middleman.
                  </p>
                  <div className="flex items-center justify-between rounded-lg bg-bg-surface-2/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        OpenRouter
                      </p>
                      <p className="text-xs text-ink-muted">
                        {system?.ai.openrouter.key ||
                          (system?.ai.openrouter.status === "connected"
                            ? "Connected"
                            : "Add your key in the API Keys tab")}
                      </p>
                    </div>
                    <StatusBadge
                      status={system?.ai.openrouter.status}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-bg-surface-2/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Anthropic
                      </p>
                      <p className="text-xs text-ink-muted">
                        {system?.ai.anthropic.key || "Optional — not required if using OpenRouter"}
                      </p>
                    </div>
                    <StatusBadge
                      status={system?.ai.anthropic.status}
                      optionalLabel={system?.ai.anthropic.status === "missing" ? "Optional" : undefined}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-bg-surface-2/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">OpenAI</p>
                      <p className="text-xs text-ink-muted">
                        {system?.ai.openai.key || "Optional — not required if using OpenRouter"}
                      </p>
                    </div>
                    <StatusBadge
                      status={system?.ai.openai.status}
                      optionalLabel={system?.ai.openai.status === "missing" ? "Optional" : undefined}
                    />
                  </div>
                  <ConfigRow
                    label="Default Model"
                    value={system?.ai.defaultModel}
                    hint="Uses system default"
                  />
                </CardContent>
              </Card>

              {/* Email */}
              <Card className="border-line-subtle bg-bg-surface">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-steel-bright" />
                      Email (Resend)
                    </span>
                    <StatusBadge
                      status={system?.email.status}
                      optionalLabel={system?.email.status === "missing" ? "Optional" : undefined}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ConfigRow label="API Key" value={system?.email.key} hint="Not set up yet" />
                  <ConfigRow
                    label="From Email"
                    value={system?.email.fromEmail}
                    hint="Will use default when configured"
                  />
                </CardContent>
              </Card>

              {/* Storage */}
              <Card className="border-line-subtle bg-bg-surface">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-steel-bright" />
                      Storage (S3)
                    </span>
                    <StatusBadge
                      status={system?.storage.status}
                      optionalLabel={system?.storage.status === "missing" ? "Optional" : undefined}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ConfigRow
                    label="Bucket"
                    value={system?.storage.bucket}
                    hint="Optional — enable when you need file uploads"
                  />
                  <ConfigRow label="Region" value={system?.storage.region} />
                </CardContent>
              </Card>

              {/* App Info */}
              <Card className="border-line-subtle bg-bg-surface">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Globe className="h-5 w-5 text-steel-bright" />
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

              {/* OpenClaw Runtime — moved to bottom, shown as advanced/optional */}
              <Card className="border-line-subtle bg-bg-surface">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-2">
                      <Server className="h-5 w-5 text-ink-muted" />
                      <span className="text-ink-secondary">Advanced: OpenClaw Runtime</span>
                    </span>
                    {system?.openclaw.status === "connected" ? (
                      <StatusBadge status="connected" />
                    ) : (
                      <StatusBadge optionalLabel="Not needed yet" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs leading-5 text-ink-muted">
                    OpenClaw is an optional AI gateway for advanced features like
                    tool invocation, workflow hooks, and agent orchestration. Your
                    agents work without it — they connect directly to AI providers
                    using your API keys above.
                  </p>
                  {system?.openclaw.status === "connected" && (
                    <>
                      <ConfigRow
                        label="Gateway URL"
                        value={system?.openclaw.gatewayUrl}
                      />
                      <ConfigRow
                        label="Gateway Token"
                        value={system?.openclaw.gatewayToken}
                      />
                      <ConfigRow
                        label="Webhook Secret"
                        value={system?.openclaw.webhookSecret}
                      />
                      <ConfigRow
                        label="Mirror Mode"
                        value={system?.openclaw.mirrorMode}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-line-subtle bg-bg-surface">
                <CardContent className="py-4">
                  <p className="text-xs leading-5 text-ink-muted">
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
