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
