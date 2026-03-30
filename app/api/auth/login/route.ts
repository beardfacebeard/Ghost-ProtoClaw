import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { loginRateLimiter } from "@/lib/api/rate-limit";
import { buildSessionData, findAdminUserByEmail } from "@/lib/auth/admin-user";
import { CSRF_COOKIE_NAME, validateCsrf } from "@/lib/auth/csrf";
import { verifyPassword } from "@/lib/auth/crypto";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  csrfToken: z.string().optional()
});

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function invalidCredentialsResponse() {
  return addSecurityHeaders(
    NextResponse.json(
      {
        error: "Invalid email or password.",
        code: "UNAUTHORIZED"
      },
      { status: 401 }
    )
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const csrfToken = request.headers.get("x-csrf-token") ?? body.csrfToken ?? "";
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? "";

    if (!validateCsrf(csrfToken, csrfCookie)) {
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

    const ipAddress = clientIp(request);
    const rateLimit = loginRateLimiter.check(ipAddress);

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: "Too many login attempts. Try again later.",
          code: "RATE_LIMITED"
        },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(rateLimit.retryAfter ?? 60));

      return addSecurityHeaders(response);
    }

    const user = await findAdminUserByEmail(body.email);

    if (!user || !user.passwordHash) {
      loginRateLimiter.increment(ipAddress);
      return invalidCredentialsResponse();
    }

    const validPassword = await verifyPassword(body.password, user.passwordHash);

    if (!validPassword) {
      loginRateLimiter.increment(ipAddress);
      return invalidCredentialsResponse();
    }

    if (user.status !== "active") {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "Account suspended. Contact your administrator.",
            code: "FORBIDDEN"
          },
          { status: 403 }
        )
      );
    }

    const sessionToken = await createSession(buildSessionData(user));

    await db.$transaction([
      db.missionControlAdminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      }),
      db.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          actorEmail: user.email,
          eventType: "admin_login",
          entityType: "admin_user",
          entityId: user.id,
          ipAddress
        }
      })
    ]);

    loginRateLimiter.reset(ipAddress);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      }
    });

    setSessionCookie(response, sessionToken);

    return addSecurityHeaders(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
