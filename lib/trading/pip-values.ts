/**
 * Pip-value lookup for forex pairs. Used by the prop-firm pre-trade check
 * to translate a stop-distance-in-pips into a worst-case USD loss.
 *
 * A "pip" is the smallest quoted increment in the convention of each pair:
 * 0.0001 for most pairs, 0.01 for JPY-quoted pairs (where the smallest
 * integer digit after the decimal is the pip).
 *
 * Pip value in USD per standard lot (100,000 units) of the base currency
 * depends on the quote currency of the pair:
 *   - USD-quoted (EUR/USD, GBP/USD, AUD/USD, NZD/USD): ~$10/pip
 *   - JPY-quoted (USD/JPY, EUR/JPY, GBP/JPY): ~$10/pip (at approx 110-160 USD/JPY)
 *   - Cross pairs where USD is not present (EUR/GBP, EUR/CHF): depends on
 *     the USD/quote rate — we approximate at $10 for majors and $8 for
 *     minor crosses. Phase 2e will look this up dynamically via OANDA's
 *     pricing endpoint for tight accuracy.
 *
 * For CFD FX and retail FX these conventions hold. For CME FX futures the
 * pip is 0.00005 or 0.000025 depending on the contract (tick sizes differ
 * by instrument) — use `getFuturesTickValue` instead.
 */

type PipMeta = {
  pipSize: number;
  pipValuePerStandardLot: number;
  note?: string;
};

const PIP_TABLE: Record<string, PipMeta> = {
  EUR_USD: { pipSize: 0.0001, pipValuePerStandardLot: 10 },
  GBP_USD: { pipSize: 0.0001, pipValuePerStandardLot: 10 },
  AUD_USD: { pipSize: 0.0001, pipValuePerStandardLot: 10 },
  NZD_USD: { pipSize: 0.0001, pipValuePerStandardLot: 10 },
  USD_CAD: {
    pipSize: 0.0001,
    pipValuePerStandardLot: 7.5,
    note: "~$7.50 at typical USD/CAD around 1.33"
  },
  USD_CHF: {
    pipSize: 0.0001,
    pipValuePerStandardLot: 11.2,
    note: "~$11.20 at typical USD/CHF around 0.89"
  },
  USD_JPY: {
    pipSize: 0.01,
    pipValuePerStandardLot: 6.5,
    note: "~$6.50 at typical USD/JPY around 155"
  },
  EUR_JPY: {
    pipSize: 0.01,
    pipValuePerStandardLot: 6.5
  },
  GBP_JPY: {
    pipSize: 0.01,
    pipValuePerStandardLot: 6.5
  },
  AUD_JPY: {
    pipSize: 0.01,
    pipValuePerStandardLot: 6.5
  },
  EUR_GBP: {
    pipSize: 0.0001,
    pipValuePerStandardLot: 12.7,
    note: "~$12.70 at typical GBP/USD around 1.27"
  },
  EUR_CHF: {
    pipSize: 0.0001,
    pipValuePerStandardLot: 11.2
  },
  GBP_CHF: {
    pipSize: 0.0001,
    pipValuePerStandardLot: 11.2
  }
};

/**
 * Normalize a pair identifier to underscore form (OANDA convention).
 * Accepts "EUR/USD", "EURUSD", "eur_usd" — all become "EUR_USD".
 */
export function normalizeInstrument(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (cleaned.length !== 6) return raw.toUpperCase();
  return `${cleaned.slice(0, 3)}_${cleaned.slice(3, 6)}`;
}

export function getPipSize(instrument: string): number {
  const key = normalizeInstrument(instrument);
  return PIP_TABLE[key]?.pipSize ?? 0.0001;
}

export function getPipValuePerStandardLot(instrument: string): number {
  const key = normalizeInstrument(instrument);
  return PIP_TABLE[key]?.pipValuePerStandardLot ?? 10;
}

/**
 * Convert a stop-distance (in price units, the difference between entry
 * price and stop price) into a USD loss estimate for a proposed position.
 */
export function estimateWorstCaseLossUsd(args: {
  instrument: string;
  entryPrice: number | null;
  stopPrice: number;
  units: number;
}): number {
  const { instrument, entryPrice, stopPrice, units } = args;
  if (!Number.isFinite(stopPrice) || !Number.isFinite(units) || units <= 0) {
    return 0;
  }
  // If entryPrice isn't supplied, we don't know the distance; return 0 and
  // let the Risk Gate decide. (Conservative — it forces the agent to pass
  // an entry price if it wants a real check.)
  if (!Number.isFinite(entryPrice ?? NaN)) return 0;

  const pipSize = getPipSize(instrument);
  const pipValuePerStandardLot = getPipValuePerStandardLot(instrument);
  const distance = Math.abs((entryPrice as number) - stopPrice);
  const pips = distance / pipSize;
  return (pips * pipValuePerStandardLot * units) / 100_000;
}

/**
 * CME FX futures tick values. Used when the pre-trade check runs on a
 * Tradovate / IBKR futures order rather than a retail spot OANDA order.
 *
 * Tick value = dollars per minimum price movement. CME 6E (EUR/USD
 * futures) has a tick of 0.00005 = $6.25. CME 6J (JPY) is 0.0000005 =
 * $6.25. CME 6B (GBP) tick 0.0001 = $6.25. E-micro versions are 1/10th.
 */
const FUTURES_TICK_TABLE: Record<string, { tick: number; tickValueUsd: number }> = {
  // Full-size CME FX futures
  "6E": { tick: 0.00005, tickValueUsd: 6.25 },
  "6B": { tick: 0.0001, tickValueUsd: 6.25 },
  "6J": { tick: 0.0000005, tickValueUsd: 6.25 },
  "6A": { tick: 0.0001, tickValueUsd: 10 },
  "6C": { tick: 0.0001, tickValueUsd: 10 },
  "6S": { tick: 0.0001, tickValueUsd: 12.5 },
  "6N": { tick: 0.0001, tickValueUsd: 10 },
  // E-micro CME FX futures (M prefix)
  M6E: { tick: 0.0001, tickValueUsd: 1.25 },
  M6B: { tick: 0.0001, tickValueUsd: 0.625 },
  M6A: { tick: 0.0001, tickValueUsd: 1 }
};

export function getFuturesTickValue(symbol: string): number {
  const key = symbol.toUpperCase();
  return FUTURES_TICK_TABLE[key]?.tickValueUsd ?? 10;
}

export function getFuturesTickSize(symbol: string): number {
  const key = symbol.toUpperCase();
  return FUTURES_TICK_TABLE[key]?.tick ?? 0.0001;
}

export function estimateFuturesWorstCaseLossUsd(args: {
  symbol: string;
  entryPrice: number;
  stopPrice: number;
  contracts: number;
}): number {
  const { symbol, entryPrice, stopPrice, contracts } = args;
  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(stopPrice) ||
    !Number.isFinite(contracts) ||
    contracts <= 0
  ) {
    return 0;
  }
  const tick = getFuturesTickSize(symbol);
  const tickValue = getFuturesTickValue(symbol);
  const ticks = Math.abs(entryPrice - stopPrice) / tick;
  return ticks * tickValue * contracts;
}
