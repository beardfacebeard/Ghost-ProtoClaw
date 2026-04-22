/**
 * Prop-firm rule presets for the Forex Research & Execution Desk template.
 *
 * Each preset is a published rule set a user can select when attaching a
 * PropFirmProfile to their business. Selecting a preset copies the JSON into
 * the PropFirmProfile.rules column — the user can then customize individual
 * values for their specific plan.
 *
 * Rule semantics:
 * - dailyDrawdown.pct / maxDrawdown.pct: the firm's published cap, expressed
 *   as a fraction of starting balance (0.05 = 5%).
 * - maxDrawdown.type: "static" | "dynamic" | "trailing"
 *   static   — floor fixed at start (balance - pct × start)
 *   dynamic  — floor = max(startingBalance, currentEquity) × (1 - pct)
 *   trailing — floor tracks equity high-water-mark up, usually locks at
 *              breakeven once equity rises ≥ lockAt% above start
 * - consistencyRule: if set, best-day profit capped at bestDayCapPct of total
 *   profit (e.g. 0.30 means no single day can be > 30% of total P&L).
 * - minTradingDays: minimum number of distinct calendar days with trading
 *   activity required to qualify for payout.
 * - profitTargetPct: % gain required to pass a challenge phase; null if the
 *   plan has no target (funded live accounts typically don't).
 * - noWeekendHold: if true, all positions must be flat before weekend close.
 * - jurisdictionFit: ISO-ish codes of jurisdictions this firm accepts. Used
 *   by the Prop-Firm Compliance Agent to warn if the operator's declared
 *   jurisdiction is incompatible.
 *
 * Keep these presets factual and current. If a firm's rules change,
 * document the change date in the preset and bump version.
 */

export type PropFirmPreset = {
  firmKey: string;
  firmName: string;
  planName: string;
  summary: string;
  version: string;
  jurisdictionFit: string[];
  rules: {
    profitTargetPct: number | null;
    dailyDrawdown: { pct: number; notes?: string };
    maxDrawdown: {
      pct: number;
      type: "static" | "dynamic" | "trailing";
      lockAtPct?: number;
      notes?: string;
    };
    consistencyRule: {
      bestDayCapPct: number;
      notes?: string;
    } | null;
    minTradingDays: number;
    noWeekendHold: boolean;
    profitSplit: { traderPct: number; notes?: string };
    /**
     * Free-form notes about things that aren't one of the structured fields —
     * news-event restrictions, copy-trading bans, EA restrictions, per-trade
     * size caps, etc. The Prop-Firm Compliance Agent surfaces these to the
     * operator at profile attach time.
     */
    footnotes: string[];
  };
};

export const PROP_FIRM_PRESETS: PropFirmPreset[] = [
  {
    firmKey: "apex",
    firmName: "Apex Trader Funding",
    planName: "Apex $50k Performance Account",
    summary:
      "US-eligible futures prop firm. Trade CME futures including FX futures (6E, 6J, 6B). No daily drawdown — only trailing threshold. Relatively trader-friendly rule set.",
    version: "2026-01",
    jurisdictionFit: ["US", "UK", "EU", "AU", "CA", "SG", "OTHER"],
    rules: {
      profitTargetPct: 0.06,
      dailyDrawdown: {
        pct: 0.0,
        notes: "Apex has no daily drawdown cap — the trailing threshold is the only DD rule."
      },
      maxDrawdown: {
        pct: 0.05,
        type: "trailing",
        lockAtPct: 0.06,
        notes:
          "$2,500 trailing threshold on a $50k account. Trails equity high-water-mark up; locks at breakeven once balance hits +$2,600 profit."
      },
      consistencyRule: {
        bestDayCapPct: 0.3,
        notes:
          "For payout, no single trading day can account for more than 30% of total profit earned to date."
      },
      minTradingDays: 7,
      noWeekendHold: false,
      profitSplit: {
        traderPct: 1.0,
        notes: "First $25k of profit at 100% to trader; 90% after that."
      },
      footnotes: [
        "News trading is allowed but positions must close 2 minutes before and 2 minutes after scheduled high-impact releases in some plans — verify with your specific account.",
        "Futures-only (no spot FX / CFDs). The desk routes through Rithmic or Tradovate.",
        "Maximum contract limits scale with account size: $50k account caps at 10 micro futures or equivalent."
      ]
    }
  },
  {
    firmKey: "ftmo",
    firmName: "FTMO",
    planName: "FTMO Classic $100k — 2-Step Challenge",
    summary:
      "The original non-US prop firm. MT4/MT5-based, spot FX + CFDs. Non-US only (FTMO removed US traders in 2024–2025).",
    version: "2026-01",
    jurisdictionFit: ["UK", "EU", "AU", "CA", "SG", "OTHER"],
    rules: {
      profitTargetPct: 0.1,
      dailyDrawdown: {
        pct: 0.05,
        notes:
          "5% of starting balance, reset daily at server close (17:00 NY)."
      },
      maxDrawdown: {
        pct: 0.1,
        type: "static",
        notes: "10% of starting balance. Floor fixed at start; does not trail."
      },
      consistencyRule: null,
      minTradingDays: 4,
      noWeekendHold: false,
      profitSplit: {
        traderPct: 0.9,
        notes: "90% split for the trader once funded."
      },
      footnotes: [
        "2-step: Challenge phase targets 10% profit, Verification targets 5% profit, both with same DD rules.",
        "Leverage 1:100 on FX majors, 1:30 crosses, 1:20 commodities, 1:10 indices.",
        "News trading allowed.",
        "Swap-free Islamic accounts available on request — ask before buying."
      ]
    }
  },
  {
    firmKey: "fundednext",
    firmName: "FundedNext",
    planName: "FundedNext Stellar $100k — 1-Step",
    summary:
      "Non-US prop firm. Single-step challenges, flexible rules. cTrader + MT4/MT5.",
    version: "2026-01",
    jurisdictionFit: ["UK", "EU", "AU", "CA", "SG", "OTHER"],
    rules: {
      profitTargetPct: 0.1,
      dailyDrawdown: {
        pct: 0.03,
        notes:
          "3% daily drawdown on the Stellar 1-step plan (tighter than the classic 2-step)."
      },
      maxDrawdown: {
        pct: 0.06,
        type: "static",
        notes: "6% max overall drawdown, static floor from starting balance."
      },
      consistencyRule: null,
      minTradingDays: 5,
      noWeekendHold: false,
      profitSplit: {
        traderPct: 0.95,
        notes: "Up to 95% trader split after funding; scales with consistency."
      },
      footnotes: [
        "Stellar plan is 1-step: pass once, no verification phase.",
        "News-trading and overnight holds allowed on most plans.",
        "Multiple plan types exist (Stellar, Evaluation, Express, Instant) — double-check your specific plan's rules before relying on this preset."
      ]
    }
  },
  {
    firmKey: "topstep",
    firmName: "Topstep",
    planName: "Topstep $50k Trading Combine",
    summary:
      "US-eligible futures prop firm, oldest in the space. Strict daily loss limit, no drawdown lock.",
    version: "2026-01",
    jurisdictionFit: ["US", "UK", "EU", "AU", "CA", "SG", "OTHER"],
    rules: {
      profitTargetPct: 0.06,
      dailyDrawdown: {
        pct: 0.022,
        notes:
          "$1,100 daily loss limit on a $50k combine — ~2.2% of starting balance."
      },
      maxDrawdown: {
        pct: 0.04,
        type: "trailing",
        lockAtPct: 0.06,
        notes:
          "$2,000 trailing max drawdown. Trails equity high-water-mark up to the initial balance, then locks."
      },
      consistencyRule: null,
      minTradingDays: 5,
      noWeekendHold: true,
      profitSplit: {
        traderPct: 1.0,
        notes:
          "First $10k at 100%, then 90% after — subject to plan tier."
      },
      footnotes: [
        "Futures-only, US-eligible. Routes through Tradovate or Rithmic.",
        "Weekend-hold BANNED — all positions must flatten before Friday close.",
        "Max position limits scale with account size."
      ]
    }
  },
  {
    firmKey: "custom",
    firmName: "Custom",
    planName: "Custom Ruleset",
    summary:
      "Blank preset — fill in your own firm's rules if they're not in the preset list. The Prop-Firm Compliance Agent enforces whatever you enter.",
    version: "2026-01",
    jurisdictionFit: ["US", "UK", "EU", "AU", "CA", "SG", "JP", "OTHER"],
    rules: {
      profitTargetPct: 0.08,
      dailyDrawdown: { pct: 0.05 },
      maxDrawdown: { pct: 0.1, type: "static" },
      consistencyRule: null,
      minTradingDays: 5,
      noWeekendHold: false,
      profitSplit: { traderPct: 0.8 },
      footnotes: [
        "This is a blank preset — customize every field before saving to your PropFirmProfile."
      ]
    }
  }
];

export function getPresetByKey(firmKey: string): PropFirmPreset | null {
  return PROP_FIRM_PRESETS.find((preset) => preset.firmKey === firmKey) ?? null;
}

/**
 * Filter presets to those compatible with the operator's jurisdiction.
 * US operators see Apex and Topstep; non-US operators see FTMO, FundedNext,
 * and the others that accept them.
 */
export function listPresetsForJurisdiction(jurisdiction: string): PropFirmPreset[] {
  if (!jurisdiction) return PROP_FIRM_PRESETS;
  return PROP_FIRM_PRESETS.filter((preset) =>
    preset.jurisdictionFit.includes(jurisdiction)
  );
}
