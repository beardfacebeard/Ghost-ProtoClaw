import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import {
  buildTradovateBracketBody,
  extractTradovateCredentials,
  getTradovateAccessToken,
  tradovateGet,
  tradovatePost
} from "@/lib/trading/tradovate-client";

/**
 * Fires an approved place_futures_order against the Tradovate live
 * endpoint. Same pattern as fire-approved-order.ts (OANDA) — called
 * from the approval approve handler after the approval status has
 * flipped to "approved".
 *
 * If the fire fails (broker error, network, credential issue), we log
 * it to the linked ActivityEntry and return { ok: false, detail } — the
 * approval stays approved because the operator's click is the decision.
 */
export async function fireApprovedFuturesOrder(args: {
  approvalId: string;
  businessId: string;
  actionDetail: unknown;
}): Promise<{ ok: boolean; detail: string }> {
  const intent = (args.actionDetail ?? {}) as Record<string, unknown>;
  const symbol = typeof intent.symbol === "string" ? intent.symbol : "";
  const side = typeof intent.side === "string" ? intent.side : "";
  const contracts =
    typeof intent.contracts === "number" ? intent.contracts : NaN;
  const stopLossPrice =
    typeof intent.stopLossPrice === "number" ? intent.stopLossPrice : NaN;
  const takeProfitPrice =
    typeof intent.takeProfitPrice === "number" ? intent.takeProfitPrice : null;
  const activityEntryId =
    typeof intent.activityEntryId === "string" ? intent.activityEntryId : null;

  if (!symbol || !side || !Number.isFinite(contracts) || contracts <= 0) {
    return {
      ok: false,
      detail:
        "Order intent is missing required fields (symbol, side, contracts). Won't fire."
    };
  }
  if (!Number.isFinite(stopLossPrice)) {
    return {
      ok: false,
      detail:
        "Order intent is missing a numeric stopLossPrice. Phase 2e refuses to fire unprotected live futures orders — edit or re-propose the order with a stop."
    };
  }

  // Resolve Tradovate credentials from the business's McpServer.
  const server =
    (await db.mcpServer.findFirst({
      where: {
        businessId: args.businessId,
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
          businesses: { some: { id: args.businessId } }
        }
      }
    }));

  if (!server) {
    return {
      ok: false,
      detail:
        "Tradovate integration not connected. Install it before approving live futures orders."
    };
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
    return {
      ok: false,
      detail:
        "Tradovate integration is missing required fields. Re-save the integration configuration."
    };
  }
  if (creds.environment !== "live") {
    return {
      ok: false,
      detail:
        "Tradovate integration is configured for 'demo' but this approval is for live execution. Switch environment to 'live' and re-approve."
    };
  }

  try {
    const auth = await getTradovateAccessToken(creds);
    const listRes = await tradovateGet(creds, auth.accessToken, "/account/list");
    const accounts = listRes.ok
      ? ((await listRes.json()) as Array<{ id: number }>)
      : [];
    const accountId = accounts[0]?.id;
    if (!accountId) {
      return {
        ok: false,
        detail: "No Tradovate accounts found on the live endpoint."
      };
    }

    // Phase 2e: placeOSO attaches protective stop + optional take-profit
    // to the fill atomically at the broker. Required — we refused
    // earlier if stopLossPrice was missing.
    const body = buildTradovateBracketBody({
      accountSpec: creds.username,
      accountId,
      side: side === "buy" ? "buy" : "sell",
      symbol,
      contracts,
      stopPrice: stopLossPrice,
      takeProfitPrice
    });

    const res = await tradovatePost(creds, auth.accessToken, "/order/placeoso", body);
    const data = await res.json();

    if (activityEntryId) {
      await db.activityEntry.update({
        where: { id: activityEntryId },
        data: {
          status: res.ok ? "completed" : "failed",
          metadata: {
            ...(intent as Record<string, unknown>),
            tradovateResponse: data,
            firedAt: new Date().toISOString(),
            firedByApprovalId: args.approvalId
          }
        }
      });
    }

    if (!res.ok) {
      return {
        ok: false,
        detail: `Tradovate live placeorder rejected (${res.status}): ${JSON.stringify(data).slice(0, 300)}`
      };
    }
    return {
      ok: true,
      detail: `Futures order accepted by Tradovate: ${symbol} ${side} ${contracts} contracts. Order id: ${data?.orderId ?? "unknown"}.`
    };
  } catch (err) {
    if (activityEntryId) {
      await db.activityEntry.update({
        where: { id: activityEntryId },
        data: {
          status: "failed",
          metadata: {
            ...(intent as Record<string, unknown>),
            firedAt: new Date().toISOString(),
            firedByApprovalId: args.approvalId,
            error: err instanceof Error ? err.message : "unknown error"
          }
        }
      });
    }
    return {
      ok: false,
      detail: `Tradovate live fire failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
}
