import { createHmac, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { decryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const dynamic = "force-dynamic";

// Meta WhatsApp Cloud API webhook.
//
// Configure at: Meta App dashboard → WhatsApp → Configuration → Webhook.
// URL:      https://<host>/api/webhooks/whatsapp/<businessId>
// Verify token: set on the whatsapp_cloud_mcp integration as config.verify_token
//               (plaintext — Meta sends it back on initial GET verification)
// App secret:   set on the integration as encrypted secret `app_secret` —
//               used to verify POST body HMAC-SHA256 signature in the
//               X-Hub-Signature-256 header.

const MAX_BODY_BYTES = 256 * 1024;

function getEncryptionKey() {
  return process.env.ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY;
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

async function getWhatsappVerifyToken(organizationId: string): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: { organizationId, key: "whatsapp_cloud" },
    select: { config: true }
  });
  if (!integration?.config || typeof integration.config !== "object" || Array.isArray(integration.config)) {
    return null;
  }
  const token = (integration.config as Record<string, unknown>).verify_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

async function getWhatsappAppSecret(organizationId: string): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: { organizationId, key: "whatsapp_cloud" },
    select: { encryptedSecrets: true }
  });
  if (!integration?.encryptedSecrets) return null;
  const encKey = getEncryptionKey();
  if (!encKey) return null;
  const encrypted = integration.encryptedSecrets as Record<string, unknown>;
  const appSecret = encrypted.app_secret;
  if (typeof appSecret !== "string" || !appSecret) return null;
  try {
    return decryptSecret(appSecret, encKey);
  } catch {
    return null;
  }
}

type RouteContext = {
  params: { businessId: string };
};

/**
 * GET is Meta's one-time webhook verification: they hit the URL with
 * hub.mode=subscribe and hub.verify_token. We echo hub.challenge only
 * when the token matches the value on the integration.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { businessId } = context.params;
  const url = request.nextUrl;
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return addSecurityHeaders(
      NextResponse.json({ error: "invalid verify request" }, { status: 400 })
    );
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { organizationId: true }
  });
  if (!business) {
    return addSecurityHeaders(
      NextResponse.json({ error: "business not found" }, { status: 404 })
    );
  }

  const expected = await getWhatsappVerifyToken(business.organizationId);
  if (!expected || !safeEqual(token, expected)) {
    return addSecurityHeaders(
      NextResponse.json({ error: "verify token mismatch" }, { status: 403 })
    );
  }

  return new NextResponse(challenge, { status: 200 });
}

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

  const appSecret = await getWhatsappAppSecret(business.organizationId);
  const signatureHeader = request.headers.get("x-hub-signature-256");
  let verified = false;
  if (appSecret && signatureHeader) {
    const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const provided = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice(7)
      : signatureHeader;
    verified = safeEqual(provided, expected);
  }

  if (!appSecret) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "WhatsApp webhook received (UNVERIFIED — app_secret not configured)",
        detail:
          "Add app_secret to the whatsapp_cloud Integration to enable Meta signature verification.",
        status: "warning",
        metadata: { provider: "whatsapp_cloud", rawBodyPreview: rawBody.slice(0, 500) }
      }
    });
    return addSecurityHeaders(NextResponse.json({ received: true, verified: false }));
  }

  if (!verified) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "WhatsApp webhook rejected (bad signature)",
        detail: "X-Hub-Signature-256 did not match HMAC of app_secret over raw body.",
        status: "error",
        metadata: { provider: "whatsapp_cloud", rawBodyPreview: rawBody.slice(0, 200) }
      }
    });
    return addSecurityHeaders(
      NextResponse.json({ error: "bad signature" }, { status: 401 })
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // non-JSON body — keep raw
  }

  // Meta webhook shape: { object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [...], statuses: [...] } }] }] }
  // Fan out one ActivityEntry per inbound message for operator visibility.
  type WaChange = {
    value?: {
      messages?: Array<{
        from?: string;
        id?: string;
        timestamp?: string;
        type?: string;
        text?: { body?: string };
      }>;
      statuses?: Array<{
        id?: string;
        status?: string;
        recipient_id?: string;
      }>;
    };
  };
  type WaEntry = { id?: string; changes?: WaChange[] };
  const entries = (payload.entry as WaEntry[] | undefined) || [];

  let inboundCount = 0;
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages ?? [];
      for (const msg of messages) {
        inboundCount++;
        const body = msg.text?.body ?? `[${msg.type ?? "non-text"}]`;
        await db.activityEntry.create({
          data: {
            businessId,
            type: "integration",
            title: `WhatsApp inbound from ${msg.from ?? "unknown"}`,
            detail: String(body).slice(0, 500),
            status: "info",
            metadata: toJsonValue({
              provider: "whatsapp_cloud",
              verified: true,
              messageId: msg.id,
              from: msg.from,
              timestamp: msg.timestamp,
              messageType: msg.type,
              body
            })
          }
        });
      }
    }
  }

  if (inboundCount === 0) {
    // Non-message payload (status update, template update, etc.) — still log for visibility.
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "WhatsApp webhook event (non-message)",
        detail: "Status or metadata update (see payload).",
        status: "info",
        metadata: toJsonValue({ provider: "whatsapp_cloud", verified: true, payload })
      }
    });
  }

  return addSecurityHeaders(
    NextResponse.json({ received: true, verified: true, inboundCount })
  );
}
