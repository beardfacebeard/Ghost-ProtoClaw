import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import {
  extractTradovateCredentials,
  getTradovateAccessToken,
  tradovateGet,
  tradovatePost
} from "@/lib/trading/tradovate-client";

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
 * Flattens every open position on the business's connected Tradovate
 * account by submitting a market order in the opposite direction for the
 * current netPos. Called by the kill-switch route alongside the OANDA
 * flatten so US futures operators get broker-side protection too.
 *
 * Tradovate doesn't expose a single "close all" endpoint — we iterate
 * per position and submit an offsetting market order. Best-effort; we
 * never throw. Per-position outcomes surface in the kill-switch
 * response so the operator can spot-check manually.
 */
export async function flattenAllTradovatePositions(
  businessId: string
): Promise<FlattenResult> {
  const result: FlattenResult = {
    attempted: 0,
    closed: 0,
    failed: 0,
    details: []
  };

  const server =
    (await db.mcpServer.findFirst({
      where: {
        businessId,
        definitionId: "tradovate_futures",
        status: "active"
      }
    })) ??
    (await db.mcpServer.findFirst({
      where: {
        definitionId: "tradovate_futures",
        status: "active",
        businessId: null,
        organization: {
          businesses: { some: { id: businessId } }
        }
      }
    }));

  if (!server) {
    result.skipReason =
      "No Tradovate integration connected to this business. Existing positions (if any) stay open.";
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

  const creds = extractTradovateCredentials(config, secrets);
  if (!creds) {
    result.skipReason =
      "Tradovate integration missing required credentials (username, password, cid, sec).";
    return result;
  }

  try {
    const auth = await getTradovateAccessToken(creds);

    const listRes = await tradovateGet(creds, auth.accessToken, "/account/list");
    if (!listRes.ok) {
      result.skipReason = `Couldn't list Tradovate accounts (status ${listRes.status}).`;
      return result;
    }
    const accounts = (await listRes.json()) as Array<{ id: number }>;
    const accountId = accounts[0]?.id;
    if (!accountId) {
      result.skipReason = "No Tradovate accounts found on this user.";
      return result;
    }

    const posRes = await tradovateGet(
      creds,
      auth.accessToken,
      `/position/list?accountId=${accountId}`
    );
    if (!posRes.ok) {
      result.skipReason = `Couldn't list Tradovate positions (status ${posRes.status}).`;
      return result;
    }
    const positions = (await posRes.json()) as Array<{
      contractId: number;
      netPos: number;
    }>;
    const openPositions = positions.filter((p) => p.netPos !== 0);
    result.attempted = openPositions.length;

    // We need the contract symbol — Tradovate returns contractId in
    // /position/list. Fetch contract metadata for each.
    for (const pos of openPositions) {
      try {
        const contractRes = await tradovateGet(
          creds,
          auth.accessToken,
          `/contract/item?id=${pos.contractId}`
        );
        const contract = contractRes.ok
          ? ((await contractRes.json()) as { name?: string })
          : null;
        const symbol = contract?.name ?? `contractId:${pos.contractId}`;

        // Offsetting market order — if netPos > 0 we're long, send Sell;
        // if netPos < 0 we're short, send Buy.
        const action = pos.netPos > 0 ? "Sell" : "Buy";
        const qty = Math.abs(pos.netPos);

        const closeRes = await tradovatePost(
          creds,
          auth.accessToken,
          "/order/placeorder",
          {
            accountSpec: creds.username,
            accountId,
            action,
            symbol,
            orderQty: qty,
            orderType: "Market",
            isAutomated: true
          }
        );
        const closeData = await closeRes.json();
        if (closeRes.ok) {
          result.closed += 1;
          result.details.push({
            instrument: symbol,
            ok: true,
            note: `Closed ${qty} contracts (${action}).`
          });
        } else {
          result.failed += 1;
          result.details.push({
            instrument: symbol,
            ok: false,
            note: `status ${closeRes.status}: ${JSON.stringify(closeData).slice(0, 160)}`
          });
        }
      } catch (err) {
        result.failed += 1;
        result.details.push({
          instrument: `contractId:${pos.contractId}`,
          ok: false,
          note: err instanceof Error ? err.message : "unknown error"
        });
      }
    }
  } catch (err) {
    result.skipReason =
      err instanceof Error ? err.message : "Tradovate request failed.";
  }

  return result;
}
