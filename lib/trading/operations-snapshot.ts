import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import {
  extractTradovateCredentials,
  tradovateGet,
  withTradovateRetry
} from "@/lib/trading/tradovate-client";

/**
 * Unified operational snapshot for the Forex Desk. Merges data from:
 *   - OANDA live/practice endpoint (account summary + open positions)
 *   - Tradovate (account cashBalance snapshot + open positions)
 *   - Local ActivityEntry log (today's forex_order P&L, last N orders)
 *   - Local ApprovalRequest table (pending forex approvals)
 *
 * Designed to be polled every 30 seconds by the ForexOperationsPanel
 * without hammering the brokers — the broker calls are opportunistic
 * and fail silently on credential / network issues. Local DB data
 * always returns even when both brokers are unreachable.
 */

export type BrokerEquity = {
  broker: "oanda" | "tradovate";
  environment: string;
  balance: number | null;
  unrealizedPnl: number | null;
  availableMargin: number | null;
  currency: string;
  skipReason?: string;
};

export type OpenPosition = {
  broker: "oanda" | "tradovate";
  instrument: string;
  direction: "long" | "short" | "flat";
  units: number;
  avgPrice: number | null;
  unrealizedPnl: number | null;
};

export type RecentOrder = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  detail: string | null;
  broker: string | null;
  tradingMode: string | null;
};

export type OperationsSnapshot = {
  generatedAt: string;
  brokerEquity: BrokerEquity[];
  openPositions: OpenPosition[];
  todayRealizedPnl: number;
  recentOrders: RecentOrder[];
  pendingApprovals: number;
  pendingLive: number;
};

async function getServerRecord(
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

async function getOandaSnapshot(businessId: string): Promise<{
  equity: BrokerEquity;
  positions: OpenPosition[];
}> {
  const record = await getServerRecord(businessId, "oanda_forex");
  if (!record) {
    return {
      equity: {
        broker: "oanda",
        environment: "none",
        balance: null,
        unrealizedPnl: null,
        availableMargin: null,
        currency: "USD",
        skipReason: "OANDA integration not connected."
      },
      positions: []
    };
  }
  const { config, secrets } = record;
  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    return {
      equity: {
        broker: "oanda",
        environment: config.environment ?? "practice",
        balance: null,
        unrealizedPnl: null,
        availableMargin: null,
        currency: "USD",
        skipReason: "OANDA integration missing account_id or api_key."
      },
      positions: []
    };
  }

  const host =
    config.environment === "live"
      ? "https://api-fxtrade.oanda.com"
      : "https://api-fxpractice.oanda.com";

  try {
    const [summaryRes, positionsRes] = await Promise.all([
      fetch(`${host}/v3/accounts/${encodeURIComponent(accountId)}/summary`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      }),
      fetch(
        `${host}/v3/accounts/${encodeURIComponent(accountId)}/openPositions`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
    ]);

    const summaryData = summaryRes.ok ? await summaryRes.json() : null;
    const positionsData = positionsRes.ok ? await positionsRes.json() : null;

    const account = summaryData?.account ?? null;
    const equity: BrokerEquity = {
      broker: "oanda",
      environment: config.environment ?? "practice",
      balance: account?.balance ? Number(account.balance) : null,
      unrealizedPnl: account?.unrealizedPL ? Number(account.unrealizedPL) : null,
      availableMargin: account?.marginAvailable
        ? Number(account.marginAvailable)
        : null,
      currency: account?.currency ?? "USD"
    };

    const rawPositions = (positionsData?.positions ?? []) as Array<{
      instrument: string;
      long?: { units: string; averagePrice?: string; unrealizedPL?: string };
      short?: { units: string; averagePrice?: string; unrealizedPL?: string };
    }>;
    const positions: OpenPosition[] = [];
    for (const pos of rawPositions) {
      const longUnits = Number(pos.long?.units ?? "0");
      const shortUnits = Number(pos.short?.units ?? "0");
      if (longUnits !== 0) {
        positions.push({
          broker: "oanda",
          instrument: pos.instrument,
          direction: "long",
          units: Math.abs(longUnits),
          avgPrice: pos.long?.averagePrice ? Number(pos.long.averagePrice) : null,
          unrealizedPnl: pos.long?.unrealizedPL
            ? Number(pos.long.unrealizedPL)
            : null
        });
      }
      if (shortUnits !== 0) {
        positions.push({
          broker: "oanda",
          instrument: pos.instrument,
          direction: "short",
          units: Math.abs(shortUnits),
          avgPrice: pos.short?.averagePrice
            ? Number(pos.short.averagePrice)
            : null,
          unrealizedPnl: pos.short?.unrealizedPL
            ? Number(pos.short.unrealizedPL)
            : null
        });
      }
    }

    return { equity, positions };
  } catch (err) {
    return {
      equity: {
        broker: "oanda",
        environment: config.environment ?? "practice",
        balance: null,
        unrealizedPnl: null,
        availableMargin: null,
        currency: "USD",
        skipReason: err instanceof Error ? err.message : "OANDA request failed."
      },
      positions: []
    };
  }
}

async function getTradovateSnapshot(businessId: string): Promise<{
  equity: BrokerEquity;
  positions: OpenPosition[];
}> {
  const record = await getServerRecord(businessId, "tradovate_futures");
  if (!record) {
    return {
      equity: {
        broker: "tradovate",
        environment: "none",
        balance: null,
        unrealizedPnl: null,
        availableMargin: null,
        currency: "USD",
        skipReason: "Tradovate integration not connected."
      },
      positions: []
    };
  }
  const { config, secrets } = record;
  const creds = extractTradovateCredentials(config, secrets);
  if (!creds) {
    return {
      equity: {
        broker: "tradovate",
        environment: config.environment ?? "demo",
        balance: null,
        unrealizedPnl: null,
        availableMargin: null,
        currency: "USD",
        skipReason: "Tradovate integration missing credentials."
      },
      positions: []
    };
  }

  try {
    // account list → pick first → parallel: cashBalanceSnapshot + position list
    const listRes = await withTradovateRetry(creds, (token) =>
      tradovateGet(creds, token, "/account/list")
    );
    if (!listRes.ok) {
      return {
        equity: {
          broker: "tradovate",
          environment: creds.environment,
          balance: null,
          unrealizedPnl: null,
          availableMargin: null,
          currency: "USD",
          skipReason: `Tradovate /account/list error ${listRes.status}`
        },
        positions: []
      };
    }
    const accounts = (await listRes.json()) as Array<{ id: number }>;
    const accountId = accounts[0]?.id;
    if (!accountId) {
      return {
        equity: {
          broker: "tradovate",
          environment: creds.environment,
          balance: null,
          unrealizedPnl: null,
          availableMargin: null,
          currency: "USD",
          skipReason: "No Tradovate accounts on this user."
        },
        positions: []
      };
    }

    const [cashRes, posRes] = await Promise.all([
      withTradovateRetry(creds, (token) =>
        tradovateGet(
          creds,
          token,
          `/cashBalance/getcashbalancesnapshot?accountId=${accountId}`
        )
      ),
      withTradovateRetry(creds, (token) =>
        tradovateGet(creds, token, `/position/list?accountId=${accountId}`)
      )
    ]);

    const cashData = cashRes.ok
      ? ((await cashRes.json()) as {
          totalCashValue?: number;
          openPL?: number;
          totalMarginAvailable?: number;
          currency?: string;
        })
      : null;

    const equity: BrokerEquity = {
      broker: "tradovate",
      environment: creds.environment,
      balance:
        typeof cashData?.totalCashValue === "number"
          ? cashData.totalCashValue
          : null,
      unrealizedPnl:
        typeof cashData?.openPL === "number" ? cashData.openPL : null,
      availableMargin:
        typeof cashData?.totalMarginAvailable === "number"
          ? cashData.totalMarginAvailable
          : null,
      currency: cashData?.currency ?? "USD"
    };

    const rawPositions = posRes.ok
      ? ((await posRes.json()) as Array<{
          contractId: number;
          netPos: number;
          avgPrice?: number;
          openPL?: number;
        }>)
      : [];

    // Resolve contract ids → symbols in parallel (cheap, cached server-side
    // at Tradovate).
    const positions: OpenPosition[] = [];
    for (const pos of rawPositions) {
      if (pos.netPos === 0) continue;
      let instrument = `contract#${pos.contractId}`;
      try {
        const contractRes = await withTradovateRetry(creds, (token) =>
          tradovateGet(creds, token, `/contract/item?id=${pos.contractId}`)
        );
        if (contractRes.ok) {
          const contract = (await contractRes.json()) as { name?: string };
          if (contract?.name) instrument = contract.name;
        }
      } catch {
        // keep fallback
      }
      positions.push({
        broker: "tradovate",
        instrument,
        direction: pos.netPos > 0 ? "long" : "short",
        units: Math.abs(pos.netPos),
        avgPrice: typeof pos.avgPrice === "number" ? pos.avgPrice : null,
        unrealizedPnl: typeof pos.openPL === "number" ? pos.openPL : null
      });
    }

    return { equity, positions };
  } catch (err) {
    return {
      equity: {
        broker: "tradovate",
        environment: creds.environment,
        balance: null,
        unrealizedPnl: null,
        availableMargin: null,
        currency: "USD",
        skipReason: err instanceof Error ? err.message : "Tradovate request failed."
      },
      positions: []
    };
  }
}

/**
 * Produce the unified snapshot. Broker calls run in parallel; DB calls
 * run sequentially after (Prisma prefers it that way under sqlite — for
 * postgres we'd parallelize these too but the data is lightweight).
 */
export async function getForexOperationsSnapshot(
  businessId: string
): Promise<OperationsSnapshot> {
  const [oanda, tradovate] = await Promise.all([
    getOandaSnapshot(businessId),
    getTradovateSnapshot(businessId)
  ]);

  // Today's realized P&L from completed forex_order ActivityEntries
  // bucketed by broker day (17:00 NY). Reuse the helper — but we only
  // need today's total, not the full histogram.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  // A day-and-a-half window is enough to cover the broker-day roll.
  const windowStart = new Date(Date.now() - 36 * 60 * 60 * 1000);

  const todayEntries = await db.activityEntry.findMany({
    where: {
      businessId,
      type: "forex_order",
      status: "completed",
      createdAt: { gte: windowStart }
    },
    select: { createdAt: true, metadata: true }
  });

  // Broker-day bucketing. We inline the logic to avoid circular import
  // with prop-firm-headroom; format in NY tz and roll >=17:00 to next
  // day.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });
  function dayKey(d: Date): string {
    const parts = formatter.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    let hour = Number(get("hour"));
    if (!Number.isFinite(hour) || hour === 24) hour = 0;
    const base = new Date(
      Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")))
    );
    if (hour >= 17) base.setUTCDate(base.getUTCDate() + 1);
    return base.toISOString().slice(0, 10);
  }
  const todayKey = dayKey(new Date());
  let todayRealizedPnl = 0;
  for (const entry of todayEntries) {
    if (dayKey(entry.createdAt) !== todayKey) continue;
    const meta = entry.metadata as Record<string, unknown> | null;
    if (!meta) continue;
    const oandaPl =
      (meta.oandaResponse as { orderFillTransaction?: { pl?: string } } | undefined)
        ?.orderFillTransaction?.pl;
    if (typeof oandaPl === "string") {
      const n = Number(oandaPl);
      if (Number.isFinite(n)) todayRealizedPnl += n;
    }
    const tradovatePl = (
      meta.tradovateResponse as { orderFillTransaction?: { pl?: number } } | undefined
    )?.orderFillTransaction?.pl;
    if (typeof tradovatePl === "number" && Number.isFinite(tradovatePl)) {
      todayRealizedPnl += tradovatePl;
    }
  }

  const recentEntries = await db.activityEntry.findMany({
    where: { businessId, type: "forex_order" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      detail: true,
      metadata: true
    }
  });
  const recentOrders: RecentOrder[] = recentEntries.map((entry) => {
    const meta = entry.metadata as Record<string, unknown> | null;
    return {
      id: entry.id,
      title: entry.title,
      status: entry.status ?? "unknown",
      createdAt: entry.createdAt.toISOString(),
      detail: entry.detail,
      broker: typeof meta?.broker === "string" ? meta.broker : null,
      tradingMode:
        typeof meta?.tradingMode === "string" ? meta.tradingMode : null
    };
  });

  const [pendingApprovals, pendingLive] = await Promise.all([
    db.approvalRequest.count({
      where: {
        businessId,
        status: "pending",
        actionType: {
          in: ["place_forex_order", "place_futures_order", "close_forex_position", "modify_forex_order"]
        }
      }
    }),
    db.approvalRequest.count({
      where: {
        businessId,
        status: "pending",
        actionType: { in: ["place_forex_order", "place_futures_order"] }
      }
    })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    brokerEquity: [oanda.equity, tradovate.equity],
    openPositions: [...oanda.positions, ...tradovate.positions],
    todayRealizedPnl,
    recentOrders,
    pendingApprovals,
    pendingLive
  };
}
