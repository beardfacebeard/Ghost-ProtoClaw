import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["used", "dismissed", "pending"])
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

    if (!entry || entry.type !== "video_clip") {
      throw notFound("Video clip not found.");
    }
    if (entry.business?.organizationId !== session.organizationId) {
      throw notFound("Video clip not found.");
    }
    if (!entry.businessId) {
      throw notFound("Video clip is not scoped to a business.");
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

    // Mirror the decision to the linked ApprovalRequest so the Approvals
    // inbox and /admin/clips stay in sync.
    const meta = (entry.metadata as Record<string, unknown> | null) ?? {};
    const approvalRequestId =
      typeof meta.approvalRequestId === "string"
        ? meta.approvalRequestId
        : null;
    if (approvalRequestId) {
      const nextApprovalStatus =
        body.action === "used"
          ? "approved"
          : body.action === "dismissed"
            ? "rejected"
            : "pending";
      try {
        await db.approvalRequest.updateMany({
          where: {
            id: approvalRequestId,
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
          "[video-clips] failed to mirror decision to approval:",
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
