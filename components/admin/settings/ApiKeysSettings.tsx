"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Key
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type ProviderKey = "openrouter" | "openai" | "anthropic";

type KeyStatus = {
  configured: boolean;
  source: "db" | "env" | "none";
};

type ApiKeysSettingsProps = {
  initialKeys: {
    openrouter: KeyStatus;
    openai: KeyStatus;
    anthropic: KeyStatus;
  };
  organizationId: string;
};

type ProviderState = {
  apiKey: string;
  orgId?: string;
  visible: boolean;
  saving: boolean;
  testing: boolean;
  testResult: "success" | "error" | null;
};

const PROVIDER_META: Record<
  ProviderKey,
  {
    label: string;
    placeholder: string;
    description: string;
    docsUrl: string;
    docsLabel: string;
    hasOrgId?: boolean;
  }
> = {
  openrouter: {
    label: "OpenRouter",
    placeholder: "sk-or-v1-...",
    description:
      "OpenRouter gives you access to all AI models with a single key. This is all most users need.",
    docsUrl: "https://openrouter.ai/keys",
    docsLabel: "Get your key at openrouter.ai/keys"
  },
  openai: {
    label: "OpenAI",
    placeholder: "sk-...",
    description:
      "Connect your OpenAI key for direct GPT model access with lower latency.",
    docsUrl: "https://platform.openai.com/api-keys",
    docsLabel: "Get your key at platform.openai.com",
    hasOrgId: true
  },
  anthropic: {
    label: "Anthropic",
    placeholder: "sk-ant-...",
    description:
      "Connect your Anthropic key for direct Claude model access.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    docsLabel: "Get your key at console.anthropic.com"
  }
};

function StatusDot({ status }: { status: KeyStatus }) {
  if (!status.configured) return null;

  return (
    <Badge variant="active" className="gap-1">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
      {status.source === "env" ? "Set via environment" : "Configured"}
    </Badge>
  );
}

function ProviderCard({
  provider,
  status,
  state,
  onChange,
  onSave,
  onTest
}: {
  provider: ProviderKey;
  status: KeyStatus;
  state: ProviderState;
  onChange: (updates: Partial<ProviderState>) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  const meta = PROVIDER_META[provider];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ghost-raised">
              <Key className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-base">{meta.label}</CardTitle>
              <CardDescription>{meta.description}</CardDescription>
            </div>
          </div>
          <StatusDot status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">API Key</label>
          <div className="relative">
            <Input
              type={state.visible ? "text" : "password"}
              placeholder={meta.placeholder}
              value={state.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => onChange({ visible: !state.visible })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              {state.visible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {meta.hasOrgId && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Organization ID{" "}
              <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <Input
              type="text"
              placeholder="org-..."
              value={state.orgId ?? ""}
              onChange={(e) => onChange({ orgId: e.target.value })}
            />
          </div>
        )}

        <a
          href={meta.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:underline"
        >
          {meta.docsLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={onSave}
            disabled={state.saving || !state.apiKey.trim()}
            size="sm"
          >
            {state.saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={onTest}
            disabled={state.testing || !state.apiKey.trim()}
            size="sm"
          >
            {state.testing ? "Testing..." : "Test Connection"}
          </Button>

          {state.testResult === "success" && (
            <span className="inline-flex items-center gap-1 text-sm text-status-active">
              <Check className="h-4 w-4" />
              Connected
            </span>
          )}
          {state.testResult === "error" && (
            <span className="inline-flex items-center gap-1 text-sm text-status-error">
              <AlertCircle className="h-4 w-4" />
              Failed
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ApiKeysSettings({
  initialKeys,
  organizationId
}: ApiKeysSettingsProps) {
  const [advanced, setAdvanced] = useState(false);
  const [keyStatus, setKeyStatus] = useState(initialKeys);

  const [providers, setProviders] = useState<Record<ProviderKey, ProviderState>>(
    {
      openrouter: {
        apiKey: "",
        visible: false,
        saving: false,
        testing: false,
        testResult: null
      },
      openai: {
        apiKey: "",
        orgId: "",
        visible: false,
        saving: false,
        testing: false,
        testResult: null
      },
      anthropic: {
        apiKey: "",
        visible: false,
        saving: false,
        testing: false,
        testResult: null
      }
    }
  );

  const updateProvider = useCallback(
    (provider: ProviderKey, updates: Partial<ProviderState>) => {
      setProviders((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], ...updates }
      }));
    },
    []
  );

  const handleSave = useCallback(
    async (provider: ProviderKey) => {
      const state = providers[provider];
      const apiKey = state.apiKey.trim();

      if (!apiKey) return;

      updateProvider(provider, { saving: true, testResult: null });

      try {
        const body: Record<string, string> = { provider, apiKey };

        if (provider === "openai" && state.orgId?.trim()) {
          body.organizationId = state.orgId.trim();
        }

        const response = await fetchWithCsrf("/api/admin/settings/api-keys", {
          method: "POST",
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(data.message || "Failed to save API key.");
        }

        setKeyStatus((prev) => ({
          ...prev,
          [provider]: { configured: true, source: "db" as const }
        }));

        updateProvider(provider, { apiKey: "" });
        toast.success(
          `${PROVIDER_META[provider].label} API key saved successfully.`
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save API key."
        );
      } finally {
        updateProvider(provider, { saving: false });
      }
    },
    [providers, updateProvider]
  );

  const handleTest = useCallback(
    async (provider: ProviderKey) => {
      const state = providers[provider];
      const apiKey = state.apiKey.trim();

      if (!apiKey) return;

      updateProvider(provider, { testing: true, testResult: null });

      try {
        const body: Record<string, string> = { provider, apiKey };

        if (provider === "openai" && state.orgId?.trim()) {
          body.organizationId = state.orgId.trim();
        }

        const response = await fetchWithCsrf(
          "/api/admin/settings/api-keys/test",
          {
            method: "POST",
            body: JSON.stringify(body)
          }
        );

        const data = (await response.json()) as {
          success: boolean;
          message: string;
        };

        updateProvider(provider, {
          testResult: data.success ? "success" : "error"
        });

        if (data.success) {
          toast.success(data.message);
        } else {
          toast.error(data.message);
        }
      } catch {
        updateProvider(provider, { testResult: "error" });
        toast.error("Connection test failed. Please check your key.");
      } finally {
        updateProvider(provider, { testing: false });
      }
    },
    [providers, updateProvider]
  );

  const simpleProviders: ProviderKey[] = ["openrouter"];
  const advancedProviders: ProviderKey[] = [
    "openrouter",
    "openai",
    "anthropic"
  ];
  const visibleProviders = advanced ? advancedProviders : simpleProviders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">AI Provider Keys</h2>
          <p className="text-sm text-slate-400">
            Connect your AI provider API keys to power agent model calls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Advanced</span>
          <Switch checked={advanced} onCheckedChange={setAdvanced} />
        </div>
      </div>

      <div className="space-y-4">
        {visibleProviders.map((provider) => (
          <ProviderCard
            key={provider}
            provider={provider}
            status={keyStatus[provider]}
            state={providers[provider]}
            onChange={(updates) => updateProvider(provider, updates)}
            onSave={() => handleSave(provider)}
            onTest={() => handleTest(provider)}
          />
        ))}
      </div>

      {advanced && (
        <p className="text-xs text-slate-500">
          Direct provider keys are used first. OpenRouter is used as fallback
          when a direct key isn&apos;t set.
        </p>
      )}
    </div>
  );
}
