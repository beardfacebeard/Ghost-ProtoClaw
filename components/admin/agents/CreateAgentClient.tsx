"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { AgentForm } from "@/components/admin/agents/AgentForm";
import type { AgentFormValues } from "@/components/admin/agents/schema";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type CreateAgentClientProps = {
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
  duplicatedFromName?: string;
};

export function CreateAgentClient({
  businesses,
  defaultValues,
  existingMainAgents,
  allowGlobal,
  systemDefaultModel,
  duplicatedFromName
}: CreateAgentClientProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate(values: AgentFormValues) {
    try {
      setCreating(true);

      const response = await fetchWithCsrf("/api/admin/agents", {
        method: "POST",
        body: JSON.stringify(values)
      });
      const payload = (await response.json()) as {
        error?: string;
        agent?: { id: string };
      };

      if (!response.ok || !payload.agent) {
        throw new Error(payload.error ?? "Unable to create agent.");
      }

      toast.success("Agent created.");
      router.push(`/admin/agents/${payload.agent.id}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create agent."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Create Agent"
        description="Configure identity, prompts, tools, and model inheritance for a new AI operator."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/agents">Back to Agents</Link>
          </Button>
        }
      />

      <AgentForm
        mode="create"
        businesses={businesses}
        defaultValues={defaultValues}
        onSubmit={handleCreate}
        loading={creating}
        submitLabel="Create Agent"
        existingMainAgents={existingMainAgents}
        allowGlobal={allowGlobal}
        systemDefaultModel={systemDefaultModel}
        notice={
          duplicatedFromName ? (
            <Card className="border-steel/30 bg-steel/10">
              <CardContent className="p-4 text-sm text-ink-primary">
                Duplicating from <span className="font-medium text-white">{duplicatedFromName}</span>.
                Review the prompts, tools, and business assignment before saving.
              </CardContent>
            </Card>
          ) : undefined
        }
        secondaryAction={
          <Button asChild type="button" variant="outline">
            <Link href="/admin/agents">Cancel</Link>
          </Button>
        }
      />
    </div>
  );
}
