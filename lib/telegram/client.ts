/**
 * Telegram Bot API client.
 *
 * Thin wrapper around the Telegram HTTP API. No SDK needed —
 * the API is simple enough to call directly via fetch.
 */

const TELEGRAM_API = "https://api.telegram.org";

type TelegramResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  text?: string;
};

// ── Core request ───────────────────────────────────────────────────

async function telegramRequest<T>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramResponse<T>> {
  const url = `${TELEGRAM_API}/bot${botToken}/${method}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });

  return res.json() as Promise<TelegramResponse<T>>;
}

// ── Public API ─────────────────────────────────────────────────────

/** Validate the bot token and return the bot info. */
export async function getMe(botToken: string) {
  return telegramRequest<TelegramUser>(botToken, "getMe");
}

/** Send a text message to a chat. Supports Markdown. */
export async function sendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  options: { parseMode?: "Markdown" | "MarkdownV2" | "HTML" } = {}
) {
  // Telegram has a 4096 char limit per message. Split if needed.
  const chunks = splitMessage(text, 4000);
  const results: TelegramResponse<TelegramMessage>[] = [];

  for (const chunk of chunks) {
    const result = await telegramRequest<TelegramMessage>(
      botToken,
      "sendMessage",
      {
        chat_id: chatId,
        text: chunk,
        parse_mode: options.parseMode
      }
    );
    results.push(result);
  }

  return results[results.length - 1];
}

/** Send a "typing..." indicator to a chat. */
export async function sendTypingAction(
  botToken: string,
  chatId: string | number
) {
  return telegramRequest(botToken, "sendChatAction", {
    chat_id: chatId,
    action: "typing"
  });
}

/** Register a webhook URL with Telegram. */
export async function setWebhook(
  botToken: string,
  url: string,
  options: { secretToken?: string; maxConnections?: number } = {}
) {
  return telegramRequest(botToken, "setWebhook", {
    url,
    secret_token: options.secretToken,
    max_connections: options.maxConnections ?? 40,
    allowed_updates: ["message"]
  });
}

/** Remove the webhook. */
export async function deleteWebhook(botToken: string) {
  return telegramRequest(botToken, "deleteWebhook");
}

/** Get current webhook info. */
export async function getWebhookInfo(botToken: string) {
  return telegramRequest(botToken, "getWebhookInfo");
}

// ── Helpers ────────────────────────────────────────────────────────

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex < maxLength * 0.5) {
      // No good newline — split at a space
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex < maxLength * 0.3) {
      // No good space either — hard split
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
