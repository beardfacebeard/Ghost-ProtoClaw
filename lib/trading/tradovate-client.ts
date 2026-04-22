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
 * Phase 2e: in-memory token cache. Tradovate's access tokens live ~80
 * minutes. Re-exchanging credentials on every tool call added 150–250ms
 * of handshake latency and pointlessly hammered Tradovate's auth
 * endpoint — which rate-limits aggressively via the p-ticket CAPTCHA
 * flow when callers get too chatty.
 *
 * Cache key is a stable hash of the credential tuple (environment,
 * username, cid, app_id). We evict 2 minutes before the server-reported
 * expirationTime to avoid the edge case where the token has just
 * expired between our cache check and the outbound API call.
 *
 * The cache is module-local and process-local. In a multi-pod
 * deployment each pod has its own cache; that's fine because the
 * underlying token is still valid across pods — worst case is each pod
 * does its own auth exchange once every ~80 minutes.
 */
type CachedToken = { auth: TradovateAuth; expiresAtMs: number };
const TOKEN_CACHE = new Map<string, CachedToken>();

function cacheKey(creds: TradovateCredentials): string {
  return `${creds.environment}::${creds.username}::${creds.cid}::${creds.appId}`;
}

function parseExpirationMs(expirationTime: string): number | null {
  if (!expirationTime) return null;
  const parsed = Date.parse(expirationTime);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Exchange username+password+cid+sec for an access token. Returns the
 * auth payload or throws on failure (caller handles).
 *
 * Caches the returned token in-memory; subsequent calls with the same
 * credentials return the cached token until ~2 minutes before
 * expiration. Pass forceRefresh to bypass the cache.
 */
export async function getTradovateAccessToken(
  creds: TradovateCredentials,
  forceRefresh: boolean = false
): Promise<TradovateAuth> {
  const key = cacheKey(creds);
  const nowMs = Date.now();
  if (!forceRefresh) {
    const cached = TOKEN_CACHE.get(key);
    if (cached && cached.expiresAtMs - nowMs > 120_000) {
      return cached.auth;
    }
  }

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

  const auth: TradovateAuth = {
    accessToken: data.accessToken,
    mdAccessToken: data.mdAccessToken ?? null,
    userId: data.userId,
    name: data.name,
    expirationTime: data.expirationTime ?? ""
  };

  // Cache for future calls. If expirationTime isn't parseable, fall back
  // to a conservative 60-minute TTL (well under Tradovate's typical ~80).
  const expiresAtMs = parseExpirationMs(auth.expirationTime) ?? nowMs + 60 * 60 * 1000;
  TOKEN_CACHE.set(key, { auth, expiresAtMs });

  return auth;
}

/**
 * Evict a cached token. Call this if a tool call returns a 401 so the
 * next request re-authenticates instead of retrying with the bad token.
 */
export function evictTradovateToken(creds: TradovateCredentials): void {
  TOKEN_CACHE.delete(cacheKey(creds));
}

/**
 * Retry-on-401 helper. Pass a function that takes an access token and
 * performs a Tradovate request. If the first attempt returns 401, we
 * evict the cached token, re-auth, and try once more. Any other status
 * (including second-attempt failures) is returned as-is to the caller.
 *
 * Use this whenever you'd otherwise write getTradovateAccessToken →
 * fetch — it's drop-in and gives you self-healing behavior when the
 * cached token expired between the cache check and the API call.
 */
export async function withTradovateRetry(
  creds: TradovateCredentials,
  run: (accessToken: string) => Promise<Response>
): Promise<Response> {
  let auth = await getTradovateAccessToken(creds);
  let res = await run(auth.accessToken);
  if (res.status === 401) {
    evictTradovateToken(creds);
    auth = await getTradovateAccessToken(creds, true);
    res = await run(auth.accessToken);
  }
  return res;
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

/**
 * Build a Tradovate placeOSO body — primary MARKET order with a linked
 * STOP bracket for the hard protective stop and an optional LIMIT bracket
 * for the take-profit. "OSO" = One-Sends-Others: when the entry fills,
 * the brackets are live at the broker within the same transaction.
 *
 * This is the safety-critical path. Without this we were sending raw
 * MARKET orders and then trying to add a stop in a second API call — if
 * that second call failed the position was unprotected at the broker.
 */
export function buildTradovateBracketBody(args: {
  accountSpec: string;
  accountId: number;
  side: "buy" | "sell";
  symbol: string;
  contracts: number;
  stopPrice: number;
  takeProfitPrice: number | null;
}): Record<string, unknown> {
  const inverseAction = args.side === "buy" ? "Sell" : "Buy";
  const body: Record<string, unknown> = {
    accountSpec: args.accountSpec,
    accountId: args.accountId,
    action: args.side === "buy" ? "Buy" : "Sell",
    symbol: args.symbol,
    orderQty: args.contracts,
    orderType: "Market",
    isAutomated: true,
    bracket1: {
      action: inverseAction,
      orderType: "Stop",
      stopPrice: args.stopPrice,
      timeInForce: "GTC"
    }
  };
  if (args.takeProfitPrice !== null && Number.isFinite(args.takeProfitPrice)) {
    body.bracket2 = {
      action: inverseAction,
      orderType: "Limit",
      price: args.takeProfitPrice,
      timeInForce: "GTC"
    };
  }
  return body;
}
