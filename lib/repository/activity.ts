import { Prisma, type AuditEvent, type LogEvent } from "@prisma/client";

import { db } from "@/lib/db";

const activityEntryInclude = {
  business: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.ActivityEntryInclude;

export type ActivityEntryWithBusiness = Prisma.ActivityEntryGetPayload<{
  include: typeof activityEntryInclude;
}>;

type ActivityListParams = {
  organizationId: string;
  businessId?: string;
  type?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  businessIds?: string[];
};

type LogListParams = {
  businessId?: string;
  organizationId: string;
  level?: string;
  action?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  businessIds?: string[];
};

type AuditListParams = {
  organizationId: string;
  actorEmail?: string;
  entityType?: string;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

type StatsOptions = {
  businessId?: string;
  businessIds?: string[];
  startDate?: Date;
  endDate?: Date;
  includeAuditEvents?: boolean;
};

function buildDateFilter(startDate?: Date, endDate?: Date) {
  if (!startDate && !endDate) {
    return undefined;
  }

  return {
    ...(startDate
      ? {
          gte: startDate
        }
      : {}),
    ...(endDate
      ? {
          lte: endDate
        }
      : {})
  };
}

function buildActivityWhere(
  params: ActivityListParams
): Prisma.ActivityEntryWhereInput {
  const search = params.search?.trim();
  const createdAt = buildDateFilter(params.startDate, params.endDate);

  return {
    business: {
      organizationId: params.organizationId,
      ...(params.businessIds !== undefined
        ? {
            id: {
              in: params.businessIds
            }
          }
        : {})
    },
    ...(params.businessId
      ? {
          businessId: params.businessId
        }
      : {}),
    ...(params.type && params.type !== "all"
      ? {
          type: params.type
        }
      : {}),
    ...(createdAt
      ? {
          createdAt
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              title: {
                contains: search,
                mode: "insensitive"
              }
            },
            {
              detail: {
                contains: search,
                mode: "insensitive"
              }
            },
            {
              business: {
                name: {
                  contains: search,
                  mode: "insensitive"
                }
              }
            }
          ]
        }
      : {})
  };
}

function buildLogWhere(params: LogListParams): Prisma.LogEventWhereInput {
  const search = params.search?.trim();
  const createdAt = buildDateFilter(params.startDate, params.endDate);

  return {
    business: {
      organizationId: params.organizationId,
      ...(params.businessIds !== undefined
        ? {
            id: {
              in: params.businessIds
            }
          }
        : {})
    },
    ...(params.businessId
      ? {
          businessId: params.businessId
        }
      : {}),
    ...(params.level && params.level !== "all"
      ? {
          level: params.level
        }
      : {}),
    ...(params.action
      ? {
          action: params.action
        }
      : {}),
    ...(createdAt
      ? {
          createdAt
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              message: {
                contains: search,
                mode: "insensitive"
              }
            },
            {
              action: {
                contains: search,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };
}

function buildAuditWhere(params: AuditListParams): Prisma.AuditEventWhereInput {
  const createdAt = buildDateFilter(params.startDate, params.endDate);

  return {
    organizationId: params.organizationId,
    ...(params.actorEmail
      ? {
          actorEmail: {
            contains: params.actorEmail.trim(),
            mode: "insensitive"
          }
        }
      : {}),
    ...(params.entityType && params.entityType !== "all"
      ? {
          entityType: params.entityType
        }
      : {}),
    ...(params.eventType && params.eventType !== "all"
      ? {
          eventType: params.eventType
        }
      : {}),
    ...(createdAt
      ? {
          createdAt
        }
      : {})
  };
}

export function countActivityEntries(params: ActivityListParams) {
  return db.activityEntry.count({
    where: buildActivityWhere(params)
  });
}

export function countLogEvents(params: LogListParams) {
  return db.logEvent.count({
    where: buildLogWhere(params)
  });
}

export function countAuditEvents(params: AuditListParams) {
  return db.auditEvent.count({
    where: buildAuditWhere(params)
  });
}

export async function listActivityEntries(
  params: ActivityListParams
): Promise<ActivityEntryWithBusiness[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
  const offset = Math.max(params.offset ?? 0, 0);

  return db.activityEntry.findMany({
    where: buildActivityWhere(params),
    include: activityEntryInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    skip: offset
  });
}

export async function listLogEvents(
  params: LogListParams
): Promise<LogEvent[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
  const offset = Math.max(params.offset ?? 0, 0);

  return db.logEvent.findMany({
    where: buildLogWhere(params),
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    skip: offset
  });
}

export async function listAuditEvents(
  params: AuditListParams
): Promise<AuditEvent[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 500);
  const offset = Math.max(params.offset ?? 0, 0);

  return db.auditEvent.findMany({
    where: buildAuditWhere(params),
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    skip: offset
  });
}

export async function getActivityStats(
  organizationId: string,
  windowHours: number,
  options: StatsOptions = {}
): Promise<{
  totalEvents: number;
  byType: Record<string, number>;
  errorCount: number;
  warningCount: number;
  recentErrors: LogEvent[];
}> {
  const startDate =
    options.startDate ??
    new Date(Date.now() - Math.max(windowHours, 1) * 60 * 60 * 1000);
  const endDate = options.endDate;

  const activityWhere = buildActivityWhere({
    organizationId,
    businessId: options.businessId,
    businessIds: options.businessIds,
    startDate,
    endDate
  });
  const logWhere = buildLogWhere({
    organizationId,
    businessId: options.businessId,
    businessIds: options.businessIds,
    startDate,
    endDate
  });
  const auditWhere = options.includeAuditEvents
    ? buildAuditWhere({
        organizationId,
        startDate,
        endDate
      })
    : null;

  const [activityCount, activityByType, logCount, errorCount, warningCount, recentErrors, auditCount] =
    await Promise.all([
      db.activityEntry.count({
        where: activityWhere
      }),
      db.activityEntry.groupBy({
        by: ["type"],
        where: activityWhere,
        _count: {
          _all: true
        }
      }),
      db.logEvent.count({
        where: logWhere
      }),
      db.logEvent.count({
        where: {
          ...logWhere,
          level: "error"
        }
      }),
      db.logEvent.count({
        where: {
          ...logWhere,
          level: "warning"
        }
      }),
      db.logEvent.findMany({
        where: {
          ...logWhere,
          level: "error"
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      }),
      auditWhere
        ? db.auditEvent.count({
            where: auditWhere
          })
        : Promise.resolve(0)
    ]);

  return {
    totalEvents: activityCount + logCount + auditCount,
    byType: Object.fromEntries(
      activityByType.map((entry) => [entry.type, entry._count._all])
    ),
    errorCount,
    warningCount,
    recentErrors
  };
}
