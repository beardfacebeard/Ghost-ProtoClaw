"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type BusinessHeaderActionsProps = {
  businessId: string;
  businessName: string;
  businessStatus?: string;
};

export function BusinessHeaderActions({
  businessId,
  businessName,
  businessStatus
}: BusinessHeaderActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  const canActivate =
    businessStatus === "planning" || businessStatus === "paused";

  async function handleActivate() {
    try {
      setActivating(true);
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/activate`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to activate business.");
      }

      toast.success(
        "Business activated! Agents and workflows are now live."
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to activate business."
      );
    } finally {
      setActivating(false);
      setActivateOpen(false);
    }
  }

  async function handleArchive() {
    try {
      setArchiving(true);
      const response = await fetchWithCsrf(`/api/admin/businesses/${businessId}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to archive business.");
      }

      toast.success("Business archived.");
      router.push("/admin/businesses");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to archive business."
      );
      throw error;
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}?permanent=true`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete business.");
      }

      toast.success("Business permanently deleted.");
      router.push("/admin/businesses");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete business."
      );
      throw error;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        {canActivate && (
          <Button onClick={() => setActivateOpen(true)} className="gap-2">
            <Rocket className="h-4 w-4" />
            Activate Business
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={`/admin/businesses/${businessId}/edit`}>Edit</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Business actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href={`/admin/businesses/${businessId}/edit`}>
                Edit Business
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-state-danger focus:text-state-danger"
              onClick={() => setConfirmOpen(true)}
            >
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-state-danger focus:text-state-danger"
              onClick={() => setDeleteOpen(true)}
            >
              Delete Permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archive this business?"
        description="This will disable the business and all its agents. You can restore it from the Backups page."
        confirmLabel="Archive Business"
        variant="danger"
        loading={archiving}
        onConfirm={handleArchive}
      />

      <ConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        title="Activate this business?"
        description={`This will set "${businessName}" to active, enable all its agents, and turn on workflows. Your agents will be ready to chat and execute tasks.`}
        confirmLabel="Activate"
        variant="default"
        loading={activating}
        onConfirm={handleActivate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Permanently delete this business?"
        description={`This will permanently delete "${businessName}" and all of its agents, workflows, knowledge items, skills, and associated data. This action cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        confirmText={businessName}
      />
    </>
  );
}
