import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import {
  getIntegrationByKey,
  saveIntegration
} from "@/lib/repository/integrations";

export const dynamic = "force-dynamic";

const AI_PROVIDERS = ["openrouter", "openai", "anthropic"] as const;
type AiProvider = (typeof AI_PROVIDERS)[number];

const ENV_KEY_MAP: Record<AiProvider, string> = {
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY"
};

const PROVIDER_NAMES: Record<AiProvider, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic"
};

function getKeySource(
  provider: AiProvider,
  integration: { status: string; secretKeys: string[] } | null
): "db" | "env" | "none" {
  if (integration?.status === "connected" && integration.secretKeys.length > 0) {
    return "db";
  }

  if (process.env[ENV_KEY_MAP[provider]]?.trim()) {
    return "env";
  }

  return "none";
}

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session || session.role !== "super_admin") {
      throw unauthorized();
    }

    const organizationId = session.organizationId;

    if (!organizationId) {
      throw unauthorized();
    }

    const results: Record<
      string,
      { configured: boolean; source: "db" | "env" | "none" }
    > = {};

    for (const provider of AI_PROVIDERS) {
      const integration = await getIntegrationByKey(organizationId, provider);
      const source = getKeySource(provider, integration);

      results[provider] = {
        configured: source !== "none",
        source
      };
    }

    return addSecurityHeaders(NextResponse.json(results));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const saveSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().trim().min(1, "API key is required."),
  organizationId: z.string().trim().optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session || session.role !== "super_admin") {
      throw unauthorized();
    }

    const orgId = session.organizationId;

    if (!orgId) {
      throw unauthorized();
    }

    const body = saveSchema.parse(await request.json());

    if (!AI_PROVIDERS.includes(body.provider)) {
      throw badRequest("Unknown AI provider.");
    }

    const config: Record<string, string> = {};

    if (body.provider === "openai" && body.organizationId) {
      config.org_id = body.organizationId;
    }

    await saveIntegration({
      organizationId: orgId,
      key: body.provider,
      name: PROVIDER_NAMES[body.provider],
      scope: "organization",
      authType: "api_key",
      config,
      secrets: { api_key: body.apiKey },
      assignedBusinessIds: [],
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        message: `${PROVIDER_NAMES[body.provider]} API key saved successfully.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
