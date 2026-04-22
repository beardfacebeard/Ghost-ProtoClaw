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

/**
 * Jurisdictions the Forex Research & Execution Desk template supports.
 * Declared at business creation, drives broker availability, leverage caps,
 * and the wording of the regulatory risk disclosure for that jurisdiction.
 * "OTHER" is the escape hatch — operator self-certifies and accepts
 * responsibility for their jurisdiction's rules.
 */
export const jurisdictionOptions = [
  {
    value: "US",
    label: "United States",
    description:
      "CFTC / NFA. Retail CFDs banned — spot FX through NFA-regulated brokers or CME FX futures only. Leverage 50:1 majors / 20:1 minors."
  },
  {
    value: "UK",
    label: "United Kingdom",
    description:
      "FCA. Retail CFDs allowed with 30:1 majors leverage cap. Negative balance protection required."
  },
  {
    value: "EU",
    label: "European Union",
    description:
      "ESMA + national regulator. Retail CFDs allowed, 30:1 majors cap, mandatory risk warnings."
  },
  {
    value: "AU",
    label: "Australia",
    description:
      "ASIC. Retail CFDs allowed, 30:1 majors cap, margin close-out and negative balance protection."
  },
  {
    value: "CA",
    label: "Canada",
    description:
      "CIRO (formerly IIROC). Limited retail FX broker availability."
  },
  {
    value: "SG",
    label: "Singapore",
    description:
      "MAS. Capital markets services licensing, wholesale-FX ecosystem."
  },
  {
    value: "JP",
    label: "Japan",
    description:
      "FFAJ. Domestic broker regime, 25x individual leverage cap."
  },
  {
    value: "OTHER",
    label: "Other — self-certified",
    description:
      "Your jurisdiction's rules apply — you certify you are permitted to trade leveraged FX where you live. Flagged to super-admin for review."
  }
] as const;

/**
 * Trading execution tier for the Forex template. Defaults to "research" so
 * a fresh business never fires a live order. Upgrading the tier requires
 * explicit consent flows enforced server-side.
 */
export const tradingModeOptions = [
  {
    value: "research",
    label: "Research",
    description:
      "Briefings, backtests, and journals only. No orders are placed anywhere. Default tier."
  },
  {
    value: "paper",
    label: "Paper",
    description:
      "Orders route to broker demo accounts only. Real-time fills simulated with empirical slippage. Zero capital at risk."
  },
  {
    value: "live_approval",
    label: "Live with per-trade approval",
    description:
      "Orders queue in Approvals and fire only on explicit human click. The desk never acts autonomously in this mode."
  }
] as const;

/**
 * Deal execution tier for the Dealhawk Empire template. Defaults to
 * "research" so a fresh business never fires seller outreach or generates
 * a binding contract. Upgrading the tier requires explicit consent flows
 * enforced server-side in app/api/admin/businesses/[id]/deal-mode/route.ts.
 */
export const dealModeOptions = [
  {
    value: "research",
    label: "Research",
    description:
      "Signal building, KB deep-dives, underwriting memos, and research digests only. No seller outreach. No binding contracts. Default tier."
  },
  {
    value: "outreach",
    label: "Outreach",
    description:
      "TCPA-compliant seller contact (SMS, mail, cold calls) unlocks. Every touch goes through the approval queue until autopilot is enabled. Binding contracts still blocked."
  },
  {
    value: "contract",
    label: "Contract",
    description:
      "Binding purchase agreements, assignments, Sub-To packages, LOIs, and disposition blasts unlock — but only for property states where an attorney is on file. Re-gated per deal."
  }
] as const;

export function getDealModeLabel(value?: string | null) {
  return (
    dealModeOptions.find((option) => option.value === value)?.label ??
    dealModeOptions[0].label
  );
}

export function getDealModeDescription(value?: string | null) {
  return (
    dealModeOptions.find((option) => option.value === value)?.description ??
    dealModeOptions[0].description
  );
}

/**
 * Full 50 + DC list for state-selector dropdowns in the Dealhawk attorney
 * form. Label is the full state name, value is the 2-letter USPS code.
 */
export const usStateOptions = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" }
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
  jurisdiction: optionalText,
  tradingMode: optionalText,
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
  jurisdiction: "",
  tradingMode: "research",
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

export function getJurisdictionLabel(value?: string | null) {
  if (!value) return "Not declared";
  return (
    jurisdictionOptions.find((option) => option.value === value)?.label ??
    value
  );
}

export function getTradingModeLabel(value?: string | null) {
  return (
    tradingModeOptions.find((option) => option.value === value)?.label ??
    "Research"
  );
}

export function getTradingModeDescription(value?: string | null) {
  return (
    tradingModeOptions.find((option) => option.value === value)?.description ??
    tradingModeOptions[0].description
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

  if (templateId === "forex_trading_desk") {
    return z
      .object({
        name: z.string().trim().min(2).max(80),
        jurisdiction: z.enum([
          "US",
          "UK",
          "EU",
          "AU",
          "CA",
          "SG",
          "JP",
          "OTHER"
        ], {
          errorMap: () => ({
            message: "Declare your jurisdiction — the desk needs this to enforce broker and leverage rules."
          })
        })
      })
      .safeParse({
        name: values.name,
        jurisdiction: values.jurisdiction
      });
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
