import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import {
  extractTradovateCredentials,
  tradovateGet,
  tradovatePost,
  withTradovateRetry
} from "@/lib/trading/tradovate-client";

/**
 * Shared broker close-position helpers, extracted so both the kill-
 * switch flatten-all path and the operator-driven per-row "Close"
 * button can invoke them without the tradingMode gate (those upstream
 * callers enforce their own gates).
 */

type CloseResult = {
  ok: boolean;
  detail: string;
  brokerResponse?: unknown;
};

async function resolveIntegration(
  businessId: string,
  definitionId: string
): Promise<null | {
  config: Record<string, string>;
  secrets: Record<string, string>;
}> {
  const server =
    (await db.mcpServer.findFirst({
      where: { businessId, definitionId, status: "active" }
    })) ??
    (await db.mcpServer.findFirst({
      where: {
        definitionId,
        status: "active",
        businessId: null,
        organization: { businesses: { some: { id: businessId } } }
      }
    }));
  if (!server) return null;

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

  return { config, secrets };
}

export async function closeOandaPositionNow(args: {
  businessId: string;
  instrument: string;
  side: "long" | "short" | "both";
  units?: string;
  liveMode: boolean;
}): Promise<CloseResult> {
  const rec = await resolveIntegration(args.businessId, "oanda_forex");
  if (!rec) {
    return { ok: false, detail: "OANDA integration not connected." };
  }
  const { config, secrets } = rec;
  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    return { ok: false, detail: "OANDA integration missing credentials." };
  }

  const envIsLive = config.environment === "live";
  if (args.liveMode && !envIsLive) {
    return {
      ok: false,
      detail:
        "OANDA integration is configured for 'practice' but this close is targeting live. Switch environment to 'live' in Integrations."
    };
  }
  if (!args.liveMode && envIsLive) {
    return {
      ok: false,
      detail:
        "OANDA integration is configured for 'live' but this close is targeting paper. Switch environment to 'practice'."
    };
  }

  const host = envIsLive
    ? "https://api-fxtrade.oanda.com"
    : "https://api-fxpractice.oanda.com";

  const body: Record<string, string> = {};
  const units = args.units && args.units !== "" ? args.units : "ALL";
  if (args.side === "long" || args.side === "both") body.longUnits = units;
  if (args.side === "short" || args.side === "both") body.shortUnits = units;
  if (Object.keys(body).length === 0) {
    return { ok: false, detail: "No side selected for close." };
  }

  try {
    const res = await fetch(
      `${host}/v3/accounts/${encodeURIComponent(accountId)}/positions/${encodeURIComponent(args.instrument)}/close`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        detail: `OANDA close error (${res.status}): ${JSON.stringify(data).slice(0, 300)}`,
        brokerResponse: data
      };
    }
    return {
      ok: true,
      detail: `Closed ${args.instrument} (${args.side}).`,
      brokerResponse: data
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "OANDA close failed."
    };
  }
}

export async function closeTradovatePositionNow(args: {
  businessId: string;
  instrument: string;
  liveMode: boolean;
}): Promise<CloseResult> {
  const rec = await resolveIntegration(args.businessId, "tradovate_futures");
  if (!rec) {
    return { ok: false, detail: "Tradovate integration not connected." };
  }
  const creds = extractTradovateCredentials(rec.config, rec.secrets);
  if (!creds) {
    return { ok: false, detail: "Tradovate integration missing credentials." };
  }
  const envIsLive = creds.environment === "live";
  if (args.liveMode && !envIsLive) {
    return {
      ok: false,
      detail:
        "Tradovate integration is configured for 'demo' but this close is targeting live. Switch environment to 'live' in Integrations."
    };
  }
  if (!args.liveMode && envIsLive) {
    return {
      ok: false,
      detail:
        "Tradovate integration is configured for 'live' but this close is targeting paper. Switch environment to 'demo'."
    };
  }

  try {
    // list accounts → find position for this symbol → offsetting MARKET
    const listRes = await withTradovateRetry(creds, (t) =>
      tradovateGet(creds, t, "/account/list")
    );
    const accounts = listRes.ok
      ? ((await listRes.json()) as Array<{ id: number }>)
      : [];
    const accountId = accounts[0]?.id;
    if (!accountId) {
      return { ok: false, detail: "No Tradovate accounts found." };
    }

    const posRes = await withTradovateRetry(creds, (t) =>
      tradovateGet(creds, t, `/position/list?accountId=${accountId}`)
    );
    if (!posRes.ok) {
      return {
        ok: false,
        detail: `Tradovate /position/list error: ${posRes.status}`
      };
    }
    const positions = (await posRes.json()) as Array<{
      contractId: number;
      netPos: number;
    }>;

    // Resolve the contract by symbol name.
    let targetPos: (typeof positions)[0] | null = null;
    for (const pos of positions) {
      if (pos.netPos === 0) continue;
      try {
        const contractRes = await withTradovateRetry(creds, (t) =>
          tradovateGet(creds, t, `/contract/item?id=${pos.contractId}`)
        );
        if (contractRes.ok) {
          const contract = (await contractRes.json()) as { name?: string };
          if (contract?.name === args.instrument) {
            targetPos = pos;
            break;
          }
        }
      } catch {
        // skip
      }
    }

    if (!targetPos) {
      return {
        ok: false,
        detail: `No open Tradovate position found for ${args.instrument}.`
      };
    }

    const action = targetPos.netPos > 0 ? "Sell" : "Buy";
    const qty = Math.abs(targetPos.netPos);
    const res = await withTradovateRetry(creds, (t) =>
      tradovatePost(creds, t, "/order/placeorder", {
        accountSpec: creds.username,
        accountId,
        action,
        symbol: args.instrument,
        orderQty: qty,
        orderType: "Market",
        isAutomated: true
      })
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        detail: `Tradovate close error (${res.status}): ${JSON.stringify(data).slice(0, 300)}`,
        brokerResponse: data
      };
    }
    return {
      ok: true,
      detail: `Closed ${args.instrument} (${qty} contracts, ${action}).`,
      brokerResponse: data
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Tradovate close failed."
    };
  }
}
