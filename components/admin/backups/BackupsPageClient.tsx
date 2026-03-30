"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { BackupCard } from "@/components/admin/backups/BackupCard";
import { CreateBackupModal } from "@/components/admin/backups/CreateBackupModal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type BackupRecord = {
  id: string;
  businessId: string | null;
  sourceType: string;
  scopeType: string | null;
  scopeId: string | null;
  status: string;
  payload: unknown;
  triggeredBy: string | null;
  reason: string | null;
  createdAt: Date | string;
  business: {
    id: string;
    name: string;
  } | null;
};

type BackupsPageClientProps = {
  backups: BackupRecord[];
  total: number;
  isSuperAdmin: boolean;
  businesses: Array<{
    id: string;
    name: string;
  }>;
  filters: {
    businessId: string;
    sourceType: string;
    page: number;
  };
};

function setParams(
  current: URLSearchParams,
  values: Record<string, string | number>
) {
  const params = new URLSearchParams(current.toString());

  Object.entries(values).forEach(([key, value]) => {
    const normalized = String(value);
    if (
      !normalized ||
      normalized === "all" ||
      (key === "page" && normalized === "1")
    ) {
      params.delete(key);
    } else {
      params.set(key, normalized);
    }
  });

  return params.toString();
}

export function BackupsPageClient({
  backups,
  total,
  isSuperAdmin,
  businesses,
  filters
}: BackupsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  function updateFilters(values: Record<string, string | number>) {
    const query = setParams(searchParams, {
      ...values,
      page: values.page ?? 1
    });
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  async function handleCreate(payload: {
    businessId?: string;
    sourceType: "gateway_config" | "workspace_snapshot" | "export_bundle";
    reason?: string;
  }) {
    const response = await fetchWithCsrf("/api/admin/backups", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as {
      error?: string;
      backup?: {
        id: string;
      };
    };

    if (!response.ok || !result.backup) {
      throw new Error(result.error ?? "Unable to create backup.");
    }

    toast.success(`Backup created: ${result.backup.id}`);
    router.refresh();
  }

  async function handleRestore(backup: BackupRecord) {
    const response = await fetchWithCsrf(`/api/admin/backups/${backup.id}/restore`, {
      method: "POST",
      body: JSON.stringify({ confirm: true })
    });
    const result = (await response.json()) as {
      error?: string;
      summary?: string;
    };

    if (!response.ok) {
      throw new Error(result.error ?? "Unable to restore backup.");
    }

    toast.success(result.summary ?? "Backup restored.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium text-white">Business</div>
            <Select
              value={filters.businessId}
              onValueChange={(value) => updateFilters({ businessId: value })}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Businesses</SelectItem>
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={business.id}>
                    {business.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-white">Source Type</div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["config", "Config"],
                ["workspace", "Workspace"],
                ["export_bundle", "Export Bundle"]
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={filters.sourceType === value ? "default" : "outline"}
                  onClick={() => updateFilters({ sourceType: value })}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Button type="button" onClick={() => setCreateOpen(true)}>
          Create Backup
        </Button>
      </div>

      {backups.length === 0 ? (
        <EmptyState
          icon={<Archive className="h-6 w-6" />}
          title="No backups yet"
          description="Create your first manual backup to capture a restore point for your operation."
          action={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Create Backup
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {backups.map((backup) => (
            <BackupCard
              key={backup.id}
              backup={backup}
              onRestore={handleRestore}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}

      {total > backups.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => updateFilters({ page: filters.page + 1 })}
          >
            Load more
          </Button>
        </div>
      ) : null}

      <CreateBackupModal
        open={createOpen}
        businesses={businesses}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
