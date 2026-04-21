import type { KnowledgeCategoryKey } from "@/lib/brain/knowledge";
import { BUSINESS_TEMPLATES } from "@/lib/templates/business-templates";

import type { KnowledgeLibraryItem } from "./types";

function slug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const KNOWLEDGE_KEYS = new Set<KnowledgeCategoryKey>([
  "about_business",
  "products_services",
  "pricing",
  "policies",
  "faqs",
  "contacts",
  "brand_voice",
  "processes",
  "custom"
]);

function asKnowledgeCategory(category: string): KnowledgeCategoryKey {
  return KNOWLEDGE_KEYS.has(category as KnowledgeCategoryKey)
    ? (category as KnowledgeCategoryKey)
    : "custom";
}

function extractTemplateKnowledge(): KnowledgeLibraryItem[] {
  const items: KnowledgeLibraryItem[] = [];
  for (const template of BUSINESS_TEMPLATES) {
    for (const knowledge of template.starterKnowledge) {
      items.push({
        id: `template__${template.id}__${slug(knowledge.title)}`,
        title: knowledge.title,
        category: asKnowledgeCategory(knowledge.category),
        content: knowledge.contentTemplate,
        tags: [...template.tags, template.category],
        source: `${template.icon} ${template.name} template`
      });
    }
  }
  return items;
}

const SOLO_SOURCE = "🚀 Solopreneur Growth Stack";

/**
 * Knowledge-base entries that pair with the Solopreneur Growth Stack
 * workflows — every content slot a founder-led product/tool/course
 * business typically needs to brief its agents.
 */
export const SOLOPRENEUR_KNOWLEDGE: KnowledgeLibraryItem[] = [
  {
    id: "solo_kb__business_snapshot",
    title: "Solopreneur Business Snapshot",
    category: "about_business",
    tags: ["solopreneur", "about"],
    source: SOLO_SOURCE,
    description: "One-page overview of what you do, who you help, and why it matters.",
    content: `# What {{businessName}} does
In one paragraph, explain the transformation you deliver — who it's for, what changes, and why it matters now.

# Who it's for
- Primary audience (role, stage, pain)
- Who it's NOT for (disqualifiers)

# Why us
- The unique approach, angle, or insight only you bring
- Three proof points (numbers, customer outcomes, or track record)

# Current focus
- This quarter's single most important outcome
- The number we're trying to move
`
  },
  {
    id: "solo_kb__offer_ladder",
    title: "Offer Ladder",
    category: "pricing",
    tags: ["solopreneur", "pricing", "offers"],
    source: SOLO_SOURCE,
    description: "Tripwire → core → high-ticket — how your offers step up in value and price.",
    content: `# {{businessName}} offer ladder

## Tier 1 — Free / Tripwire ($0 – $27)
- Product: ___
- Promise: ___
- Primary call-to-action: ___

## Tier 2 — Core offer ($___)
- Product: ___
- Promise: ___
- What's included: ___
- Natural next step: ___

## Tier 3 — High-ticket / done-with-you ($___)
- Product: ___
- Promise: ___
- What's included: ___
- Qualification requirements: ___

## Bundle / season offers
- ___
`
  },
  {
    id: "solo_kb__digital_product_catalog",
    title: "Digital Product Catalog",
    category: "products_services",
    tags: ["solopreneur", "products"],
    source: SOLO_SOURCE,
    content: `# Active products

| Product | Price | Deliverable | Best for | Sales page |
| --- | --- | --- | --- | --- |
| {{businessName}} starter | $ | ___ | ___ | ___ |
| ___ | ___ | ___ | ___ | ___ |

## Upcoming / waitlist
- ___

## Retired / do not promote
- ___
`
  },
  {
    id: "solo_kb__founder_voice",
    title: "Founder Voice & Tone",
    category: "brand_voice",
    tier: "hot",
    tags: ["solopreneur", "voice"],
    source: SOLO_SOURCE,
    content: `# Voice
First person, conversational, direct. No corporate polish. Write like a founder DM'ing a friend who's in the trenches.

# Tone
- Honest about tradeoffs; never hypes.
- Confident without arrogance — "here's what works for us."
- Short sentences. Plain words. One big idea per paragraph.

# Rules
- Never use: "leverage", "synergy", "game-changer", "revolutionary".
- Always prefer a specific number or example over a generic claim.
- Lead with the payoff, then explain the how.
- End posts with a question, a CTA, or a concrete next step — never drift off.

# Signature moves
- Share the actual numbers (revenue, MRR, email opens, etc.) when it helps.
- Tell the story before the lesson.
- Name the mistake before the fix.
`
  },
  {
    id: "solo_kb__content_production_sop",
    title: "Content Production SOP",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "content", "sop"],
    source: SOLO_SOURCE,
    content: `# Weekly content rhythm

**Monday** — Plan: pick one pillar topic for the week.
**Tuesday** — Long-form: record one YouTube or podcast episode.
**Wednesday** — Short-form: cut 5–10 short clips from the long-form.
**Thursday** — Written: one newsletter, one X thread, one LinkedIn post.
**Friday** — Queue + ship the week's assets.

# Definition of done
- Hook, promise, and CTA are all present.
- Brand voice rules followed.
- Tagged in the content queue with intended channel + publish date.
`
  },
  {
    id: "solo_kb__launch_day_sop",
    title: "Launch Day SOP",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "launch", "sop"],
    source: SOLO_SOURCE,
    content: `# 72 hours before
- Final asset QA (copy, checkout, emails, ads).
- Warm up the list with a story post.
- Brief UGC creators on the "open" signal.

# Launch day (hour-by-hour)
- 6am — First "cart open" email.
- 9am — Short-form post + pinned comment.
- 12pm — Behind-the-scenes story.
- 3pm — Proof / first-sale screenshot.
- 6pm — Objection-handling email.
- 9pm — "Only 12 hours left if applicable" email.

# Close day
- Final email at T-60 min and T-10 min.
- Pause ads.
- Wrap note to the team with numbers.
`
  },
  {
    id: "solo_kb__ugc_creator_hire_sop",
    title: "UGC Creator Hire SOP",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "ugc", "hiring"],
    source: SOLO_SOURCE,
    content: `# Brief
- Product: ___
- Hook angles (3 options): ___
- Must-say beats: ___
- Visual cues / B-roll ideas: ___
- Length: ___ seconds
- Deliverables: ___ raw + ___ edited variants
- Usage rights: ___

# Standard rate
- $___ per deliverable
- $___ for rush turnaround (under 72 hours)
- $___ bonus if video hits ___ views in 14 days

# Review checklist
- Hook in the first 1.5s
- No brand-prohibited phrases
- Captions on
- CTA clear
`
  },
  {
    id: "solo_kb__refund_guarantee",
    title: "Refund & Guarantee Policy",
    category: "faqs",
    tags: ["solopreneur", "faq", "policy"],
    source: SOLO_SOURCE,
    content: `**Q: Do you offer refunds?**
Yes — within the first ___ days, if you can show you worked the program and didn't get the promised outcome, we refund in full. Email ___ with a short note and we'll process it.

**Q: What counts as "worked the program"?**
You completed the first ___ modules and submitted the first worksheet. We keep it simple because we trust you.
`
  },
  {
    id: "solo_kb__course_access_faq",
    title: "Course Access FAQ",
    category: "faqs",
    tags: ["solopreneur", "faq", "course"],
    source: SOLO_SOURCE,
    content: `**Q: Where do I log in?**
___

**Q: Can I download the videos?**
___

**Q: Is there a community?**
___

**Q: Do I get updates if the course is revised?**
Yes — lifetime access includes every future update.

**Q: Who do I email for help?**
___
`
  },
  {
    id: "solo_kb__affiliate_program_policy",
    title: "Affiliate Program Policy",
    category: "policies",
    tier: "cold",
    tags: ["solopreneur", "affiliate"],
    source: SOLO_SOURCE,
    content: `# Commission
- Core offer: ___ % on first sale.
- Recurring product: ___ % for ___ months.
- Custom deals are case-by-case.

# Payout
- Monthly, on the ___ of each month.
- Minimum payout: $___.
- 30-day refund clawback window.

# Promotion rules
- No bidding on branded keywords.
- No cashback or coupon sites.
- No false scarcity claims.
- Must disclose affiliate relationship per FTC.
`
  },
  {
    id: "solo_kb__content_usage_policy",
    title: "Content Usage & Licensing",
    category: "policies",
    tier: "cold",
    tags: ["solopreneur", "content", "licensing"],
    source: SOLO_SOURCE,
    content: `# Customer-generated content
By posting a testimonial, review, or tagging {{businessName}}, customers grant us the right to repost with attribution across our channels.

# UGC creators
Usage rights are defined per brief (organic-only / paid / perpetual). Default: 6 months paid + organic.

# Commissioned content
All commissioned assets become the property of {{businessName}} on final payment unless stated otherwise in the brief.
`
  },
  {
    id: "solo_kb__key_partners",
    title: "Key Creators & Partners",
    category: "contacts",
    tier: "cold",
    tags: ["solopreneur", "contacts", "partners"],
    source: SOLO_SOURCE,
    content: `# Core UGC creators
- Name — handle — niche — rate — contact

# Affiliates
- Name — audience — channel — commission tier — contact

# Strategic partners
- Name — role — relationship context — contact
`
  },
  {
    id: "solo_kb__icp_profile",
    title: "Ideal Customer Profile (ICP)",
    category: "custom",
    tags: ["solopreneur", "icp", "audience"],
    source: SOLO_SOURCE,
    content: `# Who they are
- Role / title: ___
- Stage of business or career: ___
- Demographic markers: ___

# What they want
- Top outcome: ___
- What "winning" looks like in 90 days: ___

# What's blocking them
- Top 3 pains: ___
- What they've tried that didn't work: ___

# Where they hang out
- Channels (list): ___
- Who they follow: ___
- Words they use to describe the problem: ___

# Objections
- "I'm too busy" → answer: ___
- "I've tried other programs" → answer: ___
- "I'll do it later" → answer: ___
`
  },
  {
    id: "solo_kb__ninety_day_plan",
    title: "90-Day Growth Plan",
    category: "custom",
    tags: ["solopreneur", "planning", "growth"],
    source: SOLO_SOURCE,
    content: `# The one number
___ (revenue / signups / MRR / etc.)

# Month 1 — Foundation
- Outcome: ___
- 3 key moves: ___
- Metrics to watch: ___

# Month 2 — Amplify
- Outcome: ___
- 3 key moves: ___
- Metrics to watch: ___

# Month 3 — Compound
- Outcome: ___
- 3 key moves: ___
- Metrics to watch: ___

# What I will NOT do this quarter
- ___
- ___
- ___
`
  },
  {
    id: "solo_kb__wantrepreneur_icp",
    title: "Aspiring Entrepreneur ICP",
    category: "custom",
    tags: ["solopreneur", "icp", "aspiring-entrepreneur", "audience"],
    source: SOLO_SOURCE,
    description:
      "Who the aspiring-entrepreneur / side-hustle / quit-my-job audience actually is, in their own words, and what disqualifies them.",
    content: `# Aspiring Entrepreneur ICP

This is the audience that wants to start a business, make money online,
or quit their 9–5 — and is actively shopping for tools that help. Many
have been burned by courses and gurus. Our opening move is always
radical honesty about the work involved.

## Who they are
- **Primary:** 25–45, working a full-time job, trying to build a side
  hustle in 5–15 hours a week. Has tried at least one guru product and
  been disappointed.
- **Secondary:** Recently quit / laid off, now 1–6 months into "figuring
  it out," running out of savings runway, needs traction not theory.
- **Tertiary:** Existing side-hustler making $0–$2k/mo who can't break
  past the ops ceiling because they're also the whole team.

## Their life context
- Has a day job or very recent exit from one.
- Has between $0 and maybe $100/mo of discretionary budget for tools.
- Reads Reddit, HN, IndieHackers, YouTube creator-business channels.
- Lurks more than posts.
- Has a partner/family watching them and asking when this will pay off.

## Specific pains (in THEIR words)
- "I'm burnt out at my day job but I can't quit until this pays."
- "I've spent $___ on courses and I have nothing to show for it."
- "I don't have time to be the CEO AND do all the work."
- "Every guru says to build an audience — how do I actually start?"
- "I'm drowning in tools."
- "I just want ONE thing that handles the boring parts so I can focus
  on the offer."
- "I've tried dropshipping / affiliate / course selling — made $0."

## What "winning" looks like for them
- First $500/mo in real, repeating revenue.
- Not having to ask their partner if they can spend $50.
- Two hours of actual deep work per day instead of drowning in tabs.
- Knowing what to do next without a guru telling them.

## What they've already tried (and usually failed at)
- Shopify + Oberlo drop-shipping
- Amazon FBA
- Faceless YouTube channels
- AI newsletter plays
- Generic "build a SaaS in a weekend" courses
- Being an affiliate for the thing that taught them to be an affiliate

## Where they hang out
- r/Entrepreneur, r/sidehustle, r/WorkOnline, r/smallbusiness,
  r/juststart, r/passive_income, r/sweatystartup,
  r/EntrepreneurRideAlong, r/digitalnomad, r/financialindependence
- Hacker News "Ask HN: side project" / "how do you validate" threads
- IndieHackers milestones feed
- YouTube comments on business / creator-economy channels

## Disqualifiers (skip these, they will NEVER buy)
- Looking for "100% passive" anything.
- Explicitly asks for get-rich-quick results.
- Wants a refund without engaging with the work.
- Has no measurable offer, product, or audience hypothesis at all —
  and isn't willing to build one.
- Asking someone else to do the work for free.

## Objections we must be ready for
- "How is this different from [guru course I bought]?"
- "I don't have money to invest."
- "I don't have time."
- "I've tried tools like this and stopped using them."
- "Does this actually work or is it just AI hype?"

See the **Objection-Handling Scripts** KB entry for our exact answers.
`
  },
  {
    id: "solo_kb__honest_operator_voice",
    title: "Honest-Operator Brand Voice",
    category: "brand_voice",
    tier: "hot",
    tags: ["solopreneur", "voice", "honest-operator"],
    source: SOLO_SOURCE,
    description:
      "Voice rules for talking to aspiring entrepreneurs without sounding like another guru. The anti-sleaze checklist.",
    content: `# Honest-Operator Brand Voice

Our whole positioning is: "If you're willing to actually do the work,
this runs the ops layer a real team would cost you $5k/mo for." That
honesty IS the marketing. Every piece of copy the agents produce has
to survive this voice.

## Tone
- Plain. Skip the adjectives.
- Direct but warm. Not a coach, not a cheerleader, not a drill sergeant.
- Peer-level — "we've been there" — not authority-from-on-high.

## Rules (hard, every piece of copy)
1. **Never promise earnings.** No "six figures", "$10k/mo", "first
   sale in 30 days." Not in copy, not in captions, not in replies.
2. **Never promise timelines.** No "in 90 days", "overnight",
   "fastest way to", "shortcut to".
3. **Always name the work part.** Every piece of copy must acknowledge
   that the user still has to do the work. This is the thing that
   makes us different.
4. **Always prefer a specific number over a general claim.** Say
   "saved me 11 hours last week" not "saves you tons of time."
5. **Never compare timelines to failed gurus by name.** Acknowledge
   the pattern without attacking individuals.
6. **Credit the user's skepticism.** "You've probably been burned by
   this category before" > "trust me bro."
7. **Use disclaimers when we mention results.** Always attach the
   "this took X weeks of actual work" part.

## Banned phrases (instant reject — do NOT draft with these)
- "Passive income"
- "Financial freedom"
- "Quit your 9 to 5"
- "Make money while you sleep"
- "Get rich quick"
- "Anyone can do this"
- "No skill required"
- "Proven system"
- "Guaranteed results"
- "Life-changing"
- "Game-changer"
- "Secret to success"
- "Guru" (about ourselves)
- "Disrupt"
- "Side hustle millionaire"
- Any "$X in Y days" structure

## Phrases we CAN use
- "If you're actually going to do the work."
- "The ops layer you'd otherwise hire someone $___/mo to run."
- "This is not a course. This is the tool that runs what a course
  would have told you to hire for."
- "You still have to ship the offer. We just run the machine."
- "We don't know if this will work for you. We know what it does when
  you put real reps in."

## Structural rules for any draft aimed at this audience
- Start with their real pain, in their words.
- Acknowledge the pattern of burnout / courses / failed attempts.
- Offer one concrete, usable idea they can take without clicking
  anything.
- Mention {{businessName}} only once, with disclosure.
- End with a question that invites a real answer, not a "DM me."

## Red lines (violating = don't send)
- Fabricated customer quotes.
- Fabricated income screenshots.
- Urgency we didn't actually manufacture (no "only 3 spots left" when
  there isn't a cap).
- "X of Y spots filled" claims without a real cap.
- Fake testimonials.
- Astroturfed Reddit replies.
`
  },
  {
    id: "solo_kb__wantrepreneur_hook_bank",
    title: "Aspiring Entrepreneur Hook Bank",
    category: "custom",
    tags: ["solopreneur", "hooks", "content", "aspiring-entrepreneur"],
    source: SOLO_SOURCE,
    description:
      "20 pre-vetted content hooks that land with aspiring entrepreneurs without sounding like a guru.",
    content: `# Hook Bank — Aspiring Entrepreneur

Every hook here has been filtered through the Honest-Operator Brand
Voice. Use these as starting points for short-form, long-form, and
Reddit/HN reply openers. NEVER modify them in a way that adds an
income claim or timeline promise.

## "The quiet part" hooks
1. "The part every side-hustle course skips: week 6, when nothing is
   working yet."
2. "What no one tells you about the first $0 you make online."
3. "The thing that kills most side hustles isn't the offer — it's the
   ops behind it."

## Honesty-first hooks
4. "I've built ___ side projects. Here's what actually drove revenue
   and what was just vibes."
5. "Three things I wish someone told me before I quit my job."
6. "If you're still working a 9 to 5 and trying to build something,
   here's the honest timeline."

## Anti-guru hooks
7. "Why most 'make money online' advice is optimized for selling
   courses, not building businesses."
8. "The pattern: course → course → course → realize you needed a tool
   not a guru."
9. "What a real operator's day actually looks like (hint: boring)."

## Tool / systems hooks
10. "The ops layer nobody warned you about."
11. "The five hours a week that determine whether your side hustle
    survives month six."
12. "Here's the one-hour-per-week rule that kept my side project
    alive when I had a day job."

## Proof-led hooks (only use with real numbers you can back up)
13. "Spent $___ on courses in 2023. Here's what I learned about what
    a course can and can't do for you."
14. "A month of real numbers from a one-person business — the ugly
    ones too."
15. "I was skeptical of AI tools too. Here's what flipped me."

## Community / empathy hooks
16. "If you've been burned by a course, you're not alone — and here's
    what I'd do differently."
17. "The three questions I wish someone asked me before I spent $___
    on my first course."
18. "For people who are tired of being sold to."

## Reframes of common aspirations
19. "Forget 'passive income' for a minute. Here's what actually
    repeats."
20. "Financial freedom is marketing copy. Predictable income is the
    actual goal."
`
  },
  {
    id: "solo_kb__objection_scripts_aspiring",
    title: "Objection-Handling Scripts (Aspiring Entrepreneur)",
    category: "custom",
    tags: ["solopreneur", "sales", "objections", "aspiring-entrepreneur"],
    source: SOLO_SOURCE,
    description:
      "Specific reframes for the objections that aspiring-entrepreneur buyers bring. Read back out loud — every one is honest.",
    content: `# Objection Scripts

Each script follows: **Objection** → **What they mean** → **Our
reframe** → **What NOT to say.**

## "How is this different from [guru course]?"
**What they mean:** I've been burned. I'm braced for it to happen again.
**Our reframe:** "Fair skepticism. The honest answer: a course teaches
you what to do; we run the ops layer while you do it. If you haven't
actually built an offer yet, a course might be the right first step.
If you have and you're the bottleneck, we help. We are not a course
and we don't pretend to be."
**Don't say:** "We're better than ___." Never name competitors as
bad. Acknowledge the pattern, not the person.

## "I don't have money to invest."
**What they mean:** I've spent money on things that didn't work. I
don't want to do it again.
**Our reframe:** "Makes sense. Honestly, if you don't have $50/mo of
discretionary budget, the right move is probably to stay in your job
and save until you do. Tools don't create revenue. They remove
friction once revenue is already a realistic outcome."
**Don't say:** Anything implying this is a sacrifice that will pay
off. We can't promise that.

## "I don't have time."
**What they mean:** I'm burnt out, overcommitted, and scared of adding
one more thing.
**Our reframe:** "The version of this that works is the one-hour-a-week
version. If that's still more than you have right now, that's useful
information — it means your day job is the bottleneck, not your side
project. We'd rather you know that now than $___ later."
**Don't say:** "You'll find the time."

## "I've tried tools like this and stopped using them."
**What they mean:** I've been through the optimism-curve-to-abandoned
cycle.
**Our reframe:** "Which ones, and what made you stop? If the answer
is 'they didn't actually do the work, they just reminded me to do it,'
we're built differently. If the answer is 'I got distracted,' we're
probably not the fix — consistency is a human problem, not a tool
problem."
**Don't say:** "This time it'll be different." Let them convince
themselves.

## "Does this actually work or is it just AI hype?"
**What they mean:** I've seen a hundred AI-wrapper tools.
**Our reframe:** "Valid. What we do is boring on purpose. The AI part
is the cheapest piece — the value is in the ops wiring around it.
Happy to walk through a specific use case in your business and say
honestly whether it moves the needle."
**Don't say:** Anything marketing-y about "the power of AI."

## "Sounds too good to be true."
**What they mean:** They like what they hear but are waiting for the
catch.
**Our reframe:** "Here's the catch: you still have to ship an offer
people actually want. We don't do that for you. If you don't have a
real offer yet, we can't help. If you do and you're drowning in
everything around it, that's where we earn our keep."
**Don't say:** "There's no catch!" Always name the catch. The catch
IS the honesty.
`
  },
  {
    id: "solo_kb__wantrepreneur_target_communities",
    title: "Target Communities — Aspiring Entrepreneur",
    category: "custom",
    tags: ["solopreneur", "reddit", "hackernews", "outreach", "aspiring-entrepreneur"],
    source: SOLO_SOURCE,
    description:
      "The exact communities and keyword signals the outreach scanners should watch for this audience. Drop this into the scanner configs.",
    content: `# Target Communities — Aspiring Entrepreneur

This is the config the Reddit / HN / SO / GitHub scanners read. If a
community or keyword is not listed here, the scanner should not target
it for this ICP.

## Reddit — target subreddits
Paste into the Reddit Audience Scanner or the Reddit Outreach Playbook
under section 1:

- Entrepreneur
- sidehustle
- smallbusiness
- WorkOnline
- juststart
- passive_income
- sweatystartup
- EntrepreneurRideAlong
- digitalnomad
- financialindependence
- Flipping
- SideProject
- indiebiz
- solopreneur
- SaaS

## Reddit — keyword signals (active-intent phrases)
- "how do I start a ___"
- "anyone tried ___"
- "what tools do you use for ___"
- "I'm burned out at my 9 to 5"
- "tried ___, made zero"
- "looking for recommendations on ___"
- "what's the most realistic side hustle"
- "how much time per week does ___ take"
- "is ___ worth it in 2025"

## Hacker News — target searches
Kinds: ["story", "comment"]. Time window: day or week.

Keyword sets (use one per scan):
- ["side project", "quit my job"]
- ["first customer", "first sale"]
- ["how do you validate", "Ask HN"]
- ["solo founder", "one-person startup"]
- ["AI tool", "entrepreneur"]
- ["launch", "no audience"]

## Stack Overflow — skip for this ICP
This audience is not on SO. Do NOT queue drafts on SO for the
aspiring-entrepreneur angle — it'll read as off-topic and get flagged.
Stack Overflow is for the dev-targeted ICP only.

## GitHub — skip for this ICP
Also skip. GitHub issue drafts should only target dev-stack ICPs,
not the aspiring-entrepreneur audience.

## Indie Hackers / milestones
Watch the milestones feed for:
- "first dollar"
- "MRR goal"
- "quit my job"
- "side project"
- "bootstrapped"

(Manual for now — no scanner yet.)

## Scan cadence
- Reddit: every 6 hours during active launches, 12 otherwise.
- HN: every 12 hours.
- Daily cap: 5 queued drafts for this ICP across all platforms.
  Quality over quantity.

## Community-specific rules
- **r/Entrepreneur**: strict no-promo rule on many threads. If a reply
  would require mentioning {{businessName}}, skip unless the post is
  explicitly asking for tool recommendations.
- **r/smallbusiness**: hostile to SaaS-shaped tools. Only engage if the
  problem is genuinely ops-layer (not "here's a tool").
- **r/sidehustle**: lots of low-effort posts. Only engage on posts
  with real specificity — a stack, a budget, a number.
- **r/juststart**: probably our warmest audience. Prioritize this one.
`
  },
  {
    id: "solo_kb__process_case_study_template",
    title: "Process-First Case Study Template",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "case-study", "aspiring-entrepreneur"],
    source: SOLO_SOURCE,
    description:
      "Case-study shape that lets us share real customer stories without crossing into income-claim territory.",
    content: `# Case Study Template — Process-First

Every case study we publish follows this shape. Outcomes are stated as
process metrics (hours saved, bottleneck removed, decisions shipped),
not dollar metrics. This keeps us out of FTC / Truth-in-Advertising
land AND keeps us from sounding like a guru landing page.

## Fields to fill
- **Customer name:** (or anonymized "A Shopify store owner in ___")
- **What they do:** 1 sentence.
- **Stage when they started:** e.g. "10 SKUs, part-time while holding
  a day job."
- **The specific bottleneck:** What was blocking them? Be concrete.
- **How long they'd been stuck:** Weeks, months — their own framing.

## The story (4 short paragraphs)
1. **Before:** What a typical week looked like. The exact tasks
   piling up.
2. **What they did:** What they actually built / installed / turned
   on. Specifics of which workflows, which agents, which KB.
3. **What changed:** Measurable process shifts. "Replying to DMs
   dropped from 40/week to 4." "Launch day went from a panic to a
   runbook."
4. **What they still have to do:** Explicitly name the work they're
   still responsible for. This is the honesty anchor.

## Allowed outcome metrics
- Hours saved per week
- Tasks per week dropped
- Number of decisions shipped
- Number of launches executed
- Number of new pieces of content published per week
- Number of customer touches per week
- Ops cost comparison (ONLY if we have a real quoted alternative)

## Forbidden outcome metrics
- "$X in revenue"
- "$X MRR"
- "X% revenue growth"
- "Went from $0 to $___"
- Any timeline-bound income number
- Subscriber / follower counts framed as income

## One-line call-to-action formats
- "If you're at a similar bottleneck, here's where I'd start: ___."
- "Full disclosure, I build {{businessName}}. [link to docs, not
  sales page]."
- Never: "Book a call", "Limited spots", "DM me for the link."
`
  },
  {
    id: "solo_kb__content_angle_library",
    title: "Content Angle Library — Aspiring Entrepreneur",
    category: "custom",
    tags: ["solopreneur", "content", "aspiring-entrepreneur"],
    source: SOLO_SOURCE,
    description:
      "Recurring content angles that attract aspiring entrepreneurs without leaning on hype.",
    content: `# Content Angle Library

These are the recurring angles the Content Engine workflow should
rotate through when the audience is aspiring entrepreneurs. Each
angle has an example hook and the format it maps to best.

## 1. "The CMO / COO / CTO you can't afford yet"
**Why it lands:** People intuitively know they need roles they can't
fill. We frame as filling the role, not adding a tool.
**Format:** Long-form (X thread, newsletter), short-form demos.
**Example hook:** "You can't afford a CMO yet. You can afford the
layer that does what one would run."

## 2. "What a real day looks like"
**Why it lands:** Aspirants are starving for reality. Most content
in this space is motivational, not operational.
**Format:** Short-form day-in-the-life, newsletter.
**Example hook:** "07:00 standup from my Ops Lead. 08:00 two drafts
ready to review. 09:30 back to the day job."

## 3. "The one-hour-per-week rule"
**Why it lands:** Time is their #1 objection.
**Format:** Short-form, newsletter, Reddit reply template.
**Example hook:** "If you can't give this 60 minutes a week, don't
start. If you can, here's what those 60 minutes should be."

## 4. "The ops layer nobody warned you about"
**Why it lands:** Names a hidden cost of starting a business that
every first-timer hits.
**Format:** Long-form, pinned post.
**Example hook:** "The thing that killed my first three side projects
wasn't the offer. It was everything around the offer."

## 5. "What a course would have told you to hire"
**Why it lands:** Puts us in the 'tool' category, not the 'guru'
category.
**Format:** Short-form, reply template.
**Example hook:** "A $2,000 course told me to hire a VA, a copywriter,
and a community manager. I didn't have the money. Here's what I did
instead."

## 6. "Numbers I'm allowed to share"
**Why it lands:** Honesty anchor. Signals we won't pretend.
**Format:** Monthly newsletter, thread.
**Example hook:** "I'm not going to show you revenue. I'll show you
hours saved, drafts shipped, customers replied to. Those are the
numbers that actually compound."

## 7. "Tried this, failed. Tried that, failed. Here's what's working."
**Why it lands:** Relatable + honest about iteration.
**Format:** Long-form story post.
**Example hook:** "Three side hustles, $0 in revenue across all of
them. Here's the specific thing I was doing wrong — and what finally
clicked."

## 8. "If I had to start over with $0"
**Why it lands:** Classic, but honest version — no course pitches at
the end.
**Format:** Long-form, video script.
**Example hook:** "If I had $0 and 10 hours a week, here's the exact
week-by-week sequence I'd run. The tool part is month 3, not month 1."

## 9. "The part the offer pitches skip"
**Why it lands:** Puts us AFTER the offer has been validated, which
is where most tools lie.
**Format:** Short-form, thread.
**Example hook:** "Offer validated. Customers exist. Now what? That's
where most people stall. Here's the playbook."

## 10. "Watch me break it"
**Why it lands:** Transparency. No-one does live bug tours.
**Format:** Video, live stream clip.
**Example hook:** "Showing every workflow on my own business — including
the ones that failed this week and what I'm changing."
`
  },
  {
    id: "solo_kb__red_line_rules",
    title: "Red-Line Marketing Rules",
    category: "policies",
    tier: "hot",
    tags: ["solopreneur", "policy", "compliance", "aspiring-entrepreneur"],
    source: SOLO_SOURCE,
    description:
      "The list of things we never say or imply. Any draft that breaks one of these rules is auto-rejected.",
    content: `# Red-Line Marketing Rules

These are hard rules. Any draft — social post, ad, reply, email,
landing-page copy — that breaks one of these gets thrown out without
being reviewed.

The rules exist because:
- We don't want to sell to people who'll be disappointed.
- We don't want to be the next get-rich-quick story people regret
  buying from.
- Some of these are literal FTC / consumer-protection violations.

## Never claim income or outcomes we can't back up in writing
- **No income numbers in copy** unless we have a signed, dated,
  documented testimonial AND the required "results not typical"
  disclosure (per FTC guides on endorsements).
- **No "average customer makes $X"** unless we have the actual cohort
  data and can show it.
- **No "first sale in X days"** — timelines depend on their offer,
  not our tool.

## Never create fake scarcity
- No "only 3 spots left" unless there is an actual cap of 3 in the
  system and we'll honor it.
- No "price goes up tomorrow" unless we've actually set the price
  change.
- No countdown timers that reset on refresh.
- No "closing soon" emails if the product is evergreen.

## Never astroturf
- No fake testimonials. Ever.
- No sock-puppet accounts on Reddit, HN, Twitter, or anywhere else.
- No "I used this tool and it changed my life" posts from accounts
  that are actually us.
- If a real user has given us permission, we can quote them — with
  their actual handle, verifiable.

## Never misrepresent affiliation
- Every paid, affiliate, or incentivized mention must be disclosed.
- On Reddit/HN/SO/GitHub, every reply that mentions {{businessName}}
  must include a disclosure.
- No "I just came across this tool" framing from company accounts.

## Never pretend to guarantee what we don't control
- Disallowed phrases: "Guaranteed", "100%", "Proven", "Risk-free",
  "Certain", "Always works."
- Allowed: "Here's what tends to happen when someone actually does
  the work."

## Never pressure
- No shaming frames ("still stuck in your 9 to 5?")
- No fear-of-missing-out framing we can't back up.
- No "the economy is collapsing, buy my thing" panic copy.

## Never sell to someone who has explicitly told us they can't afford it
- If a reply / DM mentions "I don't have money" or "I'm broke," the
  response should be "stay in your job and save" — not a discount,
  not a payment plan, not a upsell. We've flagged this inside the
  Objection-Handling Scripts KB.

## Auto-reject checks for any drafted reply
Before queuing a draft, the agent must check:
- [ ] No banned phrases from the Honest-Operator Brand Voice list.
- [ ] No income or timeline claim.
- [ ] No implication of guaranteed outcome.
- [ ] Disclosure included if {{businessName}} is mentioned.
- [ ] At least one concrete, usable idea the reader can take even
      without clicking anything.
- [ ] Ends with a real question or a genuine offer of help, not a CTA.

If any check fails, **do not queue the draft.** Write a different one
or skip the post.
`
  },
  {
    id: "solo_kb__broll_sourcing_playbook",
    title: "B-Roll Sourcing Playbook",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "video", "broll", "sop"],
    source: SOLO_SOURCE,
    description:
      "What makes a B-roll clip worth using, where to source it (Pexels first), and how to pair it with text overlays without looking like stock content.",
    content: `# B-Roll Sourcing Playbook

The B-Roll + Text Overlay Pack workflow and any agent calling
\`broll_search\` reads this to pick clips the user can actually ship.

## 1. Sources, in order
- **Pexels** (free, commercial-use allowed, attribution optional) —
  default. Use \`broll_search\` with specific multi-word queries.
- **Uploads** (assets the user dropped in /admin/uploads) — best for
  brand-consistent content. Always prefer these over stock if they
  match.
- **Pixabay** — secondary option, fewer clips, same license shape.
- **Storyblocks / Shutterstock** — only for paid accounts; skip unless
  the user says they have one.

## 2. What makes a B-roll clip "good"
- **Neutral composition** — no visible faces, no visible logos, no
  other brand signage.
- **4–15 seconds** duration — shorter than that is unusable; longer
  than that is almost always re-edited down.
- **Shot from a fixed camera** (tripod or stabilized) — handheld only
  when the energy matches.
- **Portrait (9:16)** for TikTok/Shorts/Reels, **1:1** for square
  feeds, **16:9** only for YouTube long-form.
- **No audio that fights the voiceover** — mute the B-roll; we control
  audio ourselves.
- **Matches the beat emotionally** — fast cuts = fast music; slow
  transformation = slow dolly / wide shot.

## 3. Disqualifiers (skip these clips)
- Visible faces (copyright + identifiable person risk)
- Branded products on screen
- Stock-model-smiling-at-camera (instantly reads as cringe)
- Watermarks of any kind
- Content that shows nationality, race, or age in ways that contradict
  our audience framing

## 4. Text-overlay rules
- **Max 10 words per beat** — if it doesn't fit in one breath, cut it.
- **One beat every 2–3 seconds** — keeps eyes moving; prevents
  scroll-off.
- **Bold sans-serif** (Inter Bold, Helvetica Bold, Poppins Bold) —
  never a script / serif / thin weight.
- **High-contrast** against B-roll — white text on dim B-roll, or
  colored bg blocks if B-roll is busy.
- **Bottom-third placement** for TikTok (above UI overlays).
- Start with the hook payoff, not "In this video I'll…"

## 5. Scene length by platform
- TikTok / Shorts / Reels: **22–45 seconds** sweet spot
- Twitter/X native: **30–60 seconds**
- LinkedIn native: **45–90 seconds**

## 6. Assembly pattern (agent must queue this shape)
A proper scene call to \`log_broll_scene\` includes:
- \`hookLine\` — the 0–2s opening line
- 3–8 \`overlays\` — one per beat, in order
- 3–8 \`brollClips\` — matching download URLs in the same beat order
- \`caption\` — platform-appropriate with brand voice
- \`totalDurationSec\` — realistic total (22–45 for shorts)

## 7. Attribution
Pexels does NOT require attribution. We give it anyway when convenient
(pinned comment + photographer handle) because it keeps accounts in
good standing and signals we're not scraping. Never claim the B-roll
as ours.

## 8. Red lines (will get account flagged)
- Scraping TikTok / YouTube for B-roll directly — never use other
  creators' clips without permission
- Removing watermarks from stock content that has them
- Presenting B-roll as if it's our product / team / customer (that's
  a deceptive-practices violation on TikTok and FTC)
`
  },
  {
    id: "solo_kb__ai_avatar_playbook",
    title: "AI Avatar Video Playbook",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "video", "heygen", "creatify", "avatar", "sop"],
    source: SOLO_SOURCE,
    description:
      "Rules for producing HeyGen / Creatify avatar videos that don't feel like AI junk — scripts, voice selection, disclosure, and volume discipline.",
    content: `# AI Avatar Video Playbook

Agents call \`heygen_list_avatars\` → \`heygen_generate_video\` (or
\`creatify_list_avatars\` → \`creatify_generate_ugc\`) and then poll
the \`check\` variants. This playbook decides which tool to use when
and how to keep the output usable.

## 1. Tool selection
- **HeyGen** — best single-avatar quality. Use for: course promos,
  feature explainers, founder-voice talking heads, waitlist nurture
  sequences. ~$0.50–$1.50 per minute of output.
- **Creatify** — best volume + UGC-realism. Use for: hook-variation
  testing (10–20 versions per angle), product-spotlight rotations,
  always-on content pipelines. ~$0.15–$0.50 per video.
- **Rule:** if you need ONE great video, HeyGen. If you need TEN
  variations to A/B, Creatify.

## 2. Script rules (both tools)
- **First-person, conversational.** "I've been testing" beats "This
  video explains."
- **Short sentences**, 6–12 words each.
- **One idea per scene.** If you need two ideas, generate two videos.
- **Max 1500 characters per scene** (HeyGen technical limit; also
  prevents monologue fatigue).
- **End with a concrete ask** — not "Check out our tool." Instead:
  "Reply with the word WORKFLOW and I'll send you the template."
- **Honest-Operator Voice rules apply** — no income claims, no
  timeline promises, banned phrases list.

## 3. Voice selection
- **Match voice gender + age** to the ICP's expected peer.
- **Test 2–3 voices** on the first draft before committing — voice
  carries 40% of perceived quality.
- **Avoid "perfect" voices** — slight accent / breath / imperfection
  reads more human.

## 4. Required AI disclosure
Every published avatar video MUST include:
- Caption disclosure: "Created with AI assistance"
- On-screen label: for TikTok, use the built-in AI Content Label when
  publishing
- If the avatar looks like a specific real person (founder, team
  member): explicit consent documented before generation
- FTC compliance: if the video makes ANY product claim, add "Results
  vary. Not typical results." disclosure as on-screen text or caption

## 5. Volume discipline
- **Per product / per angle: 10–20 Creatify variations** to find
  winners.
- **Per founder-voice piece: 1 HeyGen video**, iterated across ~3
  voice/script variants first.
- **Kill threshold:** hook rate < 20% (viewers past 3s) → replace
  opening, don't iterate.
- **Promote threshold:** hook rate > 30% + CTR > 0.7% → queue for
  Spark Ads.

## 6. Quality gates before publishing
Every avatar video must pass:
- [ ] Script follows brand voice rules (no banned phrases, no income
      claim)
- [ ] AI disclosure included in caption AND on-screen
- [ ] Captions burned in (never rely on auto-generated captions at
      publish time)
- [ ] Audio levels normalized (-14 LUFS target)
- [ ] First frame is the hook (not a title card)
- [ ] CTA is concrete and actionable
- [ ] No comparison to competitors by name
- [ ] No unverifiable stats

## 7. Storage discipline
- Upload finished videos to \`/admin/uploads\` so they live on R2 with
  stable URLs
- Tag with \`kind: video_final\` in the upload title for searchability
- Reuse high-performer videos by remixing the hook, not re-generating
  from scratch
`
  },
  {
    id: "solo_kb__video_asset_management",
    title: "Video Asset Management",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "video", "assets", "r2", "sop"],
    source: SOLO_SOURCE,
    description:
      "How uploads, HeyGen outputs, Creatify renders, and B-roll flow through the system — and what agents should do with them.",
    content: `# Video Asset Management

Where video lives and who touches it. Agents that produce or consume
video should follow this flow.

## 1. Where assets live
- **Cloudflare R2** (\`/admin/uploads\`) — canonical home for anything
  big: demo videos, long-form masters, finished shorts, B-roll you
  plan to reuse.
- **HeyGen-hosted** — generated avatar videos live at HeyGen URLs; we
  download + re-upload to R2 once we plan to use them, so we control
  the URL and it survives HeyGen's own CDN TTLs.
- **Creatify-hosted** — same pattern as HeyGen.
- **Pexels** — we never host Pexels B-roll ourselves; we reference the
  download URL at assembly time.

## 2. Upload rules
- Use \`/admin/uploads\` for files > 25 MB (the old local-disk limit).
- Set the folder to \`videos\` for long-form, \`shorts\` for finished
  short-form, \`broll\` for reusable B-roll.
- Always fill the Title and Description — agents use this to decide
  which assets are relevant.

## 3. Agent discoverability
When an agent needs to reference a video asset:
- Look at recent \`asset_upload\` ActivityEntry rows (surfaced in
  context automatically) for the title / description / publicUrl.
- Copy the publicUrl into downstream tool calls (e.g.
  \`auto_clip_submit({ video_url })\` or as a reference in Telegram).

## 4. Agent production flow
When an agent produces a video (HeyGen / Creatify / finished clip):
1. Generate via the tool.
2. Poll the \`check\` variant until finished.
3. When ready, the agent should report the final URL to the user and
   recommend uploading it into \`/admin/uploads\` for stable storage.
4. NEVER promise it will auto-upload — we don't have that wiring yet.
   Be honest: "The video is ready at <url>. Please download + re-upload
   to /admin/uploads so it doesn't disappear from HeyGen's CDN."

## 5. Retention policy
- **R2 uploads:** kept indefinitely (storage is ~$0.015/GB/mo).
- **HeyGen/Creatify hosted:** providers may prune; don't rely on them.
- **B-roll references:** Pexels URLs occasionally rotate; if a clip
  becomes important, re-upload it to R2 before publishing.

## 6. Naming conventions
Helps both agents and humans find things fast:
- \`demo-v3-2026-04-19.mp4\` — include a version + date
- \`short-tiktok-hook3-creatify.mp4\` — platform + angle + producer
- \`broll-laptop-typing-4k.mp4\` — kind + subject + quality
- \`heygen-onboarding-welcome-v1.mp4\` — source + purpose + version
`
  },
  {
    id: "solo_kb__short_form_clip_playbook",
    title: "Short-Form Clip Playbook",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "video", "shorts", "tiktok", "sop"],
    source: SOLO_SOURCE,
    description:
      "Rules your agents follow when mining long-form videos for short-form clips. Defines what makes a clip worth cutting, how to write the hook, and which platforms get what aspect ratio.",
    content: `# Short-Form Clip Playbook

The Video-to-Shorts Clip Miner workflow and every agent that calls
fetch_video_transcript reads this entry to decide which moments to
queue and how to frame them.

## 1. Always fetch the transcript first
Never propose clips based on the URL alone. Call
\`fetch_video_transcript\` first, read the actual words, and pick
segments using real timestamps. If the tool returns "no captions,"
tell the user — don't guess.

## 2. What makes a clip worth cutting
At least TWO of these must be true:
- **Strong standalone hook in the first 3 seconds** (a claim, a
  question, a stat, a pattern interrupt).
- **Self-contained payoff** — the viewer gets something useful even
  without the rest of the video.
- **Emotional or tonal shift** mid-segment (surprise, laugh, confession).
- **Reusable numbers or names** — specific dollars, dates, tools.
- **Transformation or before/after** pattern.

Skip any segment that requires context from earlier in the video.

## 3. Ideal length per platform
- **TikTok / Shorts / Reels**: 22–55 seconds sweet spot. Under 15s
  only for pure hook bangers.
- **X / Twitter native**: 30–90 seconds.
- **LinkedIn native**: 45–120 seconds.

## 4. Aspect ratios
- **TikTok / Shorts / Reels**: 9:16 vertical
- **X / LinkedIn**: 1:1 or 16:9 work best in-feed
- **YouTube long-form re-upload**: 16:9

## 5. Hook-writing rules (strict)
- Max 10 words on screen
- No "In this video I'll…" openings
- Lead with the payoff or the pattern interrupt
- First 2 seconds must deliver visual OR verbal tension
- Hook text must match what's actually said — if the audio doesn't
  back it up, the viewer bounces

## 6. Caption-writing rules
- 2–4 short sentences max
- First line teases the payoff without giving it away
- Include one specific number or name
- End with a question OR a platform-native CTA (no "link in bio" on
  X; "comment [keyword]" works on TikTok)
- Must follow the Honest-Operator Brand Voice rules
- No income claims, no passive-income framing, no timeline promises
- If {{businessName}} is mentioned, include disclosure per Red-Line
  Marketing Rules

## 7. How many clips per video
- 60-minute video: 6–10 suggestions
- 20-minute video: 3–5 suggestions
- 10-minute video: 2–4 suggestions
- Quality over volume. Score each 1–10 and only queue 6+ scores.

## 8. Workflow output
For each qualifying moment, call \`log_video_clip\` with:
- Exact \`startSec\` / \`endSec\` from the transcript (not rounded)
- \`hookLine\` — the 10-word-max on-screen hook
- \`caption\` — platform-specific, brand-voice-compliant
- \`targetPlatform\` — where this should go
- \`aspectRatio\` — matched to platform
- \`transcriptExcerpt\` — copy the exact words so the human can verify
- \`reasoning\` — 1–2 sentences on WHY this clip
- \`score\` — your honest 1–10 confidence

Then tell the user: "N clips queued in /admin/clips — review and cut
the ones you like." Do NOT promise turnaround, cut time, or delivery —
we do not cut videos for them.
`
  },
  {
    id: "solo_kb__hn_outreach_playbook",
    title: "Hacker News Outreach Playbook",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "hackernews", "outreach", "sop"],
    source: SOLO_SOURCE,
    description:
      "Where to look on HN, how to write replies HN won't downvote, and the brand-safety rules the scanner has to follow.",
    content: `# Hacker News Outreach Playbook

HN is skeptical and well-read. One self-promotional reply can nuke your
account. Drafts follow these rules or don't get queued.

## 1. What to scan for
- **Ask HN / Show HN** threads about the problem you solve
- Story comments on posts about competing products
- Comments complaining about a specific pain you address

Kinds to search: ["story", "comment"]. Prefer timeWindow "day" or "week"
with moderate minPoints (5–20).

## 2. Keyword / phrase signals (user's actual language)
- "Ask HN: how do you ___"
- "Is there a tool that ___"
- "Tried ___, wasn't great because ___"
- "Looking for recommendations on ___"
- "Built a ___ in ___, what am I missing?"
- ___
- ___

## 3. ICP fit (must apply 2+ before queuing)
- Clear technical context (stack, scale, role mentioned)
- Specific pain, not generic musing
- Recent (< 48 hours old)
- Thread is still active (< 30 comments so the reply is visible)

## 4. Disqualifiers
- Rant / vent with no question
- Asking for free work
- Post is already 200+ comments deep
- Author has clearly been burned by self-promo before — check their own comments

## 5. HN reply format (required)
1. **Start with a concrete technical point** they can use even if they never click a link.
2. **Share a specific, testable claim** with a number or code snippet if possible.
3. **Disclose affiliation** inline: "Disclosure: I work on {{businessName}}."
4. **Link at most once**, and only if it genuinely adds value.
5. End with a question that continues the technical conversation.

Length: 100–250 words. Longer than Reddit because HN rewards depth.

## 6. Banned phrases (instant disqualifier)
- "Disruptive"
- "Revolutionary"
- "Game-changer"
- "Best-in-class"
- "Solving X for the first time"
- Any superlative without a benchmark

## 7. Style
- Plain text. No emojis. No marketing adjectives.
- Prefer specific examples to generalizations.
- Be willing to be wrong — acknowledge tradeoffs.
- If you can't explain the claim in one paragraph, cut it.
`
  },
  {
    id: "solo_kb__stackoverflow_playbook",
    title: "Stack Overflow Outreach Playbook",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "stackoverflow", "developer", "sop"],
    source: SOLO_SOURCE,
    description:
      "How the Stack Overflow scanner picks questions worth answering and how drafts stay within site rules.",
    content: `# Stack Overflow Outreach Playbook

Stack Overflow has strict self-promo rules. Follow them precisely.

## 1. Target tags
- ___
- ___
- ___

Use the \`tags\` arg, not \`keywords\`, whenever possible — tag filters
produce the highest signal-to-noise.

## 2. What to prioritize
- Questions < 48 hours old with 0 answers
- Questions with answers < 3 total score
- Questions on tags where our product has a legit technical fit

## 3. Disqualifiers
- Question already has an accepted answer (no value in replying)
- Question is a duplicate of a canonical SO answer
- Off-topic / opinion-based — SO will close these anyway

## 4. Answer format (REQUIRED — this is not Reddit)
1. **Answer the question directly and completely**, assuming the user never reads anything else.
2. Include a minimal code sample that works if pasted.
3. Explain tradeoffs and when NOT to use your approach.
4. Reference our product **ONLY** as one option among alternatives, with a disclosure: "Full disclosure, I work on {{businessName}}. It's one way to handle X, but [other approach] also works when [condition]."
5. No marketing language. Ever.

Length: 150–400 words. Include code blocks.

## 5. Banned moves (will get you site-banned)
- Posting the same answer across multiple questions ("link spam")
- Mentioning a product without a disclosure
- Answering questions with "use our tool" and nothing else
- Creating separate accounts to upvote your answers
`
  },
  {
    id: "solo_kb__github_playbook",
    title: "GitHub Outreach Playbook",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "github", "developer", "sop"],
    source: SOLO_SOURCE,
    description:
      "Which repos to watch, how to reply to issues on competitor projects, and the self-promo guardrails that keep accounts in good standing.",
    content: `# GitHub Outreach Playbook

Issue threads on adjacent and competitor repos are some of the warmest
outbound signal anywhere — people actively looking for a fix, with
public context. Handle carefully.

## 1. Repositories to watch
Full owner/name pairs:
- ___
- ___
- ___

(Leave empty to do keyword-only searches across all of GitHub.)

## 2. Issue signals that matter
- Title contains: "feature request", "not working", "how do I ___", "bug"
- State: open
- Created: last 14 days
- Comments: < 5 (so our reply stays visible)

## 3. Strict do's and don'ts
**Do:**
- Be genuinely helpful first — suggest a workaround that doesn't require our product.
- Disclose affiliation every time: "Disclosure: I build {{businessName}}."
- Offer a minimal repro or pointer to docs, not a sales pitch.
- Thank the maintainer for their work on the project.

**Don't:**
- Comment on every issue in a repo (looks like a spam campaign).
- Copy/paste the same reply across issues.
- Link directly to marketing pages. Link to docs or a technical comparison.
- Start with "We built this to solve exactly that."

## 4. Reply structure
1. **Acknowledge the specific problem** they described.
2. **Workaround / tip that doesn't require switching tools.**
3. **Short mention** of how {{businessName}} approaches it, with
   disclosure — one sentence max.
4. Ask a clarifying question about their setup.

Length: 60–180 words. GitHub comments should be brief.

## 5. When to skip entirely
- If you'd be the 3rd reply mentioning a product on the same issue, back off.
- If the maintainer has explicitly asked comments to stay on-topic.
- If the issue is clearly going to be closed as wontfix or duplicate.
`
  },
  {
    id: "solo_kb__reddit_outreach_playbook",
    title: "Reddit Outreach Playbook",
    category: "processes",
    tier: "cold",
    tags: ["solopreneur", "reddit", "outreach", "sop"],
    source: SOLO_SOURCE,
    description: "Everything the Reddit Audience Scanner needs — target subreddits, ICP signals, reply format, banned phrases, and disclosure rules.",
    content: `# Reddit Outreach Playbook

The Reddit Audience Scanner workflow uses this entry to decide *where* to
look, *who* to engage, and *how* to write replies the user will actually
want to post.

## 1. Target subreddits
List the subreddits the agent should scan. Prefer niche communities with
clear rules over giant catch-all ones.

- r/___
- r/___
- r/___
- r/___

## 2. Keyword & phrase signals
Multi-word phrases beat single keywords. Put the user's exact language
on the left, the intent on the right.

- "looking for recommendations" → active-intent
- "frustrated with ___" → pain signal
- "anyone use ___" → consideration
- "is ___ worth it" → evaluation
- ___
- ___

## 3. ICP signals (what makes a target worth replying to)
- Role / stage of business mentioned: ___
- Specific pain named: ___
- Budget or urgency hints: ___
- They're asking, not venting
- Post is < 48 hours old and has < 30 comments (so the reply is still visible)

## 4. Disqualifiers (skip these even if keywords match)
- Post is clearly asking for free work
- Subreddit bans self-promo and the reply would have to mention us
- Post is a vent / rant with no question
- Author's account is < 30 days old or suspiciously karma-light

## 5. Reply format (non-negotiable)
Every draft the agent queues MUST follow this shape:

1. **Acknowledge** the specific situation they described (one sentence).
2. **Give one concrete piece of help** they can use even if they never click a link.
3. **Mention {{businessName}} ONLY if relevant** — wrap it in a disclosure: "full disclosure, I build ___."
4. **End with a question** that invites dialogue, not a pitch.

Total length: 80–180 words. Never longer.

## 6. Banned phrases (instant disqualifier)
- "Check out our tool"
- "DM me"
- "Best tool for ___"
- "Game changer"
- "Sign up here"
- Any superlative with no evidence

## 7. Disclosure rules
- If the reply mentions {{businessName}} in ANY way, prepend the
  disclosure phrase from section 5.
- If the subreddit has a no-promo rule, do not mention {{businessName}}
  at all — the reply has to stand on its own helpfulness.
- Never pretend to be a neutral third party if we built the thing.

## 8. Operating cadence
- Scan every 6 hours during active launches, every 12 hours otherwise.
- Max 5 queued targets per scan (quality > volume).
- User reviews + posts manually — we do NOT auto-comment.
`
  },
  {
    id: "solo_kb__funnel_map",
    title: "Funnel Map",
    category: "custom",
    tags: ["solopreneur", "funnel", "growth"],
    source: SOLO_SOURCE,
    content: `# Top of funnel
- Traffic sources: ___
- Lead magnet(s): ___
- Opt-in rate target: ___

# Middle of funnel
- Nurture sequence: ___
- Content touchpoints: ___
- Objection-handling assets: ___

# Bottom of funnel
- Offer page: ___
- Conversion rate target: ___
- Follow-up sequences (cart abandon, post-purchase): ___

# Retention
- Onboarding touchpoints: ___
- Referral / affiliate trigger: ___
- Upsell path: ___
`
  }
];

const VIDEO_PIPELINE_SOURCE = "🎥 AI Video Production Pipeline";

/**
 * Reusable playbooks for ANY business that connects the ElevenLabs +
 * JSON2Video + YouTube integrations. Paired with the per-tool schema
 * descriptions the agents already see, these items let an agent outside
 * the Faceless YouTube template (a Ghost Operator CMO, a TikTok Shop
 * Content Creator, a Social Media Agency's editor) reliably chain the
 * 7-step pipeline without needing its system prompt rewritten.
 *
 * Install via /admin/knowledge → Library once per business that should
 * be able to produce video end-to-end.
 */
export const VIDEO_PIPELINE_KNOWLEDGE: KnowledgeLibraryItem[] = [
  {
    id: "video_pipeline__full_chain",
    title: "AI Video Production Pipeline — end-to-end tool chain",
    category: "processes",
    tags: ["video", "production", "youtube", "elevenlabs", "json2video", "pipeline"],
    source: VIDEO_PIPELINE_SOURCE,
    tier: "warm",
    description:
      "The canonical 7-step chain agents follow when asked to produce a video for {{businessName}}. Covers every tool call, what order to use them in, cost estimates, and the HITL gate.",
    content: `# AI Video Production Pipeline for {{businessName}}

End-to-end pipeline for producing a video with the built-in tools. Every
video follows these steps in order; skip none without recording why.

## Step 1 — SCRIPT (HITL-approved)
Script is drafted by a content/script agent (or directly by you) with
retention structure: hook in first 3 seconds, pattern interrupts, open
loops, single CTA. It MUST be reviewed and approved by a human before
Step 2. The \`generate_voiceover\` tool enforces this rule — never voice
an unapproved script.

## Step 2 — VOICEOVER (ElevenLabs)
- Optional: \`list_elevenlabs_voices\` if unsure which voice to use.
- Required: \`generate_voiceover({ text, voice_id?, model_id? })\`.
- Uses the integration's \`default_voice_id\` when voice_id is omitted.
- Result: brandAssetId + R2 public URL + character count + cost.
- Cost: ~$0.10–$0.12 per 1K chars on v2/v3, ~$0.05 on flash_v2_5.
- Optional QA: \`transcribe_audio({ audio_url })\` → diff against source
  script to catch TTS mispronunciations of technical terms / names /
  numbers BEFORE shipping to assembly.
- If script exceeds 5000 chars, split into scene-level chunks and call
  once per chunk.

## Step 3 — VISUALS (fal.ai + Pexels)
- Free stock first: \`broll_search({ keywords, orientation, limit })\`
  returns Pexels clips with download URLs.
- AI images: \`generate_image({ prompt, model })\` — prefer
  "fal-ai/flux-pro/v1.1" for photoreal, "fal-ai/ideogram/v3" for
  text-in-image.
- AI video (5–10 sec hero clips only, don't overuse):
  \`generate_video({ prompt, model, duration, aspect_ratio })\`. Default
  model "fal-ai/kling-video/v1.6/standard/text-to-video".
- Async poll: \`fal_check_generation({ request_id, model })\` if the
  initial call timed out.
- Already-uploaded assets: \`list_brand_assets({ fileType, category })\`
  and \`get_brand_asset({ id })\` — REUSE before generating new.

## Step 4 — THUMBNAIL (fal.ai)
- \`generate_image({ prompt, model: "fal-ai/ideogram/v3" })\` for
  text-heavy (90–95% text accuracy) or flux-pro/v1.1 for photoreal.
- 1280×720 jpg/png, ≤2 MB required by YouTube.
- Result auto-persists to R2 via the fal.ai tool's built-in handler.

## Step 5 — R2 PERSISTENCE (as needed)
Third-party CDN URLs expire. If any tool hands back a
non-R2 URL you plan to reuse (e.g. a raw JSON2Video output, a Pexels
mp4), call \`upload_to_r2({ source_url, filename })\` IMMEDIATELY so the
asset lives in your bucket and stays linkable.

## Step 6 — ASSEMBLE (JSON2Video)
- \`assemble_video({ template, resolution, quality, title })\` submits a
  JSON2Video \`movie\` template. Template has scenes with voiceover
  audio, B-roll video, on-screen text, transitions, music.
- Returns a \`project_id\`. Status is async.
- Poll: \`check_video_assembly({ project_id })\` every 30–60 s until
  status = "done". When done, the finished mp4 is auto-pulled into R2
  and a BrandAsset row is created.
- Render cost: included in the JSON2Video subscription (200 min/mo on
  the $49.95 plan).

## Step 7 — PUBLISH (YouTube, if connected)
- Preflight: uploads cost 1600 of the 10 000 daily quota units. Max ~6
  uploads/day per connected channel. The tool checks quota before
  firing and returns a clean error if you'd bust the cap.
- \`youtube_upload_video({ video_url, title, description, tags,
  privacy_status: "private", made_for_kids: false })\` — always start
  PRIVATE. Returns \`videoId\`.
- \`youtube_set_thumbnail({ video_id, image_url })\` — 50 units.
- \`youtube_update_video_metadata({ video_id, ... })\` to tweak
  title/description/tags — 50 units per call.
- When reviewed and ready: call
  \`youtube_update_video_metadata({ video_id, privacy_status: "public" })\`.

## Step 8 — MONITOR
- 48-hour CTR audit (the hard gate):
  \`youtube_get_video_analytics({ video_ids: [id] })\` — if
  impressionsCtr < 3 %, re-package (new title + new thumbnail).
- Weekly: \`youtube_list_channel_videos\` then batch analytics on the
  last 10 videos. AVD below 30 % means an algorithmic penalty is likely.

## Typical per-video cost
- Script / LLM research: ~$0.10
- ElevenLabs voiceover (9K chars for a 10-min episode): ~$1.00
- 5–8 AI images (thumbnail + hero): ~$0.30
- 1–2 AI video hero clips: ~$0.45
- JSON2Video assembly: included in plan
- YouTube upload: free (quota-gated, not dollar-gated)
- **Total variable: ~$3–4 per 10-minute video.**
- Monthly fixed: ~$200 (ElevenLabs $22 + JSON2Video $50 + misc
  stock/music subs).

## Partial workflows
Agents don't have to run the whole chain. Legitimate single-tool
calls: "voice this tagline" (just Step 2), "check our CTR on the last
10 videos" (just Step 8 analytics), "upload this already-made mp4 to
YouTube" (jump to Step 7 with the R2 URL).

## What this pipeline does NOT replace
Trend research, script writing judgement, editorial voice, and
strategic packaging decisions (titles + thumbnails). Those remain
human or human-supervised work. This pipeline is the production
plumbing only.
`
  },
  {
    id: "video_pipeline__voiceover_hitl",
    title: "Voiceover HITL Gate — never voice an unapproved script",
    category: "policies",
    tags: ["video", "voiceover", "elevenlabs", "hitl", "approval", "policy"],
    source: VIDEO_PIPELINE_SOURCE,
    tier: "hot",
    description:
      "Mandatory policy for any agent with access to generate_voiceover. Protects against AI slop + unapproved content going live.",
    content: `# Voiceover HITL Gate — {{businessName}}

Generating voiceover is cheap and fast, which is exactly why it's
dangerous. A voiceover crystallizes a script into a shippable asset —
once it exists, pressure mounts to use it. The moment you generate on
an unapproved script is the moment editorial quality control breaks.

## Rule
**Never call \`generate_voiceover\` on a script that has not been
approved by a human reviewer in the current session.**

The tool description itself encodes this rule. Do not try to
rationalize around it ("the operator approved the last one, this is
just a small edit" — no, get it approved again).

## Approval signals that count
- Operator explicitly typed "approved" / "ship it" / "generate voiceover"
  in the conversation AFTER seeing the script.
- Operator ticked an approval button in /admin/approvals on a draft
  tied to this script.
- A specific named human sign-off in a comment attributed to them.

## Approval signals that do NOT count
- Silence. No response ≠ approval.
- "Looks interesting" / "cool". Needs explicit go-ahead.
- Prior-session approval on a different script.
- An agent approving on behalf of the user (agents don't have that
  authority).

## When you're unsure
Draft the script, present it, and ASK: "Ready for me to voice this, or
edits first?" Then wait. Cost of asking = zero. Cost of premature
voiceover on a bad script = wasted ElevenLabs quota + editorial
credibility when the audience hears the flaw.

## Voice consistency
One voice per channel forever. If the integration has a
\`default_voice_id\`, use it. Don't swap voices between videos — it
destroys parasocial recognition, which is the whole asset faceless
channels are building.
`
  },
  {
    id: "video_pipeline__youtube_preflight",
    title: "YouTube Publishing Preflight — quota math + privacy defaults",
    category: "processes",
    tags: ["video", "youtube", "publishing", "quota", "preflight"],
    source: VIDEO_PIPELINE_SOURCE,
    tier: "warm",
    description:
      "The short checklist every agent should run before calling youtube_upload_video. Prevents quota exhaustion and accidental public-before-review publishes.",
    content: `# YouTube Publishing Preflight — {{businessName}}

## Quota math (hard cap)
- Default daily quota per Google Cloud project: **10 000 units**.
- Video upload = **1600 units** → max ~6 uploads/day per connected
  channel.
- Metadata update = 50 units. Thumbnail set = 50 units. List = 3 units.
  Analytics = effectively free.
- The built-in \`YouTubeQuotaUsage\` ledger tracks usage per org per
  day. The tool preflights the call and returns a clean error if you'd
  bust the cap instead of failing mid-upload.
- Midnight UTC is when the counter resets, not local midnight.

## Privacy default
Every upload should start with \`privacy_status: "private"\`. Flip it
to "public" via \`youtube_update_video_metadata\` AFTER:
- Metadata is final (title ≤55 chars, description has premise in line 1)
- Thumbnail is set via \`youtube_set_thumbnail\`
- You've sanity-checked the video plays correctly in Studio
- Any sponsor / compliance disclosures are present

## Upload order (tested path)
1. \`youtube_upload_video({ video_url, title, privacy_status: "private", made_for_kids: false })\` → returns videoId
2. \`youtube_set_thumbnail({ video_id, image_url })\`
3. \`youtube_update_video_metadata({ video_id, description, tags, category_id })\`
4. Human reviews in Studio.
5. \`youtube_update_video_metadata({ video_id, privacy_status: "public" })\` OR set \`publish_at\` for scheduled release.

## Pitfalls
- **Don't pass a non-R2 video_url.** The tool downloads the bytes
  before the resumable upload. A short-TTL CDN URL might expire
  mid-download. Use \`upload_to_r2\` first if in doubt.
- **Tags don't help discovery much.** YouTube docs are explicit that
  tags play a minimal role. 3–5 essential tags is plenty.
- **Category matters a little.** '22' = People & Blogs, '27' =
  Education, '28' = Science & Tech, '24' = Entertainment. Default '22'.
- **made_for_kids is a mandatory boolean.** Default false for adult-
  audience channels. Setting true locks out monetization.
- **Community Posts API is allowlisted only.** The
  \`youtube_post_community_update\` tool returns the prepared text with
  \`status: "requires_manual_post"\` — paste into Studio.

## When the quota cap blocks you
Options: (1) Wait until 00:00 UTC. (2) Request a quota increase in
Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas.
Approval is typically 1–3 business days. (3) Set \`YOUTUBE_QUOTA_DAILY_CAP\`
env var if Google has granted you a higher limit than 10 000.
`
  }
];

let cachedLibrary: KnowledgeLibraryItem[] | null = null;

export function getKnowledgeLibrary(): KnowledgeLibraryItem[] {
  if (cachedLibrary) {
    return cachedLibrary;
  }
  const combined = [
    ...SOLOPRENEUR_KNOWLEDGE,
    ...VIDEO_PIPELINE_KNOWLEDGE,
    ...extractTemplateKnowledge()
  ];
  const seen = new Set<string>();
  const deduped: KnowledgeLibraryItem[] = [];
  for (const item of combined) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  cachedLibrary = deduped;
  return deduped;
}

export function getKnowledgeLibraryCategories(): string[] {
  const categories = new Set<string>();
  for (const item of getKnowledgeLibrary()) {
    categories.add(item.category);
  }
  return Array.from(categories).sort();
}

export function getKnowledgeLibrarySources(): string[] {
  const sources = new Set<string>();
  for (const item of getKnowledgeLibrary()) {
    sources.add(item.source);
  }
  return Array.from(sources).sort();
}

export function getKnowledgeLibraryItem(
  id: string
): KnowledgeLibraryItem | undefined {
  return getKnowledgeLibrary().find((item) => item.id === id);
}
