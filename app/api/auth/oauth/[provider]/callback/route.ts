import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  clearOAuthStateCookie,
  getOAuthStateCookie,
  verifyOAuthStateCookie,
  type OAuthProvider
} from "@/lib/auth/oauth-state";
import { getAppUrl } from "@/lib/auth/config";
import { saveIntegration } from "@/lib/repository/integrations";

export const dynamic = "force-dynamic";

function redirectWithStatus(
  request: NextRequest,
  search: string,
  clear = true
) {
  const response = NextResponse.redirect(
    new URL(`/admin/integrations${search}`, request.url)
  );

  if (clear) {
    clearOAuthStateCookie(response);
  }

  return addSecurityHeaders(response);
}

function getGoogleCredentials() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || "",
    clientSecret:
      process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `${getAppUrl()}/api/auth/oauth/google/callback`
  };
}

async function exchangeGoogleCode(code: string) {
  const credentials = getGoogleCredentials();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: credentials.redirectUri,
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }

  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
  };
}

async function fetchGoogleUser(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Google user info lookup failed.");
  }

  return (await response.json()) as {
    email?: string;
    name?: string;
  };
}

function extractOpenRouterApiKey(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const objectPayload = payload as Record<string, unknown>;
  if (typeof objectPayload.key === "string") {
    return objectPayload.key;
  }

  if (
    objectPayload.data &&
    typeof objectPayload.data === "object" &&
    objectPayload.data !== null
  ) {
    const nested = objectPayload.data as Record<string, unknown>;
    if (typeof nested.key === "string") {
      return nested.key;
    }

    if (typeof nested.api_key === "string") {
      return nested.api_key;
    }
  }

  if (typeof objectPayload.api_key === "string") {
    return objectPayload.api_key;
  }

  return null;
}

async function exchangeOpenRouterCode(code: string, codeVerifier: string) {
  const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("OpenRouter token exchange failed.");
  }

  const payload = await response.json();
  const apiKey = extractOpenRouterApiKey(payload);

  if (!apiKey) {
    throw new Error("OpenRouter did not return an API key.");
  }

  return {
    apiKey
  };
}

export async function GET(
  request: NextRequest,
  context: { params: { provider: string } }
) {
  const provider = context.params.provider as OAuthProvider;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieValue = getOAuthStateCookie(request);

  if (
    !code ||
    !state ||
    !cookieValue ||
    (provider !== "google" && provider !== "openrouter")
  ) {
    return redirectWithStatus(request, "?error=oauth_failed");
  }

  const verified = await verifyOAuthStateCookie(cookieValue, state, provider);

  if (!verified) {
    return redirectWithStatus(request, "?error=oauth_failed");
  }

  try {
    if (provider === "google") {
      const tokens = await exchangeGoogleCode(code);
      if (!tokens.access_token) {
        throw new Error("Google access token missing.");
      }

      const user = await fetchGoogleUser(tokens.access_token);
      const sharedConfig = {
        client_id: getGoogleCredentials().clientId,
        user_email: user.email || verified.email,
        connected_account: user.name || user.email || verified.email,
        scopes: tokens.scope || ""
      };
      const sharedSecrets = {
        ...(getGoogleCredentials().clientSecret
          ? { client_secret: getGoogleCredentials().clientSecret }
          : {}),
        access_token: tokens.access_token,
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {})
      };

      await Promise.all([
        saveIntegration({
          organizationId: verified.organizationId,
          key: "gmail",
          name: "Google Gmail",
          scope: "organization",
          authType: "oauth",
          config: sharedConfig,
          secrets: sharedSecrets,
          actorUserId: verified.userId,
          actorEmail: verified.email
        }),
        saveIntegration({
          organizationId: verified.organizationId,
          key: "google_calendar",
          name: "Google Calendar",
          scope: "organization",
          authType: "oauth",
          config: sharedConfig,
          secrets: sharedSecrets,
          actorUserId: verified.userId,
          actorEmail: verified.email
        }),
        saveIntegration({
          organizationId: verified.organizationId,
          key: "google_drive",
          name: "Google Drive",
          scope: "organization",
          authType: "oauth",
          config: sharedConfig,
          secrets: sharedSecrets,
          actorUserId: verified.userId,
          actorEmail: verified.email
        })
      ]);

      return redirectWithStatus(request, "?connected=google&success=true");
    }

    const openRouter = await exchangeOpenRouterCode(
      code,
      verified.codeVerifier || ""
    );

    await saveIntegration({
      organizationId: verified.organizationId,
      key: "openrouter",
      name: "OpenRouter",
      scope: "organization",
      authType: "oauth",
      config: {
        connected_via: "oauth",
        app_url: getAppUrl()
      },
      secrets: {
        api_key: openRouter.apiKey
      },
      actorUserId: verified.userId,
      actorEmail: verified.email
    });

    return redirectWithStatus(request, "?connected=openrouter&success=true");
  } catch (error) {
    console.error("OAuth callback failed", {
      provider,
      error
    });

    return redirectWithStatus(request, "?error=oauth_failed");
  }
}
