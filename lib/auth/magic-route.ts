import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { buildSessionData, findAdminUserForMagic } from "@/lib/auth/admin-user";
import { getSessionSecret, isProduction } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/crypto";
import { setSessionCookie, createSession } from "@/lib/auth/session";
import { verifyMagicLink } from "@/lib/auth/magic-link";
import { db } from "@/lib/db";

export const MAGIC_SETUP_COOKIE_NAME = "gpc_magic_setup";

const setupCookieSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email(),
  type: z.enum(["invite", "reset"]),
  iat: z.number(),
  exp: z.number()
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters long."),
    confirmPassword: z.string().optional(),
    token: z.string().optional(),
    mode: z.enum(["invite", "reset"]).optional()
  })
  .refine(
    (value) =>
      typeof value.confirmPassword === "undefined" ||
      value.password === value.confirmPassword,
    {
      message: "Passwords do not match.",
      path: ["confirmPassword"]
    }
  );

function signingKey() {
  return new TextEncoder().encode(getSessionSecret());
}

async function createSetupCookie(payload: {
  userId?: string;
  email: string;
  type: "invite" | "reset";
}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(signingKey());
}

async function verifySetupCookie(token: string) {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"]
    });

    return setupCookieSchema.parse(payload);
  } catch {
    return null;
  }
}

function loginRedirectUrl(request: NextRequest, error = "invalid_link") {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return url;
}

function setupPasswordRedirectUrl(
  request: NextRequest,
  type: "invite" | "reset",
  error?: string
) {
  const url = new URL("/auth/setup-password", request.url);
  url.searchParams.set("mode", type);
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}

function setSetupCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: MAGIC_SETUP_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60
  });
}

function clearSetupCookie(response: NextResponse) {
  response.cookies.set({
    name: MAGIC_SETUP_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function handleMagicLinkGet(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const requestedType = request.nextUrl.searchParams.get("type");

  if (!token) {
    return addSecurityHeaders(
      NextResponse.redirect(loginRedirectUrl(request, "invalid_link"))
    );
  }

  const verification = await verifyMagicLink(token);

  if (!verification.valid || !verification.type || !verification.email) {
    return addSecurityHeaders(
      NextResponse.redirect(loginRedirectUrl(request, "invalid_link"))
    );
  }

  if (requestedType && requestedType !== verification.type) {
    return addSecurityHeaders(
      NextResponse.redirect(loginRedirectUrl(request, "invalid_link"))
    );
  }

  const user = await findAdminUserForMagic({
    userId: verification.userId,
    email: verification.email
  });

  if (!user) {
    return addSecurityHeaders(
      NextResponse.redirect(loginRedirectUrl(request, "invalid_link"))
    );
  }

  if (verification.type === "login") {
    if (user.status !== "active") {
      return addSecurityHeaders(
        NextResponse.redirect(loginRedirectUrl(request, "account_suspended"))
      );
    }

    const sessionToken = await createSession(buildSessionData(user));
    const response = NextResponse.redirect(new URL("/admin", request.url));
    setSessionCookie(response, sessionToken);

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
          eventType: "admin_magic_login",
          entityType: "admin_user",
          entityId: user.id,
          ipAddress:
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            null
        }
      })
    ]);

    return addSecurityHeaders(response);
  }

  const setupCookie = await createSetupCookie({
    userId: user.id,
    email: user.email,
    type: verification.type === "invite" ? "invite" : "reset"
  });

  const response = NextResponse.redirect(
    setupPasswordRedirectUrl(
      request,
      verification.type === "invite" ? "invite" : "reset"
    )
  );
  setSetupCookie(response, setupCookie);

  return addSecurityHeaders(response);
}

async function readPasswordPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return passwordSchema.parse(await request.json());
  }

  const formData = await request.formData();
  return passwordSchema.parse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    token: formData.get("token"),
    mode: formData.get("mode")
  });
}

export async function handleMagicLinkPost(request: NextRequest) {
  try {
    const parsed = await readPasswordPayload(request);
    const setupToken =
      parsed.token ?? request.cookies.get(MAGIC_SETUP_COOKIE_NAME)?.value;

    if (!setupToken) {
      return addSecurityHeaders(
        NextResponse.redirect(loginRedirectUrl(request, "invalid_link"))
      );
    }

    const setupPayload = await verifySetupCookie(setupToken);

    if (!setupPayload) {
      return addSecurityHeaders(
        NextResponse.redirect(loginRedirectUrl(request, "invalid_link"))
      );
    }

    const user = await findAdminUserForMagic({
      userId: setupPayload.userId,
      email: setupPayload.email
    });

    if (!user) {
      return addSecurityHeaders(
        NextResponse.redirect(loginRedirectUrl(request, "invalid_link"))
      );
    }

    const passwordHash = await hashPassword(parsed.password);
    const sessionToken = await createSession(buildSessionData(user));

    await db.$transaction([
      db.missionControlAdminUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: "active",
          lastLoginAt: new Date()
        }
      }),
      db.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          actorEmail: user.email,
          eventType:
            setupPayload.type === "invite"
              ? "admin_invite_accepted"
              : "admin_password_reset",
          entityType: "admin_user",
          entityId: user.id,
          ipAddress:
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            null
        }
      })
    ]);

    const response = NextResponse.redirect(new URL("/admin", request.url));
    clearSetupCookie(response);
    setSessionCookie(response, sessionToken);

    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Failed to complete magic-link password setup.", error);
    const fallbackMode =
      request.nextUrl.searchParams.get("mode") === "invite" ? "invite" : "reset";

    return addSecurityHeaders(
      NextResponse.redirect(
        setupPasswordRedirectUrl(request, fallbackMode, "invalid_password")
      )
    );
  }
}
