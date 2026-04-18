import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import { getDecryptedSecrets } from "@/lib/repository/integrations";
import { sendMessage } from "@/lib/telegram/client";

export const dynamic = "force-dynamic";

type TargetResult = {
  chatId: string;
  label: string;
  delivered: boolean;
  error?: string;
};

/**
 * Send a diagnostic Telegram message that bypasses the agent layer entirely.
 *
 * This is the test the user needs when "the CEO said it sent a Telegram and
 * it didn't arrive." The chain of possible failures there is:
 *   1. Bot token unreadable / integration not actually connected
 *   2. No TelegramChat rows (user never /start'd the bot)
 *   3. Telegram API call failing (rate limit, invalid chat id, bot blocked)
 *   4. The agent never actually called the tool (hallucination)
 *
 * This endpoint isolates 1–3 from 4 by calling sendMessage directly. If this
 * works but the agent's "I sent it" doesn't, the agent is hallucinating —
 * go check the Pulse feed for an actual tool_call event.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const integration = await db.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        key: "telegram",
        status: "connected"
      }
    });

    if (!integration) {
      throw badRequest("Connect Telegram in Integrations first.");
    }

    const secrets = await getDecryptedSecrets(
      integration.id,
      session.organizationId
    );
    const botToken = secrets.bot_token;
    if (!botToken) {
      throw badRequest(
        "Bot token is missing. Reconnect Telegram in Integrations."
      );
    }

    // Collect every active TelegramChat row belonging to any business in
    // this org, plus the integration's default_chat_id if set. The goal is
    // to verify delivery to every place a real agent message could land.
    const chats = await db.telegramChat.findMany({
      where: {
        organizationId: session.organizationId,
        active: true
      },
      include: {
        agent: { select: { displayName: true, emoji: true } },
        business: { select: { name: true } }
      }
    });

    const config = (integration.config ?? {}) as Record<string, unknown>;
    const defaultChatId =
      typeof config.chat_id === "string" ? config.chat_id.trim() : "";

    const targets: Array<{ chatId: string; label: string }> = [];
    for (const row of chats) {
      if (!targets.some((t) => t.chatId === row.telegramChatId)) {
        const agentLabel = row.agent
          ? `${row.agent.emoji ?? "🤖"} ${row.agent.displayName}`
          : "agent";
        const businessLabel = row.business?.name ?? "business";
        targets.push({
          chatId: row.telegramChatId,
          label: `${agentLabel} (${businessLabel})`
        });
      }
    }
    if (defaultChatId && !targets.some((t) => t.chatId === defaultChatId)) {
      targets.push({
        chatId: defaultChatId,
        label: "Default chat id from integration config"
      });
    }

    if (targets.length === 0) {
      return addSecurityHeaders(
        NextResponse.json({
          ok: false,
          message:
            "No Telegram chats to deliver to. Nobody has paired with the bot via /start yet, and no Default Chat ID is set on the integration.",
          targets: []
        })
      );
    }

    const text =
      `🔧 Ghost ProtoClaw delivery test (${new Date().toLocaleTimeString()})\n\n` +
      `If you're seeing this, outbound Telegram is working. The CEO agent's ` +
      `"I sent you a Telegram" is a hallucination if this arrived and the ` +
      `agent message didn't — check the Pulse feed for a tool_call event to confirm.`;

    const results: TargetResult[] = [];
    for (const target of targets) {
      try {
        const res = await sendMessage(botToken, target.chatId, text);
        if (res?.ok) {
          results.push({ chatId: target.chatId, label: target.label, delivered: true });
        } else {
          results.push({
            chatId: target.chatId,
            label: target.label,
            delivered: false,
            error: res?.description ?? "Telegram API returned non-ok"
          });
        }
      } catch (err) {
        results.push({
          chatId: target.chatId,
          label: target.label,
          delivered: false,
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    const deliveredCount = results.filter((r) => r.delivered).length;

    return addSecurityHeaders(
      NextResponse.json({
        ok: deliveredCount > 0,
        deliveredCount,
        targetCount: results.length,
        results
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
