import { SectionHeader } from "@/components/admin/SectionHeader";
import { ActivityPageClient } from "@/components/admin/activity/ActivityPageClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import {
  countActivityEntries,
  countAuditEvents,
  countLogEvents,
  getActivityStats,
  listActivityEntries,
  listAuditEvents,
  listLogEvents
} from "@/lib/repository/activity";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type ActivityPageProps = {
  searchParams?: {
    tab?: string;
    businessId?: string;
    range?: string;
    type?: string;
    level?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  };
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseDate(value?: string, fallback?: Date) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function resolveDateRange(
  range: string,
  startDate?: string,
  endDate?: string
) {
  if (range === "today") {
    return {
      start: startOfToday(),
      end: endOfToday()
    };
  }

  if (range === "30d") {
    return {
      start: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
      end: new Date()
    };
  }

  if (range === "custom") {
    return {
      start: parseDate(startDate),
      end: parseDate(endDate)
    };
  }

  return {
    start: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    end: new Date()
  };
}

export default async function ActivityPage({
  searchParams
}: ActivityPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const requestedTab = searchParams?.tab ?? "activity";
  const tab =
    requestedTab === "audit" && session.role !== "super_admin"
      ? "activity"
      : requestedTab;
  const businessId = searchParams?.businessId;
  const range = searchParams?.range ?? "7d";
  const type = searchParams?.type ?? "all";
  const level = searchParams?.level ?? "all";
  const search = searchParams?.search ?? "";
  const page = Math.max(Number.parseInt(searchParams?.page ?? "1", 10) || 1, 1);
  const limit = page * PAGE_SIZE;
  const businessIds = session.role === "admin" ? session.businessIds : undefined;
  const { start, end } = resolveDateRange(
    range,
    searchParams?.startDate,
    searchParams?.endDate
  );

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

  const [businesses, activityEntries, activityTotal, logEntries, logTotal, auditEntries, auditTotal, stats] =
    await Promise.all([
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
      tab === "activity"
        ? listActivityEntries({
            organizationId: session.organizationId,
            businessId,
            type,
            search,
            startDate: start,
            endDate: end,
            limit,
            businessIds
          })
        : Promise.resolve([]),
      tab === "activity"
        ? countActivityEntries({
            organizationId: session.organizationId,
            businessId,
            type,
            search,
            startDate: start,
            endDate: end,
            businessIds
          })
        : Promise.resolve(0),
      tab === "log"
        ? listLogEvents({
            organizationId: session.organizationId,
            businessId,
            level,
            search,
            startDate: start,
            endDate: end,
            limit,
            businessIds
          })
        : Promise.resolve([]),
      tab === "log"
        ? countLogEvents({
            organizationId: session.organizationId,
            businessId,
            level,
            search,
            startDate: start,
            endDate: end,
            businessIds
          })
        : Promise.resolve(0),
      tab === "audit" && session.role === "super_admin"
        ? listAuditEvents({
            organizationId: session.organizationId,
            actorEmail: search || undefined,
            startDate: start,
            endDate: end,
            limit
          })
        : Promise.resolve([]),
      tab === "audit" && session.role === "super_admin"
        ? countAuditEvents({
            organizationId: session.organizationId,
            actorEmail: search || undefined,
            startDate: start,
            endDate: end
          })
        : Promise.resolve(0),
      getActivityStats(session.organizationId, 24 * 7, {
        businessId,
        businessIds,
        startDate: start,
        endDate: end,
        includeAuditEvents: session.role === "super_admin"
      })
    ]);

  const logBusinessLabels = new Map(
    businesses.map((business) => [business.id, business.name])
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="System · Activity"
        title="Every event, in order."
        description="Full chronological feed — every agent action, workflow run, and system event across all your businesses."
      />

      <ActivityPageClient
        businesses={businesses}
        businessLabels={Object.fromEntries(logBusinessLabels)}
        isSuperAdmin={session.role === "super_admin"}
        state={{
          tab,
          businessId: businessId ?? "all",
          range,
          type,
          level,
          search,
          startDate: searchParams?.startDate ?? "",
          endDate: searchParams?.endDate ?? "",
          page
        }}
        totals={{
          activity: activityTotal,
          log: logTotal,
          audit: auditTotal
        }}
        stats={stats}
        entries={{
          activity: activityEntries,
          log: logEntries,
          audit: auditEntries
        }}
      />
    </div>
  );
}
