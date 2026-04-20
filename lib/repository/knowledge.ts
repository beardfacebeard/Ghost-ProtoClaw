import { Prisma, type KnowledgeItem } from "@prisma/client";

import {
  buildEmbeddingInput,
  cosineSimilarity,
  embedText
} from "@/lib/brain/embeddings";
import {
  estimateTokenCount,
  formatKnowledgeCategory,
  KNOWLEDGE_CATEGORIES
} from "@/lib/brain/knowledge";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

export type KnowledgeTier = "hot" | "warm" | "cold";

const ALLOWED_TIERS: KnowledgeTier[] = ["hot", "warm", "cold"];

export function normalizeTier(value: unknown): KnowledgeTier {
  return ALLOWED_TIERS.includes(value as KnowledgeTier)
    ? (value as KnowledgeTier)
    : "warm";
}

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
    tier?: string;
    assignedAgentIds?: string[];
  }
): Promise<KnowledgeItem> {
  const business = await getBusinessContext(data.businessId);
  const title = data.title.trim();
  const content = data.content.trim();
  const tier = normalizeTier(data.tier);
  const assignedAgentIds = Array.from(
    new Set((data.assignedAgentIds ?? []).filter((id) => id.trim().length > 0))
  );

  // Kick off embedding generation best-effort in parallel with the
  // insert. OpenAI fails silently here — items still save and can be
  // re-embedded later via /api/admin/knowledge/reindex.
  const embeddingPromise = embedText({
    text: buildEmbeddingInput({ title, content }),
    organizationId: business.organizationId
  });

  return db.$transaction(async (tx) => {
    const created = await tx.knowledgeItem.create({
      data: {
        businessId: business.id,
        category: data.category,
        title,
        content,
        sourceType: data.sourceType?.trim() || "knowledge_base",
        enabled: data.enabled ?? true,
        tokenCount: estimateTokenCount(content),
        tier,
        assignedAgentIds
      }
    });

    // Best-effort: attach the embedding if it finished in time. If not
    // (transaction-bound timing, OpenAI error, missing key), the row
    // ships without — knowledge_lookup falls back to keyword search
    // and the /reindex endpoint can retry later.
    try {
      const embedding = await embeddingPromise;
      if (embedding.success) {
        await tx.knowledgeItem.update({
          where: { id: created.id },
          data: {
            embedding: embedding.vector,
            embeddingModel: embedding.model,
            embeddingGeneratedAt: new Date()
          }
        });
      }
    } catch {
      /* non-fatal */
    }

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
      tier: string;
      assignedAgentIds: string[];
    }>
): Promise<KnowledgeItem> {
  const existing = await getScopedKnowledgeItem(id, organizationId);

  if (!existing) {
    throw notFound("Knowledge item not found.");
  }

  const updateData: Prisma.KnowledgeItemUncheckedUpdateInput = {};
  let contentChanged = false;

  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.title !== undefined) {
    updateData.title = data.title.trim();
    contentChanged = true;
  }
  if (data.content !== undefined) {
    const content = data.content.trim();
    updateData.content = content;
    updateData.tokenCount = estimateTokenCount(content);
    contentChanged = true;
  }
  if (data.sourceType !== undefined) {
    updateData.sourceType = data.sourceType.trim() || "knowledge_base";
  }
  if (data.enabled !== undefined) {
    updateData.enabled = data.enabled;
  }
  if (data.tier !== undefined) {
    updateData.tier = normalizeTier(data.tier);
  }
  if (data.assignedAgentIds !== undefined) {
    updateData.assignedAgentIds = Array.from(
      new Set(
        data.assignedAgentIds.filter((id) => id.trim().length > 0)
      )
    );
  }

  // Invalidate the embedding if the text body changed — we'll re-embed
  // outside the transaction below.
  if (contentChanged) {
    updateData.embedding = [];
    updateData.embeddingModel = null;
    updateData.embeddingGeneratedAt = null;
  }

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  const result = await db.$transaction(async (tx) => {
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

  // Re-embed after the transaction commits so we don't hold a DB
  // connection while waiting on OpenAI. Best-effort — the /reindex
  // endpoint can retry later if this fails.
  if (contentChanged) {
    try {
      const embedding = await embedText({
        text: buildEmbeddingInput({
          title: result.title,
          content: result.content
        }),
        organizationId: existing.business.organizationId
      });
      if (embedding.success) {
        await db.knowledgeItem.update({
          where: { id: result.id },
          data: {
            embedding: embedding.vector,
            embeddingModel: embedding.model,
            embeddingGeneratedAt: new Date()
          }
        });
      }
    } catch {
      /* non-fatal */
    }
  }

  return result;
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

/**
 * Build the auto-injected KB section of an agent's system prompt.
 *
 * Three-tier strategy:
 *   - hot  — included for EVERY agent (small, always-relevant items
 *            like brand voice and red-line rules)
 *   - warm — included when assignedAgentIds is empty (legacy "share
 *            with everyone" default) OR explicitly includes agentId
 *   - cold — never auto-included; agent pulls on demand via the
 *            knowledge_lookup tool
 *
 * Passing agentId="" (or undefined) falls back to the old "show all
 * enabled items" behavior so non-agent call sites (summary pages,
 * previews) keep working.
 */
export async function buildKnowledgeContext(
  businessId: string,
  agentId?: string | null
): Promise<string> {
  const items = await db.knowledgeItem.findMany({
    where: {
      businessId,
      enabled: true
    },
    orderBy: [{ tier: "asc" }, { category: "asc" }, { title: "asc" }],
    select: {
      category: true,
      title: true,
      content: true,
      tier: true,
      assignedAgentIds: true
    }
  });

  if (items.length === 0) {
    return "## Business Knowledge\n\nNo enabled business knowledge is currently available.";
  }

  const filtered = items.filter((item) => {
    const tier = normalizeTier(item.tier);
    if (tier === "cold") return false;
    if (tier === "hot") return true;
    // warm: included when no agent context (back-compat) OR when
    // assignedAgentIds is empty (all agents) OR when the agent is in
    // the assigned list.
    if (!agentId) return true;
    const assigned = item.assignedAgentIds ?? [];
    if (assigned.length === 0) return true;
    return assigned.includes(agentId);
  });

  if (filtered.length === 0) {
    return "## Business Knowledge\n\nNo knowledge is assigned to this agent. Use knowledge_lookup to search the cold tier on demand.";
  }

  const grouped = new Map<string, Array<{ title: string; content: string }>>();

  for (const item of filtered) {
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

  const coldCount = items.filter(
    (item) => normalizeTier(item.tier) === "cold"
  ).length;
  const coldFooter =
    coldCount > 0
      ? `\n\n---\n_${coldCount} additional reference item${coldCount === 1 ? "" : "s"} available on demand via knowledge_lookup._`
      : "";

  return `## Business Knowledge\n\n${sections.join("\n\n")}${coldFooter}`;
}

/**
 * Per-tier token budget for a business. Used to render the "Hot: 847 /
 * Warm: 2,103 / Cold: 8,167" summary at the top of /admin/knowledge so
 * users can see at a glance what's weighing down agent context.
 */
export async function getKnowledgeTokenBudget(businessId: string): Promise<{
  hot: { count: number; tokens: number };
  warm: { count: number; tokens: number };
  cold: { count: number; tokens: number };
  autoInjected: { count: number; tokens: number };
  total: { count: number; tokens: number };
}> {
  const items = await db.knowledgeItem.findMany({
    where: { businessId, enabled: true },
    select: { tier: true, tokenCount: true, assignedAgentIds: true }
  });

  const budget = {
    hot: { count: 0, tokens: 0 },
    warm: { count: 0, tokens: 0 },
    cold: { count: 0, tokens: 0 }
  };
  for (const item of items) {
    const tier = normalizeTier(item.tier);
    budget[tier].count += 1;
    budget[tier].tokens += item.tokenCount ?? 0;
  }
  // Auto-injected = hot + warm-with-no-specific-assignment. This is the
  // worst-case token load for any single agent; warm items pinned to a
  // specific agent only hit that agent, not the total.
  let autoCount = budget.hot.count;
  let autoTokens = budget.hot.tokens;
  for (const item of items) {
    const tier = normalizeTier(item.tier);
    if (tier !== "warm") continue;
    const assigned = item.assignedAgentIds ?? [];
    if (assigned.length === 0) {
      autoCount += 1;
      autoTokens += item.tokenCount ?? 0;
    }
  }
  return {
    ...budget,
    autoInjected: { count: autoCount, tokens: autoTokens },
    total: {
      count: items.length,
      tokens: budget.hot.tokens + budget.warm.tokens + budget.cold.tokens
    }
  };
}

/**
 * Semantic search over the business's KB. Scoped to warm + cold by
 * default (hot items are already in every agent's prompt so searching
 * them adds no value). Falls back to keyword matching when no items
 * have embeddings yet (fresh install or OpenAI not configured).
 */
export async function searchKnowledgeSemantic(params: {
  businessId: string;
  query: string;
  organizationId?: string;
  agentId?: string | null;
  limit?: number;
  includeHot?: boolean;
}): Promise<{
  mode: "semantic" | "keyword" | "empty";
  hits: Array<{
    id: string;
    title: string;
    category: string;
    tier: KnowledgeTier;
    score: number;
    excerpt: string;
  }>;
}> {
  const limit = Math.max(1, Math.min(params.limit ?? 5, 20));
  const includeHot = params.includeHot ?? false;

  const allowedTiers: KnowledgeTier[] = includeHot
    ? ["hot", "warm", "cold"]
    : ["warm", "cold"];

  const items = await db.knowledgeItem.findMany({
    where: {
      businessId: params.businessId,
      enabled: true,
      tier: { in: allowedTiers }
    },
    select: {
      id: true,
      title: true,
      content: true,
      category: true,
      tier: true,
      assignedAgentIds: true,
      embedding: true
    }
  });

  // Respect per-agent assignment for warm items.
  const scoped = items.filter((item) => {
    const tier = normalizeTier(item.tier);
    if (tier !== "warm") return true;
    if (!params.agentId) return true;
    const assigned = item.assignedAgentIds ?? [];
    if (assigned.length === 0) return true;
    return assigned.includes(params.agentId);
  });

  if (scoped.length === 0) {
    return { mode: "empty", hits: [] };
  }

  const withEmbeddings = scoped.filter(
    (item) => Array.isArray(item.embedding) && item.embedding.length > 0
  );

  // Try semantic first.
  if (withEmbeddings.length > 0) {
    const embeddingResult = await embedText({
      text: params.query,
      organizationId: params.organizationId
    });
    if (embeddingResult.success) {
      const queryVector = embeddingResult.vector;
      const scored = withEmbeddings
        .map((item) => ({
          item,
          score: cosineSimilarity(queryVector, item.embedding as number[])
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return {
        mode: "semantic",
        hits: scored.map(({ item, score }) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          tier: normalizeTier(item.tier),
          score: Math.round(score * 1000) / 1000,
          excerpt: item.content.slice(0, 600)
        }))
      };
    }
  }

  // Keyword fallback.
  const terms = params.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const scored = scoped
    .map((item) => {
      const hay = `${item.title}\n${item.content}`.toLowerCase();
      const matches = terms.filter((t) => hay.includes(t)).length;
      return { item, score: matches };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
    return { mode: "empty", hits: [] };
  }

  return {
    mode: "keyword",
    hits: scored.map(({ item, score }) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      tier: normalizeTier(item.tier),
      score,
      excerpt: item.content.slice(0, 600)
    }))
  };
}
