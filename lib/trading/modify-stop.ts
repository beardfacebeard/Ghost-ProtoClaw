import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";

type ModifyResult = {
  ok: boolean;
  detail: string;
  modified: number;
  errors: string[];
};

async function resolveOandaIntegration(businessId: string): Promise<null | {
  accountId: string;
  apiKey: string;
  host: string;
}> {
  const server =
    (await db.mcpServer.findFirst({
      where: { businessId, definitionId: "oanda_forex", status: "active" }
    })) ??
    (await db.mcpServer.findFirst({
      where: {
        definitionId: "oanda_forex",
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

  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) return null;

  const host =
    config.environment === "live"
      ? "https://api-fxtrade.oanda.com"
      : "https://api-fxpractice.oanda.com";

  return { accountId, apiKey, host };
}

/**
 * Modify the stop-loss (and optional take-profit) on EVERY open OANDA
 * trade for a given instrument + direction. A "position" in OANDA is
 * actually one or more trades — if an agent built the position in two
 * legs, both legs need the stop updated.
 *
 * Returns the count of modified trades + any per-trade errors. Best-
 * effort; does not throw.
 */
export async function modifyOandaStopNow(args: {
  businessId: string;
  instrument: string;
  direction: "long" | "short";
  newStopPrice: number;
  newTakeProfitPrice: number | null;
  liveMode: boolean;
}): Promise<ModifyResult> {
  const creds = await resolveOandaIntegration(args.businessId);
  if (!creds) {
    return {
      ok: false,
      detail: "OANDA integration not configured or missing credentials.",
      modified: 0,
      errors: []
    };
  }

  // Env alignment guard — same story as close-position.
  const envIsLive = creds.host.includes("api-fxtrade.oanda.com");
  if (args.liveMode !== envIsLive) {
    return {
      ok: false,
      detail: `OANDA integration environment does not match (${args.liveMode ? "live" : "paper"}). Switch environment in Integrations.`,
      modified: 0,
      errors: []
    };
  }

  try {
    const openTradesRes = await fetch(
      `${creds.host}/v3/accounts/${encodeURIComponent(creds.accountId)}/openTrades`,
      { headers: { Authorization: `Bearer ${creds.apiKey}` } }
    );
    if (!openTradesRes.ok) {
      return {
        ok: false,
        detail: `OANDA /openTrades error: ${openTradesRes.status}`,
        modified: 0,
        errors: []
      };
    }
    const tradesData = (await openTradesRes.json()) as {
      trades?: Array<{
        id: string;
        instrument: string;
        currentUnits: string;
      }>;
    };
    const allTrades = tradesData.trades ?? [];
    const matchingTrades = allTrades.filter((t) => {
      if (t.instrument !== args.instrument) return false;
      const units = Number(t.currentUnits);
      return args.direction === "long" ? units > 0 : units < 0;
    });

    if (matchingTrades.length === 0) {
      return {
        ok: false,
        detail: `No open ${args.direction} trades found for ${args.instrument}.`,
        modified: 0,
        errors: []
      };
    }

    const body: Record<string, unknown> = {
      stopLoss: { price: args.newStopPrice.toFixed(5), timeInForce: "GTC" }
    };
    if (
      args.newTakeProfitPrice !== null &&
      Number.isFinite(args.newTakeProfitPrice)
    ) {
      body.takeProfit = {
        price: args.newTakeProfitPrice.toFixed(5),
        timeInForce: "GTC"
      };
    }

    let modified = 0;
    const errors: string[] = [];
    for (const trade of matchingTrades) {
      try {
        const res = await fetch(
          `${creds.host}/v3/accounts/${encodeURIComponent(creds.accountId)}/trades/${encodeURIComponent(trade.id)}/orders`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${creds.apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }
        );
        if (res.ok) {
          modified += 1;
        } else {
          const data = await res.json();
          errors.push(
            `trade ${trade.id}: ${res.status} ${JSON.stringify(data).slice(0, 120)}`
          );
        }
      } catch (err) {
        errors.push(
          `trade ${trade.id}: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }

    if (modified > 0) {
      return {
        ok: true,
        detail: `Modified stop on ${modified}/${matchingTrades.length} trade(s)${errors.length > 0 ? ` · ${errors.length} errors` : ""}.`,
        modified,
        errors
      };
    }
    return {
      ok: false,
      detail: `All ${matchingTrades.length} modify attempts failed.`,
      modified,
      errors
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "OANDA modify failed.",
      modified: 0,
      errors: []
    };
  }
}
