import type { DistressSignalType } from "@/lib/dealhawk/distress-score";

/**
 * Dealhawk Empire — outreach scripting library.
 *
 * Channel-tuned + distress-signal-aware script templates the Seller
 * Outreach Agent and Follow-Up Sequencer use as starting points. The
 * agent customizes per deal context (operator's name, market, owner's
 * actual first name, specific property characteristics) — these
 * templates encode the *posture* per the research doc:
 *
 *   - Pre-foreclosure: empathy + credit-protection wedge. NEVER reference
 *     the NOD filing — the seller should not feel surveilled.
 *   - Probate / inherited: sensitivity-first. NEVER reference the
 *     probate filing. First contact is NOT about buying — it's about
 *     asking what they've decided.
 *   - Divorce: NEVER reference the filing. NEVER take sides.
 *   - Tired landlord (absentee + eviction): pain-first opener that pulls
 *     the yes-response before pivoting to pricing.
 *   - Tax-delinquent / code-violation / vacancy / expired: lower-distress
 *     openers, no special protocol — standard "we're buying in your area"
 *     framing with the relevant pain point named.
 *
 * Compliance language injected automatically:
 *   - SMS: STOP opt-out footer (TCPA requirement).
 *   - All channels: state-specific wholesaler disclosure where required
 *     (looked up from lib/dealhawk/state-disclosures.ts).
 *
 * Hard rule enforced upstream in the dealhawk_draft_outreach tool: refuse
 * to generate outreach for any lead scored below 40/100 unless the Deal
 * Ops Lead has logged an override.
 */

import { getStateDisclosure } from "@/lib/dealhawk/state-disclosures";

export type OutreachChannel =
  | "sms"
  | "postcard"
  | "letter"
  | "cold_call_script"
  | "email";

/** Always appended to SMS bodies — TCPA opt-out requirement. */
export const TCPA_SMS_OPT_OUT_FOOTER = "Reply STOP to opt out.";

/**
 * Template-key → starter copy. Variables are wrapped in {{double-braces}}
 * for the agent to substitute. The agent should NEVER ship a template
 * with literal {{...}} placeholders to a seller.
 */
type ScriptTemplate = {
  channel: OutreachChannel;
  /** Primary signal that drives wording. Multi-signal stacks pick the
   *  highest-priority signal (priority order in PRIORITY_ORDER below). */
  primarySignal: DistressSignalType;
  /** Title shown to the operator in the agent's response. */
  label: string;
  /** Posture rules — surfaced to the agent + operator alongside the body
   *  so the operator can see WHY this template avoids certain phrasing. */
  postureRules: string[];
  /** Body text with {{var}} placeholders. */
  body: string;
};

/** Highest priority first. When a Deal has multiple stacked signals, the
 *  template for the highest-priority signal in this list is chosen. */
const PRIORITY_ORDER: DistressSignalType[] = [
  "probate",
  "divorce",
  "pre_foreclosure",
  "tax_delinquent",
  "code_violation",
  "eviction",
  "absentee",
  "vacancy",
  "expired_listing",
  "high_equity",
  "long_tenure",
];

const TEMPLATES: ScriptTemplate[] = [
  // ── Pre-foreclosure ───────────────────────────────────────────────
  {
    channel: "sms",
    primarySignal: "pre_foreclosure",
    label: "Pre-foreclosure SMS — empathy + credit-protection",
    postureRules: [
      "NEVER reference the NOD or foreclosure filing — the seller should not feel surveilled.",
      "Lead with empathy and options, never with a cash-offer hook.",
      "Position the operator as someone who can help avoid foreclosure and protect credit.",
    ],
    body:
      "Hi {{owner_first_name}}, I work with homeowners in {{city}} who are weighing options on their property. Would it be okay to talk briefly when you have a moment? — {{operator_name}} | {{TCPA_FOOTER}}",
  },
  {
    channel: "letter",
    primarySignal: "pre_foreclosure",
    label: "Pre-foreclosure letter — empathy + credit-protection",
    postureRules: [
      "NEVER reference the NOD or foreclosure filing.",
      "Use plain envelope (no marketing branding). Hand-addressed-style works best.",
      "Position as a neighbor / local investor offering options, not a 'we buy houses' company.",
    ],
    body:
      "Dear {{owner_name}},\n\nI'm a local real-estate investor in {{city}} and I'm reaching out to homeowners in your area who may be weighing their options on their property. My goal is to find homeowners I can genuinely help — whether that's a clean cash offer that lets you walk away with money in your pocket and your credit intact, or a creative path that preserves your existing mortgage rate and protects you from a credit hit.\n\nThere's no pressure and no obligation. If now isn't the right time, I completely understand.\n\nIf you'd like to have a brief no-pressure conversation about what your options actually look like, my number is {{operator_phone}}. You can also reach me at {{operator_email}}.\n\nWith respect,\n{{operator_name}}\n\nP.S. If your situation has changed in any way you didn't expect this year, sometimes there are paths most homeowners don't realize exist. Happy to walk you through them — no strings.",
  },
  {
    channel: "cold_call_script",
    primarySignal: "pre_foreclosure",
    label: "Pre-foreclosure cold-call opener",
    postureRules: [
      "NEVER reference the NOD on the call — wait for the seller to volunteer.",
      "Build 2–3 minutes of rapport before any offer discussion.",
      "If the seller volunteers they're behind: 'I'm sorry. Would it help if I walked you through what the options actually look like, with no pressure?'",
      "NEVER promise the bank won't foreclose. NEVER promise credit outcomes.",
    ],
    body:
      "Hey {{owner_first_name}}, my name is {{operator_name}}. I'm reaching out about a property I believe you own at {{property_address}}. Did I catch you at a bad time?\n\n[If they say yes / can talk:]\nI work with a small group of local buyers in {{city}} and we're looking to help homeowners who may be weighing options on their property right now. I'm not here to pressure you. I just wanted to see if you've thought about your options recently and if it'd be okay if I asked you a couple of quick questions.\n\n[Four qualifying questions:]\n1. How would you describe the condition of the property right now?\n2. If you were going to consider selling, is there a timeline you'd want to work within?\n3. What's been on your mind lately that's making you open to talking?\n4. If everything went smoothly, what kind of number would feel fair to you?",
  },

  // ── Probate / Inherited ──────────────────────────────────────────
  {
    channel: "letter",
    primarySignal: "probate",
    label: "Probate letter — sensitivity-first, no offer in letter 1",
    postureRules: [
      "NEVER reference the probate filing. Heirs often don't know public records show the filing; feeling surveilled destroys trust.",
      "Address the executor by name where known.",
      "Letter 1 is NOT about buying. It's about acknowledging the situation and offering to be a resource.",
      "Offer discussion happens letter 2 / call 2 or 3 after rapport is real.",
    ],
    body:
      "Dear {{owner_name}},\n\nI'm a local real-estate investor here in {{city}} and I work with families who have inherited property and are figuring out what they want to do with it. There's no urgency on this letter — I just wanted to reach out and let you know I'm available as a resource if and when you're ready to talk through options.\n\nFamilies in this situation often have more options than they realize: keep it as a rental, sell it traditionally, sell as-is for cash, or any number of creative arrangements. Sometimes it's helpful just to talk through what's involved before deciding anything.\n\nIf and when you'd like to have that conversation, you can reach me at {{operator_phone}} or {{operator_email}}. No pressure, no follow-up unless you'd like one.\n\nWith respect,\n{{operator_name}}",
  },
  {
    channel: "cold_call_script",
    primarySignal: "probate",
    label: "Probate cold-call — first call is not about buying",
    postureRules: [
      "NEVER reference the probate filing.",
      "First call is about asking what the executor has decided to do with the property — NOT about buying it.",
      "Offer to be a resource: explain options, walk through the process, answer questions.",
      "Schedule a follow-up. Offer discussion happens call 2 or 3 after rapport is real.",
    ],
    body:
      "Hi {{owner_first_name}}, my name is {{operator_name}}. I'm reaching out about a property at {{property_address}} — I work with families in {{city}} who have inherited property and are figuring out what to do with it. Have you had a chance to think about what you'd like to do with it yet?\n\n[Listen. Don't pitch.]\n\nWhatever direction you're leaning, I'd be happy to walk you through what's involved with each option — keeping it as a rental, listing it traditionally, selling as-is, anything in between. Would it be helpful to set up a short call sometime in the next couple weeks to talk through it?",
  },

  // ── Divorce ──────────────────────────────────────────────────────
  {
    channel: "letter",
    primarySignal: "divorce",
    label: "Divorce letter — no sides, clean-exit framing",
    postureRules: [
      "NEVER reference the divorce filing.",
      "NEVER take sides. NEVER become a leverage point one spouse uses against the other.",
      "Both spouses must sign any purchase agreement and disclosure.",
      "Offer a clean quick-close — many divorcing couples are under court-ordered sale timelines.",
    ],
    body:
      "Dear {{owner_name}},\n\nI'm a local real-estate investor in {{city}} and I'm reaching out about the property at {{property_address}}. If you're considering your options for the home — whether that's listing traditionally, selling for cash, or any other path — I'd be glad to be a resource.\n\nSometimes families weighing decisions on a property prefer a clean, quick close with minimal back-and-forth. If that's something that would help your situation, my number is {{operator_phone}}. No pressure either way.\n\nWith respect,\n{{operator_name}}",
  },

  // ── Tired landlord (absentee + eviction) ─────────────────────────
  {
    channel: "sms",
    primarySignal: "absentee",
    label: "Tired-landlord SMS — pain-first yes-response opener",
    postureRules: [
      "Lead with the pain point the landlord already feels (tenants, repairs, vacancy).",
      "Open with a yes-response question to pull engagement before pivoting to pricing.",
      "Frame as 'we handle the whole mess' — the landlord's pain points all at once.",
    ],
    body:
      "Hi {{owner_first_name}}, are you still renting out {{property_address}}? Interested in cashing out if we could handle the whole process? — {{operator_name}} | {{TCPA_FOOTER}}",
  },
  {
    channel: "sms",
    primarySignal: "eviction",
    label: "Active-eviction SMS — pain-first, clean-exit framing",
    postureRules: [
      "Eviction filing is more acute than baseline absentee — emphasize the 'tenant headache' framing.",
      "Don't mention the eviction case directly; wait for the seller to volunteer it.",
    ],
    body:
      "Hi {{owner_first_name}}, are you still renting out {{property_address}}? Open to a clean cash exit if we handled the tenants and the closing for you? — {{operator_name}} | {{TCPA_FOOTER}}",
  },

  // ── Tax-delinquent ───────────────────────────────────────────────
  {
    channel: "sms",
    primarySignal: "tax_delinquent",
    label: "Tax-delinquent SMS — generic-area framing",
    postureRules: [
      "Don't reference the tax delinquency directly.",
      "Frame as a general area outreach.",
    ],
    body:
      "Hi {{owner_first_name}}, I'm reaching out to homeowners in {{city}} who may be considering options on their property. Open to a quick chat? — {{operator_name}} | {{TCPA_FOOTER}}",
  },
  {
    channel: "letter",
    primarySignal: "tax_delinquent",
    label: "Tax-delinquent letter — area-buyer framing",
    postureRules: [
      "Don't reference the tax delinquency.",
      "Plain envelope. Local-investor framing.",
    ],
    body:
      "Dear {{owner_name}},\n\nI'm a local real-estate investor in {{city}} and I'm reaching out to homeowners in your area who may be weighing options on their property. If you'd like to have a brief no-pressure conversation about what those options look like — whether that's a cash offer, a creative arrangement, or just a quick walk-through of the process — my number is {{operator_phone}}.\n\nNo follow-up unless you'd like one.\n\n— {{operator_name}}",
  },

  // ── Code violations / vacancy / expired listing ──────────────────
  {
    channel: "sms",
    primarySignal: "vacancy",
    label: "Vacancy SMS — neighbor-investor framing",
    postureRules: [
      "Don't mention the vacancy specifically.",
      "Local investor framing.",
    ],
    body:
      "Hi {{owner_first_name}}, I'm a local investor in {{city}} reaching out about {{property_address}}. Open to a quick conversation about options? — {{operator_name}} | {{TCPA_FOOTER}}",
  },
  {
    channel: "sms",
    primarySignal: "expired_listing",
    label: "Expired-listing SMS — agent-side motivation",
    postureRules: [
      "Reference the listing tactfully — 'I noticed your home was on the market'.",
      "Don't be pushy; the seller already had a bad agent experience.",
    ],
    body:
      "Hi {{owner_first_name}}, I noticed your home at {{property_address}} was on the market recently. Open to a quick conversation about a different kind of offer? — {{operator_name}} | {{TCPA_FOOTER}}",
  },
];

/**
 * Pick the best template for a given (deal channel, deal signal-stack).
 * Returns null if no template matches the channel + the highest-priority
 * signal in the stack — caller should fall back to a generic template.
 */
export function pickTemplate(args: {
  channel: OutreachChannel;
  signals: DistressSignalType[];
}): ScriptTemplate | null {
  if (args.signals.length === 0) {
    return (
      TEMPLATES.find(
        (t) => t.channel === args.channel && t.primarySignal === "absentee"
      ) ?? null
    );
  }
  for (const candidate of PRIORITY_ORDER) {
    if (args.signals.includes(candidate)) {
      const match = TEMPLATES.find(
        (t) => t.channel === args.channel && t.primarySignal === candidate
      );
      if (match) return match;
    }
  }
  // Fallback: any template for that channel.
  return TEMPLATES.find((t) => t.channel === args.channel) ?? null;
}

export type RenderOutreachArgs = {
  channel: OutreachChannel;
  signals: DistressSignalType[];
  vars: {
    ownerName?: string | null;
    ownerFirstName?: string | null;
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    operatorName: string;
    operatorPhone?: string | null;
    operatorEmail?: string | null;
  };
  /** Override the picked template with one selected explicitly by the
   *  agent — useful when the agent's signal-stack reasoning differs
   *  from the priority order. */
  templateLabel?: string;
};

export type RenderOutreachResult = {
  template: {
    channel: OutreachChannel;
    primarySignal: DistressSignalType;
    label: string;
    postureRules: string[];
  };
  /** Final body after substitution + compliance footer / disclosure. */
  body: string;
  /** Compliance items added to the body. */
  complianceNotes: string[];
};

/**
 * Render a script template to final ready-to-send copy. Substitutes
 * variables, appends TCPA footer on SMS, and surfaces state-specific
 * disclosure requirements where the property is in a non-permissive
 * tier (these go to the operator as posture notes — they don't get
 * pasted into the SMS body, since most state wholesaler disclosures
 * apply to contracts/dispositions, not initial outreach).
 */
export function renderOutreach(
  args: RenderOutreachArgs
): RenderOutreachResult | { error: string } {
  let template: ScriptTemplate | null;
  if (args.templateLabel) {
    template =
      TEMPLATES.find((t) => t.label === args.templateLabel) ?? null;
    if (!template) {
      return { error: `Unknown template label: "${args.templateLabel}".` };
    }
  } else {
    template = pickTemplate({
      channel: args.channel,
      signals: args.signals,
    });
  }
  if (!template) {
    return {
      error: `No template available for channel "${args.channel}" and the provided signal stack. Provide an explicit templateLabel or use a different channel.`,
    };
  }

  const ownerName = args.vars.ownerName ?? "Homeowner";
  const ownerFirstName =
    args.vars.ownerFirstName ?? ownerName.split(/\s+/)[0] ?? "there";

  let body = template.body
    .replaceAll("{{owner_name}}", ownerName)
    .replaceAll("{{owner_first_name}}", ownerFirstName)
    .replaceAll("{{property_address}}", args.vars.propertyAddress)
    .replaceAll("{{city}}", args.vars.propertyCity)
    .replaceAll("{{operator_name}}", args.vars.operatorName)
    .replaceAll(
      "{{operator_phone}}",
      args.vars.operatorPhone ?? "(operator phone not configured)"
    )
    .replaceAll(
      "{{operator_email}}",
      args.vars.operatorEmail ?? "(operator email not configured)"
    )
    .replaceAll("{{TCPA_FOOTER}}", TCPA_SMS_OPT_OUT_FOOTER);

  const complianceNotes: string[] = [];
  if (args.channel === "sms" && !body.includes(TCPA_SMS_OPT_OUT_FOOTER)) {
    body = `${body}\n${TCPA_SMS_OPT_OUT_FOOTER}`;
    complianceNotes.push(
      "Appended TCPA STOP opt-out footer to SMS body."
    );
  }

  const stateDisclosure = getStateDisclosure(args.vars.propertyState);
  if (stateDisclosure && stateDisclosure.tier !== "permissive") {
    complianceNotes.push(
      `${stateDisclosure.fullName} (${stateDisclosure.state}) is a "${stateDisclosure.tier}"-tier wholesaling state. State-specific disclosures apply to PURCHASE CONTRACTS / DISPOSITIONS, not initial outreach — but the operator should review the state's wholesaler-disclosure requirements before any signed agreement. See lib/dealhawk/state-disclosures.ts.`
    );
  }

  return {
    template: {
      channel: template.channel,
      primarySignal: template.primarySignal,
      label: template.label,
      postureRules: template.postureRules,
    },
    body,
    complianceNotes,
  };
}

// ── Objection-handler library ────────────────────────────────────

/**
 * Pre-canned objection patterns the agent can match against. The
 * Objection Handler tool runs LLM matching but uses these as a
 * grounding library so common objections get the same load-bearing
 * answers every time.
 */
export const KNOWN_OBJECTIONS: Array<{
  match: string[];
  underlyingConcern: string;
  primaryLine: string;
  backupLine: string;
  toneNotes: string;
}> = [
  {
    match: [
      "won't the bank call",
      "due on sale",
      "what about the bank",
      "can the bank do that",
    ],
    underlyingConcern:
      "The seller is afraid the bank will accelerate the loan after a Sub-To transfer. This is the #1 Sub-To objection and it's based on a real risk (the DOS clause exists), but in practice lenders almost never enforce it on performing loans because foreclosure costs them $40-50K.",
    primaryLine:
      "The bank has the right to call the loan due — that's the due-on-sale clause. In practice, when payments stay on time, banks almost never trigger it because it costs them tens of thousands to foreclose. We structure with attorney involvement and a performance agreement to protect you.",
    backupLine:
      "I'd be happy to pay for the attorney to walk you through it — would that help?",
    toneNotes:
      "Calm, direct, non-promising. NEVER say 'the bank won't' or 'I guarantee'.",
  },
  {
    match: ["what's your offer", "what would you offer", "how much"],
    underlyingConcern:
      "The seller wants to anchor the conversation on price before sharing motivation context. Giving a number now usually produces a worse deal than turning it back.",
    primaryLine:
      "Before I give you a number, help me understand — what would need to be true for this to work for you?",
    backupLine:
      "Without seeing the property in person, I'd be in the range of [X-Y] for similar properties in the area. Want to walk it together?",
    toneNotes:
      "Curious, not evasive. Make the seller feel heard, not hustled.",
  },
  {
    match: ["need to think", "let me think", "talk to my", "not sure"],
    underlyingConcern:
      "Unspecified hesitation usually means the seller has one specific concern they haven't voiced. Naming it gets you back into the conversation.",
    primaryLine:
      "Totally get it — what's the one question I haven't answered yet?",
    backupLine:
      "Take your time. If it'd help, would you like me to send you a one-page summary of how it'd work, no commitment?",
    toneNotes: "Patient. Don't push for a same-call commitment.",
  },
  {
    match: ["my credit", "ruin my credit", "credit score"],
    underlyingConcern:
      "On a Sub-To, the seller's credit stays tied to a loan in their name — a real risk that requires honest disclosure.",
    primaryLine:
      "Your credit stays connected to the loan because the loan stays in your name — that's the trade-off of this structure. We protect you with a performance agreement, escrowed reserves, and an attorney involved from day one.",
    backupLine:
      "If credit protection is the most important thing to you, we could also explore other paths that get the loan fully out of your name — they take longer and net you less, but might match your priorities better.",
    toneNotes:
      "Honest, never minimizing. NEVER promise their credit will be protected.",
  },
  {
    match: ["how soon", "when can you close", "how fast"],
    underlyingConcern:
      "The seller has a timeline pressure — divorce decree, relocation, family emergency, foreclosure auction approaching.",
    primaryLine:
      "Standard cash close runs 14–21 days from contract; if you're under a tight timeline, we can usually move faster with a hard-money lender. What's driving the question?",
    backupLine:
      "If we needed to close inside a week, I'd want to walk the property in the next 48 hours and have title open the same day. Is that doable?",
    toneNotes: "Action-oriented. Pull the timeline detail.",
  },
];

export function findObjectionMatch(quote: string) {
  const normalized = quote.toLowerCase();
  for (const objection of KNOWN_OBJECTIONS) {
    for (const phrase of objection.match) {
      if (normalized.includes(phrase)) {
        return objection;
      }
    }
  }
  return null;
}
