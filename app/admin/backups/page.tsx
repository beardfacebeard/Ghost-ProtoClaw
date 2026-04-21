import { Archive, Clock3, Database } from "lucide-react";

import { SectionHeader } from "@/components/admin/SectionHeader";
import { BackupsPageClient } from "@/components/admin/backups/BackupsPageClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import {
  countBackups,
  getBackupStats,
  listBackups
} from "@/lib/repository/backups";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type BackupsPageProps = {
  searchParams?: {
    businessId?: string;
    sourceType?: string;
    page?: string;
  };
};

export default async function BackupsPage({ searchParams }: BackupsPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const businessId = searchParams?.businessId;
  const sourceType = searchParams?.sourceType ?? "all";
  const page = Math.max(Number.parseInt(searchParams?.page ?? "1", 10) || 1, 1);
  const businessIds = session.role === "admin" ? session.businessIds : undefined;
  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: {
            in: session.businessIds
          }
        }
      : {
          organizationId: session.organizationId
        };

  const [businesses, stats, backups, total] = await Promise.all([
    db.business.findMany({
      where: businessWhere,
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    getBackupStats(session.organizationId, businessIds),
    listBackups({
      organizationId: session.organizationId,
      businessId,
      sourceType,
      limit: page * PAGE_SIZE,
      businessIds
    }),
    countBackups({
      organizationId: session.organizationId,
      businessId,
      sourceType,
      businessIds
    })
  ]);

  const statCards = [
    {
      title: "Total Backups",
      value: stats.totalBackups,
      icon: Archive,
      accent: "text-ink-primary"
    },
    {
      title: "Last Backup",
      value: stats.lastBackupAt,
      icon: Clock3,
      accent:
        stats.lastBackupAt &&
        Date.now() - stats.lastBackupAt.getTime() < 24 * 60 * 60 * 1000
          ? "text-state-success"
          : "text-state-warning"
    },
    {
      title: "Storage Used",
      value: `~${Math.max(1, Math.round(stats.totalSizeEstimate / 1024))} KB`,
      icon: Database,
      accent: "text-steel-bright"
    }
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="System · Backups"
        title="Your data, safely snapshotted."
        description="Point-in-time exports of business configs, workspace files, and agent state. Restore anytime. Nothing ever leaves your infrastructure."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-2xl border border-line-subtle bg-bg-surface p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.18em] text-ink-muted">
                  {card.title}
                </div>
                <Icon className={`h-5 w-5 ${card.accent}`} />
              </div>
              <div className="mt-3 text-2xl font-bold text-white">
                {card.value instanceof Date
                  ? card.value.toLocaleString()
                  : card.value ?? "Never"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4 text-sm text-ink-primary">
        Automatic backups are created before every update to businesses, agents, workflows, and workspace files. Use this page to create manual snapshots or full export bundles.
      </div>

      <BackupsPageClient
        backups={backups}
        total={total}
        isSuperAdmin={session.role === "super_admin"}
        businesses={businesses}
        filters={{
          businessId: businessId ?? "all",
          sourceType,
          page
        }}
      />

      <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4 text-sm text-ink-muted">
        To restore from a backup, click Restore on any completed backup. Requires Super Admin role.
      </div>
    </div>
  );
}
