import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { executeAgentChat, buildChatMessages } from "@/lib/llm/agent-chat";
import {
  getMasterAgent,
  isMasterAgentEnabled
} from "@/lib/llm/master-agent";
import type { ChatMessage } from "@/lib/openclaw/client";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z.string().trim().min(1).max(8000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string()
      })
    )
    .max(100)
    .default([])
});

/**
 * Ephemeral chat turn with the master agent. Unlike business-scoped agents,
 * master agent conversations are not persisted — the client holds history
 * in component state and echoes it back with each turn. This avoids forcing
 * a schema change on ConversationLog.businessId for v1.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    if (!isMasterAgentEnabled()) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "Master agent is disabled.",
            hint: "Set MASTER_AGENT_ENABLED=true to enable this feature."
          },
          { status: 403 }
        )
      );
    }

    const master = await getMasterAgent(session.organizationId);
    if (!master) {
      throw notFound("No master agent exists for this organization.");
    }

    const body = schema.parse(await request.json());

    const { messages, tools } = await buildChatMessages(
      master as Record<string, unknown>,
      null,
      body.history,
      body.message,
      session.organizationId,
      null
    );

    const result = await executeAgentChat({
      agent: master as unknown as Parameters<
        typeof executeAgentChat
      >[0]["agent"],
      business: null,
      messages: messages as ChatMessage[],
      organizationId: session.organizationId,
      endpoint: "master_agent_chat",
      tools
    });

    if (!result.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: result.error, hint: result.hint },
          { status: result.statusCode }
        )
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        response: result.response,
        model: result.model,
        latencyMs: result.latencyMs,
        ...(result.toolsUsed?.length ? { toolsUsed: result.toolsUsed } : {})
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
