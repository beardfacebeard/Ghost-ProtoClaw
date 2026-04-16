import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

// Max file size: 25MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/** Map of upload field names to their corresponding database column */
const FIELD_TO_COLUMN: Record<string, string> = {
  inputAd: "inputAdUrl",
  aiVersion1: "aiVersion1Url",
  aiVersion2: "aiVersion2Url",
  aiVersion3: "aiVersion3Url",
  aiVersion4: "aiVersion4Url",
  aiVersion5: "aiVersion5Url",
  chosenFavorite: "chosenFavoriteUrl",
  editedImage1: "editedImage1Url",
  editedImage2: "editedImage2Url",
  finalImage: "finalImageUrl",
  video: "videoUrl",
  resized916: "resized916Url",
  resized11: "resized11Url",
  resized43: "resized43Url",
};

function getStorageDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

/** POST — Upload an image/video to a specific field on an ad-clone project */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    // Verify the project exists and belongs to this org
    const existing = await db.adCloneProject.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });
    if (!existing) throw notFound("Project not found.");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const field = formData.get("field") as string | null;

    if (!file) {
      return addSecurityHeaders(
        NextResponse.json({ error: "No file provided." }, { status: 400 })
      );
    }

    if (!field || !FIELD_TO_COLUMN[field]) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: `Invalid field. Must be one of: ${Object.keys(FIELD_TO_COLUMN).join(", ")}`,
          },
          { status: 400 }
        )
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

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: `File type "${file.type}" is not allowed. Must be an image or video.` },
          { status: 400 }
        )
      );
    }

    // Build storage path: uploads/{orgId}/{businessId}/ad-clone/{projectId}/{field}.{ext}
    const ext = file.name.split(".").pop() || "bin";
    const storageDir = getStorageDir();
    const relDir = join(
      session.organizationId,
      existing.businessId,
      "ad-clone",
      params.id
    );
    const fullDir = join(storageDir, relDir);
    await mkdir(fullDir, { recursive: true });

    const fileName = `${field}.${ext}`;
    const filePath = join(fullDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Build public URL
    const storageKey = `${relDir}/${fileName}`.replace(/\\/g, "/");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const url = `${baseUrl}/api/admin/brand-assets/file/${storageKey}`;

    // Update the corresponding field on the project
    const columnName = FIELD_TO_COLUMN[field];
    const project = await db.adCloneProject.update({
      where: { id: params.id },
      data: { [columnName]: url },
      include: { product: true, brand: true },
    });

    return addSecurityHeaders(
      NextResponse.json({ project }, { status: 200 })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
