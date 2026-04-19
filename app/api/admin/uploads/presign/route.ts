import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  apiErrorResponse,
  badRequest,
  unauthorized
} from "@/lib/errors";
import {
  buildUploadKey,
  createPresignedUploadUrl,
  isR2Configured
} from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().nonnegative().optional(),
  folder: z.string().trim().max(80).optional(),
  businessId: z.string().trim().min(1).optional()
});

// 2 GB hard cap for presigned uploads. R2 itself handles up to 5 TB via
// multipart but we don't want to hand out unlimited presigned URLs.
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

const ALLOWED_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf"
];

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    if (!isR2Configured()) {
      throw badRequest(
        "Cloudflare R2 is not configured. Ask an admin to set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET on Railway."
      );
    }

    const body = bodySchema.parse(await request.json());

    if (body.size !== undefined && body.size > MAX_BYTES) {
      throw badRequest(
        `File too large (${Math.round(body.size / (1024 * 1024))} MB). Max ${
          MAX_BYTES / (1024 * 1024 * 1024)
        } GB per upload.`
      );
    }

    if (!ALLOWED_PREFIXES.some((prefix) => body.contentType.startsWith(prefix))) {
      throw badRequest(
        "Content type not allowed. Must be an image, video, audio, or PDF."
      );
    }

    if (body.businessId && session.role === "admin") {
      requireBusinessAccess(session, body.businessId);
    }

    const key = buildUploadKey({
      organizationId: session.organizationId,
      businessId: body.businessId,
      folder: body.folder ?? "uploads",
      filename: body.filename
    });

    const uploadUrl = await createPresignedUploadUrl({
      key,
      contentType: body.contentType,
      expiresSeconds: 600
    });

    return addSecurityHeaders(
      NextResponse.json({
        uploadUrl,
        key,
        method: "PUT",
        headers: {
          "Content-Type": body.contentType
        },
        expiresInSeconds: 600
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
