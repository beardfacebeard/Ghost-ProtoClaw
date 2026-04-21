"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ChevronDown } from "lucide-react";

import {
  AGENT_SYSTEM_DEFAULT,
  agentFormSchema,
  agentStatusOptions,
  agentTypeOptions,
  commonAgentEmojiSuggestions,
  defaultAgentFormValues,
  runtimeOptions,
  safetyModeOptions,
  type AgentFormValues
} from "@/components/admin/agents/schema";
import { ModelInheritanceDisplay } from "@/components/admin/agents/ModelInheritanceDisplay";
import { ToolSelector } from "@/components/admin/agents/ToolSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_MODELS } from "@/lib/models/model-definitions";
import { cn } from "@/lib/utils";

export { agentFormSchema } from "@/components/admin/agents/schema";

type BusinessOption = {
  id: string;
  name: string;
  slug: string;
  primaryModel: string | null;
  fallbackModel: string | null;
  safetyMode: string | null;
};

type AgentFormProps = {
  mode: "create" | "edit";
  businesses: BusinessOption[];
  defaultValues?: Partial<AgentFormValues>;
  onSubmit: (values: AgentFormValues) => Promise<void> | void;
  loading?: boolean;
  submitLabel?: string;
  secondaryAction?: React.ReactNode;
  existingMainAgents?: Record<string, string>;
  currentAgentId?: string;
  allowGlobal?: boolean;
  systemDefaultModel: string;
  notice?: React.ReactNode;
};

type FormFieldProps = {
  label: string;
  htmlFor: string;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
};

const providerGroups = [
  {
    label: "OpenAI",
    options: SUPPORTED_MODELS.filter((model) => model.provider === "openai")
  },
  {
    label: "Anthropic",
    options: SUPPORTED_MODELS.filter((model) => model.provider === "anthropic")
  },
  {
    label: "Google",
    options: SUPPORTED_MODELS.filter((model) => model.provider === "google")
  },
  {
    label: "DeepSeek",
    options: SUPPORTED_MODELS.filter((model) => model.provider === "deepseek")
  },
  {
    label: "OpenRouter Free",
    options: SUPPORTED_MODELS.filter(
      (model) => model.provider === "openrouter" && model.free
    )
  },
  {
    label: "OpenRouter Paid",
    options: SUPPORTED_MODELS.filter(
      (model) => model.provider === "openrouter" && !model.free
    )
  }
];

function mergeDefaultValues(
  values?: Partial<AgentFormValues>
): AgentFormValues {
  return {
    ...defaultAgentFormValues,
    ...values,
    tools: values?.tools ?? defaultAgentFormValues.tools
  };
}

function FormField({
  label,
  htmlFor,
  helpText,
  error,
  children
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-white">
        {label}
      </Label>
      {children}
      {helpText ? <p className="text-xs leading-5 text-ink-muted">{helpText}</p> : null}
      {error ? <p className="text-xs text-steel-bright">{error}</p> : null}
    </div>
  );
}

function Section({
  title,
  description,
  defaultOpen = false,
  children
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-line-subtle bg-bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
        <div className="space-y-1">
          <div className="text-base font-semibold text-white">{title}</div>
          {description ? (
            <div className="text-sm leading-6 text-ink-secondary">{description}</div>
          ) : null}
        </div>
        <ChevronDown className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line-subtle px-6 py-5">{children}</div>
    </details>
  );
}

function modelDefaultLabel(type: AgentFormValues["type"]) {
  return type === "global" ? "Use system default" : "Use business default";
}

function formatCostTier(model: (typeof SUPPORTED_MODELS)[number]) {
  if (model.free) {
    return "Free";
  }

  if ((model.inputCostPer1k ?? 0) <= 0.001) {
    return "Budget";
  }

  if ((model.inputCostPer1k ?? 0) <= 0.005) {
    return "Balanced";
  }

  return "Premium";
}

function buildWorkspacePlaceholder(
  business: BusinessOption | undefined,
  displayName?: string
) {
  if (!business) {
    return "/businesses/[business-slug]/agents/[agent-name]/";
  }

  const agentSlug =
    displayName?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "[agent-name]";

  return `/businesses/${business.slug}/agents/${agentSlug}/`;
}

export function AgentForm({
  mode,
  businesses,
  defaultValues,
  onSubmit,
  loading = false,
  submitLabel,
  secondaryAction,
  existingMainAgents = {},
  currentAgentId,
  allowGlobal = true,
  systemDefaultModel,
  notice
}: AgentFormProps) {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: mergeDefaultValues(defaultValues)
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = form;

  const watchedType = watch("type");
  const watchedBusinessId = watch("businessId");
  const watchedDisplayName = watch("displayName");
  const watchedSystemPrompt = watch("systemPrompt");
  const watchedTools = watch("tools");
  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === watchedBusinessId),
    [businesses, watchedBusinessId]
  );
  const conflictingMainAgentId =
    watchedType === "main" && watchedBusinessId
      ? existingMainAgents[watchedBusinessId]
      : undefined;
  const showMainWarning =
    Boolean(conflictingMainAgentId) &&
    conflictingMainAgentId !== currentAgentId;

  useEffect(() => {
    if (watchedType === "global" && watchedBusinessId) {
      setValue("businessId", "");
    }
  }, [setValue, watchedBusinessId, watchedType]);

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {notice}

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Agent Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-3">
              <Label htmlFor="emoji" className="text-sm font-medium text-white">
                Emoji
              </Label>
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-line-subtle bg-bg-surface-2 text-4xl">
                {watch("emoji") || "🤖"}
              </div>
              <Input
                id="emoji"
                maxLength={8}
                placeholder="🤖"
                {...register("emoji")}
              />
              <div className="flex flex-wrap gap-2">
                {commonAgentEmojiSuggestions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-xl border border-line-subtle bg-bg-surface-2/40 px-3 py-2 text-lg transition-colors hover:border-line"
                    onClick={() => setValue("emoji", emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <FormField
                label="Display Name"
                htmlFor="displayName"
                error={errors.displayName?.message}
              >
                <Input
                  id="displayName"
                  placeholder="e.g. Client Success Agent"
                  {...register("displayName")}
                />
              </FormField>

              <FormField label="Role" htmlFor="role" error={errors.role?.message}>
                <Input
                  id="role"
                  placeholder="e.g. Handles client inquiries and books discovery calls"
                  {...register("role")}
                />
              </FormField>

              <FormField
                label="Purpose"
                htmlFor="purpose"
                error={errors.purpose?.message}
              >
                <Textarea
                  id="purpose"
                  rows={4}
                  placeholder="Describe what this agent is responsible for and where it should focus."
                  {...register("purpose")}
                />
              </FormField>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-white">Agent Type</Label>
            <div className="grid gap-3 xl:grid-cols-3">
              {agentTypeOptions.map((option) => {
                const selected = watchedType === option.value;
                const disabled = option.value === "global" && !allowGlobal;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      !disabled &&
                      setValue("type", option.value, {
                        shouldDirty: true,
                        shouldValidate: true
                      })
                    }
                    className={cn(
                      "rounded-2xl border px-4 py-4 text-left transition-all",
                      selected
                        ? "border-steel bg-steel/10 shadow-brand-sm"
                        : "border-line-subtle bg-bg-surface-2/30 hover:border-line",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="text-sm font-semibold text-white">
                      {option.icon} {option.label}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-ink-secondary">
                      {option.description}
                    </div>
                    {disabled ? (
                      <div className="mt-3 text-xs text-state-warning">
                        Super admin only
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {watchedType !== "global" ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <FormField
                label="Business Assignment"
                htmlFor="businessId"
                error={errors.businessId?.message}
              >
                <Controller
                  control={control}
                  name="businessId"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger id="businessId">
                        <SelectValue placeholder="Choose a business" />
                      </SelectTrigger>
                      <SelectContent>
                        {businesses.map((business) => (
                          <SelectItem key={business.id} value={business.id}>
                            {business.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <div className="rounded-2xl border border-line-subtle bg-bg-surface-2/20 px-4 py-4 text-sm text-ink-secondary">
                Business agents inherit model defaults and safety settings from the
                selected business unless you override them below.
              </div>
            </div>
          ) : null}

          {showMainWarning ? (
            <div className="rounded-2xl border border-state-warning/30 bg-state-warning/10 px-4 py-4 text-sm text-ink-primary">
              <div className="flex items-center gap-2 font-medium text-white">
                <AlertTriangle className="h-4 w-4 text-state-warning" />
                This business already has a main agent
              </div>
              <div className="mt-2 leading-6">
                Saving this agent as a main agent will be blocked until the current
                main agent is changed or disabled.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Section
        title="Instructions & Behavior"
        description="Shape how this agent thinks, responds, and handles its core role."
        defaultOpen
      >
        <div className="grid gap-5">
          <FormField
            label={`System Prompt (${watchedSystemPrompt?.length ?? 0} chars)`}
            htmlFor="systemPrompt"
            helpText="The core instructions this agent always follows. Be specific about role, tone, and boundaries."
            error={errors.systemPrompt?.message}
          >
            <Textarea
              id="systemPrompt"
              rows={10}
              className="font-mono text-sm"
              placeholder={`You are ${watchedDisplayName || "[Name]"}, the ${watch("role") || "[Role]"} for ${selectedBusiness?.name || "[Business]"}.\nYour job is to [purpose].\nAlways [positive behavior].\nNever [negative boundary].`}
              {...register("systemPrompt")}
            />
          </FormField>

          <FormField
            label="Role Instructions"
            htmlFor="roleInstructions"
            helpText="Step-by-step instructions for how to handle specific situations."
            error={errors.roleInstructions?.message}
          >
            <Textarea
              id="roleInstructions"
              rows={5}
              {...register("roleInstructions")}
            />
          </FormField>

          <FormField
            label="Output Style"
            htmlFor="outputStyle"
            helpText="How should responses be formatted?"
            error={errors.outputStyle?.message}
          >
            <Textarea
              id="outputStyle"
              rows={4}
              placeholder="Always use bullet points for lists. Keep responses under 3 paragraphs."
              {...register("outputStyle")}
            />
          </FormField>
        </div>
      </Section>

      <Section
        title="Rules & Guardrails"
        description="Set hard boundaries, escalation rules, and approval requirements."
      >
        <div className="grid gap-5">
          <FormField
            label="Hard Constraints"
            htmlFor="constraints"
            helpText="Things this agent must NEVER do. These are enforced absolutely."
            error={errors.constraints?.message}
          >
            <Textarea
              id="constraints"
              rows={5}
              placeholder="Never share pricing without manager approval. Never make promises about delivery dates."
              {...register("constraints")}
            />
          </FormField>

          <FormField
            label="When to Escalate"
            htmlFor="escalationRules"
            helpText="Define when this agent should hand off to a human or another agent."
            error={errors.escalationRules?.message}
          >
            <Textarea
              id="escalationRules"
              rows={5}
              placeholder="Escalate to human if: customer is upset, legal question, refund over $500."
              {...register("escalationRules")}
            />
          </FormField>

          <FormField
            label="Ask Before Acting"
            htmlFor="askBeforeDoing"
            helpText="Actions that require approval before executing."
            error={errors.askBeforeDoing?.message}
          >
            <Textarea
              id="askBeforeDoing"
              rows={5}
              placeholder="Always ask before: sending emails to more than 10 people, making any purchase, deleting any data."
              {...register("askBeforeDoing")}
            />
          </FormField>
        </div>
      </Section>

      <Section
        title="Tools & Capabilities"
        description="Only tools connected in Integrations will work at runtime."
      >
        <div className="space-y-4">
          <Controller
            control={control}
            name="tools"
            render={({ field }) => (
              <ToolSelector
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          <p className="text-xs text-ink-muted">
            Selected tools: {watchedTools.length}
          </p>
        </div>
      </Section>

      <Section
        title="Model & Runtime"
        description="Choose the execution runtime and model settings for this agent."
        defaultOpen
      >
        <div className="space-y-5">
          <ModelInheritanceDisplay
            agent={{
              primaryModel: watch("primaryModel"),
              fallbackModel: watch("fallbackModel"),
              safetyMode: watch("safetyMode")
            }}
            business={selectedBusiness || null}
            systemDefault={systemDefaultModel}
          />

          <FormField
            label="Runtime"
            htmlFor="runtime"
            helpText="The execution runtime that powers this agent."
            error={errors.runtime?.message}
          >
            <Controller
              control={control}
              name="runtime"
              render={({ field }) => (
                <Select
                  value={field.value || "openclaw"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="runtime">
                    <SelectValue placeholder="Choose a runtime" />
                  </SelectTrigger>
                  <SelectContent>
                    {runtimeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="space-y-0.5">
                          <div className="text-sm text-white">{option.label}</div>
                          <div className="text-xs text-ink-muted">
                            {option.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <div className="grid gap-5 xl:grid-cols-2">
            <FormField
              label="Primary Model"
              htmlFor="primaryModel"
              error={errors.primaryModel?.message}
            >
              <Controller
                control={control}
                name="primaryModel"
                render={({ field }) => (
                  <Select
                    value={field.value || AGENT_SYSTEM_DEFAULT}
                    onValueChange={(value) =>
                      field.onChange(value === AGENT_SYSTEM_DEFAULT ? "" : value)
                    }
                  >
                    <SelectTrigger id="primaryModel">
                      <SelectValue placeholder="Choose a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AGENT_SYSTEM_DEFAULT}>
                        {modelDefaultLabel(watchedType)}
                      </SelectItem>
                      <SelectSeparator />
                      {providerGroups.map((group) => (
                        <SelectGroup key={group.label}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.options.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex w-full items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="text-sm text-white">
                                    {model.name}
                                  </div>
                                  <div className="text-xs text-ink-muted">
                                    {(model.contextWindow / 1000).toFixed(0)}k context
                                  </div>
                                </div>
                                <div className="flex gap-2 text-[10px]">
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5",
                                      model.free
                                        ? "bg-state-success/20 text-state-success"
                                        : "bg-bg-surface-2 text-ink-secondary"
                                    )}
                                  >
                                    {formatCostTier(model)}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              label="Fallback Model"
              htmlFor="fallbackModel"
              error={errors.fallbackModel?.message}
            >
              <Controller
                control={control}
                name="fallbackModel"
                render={({ field }) => (
                  <Select
                    value={field.value || AGENT_SYSTEM_DEFAULT}
                    onValueChange={(value) =>
                      field.onChange(value === AGENT_SYSTEM_DEFAULT ? "" : value)
                    }
                  >
                    <SelectTrigger id="fallbackModel">
                      <SelectValue placeholder="Choose a fallback model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AGENT_SYSTEM_DEFAULT}>
                        {modelDefaultLabel(watchedType)}
                      </SelectItem>
                      <SelectSeparator />
                      {providerGroups.map((group) => (
                        <SelectGroup key={`${group.label}-fallback`}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.options.map((model) => (
                            <SelectItem
                              key={`${model.id}-fallback`}
                              value={model.id}
                            >
                              <div className="flex w-full items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="text-sm text-white">
                                    {model.name}
                                  </div>
                                  <div className="text-xs text-ink-muted">
                                    {(model.contextWindow / 1000).toFixed(0)}k context
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px]",
                                    model.free
                                      ? "bg-state-success/20 text-state-success"
                                      : "bg-bg-surface-2 text-ink-secondary"
                                  )}
                                >
                                  {formatCostTier(model)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              label="Max Tokens Per Call"
              htmlFor="maxTokensPerCall"
              error={errors.maxTokensPerCall?.message}
              helpText="Limits output tokens per LLM call to control costs. Leave blank for model default."
            >
              <Input
                id="maxTokensPerCall"
                type="number"
                placeholder="e.g. 4096"
                {...register("maxTokensPerCall")}
              />
            </FormField>

            <FormField
              label="Safety Mode"
              htmlFor="safetyMode"
              error={errors.safetyMode?.message}
            >
              <Controller
                control={control}
                name="safetyMode"
                render={({ field }) => (
                  <Select
                    value={field.value || AGENT_SYSTEM_DEFAULT}
                    onValueChange={(value) =>
                      field.onChange(value === AGENT_SYSTEM_DEFAULT ? "" : value)
                    }
                  >
                    <SelectTrigger id="safetyMode">
                      <SelectValue placeholder="Choose a safety mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AGENT_SYSTEM_DEFAULT}>
                        {watchedType === "global" ? "Use system default" : "Use business default"}
                      </SelectItem>
                      <SelectSeparator />
                      {safetyModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              label="Status"
              htmlFor="status"
              error={errors.status?.message}
            >
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    value={field.value || "active"}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Choose a status" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>
        </div>
      </Section>

      <Section
        title="Workspace Path"
        description="Define where this agent's workspace files and notes live."
      >
        <FormField
          label="Workspace Path"
          htmlFor="workspacePath"
          helpText="Where this agent's workspace files are stored."
          error={errors.workspacePath?.message}
        >
          <Input
            id="workspacePath"
            placeholder={buildWorkspacePlaceholder(
              selectedBusiness,
              watchedDisplayName
            )}
            {...register("workspacePath")}
          />
        </FormField>
      </Section>

      <div
        className={cn(
          "flex gap-3",
          mode === "create"
            ? "flex-col"
            : "flex-col-reverse sm:flex-row sm:justify-end"
        )}
      >
        {secondaryAction}
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading
            ? mode === "create"
              ? "Creating Agent..."
              : "Saving..."
            : submitLabel || (mode === "create" ? "Create Agent" : "Save Agent")}
        </Button>
      </div>
    </form>
  );
}
