import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireSuperAdmin } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  restoreFromBackup
} from "@/lib/repository/backups";

const bodySchema = z.object({
  confirm: z.literal(true)
});

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    requireSuperAdmin(session);
    bodySchema.parse(await request.json());

    const result = await restoreFromBackup(
      params.id,
      session.organizationId,
      session.userId
    );

    return addSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
