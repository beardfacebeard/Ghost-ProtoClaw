import { timingSafeEqual } from "node:crypto";

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
// No CSRF or session auth — secured via secret_token header that we compare
// against the value stored on the Telegram integration record when the
// webhook was registered (see app/api/admin/integrations/telegram/route.ts).

/**
 * Constant-time compare two short strings without leaking length via timing.
 */
function secretsMatch(provided: string, expected: string) {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Return the configured webhook secret for the given organization's Telegram
 * integration, or null when the integration is missing / hasn't completed
 * webhook registration.
 */
async function getTelegramWebhookSecret(
  organizationId: string
): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: {
      organizationId,
      key: "telegram"
    },
    select: {
      config: true
    }
  });

  if (!integration?.config || typeof integration.config !== "object") {
    return null;
  }

  const config = integration.config as Record<string, unknown>;
  const secret = config.webhook_secret;
  return typeof secret === "string" && secret.length > 0 ? secret : null;
}

/**
 * Find any organization whose Telegram integration webhook secret matches the
 * provided token. Used for the /start flow where no TelegramChat link exists
 * yet. Returns the matching organizationId, or null if no match.
 */
async function findOrganizationByTelegramSecret(
  providedToken: string
): Promise<string | null> {
  if (!providedToken) {
    return null;
  }

  const integrations = await db.integration.findMany({
    where: {
      key: "telegram"
    },
    select: {
      organizationId: true,
      config: true
    }
  });

  for (const integration of integrations) {
    if (!integration.config || typeof integration.config !== "object") {
      continue;
    }

    const config = integration.config as Record<string, unknown>;
    const storedSecret = config.webhook_secret;
    if (typeof storedSecret !== "string" || storedSecret.length === 0) {
      continue;
    }

    if (secretsMatch(providedToken, storedSecret)) {
      return integration.organizationId;
    }
  }

  return null;
}

/**
 * Telegram webhook handler.
 *
 * Flow:
 * 1. Telegram sends an Update object when someone messages the bot
 * 2. We verify the secret token header against the stored webhook_secret
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

    // Read and validate secret token. We enforce strictly: every inbound
    // update must carry a header whose value matches the webhook_secret of
    // some configured Telegram integration. If none matches we reject with
    // 401 — this closes the abuse vector where any party who learns a chat
    // ID could POST crafted updates to the webhook.
    const secretToken =
      request.headers.get("x-telegram-bot-api-secret-token") ?? "";

    // Try to resolve the organization this request belongs to. Two paths:
    //   1. A TelegramChat link already exists → verify against that org's
    //      stored webhook_secret.
    //   2. No link yet (likely /start) → search all Telegram integrations
    //      for one whose webhook_secret matches the provided token.
    // If neither path yields a match, the request is rejected.
    const existingLink = await db.telegramChat.findFirst({
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

    let verifiedOrganizationId: string | null = null;

    if (existingLink) {
      const expectedSecret = await getTelegramWebhookSecret(
        existingLink.organizationId
      );
      if (expectedSecret && secretsMatch(secretToken, expectedSecret)) {
        verifiedOrganizationId = existingLink.organizationId;
      }
    }

    // Fallback: if the existing-link secret didn't match (or no link yet),
    // search every telegram integration for a matching secret. This rescues
    // the scenario where a TelegramChat row points at an org whose stored
    // webhook_secret drifted out of sync with what Telegram is sending —
    // e.g. after a botched re-registration or a restored backup. Without
    // this fallback, every inbound message silently 401s and the user has
    // no way to recover except deleting and re-creating the TelegramChat
    // row by hand.
    if (!verifiedOrganizationId) {
      verifiedOrganizationId = await findOrganizationByTelegramSecret(
        secretToken
      );
    }

    if (!verifiedOrganizationId) {
      // Persist the 401 so the admin can see it in Pulse and knows to
      // re-register the webhook. Without this entry, the failure is only
      // visible in Telegram's "Last delivery error" field — which most
      // users won't think to check.
      try {
        await db.activityEntry.create({
          data: {
            businessId: null,
            type: "integration",
            title: "Telegram webhook rejected — 401 invalid secret",
            detail:
              "Telegram sent a webhook update whose secret_token header doesn't match any stored Telegram integration. Click Re-register Webhook in Settings → Integrations → Telegram to fix.",
            status: "error",
            metadata: {
              telegramChatId,
              hasExistingLink: existingLink != null,
              providedTokenLength: secretToken.length
            }
          }
        });
      } catch {
        /* best-effort */
      }
      return NextResponse.json(
        { ok: false, error: "invalid_secret" },
        { status: 401 }
      );
    }

    // ── Handle /start command ────────────────────────────────────
    if (text.startsWith("/start")) {
      return handleStart(
        telegramChatId,
        text,
        telegramDisplayName,
        verifiedOrganizationId
      );
    }

    // ── Handle /agents command (list available agents) ───────────
    if (text === "/agents") {
      return handleListAgents(telegramChatId, verifiedOrganizationId);
    }

    // ── Handle /switch command (switch agent) ────────────────────
    if (text.startsWith("/switch")) {
      return handleSwitch(telegramChatId, text, verifiedOrganizationId);
    }

    // ── Route message to linked agent ────────────────────────────
    const link = existingLink;

    // Quick-capture commands: /todo or /idea followed by free text.
    // Lets the user brain-dump from Telegram without triggering an
    // agent turn. Runs LLM auto-assign when OpenAI is configured.
    const todoMatch = text.match(/^\/(todo|idea)\b\s*([\s\S]*)$/i);
    if (todoMatch && link) {
      const capturedType = todoMatch[1].toLowerCase() === "idea" ? "idea" : "todo";
      const capturedText = (todoMatch[2] ?? "").trim();
      const botToken = await getBotTokenForOrg(link.organizationId);
      if (capturedText.length < 3) {
        if (botToken) {
          await sendMessage(
            botToken,
            telegramChatId,
            `Usage: /${capturedType} <what you want captured>\n\nExample: /${capturedType} Rewrite the homepage hero — CMO. Due Friday.`
          );
        }
        return NextResponse.json({ ok: true });
      }

      try {
        const lines = capturedText.split("\n");
        const rawTitle = lines[0].trim().slice(0, 240);
        const rawDescription = lines.slice(1).join("\n").trim() || null;

        // Best-effort LLM auto-assign. If OpenAI isn't configured, we
        // skip and save the raw text as-is.
        let merged = {
          title: rawTitle,
          description: rawDescription,
          priority: "medium" as "low" | "medium" | "high" | "urgent",
          type: capturedType as "todo" | "idea",
          agentId: null as string | null,
          tags: [] as string[],
          dueAt: null as string | null,
          recurringPattern: null as string | null
        };
        let rationale: string | null = null;
        try {
          const { autoAssignTodo } = await import(
            "@/lib/llm/todo-auto-assign"
          );
          const agentsForBusiness = await db.agent.findMany({
            where: {
              businessId: link.businessId,
              status: { not: "disabled" }
            },
            select: {
              id: true,
              displayName: true,
              role: true,
              purpose: true,
              type: true
            }
          });
          const auto = await autoAssignTodo({
            rawText: capturedText,
            organizationId: link.organizationId,
            agents: agentsForBusiness
          });
          if (auto.success) {
            const s = auto.suggestion;
            merged = {
              title: s.title || rawTitle,
              description: s.description ?? rawDescription,
              priority: s.priority,
              type: capturedType === "idea" ? "idea" : s.type,
              agentId: s.agentId,
              tags: s.tags,
              dueAt: s.dueAt,
              recurringPattern: s.recurringPattern
            };
            rationale = s.rationale;
          }
        } catch {
          /* non-fatal */
        }

        const { createTodo } = await import("@/lib/repository/todos");
        const todo = await createTodo({
          organizationId: link.organizationId,
          businessId: link.businessId,
          type: merged.type,
          title: merged.title,
          description: merged.description,
          priority: merged.priority,
          agentId: merged.agentId,
          dueAt: merged.dueAt,
          tags: merged.tags,
          recurringPattern: merged.recurringPattern,
          createdVia: "telegram",
          actorEmail: telegramDisplayName || telegramUsername || "telegram",
          metadata: rationale ? { autoAssignRationale: rationale } : null
        });

        await db.activityEntry.create({
          data: {
            businessId: link.businessId,
            type: "integration",
            title: `Telegram /${capturedType} captured`,
            detail: todo.title,
            status: "info",
            metadata: {
              todoId: todo.id,
              telegramChatId,
              capturedVia: "telegram"
            }
          }
        });

        if (botToken) {
          // Look up the suggested agent's display name so the ack is
          // readable ("Suggested: Ops Lead") rather than a raw id.
          let suggestedAgentName: string | null = null;
          if (merged.agentId) {
            const suggested = await db.agent.findUnique({
              where: { id: merged.agentId },
              select: { displayName: true }
            });
            suggestedAgentName = suggested?.displayName ?? null;
          }
          const ackLines = [
            capturedType === "idea"
              ? `💡 Idea captured: ${todo.title}`
              : `✅ Todo captured: ${todo.title}`,
            suggestedAgentName
              ? `Suggested agent: ${suggestedAgentName}`
              : "",
            merged.dueAt
              ? `Due: ${new Date(merged.dueAt).toLocaleString()}`
              : "",
            merged.tags.length > 0 ? `Tags: ${merged.tags.join(", ")}` : "",
            rationale ? `\n${rationale}` : "",
            `\nReview in /admin/todos.`
          ].filter(Boolean);
          await sendMessage(botToken, telegramChatId, ackLines.join("\n"));
        }
      } catch (err) {
        console.error("[telegram] /todo capture failed:", err);
        if (botToken) {
          await sendMessage(
            botToken,
            telegramChatId,
            "Couldn't capture that. Try again or add it manually in /admin/todos."
          );
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (!link) {
      // Log so the user can see WHY they aren't getting responses when
      // they message the bot — "no active link" is the #1 silent failure
      // mode after /switch to an agent that got disabled.
      try {
        await db.activityEntry.create({
          data: {
            businessId: null,
            type: "integration",
            title: "Telegram inbound — no active agent link",
            detail: `Chat ${telegramChatId} messaged the bot but has no active TelegramChat. User was told to /start.`,
            status: "warning",
            metadata: {
              telegramChatId,
              text: text.slice(0, 200),
              organizationId: verifiedOrganizationId
            }
          }
        });
      } catch {
        /* best-effort */
      }
      const botToken = await getBotTokenForOrg(verifiedOrganizationId);
      if (botToken) {
        await sendMessage(
          botToken,
          telegramChatId,
          "You haven't linked to an agent yet. Send /start to get set up, or /agents to see available agents."
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Inbound received successfully and routed — one visibility entry so
    // the user can watch inbound messages arriving in Pulse.
    try {
      await db.activityEntry.create({
        data: {
          businessId: link.businessId,
          type: "integration",
          title: "Telegram inbound received",
          detail: text.length > 200 ? text.slice(0, 200) + "…" : text,
          status: "info",
          metadata: {
            telegramChatId,
            agentId: link.agentId,
            username: telegramUsername,
            displayName: telegramDisplayName
          }
        }
      });
    } catch {
      /* best-effort */
    }

    const botToken = await getBotTokenForOrg(link.organizationId);
    if (!botToken) {
      try {
        await db.activityEntry.create({
          data: {
            businessId: link.businessId,
            type: "integration",
            title: "Telegram inbound — bot token unavailable",
            detail:
              "Message arrived but no bot_token is decryptable on the integration. Reconnect Telegram in Settings.",
            status: "error",
            metadata: { telegramChatId, agentId: link.agentId }
          }
        });
      } catch {
        /* best-effort */
      }
      return NextResponse.json({ ok: true });
    }

    try {
      await sendTypingAction(botToken, telegramChatId);
    } catch {
      /* non-critical */
    }

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
      await db.telegramChat.update({
        where: { id: link.id },
        data: { conversationId: conversation.id }
      });
    }

    await createMessage({
      conversationId,
      role: "user",
      content: text
    });

    // Build the chat messages. Wrapped so a thrown error (e.g. a memory
    // query blowing up, token overflow, etc) surfaces in Pulse and gets a
    // Telegram reply instead of dying silently in the outer catch.
    let messages: Awaited<ReturnType<typeof buildChatMessages>>["messages"];
    let tools: Awaited<ReturnType<typeof buildChatMessages>>["tools"];
    try {
      const history = await getConversationHistory(conversationId, 30);
      const historyWithoutLast = history.slice(0, -1);
      const built = await buildChatMessages(
        link.agent as Record<string, unknown>,
        link.agent.business as Record<string, unknown>,
        historyWithoutLast,
        text,
        link.organizationId,
        (link.agent as any).businessId || null
      );
      messages = built.messages;
      tools = built.tools;
    } catch (buildErr) {
      console.error("[telegram-webhook] buildChatMessages threw:", buildErr);
      const errMessage =
        buildErr instanceof Error ? buildErr.message : String(buildErr);
      try {
        await db.activityEntry.create({
          data: {
            businessId: link.businessId,
            type: "integration",
            title: "Telegram inbound — prompt build failed",
            detail: errMessage,
            status: "error",
            metadata: {
              telegramChatId,
              agentId: link.agentId,
              step: "buildChatMessages"
            }
          }
        });
      } catch {
        /* best-effort */
      }
      await sendMessage(
        botToken,
        telegramChatId,
        `Something went wrong building my reply: ${errMessage.slice(0, 200)}. Check your Pulse feed for details.`
      );
      return NextResponse.json({ ok: true });
    }

    // Strip send_telegram_message from the agent's toolset so it can't
    // replace its text reply with a tool call — the webhook itself sends
    // the text reply back.
    const telegramSafeTools = tools.filter(
      (t) => t.schema.function.name !== "send_telegram_message"
    );

    let result: Awaited<ReturnType<typeof executeAgentChat>>;
    try {
      result = await executeAgentChat({
        agent: link.agent as any,
        business: link.agent.business as any,
        messages,
        organizationId: link.organizationId,
        endpoint: "telegram",
        tools: telegramSafeTools,
        conversationId
      });
    } catch (execErr) {
      console.error("[telegram-webhook] executeAgentChat threw:", execErr);
      const errMessage =
        execErr instanceof Error ? execErr.message : String(execErr);
      try {
        await db.activityEntry.create({
          data: {
            businessId: link.businessId,
            type: "integration",
            title: "Telegram inbound — agent execution threw",
            detail: errMessage,
            status: "error",
            metadata: {
              telegramChatId,
              agentId: link.agentId,
              step: "executeAgentChat"
            }
          }
        });
      } catch {
        /* best-effort */
      }
      await sendMessage(
        botToken,
        telegramChatId,
        `My LLM call hit an error: ${errMessage.slice(0, 200)}. Check the Pulse feed.`
      );
      return NextResponse.json({ ok: true });
    }

    if (result.success) {
      // Guard against empty assistant turns — if the agent produced no text
      // (e.g. it only called tools, or the response got trimmed to ""), we
      // would silently call Telegram's sendMessage with an empty string
      // which the API rejects. That's the "bot reads my message but never
      // replies" symptom. Fall back to a concrete message and log the
      // incident to ActivityEntry so it shows in Pulse.
      const safeResponse =
        result.response && result.response.trim().length > 0
          ? result.response
          : "(The agent finished its turn without producing a text reply. This usually means the model called tools but didn't say anything. Try rephrasing or ask it to respond.)";

      await createMessage({
        conversationId,
        role: "assistant",
        content: safeResponse,
        model: result.model,
        latencyMs: result.latencyMs
      });

      const send = await sendMessage(botToken, telegramChatId, safeResponse);
      if (!send?.ok) {
        console.error(
          "[telegram-webhook] sendMessage failed:",
          send?.description
        );
        await db.activityEntry.create({
          data: {
            businessId: link.businessId,
            type: "integration",
            title: "Telegram delivery failed",
            detail:
              send?.description ??
              "sendMessage returned non-ok status with no description.",
            status: "error",
            metadata: {
              telegramChatId,
              agentId: link.agentId,
              via: "webhook_reply"
            }
          }
        });
      } else if (!result.response || result.response.trim().length === 0) {
        // We replied, but with the placeholder — flag it.
        await db.activityEntry.create({
          data: {
            businessId: link.businessId,
            type: "integration",
            title: "Telegram reply had no agent text",
            detail:
              "Agent call succeeded but result.response was empty. Sent placeholder so the user wasn't left hanging.",
            status: "warning",
            metadata: {
              telegramChatId,
              agentId: link.agentId,
              toolsUsed: result.toolsUsed ?? []
            }
          }
        });
      }
    } else {
      console.error(
        "[telegram-webhook] executeAgentChat failed:",
        result.error
      );
      await db.activityEntry.create({
        data: {
          businessId: link.businessId,
          type: "integration",
          title: "Telegram agent run failed",
          detail: result.error,
          status: "error",
          metadata: {
            telegramChatId,
            agentId: link.agentId,
            statusCode: result.statusCode
          }
        }
      });
      await sendMessage(
        botToken,
        telegramChatId,
        `Sorry, I encountered an error: ${result.error}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    // Best-effort: persist the failure to Pulse so the user can see it. We
    // may not have enough context to know which business this belonged to,
    // so the entry is scoped to null business and tagged for operator
    // attention.
    try {
      const errMessage =
        error instanceof Error ? error.message : String(error);
      await db.activityEntry.create({
        data: {
          businessId: null,
          type: "integration",
          title: "Telegram webhook outer catch",
          detail: errMessage,
          status: "error",
          metadata: {
            step: "outer_catch",
            stack:
              error instanceof Error
                ? error.stack?.slice(0, 1000) ?? null
                : null
          }
        }
      });
    } catch {
      /* best-effort */
    }
    // Always return 200 to Telegram so it doesn't retry
    return NextResponse.json({ ok: true });
  }
}

// ── Command handlers ───────────────────────────────────────────────

async function handleStart(
  telegramChatId: string,
  text: string,
  displayName: string,
  organizationId: string
) {
  const botToken = await getBotTokenForOrg(organizationId);
  if (!botToken) {
    return NextResponse.json({ ok: true });
  }

  // Check if /start has a deep link payload: /start <agentId>
  const parts = text.split(" ");
  const agentId = parts[1]?.trim();

  if (agentId) {
    // Link to a specific agent — scoped to the verified organization so an
    // attacker who somehow obtains a valid webhook secret cannot pair with
    // agents in a different org.
    const agent = await db.agent.findFirst({
      where: {
        id: agentId,
        OR: [
          { business: { organizationId } },
          { type: "master", organizationId }
        ]
      },
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

    if (!agent) {
      await sendMessage(
        botToken,
        telegramChatId,
        "Agent not found. Check the link and try again."
      );
      return NextResponse.json({ ok: true });
    }

    if (agent.type === "master") {
      await sendMessage(
        botToken,
        telegramChatId,
        `🛰️ ${agent.displayName} is the organization-wide master agent. Telegram chat with the master agent isn't available yet — open Mission Control in the web dashboard to chat with them. Use /agents to list CEO agents you can pair with here.`
      );
      return NextResponse.json({ ok: true });
    }

    if (!agent.business) {
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

  // No agent specified — show welcome with available agents, scoped to the
  // verified organization. Includes main (per-business CEO) agents and the
  // master agent (if one is configured for this org).
  const agents = await db.agent.findMany({
    where: {
      status: "active",
      OR: [
        {
          type: "main",
          businessId: { not: null },
          business: { organizationId }
        },
        {
          type: "master",
          organizationId
        }
      ]
    },
    include: {
      business: {
        select: { name: true, organizationId: true }
      }
    },
    orderBy: [{ type: "asc" }, { displayName: "asc" }]
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
    .map((a, i) => {
      const scope =
        a.type === "master" ? "organization-wide" : (a.business?.name ?? "unknown");
      return `${i + 1}. ${a.emoji || "🤖"} ${a.displayName} — ${scope}`;
    })
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
  organizationId: string
) {
  const botToken = await getBotTokenForOrg(organizationId);
  if (!botToken) return NextResponse.json({ ok: true });

  const agents = await db.agent.findMany({
    where: {
      status: "active",
      OR: [
        {
          businessId: { not: null },
          business: { organizationId }
        },
        {
          type: "master",
          organizationId
        }
      ]
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
    const scope =
      a.type === "master" ? "organization-wide" : (a.business?.name ?? "unknown");
    return `${a.emoji || "🤖"} ${a.displayName} — ${scope}${current}`;
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
  organizationId: string
) {
  const botToken = await getBotTokenForOrg(organizationId);
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
      displayName: { contains: agentName, mode: "insensitive" },
      OR: [
        {
          businessId: { not: null },
          business: { organizationId }
        },
        { type: "master", organizationId }
      ]
    },
    include: {
      business: {
        select: { id: true, name: true, organizationId: true }
      }
    }
  });

  if (!agent) {
    await sendMessage(
      botToken,
      telegramChatId,
      `No active agent found matching "${agentName}". Send /agents to see available agents.`
    );
    return NextResponse.json({ ok: true });
  }

  if (agent.type === "master") {
    await sendMessage(
      botToken,
      telegramChatId,
      `🛰️ ${agent.displayName} is the organization-wide master agent. Telegram chat with the master agent isn't available yet — open Mission Control in the web dashboard to chat with them.`
    );
    return NextResponse.json({ ok: true });
  }

  if (!agent.business) {
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
