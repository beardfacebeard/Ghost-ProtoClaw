import type { KnowledgeCategoryKey } from "@/lib/brain/knowledge";

export type WorkflowTriggerKey =
  | "manual"
  | "scheduled"
  | "webhook"
  | "new_email"
  | "new_lead"
  | "new_comment";

export type WorkflowOutputKey =
  | "chat"
  | "telegram"
  | "report"
  | "draft"
  | "crm_note"
  | "content_queue";

export type WorkflowApprovalMode =
  | "auto"
  | "notify"
  | "approve_first"
  | "review_after";

export type WorkflowScheduleMode = "cron" | "every" | "definition_only";

export type WorkflowLibraryItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  source: string;
  icon?: string;
  trigger: WorkflowTriggerKey;
  output: WorkflowOutputKey;
  outputs?: WorkflowOutputKey[];
  scheduleMode?: WorkflowScheduleMode;
  frequency?: string;
  cronExpression?: string;
  timezone?: string;
  approvalMode: WorkflowApprovalMode;
};

export type KnowledgeLibraryItem = {
  id: string;
  title: string;
  category: KnowledgeCategoryKey;
  content: string;
  tags: string[];
  source: string;
  description?: string;
  /** Default loading tier when this item gets installed to a business.
   *  Users can change it afterwards in /admin/knowledge. Defaults to
   *  "warm" when undefined for back-compat. */
  tier?: "hot" | "warm" | "cold";
};
