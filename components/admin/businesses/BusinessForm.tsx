"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  businessBuilderHandsOnOptions,
  businessFormSchema,
  defaultBusinessFormValues,
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
      {helpText ? <p className="text-xs text-slate-500">{helpText}</p> : null}
      {error ? <p className="text-xs text-brand-primary">{error}</p> : null}
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
  const showDetails = step === "details" || step === "full";
  const showAdvanced = step === "advanced" || step === "full";

  const editContent = (
    <div className="space-y-6">
      <Card className="border-ghost-border bg-ghost-surface">
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

      <Card className="border-ghost-border bg-ghost-surface">
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

      <Card className="border-ghost-border bg-ghost-surface">
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

      <Card className="border-ghost-border bg-ghost-surface">
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

      <Card className="border-ghost-border bg-ghost-surface">
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
        <Card className="border-ghost-border bg-ghost-surface">
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
                                  ? "border-brand-primary bg-brand-primary/10 shadow-brand-sm"
                                  : "border-ghost-border bg-ghost-raised/40 hover:border-ghost-border-strong"
                              )}
                            >
                              <div className="text-sm font-medium text-white">
                                {option.label}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-slate-400">
                                {option.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  />
                  {errors.templateAnswers?.handsOnPreference?.message ? (
                    <p className="text-xs text-brand-primary">
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
                  helpText="A short operating summary for this business."
                  error={errors.summary?.message}
                >
                  <Textarea
                    id="summary"
                    rows={4}
                    placeholder="A short summary of what this business does and what matters most right now."
                    {...register("summary")}
                  />
                </FormField>

                <FormField
                  label="Brand Voice"
                  htmlFor="brandVoice"
                  helpText="Describe how this business should sound."
                  error={errors.brandVoice?.message}
                >
                  <Textarea
                    id="brandVoice"
                    rows={4}
                    placeholder="e.g. Warm, direct, practical, and calm."
                    {...register("brandVoice")}
                  />
                </FormField>

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
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showAdvanced ? (
        <Card className="border-ghost-border bg-ghost-surface">
          <CardHeader>
            <CardTitle className="text-base text-white">
              Advanced AI configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <FormField
              label="System Prompt"
              htmlFor="systemPrompt"
              helpText="Leave blank to use the template default."
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
              label="Offer and Audience Notes"
              htmlFor="offerAndAudienceNotes"
              error={errors.offerAndAudienceNotes?.message}
            >
              <Textarea
                id="offerAndAudienceNotes"
                rows={4}
                placeholder="Capture extra context about who this serves and how the offer works."
                {...register("offerAndAudienceNotes")}
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
