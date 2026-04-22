import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { getForexOperationsSnapshot } from "@/lib/trading/operations-snapshot";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * Returns the unified Forex operations snapshot: broker equity for
 * OANDA + Tradovate, merged open positions, today's realized P&L,
 * last 10 forex_order entries, and pending approval counts.
 *
 * Designed for 30-second polling from the ForexOperationsPanel.
 * Broker calls fail silently with skipReason — local DB data always
 * returns so the panel stays useful even when brokers are down.
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

    const snapshot = await getForexOperationsSnapshot(params.id);
    return addSecurityHeaders(NextResponse.json({ snapshot }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
