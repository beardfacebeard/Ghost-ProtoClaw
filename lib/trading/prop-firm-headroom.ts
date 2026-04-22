import { db } from "@/lib/db";
import { estimateWorstCaseLossUsd } from "@/lib/trading/pip-values";

/**
 * Most prop firms reset the daily-DD counter at 17:00 America/New_York
 * (the standard FX server day). This helper returns the broker-day key
 * for a given timestamp.
 *
 * Phase 2e: uses Intl.DateTimeFormat with timeZone "America/New_York"
 * for a DST-correct calculation. We don't just subtract 5 hours any
 * more — that hack silently drifted by an hour for 8 months of the
 * year (March–November EDT) and mis-bucketed P&L around midnight NY.
 *
 * Strategy: format the input timestamp in America/New_York, parse back
 * the date+hour fields, and bucket such that 17:00–23:59 NY belongs to
 * the NEXT calendar day's broker session. That matches how OANDA,
 * FTMO, FundedNext, and Apex all report daily P&L.
 */
function brokerDayKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  // Intl can return "24" at midnight for hour12: false on some runtimes.
  if (!Number.isFinite(hour) || hour === 24) hour = 0;

  // The broker day "starts" at 17:00 NY — 17:00–23:59 belongs to the
  // NEXT session. Roll forward one day when hour >= 17.
  const base = new Date(Date.UTC(year, month - 1, day));
  if (hour >= 17) {
    base.setUTCDate(base.getUTCDate() + 1);
  }
  return base.toISOString().slice(0, 10);
}

/**
 * Per-rule headroom computed from the active PropFirmProfile + this
 * business's recent forex_order ActivityEntries. Each entry tells the
 * operator distance-to-bust in both dollars and basis points of the
 * starting balance, plus a warning tier (ok / watch / near / bust) so
 * the UI can colorize and the Prop-Firm Compliance Agent can decide
 * whether to block the next order.
 *
 * All math is deterministic. We never let an LLM compute the final
 * number that matters — this is the exact pattern the Forex KB describes.
 */

export type RuleHeadroom = {
  name: string;
  label: string;
  capPct: number;
  capUsd: number;
  consumedUsd: number;
  consumedPct: number;
  remainingUsd: number;
  remainingPct: number;
  warning: "ok" | "watch" | "near" | "bust";
  note?: string;
};

export type HeadroomSummary = {
  profileId: string;
  firmKey: string;
  planName: string;
  startingBalance: number;
  highWaterMark: number;
  currentEquity: number;
  rules: RuleHeadroom[];
  /**
   * Aggregate status across every rule. "bust" if any rule is busted,
   * "near" if any rule is at ≥ 90%, "watch" at ≥ 75%, "ok" otherwise.
   */
  overallWarning: "ok" | "watch" | "near" | "bust";
  // Useful for the UI when displaying the active profile meta.
  tradingDaysSoFar: number;
  minTradingDays: number;
};

type PropFirmRules = {
  profitTargetPct?: number | null;
  dailyDrawdown?: { pct: number };
  maxDrawdown?: {
    pct: number;
    type: "static" | "dynamic" | "trailing";
    lockAtPct?: number;
  };
  consistencyRule?: {
    bestDayCapPct: number;
  } | null;
  minTradingDays?: number;
};

function bucket(consumedPct: number): RuleHeadroom["warning"] {
  if (consumedPct >= 1.0) return "bust";
  if (consumedPct >= 0.9) return "near";
  if (consumedPct >= 0.75) return "watch";
  return "ok";
}

/**
 * Pulls daily P&L deltas from completed forex_order ActivityEntries for
 * the business, grouped by calendar day (operator's timezone is not
 * tracked yet — we group by UTC date, which the Phase 2d TZ work will fix).
 *
 * For Phase 2c we approximate P&L from the `oandaResponse.orderFillTransaction.pl`
 * field that the place_order handler records. Closes + modifies are more
 * complicated to attribute; the approximation is honest-within-margin for
 * dashboard purposes.
 */
async function getDailyPnlSince(
  businessId: string,
  since: Date
): Promise<Map<string, number>> {
  const entries = await db.activityEntry.findMany({
    where: {
      businessId,
      type: "forex_order",
      status: "completed",
      createdAt: { gte: since }
    },
    select: { createdAt: true, metadata: true }
  });

  const byDay = new Map<string, number>();
  for (const entry of entries) {
    const meta = entry.metadata as Record<string, unknown> | null;
    if (!meta) continue;
    const oandaResponse = meta.oandaResponse as
      | { orderFillTransaction?: { pl?: string } }
      | undefined;
    const pl = oandaResponse?.orderFillTransaction?.pl;
    if (typeof pl !== "string") continue;
    const plNum = Number(pl);
    if (!Number.isFinite(plNum)) continue;
    // Phase 2d: key by broker day (17:00 NY close), not UTC calendar day.
    // This matches how FTMO / Apex / OANDA bucket daily drawdown.
    const day = brokerDayKey(entry.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + plNum);
  }
  return byDay;
}

/**
 * Count of distinct calendar days on which this business had ≥ 1 completed
 * forex_order ActivityEntry. Used for the min-trading-days rule.
 */
async function getDistinctTradingDays(
  businessId: string,
  sinceProfileCreated: Date
): Promise<number> {
  const entries = await db.activityEntry.findMany({
    where: {
      businessId,
      type: "forex_order",
      status: "completed",
      createdAt: { gte: sinceProfileCreated }
    },
    select: { createdAt: true }
  });
  const days = new Set<string>();
  for (const entry of entries) {
    days.add(entry.createdAt.toISOString().slice(0, 10));
  }
  return days.size;
}

export async function getPropFirmHeadroom(
  businessId: string
): Promise<HeadroomSummary | null> {
  const profile = await db.propFirmProfile.findFirst({
    where: { businessId, isActive: true },
    orderBy: { createdAt: "desc" }
  });
  if (!profile) return null;

  const rules = (profile.rules ?? {}) as PropFirmRules;
  const startingBalance = profile.startingBalance;
  let highWaterMark = profile.highWaterMark;

  // Sum all completed-order P&L since the profile was attached → derived
  // equity. This is the fallback when no broker-reported equity is
  // available.
  const allTimePnl = await getDailyPnlSince(businessId, profile.createdAt);
  let runningPnl = 0;
  for (const v of allTimePnl.values()) runningPnl += v;
  const derivedEquity = startingBalance + runningPnl;

  // Phase 2h: broker-WEIGHTED equity. Match the PropFirmProfile's
  // firmKey to its expected broker (Apex/Topstep → Tradovate, FTMO /
  // FundedNext → OANDA) and use ONLY that broker's balance. The
  // previous Phase 2g behavior summed across connected brokers which
  // overstated HWM for multi-broker users (e.g. someone with both an
  // Apex Tradovate account and a personal OANDA account would see
  // OANDA balance inflating their Apex trailing drawdown).
  //
  // For firmKey "custom" (or any preset whose brokerKey === "any")
  // we fall back to the sum-across-brokers behavior, treating the
  // whole org as one economic pool.
  //
  // Derived equity remains a lower-bound guardrail so a freshly-
  // attached profile with no fills doesn't lock HWM below starting
  // balance just because a broker reports $0.
  let currentEquity = derivedEquity;
  try {
    const [{ getForexOperationsSnapshot }, { getBrokerKeyForFirm }] =
      await Promise.all([
        import("@/lib/trading/operations-snapshot"),
        import("@/lib/trading/prop-firm-presets")
      ]);
    const snapshot = await getForexOperationsSnapshot(businessId);
    const desiredBroker = getBrokerKeyForFirm(profile.firmKey);

    const matchingBalances = snapshot.brokerEquity
      .filter((e) => {
        if (typeof e.balance !== "number") return false;
        if (desiredBroker === "any") return true;
        return e.broker === desiredBroker;
      })
      .map((e) => e.balance as number);

    if (matchingBalances.length > 0) {
      const brokerTotal = matchingBalances.reduce((acc, n) => acc + n, 0);
      if (brokerTotal > 0) {
        currentEquity = Math.max(brokerTotal, derivedEquity);
      }
    }
  } catch {
    // Snapshot fetch failure is non-fatal — fall back to derivedEquity.
  }

  // HWM tick-forward. If the current equity exceeds the stored HWM,
  // bump the stored value so trailing-drawdown math is correct on the
  // next computation. Fire-and-forget; next call re-reads the update.
  if (currentEquity > highWaterMark) {
    const newHwm = currentEquity;
    void db.propFirmProfile
      .update({
        where: { id: profile.id },
        data: { highWaterMark: newHwm }
      })
      .catch(() => {
        // Silent — cache-like update, not a hard correctness requirement.
      });
    highWaterMark = newHwm;
  }

  const computed: RuleHeadroom[] = [];

  // Daily drawdown — uses today's P&L, bucketed by broker day (17:00 NY).
  if (rules.dailyDrawdown && rules.dailyDrawdown.pct > 0) {
    const today = brokerDayKey(new Date());
    const todayPnl = allTimePnl.get(today) ?? 0;
    const capUsd = startingBalance * rules.dailyDrawdown.pct;
    const consumedUsd = todayPnl < 0 ? Math.abs(todayPnl) : 0;
    const consumedPct = consumedUsd / (capUsd || 1);
    const remainingUsd = Math.max(0, capUsd - consumedUsd);
    const remainingPct = Math.max(0, 1 - consumedPct);
    computed.push({
      name: "dailyDrawdown",
      label: "Daily drawdown",
      capPct: rules.dailyDrawdown.pct,
      capUsd,
      consumedUsd,
      consumedPct,
      remainingUsd,
      remainingPct,
      warning: bucket(consumedPct),
      note: "Resets at broker daily close (UTC for now — tz-aware in Phase 2d)."
    });
  }

  // Max drawdown — three math variants.
  if (rules.maxDrawdown && rules.maxDrawdown.pct > 0) {
    const capPct = rules.maxDrawdown.pct;
    const type = rules.maxDrawdown.type;
    let floor: number;
    let floorLabel: string;
    if (type === "static") {
      floor = startingBalance * (1 - capPct);
      floorLabel = `Fixed floor ${floor.toFixed(2)}`;
    } else if (type === "dynamic") {
      floor = Math.max(startingBalance, currentEquity) * (1 - capPct);
      floorLabel = `Dynamic floor ${floor.toFixed(2)}`;
    } else {
      // trailing
      const lockAtEquity = startingBalance * (1 + (rules.maxDrawdown.lockAtPct ?? 0));
      const trailedFloor = highWaterMark - startingBalance * capPct;
      floor = currentEquity >= lockAtEquity ? startingBalance : trailedFloor;
      floorLabel =
        currentEquity >= lockAtEquity
          ? `Trailing floor LOCKED at breakeven (${startingBalance.toFixed(2)})`
          : `Trailing floor ${floor.toFixed(2)}`;
    }
    const capUsd = startingBalance * capPct;
    const consumedUsd = Math.max(0, startingBalance - currentEquity);
    const distanceToFloor = currentEquity - floor;
    const consumedPct = Math.max(0, 1 - distanceToFloor / (capUsd || 1));
    const remainingUsd = Math.max(0, distanceToFloor);
    const remainingPct = Math.max(0, 1 - consumedPct);
    computed.push({
      name: "maxDrawdown",
      label: `Max drawdown (${type})`,
      capPct,
      capUsd,
      consumedUsd,
      consumedPct,
      remainingUsd,
      remainingPct,
      warning: bucket(consumedPct),
      note: floorLabel
    });
  }

  // Consistency rule — single best day cannot exceed bestDayCapPct of total
  // profit. Only meaningful when there is profit; otherwise shows ok.
  if (rules.consistencyRule && rules.consistencyRule.bestDayCapPct > 0) {
    const capPct = rules.consistencyRule.bestDayCapPct;
    const totalProfit = Math.max(0, runningPnl);
    let bestDay = 0;
    for (const v of allTimePnl.values()) if (v > bestDay) bestDay = v;
    const allowedBestDay = totalProfit * capPct;
    const consumedPct =
      allowedBestDay > 0
        ? Math.min(1, bestDay / allowedBestDay)
        : 0;
    computed.push({
      name: "consistencyRule",
      label: "Consistency (best day %)",
      capPct,
      capUsd: allowedBestDay,
      consumedUsd: bestDay,
      consumedPct,
      remainingUsd: Math.max(0, allowedBestDay - bestDay),
      remainingPct: Math.max(0, 1 - consumedPct),
      warning: bucket(consumedPct),
      note:
        totalProfit > 0
          ? `Single-day cap: ${(capPct * 100).toFixed(0)}% of total profit (${totalProfit.toFixed(2)}).`
          : "No profit yet — consistency rule inactive."
    });
  }

  const tradingDaysSoFar = await getDistinctTradingDays(
    businessId,
    profile.createdAt
  );
  const minTradingDays = rules.minTradingDays ?? 0;

  const overall = computed.reduce<"ok" | "watch" | "near" | "bust">(
    (acc, r) => {
      const order = { ok: 0, watch: 1, near: 2, bust: 3 } as const;
      return order[r.warning] > order[acc] ? r.warning : acc;
    },
    "ok"
  );

  return {
    profileId: profile.id,
    firmKey: profile.firmKey,
    planName: profile.planName,
    startingBalance,
    highWaterMark,
    currentEquity,
    rules: computed,
    overallWarning: overall,
    tradingDaysSoFar,
    minTradingDays
  };
}

/**
 * Pre-trade check: would the proposed order's worst-case loss push any rule
 * over threshold? Returns { ok, reason } for the Risk Gate Agent to
 * consume. Worst-case loss is the simple approximation:
 *   worstCase = stopDistancePips * pipValue * units
 * where pipValue is 10 USD per 100k for most majors (rough — Phase 2d
 * improves with broker-side pip values).
 *
 * We approximate pipValue = 10 per 100k units (typical major-pair
 * convention). This is deliberately conservative for JPY pairs (pip
 * value is smaller) — pre-trade check over-reserves capital, which is
 * the safer side of the error.
 */
export async function checkPropFirmOrder(
  businessId: string,
  order: {
    instrument: string;
    entryPrice?: number;
    stopLossPrice: number;
    units: number;
    side: "buy" | "sell";
  }
): Promise<{ ok: boolean; reason?: string; worstCaseUsd?: number; headroom?: HeadroomSummary | null }> {
  const summary = await getPropFirmHeadroom(businessId);
  if (!summary) {
    return { ok: true, headroom: null };
  }

  // Phase 2d: broker-aware pip values for an accurate worst-case loss
  // estimate. JPY-quoted pairs have a different pip size and pip value
  // than USD-quoted pairs; the lookup table in lib/trading/pip-values.ts
  // handles this. If entryPrice isn't supplied, worstCaseUsd degenerates
  // to 0 and the check passes — the caller should supply an entry to get
  // a real read.
  const worstCaseUsd = estimateWorstCaseLossUsd({
    instrument: order.instrument,
    entryPrice: order.entryPrice ?? null,
    stopPrice: order.stopLossPrice,
    units: order.units
  });

  // Max-drawdown check: worst-case must fit inside remaining DD headroom.
  const dd = summary.rules.find((r) => r.name === "maxDrawdown");
  if (dd && dd.remainingUsd < worstCaseUsd) {
    return {
      ok: false,
      reason: `Order would exceed max-drawdown headroom. Worst-case loss ~$${worstCaseUsd.toFixed(2)}, remaining headroom $${dd.remainingUsd.toFixed(2)}.`,
      worstCaseUsd,
      headroom: summary
    };
  }
  const daily = summary.rules.find((r) => r.name === "dailyDrawdown");
  if (daily && daily.remainingUsd < worstCaseUsd) {
    return {
      ok: false,
      reason: `Order would exceed daily-drawdown headroom. Worst-case loss ~$${worstCaseUsd.toFixed(2)}, remaining daily headroom $${daily.remainingUsd.toFixed(2)}.`,
      worstCaseUsd,
      headroom: summary
    };
  }
  if (summary.overallWarning === "bust") {
    return {
      ok: false,
      reason:
        "A prop-firm rule is already busted. No new orders can be placed — this is a full stop until the profile is reset or a new challenge is purchased.",
      worstCaseUsd,
      headroom: summary
    };
  }

  return { ok: true, worstCaseUsd, headroom: summary };
}
