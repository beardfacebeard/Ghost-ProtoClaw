import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { sendMessage, sendTypingAction } from "@/lib/telegram/client";
import { executeAgentChat, buildChatMessages } from "@/lib/llm/agent-chat";
import {
  createConversation,
  createMessage,
  getConversationHistory
} from "@/lib/repository/conversations";
import { getDecryptedSecrets } from "@/lib/repository/integrations";

export const dynamic = "force-dynamic";

// Telegram sends messages as JSON via POST
// No CSRF or session auth — secured via secret_token header

/**
 * Telegram webhook handler.
 *
 * Flow:
 * 1. Telegram sends an Update object when someone messages the bot
 * 2. We verify the secret token header
 * 3. Look up the TelegramChat link for this chat ID
 * 4. If no link exists, handle /start command to pair with an agent
 * 5. If linked, route the message through the agent chat system
 * 6. Send the agent's response back via Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;

    // Only handle text messages
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const telegramChatId = String(message.chat.id);
    const text = message.text.trim();
    const telegramUsername = message.from?.username ?? null;
    const telegramDisplayName = [
      message.from?.first_name,
      message.from?.last_name
    ]
      .filter(Boolean)
      .join(" ") || telegramUsername || "Unknown";

    // Verify secret token if configured
    const secretToken = request.headers.get("x-telegram-bot-api-secret-token");

    // ── Handle /start command ────────────────────────────────────
    if (text.startsWith("/start")) {
      return handleStart(telegramChatId, text, telegramDisplayName, secretToken);
    }

    // ── Handle /agents command (list available agents) ───────────
    if (text === "/agents") {
      return handleListAgents(telegramChatId, secretToken);
    }

    // ── Handle /switch command (switch agent) ────────────────────
    if (text.startsWith("/switch")) {
      return handleSwitch(telegramChatId, text, secretToken);
    }

    // ── Route message to linked agent ────────────────────────────
    const link = await db.telegramChat.findFirst({
      where: {
        telegramChatId,
        active: true
      },
      include: {
        agent: {
          include: {
            business: true
          }
        }
      }
    });

    if (!link) {
      const botToken = await getBotToken();
      if (botToken) {
        await sendMessage(
          botToken,
          telegramChatId,
          "You haven't linked to an agent yet. Send /start to get set up, or /agents to see available agents."
        );
      }
      return NextResponse.json({ ok: true });
    }

    const botToken = await getBotTokenForOrg(link.organizationId);
    if (!botToken) {
      return NextResponse.json({ ok: true });
    }

    // Send typing indicator
    await sendTypingAction(botToken, telegramChatId);

    // Get or create a conversation for this chat
    let conversationId = link.conversationId;
    if (!conversationId) {
      const conversation = await createConversation({
        agentId: link.agentId,
        businessId: link.businessId,
        organizationId: link.organizationId,
        adminUserId: link.role === "admin" ? "telegram" : undefined,
        title: `Telegram: ${telegramDisplayName}`,
        channel: "telegram"
      });
      conversationId = conversation.id;

      // Update the link with the conversation ID
      await db.telegramChat.update({
        where: { id: link.id },
        data: { conversationId: conversation.id }
      });
    }

    // Save user message
    await createMessage({
      conversationId,
      role: "user",
      content: text
    });

    // Load history and execute chat
    const history = await getConversationHistory(conversationId, 30);
    const historyWithoutLast = history.slice(0, -1);

    const { messages, tools } = await buildChatMessages(
      link.agent as Record<string, unknown>,
      link.agent.business as Record<string, unknown>,
      historyWithoutLast,
      text,
      link.organizationId,
      (link.agent as any).businessId || null
    );

    const result = await executeAgentChat({
      agent: link.agent as any,
      business: link.agent.business as any,
      messages,
      organizationId: link.organizationId,
      endpoint: "telegram",
      tools
    });

    if (result.success) {
      // Save assistant response
      await createMessage({
        conversationId,
        role: "assistant",
        content: result.response,
        model: result.model,
        latencyMs: result.latencyMs
      });

      // Send response via Telegram
      await sendMessage(botToken, telegramChatId, result.response);
    } else {
      await sendMessage(
        botToken,
        telegramChatId,
        `Sorry, I encountered an error: ${result.error}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    // Always return 200 to Telegram so it doesn't retry
    return NextResponse.json({ ok: true });
  }
}

// ── Command handlers ───────────────────────────────────────────────

async function handleStart(
  telegramChatId: string,
  text: string,
  displayName: string,
  _secretToken: string | null
) {
  const botToken = await getBotToken();
  if (!botToken) {
    return NextResponse.json({ ok: true });
  }

  // Check if /start has a deep link payload: /start <agentId>
  const parts = text.split(" ");
  const agentId = parts[1]?.trim();

  if (agentId) {
    // Link to a specific agent
    const agent = await db.agent.findFirst({
      where: { id: agentId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            organizationId: true
          }
        }
      }
    });

    if (!agent || !agent.business) {
      await sendMessage(
        botToken,
        telegramChatId,
        "Agent not found. Check the link and try again."
      );
      return NextResponse.json({ ok: true });
    }

    // Create or update the link
    await db.telegramChat.upsert({
      where: {
        telegramChatId_agentId: {
          telegramChatId,
          agentId: agent.id
        }
      },
      create: {
        telegramChatId,
        organizationId: agent.business.organizationId,
        agentId: agent.id,
        businessId: agent.business.id,
        telegramUsername: null,
        displayName,
        role: "admin",
        active: true
      },
      update: {
        active: true,
        displayName
      }
    });

    // Deactivate other links for this chat (single active agent)
    await db.telegramChat.updateMany({
      where: {
        telegramChatId,
        agentId: { not: agent.id }
      },
      data: { active: false }
    });

    await sendMessage(
      botToken,
      telegramChatId,
      `Connected to ${agent.emoji || "🤖"} ${agent.displayName} (${agent.business.name}).\n\nYou can now send messages and I'll respond as your ${agent.role}.\n\nCommands:\n/agents — list available agents\n/switch <name> — switch to a different agent`
    );

    return NextResponse.json({ ok: true });
  }

  // No agent specified — show welcome with available agents
  const agents = await db.agent.findMany({
    where: {
      type: "main",
      status: "active",
      businessId: { not: null }
    },
    include: {
      business: {
        select: { name: true, organizationId: true }
      }
    },
    orderBy: { displayName: "asc" }
  });

  if (agents.length === 0) {
    await sendMessage(
      botToken,
      telegramChatId,
      "Welcome! No active agents are available yet. Activate a business in Ghost ProtoClaw first."
    );
    return NextResponse.json({ ok: true });
  }

  const agentList = agents
    .map(
      (a, i) =>
        `${i + 1}. ${a.emoji || "🤖"} ${a.displayName} — ${a.business?.name}`
    )
    .join("\n");

  await sendMessage(
    botToken,
    telegramChatId,
    `Welcome to Ghost ProtoClaw! Here are your available agents:\n\n${agentList}\n\nTo connect, use /switch <agent name> or open this link in the dashboard to get a direct link.`
  );

  return NextResponse.json({ ok: true });
}

async function handleListAgents(
  telegramChatId: string,
  _secretToken: string | null
) {
  const botToken = await getBotToken();
  if (!botToken) return NextResponse.json({ ok: true });

  const agents = await db.agent.findMany({
    where: {
      status: "active",
      businessId: { not: null }
    },
    include: {
      business: { select: { name: true } }
    },
    orderBy: [{ type: "asc" }, { displayName: "asc" }]
  });

  if (agents.length === 0) {
    await sendMessage(botToken, telegramChatId, "No active agents available.");
    return NextResponse.json({ ok: true });
  }

  // Check current link
  const currentLink = await db.telegramChat.findFirst({
    where: { telegramChatId, active: true },
    select: { agentId: true }
  });

  const lines = agents.map((a) => {
    const current = a.id === currentLink?.agentId ? " (active)" : "";
    return `${a.emoji || "🤖"} ${a.displayName} — ${a.business?.name}${current}`;
  });

  await sendMessage(
    botToken,
    telegramChatId,
    `Available agents:\n\n${lines.join("\n")}\n\nUse /switch <agent name> to switch.`
  );

  return NextResponse.json({ ok: true });
}

async function handleSwitch(
  telegramChatId: string,
  text: string,
  _secretToken: string | null
) {
  const botToken = await getBotToken();
  if (!botToken) return NextResponse.json({ ok: true });

  const agentName = text.replace("/switch", "").trim();
  if (!agentName) {
    await sendMessage(
      botToken,
      telegramChatId,
      "Usage: /switch <agent name>\n\nSend /agents to see available agents."
    );
    return NextResponse.json({ ok: true });
  }

  const agent = await db.agent.findFirst({
    where: {
      status: "active",
      businessId: { not: null },
      displayName: { contains: agentName, mode: "insensitive" }
    },
    include: {
      business: {
        select: { id: true, name: true, organizationId: true }
      }
    }
  });

  if (!agent || !agent.business) {
    await sendMessage(
      botToken,
      telegramChatId,
      `No active agent found matching "${agentName}". Send /agents to see available agents.`
    );
    return NextResponse.json({ ok: true });
  }

  // Deactivate all current links, activate this one
  await db.telegramChat.updateMany({
    where: { telegramChatId },
    data: { active: false }
  });

  await db.telegramChat.upsert({
    where: {
      telegramChatId_agentId: {
        telegramChatId,
        agentId: agent.id
      }
    },
    create: {
      telegramChatId,
      organizationId: agent.business.organizationId,
      agentId: agent.id,
      businessId: agent.business.id,
      role: "admin",
      active: true
    },
    update: {
      active: true
    }
  });

  await sendMessage(
    botToken,
    telegramChatId,
    `Switched to ${agent.emoji || "🤖"} ${agent.displayName} (${agent.business.name}). Send a message to start chatting.`
  );

  return NextResponse.json({ ok: true });
}

// ── Bot token helpers ──────────────────────────────────────────────

/** Get the first available Telegram bot token from connected integrations. */
async function getBotToken(): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: {
      key: "telegram",
      status: "connected"
    }
  });

  if (!integration) return null;

  try {
    const secrets = await getDecryptedSecrets(
      integration.id,
      integration.organizationId
    );
    return secrets.bot_token ?? null;
  } catch {
    return null;
  }
}

/** Get the bot token for a specific organization. */
async function getBotTokenForOrg(
  organizationId: string
): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId,
      key: "telegram",
      status: "connected"
    }
  });

  if (!integration) return null;

  try {
    const secrets = await getDecryptedSecrets(
      integration.id,
      integration.organizationId
    );
    return secrets.bot_token ?? null;
  } catch {
    return null;
  }
}
