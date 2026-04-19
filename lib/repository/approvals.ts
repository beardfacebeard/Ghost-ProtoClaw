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
 * Pull the activityEntryId out of an approval's actionDetail JSON. Only
 * used by outreach_reply approvals (created by log_outreach_target).
 */
function extractActivityEntryId(
  actionDetail: Prisma.JsonValue | null | undefined
): string | null {
  if (!actionDetail || typeof actionDetail !== "object") return null;
  if (Array.isArray(actionDetail)) return null;
  const id = (actionDetail as Record<string, unknown>).activityEntryId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * When an outreach_reply or video_clip approval is approved or rejected,
 * mirror the decision onto the linked ActivityEntry so /admin/targets
 * (or /admin/clips) reflects the same state the Approvals inbox does.
 * Best-effort — failures here don't fail the approval itself.
 *
 * Maps by actionType:
 *   outreach_reply → outreach_target/reddit_target  (posted | dismissed)
 *   video_clip     → video_clip                      (used   | dismissed)
 */
async function syncLinkedActivityStatus(
  approval: ApprovalRequestWithContext,
  decision: "approved" | "rejected",
  reviewedBy: string | null | undefined
) {
  const kind: "outreach" | "clip" | null =
    approval.actionType === "outreach_reply"
      ? "outreach"
      : approval.actionType === "video_clip"
        ? "clip"
        : null;
  if (!kind) return;

  const entryId = extractActivityEntryId(approval.actionDetail);
  if (!entryId) return;

  const allowedEntryTypes =
    kind === "outreach"
      ? new Set(["outreach_target", "reddit_target"])
      : new Set(["video_clip"]);

  const nextStatus =
    decision === "approved"
      ? kind === "outreach"
        ? "posted"
        : "used"
      : "dismissed";

  try {
    const existing = await db.activityEntry.findUnique({
      where: { id: entryId },
      select: { id: true, metadata: true, type: true }
    });
    if (!existing) return;
    if (!allowedEntryTypes.has(existing.type)) return;

    const nextMetadata = {
      ...((existing.metadata as Record<string, unknown> | null) ?? {}),
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewedBy ?? null,
      syncedFromApprovalId: approval.id
    };
    await db.activityEntry.update({
      where: { id: entryId },
      data: {
        status: nextStatus,
        metadata: JSON.parse(JSON.stringify(nextMetadata))
      }
    });
  } catch (error) {
    console.error(
      "[approvals] failed to sync linked activity status:",
      error
    );
  }
}

/**
 * Forward an approved action to OpenClaw via the /hooks/agent endpoint.
 * This triggers an isolated agent turn that executes the approved action.
 */
async function forwardApprovedActionToOpenClaw(
  approval: ApprovalRequestWithContext
) {
  // Outreach drafts and video clips are intentionally NEVER auto-posted
  // or auto-cut. Approval means the human accepts the draft and will
  // produce it manually. Do not forward these action types to OpenClaw.
  if (
    approval.actionType === "outreach_reply" ||
    approval.actionType === "video_clip"
  ) {
    return;
  }
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

/**
 * List approval requests with pending items sorted first.
 *
 * NOTE: The "pending first" ordering uses a two-query split (count pending,
 * then fetch from the correct tier). Between the count and the fetch, an
 * approval can change status, which can cause a row to appear on two adjacent
 * pages or be skipped. This is a benign pagination race condition in practice
 * — the admin UI auto-refreshes and approval status changes are rare relative
 * to page-load frequency. If strict consistency is needed later, replace with
 * a single raw-SQL query using ORDER BY (status = 'pending')::int DESC.
 */
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
  reason?: string,
  businessIds?: string[]
): Promise<ApprovalRequest> {
  const existing = await getApprovalById(id, organizationId, businessIds);

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

  await syncLinkedActivityStatus(
    { ...existing, ...updated },
    "approved",
    reviewedBy
  );

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
  reason?: string,
  businessIds?: string[]
): Promise<ApprovalRequest> {
  const existing = await getApprovalById(id, organizationId, businessIds);

  if (!existing) {
    throw notFound("Approval request not found.");
  }

  if (existing.status !== "pending") {
    throw conflict("Only pending approval requests can be rejected.");
  }

  const reviewedAt = new Date();
  const normalizedReason = normalizeOptionalText(reason);

  const updated = await db.$transaction(async (tx) => {
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

  await syncLinkedActivityStatus(
    { ...existing, ...updated },
    "rejected",
    reviewedBy
  );

  return updated;
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
