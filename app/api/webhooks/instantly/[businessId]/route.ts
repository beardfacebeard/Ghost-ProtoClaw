import { createHmac, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";
import { findProspectByContact, transitionProspect } from "@/lib/repository/prospects";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Resolve the encryption key via the shared config helper. If the env var is
 * missing (should never happen in prod — the boot script validates it — but
 * if it does), we'd rather log the webhook as unverified than 500, so the
 * operator can still see events flowing even with broken config.
 */
function tryGetEncryptionKey(): string | null {
  try {
    return getEncryptionKey();
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

// Instantly webhook for inbound replies + campaign events.
//
// Configure at: Instantly → Settings → Webhooks.
// URL:    https://<host>/api/webhooks/instantly/<businessId>
// Secret: generated per-webhook in Instantly; stored on the business's
//         instantly Integration as encrypted secret `webhook_secret`.
// Events: email.reply, lead.replied, lead.bounced, lead.unsubscribed,
//         campaign.completed, etc. Payload shape per Instantly docs.
//
// Signature: Instantly signs with HMAC-SHA256 of the raw body using the
// webhook secret, delivered as `X-Instantly-Signature` header in
// `sha256=<hex>` format.

const MAX_BODY_BYTES = 256 * 1024;

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

function verifyInstantlySignature(
  rawBody: string,
  header: string | null,
  secret: string
): boolean {
  if (!header || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  return safeEqual(provided, expected);
}

async function getWebhookSecret(organizationId: string): Promise<string | null> {
  const integration = await db.integration.findFirst({
    where: { organizationId, key: "instantly" },
    select: { encryptedSecrets: true, config: true }
  });
  if (!integration) return null;

  const encKey = tryGetEncryptionKey();
  if (!encKey) return null;

  const encrypted = integration.encryptedSecrets as Record<string, unknown> | null;
  if (encrypted && typeof encrypted === "object") {
    const webhookSecret = encrypted.webhook_secret;
    if (typeof webhookSecret === "string" && webhookSecret.length > 0) {
      try {
        return decryptSecret(webhookSecret, encKey);
      } catch {
        return null;
      }
    }
  }

  // Fall back to plaintext config.webhook_secret if the operator set it there.
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

  const webhookSecret = await getWebhookSecret(business.organizationId);
  const signature = request.headers.get("x-instantly-signature");
  const verified = webhookSecret
    ? verifyInstantlySignature(rawBody, signature, webhookSecret)
    : false;

  if (!webhookSecret) {
    // Log the unsigned event anyway for operator visibility + so the
    // operator can see that setup is incomplete.
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "Instantly webhook received (UNVERIFIED — secret not configured)",
        detail:
          "Add webhook_secret to the instantly Integration to enable signature verification.",
        status: "warning",
        metadata: { provider: "instantly", rawBodyPreview: rawBody.slice(0, 500) }
      }
    });
    return addSecurityHeaders(NextResponse.json({ received: true, verified: false }));
  }

  if (!verified) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "Instantly webhook rejected (bad signature)",
        detail: "Signature did not match webhook_secret. Possible tampering or misconfigured secret.",
        status: "error",
        metadata: { provider: "instantly", rawBodyPreview: rawBody.slice(0, 200) }
      }
    });
    return addSecurityHeaders(
      NextResponse.json({ error: "bad signature" }, { status: 401 })
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    // non-JSON payload; keep the raw body for debugging
  }

  const eventType = String(payload.event_type || payload.type || "unknown");
  const fromEmail =
    (payload.from as string | undefined) ||
    ((payload.data as Record<string, unknown> | undefined)?.from as string | undefined) ||
    "";
  const subject =
    (payload.subject as string | undefined) ||
    ((payload.data as Record<string, unknown> | undefined)?.subject as string | undefined) ||
    "";
  const bodyPreview = String(
    (payload.body as string | undefined) ||
      ((payload.data as Record<string, unknown> | undefined)?.body as string | undefined) ||
      ""
  ).slice(0, 500);

  // Best-effort: match the inbound to an existing Prospect by sender email
  // and transition it to "replied" so the dashboard funnel widget reflects
  // real conversation state. Doesn't block the response if the lookup fails.
  let prospectMatched: string | null = null;
  if (fromEmail && eventType.includes("repl")) {
    try {
      const match = await findProspectByContact(businessId, { email: fromEmail });
      if (match && match.stage !== "replied" && match.stage !== "engaged" && match.stage !== "link_sent") {
        await transitionProspect({
          prospectId: match.id,
          toStage: "replied",
          reason: `Instantly inbound: ${eventType}`,
          channel: "instantly"
        });
        prospectMatched = match.id;
      } else if (match) {
        prospectMatched = match.id;
      }
    } catch {
      // swallow — webhook should still ack
    }
  }

  await db.activityEntry.create({
    data: {
      businessId,
      type: "integration",
      title: `Instantly: ${eventType}${fromEmail ? ` from ${fromEmail}` : ""}`,
      detail: subject ? `Subject: ${subject}` : bodyPreview,
      status: "info",
      metadata: toJsonValue({
        provider: "instantly",
        verified: true,
        eventType,
        fromEmail,
        subject,
        bodyPreview,
        prospectMatched,
        payload
      })
    }
  });

  return addSecurityHeaders(NextResponse.json({ received: true, verified: true, prospectMatched }));
}
