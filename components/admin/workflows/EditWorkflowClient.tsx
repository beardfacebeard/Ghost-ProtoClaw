"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { WorkflowForm } from "@/components/admin/workflows/WorkflowForm";
import type { WorkflowFormValues } from "@/components/admin/workflows/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type EditWorkflowClientProps = {
  workflowId: string;
  workflowName: string;
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
  defaultValues: Partial<WorkflowFormValues>;
  integrationStatus: {
    gmail: boolean;
    crm: boolean;
    comments: boolean;
  };
};

export function EditWorkflowClient({
  workflowId,
  workflowName,
  businesses,
  agents,
  defaultValues,
  integrationStatus
}: EditWorkflowClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleSave(values: WorkflowFormValues) {
    try {
      setSaving(true);

      const response = await fetchWithCsrf(`/api/admin/workflows/${workflowId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...values,
          safetyMode: values.overrideSafetyMode ? values.safetyMode : ""
        })
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save workflow.");
      }

      toast.success("Workflow saved.");
      router.push(`/admin/workflows/${workflowId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save workflow."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    try {
      setDisabling(true);

      const response = await fetchWithCsrf(`/api/admin/workflows/${workflowId}/toggle`, {
        method: "POST",
        body: JSON.stringify({
          enabled: false
        })
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to disable workflow.");
      }

      toast.success("Workflow disabled.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to disable workflow."
      );
      throw error;
    } finally {
      setDisabling(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);

      const response = await fetchWithCsrf(`/api/admin/workflows/${workflowId}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete workflow.");
      }

      toast.success("Workflow deleted.");
      router.push("/admin/workflows");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete workflow."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Edit ${workflowName}`}
        description="Changes will take effect on the next trigger. Current runs won't be affected."
        action={
          <Button asChild variant="outline">
            <Link href={`/admin/workflows/${workflowId}`}>Cancel</Link>
          </Button>
        }
      />

      <div className="rounded-2xl border border-brand-cyan/25 bg-brand-cyan/10 px-4 py-4 text-sm text-slate-200">
        Changes will create a backup before saving and will apply the next time this workflow is triggered.
      </div>

      <WorkflowForm
        mode="edit"
        businesses={businesses}
        agents={agents}
        defaultValues={defaultValues}
        onSubmit={handleSave}
        loading={saving}
        readOnlyTrigger
        integrationStatus={integrationStatus}
        secondaryAction={
          <Button asChild type="button" variant="outline">
            <Link href={`/admin/workflows/${workflowId}`}>Cancel</Link>
          </Button>
        }
      />

      <Card className="border-status-error/35 bg-status-error/5">
        <CardHeader>
          <CardTitle className="text-base text-white">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-slate-400">
            Disable the workflow to pause it, or delete it to remove it from active automation entirely.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisableOpen(true)}
            >
              Disable Workflow
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete Workflow
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable this workflow?"
        description="This will pause future runs immediately. Current runs won't be interrupted."
        confirmLabel="Disable Workflow"
        variant="danger"
        loading={disabling}
        onConfirm={handleDisable}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this workflow?</DialogTitle>
            <DialogDescription>
              Type the workflow name to confirm deletion. This disables the workflow and clears its active runtime job.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-slate-400">Workflow name</div>
            <div className="rounded-xl border border-ghost-border bg-ghost-black px-4 py-3 font-mono text-sm text-white">
              {workflowName}
            </div>
            <Input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="Type the workflow name exactly"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirm !== workflowName || deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Deleting..." : "Delete Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
