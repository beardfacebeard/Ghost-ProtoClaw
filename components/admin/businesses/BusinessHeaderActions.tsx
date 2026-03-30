"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
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
};

export function BusinessHeaderActions({
  businessId
}: BusinessHeaderActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

  return (
    <>
      <div className="flex items-center gap-3">
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
              className="text-status-error focus:text-status-error"
              onClick={() => setConfirmOpen(true)}
            >
              Archive
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
    </>
  );
}
