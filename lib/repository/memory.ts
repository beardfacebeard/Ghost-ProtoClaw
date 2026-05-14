import { Prisma, type AgentMemory } from "@prisma/client";

import { cosineSimilarity, embedText } from "@/lib/brain/embeddings";
import { MEMORY_TYPE_LABELS } from "@/lib/brain/memory";
import { MEMORY_TIERS } from "@/lib/brain/workspace";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";
import { getLogger } from "@/lib/observability/logger";

const log = getLogger("memory");

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

// ── Embedding + semantic recall ──────────────────────────────────────

/**
 * Background embed: fetch the just-created AgentMemory by id, generate the
 * embedding, and write it back. Best-effort. Failure leaves the memory
 * with an empty embedding[] and the keyword fallback continues to work.
 */
async function embedAgentMemoryAsync(params: {
  memoryId: string;
  organizationId: string | undefined;
  content: string;
}) {
  try {
    const result = await embedText({
      text: params.content,
      organizationId: params.organizationId
    });
    if (!result.success) {
      log.debug("memory embedding skipped", {
        memoryId: params.memoryId,
        reason: result.error
      });
      return;
    }
    await db.agentMemory.update({
      where: { id: params.memoryId },
      data: {
        embedding: result.vector,
        embeddingModel: result.model,
        embeddingGeneratedAt: new Date()
      }
    });
  } catch (err) {
    log.warn("memory embedding write failed", {
      memoryId: params.memoryId,
      err
    });
  }
}

/**
 * Create an AgentMemory row and kick off an embedding write in the
 * background. Returns immediately with the row — the embedding may not
 * be populated by the time the caller continues. This matches the
 * KnowledgeItem.create pattern.
 *
 * Centralizes the create + embed flow so the tool-executor handlers and
 * delegation-executor don't each have to reinvent it.
 */
export async function createAgentMemoryWithEmbedding(params: {
  agentId: string;
  businessId: string;
  type: string;
  content: string;
  importance?: number;
  tier?: string;
  expiresAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
  /** Used to look up the OpenAI key. When null/undefined we skip
   *  embedding entirely — the row still gets created. */
  organizationId?: string;
}): Promise<AgentMemory> {
  const memory = await db.agentMemory.create({
    data: {
      agentId: params.agentId,
      businessId: params.businessId,
      type: params.type,
      content: params.content,
      importance: params.importance ?? 5,
      tier: params.tier ?? "warm",
      expiresAt: params.expiresAt ?? null,
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {})
    }
  });

  if (params.organizationId && params.content.trim().length > 0) {
    // Fire-and-forget; the row is already returned. The embedText call
    // takes ~200-500ms which we don't want to block the agent turn on.
    void embedAgentMemoryAsync({
      memoryId: memory.id,
      organizationId: params.organizationId,
      content: params.content
    });
  }

  return memory;
}

/** Hit ranked by cosine similarity against an in-memory candidate set. */
export type SemanticMemoryHit = {
  id: string;
  type: string;
  content: string;
  importance: number;
  tier: string;
  score: number;
  createdAt: Date;
};

/**
 * Semantic memory recall. Embeds the query, scans the agent's memories
 * with valid embeddings, and returns the top-K by cosine similarity.
 *
 * When the query can't be embedded (OpenAI unconfigured, error) or no
 * memories have embeddings yet, returns null — callers should fall back
 * to keyword search. The graceful-degrade path is intentional so this
 * function can be enabled without breaking installations that haven't
 * set OPENAI_API_KEY.
 */
export async function searchAgentMemorySemantic(params: {
  agentId: string;
  businessId: string;
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<SemanticMemoryHit[] | null> {
  const queryResult = await embedText({
    text: params.query,
    organizationId: params.organizationId
  });
  if (!queryResult.success) return null;

  // Pull a reasonable window of candidates — capped to keep cosine
  // similarity computation O(candidates * 1536) bounded. For agents with
  // > 500 memories we trade slightly weaker recall for predictable cost.
  const candidates = await db.agentMemory.findMany({
    where: {
      agentId: params.agentId,
      businessId: params.businessId
    },
    select: {
      id: true,
      type: true,
      content: true,
      importance: true,
      tier: true,
      embedding: true,
      createdAt: true
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 500
  });

  const scored: SemanticMemoryHit[] = [];
  for (const c of candidates) {
    if (!c.embedding || c.embedding.length === 0) continue;
    const score = cosineSimilarity(queryResult.vector, c.embedding);
    if (score <= 0) continue;
    scored.push({
      id: c.id,
      type: c.type,
      content: c.content,
      importance: c.importance,
      tier: c.tier,
      score,
      createdAt: c.createdAt
    });
  }

  if (scored.length === 0) {
    // No embedded memories yet — caller should fall back to keyword.
    return null;
  }

  scored.sort((a, b) => b.score - a.score);
  const limit = Math.max(1, Math.min(params.limit ?? 5, 20));
  return scored.slice(0, limit);
}

/**
 * Delete AgentMemory rows whose expiresAt has passed. Called from the
 * scheduler tick. Returns the count deleted for logging.
 */
export async function sweepExpiredMemories(): Promise<number> {
  const now = new Date();
  const result = await db.agentMemory.deleteMany({
    where: {
      expiresAt: {
        not: null,
        lt: now
      }
    }
  });
  return result.count;
}

