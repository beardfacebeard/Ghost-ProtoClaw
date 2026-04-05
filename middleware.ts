import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { CSRF_COOKIE_NAME, validateCsrfAsync } from "@/lib/auth/csrf-edge";
import { INTERNAL_AUTH_SESSION_HEADER } from "@/lib/auth/rbac";
import { getSessionFromRequest } from "@/lib/auth/session";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function unauthorizedResponse() {
  return addSecurityHeaders(
    NextResponse.json(
      {
        error: "Unauthorized",
        code: "UNAUTHORIZED"
      },
      { status: 401 }
    )
  );
}

function forbiddenResponse() {
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

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/api/admin/health") {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);

  if (!session) {
    if (pathname.startsWith("/api/admin/")) {
      return unauthorizedResponse();
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);

    return addSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (
    pathname.startsWith("/api/admin/") &&
    STATE_CHANGING_METHODS.has(request.method)
  ) {
    const csrfToken = request.headers.get("x-csrf-token") ?? "";
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? "";
    const validCsrf = await validateCsrfAsync(csrfToken, csrfCookie);

    if (!validCsrf) {
      return forbiddenResponse();
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-email", session.email);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-organization-id", session.organizationId ?? "null");
  requestHeaders.set("x-business-ids", JSON.stringify(session.businessIds));
  requestHeaders.set("x-plan-tier", session.planTier);
  requestHeaders.set(INTERNAL_AUTH_SESSION_HEADER, "1");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  return addSecurityHeaders(response);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
