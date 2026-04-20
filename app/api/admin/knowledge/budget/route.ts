import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { getKnowledgeTokenBudget } from "@/lib/repository/knowledge";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  businessId: z.string().trim().min(1)
});

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const query = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    if (session.role === "admin") {
      requireBusinessAccess(session, query.businessId);
    }

    const budget = await getKnowledgeTokenBudget(query.businessId);

    return addSecurityHeaders(NextResponse.json(budget));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
