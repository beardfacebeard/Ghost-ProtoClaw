"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreVertical, Play, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";

import type { WorkflowWithBusiness } from "@/lib/repository/workflows";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { formatScheduleDisplay } from "@/lib/workflows/schedule-parser";

import { ApprovalModeBadge } from "@/components/admin/workflows/ApprovalModeBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { OutputBadge } from "@/components/admin/workflows/OutputBadge";
import { TriggerBadge } from "@/components/admin/workflows/TriggerBadge";
import {
  formatWorkflowDate,
  getRunStatusMeta,
  getTriggerMeta
} from "@/components/admin/workflows/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

type WorkflowCardProps = {
  workflow: WorkflowWithBusiness;
  canRunNow?: boolean;
  onToggle?: (workflowId: string, enabled: boolean) => void;
  onRun?: (workflowId: string) => void;
};

export function WorkflowCard({
  workflow,
  canRunNow = false,
  onToggle,
  onRun
}: WorkflowCardProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(workflow.enabled);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const triggerMeta = getTriggerMeta(workflow.trigger);
  const TriggerIcon = triggerMeta.icon;
  const statusMeta = workflow.resultStatus
    ? getRunStatusMeta(workflow.resultStatus)
    : null;

  async function handleToggle(nextEnabled: boolean) {
    const previous = enabled;

    try {
      setEnabled(nextEnabled);
      setToggling(true);

      const response = await fetchWithCsrf(
        `/api/admin/workflows/${workflow.id}/toggle`,
        {
          method: "POST",
          body: JSON.stringify({
            enabled: nextEnabled
          })
        }
      );
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update workflow state.");
      }

      toast.success(nextEnabled ? "Workflow enabled." : "Workflow disabled.");
      onToggle?.(workflow.id, nextEnabled);
      router.refresh();
    } catch (error) {
      setEnabled(previous);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update workflow state."
      );
    } finally {
      setToggling(false);
    }
  }

  async function handleRun() {
    try {
      setRunning(true);

      const response = await fetchWithCsrf(
        `/api/admin/workflows/${workflow.id}/run`,
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );
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
      onRun?.(workflow.id);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to run workflow."
      );
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);

      const response = await fetchWithCsrf(`/api/admin/workflows/${workflow.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete workflow.");
      }

      toast.success("Workflow disabled.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete workflow."
      );
      throw error;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-ghost-border bg-ghost-surface p-4 transition-all hover:-translate-y-[1px] hover:border-ghost-border-strong">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ghost-raised ${triggerMeta.iconClassName}`}
            >
              <TriggerIcon className="h-5 w-5" />
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-white">
                  {workflow.name}
                </div>
                <TriggerBadge trigger={workflow.trigger} size="sm" />
              </div>
              <div className="line-clamp-1 text-sm text-slate-400">
                {workflow.description || "No description yet."}
              </div>
              <div className="flex flex-wrap gap-2">
                {workflow.business ? (
                  <Badge className="bg-brand-cyan/15 text-brand-cyan">
                    {workflow.business.name}
                  </Badge>
                ) : null}
                {workflow.agent ? (
                  <Badge className="bg-status-info/15 text-status-info">
                    {workflow.agent.emoji || "Agent"} {workflow.agent.displayName}
                  </Badge>
                ) : null}
                <OutputBadge output={workflow.output} />
                <ApprovalModeBadge mode={workflow.approvalMode || "auto"} />
              </div>
              <div className="text-xs text-slate-500">
                {formatScheduleDisplay(workflow)}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="space-y-2 text-right">
              <div className="flex items-center justify-end gap-3 text-sm text-slate-400">
                <span>{enabled ? "Enabled" : "Disabled"}</span>
                <Switch
                  checked={enabled}
                  disabled={toggling}
                  onCheckedChange={handleToggle}
                />
              </div>
              <div className="text-xs text-slate-500">
                Last run: {formatWorkflowDate(workflow.lastRunAt)}
              </div>
              {statusMeta ? (
                <div className="flex justify-end">
                  <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                </div>
              ) : null}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Workflow actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/workflows/${workflow.id}`}>View Workflow</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/workflows/${workflow.id}/edit`}>
                    Edit Workflow
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/workflows/create?duplicateFrom=${workflow.id}`}>
                    Duplicate
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleToggle(!enabled)}>
                  {enabled ? "Disable" : "Enable"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-status-error focus:text-status-error"
                  onSelect={() => setDeleteOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-ghost-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{workflow._count.actionRuns} total runs</span>
            <span>{enabled ? "Active automation" : "Paused"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRunNow ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRun()}
                disabled={running || workflow.approvalMode === "approve_first"}
                title={
                  workflow.approvalMode === "approve_first"
                    ? "Requires approval before it can run."
                    : undefined
                }
              >
                {running ? (
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {workflow.approvalMode === "approve_first"
                  ? "Requires Approval"
                  : "Run Now"}
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/workflows/${workflow.id}`}>View</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/workflows/${workflow.id}/edit`}>Edit</Link>
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Disable this workflow?"
        description="This will stop the workflow from running and clear its active runtime job."
        confirmLabel="Disable Workflow"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
