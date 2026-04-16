import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Max file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  // Images
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/gif": "image",
  "image/svg+xml": "image",
  "image/webp": "image",
  // Documents
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "text/plain": "document",
  "text/csv": "document",
  "text/markdown": "document",
  "application/json": "document",
  // Audio/Video
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "video/mp4": "video",
  "video/webm": "video"
};

function getFileType(mimeType: string): string {
  return ALLOWED_TYPES[mimeType] || "other";
}

function getStorageDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

/** GET — List brand assets for a business */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const category = url.searchParams.get("category");

    const where: Record<string, unknown> = {
      organizationId: session.organizationId
    };
    if (businessId) where.businessId = businessId;
    if (category) where.category = category;

    const assets = await db.brandAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return addSecurityHeaders(NextResponse.json({ assets }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** POST — Upload a brand asset */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const businessId = formData.get("businessId") as string | null;
    const description = formData.get("description") as string | null;
    const category = (formData.get("category") as string) || "general";

    if (!file) {
      return addSecurityHeaders(
        NextResponse.json({ error: "No file provided." }, { status: 400 })
      );
    }

    if (!businessId) {
      return addSecurityHeaders(
        NextResponse.json({ error: "businessId is required." }, { status: 400 })
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
          { status: 400 }
        )
      );
    }

    const fileType = getFileType(file.type);
    if (!ALLOWED_TYPES[file.type]) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: `File type "${file.type}" is not allowed.` },
          { status: 400 }
        )
      );
    }

    // Generate unique storage key
    const ext = file.name.split(".").pop() || "bin";
    const storageKey = `${session.organizationId}/${businessId}/${randomUUID()}.${ext}`;

    // Store to local filesystem (can be swapped for S3 later)
    const storageDir = getStorageDir();
    const fullDir = join(storageDir, session.organizationId, businessId);
    await mkdir(fullDir, { recursive: true });

    const filePath = join(storageDir, storageKey);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Build URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const url = `${baseUrl}/api/admin/brand-assets/file/${storageKey}`;

    // Save to DB
    const asset = await db.brandAsset.create({
      data: {
        organizationId: session.organizationId,
        businessId,
        fileName: file.name,
        fileType,
        mimeType: file.type,
        fileSize: file.size,
        storageKey,
        url,
        description: description || null,
        category,
        tags: [],
        uploadedBy: session.userId || null
      }
    });

    return addSecurityHeaders(
      NextResponse.json({ asset }, { status: 201 })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
