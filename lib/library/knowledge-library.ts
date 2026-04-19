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
    id: "solo_kb__hn_outreach_playbook",
    title: "Hacker News Outreach Playbook",
    category: "processes",
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

let cachedLibrary: KnowledgeLibraryItem[] | null = null;

export function getKnowledgeLibrary(): KnowledgeLibraryItem[] {
  if (cachedLibrary) {
    return cachedLibrary;
  }
  const combined = [...SOLOPRENEUR_KNOWLEDGE, ...extractTemplateKnowledge()];
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
