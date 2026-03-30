import { Prisma, type WorkspaceDocument } from "@prisma/client";

import {
  estimateWorkspaceTokens,
  getWorkspaceSyncMode,
  MEMORY_TIERS,
  WORKSPACE_CATEGORIES,
  validateWorkspaceFilePath
} from "@/lib/brain/workspace";
import { db } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

type ScopedWorkspaceDocument = WorkspaceDocument & {
  business: {
    id: string;
    name: string;
    organizationId: string;
  };
};

export { MEMORY_TIERS, WORKSPACE_CATEGORIES } from "@/lib/brain/workspace";

const tierSortOrder: Record<string, number> = {
  hot: 0,
  warm: 1,
  cold: 2
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeOptionalString(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function ensureWorkspaceBusiness(businessId: string) {
  const business = await db.business.findUnique({
    where: {
      id: businessId
    },
    select: {
      id: true,
      name: true,
      organizationId: true
    }
  });

  if (!business) {
    throw notFound("Business not found.");
  }

  return business;
}

async function ensureWorkspaceAgent(
  businessId: string,
  agentId?: string | null
) {
  if (!agentId) {
    return null;
  }

  const agent = await db.agent.findFirst({
    where: {
      id: agentId,
      businessId
    },
    select: {
      id: true
    }
  });

  if (!agent) {
    throw badRequest("Selected agent is not available for this workspace file.");
  }

  return agent;
}

async function getScopedWorkspaceDocument(
  id: string,
  organizationId: string
): Promise<ScopedWorkspaceDocument | null> {
  return db.workspaceDocument.findFirst({
    where: {
      id,
      business: {
        organizationId
      }
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          organizationId: true
        }
      }
    }
  });
}

async function ensureUniqueWorkspacePath(
  businessId: string,
  filePath: string,
  excludeId?: string
) {
  const existing = await db.workspaceDocument.findFirst({
    where: {
      businessId,
      filePath,
      ...(excludeId
        ? {
            id: {
              not: excludeId
            }
          }
        : {})
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throw conflict("A workspace file already exists at that path.");
  }
}

async function createWorkspaceBackup(
  tx: Prisma.TransactionClient,
  document: ScopedWorkspaceDocument,
  reason: string,
  auditContext: AuditContext
) {
  await tx.backup.create({
    data: {
      organizationId: document.business.organizationId,
      businessId: document.businessId,
      sourceType: "workspace_file",
      scopeType: "workspace_document",
      scopeId: document.id,
      status: "completed",
      payload: toJsonValue(document),
      triggeredBy: auditContext.actorEmail ?? auditContext.actorUserId ?? "system",
      reason
    }
  });

  await tx.logEvent.create({
    data: {
      businessId: document.businessId,
      level: "info",
      action: "workspace_backup_created",
      message: `Workspace backup created for ${document.filePath}.`,
      metadata: {
        workspaceDocumentId: document.id,
        reason
      }
    }
  });
}

function sortWorkspaceDocuments(documents: WorkspaceDocument[]) {
  return [...documents].sort((left, right) => {
    const tierDiff =
      (tierSortOrder[left.tier] ?? 99) - (tierSortOrder[right.tier] ?? 99);

    if (tierDiff !== 0) {
      return tierDiff;
    }

    const categoryDiff = left.category.localeCompare(right.category);
    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    return left.filePath.localeCompare(right.filePath);
  });
}

export async function listWorkspaceDocuments(params: {
  businessId: string;
  organizationId: string;
  category?: string;
  tier?: string;
  agentId?: string;
  search?: string;
}): Promise<WorkspaceDocument[]> {
  const search = params.search?.trim();

  const documents = await db.workspaceDocument.findMany({
    where: {
      businessId: params.businessId,
      business: {
        organizationId: params.organizationId
      },
      ...(params.category && params.category !== "all"
        ? {
            category: params.category
          }
        : {}),
      ...(params.tier && params.tier !== "all"
        ? {
            tier: params.tier
          }
        : {}),
      ...(params.agentId && params.agentId !== "all"
        ? {
            agentId: params.agentId
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                filePath: {
                  contains: search,
                  mode: "insensitive"
                }
              },
              {
                content: {
                  contains: search,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    }
  });

  return sortWorkspaceDocuments(documents);
}

export async function getWorkspaceDocumentById(
  id: string,
  organizationId: string
): Promise<WorkspaceDocument | null> {
  return getScopedWorkspaceDocument(id, organizationId);
}

export async function getWorkspaceDocumentByPath(
  businessId: string,
  filePath: string
): Promise<WorkspaceDocument | null> {
  return db.workspaceDocument.findFirst({
    where: {
      businessId,
      filePath
    }
  });
}

export async function createWorkspaceDocument(
  data: AuditContext & {
    businessId: string;
    agentId?: string | null;
    filePath: string;
    content: string;
    category?: string;
    tier?: string;
    syncTarget?: string;
  }
): Promise<WorkspaceDocument> {
  const business = await ensureWorkspaceBusiness(data.businessId);
  const pathValidation = validateWorkspaceFilePath(data.filePath);

  if (!pathValidation.valid) {
    throw badRequest(pathValidation.error);
  }

  await ensureUniqueWorkspacePath(business.id, pathValidation.normalized);
  await ensureWorkspaceAgent(business.id, data.agentId);

  const content = data.content;
  const syncTarget = data.syncTarget ?? getWorkspaceSyncMode();

  return db.$transaction(async (tx) => {
    const created = await tx.workspaceDocument.create({
      data: {
        businessId: business.id,
        agentId: normalizeOptionalString(data.agentId),
        filePath: pathValidation.normalized,
        content,
        category: data.category ?? "other",
        tier: data.tier ?? "warm",
        syncTarget,
        syncStatus: "pending",
        lastSyncAt: null
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: business.id,
        type: "agent",
        title: "Workspace file created",
        detail: `${created.filePath} was added to the shared workspace.`,
        status: created.syncStatus,
        metadata: {
          workspaceDocumentId: created.id,
          category: created.category,
          tier: created.tier,
          sizeChars: content.length,
          estimatedTokens: estimateWorkspaceTokens(content)
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId: business.organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "workspace_document_created",
        entityType: "workspace_document",
        entityId: created.id,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue(created)
      }
    });

    return created;
  });
}

export async function updateWorkspaceDocument(
  id: string,
  organizationId: string,
  data: AuditContext & {
    content?: string;
    category?: string;
    tier?: string;
    filePath?: string;
    agentId?: string | null;
  }
): Promise<WorkspaceDocument> {
  const existing = await getScopedWorkspaceDocument(id, organizationId);

  if (!existing) {
    throw notFound("Workspace file not found.");
  }

  const updateData: Prisma.WorkspaceDocumentUncheckedUpdateInput = {};

  if (data.filePath !== undefined) {
    const pathValidation = validateWorkspaceFilePath(data.filePath);
    if (!pathValidation.valid) {
      throw badRequest(pathValidation.error);
    }

    await ensureUniqueWorkspacePath(existing.businessId, pathValidation.normalized, id);
    updateData.filePath = pathValidation.normalized;
  }

  if (data.content !== undefined) {
    updateData.content = data.content;
    updateData.syncStatus = "pending";
    updateData.lastSyncAt = null;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.tier !== undefined) {
    updateData.tier = data.tier;
  }
  if (data.agentId !== undefined) {
    await ensureWorkspaceAgent(existing.businessId, data.agentId);
    updateData.agentId = normalizeOptionalString(data.agentId);
  }

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  return db.$transaction(async (tx) => {
    await createWorkspaceBackup(
      tx,
      existing,
      "Automatic backup before workspace file update",
      data
    );

    const updated = await tx.workspaceDocument.update({
      where: {
        id
      },
      data: updateData
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Workspace file updated",
        detail: `${updated.filePath} was updated.`,
        status: updated.syncStatus,
        metadata: {
          workspaceDocumentId: updated.id,
          category: updated.category,
          tier: updated.tier
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "workspace_document_updated",
        entityType: "workspace_document",
        entityId: updated.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(updated)
      }
    });

    return updated;
  });
}

export async function deleteWorkspaceDocument(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
): Promise<void> {
  const existing = await getScopedWorkspaceDocument(id, organizationId);

  if (!existing) {
    throw notFound("Workspace file not found.");
  }

  await db.$transaction(async (tx) => {
    await createWorkspaceBackup(
      tx,
      existing,
      "Automatic backup before workspace file deletion",
      auditContext
    );

    await tx.workspaceDocument.delete({
      where: {
        id
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Workspace file deleted",
        detail: `${existing.filePath} was removed from the workspace.`,
        status: existing.syncStatus,
        metadata: {
          workspaceDocumentId: existing.id,
          category: existing.category,
          tier: existing.tier
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "workspace_document_deleted",
        entityType: "workspace_document",
        entityId: existing.id,
        beforeJson: toJsonValue(existing),
        afterJson: Prisma.JsonNull
      }
    });
  });
}

export async function getWorkspaceStats(businessId: string): Promise<{
  totalDocuments: number;
  byTier: Record<string, number>;
  byCategory: Record<string, number>;
  totalSizeChars: number;
  pendingSync: number;
}> {
  const documents = await db.workspaceDocument.findMany({
    where: {
      businessId
    },
    select: {
      category: true,
      tier: true,
      syncStatus: true,
      content: true
    }
  });

  const byTier = Object.fromEntries(
    Object.keys(MEMORY_TIERS).map((tier) => [tier, 0])
  ) as Record<string, number>;
  const byCategory = Object.fromEntries(
    Object.keys(WORKSPACE_CATEGORIES).map((category) => [category, 0])
  ) as Record<string, number>;

  let totalSizeChars = 0;
  let pendingSync = 0;

  for (const document of documents) {
    if (!byTier[document.tier]) {
      byTier[document.tier] = 0;
    }
    if (!byCategory[document.category]) {
      byCategory[document.category] = 0;
    }

    byTier[document.tier] += 1;
    byCategory[document.category] += 1;
    totalSizeChars += document.content.length;

    if (document.syncStatus === "pending") {
      pendingSync += 1;
    }
  }

  return {
    totalDocuments: documents.length,
    byTier,
    byCategory,
    totalSizeChars,
    pendingSync
  };
}
