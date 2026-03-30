import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

import { getSessionSecret, isProduction } from "@/lib/auth/config";

export const OAUTH_STATE_COOKIE_NAME = "gpc_oauth_state";

export type OAuthProvider = "google" | "openrouter";

type OAuthStatePayload = {
  provider: OAuthProvider;
  state: string;
  organizationId: string;
  userId: string;
  email: string;
  codeVerifier?: string;
  iat: number;
  exp: number;
};

function getSigningKey() {
  return new TextEncoder().encode(getSessionSecret());
}

function base64UrlEncode(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateOAuthState() {
  return randomBytes(24).toString("hex");
}

export function generatePkcePair() {
  const verifier = base64UrlEncode(randomBytes(48));
  const challenge = base64UrlEncode(
    createHash("sha256").update(verifier).digest()
  );

  return {
    verifier,
    challenge,
    method: "S256" as const
  };
}

export async function createOAuthStateCookie(params: {
  provider: OAuthProvider;
  organizationId: string;
  userId: string;
  email: string;
  codeVerifier?: string;
}) {
  const state = generateOAuthState();
  const cookieValue = await new SignJWT({
    provider: params.provider,
    state,
    organizationId: params.organizationId,
    userId: params.userId,
    email: params.email,
    ...(params.codeVerifier ? { codeVerifier: params.codeVerifier } : {})
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSigningKey());

  return {
    state,
    cookieValue
  };
}

export async function verifyOAuthStateCookie(
  cookieValue: string,
  expectedState: string,
  provider: OAuthProvider
) {
  try {
    const { payload } = await jwtVerify(cookieValue, getSigningKey(), {
      algorithms: ["HS256"]
    });

    if (
      payload.provider !== provider ||
      payload.state !== expectedState ||
      typeof payload.organizationId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return payload as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function setOAuthStateCookie(response: NextResponse, value: string) {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60
  });
}

export function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export function getOAuthStateCookie(request: NextRequest) {
  return request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value ?? "";
}
