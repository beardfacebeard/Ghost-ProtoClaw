import { timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { decryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// ManyChat webhook for Facebook Messenger + Instagram DM events.
//
// Configure at: ManyChat → Dev Tools → External Requests → add request
// triggered by the events you want (e.g. "New Message", "Subscribed",
// "Tag Added"). Point the request URL at:
//   https://<host>/api/webhooks/manychat/<businessId>?secret=<random-secret>
//
// ManyChat's webhook signing isn't clearly documented as of April 2026, so
// we authenticate on a shared secret in the query string matched against
// the business's manychat Integration encrypted secret `webhook_secret`.
// The comparison is constant-time.

const MAX_BODY_BYTES = 256 * 1024;

function getEncryptionKey() {
  return process.env.ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function safeEqual(left: string, right: string) {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) return false;
  try {
    return timingSafeEqual(leftBuf, rightBuf);
  } catch {
    return false;
  }
}

async function getWebhookSecret(organizationId: string): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: { organizationId, key: "manychat" },
    select: { encryptedSecrets: true, config: true }
  });
  if (!integration) return null;

  const encKey = getEncryptionKey();
  if (encKey && integration.encryptedSecrets && typeof integration.encryptedSecrets === "object") {
    const encrypted = integration.encryptedSecrets as Record<string, unknown>;
    const secret = encrypted.webhook_secret;
    if (typeof secret === "string" && secret.length > 0) {
      try {
        return decryptSecret(secret, encKey);
      } catch {
        return null;
      }
    }
  }

  if (integration.config && typeof integration.config === "object" && !Array.isArray(integration.config)) {
    const configSecret = (integration.config as Record<string, unknown>).webhook_secret;
    if (typeof configSecret === "string" && configSecret.length > 0) {
      return configSecret;
    }
  }

  return null;
}

type RouteContext = {
  params: { businessId: string };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { businessId } = context.params;

  let rawBody: string;
  try {
    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.byteLength > MAX_BODY_BYTES) {
      return addSecurityHeaders(
        NextResponse.json({ error: "payload too large" }, { status: 413 })
      );
    }
    rawBody = buffer.toString("utf8");
  } catch {
    return addSecurityHeaders(
      NextResponse.json({ error: "invalid body" }, { status: 400 })
    );
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, organizationId: true }
  });
  if (!business) {
    return addSecurityHeaders(
      NextResponse.json({ error: "business not found" }, { status: 404 })
    );
  }

  const providedSecret = request.nextUrl.searchParams.get("secret") ?? "";
  const expectedSecret = await getWebhookSecret(business.organizationId);

  if (!expectedSecret) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "ManyChat webhook received (UNVERIFIED — secret not configured)",
        detail:
          "Add webhook_secret to the manychat Integration and include ?secret=<value> on the webhook URL in ManyChat Dev Tools.",
        status: "warning",
        metadata: toJsonValue({ provider: "manychat", rawBodyPreview: rawBody.slice(0, 500) })
      }
    });
    return addSecurityHeaders(NextResponse.json({ received: true, verified: false }));
  }

  if (!providedSecret || !safeEqual(providedSecret, expectedSecret)) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "ManyChat webhook rejected (bad shared secret)",
        detail:
          "URL ?secret=... did not match webhook_secret on the manychat Integration. Possible misconfigured URL.",
        status: "error",
        metadata: toJsonValue({ provider: "manychat", rawBodyPreview: rawBody.slice(0, 200) })
      }
    });
    return addSecurityHeaders(
      NextResponse.json({ error: "bad secret" }, { status: 401 })
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // non-JSON body — keep raw preview in metadata below
  }

  // ManyChat payload shape depends on what you configure in Dev Tools.
  // Common fields across events: subscriber_id, first_name, last_name, id,
  // text, event_type (set by you in the ManyChat External Request config).
  const eventType = String(payload.event_type || payload.type || "unknown");
  const subscriberId = String(
    (payload.subscriber_id as string | undefined) ||
      (payload.id as string | undefined) ||
      ""
  );
  const firstName = String(payload.first_name || "");
  const lastName = String(payload.last_name || "");
  const text = String(payload.text || payload.last_input_text || "");
  const channel = String(payload.channel || payload.last_interaction_channel || "fb");

  let title = `ManyChat: ${eventType}`;
  if (eventType === "new_message" || text) {
    const who = [firstName, lastName].filter(Boolean).join(" ") || subscriberId || "subscriber";
    title = `${channel === "instagram" ? "Instagram" : "Messenger"} DM from ${who}`;
  } else if (eventType === "subscribed") {
    title = `ManyChat: new subscriber ${[firstName, lastName].filter(Boolean).join(" ") || subscriberId}`;
  } else if (eventType === "tag_added") {
    title = `ManyChat: tag added to ${subscriberId}`;
  }

  await db.activityEntry.create({
    data: {
      businessId,
      type: "integration",
      title,
      detail: text ? text.slice(0, 500) : undefined,
      status: "info",
      metadata: toJsonValue({
        provider: "manychat",
        verified: true,
        eventType,
        subscriberId,
        firstName,
        lastName,
        channel,
        text,
        payload
      })
    }
  });

  return addSecurityHeaders(NextResponse.json({ received: true, verified: true }));
}
