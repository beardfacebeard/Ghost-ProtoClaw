import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

const AI_PROVIDERS = ["openrouter", "openai", "anthropic"] as const;

const testSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().trim().min(1, "API key is required."),
  organizationId: z.string().trim().optional()
});

async function testProviderKey(
  provider: string,
  apiKey: string,
  organizationId?: string
): Promise<{ success: boolean; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    switch (provider) {
      case "openrouter": {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          cache: "no-store"
        });

        return response.ok
          ? { success: true, message: "OpenRouter connection is active." }
          : {
              success: false,
              message: "OpenRouter rejected the API key."
            };
      }

      case "openai": {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiKey}`
        };

        if (organizationId) {
          headers["OpenAI-Organization"] = organizationId;
        }

        const response = await fetch("https://api.openai.com/v1/models", {
          headers,
          signal: controller.signal,
          cache: "no-store"
        });

        return response.ok
          ? { success: true, message: "OpenAI connection is active." }
          : { success: false, message: "OpenAI rejected the API key." };
      }

      case "anthropic": {
        const response = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          signal: controller.signal,
          cache: "no-store"
        });

        return response.ok
          ? { success: true, message: "Anthropic connection is active." }
          : {
              success: false,
              message: "Anthropic rejected the API key."
            };
      }

      default:
        return { success: false, message: "Unknown provider." };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        success: false,
        message: "Connection timed out. The provider could not be reached."
      };
    }

    return {
      success: false,
      message:
        "The provider could not be reached or rejected the connection attempt."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session || session.role !== "super_admin") {
      throw unauthorized();
    }

    const body = testSchema.parse(await request.json());

    const result = await testProviderKey(
      body.provider,
      body.apiKey,
      body.organizationId
    );

    return addSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
