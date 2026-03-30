import { forbidden } from "@/lib/errors";
import { SessionPayload } from "@/lib/auth/session";

export const INTERNAL_AUTH_SESSION_HEADER = "x-internal-authenticated-session";

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
