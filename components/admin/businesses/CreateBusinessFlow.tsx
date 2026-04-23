"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { BusinessForm } from "@/components/admin/businesses/BusinessForm";
import {
  defaultBusinessFormValues,
  type BusinessFormValues,
  validateBusinessDetailsStep
} from "@/components/admin/businesses/schema";
import { TemplateSelector } from "@/components/admin/businesses/TemplateSelector";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { getBusinessTemplateById } from "@/lib/templates/business-templates";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, label: "Choose Template" },
  { id: 2, label: "Business Details" },
  { id: 3, label: "AI Configuration" },
  { id: 4, label: "Review & Create" }
] as const;

function applyBusinessName(template: string, businessName: string) {
  return template.replaceAll("{{businessName}}", businessName || "this business");
}

function buildTemplateDefaults(
  templateId: string,
  currentValues: BusinessFormValues
): BusinessFormValues {
  const template = getBusinessTemplateById(templateId);

  if (!template) {
    return currentValues;
  }

  return {
    ...currentValues,
    templateId: template.id,
    summary: currentValues.summary || template.defaults.summary || "",
    brandVoice: currentValues.brandVoice || template.defaults.brandVoice || "",
    mainGoals: currentValues.mainGoals || template.defaults.mainGoals || "",
    safetyMode:
      currentValues.safetyMode || template.defaults.safetyMode || "auto_low_risk",
    primaryModel:
      currentValues.primaryModel || template.defaults.primaryModel || "",
    systemPrompt:
      currentValues.systemPrompt ||
      (template.systemPromptTemplate
        ? applyBusinessName(template.systemPromptTemplate, currentValues.name)
        : ""),
    guardrails:
      currentValues.guardrails ||
      (template.guardrailsTemplate
        ? applyBusinessName(template.guardrailsTemplate, currentValues.name)
        : "")
  };
}

type CreateBusinessFlowProps = {
  currentUserEmail: string;
};

export function CreateBusinessFlow({ currentUserEmail }: CreateBusinessFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<(typeof steps)[number]["id"]>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [values, setValues] = useState<BusinessFormValues>(defaultBusinessFormValues);
  const [creating, setCreating] = useState(false);

  const selectedTemplate = getBusinessTemplateById(selectedTemplateId);

  function handleSelectTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    setValues((current) => buildTemplateDefaults(templateId, current));
  }

  function handleNextFromDetails() {
    const result = validateBusinessDetailsStep(values, selectedTemplateId);

    if (!result.success) {
      toast.error(
        selectedTemplateId === "business_builder"
          ? "Please complete the business builder questions before continuing."
          : "Please add a business name before continuing."
      );
      return;
    }

    setStep(3);
  }

  async function handleCreateBusiness() {
    try {
      setCreating(true);

      const payload = {
        ...values,
        templateId: selectedTemplateId || "blank"
      };

      const response = await fetchWithCsrf("/api/admin/businesses", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const json = (await response.json()) as {
        error?: string;
        business?: { id: string };
      };

      if (!response.ok || !json.business) {
        throw new Error(json.error ?? "Unable to create business.");
      }

      toast.success("Business created! Starter content is ready.");
      router.push(`/admin/businesses/${json.business.id}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create business."
      );
    } finally {
      setCreating(false);
    }
  }

  const templateCounts = selectedTemplate
    ? {
        agents: selectedTemplate.starterAgents.length,
        workflows: selectedTemplate.starterWorkflows.length,
        knowledge: selectedTemplate.starterKnowledge.length
      }
    : {
        agents: 0,
        workflows: 0,
        knowledge: 0
      };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Create Business"
        description="Set up a business, choose a starter, and generate the first operating layer."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/businesses">Back to Businesses</Link>
          </Button>
        }
      />

      <div className="grid gap-3 rounded-2xl border border-line-subtle bg-bg-surface p-4 md:grid-cols-4">
        {steps.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-xl border px-4 py-3",
              step === item.id
                ? "border-steel bg-steel/10"
                : step > item.id
                  ? "border-state-success/30 bg-state-success/10"
                  : "border-line-subtle bg-bg-surface-2/30"
            )}
          >
            <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
              Step {item.id}
            </div>
            <div className="mt-1 text-sm font-medium text-white">{item.label}</div>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-6">
          <Card className="border-line-subtle bg-bg-surface">
            <CardHeader>
              <CardTitle className="text-xl text-white">
                What kind of business are you setting up?
              </CardTitle>
              <p className="text-sm leading-6 text-ink-secondary">
                Choose a starter to pre-configure your agents and workflows, or
                start blank.
              </p>
            </CardHeader>
            <CardContent>
              <TemplateSelector
                selected={selectedTemplateId}
                onSelect={handleSelectTemplate}
                currentUserEmail={currentUserEmail}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedTemplateId}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <BusinessForm
            mode="create"
            templateId={selectedTemplateId}
            step="details"
            defaultValues={values}
            onSubmit={() => undefined}
            onValuesChange={(nextValues) => setValues(nextValues)}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button type="button" onClick={handleNextFromDetails}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-line-subtle bg-bg-surface p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-steel-bright" />
              Advanced configuration
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              These settings let you shape how the business operates. You can
              leave them mostly blank and rely on the template defaults.
            </p>
          </div>

          <BusinessForm
            mode="create"
            templateId={selectedTemplateId}
            step="advanced"
            defaultValues={values}
            onSubmit={() => undefined}
            onValuesChange={(nextValues) => setValues(nextValues)}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button type="button" onClick={() => setStep(4)}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-6">
          <Card className="border-line-subtle bg-bg-surface">
            <CardHeader>
              <CardTitle className="text-xl text-white">Review & Create</CardTitle>
              <p className="text-sm leading-6 text-ink-secondary">
                Confirm what Mission Control will create for this business.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-line-subtle bg-bg-surface-2/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white">
                      Business Summary
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
                        Template
                      </div>
                      <div className="mt-1 text-white">
                        {selectedTemplate?.name ?? "Start Blank"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                        Overview
                      </div>
                      <div className="mt-1 leading-6 text-ink-primary">
                        {values.summary ||
                        values.templateAnswers?.businessDescription ? (
                          values.summary ||
                          values.templateAnswers?.businessDescription
                        ) : (
                          <span className="italic text-ink-muted">
                            No summary added yet.
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-line-subtle bg-bg-surface-2/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white">
                      Will create
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-ink-primary">
                      <CheckCircle2 className="h-4 w-4 text-state-success" />
                      <span>{templateCounts.agents} starter agents</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-primary">
                      <CheckCircle2 className="h-4 w-4 text-state-success" />
                      <span>{templateCounts.workflows} starter workflows</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-primary">
                      <CheckCircle2 className="h-4 w-4 text-state-success" />
                      <span>{templateCounts.knowledge} knowledge sections</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={handleCreateBusiness}
                disabled={creating}
              >
                {creating ? "Creating Business..." : "Create Business"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-start">
            <Button type="button" variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
