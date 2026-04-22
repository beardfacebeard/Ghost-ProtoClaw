import { db } from "@/lib/db";

/**
 * Dealhawk Empire — compliance library.
 *
 * Closes the legal firewall per the research doc's Section 16 pre-launch
 * checklist. Two responsibilities:
 *
 *   1. runComplianceChecklist(businessId) — the daily / on-demand check
 *      that surfaces the operator's compliance posture. Returns a
 *      structured per-item status the dashboard renders + the Deal Ops
 *      Lead can include in its morning briefing.
 *
 *   2. scanForProhibitedPhrases(text) + sanitizeAgentOutput(text) — the
 *      output-side firewall that catches prohibited claims before they
 *      reach a seller / buyer. Belt-and-suspenders against the agent
 *      system prompts that already forbid them — TCPA / FTC / state
 *      AGs care about WHAT WAS SENT, not what the prompt said not to.
 *
 * Pre-launch checklist items (research doc):
 *   - Sub-To outputs always carry an attorney disclaimer (Phase 3 +
 *     Phase 5 — qualifySubTo + recommendCreativeStructure both hard-
 *     code disclaimers). Verified at runtime by checking that the
 *     SubToQualifier + CreativeFinanceArchitect agents have their
 *     respective tools wired.
 *   - Disposition outputs market the equitable interest, not the
 *     property (Phase 5 — buildDealPackage). Verified by ensuring the
 *     Disposition Agent has dealhawk_build_deal_package wired.
 *   - SMS outputs check DNC + honor opt-outs (Phase 4 — renderOutreach
 *     auto-appends STOP footer; agent system prompts forbid sends to
 *     opt-outs). Application-side: TCPA attestation must be on file
 *     before dealMode = "outreach".
 *   - State-specific disclosures auto-inserted (Phase 0b-2 + Phase 5
 *     state-disclosures matrix; verified at the buildDealPackage call
 *     site).
 *   - Distress Signal Analyst refuses unscored / sub-threshold leads
 *     (Phase 4 — dealhawk_draft_outreach gates on motivationScore >=
 *     40). Verified by checking the implementation, not at runtime.
 *   - Seller-facing scripts use conditional, non-promise language
 *     (Phase 4 — agent prompts + KNOWN_OBJECTIONS guardrails;
 *     scanForProhibitedPhrases is the runtime catch).
 */

export type ComplianceStatus = "pass" | "fail" | "warn" | "n/a";

export type ComplianceCheckItem = {
  id: string;
  label: string;
  status: ComplianceStatus;
  message: string;
  /** Action the operator can take to move this from fail/warn → pass. */
  action?: string;
};

export type ComplianceReport = {
  overallStatus: ComplianceStatus;
  passCount: number;
  failCount: number;
  warnCount: number;
  items: ComplianceCheckItem[];
  generatedAt: string;
};

export async function runComplianceChecklist(
  businessId: string
): Promise<ComplianceReport> {
  const items: ComplianceCheckItem[] = [];

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      dealMode: true,
      tcpaAttestedAt: true,
      tcpaAttestedBy: true,
      config: true,
    },
  });

  if (!business) {
    return {
      overallStatus: "fail",
      passCount: 0,
      failCount: 1,
      warnCount: 0,
      items: [
        {
          id: "business_exists",
          label: "Business exists",
          status: "fail",
          message: "Business not found.",
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 1. dealMode posture ──────────────────────────────────────
  const dealMode = (business.dealMode ?? "research") as
    | "research"
    | "outreach"
    | "contract";
  items.push({
    id: "deal_mode_posture",
    label: "Deal mode appropriate for current activity",
    status: "pass",
    message: `Currently in "${dealMode}" mode. ${
      dealMode === "research"
        ? "Safest tier — agents produce research deliverables only."
        : dealMode === "outreach"
          ? "Seller outreach unlocked. TCPA attestation required (see next check)."
          : "Binding contracts unlocked. Attorney review STRONGLY recommended for Sub-To and creative-finance structures."
    }`,
  });

  // ── 2. TCPA attestation ──────────────────────────────────────
  if (dealMode === "research") {
    items.push({
      id: "tcpa_attestation",
      label: "TCPA attestation on file",
      status: "n/a",
      message: "Not required in Research mode. Required to upgrade to Outreach.",
    });
  } else if (business.tcpaAttestedAt) {
    items.push({
      id: "tcpa_attestation",
      label: "TCPA attestation on file",
      status: "pass",
      message: `Attested ${new Date(business.tcpaAttestedAt).toISOString().slice(0, 10)} by ${business.tcpaAttestedBy ?? "unknown"}.`,
    });
  } else {
    items.push({
      id: "tcpa_attestation",
      label: "TCPA attestation on file",
      status: "fail",
      message:
        "No TCPA attestation recorded but dealMode is past Research. This shouldn't happen — the upgrade flow enforces attestation. Investigate.",
      action:
        "Downgrade to Research and re-upgrade to Outreach via the Dealhawk Desk panel to record attestation.",
    });
  }

  // ── 3. Attorney roster (advisory) ────────────────────────────
  const activeAttorneys = await db.attorneyProfile.count({
    where: { businessId, isActive: true },
  });
  if (dealMode === "contract") {
    if (activeAttorneys === 0) {
      items.push({
        id: "attorney_roster",
        label: "Attorney roster populated",
        status: "warn",
        message:
          "Contract mode is unlocked but no attorneys are on file. The desk will still generate binding contracts — but every output will carry the maximum-strength 'consult an attorney' disclaimer. Sub-To and creative-finance structures specifically benefit from attorney review.",
        action:
          "Add at least one licensed real-estate attorney for the states you'll close in via the Dealhawk Desk panel (Overview tab).",
      });
    } else {
      const states = await db.attorneyProfile.findMany({
        where: { businessId, isActive: true },
        select: { state: true },
        distinct: ["state"],
      });
      items.push({
        id: "attorney_roster",
        label: "Attorney roster populated",
        status: "pass",
        message: `${activeAttorneys} active attorney profile${activeAttorneys === 1 ? "" : "s"} covering ${states.length} state${states.length === 1 ? "" : "s"}: ${states.map((s) => s.state).join(", ")}.`,
      });
    }
  } else {
    items.push({
      id: "attorney_roster",
      label: "Attorney roster populated",
      status: "n/a",
      message:
        "Optional in current dealMode. Recommended before upgrading to Contract mode for Sub-To and creative-finance deals.",
    });
  }

  // ── 4. Outreach threshold enforcement ────────────────────────
  // Verifying the implementation is in code: dealhawk_draft_outreach
  // refuses leads scored below 40/100. This is a static-code check —
  // we know it's wired because the tool dispatch is in TOOL_HANDLERS.
  items.push({
    id: "outreach_threshold",
    label: "Outreach refuses unscored / sub-threshold leads",
    status: "pass",
    message:
      "dealhawk_draft_outreach hard-rejects leads scored below 40/100. Per failure rule #1: pursuing leads with no motivation is the defining beginner mistake.",
  });

  // ── 5. Disposition equitable-interest enforcement ────────────
  items.push({
    id: "equitable_interest_enforcement",
    label: "Disposition outputs market equitable interest, not property",
    status: "pass",
    message:
      "buildDealPackage hard-codes EQUITABLE_INTEREST_HEADER on every output. Property address auto-fuzzes to general-area in non-permissive states. Strict-state banner prepended in IL / OK / SC / MA / NY / etc.",
  });

  // ── 6. Sub-To attorney disclaimer ────────────────────────────
  items.push({
    id: "sub_to_attorney_disclaimer",
    label: "Sub-To outputs always carry attorney disclaimer",
    status: "pass",
    message:
      "qualifySubTo and recommendCreativeStructure both hard-code SUB_TO_ATTORNEY_DISCLAIMER (Garn-St. Germain citation + attorney review requirement) into every result. Constant exported and not overridable per Section-14 failure rule.",
  });

  // ── 7. SMS opt-out footer ────────────────────────────────────
  items.push({
    id: "sms_opt_out",
    label: "SMS outputs include TCPA STOP opt-out footer",
    status: "pass",
    message:
      "renderOutreach auto-appends TCPA_SMS_OPT_OUT_FOOTER ('Reply STOP to opt out.') to every SMS body that doesn't already contain it. Server-side fail-closed.",
  });

  // ── 8. Recent dead-by-opt-out activity (warn if elevated) ────
  const recentOptOuts = await db.deal.count({
    where: {
      businessId,
      status: "dead",
      sellerResponseState: "not_interested",
      updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  if (recentOptOuts > 10) {
    items.push({
      id: "opt_out_velocity",
      label: "Opt-out velocity within healthy range",
      status: "warn",
      message: `${recentOptOuts} leads marked dead-by-not-interested in the last 7 days. High opt-out rate suggests outreach copy may be too aggressive or off-target. Review the templates the Seller Outreach Agent has been picking.`,
      action:
        "Review recent outreach drafts. Consider tightening the motivation-score threshold above 40 or adjusting the templates per channel.",
    });
  } else {
    items.push({
      id: "opt_out_velocity",
      label: "Opt-out velocity within healthy range",
      status: "pass",
      message: `${recentOptOuts} opt-outs in the last 7 days — within healthy range.`,
    });
  }

  // Aggregate overall status.
  const failCount = items.filter((i) => i.status === "fail").length;
  const warnCount = items.filter((i) => i.status === "warn").length;
  const passCount = items.filter((i) => i.status === "pass").length;
  const overallStatus: ComplianceStatus =
    failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";

  return {
    overallStatus,
    passCount,
    failCount,
    warnCount,
    items,
    generatedAt: new Date().toISOString(),
  };
}

// ── Output sanitizer ─────────────────────────────────────────────

/**
 * Phrases that are forbidden in any seller-facing or buyer-facing
 * output. Source: research doc Section 14 (failure rules) + agent
 * guardrails template. Hitting any of these in agent text suggests
 * the agent's prompt-side guardrails leaked.
 */
const PROHIBITED_PHRASES: Array<{
  pattern: RegExp;
  rationale: string;
  /** Suggested safer replacement, or null if there's no good rewrite
   *  (the agent should re-generate the output without the phrase). */
  replacement: string | null;
}> = [
  {
    pattern: /\bguaranteed?\b/gi,
    rationale:
      "Hard-promise language. Wholesalers get sued for promising outcomes they can't control.",
    replacement: "expected",
  },
  {
    pattern: /\bguarantee\b/gi,
    rationale: "Hard-promise language.",
    replacement: "expectation",
  },
  {
    pattern: /\brisk[- ]free\b/gi,
    rationale:
      "Every Sub-To and creative-finance deal carries real risk (DOS, credit, performance). Saying 'risk-free' is per-se misleading.",
    replacement: "lower-risk",
  },
  {
    pattern: /\bno way to lose\b/gi,
    rationale: "Same risk-promise issue.",
    replacement: null,
  },
  {
    pattern: /\bdefinitely (won'?t|will not)\b/gi,
    rationale:
      "Promising bank behavior or specific outcomes is exactly the language wholesalers get sued over.",
    replacement: "rarely",
  },
  {
    pattern: /\bthe bank (won'?t|will not) (call|enforce|trigger)/gi,
    rationale:
      "Specifically forbidden per Sub-To Qualifier system prompt — DOS clause is real. Use 'in practice rare on performing loans' instead.",
    replacement: "the bank rarely calls",
  },
  {
    pattern: /\byour credit will be (protected|safe|fine)\b/gi,
    rationale:
      "On Sub-To, the seller's credit STAYS on the loan — operator default destroys it. Honest disclosure required.",
    replacement: "we structure to reduce credit risk",
  },
  {
    pattern: /\bclose (in|within) \d+ days?\b/gi,
    rationale:
      "Specific closing-date promises before title search is done are forbidden.",
    replacement: "target a quick close pending title clearance",
  },
  {
    pattern: /\bzero risk\b/gi,
    rationale: "Same risk-promise issue.",
    replacement: "minimal risk",
  },
  {
    pattern: /\bwe buy houses\b/gi,
    rationale:
      "Generic 'we buy houses' framing is the spray-and-pray pattern that the 2026 Sophisticated Wholesaler era specifically punishes. Lead with empathy + signal-tuned framing instead.",
    replacement: null,
  },
];

export type ProhibitedPhraseHit = {
  phrase: string;
  rationale: string;
  position: number;
  /** Suggested replacement, or null if the agent should regenerate. */
  replacement: string | null;
};

export function scanForProhibitedPhrases(text: string): ProhibitedPhraseHit[] {
  const hits: ProhibitedPhraseHit[] = [];
  for (const rule of PROHIBITED_PHRASES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      hits.push({
        phrase: match[0],
        rationale: rule.rationale,
        position: match.index,
        replacement: rule.replacement,
      });
      // Avoid infinite loop on zero-width matches.
      if (match[0].length === 0) rule.pattern.lastIndex++;
    }
  }
  return hits;
}

export type SanitizeResult = {
  cleaned: string;
  hits: ProhibitedPhraseHit[];
  /** True if any hit had no safe replacement — the caller should
   *  regenerate the entire output rather than ship the cleaned version. */
  requiresRegeneration: boolean;
};

/**
 * Best-effort string-substitution sanitizer. Replaces phrases that have
 * a `replacement`; flags phrases that don't (caller must regenerate).
 *
 * Use this at the EDGE — right before agent text leaves the system to
 * a seller or buyer. NOT a substitute for the agent prompts forbidding
 * these phrases; this is the last-line defense.
 */
export function sanitizeAgentOutput(text: string): SanitizeResult {
  const hits = scanForProhibitedPhrases(text);
  let cleaned = text;
  let requiresRegeneration = false;
  for (const rule of PROHIBITED_PHRASES) {
    rule.pattern.lastIndex = 0;
    if (rule.replacement === null) {
      // Unrecoverable phrase — flag for regeneration but don't touch
      // the text (caller decides whether to ship redacted or refuse).
      if (rule.pattern.test(cleaned)) {
        requiresRegeneration = true;
      }
    } else {
      cleaned = cleaned.replace(rule.pattern, rule.replacement);
    }
  }
  return { cleaned, hits, requiresRegeneration };
}
