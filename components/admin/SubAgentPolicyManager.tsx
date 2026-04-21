"use client";

import { useState } from "react";
import { AlertTriangle, Bot, Shield, Loader2 } from "lucide-react";
import type { SubAgentPolicy } from "@/lib/sub-agent-policy";
import { Card, CardContent } from "@/components/ui/card";

type SubAgentPolicyManagerProps = {
  businessId: string;
  businessName: string;
  initialPolicy: SubAgentPolicy;
  hardLimits: {
    maxDepth: number;
    maxChildrenPerAgent: number;
    maxSubAgentsPerBusiness: number;
  };
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export default function SubAgentPolicyManager({
  businessId,
  businessName,
  initialPolicy,
  hardLimits,
}: SubAgentPolicyManagerProps) {
  const [policy, setPolicy] = useState<SubAgentPolicy>(initialPolicy);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  function updateField<K extends keyof SubAgentPolicy>(
    key: K,
    value: SubAgentPolicy[K]
  ) {
    setPolicy((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaveState({ kind: "saving" });

    try {
      const response = await fetch(`/api/admin/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            subAgents: {
              enabled: policy.enabled,
              maxDepth: policy.maxDepth,
              maxChildrenPerAgent: policy.maxChildrenPerAgent,
              maxSubAgentsPerBusiness: policy.maxSubAgentsPerBusiness,
              defaultModelStrategy: policy.defaultModelStrategy,
              requireHumanApproval: policy.requireHumanApproval,
              allowRecursiveSpawning: policy.allowRecursiveSpawning,
              autoDisableAfterMinutes: policy.autoDisableAfterMinutes,
            },
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `Save failed (${response.status})`
        );
      }

      setSaveState({ kind: "saved" });
      setTimeout(() => setSaveState({ kind: "idle" }), 2000);
    } catch (error) {
      setSaveState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <Card className="rounded-xl border-line-subtle bg-bg-surface">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-state-warning" />
            <div>
              <p className="text-sm font-semibold text-white">
                Sub-Agent Spawning
              </p>
              <p className="mt-1 text-sm text-ink-secondary">
                Allow agents in {businessName} to programmatically create child
                agents for delegated tasks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateField("enabled", !policy.enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              policy.enabled ? "bg-emerald-500" : "bg-bg-surface-2"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                policy.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </CardContent>
      </Card>

      {!policy.enabled && (
        <Card className="rounded-xl border-line-subtle bg-bg-surface">
          <CardContent className="p-5">
            <p className="text-sm text-ink-secondary">
              Sub-agent spawning is disabled. Enable the toggle above to
              configure safety limits and allow agents to create specialized
              child agents.
            </p>
          </CardContent>
        </Card>
      )}

      {policy.enabled && (
        <>
          {/* Safety warning */}
          <div className="rounded-xl border border-state-warning/20 bg-state-warning/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-state-warning" />
              <div className="text-sm text-ink-primary">
                <p className="font-semibold text-white">Safety Limits Active</p>
                <p className="mt-1">
                  Sub-agents are constrained by hard limits that cannot be
                  overridden: max depth {hardLimits.maxDepth}, max{" "}
                  {hardLimits.maxChildrenPerAgent} children per agent, max{" "}
                  {hardLimits.maxSubAgentsPerBusiness} total per business.
                </p>
              </div>
            </div>
          </div>

          {/* Numeric limits */}
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                {
                  label: "Max Nesting Depth",
                  key: "maxDepth" as const,
                  hardLimit: hardLimits.maxDepth,
                },
                {
                  label: "Max Children per Agent",
                  key: "maxChildrenPerAgent" as const,
                  hardLimit: hardLimits.maxChildrenPerAgent,
                },
                {
                  label: "Max Sub-Agents per Business",
                  key: "maxSubAgentsPerBusiness" as const,
                  hardLimit: hardLimits.maxSubAgentsPerBusiness,
                },
              ] as const
            ).map(({ label, key, hardLimit }) => (
              <Card
                key={key}
                className="rounded-xl border-line-subtle bg-bg-surface"
              >
                <CardContent className="p-5">
                  <label className="block text-xs uppercase tracking-wider text-ink-secondary">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={hardLimit}
                    value={policy[key]}
                    onChange={(e) =>
                      updateField(
                        key,
                        Math.min(Number(e.target.value) || 1, hardLimit)
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-line-subtle bg-bg-surface-2 px-3 py-2 text-sm text-white"
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    Hard limit: {hardLimit}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Policy toggles */}
          <div className="space-y-3">
            {(
              [
                {
                  key: "requireHumanApproval" as const,
                  title: "Require Human Approval",
                  desc: "An admin must approve each sub-agent creation before it takes effect.",
                },
                {
                  key: "allowRecursiveSpawning" as const,
                  title: "Allow Recursive Spawning",
                  desc: "Sub-agents can themselves spawn further sub-agents (up to the depth limit).",
                },
              ] as const
            ).map(({ key, title, desc }) => (
              <Card
                key={key}
                className="rounded-xl border-line-subtle bg-bg-surface"
              >
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm text-ink-secondary">{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateField(key, !policy[key])
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      policy[key] ? "bg-emerald-500" : "bg-bg-surface-2"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        policy[key] ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Model strategy */}
          <Card className="rounded-xl border-line-subtle bg-bg-surface">
            <CardContent className="p-5">
              <label className="block text-xs uppercase tracking-wider text-ink-secondary">
                Default Model Strategy for Sub-Agents
              </label>
              <div className="mt-3 flex gap-3">
                {(["cheapest", "inherit"] as const).map((strategy) => (
                  <button
                    key={strategy}
                    type="button"
                    onClick={() =>
                      updateField("defaultModelStrategy", strategy)
                    }
                    className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                      policy.defaultModelStrategy === strategy
                        ? "border-state-warning bg-state-warning/10 text-white"
                        : "border-line-subtle bg-bg-surface-2 text-ink-secondary hover:text-white"
                    }`}
                  >
                    {strategy === "cheapest"
                      ? "Use Cheapest Model"
                      : "Inherit Parent Model"}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Auto-disable */}
          <Card className="rounded-xl border-line-subtle bg-bg-surface">
            <CardContent className="p-5">
              <label className="block text-xs uppercase tracking-wider text-ink-secondary">
                Auto-Disable After Inactivity (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={1440}
                value={policy.autoDisableAfterMinutes}
                onChange={(e) =>
                  updateField(
                    "autoDisableAfterMinutes",
                    Math.min(Number(e.target.value) || 0, 1440)
                  )
                }
                className="mt-2 w-full max-w-[200px] rounded-lg border border-line-subtle bg-bg-surface-2 px-3 py-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Set to 0 to never auto-disable. Maximum 1440 (24 hours).
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState.kind === "saving"}
          className="inline-flex items-center gap-2 rounded-lg border border-state-warning bg-state-warning/10 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-state-warning/20 disabled:opacity-50"
        >
          {saveState.kind === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Save Sub-Agent Policy
            </>
          )}
        </button>
        {saveState.kind === "saved" && (
          <p className="text-sm text-emerald-400">Policy saved.</p>
        )}
        {saveState.kind === "error" && (
          <p className="text-sm text-red-400">{saveState.message}</p>
        )}
      </div>
    </div>
  );
}
