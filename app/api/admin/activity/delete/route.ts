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
 *
 * All three row types are deletable. Deleting a pending/running ActionRun
 * is fine — any in-flight executor call finishes in memory and writes
 * back to a missing row, which the existing try/catch in the runner
 * absorbs. Deleting a message removes that single message from its
 * conversation thread (use the chat page's "Delete conversation" action
 * if you want the whole thread gone).
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
    const messageIds: string[] = [];

    for (const id of ids) {
      if (id.startsWith("activity:")) activityIds.push(id.slice(9));
      else if (id.startsWith("run:")) runIds.push(id.slice(4));
      else if (id.startsWith("msg:")) messageIds.push(id.slice(4));
    }

    // RBAC scope: admins only see/delete rows inside their assigned
    // businesses; superadmins see every business in the org.
    const businessScope =
      session.role === "admin" && session.businessIds
        ? { businessId: { in: session.businessIds } }
        : { business: { organizationId: session.organizationId } };

    let deletedActivity = 0;
    let deletedRuns = 0;
    let deletedMessages = 0;

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
      // Before deleting pending/running rows, decrement messageCount on
      // any associated conversation — not strictly required but keeps DB
      // counters honest.
      const result = await db.actionRun.deleteMany({
        where: {
          id: { in: runIds },
          ...businessScope
        }
      });
      deletedRuns = result.count;
    }

    if (messageIds.length > 0) {
      // Messages are scoped via their conversation's business; the cascade
      // on ConversationLog → Message means a direct deleteMany works here.
      // Adjust conversation counters after deletion so the chat sidebar
      // doesn't show stale message counts.
      const messages = await db.message.findMany({
        where: {
          id: { in: messageIds },
          conversation: businessScope
        },
        select: { id: true, conversationId: true }
      });
      const allowedIds = messages.map((m) => m.id);
      if (allowedIds.length > 0) {
        const byConversation = new Map<string, number>();
        for (const m of messages) {
          byConversation.set(
            m.conversationId,
            (byConversation.get(m.conversationId) ?? 0) + 1
          );
        }
        const result = await db.message.deleteMany({
          where: { id: { in: allowedIds } }
        });
        deletedMessages = result.count;
        // Best-effort counter updates; ignore any races.
        await Promise.all(
          Array.from(byConversation.entries()).map(([conversationId, count]) =>
            db.conversationLog
              .update({
                where: { id: conversationId },
                data: { messageCount: { decrement: count } }
              })
              .catch(() => null)
          )
        );
      }
    }

    const total = deletedActivity + deletedRuns + deletedMessages;
    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        deletedActivity,
        deletedRuns,
        deletedMessages,
        message: `Deleted ${total} event${total === 1 ? "" : "s"}.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
