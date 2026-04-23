import { BUSINESS_TEMPLATES } from "@/lib/templates/business-templates";

export type WorkspaceCategoryKey =
  | "core"
  | "knowledge"
  | "memory"
  | "timeline"
  | "templates"
  | "other";

export type WorkspaceTierKey = "hot" | "warm" | "cold";

export type WorkspaceLibraryItem = {
  id: string;
  title: string;
  filePath: string;
  content: string;
  category: WorkspaceCategoryKey;
  tier: WorkspaceTierKey;
  tags: string[];
  source: string;
  description: string;
};

function slug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const WORKSPACE_CATEGORY_SET: Record<string, WorkspaceCategoryKey> = {
  core: "core",
  knowledge: "knowledge",
  memory: "memory",
  timeline: "timeline",
  templates: "templates",
  other: "other"
};

function asWorkspaceCategory(value: string): WorkspaceCategoryKey {
  return WORKSPACE_CATEGORY_SET[value] ?? "other";
}

function asWorkspaceTier(value: string): WorkspaceTierKey {
  if (value === "hot" || value === "warm" || value === "cold") {
    return value;
  }
  return "warm";
}

function extractTemplateDocs(): WorkspaceLibraryItem[] {
  const items: WorkspaceLibraryItem[] = [];
  for (const template of BUSINESS_TEMPLATES) {
    // Private/unlisted templates don't contribute to the shared library —
    // their items are seeded into the owner's business at materialize time.
    if ((template.visibility ?? "public") !== "public") continue;
    for (const doc of template.starterWorkspaceDocs) {
      items.push({
        id: `template__${template.id}__${slug(doc.filePath)}`,
        title: doc.filePath,
        filePath: doc.filePath,
        content: doc.contentTemplate,
        category: asWorkspaceCategory(doc.category),
        tier: asWorkspaceTier(doc.tier),
        tags: [...template.tags, template.category],
        source: `${template.icon} ${template.name} template`,
        description: `Starter ${doc.filePath} seeded by the ${template.name} template.`
      });
    }
  }
  return items;
}

const CORE_SOURCE = "✨ Core Library";

export const CORE_WORKSPACE_DOCS: WorkspaceLibraryItem[] = [
  {
    id: "core_doc__launch_runbook",
    title: "Launch Runbook",
    filePath: "SOPs/launch-runbook.md",
    category: "templates",
    tier: "warm",
    tags: ["sop", "launch", "runbook"],
    source: CORE_SOURCE,
    description: "Hour-by-hour launch checklist from 72 hours before through close day.",
    content: `# Launch Runbook

## 72 hours before
- [ ] Final QA on copy, checkout, emails, and ad creatives
- [ ] Warm the list with a teaser story post
- [ ] Send the "open" signal and assets to UGC creators and affiliates
- [ ] Confirm support coverage and response SLAs
- [ ] Verify analytics, UTMs, and conversion events fire

## 24 hours before
- [ ] Schedule all day-of emails and posts
- [ ] Pin FAQ / troubleshooting thread for the team
- [ ] Draft your "day of" story in advance

## Launch day (hour-by-hour)
- 06:00 — First "cart open" email
- 09:00 — Short-form post + pinned comment with the buy link
- 12:00 — Behind-the-scenes story
- 15:00 — First-sale screenshot / proof post
- 18:00 — Objection-handling email (the three most common pushbacks)
- 21:00 — Short "still available" nudge

## Cart close day
- T-12h email
- T-60m email
- T-10m email
- Pause ads at close
- Post-wrap recap to the team with numbers and lessons

## Definition of done
- Revenue, units, refund rate, and top traffic sources all captured in the
  launch retrospective within 48 hours of close.
`
  },
  {
    id: "core_doc__hiring_sop",
    title: "Hiring SOP",
    filePath: "SOPs/hiring.md",
    category: "templates",
    tier: "warm",
    tags: ["sop", "hiring", "people"],
    source: CORE_SOURCE,
    description: "From role brief to signed offer — structured hiring process for small teams.",
    content: `# Hiring SOP

## 1. Role brief
- Problem this hire solves (one sentence)
- What success looks like in 90 days
- Must-have skills / experience
- Nice-to-haves
- Compensation range + equity (if any)

## 2. Sourcing
- Write the JD, pass it through the brand voice check
- Post to: LinkedIn, niche community channels, your newsletter
- Ask 3 people directly for referrals

## 3. Screening
- Async intro video (2 min): "Why this role, your relevant past, one question you'd ask us"
- 20-min culture + clarity call
- Paid trial task (≤ 4 hours, scoped tightly)

## 4. Decision
- Independent scorecards from 2+ reviewers
- Reference checks on 2 past managers or collaborators
- Gut check: would this person raise the bar?

## 5. Offer
- Written offer with start date, comp, expectations, 90-day success criteria
- Onboarding plan attached
- Backup candidate on hold until acceptance
`
  },
  {
    id: "core_doc__pricing_experiment_log",
    title: "Pricing Experiment Log",
    filePath: "experiments/pricing.md",
    category: "timeline",
    tier: "warm",
    tags: ["pricing", "experiment", "log"],
    source: CORE_SOURCE,
    description: "Running log of pricing tests — hypothesis, what you changed, and the result.",
    content: `# Pricing Experiment Log

Append new entries to the top. Keep each entry short.

## Template
\`\`\`
### YYYY-MM-DD — [name]
**Hypothesis:**
**What we changed:**
**Measurement window:**
**Result:**
**Decision:** (keep / revert / expand)
**Notes / surprises:**
\`\`\`

---

## 2026-__-__ — example entry
**Hypothesis:** Raising core offer from $97 to $127 will not hurt conversion.
**What we changed:** Price on the sales page + checkout + cart abandon email.
**Measurement window:** 14 days.
**Result:** Conversion dropped 8%, AOV up 23%, net revenue up 13%.
**Decision:** Keep.
**Notes / surprises:** New plan tier (offered at $87) retained all churn signals.
`
  },
  {
    id: "core_doc__30_60_90",
    title: "30-60-90 Day Plan",
    filePath: "plans/30-60-90.md",
    category: "templates",
    tier: "warm",
    tags: ["plan", "30-60-90", "onboarding"],
    source: CORE_SOURCE,
    description: "Classic 30-60-90 structure — great for new hires, new initiatives, or new quarters.",
    content: `# 30-60-90 Plan

## The one outcome
By end of day 90, ___ will be true.

## Days 0–30: Learn
- Three things to deeply understand
- People to meet (and what you want to learn from each)
- Documents / dashboards to read
- Deliverable: a written "what I learned, what surprised me, what I'd change"

## Days 31–60: Contribute
- First independent shipped win
- One process improvement
- Relationships established in adjacent teams
- Deliverable: shipped work + a proposal for the 60–90 focus

## Days 61–90: Own
- Area of responsibility fully owned
- KPIs reported weekly
- One bet placed (with approval)
- Deliverable: 90-day review with outcomes vs. plan
`
  },
  {
    id: "core_doc__customer_interview_script",
    title: "Customer Interview Script",
    filePath: "SOPs/customer-interview.md",
    category: "templates",
    tier: "warm",
    tags: ["research", "customer", "interview"],
    source: CORE_SOURCE,
    description: "Non-leading questions that surface real pain, real alternatives, and real words.",
    content: `# Customer Interview Script (20–30 min)

## Ground rules
- Listen more than you talk. Let silence sit.
- Ask past-tense and specific: "Tell me about the last time you ___."
- No feature pitching during the call.

## Open
- "Thanks for doing this. Mind if I record for notes only?"
- "No right answers — I'm trying to understand your world."

## The problem
1. Walk me through the last time you ran into [problem]. What were you doing?
2. What did you try first? Why that?
3. How did it turn out? What was annoying?
4. How often does this come up?

## The alternatives
5. Before our product, what were you using? Why did you pick that?
6. What made you consider switching?
7. What nearly stopped you from switching?

## Value and words
8. If [product] disappeared tomorrow, what would you miss most?
9. How would you describe it to a friend in your role?
10. What word would you use for the outcome it delivers?

## Close
- "Is there anything I didn't ask about that I should have?"
- "Who else should I talk to about this?"
`
  },
  {
    id: "core_doc__brand_guidelines",
    title: "Brand Guidelines Starter",
    filePath: "brand/guidelines.md",
    category: "knowledge",
    tier: "warm",
    tags: ["brand", "guidelines", "voice"],
    source: CORE_SOURCE,
    description: "One-page brand reference — voice, tone, visual cues, and the things you never do.",
    content: `# Brand Guidelines

## Identity
- What we are: ___
- What we are not: ___
- Promise: ___

## Voice
- Three adjectives: ___
- We sound like: ___
- We never sound like: ___

## Tone by context
- Marketing pages: ___
- Sales conversations: ___
- Support responses: ___
- Crisis / incident: ___

## Visual
- Primary color(s): ___
- Type pairing: ___
- Photography / imagery: ___
- Always avoid: ___

## Copy rules
- Words we always use: ___
- Words we never use: ___
- Punctuation quirks: ___
- Capitalization rules: ___
`
  },
  {
    id: "core_doc__competitor_battlecard",
    title: "Competitor Battlecard",
    filePath: "research/competitor-battlecard.md",
    category: "knowledge",
    tier: "warm",
    tags: ["competitor", "sales", "research"],
    source: CORE_SOURCE,
    description: "One page per competitor — positioning, objections, and the talking points that win.",
    content: `# Competitor Battlecard

Duplicate this block per competitor.

## [Competitor name]

**One-line positioning:** ___
**Their audience:** ___
**Their pricing:** ___
**Where they're stronger than us:** ___
**Where they're weaker than us:** ___

### Our win themes
- ___
- ___
- ___

### When a prospect compares us
**They'll say:** "[competitor claim]"
**We respond with:** "[reframe + proof]"

**They'll say:** "[competitor claim]"
**We respond with:** "[reframe + proof]"

### Trap to avoid
- Don't trash them. Acknowledge, reframe, move on.
- Never match on features they own. Compete on the outcome we own.
`
  },
  {
    id: "core_doc__content_calendar",
    title: "Content Calendar",
    filePath: "content/calendar.md",
    category: "templates",
    tier: "warm",
    tags: ["content", "calendar", "planning"],
    source: CORE_SOURCE,
    description: "Weekly content plan with pillar topic, channel assignments, and CTA.",
    content: `# Content Calendar — week of ___

## This week's pillar topic
___

## Why it matters to our audience
___

## Channel plan
| Channel | Asset | Hook | CTA | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Newsletter | | | | | |
| YouTube / long-form | | | | | |
| Short-form #1 | | | | | |
| Short-form #2 | | | | | |
| X / thread | | | | | |
| LinkedIn post | | | | | |
| Community / DM | | | | | |

## Repurpose queue
- Turn the long-form into 5 clips (handled by the Repurpose-to-Shorts workflow)
- Pull three quotes for standalone graphics

## Measurement
- North-star metric this week: ___
- Secondary: ___
`
  },
  {
    id: "core_doc__postmortem",
    title: "Incident Postmortem",
    filePath: "SOPs/postmortem.md",
    category: "templates",
    tier: "warm",
    tags: ["postmortem", "ops", "incident"],
    source: CORE_SOURCE,
    description: "Blameless postmortem template for outages, launch mistakes, or customer incidents.",
    content: `# Postmortem — [incident]

**Date:** YYYY-MM-DD
**Severity:** (low / medium / high / critical)
**Detected at:** HH:MM (source)
**Resolved at:** HH:MM
**Customer impact:** ___

## Summary
Two sentences. Who was affected, what happened, how we resolved it.

## Timeline
- HH:MM — Event
- HH:MM — Event
- HH:MM — Resolution

## What went well
- ___

## What went wrong
- ___

## Where we got lucky
- ___

## Root cause
What actually caused this? Keep asking "why" until the cause is structural,
not a single person.

## Action items
| # | Action | Owner | Due | Status |
| --- | --- | --- | --- | --- |

## Communication
- Customer-facing message: (link)
- Internal recap: (link)

**Blameless rule:** criticize systems and processes, never individuals.
`
  },
  {
    id: "core_doc__weekly_journal",
    title: "Weekly Founder Journal",
    filePath: "journal/weekly.md",
    category: "timeline",
    tier: "warm",
    tags: ["journal", "reflection", "weekly"],
    source: CORE_SOURCE,
    description: "Weekly reflection prompts — what moved, what drained you, what to change.",
    content: `# Weekly Founder Journal — week of ___

## What moved forward
- ___

## What stalled
- ___

## What surprised me
- ___

## What drained me
- ___

## What energized me
- ___

## One decision I should make this week
___

## One thing I'll stop doing
___

## Compounding win I invested in
___

## Score for the week (1–10) and why
___
`
  },
  {
    id: "core_doc__daily_standup",
    title: "Daily Standup Template",
    filePath: "SOPs/daily-standup.md",
    category: "templates",
    tier: "warm",
    tags: ["standup", "daily", "ops"],
    source: CORE_SOURCE,
    description: "Five-question standup format — works solo or with a team.",
    content: `# Daily Standup — YYYY-MM-DD

## What I shipped yesterday
- ___

## What I'll finish today
- ___

## What I'm stuck on (and what I need)
- ___

## Numbers that moved
- ___

## One thing I'm thinking about
- ___
`
  },
  {
    id: "core_doc__okrs",
    title: "Quarterly OKRs Template",
    filePath: "plans/okrs.md",
    category: "templates",
    tier: "warm",
    tags: ["okr", "quarterly", "planning"],
    source: CORE_SOURCE,
    description: "Three objectives max, each with 2–3 measurable key results.",
    content: `# OKRs — Q_ YYYY

## Objective 1 — ___
- KR 1.1: ___ (baseline → target)
- KR 1.2: ___ (baseline → target)
- KR 1.3: ___ (baseline → target)

## Objective 2 — ___
- KR 2.1: ___
- KR 2.2: ___

## Objective 3 — ___
- KR 3.1: ___
- KR 3.2: ___

## What we will NOT do this quarter
- ___
- ___

## Weekly check-in cadence
Every Monday, score each KR 0.0–1.0. If below 0.4 for two weeks, decide:
renegotiate, re-scope, or drop.
`
  },
  {
    id: "core_doc__meeting_notes",
    title: "Meeting Notes Template",
    filePath: "templates/meeting-notes.md",
    category: "templates",
    tier: "warm",
    tags: ["meeting", "notes", "template"],
    source: CORE_SOURCE,
    description: "Standard meeting notes structure that agents can generate automatically.",
    content: `# Meeting — [title]

**Date:** YYYY-MM-DD
**Attendees:** ___
**Purpose:** one sentence

## Decisions
- ___
- ___

## Action items
| # | Action | Owner | Due |
| --- | --- | --- | --- |

## Open questions
- ___

## Notes
Raw discussion notes here.

## Follow-ups
- Calendar invite for next meeting
- Written recap to attendees within 24 hours
`
  },
  {
    id: "core_doc__decision_log",
    title: "Decision Log",
    filePath: "decisions/log.md",
    category: "timeline",
    tier: "warm",
    tags: ["decisions", "log"],
    source: CORE_SOURCE,
    description: "Append-only record of meaningful decisions — the reason, the tradeoff, the reversibility.",
    content: `# Decision Log

Append to the top. Don't rewrite history.

## Template
\`\`\`
### YYYY-MM-DD — [decision]
**Context:**
**Decision:**
**Alternatives considered:**
**Reversibility:** (easy / moderate / hard / one-way door)
**Key tradeoff accepted:**
**Owner:**
**Review date (if any):**
\`\`\`

---

## YYYY-MM-DD — example
**Context:** Choosing email platform for transactional + marketing.
**Decision:** Consolidate on Resend + Loops.
**Alternatives considered:** Customer.io, Mailgun + Klaviyo.
**Reversibility:** moderate (DNS + template migration)
**Key tradeoff:** Less enterprise features in exchange for speed and cost.
**Owner:** founder
**Review date:** 2026-10-01
`
  },
  {
    id: "core_doc__risk_register",
    title: "Risk Register",
    filePath: "ops/risk-register.md",
    category: "other",
    tier: "warm",
    tags: ["risk", "ops"],
    source: CORE_SOURCE,
    description: "Named risks, their likelihood, their impact, and the current mitigation.",
    content: `# Risk Register

Score each risk 1–5 on likelihood and 1–5 on impact.

| # | Risk | L | I | Score | Owner | Current mitigation | Review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ___ | | | | | | |
| 2 | ___ | | | | | | |
| 3 | ___ | | | | | | |

## Top 3 this quarter
- ___
- ___
- ___

## Review cadence
- Monthly: review scores, update mitigations
- After any material change (new dependency, new market, new hire)
`
  },
  {
    id: "core_doc__customer_success_playbook",
    title: "Customer Success Playbook",
    filePath: "playbooks/customer-success.md",
    category: "knowledge",
    tier: "warm",
    tags: ["customer-success", "playbook", "retention"],
    source: CORE_SOURCE,
    description: "Onboarding, health signals, save plays, and expansion triggers.",
    content: `# Customer Success Playbook

## Onboarding (first 14 days)
- Day 0: Welcome + quick win email
- Day 1: Kickoff call or video walkthrough
- Day 3: Milestone 1 check-in
- Day 7: First outcome confirmation
- Day 14: Review + expansion nudge if appropriate

## Health signals
| Signal | Status |
| --- | --- |
| Logged in this week | green |
| Key feature used 3+ times | green |
| Invited a teammate | green |
| No logins 14 days | yellow |
| Support ticket escalated | yellow |
| Cancelled billing retry | red |

## Save plays
- Yellow: personal outreach from CEO/founder, concrete next step offered
- Red: 24-hour response window, value recap, pause offer if product fit is real

## Expansion triggers
- Power user pattern (>= 3x baseline usage)
- Team invited 2+ members
- New use case surfaced in support

## What we never do
- Auto-renew without warning
- Surprise price hikes
- Dark-pattern cancel flows
`
  },
  {
    id: "core_doc__objection_handling",
    title: "Sales Objection Handling",
    filePath: "playbooks/objections.md",
    category: "knowledge",
    tier: "warm",
    tags: ["sales", "objections", "playbook"],
    source: CORE_SOURCE,
    description: "The top objections and the exact reframes the team has agreed on.",
    content: `# Objection Handling

Structure each: **Objection** → **Why it comes up** → **Reframe** → **Proof**.

## "It's too expensive."
- Why: value is unclear, or they're comparing against the wrong anchor.
- Reframe: "Compared to [alternative they named], here's what's included/excluded."
- Proof: One specific customer outcome + the dollar value it drove.

## "I need to think about it."
- Why: usually a decision criteria they haven't expressed.
- Reframe: "What specifically would you want to be true before saying yes?"
- Proof: Show the shortest path from today to that criterion.

## "We're already using [competitor]."
- Why: switching cost and sunk cost.
- Reframe: "What would it take for switching to be obviously worth it?"
- Proof: A switch case study with numbers.

## "Now isn't a good time."
- Why: either priority misalignment or calendar.
- Reframe: "What would make the timing right? Let's build around that."
- Proof: Phased starting point (pilot, small scope).

## "I need to talk to [person]."
- Why: missing decision-maker.
- Reframe: "Happy to join that — what's the simplest way?"
- Proof: Pre-built deck or written brief the champion can forward.
`
  },
  {
    id: "core_doc__customer_onboarding",
    title: "Customer Onboarding Checklist",
    filePath: "SOPs/customer-onboarding.md",
    category: "templates",
    tier: "warm",
    tags: ["onboarding", "customer", "sop"],
    source: CORE_SOURCE,
    description: "From signed contract to first value — structured onboarding you can automate around.",
    content: `# Customer Onboarding Checklist

## 0. Contract signed
- [ ] Send welcome email (personal, signed)
- [ ] Schedule kickoff within 72 hours
- [ ] Create shared doc / folder
- [ ] Provision access

## 1. Kickoff call
- Review goals (theirs + ours)
- Confirm success metrics and check-in cadence
- Identify primary point of contact + back-up
- Schedule the next milestone review

## 2. First value (within 14 days)
- Shipped first real outcome?
- Recorded it? Shared it?
- Removed at least one blocker?

## 3. 30-day review
- Metric check
- Any new goals?
- Referral / case study ask, if it feels right

## 4. Handoff to ongoing
- Documented what's working
- Set next quarter's objective
- Transition to the steady cadence
`
  },
  {
    id: "core_doc__email_templates",
    title: "Email Templates",
    filePath: "templates/emails.md",
    category: "templates",
    tier: "warm",
    tags: ["email", "template"],
    source: CORE_SOURCE,
    description: "Common email templates — intro, follow-up, soft-ask, decline — pre-written in brand voice.",
    content: `# Email Templates

Keep every email under 150 words. Lead with the payoff.

## Warm intro
Subject: quick intro — [their problem]
Hi [name], [referrer] mentioned you were wrestling with [specific problem].
I help [ICP] do [outcome] in [timeframe]. Happy to share a specific example
if useful. 15-min chat Thursday or next Tuesday?

## Follow-up (no response)
Subject: still good timing?
Hi [name], bumping this up. If [problem] isn't a priority right now, no worries —
just let me know and I'll stop the polite pings. Happy to send a quick case
study instead if that's easier.

## Soft ask
Subject: small favor
Hi [name], big favor — could you forward this to [role they know] at your
company? I think they'd benefit from [outcome], and a warm intro from you
would carry more weight than me showing up cold. Thanks either way.

## Decline (without burning the bridge)
Subject: not the right fit right now
Hi [name], I've thought about [opportunity] and it's not the right fit for
this quarter. I want to be direct rather than slow-play it. If [specific
trigger] changes, let's revisit.
`
  },
  {
    id: "core_doc__agent_principles",
    title: "Agent Operating Principles",
    filePath: "PRINCIPLES.md",
    category: "core",
    tier: "hot",
    tags: ["principles", "core", "agents"],
    source: CORE_SOURCE,
    description: "Operating principles your agents load into context every session.",
    content: `# Operating Principles

## 1. Be useful, not impressive
Lead with the answer. Save the explanation for when it's needed.

## 2. Prefer specificity
One real number beats a general claim. One real customer beats a persona.

## 3. Raise concerns early
If something seems off, surface it in the first reply. Don't stockpile
concerns and dump them later.

## 4. Escalate before action, not after
If a decision is irreversible or affects people outside this business,
ask before acting. Approval is cheap; apologies are expensive.

## 5. Say the number
When giving status, always include the metric. "It's going well" is a
feeling. "42 signups, up 18% week-over-week" is useful.

## 6. Plain English over jargon
No "leverage," "synergy," "optimize." Say what you mean.

## 7. Short loops
Ship, check, adjust. Long plans age poorly; short loops compound.
`
  }
];

const SOLO_SOURCE = "🚀 Solopreneur Growth Stack";

export const SOLOPRENEUR_WORKSPACE_DOCS: WorkspaceLibraryItem[] = [
  {
    id: "solo_doc__tiktok_shop_ops",
    title: "TikTok Shop Ops Runbook",
    filePath: "runbooks/tiktok-shop-ops.md",
    category: "templates",
    tier: "warm",
    tags: ["tiktok", "shop", "ops", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Daily and weekly TikTok Shop operating rhythm for creators.",
    content: `# TikTok Shop Ops Runbook

## Daily
- [ ] Check order volume vs. 7-day baseline
- [ ] Reply to new reviews within 4 hours
- [ ] Pin the best performing short-form of the last 24h to the shop tab
- [ ] Clip 1 new short-form asset from existing content

## Weekly
- [ ] Review top-performing creator videos mentioning your product
- [ ] Refresh product page copy on your two best-selling SKUs
- [ ] Send a batch of 10 UGC briefs via the UGC Request Queue workflow
- [ ] Adjust affiliate commission tiers if ROAS is healthy

## Product spotlight rhythm
- Monday: educational post about the problem the product solves
- Wednesday: demo / transformation
- Friday: customer proof or unboxing
- Sunday: lifestyle / context

## When to escalate
- Conversion drops >20% for 2 consecutive days
- Refund rate crosses 5%
- A creator video hits 500k+ views — prep inventory + reply plan
`
  },
  {
    id: "solo_doc__ugc_brand_book",
    title: "UGC Brand Book",
    filePath: "brand/ugc-brand-book.md",
    category: "knowledge",
    tier: "warm",
    tags: ["ugc", "brand", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Everything a UGC creator needs to nail your brand on the first try.",
    content: `# UGC Brand Book

## The one-liner
___

## Who the content is for
- Primary audience: ___
- What they scroll for: ___
- Words that resonate: ___
- Words that turn them off: ___

## Voice in UGC
- First-person, casual, honest
- No over-acting; no scripted "as seen on TV" vibe
- Specific > general. "Saved me 3 hours last Thursday" > "a total game changer"

## Visual must-haves
- Natural lighting preferred
- Product in frame for ≥ 60% of the video
- Captions on by default
- End frame: logo + clear CTA

## Absolute no's
- No medical / financial / income claims
- No bashing competitors by name
- No stock footage pretending to be organic
- No AI voiceovers without disclosure

## Deliverable bundle (per brief)
- 1 raw 30–45s vertical file
- 2 hook variants (first 2 seconds)
- 1 b-roll roll-up
- Captions as .srt
- Usage rights: organic + paid, 6 months default
`
  },
  {
    id: "solo_doc__creator_contract",
    title: "Creator Contract Template",
    filePath: "contracts/ugc-creator.md",
    category: "templates",
    tier: "warm",
    tags: ["contract", "ugc", "legal", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Simple creator agreement — scope, usage rights, payment, and kill-fee.",
    content: `# UGC Creator Agreement — short form

This is a plain-English summary. Pair with a real legal agreement for
anything material.

## Parties
- You: {{businessName}}
- Creator: ___

## Deliverables
- ___ vertical videos, ___ seconds each
- ___ hook variants per video
- Raw files + final edit + captions
- Delivery date: ___

## Usage rights
- Organic: perpetual, worldwide
- Paid: 6 months from delivery, worldwide
- Extensions negotiable at 25% of original fee per 6-month period

## Payment
- Total: $___
- 50% on contract signing
- 50% on final delivery
- Rush turnaround (< 72h): +$___

## Kill fee
- If scope cancels after kickoff: 50% of agreed fee
- If scope cancels after draft delivery: 100%

## Brand safety
- Creator will not promote competing products for the lesser of 90 days or
  the paid usage window.
- Creator will disclose paid relationship per FTC guidelines.

## Revisions
- Two rounds of revisions included
- Additional revisions: $___ each
`
  },
  {
    id: "solo_doc__course_launch_playbook",
    title: "Course Launch Playbook",
    filePath: "playbooks/course-launch.md",
    category: "knowledge",
    tier: "warm",
    tags: ["course", "launch", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Four-week plan for a cohort or evergreen course launch.",
    content: `# Course Launch Playbook

## Week -4: Build the audience receipt
- Pick the transformation + the specific avatar
- Publish one pillar long-form
- Seed 3 short-form pieces teasing the transformation
- Add a waitlist + lead magnet

## Week -3: Validate the offer
- Soft-sound the offer in a founder-voice email to the list
- Interview 5 waitlist signups; note exact words they use
- Price test against the ladder in the Offer Ladder KB entry

## Week -2: Build the assets
- Sales page (first draft) using their words, not yours
- Drip sequence: Day -14, -7, -3, -1, 0, +1, +2, cart close
- Ads / UGC briefs out to creators
- Affiliate kit sent

## Week -1: Warm the list
- Case study post from a beta student
- Q&A or AMA live
- "Door opens in X days" framing on every channel

## Launch week: Run the Launch Runbook
- Follow SOPs/launch-runbook.md hour-by-hour
- Post daily recap with numbers internally

## Post-launch
- Refund window management
- First-wins captures (testimonials)
- Cohort kickoff or evergreen automation flip
- Retro within 5 days of close
`
  },
  {
    id: "solo_doc__ad_swipe_file",
    title: "Ad Creative Swipe File",
    filePath: "ads/swipe-file.md",
    category: "knowledge",
    tier: "warm",
    tags: ["ads", "swipe", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Running swipe file of ad angles, hooks, and the ones that worked.",
    content: `# Ad Creative Swipe File

Categorize by angle. Log what worked and why.

## Angles that resonate with us
- Problem / pain-first
- Transformation story
- Price anchor / cost-of-doing-nothing
- Social proof (specific customer)
- Contrarian take
- Behind-the-scenes / builder vibe

## Hook bank
| Hook | Angle | Use |
| --- | --- | --- |
| "I used to [painful state]. Here's what changed in 14 days." | transformation | short-form |
| "Most [audience] do X. Here's why that's backwards." | contrarian | thread |
| "The $___ mistake I made so you don't have to." | cost-of-doing-nothing | long-form |

## What's working right now
(Update monthly with CPC, CTR, conversion rate for the top 3 creatives.)

## Dead angles (for now)
- ___
- ___

## Open experiments
- ___
`
  },
  {
    id: "solo_doc__affiliate_kit",
    title: "Affiliate Partner Kit",
    filePath: "partners/affiliate-kit.md",
    category: "knowledge",
    tier: "warm",
    tags: ["affiliate", "partners", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Everything an affiliate needs — links, swipe copy, commission, rules.",
    content: `# Affiliate Partner Kit

## The pitch in 3 lines
___

## Who's a great fit for this
___

## Commission structure
- Core offer: ___ % first sale
- Recurring product: ___ % for ___ months
- Payout: monthly, 30-day refund clawback

## Your links
- Affiliate dashboard: ___
- Raw link format: ___
- UTM pattern: utm_source=___&utm_medium=affiliate&utm_campaign=___

## Swipe copy
### Email — short
Subject: a tool I actually use daily
Body: ___

### Social — 1 liner
___

### Social — thread intro
___

## Dos and don'ts
- Do: disclose, share your real story, link to a specific outcome
- Don't: bid on branded keywords, use paid cashback sites, fake scarcity

## Support
- DM: ___
- Email: ___
- Office hours: ___
`
  },
  {
    id: "solo_doc__icp_interviews",
    title: "ICP Interview Notes",
    filePath: "research/icp-interviews.md",
    category: "timeline",
    tier: "warm",
    tags: ["research", "icp", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Log of customer interviews — their words, their pain, their alternatives.",
    content: `# ICP Interview Notes

One entry per interview. Keep it short. Quote them verbatim where possible.

## Template
\`\`\`
### YYYY-MM-DD — [first name, role]
**How we met:**
**Current state:**
**Pain (in their words):**
**What they've tried:**
**What's nearly worked:**
**The words they used for the outcome:**
**Willingness to pay signal:**
**Next step:**
\`\`\`

---

## YYYY-MM-DD — example
**How we met:** replied to our newsletter
**Current state:** 2-person agency, ___ revenue, ___ clients
**Pain:** "I'm the bottleneck on everything and I can't hire fast enough."
**What they've tried:** Notion, Asana, two VAs
**What's nearly worked:** the VAs, until context-switching killed it
**Outcome words:** "a co-founder that doesn't cost a co-founder's salary"
**Willingness to pay:** "$X/mo if it actually saves me two days a week"
**Next step:** invite to beta
`
  },
  {
    id: "solo_doc__one_pager",
    title: "One-Page Pitch",
    filePath: "pitch/one-pager.md",
    category: "knowledge",
    tier: "hot",
    tags: ["pitch", "positioning", "solopreneur"],
    source: SOLO_SOURCE,
    description: "Your one-page pitch — what you do, for who, why it matters, and what to do next.",
    content: `# {{businessName}} — one-page pitch

## What we do
One sentence. No jargon.

## For who
- Role / stage / context
- The specific moment they need this

## The shift
Before: ___
After: ___
Why this matters now: ___

## How it works (in three steps)
1. ___
2. ___
3. ___

## Why us
- Unique insight / approach: ___
- Proof (numbers, logos, outcomes): ___
- What others get wrong: ___

## Offer
- Tier 1: ___
- Tier 2: ___
- Tier 3: ___

## Next step
- Book a call / sign up: ___
- Waitlist / lead magnet: ___
- Affiliate / partner: ___
`
  }
];

let cachedLibrary: WorkspaceLibraryItem[] | null = null;

export function getWorkspaceLibrary(): WorkspaceLibraryItem[] {
  if (cachedLibrary) {
    return cachedLibrary;
  }
  const combined = [
    ...CORE_WORKSPACE_DOCS,
    ...SOLOPRENEUR_WORKSPACE_DOCS,
    ...extractTemplateDocs()
  ];
  const seen = new Set<string>();
  const deduped: WorkspaceLibraryItem[] = [];
  for (const item of combined) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  cachedLibrary = deduped;
  return deduped;
}

export function getWorkspaceLibraryCategories(): string[] {
  const categories = new Set<string>();
  for (const item of getWorkspaceLibrary()) {
    categories.add(item.category);
  }
  return Array.from(categories).sort();
}

export function getWorkspaceLibrarySources(): string[] {
  const sources = new Set<string>();
  for (const item of getWorkspaceLibrary()) {
    sources.add(item.source);
  }
  return Array.from(sources).sort();
}

export function getWorkspaceLibraryItem(
  id: string
): WorkspaceLibraryItem | undefined {
  return getWorkspaceLibrary().find((item) => item.id === id);
}
