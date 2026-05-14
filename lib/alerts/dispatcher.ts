/**
 * Operator alert dispatcher.
 *
 * The May audit flagged "no proactive alerts" — failures are only visible
 * if an admin opens the dashboard. This module is the missing channel:
 * critical events (budget hard-stop, scheduler timeout, integration
 * failure, missed scheduled job) call notifyOperator() and the dispatcher
 * fans the message out via every configured channel for the organization.
 *
 * Channels:
 *   - Telegram (preferred — fast, works on mobile, easy to dismiss)
 *   - Email via Resend (slower, but always deliverable to the inbox)
 *
 * Both are best-effort. A channel that isn't configured or fails is
 * logged and skipped — alert delivery never throws into the caller.
 *
 * Severity:
 *   - critical: something is broken now (budget exceeded, scheduler hung)
 *   - high:     attention needed soon (workflow timed out, integration down)
 *   - info:     FYI digest content (approvals waiting > N hours, daily summary)
 *
 * Spam control: each (orgId, source, key) tuple is rate-limited via an
 * in-memory map. The same key fires at most once per ALERT_DEDUP_WINDOW_MS.
 * For high-severity events the window is 1 hour; for info-level it's 24h.
 * This is intentionally process-local — if you scale to multiple replicas
 * you'll get up to N duplicates per event, which is the cheap tradeoff.
 */

import { db } from "@/lib/db";
import { getLogger } from "@/lib/observability/logger";

const log = getLogger("alerts");

const ALERT_DEDUP_WINDOW_MS: Record<AlertSeverity, number> = {
  critical: 15 * 60 * 1000, // 15 minutes — still spammy enough to wake someone up if it keeps happening
  high: 60 * 60 * 1000, // 1 hour
  info: 24 * 60 * 60 * 1000 // 1 day
};

const _dedupCache = new Map<string, number>();

function dedupKey(params: {
  organizationId: string;
  source: string;
  key: string;
}): string {
  return `${params.organizationId}:${params.source}:${params.key}`;
}

function shouldSend(params: {
  organizationId: string;
  source: string;
  key: string;
  severity: AlertSeverity;
}): boolean {
  const id = dedupKey(params);
  const lastSent = _dedupCache.get(id);
  const now = Date.now();
  if (lastSent && now - lastSent < ALERT_DEDUP_WINDOW_MS[params.severity]) {
    return false;
  }
  _dedupCache.set(id, now);
  // Cap the cache size so a long-running process doesn't leak. The cap
  // is generous — even 1000 entries is < 100KB.
  if (_dedupCache.size > 1000) {
    const oldestKey = _dedupCache.keys().next().value as string | undefined;
    if (oldestKey) _dedupCache.delete(oldestKey);
  }
  return true;
}

// ── Channels ─────────────────────────────────────────────────────────

async function sendTelegram(params: {
  organizationId: string;
  text: string;
}): Promise<{ delivered: boolean; error?: string }> {
  try {
    // Reuse the existing send_telegram_message handler via the executor
    // so credential resolution + bot_token lookup + chat_id selection all
    // live in one place. bypassApprovalGate so this alert never blocks
    // on operator approval — alerts ARE the operator's notice.
    const { executeTool } = await import("@/lib/mcp/tool-executor");
    const result = await executeTool({
      toolName: "send_telegram_message",
      arguments: { text: params.text },
      mcpServerId: "__builtin__",
      organizationId: params.organizationId,
      bypassApprovalGate: true
    });
    return { delivered: result.success, error: result.error };
  } catch (err) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : "telegram threw"
    };
  }
}

async function sendEmail(params: {
  organizationId: string;
  subject: string;
  body: string;
}): Promise<{ delivered: boolean; error?: string }> {
  try {
    // Resolve the org owner's email so alerts reach a real human.
    const owner = await db.missionControlAdminUser.findFirst({
      where: { organizationId: params.organizationId, role: "super_admin" },
      select: { email: true },
      orderBy: { createdAt: "asc" }
    });
    if (!owner?.email) {
      return { delivered: false, error: "no super_admin email on file" };
    }

    const { executeTool } = await import("@/lib/mcp/tool-executor");
    const result = await executeTool({
      toolName: "send_email",
      arguments: {
        to: owner.email,
        subject: params.subject,
        body: params.body
      },
      mcpServerId: "__builtin__",
      organizationId: params.organizationId,
      bypassApprovalGate: true
    });
    return { delivered: result.success, error: result.error };
  } catch (err) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : "email threw"
    };
  }
}

// ── Public API ───────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "high" | "info";

export type AlertChannel = "telegram" | "email";

export type AlertInput = {
  organizationId: string;
  /** Short subsystem identifier — "scheduler", "budget-guard", "integration:resend". */
  source: string;
  /** Dedup key within the source. Two events with the same key
   *  within the severity's dedup window collapse to one alert. */
  key: string;
  severity: AlertSeverity;
  /** Brief one-line title for the alert (becomes the email subject and
   *  the leading line of the Telegram message). */
  title: string;
  /** Multi-line body. Plain text; Telegram supports Markdown but we keep
   *  it plain so the same body works in email too. */
  message: string;
  /** Optional structured context. Rendered as "key: value" lines below
   *  the message in the alert. */
  context?: Record<string, unknown>;
  /** Override the default channel list. By default critical → both,
   *  high → telegram only, info → telegram only. */
  channels?: AlertChannel[];
};

function channelsForSeverity(severity: AlertSeverity): AlertChannel[] {
  switch (severity) {
    case "critical":
      return ["telegram", "email"];
    case "high":
      return ["telegram"];
    case "info":
      return ["telegram"];
  }
}

function renderBody(input: AlertInput): string {
  const contextLines = input.context
    ? Object.entries(input.context)
        .map(([k, v]) => `  ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join("\n")
    : "";
  return [
    input.title,
    "",
    input.message,
    contextLines ? `\nContext:\n${contextLines}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Fire an alert. Best-effort across configured channels; returns a per-
 * channel delivery report. Never throws — alerts must not become a
 * source of cascading failures.
 */
export async function notifyOperator(input: AlertInput): Promise<{
  delivered: AlertChannel[];
  skipped: AlertChannel[];
  failures: Array<{ channel: AlertChannel; error: string }>;
  deduped: boolean;
}> {
  if (
    !shouldSend({
      organizationId: input.organizationId,
      source: input.source,
      key: input.key,
      severity: input.severity
    })
  ) {
    return { delivered: [], skipped: [], failures: [], deduped: true };
  }

  const channels = input.channels ?? channelsForSeverity(input.severity);
  const body = renderBody(input);
  const subject = `[${input.severity.toUpperCase()}] ${input.title}`;

  const delivered: AlertChannel[] = [];
  const skipped: AlertChannel[] = [];
  const failures: Array<{ channel: AlertChannel; error: string }> = [];

  for (const channel of channels) {
    try {
      if (channel === "telegram") {
        const res = await sendTelegram({
          organizationId: input.organizationId,
          text: `${subject}\n\n${body}`
        });
        if (res.delivered) delivered.push("telegram");
        else if (res.error?.toLowerCase().includes("not configured"))
          skipped.push("telegram");
        else failures.push({ channel: "telegram", error: res.error ?? "unknown" });
      } else if (channel === "email") {
        const res = await sendEmail({
          organizationId: input.organizationId,
          subject,
          body
        });
        if (res.delivered) delivered.push("email");
        else if (res.error?.toLowerCase().includes("not configured"))
          skipped.push("email");
        else failures.push({ channel: "email", error: res.error ?? "unknown" });
      }
    } catch (err) {
      failures.push({
        channel,
        error: err instanceof Error ? err.message : "channel threw"
      });
    }
  }

  log.info("operator alert dispatched", {
    organizationId: input.organizationId,
    source: input.source,
    key: input.key,
    severity: input.severity,
    delivered,
    skipped,
    failures
  });

  return { delivered, skipped, failures, deduped: false };
}
