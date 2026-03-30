import { Prisma, type KnowledgeItem } from "@prisma/client";

import {
  estimateTokenCount,
  formatKnowledgeCategory,
  KNOWLEDGE_CATEGORIES
} from "@/lib/brain/knowledge";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

type ScopedKnowledgeItem = KnowledgeItem & {
  business: {
    id: string;
    name: string;
    organizationId: string;
  };
};

export { KNOWLEDGE_CATEGORIES } from "@/lib/brain/knowledge";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function getBusinessContext(businessId: string) {
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

async function getScopedKnowledgeItem(
  id: string,
  organizationId: string
): Promise<ScopedKnowledgeItem | null> {
  return db.knowledgeItem.findFirst({
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

export async function listKnowledgeItems(params: {
  businessId: string;
  organizationId: string;
  category?: string;
  search?: string;
  enabled?: boolean;
}): Promise<KnowledgeItem[]> {
  const search = params.search?.trim();

  return db.knowledgeItem.findMany({
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
      ...(typeof params.enabled === "boolean"
        ? {
            enabled: params.enabled
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
                content: {
                  contains: search,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    },
    orderBy: [{ category: "asc" }, { title: "asc" }]
  });
}

export async function getKnowledgeItemById(
  id: string,
  organizationId: string
): Promise<KnowledgeItem | null> {
  return getScopedKnowledgeItem(id, organizationId);
}

export async function createKnowledgeItem(
  data: AuditContext & {
    businessId: string;
    category: string;
    title: string;
    content: string;
    sourceType?: string;
    enabled?: boolean;
  }
): Promise<KnowledgeItem> {
  const business = await getBusinessContext(data.businessId);
  const title = data.title.trim();
  const content = data.content.trim();

  return db.$transaction(async (tx) => {
    const created = await tx.knowledgeItem.create({
      data: {
        businessId: business.id,
        category: data.category,
        title,
        content,
        sourceType: data.sourceType?.trim() || "knowledge_base",
        enabled: data.enabled ?? true,
        tokenCount: estimateTokenCount(content)
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: business.id,
        type: "agent",
        title: "Knowledge added",
        detail: `${title} was added under ${formatKnowledgeCategory(data.category)}.`,
        status: created.enabled ? "enabled" : "disabled",
        metadata: {
          knowledgeItemId: created.id,
          category: created.category
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId: business.organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "knowledge_item_created",
        entityType: "knowledge_item",
        entityId: created.id,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue(created)
      }
    });

    return created;
  });
}

export async function updateKnowledgeItem(
  id: string,
  organizationId: string,
  data: AuditContext &
    Partial<{
      category: string;
      title: string;
      content: string;
      sourceType: string;
      enabled: boolean;
    }>
): Promise<KnowledgeItem> {
  const existing = await getScopedKnowledgeItem(id, organizationId);

  if (!existing) {
    throw notFound("Knowledge item not found.");
  }

  const updateData: Prisma.KnowledgeItemUncheckedUpdateInput = {};

  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.title !== undefined) {
    updateData.title = data.title.trim();
  }
  if (data.content !== undefined) {
    const content = data.content.trim();
    updateData.content = content;
    updateData.tokenCount = estimateTokenCount(content);
  }
  if (data.sourceType !== undefined) {
    updateData.sourceType = data.sourceType.trim() || "knowledge_base";
  }
  if (data.enabled !== undefined) {
    updateData.enabled = data.enabled;
  }

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.knowledgeItem.update({
      where: {
        id
      },
      data: updateData
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Knowledge updated",
        detail: `${updated.title} was updated.`,
        status: updated.enabled ? "enabled" : "disabled",
        metadata: {
          knowledgeItemId: updated.id,
          category: updated.category
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "knowledge_item_updated",
        entityType: "knowledge_item",
        entityId: updated.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(updated)
      }
    });

    return updated;
  });
}

export async function deleteKnowledgeItem(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
): Promise<void> {
  const existing = await getScopedKnowledgeItem(id, organizationId);

  if (!existing) {
    throw notFound("Knowledge item not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.knowledgeItem.delete({
      where: {
        id
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Knowledge deleted",
        detail: `${existing.title} was removed from the knowledge base.`,
        status: existing.enabled ? "enabled" : "disabled",
        metadata: {
          knowledgeItemId: existing.id,
          category: existing.category
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "knowledge_item_deleted",
        entityType: "knowledge_item",
        entityId: existing.id,
        beforeJson: toJsonValue(existing),
        afterJson: Prisma.JsonNull
      }
    });
  });
}

export async function toggleKnowledgeItem(
  id: string,
  organizationId: string,
  enabled: boolean,
  auditContext: AuditContext = {}
): Promise<KnowledgeItem> {
  const existing = await getScopedKnowledgeItem(id, organizationId);

  if (!existing) {
    throw notFound("Knowledge item not found.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.knowledgeItem.update({
      where: {
        id
      },
      data: {
        enabled
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: enabled ? "Knowledge enabled" : "Knowledge disabled",
        detail: `${updated.title} was ${enabled ? "included in" : "removed from"} agent context.`,
        status: updated.enabled ? "enabled" : "disabled",
        metadata: {
          knowledgeItemId: updated.id,
          category: updated.category
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: enabled ? "knowledge_item_enabled" : "knowledge_item_disabled",
        entityType: "knowledge_item",
        entityId: updated.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(updated)
      }
    });

    return updated;
  });
}

export async function getKnowledgeSummary(businessId: string): Promise<{
  totalItems: number;
  enabledItems: number;
  totalTokens: number;
  byCategory: Record<string, { count: number; tokens: number }>;
}> {
  const items = await db.knowledgeItem.findMany({
    where: {
      businessId
    },
    select: {
      category: true,
      enabled: true,
      tokenCount: true
    }
  });

  const byCategory = Object.fromEntries(
    Object.keys(KNOWLEDGE_CATEGORIES).map((category) => [
      category,
      {
        count: 0,
        tokens: 0
      }
    ])
  ) as Record<string, { count: number; tokens: number }>;

  let enabledItems = 0;
  let totalTokens = 0;

  for (const item of items) {
    const tokenCount = item.tokenCount ?? 0;
    if (!byCategory[item.category]) {
      byCategory[item.category] = { count: 0, tokens: 0 };
    }

    byCategory[item.category].count += 1;
    byCategory[item.category].tokens += tokenCount;
    totalTokens += tokenCount;

    if (item.enabled) {
      enabledItems += 1;
    }
  }

  return {
    totalItems: items.length,
    enabledItems,
    totalTokens,
    byCategory
  };
}

export async function buildKnowledgeContext(businessId: string): Promise<string> {
  const items = await db.knowledgeItem.findMany({
    where: {
      businessId,
      enabled: true
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: {
      category: true,
      title: true,
      content: true
    }
  });

  if (items.length === 0) {
    return "## Business Knowledge\n\nNo enabled business knowledge is currently available.";
  }

  const grouped = new Map<string, Array<{ title: string; content: string }>>();

  for (const item of items) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push({
      title: item.title,
      content: item.content
    });
    grouped.set(item.category, bucket);
  }

  const sections = Object.keys(KNOWLEDGE_CATEGORIES)
    .filter((category) => grouped.has(category))
    .map((category) => {
      const entries = grouped.get(category) ?? [];
      const body = entries
        .map((entry) => `#### ${entry.title}\n${entry.content.trim()}`)
        .join("\n\n");

      return `### ${formatKnowledgeCategory(category)}\n${body}`;
    });

  return `## Business Knowledge\n\n${sections.join("\n\n")}`;
}
