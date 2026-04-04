import { Prisma, type Agent, type Business } from "@prisma/client";

import { db } from "@/lib/db";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { resolveAgentModel } from "@/lib/models/agent-models";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

export type CreateAgentInput = AuditContext & {
  organizationId: string;
  businessId?: string | null;
  parentAgentId?: string | null;
  displayName: string;
  emoji?: string | null;
  role: string;
  purpose?: string | null;
  type: "main" | "specialist" | "global";
  status?: string | null;
  systemPrompt?: string | null;
  roleInstructions?: string | null;
  outputStyle?: string | null;
  constraints?: string | null;
  escalationRules?: string | null;
  askBeforeDoing?: string | null;
  primaryModel?: string | null;
  fallbackModel?: string | null;
  modelSource?: string | null;
  safetyMode?: string | null;
  runtime?: string | null;
  tools?: string[] | null;
  workspacePath?: string | null;
  depth?: number;
};

export type UpdateAgentInput = Partial<CreateAgentInput>;

const agentListInclude = {
  business: {
    select: {
      id: true,
      name: true,
      slug: true,
      primaryModel: true,
      fallbackModel: true,
      safetyMode: true,
      summary: true,
      brandVoice: true,
      mainGoals: true,
      coreOffers: true,
      systemPrompt: true,
      guardrails: true,
      offerAndAudienceNotes: true,
      bannedClaims: true
    }
  },
  _count: {
    select: {
      agentMemories: true,
      conversationLogs: true,
      actionRuns: true
    }
  }
} satisfies Prisma.AgentInclude;

const agentDetailInclude = {
  ...agentListInclude,
  actionRuns: {
    orderBy: {
      createdAt: "desc"
    },
    take: 10
  }
} satisfies Prisma.AgentInclude;

export type AgentWithBusiness = Prisma.AgentGetPayload<{
  include: typeof agentListInclude;
}>;

export type AgentDetail = Prisma.AgentGetPayload<{
  include: typeof agentDetailInclude;
}>;

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTools(value?: string[] | null) {
  if (!value || value.length === 0) {
    return Prisma.JsonNull;
  }

  return value;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sortAgents(agents: AgentWithBusiness[]) {
  const order: Record<string, number> = {
    main: 0,
    specialist: 1,
    global: 2
  };

  return [...agents].sort((left, right) => {
    const typeDiff = (order[left.type] ?? 99) - (order[right.type] ?? 99);
    if (typeDiff !== 0) {
      return typeDiff;
    }

    if (left.business?.name && right.business?.name) {
      const businessDiff = left.business.name.localeCompare(right.business.name);
      if (businessDiff !== 0) {
        return businessDiff;
      }
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

function buildAgentScopeWhere(
  organizationId: string,
  params: {
    businessId?: string;
    type?: string;
    status?: string;
    search?: string;
    businessIds?: string[];
  }
): Prisma.AgentWhereInput {
  const search = params.search?.trim();
  const scopedBusinessIds = params.businessIds;

  const orgScope: Prisma.AgentWhereInput =
    scopedBusinessIds !== undefined
      ? {
          businessId: {
            in: scopedBusinessIds
          }
        }
      : {
          OR: [
            {
              organizationId
            },
            {
              business: {
                organizationId
              }
            }
          ]
        };

  return {
    AND: [
      orgScope,
      params.businessId
        ? {
            businessId: params.businessId
          }
        : {},
      params.type && params.type !== "all"
        ? {
            type: params.type
          }
        : {},
      params.status && params.status !== "all"
        ? params.status === "active"
          ? {
              status: {
                in: ["active", "warning"]
              }
            }
          : {
              status: params.status
            }
        : {},
      search
        ? {
            OR: [
              {
                displayName: {
                  contains: search,
                  mode: "insensitive"
                }
              },
              {
                role: {
                  contains: search,
                  mode: "insensitive"
                }
              },
              {
                purpose: {
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
        : {}
    ]
  };
}

async function ensureBusinessForAgent(
  organizationId: string,
  businessId?: string | null
) {
  if (!businessId) {
    return null;
  }

  const business = await db.business.findFirst({
    where: {
      id: businessId,
      organizationId
    },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryModel: true,
      fallbackModel: true,
      safetyMode: true
    }
  });

  if (!business) {
    throw notFound("Business not found.");
  }

  return business;
}

async function ensureSingleMainAgent(
  tx: Prisma.TransactionClient,
  organizationId: string,
  businessId: string,
  excludeAgentId?: string
) {
  const existing = await tx.agent.findFirst({
    where: {
      businessId,
      type: "main",
      status: {
        not: "disabled"
      },
      OR: [
        {
          organizationId
        },
        {
          business: {
            organizationId
          }
        }
      ],
      ...(excludeAgentId
        ? {
            id: {
              not: excludeAgentId
            }
          }
        : {})
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (existing) {
    throw conflict(
      `${existing.displayName} is already the main agent for this business.`
    );
  }
}

async function shouldAssignDefaultAgent(
  tx: Prisma.TransactionClient,
  businessId: string
) {
  const existingDefault = await tx.agent.findFirst({
    where: {
      businessId,
      defaultAgent: true,
      status: {
        not: "disabled"
      }
    },
    select: {
      id: true
    }
  });

  return !existingDefault;
}

function sanitizeCreateData(data: CreateAgentInput) {
  return {
    organizationId: data.organizationId,
    businessId: data.type === "global" ? null : data.businessId ?? null,
    displayName: data.displayName.trim(),
    emoji: normalizeOptionalText(data.emoji),
    role: data.role.trim(),
    purpose: normalizeOptionalText(data.purpose),
    type: data.type,
    status: normalizeOptionalText(data.status) ?? "active",
    systemPrompt: normalizeOptionalText(data.systemPrompt),
    roleInstructions: normalizeOptionalText(data.roleInstructions),
    outputStyle: normalizeOptionalText(data.outputStyle),
    constraints: normalizeOptionalText(data.constraints),
    escalationRules: normalizeOptionalText(data.escalationRules),
    askBeforeDoing: normalizeOptionalText(data.askBeforeDoing),
    primaryModel: normalizeOptionalText(data.primaryModel),
    fallbackModel: normalizeOptionalText(data.fallbackModel),
    modelSource:
      normalizeOptionalText(data.modelSource) ??
      (data.type === "global" ? "system" : "business"),
    runtime: normalizeOptionalText(data.runtime) ?? "openclaw",
    safetyMode: normalizeOptionalText(data.safetyMode),
    tools: normalizeTools(data.tools),
    workspacePath: normalizeOptionalText(data.workspacePath),
    parentAgentId: data.parentAgentId ?? null,
    depth: data.depth ?? 0
  } satisfies Prisma.AgentUncheckedCreateInput;
}

function sanitizeUpdateData(data: UpdateAgentInput) {
  const updateData: Prisma.AgentUncheckedUpdateInput = {};

  if (data.businessId !== undefined) {
    updateData.businessId = data.businessId;
  }
  if (data.displayName !== undefined) {
    updateData.displayName = data.displayName.trim();
  }
  if (data.emoji !== undefined) {
    updateData.emoji = normalizeOptionalText(data.emoji);
  }
  if (data.role !== undefined) {
    updateData.role = data.role.trim();
  }
  if (data.purpose !== undefined) {
    updateData.purpose = normalizeOptionalText(data.purpose);
  }
  if (data.type !== undefined) {
    updateData.type = data.type;
  }
  if (data.status !== undefined) {
    updateData.status = normalizeOptionalText(data.status) ?? "active";
  }
  if (data.systemPrompt !== undefined) {
    updateData.systemPrompt = normalizeOptionalText(data.systemPrompt);
  }
  if (data.roleInstructions !== undefined) {
    updateData.roleInstructions = normalizeOptionalText(data.roleInstructions);
  }
  if (data.outputStyle !== undefined) {
    updateData.outputStyle = normalizeOptionalText(data.outputStyle);
  }
  if (data.constraints !== undefined) {
    updateData.constraints = normalizeOptionalText(data.constraints);
  }
  if (data.escalationRules !== undefined) {
    updateData.escalationRules = normalizeOptionalText(data.escalationRules);
  }
  if (data.askBeforeDoing !== undefined) {
    updateData.askBeforeDoing = normalizeOptionalText(data.askBeforeDoing);
  }
  if (data.primaryModel !== undefined) {
    updateData.primaryModel = normalizeOptionalText(data.primaryModel);
  }
  if (data.fallbackModel !== undefined) {
    updateData.fallbackModel = normalizeOptionalText(data.fallbackModel);
  }
  if (data.modelSource !== undefined) {
    updateData.modelSource =
      normalizeOptionalText(data.modelSource) ?? undefined;
  }
  if (data.runtime !== undefined) {
    updateData.runtime = normalizeOptionalText(data.runtime) ?? "openclaw";
  }
  if (data.safetyMode !== undefined) {
    updateData.safetyMode = normalizeOptionalText(data.safetyMode);
  }
  if (data.tools !== undefined) {
    updateData.tools = normalizeTools(data.tools);
  }
  if (data.workspacePath !== undefined) {
    updateData.workspacePath = normalizeOptionalText(data.workspacePath);
  }

  return updateData;
}

export async function listAgents(params: {
  organizationId: string;
  businessId?: string;
  type?: string;
  status?: string;
  search?: string;
  businessIds?: string[];
}) {
  if (params.businessIds && params.businessIds.length === 0) {
    return [] as AgentWithBusiness[];
  }

  const agents = await db.agent.findMany({
    where: buildAgentScopeWhere(params.organizationId, params),
    include: agentListInclude
  });

  return sortAgents(agents);
}

export async function getAgentById(
  id: string,
  organizationId: string,
  businessIds?: string[]
) {
  if (businessIds && businessIds.length === 0) {
    return null;
  }

  return db.agent.findFirst({
    where: {
      id,
      AND: [
        businessIds !== undefined
          ? {
              businessId: {
                in: businessIds
              }
            }
          : {
              OR: [
                {
                  organizationId
                },
                {
                  business: {
                    organizationId
                  }
                }
              ]
            }
      ]
    },
    include: agentDetailInclude
  });
}

export async function createAgent(data: CreateAgentInput): Promise<Agent> {
  if (data.type !== "global" && !data.businessId) {
    throw forbidden("Business agents must be assigned to a business.");
  }

  if (data.type === "global" && data.businessId) {
    throw forbidden("Global agents cannot be assigned to a business.");
  }

  if (data.businessId) {
    await ensureBusinessForAgent(data.organizationId, data.businessId);
  }

  return db.$transaction(async (tx) => {
    if (data.type === "main" && data.businessId) {
      await ensureSingleMainAgent(tx, data.organizationId, data.businessId);
    }

    const shouldBeDefault =
      data.businessId && data.type !== "global"
        ? await shouldAssignDefaultAgent(tx, data.businessId)
        : false;

    const created = await tx.agent.create({
      data: {
        ...sanitizeCreateData(data),
        defaultAgent: shouldBeDefault
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: created.businessId,
        type: "agent",
        title: "Agent created",
        detail: `${created.displayName} was added to Mission Control.`,
        status: created.status,
        metadata: {
          agentId: created.id,
          type: created.type
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId: data.organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "agent_created",
        entityType: "agent",
        entityId: created.id,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue(created)
      }
    });

    await tx.logEvent.create({
      data: {
        businessId: created.businessId,
        level: "info",
        action: "agent_created",
        message: `${created.displayName} was created.`,
        metadata: {
          agentId: created.id,
          type: created.type
        }
      }
    });

    return created;
  });
}

export async function updateAgent(
  id: string,
  organizationId: string,
  data: Partial<CreateAgentInput>
): Promise<Agent> {
  const existing = await db.agent.findFirst({
    where: {
      id,
      OR: [
        {
          organizationId
        },
        {
          business: {
            organizationId
          }
        }
      ]
    }
  });

  if (!existing) {
    throw notFound("Agent not found.");
  }

  const nextType = data.type ?? existing.type;
  const nextBusinessId =
    nextType === "global" ? null : data.businessId ?? existing.businessId;

  if (nextType !== "global" && !nextBusinessId) {
    throw forbidden("Business agents must be assigned to a business.");
  }

  if (nextBusinessId) {
    await ensureBusinessForAgent(organizationId, nextBusinessId);
  }

  const updateData = sanitizeUpdateData({
    ...data,
    businessId: nextBusinessId
  });

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  return db.$transaction(async (tx) => {
    if (nextType === "main" && nextBusinessId) {
      await ensureSingleMainAgent(tx, organizationId, nextBusinessId, id);
    }

    await tx.backup.create({
      data: {
        organizationId,
        businessId: existing.businessId,
        sourceType: "workspace_snapshot",
        scopeType: "agent",
        scopeId: existing.id,
        status: "completed",
        payload: toJsonValue(existing),
        triggeredBy: data.actorEmail ?? data.actorUserId ?? "system",
        reason: "Automatic snapshot before agent update"
      }
    });

    const updated = await tx.agent.update({
      where: {
        id
      },
      data: updateData
    });

    await tx.activityEntry.create({
      data: {
        businessId: updated.businessId,
        type: "agent",
        title: "Agent updated",
        detail: `${updated.displayName} settings were updated.`,
        status: updated.status,
        metadata: {
          agentId: updated.id,
          type: updated.type
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "agent_updated",
        entityType: "agent",
        entityId: updated.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(updated)
      }
    });

    return updated;
  });
}

export async function deleteAgent(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
) {
  const existing = await db.agent.findFirst({
    where: {
      id,
      OR: [
        {
          organizationId
        },
        {
          business: {
            organizationId
          }
        }
      ]
    }
  });

  if (!existing) {
    throw notFound("Agent not found.");
  }

  await db.$transaction(async (tx) => {
    const disabled = await tx.agent.update({
      where: {
        id
      },
      data: {
        status: "disabled",
        defaultAgent: false
      }
    });

    if (existing.businessId) {
      const replacement = await tx.agent.findFirst({
        where: {
          businessId: existing.businessId,
          id: {
            not: existing.id
          },
          status: {
            not: "disabled"
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      if (replacement) {
        await tx.agent.update({
          where: {
            id: replacement.id
          },
          data: {
            defaultAgent: true
          }
        });
      }
    }

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "agent",
        title: "Agent disabled",
        detail: `${existing.displayName} was disabled.`,
        status: disabled.status,
        metadata: {
          agentId: existing.id
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "agent_disabled",
        entityType: "agent",
        entityId: existing.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(disabled)
      }
    });
  });
}

export { resolveAgentModel };

export function resolveAgentModelWithSystemDefault(
  agent: Agent,
  business: Business | null,
  systemDefault: string
) {
  return resolveAgentModel(agent, business, systemDefault);
}

/** Count sub-agents (depth > 0) for a business. */
export async function countBusinessSubAgents(businessId: string) {
  return db.agent.count({
    where: {
      businessId,
      parentAgentId: { not: null }
    }
  });
}

/** Count direct children of a specific agent. */
export async function countAgentChildren(parentAgentId: string) {
  return db.agent.count({
    where: { parentAgentId }
  });
}

/** Get the raw config JSON for a business (for policy parsing). */
export async function getBusinessConfigById(id: string) {
  const business = await db.business.findUnique({
    where: { id },
    select: { config: true }
  });
  return business?.config ?? null;
}
