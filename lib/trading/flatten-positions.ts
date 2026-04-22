import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";

type FlattenResult = {
  attempted: number;
  closed: number;
  failed: number;
  details: Array<{
    instrument: string;
    ok: boolean;
    note: string;
  }>;
  skipReason?: string;
};

/**
 * Flattens every open OANDA position on a business's connected account.
 * Called by the kill-switch route AFTER the business's tradingMode has
 * been forced back to research.
 *
 * Strategy: fetch the full list of open positions from OANDA, then issue
 * a PUT /positions/{instrument}/close with longUnits=ALL, shortUnits=ALL
 * for each. Best-effort — we never throw. The caller gets a structured
 * result with per-instrument outcomes so super-admins can see what
 * cleared and what didn't.
 *
 * In Phase 2c this only knows about OANDA. Tradovate + IBKR flatten gets
 * added in Phase 2d alongside those broker adapters.
 */
export async function flattenAllOandaPositions(
  businessId: string
): Promise<FlattenResult> {
  const result: FlattenResult = {
    attempted: 0,
    closed: 0,
    failed: 0,
    details: []
  };

  // Find the business's OANDA integration (scoped to the business first,
  // then fall back to org-wide).
  const server =
    (await db.mcpServer.findFirst({
      where: {
        businessId,
        definitionId: "oanda_forex",
        status: "active"
      }
    })) ??
    (await db.mcpServer.findFirst({
      where: {
        definitionId: "oanda_forex",
        status: "active",
        businessId: null,
        organization: {
          businesses: { some: { id: businessId } }
        }
      }
    }));

  if (!server) {
    result.skipReason =
      "No OANDA integration connected to this business. Existing positions (if any) stay open.";
    return result;
  }

  const config: Record<string, string> = {};
  if (
    server.config &&
    typeof server.config === "object" &&
    !Array.isArray(server.config)
  ) {
    for (const [k, v] of Object.entries(server.config)) {
      if (typeof v === "string") config[k] = v;
    }
  }

  const secrets: Record<string, string> = {};
  if (
    server.encryptedConfig &&
    typeof server.encryptedConfig === "object" &&
    !Array.isArray(server.encryptedConfig)
  ) {
    const key = getEncryptionKey();
    for (const [k, v] of Object.entries(server.encryptedConfig)) {
      if (typeof v === "string") {
        try {
          secrets[k] = decryptSecret(v, key);
        } catch {
          // skip
        }
      }
    }
  }

  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    result.skipReason = "OANDA integration missing account_id or api_key.";
    return result;
  }

  const host =
    config.environment === "live"
      ? "https://api-fxtrade.oanda.com"
      : "https://api-fxpractice.oanda.com";

  try {
    const openRes = await fetch(
      `${host}/v3/accounts/${encodeURIComponent(accountId)}/openPositions`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!openRes.ok) {
      result.skipReason = `Couldn't list OANDA open positions (status ${openRes.status}).`;
      return result;
    }
    const openData = (await openRes.json()) as {
      positions?: Array<{
        instrument: string;
        long?: { units: string };
        short?: { units: string };
      }>;
    };
    const positions = openData.positions ?? [];
    result.attempted = positions.length;

    for (const pos of positions) {
      const longOpen = pos.long?.units && pos.long.units !== "0";
      const shortOpen = pos.short?.units && pos.short.units !== "0";
      const body: Record<string, string> = {};
      if (longOpen) body.longUnits = "ALL";
      if (shortOpen) body.shortUnits = "ALL";
      if (Object.keys(body).length === 0) continue;

      try {
        const closeRes = await fetch(
          `${host}/v3/accounts/${encodeURIComponent(accountId)}/positions/${encodeURIComponent(pos.instrument)}/close`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }
        );
        const closeData = await closeRes.json();
        if (closeRes.ok) {
          result.closed += 1;
          result.details.push({
            instrument: pos.instrument,
            ok: true,
            note: "Closed."
          });
        } else {
          result.failed += 1;
          result.details.push({
            instrument: pos.instrument,
            ok: false,
            note: `status ${closeRes.status}: ${JSON.stringify(closeData).slice(0, 160)}`
          });
        }
      } catch (err) {
        result.failed += 1;
        result.details.push({
          instrument: pos.instrument,
          ok: false,
          note: err instanceof Error ? err.message : "unknown error"
        });
      }
    }
  } catch (err) {
    result.skipReason =
      err instanceof Error ? err.message : "OANDA request failed.";
  }

  return result;
}
