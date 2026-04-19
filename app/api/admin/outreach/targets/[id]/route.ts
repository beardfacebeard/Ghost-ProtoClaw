import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["posted", "dismissed", "pending"])
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
