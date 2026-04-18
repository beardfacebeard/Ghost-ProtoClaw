import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────

export type CreateConversationInput = {
  agentId: string;
  businessId: string;
  organizationId: string;
  adminUserId?: string;
  title?: string;
  channel?: string;
};

export type ListConversationsParams = {
  organizationId: string;
  adminUserId?: string;
  agentId?: string;
  businessId?: string;
  status?: string;
  limit?: number;
  offset?: number;
  /** RBAC: limit to these businessIds for non-super-admins */
  businessIds?: string[];
};

// ── Conversations ──────────────────────────────────────────────────

export async function listConversations(params: ListConversationsParams) {
  const where: Record<string, unknown> = {};

  // RBAC scoping: either specific business or set of accessible businesses
  if (params.businessId) {
    where.businessId = params.businessId;
  } else if (params.businessIds) {
    where.businessId = { in: params.businessIds };
  }

  if (params.agentId) where.agentId = params.agentId;
  if (params.adminUserId) where.adminUserId = params.adminUserId;
  if (params.status) where.status = params.status;

  // Ensure we only get conversations belonging to businesses in this org
  where.business = { organizationId: params.organizationId };

  return db.conversationLog.findMany({
    where,
    include: {
      agent: {
        select: {
          id: true,
          displayName: true,
          emoji: true,
          role: true,
          type: true,
          status: true
        }
      },
      business: {
        select: {
          id: true,
          name: true
        }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          content: true,
          role: true,
          createdAt: true
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: params.limit ?? 50,
    skip: params.offset ?? 0
  });
}

export async function getConversationById(
  id: string,
  organizationId: string,
  businessIds?: string[]
) {
  const conversation = await db.conversationLog.findFirst({
    where: {
      id,
      business: {
        organizationId,
        ...(businessIds ? { id: { in: businessIds } } : {})
      }
    },
    include: {
      agent: {
        select: {
          id: true,
          displayName: true,
          emoji: true,
          role: true,
          type: true,
          status: true,
          businessId: true,
          primaryModel: true,
          fallbackModel: true,
          maxTokensPerCall: true
        }
      },
      business: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          primaryModel: true,
          fallbackModel: true,
          modelSource: true,
          brandVoice: true,
          mainGoals: true,
          summary: true,
          coreOffers: true,
          guardrails: true,
          bannedClaims: true,
          safetyMode: true,
          systemPrompt: true
        }
      }
    }
  });

  return conversation;
}

export async function createConversation(input: CreateConversationInput) {
  return db.conversationLog.create({
    data: {
      agentId: input.agentId,
      businessId: input.businessId,
      adminUserId: input.adminUserId,
      title: input.title || null,
      channel: input.channel ?? "dashboard",
      status: "active"
    },
    include: {
      agent: {
        select: {
          id: true,
          displayName: true,
          emoji: true,
          role: true,
          type: true,
          status: true
        }
      },
      business: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

export async function updateConversation(
  id: string,
  organizationId: string,
  data: { title?: string; status?: string }
) {
  // Verify ownership
  const existing = await db.conversationLog.findFirst({
    where: {
      id,
      business: { organizationId }
    }
  });

  if (!existing) return null;

  return db.conversationLog.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.status === "completed" ? { endedAt: new Date() } : {})
    }
  });
}

export async function archiveConversation(id: string, organizationId: string) {
  return updateConversation(id, organizationId, { status: "completed" });
}

/**
 * Permanently delete a conversation and its messages.
 *
 * Messages cascade via the ConversationLog → Message FK. TelegramChat has a
 * nullable conversationId with no cascade, so we null those references out
 * first to avoid a FK violation. Returns the deleted record or null if not
 * owned by the given organization.
 */
export async function deleteConversation(id: string, organizationId: string) {
  const existing = await db.conversationLog.findFirst({
    where: {
      id,
      business: { organizationId }
    },
    select: { id: true }
  });

  if (!existing) return null;

  return db.$transaction(async (tx) => {
    await tx.telegramChat.updateMany({
      where: { conversationId: id },
      data: { conversationId: null }
    });
    return tx.conversationLog.delete({ where: { id } });
  });
}

// ── Messages ───────────────────────────────────────────────────────

export async function listMessages(
  conversationId: string,
  params: { limit?: number; before?: string } = {}
) {
  const where: Record<string, unknown> = { conversationId };

  if (params.before) {
    where.createdAt = { lt: new Date(params.before) };
  }

  const messages = await db.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 50
  });

  // Return in chronological order
  return messages.reverse();
}

export async function createMessage(data: {
  conversationId: string;
  role: string;
  content: string;
  tokenCount?: number;
  model?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const [message] = await db.$transaction([
    db.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        tokenCount: data.tokenCount ?? null,
        model: data.model ?? null,
        latencyMs: data.latencyMs ?? null,
        metadata: data.metadata ? (data.metadata as any) : undefined
      }
    }),
    db.conversationLog.update({
      where: { id: data.conversationId },
      data: {
        messageCount: { increment: 1 },
        updatedAt: new Date()
      }
    })
  ]);

  return message;
}

/**
 * Load conversation history formatted for LLM context.
 * Returns messages as { role, content }[] in chronological order.
 */
export async function getConversationHistory(
  conversationId: string,
  maxMessages = 50
) {
  const messages = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: maxMessages,
    select: {
      role: true,
      content: true
    }
  });

  return messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content
  }));
}
