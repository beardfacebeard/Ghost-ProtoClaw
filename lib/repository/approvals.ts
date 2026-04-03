import { Prisma, type ApprovalRequest } from "@prisma/client";

import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { hooksAgent, isConfigured } from "@/lib/openclaw/client";

const approvalContextInclude = {
  business: {
    select: {
      id: true,
      name: true
    }
  },
  agent: {
    select: {
      id: true,
      displayName: true,
      emoji: true
    }
  },
  workflow: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.ApprovalRequestInclude;

export type ApprovalRequestWithContext = Prisma.ApprovalRequestGetPayload<{
  include: typeof approvalContextInclude;
}>;

type ApprovalListParams = {
  organizationId: string;
  businessId?: string;
  status?: string;
  workflowId?: string;
  agentId?: string;
  limit?: number;
  offset?: number;
  businessIds?: string[];
  startDate?: Date;
  endDate?: Date;
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

function buildApprovalWhere(params: ApprovalListParams): Prisma.ApprovalRequestWhereInput {
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
    ...(params.status && params.status !== "all"
      ? {
          status: params.status
        }
      : {}),
    ...(params.workflowId
      ? {
          workflowId: params.workflowId
        }
      : {}),
    ...(params.agentId
      ? {
          agentId: params.agentId
        }
      : {}),
    ...((params.startDate || params.endDate) && {
      createdAt: {
        ...(params.startDate
          ? {
              gte: params.startDate
            }
          : {}),
        ...(params.endDate
          ? {
              lte: params.endDate
            }
          : {})
      }
    })
  };
}

/**
 * Forward an approved action to OpenClaw via the /hooks/agent endpoint.
 * This triggers an isolated agent turn that executes the approved action.
 */
async function forwardApprovedActionToOpenClaw(
  approval: ApprovalRequestWithContext
) {
  if (!isConfigured()) {
    return;
  }

  const actionDetail =
    typeof approval.actionDetail === "object" && approval.actionDetail !== null
      ? JSON.stringify(approval.actionDetail, null, 2)
      : String(approval.actionDetail ?? "");

  const prompt = [
    `An approval request has been granted. Execute the approved action.`,
    ``,
    `Approval ID: ${approval.id}`,
    `Action type: ${approval.actionType}`,
    `Business: ${approval.business?.name ?? approval.businessId}`,
    approval.agent ? `Agent: ${approval.agent.displayName}` : "",
    approval.workflow ? `Workflow: ${approval.workflow.name}` : "",
    `Reviewed by: ${approval.reviewedBy}`,
    approval.reason ? `Reason: ${approval.reason}` : "",
    actionDetail ? `\nAction details:\n${actionDetail}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const result = await hooksAgent(
    {
      message: prompt,
      sessionKey: `approval:${approval.id}`
    },
    30_000
  );

  if (!result.success) {
    throw new Error(result.error ?? "OpenClaw did not accept the approval.");
  }
}

export function countApprovalRequests(params: ApprovalListParams) {
  return db.approvalRequest.count({
    where: buildApprovalWhere(params)
  });
}

export async function listApprovalRequests(
  params: ApprovalListParams
): Promise<ApprovalRequestWithContext[]> {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const where = buildApprovalWhere(params);

  if (params.status && params.status !== "all") {
    return db.approvalRequest.findMany({
      where,
      include: approvalContextInclude,
      orderBy: {
        createdAt: "desc"
      },
      take: limit,
      skip: offset
    });
  }

  const pendingWhere = {
    ...where,
    status: "pending"
  } satisfies Prisma.ApprovalRequestWhereInput;
  const nonPendingWhere = {
    ...where,
    status: {
      not: "pending"
    }
  } satisfies Prisma.ApprovalRequestWhereInput;

  const pendingCount = await db.approvalRequest.count({
    where: pendingWhere
  });

  if (offset >= pendingCount) {
    return db.approvalRequest.findMany({
      where: nonPendingWhere,
      include: approvalContextInclude,
      orderBy: {
        createdAt: "desc"
      },
      take: limit,
      skip: offset - pendingCount
    });
  }

  const pendingApprovals = await db.approvalRequest.findMany({
    where: pendingWhere,
    include: approvalContextInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: limit,
    skip: offset
  });

  if (pendingApprovals.length >= limit) {
    return pendingApprovals;
  }

  const remaining = limit - pendingApprovals.length;
  const otherApprovals = await db.approvalRequest.findMany({
    where: nonPendingWhere,
    include: approvalContextInclude,
    orderBy: {
      createdAt: "desc"
    },
    take: remaining
  });

  return [...pendingApprovals, ...otherApprovals];
}

export async function getApprovalById(
  id: string,
  organizationId: string,
  businessIds?: string[]
): Promise<ApprovalRequestWithContext | null> {
  return db.approvalRequest.findFirst({
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
    include: approvalContextInclude
  });
}

export async function approveRequest(
  id: string,
  reviewedBy: string,
  organizationId: string,
  reason?: string
): Promise<ApprovalRequest> {
  const existing = await getApprovalById(id, organizationId);

  if (!existing) {
    throw notFound("Approval request not found.");
  }

  if (existing.status !== "pending") {
    throw conflict("Only pending approval requests can be approved.");
  }

  const reviewedAt = new Date();
  const normalizedReason = normalizeOptionalText(reason);

  const updated = await db.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.update({
      where: {
        id
      },
      data: {
        status: "approved",
        reviewedBy,
        reviewedAt,
        reason: normalizedReason
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorEmail: reviewedBy,
        eventType: "approval_request_approved",
        entityType: "approval_request",
        entityId: approval.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(approval)
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "approval",
        title: "Approval granted",
        detail: `${existing.actionType.replaceAll("_", " ")} was approved for ${existing.business?.name ?? "the business"}.`,
        status: "approved",
        metadata: {
          approvalId: approval.id,
          actionType: approval.actionType,
          reviewedBy,
          workflowId: approval.workflowId,
          agentId: approval.agentId
        }
      }
    });

    return approval;
  });

  try {
    await forwardApprovedActionToOpenClaw({
      ...existing,
      ...updated,
      reviewedAt: updated.reviewedAt,
      reviewedBy: updated.reviewedBy,
      reason: updated.reason
    });
  } catch (error) {
    await db.logEvent.create({
      data: {
        businessId: existing.businessId,
        level: "warning",
        action: "approval_forward_failed",
        message: `Approval ${updated.id} was marked approved but could not be forwarded to OpenClaw.`,
        metadata: {
          approvalId: updated.id,
          error: error instanceof Error ? error.message : "Unknown forwarding error"
        }
      }
    });
  }

  return updated;
}

export async function rejectRequest(
  id: string,
  reviewedBy: string,
  organizationId: string,
  reason?: string
): Promise<ApprovalRequest> {
  const existing = await getApprovalById(id, organizationId);

  if (!existing) {
    throw notFound("Approval request not found.");
  }

  if (existing.status !== "pending") {
    throw conflict("Only pending approval requests can be rejected.");
  }

  const reviewedAt = new Date();
  const normalizedReason = normalizeOptionalText(reason);

  return db.$transaction(async (tx) => {
    const approval = await tx.approvalRequest.update({
      where: {
        id
      },
      data: {
        status: "rejected",
        reviewedBy,
        reviewedAt,
        reason: normalizedReason
      }
    });

    await tx.auditEvent.create({
      data: {
        organizationId,
        actorEmail: reviewedBy,
        eventType: "approval_request_rejected",
        entityType: "approval_request",
        entityId: approval.id,
        beforeJson: toJsonValue(existing),
        afterJson: toJsonValue(approval)
      }
    });

    await tx.activityEntry.create({
      data: {
        businessId: existing.businessId,
        type: "approval",
        title: "Approval rejected",
        detail: `${existing.actionType.replaceAll("_", " ")} was rejected for ${existing.business?.name ?? "the business"}.`,
        status: "rejected",
        metadata: {
          approvalId: approval.id,
          actionType: approval.actionType,
          reviewedBy,
          reason: normalizedReason
        }
      }
    });

    return approval;
  });
}

export async function expireStaleApprovals(): Promise<number> {
  const now = new Date();
  const result = await db.approvalRequest.updateMany({
    where: {
      status: "pending",
      expiresAt: {
        lt: now
      }
    },
    data: {
      status: "expired",
      reviewedAt: now
    }
  });

  return result.count;
}

export async function getPendingCount(
  organizationId: string,
  businessIds?: string[]
): Promise<number> {
  return db.approvalRequest.count({
    where: {
      status: "pending",
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
    }
  });
}
