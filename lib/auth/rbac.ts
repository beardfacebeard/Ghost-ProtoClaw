import { NextRequest } from "next/server";

import { forbidden } from "@/lib/errors";
import {
  SESSION_COOKIE_NAME,
  SessionPayload,
  verifySession
} from "@/lib/auth/session";

export const INTERNAL_AUTH_SESSION_HEADER = "x-internal-authenticated-session";

/**
 * Verify the session JWT directly from the request cookie.
 *
 * Unlike `getSessionFromHeaders` (which trusts a sentinel header set by the
 * middleware), this function always performs cryptographic JWT verification.
 * It is safe to call from any route regardless of whether the middleware
 * matcher covers that route's path — the session is verified or null.
 *
 * Prefer this function for all new route handlers.
 */
export async function getVerifiedSession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifySession(token);
}

export function isSuperAdmin(session: SessionPayload) {
  return session.role === "super_admin";
}

export function canAccessBusiness(
  session: SessionPayload,
  businessId: string
) {
  return isSuperAdmin(session) || session.businessIds.includes(businessId);
}

export function requireSuperAdmin(session: SessionPayload | null) {
  if (!session || !isSuperAdmin(session)) {
    throw forbidden("Super admin access required.");
  }
}

export function requireBusinessAccess(
  session: SessionPayload | null,
  businessId: string
) {
  if (!session || !canAccessBusiness(session, businessId)) {
    throw forbidden("You do not have access to this business.");
  }
}

/**
 * @deprecated Use `getVerifiedSession(request)` instead. This function trusts
 * middleware-set headers without verifying the JWT, which is fragile — it
 * silently trusts attacker-supplied headers if called from a route outside the
 * middleware matcher.
 */
export function getSessionFromHeaders(headers: Headers) {
  if (headers.get(INTERNAL_AUTH_SESSION_HEADER) !== "1") {
    return null;
  }

  const userId = headers.get("x-user-id");
  const email = headers.get("x-user-email");
  const role = headers.get("x-user-role");
  const organizationId = headers.get("x-organization-id");
  const businessIds = headers.get("x-business-ids");
  const planTier = headers.get("x-plan-tier");

  if (!userId || !email || !role || !businessIds || !planTier) {
    return null;
  }

  if (role !== "super_admin" && role !== "admin") {
    return null;
  }

  try {
    const parsedBusinessIds = JSON.parse(businessIds);
    if (!Array.isArray(parsedBusinessIds)) {
      return null;
    }

    return {
      userId,
      email,
      role,
      organizationId:
        organizationId && organizationId !== "null" ? organizationId : null,
      businessIds: parsedBusinessIds.filter(
        (value): value is string => typeof value === "string"
      ),
      planTier,
      iat: 0,
      exp: 0
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}
