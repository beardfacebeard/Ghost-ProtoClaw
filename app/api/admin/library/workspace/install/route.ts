import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { getWorkspaceLibraryItem } from "@/lib/library/workspace-library";
import { createWorkspaceDocument } from "@/lib/repository/workspace";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  businessId: z.string().trim().min(1),
  itemIds: z.array(z.string().trim().min(1)).min(1).max(100),
  onConflict: z.enum(["skip", "rename"]).optional()
});

type InstallAction =
  | "created"
  | "created_renamed"
  | "skipped_duplicate"
  | "skipped_unknown";

type InstallDetail = {
  id: string;
  title: string;
  filePath: string;
  action: InstallAction;
  documentId?: string;
};

function renderContent(content: string, businessName: string) {
  return content.replaceAll("{{businessName}}", businessName);
}

function renameFilePath(filePath: string, attempt: number) {
  const lastSlash = filePath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : "";
  const name = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  return `${dir}${base}-copy${attempt > 1 ? `-${attempt}` : ""}${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = bodySchema.parse(await request.json());
    const onConflict = body.onConflict ?? "skip";

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

    const existing = await db.workspaceDocument.findMany({
      where: { businessId: business.id },
      select: { filePath: true }
    });
    const takenPaths = new Set(existing.map((doc) => doc.filePath));

    const details: InstallDetail[] = [];
    const ipAddress = request.headers.get("x-forwarded-for");

    for (const itemId of body.itemIds) {
      const item = getWorkspaceLibraryItem(itemId);
      if (!item) {
        details.push({
          id: itemId,
          title: itemId,
          filePath: "",
          action: "skipped_unknown"
        });
        continue;
      }

      let targetPath = item.filePath;
      let renamed = false;

      if (takenPaths.has(targetPath)) {
        if (onConflict === "skip") {
          details.push({
            id: itemId,
            title: item.title,
            filePath: targetPath,
            action: "skipped_duplicate"
          });
          continue;
        }
        let attempt = 1;
        let candidate = renameFilePath(item.filePath, attempt);
        while (takenPaths.has(candidate) && attempt < 50) {
          attempt += 1;
          candidate = renameFilePath(item.filePath, attempt);
        }
        targetPath = candidate;
        renamed = true;
      }

      const created = await createWorkspaceDocument({
        businessId: business.id,
        agentId: null,
        filePath: targetPath,
        content: renderContent(item.content, business.name),
        category: item.category,
        tier: item.tier,
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress
      });

      takenPaths.add(targetPath);
      details.push({
        id: itemId,
        title: item.title,
        filePath: targetPath,
        action: renamed ? "created_renamed" : "created",
        documentId: created.id
      });
    }

    const createdCount = details.filter(
      (d) => d.action === "created" || d.action === "created_renamed"
    ).length;
    const renamedCount = details.filter(
      (d) => d.action === "created_renamed"
    ).length;
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
        renamed: renamedCount,
        skippedDuplicates: duplicateCount,
        skippedUnknown: unknownCount,
        details
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
