import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Pulse feed IDs are prefixed by source ("activity:<uuid>", "run:<uuid>",
 * "msg:<uuid>") so the delete endpoint can dispatch to the right table.
 * Messages are intentionally NOT deletable here — they're part of
 * conversation history and should only be removed by deleting the whole
 * conversation from the chat UI.
 */
const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500)
});

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const { ids } = bodySchema.parse(await request.json());

    const activityIds: string[] = [];
    const runIds: string[] = [];
    let refusedMessages = 0;

    for (const id of ids) {
      if (id.startsWith("activity:")) activityIds.push(id.slice(9));
      else if (id.startsWith("run:")) runIds.push(id.slice(4));
      else if (id.startsWith("msg:")) refusedMessages += 1;
    }

    // RBAC: only delete rows whose business belongs to the caller's org,
    // and for business-scoped admins, only rows inside their assigned
    // businesses. Superadmins see all businesses in the org.
    const businessScope =
      session.role === "admin" && session.businessIds
        ? { businessId: { in: session.businessIds } }
        : { business: { organizationId: session.organizationId } };

    let deletedActivity = 0;
    let deletedRuns = 0;

    if (activityIds.length > 0) {
      const result = await db.activityEntry.deleteMany({
        where: {
          id: { in: activityIds },
          ...businessScope
        }
      });
      deletedActivity = result.count;
    }

    if (runIds.length > 0) {
      const result = await db.actionRun.deleteMany({
        where: {
          id: { in: runIds },
          ...businessScope
        }
      });
      deletedRuns = result.count;
    }

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        deletedActivity,
        deletedRuns,
        refusedMessages,
        message:
          refusedMessages > 0
            ? `Deleted ${deletedActivity + deletedRuns} event(s). ${refusedMessages} message event(s) were skipped — delete the whole conversation from the chat page if you need those removed.`
            : `Deleted ${deletedActivity + deletedRuns} event(s).`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
