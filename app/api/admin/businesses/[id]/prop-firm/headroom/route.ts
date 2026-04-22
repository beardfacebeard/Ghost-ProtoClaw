import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { getPropFirmHeadroom } from "@/lib/trading/prop-firm-headroom";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * Computes and returns the current PropFirmProfile headroom for a business.
 * Returns null if no active profile — the UI renders a "attach a profile"
 * prompt in that case.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(_request);
    if (!session?.organizationId) {
      throw unauthorized();
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }

    const summary = await getPropFirmHeadroom(params.id);
    return addSecurityHeaders(NextResponse.json({ summary }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
