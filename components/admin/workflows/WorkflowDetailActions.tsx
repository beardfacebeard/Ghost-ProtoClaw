"use client";

import Link from "next/link";
import { useState } from "react";
import { Play, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type WorkflowDetailActionsProps = {
  workflowId: string;
  enabled: boolean;
  canRunNow: boolean;
};

export function WorkflowDetailActions({
  workflowId,
  enabled,
  canRunNow
}: WorkflowDetailActionsProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(enabled);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleToggle(nextEnabled: boolean) {
    const previous = checked;

    try {
      setChecked(nextEnabled);
      setToggling(true);

      const response = await fetchWithCsrf(`/api/admin/workflows/${workflowId}/toggle`, {
        method: "POST",
        body: JSON.stringify({
          enabled: nextEnabled
        })
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update workflow.");
      }

      toast.success(nextEnabled ? "Workflow enabled." : "Workflow disabled.");
      router.refresh();
    } catch (error) {
      setChecked(previous);
      toast.error(
        error instanceof Error ? error.message : "Unable to update workflow."
      );
    } finally {
      setToggling(false);
    }
  }

  async function handleRunNow() {
    try {
      setRunning(true);

      const response = await fetchWithCsrf(`/api/admin/workflows/${workflowId}/run`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as {
        error?: string;
        requiresApproval?: boolean;
        approvalId?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to run workflow.");
      }

      if (payload.requiresApproval) {
        toast.success("Approval request created.");
        router.push(`/admin/approvals?approvalId=${payload.approvalId}`);
        return;
      }

      toast.success("Workflow started.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to run workflow."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 rounded-full border border-ghost-border bg-ghost-surface px-4 py-2 text-sm text-slate-300">
        <span>{checked ? "Enabled" : "Disabled"}</span>
        <Switch
          checked={checked}
          disabled={toggling}
          onCheckedChange={handleToggle}
        />
      </div>
      <Button asChild variant="outline">
        <Link href={`/admin/workflows/${workflowId}/edit`}>Edit</Link>
      </Button>
      {canRunNow ? (
        <Button onClick={() => void handleRunNow()} disabled={running}>
          {running ? (
            <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Run Now
        </Button>
      ) : null}
    </div>
  );
}
