import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for chat attachments

function getStorageDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

/** Upload a file to attach to a chat message */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return addSecurityHeaders(
        NextResponse.json({ error: "No file provided." }, { status: 400 })
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

    const ext = file.name.split(".").pop() || "bin";
    const fileId = randomUUID();
    const storageKey = `${session.organizationId}/chat/${fileId}.${ext}`;

    const storageDir = getStorageDir();
    const fullDir = join(storageDir, session.organizationId, "chat");
    await mkdir(fullDir, { recursive: true });

    const filePath = join(storageDir, storageKey);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const url = `${baseUrl}/api/admin/brand-assets/file/${storageKey}`;

    return addSecurityHeaders(
      NextResponse.json({
        attachment: {
          id: fileId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          url
        }
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
