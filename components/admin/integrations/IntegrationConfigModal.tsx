"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, KeyRound, Link2 } from "lucide-react";

import type { IntegrationDefinition } from "@/lib/integrations/integration-definitions";
import type { SafeIntegrationPayload } from "@/lib/integrations/safe";
import { IntegrationTestResult } from "@/components/admin/integrations/IntegrationTestResult";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

type SavePayload = {
  scope: "organization" | "business";
  config: Record<string, string>;
  secrets: Record<string, string>;
  assignedBusinessIds: string[];
};

type SaveResult = {
  integration: SafeIntegrationPayload;
  testResult: { success: boolean; message: string } | null;
};

type IntegrationConfigModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: IntegrationDefinition | null;
  integration?: SafeIntegrationPayload | null;
  businesses: Array<{ id: string; name: string }>;
  sessionRole: "super_admin" | "admin";
  onSave: (
    definition: IntegrationDefinition,
    payload: SavePayload,
    testAfterSave: boolean
  ) => Promise<SaveResult>;
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

function authLabel(authType: IntegrationDefinition["authType"]) {
  switch (authType) {
    case "api_key":
      return "API Key";
    case "oauth":
      return "OAuth";
    case "bearer":
      return "Bearer";
    case "multi_key":
      return "Multi-Key";
    default:
      return authType;
  }
}

export function IntegrationConfigModal({
  open,
  onOpenChange,
  definition,
  integration,
  businesses,
  sessionRole,
  onSave
}: IntegrationConfigModalProps) {
  const initialConfig = useMemo(
    () => readStringRecord(integration?.config),
    [integration?.config]
  );
  const [scope, setScope] = useState<"organization" | "business">("organization");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [assignedBusinessIds, setAssignedBusinessIds] = useState<string[]>([]);
  const [showSecretFields, setShowSecretFields] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!definition) {
      return;
    }

    const defaultScope =
      definition.scope === "organization"
        ? "organization"
        : sessionRole === "admin"
          ? "business"
          : integration?.scope === "business"
            ? "business"
            : definition.scope === "business"
              ? "business"
              : "organization";

    setScope(defaultScope);
    setConfig(initialConfig);
    setSecrets({});
    setAssignedBusinessIds(integration?.assignedBusinessIds ?? []);
    setShowSecretFields({});
    setError(null);
    setTestResult(null);
  }, [definition, initialConfig, integration?.assignedBusinessIds, integration?.scope, sessionRole]);

  if (!definition) {
    return null;
  }

  const oauthSupported =
    definition.authType === "oauth" &&
    (definition.oauthProvider === "google" ||
      definition.oauthProvider === "openrouter");
  const connectedLabel =
    initialConfig.user_email ||
    initialConfig.connected_account ||
    initialConfig.portal_id ||
    "";
  const shouldShowAssignments =
    definition.scope === "business" ||
    scope === "business" ||
    definition.scope === "both";
  const activeDefinition = definition;

  async function performSave(testAfterSave: boolean) {
    try {
      setSaving(true);
      if (testAfterSave) {
        setTesting(true);
      }
      setError(null);

      const result = await onSave(
        activeDefinition,
        {
          scope,
          config,
          secrets,
          assignedBusinessIds: scope === "organization" ? [] : assignedBusinessIds
        },
        testAfterSave
      );

      setTestResult(result.testResult);
      setSecrets({});
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save this integration."
      );
    } finally {
      setSaving(false);
      setTesting(false);
    }
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ghost-raised text-2xl">
                {definition.icon}
              </div>
              <div className="space-y-2">
                <DialogTitle>{definition.name}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-brand-cyan/10 text-brand-cyan">
                    {authLabel(definition.authType)}
                  </Badge>
                  {integration?.status === "connected" ? (
                    <Badge variant="active">Connected ✓</Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <DialogDescription>{definition.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {definition.authType === "oauth" ? (
              <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/10 p-4">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-white">OAuth Setup</div>
                  {integration?.status === "connected" ? (
                    <div className="text-sm text-slate-200">
                      Connected{connectedLabel ? ` as ${connectedLabel}` : ""}.
                    </div>
                  ) : null}
                  {oauthSupported ? (
                    <Button asChild className="w-full sm:w-auto">
                      <a href={`/api/auth/oauth/${definition.oauthProvider}`}>
                        Connect with {definition.oauthProvider === "google" ? "Google" : "OpenRouter"}
                      </a>
                    </Button>
                  ) : (
                    <div className="text-sm text-slate-300">
                      Direct OAuth setup for this provider is coming later. You can enter tokens manually below for now.
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    or configure manually
                  </div>
                </div>
              </div>
            ) : null}

            {definition.scope === "both" ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white">Scope</Label>
                <Select
                  value={scope}
                  onValueChange={(value) =>
                    setScope(value as "organization" | "business")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionRole === "super_admin" ? (
                      <SelectItem value="organization">Organization-wide</SelectItem>
                    ) : null}
                    <SelectItem value="business">Business-specific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-xl border border-ghost-border bg-ghost-raised/30 px-3 py-2 text-sm text-slate-400">
                Scope: {definition.scope === "organization" ? "Organization-wide" : "Business-specific"}
              </div>
            )}

            <div className="grid gap-4">
              {definition.fields.map((field) => {
                const isSecret = definition.secretFields.includes(field.key) || field.secret;
                const inputValue = isSecret
                  ? secrets[field.key] ?? ""
                  : config[field.key] ?? "";

                const inputProps = {
                  id: field.key,
                  value: inputValue,
                  placeholder:
                    isSecret && !inputValue && integration?.hasSecrets
                      ? "Saved securely"
                      : field.placeholder,
                  onChange: (
                    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
                  ) => {
                    const nextValue = event.target.value;
                    if (isSecret) {
                      setSecrets((current) => ({
                        ...current,
                        [field.key]: nextValue
                      }));
                    } else {
                      setConfig((current) => ({
                        ...current,
                        [field.key]: nextValue
                      }));
                    }
                  }
                };

                return (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={field.key} className="text-sm font-medium text-white">
                        {field.label}
                        {field.required ? " *" : ""}
                      </Label>
                      {field.helpText ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-slate-500">
                              <HelpCircle className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>{field.helpText}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>

                    {field.type === "textarea" ? (
                      <Textarea rows={4} {...inputProps} />
                    ) : field.type === "select" ? (
                      <Select
                        value={config[field.key] || ""}
                        onValueChange={(value) =>
                          setConfig((current) => ({
                            ...current,
                            [field.key]: value
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="relative">
                        <Input
                          type={
                            isSecret && !showSecretFields[field.key]
                              ? "password"
                              : field.type === "url"
                                ? "url"
                                : "text"
                          }
                          {...inputProps}
                        />
                        {isSecret ? (
                          <button
                            type="button"
                            onClick={() =>
                              setShowSecretFields((current) => ({
                                ...current,
                                [field.key]: !current[field.key]
                              }))
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                          >
                            {showSecretFields[field.key] ? "Hide" : "Show"}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {definition.setupNotes || definition.docs ? (
              <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <KeyRound className="h-4 w-4 text-brand-amber" />
                  Setup Notes
                </div>
                {definition.setupNotes ? (
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {definition.setupNotes}
                  </p>
                ) : null}
                {definition.docs ? (
                  <a
                    href={definition.docs}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm text-white underline-offset-4 hover:underline"
                  >
                    <Link2 className="h-4 w-4" />
                    Open provider docs
                  </a>
                ) : null}
              </div>
            ) : null}

            {shouldShowAssignments ? (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-white">
                  Assign to businesses
                </Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {businesses.map((business) => {
                    const checked = assignedBusinessIds.includes(business.id);

                    return (
                      <label
                        key={business.id}
                        className="flex items-center gap-3 rounded-xl border border-ghost-border bg-ghost-raised/20 px-3 py-3 text-sm text-slate-200"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            setAssignedBusinessIds((current) =>
                              nextChecked
                                ? [...new Set([...current, business.id])]
                                : current.filter((value) => value !== business.id)
                            );
                          }}
                        />
                        <span>{business.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-slate-100">
                {error}
              </div>
            ) : null}

            <IntegrationTestResult result={testResult} loading={testing} />
          </div>

          <DialogFooter className="sm:justify-between">
            <div className="text-xs text-slate-500">
              Secret values are encrypted before they are stored.
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void performSave(true)}
              >
                Test Connection
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void performSave(true)}
              >
                {saving ? "Saving..." : "Save Integration"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
