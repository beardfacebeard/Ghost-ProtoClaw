import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { getWorkflowLibraryItem } from "@/lib/library/workflow-library";
import { createWorkflow } from "@/lib/repository/workflows";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  businessId: z.string().trim().min(1),
  itemIds: z.array(z.string().trim().min(1)).min(1).max(100),
  enableImmediately: z.boolean().optional()
});

type InstallAction = "created" | "skipped_duplicate" | "skipped_unknown";

type InstallDetail = {
  id: string;
  name: string;
  action: InstallAction;
  workflowId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    if (session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    const business = await db.business.findFirst({
      where: {
        id: body.businessId,
        organizationId: session.organizationId
      },
      select: { id: true, name: true }
    });

    if (!business) {
      throw notFound("Business not found.");
    }

    const existing = await db.workflow.findMany({
      where: { businessId: business.id },
      select: { name: true }
    });
    const existingNames = new Set(
      existing.map((workflow) => workflow.name.trim().toLowerCase())
    );

    const details: InstallDetail[] = [];
    const enableImmediately = body.enableImmediately ?? true;
    const ipAddress = request.headers.get("x-forwarded-for");

    for (const itemId of body.itemIds) {
      const item = getWorkflowLibraryItem(itemId);
      if (!item) {
        details.push({ id: itemId, name: itemId, action: "skipped_unknown" });
        continue;
      }

      const key = item.name.trim().toLowerCase();
      if (existingNames.has(key)) {
        details.push({ id: itemId, name: item.name, action: "skipped_duplicate" });
        continue;
      }

      const created = await createWorkflow({
        organizationId: session.organizationId,
        businessId: business.id,
        agentId: null,
        name: item.name,
        description: item.description,
        trigger: item.trigger,
        output: item.output,
        outputs: item.outputs ?? [item.output],
        scheduleMode: item.scheduleMode ?? null,
        frequency: item.frequency ?? null,
        cronExpression: item.cronExpression ?? null,
        timezone: item.timezone ?? null,
        approvalMode: item.approvalMode,
        enabled: enableImmediately,
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress
      });

      existingNames.add(key);
      details.push({
        id: itemId,
        name: item.name,
        action: "created",
        workflowId: created.id
      });
    }

    const createdCount = details.filter((d) => d.action === "created").length;
    const duplicateCount = details.filter(
      (d) => d.action === "skipped_duplicate"
    ).length;
    const unknownCount = details.filter(
      (d) => d.action === "skipped_unknown"
    ).length;

    return addSecurityHeaders(
      NextResponse.json({
        businessId: business.id,
        businessName: business.name,
        created: createdCount,
        skippedDuplicates: duplicateCount,
        skippedUnknown: unknownCount,
        details
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
