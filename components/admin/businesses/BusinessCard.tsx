"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Bot, GitBranch, MoreVertical } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { getBusinessStatusMeta } from "@/components/admin/businesses/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type BusinessCardProps = {
  business: {
    id: string;
    name: string;
    status: string;
    summary: string | null;
    _count: {
      agents: number;
      workflows: number;
      knowledgeItems: number;
    };
  };
};

export function BusinessCard({ business }: BusinessCardProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const status = getBusinessStatusMeta(business.status);

  async function handleArchive() {
    try {
      setArchiving(true);

      const response = await fetchWithCsrf(`/api/admin/businesses/${business.id}`, {
        method: "DELETE"
      });

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to archive business.");
      }

      toast.success("Business archived.");
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
        `/api/admin/businesses/${business.id}?permanent=true`,
        { method: "DELETE" }
      );

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete business.");
      }

      toast.success("Business permanently deleted.");
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
      <Card
        variant="hover"
        className="h-full border-line-subtle bg-bg-surface transition-all hover:-translate-y-0.5"
      >
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">{business.name}</h3>
              <Badge className={cn("font-medium", status.className)}>
                {status.label}
              </Badge>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/businesses/${business.id}`}>View Details</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/businesses/${business.id}/edit`}>
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

          <p className="min-h-[2.75rem] text-sm leading-6 text-ink-secondary">
            {business.summary ? (
              <span className="line-clamp-2">{business.summary}</span>
            ) : (
              <span className="italic text-ink-muted">No summary set</span>
            )}
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-ink-secondary">
            <div className="inline-flex items-center gap-2">
              <Bot className="h-4 w-4 text-steel-bright" />
              <span>{business._count.agents} agents</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-steel-bright" />
              <span>{business._count.workflows} workflows</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-state-warning" />
              <span>{business._count.knowledgeItems} knowledge</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="gap-3 border-t border-line-subtle px-5 py-4">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/admin/businesses/${business.id}`}>View</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link href={`/admin/businesses/${business.id}/edit`}>Edit</Link>
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archive this business?"
        description="This will archive the business, disable its agents, and pause its workflows. You can restore the business later from Backups."
        confirmLabel="Archive Business"
        variant="danger"
        loading={archiving}
        onConfirm={handleArchive}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Permanently delete this business?"
        description={`This will permanently delete "${business.name}" and all of its agents, workflows, knowledge items, skills, and associated data. This action cannot be undone.`}
        confirmLabel="Delete Forever"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        confirmText={business.name}
      />
    </>
  );
}
