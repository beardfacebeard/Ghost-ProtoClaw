import { z } from "zod";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().optional()
);

export const businessBuilderHandsOnOptions = [
  {
    value: "ask_first",
    label: "Ask me before doing anything important",
    description: "Best for careful review before customer-facing actions."
  },
  {
    value: "balanced",
    label: "Use good judgment, let me know what it did",
    description: "A balanced default for safe work with human visibility."
  },
  {
    value: "autonomous",
    label: "Handle everything automatically",
    description: "Best for experienced operators who want high autonomy."
  }
] as const;

export const safetyModeOptions = [
  {
    value: "ask_before_acting",
    label: "Ask Before Acting",
    description: "Runs safe tasks and asks before anything high impact."
  },
  {
    value: "auto_low_risk",
    label: "Balanced",
    description: "Uses good judgment on low-risk tasks and surfaces what it did."
  },
  {
    value: "full_auto",
    label: "Autonomous",
    description: "Runs everything automatically."
  }
] as const;

export const modelOptions = [
  { value: "__system_default__", label: "Use system default" },
  { value: "openrouter/auto", label: "OpenRouter Auto" },
  { value: "openrouter/free", label: "OpenRouter Free Tier" },
  { value: "anthropic/claude-3-5-sonnet", label: "Anthropic Claude 3.5 Sonnet" },
  { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" }
] as const;

export const templateAnswersSchema = z
  .object({
    businessDescription: optionalText,
    idealCustomers: optionalText,
    mainGoalsRightNow: optionalText,
    neverSayOrDo: optionalText,
    handsOnPreference: z
      .enum(["ask_first", "balanced", "autonomous"])
      .optional()
  })
  .partial()
  .optional();

export const businessFormSchema = z.object({
  name: z.string().trim().min(2, "Business name is required.").max(80),
  summary: optionalText,
  brandVoice: optionalText,
  mainGoals: optionalText,
  coreOffers: optionalText,
  offerAndAudienceNotes: optionalText,
  systemPrompt: optionalText,
  guardrails: optionalText,
  bannedClaims: optionalText,
  safetyMode: optionalText,
  primaryModel: optionalText,
  fallbackModel: optionalText,
  status: optionalText,
  templateId: optionalText,
  templateAnswers: templateAnswersSchema
});

export const businessCreateApiSchema = businessFormSchema.extend({
  templateAnswers: templateAnswersSchema
});

export const businessUpdateApiSchema = businessFormSchema.omit({
  templateId: true,
  templateAnswers: true
}).partial();

export type BusinessFormValues = z.infer<typeof businessFormSchema>;

export const defaultBusinessFormValues: BusinessFormValues = {
  name: "",
  summary: "",
  brandVoice: "",
  mainGoals: "",
  coreOffers: "",
  offerAndAudienceNotes: "",
  systemPrompt: "",
  guardrails: "",
  bannedClaims: "",
  safetyMode: "auto_low_risk",
  primaryModel: "",
  fallbackModel: "",
  status: "planning",
  templateId: "",
  templateAnswers: {
    businessDescription: "",
    idealCustomers: "",
    mainGoalsRightNow: "",
    neverSayOrDo: "",
    handsOnPreference: "balanced"
  }
};

export function getSafetyModeLabel(value?: string | null) {
  return (
    safetyModeOptions.find((option) => option.value === value)?.label ??
    "System Default"
  );
}

export function validateBusinessDetailsStep(
  values: Partial<BusinessFormValues>,
  templateId?: string | null
) {
  const nameCheck = z.string().trim().min(2).max(80).safeParse(values.name);

  if (!nameCheck.success) {
    return nameCheck;
  }

  if (templateId !== "business_builder") {
    return z.object({ name: z.string() }).safeParse({ name: values.name });
  }

  return z
    .object({
      name: z.string().trim().min(2).max(80),
      templateAnswers: z.object({
        businessDescription: z.string().trim().min(10),
        idealCustomers: z.string().trim().min(5),
        mainGoalsRightNow: z.string().trim().min(5),
        neverSayOrDo: z.string().trim().min(5),
        handsOnPreference: z.enum(["ask_first", "balanced", "autonomous"])
      })
    })
    .safeParse({
      name: values.name,
      templateAnswers: {
        businessDescription: values.templateAnswers?.businessDescription,
        idealCustomers: values.templateAnswers?.idealCustomers,
        mainGoalsRightNow: values.templateAnswers?.mainGoalsRightNow,
        neverSayOrDo: values.templateAnswers?.neverSayOrDo,
        handsOnPreference: values.templateAnswers?.handsOnPreference
      }
    });
}
