import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { executeAgentChat, buildChatMessages } from "@/lib/llm/agent-chat";
import {
  createMessage,
  getConversationById,
  getConversationHistory,
  listMessages
} from "@/lib/repository/conversations";

const sendSchema = z.object({
  content: z.string().trim().min(1, "Message is required.").max(8000)
});

export const dynamic = "force-dynamic";

type RouteContext = { params: { conversationId: string } };

/** List messages in a conversation (paginated). */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    // Verify conversation access
    const conversation = await getConversationById(
      params.conversationId,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!conversation) {
      throw notFound("Conversation not found.");
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const before = url.searchParams.get("before") ?? undefined;

    const messages = await listMessages(params.conversationId, {
      limit,
      before
    });

    return addSecurityHeaders(NextResponse.json({ messages }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** Send a message and get the agent's response. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = sendSchema.parse(await request.json());

    // Load conversation with full agent + business data for LLM context
    const conversation = await getConversationById(
      params.conversationId,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!conversation) {
      throw notFound("Conversation not found.");
    }

    if (conversation.status === "completed") {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "This conversation has been completed.",
            hint: "Start a new conversation to continue chatting with this agent."
          },
          { status: 400 }
        )
      );
    }

    // Save user message to DB
    const userMessage = await createMessage({
      conversationId: params.conversationId,
      role: "user",
      content: body.content
    });

    // Load conversation history from DB for LLM context
    const history = await getConversationHistory(
      params.conversationId,
      50 // last 50 messages for context
    );

    // Remove the just-added user message from history (buildChatMessages adds it)
    const historyWithoutLast = history.slice(0, -1);

    // Build full messages array with system prompt + tools + history + new message
    const agent = conversation.agent as Record<string, unknown>;
    const business = conversation.business as Record<string, unknown>;
    const { messages, tools } = await buildChatMessages(
      agent,
      business,
      historyWithoutLast,
      body.content,
      session.organizationId,
      (agent.businessId as string) || null
    );

    // Execute chat with tool loop
    const result = await executeAgentChat({
      agent: conversation.agent as any,
      business: conversation.business as any,
      messages,
      organizationId: session.organizationId,
      endpoint: "agent_chat",
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

    // Save assistant response to DB
    const assistantMessage = await createMessage({
      conversationId: params.conversationId,
      role: "assistant",
      content: result.response,
      model: result.model,
      latencyMs: result.latencyMs,
      metadata: result.toolsUsed?.length
        ? { toolsUsed: result.toolsUsed }
        : undefined
    });

    return addSecurityHeaders(
      NextResponse.json({
        userMessage,
        assistantMessage,
        model: result.model,
        latencyMs: result.latencyMs,
        ...(result.toolsUsed?.length ? { toolsUsed: result.toolsUsed } : {}),
        ...(result.budgetWarning
          ? { budgetWarning: result.budgetWarning }
          : {})
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
