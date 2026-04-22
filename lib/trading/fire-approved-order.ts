import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";

/**
 * Fires an approved place_forex_order against the OANDA live endpoint.
 *
 * Only called from the approval approve handler, AFTER the approval status
 * has flipped to "approved" and the reviewer email is recorded. If this
 * call fails (broker error, network, credential issue), we log the failure
 * to the ActivityEntry but do NOT roll back the approval — the operator
 * explicitly clicked Approve, so the decision is real; what failed is only
 * the execution, and they need to see the failure and decide whether to
 * re-fire manually.
 */
export async function fireApprovedForexOrder(args: {
  approvalId: string;
  businessId: string;
  actionDetail: unknown;
}): Promise<{ ok: boolean; detail: string }> {
  const intent = (args.actionDetail ?? {}) as Record<string, unknown>;
  const instrument = typeof intent.instrument === "string" ? intent.instrument : "";
  const signedUnits =
    typeof intent.signedUnits === "number"
      ? intent.signedUnits
      : typeof intent.units === "number"
        ? intent.side === "sell"
          ? -Number(intent.units)
          : Number(intent.units)
        : 0;
  const stopLossPrice =
    typeof intent.stopLossPrice === "number" ? intent.stopLossPrice : null;
  const takeProfitPrice =
    typeof intent.takeProfitPrice === "number" ? intent.takeProfitPrice : null;
  const activityEntryId =
    typeof intent.activityEntryId === "string" ? intent.activityEntryId : null;

  if (!instrument || !Number.isFinite(signedUnits) || signedUnits === 0 || stopLossPrice === null) {
    return {
      ok: false,
      detail:
        "Order intent is missing required fields (instrument, signed units, stop-loss). Will not fire. Inspect the approval detail and either re-propose or close this approval manually."
    };
  }

  // Resolve OANDA credentials for this business. We use the business-scoped
  // McpServer record for oanda_forex — the same one that served Phase 2a's
  // read-only calls. This enforces the per-business credential model.
  const server = await db.mcpServer.findFirst({
    where: {
      businessId: args.businessId,
      definitionId: "oanda_forex",
      status: "active"
    }
  });

  // Fall back to organization-scoped credentials if no business-specific
  // integration exists. Safe because we still gate by businessId above when
  // reading the approval itself.
  const fallbackServer = server
    ? null
    : await db.mcpServer.findFirst({
        where: {
          definitionId: "oanda_forex",
          status: "active",
          businessId: null,
          organization: {
            businesses: { some: { id: args.businessId } }
          }
        }
      });

  const resolved = server ?? fallbackServer;
  if (!resolved) {
    return {
      ok: false,
      detail:
        "OANDA integration is not connected. Install the OANDA v20 integration before approving live orders — otherwise the approve click can't actually fire anything."
    };
  }

  const config: Record<string, string> = {};
  if (
    resolved.config &&
    typeof resolved.config === "object" &&
    !Array.isArray(resolved.config)
  ) {
    for (const [k, v] of Object.entries(resolved.config)) {
      if (typeof v === "string") config[k] = v;
    }
  }

  const secrets: Record<string, string> = {};
  if (
    resolved.encryptedConfig &&
    typeof resolved.encryptedConfig === "object" &&
    !Array.isArray(resolved.encryptedConfig)
  ) {
    const key = getEncryptionKey();
    for (const [k, v] of Object.entries(resolved.encryptedConfig)) {
      if (typeof v === "string") {
        try {
          secrets[k] = decryptSecret(v, key);
        } catch {
          // Skip unreadable secrets
        }
      }
    }
  }

  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  const environment = config.environment === "live" ? "live" : "practice";

  if (!accountId || !apiKey) {
    return {
      ok: false,
      detail:
        "OANDA is installed but missing account_id or api_key. Re-save the integration configuration."
    };
  }

  // Defensive: approving a live-mode order against a practice-configured
  // OANDA integration is a configuration inconsistency — we log and refuse.
  if (environment !== "live") {
    return {
      ok: false,
      detail:
        "OANDA integration is configured for 'practice' but this approval was for live mode. Switch OANDA environment to 'live' in Integrations, then re-approve."
    };
  }

  const host = "https://api-fxtrade.oanda.com";
  const orderBody = {
    order: {
      type: "MARKET",
      instrument,
      units: String(signedUnits),
      timeInForce: "FOK",
      positionFill: "DEFAULT",
      stopLossOnFill: {
        price: stopLossPrice.toFixed(5),
        timeInForce: "GTC"
      },
      ...(takeProfitPrice !== null
        ? {
            takeProfitOnFill: {
              price: takeProfitPrice.toFixed(5),
              timeInForce: "GTC"
            }
          }
        : {})
    }
  };

  try {
    const res = await fetch(
      `${host}/v3/accounts/${encodeURIComponent(accountId)}/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderBody)
      }
    );
    const data = await res.json();

    // Update the linked ActivityEntry (if any) with the fill result. Status
    // goes to "completed" on success, "failed" otherwise.
    if (activityEntryId) {
      await db.activityEntry.update({
        where: { id: activityEntryId },
        data: {
          status: res.ok ? "completed" : "failed",
          metadata: {
            ...(intent as Record<string, unknown>),
            oandaResponse: data,
            firedAt: new Date().toISOString(),
            firedByApprovalId: args.approvalId
          }
        }
      });
    }

    if (!res.ok) {
      return {
        ok: false,
        detail: `OANDA live endpoint rejected the order (${res.status}): ${JSON.stringify(data).slice(0, 300)}`
      };
    }

    const fill = data.orderFillTransaction;
    return {
      ok: true,
      detail: fill
        ? `Order filled: ${fill.instrument} ${fill.units} @ ${fill.price}. Transaction id ${fill.id}.`
        : "Order accepted by OANDA."
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
      detail: `OANDA live fire failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
}
