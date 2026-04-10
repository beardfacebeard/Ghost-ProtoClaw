import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import {
  getMe,
  setWebhook,
  deleteWebhook,
  getWebhookInfo
} from "@/lib/telegram/client";
import { getDecryptedSecrets } from "@/lib/repository/integrations";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET: Check current Telegram bot status and webhook info. */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const integration = await db.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        key: "telegram",
        status: "connected"
      }
    });

    if (!integration) {
      return addSecurityHeaders(
        NextResponse.json({
          connected: false,
          hint: "Connect Telegram in Integrations first."
        })
      );
    }

    const secrets = await getDecryptedSecrets(
      integration.id,
      session.organizationId
    );
    const botToken = secrets.bot_token;

    if (!botToken) {
      return addSecurityHeaders(
        NextResponse.json({
          connected: false,
          hint: "Bot token is missing. Reconnect Telegram in Integrations."
        })
      );
    }

    const [meResult, webhookResult] = await Promise.all([
      getMe(botToken),
      getWebhookInfo(botToken)
    ]);

    return addSecurityHeaders(
      NextResponse.json({
        connected: true,
        bot: meResult.ok ? meResult.result : null,
        webhook: webhookResult.ok ? webhookResult.result : null
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * POST: Register the Telegram webhook.
 *
 * This tells Telegram to send all incoming messages to your
 * Ghost ProtoClaw instance. Call this after connecting the
 * Telegram integration.
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const integration = await db.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        key: "telegram",
        status: "connected"
      }
    });

    if (!integration) {
      throw badRequest(
        "Connect Telegram in Integrations first, then register the webhook."
      );
    }

    const secrets = await getDecryptedSecrets(
      integration.id,
      session.organizationId
    );
    const botToken = secrets.bot_token;

    if (!botToken) {
      throw badRequest("Bot token is missing from the Telegram integration.");
    }

    // Determine the webhook URL from the app URL
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : null;

    if (!appUrl) {
      throw badRequest(
        "Cannot determine app URL. Set NEXT_PUBLIC_APP_URL in your environment."
      );
    }

    // Generate a secret token for webhook verification
    const secretToken = randomBytes(32).toString("hex");
    const webhookUrl = `${appUrl}/api/webhooks/telegram`;

    // Register with Telegram
    const result = await setWebhook(botToken, webhookUrl, {
      secretToken,
      maxConnections: 40
    });

    if (!result.ok) {
      throw badRequest(
        `Telegram rejected the webhook: ${result.description || "Unknown error"}`
      );
    }

    // Store the secret token in integration config
    const existingConfig =
      integration.config &&
      typeof integration.config === "object" &&
      !Array.isArray(integration.config)
        ? (integration.config as Record<string, unknown>)
        : {};

    await db.integration.update({
      where: { id: integration.id },
      data: {
        config: {
          ...existingConfig,
          webhook_secret: secretToken,
          webhook_url: webhookUrl,
          webhook_registered_at: new Date().toISOString()
        }
      }
    });

    // Get bot info to confirm
    const meResult = await getMe(botToken);
    const botUsername = meResult.ok
      ? `@${meResult.result?.username}`
      : "your bot";

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        webhookUrl,
        botUsername,
        message: `Webhook registered! Message ${botUsername} on Telegram to start chatting with your agents.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** DELETE: Remove the Telegram webhook. */
export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const integration = await db.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        key: "telegram",
        status: "connected"
      }
    });

    if (!integration) {
      throw badRequest("No Telegram integration found.");
    }

    const secrets = await getDecryptedSecrets(
      integration.id,
      session.organizationId
    );
    const botToken = secrets.bot_token;

    if (botToken) {
      await deleteWebhook(botToken);
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true, message: "Webhook removed." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
