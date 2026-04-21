import { Prisma, type AgentMemory } from "@prisma/client";

import { MEMORY_TYPE_LABELS } from "@/lib/brain/memory";
import { MEMORY_TIERS } from "@/lib/brain/workspace";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

const agentMemoryInclude = {
  agent: {
    select: {
      id: true,
      displayName: true,
      emoji: true
    }
  }
} satisfies Prisma.AgentMemoryInclude;

export type AgentMemoryWithAgent = Prisma.AgentMemoryGetPayload<{
  include: typeof agentMemoryInclude;
}>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getMemoryScopeWhere(params: {
  organizationId: string;
  businessId?: string;
  agentId?: string;
  tier?: string;
  type?: string;
  search?: string;
  businessIds?: string[];
}) {
  const search = params.search?.trim();

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
    ...(params.agentId
      ? {
          agentId: params.agentId
        }
      : {}),
    ...(params.tier && params.tier !== "all"
      ? {
          tier: params.tier
        }
      : {}),
    ...(params.type && params.type !== "all"
      ? {
          type: params.type
        }
      : {}),
    ...(search
      ? {
          content: {
            contains: search,
            mode: "insensitive"
          }
        }
      : {})
  } satisfies Prisma.AgentMemoryWhereInput;
}

async function getScopedMemory(
  id: string,
  organizationId: string,
  businessIds?: string[]
) {
  return db.agentMemory.findFirst({
    where: {
      id,
      business: {
        organizationId,
        ...(businessIds !== undefined
          ? {
              id: {
                in: businessIds
              }
            }
          : {})
      }
    },
    include: {
      ...agentMemoryInclude,
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

function validateTier(tier: string) {
  if (!Object.prototype.hasOwnProperty.call(MEMORY_TIERS, tier)) {
    throw badRequest("Memory tier must be hot, warm, or cold.");
  }
}

export async function listAgentMemories(params: {
  businessId?: string;
  agentId?: string;
  organizationId: string;
  tier?: string;
  type?: string;
  search?: string;
  limit?: number;
  businessIds?: string[];
}): Promise<AgentMemoryWithAgent[]> {
  if (params.businessIds && params.businessIds.length === 0) {
    return [];
  }

  return db.agentMemory.findMany({
    where: getMemoryScopeWhere(params),
    include: agentMemoryInclude,
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(params.limit ?? 200, 500))
  });
}

export async function getAgentMemoryById(
  id: string,
  organizationId: string,
  businessIds?: string[]
) {
  return getScopedMemory(id, organizationId, businessIds);
}

export async function getMemoryStats(params: {
  organizationId: string;
  businessId?: string;
  businessIds?: string[];
}): Promise<{
  total: number;
  byTier: { hot: number; warm: number; cold: number };
  byType: Record<string, number>;
  byAgent: { agentId: string; name: string; count: number }[];
}> {
  const memories = await db.agentMemory.findMany({
    where: getMemoryScopeWhere({
      organizationId: params.organizationId,
      businessId: params.businessId,
      businessIds: params.businessIds
    }),
    include: agentMemoryInclude
  });

  const byTier = {
    hot: 0,
    warm: 0,
    cold: 0
  };
  const byType = Object.fromEntries(
    Object.keys(MEMORY_TYPE_LABELS).map((type) => [type, 0])
  ) as Record<string, number>;
  const agentCounts = new Map<string, { agentId: string; name: string; count: number }>();

  for (const memory of memories) {
    if (memory.tier === "hot" || memory.tier === "warm" || memory.tier === "cold") {
      byTier[memory.tier] += 1;
    }

    byType[memory.type] = (byType[memory.type] ?? 0) + 1;

    if (memory.agent) {
      const existing = agentCounts.get(memory.agent.id);
      if (existing) {
        existing.count += 1;
      } else {
        agentCounts.set(memory.agent.id, {
          agentId: memory.agent.id,
          name: memory.agent.displayName,
          count: 1
        });
      }
    }
  }

  return {
    total: memories.length,
    byTier,
    byType,
    byAgent: [...agentCounts.values()].sort(
      (left, right) => right.count - left.count || left.name.localeCompare(right.name)
    )
  };
}

export async function updateMemoryTier(
  id: string,
  organizationId: string,
  tier: string,
  auditContext: AuditContext = {}
): Promise<AgentMemory> {
  validateTier(tier);

  const existing = await getScopedMemory(id, organizationId);

  if (!existing) {
    throw notFound("Memory not found.");
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.agentMemory.update({
      where: {
        id
      },
      data: {
        tier
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Memory tier updated",
        detail: `${existing.agent?.displayName ?? "Agent"} memory was moved to ${tier}.`,
        status: tier,
        metadata: {
          memoryId: existing.id,
          agentId: existing.agentId,
          previousTier: existing.tier,
          nextTier: tier
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "agent_memory_tier_updated",
        entityType: "agent_memory",
        entityId: updated.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(updated)
      }
    });

    return updated;
  });
}

/**
 * Update an individual memory's editable fields. Content is the main
 * user-editable field (correcting or redacting things an agent
 * "remembers"). Other editable fields: type, importance, tier,
 * expiresAt. Writes an activity entry + audit event.
 */
export async function updateMemoryFields(
  id: string,
  organizationId: string,
  updates: {
    content?: string;
    importance?: number;
    type?: string;
    tier?: string;
    expiresAt?: Date | null;
  },
  auditContext: AuditContext = {}
): Promise<AgentMemory> {
  const existing = await getScopedMemory(id, organizationId);
  if (!existing) {
    throw notFound("Memory not found.");
  }

  if (updates.tier !== undefined) {
    validateTier(updates.tier);
  }
  if (updates.type !== undefined) {
    if (
      !Object.prototype.hasOwnProperty.call(MEMORY_TYPE_LABELS, updates.type)
    ) {
      throw badRequest(
        `Memory type must be one of: ${Object.keys(MEMORY_TYPE_LABELS).join(", ")}`
      );
    }
  }
  if (updates.importance !== undefined) {
    if (
      !Number.isInteger(updates.importance) ||
      updates.importance < 1 ||
      updates.importance > 10
    ) {
      throw badRequest("Importance must be an integer 1-10.");
    }
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.agentMemory.update({
      where: { id },
      data: {
        ...(updates.content !== undefined ? { content: updates.content } : {}),
        ...(updates.importance !== undefined
          ? { importance: updates.importance }
          : {}),
        ...(updates.type !== undefined ? { type: updates.type } : {}),
        ...(updates.tier !== undefined ? { tier: updates.tier } : {}),
        ...(updates.expiresAt !== undefined
          ? { expiresAt: updates.expiresAt }
          : {})
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Memory edited",
        detail: `${existing.agent?.displayName ?? "Agent"} memory updated by human review.`,
        metadata: {
          memoryId: existing.id,
          agentId: existing.agentId,
          fieldsChanged: Object.keys(updates)
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "agent_memory_edited",
        entityType: "agent_memory",
        entityId: updated.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(updated)
      }
    });

    return updated;
  });
}

export async function deleteMemory(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
): Promise<void> {
  const existing = await getScopedMemory(id, organizationId);

  if (!existing) {
    throw notFound("Memory not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.agentMemory.delete({
      where: {
        id
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Memory deleted",
        detail: `${existing.agent?.displayName ?? "Agent"} memory was deleted.`,
        status: existing.tier,
        metadata: {
          memoryId: existing.id,
          agentId: existing.agentId,
          type: existing.type
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "agent_memory_deleted",
        entityType: "agent_memory",
        entityId: existing.id,
        beforeJson: toJsonValue(existing),
        afterJson: Prisma.JsonNull
      }
    });
  });
}

export async function clearAgentMemories(
  params: AuditContext & {
    agentId?: string;
    businessId?: string;
    organizationId: string;
    tier?: string;
    businessIds?: string[];
  }
): Promise<{ count: number }> {
  if (!params.agentId && !params.businessId) {
    throw badRequest("Provide an agent or business when clearing memories.");
  }

  if (params.tier) {
    validateTier(params.tier);
  }

  const where = getMemoryScopeWhere({
    organizationId: params.organizationId,
    businessId: params.businessId,
    agentId: params.agentId,
    tier: params.tier,
    businessIds: params.businessIds
  });

  const targetMemories = await db.agentMemory.findMany({
    where,
    select: {
      id: true,
      businessId: true
    }
  });

  if (targetMemories.length === 0) {
    await db.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId ?? null,
        actorEmail: params.actorEmail ?? null,
        ipAddress: params.ipAddress ?? null,
        eventType: "agent_memory_bulk_deleted",
        entityType: "agent_memory",
        entityId: params.agentId ?? params.businessId ?? null,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue({
          count: 0,
          filters: {
            agentId: params.agentId ?? null,
            businessId: params.businessId ?? null,
            tier: params.tier ?? null
          }
        })
      }
    });

    return {
      count: 0
    };
  }

  const businessId = params.businessId ?? targetMemories[0]?.businessId ?? null;

  return db.$transaction(async (tx) => {
    const deleted = await tx.agentMemory.deleteMany({
      where
    });

    await tx.activityEntry.create({
      data: {
        businessId,
        type: "agent",
        title: "Memories cleared",
        detail:
          deleted.count === 1
            ? "1 memory was permanently deleted."
            : `${deleted.count} memories were permanently deleted.`,
        status: params.tier ?? "all",
        metadata: {
          agentId: params.agentId ?? null,
          businessId: params.businessId ?? null,
          tier: params.tier ?? null,
          count: deleted.count
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId ?? null,
        actorEmail: params.actorEmail ?? null,
        ipAddress: params.ipAddress ?? null,
        eventType: "agent_memory_bulk_deleted",
        entityType: "agent_memory",
        entityId: params.agentId ?? params.businessId ?? null,
        beforeJson: toJsonValue({
          ids: targetMemories.map((memory) => memory.id)
        }),
        afterJson: toJsonValue({
          count: deleted.count,
          filters: {
            agentId: params.agentId ?? null,
            businessId: params.businessId ?? null,
            tier: params.tier ?? null
          }
        })
      }
    });

    return {
      count: deleted.count
    };
  });
}
