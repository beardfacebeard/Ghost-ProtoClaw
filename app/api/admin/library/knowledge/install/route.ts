import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { getKnowledgeLibraryItem } from "@/lib/library/knowledge-library";
import { createKnowledgeItem } from "@/lib/repository/knowledge";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  businessId: z.string().trim().min(1),
  itemIds: z.array(z.string().trim().min(1)).min(1).max(100)
});

type InstallAction = "created" | "skipped_duplicate" | "skipped_unknown";

type InstallDetail = {
  id: string;
  title: string;
  action: InstallAction;
  knowledgeItemId?: string;
};

function renderContent(content: string, businessName: string) {
  return content.replaceAll("{{businessName}}", businessName);
}

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

    const existing = await db.knowledgeItem.findMany({
      where: { businessId: business.id },
      select: { title: true, category: true }
    });
    const existingKeys = new Set(
      existing.map(
        (item) => `${item.category}::${item.title.trim().toLowerCase()}`
      )
    );

    const details: InstallDetail[] = [];
    const ipAddress = request.headers.get("x-forwarded-for");

    for (const itemId of body.itemIds) {
      const item = getKnowledgeLibraryItem(itemId);
      if (!item) {
        details.push({ id: itemId, title: itemId, action: "skipped_unknown" });
        continue;
      }

      const key = `${item.category}::${item.title.trim().toLowerCase()}`;
      if (existingKeys.has(key)) {
        details.push({
          id: itemId,
          title: item.title,
          action: "skipped_duplicate"
        });
        continue;
      }

      const created = await createKnowledgeItem({
        businessId: business.id,
        category: item.category,
        title: item.title,
        content: renderContent(item.content, business.name),
        sourceType: "knowledge_base",
        enabled: true,
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress
      });

      existingKeys.add(key);
      details.push({
        id: itemId,
        title: item.title,
        action: "created",
        knowledgeItemId: created.id
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
