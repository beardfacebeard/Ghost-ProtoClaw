import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  getDecryptedSecrets,
  getIntegrationByKey
} from "@/lib/repository/integrations";

export const dynamic = "force-dynamic";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // OpenAI Whisper hard limit

/**
 * Resolve an OpenAI API key for the given organization. Prefers the
 * organization's stored OpenAI integration; falls back to the server-wide
 * OPENAI_API_KEY env var when no integration is configured.
 */
async function resolveOpenAIKey(organizationId: string): Promise<{
  apiKey: string | null;
  orgId: string | null;
}> {
  const integration = await getIntegrationByKey(organizationId, "openai");

  if (integration && integration.status === "connected") {
    try {
      const secrets = await getDecryptedSecrets(
        integration.id,
        integration.organizationId
      );
      const key = typeof secrets.api_key === "string" ? secrets.api_key : null;
      const config = (integration.config ?? {}) as Record<string, unknown>;
      const orgId = typeof config.org_id === "string" ? config.org_id : null;
      if (key) return { apiKey: key, orgId };
    } catch {
      // Fall through to env
    }
  }

  const envKey = process.env.OPENAI_API_KEY;
  return { apiKey: envKey && envKey.length > 0 ? envKey : null, orgId: null };
}

/**
 * Transcribe a short audio clip via OpenAI Whisper and return the text.
 *
 * Expects multipart/form-data with an `audio` file field. Used by the chat
 * mic-input button to convert voice into message text before the user sends
 * it. We don't store the audio — it's forwarded straight to Whisper and the
 * text is returned to the client.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "No audio file provided." },
          { status: 400 }
        )
      );
    }

    if (audio.size === 0) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Audio file is empty." }, { status: 400 })
      );
    }

    if (audio.size > MAX_AUDIO_SIZE) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: `Audio too long. Maximum size is ${MAX_AUDIO_SIZE / 1024 / 1024}MB.`
          },
          { status: 400 }
        )
      );
    }

    const { apiKey, orgId } = await resolveOpenAIKey(session.organizationId);

    if (!apiKey) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "Voice transcription requires an OpenAI API key.",
            hint: "Add an OpenAI key in Settings → Integrations, or set OPENAI_API_KEY."
          },
          { status: 503 }
        )
      );
    }

    const upstream = new FormData();
    upstream.append("file", audio, audio.name || "recording.webm");
    upstream.append("model", "whisper-1");

    const language = formData.get("language");
    if (typeof language === "string" && language.length > 0) {
      upstream.append("language", language);
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`
    };
    if (orgId) headers["OpenAI-Organization"] = orgId;

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers,
        body: upstream
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Whisper transcription failed:", response.status, errorBody);
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Transcription failed. Please try again." },
          { status: 502 }
        )
      );
    }

    const data = (await response.json()) as { text?: string };
    const text = typeof data.text === "string" ? data.text.trim() : "";

    return addSecurityHeaders(NextResponse.json({ text }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
