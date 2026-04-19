import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { resolvePublicUrl } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  key: z.string().trim().min(1),
  businessId: z.string().trim().min(1).optional(),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().nonnegative().optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional()
});

/**
 * Called by the browser AFTER a successful presigned upload. We resolve
 * a publicly shareable URL and log the asset so Pulse + agents can see
 * it was uploaded. For videos, this creates an ActivityEntry of type
 * "video_asset" the CMO can reference by URL.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = bodySchema.parse(await request.json());

    if (body.businessId && session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    const publicUrl = await resolvePublicUrl(body.key);
    const kind = body.contentType.startsWith("video/")
      ? "video"
      : body.contentType.startsWith("audio/")
        ? "audio"
        : body.contentType.startsWith("image/")
          ? "image"
          : "file";

    if (body.businessId) {
      await db.activityEntry.create({
        data: {
          businessId: body.businessId,
          type: "asset_upload",
          title: `${kind[0].toUpperCase() + kind.slice(1)} uploaded: ${body.title || body.filename}`,
          detail: body.description ?? null,
          status: "uploaded",
          metadata: {
            kind,
            key: body.key,
            publicUrl,
            contentType: body.contentType,
            size: body.size ?? null,
            filename: body.filename,
            uploadedBy: session.email ?? session.userId
          }
        }
      });
    }

    return addSecurityHeaders(
      NextResponse.json({
        key: body.key,
        publicUrl,
        kind
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
