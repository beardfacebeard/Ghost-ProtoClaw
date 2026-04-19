"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Bell,
  Clock,
  GitBranch,
  Link2,
  Mail,
  MessageCircle,
  Sparkles,
  UserPlus
} from "lucide-react";

import {
  approvalModeOptions,
  commonTimezones,
  defaultWorkflowFormValues,
  outputOptions,
  scheduleModeOptions,
  triggerOptions,
  type WorkflowFormValues,
  workflowFormSchema
} from "@/components/admin/workflows/schema";
import { CronBuilder } from "@/components/admin/workflows/CronBuilder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { parseEveryInterval } from "@/lib/workflows/schedule-parser";

export { workflowFormSchema } from "@/components/admin/workflows/schema";

type BusinessOption = {
  id: string;
  name: string;
};

type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
  businessId: string | null;
  type: string;
};

type WorkflowFormProps = {
  mode: "create" | "edit";
  businesses: BusinessOption[];
  agents: AgentOption[];
  defaultValues?: Partial<WorkflowFormValues>;
  onSubmit: (values: WorkflowFormValues) => Promise<void> | void;
  loading?: boolean;
  step?: "trigger" | "behavior" | "full";
  submitLabel?: string;
  secondaryAction?: React.ReactNode;
  onValuesChange?: (values: WorkflowFormValues) => void;
  readOnlyTrigger?: boolean;
  integrationStatus?: {
    gmail: boolean;
    crm: boolean;
    comments: boolean;
  };
  notice?: React.ReactNode;
};

const workflowSafetyOptions = [
  { value: "ask_before_acting", label: "Ask Before Acting" },
  { value: "auto_low_risk", label: "Balanced" },
  { value: "full_auto", label: "Autonomous" }
] as const;

const intervalUnits = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" }
] as const;

function mergeDefaultValues(
  values?: Partial<WorkflowFormValues>
): WorkflowFormValues {
  return {
    ...defaultWorkflowFormValues,
    ...values,
    overrideSafetyMode:
      Boolean(values?.safetyMode) || values?.overrideSafetyMode || false
  };
}

function buildEveryFrequency(value: number, unit: string) {
  return `every ${value} ${unit}`;
}

function FormField({
  label,
  htmlFor,
  helpText,
  error,
  children
}: {
  label: string;
  htmlFor: string;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-white">
        {label}
      </Label>
      {children}
      {helpText ? <p className="text-xs leading-5 text-slate-500">{helpText}</p> : null}
      {error ? <p className="text-xs text-brand-primary">{error}</p> : null}
    </div>
  );
}

function Section({
  title,
  description,
  defaultOpen = true,
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
      className="group rounded-2xl border border-ghost-border bg-ghost-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
        <div className="space-y-1">
          <div className="text-base font-semibold text-white">{title}</div>
          {description ? (
            <div className="text-sm leading-6 text-slate-400">{description}</div>
          ) : null}
        </div>
        <Sparkles className="h-4 w-4 text-slate-500 transition-colors group-open:text-brand-cyan" />
      </summary>
      <div className="border-t border-ghost-border px-6 py-5">{children}</div>
    </details>
  );
}

function TriggerCard({
  selected,
  label,
  description,
  icon,
  onClick
}: {
  selected: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-4 text-left transition-all",
        selected
          ? "border-brand-primary bg-brand-primary/10 shadow-brand-sm"
          : "border-ghost-border bg-ghost-raised/30 hover:border-ghost-border-strong"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ghost-black text-slate-200">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
        </div>
      </div>
    </button>
  );
}

function OutputCard({
  selected,
  label,
  description,
  icon,
  onClick
}: {
  selected: boolean;
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-4 text-left transition-all",
        selected
          ? "border-brand-primary bg-brand-primary/10 shadow-brand-sm"
          : "border-ghost-border bg-ghost-raised/30 hover:border-ghost-border-strong"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ghost-black text-slate-200">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
        </div>
      </div>
    </button>
  );
}

export function WorkflowForm({
  mode,
  businesses,
  agents,
  defaultValues,
  onSubmit,
  loading = false,
  step = "full",
  submitLabel,
  secondaryAction,
  onValuesChange,
  readOnlyTrigger = false,
  integrationStatus,
  notice
}: WorkflowFormProps) {
  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: mergeDefaultValues(defaultValues)
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = form;

  const watchedBusinessId = watch("businessId");
  const watchedTrigger = watch("trigger");
  const watchedScheduleMode = watch("scheduleMode");
  const watchedFrequency = watch("frequency");
  const watchedOutput = watch("output");
  const watchedOutputs = watch("outputs");
  const watchedApprovalMode = watch("approvalMode");
  const watchedOverrideSafety = watch("overrideSafetyMode");
  const supportedTimezones = useMemo(() => {
    const allTimezones =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [];

    return [...new Set([...commonTimezones, ...allTimezones])];
  }, []);
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (!watchedBusinessId) {
        return agent.type === "global";
      }

      return agent.type === "global" || agent.businessId === watchedBusinessId;
    });
  }, [agents, watchedBusinessId]);
  const parsedEvery = useMemo(
    () => (watchedFrequency ? parseEveryInterval(watchedFrequency) : null),
    [watchedFrequency]
  );
  const [intervalValue, setIntervalValue] = useState(parsedEvery?.value ?? 1);
  const [intervalUnit, setIntervalUnit] = useState<string>(
    parsedEvery?.unit ?? "hours"
  );

  useEffect(() => {
    if (!onValuesChange) {
      return;
    }

    const subscription = watch((values) => {
      onValuesChange(mergeDefaultValues(values as Partial<WorkflowFormValues>));
    });

    return () => subscription.unsubscribe();
  }, [onValuesChange, watch]);

  useEffect(() => {
    if (watchedTrigger !== "scheduled") {
      setValue("scheduleMode", undefined);
      setValue("frequency", "");
      setValue("cronExpression", "");
      return;
    }

    if (!watch("scheduleMode")) {
      setValue("scheduleMode", "every");
    }
  }, [setValue, watch, watchedTrigger]);

  useEffect(() => {
    if (watchedScheduleMode !== "every") {
      return;
    }

    setValue("frequency", buildEveryFrequency(intervalValue, intervalUnit), {
      shouldDirty: true
    });
  }, [intervalUnit, intervalValue, setValue, watchedScheduleMode]);

  useEffect(() => {
    if (!parsedEvery) {
      return;
    }

    setIntervalValue(parsedEvery.value);
    setIntervalUnit(parsedEvery.unit);
  }, [parsedEvery]);

  const showTriggerStep = step === "trigger" || step === "full";
  const showBehaviorStep = step === "behavior" || step === "full";

  const content = (
    <div className="space-y-6">
      {notice}

      {showTriggerStep ? (
        <Card className="border-ghost-border bg-ghost-surface">
          <CardHeader>
            <CardTitle className="text-base text-white">Trigger & Business</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <FormField
                label="Business"
                htmlFor="businessId"
                error={errors.businessId?.message}
              >
                <Controller
                  control={control}
                  name="businessId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
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

              <FormField
                label="Agent (optional)"
                htmlFor="agentId"
                helpText="Choose a specific agent or leave blank to let Mission Control choose."
                error={errors.agentId?.message}
              >
                <Controller
                  control={control}
                  name="agentId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "__any__"}
                      onValueChange={(value) =>
                        field.onChange(value === "__any__" ? "" : value)
                      }
                    >
                      <SelectTrigger id="agentId">
                        <SelectValue placeholder="Any available agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any available agent</SelectItem>
                        {filteredAgents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {(agent.emoji || "Agent") + " " + agent.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-white">Trigger type</Label>
              <div className="grid gap-3 xl:grid-cols-3">
                {triggerOptions.map((option) => (
                  <TriggerCard
                    key={option.value}
                    selected={watchedTrigger === option.value}
                    label={option.label}
                    description={option.description}
                    icon={
                      option.value === "manual" ? (
                        <GitBranch className="h-5 w-5" />
                      ) : option.value === "scheduled" ? (
                        <Clock className="h-5 w-5" />
                      ) : option.value === "webhook" ? (
                        <Link2 className="h-5 w-5" />
                      ) : option.value === "new_email" ? (
                        <Mail className="h-5 w-5" />
                      ) : option.value === "new_lead" ? (
                        <UserPlus className="h-5 w-5" />
                      ) : (
                        <MessageCircle className="h-5 w-5" />
                      )
                    }
                    onClick={() => {
                      if (readOnlyTrigger) {
                        return;
                      }

                      setValue("trigger", option.value, {
                        shouldDirty: true,
                        shouldValidate: true
                      });
                    }}
                  />
                ))}
              </div>
              {readOnlyTrigger ? (
                <div className="text-xs text-slate-500">
                  Trigger type is fixed after creation so external systems keep the same behavior.
                </div>
              ) : null}
            </div>

            {watchedTrigger === "scheduled" ? (
              <div className="space-y-5 rounded-2xl border border-ghost-border bg-ghost-raised/20 p-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-white">Schedule mode</Label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {scheduleModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setValue("scheduleMode", option.value, {
                            shouldDirty: true,
                            shouldValidate: true
                          })
                        }
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left text-sm transition-all",
                          watchedScheduleMode === option.value
                            ? "border-brand-primary bg-brand-primary/10 text-white"
                            : "border-ghost-border bg-ghost-surface text-slate-400 hover:text-white"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {errors.scheduleMode?.message ? (
                    <p className="text-xs text-brand-primary">
                      {errors.scheduleMode.message}
                    </p>
                  ) : null}
                </div>

                {watchedScheduleMode === "every" ? (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-white">
                      Every interval
                    </Label>
                    <div className="grid gap-4 md:grid-cols-[120px_160px_minmax(0,1fr)]">
                      <Input
                        type="number"
                        min={1}
                        value={intervalValue}
                        onChange={(event) =>
                          setIntervalValue(Math.max(Number(event.target.value) || 1, 1))
                        }
                      />
                      <Select
                        value={intervalUnit}
                        onValueChange={(value) => setIntervalUnit(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {intervalUnits.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="rounded-xl border border-ghost-border bg-ghost-black px-4 py-2 text-sm text-slate-300">
                        This will run {buildEveryFrequency(intervalValue, intervalUnit)}.
                      </div>
                    </div>
                    {errors.frequency?.message ? (
                      <p className="text-xs text-brand-primary">{errors.frequency.message}</p>
                    ) : null}
                  </div>
                ) : null}

                {watchedScheduleMode === "cron" ? (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-white">
                      Cron expression
                    </Label>
                    <Controller
                      control={control}
                      name="cronExpression"
                      render={({ field }) => (
                        <CronBuilder value={field.value || ""} onChange={field.onChange} />
                      )}
                    />
                    {errors.cronExpression?.message ? (
                      <p className="text-xs text-brand-primary">
                        {errors.cronExpression.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {watchedScheduleMode === "definition_only" ? (
                  <FormField
                    label="Schedule definition"
                    htmlFor="frequency"
                    helpText="Describe the desired cadence in plain language for later automation."
                    error={errors.frequency?.message}
                  >
                    <Textarea
                      id="frequency"
                      rows={3}
                      placeholder="e.g. Every Monday morning after the sales meeting."
                      {...register("frequency")}
                    />
                  </FormField>
                ) : null}

                <FormField
                  label="Timezone"
                  htmlFor="timezone"
                  error={errors.timezone?.message}
                >
                  <Input
                    id="timezone"
                    list="workflow-timezones"
                    placeholder="Europe/Berlin"
                    {...register("timezone")}
                  />
                  <datalist id="workflow-timezones">
                    {supportedTimezones.map((timezone) => (
                      <option key={timezone} value={timezone} />
                    ))}
                  </datalist>
                </FormField>
              </div>
            ) : null}

            {watchedTrigger === "webhook" ? (
              <div className="rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 px-4 py-4 text-sm leading-6 text-slate-200">
                A webhook URL will be generated after creation. You can add a signing secret for security on the workflow detail page.
              </div>
            ) : null}

            {watchedTrigger === "new_email" ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-4 text-sm leading-6",
                  integrationStatus?.gmail
                    ? "border-status-active/30 bg-status-active/10 text-slate-200"
                    : "border-brand-amber/30 bg-brand-amber/10 text-slate-200"
                )}
              >
                {integrationStatus?.gmail
                  ? "Gmail is connected and ready to trigger this workflow."
                  : "Gmail is not connected yet. Connect it in Integrations before relying on this trigger."}
              </div>
            ) : null}

            {watchedTrigger === "new_lead" ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-4 text-sm leading-6",
                  integrationStatus?.crm
                    ? "border-status-active/30 bg-status-active/10 text-slate-200"
                    : "border-brand-amber/30 bg-brand-amber/10 text-slate-200"
                )}
              >
                {integrationStatus?.crm
                  ? "A CRM integration is connected and can trigger this workflow."
                  : "No CRM integration is connected yet. Connect HubSpot, Pipedrive, or GoHighLevel before using this trigger."}
              </div>
            ) : null}

            {watchedTrigger === "new_comment" ? (
              <div
                className={cn(
                  "rounded-2xl border px-4 py-4 text-sm leading-6",
                  integrationStatus?.comments
                    ? "border-status-active/30 bg-status-active/10 text-slate-200"
                    : "border-brand-amber/30 bg-brand-amber/10 text-slate-200"
                )}
              >
                {integrationStatus?.comments
                  ? "A connected channel can feed new comments into this workflow."
                  : "Connect a community or messaging integration before using comment-based triggers."}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showBehaviorStep ? (
        <Card className="border-ghost-border bg-ghost-surface">
          <CardHeader>
            <CardTitle className="text-base text-white">Output & Behavior</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-5">
              <FormField
                label="Workflow Name"
                htmlFor="name"
                error={errors.name?.message}
              >
                <Input
                  id="name"
                  placeholder="e.g. Weekly Content Plan"
                  {...register("name")}
                />
              </FormField>

              <FormField
                label="Description"
                htmlFor="description"
                error={errors.description?.message}
              >
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="What should happen when this workflow runs?"
                  {...register("description")}
                />
              </FormField>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-white">
                Output — select one or more
              </Label>
              <p className="text-xs text-slate-400">
                Every selected output receives the workflow&apos;s result when a
                run completes. Pick multiple to fan out (e.g. Chat + Telegram
                + Report). The first selected becomes the primary output for
                list views.
              </p>
              <div className="grid gap-3 xl:grid-cols-3">
                {outputOptions.map((option) => {
                  const selected =
                    watchedOutputs?.includes(option.value) ||
                    (!watchedOutputs?.length && watchedOutput === option.value);
                  return (
                    <OutputCard
                      key={option.value}
                      selected={selected}
                      label={option.label}
                      description={option.description}
                      icon={
                        option.value === "chat" ? (
                          <Mail className="h-5 w-5" />
                        ) : option.value === "report" ? (
                          <GitBranch className="h-5 w-5" />
                        ) : option.value === "draft" ? (
                          <Sparkles className="h-5 w-5" />
                        ) : option.value === "crm_note" ? (
                          <UserPlus className="h-5 w-5" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )
                      }
                      onClick={() => {
                        const current = new Set(watchedOutputs ?? []);
                        if (current.has(option.value)) {
                          current.delete(option.value);
                        } else {
                          current.add(option.value);
                        }
                        // Always keep at least one selected; if the user
                        // un-checks the last, fall back to Chat.
                        const next =
                          current.size > 0
                            ? (Array.from(current) as typeof watchedOutputs)
                            : (["chat"] as typeof watchedOutputs);
                        setValue("outputs", next, {
                          shouldDirty: true,
                          shouldValidate: true
                        });
                        setValue("output", next?.[0] ?? "chat", {
                          shouldDirty: true,
                          shouldValidate: true
                        });
                      }}
                    />
                  );
                })}
              </div>
              {errors.outputs ? (
                <p className="text-xs text-status-error">
                  {errors.outputs.message as string}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-white">
                Approval mode
              </Label>
              <div className="grid gap-3">
                {approvalModeOptions.map((option) => {
                  const selected = watchedApprovalMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setValue("approvalMode", option.value, {
                          shouldDirty: true,
                          shouldValidate: true
                        })
                      }
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left transition-all",
                        selected
                          ? "border-brand-primary bg-brand-primary/10 shadow-brand-sm"
                          : "border-ghost-border bg-ghost-raised/30 hover:border-ghost-border-strong"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ghost-black text-slate-200">
                          {option.value === "auto" ? (
                            <Sparkles className="h-5 w-5" />
                          ) : option.value === "notify" ? (
                            <Bell className="h-5 w-5" />
                          ) : option.value === "approve_first" ? (
                            <GitBranch className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {option.label}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-400">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Section
              title="Safety Override"
              description="Use the business safety mode by default, or override it for this workflow."
              defaultOpen
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Controller
                    control={control}
                    name="overrideSafetyMode"
                    render={({ field }) => (
                      <Checkbox
                        id="overrideSafetyMode"
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          const nextChecked = checked === true;
                          field.onChange(nextChecked);

                          if (!nextChecked) {
                            setValue("safetyMode", "");
                          }
                        }}
                      />
                    )}
                  />
                  <Label htmlFor="overrideSafetyMode" className="text-sm text-white">
                    Override business safety mode for this workflow
                  </Label>
                </div>

                {watchedOverrideSafety ? (
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
                          value={field.value || ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="safetyMode">
                            <SelectValue placeholder="Choose a safety mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {workflowSafetyOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>
                ) : (
                  <div className="text-sm text-slate-500">
                    This workflow will inherit the business safety mode.
                  </div>
                )}
              </div>
            </Section>

            <Section
              title="Advanced Workflow Options"
              description="Optional fields for runtime routing and downstream automation."
              defaultOpen={mode === "edit"}
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <FormField
                  label="Action Type"
                  htmlFor="actionType"
                  helpText="Optional internal action label for downstream handlers."
                  error={errors.actionType?.message}
                >
                  <Input
                    id="actionType"
                    placeholder="e.g. publish_report"
                    {...register("actionType")}
                  />
                </FormField>

                <FormField
                  label="Enabled"
                  htmlFor="enabled"
                  helpText="Disable this if you want to save the workflow without running it."
                  error={errors.enabled?.message}
                >
                  <Controller
                    control={control}
                    name="enabled"
                    render={({ field }) => (
                      <div className="flex h-10 items-center">
                        <Checkbox
                          id="enabled"
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                        <Label htmlFor="enabled" className="ml-3 text-sm text-white">
                          Workflow is enabled
                        </Label>
                      </div>
                    )}
                  />
                </FormField>
              </div>
            </Section>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  if (mode === "create") {
    return content;
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {content}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {secondaryAction}
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : submitLabel || "Save Workflow"}
        </Button>
      </div>
    </form>
  );
}
