# TikTok Shop Operator — Rebuild Overview

> What changed, why it changed, and how the new template + addon system works.

---

## 1. The core insight

The old template treated off-platform creator monetization (Stripe digital ladder + Resend email funnel + lead magnets) as the financial backbone. But the actual product — TikTok Shop sales — is fully self-contained inside TikTok:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WHAT THE SELLER NEVER SEES                      │
├─────────────────────────────────────────────────────────────────────┤
│  ✗ Buyer email          ✗ Card / payment data    ✗ Buyer's name    │
│  ✗ Buyer's address      ✗ External CRM hooks     ✗ Stripe access   │
└─────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       WHAT THE SELLER SEES                          │
├─────────────────────────────────────────────────────────────────────┤
│  ✓ Order line item      ✓ Shipping label          ✓ TikTok IM      │
│  ✓ Settlement Report    ✓ Returns/dispute queue   ✓ SPS dashboard  │
└─────────────────────────────────────────────────────────────────────┘
```

So Stripe + Resend are **not required** — they moved into a toggleable **Organic Ladder addon** for operators who *also* run an off-platform creator-economy layer.

The ONE third-party MCP that IS required is **Social Media Hub** (Late or Ayrshare):

```
┌─────────────────────────────────────────────────────────────────────┐
│   WHAT social_media_mcp COVERS — the publish + analytics layer      │
├─────────────────────────────────────────────────────────────────────┤
│  ✓ publish_post / schedule_post  ✓ get_analytics                    │
│  ✓ get_comments                  ✓ get_post_history                 │
│  ✓ get_profiles                  ✓ upload_media                     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │  Without this, the Content Producer's
                                   │  3-5 videos/day target becomes manual
                                   ▼  copy-paste — agent leverage collapses.
┌─────────────────────────────────────────────────────────────────────┐
│   WHAT STAYS MANUAL IN SELLER CENTER (regardless of MCPs)           │
├─────────────────────────────────────────────────────────────────────┤
│  • Listings + product card / yellow-basket attachment               │
│  • GMV Max ads + Spark Ads code-paste                               │
│  • TikTok IM customer messaging                                     │
│  • Returns / refunds queue (24h dispute evidence window)            │
│  • Settlement Reports + SPS sub-metrics                             │
│  • Affiliate Marketplace (Open / Targeted Plan, samples)            │
│  • Live Shopping streams                                            │
│  • ManyChat DM-to-Shop flow configuration                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture — template + addons composition

```
                       ┌─────────────────────────────────┐
                       │   BusinessTemplate object       │
                       │   id: "tiktok_shop"             │
                       │                                 │
                       │   requiredIntegrations: [       │  ← was [stripe, resend]
                       │     "social_media_mcp"          │     (publish + analytics)
                       │   ]                             │
                       │   suggestedIntegrations: [      │
                       │     "shopify_mcp"               │
                       │   ]                             │
                       │                                 │
                       │   starterAgents: [11 agents]    │
                       │   starterWorkflows: [20]        │
                       │   starterKnowledge: [22]        │
                       │   starterWorkspaceDocs: [3]     │
                       │                                 │
                       │   addons: [                     │
                       │     organic_ladder ──┐          │
                       │   ]                  │          │
                       └──────────────────────┼──────────┘
                                              │
                                              ↓
                       ┌──────────────────────────────────────┐
                       │   TemplateAddon                      │
                       │   id: "organic_ladder"               │
                       │   enabledByDefault: false            │
                       │                                      │
                       │   extraRequiredIntegrations: [       │
                       │     "stripe_mcp",                    │
                       │     "resend_mcp"                     │
                       │   ]                                  │
                       │   extraAgents: [Lead Magnet Mgr]     │
                       │   extraWorkflows: [3]                │
                       │   extraKnowledge: [5]                │
                       │   extraWorkspaceDocs: [PRODUCT_      │
                       │     LADDER.md]                       │
                       │   systemPromptAddendum: "..."        │
                       │   guardrailsAddendum: "..."          │
                       └──────────────────────────────────────┘
```

### Create-time data flow

```
 User picks tiktok_shop                              User toggles addon
        │                                                    │
        ▼                                                    ▼
┌─────────────────────┐                   ┌──────────────────────────────┐
│ TemplateSelector    │                   │ Addon checkbox UI            │
│ (Step 1 — picks)    │                   │ (renders if template.addons) │
└──────────┬──────────┘                   └────────────┬─────────────────┘
           │                                           │
           └────────── values.selectedAddons[] ────────┘
                              │
                              ▼
            ┌─────────────────────────────────────────┐
            │ POST /api/admin/businesses              │
            │                                         │
            │  ▸ validate selectedAddons against      │
            │    template.addons                      │
            │  ▸ composeTemplateSystemPrompt()        │
            │  ▸ composeTemplateGuardrails()          │
            │  ▸ store selectedAddons in config       │
            │  ▸ call materializeTemplate(...)        │
            └────────────────┬────────────────────────┘
                             │
                             ▼
            ┌─────────────────────────────────────────┐
            │ materializeTemplate()                   │
            │                                         │
            │  resolveEnabledAddons(template, ids)    │
            │      ↓                                  │
            │  merge:                                 │
            │    allStarterAgents      = core+addon   │
            │    allStarterWorkflows   = core+addon   │
            │    allStarterKnowledge   = core+addon   │
            │    allStarterWorkspaceDocs = core+addon │
            │      ↓                                  │
            │  insert into Prisma in transaction      │
            └─────────────────────────────────────────┘
```

---

## 3. The 11-agent core team

```
                            ┌──────────────────────┐
                            │     CEO / Operator   │  (main)
                            │   12-week roadmap    │
                            │    Shop Health Rpt   │
                            └──────────┬───────────┘
                                       │
       ┌──────────────┬─────────────┬──┴───────────┬─────────────┐
       │              │             │              │             │
       ▼              ▼             ▼              ▼             ▼
 ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐
 │ Growth      │ │ Listings    │ │ Content  │ │ AI UGC       │ │ Compliance│
 │ Strategist  │ │ Specialist  │ │ Producer │ │ Producer     │ │ Officer  │
 │             │ │             │ │          │ │              │ │          │
 │ Algorithm + │ │ SKU sourcing│ │ 7-pkg    │ │ 10-20        │ │ INFORM + │
 │ 0→1K→5K +   │ │ + Listing   │ │ weekly   │ │ variations + │ │ C2PA +   │
 │ Spark Ads   │ │ Quality     │ │ batch    │ │ Ad Clone     │ │ IP defense│
 │ pipeline    │ │ Scorecard   │ │          │ │ Tool         │ │          │
 └─────────────┘ └─────────────┘ └──────────┘ └──────────────┘ └──────────┘

       ┌──────────────┬─────────────┬──────────────┬─────────────┐
       │              │             │              │             │
       ▼              ▼             ▼              ▼             ▼
 ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐
 │ Affiliate   │ │ Ads Manager │ │ Ops &    │ │ Finance &    │ │ Customer │
 │ Manager     │ │ (GMV Max)   │ │ Fulfill- │ │ Settlement   │ │ Service  │
 │             │ │             │ │ ment     │ │ Analyst      │ │ & Reviews│
 │ Open Plan + │ │ ONLY GMV Max│ │          │ │              │ │          │
 │ Targeted +  │ │ + Spark Ads │ │ LDR      │ │ Settlement   │ │ TikTok IM│
 │ Affiliate   │ │ pipeline    │ │ firefight│ │ Reports →    │ │ + Review │
 │ API + ≥⅓    │ │ + creative  │ │ + FBT vs │ │ CM2 + cash   │ │ Velocity │
 │ rule        │ │ rotation    │ │ self     │ │ flow forecast│ │ engine   │
 └─────────────┘ └─────────────┘ └──────────┘ └──────────────┘ └──────────┘
```

**Removed from old roster** (intentional consolidation):
- ❌ Old Content Creator agent → merged into Content Producer
- ❌ Old Script Producer → merged into Content Producer
- ❌ Old Analytics Lead → folded into CEO (Shop Health Report) + Growth Strategist (algorithm signals) + Finance (commercial KPIs)

---

## 4. Customer purchase journey — what actually happens

```
┌────────────────────────────────────────────────────────────────────┐
│                       DISCOVERY ENTRY POINTS                       │
├────────────────────────────────────────────────────────────────────┤
│  • FYP video w/ yellow-basket card  (dominant)                     │
│  • Live Shopping  (3-5× conversion vs feed)                        │
│  • Shop Tab  (search engine — Review Velocity > total count)       │
│  • Creator Showcase  (Affiliate Marketplace)                       │
│  • In-app Search + Search Ads                                      │
│  • Affiliate creator videos                                        │
│  • GMV Max ad placements                                           │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│              IN-APP CHECKOUT  (buyer never leaves TikTok)          │
│                                                                    │
│  TikTok collects:  shipping address, payment, account email        │
│  Seller sees:      ✗ NOTHING about the buyer beyond the order ID   │
│  Address:          MASKED — only revealed on shipping label        │
│  Payment:          Cards, Apple/Google Pay, wallets                │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    POST-PURCHASE FULFILLMENT                       │
│                                                                    │
│  Dispatch SLA:     2 business days                                 │
│  LDR target:       ≤4%   ────────────► [Operations agent owns]     │
│  LDR enforcement:  ≥10% (order caps + AHR penalty)                 │
│  OTDR target:      ≥95%                                            │
│  Returns:          30-day window, 1-working-day approval           │
│  Disputes:         24-hour evidence window                         │
│  Messaging:        TikTok IM only (no email)                       │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                          SETTLEMENT                                │
│                                                                    │
│  TikTok pays seller via Settlement Reports on tier ladder.         │
│  Reserves typically held 30 days.                                  │
│  Bank ACH adds 1-3 business days.                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. SPS-tier graduation roadmap (12 weeks, hybrid calendar + event)

```
WEEK    │  Milestone                    │ SPS Target  │ Unlocks
────────┼───────────────────────────────┼─────────────┼─────────────────────
 1-2    │  Foundation                   │ Not yet     │ —
        │  • Shop verified              │ rated       │
        │  • INFORM Act filed           │ (need 30d   │
        │  • First 5 SKUs at "Good"     │ activity)   │
        │  • AI avatar bible locked     │             │
        │  • Brand Registry filed       │             │
────────┼───────────────────────────────┼─────────────┼─────────────────────
 3-4    │  Activation                   │ ≥ 2.5  ◄────┤ ✓ Flash Deals
        │  • SPS first rated            │             │ ✓ Shop Ads (GMV Max)
        │  • Content velocity 3-5/day   │             │ ✓ TikTok-Funded Promos
        │  • LDR < 4%                   │             │
        │  • First 50 orders            │             │
        │  • Pilot Program graduation   │             │
────────┼───────────────────────────────┼─────────────┼─────────────────────
 5-8    │  Scale                        │ ≥ 3.5  ◄────┤ ✓ Affiliate Marketplace
        │  • 20+ Open Plan affiliates   │             │ ✓ Express settlement
        │  • GMV Max at ≥3× ROAS        │             │   (1-day payout!)
        │  • Spark Ads pipeline live    │             │
────────┼───────────────────────────────┼─────────────┼─────────────────────
 9-12   │  Optimize                     │ ≥ 4.0  ◄────┤ ✓ Star Seller badge
        │  • Affiliate army → 50+       │             │   (trust signal,
        │  • FBT migration evaluated    │             │    materially boosts
        │  • Sustainable run rate       │             │    conversion)
        │  • CM2 ≥20% on all SKUs       │             │
```

---

## 6. SPS sub-metrics — the constraint hunt

```
                           ┌──────────────┐
                           │  SPS  0─5    │
                           └──────┬───────┘
                                  │
           ┌──────────────────────┼─────────────────────────┐
           │              ┌───────┴──────┐                  │
           │              │              │                  │
       LDR (≤4%)    NRR (minimize)   OTDR (≥95%)    Seller-Fault
           │              │              │            Cancellation
           │              │              │            (minimize)
           ▼              ▼              ▼                  │
    [Operations]   [Customer Svc] [Operations]         [Operations]
                                                            │
           ┌──────────────────────────────────────┬─────────┘
           │                                      │
       IM Dissatisfaction              After-Sales Handle Time
       (minimize)                      (minimize)
           │                                      │
           ▼                                      ▼
    [Customer Svc]                       [Customer Svc]
```

The **Daily SPS Watch** workflow names the **constraint sub-metric** each day; the CEO assigns the owner. The Daily LDR Firefight runs in parallel because LDR is the most catastrophic on the operational side.

---

## 7. Full fee stack — how CM2 actually computes

```
   Revenue (Customer Payment)
        │
        ▼
   ─────────────────────────────────────
   • COGS               (product + packaging + inserts)
   • Shipping           (outbound + returns allocation)
   ─────────────────────────────────────
        │
        ▼
   = CM1 (gross margin)
        │
        ▼
   ─────────────────────────────────────
   • Referral Fee       (6% standard / 3% new-seller 30d / 5% some categories)
   • Affiliate          (10-15% Open Plan / 18-30% Targeted)
   • GMV Max spend      (per-unit allocation)
   • Returns Reserve    (5-15% by category)
   • FBT fees           (if used: $2.86-3.58/unit + storage)
   ─────────────────────────────────────
        │
        ▼
   = CM2 (the number that matters)

   ┌─────────────────────────────────────────────┐
   │  CM2 ≥ 20%  →  active SKU                   │
   │  CM2 ≥ 30%  →  preferred for scaling        │
   │  CM2 < 15%  →  auto-flag for sunset (2 wks) │
   └─────────────────────────────────────────────┘
```

---

## 8. Settlement tier ladder — cash flow timing

```
TIER         │ Payout timing  │ Gate                  │ Cash conv. days
─────────────┼────────────────┼───────────────────────┼─────────────────
INTRODUCTORY │ +31 days       │ NEW seller (mandatory)│  31+
   31-day fraud-prevention hold                       │
                                                      │
STANDARD     │ +8 days after  │ Default after intro   │   8 + reserve
             │ delivery       │                       │
                                                      │
ACCELERATED  │ +5 days after  │ Performance-assigned  │   5 + reserve
             │ delivery       │                       │
                                                      │
EXPRESS      │ +1 day after   │ SPS ≥ 3.5  ◄────────  │   1 + reserve  ← goal
             │ delivery       │                       │
─────────────┼────────────────┼───────────────────────┼─────────────────
             │ 30-day reserve hold on top, then released                │
             │ Bank ACH adds 1-3 business days                          │
─────────────┴────────────────┴───────────────────────┴─────────────────
```

**Why Express matters**: hitting SPS ≥3.5 doesn't just unlock the Affiliate Marketplace — it **compresses cash conversion by ~7 days** vs Standard, which is the single biggest non-cost-reduction CM2 lever the operator has.

---

## 9. Workflow → Agent routing map (20 core + 3 addon)

```
                          ┌── Daily ─────────────────────┐
                          ├── Daily Content Queue        ──→ Content Producer
                          ├── Daily LDR & Late Dispatch  ──→ Operations
                          ├── Daily SPS Watch            ──→ CEO
                          ├── Follower Velocity Check    ──→ Growth Strategist
                          └──────────────────────────────┘

                          ┌── Weekly ────────────────────┐
                          ├── Shop Health Report          ──→ CEO
                          ├── Unit Economics Report       ──→ Finance
                          ├── Settlement Reconciliation   ──→ Finance
                          ├── Compliance Audit            ──→ Compliance
                          ├── Customer Review Follow-Up   ──→ Customer Service
                          ├── GMV Max + Spark Ads Pipeline──→ Ads Manager
                          ├── DM-to-Shop Funnel Audit     ──→ Content Producer
                          ├── Winner Extraction           ──→ Growth Strategist
                          ├── Batch Content Production    ──→ Content Producer
                          ├── AI UGC Creative Batch       ──→ AI UGC Producer
                          ├── Ad Clone Pipeline Review    ──→ AI UGC Producer
                          ├── Listing Quality Sweep       ──→ Listings
                          └── SEO Query Bank Mining       ──→ Content Producer

                          ┌── Manual ────────────────────┐
                          ├── New SKU Launch Checklist    ──→ CEO (multi-agent)
                          └── Affiliate Outreach Campaign ──→ Affiliate Manager

                          ┌── Event-driven ──────────────┐
                          └── Customer Review Follow-Up   ──→ Customer Service
                          (trigger: new_comment)

                          ┌── Yearly ────────────────────┐
                          └── INFORM Act Re-Verification  ──→ Compliance

ADDON workflows (only when organic_ladder enabled):
                          ├── Weekly Digital Ladder Rpt   ──→ Lead Magnet Mgr
                          ├── ManyChat → Email Capture    ──→ Lead Magnet Mgr
                          └── Email Sequence Performance  ──→ Lead Magnet Mgr
```

---

## 10. Compliance hot zones (the things that kill accounts)

```
                ┌─────────────────────────────────────────────┐
                │           BAN-LEVEL CONSEQUENCES            │
                ├─────────────────────────────────────────────┤
                │                                             │
                │  ❌ Counterfeit / IP claim                  │
                │     → Instant suspension                    │
                │     → 180-day balance withhold              │
                │       (extended from 90d, Oct 27 2025)      │
                │                                             │
                │  ❌ INFORM Act lapse                        │
                │     → Listing freeze + payout freeze        │
                │     → ~50% never recover                    │
                │                                             │
                │  ❌ AI content w/o C2PA + paid-partnership  │
                │     label (2026 enforcement)                │
                │     → Reach throttle, then removal          │
                │                                             │
                │  ❌ LDR > 10%                               │
                │     → AHR point deduction                   │
                │     → Order volume caps                     │
                │     → Extended settlement                   │
                │                                             │
                │  ❌ Mass-DM creators outside Marketplace    │
                │     → Community guideline strikes           │
                │                                             │
                │  ❌ Third-party music in shoppable content  │
                │     → Silent throttle                       │
                │                                             │
                └─────────────────────────────────────────────┘
```

---

## 11. Organic Ladder addon — the other revenue layer

```
   ┌───────────────────────────────────────────────────────────────────┐
   │             OPTIONAL — TOGGLE AT CREATE TIME                      │
   └─────────────────────────┬─────────────────────────────────────────┘
                             │
                  TikTok content drives "Comment [KEYWORD]"
                             │
                             ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  ManyChat catches comment → DM → asks for email + delivers magnet │
   └─────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  Resend welcome sequence (3-5 emails over 7 days)                 │
   └─────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
   ┌─── DIGITAL LADDER (Stripe-powered) ──────────────────────────────┐
   │                                                                  │
   │  RUNG 1  Free lead magnet         (email capture)                │
   │     ▼                                                            │
   │  RUNG 2  $7-$47 low-ticket        (e-book, prompt pack, mini)    │
   │     ▼                                                            │
   │  RUNG 3  $47-$297 mid-ticket      (course, premium bundle)       │
   │     ▼                                                            │
   │  RUNG 4  $297+ high-ticket        (signature program)            │
   │     ▼                                                            │
   │  RUNG 5  $1,997+ done-for-you     (optional 1:1 / coaching)      │
   │                                                                  │
   └──────────────────────────────────────────────────────────────────┘

   ⚠ CRITICAL: digital revenue is REPORTED SEPARATELY from TikTok Shop
   GMV. The Lead Magnet & Email Funnel Manager runs the Weekly Digital
   Ladder Report on a separate P&L. Blending kills visibility into
   which channel is actually profitable.
```

**What gets added when enabled:**

| Asset | Count | What |
|-------|-------|------|
| Agent | 1 | Lead Magnet & Email Funnel Manager |
| Workflows | 3 | Weekly Digital Ladder Report, ManyChat→Email Audit, Email Sequence Performance |
| KB items | 5 | 5-step strategy, digital ladder catalog, ManyChat→Resend playbook, off-platform unit economics, off-platform compliance (CAN-SPAM/GDPR/FTC) |
| Workspace docs | 1 | PRODUCT_LADDER.md |
| Required integrations | 2 | `stripe_mcp`, `resend_mcp` |
| System prompt | + addendum | Teaches existing agents about the dual-revenue-channel model |

---

## 12. What changed at the file level

```
  lib/templates/business-templates.ts          ▲ +172 lines (8510 → 8682)
    + TemplateAddon type
    + addons?: TemplateAddon[] field on BusinessTemplate
    + resolveEnabledAddons()        helper
    + composeTemplateSystemPrompt() helper
    + composeTemplateGuardrails()   helper
    + getEffectiveRequiredIntegrations() helper
    + materializeTemplate accepts selectedAddonIds
    ⟲ tiktok_shop template fully rewritten

  app/api/admin/businesses/route.ts            ▲ ~30 lines
    + selectedAddons validation against template.addons
    + composed systemPrompt + guardrails via helpers
    + selectedAddons stored in business config
    + selectedAddonIds passed to materializeTemplate

  components/admin/businesses/schema.ts        ▲ ~10 lines
    + selectedAddons field on form schema
    + excluded from update schema (template-only)

  components/admin/businesses/CreateBusinessFlow.tsx  ▲ ~80 lines
    + addon toggle UI on Step 1
    + handleToggleAddon + enabledAddons memo
    + addon counts factored into "Will create" pane
    + addons listed on Step 4 review with required-integration badges

  Website_Update_Prompt_TikTok_Template.md     ⟲ rewritten
    + reflects 11 agents, SPS-tier roadmap, GMV Max-only, masked email
    + adds optional addon callout
    + flags stale claims to avoid (VSA / "we capture emails")

  TikTok_Shop_Template_Prompt.md               ✗ deleted (stale)
  Claude_Code_TikTok_Shop_Implementation_Prompt.md ✗ deleted (stale)
  TikTok_Shop_Template_Improvements.md         ✗ deleted (stale)
  TikTok_Shop_StarterKnowledge_Entries.md      ✗ deleted (folded)
  UGC_TikTok_Shop_Knowledge_Base.md            ✗ deleted (folded)
  Faceless_Digital_Creator_Knowledge_Base.md   ✓ kept (feeds the addon)
```

---

## 13. Verification

```
  npx tsc --noEmit -p tsconfig.json    ─→  EXIT 0 (clean)

  Runtime template load:
    id:                      tiktok_shop
    name:                    TikTok Shop Operator
    agents (core):           11
    workflows (core):        20
    knowledge (core):        22
    workspace docs (core):   3
    required integrations:   ["social_media_mcp"]
    suggested integrations:  ["shopify_mcp"]

    addons:
      - organic_ladder ("Organic 5-Step Ladder & Email Funnel")
        enabledByDefault: false
        extraRequired:     ["stripe_mcp", "resend_mcp"]
        +agents=1 +workflows=3 +knowledge=5 +workspaceDocs=1

    With no addons enabled:
      effective required integrations:  ["social_media_mcp"]

    With organic_ladder enabled:
      effective required integrations:  ["social_media_mcp", "stripe_mcp", "resend_mcp"]
      enabled addons:                   ["organic_ladder"]
      system prompt addendum injected:  true
```

---

## 14. Backward compatibility note

- Template id stayed `tiktok_shop` (overwrite, per the rebuild brief).
- Existing businesses created on the OLD template keep their old agents/workflows/KB — only NEW businesses created from the new template definition get the rebuilt structure.
- If you want existing operators to migrate, that's a separate one-shot script (not built — flag if you want it).

---

## 15. Onboarding UX (Step 1 of business creation)

```
   ┌──────────────────────────────────────────────────────────────────┐
   │  What kind of business are you setting up?                       │
   │                                                                  │
   │  [Template picker grid — TikTok Shop Operator selected]          │
   └──────────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────────┐
   │  Optional addons                                                 │
   │  Layer extra capability onto the core TikTok Shop Operator       │
   │  template. Each addon installs additional agents, workflows,     │
   │  and KB items — and may require its own MCP integrations.        │
   │                                                                  │
   │  ┌────────────────────────────────────────────────────────────┐  │
   │  │ ☐  Organic 5-Step Ladder & Email Funnel                    │  │
   │  │                                                            │  │
   │  │    Layers an off-platform creator-economy stack on top of  │  │
   │  │    the core TikTok Shop business: free lead magnet → low-  │  │
   │  │    ticket → mid-ticket → high-ticket. Skip it if you only  │  │
   │  │    sell on TikTok Shop — it's intentionally optional.      │  │
   │  │                                                            │  │
   │  │    +1 agents  +3 workflows  +5 KB items                    │  │
   │  │    Requires: stripe_mcp, resend_mcp        ⚠ amber warning │  │
   │  └────────────────────────────────────────────────────────────┘  │
   │                                                                  │
   └──────────────────────────────────────────────────────────────────┘

                                  [ Continue → ]
```

---

## TL;DR

| Old | New |
|-----|-----|
| 13 agents incl. ladder-coupled Finance | 11 agents, settlement-driven Finance |
| `requiredIntegrations: [stripe, resend]` | `requiredIntegrations: [social_media_mcp]` (publishing + analytics) |
| 5-Step Organic Method (ladder is core) | TikTok-Shop-native (ladder is optional addon) |
| Time + GMV-target roadmap | Hybrid 12-week + SPS-tier graduation roadmap |
| VSA / PSA / LIVE Shopping Ads | GMV Max only (post-July 2025 reality) |
| No SPS surface | SPS as first-class daily metric, tier-aware playbook |
| No LDR firefighter | Daily LDR Firefight workflow with tiered escalation |
| No FBT decision framework | FBT vs self-fulfill KB + decision per SKU |
| No 2026 AI labels | C2PA + paid-partnership label flow throughout |
| 90-day counterfeit withhold | 180-day withhold (Oct 2025 update) |
| Listing quality assumed | Listing Quality Scorecard workflow |
| Email capture as core | Email capture as optional addon (Stripe + Resend) |
