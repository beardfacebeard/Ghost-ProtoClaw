import { getSessionSecret } from "@/lib/auth/config";

export const CSRF_COOKIE_NAME = "gpc_csrf";

function hexToBytes(value: string) {
  if (!value || value.length % 2 !== 0) {
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
  const keyData = new TextEncoder().encode(getSessionSecret());
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(token)
  );

  return new Uint8Array(signature);
}

export async function validateCsrfAsync(token: string, cookieValue: string) {
  if (!token || !cookieValue) {
    return false;
  }

  try {
    const expected = await signCsrfTokenAsync(token);
    const actual = hexToBytes(cookieValue);
    return safeEqualBytes(expected, actual);
  } catch {
    return false;
  }
}
