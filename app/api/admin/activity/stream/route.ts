import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  loadActivityStream,
  type ActivityEventKind,
  type StreamParams
} from "@/lib/activity/stream";

export const dynamic = "force-dynamic";

const VALID_KINDS: ActivityEventKind[] = [
  "workflow",
  "approval",
  "backup",
  "integration",
  "agent",
  "system",
  "action_run",
  "tool_call",
  "message"
];

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId") || undefined;
    const agentId = url.searchParams.get("agentId") || undefined;
    const kindRaw = url.searchParams.get("kind");
    const sinceRaw = url.searchParams.get("since");
    const limitRaw = url.searchParams.get("limit");

    const kind =
      kindRaw && VALID_KINDS.includes(kindRaw as ActivityEventKind)
        ? (kindRaw as ActivityEventKind)
        : undefined;

    const since = sinceRaw ? new Date(sinceRaw) : undefined;
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

    const params: StreamParams = {
      organizationId: session.organizationId,
      businessIds:
        session.role === "admin" ? session.businessIds : undefined,
      businessId,
      agentId,
      kind,
      since: since && !Number.isNaN(since.getTime()) ? since : undefined,
      limit: limit && !Number.isNaN(limit) ? limit : undefined
    };

    const events = await loadActivityStream(params);

    return addSecurityHeaders(
      NextResponse.json({
        events,
        serverTime: new Date().toISOString()
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
