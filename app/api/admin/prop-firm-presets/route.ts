import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  listPresetsForJurisdiction,
  PROP_FIRM_PRESETS
} from "@/lib/trading/prop-firm-presets";

export const dynamic = "force-dynamic";

/**
 * Read-only endpoint: returns the curated prop-firm presets shipped in the
 * app. Supports optional ?jurisdiction=US filter — US operators see only
 * firms that accept them (Apex, Topstep, Custom), non-US see the full set
 * including FTMO / FundedNext.
 *
 * No DB hit — presets are TypeScript constants in
 * lib/trading/prop-firm-presets.ts.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const jurisdiction = request.nextUrl.searchParams.get("jurisdiction");
    const presets = jurisdiction
      ? listPresetsForJurisdiction(jurisdiction)
      : PROP_FIRM_PRESETS;

    return addSecurityHeaders(
      NextResponse.json({ presets })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
