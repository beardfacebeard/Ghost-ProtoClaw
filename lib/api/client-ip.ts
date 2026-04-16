import { NextRequest } from "next/server";

/**
 * Resolve the most trustworthy client IP available.
 *
 * We prefer headers set by the reverse proxy we actually sit behind
 * (`x-real-ip` on Railway / Fly / Vercel) and fall back to the LAST hop of
 * `x-forwarded-for`, which is the address seen by the nearest trusted proxy.
 *
 * The FIRST hop of X-Forwarded-For is client-controlled and trivially
 * spoofable — an attacker can send any value they want, and naive
 * `split(",")[0]` parsing will happily use it as the rate-limit key. Taking
 * the last hop means the only way to forge an IP is to control the edge
 * proxy, which is outside our threat model.
 *
 * Returns the string `"unknown"` when no proxy header is present, which
 * still buckets local dev / unproxied traffic under a single key rather
 * than crashing rate limiters that expect a string.
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);

    if (hops.length > 0) {
      return hops[hops.length - 1];
    }
  }

  return "unknown";
}
