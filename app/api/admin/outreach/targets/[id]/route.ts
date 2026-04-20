import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Status vocabulary on the outreach_target side of the house:
//   pending    — drafted by the agent, awaiting the human's decision
//   approved   — human approved the DRAFT via /admin/approvals; not
//                yet claimed to be posted
//   posted     — human clicked "Mark posted" after actually posting
//                it to the target platform (source of truth)
//   dismissed  — human rejected it
const bodySchema = z.object({
  action: z.enum(["approved", "posted", "dismissed", "pending"])
});

type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    const entry = await db.activityEntry.findUnique({
      where: { id: params.id },
      include: {
        business: {
          select: { organizationId: true }
        }
      }
    });

    if (
      !entry ||
      (entry.type !== "outreach_target" && entry.type !== "reddit_target")
    ) {
      throw notFound("Outreach target not found.");
    }
    if (entry.business?.organizationId !== session.organizationId) {
      throw notFound("Outreach target not found.");
    }
    if (!entry.businessId) {
      throw notFound("Outreach target is not scoped to a business.");
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, entry.businessId);
    }

    const updated = await db.activityEntry.update({
      where: { id: params.id },
      data: {
        status: body.action,
        metadata: {
          ...((entry.metadata as Record<string, unknown> | null) ?? {}),
          reviewedAt: new Date().toISOString(),
          reviewedBy: session.email ?? session.userId
        }
      }
    });

    // Mirror the decision back to the linked ApprovalRequest (if any) so
    // the Approvals inbox and /admin/targets never disagree. posted →
    // approved, dismissed → rejected, pending → reopen the approval.
    const meta =
      (entry.metadata as Record<string, unknown> | null) ?? {};
    const approvalRequestId =
      typeof meta.approvalRequestId === "string"
        ? meta.approvalRequestId
        : null;
    if (approvalRequestId) {
      const nextApprovalStatus =
        body.action === "posted"
          ? "approved"
          : body.action === "dismissed"
            ? "rejected"
            : "pending";
      try {
        await db.approvalRequest.updateMany({
          where: {
            id: approvalRequestId,
            // Guard: only flip approvals that haven't already been resolved
            // in the inbox. If the approval was already decided there, we
            // respect that decision and leave it alone.
            status:
              nextApprovalStatus === "pending"
                ? { in: ["approved", "rejected"] }
                : "pending"
          },
          data: {
            status: nextApprovalStatus,
            reviewedBy:
              nextApprovalStatus === "pending"
                ? null
                : session.email ?? session.userId,
            reviewedAt:
              nextApprovalStatus === "pending" ? null : new Date()
          }
        });
      } catch (error) {
        console.error(
          "[outreach-targets] failed to mirror decision to approval:",
          error
        );
      }
    }

    return addSecurityHeaders(
      NextResponse.json({
        id: updated.id,
        status: updated.status
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
