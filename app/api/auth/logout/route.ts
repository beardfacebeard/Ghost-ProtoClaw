import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { CSRF_COOKIE_NAME, validateCsrf } from "@/lib/auth/csrf";
import { clearSessionCookie, getSessionFromRequest } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function invalidCsrfResponse() {
  return addSecurityHeaders(
    NextResponse.json(
      {
        error: "Invalid CSRF token",
        code: "FORBIDDEN"
      },
      { status: 403 }
    )
  );
}

export async function POST(request: NextRequest) {
  try {
    const csrfToken = request.headers.get("x-csrf-token") ?? "";
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? "";

    if (!validateCsrf(csrfToken, csrfCookie)) {
      return invalidCsrfResponse();
    }

    const session = await getSessionFromRequest(request);
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);

    if (session) {
      db.auditEvent
        .create({
          data: {
            organizationId: session.organizationId,
            actorUserId: session.userId,
            actorEmail: session.email,
            eventType: "admin_logout",
            entityType: "admin_user",
            entityId: session.userId,
            ipAddress: clientIp(request)
          }
        })
        .catch((error) => {
          console.error("Failed to record logout audit event.", error);
        });
    }

    return addSecurityHeaders(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
