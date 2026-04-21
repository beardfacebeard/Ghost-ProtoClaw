# Emergent Agent Prompt: Reconcile Landing-Page Pricing with /pricing

## Task

Update the Ghost ProtoClaw marketing site so the **landing page pricing section** and the **/pricing page** both show the **same three public tiers** with the same feature lists, prices, and CTAs. Today they disagree — landing shows 2 tiers, /pricing shows 3. Bring them into alignment. Don't invent new tiers; use the canonical three below.

## Why This Matters

The landing page is the first impression. If a visitor clicks "See pricing" and gets a different tier structure than the landing promised, the site looks broken and unserious. The canonical pricing is locked in the Business Overview and Agency Service Plans partner docs. The landing needs to match them.

## Canonical Pricing (Source of Truth)

These are the three **public** self-managed tiers. The Enterprise tier ($1,997) stays off the public site — it's sold through partner conversations only.

### Tier 1 — App Only
- **Price:** $149 one-time
- **Subhead:** Yours forever. No subscription.
- **Who it's for:** Builders who want the full platform and will configure it themselves.
- **Includes:**
  - Full Ghost ProtoClaw platform (all 13+ business templates)
  - All 4 AI engines (OpenClaw, Hermes, Codex, Claude Code)
  - Full admin dashboard, workflows, knowledge base, memory system
  - One-click Railway deploy OR download the source for VPS / local hosting
  - Source-code ownership — no vendor lock-in
  - Documentation package (setup guides, best practices, workflow templates)
  - Community support
- **CTA:** "Get Ghost ProtoClaw — $149"
- **Badge:** None (this is the default / baseline tier)

### Tier 2 — Founding Setup
- **Price:** $497 one-time
- **Subhead:** Everything in App Only + we get you live.
- **Who it's for:** Non-technical owners who want a guided first run and a configured template out of the box.
- **Includes everything in App Only, plus:**
  - 1-hour live setup call — we configure your business template, agents, and knowledge base with you
  - 14-day email support
  - Starter knowledge pack tailored to your industry
- **CTA:** "Start with Founding Setup — $497"
- **Badge:** "MOST POPULAR"

### Tier 3 — Founding Concierge (Pro)
- **Price:** $997 one-time
- **Subhead:** Two templates, optimized agents, a second set of eyes two weeks in.
- **Who it's for:** Owners running more than one brand, or owners who want their agent team tuned after real-world use.
- **Includes everything in Founding Setup, plus:**
  - A second business template configured for a second brand, offer, or product line
  - All agents configured with a custom knowledge base (not just the starter pack)
  - 30-day email support (double the Founding Setup window)
  - One optimization review at the 2-week mark — we look at what's running, tune the prompts, retire the dead workflows
- **CTA:** "Go Pro — $997"
- **Badge:** "BEST VALUE FOR MULTI-BRAND"

## What Needs to Change

### On the Landing Page
Find the current pricing section (it shows $149 and $497 only). Replace it with a three-column block using the canonical copy above. Keep the landing-page visual treatment consistent with the rest of the hero / features / proof sections — don't redesign the whole page, just the pricing block.

If the landing page has a "See full pricing →" link, keep it and point it at `/pricing`.

### On /pricing
Audit the existing /pricing page against the canonical copy above. Keep the three tiers in the same order ($149 → $497 → $997). Make sure:
- The exact prices match
- The feature bullets use the same wording as the canonical copy (so the two pages are literally the same text, not paraphrases)
- The CTAs match
- The "MOST POPULAR" badge lands on the $497 column on both pages
- The "BEST VALUE FOR MULTI-BRAND" badge lands on the $997 column on both pages

### What NOT to do
- Do **not** add an Enterprise tier to the public site. It's partner-sold.
- Do **not** show monthly retainer tiers (Growth $499/mo, Scale $999/mo) on the self-serve pricing page — those are the agency-managed plan sold separately through conversations, not self-checkout.
- Do **not** add "Starting at" language to the $149 tier. It's a flat $149, one-time.
- Do **not** use emojis in the pricing block.

## Visual Details

- All three tiers in a single row on desktop, stacked on mobile.
- The $497 column should have a visible accent (border, slight lift, or badge) marking it as the default recommendation.
- Prices should be set in the same display font / weight treatment used elsewhere in the site headline system.
- The "one-time" qualifier must sit directly under every price — visitors should never have to hunt to confirm it's not a subscription.
- Include a small line under the tier grid: *"All plans are one-time. You own the source code. Hosting (Railway or your own VPS) is separate and starts at $0–$5/month."*

## Copy Tone

Match the existing Ghost ProtoClaw marketing voice: direct, builder-to-builder, no hype, no fake urgency, no fake scarcity. The tiers should read like a calm menu, not a sales funnel. The reader should feel like they can pick the tier that fits their life and move on — not like they're being upsold.

## Verification Checklist

Before you mark this done, open the site in the browser and confirm:

1. Landing page pricing block shows three tiers ($149, $497, $997), in that order, with the canonical copy above.
2. /pricing shows the same three tiers with the same copy and CTAs.
3. The "MOST POPULAR" badge is on $497 on both pages.
4. The "BEST VALUE FOR MULTI-BRAND" badge is on $997 on both pages.
5. No Enterprise tier is visible on either page.
6. No monthly retainer tiers are visible on either page.
7. Mobile layout stacks cleanly; desktop shows the three columns without wrapping.
8. Every CTA button works and routes to the correct checkout flow.

If any of the three tier CTAs go to a checkout page that still shows old pricing, that's a second thing to flag back to me — I'll need to fix the checkout config separately.
