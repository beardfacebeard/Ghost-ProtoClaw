import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getSessionSecret, isProduction } from "@/lib/auth/config";
import { generateCsrfToken } from "@/lib/auth/crypto";

export const CSRF_COOKIE_NAME = "gpc_csrf";

function csrfSecret() {
  return getSessionSecret();
}

function signCsrfToken(token: string) {
  return createHmac("sha256", csrfSecret()).update(token).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  try {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

export function generateCsrfPair() {
  const token = generateCsrfToken();

  return {
    token,
    cookie: signCsrfToken(token)
  };
}

export function validateCsrf(token: string, cookieValue: string) {
  if (!token || !cookieValue) {
    return false;
  }

  return safeEqualHex(signCsrfToken(token), cookieValue);
}

function hexToBytes(value: string) {
  if (value.length % 2 !== 0) {
    throw new Error("Invalid hex value.");
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  return bytes;
}

function safeEqualBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

async function signCsrfTokenAsync(token: string) {
  const secret = new TextEncoder().encode(csrfSecret());
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(token)
  );

  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function validateCsrfAsync(token: string, cookieValue: string) {
  if (!token || !cookieValue) {
    return false;
  }

  try {
    const expected = await signCsrfTokenAsync(token);
    return safeEqualBytes(hexToBytes(expected), hexToBytes(cookieValue));
  } catch {
    return false;
  }
}

export function setCsrfCookie(response: NextResponse, cookieValue: string) {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: cookieValue,
    httpOnly: false,
    secure: isProduction(),
    sameSite: "strict",
    path: "/"
  });
}
