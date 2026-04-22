import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { runComplianceChecklist } from "@/lib/dealhawk/compliance";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * GET — run the Dealhawk pre-launch compliance checklist for this
 * business. Returns the structured report rendered by the Dashboard
 * Compliance panel (and the dealhawk_compliance_check agent tool).
 *
 * Cheap to run — pure DB lookups + a couple of counts. Safe to poll
 * from the dashboard at refresh time.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) {
      throw unauthorized();
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }
    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!business) {
      throw notFound("Business not found.");
    }
    const report = await runComplianceChecklist(params.id);
    return addSecurityHeaders(NextResponse.json({ report }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
