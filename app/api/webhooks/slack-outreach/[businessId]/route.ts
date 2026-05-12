import { createHmac, timingSafeEqual } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";

// Slack Events API webhook for Slack Connect invite lifecycle + inbound
// channel messages from prospects who accepted invites.
//
// Configure at: api.slack.com/apps/<app>/event-subscriptions →
//   Request URL: https://<host>/api/webhooks/slack-outreach/<businessId>
//   Subscribed events (workspace, not bot):
//     - shared_channel_invite_accepted
//     - shared_channel_invite_declined
//     - shared_channel_invite_revoked
//     - shared_channel_invite_expired
//     - message.channels  (inbound messages in Connect channels we created)
//
// Bot scope needed for message.channels: channels:history.
//
// Signing: Slack signs every request with HMAC-SHA256 of
//   `v0:${X-Slack-Request-Timestamp}:${rawBody}` using the App's Signing
//   Secret. We store that as `signing_secret` on the slack_outreach_mcp
//   McpServer row (encryptedConfig). Reject events older than 5 min.
//
// URL verification: on first save Slack POSTs `{type: "url_verification",
// challenge}` BEFORE the signing secret is in place — we echo the challenge
// without verifying.
//
// Loop-protection for message events: Slack delivers our own bot's
// messages back to us as message events. We drop any message with a
// `bot_id`, a `subtype` (channel_join, message_changed, etc.), or whose
// `user` matches the workspace's authed bot user. We also only ingest
// messages from channels we previously created via
// slack_outreach_create_connect_channel — i.e. channel_id appears in our
// slack_outreach_invite audit log.

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

async function getSlackSigningSecret(
  businessId: string
): Promise<string | null> {
  const server = await db.mcpServer.findFirst({
    where: {
      businessId,
      definitionId: "slack_outreach_mcp",
      status: "active"
    },
    select: { encryptedConfig: true }
  });
  if (!server?.encryptedConfig) return null;

  const encKey = tryGetEncryptionKey();
  if (!encKey) return null;
  if (
    typeof server.encryptedConfig === "object" &&
    !Array.isArray(server.encryptedConfig)
  ) {
    const raw = (server.encryptedConfig as Record<string, unknown>)
      .signing_secret;
    if (typeof raw === "string" && raw.length > 0) {
      try {
        return decryptSecret(raw, encKey);
      } catch {
        return null;
      }
    }
  }
  return null;
}

type SlackInvitePayload = {
  id?: string;
  recipient_email?: string;
};

type SlackEventInner = {
  type?: string;
  // Invite lifecycle
  invite?: SlackInvitePayload;
  approval_status?: string;
  accepting_user?: { id?: string; name?: string };
  // Channel info (used for invite + message events)
  channel?: string | { id?: string };
  channel_type?: string;
  // Message events
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
  team?: string;
  event_ts?: string;
};

type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  event?: SlackEventInner;
  event_id?: string;
  team_id?: string;
  api_app_id?: string;
  authorizations?: Array<{
    user_id?: string;
    is_bot?: boolean;
  }>;
};

function inviteStatusFromEventType(eventType: string): string | null {
  switch (eventType) {
    case "shared_channel_invite_accepted":
      return "accepted";
    case "shared_channel_invite_declined":
      return "declined";
    case "shared_channel_invite_revoked":
      return "revoked";
    case "shared_channel_invite_expired":
      return "expired";
    default:
      return null;
  }
}

type RouteContext = {
  params: { businessId: string };
};

export const dynamic = "force-dynamic";

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

  let payload: SlackEventEnvelope = {};
  try {
    payload = JSON.parse(rawBody) as SlackEventEnvelope;
  } catch {
    return addSecurityHeaders(
      NextResponse.json({ error: "invalid json" }, { status: 400 })
    );
  }

  // URL verification: Slack POSTs this BEFORE the signing secret is in place,
  // so it bypasses signature verification by design.
  if (payload.type === "url_verification" && payload.challenge) {
    return addSecurityHeaders(
      NextResponse.json({ challenge: payload.challenge })
    );
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true }
  });
  if (!business) {
    return addSecurityHeaders(
      NextResponse.json({ error: "business not found" }, { status: 404 })
    );
  }

  const signingSecret = await getSlackSigningSecret(businessId);
  const sigHeader = request.headers.get("x-slack-signature");
  const tsHeader = request.headers.get("x-slack-request-timestamp");

  let verified = false;
  let signatureError: string | null = null;

  if (signingSecret && sigHeader && tsHeader) {
    const tsNum = Number(tsHeader);
    const now = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(tsNum) ||
      Math.abs(now - tsNum) > REPLAY_WINDOW_SECONDS
    ) {
      signatureError = "timestamp outside replay window";
    } else {
      const expected =
        "v0=" +
        createHmac("sha256", signingSecret)
          .update(`v0:${tsHeader}:${rawBody}`)
          .digest("hex");
      if (safeEqual(sigHeader, expected)) {
        verified = true;
      } else {
        signatureError = "hmac mismatch";
      }
    }
  }

  if (!signingSecret) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title:
          "Slack outreach webhook received (UNVERIFIED — signing_secret not configured)",
        detail:
          "Add signing_secret to the slack_outreach_mcp MCP server to enable signature verification.",
        status: "warning",
        metadata: toJsonValue({
          provider: "slack_outreach",
          rawBodyPreview: rawBody.slice(0, 500)
        })
      }
    });
    return addSecurityHeaders(
      NextResponse.json({ received: true, verified: false })
    );
  }

  if (!verified) {
    await db.activityEntry.create({
      data: {
        businessId,
        type: "integration",
        title: "Slack outreach webhook rejected",
        detail: `Signature verification failed: ${signatureError ?? "missing signature"}.`,
        status: "error",
        metadata: toJsonValue({
          provider: "slack_outreach",
          rawBodyPreview: rawBody.slice(0, 200)
        })
      }
    });
    return addSecurityHeaders(
      NextResponse.json({ error: "bad signature" }, { status: 401 })
    );
  }

  // ── Event dispatch ──────────────────────────────────────────────
  const event = payload.event;
  const eventType = String(event?.type || payload.type || "unknown");

  // ── Branch A: inbound channel message (prospect replied in a Slack
  //              Connect channel we created). Loop-protected — we drop
  //              our own bot's messages + subtype events.
  if (eventType === "message") {
    const subtype = event?.subtype;
    const botId = event?.bot_id;
    const authedBotUserId = payload.authorizations?.find((a) => a.is_bot)
      ?.user_id;

    // Drop bot loops + non-user messages (channel_join, message_changed, etc.)
    if (subtype || botId || (authedBotUserId && event?.user === authedBotUserId)) {
      return addSecurityHeaders(
        NextResponse.json({ received: true, verified: true, ignored: "bot_or_subtype" })
      );
    }

    const channelId =
      typeof event?.channel === "string"
        ? event.channel
        : event?.channel?.id || "";
    if (!channelId) {
      return addSecurityHeaders(
        NextResponse.json({ received: true, verified: true, ignored: "no_channel" })
      );
    }

    // Filter to channels we created via slack_outreach_create_connect_channel.
    // We look up by channel_id in the invite audit log.
    const inviteRow = await db.activityEntry.findFirst({
      where: {
        businessId,
        type: "slack_outreach_invite",
        metadata: { path: ["channel_id"], equals: channelId }
      },
      select: { id: true, metadata: true }
    });
    if (!inviteRow) {
      // Message from a channel we don't manage — log lightly and ignore so
      // we don't pollute Reply Triager with workspace-internal chatter.
      await db.activityEntry.create({
        data: {
          businessId,
          type: "integration",
          title: "Slack message in unmanaged channel — ignored",
          detail: `channel=${channelId}`,
          status: "info",
          metadata: toJsonValue({
            provider: "slack_outreach",
            eventType,
            channelId,
            note: "channel_not_in_slack_outreach_audit_log"
          })
        }
      });
      return addSecurityHeaders(
        NextResponse.json({ received: true, verified: true, ignored: "unmanaged_channel" })
      );
    }

    const inviteMeta =
      (inviteRow.metadata as Record<string, unknown> | null) ?? {};
    const prospectEmail = String(inviteMeta.email || "");

    // Write inbound to ActivityEntry so Reply Triager picks it up via
    // wf_03's inbound webhook trigger.
    await db.activityEntry.create({
      data: {
        businessId,
        type: "reply_inbound",
        title: `Slack reply from ${prospectEmail || "Connect prospect"}`,
        detail: String(event?.text || "").slice(0, 500),
        status: "pending_triage",
        metadata: toJsonValue({
          provider: "slack_outreach",
          channel: "slack",
          channel_id: channelId,
          slack_ts: event?.ts,
          slack_thread_ts: event?.thread_ts,
          slack_user_id: event?.user,
          slack_team_id: event?.team,
          prospect_email: prospectEmail,
          related_invite_id: inviteMeta.invite_id,
          related_invite_row: inviteRow.id,
          text: String(event?.text || "").slice(0, 2000)
        })
      }
    });

    return addSecurityHeaders(
      NextResponse.json({ received: true, verified: true, triaged: true })
    );
  }

  // ── Branch B: Slack Connect invite lifecycle ────────────────────
  const newStatus = inviteStatusFromEventType(eventType);

  // Always log the event for audit / debugging.
  let updatedInviteRowId: string | null = null;
  let matchedInviteId: string | null = null;
  let matchedEmail: string | null = null;

  if (newStatus && event?.invite?.id) {
    const inviteId = String(event.invite.id);
    matchedInviteId = inviteId;
    matchedEmail = event.invite.recipient_email
      ? String(event.invite.recipient_email)
      : null;

    // Find the original invite ActivityEntry we created when sending.
    const existing = await db.activityEntry.findFirst({
      where: {
        businessId,
        type: "slack_outreach_invite",
        metadata: {
          path: ["invite_id"],
          equals: inviteId
        }
      },
      select: { id: true, metadata: true, title: true, detail: true }
    });

    if (existing) {
      const currentMeta =
        (existing.metadata as Record<string, unknown> | null) ?? {};
      const updatedMeta = {
        ...currentMeta,
        accepted_at:
          newStatus === "accepted"
            ? new Date().toISOString()
            : currentMeta.accepted_at,
        declined_at:
          newStatus === "declined"
            ? new Date().toISOString()
            : currentMeta.declined_at,
        revoked_at:
          newStatus === "revoked"
            ? new Date().toISOString()
            : currentMeta.revoked_at,
        last_event_type: eventType,
        accepting_user_id: event.accepting_user?.id,
        accepting_user_name: event.accepting_user?.name
      };
      const updated = await db.activityEntry.update({
        where: { id: existing.id },
        data: {
          status: newStatus,
          metadata: toJsonValue(updatedMeta)
        }
      });
      updatedInviteRowId = updated.id;
    }
  }

  // Drop a fresh ActivityEntry for the operator pulse so the acceptance
  // shows up in /admin/activity even if no matching invite row was found
  // (e.g. invite sent from outside the agent runtime).
  await db.activityEntry.create({
    data: {
      businessId,
      type: "integration",
      title: newStatus
        ? `Slack Connect invite ${newStatus}${matchedEmail ? ` — ${matchedEmail}` : ""}`
        : `Slack event: ${eventType}`,
      detail:
        newStatus && matchedInviteId
          ? `invite_id=${matchedInviteId}${updatedInviteRowId ? ` (audit row ${updatedInviteRowId} updated)` : " (no matching audit row)"}`
          : undefined,
      status: "info",
      metadata: toJsonValue({
        provider: "slack_outreach",
        verified: true,
        eventType,
        eventId: payload.event_id,
        teamId: payload.team_id,
        appId: payload.api_app_id,
        invite: event?.invite,
        channel: event?.channel,
        approvalStatus: event?.approval_status,
        acceptingUser: event?.accepting_user
      })
    }
  });

  return addSecurityHeaders(
    NextResponse.json({ received: true, verified: true })
  );
}
