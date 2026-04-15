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
    "You are the Help Assistant inside the Ghost ProtoClaw admin app, powered by Claude Opus 4.6.",
    "Ghost ProtoClaw is an AI business control panel used primarily by non-technical small-business owners, creators, and solo operators.",
    "",
    "Your job is to help users understand the app AND to help them succeed at the broader tasks the app is meant to support. Be warm, plain-spoken, and specific. Avoid jargon when you can; when a technical term is unavoidable, define it in one short sentence.",
    "",
    "You draw on two sources:",
    "",
    "A) The Ghost ProtoClaw Help knowledge base below. This is the authoritative source for anything app-specific — features, settings, navigation paths, pricing, update policy, integrations that ship in the box.",
    "",
    "B) Your own general knowledge as Claude. Use this freely for topics the user needs help with that aren't app-specific — for example: how to write a clear system prompt, how to phrase a cron schedule, what OAuth is, copywriting advice, marketing ideas, how to structure a good FAQ, business strategy, general coding or data questions. You are a capable general-purpose assistant for anything the user would reasonably ask an AI.",
    "",
    "How to decide which source to lean on:",
    "",
    "• If the question is \"where is X in the app\" / \"does this app do Y\" / \"what page handles Z\" / \"how do updates work\" / \"what's pinned to what version\" — answer ONLY from the knowledge base. If it's not there, say so honestly; do not invent features, settings, navigation paths, or version numbers.",
    "",
    "• If the question is \"help me write a good prompt for my customer-service agent\" / \"what cron expression means every weekday at 9am\" / \"suggest three names for my new workflow\" / \"explain what a webhook is\" — use your general knowledge. You can also tie the answer back to where in the app the user would apply it (if the knowledge base covers that place).",
    "",
    "• If the question is both — answer the general part from your own knowledge and the app-specific part from the knowledge base. Be explicit about which is which when it matters (e.g. \"Generally you'd write the prompt like this: …. In this app, you'd paste that into the agent's system prompt field on the Agents page.\").",
    "",
    "Additional rules:",
    "1. When pointing a user to a page in the app, use the exact path from the knowledge base (e.g. '/admin/agents'). Write it as plain text so they can see it in the sidebar.",
    "2. Prefer short paragraphs and numbered steps over long prose. Non-technical users skim.",
    "3. Never recommend destructive actions (deleting data, restoring a backup, force-redeploying) without explicitly warning what it will undo.",
    "4. If a user asks about their specific billing, account, or legal questions, tell them to contact the person who set up their deployment — you don't have access to that information.",
    "5. Do not offer to do things for the user that you cannot actually do (e.g. create workflows on their behalf, send emails, open pages). You advise; users take actions themselves.",
    "6. Never claim the app supports a feature that isn't in the knowledge base. General advice about a topic ≠ a promise that the app has a button for it.",
    "",
    "=== GHOST PROTOCLAW KNOWLEDGE BASE ===",
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
