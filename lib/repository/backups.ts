import { Prisma, type Backup } from "@prisma/client";

import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";

const backupWithBusinessInclude = {
  business: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.BackupInclude;

export type BackupWithBusiness = Prisma.BackupGetPayload<{
  include: typeof backupWithBusinessInclude;
}>;

type BackupListParams = {
  organizationId: string;
  businessId?: string;
  sourceType?: string;
  status?: string;
  limit?: number;
  businessIds?: string[];
};

type CreateBackupParams = {
  organizationId: string;
  businessId?: string;
  sourceType: string;
  scopeType?: string;
  scopeId?: string;
  triggeredBy: string;
  reason?: string;
};

type SafeBusinessExport = {
  business: Record<string, unknown> | null;
  agents: Record<string, unknown>[];
  workflows: Record<string, unknown>[];
  knowledgeItems: Record<string, unknown>[];
  workspaceDocuments: Record<string, unknown>[];
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildSourceTypeWhere(sourceType?: string) {
  if (!sourceType || sourceType === "all") {
    return {};
  }

  if (sourceType === "workspace") {
    return {
      sourceType: {
        in: ["workspace_snapshot", "workspace_file"]
      }
    } satisfies Prisma.BackupWhereInput;
  }

  if (sourceType === "config") {
    return {
      sourceType: "gateway_config"
    } satisfies Prisma.BackupWhereInput;
  }

  return {
    sourceType
  } satisfies Prisma.BackupWhereInput;
}

function buildBackupWhere(params: BackupListParams): Prisma.BackupWhereInput {
  return {
    organizationId: params.organizationId,
    ...(params.businessIds !== undefined
      ? {
          businessId: {
            in: params.businessIds
          }
        }
      : {}),
    ...(params.businessId
      ? {
          businessId: params.businessId
        }
      : {}),
    ...(params.status && params.status !== "all"
      ? {
          status: params.status
        }
      : {}),
    ...buildSourceTypeWhere(params.sourceType)
  };
}

async function readGatewayConfigBackupPayload(organizationId: string) {
  const [organization, integrations] = await Promise.all([
    db.organization.findUnique({
      where: {
        id: organizationId
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        config: true,
        updatedAt: true
      }
    }),
    db.integration.findMany({
      where: {
        organizationId
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        scope: true,
        status: true,
        authType: true,
        config: true,
        assignedBusinessIds: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        key: "asc"
      }
    })
  ]);

  return {
    organization,
    integrations
  };
}

async function readWorkspaceSnapshotPayload(businessId: string) {
  const [business, documents] = await Promise.all([
    db.business.findUnique({
      where: {
        id: businessId
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    }),
    db.workspaceDocument.findMany({
      where: {
        businessId
      },
      orderBy: {
        filePath: "asc"
      }
    })
  ]);

  return {
    business,
    documents
  };
}

async function readExportBundlePayload(
  organizationId: string,
  businessId: string
): Promise<SafeBusinessExport> {
  const [business, agents, workflows, knowledgeItems, workspaceDocuments] =
    await Promise.all([
      db.business.findFirst({
        where: {
          id: businessId,
          organizationId
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          slug: true,
          status: true,
          health: true,
          summary: true,
          brandVoice: true,
          primaryOwners: true,
          secondaryOwners: true,
          mainGoals: true,
          coreOffers: true,
          openTasks: true,
          recentSessions: true,
          systemPrompt: true,
          guardrails: true,
          offerAndAudienceNotes: true,
          bannedClaims: true,
          safetyMode: true,
          primaryModel: true,
          fallbackModel: true,
          modelSource: true,
          currentIntegrations: true,
          knowledgeBase: true,
          config: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      db.agent.findMany({
        where: {
          businessId
        },
        select: {
          id: true,
          businessId: true,
          organizationId: true,
          displayName: true,
          emoji: true,
          role: true,
          purpose: true,
          type: true,
          status: true,
          systemPrompt: true,
          roleInstructions: true,
          outputStyle: true,
          constraints: true,
          escalationRules: true,
          askBeforeDoing: true,
          primaryModel: true,
          fallbackModel: true,
          modelSource: true,
          safetyMode: true,
          tools: true,
          config: true,
          workspacePath: true,
          defaultAgent: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [{ type: "asc" }, { displayName: "asc" }]
      }),
      db.workflow.findMany({
        where: {
          businessId
        },
        select: {
          id: true,
          businessId: true,
          organizationId: true,
          agentId: true,
          name: true,
          description: true,
          enabled: true,
          trigger: true,
          output: true,
          scheduleMode: true,
          frequency: true,
          timezone: true,
          cronExpression: true,
          approvalMode: true,
          safetyMode: true,
          actionType: true,
          resultStatus: true,
          lastRunAt: true,
          lastRunResult: true,
          config: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          name: "asc"
        }
      }),
      db.knowledgeItem.findMany({
        where: {
          businessId
        },
        orderBy: [{ category: "asc" }, { title: "asc" }]
      }),
      db.workspaceDocument.findMany({
        where: {
          businessId
        },
        orderBy: {
          filePath: "asc"
        }
      })
    ]);

  return {
    business,
    agents,
    workflows,
    knowledgeItems,
    workspaceDocuments
  };
}

async function captureBackupPayload(params: CreateBackupParams) {
  switch (params.sourceType) {
    case "gateway_config":
      return readGatewayConfigBackupPayload(params.organizationId);
    case "workspace_snapshot":
      if (!params.businessId) {
        throw badRequest("Workspace snapshots require a business.");
      }
      return readWorkspaceSnapshotPayload(params.businessId);
    case "export_bundle":
      if (!params.businessId) {
        throw badRequest("Export bundles require a business.");
      }
      return readExportBundlePayload(params.organizationId, params.businessId);
    default:
      throw badRequest("Unsupported backup type.");
  }
}

async function createAutomaticRestoreBackup(params: {
  organizationId: string;
  businessId?: string | null;
  sourceType: string;
  scopeType?: string | null;
  scopeId?: string | null;
  triggeredBy: string;
  reason: string;
}) {
  const payload = await captureBackupPayload({
    organizationId: params.organizationId,
    businessId: params.businessId ?? undefined,
    sourceType: params.sourceType,
    scopeType: params.scopeType ?? undefined,
    scopeId: params.scopeId ?? undefined,
    triggeredBy: params.triggeredBy,
    reason: params.reason
  });

  return db.backup.create({
    data: {
      organizationId: params.organizationId,
      businessId: params.businessId ?? null,
      sourceType: params.sourceType,
      scopeType: params.scopeType ?? null,
      scopeId: params.scopeId ?? null,
      status: "completed",
      payload: toJsonValue(payload),
      triggeredBy: params.triggeredBy,
      reason: params.reason
    }
  });
}

async function restoreWorkspaceDocuments(
  tx: Prisma.TransactionClient,
  businessId: string,
  documents: Array<Record<string, unknown>>
) {
  let restoredCount = 0;

  for (const document of documents) {
    const filePath =
      typeof document.filePath === "string" ? document.filePath : null;

    if (!filePath) {
      continue;
    }

    const existing = await tx.workspaceDocument.findFirst({
      where: {
        businessId,
        filePath
      }
    });

    const data = {
      businessId,
      agentId: typeof document.agentId === "string" ? document.agentId : null,
      filePath,
      content: typeof document.content === "string" ? document.content : "",
      category: typeof document.category === "string" ? document.category : "other",
      tier: typeof document.tier === "string" ? document.tier : "warm",
      syncStatus:
        typeof document.syncStatus === "string" ? document.syncStatus : "pending",
      syncTarget:
        typeof document.syncTarget === "string" ? document.syncTarget : "database",
      lastSyncAt:
        typeof document.lastSyncAt === "string" || document.lastSyncAt instanceof Date
          ? new Date(document.lastSyncAt)
          : null
    } satisfies Prisma.WorkspaceDocumentUncheckedCreateInput;

    if (existing) {
      await tx.workspaceDocument.update({
        where: {
          id: existing.id
        },
        data
      });
    } else {
      await tx.workspaceDocument.create({
        data
      });
    }

    restoredCount += 1;
  }

  return restoredCount;
}

async function restoreKnowledgeItems(
  tx: Prisma.TransactionClient,
  businessId: string,
  items: Array<Record<string, unknown>>
) {
  let restoredCount = 0;

  for (const item of items) {
    const id = typeof item.id === "string" ? item.id : null;
    const title = typeof item.title === "string" ? item.title : null;

    if (!title) {
      continue;
    }

    const data = {
      businessId,
      category:
        typeof item.category === "string" ? item.category : "about_business",
      title,
      content: typeof item.content === "string" ? item.content : "",
      sourceType:
        typeof item.sourceType === "string" ? item.sourceType : "knowledge_base",
      enabled: typeof item.enabled === "boolean" ? item.enabled : true,
      tokenCount:
        typeof item.tokenCount === "number" ? item.tokenCount : undefined,
      metadata:
        item.metadata === undefined
          ? Prisma.JsonNull
          : (item.metadata as Prisma.InputJsonValue)
    } satisfies Prisma.KnowledgeItemUncheckedCreateInput;

    if (id) {
      const existing = await tx.knowledgeItem.findUnique({
        where: {
          id
        }
      });

      if (existing) {
        await tx.knowledgeItem.update({
          where: {
            id
          },
          data
        });
      } else {
        await tx.knowledgeItem.create({
          data: {
            ...data,
            id
          }
        });
      }
    } else {
      await tx.knowledgeItem.create({
        data
      });
    }

    restoredCount += 1;
  }

  return restoredCount;
}

async function restoreAgents(
  tx: Prisma.TransactionClient,
  businessId: string,
  organizationId: string,
  agents: Array<Record<string, unknown>>
) {
  let restoredCount = 0;

  for (const agent of agents) {
    const id = typeof agent.id === "string" ? agent.id : null;
    const displayName =
      typeof agent.displayName === "string" ? agent.displayName : null;
    const role = typeof agent.role === "string" ? agent.role : null;

    if (!id || !displayName || !role) {
      continue;
    }

    const data = {
      businessId,
      organizationId,
      displayName,
      emoji: typeof agent.emoji === "string" ? agent.emoji : null,
      role,
      purpose: typeof agent.purpose === "string" ? agent.purpose : null,
      type: typeof agent.type === "string" ? agent.type : "specialist",
      status: typeof agent.status === "string" ? agent.status : "active",
      systemPrompt:
        typeof agent.systemPrompt === "string" ? agent.systemPrompt : null,
      roleInstructions:
        typeof agent.roleInstructions === "string"
          ? agent.roleInstructions
          : null,
      outputStyle:
        typeof agent.outputStyle === "string" ? agent.outputStyle : null,
      constraints:
        typeof agent.constraints === "string" ? agent.constraints : null,
      escalationRules:
        typeof agent.escalationRules === "string" ? agent.escalationRules : null,
      askBeforeDoing:
        typeof agent.askBeforeDoing === "string" ? agent.askBeforeDoing : null,
      primaryModel:
        typeof agent.primaryModel === "string" ? agent.primaryModel : null,
      fallbackModel:
        typeof agent.fallbackModel === "string" ? agent.fallbackModel : null,
      modelSource:
        typeof agent.modelSource === "string" ? agent.modelSource : "business",
      safetyMode:
        typeof agent.safetyMode === "string" ? agent.safetyMode : null,
      tools:
        agent.tools === undefined
          ? Prisma.JsonNull
          : (agent.tools as Prisma.InputJsonValue),
      config:
        agent.config === undefined
          ? Prisma.JsonNull
          : (agent.config as Prisma.InputJsonValue),
      workspacePath:
        typeof agent.workspacePath === "string" ? agent.workspacePath : null,
      defaultAgent:
        typeof agent.defaultAgent === "boolean" ? agent.defaultAgent : false
    } satisfies Prisma.AgentUncheckedCreateInput;

    const existing = await tx.agent.findUnique({
      where: {
        id
      }
    });

    if (existing) {
      await tx.agent.update({
        where: {
          id
        },
        data
      });
    } else {
      await tx.agent.create({
        data: {
          ...data,
          id
        }
      });
    }

    restoredCount += 1;
  }

  return restoredCount;
}

async function restoreWorkflows(
  tx: Prisma.TransactionClient,
  businessId: string,
  organizationId: string,
  workflows: Array<Record<string, unknown>>
) {
  let restoredCount = 0;

  for (const workflow of workflows) {
    const id = typeof workflow.id === "string" ? workflow.id : null;
    const name = typeof workflow.name === "string" ? workflow.name : null;

    if (!id || !name) {
      continue;
    }

    const data = {
      businessId,
      organizationId,
      agentId:
        typeof workflow.agentId === "string" ? workflow.agentId : null,
      name,
      description:
        typeof workflow.description === "string" ? workflow.description : null,
      enabled: typeof workflow.enabled === "boolean" ? workflow.enabled : true,
      trigger: typeof workflow.trigger === "string" ? workflow.trigger : "manual",
      output: typeof workflow.output === "string" ? workflow.output : "chat",
      scheduleMode:
        typeof workflow.scheduleMode === "string" ? workflow.scheduleMode : null,
      frequency:
        typeof workflow.frequency === "string" ? workflow.frequency : null,
      timezone: typeof workflow.timezone === "string" ? workflow.timezone : null,
      cronExpression:
        typeof workflow.cronExpression === "string"
          ? workflow.cronExpression
          : null,
      approvalMode:
        typeof workflow.approvalMode === "string"
          ? workflow.approvalMode
          : null,
      safetyMode:
        typeof workflow.safetyMode === "string" ? workflow.safetyMode : null,
      actionType:
        typeof workflow.actionType === "string" ? workflow.actionType : null,
      resultStatus:
        typeof workflow.resultStatus === "string" ? workflow.resultStatus : null,
      lastRunAt:
        typeof workflow.lastRunAt === "string" || workflow.lastRunAt instanceof Date
          ? new Date(workflow.lastRunAt)
          : null,
      lastRunResult:
        workflow.lastRunResult === undefined
          ? Prisma.JsonNull
          : (workflow.lastRunResult as Prisma.InputJsonValue),
      config:
        workflow.config === undefined
          ? Prisma.JsonNull
          : (workflow.config as Prisma.InputJsonValue)
    } satisfies Prisma.WorkflowUncheckedCreateInput;

    const existing = await tx.workflow.findUnique({
      where: {
        id
      }
    });

    if (existing) {
      await tx.workflow.update({
        where: {
          id
        },
        data
      });
    } else {
      await tx.workflow.create({
        data: {
          ...data,
          id
        }
      });
    }

    restoredCount += 1;
  }

  return restoredCount;
}

export function countBackups(params: BackupListParams) {
  return db.backup.count({
    where: buildBackupWhere(params)
  });
}

export async function listBackups(
  params: BackupListParams
): Promise<BackupWithBusiness[]> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 200);

  return db.backup.findMany({
    where: buildBackupWhere(params),
    include: backupWithBusinessInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}

export async function getBackupById(
  id: string,
  organizationId: string,
  businessIds?: string[]
): Promise<Backup | null> {
  return db.backup.findFirst({
    where: {
      id,
      organizationId,
      ...(businessIds !== undefined
        ? {
            businessId: {
              in: businessIds
            }
          }
        : {})
    }
  });
}

export async function createManualBackup(
  params: CreateBackupParams
): Promise<Backup> {
  const payload = await captureBackupPayload(params);
  const normalizedReason = normalizeOptionalText(params.reason);

  return db.$transaction(async (tx) => {
    const backup = await tx.backup.create({
      data: {
        organizationId: params.organizationId,
        businessId: params.businessId ?? null,
        sourceType: params.sourceType,
        scopeType: normalizeOptionalText(params.scopeType),
        scopeId: normalizeOptionalText(params.scopeId),
        status: "completed",
        payload: toJsonValue(payload),
        triggeredBy: params.triggeredBy,
        reason: normalizedReason
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        actorEmail: params.triggeredBy,
        eventType: "backup_created",
        entityType: "backup",
        entityId: backup.id,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue(backup)
      }
    });

    if (params.businessId) {
      await tx.activityEntry.create({
        data: {
          businessId: params.businessId,
          type: "backup",
          title: "Backup created",
          detail: `${params.sourceType.replaceAll("_", " ")} snapshot completed.`,
          status: "completed",
          metadata: {
            backupId: backup.id,
            sourceType: backup.sourceType,
            scopeType: backup.scopeType,
            scopeId: backup.scopeId
          }
        }
      });
    }

    return backup;
  });
}

export async function restoreFromBackup(
  id: string,
  organizationId: string,
  userId: string
): Promise<{ restored: boolean; summary: string }> {
  const backup = await getBackupById(id, organizationId);

  if (!backup) {
    throw notFound("Backup not found.");
  }

  if (backup.status !== "completed" || !backup.payload) {
    throw badRequest("Only completed backups can be restored.");
  }

  const actor = await db.missionControlAdminUser.findUnique({
    where: {
      id: userId
    },
    select: {
      id: true,
      email: true
    }
  });

  if (!actor) {
    throw notFound("Admin user not found.");
  }

  const payload =
    typeof backup.payload === "object" && backup.payload !== null
      ? (backup.payload as Record<string, unknown>)
      : null;

  if (!payload) {
    throw badRequest("Backup payload is invalid.");
  }

  await createAutomaticRestoreBackup({
    organizationId,
    businessId: backup.businessId,
    sourceType: backup.sourceType,
    scopeType: backup.scopeType,
    scopeId: backup.scopeId,
    triggeredBy: actor.email,
    reason: `Automatic snapshot before restore from backup ${backup.id}`
  });

  const summaryParts: string[] = [];

  await db.$transaction(async (tx) => {
    switch (backup.sourceType) {
      case "workspace_snapshot": {
        if (!backup.businessId) {
          throw badRequest("Workspace snapshot restore requires a business.");
        }

        const documents = Array.isArray(payload.documents)
          ? (payload.documents as Array<Record<string, unknown>>)
          : [];
        const restoredDocuments = await restoreWorkspaceDocuments(
          tx,
          backup.businessId,
          documents
        );

        summaryParts.push(`${restoredDocuments} workspace file(s) restored`);
        break;
      }
      case "gateway_config": {
        const organizationPayload =
          payload.organization &&
          typeof payload.organization === "object" &&
          !Array.isArray(payload.organization)
            ? (payload.organization as Record<string, unknown>)
            : null;

        if (organizationPayload) {
          await tx.organization.update({
            where: {
              id: organizationId
            },
            data: {
              config:
                organizationPayload.config === undefined
                  ? Prisma.JsonNull
                  : (organizationPayload.config as Prisma.InputJsonValue),
              status:
                typeof organizationPayload.status === "string"
                  ? organizationPayload.status
                  : undefined,
              name:
                typeof organizationPayload.name === "string"
                  ? organizationPayload.name
                  : undefined,
              slug:
                typeof organizationPayload.slug === "string"
                  ? organizationPayload.slug
                  : undefined
            }
          });
        }

        const integrations = Array.isArray(payload.integrations)
          ? (payload.integrations as Array<Record<string, unknown>>)
          : [];

        for (const integration of integrations) {
          const key = typeof integration.key === "string" ? integration.key : null;
          const name =
            typeof integration.name === "string" ? integration.name : null;

          if (!key || !name) {
            continue;
          }

          const existing = await tx.integration.findFirst({
            where: {
              organizationId,
              key
            }
          });

          const data = {
            name,
            description:
              typeof integration.description === "string"
                ? integration.description
                : null,
            scope:
              typeof integration.scope === "string"
                ? integration.scope
                : "organization",
            status:
              typeof integration.status === "string"
                ? integration.status
                : "disconnected",
            authType:
              typeof integration.authType === "string"
                ? integration.authType
                : "api_key",
            config:
              integration.config === undefined
                ? Prisma.JsonNull
                : (integration.config as Prisma.InputJsonValue),
            assignedBusinessIds: Array.isArray(integration.assignedBusinessIds)
              ? integration.assignedBusinessIds.filter(
                  (value): value is string => typeof value === "string"
                )
              : []
          } satisfies Prisma.IntegrationUncheckedUpdateInput;

          if (existing) {
            await tx.integration.update({
              where: {
                id: existing.id
              },
              data
            });
          } else {
            await tx.integration.create({
              data: {
                ...data,
                organizationId,
                key,
                secretKeys: [],
                encryptedSecrets: Prisma.JsonNull
              }
            });
          }
        }

        summaryParts.push("Organization settings restored");
        summaryParts.push(`${integrations.length} integration definition(s) refreshed`);
        break;
      }
      case "export_bundle": {
        if (!backup.businessId) {
          throw badRequest("Export bundle restore requires a business.");
        }

        const businessPayload =
          payload.business &&
          typeof payload.business === "object" &&
          !Array.isArray(payload.business)
            ? (payload.business as Record<string, unknown>)
            : null;

        if (businessPayload) {
          await tx.business.update({
            where: {
              id: backup.businessId
            },
            data: {
              name:
                typeof businessPayload.name === "string"
                  ? businessPayload.name
                  : undefined,
              slug:
                typeof businessPayload.slug === "string"
                  ? businessPayload.slug
                  : undefined,
              status:
                typeof businessPayload.status === "string"
                  ? businessPayload.status
                  : undefined,
              health:
                businessPayload.health === undefined
                  ? undefined
                  : (businessPayload.health as Prisma.InputJsonValue),
              summary:
                typeof businessPayload.summary === "string"
                  ? businessPayload.summary
                  : undefined,
              brandVoice:
                typeof businessPayload.brandVoice === "string"
                  ? businessPayload.brandVoice
                  : undefined,
              primaryOwners:
                typeof businessPayload.primaryOwners === "string"
                  ? businessPayload.primaryOwners
                  : undefined,
              secondaryOwners:
                typeof businessPayload.secondaryOwners === "string"
                  ? businessPayload.secondaryOwners
                  : undefined,
              mainGoals:
                typeof businessPayload.mainGoals === "string"
                  ? businessPayload.mainGoals
                  : undefined,
              coreOffers:
                typeof businessPayload.coreOffers === "string"
                  ? businessPayload.coreOffers
                  : undefined,
              openTasks:
                typeof businessPayload.openTasks === "string"
                  ? businessPayload.openTasks
                  : undefined,
              recentSessions:
                typeof businessPayload.recentSessions === "string"
                  ? businessPayload.recentSessions
                  : undefined,
              systemPrompt:
                typeof businessPayload.systemPrompt === "string"
                  ? businessPayload.systemPrompt
                  : undefined,
              guardrails:
                typeof businessPayload.guardrails === "string"
                  ? businessPayload.guardrails
                  : undefined,
              offerAndAudienceNotes:
                typeof businessPayload.offerAndAudienceNotes === "string"
                  ? businessPayload.offerAndAudienceNotes
                  : undefined,
              bannedClaims:
                typeof businessPayload.bannedClaims === "string"
                  ? businessPayload.bannedClaims
                  : undefined,
              safetyMode:
                typeof businessPayload.safetyMode === "string"
                  ? businessPayload.safetyMode
                  : undefined,
              primaryModel:
                typeof businessPayload.primaryModel === "string"
                  ? businessPayload.primaryModel
                  : undefined,
              fallbackModel:
                typeof businessPayload.fallbackModel === "string"
                  ? businessPayload.fallbackModel
                  : undefined,
              modelSource:
                typeof businessPayload.modelSource === "string"
                  ? businessPayload.modelSource
                  : undefined,
              currentIntegrations:
                businessPayload.currentIntegrations === undefined
                  ? undefined
                  : (businessPayload.currentIntegrations as Prisma.InputJsonValue),
              knowledgeBase:
                businessPayload.knowledgeBase === undefined
                  ? undefined
                  : (businessPayload.knowledgeBase as Prisma.InputJsonValue),
              config:
                businessPayload.config === undefined
                  ? undefined
                  : (businessPayload.config as Prisma.InputJsonValue)
            }
          });

          summaryParts.push("Business settings restored");
        }

        const [restoredAgents, restoredWorkflows, restoredKnowledge, restoredWorkspace] =
          await Promise.all([
            restoreAgents(
              tx,
              backup.businessId,
              organizationId,
              Array.isArray(payload.agents)
                ? (payload.agents as Array<Record<string, unknown>>)
                : []
            ),
            restoreWorkflows(
              tx,
              backup.businessId,
              organizationId,
              Array.isArray(payload.workflows)
                ? (payload.workflows as Array<Record<string, unknown>>)
                : []
            ),
            restoreKnowledgeItems(
              tx,
              backup.businessId,
              Array.isArray(payload.knowledgeItems)
                ? (payload.knowledgeItems as Array<Record<string, unknown>>)
                : []
            ),
            restoreWorkspaceDocuments(
              tx,
              backup.businessId,
              Array.isArray(payload.workspaceDocuments)
                ? (payload.workspaceDocuments as Array<Record<string, unknown>>)
                : []
            )
          ]);

        summaryParts.push(`${restoredAgents} agent definition(s) restored`);
        summaryParts.push(`${restoredWorkflows} workflow(s) restored`);
        summaryParts.push(`${restoredKnowledge} knowledge item(s) restored`);
        summaryParts.push(`${restoredWorkspace} workspace file(s) restored`);
        break;
      }
      default:
        throw badRequest("Unsupported backup type.");
    }

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: actor.id,
        actorEmail: actor.email,
        eventType: "backup_restored",
        entityType: "backup",
        entityId: backup.id,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue({
          restoredFromBackupId: backup.id,
          sourceType: backup.sourceType,
          summary: summaryParts
        })
      }
    });

    if (backup.businessId) {
      await tx.activityEntry.create({
        data: {
          businessId: backup.businessId,
          type: "backup",
          title: "Backup restored",
          detail: summaryParts.join(". "),
          status: "completed",
          metadata: {
            backupId: backup.id,
            sourceType: backup.sourceType
          }
        }
      });
    }
  });

  return {
    restored: true,
    summary: summaryParts.join(". ")
  };
}

export async function getBackupStats(
  organizationId: string,
  businessIds?: string[]
): Promise<{
  totalBackups: number;
  lastBackupAt: Date | null;
  totalSizeEstimate: number;
  bySourceType: Record<string, number>;
}> {
  const backups = await db.backup.findMany({
    where: {
      organizationId,
      ...(businessIds !== undefined
        ? {
            businessId: {
              in: businessIds
            }
          }
        : {})
    },
    select: {
      sourceType: true,
      createdAt: true,
      payload: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const bySourceType = backups.reduce<Record<string, number>>((acc, backup) => {
    acc[backup.sourceType] = (acc[backup.sourceType] ?? 0) + 1;
    return acc;
  }, {});

  const totalSizeEstimate = backups.reduce((sum, backup) => {
    return sum + JSON.stringify(backup.payload ?? null).length;
  }, 0);

  return {
    totalBackups: backups.length,
    lastBackupAt: backups[0]?.createdAt ?? null,
    totalSizeEstimate,
    bySourceType
  };
}
