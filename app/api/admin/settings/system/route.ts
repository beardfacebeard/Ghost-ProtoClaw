import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

function masked(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.length <= 8) return "****";
  return v.slice(0, 4) + "****" + v.slice(-4);
}

function envStatus(key: string): "connected" | "missing" {
  return process.env[key]?.trim() ? "connected" : "missing";
}

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session || session.role !== "super_admin") {
      throw unauthorized();
    }

    const config = {
      openclaw: {
        gatewayUrl: process.env.OPENCLAW_API_URL || process.env.OPENCLAW_GATEWAY_URL || null,
        status: envStatus("OPENCLAW_API_URL") === "connected" || envStatus("OPENCLAW_GATEWAY_URL") === "connected"
          ? "connected"
          : "missing",
        webhookSecret: masked(process.env.OPENCLAW_WEBHOOK_SECRET),
        workspaceRoot: process.env.OPENCLAW_WORKSPACE_ROOT || null,
        mirrorMode: process.env.MISSION_CONTROL_WORKSPACE_MIRROR_MODE || process.env.WORKSPACE_SYNC_MODE || "database"
      },
      ai: {
        openrouter: {
          status: envStatus("OPENROUTER_API_KEY"),
          key: masked(process.env.OPENROUTER_API_KEY)
        },
        anthropic: {
          status: envStatus("ANTHROPIC_API_KEY"),
          key: masked(process.env.ANTHROPIC_API_KEY)
        },
        openai: {
          status: envStatus("OPENAI_API_KEY"),
          key: masked(process.env.OPENAI_API_KEY)
        },
        defaultModel: process.env.MISSION_CONTROL_PROMPT_ASSIST_MODEL || null
      },
      email: {
        status: envStatus("RESEND_API_KEY"),
        key: masked(process.env.RESEND_API_KEY),
        fromEmail: process.env.RESEND_FROM_EMAIL || null
      },
      storage: {
        status:
          envStatus("AWS_S3_BUCKET") === "connected" &&
          envStatus("AWS_ACCESS_KEY_ID") === "connected" &&
          envStatus("AWS_SECRET_ACCESS_KEY") === "connected"
            ? "connected"
            : envStatus("AWS_S3_BUCKET") === "connected"
              ? "partial"
              : "missing",
        bucket: process.env.AWS_S3_BUCKET || null,
        region: process.env.AWS_REGION || null
      },
      app: {
        url: process.env.NEXT_PUBLIC_APP_URL || null,
        nodeEnv: process.env.NODE_ENV || "development",
        seedOnStart: process.env.SEED_ON_START === "true"
      }
    };

    return addSecurityHeaders(NextResponse.json(config));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
