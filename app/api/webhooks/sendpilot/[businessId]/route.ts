import { createHmac, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function tryGetEncryptionKey(): string | null {
  try {
    return getEncryptionKey();
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

// Sendpilot webhook for LinkedIn events (messages, connection requests,
// campaign lifecycle, lead status changes).
//
// Configure at: Sendpilot → Settings → Webhooks → Add Webhook.
// URL:      https://<host>/api/webhooks/sendpilot/<businessId>
// Secret:   Sendpilot displays once on creation. Store on the business's
//           sendpilot Integration as encrypted secret `webhook_secret`.
//
// Signature: `Webhook-Signature: v1,t=<unix_seconds>,s=<hex>` where
// s = HMAC-SHA256 of `${t}.${raw_body}` with the webhook secret.
// Reject events older than 5 minutes to block replay.

const MAX_BODY_BYTES = 256 * 1024;
const REPLAY_WINDOW_SECONDS = 300;

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

function parseSignatureHeader(header: string): { t?: string; s?: string } {
  // "v1,t=1708456789,s=abc..."
  const parts = header.split(",").map((p) => p.trim());
  const out: { t?: string; s?: string } = {};
  for (const part of parts) {
    if (part.startsWith("t=")) out.t = part.slice(2);
    else if (part.startsWith("s=")) out.s = part.slice(2);
  }
  return out;
}

async function getSendpilotWebhookSecret(organizationId: string): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: { organizationId, key: "sendpilot" },
    select: { encryptedSecrets: true, config: true }
  });
  if (!integration) return null;

  const encKey = tryGetEncryptionKey();
  if (encKey && integration.encryptedSecrets && typeof integration.encryptedSecrets === "object") {
    const encrypted = integration.encryptedSecrets as Record<string, unknown>;
    const webhookSecret = encrypted.webhook_secret;
    if (typeof webhookSecret === "string" && webhookSecret.length > 0) {
      try {
        return decryptSecret(webhookSecret, encKey);
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

  const webhookSecret = await getSendpilotWebhookSecret(business.organizationId);
  const signatureHeader = request.headers.get("webhook-signature");

  let verified = false;
  let signatureError: string | null = null;

  if (webhookSecret && signatureHeader) {
    const { t, s } = parseSignatureHeader(signatureHeader);
    if (!t || !s) {
      signatureError = "signature header missing t or s";
    } else {
      const tsNum = Number(t);
      const now = Math.floor(Date.now() / 1000);
      if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > REPLAY_WINDOW_SECONDS) {
        signatureError = "timestamp outside replay window";
      } else {
        const expected = createHmac("sha256", webhookSecret)
          .update(`${t}.${rawBody}`)
          .digest("hex");
        if (safeEqual(s, expected)) {
          verified = true;
        } else {
          signatureError = "hmac mismatch";
        }
      }
    }
  }

  if (!webhookSecret) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "Sendpilot webhook received (UNVERIFIED — secret not configured)",
        detail:
          "Add webhook_secret to the sendpilot Integration to enable signature verification.",
        status: "warning",
        metadata: { provider: "sendpilot", rawBodyPreview: rawBody.slice(0, 500) }
      }
    });
    return addSecurityHeaders(NextResponse.json({ received: true, verified: false }));
  }

  if (!verified) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "Sendpilot webhook rejected",
        detail: `Signature verification failed: ${signatureError ?? "missing signature"}.`,
        status: "error",
        metadata: { provider: "sendpilot", rawBodyPreview: rawBody.slice(0, 200) }
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
    // non-JSON body
  }

  const eventType = String(payload.eventType || payload.event_type || "unknown");
  const eventData = (payload.data as Record<string, unknown> | undefined) || {};

  // Build a human title per known event type.
  let title = `Sendpilot: ${eventType}`;
  let detail = "";
  if (eventType === "message.received") {
    const content = String(eventData.content || eventData.message || "").slice(0, 500);
    const sender = String(eventData.senderName || eventData.leadName || "lead");
    title = `LinkedIn reply from ${sender}`;
    detail = content;
  } else if (eventType === "connection.accepted") {
    const name = String(eventData.leadName || "lead");
    title = `LinkedIn connection accepted: ${name}`;
  } else if (eventType === "connection.sent") {
    const name = String(eventData.leadName || "lead");
    title = `LinkedIn connection request sent to ${name}`;
  } else if (eventType === "message.sent") {
    const name = String(eventData.leadName || "lead");
    title = `LinkedIn DM sent to ${name}`;
  } else if (eventType === "lead.status.changed") {
    const name = String(eventData.leadName || eventData.leadId || "lead");
    const newStatus = String(eventData.newStatus || "");
    title = `Lead ${name} → ${newStatus}`;
  }

  await db.activityEntry.create({
    data: {
      businessId,
      type: "integration",
      title,
      detail: detail || undefined,
      status: "info",
      metadata: toJsonValue({
        provider: "sendpilot",
        verified: true,
        eventType,
        eventId: payload.eventId,
        workspaceId: payload.workspaceId,
        data: eventData
      })
    }
  });

  return addSecurityHeaders(NextResponse.json({ received: true, verified: true }));
}
