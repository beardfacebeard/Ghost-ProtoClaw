"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { BusinessForm } from "@/components/admin/businesses/BusinessForm";
import type { BusinessFormValues } from "@/components/admin/businesses/schema";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type BusinessEditClientProps = {
  businessId: string;
  businessName: string;
  defaultValues: Partial<BusinessFormValues>;
};

export function BusinessEditClient({
  businessId,
  businessName,
  defaultValues
}: BusinessEditClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleSave(values: BusinessFormValues) {
    try {
      setSaving(true);

      const response = await fetchWithCsrf(`/api/admin/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify(values)
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update business.");
      }

      toast.success("Business saved.");
      router.push(`/admin/businesses/${businessId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update business."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    try {
      setArchiving(true);

      const response = await fetchWithCsrf(`/api/admin/businesses/${businessId}`, {
        method: "DELETE"
      });
      const payload = (await response.json()) as {
        error?: string;
      };

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
    <div className="space-y-6">
      <SectionHeader
        title={`Edit ${businessName}`}
        description="Update the business identity, voice, operating rules, and model behavior."
        action={
          <Button asChild variant="outline">
            <Link href={`/admin/businesses/${businessId}`}>Cancel</Link>
          </Button>
        }
      />

      <BusinessForm
        mode="edit"
        defaultValues={defaultValues}
        onSubmit={handleSave}
        submitLabel="Save Business"
        loading={saving}
        secondaryAction={
          <Button asChild type="button" variant="outline">
            <Link href={`/admin/businesses/${businessId}`}>Cancel</Link>
          </Button>
        }
      />

      <Card className="border-status-error/35 bg-status-error/5">
        <CardHeader>
          <CardTitle className="text-base text-white">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-slate-400">
            This will disable the business and all its agents. You can restore it
            from the Backups page.
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setArchiveOpen(true)}
          >
            Archive Business
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this business?"
        description="This will disable the business and all its agents. You can restore it from the Backups page."
        confirmLabel="Archive Business"
        variant="danger"
        loading={archiving}
        onConfirm={handleArchive}
      />
    </div>
  );
}
