/**
 * Template demo-data seeders. Drops a small set of ActivityEntry +
 * AgentMemory rows for the four templates the audit identified as
 * benefiting most from a populated dashboard at first-load:
 *
 *   - tiktok_shop
 *   - faceless_youtube
 *   - content_creator
 *   - local_lead_gen
 *
 * Each seeder is idempotent — re-running on an already-seeded business
 * is a no-op (we check for the demo-seed marker in the metadata).
 *
 * The dealhawk_empire template has its own deeper seeder
 * (`lib/dealhawk/seed.ts`) because it owns its own Prisma models
 * (Deal / Signal). The four templates seeded here use platform-wide
 * models, so the seed surface is much lighter.
 */

import type { Prisma } from "@prisma/client";

type ActivitySeed = {
  type: string;
  title: string;
  detail: string;
  status: string;
  daysAgo: number;
};

const TIKTOK_SHOP_ACTIVITIES: ActivitySeed[] = [
  {
    type: "workflow",
    title: "Daily SPS Watch & Tier Alert ran",
    detail:
      "SPS held at 4.2 — Late Dispatch Rate 5% (warning band), Customer Service Score 4.6 (healthy). No tier change. CEO surfaced LDR as constraint metric for the week.",
    status: "completed",
    daysAgo: 0
  },
  {
    type: "workflow",
    title: "Weekly Shop Health Report ran",
    detail:
      "GMV $2,840 (+12% WoW), CM2 22%, top SKU contributing 38% of GMV. Constraint sub-metric: review velocity (only 4 reviews in last 7 days vs target 10+). Owner assigned: Customer Service & Reviews.",
    status: "completed",
    daysAgo: 1
  },
  {
    type: "agent",
    title: "Listings Specialist scored a new SKU",
    detail:
      "SKU candidate 'Glossy Lip Stain Trio' — Listing Quality 'Good' tier, projected CM2 24%, recommended retail $19.99. Sample budget $35. Routed to Operations for fulfillment vetting.",
    status: "completed",
    daysAgo: 2
  },
  {
    type: "agent",
    title: "Compliance Officer cleared 3 new pieces of content",
    detail:
      "All 3 carry C2PA AI labels (HeyGen avatar visible) + paid-partnership labels. Music license logged in rights ledger. Cleared for Spark Ads pipeline.",
    status: "completed",
    daysAgo: 3
  },
  {
    type: "approval",
    title: "Affiliate Manager queued 12 Targeted Plan creator invites",
    detail:
      "12 creators in 10K–100K micro-influencer band, 22% commission rate, sample budget $180. Awaiting operator approval before send.",
    status: "pending",
    daysAgo: 0
  }
];

const FACELESS_YOUTUBE_ACTIVITIES: ActivitySeed[] = [
  {
    type: "workflow",
    title: "Weekly KPI Dashboard ran",
    detail:
      "Rolling-10 CTR 4.8% (above 4% gate), AVD 47% (above 40% gate), returning-viewer rate 14%. Subscribers +312 WoW. Top video: 'How AI Agents Replaced My $80K SaaS Stack' (CTR 6.2%, AVD 53%).",
    status: "completed",
    daysAgo: 0
  },
  {
    type: "workflow",
    title: "Compliance Pre-Publish Gate cleared Video #18",
    detail:
      "C2PA AI labels toggled, rights ledger updated for 4 Pexels clips + 1 Flux-generated thumbnail. No claim substantiation gaps. Cleared for Publish + SEO Metadata.",
    status: "completed",
    daysAgo: 1
  },
  {
    type: "agent",
    title: "Script Writer drafted Video #19 + HITL gate routed to operator",
    detail:
      "Topic: 'I Audited 12 AI Agency Templates — Here's What I Found'. 1,420-word script. Hook: 'I spent 4 hours digging through Ghost ProtoClaw to test something.' HITL gate awaiting operator's 10–20% personal-anecdote injection.",
    status: "pending",
    daysAgo: 0
  },
  {
    type: "approval",
    title: "Voiceover Generation queued for Video #18",
    detail:
      "Approved script (post-HITL). ElevenLabs voice ID locked. Estimated cost $1.10 (8,200 chars). Awaiting voice-direction confirmation before generate_voiceover fires.",
    status: "pending",
    daysAgo: 0
  },
  {
    type: "agent",
    title: "Sponsor Hunter advanced 2 prospects",
    detail:
      "Brand A → 'reply' stage (asked for media kit + audience demographics). Brand B → 'negotiating' stage (proposed $4,500 for 60-sec mid-roll, 2-week window).",
    status: "completed",
    daysAgo: 2
  }
];

const CONTENT_CREATOR_ACTIVITIES: ActivitySeed[] = [
  {
    type: "workflow",
    title: "Weekly Content Plan committed",
    detail:
      "5 newsletter issues queued for next 5 days. Editorial themes: AI agent ROI math, beehiiv vs Substack 2026, sponsor-deal pricing tiers, list-growth via swaps, and a member spotlight. CTA mix: 1 Boost + 1 affiliate + 1 paid-tier nudge + 2 pure-value.",
    status: "completed",
    daysAgo: 0
  },
  {
    type: "agent",
    title: "Content Writer drafted Issue 47",
    detail:
      "1,180-word issue on 'Why I Killed 3 Newsletters Before This One Worked'. 3 subject-line variants tested. Social repurposing kit attached (X thread + LinkedIn + Medium Notes).",
    status: "completed",
    daysAgo: 1
  },
  {
    type: "agent",
    title: "Sponsor Hunter pipeline update",
    detail:
      "1 sponsor moved to 'IO signed' ($1,800 mid-tier placement, runs in 2 weeks). 2 sponsors in 'reply' stage. Pipeline value forecast: $6,200 next 60 days.",
    status: "completed",
    daysAgo: 2
  },
  {
    type: "workflow",
    title: "Content Performance Review surfaced 3 insights",
    detail:
      "Issue 43 (24% open rate vs 38% baseline) — subject too clever. Issue 44 (47% open) — first-line cold-open hooked correctly. Issue 45 (32% open) — sent at wrong time-of-day. Recommendation: lock send time to Tue 10am ET.",
    status: "completed",
    daysAgo: 3
  },
  {
    type: "agent",
    title: "Monetization Stacker scheduled Q2 paid-tier experiment",
    detail:
      "Annual-discount test (15% off annual, 30-day exit window). Target: convert 30 paying members to annual; success = NRR ≥120% within 90 days. Approved by CEO.",
    status: "completed",
    daysAgo: 4
  }
];

const LOCAL_LEAD_GEN_ACTIVITIES: ActivitySeed[] = [
  {
    type: "workflow",
    title: "Daily Lead Quality + Forward processed 18 calls",
    detail:
      "12 REAL leads (forwarded to contractors within 2 min), 4 TIRE_KICKERS (archived), 2 SPAM (filtered). Average forwarding latency 47 sec. Per-site breakdown attached.",
    status: "completed",
    daysAgo: 0
  },
  {
    type: "workflow",
    title: "Daily GBP Health Check — all green",
    detail:
      "All 4 active sites passed: GBP suspension flag clear, Local Pack share within 2-position range vs yesterday, 0 unanswered Q&A, 14 photos average per site. No action required.",
    status: "completed",
    daysAgo: 0
  },
  {
    type: "agent",
    title: "Niche & City Scanner ranked 3 new candidates",
    detail:
      "Candidates: Roofing × Springfield MO (green — Maps weakness, KD 24, $32 CPC), HVAC × Chattanooga TN (yellow — Maps strength but SERP weakness), Tree Service × Lubbock TX (red — Maps + SERP both saturated). Portfolio Lead prioritized Springfield for next build.",
    status: "completed",
    daysAgo: 1
  },
  {
    type: "agent",
    title: "Site Builder shipped Site #5 (Roofing × Springfield MO)",
    detail:
      "5-page site live: homepage + 3 service sub-pages + city page + FAQ. NAP consistent. LocalBusiness + Service + FAQPage schema in place. CallRail tracking number installed. 60-day citation schedule queued.",
    status: "completed",
    daysAgo: 2
  },
  {
    type: "approval",
    title: "Contractor Outreach Sprint queued for Site #4 (HVAC × Knoxville)",
    detail:
      "Site #4 ranked #2 for primary keyword + 3 long-tails for 14 days. CallRail data: 23 calls in last 30 days, 67% REAL. Outreach Sprint targeting top 20 local HVAC contractors. Awaiting operator approval before send.",
    status: "pending",
    daysAgo: 0
  }
];

const SEEDS: Record<string, ActivitySeed[]> = {
  tiktok_shop: TIKTOK_SHOP_ACTIVITIES,
  faceless_youtube: FACELESS_YOUTUBE_ACTIVITIES,
  content_creator: CONTENT_CREATOR_ACTIVITIES,
  local_lead_gen: LOCAL_LEAD_GEN_ACTIVITIES
};

const DEMO_SEED_MARKER = { demoSeed: true };

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Seed demo activity entries for the given template. Idempotent —
 * checks for an existing demo-seeded entry before writing.
 *
 * Returns the count of activities created (0 if skipped due to
 * already-seeded or template not in scope).
 */
export async function seedTemplateDemoActivities(
  tx: Prisma.TransactionClient,
  templateId: string,
  businessId: string
): Promise<number> {
  const seeds = SEEDS[templateId];
  if (!seeds) return 0;

  // Idempotency check — bail if any demo-seeded activity already exists.
  const existing = await tx.activityEntry.findFirst({
    where: {
      businessId,
      metadata: { equals: DEMO_SEED_MARKER as Prisma.InputJsonValue }
    }
  });
  if (existing) return 0;

  let created = 0;
  for (const seed of seeds) {
    await tx.activityEntry.create({
      data: {
        businessId,
        type: seed.type,
        title: seed.title,
        detail: seed.detail,
        status: seed.status,
        metadata: DEMO_SEED_MARKER as Prisma.InputJsonValue,
        createdAt: daysAgo(seed.daysAgo)
      }
    });
    created++;
  }
  return created;
}

/**
 * Returns the list of template ids with demo-seed coverage.
 */
export function getDemoSeedTemplateIds(): string[] {
  return Object.keys(SEEDS);
}
