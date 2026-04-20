import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { buildR2CorsPolicy, configureR2Cors } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

/**
 * Configure CORS on the user's R2 bucket so browser-direct uploads
 * from /admin/uploads and /admin/brand-assets pass the preflight
 * check. Safe to call repeatedly — PutBucketCors is idempotent.
 *
 * On success: returns { ok: true, appliedOrigins }.
 * On failure: returns { ok: false, code, message, manual } where
 *   manual contains the exact JSON the user can paste into the
 *   Cloudflare dashboard if their R2 API token lacks Admin Write.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const requestOrigin =
      request.headers.get("origin") ??
      request.headers.get("x-forwarded-host") ??
      null;
    const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const railwayHost =
      process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ??
      process.env.RAILWAY_STATIC_URL?.trim();
    const originsToAllow = Array.from(
      new Set(
        [
          requestOrigin,
          envOrigin,
          railwayHost ? `https://${railwayHost}` : null
        ].filter((value): value is string => Boolean(value))
      )
    );

    const result = await configureR2Cors({
      organizationId: session.organizationId,
      allowedOrigins: originsToAllow
    });

    if (result.ok) {
      return addSecurityHeaders(
        NextResponse.json({
          ok: true,
          appliedOrigins: result.appliedOrigins
        })
      );
    }

    return addSecurityHeaders(
      NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
          // Manual fallback — user pastes this JSON into R2 bucket →
          // Settings → CORS Policy when the API token lacks Admin
          // Write permission.
          manual: {
            rules: buildR2CorsPolicy(originsToAllow),
            instructions: [
              "Open Cloudflare dashboard → R2 → your bucket → Settings → CORS Policy.",
              "Paste the JSON shown below and save.",
              "Then retry the upload."
            ]
          }
        },
        { status: 200 }
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
