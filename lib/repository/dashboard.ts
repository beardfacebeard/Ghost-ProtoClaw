import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { runFullHealthCheck } from "@/lib/health/system-health";
import { listActivityEntries } from "@/lib/repository/activity";
import { getPendingCount } from "@/lib/repository/approvals";

type DashboardStats = {
  activeBusinesses: number;
  totalAgents: number;
  workflowsEnabled: number;
  pendingApprovals: number;
};

type ChecklistStatus = {
  hasBusinesses: boolean;
  hasAgents: boolean;
  hasWorkflows: boolean;
  hasIntegrations: boolean;
  hasModels: boolean;
};

type HealthStatus = {
  database: "ok" | "error";
  openclaw: "connected" | "unconfigured" | "error";
};

function businessScopeWhere(
  organizationId: string,
  role: string,
  businessIds: string[]
) {
  if (role === "super_admin") {
    return { organizationId };
  }

  return {
    organizationId,
    id: {
      in: businessIds
    }
  };
}

function hasModelConfig(config: Prisma.JsonValue | null | undefined) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }

  const modelConfig = config as Record<string, unknown>;
  return Boolean(
    modelConfig.primaryModel ||
      modelConfig.defaultModel ||
      modelConfig.modelDefaults ||
      modelConfig.providerDefaults
  );
}

export async function getDashboardStats(
  organizationId: string,
  role: string,
  businessIds: string[]
): Promise<DashboardStats> {
  const businessWhere = businessScopeWhere(organizationId, role, businessIds);

  const [activeBusinesses, totalAgents, workflowsEnabled, pendingApprovals] =
    await Promise.all([
      db.business.count({
        where: {
          ...businessWhere,
          status: "active"
        }
      }),
      db.agent.count({
        where:
          role === "super_admin"
            ? {
                OR: [
                  {
                    business: {
                      organizationId
                    }
                  },
                  {
                    organizationId
                  }
                ]
              }
            : {
                businessId: {
                  in: businessIds
                }
              }
      }),
      db.workflow.count({
        where:
          role === "super_admin"
            ? {
                enabled: true,
                OR: [
                  {
                    business: {
                      organizationId
                    }
                  },
                  {
                    organizationId
                  }
                ]
              }
            : {
                enabled: true,
                businessId: {
                  in: businessIds
                }
              }
      }),
      getPendingCount(
        organizationId,
        role === "admin" ? businessIds : undefined
      )
    ]);

  return {
    activeBusinesses,
    totalAgents,
    workflowsEnabled,
    pendingApprovals
  };
}

export async function getRecentActivity(
  organizationId: string,
  limit: number,
  role: string = "super_admin",
  businessIds: string[] = []
) {
  return listActivityEntries({
    organizationId,
    limit,
    businessIds: role === "admin" ? businessIds : undefined
  });
}

export async function getChecklistStatus(
  organizationId: string,
  role: string = "super_admin",
  businessIds: string[] = []
): Promise<ChecklistStatus> {
  const businessWhere = businessScopeWhere(organizationId, role, businessIds);

  const [businessCount, agentCount, workflowCount, integrationCount, org] =
    await Promise.all([
      db.business.count({
        where: businessWhere
      }),
      db.agent.count({
        where:
          role === "super_admin"
            ? {
                OR: [
                  {
                    business: {
                      organizationId
                    }
                  },
                  {
                    organizationId
                  }
                ]
              }
            : {
                businessId: {
                  in: businessIds
                }
              }
      }),
      db.workflow.count({
        where:
          role === "super_admin"
            ? {
                OR: [
                  {
                    business: {
                      organizationId
                    }
                  },
                  {
                    organizationId
                  }
                ]
              }
            : {
                businessId: {
                  in: businessIds
                }
              }
      }),
      db.integration.count({
        where: {
          organizationId,
          ...(role === "super_admin"
            ? {}
            : {
                OR: [
                  { scope: "organization" },
                  {
                    assignedBusinessIds: {
                      hasSome: businessIds
                    }
                  }
                ]
              })
        }
      }),
      db.organization.findUnique({
        where: { id: organizationId },
        select: {
          config: true
        }
      })
    ]);

  const [businessModelCount, agentModelCount] = await Promise.all([
    db.business.count({
      where: {
        ...businessWhere,
        OR: [{ primaryModel: { not: null } }, { fallbackModel: { not: null } }]
      }
    }),
    db.agent.count({
      where:
        role === "super_admin"
          ? {
              OR: [
                {
                  business: {
                    organizationId
                  },
                  primaryModel: {
                    not: null
                  }
                },
                {
                  business: {
                    organizationId
                  },
                  fallbackModel: {
                    not: null
                  }
                },
                {
                  organizationId,
                  primaryModel: {
                    not: null
                  }
                },
                {
                  organizationId,
                  fallbackModel: {
                    not: null
                  }
                }
              ]
            }
          : {
              businessId: {
                in: businessIds
              },
              OR: [{ primaryModel: { not: null } }, { fallbackModel: { not: null } }]
            }
    })
  ]);

  return {
    hasBusinesses: businessCount > 0,
    hasAgents: agentCount > 0,
    hasWorkflows: workflowCount > 0,
    hasIntegrations: integrationCount > 0,
    hasModels:
      businessModelCount > 0 ||
      agentModelCount > 0 ||
      hasModelConfig(org?.config)
  };
}

export async function getSystemHealth(): Promise<HealthStatus> {
  const report = await runFullHealthCheck();
  const databaseCheck = report.checks.find((check) => check.name === "Database");
  const openclawCheck = report.checks.find(
    (check) => check.name === "OpenClaw Runtime"
  );

  return {
    database: databaseCheck?.status === "error" ? "error" : "ok",
    openclaw:
      openclawCheck?.status === "error"
        ? "error"
        : openclawCheck?.status === "unconfigured"
          ? "unconfigured"
          : "connected"
  };
}
