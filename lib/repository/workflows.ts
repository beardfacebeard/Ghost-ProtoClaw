import { Prisma, type Workflow } from "@prisma/client";

import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { runWorkflowOnOpenClaw, syncWorkflowSchedule } from "@/lib/openclaw/workflow-bridge";
import { getNextRunTime } from "@/lib/workflows/schedule-parser";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

export type CreateWorkflowInput = AuditContext & {
  organizationId: string;
  businessId: string;
  agentId?: string | null;
  name: string;
  description?: string | null;
  trigger:
    | "manual"
    | "scheduled"
    | "webhook"
    | "new_email"
    | "new_lead"
    | "new_comment";
  output: "chat" | "report" | "draft" | "crm_note" | "content_queue";
  scheduleMode?: "cron" | "every" | "definition_only" | null;
  frequency?: string | null;
  cronExpression?: string | null;
  timezone?: string | null;
  approvalMode: "auto" | "notify" | "approve_first" | "review_after";
  safetyMode?: string | null;
  actionType?: string | null;
  enabled?: boolean;
};

export type UpdateWorkflowInput = Partial<CreateWorkflowInput>;

const webhookEndpointSelect = {
  id: true,
  businessId: true,
  workflowId: true,
  provider: true,
  enabled: true,
  lastReceivedAt: true,
  totalReceived: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.WebhookEndpointSelect;

const workflowListInclude = {
  business: {
    select: {
      id: true,
      name: true
    }
  },
  webhookEndpoints: {
    select: webhookEndpointSelect
  },
  _count: {
    select: {
      actionRuns: true
    }
  }
} satisfies Prisma.WorkflowInclude;

const workflowDetailInclude = {
  ...workflowListInclude,
  actionRuns: {
    orderBy: {
      createdAt: "desc"
    },
    take: 10
  }
} satisfies Prisma.WorkflowInclude;

export type WorkflowWithBusiness = Prisma.WorkflowGetPayload<{
  include: typeof workflowListInclude;
}> & {
  agent: {
    id: string;
    displayName: string;
    emoji: string | null;
  } | null;
};

type WorkflowDetailPayload = Prisma.WorkflowGetPayload<{
  include: typeof workflowDetailInclude;
}>;

export type WorkflowWithDetails = Omit<WorkflowDetailPayload, "actionRuns"> & {
  agent: {
    id: string;
    displayName: string;
    emoji: string | null;
  } | null;
  recentRuns: WorkflowDetailPayload["actionRuns"];
};

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sanitizeCreateData(data: CreateWorkflowInput) {
  return {
    organizationId: data.organizationId,
    businessId: data.businessId,
    agentId: normalizeOptionalText(data.agentId),
    name: data.name.trim(),
    description: normalizeOptionalText(data.description),
    enabled: data.enabled ?? true,
    trigger: data.trigger,
    output: data.output,
    scheduleMode: normalizeOptionalText(data.scheduleMode),
    frequency: normalizeOptionalText(data.frequency),
    timezone: normalizeOptionalText(data.timezone),
    cronExpression: normalizeOptionalText(data.cronExpression),
    approvalMode: data.approvalMode,
    safetyMode: normalizeOptionalText(data.safetyMode),
    actionType: normalizeOptionalText(data.actionType)
  } satisfies Prisma.WorkflowUncheckedCreateInput;
}

function sanitizeUpdateData(data: UpdateWorkflowInput) {
  const updateData: Prisma.WorkflowUncheckedUpdateInput = {};

  if (data.businessId !== undefined) {
    updateData.businessId = data.businessId;
  }
  if (data.agentId !== undefined) {
    updateData.agentId = normalizeOptionalText(data.agentId);
  }
  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }
  if (data.description !== undefined) {
    updateData.description = normalizeOptionalText(data.description);
  }
  if (data.enabled !== undefined) {
    updateData.enabled = data.enabled;
  }
  if (data.trigger !== undefined) {
    updateData.trigger = data.trigger;
  }
  if (data.output !== undefined) {
    updateData.output = data.output;
  }
  if (data.scheduleMode !== undefined) {
    updateData.scheduleMode = normalizeOptionalText(data.scheduleMode);
  }
  if (data.frequency !== undefined) {
    updateData.frequency = normalizeOptionalText(data.frequency);
  }
  if (data.cronExpression !== undefined) {
    updateData.cronExpression = normalizeOptionalText(data.cronExpression);
  }
  if (data.timezone !== undefined) {
    updateData.timezone = normalizeOptionalText(data.timezone);
  }
  if (data.approvalMode !== undefined) {
    updateData.approvalMode = data.approvalMode;
  }
  if (data.safetyMode !== undefined) {
    updateData.safetyMode = normalizeOptionalText(data.safetyMode);
  }
  if (data.actionType !== undefined) {
    updateData.actionType = normalizeOptionalText(data.actionType);
  }

  return updateData;
}

async function ensureBusinessForWorkflow(
  organizationId: string,
  businessId: string
) {
  const business = await db.business.findFirst({
    where: {
      id: businessId,
      organizationId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!business) {
    throw notFound("Business not found.");
  }

  return business;
}

async function ensureAgentForWorkflow(
  organizationId: string,
  businessId: string,
  agentId?: string | null
) {
  if (!agentId) {
    return null;
  }

  const agent = await db.agent.findFirst({
    where: {
      id: agentId,
      OR: [
        {
          businessId
        },
        {
          type: "global",
          organizationId
        }
      ]
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (!agent) {
    throw conflict("Selected agent is not available for this workflow.");
  }

  return agent;
}

function buildWorkflowScopeWhere(
  organizationId: string,
  params: {
    businessId?: string;
    trigger?: string;
    enabled?: boolean;
    search?: string;
    businessIds?: string[];
  }
): Prisma.WorkflowWhereInput {
  const search = params.search?.trim();

  return {
    business: {
      organizationId,
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
    ...(params.trigger && params.trigger !== "all"
      ? {
          trigger: params.trigger
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
              name: {
                contains: search,
                mode: "insensitive"
              }
            },
            {
      description: {
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
      : {})
  };
}

async function maybeSyncSchedule(workflow: Workflow) {
  await persistNextRunAt(workflow);

  if (workflow.trigger !== "scheduled" || !workflow.enabled) {
    return;
  }

  await syncWorkflowSchedule(workflow);
}

/**
 * Recompute and persist nextRunAt on the workflow row. Called after create
 * and update so the in-process scheduler has a fresh firing time. When the
 * workflow is no longer scheduled or is disabled, clears the column so the
 * scheduler stops seeing it as due.
 */
async function persistNextRunAt(workflow: Workflow) {
  const shouldSchedule =
    workflow.trigger === "scheduled" && workflow.enabled;
  const next = shouldSchedule ? getNextRunTime(workflow) : null;

  const current = workflow.nextRunAt ? workflow.nextRunAt.getTime() : null;
  const desired = next ? next.getTime() : null;
  if (current === desired) return;

  await db.workflow.update({
    where: { id: workflow.id },
    data: { nextRunAt: next }
  });
}

async function attachAgents<T extends { agentId: string | null }>(
  workflows: T[]
) {
  const agentIds = [
    ...new Set(
      workflows
        .map((workflow) => workflow.agentId)
        .filter((agentId): agentId is string => Boolean(agentId))
    )
  ];

  if (agentIds.length === 0) {
    return workflows.map((workflow) => ({
      ...workflow,
      agent: null
    }));
  }

  const agents = await db.agent.findMany({
    where: {
      id: {
        in: agentIds
      }
    },
    select: {
      id: true,
      displayName: true,
      emoji: true
    }
  });
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));

  return workflows.map((workflow) => ({
    ...workflow,
    agent: workflow.agentId ? agentMap.get(workflow.agentId) ?? null : null
  }));
}

export async function listWorkflows(params: {
  organizationId: string;
  businessId?: string;
  trigger?: string;
  enabled?: boolean;
  search?: string;
  businessIds?: string[];
}) {
  if (params.businessIds && params.businessIds.length === 0) {
    return [] as WorkflowWithBusiness[];
  }

  const workflows = await db.workflow.findMany({
    where: buildWorkflowScopeWhere(params.organizationId, params),
    include: workflowListInclude,
    orderBy: [{ enabled: "desc" }, { name: "asc" }]
  });

  return attachAgents(workflows);
}

export async function getWorkflowById(
  id: string,
  organizationId: string,
  businessIds?: string[]
): Promise<WorkflowWithDetails | null> {
  if (businessIds && businessIds.length === 0) {
    return null;
  }

  const workflow = await db.workflow.findFirst({
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
    include: workflowDetailInclude
  });

  if (!workflow) {
    return null;
  }

  const [augmented] = await attachAgents([workflow]);

  return {
    ...augmented,
    recentRuns: workflow.actionRuns
  };
}

export async function createWorkflow(data: CreateWorkflowInput): Promise<Workflow> {
  await ensureBusinessForWorkflow(data.organizationId, data.businessId);
  await ensureAgentForWorkflow(data.organizationId, data.businessId, data.agentId);

  const created = await db.$transaction(async (tx) => {
    const workflow = await tx.workflow.create({
      data: sanitizeCreateData(data)
    });

    if (workflow.trigger === "webhook") {
      await tx.webhookEndpoint.create({
        data: {
          businessId: workflow.businessId,
          workflowId: workflow.id,
          provider: "generic",
          enabled: true
        }
      });
    }

    await tx.activityEntry.create({
      data: {
        businessId: workflow.businessId,
        type: "workflow",
        title: "Workflow created",
        detail: `${workflow.name} is ready to run.`,
        status: workflow.enabled ? "enabled" : "disabled",
        metadata: {
          workflowId: workflow.id,
          trigger: workflow.trigger
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId: data.organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "workflow_created",
        entityType: "workflow",
        entityId: workflow.id,
        beforeJson: Prisma.JsonNull,
        afterJson: toJsonValue(workflow)
      }
    });

    await tx.logEvent.create({
      data: {
        businessId: workflow.businessId,
        level: "info",
        action: "workflow_created",
        message: `${workflow.name} was created.`,
        metadata: {
          workflowId: workflow.id,
          trigger: workflow.trigger
        }
      }
    });

    return workflow;
  });

  await maybeSyncSchedule(created);

  return created;
}

export async function updateWorkflow(
  id: string,
  organizationId: string,
  data: Partial<CreateWorkflowInput>
): Promise<Workflow> {
  const existing = await db.workflow.findFirst({
    where: {
      id,
      business: {
        organizationId
      }
    }
  });

  if (!existing) {
    throw notFound("Workflow not found.");
  }

  const nextBusinessId = data.businessId ?? existing.businessId;
  await ensureBusinessForWorkflow(organizationId, nextBusinessId);
  await ensureAgentForWorkflow(
    organizationId,
    nextBusinessId,
    data.agentId ?? existing.agentId
  );

  const updateData = sanitizeUpdateData(data);

  if (Object.keys(updateData).length === 0) {
    return existing;
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.backup.create({
      data: {
        organizationId,
        businessId: existing.businessId,
        sourceType: "workspace_snapshot",
        scopeType: "workflow",
        scopeId: existing.id,
        status: "completed",
        payload: toJsonValue(existing),
        triggeredBy: data.actorEmail ?? data.actorUserId ?? "system",
        reason: "Automatic snapshot before workflow update"
      }
    });

    const workflow = await tx.workflow.update({
      where: {
        id
      },
      data: updateData
    });

    if (workflow.trigger === "webhook") {
      const endpoint = await tx.webhookEndpoint.findFirst({
        where: {
          workflowId: workflow.id
        },
        select: {
          id: true
        }
      });

      if (!endpoint) {
        await tx.webhookEndpoint.create({
          data: {
            businessId: workflow.businessId,
            workflowId: workflow.id,
            provider: "generic",
            enabled: true
          }
        });
      }
    }

    await tx.activityEntry.create({
      data: {
        businessId: workflow.businessId,
        type: "workflow",
        title: "Workflow updated",
        detail: `${workflow.name} settings were updated.`,
        status: workflow.enabled ? "enabled" : "disabled",
        metadata: {
          workflowId: workflow.id
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: data.actorUserId ?? null,
        actorEmail: data.actorEmail ?? null,
        ipAddress: data.ipAddress ?? null,
        eventType: "workflow_updated",
        entityType: "workflow",
        entityId: workflow.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(workflow)
      }
    });

    return workflow;
  });

  await maybeSyncSchedule(updated);

  return updated;
}

export async function deleteWorkflow(
  id: string,
  organizationId: string,
  auditContext: AuditContext = {}
): Promise<void> {
  const existing = await db.workflow.findFirst({
    where: {
      id,
      business: {
        organizationId
      }
    }
  });

  if (!existing) {
    throw notFound("Workflow not found.");
  }

  await db.$transaction(async (tx) => {
    const disabled = await tx.workflow.update({
      where: {
        id
      },
      data: {
        enabled: false,
        runtimeJobId: null
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "workflow",
        title: "Workflow deleted",
        detail: `${existing.name} was disabled and removed from active automation.`,
        status: "disabled",
        metadata: {
          workflowId: existing.id
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: "workflow_deleted",
        entityType: "workflow",
        entityId: existing.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(disabled)
      }
    });
  });
}

export async function toggleWorkflow(
  id: string,
  organizationId: string,
  enabled: boolean,
  auditContext: AuditContext = {}
) {
  const existing = await db.workflow.findFirst({
    where: {
      id,
      business: {
        organizationId
      }
    }
  });

  if (!existing) {
    throw notFound("Workflow not found.");
  }

  const updated = await db.$transaction(async (tx) => {
    const workflow = await tx.workflow.update({
      where: {
        id
      },
      data: {
        enabled,
        ...(enabled ? {} : { runtimeJobId: null })
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: workflow.businessId,
        type: "workflow",
        title: enabled ? "Workflow enabled" : "Workflow disabled",
        detail: `${workflow.name} was ${enabled ? "enabled" : "disabled"}.`,
        status: enabled ? "enabled" : "disabled",
        metadata: {
          workflowId: workflow.id
        }
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: auditContext.actorUserId ?? null,
        actorEmail: auditContext.actorEmail ?? null,
        ipAddress: auditContext.ipAddress ?? null,
        eventType: enabled ? "workflow_enabled" : "workflow_disabled",
        entityType: "workflow",
        entityId: workflow.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(workflow)
      }
    });

    return workflow;
  });

  await maybeSyncSchedule(updated);

  return updated;
}

export async function runWorkflowManually(
  id: string,
  userId: string,
  payload?: Record<string, unknown>
) {
  const workflow = await db.workflow.findUnique({
    where: {
      id
    },
    include: {
      business: true
    }
  });

  if (!workflow) {
    throw notFound("Workflow not found.");
  }

  if (workflow.approvalMode === "approve_first") {
    const approval = await db.approvalRequest.create({
      data: {
        businessId: workflow.businessId,
        agentId: workflow.agentId,
        workflowId: workflow.id,
        actionType: "trigger_workflow",
        actionDetail: payload ? toJsonValue(payload) : Prisma.JsonNull,
        status: "pending",
        requestedBy: userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reason: "Manual workflow run requires approval"
      }
    });

    await db.activityEntry.create({
      data: {
        businessId: workflow.businessId,
        type: "approval",
        title: "Workflow awaiting approval",
        detail: `${workflow.name} is waiting for approval before it runs.`,
        status: approval.status,
        metadata: {
          workflowId: workflow.id,
          approvalId: approval.id
        }
      }
    });

    return {
      requiresApproval: true as const,
      approvalId: approval.id
    };
  }

  const run = await db.actionRun.create({
    data: {
      businessId: workflow.businessId,
      agentId: workflow.agentId,
      workflowId: workflow.id,
      action: "run_workflow",
      status: "pending",
      reason: `Manual run requested by ${userId}`,
      result: payload ? toJsonValue(payload) : undefined,
      startedAt: new Date()
    }
  });

  const runtimeResult = await runWorkflowOnOpenClaw({
    workflowId: workflow.id,
    businessId: workflow.businessId,
    agentId: workflow.agentId,
    trigger: "manual",
    payload
  });

  const status = runtimeResult.success ? "completed" : "failed";
  const resultSummary = runtimeResult.success
    ? runtimeResult.result ?? { message: "Workflow completed." }
    : { error: runtimeResult.error ?? "Workflow failed." };

  const updatedRun = await db.actionRun.update({
    where: {
      id: run.id
    },
    data: {
      status,
      result: toJsonValue(resultSummary),
      error: runtimeResult.success ? null : runtimeResult.error ?? "Workflow failed",
      completedAt: new Date()
    }
  });

  await db.workflow.update({
    where: {
      id: workflow.id
    },
    data: {
      lastRunAt: new Date(),
      resultStatus: status,
      lastRunResult: toJsonValue(resultSummary),
      ...(runtimeResult.runtimeJobId
        ? {
            runtimeJobId: runtimeResult.runtimeJobId
          }
        : {})
    }
  });

  await db.activityEntry.create({
    data: {
      businessId: workflow.businessId,
      type: "workflow",
      title: "Workflow ran manually",
      detail: runtimeResult.success
        ? `${workflow.name} completed successfully.`
        : `${workflow.name} failed to run.`,
      status,
      metadata: {
        workflowId: workflow.id,
        actionRunId: updatedRun.id,
        latencyMs: runtimeResult.latencyMs
      }
    }
  });

  return updatedRun;
}

export async function getWorkflowRuns(workflowId: string, limit = 20) {
  return db.actionRun.findMany({
    where: {
      workflowId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: Math.max(1, Math.min(limit, 100))
  });
}
