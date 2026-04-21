import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSystemDefaultModel, resolveAgentModel } from "@/lib/models/agent-models";
import { cn } from "@/lib/utils";

import {
  formatModelName,
  getModelSourceMeta,
  getSafetyModeLabel
} from "@/components/admin/agents/utils";

type ModelCarrier = {
  primaryModel?: string | null;
  fallbackModel?: string | null;
  safetyMode?: string | null;
};

type ModelInheritanceDisplayProps = {
  agent: ModelCarrier;
  business: ModelCarrier | null;
  systemDefault: string;
  compact?: boolean;
};

function resolveSafetyMode(agent: ModelCarrier, business: ModelCarrier | null) {
  if (agent.safetyMode) {
    return {
      value: agent.safetyMode,
      source: "agent" as const
    };
  }

  if (business?.safetyMode) {
    return {
      value: business.safetyMode,
      source: "business" as const
    };
  }

  return {
    value: "ask_before_acting",
    source: "system" as const
  };
}

function ChainRow({
  index,
  label,
  value,
  active
}: {
  index: number;
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm",
        active
          ? "border-steel/40 bg-steel/10"
          : "border-line-subtle bg-bg-surface-2/40"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-app text-xs text-ink-secondary">
          {index}
        </div>
        <span className="text-ink-primary">{label}</span>
      </div>
      <span className="font-mono text-xs text-white">{value}</span>
    </div>
  );
}

export function ModelInheritanceDisplay({
  agent,
  business,
  systemDefault,
  compact = false
}: ModelInheritanceDisplayProps) {
  const resolved = resolveAgentModel(
    agent,
    business,
    systemDefault || getSystemDefaultModel()
  );
  const primarySource = getModelSourceMeta(resolved.source);
  const fallbackSource = getModelSourceMeta(resolved.fallbackSource);
  const resolvedSafetyMode = resolveSafetyMode(agent, business);
  const safetySource = getModelSourceMeta(resolvedSafetyMode.source);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-bg-surface-2/60 px-3 py-1 text-xs text-ink-primary">
        <span className="font-medium text-white">
          {formatModelName(resolved.model)}
        </span>
        <span className="text-ink-muted">·</span>
        <span>{primarySource.icon}</span>
        <span>{primarySource.label} default</span>
      </div>
    );
  }

  return (
    <Card className="border-line-subtle bg-bg-surface">
      <CardHeader>
        <CardTitle className="text-base text-white">
          Model Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <ChainRow
            index={1}
            label="This Agent"
            value={agent.primaryModel || "Not set"}
            active={resolved.source === "agent"}
          />
          <ChainRow
            index={2}
            label="Business"
            value={business?.primaryModel || "Not set"}
            active={resolved.source === "business"}
          />
          <ChainRow
            index={3}
            label="System Default"
            value={systemDefault}
            active={resolved.source === "system"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line-subtle bg-bg-surface-2/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              Primary Model
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {formatModelName(resolved.model)}
            </div>
            <Badge className={cn("mt-3", primarySource.badgeClassName)}>
              {primarySource.icon} {primarySource.label} default
            </Badge>
          </div>

          <div className="rounded-xl border border-line-subtle bg-bg-surface-2/40 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              Fallback Model
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {formatModelName(resolved.fallbackModel)}
            </div>
            <Badge className={cn("mt-3", fallbackSource.badgeClassName)}>
              {fallbackSource.icon} {fallbackSource.label} default
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-line-subtle bg-bg-surface-2/40 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">
            Safety Mode
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {getSafetyModeLabel(resolvedSafetyMode.value)}
          </div>
          <Badge className={cn("mt-3", safetySource.badgeClassName)}>
            {safetySource.icon} {safetySource.label} setting
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
