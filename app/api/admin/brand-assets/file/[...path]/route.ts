import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

function getStorageDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
}

type RouteContext = { params: { path: string[] } };

/** Serve an uploaded file */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const filePath = params.path.join("/");

    // Security: ensure the file belongs to this org
    if (!filePath.startsWith(session.organizationId + "/")) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const fullPath = join(getStorageDir(), filePath);

    try {
      const buffer = await readFile(fullPath);
      const ext = filePath.split(".").pop()?.toLowerCase() || "";

      const mimeTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        csv: "text/csv",
        txt: "text/plain",
        md: "text/markdown",
        json: "application/json",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        mp4: "video/mp4",
        webm: "video/webm"
      };

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeTypes[ext] || "application/octet-stream",
          "Cache-Control": "private, max-age=3600"
        }
      });
    } catch {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
