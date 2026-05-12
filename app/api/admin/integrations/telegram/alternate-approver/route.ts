import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const dynamic = "force-dynamic";

// Manages the alternate-approver fields on the org's Telegram Integration.
// Fields stored in Integration.config JSON:
//   - alternate_approver_chat_id : string (Telegram chat ID, strongly recommended)
//   - alternate_approver_email   : string (fallback email, used by Resend if installed)
//   - alternate_approver_name    : string (display name for escalation messages)
//
// Read by `escalate_to_alternate_approver` tool when TRA Growth Ops Lead or
// Compliance Officer detects a severity=HIGH item with primary-operator
// silence exceeding the documented SLA (KB-13).

type AlternateApproverConfig = {
  alternate_approver_chat_id: string;
  alternate_approver_email: string;
  alternate_approver_name: string;
};

const FIELD_KEYS: Array<keyof AlternateApproverConfig> = [
  "alternate_approver_chat_id",
  "alternate_approver_email",
  "alternate_approver_name"
];

function readConfig(
  raw: unknown
): AlternateApproverConfig & { configured: boolean } {
  const cfg =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const chatId =
    typeof cfg.alternate_approver_chat_id === "string"
      ? cfg.alternate_approver_chat_id.trim()
      : "";
  const email =
    typeof cfg.alternate_approver_email === "string"
      ? cfg.alternate_approver_email.trim()
      : "";
  const name =
    typeof cfg.alternate_approver_name === "string"
      ? cfg.alternate_approver_name.trim()
      : "";
  return {
    alternate_approver_chat_id: chatId,
    alternate_approver_email: email,
    alternate_approver_name: name,
    configured: Boolean(chatId || email)
  };
}

/** GET: read current alternate-approver config. */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const integration = await db.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        key: "telegram",
        status: "connected"
      },
      select: { id: true, config: true }
    });

    if (!integration) {
      return addSecurityHeaders(
        NextResponse.json({
          telegramConnected: false,
          configured: false,
          hint: "Connect Telegram in Integrations first, then set the alternate-approver config."
        })
      );
    }

    const cfg = readConfig(integration.config);
    return addSecurityHeaders(
      NextResponse.json({
        telegramConnected: true,
        ...cfg,
        hint: cfg.configured
          ? null
          : "No alternate approver configured. PUT this endpoint with chat_id, email, and name to enable the severity=HIGH fallback per KB-13."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** PUT: set or update the alternate-approver config (partial OK). */
export async function PUT(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = (await request.json().catch(() => ({}))) as Partial<
      AlternateApproverConfig
    >;

    // Validate at least one identity field if updating
    const hasAtLeastOne =
      typeof body.alternate_approver_chat_id === "string" ||
      typeof body.alternate_approver_email === "string";
    if (!hasAtLeastOne && typeof body.alternate_approver_name !== "string") {
      throw badRequest(
        "Provide at least one of alternate_approver_chat_id or alternate_approver_email (alternate_approver_name is optional)."
      );
    }

    // Validate email shape if provided
    if (typeof body.alternate_approver_email === "string") {
      const email = body.alternate_approver_email.trim();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw badRequest(
          "alternate_approver_email is not a valid email address."
        );
      }
    }

    // Validate chat_id shape if provided (Telegram chat IDs are integers, often negative for groups)
    if (typeof body.alternate_approver_chat_id === "string") {
      const chatId = body.alternate_approver_chat_id.trim();
      if (chatId && !/^-?\d+$/.test(chatId)) {
        throw badRequest(
          "alternate_approver_chat_id must be a numeric Telegram chat ID (e.g. '123456789' or '-1001234567890'). The alternate gets their ID by messaging your Telegram bot once and reading the response."
        );
      }
    }

    const integration = await db.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        key: "telegram",
        status: "connected"
      },
      select: { id: true, config: true }
    });

    if (!integration) {
      throw badRequest(
        "Telegram integration not connected. Connect it in Integrations first."
      );
    }

    const existing =
      integration.config &&
      typeof integration.config === "object" &&
      !Array.isArray(integration.config)
        ? (integration.config as Record<string, unknown>)
        : {};

    const nextConfig: Record<string, unknown> = { ...existing };
    for (const key of FIELD_KEYS) {
      if (typeof body[key] === "string") {
        nextConfig[key] = (body[key] as string).trim();
      }
    }

    await db.integration.update({
      where: { id: integration.id },
      data: { config: toJsonValue(nextConfig) }
    });

    const cfg = readConfig(nextConfig);
    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        ...cfg,
        message: cfg.configured
          ? "Alternate approver updated. The escalate_to_alternate_approver tool will now fire when the primary operator is silent on severity=HIGH issues."
          : "Alternate approver fields cleared."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** DELETE: clear the alternate-approver config. */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const integration = await db.integration.findFirst({
      where: {
        organizationId: session.organizationId,
        key: "telegram",
        status: "connected"
      },
      select: { id: true, config: true }
    });

    if (!integration) {
      throw badRequest("Telegram integration not connected.");
    }

    const existing =
      integration.config &&
      typeof integration.config === "object" &&
      !Array.isArray(integration.config)
        ? (integration.config as Record<string, unknown>)
        : {};

    const nextConfig: Record<string, unknown> = { ...existing };
    for (const key of FIELD_KEYS) {
      delete nextConfig[key];
    }

    await db.integration.update({
      where: { id: integration.id },
      data: { config: toJsonValue(nextConfig) }
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message:
          "Alternate-approver fields cleared. Severity=HIGH escalations now fall back to 'pause + holding statement' until the primary operator returns."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
