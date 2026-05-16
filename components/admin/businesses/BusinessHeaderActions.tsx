"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileSpreadsheet,
  MoreVertical,
  Pause,
  Play,
  Radar,
  Rocket
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type BusinessHeaderActionsProps = {
  businessId: string;
  businessName: string;
  businessStatus?: string;
  /** Current per-business kill-switch state. When true a red Unpause action
   *  is surfaced in the dropdown; when false the Pause Business action
   *  opens a confirm dialog that accepts a reason. */
  businessGlobalPaused?: boolean;
};

export function BusinessHeaderActions({
  businessId,
  businessName,
  businessStatus,
  businessGlobalPaused = false
}: BusinessHeaderActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

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

  async function handlePauseBusiness() {
    try {
      setPausing(true);
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/pause`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason: pauseReason.trim() || undefined
          })
        }
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to pause business.");
      }
      toast.success(`${businessName} paused. All agents and workflows halted.`);
      setPauseReason("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to pause business."
      );
    } finally {
      setPausing(false);
      setPauseOpen(false);
    }
  }

  async function handleUnpauseBusiness() {
    try {
      setPausing(true);
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/pause`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to unpause business.");
      }
      toast.success(`${businessName} unpaused.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to unpause business."
      );
    } finally {
      setPausing(false);
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
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/admin/businesses/${businessId}/edit`}>
                Edit Business
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/businesses/${businessId}/sourcing`}>
                <Radar className="mr-2 h-3.5 w-3.5" />
                Sourcing Buy-Box
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/businesses/${businessId}/import-leads`}>
                <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                Import Leads (CSV)
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/admin/businesses/${businessId}/foreclosures`}>
                <AlertTriangle className="mr-2 h-3.5 w-3.5" />
                Pre-Foreclosure (Dealhawk addon)
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {businessGlobalPaused ? (
              <DropdownMenuItem
                onClick={handleUnpauseBusiness}
                disabled={pausing}
              >
                <Play className="mr-2 h-3.5 w-3.5" />
                Unpause Business
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setPauseOpen(true)}
                className="text-state-warning focus:text-state-warning"
              >
                <Pause className="mr-2 h-3.5 w-3.5" />
                Pause Business
              </DropdownMenuItem>
            )}
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

      <ConfirmDialog
        open={pauseOpen}
        onOpenChange={(o) => {
          setPauseOpen(o);
          if (!o) setPauseReason("");
        }}
        title={`Pause ${businessName}?`}
        description="All agents and workflows for this business will halt. Cron firings advance their schedule but skip execution. Cleared with one click; no data lost."
        confirmLabel="Pause Business"
        variant="danger"
        loading={pausing}
        onConfirm={handlePauseBusiness}
      >
        <div className="space-y-1 py-2">
          <label
            htmlFor="business-pause-reason"
            className="text-xs text-ink-secondary"
          >
            Reason (optional)
          </label>
          <Input
            id="business-pause-reason"
            value={pauseReason}
            onChange={(e) => setPauseReason(e.target.value)}
            placeholder="e.g. operator out of office"
            maxLength={500}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
