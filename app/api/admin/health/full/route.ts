import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { runFullHealthCheck } from "@/lib/health/system-health";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const report = await runFullHealthCheck(session.organizationId, {
      businessIds: session.role === "admin" ? session.businessIds : undefined
    });

    const response = NextResponse.json(report);
    response.headers.set("Cache-Control", "no-store");

    return addSecurityHeaders(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
