import { Prisma, type Business } from "@prisma/client";

import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

export type CreateBusinessInput = AuditContext & {
  organizationId: string;
  name: string;
  status?: string;
  health?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  summary?: string | null;
  brandVoice?: string | null;
  primaryOwners?: string | null;
  secondaryOwners?: string | null;
  mainGoals?: string | null;
  coreOffers?: string | null;
  openTasks?: string | null;
  recentSessions?: string | null;
  systemPrompt?: string | null;
  guardrails?: string | null;
  offerAndAudienceNotes?: string | null;
  bannedClaims?: string | null;
  safetyMode?: string | null;
  primaryModel?: string | null;
  fallbackModel?: string | null;
  modelSource?: string | null;
  // Jurisdiction drives broker availability and leverage caps for regulated
  // templates (notably Forex Research & Execution Desk). Optional for any
  // other template.
  jurisdiction?: string | null;
  // Trading execution tier. Only the Forex template reads this; any other
  // template leaves it at the server-side default ("research"), which is a
  // no-op for non-trading businesses.
  tradingMode?: string | null;
  // Deal execution tier for Dealhawk-style real-estate templates. Only the
  // Dealhawk template reads this; non-real-estate businesses leave it at the
  // server-side default ("research"), which is a no-op.
  dealMode?: string | null;
  tcpaAttestedAt?: Date | null;
  tcpaAttestedBy?: string | null;
  currentIntegrations?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  knowledgeBase?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  config?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

export type UpdateBusinessInput = Partial<CreateBusinessInput>;

export type BusinessListItem = Business & {
  _count: {
    agents: number;
    workflows: number;
    knowledgeItems: number;
  };
};

function buildScopedWhere(
  organizationId: string,
  options?: {
    status?: string;
    search?: string;
    businessIds?: string[];
  }
): Prisma.BusinessWhereInput {
  const businessIds = options?.businessIds;
  const search = options?.search?.trim();

  return {
    organizationId,
    ...(businessIds
      ? {
          id: {
            in: businessIds
          }
        }
      : {}),
    ...(options?.status && options.status !== "all"
      ? {
          status: options.status
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive"
              }
            },
            {
              slug: {
                contains: search,
                mode: "insensitive"
              }
            },
            {
              summary: {
                contains: search,
                mode: "insensitive"
              }
            }
          ]
        }
      : {})
  };
}

function toNullableString(value?: string | null) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sanitizeCreateData(data: CreateBusinessInput, slug: string) {
  return {
    organizationId: data.organizationId,
    name: data.name.trim(),
    slug,
    status: data.status ?? "planning",
    health: data.health,
    summary: toNullableString(data.summary),
    brandVoice: toNullableString(data.brandVoice),
    primaryOwners: toNullableString(data.primaryOwners),
    secondaryOwners: toNullableString(data.secondaryOwners),
    mainGoals: toNullableString(data.mainGoals),
    coreOffers: toNullableString(data.coreOffers),
    openTasks: toNullableString(data.openTasks),
    recentSessions: toNullableString(data.recentSessions),
    systemPrompt: toNullableString(data.systemPrompt),
    guardrails: toNullableString(data.guardrails),
    offerAndAudienceNotes: toNullableString(data.offerAndAudienceNotes),
    bannedClaims: toNullableString(data.bannedClaims),
    safetyMode: toNullableString(data.safetyMode) ?? "ask_before_acting",
    primaryModel: toNullableString(data.primaryModel),
    fallbackModel: toNullableString(data.fallbackModel),
    modelSource: toNullableString(data.modelSource) ?? "system",
    jurisdiction: toNullableString(data.jurisdiction),
    // Trading mode is NEVER user-settable at create time. The Prisma default
    // of "research" is authoritative — upgrading requires explicit consent
    // flows enforced at the server after creation. We deliberately ignore
    // data.tradingMode here even if the caller passes something.
    currentIntegrations: data.currentIntegrations,
    knowledgeBase: data.knowledgeBase,
    config: data.config
  } satisfies Prisma.BusinessUncheckedCreateInput;
}

function sanitizeUpdateData(data: UpdateBusinessInput, slug?: string) {
  const updateData: Prisma.BusinessUncheckedUpdateInput = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }
  if (slug) {
    updateData.slug = slug;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.health !== undefined) {
    updateData.health = data.health;
  }
  if (data.summary !== undefined) {
    updateData.summary = toNullableString(data.summary);
  }
  if (data.brandVoice !== undefined) {
    updateData.brandVoice = toNullableString(data.brandVoice);
  }
  if (data.primaryOwners !== undefined) {
    updateData.primaryOwners = toNullableString(data.primaryOwners);
  }
  if (data.secondaryOwners !== undefined) {
    updateData.secondaryOwners = toNullableString(data.secondaryOwners);
  }
  if (data.mainGoals !== undefined) {
    updateData.mainGoals = toNullableString(data.mainGoals);
  }
  if (data.coreOffers !== undefined) {
    updateData.coreOffers = toNullableString(data.coreOffers);
  }
  if (data.openTasks !== undefined) {
    updateData.openTasks = toNullableString(data.openTasks);
  }
  if (data.recentSessions !== undefined) {
    updateData.recentSessions = toNullableString(data.recentSessions);
  }
  if (data.systemPrompt !== undefined) {
    updateData.systemPrompt = toNullableString(data.systemPrompt);
  }
  if (data.guardrails !== undefined) {
    updateData.guardrails = toNullableString(data.guardrails);
  }
  if (data.offerAndAudienceNotes !== undefined) {
    updateData.offerAndAudienceNotes = toNullableString(
      data.offerAndAudienceNotes
    );
  }
  if (data.bannedClaims !== undefined) {
    updateData.bannedClaims = toNullableString(data.bannedClaims);
  }
  if (data.safetyMode !== undefined) {
    updateData.safetyMode = toNullableString(data.safetyMode) ?? undefined;
  }
  if (data.primaryModel !== undefined) {
    updateData.primaryModel = toNullableString(data.primaryModel);
  }
  if (data.fallbackModel !== undefined) {
    updateData.fallbackModel = toNullableString(data.fallbackModel);
  }
  if (data.modelSource !== undefined) {
    updateData.modelSource = toNullableString(data.modelSource) ?? undefined;
  }
  if (data.jurisdiction !== undefined) {
    updateData.jurisdiction = toNullableString(data.jurisdiction);
  }
  if (data.tradingMode !== undefined) {
    // tradingMode updates DO flow through here, but callers are expected to
    // have already gated the tier change (see updateBusinessTradingMode in
    // lib/trading/mode-gate.ts). This path is the persistence layer; it does
    // not re-verify the consent flow.
    const candidate = toNullableString(data.tradingMode);
    if (
      candidate === "research" ||
      candidate === "paper" ||
      candidate === "live_approval"
    ) {
      updateData.tradingMode = candidate;
    }
  }
  if (data.dealMode !== undefined) {
    // dealMode updates flow through here, but callers are expected to have
    // already gated the tier change (see deal-mode route handler which
    // enforces TCPA attestation + attorney-on-file checks before invoking
    // updateBusiness). This path is the persistence layer only.
    const candidate = toNullableString(data.dealMode);
    if (
      candidate === "research" ||
      candidate === "outreach" ||
      candidate === "contract"
    ) {
      updateData.dealMode = candidate;
    }
  }
  if (data.tcpaAttestedAt !== undefined) {
    updateData.tcpaAttestedAt = data.tcpaAttestedAt;
  }
  if (data.tcpaAttestedBy !== undefined) {
    updateData.tcpaAttestedBy = toNullableString(data.tcpaAttestedBy);
  }
  if (data.currentIntegrations !== undefined) {
    updateData.currentIntegrations = data.currentIntegrations;
  }
  if (data.knowledgeBase !== undefined) {
    updateData.knowledgeBase = data.knowledgeBase;
  }
  if (data.config !== undefined) {
    updateData.config = data.config;
  }

  return updateData;
}

async function ensureUniqueSlug(
  organizationId: string,
  baseName: string,
  excludeId?: string
) {
  const baseSlug = slugify(baseName) || "business";
  let candidate = baseSlug;
  let suffix = 2;

  for (;;) {
    const existing = await db.business.findFirst({
      where: {
        organizationId,
        slug: candidate,
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

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listBusinesses(
  organizationId: string,
  options?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
    businessIds?: string[];
  }
): Promise<{ businesses: BusinessListItem[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
  const where = buildScopedWhere(organizationId, options);

  const [businesses, total] = await Promise.all([
    db.business.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: {
            agents: true,
            workflows: true,
            knowledgeItems: true
          }
        }
      }
    }),
    db.business.count({
      where
    })
  ]);

  return {
    businesses,
    total
  };
}

export async function getBusinessById(id: string, organizationId: string) {
  return db.business.findFirst({
    where: {
      id,
      organizationId
    }
  });
}

export async function getBusinessStatusCounts(
  organizationId: string,
  businessIds?: string[]
) {
  const baseWhere =
    businessIds
      ? {
          organizationId,
          id: {
            in: businessIds
          }
        }
      : {
          organizationId
        };

  const [total, active, paused, planning, archived] = await Promise.all([
    db.business.count({
      where: baseWhere
    }),
    db.business.count({
      where: {
        ...baseWhere,
        status: "active"
      }
    }),
    db.business.count({
      where: {
        ...baseWhere,
        status: "paused"
      }
    }),
    db.business.count({
      where: {
        ...baseWhere,
        status: "planning"
      }
    }),
    db.business.count({
      where: {
        ...baseWhere,
        status: "archived"
      }
    })
  ]);

  return {
    total,
    active,
    paused,
    planning,
    archived
  };
}

export async function createBusiness(data: CreateBusinessInput): Promise<Business> {
  const slug = await ensureUniqueSlug(data.organizationId, data.name);

  return db.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: sanitizeCreateData(data, slug)
    });

    await tx.activityEntry.create({
      data: {
        businessId: created.id,
        type: "agent",
        title: "Business created",
        detail: `${created.name} is ready for setup.`,
        status: created.status,
        metadata: {
          businessId: created.id,
          slug: created.slug
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId: created.organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "business_created",
        entityType: "business",
        entityId: created.id,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue(created)
      }
    });

    return created;
  });
}

export async function updateBusiness(
  id: string,
  organizationId: string,
  data: Partial<CreateBusinessInput>
): Promise<Business> {
  const existing = await db.business.findFirst({
    where: {
      id,
      organizationId
    }
  });

  if (!existing) {
    throw notFound("Business not found.");
  }

  const nextSlug =
    data.name && data.name.trim() !== existing.name
      ? await ensureUniqueSlug(organizationId, data.name, id)
      : undefined;

  const updateData = sanitizeUpdateData(data, nextSlug);

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  return db.$transaction(async (tx) => {
    await tx.backup.create({
      data: {
        organizationId,
        businessId: existing.id,
        sourceType: "workspace_snapshot",
        scopeType: "business",
        scopeId: existing.id,
        status: "completed",
        payload: toJsonValue(existing),
        triggeredBy: data.actorEmail ?? data.actorUserId ?? "system",
        reason: "Automatic snapshot before business update"
      }
    });

    const updated = await tx.business.update({
      where: {
        id
      },
      data: updateData
    });

    await tx.activityEntry.create({
      data: {
        businessId: updated.id,
        type: "agent",
        title: "Business updated",
        detail: `${updated.name} settings were updated.`,
        status: updated.status,
        metadata: {
          businessId: updated.id
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "business_updated",
        entityType: "business",
        entityId: updated.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(updated)
      }
    });

    return updated;
  });
}

export async function activateBusiness(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
): Promise<Business> {
  const existing = await db.business.findFirst({
    where: {
      id,
      organizationId
    }
  });

  if (!existing) {
    throw notFound("Business not found.");
  }

  if (existing.status === "active") {
    return existing;
  }

  if (existing.status === "archived") {
    throw notFound("Cannot activate an archived business. Restore it first.");
  }

  return db.$transaction(async (tx) => {
    const activated = await tx.business.update({
      where: { id },
      data: { status: "active" }
    });

    // Activate all agents that are not explicitly disabled by the user
    await tx.agent.updateMany({
      where: {
        businessId: id,
        status: { not: "disabled" }
      },
      data: { status: "active" }
    });

    // Enable all workflows
    await tx.workflow.updateMany({
      where: { businessId: id },
      data: { enabled: true }
    });

    await tx.activityEntry.create({
      data: {
        businessId: id,
        type: "agent",
        title: "Business activated",
        detail: `${existing.name} is now active. Agents and workflows have been enabled.`,
        status: activated.status,
        metadata: { businessId: id }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "business_activated",
        entityType: "business",
        entityId: id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(activated)
      }
    });

    return activated;
  });
}

export async function archiveBusiness(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
): Promise<void> {
  const existing = await db.business.findFirst({
    where: {
      id,
      organizationId
    }
  });

  if (!existing) {
    throw notFound("Business not found.");
  }

  await db.$transaction(async (tx) => {
    const archived = await tx.business.update({
      where: {
        id
      },
      data: {
        status: "archived"
      }
    });

    await tx.agent.updateMany({
      where: {
        businessId: id
      },
      data: {
        status: "disabled"
      }
    });

    await tx.workflow.updateMany({
      where: {
        businessId: id
      },
      data: {
        enabled: false
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: id,
        type: "agent",
        title: "Business archived",
        detail: `${existing.name} was archived and its automations were disabled.`,
        status: archived.status,
        metadata: {
          businessId: id
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "business_archived",
        entityType: "business",
        entityId: id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(archived)
      }
    });
  });
}

export async function deleteBusiness(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
): Promise<void> {
  const existing = await db.business.findFirst({
    where: {
      id,
      organizationId
    }
  });

  if (!existing) {
    throw notFound("Business not found.");
  }

  await db.$transaction(async (tx) => {
    // Create a final audit event before deletion
    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "business_deleted",
        entityType: "business",
        entityId: id,
        beforeJson: toJsonValue(existing),
        afterJson: Prisma.JsonNull
      }
    });

    // Delete join tables and dependent records (order matters for FK constraints)
    // Delete agent-skill links for agents in this business
    await tx.agentSkill.deleteMany({
      where: { agent: { businessId: id } }
    });

    // Delete webhook events before webhook endpoints
    await tx.webhookEvent.deleteMany({
      where: { businessId: id }
    });

    await tx.webhookEndpoint.deleteMany({
      where: { businessId: id }
    });

    await tx.approvalRequest.deleteMany({
      where: { businessId: id }
    });

    await tx.agentMemory.deleteMany({
      where: { businessId: id }
    });

    await tx.conversationLog.deleteMany({
      where: { businessId: id }
    });

    await tx.activityEntry.deleteMany({
      where: { businessId: id }
    });

    await tx.knowledgeItem.deleteMany({
      where: { businessId: id }
    });

    await tx.workspaceDocument.deleteMany({
      where: { businessId: id }
    });

    await tx.outcomeSnapshot.deleteMany({
      where: { businessId: id }
    });

    await tx.actionRun.deleteMany({
      where: { businessId: id }
    });

    await tx.issue.deleteMany({
      where: { businessId: id }
    });

    await tx.goal.deleteMany({
      where: { businessId: id }
    });

    await tx.project.deleteMany({
      where: { businessId: id }
    });

    // Nullify optional business references
    await tx.logEvent.updateMany({
      where: { businessId: id },
      data: { businessId: null }
    });

    await tx.backup.updateMany({
      where: { businessId: id },
      data: { businessId: null }
    });

    // Delete workflows and agents
    await tx.workflow.deleteMany({
      where: { businessId: id }
    });

    // Nullify parent agent references before deleting agents
    await tx.agent.updateMany({
      where: { businessId: id, parentAgentId: { not: null } },
      data: { parentAgentId: null }
    });

    await tx.agent.deleteMany({
      where: { businessId: id }
    });

    // Remove business ID from admin users who had access
    const adminsWithAccess = await tx.missionControlAdminUser.findMany({
      where: {
        organizationId,
        businessIds: { has: id }
      },
      select: { id: true, businessIds: true }
    });

    for (const admin of adminsWithAccess) {
      await tx.missionControlAdminUser.update({
        where: { id: admin.id },
        data: {
          businessIds: admin.businessIds.filter((bid) => bid !== id)
        }
      });
    }

    // Finally delete the business itself
    await tx.business.delete({
      where: { id }
    });
  });
}

export async function getBusinessStats(id: string) {
  const [agentCount, workflowCount, activeWorkflows, knowledgeItems, workspaceDocuments, pendingApprovals, lastActivity] =
    await Promise.all([
      db.agent.count({
        where: {
          businessId: id
        }
      }),
      db.workflow.count({
        where: {
          businessId: id
        }
      }),
      db.workflow.count({
        where: {
          businessId: id,
          enabled: true
        }
      }),
      db.knowledgeItem.count({
        where: {
          businessId: id
        }
      }),
      db.workspaceDocument.count({
        where: {
          businessId: id
        }
      }),
      db.approvalRequest.count({
        where: {
          businessId: id,
          status: "pending"
        }
      }),
      db.activityEntry.findFirst({
        where: {
          businessId: id
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          createdAt: true
        }
      })
    ]);

  return {
    agentCount,
    workflowCount,
    activeWorkflows,
    knowledgeItems,
    workspaceDocuments,
    pendingApprovals,
    lastActivity: lastActivity?.createdAt ?? null
  };
}
