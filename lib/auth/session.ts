import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getSessionMaxAgeDays,
  getSessionSecret,
  isProduction
} from "@/lib/auth/config";

export const SESSION_COOKIE_NAME = "gpc_session";

const sessionPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: z.enum(["super_admin", "admin"]),
  organizationId: z.string().nullable(),
  businessIds: z.array(z.string()),
  planTier: z.string(),
  iat: z.number(),
  exp: z.number()
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

function getSessionMaxAgeSeconds() {
  return getSessionMaxAgeDays() * 24 * 60 * 60;
}

function getSigningKey() {
  return new TextEncoder().encode(getSessionSecret());
}

export async function createSession(
  payload: Omit<SessionPayload, "iat" | "exp">
) {
  const maxAgeSeconds = getSessionMaxAgeSeconds();

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(getSigningKey());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"]
    });

    return sessionPayloadSchema.parse(payload);
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    maxAge: getSessionMaxAgeSeconds(),
    path: "/"
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    maxAge: 0,
    path: "/"
  });
}

export async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifySession(token);
}
