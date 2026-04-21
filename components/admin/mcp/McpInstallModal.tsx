"use client";

import { useEffect, useMemo, useState } from "react";

import type { McpDefinition } from "@/lib/integrations/mcp-definitions";
import type { SafeIntegrationPayload, SafeMcpServerPayload } from "@/lib/integrations/safe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type McpInstallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definitions: McpDefinition[];
  businesses: Array<{ id: string; name: string }>;
  integrations: SafeIntegrationPayload[];
  sessionRole: "super_admin" | "admin";
  server?: SafeMcpServerPayload | null;
  initialDefinitionId?: string | null;
  onInstall: (payload: {
    definitionId: string;
    name: string;
    businessId?: string;
    config: Record<string, string>;
    secrets: Record<string, string>;
    serverId?: string;
  }) => Promise<void>;
};

function readStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function prettifyLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (part) => part.toUpperCase());
}

export function McpInstallModal({
  open,
  onOpenChange,
  definitions,
  businesses,
  integrations,
  sessionRole,
  server,
  initialDefinitionId,
  onInstall
}: McpInstallModalProps) {
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [businessChoice, setBusinessChoice] = useState("__org__");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedDefinition = useMemo(
    () =>
      definitions.find(
        (definition) =>
          definition.id === (server?.definitionId || selectedDefinitionId || initialDefinitionId)
      ) || null,
    [definitions, initialDefinitionId, selectedDefinitionId, server?.definitionId]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const existingConfig = readStringRecord(server?.config);
    setSelectedDefinitionId(server?.definitionId || initialDefinitionId || null);
    setName(server?.name || "");
    setBusinessChoice(server?.businessId || (sessionRole === "super_admin" ? "__org__" : businesses[0]?.id || ""));
    setConfig(existingConfig);
    setSecrets({});
    setShowSecrets({});
    setError(null);
  }, [businesses, initialDefinitionId, open, server?.businessId, server?.config, server?.definitionId, server?.name, sessionRole]);

  useEffect(() => {
    if (!selectedDefinition || name) {
      return;
    }

    setName(server?.name || selectedDefinition.name);
  }, [name, selectedDefinition, server?.name]);

  const dependencyConnected = useMemo(() => {
    if (!selectedDefinition?.requiresIntegration) {
      return true;
    }

    return integrations.some((integration) => {
      if (
        integration.key !== selectedDefinition.requiresIntegration ||
        integration.status !== "connected"
      ) {
        return false;
      }

      if (integration.scope === "organization") {
        return true;
      }

      if (businessChoice === "__org__") {
        return integration.assignedBusinessIds.length === 0;
      }

      return integration.assignedBusinessIds.length === 0
        ? true
        : integration.assignedBusinessIds.includes(businessChoice);
    });
  }, [businessChoice, integrations, selectedDefinition?.requiresIntegration]);

  async function handleSubmit() {
    if (!selectedDefinition) {
      setError("Choose an MCP server first.");
      return;
    }

    if (!dependencyConnected) {
      setError(
        `Connect ${selectedDefinition.requiresIntegration} before installing this MCP server.`
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onInstall({
        definitionId: selectedDefinition.id,
        name,
        businessId: businessChoice === "__org__" ? undefined : businessChoice,
        config,
        secrets,
        serverId: server?.id
      });
      onOpenChange(false);
    } catch (installError) {
      setError(
        installError instanceof Error
          ? installError.message
          : "Unable to save this MCP server."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {server ? "Configure MCP Server" : "Install MCP Server"}
          </DialogTitle>
          <DialogDescription>
            Install Model Context Protocol servers to extend what your agents can do.
          </DialogDescription>
        </DialogHeader>

        {!server && !selectedDefinition ? (
          <div className="space-y-4">
            <div className="text-sm text-ink-secondary">Step 1: Pick an MCP server</div>
            <div className="grid gap-4 xl:grid-cols-2">
              {definitions.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  onClick={() => {
                    setSelectedDefinitionId(definition.id);
                    setName(definition.name);
                  }}
                  className="rounded-2xl border border-line-subtle bg-bg-surface p-5 text-left transition-all hover:border-line"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-surface-2 text-2xl">
                        {definition.icon}
                      </div>
                      <div className="space-y-2">
                        <div className="text-base font-semibold text-white">{definition.name}</div>
                        <div className="text-sm leading-6 text-ink-secondary">
                          {definition.description}
                        </div>
                      </div>
                    </div>
                    {definition.comingSoon ? (
                      <Badge className="bg-bg-surface-2 text-ink-muted">Coming soon</Badge>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : selectedDefinition ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-surface-2 text-2xl">
                  {selectedDefinition.icon}
                </div>
                <div className="space-y-2">
                  <div className="text-base font-semibold text-white">{selectedDefinition.name}</div>
                  <div className="text-sm text-ink-secondary">{selectedDefinition.description}</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedDefinition.capabilities.map((capability) => (
                      <Badge key={capability} className="bg-bg-surface-2 text-ink-secondary">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mcp-name" className="text-sm font-medium text-white">
                  Name
                </Label>
                <Input
                  id="mcp-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={selectedDefinition.name}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-white">Business scope</Label>
                <Select value={businessChoice} onValueChange={setBusinessChoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionRole === "super_admin" ? (
                      <SelectItem value="__org__">Organization-wide</SelectItem>
                    ) : null}
                    {businesses.map((business) => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4">
              {selectedDefinition.configFields.map((field) => {
                const isSecret = selectedDefinition.secretFields.includes(field.key);
                const fieldValue = isSecret
                  ? secrets[field.key] ?? ""
                  : config[field.key] ?? "";

                return (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm font-medium text-white">
                      {field.label}
                    </Label>
                    {field.options ? (
                      <Select
                        value={config[field.key] || ""}
                        onValueChange={(value) =>
                          setConfig((current) => ({ ...current, [field.key]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder || field.label} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === "textarea" ? (
                      <Textarea
                        id={field.key}
                        rows={4}
                        value={fieldValue}
                        onChange={(event) =>
                          isSecret
                            ? setSecrets((current) => ({
                                ...current,
                                [field.key]: event.target.value
                              }))
                            : setConfig((current) => ({
                                ...current,
                                [field.key]: event.target.value
                              }))
                        }
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <div className="relative">
                        <Input
                          id={field.key}
                          type={isSecret && !showSecrets[field.key] ? "password" : "text"}
                          value={fieldValue}
                          onChange={(event) =>
                            isSecret
                              ? setSecrets((current) => ({
                                  ...current,
                                  [field.key]: event.target.value
                                }))
                              : setConfig((current) => ({
                                  ...current,
                                  [field.key]: event.target.value
                                }))
                          }
                          placeholder={
                            isSecret && server?.hasSecrets && !fieldValue
                              ? "Saved securely"
                              : field.placeholder
                          }
                        />
                        {isSecret ? (
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-white"
                            onClick={() =>
                              setShowSecrets((current) => ({
                                ...current,
                                [field.key]: !current[field.key]
                              }))
                            }
                          >
                            {showSecrets[field.key] ? "Hide" : "Show"}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}

              {selectedDefinition.secretFields
                .filter(
                  (fieldKey) =>
                    !selectedDefinition.configFields.some((field) => field.key === fieldKey)
                )
                .map((fieldKey) => (
                  <div key={fieldKey} className="space-y-2">
                    <Label className="text-sm font-medium text-white">
                      {prettifyLabel(fieldKey)}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showSecrets[fieldKey] ? "text" : "password"}
                        value={secrets[fieldKey] ?? ""}
                        onChange={(event) =>
                          setSecrets((current) => ({
                            ...current,
                            [fieldKey]: event.target.value
                          }))
                        }
                        placeholder={server?.hasSecrets ? "Saved securely" : prettifyLabel(fieldKey)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-white"
                        onClick={() =>
                          setShowSecrets((current) => ({
                            ...current,
                            [fieldKey]: !current[fieldKey]
                          }))
                        }
                      >
                        {showSecrets[fieldKey] ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {selectedDefinition.requiresIntegration && !dependencyConnected ? (
              <div className="rounded-2xl border border-state-warning/25 bg-state-warning/10 px-4 py-3 text-sm leading-6 text-ink-primary">
                Connect {selectedDefinition.requiresIntegration} first before installing this MCP server.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-status-error/30 bg-state-danger/10 px-3 py-2 text-sm text-slate-100">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {!server && selectedDefinition ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedDefinitionId(null);
                setName("");
              }}
            >
              Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {selectedDefinition ? (
            <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
              {saving
                ? server
                  ? "Saving..."
                  : "Installing..."
                : server
                  ? "Save Changes"
                  : "Install"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
