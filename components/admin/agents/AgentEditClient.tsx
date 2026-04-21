"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { AgentForm } from "@/components/admin/agents/AgentForm";
import type { AgentFormValues } from "@/components/admin/agents/schema";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type AgentEditClientProps = {
  agentId: string;
  agentName: string;
  businesses: Array<{
    id: string;
    name: string;
    slug: string;
    primaryModel: string | null;
    fallbackModel: string | null;
    safetyMode: string | null;
  }>;
  defaultValues: Partial<AgentFormValues>;
  existingMainAgents: Record<string, string>;
  allowGlobal: boolean;
  systemDefaultModel: string;
};

export function AgentEditClient({
  agentId,
  agentName,
  businesses,
  defaultValues,
  existingMainAgents,
  allowGlobal,
  systemDefaultModel
}: AgentEditClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);

  async function handleSave(values: AgentFormValues) {
    try {
      setSaving(true);

      const response = await fetchWithCsrf(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(values)
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save agent.");
      }

      toast.success("Agent saved.");
      router.push(`/admin/agents/${agentId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save agent.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    try {
      setDisabling(true);

      const response = await fetchWithCsrf(`/api/admin/agents/${agentId}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to disable agent.");
      }

      toast.success("Agent disabled.");
      router.push("/admin/agents");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to disable agent."
      );
      throw error;
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Edit ${agentName}`}
        description="Update identity, prompts, tools, and model behavior for this agent."
        action={
          <Button asChild variant="outline">
            <Link href={`/admin/agents/${agentId}`}>Cancel</Link>
          </Button>
        }
      />

      <AgentForm
        mode="edit"
        businesses={businesses}
        defaultValues={defaultValues}
        onSubmit={handleSave}
        loading={saving}
        submitLabel="Save Agent"
        currentAgentId={agentId}
        existingMainAgents={existingMainAgents}
        allowGlobal={allowGlobal}
        systemDefaultModel={systemDefaultModel}
        notice={
          <Card className="border-steel/30 bg-steel/10">
            <CardContent className="p-4 text-sm text-ink-primary">
              Changes will create a backup before saving.
            </CardContent>
          </Card>
        }
        secondaryAction={
          <Button asChild type="button" variant="outline">
            <Link href={`/admin/agents/${agentId}`}>Cancel</Link>
          </Button>
        }
      />

      <Card className="border-status-error/35 bg-state-danger/5">
        <CardHeader>
          <CardTitle className="text-base text-white">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-ink-secondary">
            Disabling this agent stops it from running. Existing records stay in
            Mission Control, and you can restore it later by editing the agent.
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDisableOpen(true)}
          >
            Disable Agent
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable this agent?"
        description="This agent will stop running until you re-enable it."
        confirmLabel="Disable Agent"
        variant="danger"
        loading={disabling}
        onConfirm={handleDisable}
      />
    </div>
  );
}
