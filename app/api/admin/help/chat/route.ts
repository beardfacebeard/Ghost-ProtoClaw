import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import {
  apiErrorResponse,
  badRequest,
  serverError,
  unauthorized,
} from "@/lib/errors";
import { directProviderCompletion } from "@/lib/llm/direct-provider";
import { resolveApiKey } from "@/lib/keys";
import { renderKnowledgeBase } from "@/lib/help/knowledge-base";

/**
 * POST /api/admin/help/chat
 *
 * A minimal Q&A endpoint that answers user questions about Ghost ProtoClaw
 * using the in-app Help knowledge base as grounding context. Wired to
 * Claude Opus 4.6 via OpenRouter so it inherits whichever OpenRouter key
 * the organization already has configured for the rest of the app.
 *
 * This is intentionally NOT the same as the full agent chat. There is no
 * persistence, no tool use, no business/agent context — just a stateless
 * "ask about the app" helper aimed at non-technical users.
 */

export const dynamic = "force-dynamic";

const HELP_MODEL = "anthropic/claude-opus-4-6";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8_000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

function buildSystemPrompt(): string {
  return [
    "You are the Help Assistant inside the Ghost ProtoClaw admin app.",
    "Ghost ProtoClaw is an AI business control panel used primarily by non-technical small-business owners, creators, and solo operators.",
    "",
    "Your job is to help users understand the app and get unstuck. Be warm, plain-spoken, and specific. Avoid jargon when you can; when a technical term is unavoidable, define it in one short sentence.",
    "",
    "Rules you must follow:",
    "1. Ground every answer in the knowledge base below. If the knowledge base does not cover the question, say so honestly — do not invent features, settings, or navigation paths.",
    "2. When pointing a user to a page in the app, use the exact path from the knowledge base (e.g. '/admin/agents'). Write it as plain text so they can click the link in the sidebar, not as a URL.",
    "3. Prefer short paragraphs and numbered steps over long prose. Non-technical users skim.",
    "4. Never recommend destructive actions (deleting, restoring a backup, force-redeploying) without explicitly warning what it will undo.",
    "5. If a user asks about billing, their account, or legal questions, tell them to contact the person who set up their deployment — you don't have access to that information.",
    "6. Do not offer to do things for the user that you cannot actually do (e.g. create workflows, send emails). You answer questions — users take actions themselves in the app.",
    "",
    "=== KNOWLEDGE BASE ===",
    "",
    renderKnowledgeBase(),
    "",
    "=== END KNOWLEDGE BASE ===",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = bodySchema.parse(await request.json());

    const last = body.messages[body.messages.length - 1];
    if (last.role !== "user") {
      throw badRequest("The last message must be from the user.");
    }

    // Always route through OpenRouter so the Help Assistant works with the
    // same single key the rest of the template ships with.
    const keyInfo = await resolveApiKey({
      provider: "openrouter",
      organizationId: session.organizationId,
    });

    if (!keyInfo?.apiKey) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error:
              "The Help Assistant needs an OpenRouter API key to run. Add one in Settings → AI Providers and try again.",
            code: "NO_API_KEY",
          },
          { status: 503 },
        ),
      );
    }

    const messages = [
      { role: "system" as const, content: buildSystemPrompt() },
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const result = await directProviderCompletion({
      messages,
      model: HELP_MODEL,
      apiKey: keyInfo.apiKey,
      provider: "openrouter",
      maxTokens: 1_200,
      timeoutMs: 60_000,
    });

    if (!result.success || !result.content) {
      throw serverError(result.error ?? "Help Assistant failed to respond.");
    }

    return addSecurityHeaders(
      NextResponse.json({
        content: result.content,
        model: result.model ?? HELP_MODEL,
        latencyMs: result.latencyMs,
      }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
