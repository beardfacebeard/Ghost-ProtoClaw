/**
 * Code Violation Compliance Review.
 *
 * Programmatic gate the State Compliance Review Agent calls before
 * any code-violation outreach draft clears. Returns PASS /
 * PASS_WITH_NOTICE / BLOCK with a rationale + concrete blockers list
 * the agent surfaces back to the operator.
 *
 * Differs from foreclosure-state-compliance.ts's reviewOutreachDraft:
 *   - No per-state attestation gate (no foreclosure statute applies).
 *   - Fair Housing forbidden-pattern filter is the BIGGEST gate
 *     (code-violation density correlates with race/national origin).
 *   - MD condemnation cross-check routes through the foreclosure
 *     compliance flow when status = scheduled_hearing /
 *     condemned / demolition_ordered.
 *   - SMS off by default at template level.
 *
 * Decision #11 default: PHIFA cross-check is Maryland only at launch.
 * Other states with condemnation flags surface for operator review
 * without auto-triggering the foreclosure-rescue flow.
 */

import { getForeclosureCompliance } from "./foreclosure-state-compliance";

export type CodeViolationReviewInput = {
  /** Lead state — 2-letter USPS code. */
  state: string;
  /** Outreach channel. */
  channel: "mail" | "email" | "sms" | "call" | "voicemail";
  /** Code-violation case status. When "scheduled_hearing" /
   *  "condemned" / "demolition_ordered" in MD, trigger PHIFA review. */
  caseStatus: string;
  /** The draft outreach copy to review. */
  draft: string;
  /** When the operator's Fair Housing audit was last completed.
   *  Drives a warning when >90 days old. */
  fairHousingAuditedAt?: string | null;
  /** When the lead is a multi-signal lead (code-violation +
   *  pre_foreclosure both fire), the foreclosure compliance flow
   *  also applies. The agent passes the foreclosure result through
   *  via crossModuleForeclosureBlockers when present. */
  crossModuleForeclosureBlockers?: string[];
};

export type CodeViolationReviewResult = {
  decision: "PASS" | "PASS_WITH_NOTICE" | "BLOCK";
  /** When PASS_WITH_NOTICE, the State Compliance Review Agent
   *  appends this required notice to the outreach. */
  requiredNotice?: string;
  rationale: string[];
  blockers: string[];
  /** True when a Fair Housing audit recheck is recommended (audit
   *  is older than 90 days). Soft warning, not a blocker. */
  fairHousingAuditStale?: boolean;
};

// ── Forbidden copy patterns (code-violation-specific) ─────────────────
// Reuses the foreclosure-state-compliance patterns + adds code-
// violation-specific ones from the plan §16.

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /we saw your code violations?\b|noticed your.*violations?\b/i,
    reason:
      "Implies surveillance — coercive framing. Drop reference to the violation. Position as 'I sometimes buy homes that need repairs.'"
  },
  {
    pattern: /the city.*(?:going to|will|plans to).*(?:demolish|condemn|take|seize)/i,
    reason:
      "False urgency + government impersonation. The city's enforcement timeline is the city's business, not yours to invoke."
  },
  {
    pattern: /(?:we can|I can|let me).*(?:make.*go away|fix|resolve).*violations?\b/i,
    reason:
      "Implied authority over a government process — foreclosure-consultant-statute analog risk in regulated states. Position as a purchase, not a fix."
  },
  {
    pattern: /your\s+neighbo[ru]rs?\s+(?:are\s+)?(?:watching|complain|notic)/i,
    reason: "Harassment / coercion pattern. Remove."
  },
  {
    pattern:
      /(?:we'?re|I'?m)\s+working\s+with\s+(?:the\s+)?(?:inspector|city|department)/i,
    reason: "Implies government affiliation. Remove."
  },
  {
    pattern:
      /tired\s+of\s+code\s+violations?.*(?:destroying|hurting|ruining)\s+your\s+community/i,
    reason:
      "Race-coded 'community' framing — Fair Housing disparate-impact risk. Use neutral language ('homeowners in any situation')."
  },
  {
    pattern: /final\s+notice|official\s+notice|notice\s+of\s+(?:demolition|condemnation)/i,
    reason:
      "Mimics a city notice — FTC § 5 deception + FTC impersonation rule. Use plain investor branding."
  },
  {
    pattern: /pay\s+(?:us|me)\s+(\$|fee|upfront|in\s+advance).*resolve/i,
    reason:
      "Advance-fee fraud pattern — never collect fees, only buy property. Remove."
  },
  {
    pattern: /\b(HUD|HAMP|HARP)\b|government\s+program|federal\s+program/i,
    reason:
      "Government / federal-program impersonation. Never imply affiliation with HUD/HAMP/HARP or any government program."
  },
  {
    pattern: /buy\s+ugly\s+houses?/i,
    reason:
      "Litigated phrase pattern. Demographic-coded in many MSAs. Use neutral language."
  },
  {
    pattern: /(?:respond|reply|call)\s+within\s+24\s+hours|act\s+now|limited\s+time/i,
    reason: "Artificial urgency. UDAAP red-line. Remove."
  }
];

const REQUIRED_DISCLAIMERS: Array<{ pattern: RegExp; missing: string }> = [
  {
    pattern: /private\s+real\s+estate\s+investor|real\s+estate\s+investor/i,
    missing:
      "Missing identity disclaimer: 'I am a private real estate investor, not affiliated with any city, county, or government office.'"
  },
  {
    pattern: /not\s+(offering|providing)\s+(legal|financial|tax|code-compliance)\s+advice/i,
    missing:
      "Missing advice disclaimer: 'I am not offering legal, financial, or code-compliance advice.'"
  }
];

// MD condemnation triggers the PHIFA cross-check (decision #11).
const MD_PHIFA_TRIGGER_STATUSES = new Set([
  "scheduled_hearing",
  "condemned",
  "demolition_ordered"
]);

export function reviewCodeViolationDraft(
  input: CodeViolationReviewInput
): CodeViolationReviewResult {
  const blockers: string[] = [];
  const rationale: string[] = [];

  // SMS gate (template-level off by default).
  if (input.channel === "sms") {
    blockers.push(
      "Cold SMS is OFF by default at the template level for code-violation outreach. To enable SMS, the operator must explicitly opt in per-state + complete 10DLC + RND scrub setup. Switch to direct mail (Lob) or email."
    );
  }

  // Ringless voicemail = TCPA-equivalent.
  if (input.channel === "voicemail") {
    blockers.push(
      "Ringless voicemail (RVM) is treated as a TCPA call by the FCC. The platform refuses RVM for code-violation outreach."
    );
  }

  // Forbidden-pattern scan.
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(input.draft)) {
      blockers.push(reason);
    }
  }

  // Required disclaimers.
  for (const { pattern, missing } of REQUIRED_DISCLAIMERS) {
    if (!pattern.test(input.draft)) {
      blockers.push(missing);
    }
  }

  // Cross-module: when the same lead also has an open foreclosure
  // signal, the foreclosure module's blockers apply too.
  if (input.crossModuleForeclosureBlockers?.length) {
    blockers.push(
      ...input.crossModuleForeclosureBlockers.map(
        (b) => `[cross-module: pre-foreclosure compliance] ${b}`
      )
    );
  }

  // Fair Housing audit recency (soft warning, not a blocker).
  let fhStale = false;
  if (input.fairHousingAuditedAt) {
    const auditDate = new Date(input.fairHousingAuditedAt);
    if (Number.isNaN(auditDate.getTime())) {
      fhStale = true;
    } else {
      const ageDays = (Date.now() - auditDate.getTime()) / (24 * 60 * 60 * 1000);
      fhStale = ageDays > 90;
    }
  } else {
    fhStale = true;
  }
  if (fhStale) {
    rationale.push(
      "Fair Housing audit is >90 days old (or never recorded). The dashboard surfaces this as a reminder. Soft warning — does not block outreach but indicates a refresh is due."
    );
  }

  // PHIFA cross-check (decision #11: MD only at launch).
  const isPhifaTrigger =
    input.state.toUpperCase() === "MD" &&
    MD_PHIFA_TRIGGER_STATUSES.has(input.caseStatus.toLowerCase());

  if (blockers.length > 0) {
    return {
      decision: "BLOCK",
      blockers,
      rationale,
      fairHousingAuditStale: fhStale
    };
  }

  // MD PHIFA trigger → require the foreclosure statutory notice.
  if (isPhifaTrigger) {
    const mdCompliance = getForeclosureCompliance("MD");
    if (mdCompliance?.statutoryNotice) {
      return {
        decision: "PASS_WITH_NOTICE",
        requiredNotice: mdCompliance.statutoryNotice,
        rationale: [
          ...rationale,
          "MD condemnation cross-check fired (decision #11): code-violation case status is " +
            input.caseStatus +
            ". Maryland PHIFA's 'distressed property' definition includes condemnation + receivership cases, so the foreclosure module's statutory notice attaches.",
          "5-business-day rescission applies if the lead becomes a purchase contract. Verify operator's per-state MD attestation is on file via the pre_foreclosure compliance flow."
        ],
        blockers: [],
        fairHousingAuditStale: fhStale
      };
    }
  }

  return {
    decision: "PASS",
    blockers: [],
    rationale: [
      ...rationale,
      "Universal disclaimers present + no forbidden patterns matched + no MD condemnation trigger."
    ],
    fairHousingAuditStale: fhStale
  };
}
