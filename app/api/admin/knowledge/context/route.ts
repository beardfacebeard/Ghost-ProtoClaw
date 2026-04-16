import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  buildKnowledgeContext,
  getKnowledgeSummary
} from "@/lib/repository/knowledge";

const querySchema = z.object({
  businessId: z.string().trim().min(1)
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (session.role === "admin") {
      requireBusinessAccess(session, query.businessId);
    }

    const [context, summary] = await Promise.all([
      buildKnowledgeContext(query.businessId),
      getKnowledgeSummary(query.businessId)
    ]);

    return addSecurityHeaders(
      NextResponse.json({
        context,
        itemCount: summary.enabledItems,
        tokenEstimate: summary.totalTokens
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
