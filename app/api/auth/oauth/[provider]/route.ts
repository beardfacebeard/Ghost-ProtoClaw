import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  clearOAuthStateCookie,
  createOAuthStateCookie,
  generatePkcePair,
  type OAuthProvider,
  setOAuthStateCookie
} from "@/lib/auth/oauth-state";
import { getAppUrl } from "@/lib/auth/config";
import { getSessionFromRequest } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function getGoogleRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${getAppUrl()}/api/auth/oauth/google/callback`
  );
}

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || "";
}

function buildGoogleUrl(state: string) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive"
    ].join(" "),
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildOpenRouterUrl(state: string, challenge: string) {
  const callbackUrl = `${getAppUrl()}/api/auth/oauth/openrouter/callback?state=${encodeURIComponent(state)}`;
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  return `https://openrouter.ai/auth?${params.toString()}`;
}

export async function GET(
  request: NextRequest,
  context: { params: { provider: string } }
) {
  const provider = context.params.provider as OAuthProvider;
  const session = await getSessionFromRequest(request);

  if (!session?.organizationId) {
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/login", request.url))
    );
  }

  if (provider !== "google" && provider !== "openrouter") {
    return addSecurityHeaders(
      NextResponse.redirect(
        new URL("/admin/integrations?error=oauth_failed", request.url)
      )
    );
  }

  try {
    if (provider === "google" && !getGoogleClientId()) {
      throw new Error("Google OAuth is not configured.");
    }

    const pkce = provider === "openrouter" ? generatePkcePair() : null;
    const { state, cookieValue } = await createOAuthStateCookie({
      provider,
      organizationId: session.organizationId,
      userId: session.userId,
      email: session.email,
      codeVerifier: pkce?.verifier
    });

    const redirectUrl =
      provider === "google"
        ? buildGoogleUrl(state)
        : buildOpenRouterUrl(state, pkce?.challenge || "");

    const response = NextResponse.redirect(redirectUrl);
    clearOAuthStateCookie(response);
    setOAuthStateCookie(response, cookieValue);

    return addSecurityHeaders(response);
  } catch {
    return addSecurityHeaders(
      NextResponse.redirect(
        new URL("/admin/integrations?error=oauth_failed", request.url)
      )
    );
  }
}
