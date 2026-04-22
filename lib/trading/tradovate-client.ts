/**
 * Tradovate API client helpers.
 *
 * Tradovate uses a username+password auth flow (not a permanent API key
 * like OANDA). POST /auth/accesstokenrequest exchanges the credentials
 * for a short-lived access token (~80 minute lifetime). We refresh on
 * each call — slightly slower than token-caching but dramatically
 * simpler and removes a whole class of cache-staleness bugs. If latency
 * becomes an issue, add an in-memory cache in Phase 2e.
 *
 * Docs: https://api.tradovate.com/
 */

export type TradovateEnv = "demo" | "live";

export type TradovateCredentials = {
  username: string;
  password: string;
  cid: string;
  sec: string;
  appId: string;
  appVersion: string;
  environment: TradovateEnv;
};

export function tradovateHost(env: TradovateEnv): string {
  return env === "live"
    ? "https://live.tradovateapi.com/v1"
    : "https://demo.tradovateapi.com/v1";
}

export type TradovateAuth = {
  accessToken: string;
  mdAccessToken: string | null;
  userId: number;
  name: string;
  expirationTime: string;
};

/**
 * Exchange username+password+cid+sec for an access token. Returns the
 * auth payload or throws on failure (caller handles).
 */
export async function getTradovateAccessToken(
  creds: TradovateCredentials
): Promise<TradovateAuth> {
  const host = tradovateHost(creds.environment);
  const res = await fetch(`${host}/auth/accesstokenrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: creds.username,
      password: creds.password,
      appId: creds.appId,
      appVersion: creds.appVersion,
      cid: creds.cid,
      sec: creds.sec
    })
  });

  if (!res.ok) {
    throw new Error(
      `Tradovate auth failed (${res.status}): ${(await res.text()).slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    accessToken?: string;
    mdAccessToken?: string;
    userId?: number;
    name?: string;
    expirationTime?: string;
    errorText?: string;
    "p-ticket"?: string;
    "p-time"?: number;
  };

  if (data.errorText) {
    throw new Error(`Tradovate auth error: ${data.errorText}`);
  }
  if (data["p-ticket"]) {
    // Tradovate uses CAPTCHA-like flow-control when too many auth
    // requests hit in quick succession. We surface a clear error so the
    // operator reduces frequency or waits the returned p-time seconds.
    throw new Error(
      `Tradovate auth rate-limited. Wait ${data["p-time"] ?? "?"} seconds and retry.`
    );
  }
  if (!data.accessToken || !data.userId || !data.name) {
    throw new Error("Tradovate returned an incomplete auth response.");
  }

  return {
    accessToken: data.accessToken,
    mdAccessToken: data.mdAccessToken ?? null,
    userId: data.userId,
    name: data.name,
    expirationTime: data.expirationTime ?? ""
  };
}

/**
 * Extract Tradovate credentials from a McpServer config + secrets pair.
 * Returns null if any required field is missing — the caller surfaces a
 * "configure integration" error in that case.
 */
export function extractTradovateCredentials(
  config: Record<string, string>,
  secrets: Record<string, string>
): TradovateCredentials | null {
  const environment = config.environment === "live" ? "live" : "demo";
  const appId = config.app_id;
  const appVersion = config.app_version;
  const username = secrets.username;
  const password = secrets.password;
  const cid = secrets.cid;
  const sec = secrets.sec;

  if (!appId || !appVersion || !username || !password || !cid || !sec) {
    return null;
  }
  return { environment, appId, appVersion, username, password, cid, sec };
}

/**
 * Convenience wrapper: authed GET request.
 */
export async function tradovateGet(
  creds: TradovateCredentials,
  accessToken: string,
  path: string
): Promise<Response> {
  const host = tradovateHost(creds.environment);
  return fetch(`${host}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
}

/**
 * Convenience wrapper: authed POST request.
 */
export async function tradovatePost(
  creds: TradovateCredentials,
  accessToken: string,
  path: string,
  body: unknown
): Promise<Response> {
  const host = tradovateHost(creds.environment);
  return fetch(`${host}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
}
