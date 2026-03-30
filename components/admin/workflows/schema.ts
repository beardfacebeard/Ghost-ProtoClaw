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

export const triggerOptions = [
  {
    value: "manual",
    label: "Manual",
    icon: "▶",
    description: "Run on demand from the dashboard"
  },
  {
    value: "scheduled",
    label: "Scheduled",
    icon: "🕐",
    description: "Runs on a schedule or interval"
  },
  {
    value: "webhook",
    label: "Webhook",
    icon: "🔗",
    description: "HTTP POST event from another provider"
  },
  {
    value: "new_email",
    label: "New Email",
    icon: "📧",
    description: "Triggered when email arrives"
  },
  {
    value: "new_lead",
    label: "New Lead",
    icon: "👤",
    description: "Triggered when a CRM lead arrives"
  },
  {
    value: "new_comment",
    label: "New Comment",
    icon: "💬",
    description: "Triggered on a new review or comment"
  }
] as const;

export const outputOptions = [
  {
    value: "chat",
    label: "Chat",
    icon: "💬",
    description: "Conversational response"
  },
  {
    value: "report",
    label: "Report",
    icon: "📄",
    description: "Structured document or analysis"
  },
  {
    value: "draft",
    label: "Draft",
    icon: "✍️",
    description: "Draft content for review"
  },
  {
    value: "crm_note",
    label: "CRM Note",
    icon: "👥",
    description: "Add a note to a CRM record"
  },
  {
    value: "content_queue",
    label: "Content Queue",
    icon: "📅",
    description: "Add an item to the content schedule"
  }
] as const;

export const approvalModeOptions = [
  {
    value: "auto",
    label: "Auto-run",
    description: "Run immediately when triggered. No approval needed."
  },
  {
    value: "notify",
    label: "Notify only",
    description: "Run automatically and notify you of the result."
  },
  {
    value: "approve_first",
    label: "Approve first",
    description:
      "Create an approval request before running. You review it first."
  },
  {
    value: "review_after",
    label: "Review after",
    description:
      "Run automatically but flag the output for your review afterward."
  }
] as const;

export const scheduleModeOptions = [
  {
    value: "every",
    label: "Every interval"
  },
  {
    value: "cron",
    label: "Cron expression"
  },
  {
    value: "definition_only",
    label: "Definition only"
  }
] as const;

export const commonTimezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney"
] as const;

const workflowFormBaseSchema = z.object({
  businessId: z.string().trim().min(1, "Choose a business."),
  agentId: optionalText,
  name: z.string().trim().min(2, "Workflow name is required.").max(100),
  description: optionalText,
  trigger: z.enum([
    "manual",
    "scheduled",
    "webhook",
    "new_email",
    "new_lead",
    "new_comment"
  ]),
  output: z.enum(["chat", "report", "draft", "crm_note", "content_queue"]),
  scheduleMode: z
    .enum(["cron", "every", "definition_only"])
    .optional(),
  frequency: optionalText,
  cronExpression: optionalText,
  timezone: optionalText,
  approvalMode: z.enum(["auto", "notify", "approve_first", "review_after"]),
  safetyMode: optionalText,
  actionType: optionalText,
  enabled: z.boolean().default(true),
  overrideSafetyMode: z.boolean().default(false)
});

export const workflowFormSchema = workflowFormBaseSchema.superRefine(
  (values, context) => {
    if (values.trigger === "scheduled") {
      if (!values.scheduleMode) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduleMode"],
          message: "Choose how this schedule should be defined."
        });
      }

      if (values.scheduleMode === "cron" && !values.cronExpression) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cronExpression"],
          message: "Add a cron expression."
        });
      }

      if (values.scheduleMode === "every" && !values.frequency) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["frequency"],
          message: "Describe how often this workflow should run."
        });
      }
    }
  }
);

export const workflowCreateApiSchema = workflowFormBaseSchema
  .omit({
    overrideSafetyMode: true
  })
  .superRefine((values, context) => {
    if (values.trigger === "scheduled") {
      if (!values.scheduleMode) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduleMode"],
          message: "Choose how this schedule should be defined."
        });
      }

      if (values.scheduleMode === "cron" && !values.cronExpression) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cronExpression"],
          message: "Add a cron expression."
        });
      }

      if (values.scheduleMode === "every" && !values.frequency) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["frequency"],
          message: "Describe how often this workflow should run."
        });
      }
    }
  });

export const workflowUpdateApiSchema = workflowFormBaseSchema
  .omit({
    overrideSafetyMode: true
  })
  .partial();

export type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

const workflowTriggerStepSchema = z
  .object({
    businessId: z.string().trim().min(1, "Choose a business."),
    trigger: z.enum([
      "manual",
      "scheduled",
      "webhook",
      "new_email",
      "new_lead",
      "new_comment"
    ]),
    scheduleMode: z
      .enum(["cron", "every", "definition_only"])
      .optional(),
    frequency: optionalText,
    cronExpression: optionalText,
    timezone: optionalText
  })
  .superRefine((values, context) => {
    if (values.trigger !== "scheduled") {
      return;
    }

    if (!values.scheduleMode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduleMode"],
        message: "Choose how this schedule should be defined."
      });
    }

    if (values.scheduleMode === "cron" && !values.cronExpression) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cronExpression"],
        message: "Add a cron expression."
      });
    }

    if (values.scheduleMode === "every" && !values.frequency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frequency"],
        message: "Describe how often this workflow should run."
      });
    }
  });

const workflowBehaviorStepSchema = z.object({
  businessId: z.string().trim().min(1, "Choose a business."),
  name: z.string().trim().min(2, "Workflow name is required.").max(100),
  output: z.enum(["chat", "report", "draft", "crm_note", "content_queue"]),
  approvalMode: z.enum(["auto", "notify", "approve_first", "review_after"]),
  overrideSafetyMode: z.boolean().default(false),
  safetyMode: optionalText
});

export const defaultWorkflowFormValues: WorkflowFormValues = {
  businessId: "",
  agentId: "",
  name: "",
  description: "",
  trigger: "manual",
  output: "chat",
  scheduleMode: undefined,
  frequency: "",
  cronExpression: "",
  timezone: "UTC",
  approvalMode: "approve_first",
  safetyMode: "",
  actionType: "",
  enabled: true,
  overrideSafetyMode: false
};

export function validateWorkflowTriggerStep(
  values: Partial<WorkflowFormValues>
) {
  return workflowTriggerStepSchema.safeParse({
    businessId: values.businessId,
    trigger: values.trigger,
    scheduleMode: values.scheduleMode,
    frequency: values.frequency,
    cronExpression: values.cronExpression,
    timezone: values.timezone
  });
}

export function validateWorkflowBehaviorStep(
  values: Partial<WorkflowFormValues>
) {
  return workflowBehaviorStepSchema.safeParse({
    businessId: values.businessId,
    name: values.name,
    output: values.output,
    approvalMode: values.approvalMode,
    overrideSafetyMode: values.overrideSafetyMode,
    safetyMode: values.overrideSafetyMode ? values.safetyMode : undefined
  });
}
