"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  type WorkflowFormValues,
  defaultWorkflowFormValues,
  validateWorkflowBehaviorStep,
  validateWorkflowTriggerStep
} from "@/components/admin/workflows/schema";
import { WorkflowForm } from "@/components/admin/workflows/WorkflowForm";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { formatScheduleDisplay } from "@/lib/workflows/schedule-parser";

type CreateWorkflowClientProps = {
  businesses: Array<{
    id: string;
    name: string;
  }>;
  agents: Array<{
    id: string;
    displayName: string;
    emoji: string | null;
    businessId: string | null;
    type: string;
  }>;
  integrationStatus: {
    gmail: boolean;
    crm: boolean;
    comments: boolean;
  };
  defaultValues?: Partial<WorkflowFormValues>;
  duplicatedFromName?: string | null;
};

const steps = [
  { id: 1, label: "Trigger & Business" },
  { id: 2, label: "Output & Behavior" },
  { id: 3, label: "Review & Create" }
] as const;

export function CreateWorkflowClient({
  businesses,
  agents,
  integrationStatus,
  defaultValues,
  duplicatedFromName
}: CreateWorkflowClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<(typeof steps)[number]["id"]>(1);
  const [values, setValues] = useState<WorkflowFormValues>({
    ...defaultWorkflowFormValues,
    ...defaultValues
  });
  const [creating, setCreating] = useState(false);

  const selectedBusiness = businesses.find((business) => business.id === values.businessId);
  const selectedAgent = agents.find((agent) => agent.id === values.agentId);

  function handleNextFromTrigger() {
    const result = validateWorkflowTriggerStep(values);

    if (!result.success) {
      toast.error("Finish the trigger and schedule details before continuing.");
      return;
    }

    setStep(2);
  }

  function handleNextFromBehavior() {
    const result = validateWorkflowBehaviorStep(values);

    if (!result.success) {
      toast.error("Add the workflow name, output, and approval settings before continuing.");
      return;
    }

    setStep(3);
  }

  async function handleCreate() {
    try {
      setCreating(true);

      const response = await fetchWithCsrf("/api/admin/workflows", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          safetyMode: values.overrideSafetyMode ? values.safetyMode : ""
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        workflow?: { id: string };
      };

      if (!response.ok || !payload.workflow) {
        throw new Error(payload.error ?? "Unable to create workflow.");
      }

      toast.success("Workflow created.");
      router.push(`/admin/workflows/${payload.workflow.id}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create workflow."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Create Workflow"
        description="Define when something happens and what the agent should do next."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/workflows">Back to Workflows</Link>
          </Button>
        }
      />

      {duplicatedFromName ? (
        <div className="rounded-2xl border border-steel/25 bg-steel/10 px-4 py-4 text-sm text-ink-primary">
          Duplicating settings from {duplicatedFromName}. Review the trigger, business assignment, and approval mode before creating the copy.
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-4 md:grid-cols-3">
        {steps.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border px-4 py-3 ${
              step === item.id
                ? "border-steel bg-steel/10"
                : step > item.id
                  ? "border-state-success/30 bg-state-success/10"
                  : "border-line-subtle bg-bg-surface-2/30"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
              Step {item.id}
            </div>
            <div className="mt-1 text-sm font-medium text-white">{item.label}</div>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <>
          <WorkflowForm
            mode="create"
            step="trigger"
            businesses={businesses}
            agents={agents}
            defaultValues={values}
            onValuesChange={setValues}
            onSubmit={() => undefined}
            integrationStatus={integrationStatus}
          />

          <div className="flex justify-end">
            <Button type="button" onClick={handleNextFromTrigger}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <WorkflowForm
            mode="create"
            step="behavior"
            businesses={businesses}
            agents={agents}
            defaultValues={values}
            onValuesChange={setValues}
            onSubmit={() => undefined}
            integrationStatus={integrationStatus}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button type="button" onClick={handleNextFromBehavior}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <Card className="border-line-subtle bg-bg-surface">
            <CardHeader>
              <CardTitle className="text-xl text-white">Review & Create</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-line-subtle bg-bg-surface-2/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white">
                      Workflow Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-ink-primary">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                        Name
                      </div>
                      <div className="mt-1 text-white">{values.name}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                        Business
                      </div>
                      <div className="mt-1 text-white">
                        {selectedBusiness?.name || "Not selected"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                        Agent
                      </div>
                      <div className="mt-1 text-white">
                        {selectedAgent
                          ? `${selectedAgent.emoji || "Agent"} ${selectedAgent.displayName}`
                          : "Any available agent"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                        Schedule
                      </div>
                      <div className="mt-1 text-white">
                        {formatScheduleDisplay(values)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-line-subtle bg-bg-surface-2/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white">
                      What will happen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-ink-primary">
                      <CheckCircle2 className="h-4 w-4 text-state-success" />
                      <span>Trigger: {values.trigger.replaceAll("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-primary">
                      <CheckCircle2 className="h-4 w-4 text-state-success" />
                      <span>Output: {values.output.replaceAll("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-primary">
                      <CheckCircle2 className="h-4 w-4 text-state-success" />
                      <span>Approval: {values.approvalMode.replaceAll("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-primary">
                      <CheckCircle2 className="h-4 w-4 text-state-success" />
                      <span>
                        Safety:{" "}
                        {values.overrideSafetyMode
                          ? values.safetyMode || "Business default"
                          : "Business default"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {values.trigger === "webhook" ? (
                <div className="rounded-2xl border border-state-warning/25 bg-state-warning/10 px-4 py-4 text-sm leading-6 text-ink-primary">
                  After creating, you&apos;ll see your webhook URL on the workflow detail page. Keep your signing secret safe.
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full"
                onClick={() => void handleCreate()}
                disabled={creating}
              >
                {creating ? "Creating Workflow..." : "Create Workflow"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-start">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
