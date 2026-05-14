"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  businessBuilderHandsOnOptions,
  businessFormSchema,
  defaultBusinessFormValues,
  jurisdictionOptions,
  modelOptions,
  safetyModeOptions,
  type BusinessFormValues
} from "@/components/admin/businesses/schema";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export { businessFormSchema } from "@/components/admin/businesses/schema";

const SYSTEM_DEFAULT_MODEL = "__system_default__";

type BusinessFormProps = {
  defaultValues?: Partial<BusinessFormValues>;
  onSubmit: (values: BusinessFormValues) => Promise<void> | void;
  mode: "create" | "edit";
  templateId?: string;
  step?: "details" | "advanced" | "full";
  loading?: boolean;
  submitLabel?: string;
  secondaryAction?: React.ReactNode;
  onValuesChange?: (values: BusinessFormValues) => void;
};

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
      {helpText ? <p className="text-xs text-ink-muted">{helpText}</p> : null}
      {error ? <p className="text-xs text-steel-bright">{error}</p> : null}
    </div>
  );
}

function renderTemplateDefaults(
  values: Partial<BusinessFormValues> | undefined
): BusinessFormValues {
  return {
    ...defaultBusinessFormValues,
    ...values,
    templateAnswers: {
      ...defaultBusinessFormValues.templateAnswers,
      ...values?.templateAnswers
    }
  };
}

export function BusinessForm({
  defaultValues,
  onSubmit,
  mode,
  templateId,
  step = "full",
  loading = false,
  submitLabel,
  secondaryAction,
  onValuesChange
}: BusinessFormProps) {
  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: renderTemplateDefaults(defaultValues)
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = form;

  useEffect(() => {
    if (!onValuesChange) {
      return;
    }

    const subscription = watch((values) => {
      onValuesChange(renderTemplateDefaults(values as Partial<BusinessFormValues>));
    });

    return () => subscription.unsubscribe();
  }, [onValuesChange, watch]);

  const showBusinessBuilder = templateId === "business_builder";
  const showForexDesk = templateId === "forex_trading_desk";
  const showDetails = step === "details" || step === "full";
  const showAdvanced = step === "advanced" || step === "full";

  const editContent = (
    <div className="space-y-6">
      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <FormField
            label="Business Name"
            htmlFor="name"
            error={errors.name?.message}
          >
            <Input
              id="name"
              placeholder="e.g. Horizon Leadership Coaching"
              {...register("name")}
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
                  value={field.value ?? "planning"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Summary"
            htmlFor="summary"
            error={errors.summary?.message}
          >
            <Textarea
              id="summary"
              rows={4}
              placeholder="A short operating summary of what this business does."
              {...register("summary")}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Brand & Voice</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <FormField
            label="Brand Voice"
            htmlFor="brandVoice"
            error={errors.brandVoice?.message}
          >
            <Textarea
              id="brandVoice"
              rows={4}
              placeholder="Describe how this business should sound."
              {...register("brandVoice")}
            />
          </FormField>

          <FormField
            label="Offer and Audience Notes"
            htmlFor="offerAndAudienceNotes"
            error={errors.offerAndAudienceNotes?.message}
          >
            <Textarea
              id="offerAndAudienceNotes"
              rows={4}
              placeholder="Capture extra context about the audience, positioning, and offer."
              {...register("offerAndAudienceNotes")}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Goals & Offers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <FormField
            label="Main Goals"
            htmlFor="mainGoals"
            error={errors.mainGoals?.message}
          >
            <Textarea
              id="mainGoals"
              rows={4}
              placeholder="What should Mission Control help this business achieve next?"
              {...register("mainGoals")}
            />
          </FormField>

          <FormField
            label="Core Offers"
            htmlFor="coreOffers"
            error={errors.coreOffers?.message}
          >
            <Textarea
              id="coreOffers"
              rows={4}
              placeholder="List the main services, products, or programs this business sells."
              {...register("coreOffers")}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">
            AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <FormField
            label="System Prompt"
            htmlFor="systemPrompt"
            error={errors.systemPrompt?.message}
          >
            <Textarea
              id="systemPrompt"
              rows={7}
              placeholder="Describe how the main operator should think, prioritize, and respond."
              {...register("systemPrompt")}
            />
          </FormField>

          <FormField
            label="Guardrails"
            htmlFor="guardrails"
            error={errors.guardrails?.message}
          >
            <Textarea
              id="guardrails"
              rows={5}
              placeholder="Define what the AI should avoid, escalate, or double-check."
              {...register("guardrails")}
            />
          </FormField>

          <FormField
            label="Banned Claims"
            htmlFor="bannedClaims"
            error={errors.bannedClaims?.message}
          >
            <Textarea
              id="bannedClaims"
              rows={4}
              placeholder="List claims, promises, or topics the AI must avoid."
              {...register("bannedClaims")}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Safety & Models
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Safety Mode"
            htmlFor="safetyMode"
            error={errors.safetyMode?.message}
          >
            <Controller
              control={control}
              name="safetyMode"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger id="safetyMode">
                    <SelectValue placeholder="Choose a safety mode" />
                  </SelectTrigger>
                  <SelectContent>
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
            label="Primary Model"
            htmlFor="primaryModel"
            error={errors.primaryModel?.message}
          >
            <Controller
              control={control}
              name="primaryModel"
              render={({ field }) => (
                <Select
                  value={field.value || SYSTEM_DEFAULT_MODEL}
                  onValueChange={(value) =>
                    field.onChange(value === SYSTEM_DEFAULT_MODEL ? "" : value)
                  }
                >
                  <SelectTrigger id="primaryModel">
                    <SelectValue placeholder="Choose a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
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
            label="Fallback Model"
            htmlFor="fallbackModel"
            error={errors.fallbackModel?.message}
          >
            <Controller
              control={control}
              name="fallbackModel"
              render={({ field }) => (
                <Select
                  value={field.value || SYSTEM_DEFAULT_MODEL}
                  onValueChange={(value) =>
                    field.onChange(value === SYSTEM_DEFAULT_MODEL ? "" : value)
                  }
                >
                  <SelectTrigger id="fallbackModel">
                    <SelectValue placeholder="Choose a fallback model" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
                      <SelectItem key={`${option.value}-fallback`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </CardContent>
      </Card>
    </div>
  );

  const content = mode === "edit" ? editContent : (
    <div className="space-y-6">
      {showDetails ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Tell us about your business
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormField
              label="Business Name"
              htmlFor="name"
              error={errors.name?.message}
            >
              <Input
                id="name"
                placeholder="e.g. Horizon Leadership Coaching"
                {...register("name")}
              />
            </FormField>

            {showForexDesk ? (
              <>
                <div className="rounded-lg border border-state-warning/30 bg-state-warning/5 px-4 py-3">
                  <div className="text-[13px] font-medium text-state-warning">
                    This template requires a declared jurisdiction
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
                    The desk enforces your jurisdiction&apos;s broker rules,
                    leverage caps, and risk-disclosure wording as hard
                    constraints. You can change this later only via a
                    super-admin action. Pick carefully.
                  </p>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
                    <strong className="text-ink-primary">Not financial advice.</strong>{" "}
                    Leveraged FX can produce rapid losses. Most retail FX
                    traders lose money. This template is a disciplined
                    research and ops system, not a profit machine.
                  </p>
                </div>

                <FormField
                  label="Your jurisdiction"
                  htmlFor="jurisdiction"
                  error={errors.jurisdiction?.message}
                >
                  <Controller
                    control={control}
                    name="jurisdiction"
                    render={({ field }) => (
                      <div className="grid gap-2">
                        {jurisdictionOptions.map((option) => {
                          const selected = field.value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
                              className={cn(
                                "rounded-md border px-3 py-3 text-left transition-colors",
                                selected
                                  ? "border-steel/60 bg-steel/10"
                                  : "border-line-subtle bg-bg-surface-2/40 hover:border-line"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-[13px] font-medium text-ink-primary">
                                  {option.label}
                                </div>
                                <span className="font-mono text-[10.5px] text-ink-muted">
                                  {option.value}
                                </span>
                              </div>
                              <div className="mt-1 text-[11.5px] leading-5 text-ink-secondary">
                                {option.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                </FormField>
              </>
            ) : null}

            {showBusinessBuilder ? (
              <>
                <FormField
                  label="What does your business do?"
                  htmlFor="templateAnswers.businessDescription"
                  error={errors.templateAnswers?.businessDescription?.message}
                >
                  <Textarea
                    id="templateAnswers.businessDescription"
                    rows={4}
                    placeholder="e.g. I run a coaching business helping executives reduce stress and improve leadership."
                    {...register("templateAnswers.businessDescription")}
                  />
                </FormField>

                <FormField
                  label="Who are your ideal customers?"
                  htmlFor="templateAnswers.idealCustomers"
                  error={errors.templateAnswers?.idealCustomers?.message}
                >
                  <Textarea
                    id="templateAnswers.idealCustomers"
                    rows={4}
                    placeholder="e.g. Mid-level managers at tech companies, 30-50 years old."
                    {...register("templateAnswers.idealCustomers")}
                  />
                </FormField>

                <FormField
                  label="What are your main goals right now?"
                  htmlFor="templateAnswers.mainGoalsRightNow"
                  error={errors.templateAnswers?.mainGoalsRightNow?.message}
                >
                  <Textarea
                    id="templateAnswers.mainGoalsRightNow"
                    rows={4}
                    placeholder="e.g. Get 5 new clients this month, grow my email list."
                    {...register("templateAnswers.mainGoalsRightNow")}
                  />
                </FormField>

                <FormField
                  label="What should your AI operator NEVER say or do?"
                  htmlFor="templateAnswers.neverSayOrDo"
                  error={errors.templateAnswers?.neverSayOrDo?.message}
                >
                  <Textarea
                    id="templateAnswers.neverSayOrDo"
                    rows={4}
                    placeholder="e.g. Never make promises about income. Never share competitor names."
                    {...register("templateAnswers.neverSayOrDo")}
                  />
                </FormField>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-white">
                    How hands-on should your AI be?
                  </Label>
                  <Controller
                    control={control}
                    name="templateAnswers.handsOnPreference"
                    render={({ field }) => (
                      <div className="grid gap-3">
                        {businessBuilderHandsOnOptions.map((option) => {
                          const selected = field.value === option.value;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => field.onChange(option.value)}
                              className={cn(
                                "rounded-xl border px-4 py-4 text-left transition-all",
                                selected
                                  ? "border-steel bg-steel/10 shadow-brand-sm"
                                  : "border-line-subtle bg-bg-surface-2/40 hover:border-line"
                              )}
                            >
                              <div className="text-sm font-medium text-white">
                                {option.label}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-ink-secondary">
                                {option.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                  {errors.templateAnswers?.handsOnPreference?.message ? (
                    <p className="text-xs text-steel-bright">
                      {errors.templateAnswers.handsOnPreference.message}
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <FormField
                  label="Summary"
                  htmlFor="summary"
                  helpText="Your agents read this to understand the business. Be specific about what you do and who you serve."
                  error={errors.summary?.message}
                >
                  <Textarea
                    id="summary"
                    rows={4}
                    placeholder="e.g. We help small e-commerce brands increase repeat purchases through email marketing and customer retention strategies."
                    {...register("summary")}
                  />
                </FormField>

                <FormField
                  label="Brand Voice"
                  htmlFor="brandVoice"
                  helpText="Your agents will match this tone in every message, email, and content piece they create."
                  error={errors.brandVoice?.message}
                >
                  <Textarea
                    id="brandVoice"
                    rows={4}
                    placeholder="e.g. Warm but professional. Use simple language. Never be salesy or pushy. Sound like a trusted advisor, not a corporation."
                    {...register("brandVoice")}
                  />
                </FormField>

                <FormField
                  label="Main Goals"
                  htmlFor="mainGoals"
                  helpText="Your agents prioritize work based on these goals. Update them anytime your focus shifts."
                  error={errors.mainGoals?.message}
                >
                  <Textarea
                    id="mainGoals"
                    rows={4}
                    placeholder="e.g. Get 10 new clients this month. Launch the email welcome sequence. Build a referral program for existing customers."
                    {...register("mainGoals")}
                  />
                </FormField>

                <FormField
                  label="Core Offers"
                  htmlFor="coreOffers"
                  helpText="Your agents reference these when discussing your products or services with customers and in content."
                  error={errors.coreOffers?.message}
                >
                  <Textarea
                    id="coreOffers"
                    rows={4}
                    placeholder="e.g. 1:1 coaching ($2,500/month), Group mastermind ($997/quarter), Self-paced course ($297 one-time)."
                    {...register("coreOffers")}
                  />
                </FormField>

                <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-4 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-white">
                      Operator + escalation identity
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">
                      Templates render these as <code>{`{{operatorName}}`}</code>,{" "}
                      <code>{`{{operatorPhone}}`}</code>,{" "}
                      <code>{`{{operatorEmail}}`}</code>,{" "}
                      <code>{`{{escalationContactName}}`}</code>, and{" "}
                      <code>{`{{escalationContactPhone}}`}</code>. Edits flow
                      through to every agent on this business on the next turn.
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      label="Operator name"
                      htmlFor="operatorName"
                      helpText="The person running this business — used in agent prompts to address you by name."
                      error={errors.operatorName?.message}
                    >
                      <Input
                        id="operatorName"
                        placeholder="e.g. Brandon"
                        {...register("operatorName")}
                      />
                    </FormField>

                    <FormField
                      label="Operator phone"
                      htmlFor="operatorPhone"
                      helpText="Where escalations route by SMS or call. Optional."
                      error={errors.operatorPhone?.message}
                    >
                      <Input
                        id="operatorPhone"
                        placeholder="e.g. +1 555 555 5555"
                        {...register("operatorPhone")}
                      />
                    </FormField>

                    <FormField
                      label="Operator email"
                      htmlFor="operatorEmail"
                      helpText="Where agents email you for approvals and digests."
                      error={errors.operatorEmail?.message}
                    >
                      <Input
                        id="operatorEmail"
                        type="email"
                        placeholder="you@example.com"
                        {...register("operatorEmail")}
                      />
                    </FormField>

                    <FormField
                      label="Escalation contact name"
                      htmlFor="escalationContactName"
                      helpText="External handoff — a CPA, attorney, or specialist agents direct prospects to when they hit a hard limit."
                      error={errors.escalationContactName?.message}
                    >
                      <Input
                        id="escalationContactName"
                        placeholder="e.g. Dave"
                        {...register("escalationContactName")}
                      />
                    </FormField>

                    <FormField
                      label="Escalation contact phone"
                      htmlFor="escalationContactPhone"
                      helpText="Phone number paired with the escalation contact name above."
                      error={errors.escalationContactPhone?.message}
                    >
                      <Input
                        id="escalationContactPhone"
                        placeholder="e.g. (410) 404-2880"
                        {...register("escalationContactPhone")}
                      />
                    </FormField>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showAdvanced ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Advanced AI configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormField
              label="System Prompt"
              htmlFor="systemPrompt"
              helpText="High-level instructions for how your agents should think and operate. The template provides a strong default — customize only if needed."
              error={errors.systemPrompt?.message}
            >
              <Textarea
                id="systemPrompt"
                rows={7}
                placeholder="Describe how the main operator should think, prioritize, and respond."
                {...register("systemPrompt")}
              />
            </FormField>

            <FormField
              label="Guardrails"
              htmlFor="guardrails"
              helpText="Your agents will follow these rules strictly. Use this to prevent mistakes that matter to your business."
              error={errors.guardrails?.message}
            >
              <Textarea
                id="guardrails"
                rows={5}
                placeholder="e.g. Never guarantee results or timeframes. Always get approval before sending emails to customers. Never discuss competitor pricing."
                {...register("guardrails")}
              />
            </FormField>

            <FormField
              label="Offer and Audience Notes"
              htmlFor="offerAndAudienceNotes"
              helpText="Extra context about your target audience, positioning, and how your offer works. Agents use this for marketing and sales decisions."
              error={errors.offerAndAudienceNotes?.message}
            >
              <Textarea
                id="offerAndAudienceNotes"
                rows={4}
                placeholder="e.g. Our ideal customer is a busy founder who wants done-for-you marketing. They typically find us through LinkedIn or referrals. Average deal size is $3,000/month."
                {...register("offerAndAudienceNotes")}
              />
            </FormField>

            <FormField
              label="Banned Claims"
              htmlFor="bannedClaims"
              helpText="Agents will never state, imply, or reference anything on this list. Critical for compliance and brand safety."
              error={errors.bannedClaims?.message}
            >
              <Textarea
                id="bannedClaims"
                rows={4}
                placeholder="e.g. No income guarantees. No medical advice. Never claim to be the #1 provider. Never mention specific competitor names."
                {...register("bannedClaims")}
              />
            </FormField>

            <div className="grid gap-5 md:grid-cols-2">
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
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="safetyMode">
                        <SelectValue placeholder="Choose a safety mode" />
                      </SelectTrigger>
                      <SelectContent>
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
                label="Primary Model"
                htmlFor="primaryModel"
                helpText="Leave blank to inherit the system default model."
                error={errors.primaryModel?.message}
              >
                <Controller
                  control={control}
                  name="primaryModel"
                  render={({ field }) => (
                    <Select
                      value={field.value || SYSTEM_DEFAULT_MODEL}
                      onValueChange={(value) =>
                        field.onChange(
                          value === SYSTEM_DEFAULT_MODEL ? "" : value
                        )
                      }
                    >
                      <SelectTrigger id="primaryModel">
                        <SelectValue placeholder="Choose a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>

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
          {loading ? "Saving..." : submitLabel ?? "Save Business"}
        </Button>
      </div>
    </form>
  );
}
