# Ghost ProtoClaw — Library-Wide Template Audit

**Audit date:** 2026-05-09
**Scope:** All 19 active business templates (+ `blank` and the private `tiptax_affiliate_engine`).
**Method:** Programmatic introspection of `lib/templates/business-templates.ts` against `lib/integrations/mcp-definitions.ts`. Every metric pulled from code, not estimated.

## Table of contents

| Section | What it covers |
|---|---|
| **A** — Library inventory | Master template index, integration inventory, runtime distribution, cross-template patterns |
| **B** — Ship-readiness ranking | All 20 templates ranked from most-ready to least-ready, with top-3 P0s + fix-time estimates |
| **C/1 — `tiktok_shop`** | rank #1 — SHIP after rebuild |
| **C/2 — `faceless_youtube`** | rank #2 — SHIP |
| **C/3 — `dealhawk_empire`** | rank #3 — SHIP |
| **C/4 — `forex_trading_desk`** | rank #4 — RETIRE FROM PUBLIC (regulatory exposure) |
| **C/5 — `tiptax_affiliate_engine`** | rank #5 — SHIP (private only) |
| **C/6 — `ghost_operator`** | rank #6 — NEEDS WORK |
| **C/7 — `agency`** | rank #7 — NEEDS WORK (split decision) |
| **C/8 — `local_lead_gen`** | rank #8 — NEEDS WORK |
| **C/9 — `content_creator`** | rank #9 — NEEDS WORK |
| **C/10 — `pinterest_traffic`** | rank #10 — NEEDS WORK |
| **C/11 — `ecommerce`** | rank #11 — NEEDS WORK (split decision) |
| **C/12 — `saas_product`** | rank #12 — NEEDS WORK |
| **C/13 — `high_ticket_coaching`** | rank #13 — NEEDS WORK |
| **C/14 — `real_estate`** | rank #14 — NEEDS WORK |
| **C/15 — `local_service`** | rank #15 — NEEDS WORK |
| **C/16 — `service_business`** | rank #16 — RETIRE / consolidate |
| **C/17 — `social_media_agency`** | rank #17 — NEEDS WORK |
| **C/18 — `skool_community`** | rank #18 — NEEDS WORK |
| **C/19 — `business_builder`** | rank #19 — RETIRE / consolidate into `ghost_operator` |
| **D** — Library-wide findings | Cross-template patterns, structural fixes (S-1..S-9), reusable primitives (P-1..P-7), integration consolidation (IC-1..IC-7), 5 P0 themes |
| **E** — Sequenced fix plan | Phase 0 foundations (E0-1..E0-7), Phase 1 per-template P0s (E1-1..E1-19), Phase 2 P1s, Phase 3 polish, sequenced execution plan, 10 decision points |
| **F** — Re-audit triggers | Post-Phase 0/1 mandatory re-audits, ongoing trigger conditions (F3-1..F3-10), what does NOT trigger a re-audit, deliverable format |

## Five library-wide P0 themes (synthesis)

The library has 5 root P0 themes that cluster the per-template issues:

1. **Tools-vs-prompts mismatch** — Auto-attach gives agents capability via `getToolsForAgent`; system prompts don't enumerate it. Customer reads "agent uses HeyGen / HubSpot / Stripe" and the agents may or may not actually call those tools. Affects all 19 templates. Fix: **E0-3 system-prompt enumeration helper**.
2. **Webhook + signal plumbing** — Templates with `webhook` triggers depend on operator wiring that's undocumented; routes may not exist. Affects 8+ templates. Fix: **E0-6 + E0-7**.
3. **Spend-ceiling absence** — Loops can burn unbounded credits (AI video gen, cold email blasts, SMS, image generation). Affects ~12 templates. Fix: **E0-4 spendCeilings config**.
4. **Specialist agent starvation** — Roles that need specific tools have only `["knowledge_lookup"]`. Fix: enumerate the auto-attach + add `send_email`/`send_telegram_message` to every specialist.
5. **Bifurcated identity / overlap** — `agency`, `ecommerce`, `business_builder`, `service_business`, `social_media_agency`, `skool_community`, `high_ticket_coaching`, `real_estate`, `local_service`, `saas_product` all overlap in "service business with 4 agents + Stripe + Resend + suggested HubSpot." Fix: split bifurcated templates, retire overlapping ones, tighten differentiation on the rest.

---

_Source transcript: `C:\Users\brand\.claude\projects\C--Users-brand-Documents-Playground-Ghost-ProtoClaw\971fa912-86d7-4a6f-9400-61556bf7f0ab.jsonl`_

_Extracted: 23 audit deliverables across 115 assistant messages._

---



<!-- ============================================================ -->
<!-- Sections A & B (Inventory + Ship-readiness ranking)  (transcript line 684, 23024 chars) -->
<!-- ============================================================ -->

---

# GHOST PROTOCLAW LIBRARY AUDIT — SECTIONS A & B

**Scope:** 20 templates (19 active + `blank`). 140 agents. 154 workflows. 265 KB items.
**Method:** Programmatic introspection of `lib/templates/business-templates.ts` against `lib/integrations/mcp-definitions.ts`. Every metric below is pulled from code, not estimated.

---

# SECTION A — LIBRARY INVENTORY

## A1. Master template index

Price tiers below are **my recommendation** based on agent count × buyer ICP × workflow surface complexity. Argue with any.

| # | id | Name | Cat | Agents | WFs | KB | Docs | Addons | Buyer | **My price tier** |
|---|---|---|---|---:|---:|---:|---:|---:|---|---|
| 1 | `business_builder` | Business Builder | custom | 4 | 4 | 7 | 2 | 0 | First-time founders, "tell me what to do" | **$147** |
| 2 | `service_business` | Service Business | service | 4 | 6 | 9 | 2 | 0 | Coaches/consultants/agencies billing services | **$197** |
| 3 | `ecommerce` | E-Commerce & Etsy Digital Studio | ecommerce | 7 | 6 | 14 | 3 | 0 | DTC operator OR Etsy printable shop | **$297** |
| 4 | `content_creator` | Newsletter Empire | content | 6 | 6 | 13 | 4 | 0 | Newsletter operator | **$297** |
| 5 | `agency` | Agency / Studio / AI Automation Reseller | agency | 8 | 6 | 13 | 4 | 0 | Multi-client agency owner | **$497** |
| 6 | `ghost_operator` | Ghost Operator | custom | 5 | 9 | 21 | 5 | 0 | Solopreneur / "build a business for me" | **$497** |
| 7 | `high_ticket_coaching` | High-Ticket Coaching / Mastermind | service | 4 | 4 | 8 | 2 | 0 | $5K+ program operator | **$297** |
| 8 | `skool_community` | Skool Community / Online Education | service | 4 | 4 | 7 | 2 | 0 | Skool/community operator | **$197** |
| 9 | `real_estate` | Real Estate Agent / Team | service | 4 | 4 | 7 | 2 | 0 | Licensed agents | **$197** |
| 10 | `local_service` | Local Service Business | service | 4 | 4 | 7 | 2 | 0 | Plumbing/HVAC/landscaping | **$197** |
| 11 | `saas_product` | SaaS / Software Product | service | 4 | 4 | 8 | 2 | 0 | SaaS founder | **$297** |
| 12 | `social_media_agency` | Social Media Management Agency | agency | 4 | 4 | 8 | 2 | 0 | SMMA owner | **$197** |
| 13 | `tiktok_shop` | TikTok Shop Operator | ecommerce | 11 | 20 | 22 | 3 | **1** | Faceless TikTok Shop seller | **$497** |
| 14 | `faceless_youtube` | Faceless YouTube Empire | content | 14 | 18 | 25 | 3 | 0 | Faceless YT channel operator | **$697** |
| 15 | `forex_trading_desk` | Forex Research & Execution Desk | service | 14 | 6 | 15 | 3 | 0 | Retail FX trader / prop firm | **$497** ⚠ |
| 16 | `dealhawk_empire` | Dealhawk Empire | service | 14 | 19 | 29 | 5 | 0 | RE wholesaler | **$997** |
| 17 | `local_lead_gen` | Local Lead Gen Agency | agency | 9 | 8 | 6 | 4 | 0 | Lead-gen agency owner | **$497** |
| 18 | `pinterest_traffic` | Pinterest Traffic Operator | content | 6 | 7 | 6 | 4 | 0 | Pinterest creator/blogger | **$197** |
| 19 | `blank` | Start Blank | custom | 0 | 0 | 0 | 0 | 0 | "Power user" | Free / no SKU |
| 20 | `tiptax_affiliate_engine` | TipTax Affiliate Engine | service | 14 | 15 | 40 | 3 | 0 | **Private** — affiliate-only | N/A (private) |

**⚠ on Forex:** I'd cap that at $497 OR not sell it at all. Selling a "trading desk" template to retail at $697+ has regulatory exposure beyond what a template owner usually wants to absorb. Re-audit recommendation in Section D.

**Visibility:** 19 public, 1 private (`tiptax_affiliate_engine` — owner-gated). Blank is technically public but intentionally empty.

---

## A2. Integration inventory (cross-template)

### Required integrations — 13 distinct MCPs, 14 templates depend on at least one

| MCP | Used by (required) | Count |
|---|---|---:|
| `resend_mcp` | service_business, ecommerce, content_creator, agency, ghost_operator, high_ticket_coaching, skool_community, real_estate, local_service, saas_product, social_media_agency, faceless_youtube, local_lead_gen, pinterest_traffic | **14** |
| `stripe_mcp` | ecommerce, high_ticket_coaching, skool_community, saas_product, faceless_youtube | **5** |
| `social_media_mcp` | ghost_operator, social_media_agency, tiktok_shop, tiptax_affiliate_engine | **4** |
| `hubspot_mcp` | agency | **1** |
| `beehiiv_mcp` | content_creator | **1** |
| `tailwind_mcp` | pinterest_traffic | **1** |
| `firecrawl_mcp` | tiptax_affiliate_engine | **1** |
| `instantly_mcp` | tiptax_affiliate_engine | **1** |
| `postgres_mcp` | tiptax_affiliate_engine | **1** |
| `sendpilot_mcp` | tiptax_affiliate_engine | **1** |
| `twelvedata_forex` | forex_trading_desk | **1** |
| `fred_macro` | forex_trading_desk | **1** |
| `finnhub_news` | forex_trading_desk | **1** |

### Suggested integrations — top 10 by template count

| MCP | Suggested by | Count |
|---|---|---:|
| `hubspot_mcp` | service_business, ecommerce, content_creator, ghost_operator, high_ticket_coaching, skool_community, real_estate, local_service, saas_product, social_media_agency, faceless_youtube, dealhawk_empire, local_lead_gen, pinterest_traffic, tiptax_affiliate_engine | **15** |
| `social_media_mcp` | business_builder, service_business, ecommerce, content_creator, agency, high_ticket_coaching, skool_community, real_estate, faceless_youtube, local_lead_gen, pinterest_traffic | **11** |
| `whatsapp_cloud_mcp` | service_business, ghost_operator, high_ticket_coaching, real_estate, local_service, dealhawk_empire, local_lead_gen, tiptax_affiliate_engine | **8** |
| `stripe_mcp` | business_builder, service_business, content_creator, agency, ghost_operator, local_service, social_media_agency, pinterest_traffic | **8** |
| `twilio_mcp` | service_business, ghost_operator, high_ticket_coaching, real_estate, local_service, dealhawk_empire, local_lead_gen | **7** |
| `telnyx_mcp` | (same 7 as twilio) | **7** |
| `slack_mcp` | agency, saas_product | **2** |
| `ahrefs_mcp` | local_lead_gen, pinterest_traffic | **2** |
| `semrush_mcp` | local_lead_gen, pinterest_traffic | **2** |
| `gohighlevel_mcp` | agency, tiptax_affiliate_engine | **2** |

### Categorized by media-gen capability — what's the library actually doing?

| Category | Coverage | Notes |
|---|---|---|
| **LLM** | Implicit via OpenAI/Anthropic (every template) | Only 4 templates pin a model: `tiktok_shop`, `faceless_youtube`, `forex_trading_desk`, `dealhawk_empire` (all `anthropic/claude-sonnet-4.5`). **15 templates leave `primaryModel` unset.** P1. |
| **Image gen** | Referenced via built-in `generate_image` tool (only `faceless_youtube` + `dealhawk_empire` have it in their tools array). Implied use of fal.ai Flux/Ideogram in KB content. **No template declares an image-gen MCP.** | P1 — declared in narrative but not wired |
| **Video gen** | `generate_video` (1 template: faceless_youtube). `assemble_video` + `check_video_assembly` (1 template: faceless_youtube). | Only `faceless_youtube` has video tools wired. `tiktok_shop` describes UGC tools (MakeUGC/Creatify/Arcads/HeyGen) in KB but has **zero MCP wiring** for them. |
| **Voice / TTS** | `generate_voiceover` + `list_elevenlabs_voices` (1 template: faceless_youtube). | Only one template wires voice. Others (tiktok_shop, ghost_operator) describe AI voice in KB but have no tool. |
| **Music** | None | Zero templates wire music gen. |
| **Avatar / UGC** | None | Zero templates wire HeyGen/Creatify/Arcads despite KB content describing them as core. |
| **Browser / scraping** | `crawl_website` (1), `scrape_webpage` (1), `browser_navigate/click/fill_form` (1: tiptax) | Sparse |
| **Telephony / SMS / WhatsApp** | `send_sms` (1 template: dealhawk), `whatsapp_send_*` (1: dealhawk) | Most templates SUGGEST whatsapp/twilio/telnyx but only `dealhawk_empire` actually wires the tools |

**This is the single biggest pattern in the library:** templates DECLARE integrations and DESCRIBE them in KB content, but agents' actual `tools` arrays don't have the corresponding tool names. **Agents that "use HeyGen" in their system prompt cannot actually call HeyGen.**

---

## A3. Runtime distribution

| Runtime | Templates | Agents using |
|---|---|---:|
| **(none declared)** | All 20 templates | 140 / 140 agents |
| `openclaw` | 0 | 0 |
| `hermes` | 0 | 0 |
| `opencode` | 0 | 0 |
| `codex` | 0 | 0 |
| `claude` | 0 | 0 |

**Every single agent in the library has `runtime` undefined.** They all fall back to whatever the platform default is. No template forces a specific runtime for any specialist.

This is fine if your platform has one default runtime that handles everything. It becomes a problem the moment you ship a Codex-only template (long-running Claude Code agents) alongside a Hermes-only template (cheap quick reasoning). **Today, library is implicitly homogeneous on runtime** — no per-agent specialization.

---

## A4. Cross-template patterns

### Reusable primitives (good — should become shared building blocks)

| Pattern | Templates with it | Recommended primitive |
|---|---|---|
| **Compliance Officer** agent | tiktok_shop, faceless_youtube, agency, dealhawk_empire, forex_trading_desk | One shared "Compliance Officer Base" — each template extends with niche-specific rules. Not done today. |
| **Finance / Unit Economics analyst** | tiktok_shop, faceless_youtube, ecommerce, agency, ghost_operator, high_ticket_coaching, dealhawk_empire | Shared "Finance Analyst Base" with revenue model swapped per-template. |
| **CEO / strategist + 12-week roadmap** | tiktok_shop, faceless_youtube, dealhawk_empire, ghost_operator, content_creator | Shared roadmap pattern. Today each rewrites from scratch. |
| **Affiliate / outreach manager** | tiktok_shop, agency, dealhawk_empire (buyer outreach), tiptax_affiliate_engine | Shared "Outreach Sequencer" with channel swapped per template. |
| **Customer Service / IM template library** | tiktok_shop, faceless_youtube, ecommerce, service_business | Shared response template library w/ niche overrides. |

### Inconsistent patterns (P1/P2 cleanup)

| Issue | Evidence | P-level |
|---|---|---|
| **`primaryModel` unset on 15/20 templates** | Only 4 pin `claude-sonnet-4.5`. 15 have nothing. `tiptax_affiliate_engine` has empty string `""` (different bug — defaults silently). | **P1** — output quality drift across templates |
| **`stripe_mcp` required vs suggested split** | Required: ecommerce, high_ticket_coaching, skool_community, saas_product, faceless_youtube. Suggested: business_builder, service_business, content_creator, agency, ghost_operator, local_service, social_media_agency, pinterest_traffic. **Pick a rule.** Why is it required for skool_community but suggested for high-priced agency? | **P1** |
| **`resend_mcp` required by 14 templates** | Many of these don't actually need owned-list email to function (e.g., real_estate uses Twilio for SMS, doesn't need Resend at the template level). Required = blocking. Most are over-flagged. | **P1** |
| **`hubspot_mcp` required by `agency` only** | But suggested by 14 others. Why this one? `agency` doesn't have any HubSpot-specific tool calls in the agent tools arrays I can see. | **P2** |
| **`whatsapp_cloud_mcp` + `twilio_mcp` + `telnyx_mcp` triad always together** | 7 templates suggest all 3 simultaneously (telephony alternatives). Customer has to pick one. **No template tells them which.** | **P1** |
| **No template declares image/video/voice MCPs as required** despite KB content claiming agents "use HeyGen / Midjourney / Creatify / OpenArt" | Misleading marketing — see Phase 4 deep dive | **P0 for any template selling on "AI media at scale"** |
| **No `runtime` field set anywhere** | Every agent runs on platform default | P2 (only matters if you ship multi-runtime) |
| **No spend ceiling on any agent** | Zero templates have any concept of "stop after $X" | **P0 for any template that loops** |

### Voice / brand drift

I read the system prompts on a sample of 8 templates. Voice is **inconsistent** across the library:

- **`tiktok_shop` (just rebuilt)**: tight, data-driven, names specific metrics, refuses vague claims. "You think in unit economics. CM2 must stay above 20%." Premium voice.
- **`faceless_youtube`**: similar, specific. "Mandatory HITL gate." Premium voice.
- **`dealhawk_empire`**: tight, regulated-business voice. Premium.
- **`forex_trading_desk`**: tight + regulatory. Premium.
- **`ecommerce`**: less specific. "Help the operator scale the business" — generic. Mid-tier voice.
- **`service_business`, `real_estate`, `local_service`**: generic agentic voice. "You handle leads quickly" — could be any of 3 templates. Lower-tier voice.
- **`business_builder`**: warm/conversational ("supportive, practical"). Different voice register from the rest.
- **`tiptax_affiliate_engine`**: niche affiliate-CRO voice. Coherent but isolated.

**Recommendation:** Pick one library voice (the `tiktok_shop` / `faceless_youtube` / `dealhawk` register — specific, metric-driven, refuses generic AI babble) and rewrite the 8 generic templates to match. **This is the single highest-leverage P1 across the library.**

### Schedule + approval-mode distribution

```
review_after:  94 (61%)  — agent runs, surfaces output for after-the-fact review
approve_first: 40 (26%)  — agent waits for explicit approval before running
notify:         9  (6%)  — agent runs autonomously, just notifies
auto:          11  (7%)  — fully autonomous
```

Healthy bias toward `review_after`. The 11 `auto` workflows should be audited individually — they execute without any human gate. Where are they? Let me grep them in the deep-dive section.

**Schedule sanity check:** zero workflows have `trigger: "scheduled"` without a `scheduleMode` and `frequency`. This is clean — no silent never-fires.

---

# SECTION B — SHIP-READINESS RANKING

Ranked from **MOST READY to LEAST READY**. Verdict legend: **SHIP** = saleable today (minor polish OK). **NEEDS WORK** = saleable after focused fixes (1–3 days). **NOT READY** = saleable only after structural rebuild (1+ week). Every template flagged with my best-guess top 3 P0 issues.

| Rank | Template | Verdict | Headline | Top 3 P0 issues | Fix-time estimate |
|---:|---|---|---|---|---:|
| 1 | **`tiktok_shop`** | **SHIP** | Just rebuilt to TikTok-Shop-native; 11 agents, SPS-tier roadmap, addon system, integration-aware. Best-shaped template in the library. | (1) No spend ceiling on AI UGC tool calls; (2) System prompts reference HeyGen/Creatify/Arcads but agent `tools` arrays don't include them — declared ≠ wired; (3) `primaryModel` is set but no fallback model | **0.5 day** |
| 2 | **`faceless_youtube`** | **SHIP** | 14 agents, full video stack wired (ElevenLabs / JSON2Video / fal.ai / YouTube Data + Analytics tools actually in agent `tools` arrays), HITL approval gate built in. | (1) Stripe + Resend required but channel-flipping monetization works without them; should be optional; (2) No GIVEN model versions for fal.ai (latest = drift risk); (3) `auto` approval workflows need audit | **1 day** |
| 3 | **`dealhawk_empire`** | **SHIP** | 14 agents, 24+ Dealhawk-specific tools wired (deal scoring, MAO, sub-to qualification, skip trace, buyer matching), demo-data seeding, regulated-business gating. Most engineered template. | (1) Telephony triad (Twilio/Telnyx/WhatsApp) suggested but no opinion on which; (2) No outreach spend ceiling; (3) Brand voice tight but compliance disclaimers per-state not modeled | **1 day** |
| 4 | **`forex_trading_desk`** | **NEEDS WORK** ⚠ | Fully wired (twelvedata/oanda/tradovate/finnhub/fred), regulated, jurisdiction gate. **But: regulatory exposure of selling FX trading to retail is real.** | (1) **Liability question — should this be sold publicly at all?**; (2) Only 6 workflows for 14 agents (low cadence-to-team ratio); (3) Trading mode defaults are correct (research only) but onboarding doesn't surface the consent escalation clearly enough | **2 days + legal review** |
| 5 | **`tiptax_affiliate_engine`** | **SHIP (private only)** | 40 KB items, 15 workflows, full outreach stack (Smartlead/Instantly/Sendpilot/Manychat/Reddit/Playwright). Affiliate-recruitment-engine specialist. **Private** — not for retail SKU. | (1) Empty-string `primaryModel` (typo bug); (2) Hardcoded affiliate link default in `applyContext`; (3) Heavy MCP requirement footprint — Postgres + Firecrawl + Instantly + Sendpilot all required = customer hits paywall fast | **0.5 day for typo + private-only** |
| 6 | **`ghost_operator`** | **NEEDS WORK** | 5-agent autonomous business builder. 9 workflows. Marketing star. **But: agents promise 8-channel publishing without the publishing tool wired into their `tools` array.** | (1) Agents describe TikTok/IG/X/LinkedIn/Pinterest/etc. publishing — `social_media_mcp` is required, but agent `tools` arrays don't include `social_publish_post`/`social_get_analytics`; (2) "Researches the best business" — no tool grounding for actual research (only `web_search`); (3) "24/7" claim — no spend ceiling | **2 days** |
| 7 | **`agency`** | **NEEDS WORK** | 8 agents for multi-client agency. **Required `hubspot_mcp` but no HubSpot tools in any agent `tools` array.** Declared ≠ wired. | (1) HubSpot required but not actually used; (2) No client-isolation model (one agent serves all clients?); (3) Voice generic | **2 days** |
| 8 | **`local_lead_gen`** | **NEEDS WORK** | 9 agents wired with CallRail, Ahrefs, Semrush tools — best SEO-tooling coverage. KB lighter than peers (6 items). | (1) KB at 6 items is thin for $497 SKU; (2) Generic outbound voice; (3) Agents reference local-citation work but no specific GMB/citations tool wiring | **2 days** |
| 9 | **`content_creator`** (Newsletter Empire) | **NEEDS WORK** | 6 agents, beehiiv tools wired (5 of them). Solid for newsletter operators. | (1) Stripe required but newsletter ad-revenue path doesn't need it; (2) Beehiiv is hardcoded — Substack/Kit/Ghost users locked out; (3) Voice mid-tier | **1.5 days** |
| 10 | **`pinterest_traffic`** | **NEEDS WORK** | Tailwind tools wired (6 specific tools). Niche-fit good. KB at 6 items thin. | (1) KB thin for $197+; (2) Required `tailwind_mcp` is hard MCP dependency on a paid product (~$15/mo); (3) Pinterest API direct option not surfaced | **1.5 days** |
| 11 | **`ecommerce`** (E-Commerce & Etsy hybrid) | **NEEDS WORK** | 7 agents, etsy/printify/tailwind tools wired. **But the template tries to be BOTH a Shopify DTC brand AND an Etsy printable studio in one.** Identity confusion. | (1) Bifurcated identity — split into `dtc_shopify` and `etsy_printables` as separate templates; (2) Voice generic; (3) Stripe required but Etsy + Printify operators don't always use Stripe | **3 days (split)** |
| 12 | **`saas_product`** | **NEEDS WORK** | 4 agents. GitHub MCP suggested. Generic. | (1) 4 agents is thin for SaaS complexity (onboarding + support + billing + churn + product-eng + dev-rel); (2) Voice generic; (3) Stripe required but trial-only / open-source SaaS skip it | **2 days** |
| 13 | **`high_ticket_coaching`** | **NEEDS WORK** | 4 agents. Stripe + Resend required (legit for $5K+ programs). Generic voice. | (1) Voice not premium ($5K+ buyer expects $5K+ voice); (2) 4 agents is thin for high-ticket sales+delivery+retention; (3) No webinar/launch sequence specifics in workflows | **2.5 days** |
| 14 | **`real_estate`** | **NEEDS WORK** | 4 agents for licensed agents. Generic. | (1) Voice generic; (2) MLS / IDX integration not wired or even discussed; (3) State-specific compliance not modeled | **3 days** |
| 15 | **`local_service`** | **NEEDS WORK** | 4 agents. Generic local-service ops. | (1) Voice generic; (2) Telephony triad without opinion; (3) Google Business Profile is the marketing asset and there's no GBP tool/MCP wiring | **2 days** |
| 16 | **`service_business`** | **NEEDS WORK** | 4 agents, generic services. Resend required. | (1) Generic — overlaps with high_ticket_coaching, social_media_agency, agency without clear differentiation; (2) Voice generic; (3) Probably consolidate with one of the other service templates | **2 days OR retire** |
| 17 | **`social_media_agency`** | **NEEDS WORK** | 4 agents. social_media_mcp required (correct). Generic. | (1) Voice generic; (2) 4 agents is thin for SMMA (need separate IG/TikTok/LI specialists or a content pipeline); (3) Client onboarding workflow missing | **2 days** |
| 18 | **`skool_community`** | **NEEDS WORK** | 4 agents, Stripe + Resend required. Generic. | (1) Voice generic; (2) No actual Skool API/MCP — agents draft what to do, you paste it. This needs to be VERY clear in onboarding; (3) Community-engagement metrics missing | **2 days** |
| 19 | **`business_builder`** | **NEEDS WORK** | 4 agents, "tell me what to do" framing. Optional but high friction onboarding (4-question form). | (1) Conflict with `ghost_operator` — both target "first-time founder"; (2) Sets `summary/brandVoice/mainGoals` from form answers but no agent KB references those answers; (3) Could be a wizard, not a template | **2 days OR consolidate** |
| 20 | **`blank`** | **N/A — not a sellable SKU** | Empty by design | — | — |

---

## Library-wide P0 themes (preview of Section D)

Three patterns appear in 3+ templates and are higher-leverage than any individual fix:

1. **Declared ≠ Wired** (P0 for any template that markets media production): Agents' system prompts describe tools that don't exist in their `tools` arrays. KB items reference HeyGen/Creatify/Arcads/OpenArt as if agents call them. They don't. This is fraud-risk for premium SKUs that promise "AI does it for you."
2. **`primaryModel` unset on 15/20 templates** (P1): Output quality drifts as platform defaults change. Premium SKU customers get inconsistent quality.
3. **Generic voice on 8 templates** (P1): The 4 specialty templates (tiktok_shop, faceless_youtube, dealhawk, forex) sound premium. The other 8 sound like template-marketplace fluff.
4. **Zero spend ceilings library-wide** (P0 for templates with loops): Any agent that loops content generation can burn unbounded credits.

---

## What's next

I've delivered Sections A & B per the framework. **Section C (per-template deep dive in priority order)** comes next. Per your framework's "if too large, continue in follow-ups" rule, I'll batch C into multiple messages — **2 templates per message**, starting from the **bottom of the rank** (least ready, most fix-time leverage).

**Confirm before I dive in:**

1. **Price tiers** — argue with my numbers above? Or proceed with them as the "would I pay $X" anchor?
2. **Forex trading desk regulatory question** — do you want me to flag this in Section D as "consider not selling publicly" and move on, or audit it like any other template?
3. **Service-template consolidation** — `service_business`, `social_media_agency`, `skool_community`, `high_ticket_coaching` are all ~4-agent generic-voice templates targeting overlapping ICPs. Audit each separately, or audit them once as a class with consolidation recommendation?
4. **Order of attack** — bottom-up (least ready first, biggest impact) is my default. You want top-down (validate the SHIP-tier templates first)?

Send your answers and I'll start Section C in the next message.


<!-- ============================================================ -->
<!-- Section C/1 — tiktok_shop  (transcript line 716, 31929 chars) -->
<!-- ============================================================ -->

I have enough context now. Two facts that change my earlier audit framing:

1. **Platform auto-attaches the video production stack** (`HeyGen`, `Creatify`, `ElevenLabs`, `JSON2Video`, `B-Roll`, `Auto-Clip`, `Whisper`, `R2`) to ANY agent in a `VIDEO_PRODUCTION_TEMPLATES` template ([tool-registry.ts:4782](lib/mcp/tool-registry.ts:4782) — `tiktok_shop` is included). The agents' explicit `tools: []` arrays are an *additional* whitelist on top of these auto-attached tools.
2. **Installed MCP tools auto-populate** via `getToolsForAgent` ([tool-registry.ts:1863](lib/mcp/tool-registry.ts:1863)) — every active MCP server in the org/business contributes its full tool set to every agent in that business.

So "declared ≠ wired" is **less severe than I flagged in Section A** — but a different problem appears: **agents don't know what tools they actually have at runtime** because their system prompts only mention the explicit `tools: []` whitelist. Now to the audit.

---

# SECTION C — TEMPLATE 1/19: `tiktok_shop` (TikTok Shop Operator)

**Verdict:** **SHIP** with focused fixes (~0.5 day to S-tier).
**Headline:** Just rebuilt to TikTok-Shop-native; 11 agents, SPS-tier roadmap, addon system. The shape is right. The remaining issues are mostly *contract* gaps (system prompts don't describe the actual tool runtime) and missing guardrails (spend ceiling, model fallback, delegation-tool gap).

## C1. Functional walkthrough — daily happy path

The customer's daily-cadence loop is: **CEO produces Shop Health Report → constraint sub-metric named → owner assigned → specialist runs daily/weekly workflow → output reviewed → action taken**. Tracing one full cycle:

| Agent (depth 0) | INPUT | PROCESSING | TOOL CALLS (named in system prompt) | TOOL CALLS (actual at runtime) | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **CEO** | SPS sub-metrics from Seller Center (operator pastes), Settlement Reports (operator pastes), workflow outputs from specialists | Weekly Shop Health Report → constraint sub-metric → assigned owner | ❓ None named | `send_email`, `web_search`, `knowledge_lookup`, BUILTIN_ALWAYS_ON (incl. `delegate_task`), full video stack auto-attached, social_media_mcp tools (publish, analytics, comments) when installed | Weekly report + constraint + owner | 🟡 IMPLICIT — system prompt says "coordinate with Compliance" but no `delegate_task` instruction |
| **Growth Strategist** | Algorithm signals (post performance from `social_media_mcp`), follower velocity | Apply Follower Velocity Decision Rule, run shadow-ban detection, surface Spark Ads candidates | `web_search`, `knowledge_lookup` | + BUILTIN, + video stack, + social_media_mcp `get_analytics`, `get_post_history`, `get_profiles` (when installed) | Daily report with constraint + escalation | 🟡 IMPLICIT — surfaces Spark Ads candidates "to operator" but no actual mechanism |
| **Listings Specialist** | New SKU candidates, fee assumptions, supplier data (operator pastes or KB) | Score against Listing Quality Scorecard + full fee-stack CM2 projection | `web_search`, `knowledge_lookup` | + BUILTIN, + video stack | Per-SKU memo with CM2 calc + listing tier verdict | 🟡 IMPLICIT — "coordinate with Compliance / Operations / Finance" but no `delegate_task` mention |
| **Content Producer** | Weekly Content Calendar slot, master hashtag bank, SEO query bank | 7 video packages/week + carousel briefs + cross-platform variants | `web_search`, `knowledge_lookup` | + BUILTIN, + video stack (HeyGen/Creatify/ElevenLabs/etc.), + social_media_mcp | 7 production-ready packages | 🟡 IMPLICIT — packages "queue for publishing" but no `social_publish_post` instruction in system prompt |
| **AI UGC Producer** | Active SKU + brief from Listings | 10–20 variations using AI tools | `web_search`, `knowledge_lookup` | + BUILTIN, + video stack incl. `heygen_generate_video`, `creatify_generate_ugc`, `elevenlabs_generate_voiceover`, `upload_to_r2` | Variation pipeline + Hook Rate report | 🔴 BREAK — system prompt says "produce in tool" but doesn't reference the actual tool names (`heygen_generate_video`, `creatify_generate_ugc`); Arcads is recommended but not wired |
| **Affiliate Manager** | Marketplace state (Open Plan vs Targeted), creator targets (operator pastes) | Creator outreach drafts + commission strategy + sample dispatch coordination | `send_email`, `web_search`, `knowledge_lookup` | + BUILTIN | Personalized creator briefs | 🔴 BREAK — system prompt says "use the TikTok Shop Affiliate API" but **no Affiliate API MCP exists** in the library — agent will draft but cannot execute |
| **Ads Manager** | Spark Ads candidates from Growth Strategist, creative pipeline from AI UGC Producer | GMV Max campaign briefs, creative-rotation decisions, Spark Ads pipeline | `web_search`, `knowledge_lookup` | + BUILTIN, + video stack | Per-SKU campaign briefs (operator executes in Ads Manager UI) | 🔴 BREAK — no TikTok Ads MCP; "draft + paste" model not made explicit in system prompt |
| **Compliance Officer** | New listings, content, ad creatives (queued by other agents) | C2PA + paid-partnership label review, INFORM Act watch, IP defense | `web_search`, `knowledge_lookup` | + BUILTIN | Pass/fail per asset + Weekly Compliance Audit | 🟡 IMPLICIT — "review every new SKU before listing" but no incoming-queue mechanism |
| **Operations & Fulfillment** | LDR/OTDR data (operator pastes from Seller Center), supplier data | Daily LDR firefight + FBT decisions + returns/refund workflow + dispute evidence | `send_email`, `knowledge_lookup` | + BUILTIN, + video stack (irrelevant) | Daily LDR escalation + supplier scorecards | 🟡 IMPLICIT — "process returns within 1 working day" but no Seller Center API access |
| **Finance & Settlement Analyst** | TikTok Settlement Reports (operator pastes), order records | Weekly Unit Economics Report + Settlement Reconciliation + Cash Flow Forecast | `knowledge_lookup` ONLY | + BUILTIN — but no `send_email` to surface escalations | Per-SKU CM2 + cash flow forecast | 🔴 BREAK — escalation rules say "escalate when discrepancies >$100" but agent has no `send_email` tool to actually escalate |
| **Customer Service & Reviews** | TikTok IM messages (operator pastes), review queue | IM responses, review-velocity prompts, public + private negative-review handling | `send_email`, `knowledge_lookup` | + BUILTIN, + video stack (irrelevant), + social_media_mcp `get_comments` (read-only for reviews) | IM response drafts + Review Velocity report | 🟡 IMPLICIT — `social_media_mcp` doesn't have a "post comment reply" tool, only `get_comments` (read) — verified at [providers/types.ts](mcp-servers/social-media/src/providers/types.ts) — agent can read but not respond automatically |

### Break points (where the chain assumes something that isn't wired)

1. **Spark Ads creator-handle authorization pipeline** — Growth Strategist + Ads Manager both reference this. **No tool to request authorization from creators**, no UI prompt mechanism, no in-app workflow page for it. Operator has to know to manually message creators.
2. **Affiliate API integration** — Affiliate Manager system prompt says "Use the TikTok Shop Affiliate API for sample dispatch automation, creator GMV pulls, commission queries." There is no TikTok Affiliate API MCP in the library. The agent will draft what to do, but the operator has to execute via Affiliate Center manually. **The system prompt overpromises.**
3. **Settlement Report ingestion** — Finance & Settlement Analyst's entire job depends on Settlement Reports. There's no way to auto-import them. **The KB item documents the manual paste workflow but Finance's system prompt doesn't tell the operator to paste them.**
4. **Inter-agent coordination** — 7 of 11 agents say "coordinate with X" in their system prompts. None except CEO have `delegate_task` (only leaders get it per [tool-registry.ts:5191](lib/mcp/tool-registry.ts:5191)). Specialists asking each other to "coordinate" cannot actually delegate.
5. **Finance Analyst escalation gap** — Escalation rules require `send_email` (telling CEO about >$100 discrepancies), but the agent's `tools: ["knowledge_lookup"]` doesn't include `send_email`. **Cannot escalate.**

---

## C2. Integration health

| Integration | Declared | Wired in code? | Status | Notes |
|---|---|---|---|---|
| `social_media_mcp` | **Required** | Yes (auto-attached via `getToolsForAgent`) when installed | ✅ Configured | Late or Ayrshare provider. Tools: `publish_post`, `schedule_post`, `delete_post`, `get_analytics`, `get_post_history`, `get_profiles`, `get_comments`, `upload_media`. Operator must install + connect TikTok via Late/Ayrshare dashboard. |
| `shopify_mcp` | Suggested | Yes (auto-attached when installed) | ✅ Optional | Used only if mirrored DTC storefront exists. |
| `stripe_mcp` | Required (only when Organic Ladder addon enabled) | Yes via addon mechanism | ✅ Conditional | Addon only |
| `resend_mcp` | Required (only when Organic Ladder addon enabled) | Yes via addon mechanism | ✅ Conditional | Addon only |
| HeyGen | Mentioned in KB + system prompts | Yes (auto-attached for `tiktok_shop` template per `VIDEO_PRODUCTION_TEMPLATES`) | ✅ Configured | Tools: `heygen_list_avatars`, `heygen_generate_video`, `heygen_check_video`. Operator needs HeyGen API key configured at the platform level. |
| Creatify | Mentioned in KB + system prompts | Yes (auto-attached) | ✅ Configured | Tools: `creatify_list_avatars`, `creatify_generate_ugc`, `creatify_check_ugc`. Operator needs Creatify API key. |
| ElevenLabs | Implied in KB | Yes (auto-attached) | ✅ Configured | `generate_voiceover`, `list_elevenlabs_voices`. Operator needs ElevenLabs key. |
| Arcads | Recommended in KB | ❌ NOT wired | ⚠ Documentation-only | Operator runs Arcads externally and uploads outputs. **System prompt should clarify this.** |
| MakeUGC | Recommended in KB | ❌ NOT wired | ⚠ Documentation-only | Same as Arcads. |
| OpenArt | Recommended in KB for AI avatar bible | ❌ NOT wired | ⚠ Documentation-only | Same. |
| ManyChat (DM-to-Shop) | Required workflow target | ❌ NOT wired | ⚠ Documentation-only | Operator configures in ManyChat UI directly. |
| TikTok Shop Affiliate API | Referenced in Affiliate Manager system prompt | ❌ NOT wired | 🔴 P0 — overpromise | Agent claims to use API. Cannot. |
| TikTok Shop Open Platform (Settlement, Orders, Listings, Returns, Promotions) | Referenced as data source for many agents | ❌ NOT wired | ⚠ Documentation-only | Manual paste in KB. **No first-party MCP exists today** per setup checklist — accurate but the gap should be louder in agent system prompts. |
| GMV Max Ads | Ads Manager runs them | ❌ NOT wired | ⚠ Documentation-only | Operator pastes Spark codes into TikTok Ads Manager. |
| LLM (Anthropic) | `primaryModel: "anthropic/claude-sonnet-4.5"` | ✅ Configured | Pinned ✅ | **No fallback model** — if Anthropic is down, no Claude Haiku/Sonnet fallback |

### Per-integration audit (the 8 sub-checks)

For the 4 actually-wired integrations:

| Check | `social_media_mcp` | HeyGen | Creatify | ElevenLabs |
|---|---|---|---|---|
| **Credential flow** | MCP install flow at `/admin/integrations` ✅ | Org-level API key (manual in MCP setup or env var ❓ — let me verify) | Same | Same |
| **Call construction** | Standard MCP schema, declared in [providers/types.ts](mcp-servers/social-media/src/providers/types.ts) ✅ | Tool schema declared in `tool-registry.ts` ✅ | Same | Same |
| **Rate limit awareness** | ❌ No agent mentions rate limits | ❌ | ❌ | ❌ |
| **Error handling** | ❌ No retry/fallback policy in any agent system prompt | ❌ | ❌ | ❌ |
| **Cost ceiling** | ❌ Zero | ❌ Zero | ❌ Zero | ❌ Zero (long voiceovers can hit $1+/script unbounded) |
| **Fallback path** | ❌ Late ↔ Ayrshare are alternatives but no fallback rule | ❌ HeyGen → Creatify fallback not designed | ❌ | ❌ ElevenLabs → OpenAI TTS not designed |
| **Model/version pinning** | ✅ Provider locked in MCP config | ❌ HeyGen avatar model not pinned per template — operator picks | ❌ Same | ❌ ElevenLabs voice ID & model not pinned per business — operator must pick |

---

## C3. Media generation deep-check

This template generates **AI UGC video + AI avatar talking-head + AI voiceover**. Per Phase 4:

### Image generation
**Not in primary loop.** Avatar character bible references OpenArt for static avatar images. No direct image-gen tool wired. KB content describes prompt engineering for OpenArt but the agent cannot call it — operator runs externally. **Acceptable for the avatar-bible workflow (one-time setup) but a gap if the template promises "AI generates your avatar."**

### Video generation (HeyGen / Creatify auto-attached)
- ✅ Prompts engineered for the specific tool? **Partial.** AI UGC Producer system prompt lists tool capabilities but doesn't show *how* to write a Creatify prompt vs. an Arcads prompt. Different platforms have different prompt grammars. **Missing: per-tool prompt examples in KB.**
- ❌ Aspect ratio explicitly specified? Mentioned in Ad Clone workflow KB ("9:16 / 1:1 / 4:3") but **not enforced in the actual `creatify_generate_ugc` or `heygen_generate_video` tool calls** — depends on operator parameters.
- ❌ Quality/consistency check before downstream use? AI UGC Producer's escalation rules mention "below 20% hook rate → replace opening" — that's *post hoc*, not pre-publish. **No automated QC step.**
- ❌ Multi-shot continuity? Each Creatify generation is independent. **Avatar bible exists in KB but not enforced as a constraint passed to every video gen call.**
- ❌ Stitching / editing step? Templates references CapCut + JSON2Video. JSON2Video tools auto-attached. **But system prompts don't mention them.**

### Voice / TTS (ElevenLabs auto-attached)
- ❌ Voice ID consistent across a project? **No business-level default voice ID set.** Each call lets the agent pick — drift across content batches.
- ❌ Voice settings tuned? Default settings used.
- ❌ Long-form chunking? `generate_voiceover` doesn't show evidence of automatic chunking for long scripts (TikTok content is short so probably OK in practice).
- ❌ Re-roll mechanism if first generation is bad? Not designed.

### Music
- ❌ Music generation not in scope (the template correctly tells operators to use TikTok Commercial Music Library — third-party music kills shoppable reach). Ironic-ally, this means *this template is correctly avoiding music gen*. ✅ Acceptable.

### Avatar / UGC video
- ❌ Avatar selection consistent across brand? Avatar bible in KB but no enforcement at tool-call time.
- ❌ Script optimized for spoken delivery? Content Producer system prompt mentions "spoken aloud in audio" — good direction, but no abbreviation/numeric handling rule.
- ❌ Lip-sync verified? HeyGen handles this internally. Acceptable.
- ⚠ Background, framing, brand intro/outro standardized? Not enforced.

**Headline:** Tools are wired but **system prompts don't tell agents to use them, and there's no consistency-enforcement layer between brand guidelines (avatar bible) and tool calls.** A customer running this template will get inconsistent avatars + voices across content batches unless they manually enforce it.

---

## C4. Output quality scorecard

Predicting based on prompt structure (no real outputs):

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $497? |
|---|---|---|---|---|---|
| **Weekly Shop Health Report (CEO)** | High — SHOP_HEALTH.md template is structured | High — per-SKU CM2 + SPS sub-metrics | High — tied to numbers | High — copy-paste into a Notion doc | ✅ Yes |
| **7 Video Packages/week (Content Producer)** | High — 11-element package spec | High — content-calendar bound | Medium — depends on operator filling AI avatar bible | High — production-ready | ✅ Yes |
| **AI UGC Variation (AI UGC Producer)** | Medium — depends on operator's prompt input + tool config | Low–Medium — same prompt yields different visuals across calls due to no enforced consistency | LOW — avatar drift across batches likely | Medium — needs human QC | ⚠ Borderline — premium customer expects more consistency |
| **Affiliate Outreach Brief (Affiliate Manager)** | High — tightly structured | High — references creator's actual content | High | Medium — operator must DM manually outside Marketplace | ✅ Yes |
| **GMV Max Campaign Brief (Ads Manager)** | High | High | High | Low — operator executes in TikTok Ads Manager (multi-step paste) | ⚠ Borderline — *brief* is great but customer wanted the campaign launched, not just briefed |
| **Settlement Reconciliation Report (Finance)** | High | High | High | High when operator pastes Settlement CSV — Low until then | ✅ Yes |
| **Customer IM Response (CS & Reviews)** | High — template library structured | High | High | High | ✅ Yes |

**Two outputs fail the $497 test:** AI UGC variations (consistency drift) and GMV Max campaign briefs (last-mile gap — operator wanted launch, got brief).

---

## C5. Error-handling stress test (8 scenarios)

| # | Scenario | What happens today | P-level |
|---|---|---|---|
| 1 | Customer's `social_media_mcp` API key invalid | `social_publish_post` returns error → agent **does not retry** (per global instruction at [tool-registry.ts:1914](lib/mcp/tool-registry.ts:1914): "If a tool call fails, DO NOT retry the same call. Report the error to the user.") → operator sees error in chat. ✅ Reasonable. | OK |
| 2 | `social_media_mcp` server is offline | `getToolsForAgent` filters by `status: "active"` ([tool-registry.ts:1871](lib/mcp/tool-registry.ts:1871)) — if marked inactive, no tool exposed. **But no health check** — if server is technically active but unreachable, calls fail with timeouts. No agent fallback. | **P1** |
| 3 | Customer pastes garbage Settlement Report data | Finance Analyst processes whatever it sees — **no validation step in system prompt**. Could compute meaningless CM2. | **P1** |
| 4 | Content moderation blocks an HeyGen video output (e.g. trademark detected) | `heygen_generate_video` returns failure → agent reports error → no fallback to Creatify. | **P1** |
| 5 | Customer runs at 3am unsupervised | All workflows have `approvalMode: "review_after"` (most common) or `"approve_first"`. Approve_first stalls until approval. Review_after runs and surfaces. **Acceptable for unsupervised — but no operator notification mechanism beyond Telegram (only if installed).** | **P2** |
| 6 | Customer runs same workflow twice in a day | Workflows are stateless — same workflow can run multiple times, will produce similar outputs. No deduplication. **Probably fine for review-after; bad for any workflow that posts.** | **P1** |
| 7 | Customer scales up (3 SKUs → 50 SKUs) | AI UGC Producer's "10–20 variations per active SKU" → at 50 SKUs that's 500–1000 video gen calls. **No batch ceiling. No daily spend budget. Could trivially burn $1,000+ in Creatify credits in one batch.** | **P0 — fix before sale** |
| 8 | Third-party rate limit hit (e.g. ElevenLabs 429) | Per global "do not retry" rule, single 429 surfaces as error. No back-off. **Agent doesn't know about rate limits in the first place.** | **P1** |

---

## C6. Premium polish

| Aspect | State | Issue |
|---|---|---|
| **Onboarding** | Day 1 Setup Checklist KB item lists everything | ✅ Strong. Best in library. |
| **Defaults** | `safetyMode: "ask_before_acting"`, `primaryModel: "anthropic/claude-sonnet-4.5"` set | ✅ Reasonable defaults. **No fallback model.** |
| **Documentation** | Agent purposes are clear from name + role + purpose | ✅ Strong |
| **Voice** | Tight, metric-driven, refuses generic claims | ✅ Premium voice. **This is the model the rest of the library should follow.** |
| **Progress visibility** | Workflows have `approvalMode: review_after` — operator sees output after | ⚠ No live progress indicator during AI UGC batch generation (which can take 5–10 min). Operator stares at chat. **Consider a streaming progress message.** |
| **Handoff moments** | Every workflow's `description` ends with what the operator sees | ✅ Acceptable |
| **The 90% rule** | This template asks the operator to: paste Settlement Reports, paste SPS metrics, configure ManyChat, configure GMV Max in TikTok Ads Manager, send Affiliate DMs externally, post to TikTok via Social Media Hub (automatable) | ⚠ **The 90% rule is closer to 60–70%.** A lot of "agent drafts, you execute" because TikTok's first-party APIs aren't all wired. **This is honest about the platform's limits but feels less premium than "agent does it."** |

---

## C7. Cost efficiency

Single-run-per-week of all scheduled workflows, ballpark:

| Workflow | Tool calls per run | Est. cost per run |
|---|---|---|
| Daily Content Publishing Queue | LLM (Sonnet 4.5) ~5K tokens × 1 = $0.075 | Negligible |
| Daily LDR & Late Dispatch Firefight | LLM ~3K = $0.045 | Negligible |
| Daily SPS Watch | LLM ~3K = $0.045 | Negligible |
| Follower Velocity Check | LLM ~5K = $0.075 | Negligible |
| Weekly Shop Health Report | LLM ~10K = $0.15 | Negligible |
| Weekly Unit Economics | LLM ~10K = $0.15 | Negligible |
| Settlement Reconciliation | LLM ~10K = $0.15 | Negligible |
| Affiliate Outreach Campaign | LLM ~15K + 30 outreach drafts × LLM ~2K = $0.60 | $0.60–$1 |
| Customer Review Follow-Up | per-event, LLM ~3K = $0.045 each | Negligible |
| Compliance Audit | LLM ~15K = $0.225 | Negligible |
| GMV Max Creative Rotation & Spark Ads | LLM ~10K = $0.15 | Negligible |
| Weekly Winner Extraction | LLM ~5K = $0.075 | Negligible |
| Weekly Batch Content Production | LLM ~50K (7 packages × 7K each) = $0.75 | $0.75 |
| Weekly **AI UGC Creative Batch** | 10–20 video gens × $2–11/video × N SKUs = **$30–$2,200/week per 5 SKUs** | **$30–$2,200/week** ⚠ |
| Ad Clone Pipeline Review | LLM ~10K = $0.15 | Negligible |
| Listing Quality Sweep | LLM ~10K = $0.15 | Negligible |
| SEO Query Bank Mining | LLM ~5K = $0.075 | Negligible |

**Total LLM weekly cost: ~$3–$5.** Cheap. ✅

**AI UGC weekly cost: $30–$2,200.** This is the killer. **There's no ceiling.** A customer with 10 SKUs running Arcads variations could burn $4,000/week in AI video credits before realizing it. Even with Creatify's $2–4/video, 10 SKUs × 15 variations = 150 videos × $4 = $600/week.

**P0 — must add cost guardrails before selling this.**

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: No spend ceiling on AI UGC batch production
**What:** [`AI UGC Creative Batch Production` workflow at business-templates.ts](lib/templates/business-templates.ts) (line ~5046) runs weekly, produces 10–20 variations per active SKU using Creatify/HeyGen/Arcads. **No max-call-count, no daily-spend cap, no per-SKU quota.**

**Why it matters:** Priority 1 (Functional) + Priority 6 (Cost). Customer with 10 SKUs runs this once and burns $600–$4,000 in video gen credits in a single batch. They will refund. Possibly chargeback.

**Fix:** Add to `AI UGC Producer` system prompt:
```
COST GUARDRAILS:
- Maximum 5 active SKUs per weekly batch (operator chooses which SKUs).
- Maximum 15 variations per SKU per batch.
- Total batch ceiling: 75 video gens / week.
- Before launching a batch, compute total estimated cost using tool-rate-card and surface it for operator approval (approve_first).
- Hard stop at $300/week unless operator explicitly raises ceiling in business config.
```
And change the workflow's `approvalMode` from `"review_after"` to `"approve_first"`. **Also add a `max_weekly_video_budget` field to business config** so the operator can set their own ceiling.

### P0-2: Affiliate Manager system prompt overpromises
**What:** [Affiliate Manager system prompt at line 4801](lib/templates/business-templates.ts:4801): *"Use the TikTok Shop Affiliate API (launched 2024) for sample dispatch automation, creator GMV pulls, and commission queries"*. **No Affiliate API MCP exists.** Agent has tools `["send_email", "web_search", "knowledge_lookup"]` plus BUILTIN. None are TikTok Affiliate API.

**Why it matters:** Priority 1 (Functional) + Priority 5 (Premium polish). Customer reads "AI does affiliate sample dispatch automatically." Reality: agent drafts what to dispatch, operator runs it manually in Affiliate Center. **Mismatch between promise and delivery.**

**Fix:** Replace that sentence with: *"The TikTok Shop Affiliate API (launched 2024) supports sample dispatch automation, creator GMV pulls, and commission queries — but Ghost ProtoClaw does not have a first-party Affiliate API MCP yet. You draft creator briefs, sample dispatch lists, and commission policies; the operator executes them in Affiliate Center directly. Surface a one-line 'TODO for operator' summary at the end of every report so they know exactly what to action."*

### P0-3: Finance & Settlement Analyst cannot escalate
**What:** [Finance & Settlement Analyst at line 4877](lib/templates/business-templates.ts:4877): `tools: ["knowledge_lookup"]`. Escalation rules say "Escalate when settlement discrepancies exceed $100." **Agent has no `send_email`, no `delegate_task` (specialists don't get it), no Telegram, no surfacing mechanism.**

**Why it matters:** Priority 1 (Functional). Critical financial escalations silently dropped.

**Fix:** Add `"send_email"` to the agent's `tools` array. (BUILTIN_ALWAYS_ON includes `send_telegram_message` so Telegram works if installed, but `send_email` is the canonical escalation channel and must be explicit in the whitelist.)

### P0-4: System prompts don't enumerate the actual tool runtime
**What:** All 11 agents have minimal `tools: []` arrays. At runtime, the platform attaches: BUILTIN_ALWAYS_ON (20+ tools), the full video stack (HeyGen, Creatify, ElevenLabs, JSON2Video, B-Roll, Auto-Clip, Whisper, R2), and any installed MCP tools (`social_media_mcp` adds 8 tools). **None of the system prompts enumerate these tools by name.**

**Why it matters:** Priority 2 (Output Quality) + Priority 1 (Functional). Agents who don't know they have a tool won't use it. The Content Producer is told to "use TikTok Commercial Music Library audio" but isn't told it has `heygen_generate_video` available — so it'll produce text scripts and miss the video pipeline.

**Fix:** Append to each agent's system prompt: a list of the tools they have access to that are relevant to their role, e.g. for AI UGC Producer:

```
TOOLS YOU HAVE ACCESS TO (AT RUNTIME):
- creatify_list_avatars / creatify_generate_ugc / creatify_check_ugc (volume UGC, $2–4/video)
- heygen_list_avatars / heygen_generate_video / heygen_check_video (avatar talking-head, $0.30/video)
- elevenlabs_list_voices / generate_voiceover (premium TTS)
- broll_search / log_broll_scene (stock footage)
- auto_clip_submit / auto_clip_check (Klap/Opus Clip extraction)
- upload_to_r2 (stable URLs for assets)
- transcribe_audio (Whisper)
- social_publish_post / social_get_analytics / get_comments (when Social Media Hub installed)
- knowledge_lookup, send_email, delegate_task (if leader)

Tools you DO NOT have (operator runs externally): MakeUGC, Arcads, OpenArt, Clippie AI, InVideo AI, ReelFarm.
```

This is the single highest-leverage fix in this audit. **Repeat the pattern across all agents.**

---

## C9. P1 issues (quality)

### P1-1: No model fallback for `claude-sonnet-4.5`
**Fix:** Add `fallbackModel: "anthropic/claude-haiku-4.5"` (or `openai/gpt-4o-mini`) to template defaults. Configure platform to fall through if primary times out / errors.

### P1-2: Inter-agent "coordinate with X" without delegation tool
**What:** 8 agents reference "coordinate with [other agent]" in their system prompts. Specialists don't have `delegate_task` (only leaders do). They surface intent but cannot trigger.

**Fix:** Either (a) escalate "coordination" requests through the CEO (whose tools include `delegate_task` automatically since it's in BUILTIN), or (b) replace "coordinate with X" with "surface a memo to CEO recommending coordination with X." I prefer (b) — it makes the human-in-loop pattern explicit.

### P1-3: AI avatar bible not enforced in tool calls
**What:** Avatar character bible lives in KB, but no automated check that every `heygen_generate_video` / `creatify_generate_ugc` call references the bible.

**Fix:** Add to AI UGC Producer system prompt: *"Before calling heygen_generate_video or creatify_generate_ugc, knowledge_lookup the AI avatar character bible KB item and pass the avatar_id / style_ref consistently. Refuse to generate if no bible is set — surface as escalation to CEO."*

### P1-4: ElevenLabs voice ID drift
**What:** No business-level voice_id default. Each call picks one.

**Fix:** Add a config field on the business: `default_voiceover_voice_id`. Add to Content Producer + AI UGC Producer system prompts: *"Always pass default_voiceover_voice_id from business config to generate_voiceover. If unset, surface to operator via review_after with a top-3 voice recommendation from list_elevenlabs_voices."*

### P1-5: No deduplication on workflow re-runs
**What:** Customer runs Weekly Batch Content Production twice — produces another 7 packages without checking last week's.

**Fix:** Add to workflow description: *"Before producing, check workspace docs for the most recent batch's date stamp. If <7 days old, surface 'Already produced this week — overwrite or skip?' to operator."*

### P1-6: Workflow with `approvalMode: "auto"`
**What:** No `tiktok_shop` workflows are `approvalMode: "auto"` actually — let me verify... [Looking back at audit data: tiktok_shop workflows are mostly `review_after` and `approve_first`.] **OK, this is fine for tiktok_shop. P1-6 doesn't apply here.**

### P1-7: GMV Max campaign brief — last-mile gap
**Fix:** Update Ads Manager system prompt to produce a paste-ready campaign config block (campaign name, daily budget, target SKUs, target CPA, creative IDs, Spark codes) so the operator's TikTok Ads Manager work is 60-second copy-paste vs. multi-step interpretation. Plus a checklist.

---

## C10. P2 issues (polish)

### P2-1: Telegram notification for autonomous runs
Add `send_telegram_message` to escalation paths so 3am autonomous LDR firefighter alerts reach the operator without needing to check chat.

### P2-2: SHOP_HEALTH.md template bias
Template doc has structured sections but no "last week's constraint sub-metric" memory. Add a "Last week's constraint: ___" row so the operator sees if they're stuck on the same metric for multiple weeks.

### P2-3: KB items use TikTok-Shop-native terms but the dashboard widget label says "Shop Health Tracker" (good) — check label consistency in onboarding emails / first-run wizard
Minor: future onboarding email/wizard should match the SHOP_HEALTH.md naming.

### P2-4: No "first run" demo data
Unlike `dealhawk_empire` which seeds 15 demo deals on materialization, `tiktok_shop` materializes empty. Premium feel improvement: seed 2 demo SKUs + a fake Settlement Report so the operator sees the system "alive" on Day 1.

### P2-5: Live Shopping not in any workflow
Daytime Live Shopping cadence is mentioned in KB ("2–4 sessions/week minimum, daily during launches") but no workflow drives it. Customer's Live Shopping runs are entirely human-driven. **If the template promises Live Shopping support, add a "Weekly Live Shopping Run-of-Show" workflow drafted by Content Producer.**

---

## Summary fix-time for `tiktok_shop`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | spend ceiling, Affiliate API overpromise, Finance escalation tools, system-prompt tool enumeration | **3–4 hours** |
| P1 (6) | model fallback, delegation language, avatar enforcement, voice ID config, dedupe, GMV Max paste-ready block | **3 hours** |
| P2 (5) | Telegram, header memory, naming consistency, demo data, Live Shopping workflow | **2 hours** |

**Total to S-tier: ~8–9 hours of focused fixing.** The shape is right — these are surface-level contract gaps and missing guardrails, not structural rebuilds.

---

**Next message: Section C for `faceless_youtube` (rank #2 SHIP-tier).** Send "go" if ready, or any course-correction first.


<!-- ============================================================ -->
<!-- Section C/2 — faceless_youtube  (transcript line 745, 34019 chars) -->
<!-- ============================================================ -->

Got everything I need. Writing Section C for `faceless_youtube`.

---

# SECTION C — TEMPLATE 2/19: `faceless_youtube` (Faceless YouTube Empire)

**Verdict:** **SHIP** with focused fixes (~1 day to S-tier).
**Headline:** Most engineered template in the library on the production-pipeline axis. 14 agents with actual tool wiring (Voice Director has ElevenLabs tools, Visual Producer has fal.ai, Assembly Engineer has JSON2Video, SEO/Publishing has YouTube Data v3, Studio Head has YouTube Analytics). HITL approval gate is the central design pattern and it's well-modeled. **But: Stripe + Resend marked as required when AdSense + Sponsorships are streams 1 and 2 of revenue. The fix is small but blocks "ship cleanly" today.**

## C1. Functional walkthrough — flagship video happy path

The 12-step production pipeline (per the template's stated design): Idea → Research → Outline → Script → Hook/Title/Thumbnail → Voice → Visuals → Thumbnails → Assembly → SEO → Publishing → Analytics. Mapping agents to steps:

| Step | Agent | INPUT | PROCESSING | TOOL CALLS (named) | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| 1. Idea / Outlier mining | **Niche & Packaging Strategist** | Niche + adjacent niches + outlier database (operator pastes) | Pulls 3× outliers, generates 3 title variants per video using 6 packaging formulas | `web_search`, `knowledge_lookup`, `youtube_list_channel_videos`, `youtube_get_video_analytics` | 3 title candidates + 3 thumbnail concepts per video | ✅ EXPLICIT to Research Analyst |
| 2. Research | **Research Analyst** | Greenlit concept | 5–7 facts w/ primary URLs, 3–5 named examples, 3 comment pre-empts, asset list, 3 operator-injection slots | `web_search`, `knowledge_lookup` | Sourced brief w/ injection slots | ✅ EXPLICIT to Script Writer |
| 3-4. Outline + Script | **Script Writer** | Brief | Timed retention-engineered script per format target (8-30min long, 30-60s Shorts), hook architecture, marked injection slots, AI-tells blacklist | `web_search`, `knowledge_lookup` | Scene-by-scene script with injection slots | ✅ EXPLICIT to Hook & Retention Editor |
| 5. Hook QA + LLM-as-judge | **Hook & Retention Editor** | Draft script | 5-point hook test, LLM-as-judge cascade (factuality / repetition / hallucination / AI tells / burstiness), humanizer pass | `knowledge_lookup`, `youtube_get_video_analytics` | Rubric scores + retention-cliff patches | 🟡 IMPLICIT — handoff back to Script Writer for fixes is implied not explicit; **HITL gate to Studio Head IS explicit** |
| **HITL GATE** | **Studio Head** | Edited script | Operator injects 10–20% proprietary content | (operator-driven) | Approval stamp | ✅ EXPLICIT — Voice Director system prompt says "only after the HITL approval stamp is present" |
| 6. Voice | **Voice Director** | Approved script | ElevenLabs Multilingual v2/v3 voiceover w/ cadence direction; Whisper diff for mispronunciations; pronunciation dictionary maintenance | `list_elevenlabs_voices`, `generate_voiceover`, `transcribe_audio`, `upload_to_r2`, `list_brand_assets`, `get_brand_asset`, `knowledge_lookup` | Final voice file + Whisper diff report | ✅ EXPLICIT |
| 7. Visuals | **Visual Producer** | Script's B-roll column | 90% Pexels/Pixabay, paid stock secondary, AI hero clips via fal.ai (Flux/Ideogram/Kling/Veo) | `web_search`, `knowledge_lookup`, `generate_image`, `generate_video`, `fal_check_generation`, `broll_search`, `upload_to_r2`, `list_brand_assets`, `get_brand_asset` | Shot list mapped to timestamps | ✅ EXPLICIT |
| 8. Thumbnail | **Thumbnail Designer** | Title + concept | 2-3 variants via Ideogram 3.0 / Flux 1.1 Pro; mobile-scale test; YouTube Test & Compare | `knowledge_lookup`, `generate_image`, `fal_check_generation`, `upload_to_r2`, `list_brand_assets`, `get_brand_asset` | 2-3 thumbnail files | ✅ EXPLICIT |
| 9. Assembly | **Assembly Engineer** | Voice + visuals + script | n8n + JSON2Video pipeline; per-video cost ledger | `knowledge_lookup`, `assemble_video`, `check_video_assembly`, `upload_to_r2`, `list_brand_assets`, `get_brand_asset` | Final MP4 in R2 | ✅ EXPLICIT to SEO & Publishing |
| 10-11. SEO + Publish | **SEO & Publishing Manager** | Final video | Metadata package, chapters, end screen, pinned comment; uploads via YouTube Data API v3 | `web_search`, `knowledge_lookup`, `youtube_upload_video`, `youtube_update_video_metadata`, `youtube_set_thumbnail`, `youtube_list_channel_videos`, `list_brand_assets`, `get_brand_asset` | Published video | ✅ EXPLICIT |
| 11b. Shorts cuts + Community | **Community & Shorts Manager** | Published flagship | 3-5 Shorts via YouTube native tool; Community campaign; top-10 comment replies | `send_email`, `knowledge_lookup`, `auto_clip_submit`, `auto_clip_check`, `youtube_list_channel_videos`, `youtube_post_community_update`, `fetch_video_transcript`, `log_video_clip`, `upload_to_r2` | Shorts cuts + Community calendar | ✅ EXPLICIT |
| 12. Analytics | **Analytics & Retention Lead** | YouTube Analytics data | 48h CTR/AVD audit, 30/60/90d benchmarks, 20-video checkpoint matrix | `web_search`, `knowledge_lookup`, `youtube_list_channel_videos`, `youtube_get_video_analytics` | Weekly KPI dashboard, retention cliffs flagged | ✅ EXPLICIT — feedback loops to Hook & Retention Editor |
| **Cross-cutting** | **Compliance & Rights Officer** | Every video pre-publish | HITL stamp verification, rights ledger, AI-disclosure matrix, strike windows | `web_search`, `knowledge_lookup`, `list_brand_assets`, `get_brand_asset`, `youtube_list_channel_videos` | Per-video sign-off, monthly audit | 🟡 IMPLICIT — gating mechanism not codified in workflow trigger |
| **Cross-cutting** | **Monetization & Funnel Manager** | Revenue data | 5-stream operations: AdSense + sponsorships + affiliates + SaaS funnel + channel-as-asset | `send_email`, `web_search`, `knowledge_lookup` | Sponsor pipeline, monthly revenue mix | OK |

### Break points

1. **Compliance "gating" is implicit** — Compliance & Rights Officer's role says it "verifies the HITL stamp on every pre-publish video" but the workflow `Publish + SEO Metadata` (`approvalMode: "approve_first"`) only routes to operator approval, not to Compliance review. **Compliance can't actually block a publish.** A non-cleared video can ship if operator clicks approve without Compliance having seen it.
2. **AI-disclosure toggle is not a tool** — Compliance has the 2026 decision matrix in its system prompt but no tool to actually flip the YouTube `selfDeclared` AI-content flag at upload time. SEO & Publishing Manager has `youtube_upload_video` but the system prompt for that tool (in `tool-registry.ts`) would need to expose `selfDeclaredMadeForKids` / similar AI-disclosure params for the agent to toggle correctly. **Need to verify the tool actually exposes these params.**
3. **Rights ledger lives in Notion/Airtable manually** — explicitly noted in Setup Checklist: *"Rights ledger tool (Notion/Airtable) — manual"*. Visual Producer's system prompt says "Log every asset in the rights ledger" but there's no rights-ledger tool, no DB table, no enforcement. Visual Producer can't actually log; it can only describe what should be logged. **The promise is a workflow that the operator runs externally.**
4. **Voice cloning happens externally** — ElevenLabs voice cloning isn't a tool; the operator clones their voice in the ElevenLabs dashboard and pastes the voice ID. Setup Checklist mentions a "dedicated avatar (one consistent face per channel is non-negotiable)" but there's no avatar-bible enforcement at tool-call time (same issue as `tiktok_shop`).
5. **Inter-agent coordination via "coordinate with X" pattern** — same as `tiktok_shop`. Specialists don't have `delegate_task`. Surfaced intent only.
6. **Sponsor outreach sending** — Monetization Manager drafts pitches but Setup Checklist says *"sending goes through Resend (if installed) OR direct platform DM (manual)"*. So even with Resend installed, agent has `send_email` tool — fine, but no template / sponsor-CRM data model. Each pitch is a one-off.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `stripe_mcp` | **Required** | When installed | ⚠ **Wrongly required** | Setup Checklist KB says it's for "SaaS funnel + digital product revenue." But streams 1 and 2 (AdSense + Sponsorships) are the dominant revenue streams. Operators who skip the SaaS funnel can't even create the business. **P0.** |
| `resend_mcp` | **Required** | When installed | ⚠ **Wrongly required** | "Newsletter + lead magnet delivery" is stream 4. Sponsor outreach falls back to Resend per setup checklist. **Better as suggested.** P0. |
| `social_media_mcp` | Suggested | When installed | ✅ Optional | Cross-posting Shorts to Reels/TikTok |
| `hubspot_mcp` | Suggested | When installed | ✅ Optional | Sponsor pipeline tracking |
| **YouTube Data v3** | Auto-attached for `YOUTUBE_API_TEMPLATES` (incl. `faceless_youtube`) | ✅ Configured | Wired | OAuth flow needed at platform level; setup checklist correctly calls this out |
| **YouTube Analytics** | Auto-attached | ✅ Configured | Wired | |
| **ElevenLabs** | Auto-attached for `VIDEO_PRODUCTION_TEMPLATES` | ✅ Configured | Wired + multiple agents have tools in their `tools[]` array | Voice Director: `list_elevenlabs_voices`, `generate_voiceover` |
| **fal.ai** | Auto-attached | ✅ Configured | Wired | Visual Producer + Thumbnail Designer have `generate_image`, `generate_video`, `fal_check_generation` |
| **JSON2Video** | Auto-attached | ✅ Configured | Wired | Assembly Engineer has `assemble_video`, `check_video_assembly` |
| **HeyGen** | Auto-attached | ✅ Configured | Wired but underutilized | Faceless youtube primarily uses voiceover-over-B-roll, not avatar talking-head. HeyGen is in tool registry but no agent's `tools[]` array references it explicitly. **System prompts don't mention HeyGen as a primary tool — Voice Director uses ElevenLabs.** Slight contradiction — HeyGen is auto-attached but the design doesn't actually use it. Acceptable but inconsistent. |
| **Creatify** | Auto-attached | ✅ Configured | Wired but underutilized | Same as HeyGen — auto-attached but not in this template's design |
| **B-Roll search** | Auto-attached | ✅ Configured | Wired | Visual Producer has `broll_search` |
| **Auto-Clip (Klap/Opus)** | Auto-attached | ✅ Configured | Wired | Community & Shorts Manager has `auto_clip_submit`, `auto_clip_check` |
| **Whisper** | Auto-attached | ✅ Configured | Wired | Voice Director has `transcribe_audio` |
| **R2 Storage** | Auto-attached | ✅ Configured | Wired | Multiple agents have `upload_to_r2` |
| **Pexels / Pixabay free stock** | Mentioned in system prompts | ❌ Not directly wired | ⚠ Implied via `broll_search` | The `broll_search` tool aggregates stock searches — likely covers Pexels/Pixabay via the internal aggregator, but tool schema doesn't expose source filtering |
| **Storyblocks / Artgrid** | Mentioned as "paid stock secondary" | ❌ Not wired | ⚠ Manual | Agent recommends, operator pulls externally |
| **Epidemic Sound** | Mentioned in setup checklist + Compliance | ❌ Not wired | ⚠ Manual | Music licensing tracker — manual |
| **n8n orchestration** | Mentioned by Assembly Engineer | ❌ Not wired in app | ⚠ External | Operator runs n8n separately. Setup Checklist KB mentions n8n Cloud €24-60/mo. |
| **Notion / Airtable rights ledger** | Mentioned | ❌ Not wired | ⚠ Manual | |
| **Sponsor outreach platforms (BrandConnect, Passionfroot, ThoughtLeaders)** | Mentioned by Monetization Manager | ❌ Not wired | ⚠ Manual | |
| LLM | `claude-sonnet-4.5` | ✅ Configured | Pinned | No fallback model |
| LLM-as-judge "hero-tier model" | Hook & Retention Editor system prompt says "Opus or hero-tier" | ⚠ Vague | Not pinned | `tools` array doesn't expose a separate model selector |

### 8-sub-check audit on the 5 wired integrations that actually run inside agent calls

| Check | YouTube Data v3 | YouTube Analytics | ElevenLabs | fal.ai | JSON2Video |
|---|---|---|---|---|---|
| Credential flow | OAuth via `/admin/integrations` ✅ | OAuth ✅ | API key in MCP definition (need to verify ❓) | API key | API key |
| Call construction | Tool schema declared ✅ | Tool schema ✅ | Tool schema ✅ | Tool schema ✅ | Tool schema ✅ |
| Rate limit awareness | ✅ Assembly Engineer system prompt explicitly references **"YouTube Data API v3 quota: 10,000 units/day default, video upload = 1,600 units = ~6 uploads/day per project max before requesting a quota increase. Multi-channel operators run separate Google Cloud projects per channel for isolation."** Best in library. | Same | ❌ Voice Director escalation rule says "ElevenLabs rate-limits or costs exceed plan by 25%" but no proactive pacing | ❌ | ❌ |
| Error handling | Per global no-retry rule, single failure surfaces | Same | ❌ Whisper diff catches mispronunciations but no re-roll on bad voiceover | ❌ No fallback if Flux down; operator has to manually pick Ideogram | ❌ No Shotstack/Creatomate fallback wiring |
| Cost ceiling | ✅ Per-video budget escalation at $10 per Assembly Engineer escalation rules | ✅ | ⚠ ElevenLabs 25% over plan triggers escalation; no hard cap | ❌ Visual Producer escalation: ">$50/video" — but no aggregate weekly/monthly | ❌ |
| Fallback path | Multi-Cloud-project pattern documented for quota | ✅ | ❌ ElevenLabs → OpenAI TTS / gpt-4o-mini-tts mentioned as "budget fallback" but not wired | ❌ "Avoid Sora 2 Pro" / "Midjourney has no API" docs but no auto-fallback chain | ❌ Shotstack/Creatomate as alternatives but no auto-fallback |
| Model/version pinning | API version pinned | API version pinned | ✅ Voice Director system prompt names Multilingual v2/v3 explicitly. Voice ID is operator-set. **Model version not enforced at tool-call time.** | ❌ "Flux 1.1 Pro", "Ideogram 3.0", "Kling 3.0", "Veo 3.1" named in system prompts but the `generate_image`/`generate_video` tools accept arbitrary models — agents pick at call time. **Drift risk when fal.ai retires versions.** | ❌ |

---

## C3. Media generation deep-check

### Image generation (Visual Producer + Thumbnail Designer)
- ✅ Prompts engineered for specific model? **Partial.** Visual Producer's system prompt says "Ideogram 3.0 wins for text-in-image accuracy; Flux 1.1 Pro is the photoreal workhorse" — model selection guidance is good. **But no per-model prompt-engineering examples** (Flux likes very different prompt syntax than Midjourney; Ideogram is text-friendly but needs explicit text directives).
- ✅ Aspect ratio specified? Thumbnail Designer's system prompt mentions 168×94 mobile scale (10% of 1280×720) but doesn't explicitly require aspect_ratio param in `generate_image` calls. **Risk: agent picks default (1:1) when 16:9 is needed.**
- ❌ Quality/consistency check before downstream? **Same gap as `tiktok_shop`.** AI avatar bible exists in `CHANNEL_IDENTITY_BIBLE.md` but no tool-call-time enforcement.
- ⚠ Negative prompts? Not mentioned in any system prompt.
- ✅ Text rendering by appropriate model? Ideogram 3.0 explicitly named for text-heavy thumbnails ✅
- ⚠ Brand consistency across batches? Bible exists but not enforced.

### Video generation (Visual Producer)
- ✅ Prompt structured for platform? Visual Producer's system prompt names "Kling 3.0 ($0.029-$0.10/sec) is best-value; Veo 3.1 ($0.40/sec w/ audio) for hero clips; avoid Sora 2 Pro ($0.30-$0.50/sec) for cost reasons; Midjourney no API."
- ✅ Duration / aspect ratio / FPS? Implied — operator sets per-call. Not enforced.
- ⚠ Storyboard / shot list? Yes — Script Writer outputs B-roll column with timestamps, Visual Producer pulls from it. Decent.
- ❌ Multi-shot continuity? Each `generate_video` call independent. **Same character / lighting NOT enforced across hero clips.** Severe issue for documentary aesthetic.
- ✅ Stitching/editing step? Assembly Engineer (JSON2Video). **Strong.**

### Voice / TTS (Voice Director)
- ✅ Voice ID consistent? Voice Director system prompt: "ONE voice this channel uses forever." **Best in library.** But still no enforcement at tool-call time — relies on agent discipline.
- ❌ Voice settings tuned? Not mentioned.
- ⚠ Long-form chunking? `generate_voiceover` tool may or may not chunk — unclear from system prompt.
- ✅ Re-roll on bad generation? Whisper diff identifies mispronunciations and triggers full re-run when 3+ errors detected. **Partial.** Single mispronunciations don't trigger re-roll automatically.

### Music
- ❌ Not in scope. Setup checklist points to Epidemic Sound external. Acceptable — music gen would be wrong fit for documentary content.

### Avatar / UGC video
- ❌ Not in scope for faceless YouTube documentary format. HeyGen is auto-attached but unused. **Should be removed from this template's tool set, or system prompts should explicitly mention "HeyGen avatar mode is available for fast-cut talking-head segments."** Currently dead weight in the agent's decision space.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $697? |
|---|---|---|---|---|---|
| **Outlier Database (Niche & Packaging Strategist)** | High | High | High | High | ✅ Yes |
| **Research Brief (Research Analyst)** | High — sourced + injection slots | High | High | High | ✅ Yes |
| **Retention-engineered Script (Script Writer + Hook Editor)** | High — LLM-as-judge cascade is strong | High | High pre-HITL — Channel Identity Bible enforces voice | High | ✅ Yes |
| **Voiceover w/ Whisper diff (Voice Director)** | High | High | High when voice ID set | High | ✅ Yes |
| **Visual asset shot list (Visual Producer)** | High | Medium — depends on AI gen consistency across calls | LOW — multi-shot continuity not enforced | Medium | ⚠ Borderline |
| **2-3 Thumbnail variants (Thumbnail Designer)** | High | High | High | High | ✅ Yes |
| **Assembled video (Assembly Engineer)** | High when JSON2Video pipeline works | High | High | High | ✅ Yes |
| **Metadata package (SEO & Publishing)** | High | High | High | High | ✅ Yes |
| **Shorts cuts + Community campaign** | High | High | High | High | ✅ Yes |
| **48h CTR/AVD Audit** | High | High | High | High | ✅ Yes |
| **20-Video Checkpoint Decision** | High | High | High | High — operator gets clear pivot/stay matrix | ✅ Yes |
| **Sponsor pitch (Monetization Manager)** | Medium — drafted but no template / CRM | Medium | High | Medium — manual send | ⚠ Borderline |
| **Rights ledger entry** | Cannot deliver — no tool | N/A | N/A | LOW — manual | ❌ Fail |

**Two outputs fail or are borderline:** Visual asset multi-shot continuity (drift risk same as tiktok_shop), and the rights ledger (operator does it manually). Sponsor pitch is borderline because no CRM data model means each is a one-off.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | YouTube OAuth token expires | `youtube_upload_video` returns 401 → no retry → operator sees error. **OAuth refresh persistence is in place per the help KB ("OAuth refresh persistence for YouTube — access tokens cached in encryptedSecrets, auto-refreshed per call")** ✅ | OK |
| 2 | fal.ai down | Visual Producer's `generate_image` / `generate_video` fail → no Ideogram → Flux → Stable Diffusion fallback chain → batch stalls | **P1** |
| 3 | Customer pastes garbage research data into brief | Research Analyst processes whatever — but the LLM-as-judge cascade in Hook & Retention Editor catches some hallucination. **Partial coverage. Doesn't catch upstream factual errors in the brief itself.** | P1 |
| 4 | Content moderation blocks fal.ai gen (e.g. trademark in prompt) | Single failure surfaces, no fallback | **P1** |
| 5 | 3am unsupervised run | Pipeline halts at HITL gate (`Script Draft + HITL Approval Gate` is `approve_first`) — won't run voiceover. **This is the correct behavior.** ✅ | OK |
| 6 | Customer runs Pipeline Run twice | `assemble_video` + `youtube_upload_video` would create duplicates if not gated. Setup Checklist says "Keep YouTube uploads PRIVATE by default — the youtube_upload_video tool enforces this. Human review before public flip is the safety pattern." **Trust this. Need to verify in tool schema.** | P2 — need verify |
| 7 | Scale 1 → 30 videos/month | Per-video cost is well-modeled (~$3-6.50). 30 videos = $100-200/mo variable. **YouTube API quota: 6 uploads/day max per Cloud project.** Multi-channel operators need separate projects. **Acceptable but the YouTube API quota becomes the binding constraint at 7+ videos/day.** | OK at typical cadence |
| 8 | ElevenLabs 429 | Voice Director escalation rule triggers but no automatic OpenAI TTS fallback | **P1** |

---

## C6. Premium polish

| Aspect | State | Issue |
|---|---|---|
| **Onboarding** | Setup Checklist KB is dense + accurate. Channel Identity Bible doc seeds the operator's first task. | ✅ Strong. Best-in-library tied with `tiktok_shop`. |
| **Defaults** | `safetyMode: "ask_before_acting"`, `primaryModel: "anthropic/claude-sonnet-4.5"` | ✅ Reasonable. **No fallback model** (same as `tiktok_shop`). |
| **Documentation** | Agent purposes vivid, specific. **Best agent voices in library.** | ✅ Premium |
| **Voice** | Editorially sharp, cinematic. Refuses generic. Brand voice is part of the design (`brandVoice` field). | ✅ Premium |
| **Progress visibility** | Multiple workflows are `approve_first` (Script Draft + HITL, Publish + SEO, 20-Video Checkpoint, Sponsor Outreach, Secondary Channel) — operator sees at every gate | ✅ Strong gating |
| **Handoff moments** | HITL gate is the single most explicit handoff in the library. Other handoffs are explicit per agent system prompts. | ✅ Strong |
| **The 90% rule** | This template is closer to ~75% autonomous. Operator must: clone voice in ElevenLabs, fill Channel Identity Bible, perform HITL injection, set up rights ledger in Notion, configure n8n if used. **Compared to a "press play and channel runs" promise — under-delivers slightly.** | ⚠ The HITL gate is intentional and a feature, not a bug. **But the rights ledger and n8n requirements should be more loudly surfaced** so the operator doesn't get frustrated 3 days in. |
| **Branded competitor reference** | Assembly Engineer system prompt at line 5802: *"Emergent.sh is perfect for the control plane (admin dashboard, HITL review inbox, cost ledger, analytics dashboard) but WRONG for pipeline orchestration — credit burn on iterative 12-step chains is brutal. Delegate orchestration to n8n, let Emergent own UI + CRUD, connect via webhooks."* | ⚠ Mentions a competitor (Emergent) by name. Reads like a guru-marketing aside. **In a $697 SKU, this register may feel less premium.** Either remove or rephrase as "the orchestration plane (typically n8n / Make / Temporal) is separate from the UI/CRUD plane (typically the host app — in your case, Ghost ProtoClaw)." P2. |

---

## C7. Cost efficiency

The Assembly Engineer system prompt itself is a cost ledger. **Best in library on this dimension.**

Per-video cost (Assembly Engineer):
```
Research $0.05 + Script $0.04 + Thumbnails $0.24 + B-Roll $0.60
+ AI Video clips $0.45 + ElevenLabs voiceover $0.90
+ JSON2Video assembly $0.80 = ~$3.00–$3.50 variable
```
Plus ~$200/month fixed (ElevenLabs $22 + Epidemic Sound $49 + n8n €60 + JSON2Video $50 + Emergent $20).

**At 30 videos/month all-in: ~$6.50/video. At 100/month: ~$5/video.** Healthy.

Per-week LLM costs (estimate):
- Outlier mining: ~5K tokens × $0.075 = ~$0.075
- Research brief × 2 videos/week = ~30K tokens = ~$0.45
- Script drafts × 2 = ~80K tokens (long scripts + LLM-as-judge cascade) = ~$1.20
- Hook editing × 2 = ~30K = ~$0.45
- SEO metadata × 2 = ~10K = ~$0.15
- Analytics dashboards weekly = ~10K = ~$0.15
- Compliance audits monthly = ~$0.30/mo

**Total LLM weekly: ~$2.50.** Cheap.

**Cost guardrails present:** ✅ Per-video cost ceiling escalation at $10. Visual Producer escalates AI-video budget at $50/video. Voice Director escalates at 25% over plan.

**Cost guardrails missing:** ❌ No aggregate weekly/monthly cap. If 30 videos all hit $9 (just below per-video escalation), that's $270/week + $200/month fixed = $1,280/month — probably acceptable but not visible to operator until billing arrives. **Need a "monthly burn" dashboard widget.**

**Tool-cost tier-down:** Visual Producer uses Flux schnell for non-flagship videos? Not specified. **Could save 50%+** by tier-down logic in system prompt.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: Stripe + Resend wrongly required
**What:** [`requiredIntegrations: ["stripe_mcp", "resend_mcp"]` at line 5598](lib/templates/business-templates.ts:5598). The five-stream stack lists AdSense + Sponsorships as streams 1 and 2 (the dominant ones). Stripe is for stream 4 (digital products / SaaS funnel). Resend is for stream 4 nurture + sponsor outreach.

**Why it matters:** Priority 1 (Functional) + Priority 5 (Premium polish). An operator who wants to build an AdSense-heavy AI-finance channel cannot create the business without Stripe + Resend keys. Same flaw `tiktok_shop` had pre-rebuild. Fix is identical pattern.

**Fix:** Move `stripe_mcp` and `resend_mcp` to `suggestedIntegrations`. Update Setup Checklist KB to mark them as conditional ("install when you ship stream 4 — the SaaS funnel"). Optionally add an Organic Ladder-style addon for the SaaS funnel layer (keeps the current promise valid for operators who want it).

```diff
- requiredIntegrations: ["stripe_mcp", "resend_mcp"],
- suggestedIntegrations: ["social_media_mcp", "hubspot_mcp"],
+ requiredIntegrations: [],
+ suggestedIntegrations: ["social_media_mcp", "hubspot_mcp", "stripe_mcp", "resend_mcp"],
```

And in the Setup Checklist's `requiredMcps`, reframe:

```diff
  requiredMcps: [
-    {
-      label: "Stripe (SaaS funnel + digital product revenue)",
-      why: "..."
-    },
-    {
-      label: "Resend (newsletter + lead magnet delivery)",
-      why: "..."
-    }
+    // The faceless-YouTube core needs only YouTube OAuth + the video stack
+    // (auto-wired). Stripe + Resend become required only when the operator
+    // ships the SaaS funnel (stream 4 of the 5-stream stack).
  ],
```

### P0-2: Compliance Officer cannot block publishes
**What:** Compliance & Rights Officer's role description says it gates every pre-publish video. But the `Publish + SEO Metadata` workflow is `approve_first` — only the operator approves. There's no Compliance approval step. **A non-cleared video can ship if the operator clicks approve without Compliance having seen it.**

**Why it matters:** Priority 1 (Functional) + Priority 4 (Error handling). 90% of the value of the Compliance officer is preventing strikes. If it can't actually gate, it's documentation theater.

**Fix:** Add a workflow `Pre-Publish Compliance Sign-Off` between `Video Assembly Pipeline Run` and `Publish + SEO Metadata` with `approvalMode: "approve_first"` and `agentRole: "Compliance"`. Compliance signs off → operator sees Compliance's check + their own approve gate. Two gates = real control.

```typescript
{
  name: "Pre-Publish Compliance Sign-Off",
  description:
    "Compliance & Rights Officer reviews every video pre-publish: HITL stamp present, rights ledger complete for all assets in this video, AI disclosure decision matrix applied, Community Guidelines + Copyright strike windows clean, no restricted-claim language. Produces a per-video sign-off (PASS/FAIL with specific findings). Blocks publish on FAIL.",
  trigger: "manual",
  output: "report",
  approvalMode: "approve_first",
  agentRole: "Compliance"
}
```

### P0-3: `youtube_upload_video` AI-disclosure flag may not be exposed
**What:** Compliance Officer has the AI-disclosure decision matrix in its system prompt but no tool to actually toggle the YouTube `selfDeclared` AI-content flag. SEO & Publishing Manager owns `youtube_upload_video` — but the tool schema needs to expose `selfDeclaredMadeForKids` / AI-disclosure params for the agent to set them correctly.

**Why it matters:** Priority 1 (Functional). YouTube's 2026 AI disclosure enforcement is real and severe. If the agent uploads without the disclosure flag set, customer takes the strike.

**Fix:** Verify `youtube_upload_video` tool schema in `tool-registry.ts` accepts AI-disclosure params (something like `madeForKids`, `containsSyntheticMedia`, `aiDisclosure`). If not, add them. Then update SEO & Publishing Manager's role instructions: *"Before any upload, knowledge_lookup the AI Disclosure Decision Matrix KB item, evaluate this video's AI usage against the matrix, and pass the appropriate aiDisclosure flag to youtube_upload_video. If matrix evaluation is ambiguous, escalate to Compliance Officer before upload."*

(I haven't verified the current YouTube upload tool schema — flagging as P0 to verify.)

### P0-4: System prompts don't enumerate the actual tool runtime (same pattern as `tiktok_shop`)
**What:** While this template's agents have decent `tools[]` arrays compared to `tiktok_shop`, they still don't list **all** the tools available at runtime (BUILTIN_ALWAYS_ON adds 20+; the video stack adds 15+; YouTube tools auto-attach for this template).

**Fix:** Same pattern as P0-4 in `tiktok_shop` — append a "TOOLS YOU HAVE ACCESS TO" block to each agent's system prompt enumerating the runtime tool set.

---

## C9. P1 issues (quality)

### P1-1: No model fallback for `claude-sonnet-4.5`
Same as `tiktok_shop`. Fix: add `fallbackModel`.

### P1-2: fal.ai model versions named in system prompts but not pinned at tool-call level
**What:** Visual Producer system prompt names "Flux 1.1 Pro," "Ideogram 3.0," "Kling 3.0," "Veo 3.1." When fal.ai retires Flux 1.1 Pro for Flux 2.0, the system prompt is suddenly wrong. Templates ship to customers; customers don't read system prompts.

**Fix:** Move model names to a single "fal.ai Model Pinning" KB item with versions + costs + use cases. Reference the KB item from system prompts via `knowledge_lookup` instead of hardcoded names. When you upgrade, you edit one KB item, not 4 system prompts.

### P1-3: Multi-shot continuity not enforced
Same as `tiktok_shop`. Fix: Visual Producer system prompt should `knowledge_lookup CHANNEL_IDENTITY_BIBLE.md` before every `generate_video`/`generate_image` call and pass the visual style ref as a param.

### P1-4: Compliance has no way to actually flag AI-disclosure for SEO Manager
Coordinate-with-X pattern. Fix: when Compliance needs to set the AI-disclosure flag on a specific video, surface it as a memo to Studio Head + SEO Manager via `delegate_task` (Compliance is a leader? Actually — only the Studio Head is type "main" with depth=0. Compliance is a specialist. **No `delegate_task` available.**) → real fix: Compliance produces a per-video sign-off doc (workflow above) that SEO Manager `knowledge_lookup`s before upload.

### P1-5: HeyGen + Creatify are auto-attached but unused in this template's design
**What:** `VIDEO_PRODUCTION_TEMPLATES` adds HeyGen + Creatify to every faceless_youtube agent's tool registry. But the design (voiceover-over-B-roll documentary) doesn't use them. **Pollutes the agent's decision space.**

**Fix:** Either (a) explicitly exclude `faceless_youtube` from the HeyGen/Creatify portion of `VIDEO_PRODUCTION_TEMPLATES` (requires per-tool gating in `getToolsForAgent`), or (b) update Visual Producer system prompt: *"HeyGen avatar mode is available for fast-cut talking-head segments if you choose to add them — default for this channel is voiceover-over-B-roll."* Option (b) is cheaper.

### P1-6: Sponsor outreach has no CRM model
Each sponsor pitch is a one-off `send_email`. No deal-stage tracking. HubSpot is suggested but optional.

**Fix:** Add a `SPONSOR_PIPELINE.md` workspace doc (similar to `SHOP_HEALTH.md` pattern) with structured deal stages. Update Monetization Manager system prompt to maintain it. Or wire Notion / Airtable as a suggested integration.

### P1-7: 18 workflows but only 1 ties to Compliance
Compliance & Rights Officer owns the `Rights Ledger & Compliance Audit` (monthly). **Pre-publish per-video review isn't in the workflow list.** The `Pre-Publish Compliance Sign-Off` workflow proposed in P0-2 fixes this.

---

## C10. P2 issues (polish)

### P2-1: Emergent.sh competitor reference
[Line 5802](lib/templates/business-templates.ts:5802). Rephrase to platform-neutral.

### P2-2: 20-Video Checkpoint discipline lives in Studio Head + Analytics agents — but the workflow itself is `approve_first` manual
Consider auto-triggering at Video 18 published so the operator has time to consider before the actual checkpoint date.

### P2-3: Sponsor outreach `approvalMode: "approve_first"` 
This is correct (sponsor pitches need operator review) but at 10 outbound briefs/week, the operator is reviewing 40 a month. Consider batching into a weekly approval-pack.

### P2-4: No demo data on materialization
Like `tiktok_shop`, no demo data. Could pre-seed an outlier database or sample brief.

### P2-5: Sponsor sensitive-categories list is hardcoded in Studio Head escalation rules
"Health, finance, politics, gambling, dating, supplements, dating" — this list should live in a KB item the operator can extend per-niche.

---

## Summary fix-time for `faceless_youtube`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | Stripe/Resend demote, Compliance pre-publish gate, AI disclosure flag verification, system-prompt tool enumeration | **4 hours** |
| P1 (7) | model fallback, fal.ai version pinning, multi-shot continuity enforcement, Compliance routing, HeyGen prompt cleanup, sponsor CRM model, compliance workflow trigger | **3 hours** |
| P2 (5) | Emergent rephrase, checkpoint auto-trigger, sponsor batching, demo data, sensitive-categories KB | **1 hour** |

**Total to S-tier: ~8 hours.** This is a strong template — most fixes are surface contract gaps, not structural rewrites. The HITL gate, the cost ledger, and the engineered tool wiring are best-in-library and should be the model the rest of the library follows.

---

**Next message: Section C for `dealhawk_empire` (rank #3 SHIP-tier).** Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/3 — dealhawk_empire  (transcript line 775, 30123 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `dealhawk_empire`.

---

# SECTION C — TEMPLATE 3/19: `dealhawk_empire` (Dealhawk Empire)

**Verdict:** **SHIP** with focused fixes (~1 day to S-tier).
**Headline:** Most engineered template in the library on the *domain-tooling* axis. **17 purpose-built `dealhawk_*` tools** wired to specific agents. **Demo data seeds 15 deals across 3 metros on materialization** (only template that does this — best onboarding feel). **Triple-tier dealMode gate** (research / outreach / contract) is the strongest gating mechanism in the library. **Attorney-on-file data model** for state-by-state regulatory compliance. **Brand voice is genuinely premium** — empathy-first, refuses "we buy houses" language. The remaining issues are mostly around the telephony triad ambiguity, missing outreach spend ceiling, and a few `approvalMode: "auto"` workflows that need a closer look.

## C1. Functional walkthrough — single-deal happy path (research → outreach → contract)

The dealMode gate is the most important architectural choice. Every agent system prompt enforces it. Tracing one deal from sourcing to disposition:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Research mode** | | | | | | |
| Sourcing | **MLS Stale Listing Hunter** | Operator's target zip codes | Daily MLS pull, motivation-score 1–100 | `web_search`, `dealhawk_search_properties`, `dealhawk_score_lead`, `dealhawk_create_deal` | Deal cards w/ motivation score | ✅ EXPLICIT to Distress Signal Analyst |
| Sourcing | **Off-Market Scraper** | Same target zips | Pulls Craigslist/FB Marketplace/FSBO/auctions/probate | `web_search`, `dealhawk_score_lead`, `dealhawk_create_deal` | Deduped lead list | ✅ EXPLICIT |
| Sourcing | **Distress Signal Analyst** | Property addresses from sourcing | 1–100 motivation score from stacked public-record signals | `web_search`, `dealhawk_score_lead`, `dealhawk_create_deal`, `dealhawk_skip_trace` | Strict-JSON `{score, signals[], recommended_exit}` | ✅ EXPLICIT |
| Sourcing | **Absentee Owner Identifier** | County tax records | Tax-assessor-vs-property-address comparison | `web_search`, `dealhawk_search_properties`, `dealhawk_create_deal` | Tagged absentee list | ✅ EXPLICIT (must route through Distress Signal) |
| Underwriting | **Comp Analyst** | Subject property | 3–6 sold comps, ARV low/mid/high, rent estimate, **all four MAOs (wholesale / BRRRR / flip / Sub-To)** | `dealhawk_compute_mao`, `dealhawk_update_deal` | Full deal sheet | ✅ EXPLICIT |
| Underwriting | **Sub-To Qualifier** | Cooperative-seller deal w/ loan data | DOS risk notes, sub_to_score, recommended structure, **load-bearing attorney disclaimer** | `dealhawk_qualify_sub_to`, `dealhawk_update_deal` | Sub-To memo | ✅ EXPLICIT |
| Underwriting | **Repair Cost Estimator** | Listing photos + property age | Light/Medium/Heavy rehab ranges with line-items | `dealhawk_update_deal` | Rehab estimate | ✅ EXPLICIT (feeds Comp Analyst) |
| Pipeline coordination | **Deal Ops Lead** | All agent outputs | Daily Deal Digest at 7am: top-10 ranked w/ four-MAO underwriting | All 17 dealhawk tools + delegate_task (BUILTIN) | Morning briefing | ✅ |
| **Outreach mode** (gated by dealMode + TCPA attestation) | | | | | | |
| Outreach | **Seller Outreach Agent** | Scored lead ≥ 40/100, seller distress-signal type | Channel-tuned outreach (NOD-blind for pre-foreclosure, pain-led for tired landlords, rapport-first for probate) | `send_email`, `send_sms`, `dealhawk_draft_outreach`, `dealhawk_log_touch`, `dealhawk_schedule_followup` | Channel-appropriate outreach drafts | 🔴 BREAK — see below |
| Outreach | **Follow-Up Sequencer** | Lead in outreach state | 90-day drip across mail/SMS/email/voicemail with angle rotation | `send_email`, `send_sms`, `dealhawk_draft_outreach`, `dealhawk_log_touch`, `dealhawk_schedule_followup` | Scheduled-touch queue | ✅ |
| Outreach | **Objection Handler** | Operator pastes seller quote | 3-part response coaching: underlying concern, primary line ≤25 words, backup line | `dealhawk_coach_objection`, `dealhawk_log_touch` | Real-time call coaching | ✅ |
| **Contract mode** (gated by dealMode + AttorneyOnFile) | | | | | | |
| Disposition | **Buyer List Builder** | Cash-sale records by zip | Sorted A-list by buy-box (flip / BRRRR / section-8 / high-end) | `web_search`, `dealhawk_add_buyer`, `dealhawk_list_buyers` | Sorted buyer list | ✅ |
| Disposition | **Disposition Agent** | Locked contract | Deal package, A-list blast (email + SMS), manual-post copy block, **state-specific disclosure auto-inserted** | `send_email`, `send_sms`, `dealhawk_match_buyers`, `dealhawk_build_deal_package`, `dealhawk_list_buyers` | DIRECT BLAST + MANUAL POST blocks | ✅ |
| Disposition | **Creative Finance Architect** | Deals where wholesale MAO negative or Sub-To grand-slam | Match seller to structure (Sub-To / wrap / novation / lease-option / contract-for-deed), risk memo, contract checklist | `dealhawk_qualify_sub_to`, `dealhawk_design_creative_structure`, `dealhawk_update_deal` | Creative-finance memo | ✅ |
| Compliance (cross-cutting) | (No dedicated Compliance agent — compliance is **distributed** across the dealMode gate, attorneyOnFile model, and the Sub-To Qualifier's hardcoded disclaimer) | | | | | |

### Break points

1. **Seller Outreach Agent's "TCPA attestation" gate is referenced but not modeled** — the system prompt says outreach refuses to generate in `research` mode (good — enforced via dealMode). It says outreach mode requires TCPA attestation. **But there's no `tcpaAttestedAt` data field check anywhere in the system prompt — only in `BusinessDetailTabs.tsx` line 183 (`tcpaAttestedAt`). The agent doesn't actually check if the field is set.** It's enforced at the UI layer, not at agent-call time.

2. **`dealhawk_skip_trace` backend ambiguous** — Distress Signal Analyst calls `dealhawk_skip_trace`. Setup checklist names BatchSkip / REsimpli / TLOxp as options. **The tool itself doesn't show which provider it routes to.** Operator credentials → which backend? Need to verify in tool implementation.

3. **Off-Market Scraper TOS risk** — system prompt says *"if a platform requires login or API key, you stop and flag the integration gap to the operator"* — good — but `web_search` against Craigslist / FB Marketplace at scale will likely violate TOS. **No anti-throttling rule. No fallback to paid scraping providers (Apify, etc.).**

4. **Distress Signal Sweep workflow is `approvalMode: "auto"`** — autonomous daily NOD/tax-delinquency/probate/code-violation pull + score. ✅ Acceptable for read-only data ingestion. **No outbound action implied.** OK.

5. **Code Violation Tracker workflow is `approvalMode: "auto"`** — same OK.

6. **Buyer List Refresh workflow is `approvalMode: "auto"`** — monthly buyer-list refresh from public records. Read-only. OK.

7. **Daily Deal Digest is `review_after`** — fires at 7am with no operator. **At 3am unsupervised, it'll run autonomously and queue results for review when operator wakes.** Acceptable — but no Telegram/email notification mechanism, so operator might miss it.

8. **Disposition Blast is `approve_first` AND requires dealMode=contract AND attorneyOnFile** — best-gated workflow in the library. ✅

9. **Inter-agent coordination via Deal Ops Lead** — Deal Ops Lead is `type: main` so has `delegate_task` from BUILTIN. **Specialists in DEALHAWK_AGENTS don't have `delegate_task` either** — they all surface intent through the Deal Ops Lead. Pattern is consistent with other templates but works better here because there IS an explicit coordinator.

10. **State Compliance Matrix workspace doc not enforced at tool-call time** — Disposition Agent's system prompt says *"You insert the state-specific wholesaler disclosure for the property's state from the knowledge base (see State Compliance Matrix)"* but doesn't explicitly call `knowledge_lookup` against `STATE_COMPLIANCE_MATRIX.md` before each blast. Relies on agent discipline. 🟡

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `whatsapp_cloud_mcp` | Suggested | When installed | ✅ Optional | Telephony alternative #1 |
| `twilio_mcp` | Suggested | When installed | ✅ Optional | Setup Checklist correctly identifies Twilio as the SMS path + A2P 10DLC requirement. **But no opinion in the template — Twilio vs Telnyx vs WhatsApp is left to operator.** |
| `telnyx_mcp` | Suggested | When installed | ✅ Optional | Telephony alternative #3 |
| `resend_mcp` | Suggested | When installed | ✅ Optional | Letters + buyer-list distribution + attorney coordination |
| `hubspot_mcp` | Suggested | When installed | ✅ Optional | Visible Kanban CRM alternative to Dealhawk's own Prisma tables |
| **17 dealhawk_* custom tools** | Built into platform | ✅ Configured | Wired | Each agent has a tightly scoped whitelist. **Best in library on this dimension.** |
| `dealhawk_search_properties` | Built-in | ✅ | Wired | Used by Deal Ops Lead, MLS Hunter, Off-Market Scraper, Distress Signal Analyst, Absentee Owner Identifier |
| `dealhawk_create_deal` | Built-in | ✅ | Wired | Same |
| `dealhawk_score_lead` | Built-in | ✅ | Wired | Distress Signal Analyst owns this |
| `dealhawk_compute_mao` | Built-in | ✅ | Wired | Comp Analyst |
| `dealhawk_qualify_sub_to` | Built-in | ✅ | Wired | Sub-To Qualifier + Creative Finance Architect |
| `dealhawk_update_deal` | Built-in | ✅ | Wired | Multiple agents |
| `dealhawk_draft_outreach` | Built-in | ✅ | Wired | Seller Outreach + Follow-Up Sequencer + Deal Ops Lead. **Drafts only — sending requires Twilio/Resend.** |
| `dealhawk_log_touch` | Built-in | ✅ | Wired | Outreach agents |
| `dealhawk_coach_objection` | Built-in | ✅ | Wired | Objection Handler |
| `dealhawk_schedule_followup` | Built-in | ✅ | Wired | Follow-Up Sequencer + Seller Outreach |
| `dealhawk_add_buyer`, `dealhawk_list_buyers`, `dealhawk_match_buyers` | Built-in | ✅ | Wired | Buyer List Builder + Disposition Agent |
| `dealhawk_build_deal_package` | Built-in | ✅ | Wired | Disposition Agent |
| `dealhawk_design_creative_structure` | Built-in | ✅ | Wired | Creative Finance Architect |
| `dealhawk_compliance_check` | Built-in | ✅ | Wired | Deal Ops Lead. **Note:** only Deal Ops Lead has this tool. Specialists rely on hard-coded disclaimers in system prompts. |
| `dealhawk_skip_trace` | Built-in | ✅ Wired | ⚠ Backend ambiguous | Distress Signal Analyst. Setup checklist mentions BatchSkip / REsimpli / TLOxp — which one does the platform call? **Not surfaced in template.** |
| **Demo data seeding** | `seedDealhawkDemoData(tx, businessId, organizationId)` at materialization | ✅ Configured | **Best-in-library onboarding feel** | 15 demo deals × 3 Sun Belt metros |
| County data providers (PropStream / BatchData / ListSource) | Mentioned in system prompts + setup checklist | ❌ Not wired | ⚠ Manual | Buyer List Builder explicitly falls back to `web_search` |
| MLS / Zillow / Redfin direct feeds | Mentioned | ❌ Not wired | ⚠ Manual | MLS Stale Listing Hunter uses `web_search` |
| Mail house (Yellow Letter HQ / Open Letter Marketing / BallPoint) | Mentioned | ❌ Not wired | ⚠ Manual | Cold Letter Generator drops to mail-house queue manually |
| Facebook groups / BiggerPockets / forum posting | Mentioned | ❌ Not wired | ⚠ Manual | Acknowledged in setup checklist; output explicitly labeled "MANUAL POST (copy + paste)" |
| LLM | `claude-sonnet-4.5` | ✅ Pinned | No fallback model |

### Per-integration audit (for the 5 most-used dealhawk_* tools)

| Check | dealhawk_score_lead | dealhawk_compute_mao | dealhawk_qualify_sub_to | dealhawk_draft_outreach | dealhawk_skip_trace |
|---|---|---|---|---|---|
| Credential flow | Internal (no API key) ✅ | Internal ✅ | Internal ✅ | Internal ✅ + per-channel sender (Twilio/Resend) | ⚠ Backend provider ambiguous |
| Call construction | Tool schema declared in tool-registry.ts | ✅ | ✅ | ✅ | ✅ |
| Rate limit awareness | N/A internal | N/A | N/A | ❌ Twilio rate limits not mentioned in agent system prompts | ❌ Skip-trace cost per lookup ($0.05–$0.50) — no quota |
| Error handling | Per global no-retry rule | ✅ | ✅ | ❌ Single failure surfaces; no fallback channel | ❌ |
| Cost ceiling | N/A | N/A | N/A | ❌ **Critical gap — see P0** | ❌ Skip-trace can burn $50/day on 100 leads × $0.50 |
| Fallback path | N/A | N/A | N/A | ❌ Twilio → Telnyx fallback not designed despite both being suggested | ❌ |
| Model/version pinning | N/A | N/A | N/A | LLM-driven copy; uses claude-sonnet-4.5 | N/A |

---

## C3. Media generation deep-check

**Not applicable.** No image/video/voice/music generation in this template. Visual material is photos pulled from listing data + property addresses. No AI media gen wiring. ✅ Correctly scoped — adding media gen would bloat without adding value.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $997? |
|---|---|---|---|---|---|
| **Daily Deal Digest** | High — top-10 with four-MAO + winning structure | High — citable comps, score sources | High | High — operator's morning operating doc | ✅ Yes |
| **Distress Signal JSON** | High — strict schema with citations | High — public-record sources required | High | High — feeds downstream agents | ✅ Yes |
| **Comp Analyst deal sheet** | High — ranges not points | High — comp addresses + dates | High | High | ✅ Yes |
| **Sub-To memo** | High — JSON + load-bearing disclaimer | High | High | High — paste-ready | ✅ Yes |
| **Repair Cost Estimator (Light/Medium/Heavy)** | High — line items, ranges, photo flags | High | High | High | ✅ Yes |
| **Seller outreach drafts (channel-tuned)** | High — empathy-first, NOD-blind | High — distress-signal-tuned | High — premium voice | High | ✅ Yes |
| **Follow-Up Sequencer queue** | High | High — angle rotation | High | High | ✅ Yes |
| **Objection Handler 3-part response** | High — primary line ≤25 words constraint is good | High | High | High | ✅ Yes |
| **Buyer List (sorted by zip × buy-box)** | High when paid data wired; Medium with `web_search` fallback | Medium — buy-box quality depends on data source | High | High | ⚠ Borderline — `web_search` fallback for buyer intel won't scale past Day 30 |
| **Disposition deal package + state disclosure** | High — direct blast + manual post blocks separated | High | High — equitable-interest language load-bearing | High — operator can copy-paste manual post immediately | ✅ Yes |
| **Creative Finance memo (Sub-To / wrap / novation / lease-option)** | High — risk memo, contracts list, attorney disclaimer | High | High | High | ✅ Yes |
| **LOI Generator output** | High | High | High | High | ✅ Yes |
| **Offer Letter cover letter** | High — empathy-first, anti-pressure | High | High | High | ✅ Yes |
| **State Compliance Matrix workspace doc** | High — table format, statute references | High | High | High | ✅ Yes |
| **Weekly Pipeline Report** | High | High | High | High | ✅ Yes |
| **Weekly Market Heat Map** | High | High | High | High | ✅ Yes |

**No outputs fail the "would I pay $997" test.** Buyer List quality with `web_search` fallback is borderline at scale — but acceptable until volume forces paid-data adoption. **Best output quality across the library.**

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Customer's Twilio key invalid | `dealhawk_draft_outreach` may still draft; `send_sms` fails when sending. Outreach queue stalls. **Setup checklist correctly calls out A2P 10DLC requirement**, so this is operator-side fixable. | OK |
| 2 | A `dealhawk_*` tool errors (e.g. internal Prisma failure) | Per global no-retry rule, single failure surfaces. **Better than other templates because the dealhawk_* tools are first-party — your team controls reliability.** | OK |
| 3 | Customer pastes wrong loan balance into Sub-To Qualifier | Qualifier produces wrong cashflow + recommends wrong structure. **No validation — `dealhawk_qualify_sub_to` accepts whatever input.** Operator might sign Sub-To on bad math. | **P1** |
| 4 | Content moderation blocks a draft (e.g. seller outreach mentions "foreclosure") | Probably won't happen — agent system prompts forbid NOD reference. **But no test/validation on output.** | P1 |
| 5 | 3am unsupervised | Daily Deal Digest fires at 7am `review_after`. Distress Signal Sweep runs `auto`. **No outbound action without `approve_first`. Safe.** ✅ | OK |
| 6 | Customer runs same Distress Signal Sweep twice | Read-only data ingestion. Re-pull is idempotent against `dealhawk_create_deal` (assumes deduplication on address — need to verify in tool implementation). 🟡 | **P1 — verify** |
| 7 | Customer scales 1 → 100 leads/day | Sourcing agents pull at volume. **Skip-trace at $0.05–$0.50/lookup × 100/day = $5–$50/day = $150–$1,500/month** uncapped. Twilio SMS at $0.0075–$0.0079/SMS × 100 leads × 5 touches over 90 days = $375. **No aggregate budget.** | **P0 — see below** |
| 8 | Twilio 429 rate limit hit | Per global rule, single failure surfaces. **No graceful back-off, no failover to Telnyx.** Outreach queue stalls. | **P1** |

---

## C6. Premium polish

| Aspect | State | Issue |
|---|---|---|
| **Onboarding** | Setup Checklist + dedicated `/admin/dealhawk` dashboard + 15 demo deals seeded on materialization | ✅ **Best-in-library.** Operator sees a populated pipeline on Day 1. |
| **Defaults** | `safetyMode: "ask_before_acting"`, `primaryModel: "anthropic/claude-sonnet-4.5"` | ✅ Reasonable. **No fallback model** (same library-wide gap). |
| **Documentation** | Agent purposes vivid + niche-precise + branded ("Sub-To Qualifier — DOS Risk Analyst") | ✅ Premium |
| **Voice** | Empathy-first, anti-spam, refuses "we buy houses." **Brand voice is best in library — the only template where the voice itself is part of the legal/ethical defense.** | ✅ Premium |
| **Progress visibility** | Daily/weekly/monthly cadence baked in. Daily Deal Digest at 7am is a fixed touchpoint. | ✅ Strong |
| **Handoff moments** | dealMode upgrades require operator attestation (research → outreach: TCPA; outreach → contract: AttorneyOnFile per state). **Best progressive-disclosure model in library.** | ✅ Premium |
| **The 90% rule** | Closer to **80%** autonomous in research mode (most work is automatic), **70%** in outreach (drafts auto, sending often manual via mail house), **60%** in contract (attorney engagement is operator-side). **Honest about platform limits — feels less premium than "agent does it all" but more credible.** | ⚠ Acceptable — the gates are intentional and a feature, not a bug. |
| **Regulatory exposure framing** | "Premium legal firewall. Not legal or financial advice." in description. Hardcoded disclaimers everywhere. | ✅ Best-in-library |
| **Branded tooling** | `/admin/dealhawk` dashboard, `Dealhawk*Panel.tsx` components, demo-data seeding | ✅ Premium feel |

---

## C7. Cost efficiency

Operator-side costs vary by mode:

**Research mode (week 1):**
- LLM (sourcing + scoring + underwriting daily) ~$3–$5/day
- Skip trace (only for ≥40-score leads, ~10/day) × $0.05–$0.50 = $0.50–$5/day
- **Total: ~$100–$300/month research-only**

**Outreach mode (week 4+):**
- Add Twilio SMS: $0.0079/SMS × ~50 outbound/day × 30 days = $12/month + A2P 10DLC fees (~$15/mo)
- Add Resend email: ~$20/mo (3,000 sends/mo plan)
- Add mail house (if used): $0.50–$1.50 per piece × 100 letters/month = $50–$150/mo
- **Total: ~$300–$600/month outreach mode**

**Contract mode (when locking deals):**
- Title company fees ($500–$1,500 per close) — operator pays
- Attorney fees ($300–$1,500 per Sub-To) — operator pays
- Marketing during disposition: minimal
- **Total: revenue-positive at this stage**

**Cost guardrails present:** ❌ **None.** No template-level spend ceiling, no daily budget, no per-mode budget, no skip-trace quota.

**Cost-tier-down opportunities:**
- LLM model picking — Sub-To Qualifier and Creative Finance Architect have very long system prompts (~600+ words each). Each call burns ~6K tokens. **Could move to Claude Haiku for routine scoring loops, keep Sonnet 4.5 for memo generation.** ~50% savings on routine ops.
- Skip-trace tier-down: don't skip-trace leads scoring <50, only ≥40. Currently scored leads are skip-traced indiscriminately at the Distress Signal Analyst step.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: No outreach spend ceiling
**What:** Seller Outreach Agent + Follow-Up Sequencer can blast hundreds of SMS / emails / letters per day. No template-level budget. No per-channel cap. **At 100 leads × 5 touches × 90 days = 500 SMS @ $0.0079 + ~$10 mail-house per letter = potentially $200–$1,000/month outreach burn unchecked.**

**Why it matters:** Priority 1 (Functional) + Priority 6 (Cost). Customer scales aggressively → unexpected bill → refund/chargeback risk.

**Fix:** Add to Deal Ops Lead system prompt:
```
COST GUARDRAILS:
- Maximum 50 outbound SMS / day across all leads (operator-configurable)
- Maximum 100 outbound mail pieces / week
- Maximum 200 skip-trace lookups / month (only on leads scoring ≥40)
- Before any blast that would exceed daily caps, surface a confirmation prompt with cost projection.
- Hard stop at $500/month total outreach budget unless operator raises ceiling in business config.
```
Add a `monthly_outreach_budget` field to business config so the operator can set their ceiling. Mirror the pattern proposed for `tiktok_shop`.

### P0-2: TCPA attestation enforced at UI layer, not agent-call layer
**What:** Setup Checklist KB + system prompt say outreach mode requires TCPA attestation. The data field `tcpaAttestedAt` is on the business model and surfaced in the UI dashboard. **But the Seller Outreach Agent doesn't actually check `tcpaAttestedAt` is set before drafting outreach.** The dealMode gate (research vs outreach) is the only thing actually enforced at agent level.

**Why it matters:** Priority 1 (Functional) + Priority 4 (Error Handling) + regulatory exposure. Operator could flip dealMode to outreach without signing the TCPA attestation in the UI. Agent would then send outreach. Operator now legally exposed.

**Fix:** Add a `tcpa_attested` check inside `dealhawk_draft_outreach` tool implementation — refuse to draft if `tcpaAttestedAt` is null. Update Seller Outreach Agent system prompt to verify with a knowledge_lookup or tool call before drafting:
```
Before drafting any outreach, verify that the business has tcpaAttestedAt set
on its config. If not set, refuse to draft and surface to the operator with:
"TCPA attestation is required before outreach mode can generate seller-facing
drafts. Please confirm TCPA compliance in /admin/businesses/[id]/settings."
```

### P0-3: `dealhawk_skip_trace` provider ambiguity
**What:** Setup Checklist names BatchSkip / REsimpli / TLOxp as skip-trace providers. **Tool implementation doesn't surface which one is being called.** Operator's account credentials → which backend? Where's the cost-per-lookup actually billed?

**Why it matters:** Priority 3 (Integration Health) + Priority 6 (Cost). Customer doesn't know which provider they're paying for. Could be paying for two simultaneously. Could be hitting the wrong API.

**Fix:** Update `dealhawk_skip_trace` tool to accept a `provider` param (`"batchdata" | "resimpli" | "tloxp"`) sourced from a business config field `default_skip_trace_provider`. Update Distress Signal Analyst system prompt to require operator to set this at first use. Surface the unit cost ($0.05–$0.50 by provider) in the tool's response so cost is visible.

### P0-4: System prompts don't enumerate the actual tool runtime
**What:** Same library-wide pattern. Dealhawk agents have decent `tools[]` arrays (the dealhawk_* tools are the right whitelist) but they don't list BUILTIN_ALWAYS_ON, what's auto-attached for `VIDEO_PRODUCTION_TEMPLATES`... wait, dealhawk is NOT in VIDEO_PRODUCTION_TEMPLATES (correctly so — no video gen) and NOT in YOUTUBE_API_TEMPLATES.

So dealhawk agents get: their explicit `tools[]` whitelist + BUILTIN_ALWAYS_ON + any installed MCP tools. Cleanest tool-attachment story in the library.

**Still: agents don't enumerate what they have in their system prompts.** Same fix pattern as `tiktok_shop` and `faceless_youtube`.

---

## C9. P1 issues (quality)

### P1-1: No model fallback
Same as other templates. Add `fallbackModel`.

### P1-2: Telephony triad ambiguity (Twilio vs Telnyx vs WhatsApp)
**What:** All three suggested simultaneously. Setup Checklist names Twilio for SMS but doesn't tell the operator *whether to also install Telnyx, or whether WhatsApp Cloud is for a different segment*.

**Fix:** Update Setup Checklist KB:
```
Recommended: Twilio for SMS (US wholesalers) + Resend for email + (optional)
Telnyx as a fallback failover if Twilio rate-limits. Skip WhatsApp Cloud
unless you operate in markets where WhatsApp is dominant (Latin America,
international wholesaling). Don't install all three — pick one primary +
one fallback.
```
And add a Twilio → Telnyx fallback rule to Seller Outreach Agent's system prompt.

### P1-3: State Compliance Matrix not enforced at tool-call time
Disposition Agent should explicitly `knowledge_lookup STATE_COMPLIANCE_MATRIX.md` before every blast. Add to system prompt.

### P1-4: Off-Market Scraper TOS exposure
**What:** `web_search` against Craigslist / Facebook Marketplace at scale will eventually trigger CAPTCHA / IP block. **No anti-throttling rule.** No pivot to paid scraping (Apify, BatchData, etc.) as a fallback when blocked.

**Fix:** Add to system prompt: *"Pace requests — no more than 10 / minute / domain. Honor robots.txt. If a domain CAPTCHA or 403, escalate to operator and recommend they configure BATCHDATA_API_KEY or similar paid scraping endpoint."*

### P1-5: Sub-To Qualifier accepts any input — no validation
**What:** Operator can paste wrong loan balance / rate / PITI → wrong cashflow → wrong recommendation.

**Fix:** Add input validation rules to system prompt: *"Refuse to score Sub-To if loan balance > 1.2 × ARV (mortgage exceeds value — scenario should be a short sale, not Sub-To). Refuse to score if claimed rate < 1% (data error). Refuse to score if PITI > 60% of operator-claimed market rent (cashflow inversion — verify before continuing)."*

### P1-6: Cost-tier-down for routine sourcing/scoring
Sub-To Qualifier and Creative Finance Architect have ~600-word system prompts. Routine daily scoring runs through them. **Move routine scoring to Claude Haiku** (10× cheaper); keep Sonnet 4.5 for memos.

**Fix:** Add a per-agent `model_for_routine_ops` field. Default Distress Signal Analyst + Repair Cost Estimator + Buyer List Builder → Haiku. Sub-To memos + Creative Finance memos + Disposition packages stay on Sonnet 4.5.

### P1-7: Distress Signal Sweep `auto` — verify dedup
The `auto` mode is OK for read-only signal pulls **only if `dealhawk_create_deal` deduplicates by address**. Verify in tool implementation.

### P1-8: Buyer List Builder web_search fallback won't scale
Setup Checklist correctly identifies BatchData / PropStream as paid alternatives. But the system prompt could be louder: *"web_search is a small-market crutch. By Day 30 of operation in a target market, recommend BatchData or PropStream subscription. Without paid data, the buyer list will degrade."*

---

## C10. P2 issues (polish)

### P2-1: Daily Deal Digest at 7am — no notification mechanism
Add `send_telegram_message` to Deal Ops Lead's tools (it's BUILTIN, so already there). System prompt could add: *"After producing the digest, send a 1-line Telegram summary to the operator (deal count + top-1 with dollar value)."*

### P2-2: Brand voice exemplar library
Other premium templates (`faceless_youtube`) have a "channel-voice exemplar library." Dealhawk's voice is so distinctive (empathy-first, anti-pressure) it deserves a similar 5–10 exemplar past-good-outreach KB item that Seller Outreach Agent references on every draft.

### P2-3: Strict-disclosure-state list hardcoded across multiple agents
IL / OK / SC / PA / NY / NJ / VA / MD / MA / TN reference appears in: guardrailsTemplate, Disposition Agent system prompt, Creative Finance Architect system prompt, STATE_COMPLIANCE_MATRIX.md. **Single source of truth = STATE_COMPLIANCE_MATRIX.md.** Update other prompts to reference it via knowledge_lookup instead of duplicating.

### P2-4: 19 workflows but no "Weekly Compliance Review" workflow
Other templates have a Compliance Audit workflow. Dealhawk distributes compliance across agents, but a weekly review of: (a) any outreach that referenced the NOD by accident, (b) any disclaimer that was softened, (c) any state-mismatch event would be valuable.

### P2-5: Brand voice could be even more distinctive
The empathy-first + premium-legal-firewall positioning is unique. Could lean even harder — maybe a "Decline-to-deal" pattern where the system explicitly flags vulnerable sellers and recommends operator step away.

---

## Summary fix-time for `dealhawk_empire`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | Outreach spend ceiling, TCPA attestation enforcement at agent level, skip-trace provider clarity, system-prompt tool enumeration | **4 hours** |
| P1 (8) | model fallback, telephony triad opinion, State Matrix enforcement, Off-Market TOS rules, Sub-To input validation, cost-tier-down, dedup verification, buyer-data scale advisory | **3–4 hours** |
| P2 (5) | Telegram digest, voice exemplar, single-source state list, weekly compliance review, decline-to-deal pattern | **1–2 hours** |

**Total to S-tier: ~8–10 hours.** Best-engineered template in the library on tool wiring + brand voice + compliance gating. The remaining gaps are quality-tightening, not structural rebuilds.

---

**Next message:** Section C for `forex_trading_desk` (rank #4) — but per your earlier decision, this is a **REMOVE recommendation** rather than a deep audit. I'll do a tight one-page case for removal + flag the components worth salvaging for elsewhere, then move directly to **rank #5** (`tiptax_affiliate_engine` → SHIP private-only). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/4 — forex_trading_desk (REMOVAL)  (transcript line 783, 7771 chars) -->
<!-- ============================================================ -->

Starting with the Forex removal recommendation, then deep-diving `tiptax_affiliate_engine`.

---

# SECTION C — TEMPLATE 4/19: `forex_trading_desk` — **REMOVAL RECOMMENDATION**

**Verdict:** **REMOVE FROM PUBLIC SKU CATALOG.** Optionally retain as a private template gated by `ownerEmails` if there's a specific operator who needs it.

## The case for removal (one page)

### What you've built
A genuinely engineered desk: 14 agents, 6 workflows, 15 KB items, real-time market data MCPs (`twelvedata_forex`, `fred_macro`, `finnhub_news`), broker MCPs (`oanda_forex`, `tradovate_futures`), `e2b_code_execution` for backtesting, jurisdiction gating (US / UK / EU / AU / CA / SG / JP / OTHER), and a **three-tier `tradingMode` consent escalation** (research → paper → live_approval) where the default is `research` and live order routing is gated behind explicit per-trade approval.

The architecture is sound. The technical work is real. The problem is upstream of the code.

### Why ship it as a $497 SKU is a problem

**1. Selling "AI-powered FX trading" to retail at $147–$997 invites a regulatory inquiry the rest of your library cannot afford.**
- US: CFTC + NFA. Retail FX with leverage is the most-investigated retail derivative segment in the country. Even though this template doesn't broker — it sends signals + drafts orders — selling **a product** that drafts trades for retail FX customers triggers questions about whether you're operating as an unregistered Commodity Trading Advisor (CTA) or providing investment advice without a license. CFTC Reg 4.14 exemptions exist but require either registration or a paid-subscriber-with-disclaimer setup that is materially different from "buy this template, deploy it, trade FX."
- UK: FCA's MiFID II + retail-CFD ban + 30:1 leverage cap. Selling a tool that helps retail enter CFDs has been the focus of FCA enforcement repeatedly since 2018.
- EU: ESMA same as UK with national-regulator overlay.
- AU: ASIC's Design and Distribution Obligations (DDO) treat this kind of tool as a "complex financial product" with target-market determination requirements you'd need to file. As of 2024 ASIC has been actively enforcing DDO against retail-FX-adjacent products.

The `jurisdiction` enum + Risk Disclosure UI + `tradingMode: research` default are **mitigations, not exemptions.** They reduce risk; they don't eliminate it.

**2. The buyer who would pay $497 for this is not the buyer your library is built for.**
- Your library targets operators who run businesses (Shop, Newsletter, Agency, Real Estate). The retail FX buyer is a different psychographic — they're typically searching for trading-edge tools, not business-operations tools.
- Selling this template alongside your other SKUs makes Ghost ProtoClaw look unfocused. *"Why does this guy sell a TikTok Shop template AND a Forex desk?"* — it dilutes positioning.

**3. The legal-blast-radius is asymmetric.**
- Best case at scale: you get 50–100 customers, $24K–$50K revenue, no regulatory issue.
- Worst case at scale: one customer's account gets blown up, they file a complaint with CFTC / FCA / ASIC alleging the template gave bad signals, and you're now defending whether your "draft" really meant "advise" — even though the template is technically clear it's not advice. Discovery alone costs $20K–$100K. A consent decree could ban you from "operating in the financial-services adjacent space" for a period — which would block you from selling Dealhawk too.

**4. Even the "OTHER — self-certified" jurisdiction is a problem.**
- That escape hatch lets a customer in any jurisdiction self-certify and use the desk. It documents their attestation, but in a regulator-dispute, regulators will look at *"did you do what a reasonable operator should have done"* — and a self-cert checkbox often doesn't clear that bar.

### What to do instead

**Option A — Remove from public catalog (recommended).**
- Set `visibility: "private"` on `forex_trading_desk`.
- Set `ownerEmails: ["beardfacebeard@gmail.com"]` so YOU can still instantiate it (you're the user with `currentDate: 2026-05-09 / userEmail: beardfacebeard@gmail.com`).
- The selector UI already filters private templates by ownerEmails — this is a one-line change.
- Cost: zero. Customer-facing impact: zero (they can't buy what they couldn't see).

**Option B — Retain but gate harder.**
If you really want to keep it sellable, two requirements:
- (a) Hire a regulatory attorney for a 30-minute consult to confirm CTA exemption applies in your customer-acquisition model. Probably $500–$1,000.
- (b) Add a click-through licensing agreement at create time that includes operator attestation: *"I am not a US person / I am a Sophisticated / Accredited Investor / I have consulted my own counsel."* The current jurisdiction enum is a UI-level disclosure but not a licensing agreement.
- Even with this, I'd cap pricing at $297 — not because the work is worth less, but because the legal-exposure-per-dollar ratio gets worse as price goes up (higher revenue draws regulator attention).

### What to salvage from the build
The forex template has **reusable primitives** worth extracting before you remove it:

| Component | Where it could go |
|---|---|
| `tradingMode: research → paper → live_approval` consent escalation | **This is the BEST progressive-disclosure pattern in the library.** Generalize to a `executionMode` template-level field other regulated templates can use (e.g. dealhawk's `dealMode` is a sibling pattern). |
| Jurisdiction-aware system prompts | Extractable as a `jurisdictionAwareSystemPrompt(jurisdiction)` helper. Useful for any template that ships in multiple regulatory regimes (real_estate, dealhawk_empire). |
| `e2b_code_execution` backtesting integration | Reusable for any template that needs sandbox compute (data-analysis workflows in agency, dealhawk, etc.). |
| `twelvedata_forex / fred_macro / finnhub_news` MCP integrations | Keep them in `mcp-definitions.ts`. They're useful for any agent doing macro research. Just don't ship a template that mandates them. |
| The 14-agent specialization pattern (analyst / risk officer / execution / journal / etc.) | Reusable in `dealhawk_empire` evolution and in a hypothetical `b2b_trading_desk` private template. |

### Implementation: the actual change

```diff
  // ── FOREX RESEARCH & EXECUTION DESK ────────────────────────────────────
  {
    id: "forex_trading_desk",
    ...
+   visibility: "private",
+   ownerEmails: ["beardfacebeard@gmail.com"],
  },
```

Plus update the `forex_trading_desk` references in `route.ts:140-147` (jurisdiction gate) and `BusinessDetailTabs.tsx:174` (specialty dashboard) — they continue to work because the template still exists, just not visible to non-owners. **Nothing breaks for you.**

**Fix-time:** **15 minutes.** Single-line `visibility` + `ownerEmails` add. Two-line audit trail update.

---

# SECTION C — TEMPLATE 5/19: `tiptax_affiliate_engine` (TipTax Affiliate Engine)

**Verdict:** **SHIP — but private-only as designed.** Already `visibility: "private"`. ~0.5 day to S-tier within its private scope.
**Headline:** A specialized 14-agent affiliate-recruitment engine wired to a real B2B outbound stack (Smartlead / Instantly / Sendpilot / Manychat / Reddit / Playwright). 40 KB items, 15 workflows. Tightly purpose-built for one buyer (you / TipTax affiliates). **Not a retail SKU and shouldn't become one.** The remaining issues are: an empty-string `primaryModel` typo, the hardcoded `DEFAULT_TIPTAX_AFFILIATE_LINK` in `applyContext`, and a heavy required-MCP footprint (5 required MCPs) that's appropriate for the private use case but would break a retail SKU if ever flipped public.

Before I dive in, let me quickly read the template structure to ground the audit.


<!-- ============================================================ -->
<!-- Section C/5 — tiptax_affiliate_engine  (transcript line 795, 21746 chars) -->
<!-- ============================================================ -->

Got enough to audit. This template is private — designed for owner operation only — so the audit reframes from "premium retail product" to "operator efficiency + regulatory tightness."

## C1. Functional walkthrough — affiliate hunt happy path

Two parallel funnels: **Funnel A** (restaurant owner → `{{affiliateLink}}` → signed affiliate) and **Funnel B** (sub-affiliate recruitment → downline override).

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Coordination** | **Recovery Ops Lead** | All agent outputs | Daily pipeline digest at 7am, gate compliance flags, "next best action" | `delegate_task` (BUILTIN), `send_email`, `send_telegram_message`, `knowledge_lookup`, `web_search` | Daily digest | ✅ EXPLICIT |
| **Sourcing** | **Prospect Hunter** | State + metro target | Free-source scraping (Google Places, Yelp, OSM, state license rolls); shard by state | `web_search`, `scrape_webpage`, `crawl_website`, `browser_navigate/click/fill_form`, `database_query`, `prospect_record_source` (purpose-built tool) | Prospect records w/ prospect_id | ✅ EXPLICIT to Qualifier |
| **Qualification** | **Qualifier** | Prospect record | Score by tip volume, employee count, license class | `prospect_record_qualification` (purpose-built) | Tier A/B/C scoring | ✅ EXPLICIT to Channel Operator |
| **Outbound — Email** | **Channel Operator (Email)** | Tier A/B prospects | Instantly cold email campaigns w/ register-tuned copy | `instantly_create_campaign`, `instantly_add_leads_to_campaign`, `instantly_launch_campaign`, `instantly_list_replies`, `instantly_send_reply` | Cold email sequence | ✅ EXPLICIT |
| **Outbound — LinkedIn** | (same or LinkedIn-specialist) | Same tier | Sendpilot DMs + connection requests, native session safety | `sendpilot_send_dm`, `sendpilot_send_connection_request`, `sendpilot_list_senders`, `sendpilot_list_leads`, `sendpilot_update_lead_status` | LinkedIn touches | ✅ EXPLICIT |
| **Outbound — Social** | **Social Publisher** | Daily content calendar | Cross-channel publish to 8 platforms | `social_publish_post`, `social_get_analytics` | Posts | ✅ |
| **Outbound — Reddit** | (specialist) | Subreddit-relevant content | Value-first post → DM follow-up (approve_first) | `reddit_create_post`, `reddit_reply_to_post`, `log_reddit_target` | Reddit content | ✅ |
| **Outbound — Messaging** | (specialist) | Warm leads | WhatsApp Cloud + Telegram | `whatsapp_send_text_message`, `whatsapp_send_template_message`, `send_telegram_message`, `manychat_send_content`, `manychat_send_flow` | Warm DMs | ✅ |
| **Inbound** | **Reply Triager** | Webhook events from Instantly + WhatsApp + Sendpilot in ActivityEntry | Classify reply: bucket + buyer state (8-state model from KB) | `prospect_transition` (purpose-built), `prospect_record_qualification` | Triaged replies w/ buyer-state assignment | ✅ EXPLICIT to Objection Responder |
| **Conversation** | **Objection Responder** | Triaged reply + buyer state | Generate calm, evidence-led, register-matched response (4 calibrated registers per KB) | `instantly_send_reply`, `sendpilot_send_dm`, `whatsapp_send_text_message` | Reply draft | ✅ |
| **Compliance** | **Compliance Officer** | All outbound drafts | Advisory check against guardrails (no refund guarantees, no political-policy claims, no CPA-bypass language) | `knowledge_lookup` | Pass/fail + flag | 🟡 Advisory only — operator is the actual gate |
| **Analytics** | **Data Analyst** | Pipeline DB | Funnel summary, leakiest-stage flag | `prospect_funnel_summary`, `database_query` | Weekly funnel report | ✅ |

### Break points

1. **`postgres_mcp` required for pipeline reads/writes** — `database_query` is a generic tool that depends on `postgres_mcp` being installed AND the schema matching what Hunter / Qualifier / Reply Triager / Data Analyst expect. **If the operator's Postgres doesn't have the prospect tables, agents return errors.** No schema-mismatch validation.

2. **Webhook routes hardcoded** — `/api/webhooks/instantly/<businessId>`, `/api/webhooks/whatsapp/<businessId>`, `/api/webhooks/sendpilot/<businessId>` exist per the file's documentation. Need to verify these routes are actually implemented in `app/api/webhooks/`.

3. **`approvalMode` distribution** — the template has 15 workflows. Setup checklist + system prompts call out `approve_first` for Reddit + bulk batches >100 + outcome-promise rewrites. **Need to verify which workflows actually carry `approve_first` vs `auto`** — could be unsupervised outbound risk if any send-action workflow is `auto`.

4. **`{{affiliateLink}}` substitution** — Setup checklist relies on the operator providing `affiliateLink` via business config or template falls through to `DEFAULT_TIPTAX_AFFILIATE_LINK` hardcoded in `applyContext` ([business-templates.ts:115](lib/templates/business-templates.ts:115)). For a private template that's fine. **For a hypothetical public version, that default link would leak the owner's affiliate code.**

5. **Buyer-state model** depends on Reply Triager correctly classifying — and the model has 8 states, scored 0-100 engagement. **Misclassification cascades** through Objection Responder's register choice → wrong tone at wrong moment → trust burn → conversion lost.

6. **CPA-adjacent positioning** — system prompt repeatedly says "always say 'verify with your CPA,' never instruct owner to bypass CPA." Good. **But the underlying offer ("we'll get you back overlooked tax credits via §45B") is squarely in the unauthorized-tax-practice gray zone for a non-licensed agent.** The "operator-process claims vs statutory facts" separation in the brand voice is the legal mitigation. Premium voice — but the line between "second opinion service" and "tax preparation" is enforcement-ambiguous.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `social_media_mcp` | **Required** | When installed | ✅ Configured | 8-platform publish (X, TikTok, LinkedIn, Reddit, FB, IG, Pinterest, Threads) |
| `firecrawl_mcp` | **Required** | When installed | ✅ Configured | High-volume scraping fallback |
| `postgres_mcp` | **Required** | When installed | ⚠ Schema-coupled | Operator's DB must have the prospect schema. **No schema-version check.** |
| `instantly_mcp` | **Required** | When installed | ✅ Configured | Cold email + reply ingestion via webhook |
| `sendpilot_mcp` | **Required** | When installed | ✅ Configured | LinkedIn DMs + connection requests w/ session safety |
| `reddit_mcp` | Suggested | When installed | ✅ Optional | Reddit posting + replies. **Note: `approve_first` discipline mandatory at scale.** |
| `playwright_mcp` | Suggested | When installed | ✅ Optional | Browser automation for sites without API |
| `whatsapp_cloud_mcp` | Suggested | When installed | ✅ Optional | WhatsApp Business API |
| `manychat_mcp` | Suggested | When installed | ✅ Optional | Conversational flows |
| `hubspot_mcp` | Suggested | When installed | ⚠ Redundant w/ gohighlevel | Pick one — they overlap |
| `gohighlevel_mcp` | Suggested | When installed | ⚠ Redundant w/ hubspot | |
| `smartlead_mcp` | Suggested | When installed | ✅ Optional | Smartlead alternative to Instantly cold email |
| `prospect_record_source` | Built-in custom | ✅ Wired | Purpose-built | Auto-dedupes by businessName + state |
| `prospect_record_qualification` | Built-in custom | ✅ Wired | Purpose-built | |
| `prospect_transition` | Built-in custom | ✅ Wired | Purpose-built | 8-state buyer model transitions |
| `prospect_funnel_summary` | Built-in custom | ✅ Wired | Purpose-built | Per-stage attribution |
| `database_query` | Built-in | ✅ Wired | Generic but coupled to schema | |
| LLM | `primaryModel: ""` | ❌ **TYPO** | **P0** | Empty string falls through to platform default — different from "(none set)" |

### Per-integration audit (the 5 required)

| Check | `social_media_mcp` | `firecrawl_mcp` | `postgres_mcp` | `instantly_mcp` | `sendpilot_mcp` |
|---|---|---|---|---|---|
| Credential flow | MCP install ✅ | MCP install ✅ | MCP install + schema setup ⚠ | MCP install ✅ | MCP install ✅ |
| Call construction | Standard schema ✅ | ✅ | ✅ | ✅ | ✅ |
| Rate limit awareness | ❌ Not in any agent | ❌ | N/A internal | ⚠ Setup checklist mentions warming, agents don't | ⚠ "Per-account session safety" is the design but not surfaced as a rate awareness rule |
| Error handling | ❌ Single fail surfaces | ❌ | ❌ Schema mismatch fails silently | ❌ | ❌ |
| Cost ceiling | N/A | ❌ Firecrawl ~$0.001-0.003/page; agent could scrape unbounded | ❌ | ❌ Instantly ~$0.03/email; 1K/day = $30 → $900/month, no cap | ❌ Sendpilot ~$0.50/account/day, no cap |
| Fallback path | N/A | ❌ Firecrawl → Playwright fallback not wired | ❌ | ❌ Instantly → Smartlead fallback (Smartlead suggested) not wired | ❌ |
| Model/version pinning | ✅ Provider-locked | ✅ | ✅ | ✅ | ✅ |

---

## C3. Media generation deep-check

**Not applicable.** No image/video/voice/music generation. Outreach is text + occasional outcome infographic (referenced in system prompt as a static asset). No AI media gen wiring needed. ✅ Correctly scoped.

---

## C4. Output quality scorecard

For an owner-operated private template, the question isn't "would I pay $X" — it's "does this output convert?" Reframing:

| Deliverable | Polish | Specificity | Brand consistency | Conversion-likely? | Notes |
|---|---|---|---|---|---|
| Daily pipeline digest (Recovery Ops Lead) | High | High | High | N/A — internal | Strong |
| Prospect records (Hunter) | High | High | High | N/A — internal | |
| Qualifier scoring | High | High | High | N/A | |
| Cold email sequences | High — register-tuned | High — niche-specific | High — calm, evidence-led | ✅ Likely converts | |
| LinkedIn DM sequences | High | High | High | ✅ Likely | |
| Reddit content | Medium — value-first discipline strong | Medium | High | ⚠ Reddit-conversion-from-organic-content is hard | |
| Reply triage classification | Critical correctness | High when correct | High | ✅ When correct, drives correct register | |
| Objection Responder replies | High — 4-register calibration | High | High | ✅ Most-tested asset for conversion | |
| Outcome infographic | Static asset (operator-supplied?) | High | High | ✅ "Single highest-converting asset" per system prompt | |
| Compliance flag reports | High — advisory | High | High | N/A | |
| Funnel summary | High — leakiest-stage flag is sharp | High | High | N/A | |

**Output quality is high across the board.** This is a sophisticated template that knows what it's doing. The conversion question depends on Reply Triager correctness + buyer-state model accuracy more than any individual output.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Instantly API key invalid | `instantly_*` tools fail → outreach queue stalls. Webhook ingestion still works for old replies. | P1 |
| 2 | `postgres_mcp` server down | `database_query` + custom prospect tools fail → entire pipeline halts. **Most templates degrade; this one breaks.** | **P1 — critical dependency** |
| 3 | Operator's Postgres schema doesn't match | `prospect_record_source` etc. fail. **No clear error to operator about schema mismatch.** | **P1** |
| 4 | Reddit account banned for spam | `reddit_create_post` returns 403. Setup checklist correctly notes Reddit risk. **No automatic detection / alert.** | P1 |
| 5 | Instantly inbox burned (deliverability < 50%) | Cold emails send but bounce/spam. **No deliverability monitoring.** | **P1** |
| 6 | Operator runs same campaign twice | Instantly allows duplicate campaigns. Prospects get 2 sequences. Trust burned. **No dedup at agent level.** | P1 |
| 7 | Sendpilot account session lost | DMs queue but don't send. Per setup, "per-account session safety" is the design. **Operator notification?** | P1 |
| 8 | Webhook arrives malformed (Instantly schema change) | Reply Triager fails to classify. Reply sits in ActivityEntry untriaged. **No fallback for unrecognized webhook payload.** | P1 |

---

## C6. Premium polish

Reframed for owner operation:

| Aspect | State | Notes |
|---|---|---|
| **Onboarding (operator)** | Setup checklist exists; webhook routes documented at top of file; `affiliateLink` substitution path explained | ✅ Strong |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅; **`primaryModel: ""` ❌ TYPO BUG** | **P0** |
| **Documentation** | 40 KB items including Buyer State Definitions, Engagement Scoring Rubric, Proof Ladder, Sourcing Sources & URLs | ✅ Most-documented template in library |
| **Voice** | Calm, evidence-led, anti-hype. Distinctive. | ✅ Premium |
| **Progress visibility** | Daily digest at 7am via Recovery Ops Lead. Telegram message also wired (Recovery Ops Lead has `send_telegram_message`). | ✅ |
| **Compliance posture** | Hardcoded across system prompts: §45B is statutory; "verify with CPA"; no refund guarantees; no policy-attribution; account-warming explicit; Craigslist OFF-LIMITS | ✅ Best-in-library on niche-specific compliance discipline |
| **The 90% rule** | Most outbound automated. Operator's role: approve outcome-promise rewrites, approve >100-batch sends, approve Reddit posts, sign HubSpot/GHL pipeline movements if used. **Probably 85%+ autonomous after Day 7 of warming.** | ✅ Premium operator efficiency |

---

## C7. Cost efficiency

Estimated monthly burn at 1K prospects/month sourced + 500 cold emails + 50 LinkedIn touches/day:

| Cost line | Monthly |
|---|---|
| Instantly cold email | ~$120/mo (Pro plan) + $0 per email overage typically |
| Sendpilot LinkedIn | ~$50-99/mo per account |
| Firecrawl scraping | ~$30-100/mo at this volume |
| Postgres MCP (operator's DB) | depends on hosting |
| Social Media Hub (Late or Ayrshare) | $33-149/mo |
| WhatsApp Cloud | per-message after free tier |
| Reddit MCP | $0 |
| LLM (Claude Sonnet 4.5 or default) | ~$10-30/mo at this volume |
| **Total** | **~$250-500/mo operator side** |

**No spend ceiling on agents.** Operator can theoretically blast 10× the volume and not see the bill until it lands.

**Cost-tier-down opportunities:**
- LLM defaults to platform default (because of the typo). When fixed, Sonnet 4.5 is overkill for routine reply triage. **Move triage + scoring to Haiku; keep Sonnet 4.5 for Objection Responder + outbound copy.** ~50% LLM savings.
- Firecrawl tier-down: prefer free `scrape_webpage` for simple pages, only fall through to Firecrawl for sites that block.

---

## C8. P0 issues (BLOCK SHIP — even private operation has bugs to fix)

### P0-1: `primaryModel: ""` typo
**What:** Line 68 of `tiptax-affiliate-engine.ts`: `primaryModel: ""`. Empty string isn't the same as "unset." Falls through to platform default at runtime, but if any code path checks `primaryModel.length > 0` it could behave unpredictably.

**Why it matters:** Priority 3 (Integration Health) + Priority 5 (Premium polish). Output quality drift across runs as platform defaults change.

**Fix:** Change to `primaryModel: "anthropic/claude-sonnet-4.5"` (matching the other premium templates). One line.

```diff
- primaryModel: ""
+ primaryModel: "anthropic/claude-sonnet-4.5"
```

### P0-2: `postgres_mcp` schema dependency unguarded
**What:** Multiple agents call `prospect_record_source`, `prospect_record_qualification`, `prospect_transition`, `prospect_funnel_summary`, `database_query`. **All depend on operator's Postgres having a specific prospect schema.** No migration, no schema check.

**Why it matters:** Priority 1 (Functional). Day 1 fail mode: operator installs `postgres_mcp` against their existing DB, agents fire, queries fail with cryptic "table prospects does not exist" errors.

**Fix:** Add a setup-checklist action: *"Run the prospect-schema migration: `npx prisma migrate apply migrations/tiptax-prospects.sql` (or paste the schema SQL into your Postgres directly — file at `lib/templates/tiptax-prospect-schema.sql`)."* And add a **schema-version check tool** (`prospect_schema_check`) that the Recovery Ops Lead runs on first business creation and surfaces missing tables to the operator.

### P0-3: Webhook route implementation not verified in this audit
**What:** Header doc says `/api/webhooks/instantly/<businessId>`, `/api/webhooks/whatsapp/<businessId>`, `/api/webhooks/sendpilot/<businessId>` exist. **I haven't verified these routes are actually implemented.**

**Why it matters:** Priority 1 (Functional). If webhooks aren't actually wired, Reply Triager has no inbound to triage. Pipeline is one-way: outbound only.

**Fix:** Verify routes at `app/api/webhooks/instantly/[businessId]/route.ts`, `app/api/webhooks/whatsapp/[businessId]/route.ts`, `app/api/webhooks/sendpilot/[businessId]/route.ts`. If missing, implement them — they're listed in the design but the audit can't confirm without reading those files.

### P0-4: System prompts don't enumerate the actual tool runtime (library-wide)
Same pattern as `tiktok_shop` / `faceless_youtube` / `dealhawk_empire`. Agents have decent `tools[]` arrays but no enumeration in system prompts. Apply the same fix pattern.

---

## C9. P1 issues

### P1-1: No model fallback (library-wide)
Add `fallbackModel`. Same as everywhere else.

### P1-2: No spend ceiling on Instantly / Sendpilot / Firecrawl
**Fix:** Add to Recovery Ops Lead system prompt:
```
COST GUARDRAILS:
- Maximum 1,000 cold emails / day across all Instantly campaigns.
- Maximum 50 LinkedIn DM/connection touches / day per Sendpilot account.
- Maximum 500 Firecrawl scrapes / day (prefer free scrape_webpage first).
- Hard stop at $500/month total outreach budget unless operator raises.
```

### P1-3: Compliance Officer is advisory; operator is the gate — make it explicit in workflow approval modes
Audit all 15 workflows. Any that send outbound (cold email send, DM send, social post, Reddit post) should be `approve_first` until operator explicitly opts into autopilot.

### P1-4: Deliverability monitoring missing
Add a workflow `Weekly Deliverability Check` that queries Instantly's `get_campaign_analytics`, flags bounce rate > 5%, spam rate > 0.1%, open rate < 30% as "inbox warming required — pause campaigns."

### P1-5: HubSpot/GHL/Smartlead overlap with Instantly
Pick one CRM (HubSpot or GHL) and one cold-email engine (Instantly or Smartlead). Currently template suggests both pairs. **For private operation, less critical — but document the choice.**

### P1-6: Buyer-state classification correctness has no QA
**Fix:** Add to Reply Triager system prompt: *"If buyer state classification is genuinely ambiguous (matches 2+ states), default to the more conservative state and flag for operator review. Never escalate state without clear signal."*

### P1-7: Reddit account-bannable risk
At scale, Reddit's anti-spam algos are aggressive. Even with `approve_first`, if the operator approves 10 Reddit posts/week across multiple subreddits over months, the account gets shadowbanned. **Add to KB**: *"Reddit shadowban watch — if any post drops to 0 upvotes within 30min, pause Reddit posting for 14 days."*

### P1-8: Custom prospect tools should validate input before writing
`prospect_record_source` could accept any `businessName` string. **Add validation:** required fields, max lengths, regex on phone/website, dedupe matching tolerance.

---

## C10. P2 issues

### P2-1: Brand-voice exemplar library
40 KB items but no "Past-winning outreach exemplars." Add 5-10 actual successful outreach drafts as a KB item Objection Responder references.

### P2-2: Outcome infographic is referenced but not stored
System prompt says "Small Restaurant $25,819 net / Neighborhood Bar $51,638 net / Busy Restaurant Group $154,913 net" infographic is the "single highest-converting asset" — should be a `brand_assets` registered file the agents can pass via `get_brand_asset`.

### P2-3: §45B regulatory framing
The system prompt's "verify with CPA, never bypass CPA" + "second opinion service" framing is good. **One line worth adding**: *"This service is a recovery-process facilitator, not tax preparation. We don't compute final amounts. Form 8846 is filed by the CPA, not by us."* Tightens the unauthorized-practice gray-zone position.

### P2-4: 14 agents may be overstaffed for 1 operator
For owner-operation, a 14-agent mesh is heavy. Consider whether Channel Operator Email + LinkedIn + Social + WhatsApp could collapse to 2 agents (one inbound, one outbound) — saves prompt-cache complexity.

### P2-5: Telegram digest format
Recovery Ops Lead has `send_telegram_message`. Add explicit instruction: *"Send a 1-line Telegram summary every morning (digest header + top-1 next-best-action)."*

---

## Summary fix-time for `tiptax_affiliate_engine`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | `primaryModel` typo, Postgres schema check, webhook route verification, system-prompt tool enumeration | **3-4 hours** |
| P1 (8) | model fallback, spend ceilings, workflow approval audit, deliverability monitor, CRM dedup, classification QA, Reddit watch, input validation | **4-5 hours** |
| P2 (5) | exemplar KB, infographic asset, §45B framing tightening, agent-collapse review, Telegram digest | **1-2 hours** |

**Total to S-tier: ~8-10 hours.** This is the most sophisticated template in the library on prospect-pipeline and reply-triage design. **For private owner operation, the P0s are real bugs to fix; the P1s are operator-efficiency improvements; the P2s are polish.** It should NOT be flipped public — the regulatory framing (§45B + "we'll get you back overlooked credits") and the heavy MCP footprint don't fit a retail SKU. Keep `visibility: "private"`.

---

**Next message: Section C for `ghost_operator` (rank #6 — flagship marketing-star but `NEEDS WORK`).** Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/6 — ghost_operator  (transcript line 812, 26381 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `ghost_operator`.

---

# SECTION C — TEMPLATE 6/19: `ghost_operator` (Ghost Operator)

**Verdict:** **NEEDS WORK** (~2 days to S-tier).
**Headline:** Marketing-star template — best-positioned in the library, hits a real customer pain ("I want to start an online business but don't know what"). The disclaimer + platform-rules + escalation-matrix KB content is genuinely solid. **But there's a fundamental contract mismatch:** the description promises "builds your chosen business with approval at every step, markets it for free across every major social platform" — and the agents who would do that work don't have the tools to execute. CTO/Builder is honest about being a planner ("I don't execute"), but the *template description and customer-facing positioning aren't*. The CMO promises 8-channel publishing but `tools: ["send_email", "web_search", "knowledge_lookup"]` — no `social_publish_post`. The CFO promises revenue tracking but `tools: ["knowledge_lookup"]` — no Stripe tools. Customers will arrive, sign up, and discover that "autonomous" means "drafts everything for you to execute." That's a real product, but it's not the product the description sells.

## C1. Functional walkthrough — first-time-founder happy path

The template promises a 5-phase loop (research → decide → build → grow → optimize) with the user as approval gate. Tracing one cycle:

| Phase | Agent | INPUT | PROCESSING | TOOL CALLS (declared) | TOOL CALLS (runtime) | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|---|
| **Phase 1 — Research** | **CEO (Scout)** | User goals + constraints (gathered via discovery conversation) | Score current online business models against user's time/budget/skills/income goal; present top 3 ranked w/ honest revenue ranges + time-to-first-dollar + risks | `send_email`, `web_search`, `knowledge_lookup`, `telegram_message` | + BUILTIN, + auto-attached video stack (`tiktok_shop` is in VIDEO_PRODUCTION_TEMPLATES — wait, ghost_operator IS too per [tool-registry.ts:4788](lib/mcp/tool-registry.ts:4788)) — so HeyGen/Creatify/ElevenLabs/JSON2Video tools auto-attach | Top-3 ranked options w/ data | 🟡 IMPLICIT — "Wait for user to pick before handing off to Strategist." No actual delegate_task wiring. |
| **Phase 2 — Decide** | (User picks) | | | | | | |
| **Phase 3 — Plan** | **COO (Strategist)** | Selected business model | 4 deliverables: phased build plan + access list + 30/60/90 milestones + risk register | `send_email`, `knowledge_lookup` | + BUILTIN, + video stack | BUSINESS_PLAN.md populated | 🟡 IMPLICIT to Builder |
| **Phase 4a — Build** | **CTO (Builder)** | Approved plan | Per-task: state goal + access + execution steps + success check + BUILD_LOG entry. **Honest disclosure: "I write steps; YOU or an external tool execute"** | `web_search`, `knowledge_lookup` | + BUILTIN, + video stack | BUILD_LOG entries (after operator confirms each step) | 🔴 BREAK — Builder's "external build tool (Emergent, Cursor, v0)" handoff is referenced but not wired. Operator runs entirely manually. |
| **Phase 4b — Grow** | **CMO (Growth)** | Built product + brand voice | 8-channel free-organic strategy: TikTok → IG Reels → Pinterest → X → LinkedIn → cold email → Threads → Snapchat. Weekly experiments w/ kill criteria. | `send_email`, `web_search`, `knowledge_lookup` | + BUILTIN, + video stack, + `social_media_mcp` tools (publish_post, schedule_post, get_analytics, get_comments — when MCP installed) | Weekly experiments + content calendar | 🔴 BREAK — system prompt promises 8-channel publishing but agent's `tools[]` whitelist doesn't include any social_publish_post. Relies on `social_media_mcp` being installed AND the auto-attach mechanism working. **Customer thinks the agent "publishes"; reality is it drafts.** |
| **Phase 5 — Optimize** | **CFO (Revenue Monitor)** | Revenue data | Daily silent check, weekly analysis, alerts only when action needed | `knowledge_lookup` ONLY | + BUILTIN, + video stack, + `stripe_mcp` tools when installed (suggested, not required) | Weekly revenue snapshot, alerts on >20% drops | 🔴 BREAK — CFO has only `knowledge_lookup` in explicit tools. **Cannot read Stripe data even when MCP is installed unless auto-attach surfaces it.** Setup checklist correctly notes "Without Stripe, Daily Revenue Pulse is based on what you paste in." But the operator paying $497 for autonomy is not expecting to paste revenue data daily. |

### Break points

1. **CMO publishing claim — declared ≠ wired in agent tools array.** Required: `social_media_mcp`. Agent: `["send_email", "web_search", "knowledge_lookup"]`. Auto-attached when MCP installed: yes. **But the agent system prompt doesn't tell CMO it has `social_publish_post` available** (same library-wide P0). At inference time, CMO sees its `tools[]` whitelist and tool-runtime context and may or may not know to call `social_publish_post`. **Customer-facing risk: agent "schedules a post" by writing copy + scheduling intent, but doesn't actually post.**

2. **CFO tool starvation** — `tools: ["knowledge_lookup"]` is the most starved agent tool array in the entire ghost_operator team. Even if Stripe is installed, agent has no `stripe_*` tool in its explicit whitelist. **Setup checklist explicitly downgrades the CFO's value when Stripe is missing.**

3. **CTO/Builder claim** — "5-agent team that...builds your chosen business with approval at every step" (description). **Builder honestly admits in system prompt: "YOU DO NOT EXECUTE — you produce the exact specification + step-by-step instructions the user (or an external build tool like Emergent, Cursor, v0, or a no-code platform) will run."** This is a contract gap. Either the description should say "designs and instructs," or Builder needs actual execution tools.

4. **Discovery conversation has no workflow** — CEO's `roleInstructions` say "Wait for the user to pick before handing off to Strategist" but there's no `Discovery Conversation` workflow that runs this initial dialog. First-time founder lands on the platform and... what? Day 1 onboarding ambiguous.

5. **Inter-agent coordination** — same library-wide pattern. CEO has `delegate_task` (BUILTIN, since type=main). Specialists do not. "Coordinate with X" surfaces intent only.

6. **Scout's research stack is light** — `web_search` only for "research current online business models." For competitor analysis, market sizing, opportunity scoring — `web_search` returns top 10 generic results. **No grounding in any market-data API, no Reddit/forum mining, no Twitter sentiment.**

7. **`approvalMode: "notify"` on Daily Revenue Pulse** — agent runs autonomously, only surfaces report when "something unusual needs attention." Acceptable for revenue monitoring. **But "notify" doesn't actually wire a notification channel** — it just doesn't gate execution. Operator might miss critical alerts if not actively in the dashboard.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `social_media_mcp` | **Required** | Auto-attached when installed | ⚠ **Required but agent tools[] don't list specific tools** | CMO needs `social_publish_post`, `social_get_analytics`, `get_comments` — relies on auto-attach |
| `resend_mcp` | **Required** | Auto-attached when installed | ✅ | CEO + COO + CMO have `send_email` in tools[] |
| `stripe_mcp` | Suggested | Auto-attached when installed | ⚠ CFO needs but doesn't list | "Without Stripe, Revenue Monitor is watching an empty dashboard." Acknowledged in setup checklist. **Wrong — Stripe should be required for the CFO to deliver value.** |
| `whatsapp_cloud_mcp` / `twilio_mcp` / `telnyx_mcp` | Suggested (all 3) | When installed | ⚠ Telephony triad ambiguity — same as dealhawk | |
| `hubspot_mcp` | Suggested | When installed | ✅ Optional | |
| **Video production stack** (HeyGen, Creatify, ElevenLabs, JSON2Video, B-Roll, Auto-Clip, Whisper, R2) | Auto-attached because `ghost_operator` is in `VIDEO_PRODUCTION_TEMPLATES` | ✅ Configured | ⚠ But none of the system prompts mention these tools | Per [tool-registry.ts:4788](lib/mcp/tool-registry.ts:4788): *"CMO / Growth posts to social and needs avatar video"* — correct intent. **But no agent's system prompt tells CMO it has `heygen_generate_video` for AI avatar content or `creatify_generate_ugc` for UGC variants.** |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** | Output drift across runs |

### 8-sub-check audit

For social_media_mcp + stripe_mcp specifically (the two most consequential):

| Check | `social_media_mcp` | `stripe_mcp` |
|---|---|---|
| Credential flow | OAuth via `/admin/integrations` ✅ | API key ✅ |
| Call construction | Standard schema ✅ | ✅ |
| Rate limit awareness | ✅ Platform-rules KB items document daily limits per platform — best in library on this | ❌ |
| Error handling | Per global no-retry rule | ❌ |
| Cost ceiling | ❌ None — could hit Late/Ayrshare API limits if scaled | N/A read-only |
| Fallback path | ❌ Late ↔ Ayrshare alternatives not wired | N/A |
| Model/version pinning | ✅ Provider-locked | N/A |
| Tools in system prompt | ❌ CMO's `tools[]` doesn't list `social_publish_post` | ❌ CFO's `tools[]` is just `["knowledge_lookup"]` |

---

## C3. Media generation deep-check

Auto-attached video stack but no agent's system prompt actually mentions it. Quick takes:

- **Image generation** — auto-attached via `generate_image` (fal.ai). CMO promises "TikTok short-form video" but template has no agent designated as "Content Producer" or "AI UGC Producer" like `tiktok_shop` does. **No one writes the scripts. No one generates the visuals. CMO drafts strategy; no one executes.**
- **Video generation** — Creatify + HeyGen auto-attached. No system prompt references them.
- **Voice** — ElevenLabs auto-attached. No reference.
- **Music / Avatar / UGC** — auto-attached. No reference.

**For a 5-agent template, the auto-attach pattern works against simplicity.** The 5 agents don't need a 30-tool runtime — they need to know which 5 tools to call. The auto-attach for VIDEO_PRODUCTION_TEMPLATES adds ~15 tools per agent that none of them are designed to use.

**Fix consideration:** either (a) remove `ghost_operator` from VIDEO_PRODUCTION_TEMPLATES (CMO can't generate video without specific instruction anyway), or (b) add Content Producer / Visual Producer specialist to the template if the multi-platform video promise is real. Either tighten the contract or add the team.

---

## C4. Output quality scorecard

For the first-time-founder buyer, what they actually receive:

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $497? |
|---|---|---|---|---|---|
| **Top-3 opportunity options (Scout)** | Medium-High — depends on `web_search` quality | Medium — generic models because data is web-search-grounded | High — honest tone | High | ⚠ Borderline. **Would I pay $497 for "ChatGPT could give me a similar list"? Only if the recommendations are actually market-data-backed.** |
| **BUSINESS_PLAN.md (Strategist)** | High — structured, specific, 90-day milestones | High | High | High — paste-able plan | ✅ Yes |
| **Build steps (Builder)** | High — exec-ready instructions | High | High | High **for the operator who knows how to follow technical steps** | ⚠ Borderline. **First-time founder who can't run `npm install` will struggle.** |
| **Weekly experiment proposals (Growth)** | High | High | High | Medium — operator must execute the experiments manually unless social_media_mcp wired well | ⚠ Borderline |
| **Daily Revenue Pulse (CFO)** | Empty without Stripe | N/A | N/A | Low until Stripe wired | ❌ Fails until Stripe required |
| **Weekly Business Health Report** | High when all 5 agents contribute | High | High | High | ✅ Yes |
| **Monthly Strategy Review** | High | High | High | High | ✅ Yes |
| **Paid Ad Spend Approval** | High — explicit approval framework | High | High | High | ✅ Yes |

**Three borderline outputs.** First-time founder buyer is the riskiest segment for a "pay before you understand the product" template — they assume "autonomous" means "AI runs the business." They get "AI plans the business; you run it." That's a real product, but it's not what the marketing implies.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Customer's `social_media_mcp` invalid | CMO drafts content but tool calls fail. Per global no-retry. **Best-case: weekly experiments stay in `BUILD_LOG` as drafts. Worst-case: operator thinks publishing happened, doesn't verify, no posts go live.** | **P0** |
| 2 | `social_media_mcp` server offline | Same | P1 |
| 3 | Customer pastes garbage market data | Scout works with whatever it sees; opportunity scoring becomes meaningless. **No validation.** | P1 |
| 4 | Content moderation blocks AI-generated post | Single failure surfaces. No fallback. | P1 |
| 5 | 3am unsupervised | Scout's Weekly Opportunity Scan and CFO's Daily Revenue Pulse run autonomously per `approvalMode: "review_after"` and `"notify"`. CMO's experiments are `approve_first` — gated. **Builder + paid ads gated.** ✅ Acceptable. | OK |
| 6 | Customer runs same Weekly Opportunity Scan twice | Stateless — same week, two scans, similar outputs. **No dedup. Could create operator confusion: "Scout said X last week, why does Scout say Y this week?"** | P1 |
| 7 | First-time founder doesn't know what "OAuth" means | Setup Checklist includes "Accounts ready on each platform Growth intends to use — TikTok (Creator + potentially Business)..." **Actual instructions for HOW to OAuth missing.** | **P1** — wrong audience-fit |
| 8 | Customer scales 1 → 50 outreach contacts/day across 8 channels | Setup Checklist + Platform Rules KB document daily limits. **But no enforcement at agent level — agents could draft 200 messages even when daily limit is 50 per platform.** Operator-side discipline is the only defense. | **P1** |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup Checklist + Discovery Conversation in CEO's roleInstructions | ⚠ Discovery Conversation is referenced but not workflowed. **First-time founder might not know to start a conversation with Scout.** |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | Disclaimers + Platform Rules + Decision Framework + Escalation Matrix + Inter-Agent Communication = comprehensive | ✅ Best legal-disclaimer block in library |
| **Voice** | "Adaptive — matches whatever voice the chosen business needs. Internal: plain-English, honest, decision-ready." | Adaptive voice is actually correct for this template. Different from premium niche templates that have a fixed brand voice. |
| **Progress visibility** | Daily Revenue Pulse + Weekly Business Health Report + Monthly Strategy Review = 3-tier cadence | ✅ Strong |
| **Handoff moments** | 4-tier Decision-Making Framework explicit. **But buyer is first-time founder; tier escalations (Tier 4 = $50+ spend) are very aggressive.** | ⚠ Mismatch — buyer who doesn't know what they're doing should arguably have $0 Tier 4 threshold. |
| **The 90% rule** | **Probably 50–60% autonomous.** Builder is a planner. CFO has no Stripe. CMO drafts but operator must verify each post. **First-time founder doesn't know what they're "approving" most of the time, so the approval gate becomes friction.** | ⚠ Lower than the marketing implies |
| **Disclaimers** | "AGENT BOUNDARIES AND DISCLAIMERS — Read First" KB item is genuinely solid | ✅ Premium |

---

## C7. Cost efficiency

For a first-time founder running this template:

- LLM weekly: ~$2-5 across all 5 agents at typical research/planning cadence
- Social Media Hub (Late/Ayrshare): $33-149/mo
- Resend: ~$20/mo
- Stripe: $0 setup + transaction fees
- Optional: Twilio ($20-30/mo SMS), HubSpot ($50/mo entry tier)
- **Total: ~$80-300/mo** infrastructure for the first-time founder who buys this

**Affordable for a $497 SKU buyer.** ✅

**No spend ceiling at the agent level.** Tier-4 framework (>$50 spend → user approval) is system-prompt discipline. Could be enforced at the tool level with budget gates if needed.

**Cost-tier-down opportunity:** Scout uses default model for research — could use Haiku for routine `web_search` synthesis and Sonnet 4.5 for ranked-options output. ~50% LLM savings.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: CMO promises 8-channel publishing but `tools[]` whitelist doesn't include social_publish_post
**What:** CMO's `tools: ["send_email", "web_search", "knowledge_lookup"]`. System prompt + KB + Setup Checklist all promise multi-platform publishing. Relies on `social_media_mcp` being installed AND auto-attach surfacing tools that aren't named in the system prompt.

**Why it matters:** Priority 1 (Functional) + Priority 2 (Output Quality) + Priority 5 (Premium polish). Customer-facing description says "markets it for free across every major social platform." Reality at runtime: CMO drafts content, may or may not call publishing tools depending on whether it discovers them in the runtime tool catalog.

**Fix:**
```diff
  tools: [
    "send_email",
    "web_search",
    "knowledge_lookup",
+   "social_publish_post",
+   "social_get_analytics",
+   "get_comments",
+   "schedule_post",
+   "delete_post",
+   "upload_media"
  ]
```
And add to system prompt: *"You publish via Social Media Hub (`social_publish_post`, `schedule_post`). You read engagement via `social_get_analytics` and reply via `get_comments`. Post per the platform-specific daily limits in the Platform Rules KB items — never exceed them. Surface failures (auth errors, content moderation blocks) immediately."*

### P0-2: CFO has only `knowledge_lookup` — cannot read revenue data
**What:** CFO's `tools: ["knowledge_lookup"]`. System prompt promises "watch every dollar — what comes in, what goes out, which channel drove it, which offer converted." Setup Checklist correctly notes "Without Stripe, Daily Revenue Pulse is based on what you paste in" — but **even WITH Stripe installed, the CFO doesn't have Stripe tools in its whitelist.**

**Why it matters:** Priority 1 (Functional) + Priority 2 (Output Quality). CFO's entire role is undeliverable without Stripe data. Setup Checklist hand-waves this as a suggested integration; should be required + tools added.

**Fix:**
1. Move `stripe_mcp` to `requiredIntegrations`.
2. Add to CFO's `tools[]` (auto-attached via stripe_mcp install but explicit is better):
```diff
  tools: [
    "knowledge_lookup",
+   "send_email",
+   "send_telegram_message"
+   // (stripe tools auto-attached when stripe_mcp installed)
  ]
```
3. Update system prompt: *"You read revenue data via `stripe_mcp` tools (charges, customers, subscriptions). When Stripe is unavailable, surface a setup-needed alert — don't fabricate numbers from KB or paste-only input."*

### P0-3: CTO/Builder description vs reality mismatch
**What:** Template description: *"builds your chosen business with approval at every step."* Builder system prompt: *"YOU DO NOT EXECUTE — you produce the exact specification + step-by-step instructions the user (or an external build tool like Emergent, Cursor, v0, or a no-code platform) will run."*

**Why it matters:** Priority 5 (Premium polish) + customer expectation management. The customer paying $497 reads "builds for you," gets "instructs you to build." Those are different products. Refund risk.

**Fix:** Two paths.
- **Path A (clarify the contract — fastest):** Update description to *"plans your chosen business with the technical specifications and step-by-step instructions you (or your preferred build tool) execute."* And update Builder's display name from "CTO" to "Build Architect" or similar so the role title matches reality.
- **Path B (deliver on the promise — slowest):** Wire `playwright_mcp`, `e2b_code_execution`, file-write tools to Builder. Add a "Build Executor" specialist that picks up Builder's specs and runs them. Significantly more product work but matches the marketing.

Path A is the right move for ship-readiness. Path B is the roadmap.

### P0-4: System prompts don't enumerate the actual tool runtime (library-wide pattern)
Same fix as `tiktok_shop`, `faceless_youtube`, `dealhawk_empire`. Append "TOOLS YOU HAVE ACCESS TO" block to each agent.

---

## C9. P1 issues

### P1-1: `primaryModel` not set
Add `primaryModel: "anthropic/claude-sonnet-4.5"` to defaults. Same library-wide gap.

### P1-2: No fallback model
Same as everywhere.

### P1-3: Discovery Conversation has no workflow
First-time founder lands → no obvious entry point. Add a `Discovery Conversation` workflow:

```typescript
{
  name: "Discovery Conversation (Day 1)",
  description: "Scout (CEO) walks the user through the structured discovery: weekly hours available, starting budget, existing skills, risk tolerance, income goal, niche preferences. Populates the User Goals and Constraints KB item before the first Weekly Opportunity Scan can run.",
  trigger: "manual",
  output: "report",
  approvalMode: "approve_first",
  agentRole: "CEO"
}
```
And add a Day-1-only setup wizard (UI work) that prompts the operator to start this workflow before anything else.

### P1-4: Buyer-fit mismatch on Tier 4 spend threshold
Decision-Making Framework Tier 4 = "Any spending over $50, pivoting the business model, entering new markets, connecting payment processors." For first-time founder, $50 is high. Recommend Tier 4 = "Any spend at all" for first 30 days; relax after.

**Fix:** Add to system prompt: *"For the first 30 days from business creation, treat ALL spending as Tier 4 (user approval required). After Day 30, Tier 4 threshold relaxes to $50+ if the user has approved at least 3 prior spend requests without negative outcomes."*

### P1-5: Auto-attached video stack is dead weight for ghost_operator
None of the 5 agents are designed to use HeyGen / Creatify / ElevenLabs / JSON2Video. Auto-attach gives them ~15 unused tools.

**Fix options:**
- Remove `ghost_operator` from `VIDEO_PRODUCTION_TEMPLATES` in `tool-registry.ts:4782-4789` (current comment says "CMO / Growth posts to social and needs avatar video" — but no agent prompt mentions any avatar tool). Cleanup.
- OR add explicit guidance: *"When CMO needs short-form video for TikTok/Reels and the operator hasn't sourced their own video tool, recommend using `creatify_generate_ugc` for fast UGC variants or `heygen_generate_video` for talking-head. Cost: ~$2-11/video."*

I'd take **option 1** — keeps the 5-agent simplicity. Buyers who need video should look at `tiktok_shop` or `faceless_youtube`.

### P1-6: Scout research stack is light
Add to Scout's `tools[]`: maybe `crawl_website` (Firecrawl) for deeper market data. Or wire a Reddit MCP for market sentiment.

### P1-7: No deduplication on weekly scans
Scout runs Weekly Opportunity Scan repeatedly. Same week → similar output → operator confusion.

**Fix:** Add to Scout's system prompt: *"Before producing a weekly scan, knowledge_lookup the prior 4 scans. If your top-3 hasn't changed and no market data has shifted, surface 'No material changes since last scan' instead of regenerating."*

### P1-8: Builder execution-tool handoff
Setup Checklist mentions "Emergent, Cursor, v0, Replit, or manual" as build executors. **None are wired.** Builder produces specs that the operator copies into another tool. Two options:
- (a) Document the handoff clearly: *"Builder's output is paste-ready for [your chosen execution tool]. The recommended pairing is X for Y use case."*
- (b) Wire one — e.g., Builder integrates with `e2b_code_execution` for shell commands or with Replit's API for repo creation.

Path A is the ship-fast move.

### P1-9: Telephony triad ambiguity
Same as `dealhawk_empire`. Pick one with an opinion.

---

## C10. P2 issues

### P2-1: Discovery Conversation outcome
Once `User Goals and Constraints` KB is populated, surface a one-click "Run my first opportunity scan" CTA. Reduces first-time founder friction.

### P2-2: 8-channel-per-week is operator-heavy
Even with `social_media_mcp` wired, 8 channels × 1-4 posts/day each = 8-32 daily posts to draft, schedule, engage with. **Realistic operator commitment: 2-3 hours/day.** Setup Checklist could surface this honestly: *"This template's organic-marketing strategy expects ~2-3 hours/day of operator commitment in months 1-3. If you have less, narrow to 2-3 platforms (TikTok + Instagram + cold email)."*

### P2-3: Brand voice disclaimer
"Adaptive — matches whatever voice the chosen business needs" — true for the agent team but the template-level brand voice could be tightened. *"Internal: plain-English, decision-ready, data-grounded. Customer-facing: matches the chosen business's brand voice once Strategist defines it."*

### P2-4: Demo data
Other premium templates seed demo data (`dealhawk_empire`). Ghost Operator could seed a sample User Goals KB + a sample Strategy Notes KB so operators see a populated workspace on Day 1.

### P2-5: Builder's "external build tool" mention
Same competitor-mention concern as `faceless_youtube`. Replace specific tool names with categories: *"Use your preferred execution method — Cursor / v0 / Emergent / Replit / a no-code platform / manual."*

---

## Summary fix-time for `ghost_operator`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | CMO publishing tools, CFO Stripe tools + move to required, Builder description-vs-reality clarification, system-prompt tool enumeration | **5-6 hours** |
| P1 (9) | primaryModel + fallback, Discovery workflow, Tier-4 buyer-fit, video stack cleanup, Scout research depth, scan dedup, Builder handoff doc, telephony triad opinion | **4-5 hours** |
| P2 (5) | onboarding CTA, time-commitment honesty, brand-voice tighten, demo data, Builder mention rephrase | **2 hours** |

**Total to S-tier: ~12 hours.** This template is the most marketing-leveraged in the library. The fix is mostly *honesty* — match what the description promises to what the agents actually deliver. Either tighten the contract (Path A — fastest) or expand the team (Path B — roadmap). Either way, the buyer should know on Day 1 that they're paying for a planning + drafting + research engine, not a "press play and the business runs."

---

**Next message:** Section C for `agency` (rank #7 — `NEEDS WORK`). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/7 — agency  (transcript line 828, 27461 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `agency`.

---

# SECTION C — TEMPLATE 7/19: `agency` (Agency / Studio / AI Automation Reseller)

**Verdict:** **NEEDS WORK** (~2 days to S-tier, OR consider splitting into two templates).
**Headline:** Sophisticated 8-agent team with the most coherent productized-AI-agency playbook in the library — Offer Architect / Proposal Writer / Fulfillment Orchestrator / Case Study Producer is a real go-to-market system. **But the template explicitly serves two operator archetypes ("traditional creative/dev/marketing agencies AND AI automation agencies") and forks in the road.** Setup Checklist's first action is *"Pick archetype."* That's a sign the template is two templates pretending to be one. Other issues: HubSpot is required but no agent has HubSpot tools in `tools[]`, the Fulfillment Orchestrator has *only* `knowledge_lookup` so it can't actually orchestrate, the template-level systemPromptTemplate is one sentence (vs ~600 words on `tiktok_shop`), and there's no multi-client-isolation model — Account Manager handles all clients in one pool with no per-client scoping.

## C1. Functional walkthrough — AI Automation Reseller happy path

This template's primary archetype (per the description) is the AI Automation Reseller. Tracing one cold-to-signed-client cycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Pipeline** | **CEO** | All agent outputs | Weekly leadership review: revenue, pipeline, delivery, capacity | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Weekly leadership review | 🟡 IMPLICIT |
| **Outbound** | **Business Developer / AI Lead Gen** | ICP + niche | Build target list, run cold email via Instantly, qualify inbound, manage pipeline in HubSpot OR GHL | `send_email`, `web_search`, `knowledge_lookup`, `instantly_create_campaign`, `instantly_launch_campaign`, `instantly_add_leads_to_campaign`, `instantly_get_campaign_analytics`, `ghl_create_contact`, `ghl_create_opportunity`, `ghl_list_pipelines` + BUILTIN | Cold campaigns + qualified leads | ✅ EXPLICIT (GHL pipeline) |
| **Discovery** | (operator runs the call; agent doesn't) | | Operator's discovery call → transcript or brief | | | 🔴 BREAK — no discovery-call agent. Setup Checklist's "Discovery call framework" KB is operator-side guidance only. |
| **Offer design** | **Offer Architect** | Niche profile | 3-tier productized offer per niche — Starter $1.5-3K, Core $5-10K + $1.5K/mo, Premium $15K+ + $5K/mo | `web_search`, `knowledge_lookup` + BUILTIN | PROPOSAL_LIBRARY.md updated | ✅ EXPLICIT to Proposal Writer |
| **Proposal** | **Proposal Writer** | Discovery transcript / brief | 3-page proposal: client's words + ROI math + 2 pricing options + 48h deadline | `send_email`, `knowledge_lookup` + BUILTIN | 3-page proposal in <5 min | ✅ EXPLICIT |
| **Sign** | (operator + client) | | | | Signed contract | |
| **Build** | **Fulfillment Orchestrator** | Signed SOW | Build brief: flow diagram + platform decision (n8n/Make/Zapier/GHL) + credentials list + QA checklist | `knowledge_lookup` ONLY | Build brief + delivery package | 🔴 BREAK — see below |
| **Account mgmt** | **Account Manager** | Active client | Weekly client-facing reports, scope conversations, health dashboard | `send_email`, `knowledge_lookup` + BUILTIN | Weekly report + meeting recaps | 🟡 IMPLICIT |
| **Delivery oversight** | **COO** | All active projects | Milestone tracking, resource allocation, deliverable QA, SOPs | `knowledge_lookup` ONLY | Weekly delivery status | 🟡 IMPLICIT |
| **Wins → marketing** | **Case Study Producer** | 30-day-post-kickoff client wins | Numbered case study + LinkedIn post + landing page draft + Business Developer stat library | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Case study artifacts | ✅ EXPLICIT (feeds Business Developer) |

### Break points

1. **Fulfillment Orchestrator has only `knowledge_lookup`** — it produces "build briefs" and "delivery packages" as documents. **It cannot actually orchestrate any build.** Setup checklist correctly notes Sprint 2 will add n8n / Make MCPs. Until then, agent describes what to build; operator builds it manually. **Customer paying $5K-$50K to deliver a productized AI build expects "we built it for you" and gets "we wrote you a build brief."** Same pattern as `ghost_operator` Builder — but worse because the agency template's whole pitch is "we sell builds." If the agency operator is the bottleneck, throughput stalls.

2. **Required `hubspot_mcp` but zero agents have HubSpot tools in `tools[]`** — Business Developer has `ghl_*` tools (GoHighLevel). No agent has `hubspot_*` tools. **HubSpot integration is auto-attached at runtime via `getToolsForAgent` when the MCP is installed**, but no agent's system prompt or `tools[]` references HubSpot specifically. **A traditional creative agency operator on HubSpot won't see their CRM data flow into agent decisions** unless the auto-attach happens to surface relevant tools.

3. **`requiredIntegrations: ["resend_mcp", "hubspot_mcp"]` forces HubSpot** — but the AI Automation Reseller archetype recommends GoHighLevel. **Forcing HubSpot for the AI agency archetype is a mismatch.** Operators who only want GHL pay for HubSpot they don't use.

4. **No discovery-call agent** — Discovery call framework exists as a KB item. **No agent owns running the discovery call or even drafting the transcript.** Operator runs the call, types up the transcript, pastes into Proposal Writer. Acceptable but the template description implies more autonomy.

5. **No CMO / agency-self-marketing agent** — CEO + Business Developer drive new business via cold email. **No agent runs the agency's own social, content, or thought-leadership.** Traditional creative agencies that grow through inbound/social are underserved here.

6. **No retainer-billing workflow** — Stripe is suggested for retainers. No workflow runs retainer collection, AR aging, dunning, or churn-risk detection. **Setup Checklist mentions retainer health in Weekly Leadership Review but no agent owns it.**

7. **Bifurcated identity (the structural issue)** — Setup Checklist literally says: *"Pick archetype: traditional creative/dev agency OR AI automation reseller. The Offer Architect, Proposal Writer, Fulfillment Orchestrator, and Case Study Producer agents stay dormant for traditional agencies; the Business Developer runs differently."* Half the agents go dormant for half the buyers. **This is two templates wearing one trenchcoat.**

8. **No multi-client-isolation model** — Account Manager handles ALL clients with one knowledge_lookup pool. No way to scope agent context to a specific client. If the agency has 30 clients, the Account Manager either treats them generically or operator manually injects client context every time. **Premium agency operators with 10+ clients will hit this wall fast.**

9. **template-level `systemPromptTemplate`** is a single sentence: *"You coordinate client operations for {{businessName}}. Keep account communication clean, delivery visible, and next steps easy to act on."* For an 8-agent template selling $5K-$50K builds, that's anemic. Agent-level prompts are detailed; team-level coordination prompt is missing.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `resend_mcp` | **Required** | Auto-attached when installed | ✅ Configured | CEO + Account Manager + Business Developer + Proposal Writer + Case Study Producer have `send_email` |
| `hubspot_mcp` | **Required** | Auto-attached when installed | ⚠ **Required but no agent has hubspot_* tools in tools[]** | The auto-attach mechanism may surface them at runtime — but no agent system prompt references HubSpot specifically. **Required for Business Developer's pipeline management but Business Developer's `tools[]` lists `ghl_*` not `hubspot_*`.** |
| `stripe_mcp` | Suggested | Auto-attached when installed | ⚠ No agent has Stripe tools | Setup Checklist says CEO uses retainer billing data in Weekly Leadership Review — but CEO's `tools[]` is `["send_email", "web_search", "knowledge_lookup"]`. No Stripe. |
| `instantly_mcp` | Suggested | When installed | ✅ Wired | Business Developer has `instantly_*` tools |
| `gohighlevel_mcp` | Suggested | When installed | ✅ Wired | Business Developer has `ghl_*` tools |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent owns agency social marketing | Suggested "if {{businessName}} runs client social accounts in addition to advising." But no agent's `tools[]` references `social_publish_post`. |
| `slack_mcp` | Suggested | When installed | ⚠ No agent has Slack tools | Setup Checklist says COO surfaces delivery alerts in team channel — but COO's `tools[]` is `["knowledge_lookup"]`. No Slack. |
| Auto-attached video stack (`agency` is in `VIDEO_PRODUCTION_TEMPLATES`) | ✅ Configured | ⚠ Same issue as `ghost_operator` | None of the 8 agents are designed to use HeyGen / Creatify / ElevenLabs / JSON2Video. **Auto-attach polluting decision space.** |
| LLM | `primaryModel: (none set)` | ❌ | **P1** | Falls to platform default |

### 8-sub-check audit (for the 4 actually-wired integrations)

| Check | `instantly_mcp` | `ghl_*` (gohighlevel_mcp) | `resend_mcp` | `hubspot_mcp` |
|---|---|---|---|---|
| Credential flow | API key + warmup setup ✅ | API key (Agency Unlimited $297/mo plan needed) | Domain + SPF/DKIM | API key + private app token |
| Call construction | ✅ Standard schema | ✅ | ✅ | ⚠ No agent calls hubspot tools — runtime auto-attach untested |
| Rate limit awareness | ⚠ Setup checklist notes 10-14 day warmup; agent system prompt doesn't enforce | ❌ | ❌ | ❌ |
| Error handling | Per global no-retry rule | Same | Same | Same |
| Cost ceiling | ❌ Instantly ~$0.03/email; agency could blast 10K/day = $300/day. **No template-level cap.** | ❌ | ❌ | N/A |
| Fallback path | ⚠ Instantly → Smartlead fallback mentioned in KB but not wired | ❌ HubSpot ↔ GHL fallback not designed | ❌ | ❌ |
| Model/version pinning | ✅ Provider-locked | ✅ | ✅ | ✅ |
| Tool enumeration in system prompts | ✅ Business Developer's `instantly_*` tools listed | ✅ Business Developer's `ghl_*` listed | ✅ via `send_email` | ❌ |

---

## C3. Media generation deep-check

Same as `ghost_operator`: auto-attached for VIDEO_PRODUCTION_TEMPLATES but unused. **Cleanup recommendation: remove `agency` from `VIDEO_PRODUCTION_TEMPLATES`.** The template doesn't promise video production — agency operators who need video should pair this template with an external video tool or use `tiktok_shop` / `faceless_youtube` for that specific channel work.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $497? |
|---|---|---|---|---|---|
| **Weekly Client Update Report (Account Manager)** | High — recap-formatted, wins/blockers/next-steps | Medium — no client-specific KB scoping = generic if multi-client | Medium — depends on operator's voice file | High when client-specific data is paste-able | ⚠ Borderline. Multi-client risk: 30 clients all get similar-tone updates. |
| **Cold Email Campaign (Business Developer)** | High — Instantly-driven + ROI-anchored | High when ICP is well-defined | High | High | ✅ Yes |
| **3-Page Proposal (Proposal Writer)** | High — tight structure | High — client-words verbatim + ROI math | High | High — paste-ready | ✅ Yes — best output in the template |
| **Productized Offer Catalog (Offer Architect)** | High — 3-tier per niche structure | High | High | High | ✅ Yes |
| **Build Brief (Fulfillment Orchestrator)** | High when n8n/Make are wired (NOT YET) | Medium without execution tools | High | LOW — operator must build externally | ⚠ Borderline. Closer to "spec sheet" than "delivery." |
| **Delivery Package (Loom + SOP + credentials + retainer)** | High when operator records Loom; agent has no `screen_record` tool | High | High | Medium — operator does most of the work | ⚠ Borderline |
| **Case Study Draft (Case Study Producer)** | High — numbers-first format | High | High | High | ✅ Yes |
| **Project Status Summary (COO)** | Medium — `knowledge_lookup`-only agent has no project-mgmt tool | Medium | Medium | Low — relies on operator paste | ❌ Fails — COO can't actually track projects without tools |
| **Weekly Leadership Review (CEO)** | Medium — without Stripe tools, retainer + AR data is paste-only | Medium | High | Medium | ⚠ Borderline |
| **Lead Qualification (Business Developer)** | High — has tools | High | High | High | ✅ Yes |

**Three borderline outputs + one outright fail.** COO is broken (no project-management tool, just `knowledge_lookup`). Fulfillment Orchestrator + Delivery Package don't deliver actual builds. Multi-client Account Manager risks generic communications.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Instantly key invalid | Business Developer's `instantly_*` tools fail → cold campaigns stall | P1 |
| 2 | HubSpot CRM offline | Required integration but no agent calls it directly. **Agents continue working with KB-only data.** Pipeline state diverges from CRM. | **P1** |
| 3 | Cold launching unwarmed Instantly domain | Setup Checklist warns; Business Developer system prompt doesn't enforce. **Agent could fire `instantly_launch_campaign` on Day 1 and burn the domain.** | **P0** |
| 4 | 30-client Account Manager scaling | Each client requires its own KB context. No isolation = generic outputs across all clients. | **P0 — see C8** |
| 5 | Customer fires Proposal Draft workflow without discovery transcript | Proposal Writer's escalation rules say "Never ship a proposal without ROI math" — but agent has no validation step. Could draft a vague proposal anyway. | P1 |
| 6 | 3am unsupervised | Workflows: Client Update Report, Project Status, Weekly Leadership Review = `review_after`. New Lead Qualification = `approve_first`. Proposal Draft = `approve_first`. **Acceptable.** | OK |
| 7 | Fulfillment Orchestrator hits the n8n/Make execution wall | "Sprint 2 adds direct MCPs" per setup checklist. Until then, agent drafts brief; operator executes. **Most pipeline output sits in operator queue.** | **P0 (existing — the contract gap)** |
| 8 | 50-lead cold email blast burns Instantly inbox | Setup Checklist mentions warmup but no agent enforces volume ramping or deliverability monitoring | **P1** |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup Checklist forks: "Pick archetype: traditional OR AI agency." 4 agents go dormant for traditional. | ⚠ Bifurcation = onboarding-confusing |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 13 KB items including productized-pricing playbook, niche guidance, cold email playbook, discovery framework | ✅ Strong on AI agency content. **Thin on traditional creative agency content.** |
| **Voice** | "Confident, organized, partner-oriented." For AI agency: "Consultative, ROI-framed, never hours-based pricing." | ⚠ Dual voice profiles. AI agency voice is premium. Traditional voice is generic. |
| **Progress visibility** | Weekly Leadership Review + Weekly Client Update + Project Status = 3-tier cadence | ✅ Adequate |
| **Handoff moments** | New Lead Qualification + Proposal Draft + Paid Ad Spend Approval are `approve_first`. CEO discretion on pricing. | ✅ |
| **The 90% rule** | AI agency archetype: ~70% (Fulfillment is operator-bottleneck'd). Traditional: ~50% (4 agents dormant + COO/Account Manager have minimal tools). | ⚠ Lower than implied |
| **systemPromptTemplate (template-level)** | ONE SENTENCE | ⚠ Anemic for an 8-agent product |
| **guardrailsTemplate (template-level)** | TWO SENTENCES | ⚠ Anemic |

---

## C7. Cost efficiency

For the AI Automation Reseller archetype:
- LLM weekly: ~$3-5 across 8 agents at typical proposal/discovery cadence
- Resend: $20/mo
- HubSpot Starter: $20-50/mo OR GoHighLevel Agency Unlimited: $297/mo
- Instantly: $97/mo Pro + $30-100/mo for sending domain warmup
- Stripe: transaction fees only
- **Total: $150-500/mo infrastructure**

**Cost guardrails missing:** zero. Cold email at $0.03/email × 1,000/day × 30 days = $900/mo unchecked.

**Cost-tier-down opportunity:** Proposal Writer + Offer Architect benefit from Sonnet 4.5 (writing-heavy). Account Manager + COO can run on Haiku (status-update-heavy). 50%+ LLM savings. Not implemented.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: Bifurcated identity — split into two templates
**What:** Setup Checklist's first action: *"Pick archetype: traditional creative/dev agency OR AI automation reseller. The Offer Architect, Proposal Writer, Fulfillment Orchestrator, and Case Study Producer agents stay dormant for traditional agencies; the Business Developer runs differently."*

**Why it matters:** Priority 5 (Premium polish) + Priority 1 (Functional). Half the agents go dormant for half the buyers. Two products competing for one template slot. Customers paying $497 deserve a focused product.

**Fix options:**
- **Path A (recommended): Split into two templates.**
  - `agency_creative` — CEO + Account Manager + COO + Business Developer + (new) Marketing Manager. 5 agents focused on traditional creative/dev/marketing agencies. Required: Resend + Stripe (retainers). Suggested: HubSpot, social_media_mcp.
  - `agency_ai_automation` — CEO + Account Manager + Business Developer + Offer Architect + Proposal Writer + Fulfillment Orchestrator + Case Study Producer. 7 agents. Required: Resend + GoHighLevel. Suggested: HubSpot (alternative), Instantly, Stripe.
  - Effort: ~6 hours (refactor existing 8-agent definition into two clean templates).
- **Path B (compromise): Make the AI Automation Reseller a toggleable addon on `agency`.** Following the same pattern as `tiktok_shop` Organic Ladder addon. Core template = traditional creative agency (5 agents). Addon = AI Automation Reseller (3 extra agents: Offer Architect, Proposal Writer, Fulfillment Orchestrator + Case Study Producer reframed).
  - Effort: ~4 hours (less than Path A but constrains AI agency to "addon" framing which may misrepresent its centrality).

I recommend **Path A**. The two archetypes have different ICPs, different monetization, different sales motions, different pricing — they're products, not features.

### P0-2: Fulfillment Orchestrator has only `knowledge_lookup` — cannot orchestrate
**What:** Fulfillment Orchestrator's role: *"Coordinates the actual automation build once a client signs. Writes build briefs, assigns subcontractors (if applicable), runs QA checklists, and packages final delivery with documentation + training videos."* `tools: ["knowledge_lookup"]`.

**Why it matters:** Priority 1 (Functional) + Priority 2 (Output Quality). Customer signs $5K-$50K → expects build delivery → gets a build brief and a checklist. Same trap as `ghost_operator`'s Builder.

**Fix:** Two paths.
- **Path A (clarify the contract):** Rename to "Build Architect" or "Delivery Coordinator." Update system prompt to be honest: *"You produce the build specification + QA checklist. The operator (or their subcontractor / their preferred execution tool) builds the automation. You document the delivery and own the retainer-at-signing."*
- **Path B (deliver):** Add tools — `n8n_create_workflow`, `make_create_scenario`, `zapier_create_zap` (don't exist yet — Sprint 2 per setup checklist). Add `slack_post_message` so the agent can hand off to subcontractors via Slack. Add `loom_*` for video walkthroughs (also doesn't exist).

Path A for ship; Path B for roadmap. Either way, the customer-facing description should match.

### P0-3: COO has only `knowledge_lookup` — cannot track projects
**What:** COO: *"Manages project delivery across all accounts: tracks milestones, maintains quality standards, creates briefs and proposals, and ensures the team delivers on time and on budget."* `tools: ["knowledge_lookup"]`.

**Why it matters:** Priority 1 (Functional). For an agency operator, project management visibility is THE operational input. COO can't track without tools.

**Fix:** Add to COO's `tools[]`:
```diff
  tools: [
+   "send_email",
+   "send_telegram_message",
+   "delegate_task",
    "knowledge_lookup"
+   // Slack tools (auto-attach when slack_mcp installed):
+   // slack_post_message, slack_list_channels
  ]
```
And consider promoting `slack_mcp` from suggested to recommended for project-management visibility. Update system prompt: *"Coordinate via Slack channel where status updates land — operator sees delivery state without checking dashboard."*

### P0-4: HubSpot required but no agent has hubspot_* tools
**What:** `requiredIntegrations: ["resend_mcp", "hubspot_mcp"]`. No agent's `tools[]` references any `hubspot_*` tool. Auto-attach happens at runtime when MCP is installed, but no system prompt tells any agent to use it.

**Why it matters:** Priority 3 (Integration Health). Customer pays for HubSpot, expects pipeline integration, gets... whatever the auto-attach mechanism happens to surface.

**Fix:**
- If splitting templates per P0-1, traditional creative agency requires HubSpot OR Stripe (depends on archetype). AI Automation Reseller requires GoHighLevel.
- If keeping merged, change `requiredIntegrations` to `[]` (none required) and let operator pick HubSpot OR GHL OR neither. Update Business Developer's `tools[]` to add HubSpot tools when HubSpot is the chosen CRM.

### P0-5: System prompts don't enumerate the actual tool runtime (library-wide)
Same fix.

---

## C9. P1 issues

### P1-1: `primaryModel` not set + no fallback
Same library-wide gap.

### P1-2: No multi-client-isolation model
**What:** Account Manager handles ALL clients with one KB pool. No way to scope an agent's context to a specific client.

**Fix:** Add a `clients[]` data model on the business + a `currentClient` config that scopes Account Manager + COO to one client at a time. Or accept this is a Sprint 3+ infrastructure improvement and document in setup checklist that *"this template scales linearly to ~10 clients per operator. Beyond that, multi-tenant client isolation is on the roadmap."*

### P1-3: No agency-self-marketing agent
Traditional creative agencies grow via inbound + thought leadership. **Add a Marketing Manager agent (in the creative-agency template if split, or as an addon if merged) with social_media_mcp + content tools wired.**

### P1-4: No retainer-billing workflow
Stripe is suggested but no workflow drives retainer collection. Add:
```typescript
{
  name: "Monthly Retainer Health Check",
  description: "CEO reviews Stripe retainer subscriptions: active count, MRR, churn signals (failed payments 3+ times = at-risk), expansion opportunities (clients on Starter retainer for 6+ months who could upgrade). Identifies clients to call.",
  trigger: "scheduled",
  output: "report",
  scheduleMode: "every",
  frequency: "monthly",
  approvalMode: "review_after",
  agentRole: "CEO"
}
```

### P1-5: Cold email warmup discipline not enforced at agent level
**Fix:** Update Business Developer's system prompt:
```
COLD EMAIL DEPLOYMENT GATE:
Before launching any new sending domain at scale (>50 emails/day), verify
the domain has been warmed for at least 10 days. If unverified, refuse to
call instantly_launch_campaign and surface to operator with:
"Sending domain X has not completed 10-day warmup. Cold launching will
permanently damage deliverability. Do you want to (a) wait for warmup,
(b) use a different already-warmed domain, or (c) override (not recommended)?"
```

### P1-6: No discovery-call agent
Operator runs discovery calls manually. No transcription, no auto-extraction of the 4 fields the Proposal Writer needs.

**Fix:** Add Discovery Caller agent with `transcribe_audio` (Whisper auto-attached for VIDEO_PRODUCTION_TEMPLATES). Or wire a Loom-recording → Whisper transcript → Proposal Writer pipeline.

### P1-7: No spend ceiling on cold email
**Fix:** Add to Business Developer's system prompt:
```
COST GUARDRAILS:
- Maximum 1,000 cold emails / day per Instantly campaign.
- Maximum 50 LinkedIn DMs / day per Sendpilot account.
- Hard stop at $300/month total cold-outreach budget unless operator raises.
```

### P1-8: Auto-attached video stack
Same as `ghost_operator` — remove `agency` from `VIDEO_PRODUCTION_TEMPLATES`. None of the 8 agents are designed to use video tools.

### P1-9: Template-level systemPromptTemplate is one sentence
**Fix:** Expand to ~150-300 words covering: agency-as-business-system framing, productized vs custom-pricing rule, retainer-at-signing rule, client-isolation principle (or acknowledgment of single-pool reality), case-study-as-marketing-asset rule, escalation thresholds.

### P1-10: guardrailsTemplate is two sentences
**Fix:** Add: never quote without ROI math, never offer hours-based pricing, never let a build go live without operator-confirmed QA, escalate scope creep before it becomes contract dispute, never share client data across accounts (multi-tenant discipline), never blast cold email without warmup discipline.

---

## C10. P2 issues

### P2-1: AI agency niche-pain content is vivid; traditional agency niche-pain content is generic
"Common prospect questions" KB and "Service lines and packages" KB are placeholders for traditional agencies. The AI agency content has playbooks, niche pain points, ROI frames. Asymmetric.

### P2-2: PROPOSAL_LIBRARY.md template
Workspace doc is a starting point. **Could pre-seed 2-3 example niche entries** (home services, med spas) so AI agency operators see a populated artifact on Day 1.

### P2-3: 6 workflows for 8 agents
No workflow drives Offer Architect, Fulfillment Orchestrator, or Case Study Producer specifically. Add:
- `Productized Offer Catalog Refresh` (quarterly, agentRole: Offer Architect)
- `New Build Kickoff` (manual/on-signed-contract, agentRole: Fulfillment)
- `30-Day Case Study Producer` (per-client, agentRole: Case Study)

### P2-4: Discovery call framework KB is operator-side, not agent-side
Could rewrite to be agent-runnable if a Discovery Caller agent is added.

### P2-5: No Slack alerts for delivery risks
COO needs `slack_mcp` wiring to surface "this milestone slipped 3 days" in real-time. Currently weekly status report only.

---

## Summary fix-time for `agency`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (5) | Split bifurcated identity (recommended), Fulfillment tool wiring, COO tool wiring, HubSpot vs GHL clarity, system-prompt tool enumeration | **6-8 hours** (Path A split) OR **4 hours** (keep merged + fix in place) |
| P1 (10) | primaryModel + fallback, multi-client isolation, marketing agent, retainer workflow, warmup gate, discovery agent, spend ceiling, video stack cleanup, expanded system prompt + guardrails | **5-6 hours** |
| P2 (5) | balanced KB content, demo data in PROPOSAL_LIBRARY, missing workflows, agent-side discovery, Slack delivery alerts | **2-3 hours** |

**Total to S-tier: ~13-17 hours.** This template has the strongest AI-Automation-Reseller domain content in the library — but the bifurcated structure undermines the premium feel. **The fastest path to ship: take Path A (split into two), tighten each independently. ~2 days of work — but the result is two ship-ready templates instead of one confused product.**

---

**Next message:** Section C for `local_lead_gen` (rank #8 — `NEEDS WORK`). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/8 — local_lead_gen  (transcript line 844, 27625 chars) -->
<!-- ============================================================ -->

Got the full picture — this template is more sophisticated than my Section B summary suggested. Writing the audit.

---

# SECTION C — TEMPLATE 8/19: `local_lead_gen` (Local Lead Gen Agency)

**Verdict:** **NEEDS WORK** but on the SHIP side of the line (~1 day to S-tier — closer to SHIP than my initial Section B ranking implied).
**Headline:** I underrated this in Section B. The 5 substantive KB items are *dense playbooks*, not stubs — month-by-month rank timeline expectations, niche selection (what works / what never works), niche × city × population rent pricing tables, contractor retention failure modes, and the hard rented-mailbox warning. The CallRail integration is the most thorough lead-quality QA system in the library — real/tire-kicker/spam scoring with auto-forward + monthly contractor retention reports backed by call recordings. **The brand voice is premium** — "calm, contractor-friendly, proof-first," refuses lead-gen-spam tone. **The real issues are smaller than I implied:** typo bugs in agent tool arrays, no spend ceiling, the unavoidable Sprint-2 gap on GBP/citation/site-build automation, and the library-wide patterns (no model pinning, system prompts don't enumerate auto-attached tools). **Quality > count on KB items here. My Section B "KB at 6 items is thin" critique was wrong** — the 5 deep KBs do more operator-protecting work than 20 shallow ones.

## C1. Functional walkthrough — first-site happy path

The 6-month rank-and-rent cycle: niche selection → site build → GBP + citations → content engine → call tracking → contractor outreach → retention. Tracing one cycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Portfolio coordination** | **Portfolio Lead** | All site outputs | Per-site dashboard, prioritization, buy/build/kill calls | `knowledge_lookup`, `web_search`, `send_email`, `propose_todo`, `list_todos` + BUILTIN | Weekly portfolio review | ✅ EXPLICIT |
| **Sourcing** | **Niche + City Scanner** | Operator's target metros | Score 20+ niche × city candidates against 4-gate filter (Maps weakness × SERP weakness × volume × KD) | `web_search`, `knowledge_lookup`, `ahrefs_keyword_overview`, `ahrefs_keyword_difficulty`, `ahrefs_search_volume`, `ahrefs_serp_overview`, `semrush_keyword_overview`, `semrush_keyword_magic`, `semrush_local_pack_tracking` | Ranked green/yellow/red list | ✅ EXPLICIT to Keyword Analyst |
| **Validation** | **Keyword + Volume Analyst** | Approved niche × city | Keyword universe map (primary + secondary + long-tail), seasonality, KD validation | `web_search`, `knowledge_lookup`, `ahrefs_keyword_overview`, `ahrefs_search_volume`, `ahrefs_serp_overview`, `semrush_keyword_overview`, `semrush_keyword_magic` | Keyword universe + site architecture map | ✅ EXPLICIT |
| **Content** | **Site Builder** | Keyword map + niche × city | 5+ pages markdown + LocalBusiness/Service/FAQPage schema + NAP block + E-E-A-T signals | `web_search`, `knowledge_lookup` | Markdown files + JSON-LD schema | 🔴 BREAK — operator pastes into Snapps.ai / WordPress manually. No site-build tool. |
| **GBP** | **GBP Optimizer** | Site live + verifiable address | Categories + services + 30-day post schedule + photo guidelines + review request flow | `web_search`, `knowledge_lookup` | GBP setup package | 🔴 BREAK — no GBP API tool. Operator clicks through Google Business Profile UI manually. |
| **Citations** | **Citation Builder** | Site NAP | 50+ citation portfolio Tier 1/2/3 staged over 60 days | `web_search`, `knowledge_lookup` | Submission-ready data payloads + schedule | 🔴 BREAK — explicit per role: *"data payloads (not live submissions — citations require manual verification in many cases)"*. Operator submits to BrightLocal/Whitespark or manually. |
| **Content engine** | **Content Engine** | Long-tail keyword bank | 1,200-1,800 word post/week/site, featured-snippet structure, internal linking silos | `web_search`, `knowledge_lookup` | Markdown post | 🟡 IMPLICIT — operator publishes via CMS |
| **Lead QA** | **Call Tracking + Lead QA** | CallRail inbound | Score every call REAL/TIRE_KICKER/SPAM, forward REAL within 2 min, daily quality report | `knowledge_lookup`, `callrail_list_calls`, `callrail_get_call`, `callrail_get_call_recording`, `callrail_get_call_transcript`, `callrail_tag_call`, `callrail_send_to_webhook`, `send_email` | Daily quality report + forwarded leads | ✅ EXPLICIT — auto workflow |
| **Outreach** | **Contractor Outreach + Retention** | Site ranked + 30-day call data | Top-20 contractor identification + 3-touch cold email backed by CallRail screenshots; monthly retention report | `send_email`, `web_search`, `knowledge_lookup`, `callrail_list_calls`, `callrail_get_call`, `callrail_get_call_recording`, `smartlead_*`, `instantly_*`, `ghl_*`, **`hubspot_mcp`** ⚠ | Cold sequences + monthly retention | ⚠ Tool list contains `"hubspot_mcp"` (the MCP id) listed as if it's a tool name — invalid |

### Break points

1. **Site Builder, GBP Optimizer, Citation Builder are all "draft + operator-executes" agents** — the agent produces specs / payloads / schedules that the operator manually executes in Snapps.ai / Google Business Profile / BrightLocal. **All three are honestly disclosed in the role + setup checklist** ("Citation Builder generates submission schedule + data payloads; you execute submissions in BrightLocal/Whitespark OR submit manually"). But the cumulative effect is: the operator spends substantial Day-1-to-30 time pasting agent outputs into external UIs. **Customer expectation depends on how the marketing positions this. If sold as "agents build sites for you," it under-delivers. If sold as "agents do the strategic + analytical work; you execute in the tooling you already use," it matches reality.**

2. **`hubspot_mcp` listed as a tool name in Contractor Outreach's `tools[]`** — line 7555: `"hubspot_mcp"`. That's an MCP id, not a tool name. Likely typo/shorthand for "give this agent HubSpot tools when MCP installed." **At runtime this entry is invalid and ignored** — the actual HubSpot tools (whatever they are) auto-attach via `getToolsForAgent` when the MCP is installed. Cosmetic bug but should be cleaned up.

3. **`Daily Lead Quality + Forward` workflow is `approvalMode: "auto"`** — runs daily, autonomously forwards REAL leads to contractor. **This IS correct** — real-time forwarding has to be auto. But it means a misclassified spam call could get forwarded, OR a real call could be misclassified as spam and never reach the contractor. **No human gate on the lead-classification step.** Acceptable risk for the model — but should be auditable (CallRail tags create the audit trail; Setup Checklist mentions this).

4. **GBP suspension monitoring missing** — guardrails say *"Escalate any GBP suspension signal (verification failed, listing disabled)"* but no agent runs a daily/weekly GBP health check. Suspensions are detected when the operator notices.

5. **Inter-agent coordination via Portfolio Lead** — Portfolio Lead has `propose_todo` + `list_todos` (BUILTIN) but not `delegate_task`... wait, actually does it? Let me check: Portfolio Lead `tools: ["knowledge_lookup", "web_search", "send_email", "propose_todo", "list_todos"]`. **No `delegate_task` listed even though it's `type: "main"` and BUILTIN should add `delegate_task` for leaders.** The BUILTIN_ALWAYS_ON list ([tool-registry.ts:4754](lib/mcp/tool-registry.ts:4754)) includes `delegate_task` for everyone. So it's available at runtime. ✅

6. **No `whatsapp_send_*` in any agent's tools** — Call Tracking + Lead QA's system prompt says *"forward REAL leads to the contractor within 2 min via their preferred channel (WhatsApp / SMS / email based on their setup)"*. But the agent's `tools[]` only has `send_email` for messaging. **WhatsApp + SMS forwarding is auto-attach via `whatsapp_cloud_mcp` / `twilio_mcp`** — agent has them at runtime if installed but doesn't explicitly know to call them.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `resend_mcp` | **Required** | Auto-attached when installed | ✅ Configured | Multiple agents have `send_email` |
| `callrail_mcp` | Suggested | Auto-attached when installed | ✅ **Best-in-library lead QA wiring** | Call Tracking has 7 callrail_* tools; Contractor Outreach has 3 |
| `ahrefs_mcp` | Suggested | Auto-attached when installed | ✅ Wired | Niche Scanner + Keyword Analyst have 4-5 ahrefs_* tools each |
| `semrush_mcp` | Suggested | Auto-attached when installed | ✅ Wired | Niche Scanner + Keyword Analyst have semrush_* tools |
| `whatsapp_cloud_mcp` | Suggested | Auto-attached when installed | ⚠ No agent's `tools[]` references `whatsapp_send_*` | Lead-forwarding flow assumes auto-attach delivers it |
| `twilio_mcp` / `telnyx_mcp` | Suggested | Auto-attached when installed | ⚠ Same | Setup checklist has actual opinion (*"Telnyx is ~50% cheaper than Twilio"*) — better than dealhawk's triad ambiguity |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent's `tools[]` lists publishing tools | Setup checklist says cross-posting blog content supports rank signals |
| `hubspot_mcp` | Suggested | When installed | ⚠ Listed as a "tool name" in Contractor Outreach's `tools[]` (invalid) | Cosmetic typo |
| `smartlead_mcp` | Mentioned in setup | Auto-attached when installed | ✅ Wired | Contractor Outreach has 4 smartlead_* tools |
| `instantly_mcp` | Mentioned in setup | Auto-attached when installed | ✅ Wired | Contractor Outreach has 3 instantly_* tools |
| Auto-attached video stack | ✅ Configured (per `VIDEO_PRODUCTION_TEMPLATES`? No — `local_lead_gen` is NOT in the set) | ❌ Not auto-attached | ✅ Clean | Good — no dead-weight tools |
| BrightLocal / Whitespark | Mentioned in setup as "no MCP yet" | ❌ Not wired | ⚠ Operator-side | Citation Builder produces submission payloads; operator submits via BrightLocal/Whitespark or manually |
| Snapps.ai / WordPress | Mentioned in setup as "no MCP" | ❌ Not wired | ⚠ Operator-side | Site Builder outputs markdown; operator pastes |
| Google Business Profile API | Not wired | ❌ Not wired | ⚠ Operator-side | GBP Optimizer outputs strategy; operator clicks through GBP UI |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for the 4 well-wired integrations)

| Check | `callrail_mcp` | `ahrefs_mcp` | `semrush_mcp` | `instantly_mcp` / `smartlead_mcp` |
|---|---|---|---|---|
| Credential flow | API key + per-account setup ✅ | API key ✅ | API key ✅ | API keys + warmup setup |
| Call construction | Standard schema ✅ | ✅ | ✅ | ✅ |
| Rate limit awareness | ❌ Not in agent system prompts | ❌ | ❌ | ⚠ Setup checklist mentions warmup; agent doesn't enforce |
| Error handling | Per global no-retry rule | Same | Same | Same |
| Cost ceiling | ⚠ CallRail is per-call + per-tracking-number ($50+/mo per location); no template-level cap | ⚠ Ahrefs $129+/mo flat — fixed cost, agent could over-query | ⚠ Same | ❌ Cold email at $0.03/email could blast unbounded |
| Fallback path | ❌ | ❌ Ahrefs ↔ SEMrush as alternatives but no auto-fallback | ❌ | ❌ Smartlead ↔ Instantly alternatives but no auto-fallback |
| Model/version pinning | ✅ Provider-locked | ✅ | ✅ | ✅ |
| Tool enumeration in system prompts | ✅ Call Tracking enumerates tools | ✅ Niche Scanner enumerates | ✅ Same | ✅ Contractor Outreach enumerates |

**Best integration enumeration in the library** — the Niche Scanner, Keyword Analyst, Call Tracking, and Contractor Outreach system prompts all explicitly reference their tools by name. Library-wide P0 (system prompts not enumerating runtime) is partially solved here. Other agents (Portfolio Lead, Site Builder, GBP Optimizer, Citation Builder, Content Engine) still don't enumerate.

---

## C3. Media generation deep-check

**Not applicable.** No image/video/voice/music generation needed. Site visuals come from CMS templates + stock + contractor-supplied photos. ✅ Correctly scoped — `local_lead_gen` is NOT in `VIDEO_PRODUCTION_TEMPLATES`.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $497? |
|---|---|---|---|---|---|
| **Weekly Niche × City Opportunity Report** | High — 4-gate filter explicit | High — Ahrefs/SEMrush data-grounded | High | High | ✅ Yes |
| **Keyword universe map** | High — siloed by site architecture | High | High | High — Site Builder consumes directly | ✅ Yes |
| **Site content (markdown + schema)** | High — 5 pages, NAP-consistent, E-E-A-T signals | High | High | Medium — operator pastes into CMS | ⚠ Borderline ("we wrote you a site" but operator builds it) |
| **GBP package** | High — categories + services + posts + photos + verification | High | High | Medium — operator executes in GBP UI | ⚠ Borderline |
| **Citation submission schedule + payloads** | High — Tier 1/2/3 staged 60 days | High | High | Medium — operator submits manually | ⚠ Borderline |
| **Weekly blog post** | High — featured-snippet-structured, contractor voice | High | High | High when operator publishes | ✅ Yes |
| **Daily lead quality report** | High — REAL/tire-kicker/spam tags + recordings | High | High | High — auto-forward + audit trail | ✅ Yes |
| **3-touch cold email sequence** | High — backed by CallRail screenshots, 100-word constraint | High | High — premium voice | High | ✅ Yes |
| **Monthly contractor retention report** | High — call count + real-lead count + revenue estimate + recordings | High | High | High — sent 1st of month | ✅ **Best deliverable in the template** |
| **Portfolio Tracker** | High — fund-manager-style health colors | High | High | High | ✅ Yes |
| **Contract templates** (3 — flat / pay-per-lead / revenue share) | High — attorney-call-out for >$1K/mo deals | High | High | High — paste-ready | ✅ Yes |

**Three borderline outputs** — Site content, GBP package, citation submissions all rely on operator execution. All three are honestly disclosed but cumulatively reduce the autonomy feel. **The retention report is the standout — best contractor-facing deliverable in the library.** That report alone justifies a meaningful portion of the SKU's value.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Operator's CallRail key invalid | Call Tracking + Lead QA fails. **Daily auto-forward stalls — contractor doesn't get leads.** Worst-case: contractor churns blaming operator. | **P0** — best-in-library lead QA breaks silently |
| 2 | Ahrefs API rate-limited | Niche Scanner + Keyword Analyst stall. Setup checklist's note about Ahrefs vs SEMrush positioning means operator can switch — but no auto-fallback. | P1 |
| 3 | Operator pastes wrong NAP into one Tier 1 citation | Citation Builder enforces NAP consistency in system prompt but doesn't validate operator-side submissions. **NAP inconsistency degrades rank silently.** | P1 |
| 4 | GBP gets suspended | Guardrails say escalate; no agent monitors GBP health. **Suspension detected when operator notices ranking drop.** | **P0** |
| 5 | Customer fires "Contractor Outreach Sprint" before site has any rank | Contractor Outreach assumes CallRail data exists for the email screenshots. **Fires anyway with empty data.** | P1 |
| 6 | 3am unsupervised | Daily Lead Quality + Forward = `auto` (correct for real-time forwarding). Other workflows are `review_after` or `approve_first`. **Acceptable.** | OK |
| 7 | Customer scales 1 → 10 sites | Each site needs CallRail (~$50+/mo per location) + GBP + citations + content + outreach. **CallRail cost: ~$500-$1000/mo for 10 sites.** Setup checklist is honest about the cost. **Operator-side discipline.** | OK |
| 8 | Cold email blast hits Smartlead/Instantly rate limits | Per global no-retry rule, single failure surfaces. **No fallback chain Smartlead↔Instantly even though both are wired.** | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + month-by-month rank timeline + GBP-rented-mailbox hard warning + niche selection KB | ✅ **Best onboarding for buyer-expectation-setting in the library.** Solves the #1 churn driver (operator abandonment at month 3). |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 5 dense KB items + 2 workspace docs (PORTFOLIO_TRACKER + CONTRACTOR_CONTRACTS) | ✅ Quality > count. KB items are operating playbooks, not stubs. |
| **Voice** | "Direct, contractor-friendly, proof-first. No 'we'll flood you with leads' language. No guarantees. Written communication always leans on CallRail recordings as proof." | ✅ Premium voice — distinct from agency-template "consultative" generic. |
| **Progress visibility** | Daily lead QA + weekly content drop + weekly portfolio review + monthly contractor retention report = 4-tier cadence | ✅ Strong |
| **Handoff moments** | New Site Launch + Contractor Outreach Sprint + Citation Build = `approve_first`. Daily Lead QA + GBP 30-Day Warmup = `auto`/`review_after`. Sensible. | ✅ |
| **The 90% rule** | ~60% autonomous. Site Builder, GBP Optimizer, Citation Builder = operator-side execution. But CallRail QA + retention reports + outreach are genuinely autonomous. | ⚠ Below 90% — but **honest about it** in setup checklist |
| **Brand differentiation** | Rank-and-rent specialty + lead-quality-as-product is distinctive. Most rank-and-rent guru content treats the call-tracking layer as an afterthought. | ✅ Premium |

---

## C7. Cost efficiency

For a 5-site portfolio:
- LLM weekly: ~$2-4 across 9 agents at typical research/scoring/outreach cadence
- CallRail: $50+/mo × 5 = $250+/mo (5 tracking numbers minimum)
- Ahrefs OR SEMrush: $129-$139/mo
- Resend: ~$20/mo
- Domains: $12-$20/year × 5 = ~$10/mo
- Hosting: $5-$15/mo (WordPress) or $30-$50/mo (Snapps.ai)
- Smartlead OR Instantly: ~$97/mo
- Optional: GoHighLevel ($297/mo for portfolio scale), BrightLocal ($29-$79/mo), Twilio/Telnyx ($20-$30/mo)
- **Total: $560-$870/mo at 5-site portfolio**

**Goal in the template:** 10 sites × $800/mo = $8K MRR. Net: $7K-$7.4K MRR after infra.

**Cost guardrails missing:**
- No spend ceiling on Smartlead/Instantly cold email (~$0.03/email × 1K/day = $900/mo)
- No CallRail call-volume cap per site
- No Ahrefs/SEMrush query budget

**Cost-tier-down opportunity:** Niche Scanner + Keyword Analyst run validation queries — could use Haiku for volume scoring (cheap), Sonnet 4.5 for the green-light decisions. ~50% LLM savings.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: GBP suspension not monitored
**What:** Guardrails escalate on suspension; no agent does daily/weekly GBP health checks. Suspension is the #1 operator-killer (per the rented-mailbox KB) but detection is reactive.

**Why it matters:** Priority 1 (Functional) + Priority 4 (Error handling). Suspended GBP = dead site = lost contractor revenue. **A 1-day delay in detection costs days of forwarding to contractors who think the site is live.**

**Fix:** Add a workflow:
```typescript
{
  name: "Daily GBP Health Check",
  description: "GBP Optimizer pings each site's Google Business Profile listing daily — verifies the listing is live, indexed in Maps, not flagged with verification warnings. Surfaces any anomaly (suspended, disabled, edit reverted) within 24 hours of detection. Recovery is hard; early detection matters.",
  trigger: "scheduled",
  output: "report",
  scheduleMode: "every",
  frequency: "daily",
  approvalMode: "notify",
  agentRole: "GBP Optimizer"
}
```
And update GBP Optimizer's `tools[]` to add a way to detect listing state — for now `web_search` against the GBP listing URL is the operator-side fallback. (A `gbp_*` MCP would close this gap; flag for Sprint 2.)

### P0-2: CallRail key invalidation breaks the auto-forward silently
**What:** Daily Lead Quality + Forward workflow is `auto`. If CallRail key fails, the daily forward stalls. Contractor doesn't get leads. **Contractor blames operator.** No alert to operator.

**Why it matters:** Priority 1 (Functional) + Priority 5 (Premium polish). The retention report is the moat — if it depends on data that's silently broken, the moat collapses.

**Fix:** Add to Call Tracking + Lead QA's escalation rules:
```diff
+ Escalate IMMEDIATELY when CallRail returns auth errors or returns zero calls
+ for 24+ hours on a site that previously had call volume (suggests key
+ rotation, account suspension, or tracking number break). Send Telegram +
+ email alert to operator within 2 hours of detection.
```
And add `send_telegram_message` to the agent's tools (BUILTIN, already available). Update workflow to include a CallRail health check as a sanity step.

### P0-3: `"hubspot_mcp"` listed as a tool name in Contractor Outreach's `tools[]`
**What:** Line 7555: `"hubspot_mcp"`. That's the MCP id (a server identifier), not a tool name. Invalid entry — at runtime the platform looks for a tool named `hubspot_mcp` and finds none.

**Why it matters:** Priority 3 (Integration health). Cosmetic but error-prone. Sets a precedent for malformed tool arrays.

**Fix:** Remove the `"hubspot_mcp"` entry. HubSpot's individual tools auto-attach when the MCP is installed. Or, if intent was to make HubSpot tools explicit, add specific tool names like `hubspot_create_contact`, `hubspot_create_deal`, `hubspot_get_pipeline` (verify these exist in tool registry).

### P0-4: System prompts mostly enumerate runtime tools (good!) but Portfolio Lead, Site Builder, GBP Optimizer, Citation Builder, Content Engine don't
**What:** Library-wide pattern. Niche Scanner, Keyword Analyst, Call Tracking, Contractor Outreach are good. Other 5 agents don't enumerate.

**Fix:** Same pattern as other templates — append "TOOLS YOU HAVE ACCESS TO" block to those 5 agents.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No spend ceiling on cold outreach
Same library-wide. Add to Contractor Outreach system prompt:
```
COST GUARDRAILS:
- Maximum 100 cold emails / day per Smartlead or Instantly campaign
- Hard stop at $300/month total cold-outreach budget unless operator raises
```

### P1-3: WhatsApp / SMS lead-forwarding tools not in Call Tracking's `tools[]`
**What:** Call Tracking + Lead QA needs to forward leads via "WhatsApp / SMS / email." Has `send_email`. WhatsApp/SMS auto-attach via `whatsapp_cloud_mcp` / `twilio_mcp` when installed.

**Fix:** Add explicit tools (auto-attach handles runtime, but explicit is documented):
```diff
  tools: [
    "knowledge_lookup",
    "callrail_*",
    "send_email",
+   "send_sms",
+   "whatsapp_send_text_message",
+   "whatsapp_send_template_message",
+   "send_telegram_message"
  ]
```

### P1-4: Site Builder, GBP Optimizer, Citation Builder operator-execution gap
The framing-as-honest pattern. Either:
- (a) Update template description to match reality: *"strategy + content + briefs the operator executes in their preferred tooling (Snapps.ai / WordPress / GBP UI / BrightLocal)"*
- (b) Wire missing MCPs as Sprint 2: Snapps.ai integration, GBP API, BrightLocal/Whitespark API.

Path (a) for ship-readiness; (b) for roadmap. Setup checklist is already honest; description should match.

### P1-5: Telephony triad — actually has opinion already
Setup checklist says "Telnyx is ~50% cheaper than Twilio for same capability" + "WhatsApp for international, Twilio or Telnyx for US." **More opinion than dealhawk/agency.** Keep as-is. Promote to a clearer recommendation in the system prompt.

### P1-6: No Ahrefs ↔ SEMrush fallback
Setup checklist says *"pick one"* — but if the operator picks Ahrefs and it's down, Niche Scanner can't fall back to SEMrush even though both tool sets exist in the agent's `tools[]`.

**Fix:** Add to Niche Scanner's system prompt: *"Prefer Ahrefs for keyword research. If Ahrefs returns errors or rate-limits, fall back to SEMrush automatically. Surface to operator only if both fail."*

### P1-7: Snapps.ai mention is competitor-adjacent
Setup checklist names "Snapps.ai" as the AI site builder. Same competitor-mention concern as `faceless_youtube`. Replace with category: *"AI site builder (e.g., Snapps.ai or equivalent)"* or *"your preferred site builder."*

### P1-8: `Daily Lead Quality + Forward` workflow auto-classification has no human gate
The `auto` mode is correct for real-time forwarding. **But misclassification is silent.** Add a weekly QA review where operator audits 10 random calls' classifications.

**Fix:** Add workflow:
```typescript
{
  name: "Weekly Lead-Classification Audit",
  description: "Operator (or QA reviewer) audits 10 random calls from the last 7 days against their REAL/TIRE_KICKER/SPAM tags. Flags any misclassifications. Call Tracking agent updates classification rules based on patterns.",
  trigger: "scheduled",
  output: "report",
  scheduleMode: "every",
  frequency: "weekly",
  approvalMode: "review_after",
  agentRole: "Call Tracking"
}
```

### P1-9: Auto-attached video stack — actually NOT applied here
Verified: `local_lead_gen` is NOT in `VIDEO_PRODUCTION_TEMPLATES`. ✅ Clean. No fix needed.

---

## C10. P2 issues

### P2-1: Portfolio Tracker workspace doc could pre-seed example rows
Like `dealhawk_empire`'s demo data seeding — the Portfolio Tracker could ship with 1-2 example rows (different niches, different rent statuses) so operators see "what good looks like" on Day 1.

### P2-2: Contract templates assume US jurisdiction
Three contract templates reference state-law concepts. International operators (UK, AU, CA — the Local Lead Gen model is global) would need different language. **Add a "this is US law; consult attorney for other jurisdictions" callout.**

### P2-3: Citation Builder's "submission-ready data payloads" output format
Could be more specific — JSON, CSV, or markdown? Operators using BrightLocal need CSV; manual submitters need text. Standardize.

### P2-4: 8 workflows for 9 agents — Site Builder has no dedicated workflow
The New Site Launch Sequence is the umbrella, but no specific workflow drives Site Builder. Could be fine if Site Builder is part of the umbrella; could be cleaner as a dedicated workflow.

### P2-5: No demo Portfolio Tracker
Like `dealhawk_empire`'s demo deals. Could seed 2-3 example sites at different lifecycle stages.

---

## Summary fix-time for `local_lead_gen`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | Daily GBP Health Check workflow, CallRail invalidation alerting, `hubspot_mcp` tool typo, system-prompt tool enumeration on 5 agents | **3-4 hours** |
| P1 (9) | `primaryModel` + fallback, spend ceiling on cold email, lead-forwarding tools explicit, description-vs-reality framing, Ahrefs↔SEMrush fallback, Snapps.ai rephrase, weekly classification audit, telephony rec | **3-4 hours** |
| P2 (5) | Portfolio Tracker pre-seed, contract jurisdiction callout, citation payload format, Site Builder workflow, demo data | **1-2 hours** |

**Total to S-tier: ~7-10 hours.** This template was understated in my Section B ranking. **The KB quality, brand voice premium, CallRail wiring, and contractor-retention report are genuine differentiators.** The Site Builder / GBP Optimizer / Citation Builder operator-execution gaps are honestly disclosed and acceptable for the buyer's actual workflow (operators in this niche typically use Snapps.ai or WordPress already and BrightLocal for citations — the template doesn't try to replace those tools, it orchestrates around them). **Closer to SHIP than NEEDS WORK.**

---

**Next message:** Section C for `content_creator` (Newsletter Empire — rank #9). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/9 — content_creator  (transcript line 863, 25114 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `content_creator` (Newsletter Empire).

---

# SECTION C — TEMPLATE 9/19: `content_creator` (Newsletter Empire)

**Verdict:** **NEEDS WORK** but on the SHIP side of the line (~1 day to S-tier — closer to SHIP than my initial Section B placement).
**Headline:** Underrated in Section B. The voice-matching discipline (Writer reads 3+ past issues + matches sentence rhythm + vocabulary), the AI-tells blacklist ("in today's fast-paced world", "have you ever wondered", "delve into", "let's dive into", "in conclusion", em-dash clusters, tricolons), the subscriber-tier-gated revenue stream rules (1K/5K/20K/50K/100K), and the **deliverability fundamentals KB** (SPF/DKIM/DMARC + 2026 list-unsubscribe header + subdomain isolation + engagement pruning) are best-in-library on their respective dimensions. **The real issue: beehiiv is hardcoded.** `requiredIntegrations: ["beehiiv_mcp", "resend_mcp"]` locks out Substack/Kit/Ghost operators even though the KB explicitly compares all four platforms. **The other gaps are smaller than I implied:** library-wide patterns (no model pinning, system prompts mostly enumerate runtime tools but Community Manager + CEO don't), Community Manager has no social-platform tools to actually reply to comments, and `content_creator` is in both `VIDEO_PRODUCTION_TEMPLATES` and `YOUTUBE_API_TEMPLATES` (auto-attached unused tools).

## C1. Functional walkthrough — weekly issue happy path

Newsletter cadence: research brief → editorial calendar → draft + voice-match → CEO review → publish via beehiiv → social repurposing kit → analytics review → monetization-calendar reset. Tracing one week:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Editorial planning** | **CEO** | Last week's analytics + Research brief + Community sentiment | Weekly content calendar with topics, formats, posting schedule, monetization CTA per issue | `web_search`, `knowledge_lookup` + BUILTIN | Weekly editorial calendar | ✅ EXPLICIT to Writer |
| **Research** | **Research Analyst** | Niche + 3-5 peer newsletters | Daily 5-10 story brief scored for novelty + fit; weekly beehiiv analytics review | `web_search`, `knowledge_lookup`, `beehiiv_list_posts`, `beehiiv_get_post_analytics`, `beehiiv_list_subscribers` + BUILTIN | Daily brief + weekly analytics report | ✅ EXPLICIT |
| **Drafting** | **Content Writer** | Editorial brief + research brief + 3+ past issues for voice match | Voice-matched 600-1000 word issue + 3 subject line variants + social repurposing kit (X thread + LinkedIn + Medium) | `web_search`, `knowledge_lookup`, `beehiiv_list_posts`, `beehiiv_get_post_analytics` + BUILTIN | DRAFT issue + repurposing kit | ✅ EXPLICIT to CEO for review |
| **Editorial review** | **CEO** | DRAFT | Voice + accuracy + AI-tells check; primary CTA aligned with monetization calendar | (operator does most of this; agent assists via review) | Approved issue OR revision request | ✅ |
| **Send** | (operator publishes) | Approved issue | Beehiiv send + subject A/B test | (operator-side beehiiv UI) | Live issue | 🟡 IMPLICIT — no scheduled-publish workflow |
| **Social repurposing** | (operator) | Repurposing kit | Cross-post to X/LinkedIn/Medium/Notes | (operator-side OR `social_media_mcp` if installed) | Cross-platform posts | 🔴 BREAK — Writer drafts kit, no agent has `social_publish_post` to actually publish |
| **Community** | **Community Manager** | New comments, DMs, audience signals | Reply within 8 hours, surface sentiment trends | `send_email`, `knowledge_lookup` + BUILTIN | Replies + sentiment report | 🔴 BREAK — agent has email but **no social_media_mcp tools to reply on platforms** where the comments live |
| **Sponsor pipeline** | **Sponsor Hunter** | 50-brand target list | Personalized pitches, beehiiv Ad Network management, pipeline tracking | `web_search`, `knowledge_lookup`, `send_email`, `beehiiv_list_ad_network_offers`, `beehiiv_get_publication` + BUILTIN | Cold pitches + Ad Network optimization | ⚠ Says "tracks pipeline in HubSpot" — no HubSpot tools |
| **Monetization** | **Monetization Stacker** | Subscriber tier + revenue mix | Monthly monetization calendar; subscriber-tier-gated stream activation; revenue-per-subscriber tracking | `knowledge_lookup`, `beehiiv_get_post_analytics`, `beehiiv_list_subscribers`, `beehiiv_list_ad_network_offers` + BUILTIN | MONETIZATION_CALENDAR.md updated | ✅ EXPLICIT to Writer (CTA per issue) |

### Break points

1. **Beehiiv-only lock-in** — `requiredIntegrations: ["beehiiv_mcp", "resend_mcp"]`. The Newsletter platform comparison KB explicitly recommends beehiiv but acknowledges Substack/Kit/Ghost are valid choices. **A Substack operator cannot create this business.** Same flaw `tiktok_shop` and `faceless_youtube` had pre-rebuild (Stripe + Resend wrongly required).

2. **Community Manager can't reply on platforms** — system prompt says *"reply to all comments and DMs within 8 hours"* and tracks audience sentiment "across platforms." Agent's `tools[]` is `["send_email", "knowledge_lookup"]`. **No `social_publish_post`, no `get_comments` (read), no `social_get_analytics`.** Auto-attach is via `social_media_mcp` if installed (suggested, not required) — but Community Manager isn't even told it has those tools at runtime.

3. **Writer's social repurposing kit is unused** — Writer produces X thread + LinkedIn post + Medium cross-post. **No agent has the tools to publish them.** Operator pastes manually OR has Social Media Hub installed AND knows the tools auto-attach.

4. **Auto-attached video stack** — `content_creator` IS in `VIDEO_PRODUCTION_TEMPLATES` per [tool-registry.ts:4785](lib/mcp/tool-registry.ts:4785). **Newsletter Empire is not a video business.** HeyGen/Creatify/ElevenLabs/JSON2Video/B-Roll/Auto-Clip auto-attach to all 6 agents who don't need them. Polluting decision space.

5. **Auto-attached YouTube stack** — `content_creator` IS in `YOUTUBE_API_TEMPLATES` per [tool-registry.ts:4797](lib/mcp/tool-registry.ts:4797). **Newsletter Empire doesn't publish to YouTube.** `youtube_upload_video`, `youtube_get_video_analytics`, etc. auto-attached. More dead weight. *(Comment in tool-registry says "Faceless YouTube + content_creator + social_media_agency" — but `content_creator` doesn't actually publish to YouTube. Should be removed from this set.)*

6. **CEO has minimal tools** — `["web_search", "knowledge_lookup"]`. For an editorial coordinator running an 6-agent media business, that's thin. **No `send_email` to communicate with Sponsor Hunter or operator. No analytics tools to verify performance.** Relies entirely on KB lookups.

7. **No publish workflow** — every workflow is `review_after` or `approve_first`. Operator publishes manually via beehiiv UI. Acceptable but not "autonomous publishing."

8. **Sponsor Hunter mentions "tracks pipeline in HubSpot"** — no HubSpot tools in `tools[]`. Same library-wide pattern.

9. **Inter-agent coordination** — same library-wide pattern. CEO is `type: main` so has `delegate_task` (BUILTIN). Specialists do not.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `beehiiv_mcp` | **Required** | When installed | ✅ Configured | Writer, Research Analyst, Sponsor Hunter, Monetization Stacker have specific beehiiv_* tools |
| `resend_mcp` | **Required** | When installed | ✅ Configured | Sponsor Hunter has `send_email` |
| `stripe_mcp` | Suggested | When installed | ⚠ Auto-attach but no agent has Stripe tools in `tools[]` | "Required once {{businessName}} ships the paid tier" per setup checklist — but no tool wiring |
| `hubspot_mcp` | Suggested | When installed | ⚠ Sponsor Hunter system prompt references HubSpot pipeline; agent has no `hubspot_*` tools | |
| `social_media_mcp` | Suggested | When installed | ⚠ Writer drafts repurposing kit, Community Manager replies to "all comments and DMs" — neither has social_* tools in `tools[]` | |
| Auto-attached video stack (HeyGen, Creatify, ElevenLabs, JSON2Video, B-Roll, Auto-Clip, Whisper, R2) | Auto via `VIDEO_PRODUCTION_TEMPLATES` | ✅ Configured | ⚠ Newsletter doesn't need any of this | **Remove `content_creator` from VIDEO_PRODUCTION_TEMPLATES** |
| Auto-attached YouTube tools | Auto via `YOUTUBE_API_TEMPLATES` | ✅ Configured | ⚠ Newsletter doesn't publish to YouTube | **Remove `content_creator` from YOUTUBE_API_TEMPLATES** |
| Substack / Kit / Ghost / Mailchimp | Mentioned in Newsletter platform comparison KB | ❌ Not wired | ⚠ Operator-side switching impossible | KB recommends "default beehiiv" but template forces it |
| SparkLoop / Boosts marketplace | Mentioned in setup checklist | ❌ Not wired | ⚠ Manual ops | Honestly disclosed |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for the 4 wired beehiiv integrations + resend)

| Check | `beehiiv_mcp` (5 tools across 4 agents) | `resend_mcp` |
|---|---|---|
| Credential flow | API key + custom sending domain | Domain + SPF/DKIM |
| Call construction | Standard schema ✅ | ✅ |
| Rate limit awareness | ❌ Not mentioned in any agent | ❌ |
| Error handling | Per global no-retry rule | Same |
| Cost ceiling | N/A — beehiiv is monthly flat ($43+/mo Scale plan) | ❌ Resend per-send pricing; cold outreach unbounded |
| Fallback path | ❌ No beehiiv → Substack failover | ❌ |
| Model/version pinning | ✅ Provider-locked | ✅ |
| Tool enumeration in system prompts | ✅ Writer, Research Analyst, Sponsor Hunter, Monetization Stacker enumerate beehiiv_* tools | ✅ via `send_email` |

---

## C3. Media generation deep-check

**Not in scope, but auto-attached.** Newsletter Empire doesn't generate AI media. **Recommendation: remove `content_creator` from `VIDEO_PRODUCTION_TEMPLATES` AND `YOUTUBE_API_TEMPLATES`** in `tool-registry.ts:4785, 4797`. Cleanup.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $497? |
|---|---|---|---|---|---|
| **Voice-matched newsletter draft (Writer)** | High — 3+ past issues seed; AI-tells blacklist explicit | High | High **when operator pastes 3+ real past issues into KB** | High | ✅ Yes — best newsletter draft system in library |
| **3 subject line variants per issue** | High — 5-frame system | High | High | High | ✅ Yes |
| **Social repurposing kit** (X thread + LinkedIn + Medium) | High — generated alongside every issue | High | High | Low — no agent publishes it | ⚠ Borderline — kit is good but operator must paste-publish |
| **Daily research brief** | High — 5-10 stories, novelty + fit scored | High — niche-specific | High | High | ✅ Yes |
| **Weekly beehiiv analytics report** | High — open rate trend + CTR + subscriber velocity + revenue-per-subscriber + top/bottom 3 with 'why' | High | High | High | ✅ Yes |
| **Sponsor pitch (50-brand list, personalized)** | High — audience-fit-numbers anchored, 48h deadline | High | High | High | ✅ Yes |
| **Monthly monetization calendar** | High — one CTA per issue, subscriber-tier-gated rules | High | High | High | ✅ Yes |
| **Community engagement report** | Medium — depends on Community Manager's actual ability to gather data from platforms | Medium | High | Medium — without social tools, agent is doing reduced work | ⚠ Borderline |
| **MONETIZATION_CALENDAR.md** | High — structured with rules + monthly review | High | High | High | ✅ Yes |
| **SPONSOR_PIPELINE.md** | High — 8-stage pipeline + brand-fit rejection log | High | High | High | ✅ Yes |

**Two borderline outputs** — social repurposing kit (no publishing tools) and Community Manager engagement report (no social-platform read tools). Both fixable via tool array additions.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Operator's beehiiv API key invalid | Writer can't pull past issues for voice-match. **Voice-matching breaks silently if Writer falls back to its own tone.** | **P0** |
| 2 | Operator hasn't pasted 3+ past issues into KB | Writer voice-matches against placeholder content. Output reads AI-generic. | **P0** — first-week trap |
| 3 | Operator pastes typos/garbage into "Operator voice samples" | Voice match degrades; AI-tells blacklist might still catch the worst | P1 |
| 4 | Sponsor pitch hits a 429 from Resend | Single failure, no retry, surfaces. Acceptable. | OK |
| 5 | 3am unsupervised | All workflows `review_after` (Newsletter Draft, Trending Topic Brief, Performance Review, Engagement Report, Content Plan). New Comment Response = `review_after`. **Acceptable.** | OK |
| 6 | Operator runs Newsletter Draft twice in same week | Stateless. Two drafts produced. **No dedup.** | P1 |
| 7 | Customer scales to 50K+ subs | Subscriber-tier-gated rules adapt automatically (Stacker activates streams). beehiiv handles 50K+ at Scale plan level. **Sponsor Hunter pipeline grows to 50+ brands per quarter.** Acceptable. | OK |
| 8 | Beehiiv outage | Writer can't draft. Research Analyst can't pull analytics. **Entire team stalls.** No Substack failover even though KB recommends Substack as alternative. | **P1** |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup Checklist + voice samples requirement + first-week-actions explicit | ✅ Strong. **Voice samples requirement is critical for output quality.** |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 12 KB items including Newsletter platform comparison + Sponsor rate card by tier + Subscriber stage revenue playbook + Subject line frameworks + Deliverability fundamentals | ✅ Quality > count. Best subject-line-framework KB in library. |
| **Voice** | "Distinctive, clear, audience-aware. Write like you talk." AI-tells blacklist explicit. | ✅ **Best anti-AI-slop discipline in the library.** |
| **Progress visibility** | Weekly Newsletter Draft + Weekly Content Plan + Weekly Performance Review + Weekly Community Report = 4-tier weekly cadence | ✅ Strong |
| **Handoff moments** | All workflows `review_after` — operator approves before send. Acceptable for newsletter (single-channel, single-author trust model) | ✅ |
| **The 90% rule** | ~75% autonomous. Writer drafts; CEO reviews; operator publishes via beehiiv UI; Community Manager limited by missing social tools. **Honest about platform-limit publishing.** | ⚠ Acceptable |
| **Beehiiv lock-in** | KB explicitly compares 4 platforms but template hardcodes one | ⚠ Mismatch — **fixable** |

---

## C7. Cost efficiency

For a 5K-subscriber newsletter:
- LLM weekly: ~$3-5 across 6 agents (Writer is the heaviest call)
- beehiiv: $43-$99/mo (Scale or Max tier for the API)
- Resend: ~$20/mo
- Stripe: transaction fees only when paid tier ships
- Optional: HubSpot ($20-50/mo), Social Media Hub via Late ($33/mo) or Ayrshare ($149/mo)
- **Total: $80-200/mo at 5K-subscriber scale**

**Cost guardrails missing:**
- No spend ceiling on Sponsor Hunter cold outreach (~50 cold emails per pipeline pass)
- No LLM token budget per Writer call (long voice samples + research brief + draft = ~10-15K tokens per issue)

**Cost-tier-down opportunity:**
- Research Analyst's daily brief = 5-10 stories × news synthesis = good Haiku candidate. ~50% LLM savings on daily research.
- Community Manager replies = Haiku candidate (short responses don't need Sonnet 4.5).
- Keep Sonnet 4.5 for Writer (voice-matching is the highest-quality work).

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: beehiiv hardcoded as required — locks out Substack/Kit/Ghost operators
**What:** `requiredIntegrations: ["beehiiv_mcp", "resend_mcp"]`. KB explicitly compares 4 platforms (beehiiv, Substack, Kit, Ghost) and recommends beehiiv as default — but doesn't *only* serve beehiiv operators. A Substack operator who reads the marketing ("For newsletter operators building $10K–$500K/year businesses on beehiiv, Substack, or Kit") and tries to create the business cannot.

**Why it matters:** Priority 1 (Functional). False advertising risk + buyer-locked-out.

**Fix:** Move `beehiiv_mcp` to `suggestedIntegrations` (with strong "default" framing). For Substack/Kit/Ghost operators, the agents fall back to their respective platforms' analytics KB-paste workflow until those MCPs exist (or the operator manually stages data into the workspace doc).

```diff
- requiredIntegrations: ["beehiiv_mcp", "resend_mcp"],
- suggestedIntegrations: ["stripe_mcp", "hubspot_mcp", "social_media_mcp"],
+ requiredIntegrations: ["resend_mcp"],
+ suggestedIntegrations: [
+   "beehiiv_mcp",      // Default platform — best monetization economics
+   "stripe_mcp",
+   "hubspot_mcp",
+   "social_media_mcp"
+ ],
```

Update setup checklist to clearly say: *"Default platform is beehiiv. Substack / Kit / Ghost operators: agents fall back to KB-paste analytics until those MCPs ship. Voice-match + research brief + sponsor pipeline workflows still work."*

### P0-2: Community Manager has no social-platform tools
**What:** Role: *"Replies to all comments and DMs within 8 hours, tracks audience sentiment across platforms."* `tools: ["send_email", "knowledge_lookup"]`.

**Why it matters:** Priority 1 (Functional). Customer pays for community management; gets only email replies. **Newsletter audiences live on X, LinkedIn, Threads, Substack Notes — not in email.**

**Fix:**
```diff
  tools: [
    "send_email",
    "knowledge_lookup",
+   "social_publish_post",
+   "get_comments",
+   "social_get_analytics",
+   "schedule_post"
  ]
```
And update system prompt to enumerate the social tools. Surface that auto-attach happens via `social_media_mcp` install — without that MCP, agent works in email-only mode.

### P0-3: Voice samples requirement is silent at first run
**What:** Setup checklist says *"Paste 3+ of your best past newsletter issues into the 'Operator voice samples' knowledge item."* But the agent runs without checking that this KB item has real content. **Writer voice-matches against placeholder text** ("--- ISSUE 1 --- Subject line: Body:") if operator skips this step.

**Why it matters:** Priority 2 (Output Quality). Day 1 operator runs Newsletter Draft, gets generic AI-prose, refunds.

**Fix:** Add to Writer's system prompt:
```
Before drafting any issue, knowledge_lookup the "Operator voice samples"
KB item. If it contains placeholder text ("--- ISSUE 1 --- Subject line:")
or fewer than 3 substantive issues, REFUSE to draft and surface to the
operator: "Cannot draft a voice-matched issue without 3+ past issues in
the Operator voice samples KB. Please paste your best 3 past issues
before running the Newsletter Draft workflow again."
```

### P0-4: Auto-attached video + YouTube stack is dead weight
**What:** `content_creator` is in `VIDEO_PRODUCTION_TEMPLATES` AND `YOUTUBE_API_TEMPLATES` per [tool-registry.ts:4785,4797](lib/mcp/tool-registry.ts:4785). **Newsletter Empire generates no video, publishes no YouTube content.** ~20+ irrelevant tools auto-attach to every agent.

**Fix:** Remove `content_creator` from both sets in `tool-registry.ts`:
```diff
  const VIDEO_PRODUCTION_TEMPLATES = new Set([
    "faceless_youtube",
    "tiktok_shop",
-   "content_creator",
    "social_media_agency",
    "agency",
    "ghost_operator"
  ]);

  const YOUTUBE_API_TEMPLATES = new Set([
    "faceless_youtube",
-   "content_creator",
    "social_media_agency"
  ]);
```

### P0-5: System prompts don't enumerate the actual tool runtime (library-wide pattern)
**What:** Mostly enumerated in this template (Writer, Research Analyst, Sponsor Hunter, Monetization Stacker name beehiiv tools). **CEO + Community Manager don't enumerate tools** — and they're the ones with the thinnest tool wiring.

**Fix:** Append "TOOLS YOU HAVE ACCESS TO" block to CEO + Community Manager system prompts.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: CEO has only `web_search` + `knowledge_lookup`
**What:** Editorial coordinator can't email Sponsor Hunter, can't view live analytics, can't send Telegram alerts.

**Fix:**
```diff
  tools: [
    "web_search",
    "knowledge_lookup",
+   "send_email",
+   "send_telegram_message",
+   "beehiiv_get_post_analytics",
+   "beehiiv_list_subscribers"
  ]
```

### P1-3: Sponsor Hunter "tracks pipeline in HubSpot" but has no HubSpot tools
Same library-wide pattern. Either add HubSpot tools OR remove the HubSpot reference from the system prompt and rely on the SPONSOR_PIPELINE.md workspace doc.

### P1-4: No Stripe tools on Monetization Stacker
**What:** Setup checklist says *"Required once {{businessName}} ships the paid tier"* — but Monetization Stacker has only beehiiv tools. Cannot read Stripe data even when integration is installed.

**Fix:** Add Stripe tools to Monetization Stacker's `tools[]` (auto-attach handles runtime, but explicit is documented).

### P1-5: No spend ceiling on Sponsor Hunter cold outreach
Same library-wide pattern.

### P1-6: No deduplication on Newsletter Draft re-runs
Customer runs Newsletter Draft twice in the same week → two drafts. **Add to Writer's system prompt:** *"Before drafting, knowledge_lookup the most recent Newsletter Draft date. If <7 days old, surface 'Already drafted for this week — overwrite or skip?' to operator."*

### P1-7: Beehiiv outage = full team stall
**Fix:** Add to Writer + Research Analyst system prompts: *"If beehiiv tools return errors for >2 hours, fall back to KB-paste analytics + previously-cached past issues. Surface 'Operating in beehiiv-degraded mode' in output header until tools recover."*

### P1-8: AI-tells blacklist could be more comprehensive
Currently 5-6 phrases. Could add: "leverage", "synergy", "navigating the landscape", "in this article we will explore", "moreover", "furthermore", "to put it simply", "at the end of the day", "key takeaways" (when used as a forced section header), bullet-list-of-3-everywhere pattern.

### P1-9: No paid-tier conversion-experiment workflow
Monetization Stacker references monthly experiments but no workflow drives them.

**Fix:** Add workflow:
```typescript
{
  name: "Monthly Paid-Tier Conversion Experiment",
  description: "Monetization Stacker designs one experiment per month: trial length, annual discount %, VIP tier, content gating, win-back timing. Runs experiment via beehiiv tier settings. Reports results month-end with conversion delta + recommendation to keep/kill.",
  trigger: "scheduled",
  output: "report",
  scheduleMode: "every",
  frequency: "monthly",
  approvalMode: "approve_first",
  agentRole: "Monetization Stacker"
}
```

### P1-10: Subject line A/B testing is operator-side
Beehiiv supports native subject A/B testing. Writer's 3 variants aren't auto-pushed into A/B test slot.

**Fix:** If beehiiv MCP exposes A/B test creation, add a tool call to Writer's workflow. Otherwise document the manual paste in setup checklist.

---

## C10. P2 issues

### P2-1: SPONSOR_PIPELINE.md template
Pre-seed with 2-3 example brands at different stages so operators see "what good looks like" on Day 1.

### P2-2: MONETIZATION_CALENDAR.md template
Pre-seed with example issues showing CTA rotation pattern.

### P2-3: 6 KB items are quality-dense but could include more
Missing: a "renewal cadence" KB (when to ping at-risk subscribers), a "list hygiene" KB (engagement pruning rules — referenced in deliverability KB but no standalone playbook), a "growth tactics by stage" KB (Boosts vs SparkLoop vs cross-promo swaps vs Twitter discovery vs LinkedIn newsletters).

### P2-4: Community Manager workflow doesn't query specific platforms
"Reply to all comments and DMs" is vague. Should specify which platforms (Substack Notes / Twitter replies / LinkedIn comments / Reddit responses).

### P2-5: No "renewal save" workflow for paid-tier churning subscribers
Paid tier with churn under 2%/mo target — no agent owns churn-save outreach. Could add a `Paid Tier Churn-Save Sequence` workflow when Stripe is wired.

---

## Summary fix-time for `content_creator`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (5) | beehiiv → suggested + Substack/Kit fallback path, Community Manager social tools, voice-samples gating, remove from VIDEO + YOUTUBE template sets, system-prompt tool enumeration on CEO + CM | **3-4 hours** |
| P1 (10) | primaryModel + fallback, CEO tool wiring, Sponsor Hunter HubSpot, Monetization Stacker Stripe, spend ceiling, dedup, beehiiv outage fallback, AI-tells expansion, conversion-experiment workflow, subject A/B | **3-4 hours** |
| P2 (5) | pre-seed workspace docs, additional KBs, platform-specific community workflow, churn-save workflow | **1-2 hours** |

**Total to S-tier: ~7-10 hours.** This is one of the better-positioned templates in the library on output-quality dimensions (voice-matching + AI-tells discipline + subscriber-tier revenue gating + deliverability KB). **The beehiiv lock-in is the biggest single fix and unlocks the Substack/Kit/Ghost market.** Closer to SHIP than NEEDS WORK once that's done.

---

**Next message:** Section C for `pinterest_traffic` (rank #10). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/10 — pinterest_traffic  (transcript line 879, 24456 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `pinterest_traffic`.

---

# SECTION C — TEMPLATE 10/19: `pinterest_traffic` (Pinterest Traffic Operator)

**Verdict:** **NEEDS WORK** but on the SHIP side of the line (~6-8 hours to S-tier — this template was significantly undersold in my Section B ranking).
**Headline:** I underrated this badly in Section B. The "compound timeline + when to quit" KB (sets month-by-month expectations explicitly because 1-in-3 operators quit at month 3 right before it works), the 2:3 aspect ratio + 72-hour rule guardrails (hardcoded in `guardrailsTemplate`), the "top 1% of pins drive 50% of traffic" multiplier pattern (Content Multiplier produces 20 variants per source URL across 6 angles), and the Funnel Architect's "never direct-to-affiliate" mandate (email-capture-first compounds; direct links don't) are best-in-library on their respective dimensions. Tailwind is correctly identified as **the only path** for Pinterest posting at scale (third-party Pinterest MCPs are read-only; Pinterest's own write API is locked) — `requiredIntegrations: ["tailwind_mcp", "resend_mcp"]` is structurally correct, not a bug. **Real issues are smaller:** Pin Designer has no AI image gen tools (produces prompts but doesn't render), no Stripe tools on Funnel Architect or Analytics Agent for revenue attribution, library-wide patterns (no `primaryModel`, no fallback model). My Section B critique that "tailwind_mcp is a hard dependency on a paid product" is partially wrong — Tailwind ($50/mo) genuinely is the only Pinterest scheduling option for the operator workflow this template enables.

## C1. Functional walkthrough — pin-to-revenue happy path

The 4-8 month compound: keyword research → board architecture → pin multiplication → Tailwind queue → lead-magnet funnel → conversion attribution. Tracing one cycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Keyword research** | **Pinterest SEO Strategist** (main) | Niche + target Pinterest audience | Monthly: 50 primary + 200 long-tail + seasonal map + purchase-intent list | `web_search`, `knowledge_lookup`, `ahrefs_keyword_overview`, `ahrefs_search_volume`, `semrush_keyword_overview`, `semrush_keyword_magic`, `tailwind_list_boards` + BUILTIN | PINTEREST_KEYWORD_MAP.md updated | ✅ EXPLICIT to Pin Designer + Content Multiplier |
| **Board architecture** | Same | Keyword clusters | 10-20 boards per niche, keyword-rich descriptions | (same tools) | PINTEREST_BOARD_ARCHITECTURE.md | ✅ |
| **Pin design** | **Pin Designer** | Source URL + keyword cluster | 5 static variants (Bright/Minimalist/Dark/Infographic/Lifestyle) + 1 idea pin + 1 video pin script per URL | `web_search`, `knowledge_lookup` ONLY | Pin design briefs | 🔴 BREAK — no image-gen tools (see below) |
| **Multiplication** | **Content Multiplier** | Source URL + Pin Designer briefs | 20 variants across 6 angles (problem / aspiration / number / before-after / list / step-by-step) | `web_search`, `knowledge_lookup` | 20 pin briefs per source URL | ✅ EXPLICIT to Scheduler |
| **Scheduling** | **Scheduler + Board Manager** | Pin briefs + board map | Tailwind queue at 3-5/day (new) or 5-10/day (established); SmartLoop for proven winners; group board audit quarterly; 2:3 + 72-hour enforced at queue level | `knowledge_lookup`, `tailwind_create_pin`, `tailwind_schedule_pin`, `tailwind_list_pins`, `tailwind_list_boards`, `tailwind_create_smartloop`, `tailwind_get_pin_analytics` + BUILTIN | Tailwind queue filled | ✅ EXPLICIT |
| **Funnel** | **Funnel Architect** | Pinterest traffic stream | Lead magnet + landing page + 5-email welcome sequence + upsell path; weekly step-level conversion tracking | `send_email`, `knowledge_lookup`, `web_search` + BUILTIN | Funnel spec per niche | 🟡 IMPLICIT — designs the funnel but no Resend campaign-create tools to actually deploy welcome sequence |
| **Analytics** | **Analytics Agent** | Tailwind analytics + Pinterest dashboard data | Weekly: top 10 by revenue, top 10 by impressions, board conversion, email signups from Pinterest, revenue-per-pin trend | `knowledge_lookup`, `tailwind_get_pin_analytics`, `ahrefs_rank_tracking`, `semrush_position_tracking` + BUILTIN | Weekly dashboard | ✅ EXPLICIT |

### Break points

1. **Pin Designer has no AI image generation tools** — system prompt says *"Use fal.ai or Midjourney prompts where AI imagery is appropriate"* but `tools: ["web_search", "knowledge_lookup"]`. **Agent produces image prompts, doesn't render images.** Operator runs the prompts in their own image-gen tool (Canva/Midjourney/fal.ai) and pastes results back. This is honest — Tailwind itself doesn't generate images either. **But it's a manual step the operator has to do for every pin.** At 5-10 pins/day × 5 variants = 25-50 image generations daily, that's an hour+/day of operator work even with AI.

2. **Pinterest is NOT in `VIDEO_PRODUCTION_TEMPLATES`** per [tool-registry.ts:4782-4789](lib/mcp/tool-registry.ts:4782) — so `generate_image` (fal.ai) doesn't auto-attach. **This is correct philosophy (Pinterest isn't video) but means Pin Designer can't render its own images.** Trade-off: cleaner tool space vs. operator-side image work. Could be added selectively just for Pinterest.

3. **Funnel Architect designs but can't deploy** — produces lead magnet specs + 5-email welcome sequence copy. Operator pastes into Resend / ConvertKit / beehiiv manually. **Same agent has `send_email`** but that's transactional sending, not campaign/sequence creation.

4. **No Stripe tools on Funnel Architect or Analytics Agent** — Funnel Architect tracks "step-level conversion (pin click → landing → email signup → product)" but the agent has no Stripe tool to read product purchase data. Analytics Agent's "revenue-per-pin trend" depends on attribution that requires Stripe data. **Both rely on operator paste OR auto-attach via stripe_mcp install.**

5. **Daily Tailwind Queue Fill is `approvalMode: "auto"`** — runs daily, autonomously fills queue. **With 2:3 + 72-hour enforcement at queue level + Tailwind's own validation, this is acceptable.** Worst case: pin slips through with bad description (Scheduler doesn't validate copy quality). Risk minimal.

6. **Inter-agent coordination via Pinterest SEO Strategist** — this agent is `type: "main"`. Has `delegate_task` (BUILTIN). Specialists do not. Standard library pattern.

7. **Group board applications correctly disclosed as manual** — Setup Checklist + agent system prompt both note no API exists for joining group boards. Acceptable disclosure.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `tailwind_mcp` | **Required** | When installed | ✅ Configured | Scheduler has 6 tailwind_* tools; SEO Strategist + Analytics also have tailwind tools |
| `resend_mcp` | **Required** | When installed | ✅ Configured | Funnel Architect has `send_email` |
| `stripe_mcp` | Suggested | Auto-attach when installed | ⚠ No agent has Stripe tools in `tools[]` | Funnel Architect's revenue attribution + Analytics Agent's revenue-per-pin both need Stripe |
| `ahrefs_mcp` | Suggested | When installed | ✅ Configured | SEO Strategist + Analytics have ahrefs_* tools |
| `semrush_mcp` | Suggested | When installed | ✅ Configured | Same |
| `hubspot_mcp` | Suggested | When installed | ✅ Optional | "Once the list hits 5K, segmenting by pin source / product interest meaningfully improves conversion" |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent has social tools | Setup checklist mentions cross-posting winning pins to IG/TikTok/FB but no agent's `tools[]` includes publishing |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct — Pinterest isn't video |
| Auto-attached YouTube | NOT in `YOUTUBE_API_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct |
| Pinterest Ads API | Mentioned in setup as not wired | ❌ Manual | ⚠ Operator-side | Honest disclosure |
| Pinterest direct write API | Locked by Pinterest | ❌ Not available | N/A | "Tailwind is the only path" — accurate |
| AI image gen (fal.ai / Midjourney) | Mentioned in Pin Designer system prompt | ❌ NOT wired | ⚠ Operator-side | **Pin Designer produces prompts; operator renders.** Could auto-attach `generate_image` from `__video__` tool definition. |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for Tailwind + Resend)

| Check | `tailwind_mcp` (6 tools across 3 agents) | `resend_mcp` |
|---|---|---|
| Credential flow | API key + Tailwind subscription required | Domain + SPF/DKIM ✅ |
| Call construction | Standard schema ✅ | ✅ |
| Rate limit awareness | ✅ Scheduler enforces 3-5/day new and 5-10/day established **at the agent level** — best in library on this | ❌ |
| Error handling | Per global no-retry rule | Same |
| Cost ceiling | N/A — Tailwind monthly flat ($50/mo) | ❌ Resend per-send pricing; minimal exposure for this template |
| Fallback path | ❌ No alternative — Tailwind is structurally only path | ❌ Substitutes ConvertKit/Kit/beehiiv but not wired |
| Model/version pinning | ✅ Provider-locked | ✅ |
| Tool enumeration in system prompts | ✅ Scheduler enumerates all 6 tailwind tools; SEO Strategist + Analytics enumerate their relevant ones | ✅ via `send_email` |

**Best agent-level rate-limit awareness in the library** — Scheduler explicitly enforces 3-5/day new account / 5-10/day established / 7-14/day pre-holiday at the queue-creation level. Other templates have rate-limit awareness in KB but not at agent action level.

---

## C3. Media generation deep-check

**Pinterest IS visual.** Every pin is an image. The template doesn't auto-attach image generation. Pin Designer produces *briefs* (5 static variants per source URL) but the operator renders the actual images.

### Image generation
- ❌ Prompts engineered for the specific model? Pin Designer system prompt says "Use fal.ai or Midjourney prompts where AI imagery is appropriate" — but no model-specific prompt examples in KB.
- ❌ Aspect ratio specified? Pin Designer enforces 2:3 (1000×1500px) at the brief level — but if AI image gen were wired, the tool call would need to enforce this.
- ❌ Quality/consistency check? None at agent level.
- ❌ Brand consistency across pin batches? Pin Designer's 5 templates (Bright/Minimalist/Dark/Infographic/Lifestyle) are the "brand template library" — but no enforcement at render time.

**Recommendation:** Add `generate_image` (fal.ai) selectively to Pin Designer's `tools[]` so the agent can produce final pin images. Alternatively, add an explicit "Image Renderer" sub-agent or document the operator-side workflow more thoroughly.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $197? |
|---|---|---|---|---|---|
| **Monthly keyword research (50 primary + 200 long-tail + seasonal)** | High — Ahrefs/SEMrush data-grounded | High | High | High | ✅ Yes |
| **Board architecture (10-20 boards w/ keyword-dense descriptions)** | High | High | High | High | ✅ Yes |
| **Pin design briefs (5 variants × source URL)** | High — 5 template variants + hook patterns | High | High | Medium — operator renders manually | ⚠ Borderline |
| **20-pin multiplication per source URL** | High — 6 angles, distinct framings | High | High | High | ✅ Yes |
| **Tailwind queue management** | High — 6 tools wired, rate-aware | High | High | High | ✅ Yes |
| **Lead-magnet-first funnel design** | High — explicit "never direct-to-affiliate" mandate | High | High | Medium — operator deploys via Resend/ConvertKit manually | ⚠ Borderline |
| **5-email welcome sequence** | High — structured (deliver + story + case-study + soft-pitch + hard-CTA) | High | High | Medium — operator deploys | ⚠ Borderline |
| **Weekly analytics dashboard (top 10 revenue, top 10 impressions, board conversion, revenue-per-pin trend)** | High when Stripe wired | High | High | Medium without Stripe (paste-only revenue) | ⚠ Borderline |
| **Pinterest compound timeline expectation-setting KB** | High — month-by-month + when-to-quit | High | High | High — best in library on this dimension | ✅ Yes |
| **PINTEREST_KEYWORD_MAP.md template** | High — primary + long-tail + seasonal + purchase-intent | High | High | High | ✅ Yes |
| **PINTEREST_BOARD_ARCHITECTURE.md template** | High — board status taxonomy + group board ROI test | High | High | High | ✅ Yes |

**Three borderline outputs** — pin design briefs (operator renders), funnel deployment (operator deploys via email platform), revenue analytics (paste-only without Stripe). All three are honestly disclosed in the agent system prompts and setup checklist.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Tailwind API key invalid | Scheduler stalls. Pinterest queue empties within days. **Single point of failure.** | P1 |
| 2 | Tailwind subscription lapses | Same as above. Setup checklist correctly identifies Tailwind as $50/mo non-negotiable. | OK |
| 3 | Operator pins manually (bypassing Tailwind) and breaks 72-hour rule | Pinterest may flag account. Tailwind enforcement only catches Tailwind-routed pins. | P1 |
| 4 | 3am unsupervised | Daily Tailwind Queue Fill = `auto` (correct for queue ops). Other workflows = `review_after`. **Acceptable.** | OK |
| 5 | Pinterest demotes a board (algorithm shift) | Guardrails escalate. **No automatic recovery — operator-side action.** | P1 |
| 6 | Pin design briefs generated but operator never renders images | Scheduler queue waits. **No alert if briefs-without-renders pile up.** | P1 |
| 7 | Customer scales 1 → 10 niches | Each niche needs its own keyword map + board architecture + funnel. **Per-niche overhead is real.** Not auto-managed. | P1 |
| 8 | Month 6 traffic still <1K/mo | Setup Checklist's "compound timeline" KB includes diagnosis steps. **Analytics Agent escalation rule fires.** | OK |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + compound timeline + month-by-month expectations + 4 first-week actions | ✅ **Best expectation-setting in library** — solves #1 churn driver |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 5 KB items + 2 workspace docs (KEYWORD_MAP + BOARD_ARCHITECTURE). KB items are dense playbooks. | ✅ Quality > count |
| **Voice** | "Visual-first, benefit-led, scroll-stopping. Pin captions lead with the benefit or the pain, not the brand." | ✅ Premium voice — distinctive |
| **Progress visibility** | Daily Tailwind queue + Weekly analytics + Monthly keyword refresh + Quarterly group board audit + Seasonal ramp = 5-tier cadence | ✅ Strong |
| **Handoff moments** | Most workflows `review_after` or `auto`. Seasonal Content Ramp = `approve_first`. **Acceptable.** | ✅ |
| **The 90% rule** | ~70% autonomous. Pin rendering + funnel deployment + group board joins = operator-side. **Honest about limits.** | ⚠ Acceptable |
| **Pinterest 2026 algorithm rules KB** | Best-in-library on platform-specific algorithm awareness. Lists fresh-pin-priority + 2:3 ratio + top-1% rule + 72-hour rule + idea/video pin priority + keywords + cadence. | ✅ Premium |

---

## C7. Cost efficiency

For a 1-niche Pinterest operator at month 6:
- LLM weekly: ~$2-3 across 6 agents (keyword research + pin design briefs + multiplier are bulk LLM)
- Tailwind: $50/mo flat
- Resend: ~$20/mo
- Optional: Ahrefs OR SEMrush ($129-$139/mo), Stripe (transaction fees), Canva Pro ($12.99/mo) for image rendering
- Optional AI image gen: Midjourney ($30/mo) or fal.ai (~$0.03-$0.05/image × 100/mo = $3-5/mo)
- **Total: $90-300/mo at single-niche operation**

**Cost guardrails missing:**
- No spend ceiling on AI image gen (if wired) — could blast 1,000 images/month
- No Tailwind pin-volume cap per niche (Tailwind itself caps at plan tier — fine)
- No Ahrefs/SEMrush query budget — agents could over-query

**Cost-tier-down opportunity:**
- Pin Designer + Content Multiplier are pattern-heavy (5 templates × 6 angles) — Haiku candidates. Sonnet 4.5 for SEO Strategist + Analytics Agent + Funnel Architect. ~50% LLM savings.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: Pin Designer has no image-rendering tools
**What:** Pin Designer's role: *"Generates pin designs in 5 proven high-CTR templates per source URL."* `tools: ["web_search", "knowledge_lookup"]`. **Agent produces image-generation PROMPTS, doesn't render images.** Operator runs the prompts in Canva / Midjourney / fal.ai externally and pastes results back into the workflow.

**Why it matters:** Priority 1 (Functional) + Priority 5 (Premium polish). The "we generate Pinterest pins for you" promise (in the description's "Pin Multiplier" framing) is partially undelivered. At 5-10 pins/day × 5 variants × 6 angles = 150-300 image generations per source URL = an hour+/day of operator-side rendering.

**Fix:** Add `generate_image` (fal.ai) to Pin Designer's `tools[]`:
```diff
  tools: [
    "web_search",
    "knowledge_lookup",
+   "generate_image",
+   "fal_check_generation",
+   "upload_to_r2",
+   "list_brand_assets",
+   "get_brand_asset"
  ]
```
And update Pin Designer's system prompt: *"You render pin images directly via `generate_image` (fal.ai Flux for photoreal, Ideogram for text-heavy hook overlays). Output 1000×1500px (2:3 ratio enforced — Pinterest requires it)."*

This will require either:
- (a) Adding `pinterest_traffic` to a new `IMAGE_PRODUCTION_TEMPLATES` set in `tool-registry.ts` (just image gen, not full video stack), OR
- (b) Adding the tools directly via the agent's `tools[]` whitelist (auto-attach handles registration if image gen is in BUILTIN_ALWAYS_ON for the org).

Path (a) is cleaner for cross-template reuse.

### P0-2: Funnel Architect can design but not deploy
**What:** Agent designs lead magnets + landing pages + 5-email welcome sequences. `tools: ["send_email", "knowledge_lookup", "web_search"]`. **Cannot create campaigns or trigger sequences in Resend.**

**Why it matters:** Priority 1 (Functional). Customer pays for autonomous funnel; gets a spec doc operator deploys manually.

**Fix:**
- If Resend MCP exposes campaign/sequence-creation tools (not just send), add them to Funnel Architect's `tools[]`.
- If not (Resend is primarily transactional, not campaign-management), document the operator-side deployment step explicitly: *"Funnel Architect drafts the 5-email welcome sequence as paste-ready copy. Operator deploys in Resend Audiences / ConvertKit / beehiiv — agent doesn't trigger sequences directly because Resend MCP is transactional-send only."*
- Long-term: add a campaign-management MCP (Resend Audiences, ConvertKit, Kit) for full deployment.

### P0-3: System prompts don't enumerate tool runtime on 3 agents
Pin Designer + Content Multiplier + Funnel Architect have only `web_search` + `knowledge_lookup` listed. Other 3 agents enumerate well. Same library-wide pattern — apply the fix to these 3.

### P0-4: No revenue attribution without Stripe tools
**What:** Funnel Architect's "step-level conversion tracking" + Analytics Agent's "revenue-per-pin trend" depend on Stripe data. Neither agent has Stripe tools in `tools[]`. **Setup checklist says Stripe is "Required once {{businessName}} ships paid products"** — but if the template's whole revenue argument is digital-product sales via Pinterest funnel, Stripe IS required for the revenue half of the funnel.

**Why it matters:** Priority 1 (Functional). Without Stripe tools, the weekly analytics dashboard's "top 10 pins by revenue" is paste-only.

**Fix:** Move `stripe_mcp` from suggested to **conditionally required** when paid products are part of the offer. Add Stripe tools to Funnel Architect + Analytics Agent `tools[]` (auto-attach handles runtime, but explicit is better):
```diff
  // Funnel Architect
  tools: [
    "send_email",
    "knowledge_lookup",
    "web_search",
+   // Stripe tools auto-attach when stripe_mcp installed:
+   // stripe_list_charges, stripe_get_subscription, stripe_list_customers
  ]
```

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No spend ceiling on AI image gen (if wired)
**Fix:** If P0-1 wires `generate_image`, add to Pin Designer's system prompt:
```
COST GUARDRAILS:
- Maximum 100 image generations / day at fal.ai Flux ($0.03-$0.05/img = $3-5/day max)
- Hard stop at $100/month image-gen budget unless operator raises ceiling
- Use Ideogram only for text-heavy hooks; Flux for photoreal lifestyle
```

### P1-3: Funnel deployment requires manual paste even when Resend installed
See P0-2. Document or wire campaign tools.

### P1-4: No automatic detection of "briefs-without-renders" pile-up
If Pin Designer produces briefs but operator doesn't render, no alert. **Fix:** Scheduler should track "briefed pins waiting for render" and surface stalls.

### P1-5: No Pinterest Ads API
Honestly disclosed. Operators running Pinterest Ads paste analytics manually. Acceptable for now.

### P1-6: Group board joining is manual
Honestly disclosed. Acceptable.

### P1-7: Cross-posting winning pins to IG/TikTok/FB
Setup checklist mentions Social Media Hub for cross-posting winners. **No agent has the tools to do this.** Add `social_publish_post` to Pin Designer or Content Multiplier when `social_media_mcp` is installed.

### P1-8: Rate-limit-tier-down opportunity for LLM
Move Pin Designer + Content Multiplier to Haiku for routine generation; keep Sonnet 4.5 for SEO Strategist + Analytics + Funnel Architect.

### P1-9: Pinterest Trends API / native search suggestions not auto-fetched
Pinterest SEO Strategist mentions using Pinterest's native search suggestions but agent has no tool to query them programmatically. Operator manually pulls from Pinterest's UI. **Fix:** Document the manual step OR wire a Pinterest Trends scraper tool.

---

## C10. P2 issues

### P2-1: KEYWORD_MAP and BOARD_ARCHITECTURE workspace docs could pre-seed examples
For a new Pinterest operator, seeing "what good looks like" on Day 1 helps. Pre-seed with 1-2 example niche entries (e.g., home decor + parenting) so the operator has a model to follow.

### P2-2: 5 KB items are dense but could include more
Missing: a "pin lifecycle" KB (when to refresh winning pins, archive losers), a "Pinterest analytics deep-dive" KB (how to read the native dashboard), an "audit your account" KB (board cleanup, demoted boards, low-CTR pin culling).

### P2-3: Pin Designer's 5 templates could be image-asset-backed
Operators benefit from seeing the actual templates (Bright/Minimalist/Dark/Infographic/Lifestyle). Pre-seed Canva-template URLs or example pin images in `brand_assets`.

### P2-4: Seasonal Content Ramp workflow could auto-trigger
Currently `manual` trigger. Could auto-trigger 60 days before predefined holidays (Christmas / Mother's Day / Halloween / wedding season / back-to-school / New Year per the seasonal keyword KB).

### P2-5: No "first month survival" workflow
Compound timeline KB sets expectations but no workflow checks in at month 1, 2, 3 to reinforce the message ("you're in the danger zone — keep going"). Could add a `Monthly Compound Timeline Check-In` workflow that surfaces month-N expected metrics vs actual.

---

## Summary fix-time for `pinterest_traffic`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | Pin Designer image-gen tools, Funnel Architect deployment tools, system-prompt tool enumeration on 3 agents, Stripe tools for revenue attribution | **3-4 hours** |
| P1 (9) | primaryModel + fallback, image-gen spend ceiling, briefs-without-renders alert, social cross-post, Pinterest Trends fetch, model tier-down | **2-3 hours** |
| P2 (5) | pre-seed workspace docs, additional KBs, Pin Designer template asset library, seasonal auto-trigger, monthly compound check-in | **1-2 hours** |

**Total to S-tier: ~6-9 hours.** This template is genuinely **closer to SHIP than NEEDS WORK** — the KB content is dense and operator-protecting, the brand voice is premium, the Tailwind wiring is the best in library on rate-limit awareness, and the compound-timeline expectation-setting solves the #1 Pinterest churn driver. **Pin Designer image-gen tools is the single biggest fix** and unlocks the autonomy promise.

---

**Next message:** Section C for `ecommerce` (rank #11). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/11 — ecommerce  (transcript line 898, 22493 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `ecommerce`.

---

# SECTION C — TEMPLATE 11/19: `ecommerce` (E-Commerce & Etsy Digital Studio)

**Verdict:** **NEEDS WORK — split or specialize** (~6-8 hours to split into two templates, OR ~10-12 hours to make one work for both archetypes).
**Headline:** Same bifurcated-identity issue as `agency`, but more lopsided. The **Etsy Digital Studio half is best-in-library** on its dimension — Copyright Firewall KB (Disney/sports/lyrics/celebrities/corporate logos with permanent-shop-closure framing), Etsy 13-tag rule + 140-char title format hardcoded in agent system prompt, seasonal calendar with launch windows by holiday, "300+ listings beats 10 perfect ones" volume play KB. **The DTC Shopify half is barely there.** CEO + Support Lead + CMO + Operations Manager are generic, voice is generic, and no agent has Shopify tools in `tools[]` even though `shopify_mcp` is suggested. Setup checklist literally says: *"Pick your archetype first: DTC brand OR Etsy Digital Studio. The other agents stay dormant."* Same trap as `agency`. Plus a `Performance Analyst` agent referenced in SKU_SCORECARD.md but doesn't actually exist in `starterAgents` — bug.

## C1. Functional walkthrough — Etsy Digital Studio happy path (the strong half)

The Etsy half: trend scan → niche scoring → Copyright Firewall check → listing copy + 13 tags + Printify mockups → Etsy publish → 20-pin Pinterest distribution → 90-day refresh. Tracing one cycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Trend scan** | **Etsy Trend Hunter** | Pinterest Predicts + Etsy quarterly trend drops + eRank + Google Trends | Score niches 1-100 on competition × price × velocity × seasonality; reject copyrighted/trademarked themes | `web_search`, `knowledge_lookup` + BUILTIN | Weekly trend report (green/yellow/red) | ✅ EXPLICIT to Listing Copywriter |
| **Listing build** | **Etsy Listing Copywriter** | Green-light niche | 140-char pipe-delimited title + 3-paragraph description + EXACTLY 13 tags + 3 mockup briefs | `knowledge_lookup`, `etsy_create_listing`, `etsy_update_listing`, `etsy_upload_listing_image`, `printify_generate_mockup`, `printify_create_product` + BUILTIN | Live Etsy listing | ✅ EXPLICIT |
| **Pinterest distribution** | **Pinterest Traffic Pipe** | New Etsy listing | 5 static + 1 idea + 1 video pin per listing; 2:3 ratio + 72-hour rule enforced | `knowledge_lookup`, `tailwind_create_pin`, `tailwind_schedule_pin`, `tailwind_list_boards`, `tailwind_create_smartloop`, `tailwind_get_pin_analytics` + BUILTIN | Tailwind queue filled | ✅ EXPLICIT |
| **90-day refresh** | (agent-undefined) | Stale listings | Re-tag scan, kill losers, variant-test winners | (no agent has this owned) | SKU_SCORECARD.md updated | 🔴 BREAK — see below |

## C1b. Functional walkthrough — DTC Shopify happy path (the weak half)

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | Issue |
|---|---|---|---|---|---|---|
| **Strategy** | **CEO** | Revenue + AOV + conversion data | Weekly priorities, business health report | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Weekly business health report | 🔴 No Shopify tools — can't read orders/products directly |
| **Support** | **Support Lead** | Customer inquiries (operator pastes) | Order resolution, returns, exchanges | `send_email`, `knowledge_lookup` + BUILTIN | Customer responses | 🔴 No Shopify tools — can't look up order status |
| **Marketing** | **CMO** | Customer behavior data (operator pastes) | Email campaigns, social, conversion funnel | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Campaign drafts | 🔴 No Shopify or email-platform tools |
| **Operations** | **Operations Manager** | Inventory + supplier data | Reorder alerts, fulfillment SLA | `knowledge_lookup` ONLY | Operations report | 🔴 Tool starvation — same as agency template's COO |

### Break points

1. **DTC half has near-zero tool wiring.** CEO + Support Lead + CMO + Operations Manager are generic 4-agent shell with placeholder tools. **Even when `shopify_mcp` is installed, no agent's system prompt enumerates Shopify tools or instructs the agent to use them.** Auto-attach via `getToolsForAgent` may surface them at runtime, but the agents don't know.

2. **`Performance Analyst` agent referenced but doesn't exist.** SKU_SCORECARD.md workspace doc says *"Performance Analyst maintains this. Etsy Digital Studio operators update weekly."* Search the `starterAgents` array — **no agent named "Performance Analyst" exists.** The Etsy Listing Copywriter is the closest match but isn't assigned this role. **Customer reads SKU_SCORECARD.md, expects a Performance Analyst agent, finds none.** Bug.

3. **90-day Etsy refresh has no owner.** KB says *"90-day freshness refresh"* and *"Performance Analyst runs 90-day scan weekly, re-tags any listing with 0 sales in last 30 days."* No agent assigned. No workflow drives this. Will silently not happen.

4. **`requiredIntegrations: ["stripe_mcp", "resend_mcp"]`** — for Etsy operators, Stripe is wrong because Etsy handles checkout via Etsy Payments. Etsy operators don't process payments through Stripe directly. **Stripe is required for both archetypes but only one actually uses it.**

5. **Bifurcation Setup Checklist is honest about it** — *"Pick your archetype first... The other agents stay dormant."* But the customer pays for 7 agents and uses 4 (one half goes dormant). Premium-product framing problem.

6. **No Shopify-specific tools in any agent's `tools[]`** — `shopify_mcp` is suggested. Even if installed, the DTC CEO's system prompt has no Shopify-tool reference. Auto-attach handles runtime registration but agents don't know to call.

7. **CMO can't actually run email campaigns** — has `send_email` (transactional) but no Resend campaign-create / sequence tools. Same library-wide pattern.

8. **Operations Manager has only `knowledge_lookup`** — for inventory tracking + fulfillment + supplier coordination. **Cannot read live inventory data even when Shopify is installed.**

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `stripe_mcp` | **Required** | When installed | ⚠ Required for both archetypes but only DTC half uses it (Etsy operators use Etsy Payments) | |
| `resend_mcp` | **Required** | When installed | ✅ Configured | CEO + Support + CMO have `send_email` |
| `shopify_mcp` | Suggested | When installed | ⚠ DTC archetype-specific. **No agent has shopify_* tools in `tools[]`.** | Auto-attach handles runtime |
| `etsy_mcp` | Suggested | When installed | ✅ Configured | Etsy Listing Copywriter has 3 etsy_* tools |
| `printify_mcp` | Suggested | When installed | ✅ Configured | Etsy Listing Copywriter has 2 printify_* tools |
| `tailwind_mcp` | Suggested | When installed | ✅ Configured | Pinterest Traffic Pipe has 5 tailwind_* tools |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot_* tools | Setup checklist references "Powers segmented email flows" but no wiring |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent has social tools | Setup checklist mentions cross-posting to IG/TikTok/FB but no agent owns it |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct |
| EverBee / eRank | Mentioned in setup as "no MCP" | ❌ Not wired | ⚠ Operator-side | Honest |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for the wired Etsy + Printify + Tailwind)

| Check | `etsy_mcp` (3 tools) | `printify_mcp` (2 tools) | `tailwind_mcp` (5 tools) |
|---|---|---|---|
| Credential flow | Etsy developer app + OAuth | Printify Personal Access Token | API key + Tailwind subscription |
| Call construction | Standard schema ✅ | ✅ | ✅ |
| Rate limit awareness | ❌ Not in agent prompts | ❌ | ✅ Pinterest Traffic Pipe enforces 2:3 + 72-hour at queue level |
| Error handling | Per global no-retry | Same | Same |
| Cost ceiling | N/A | ❌ Per-mockup costs not capped | N/A — Tailwind monthly flat |
| Fallback path | ❌ | ❌ | ❌ |
| Model/version pinning | ✅ | ✅ | ✅ |
| Tool enumeration in system prompts | ✅ Listing Copywriter enumerates etsy_* tools | ✅ Same enumerates printify_* | ✅ Pinterest Traffic Pipe enumerates 5 tailwind tools |

---

## C3. Media generation deep-check

Etsy Listing Copywriter generates "3 mockup briefs" via `printify_generate_mockup` for POD products. **For digital products (the bigger Etsy archetype) there's no AI image gen wired.** Pinterest Traffic Pipe also produces "5 static + 1 idea + 1 video pin" briefs but no `generate_image` tool — same gap as `pinterest_traffic` template.

**Pin Designer-equivalent role doesn't exist** in this template. Pinterest Traffic Pipe writes briefs; operator renders. At 50 listings/week × 7 pins/listing = 350 image generations weekly = significant operator-side work even with AI.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $297? |
|---|---|---|---|---|---|
| **Weekly Etsy trend report (green/yellow/red niches)** | High — 4-axis scoring + Copyright Firewall enforcement | High | High | High | ✅ Yes |
| **Etsy listing (140-char title + 13 tags + 3-paragraph description + 3 mockups)** | High — algorithm-aware, paste-ready | High | High | High when etsy_mcp wired | ✅ Yes |
| **20-pin Pinterest batch per listing** | High — same caliber as `pinterest_traffic` template | High | High | Medium — operator renders images | ⚠ Borderline |
| **DTC weekly business health report (CEO)** | Low when no Shopify tools — relies on operator paste | Low | Medium — generic e-commerce voice | Medium | ❌ Fails for DTC use |
| **Customer support response (Support Lead)** | High — warm, solution-oriented | Medium when no order data — agent guesses | Medium | Medium | ⚠ Borderline |
| **Email campaign drafts (CMO)** | Medium — generic e-commerce voice | Medium | Medium | Medium — operator deploys | ⚠ Borderline |
| **Inventory reorder alerts (Operations)** | Low without inventory tools | Low | High | Low | ❌ Fails |
| **Cart recovery email** | Medium — generic | Medium | High | Medium | ⚠ Borderline |
| **Post-purchase follow-up email** | Medium | Medium | High | Medium | ⚠ Borderline |
| **Copyright Firewall KB** | High — best-in-library on IP risk | High | High | High | ✅ Yes |
| **SKU_SCORECARD.md** | High — winner/steady/marginal/loser taxonomy + action types | High | High | Medium — references undefined "Performance Analyst" agent | ⚠ Borderline |

**Etsy half outputs are mostly Yes. DTC half outputs are mostly Borderline or Fail.** The split is the issue.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Customer is DTC operator on Shopify, expects autonomous order management | Shopify is suggested-not-required. Even when installed, no agent's `tools[]` references Shopify tools. **DTC operator gets a 4-agent generic team that can't do their actual job.** | **P0 for DTC archetype** |
| 2 | Customer is Etsy operator, doesn't have Stripe | `requiredIntegrations` blocks creation | **P0 for Etsy archetype** |
| 3 | Operator runs Etsy Trend Hunter on a niche it scores RED for copyright | Refuses correctly. Setup checklist enforces. | OK |
| 4 | 3am unsupervised | Workflows mostly `review_after`. New Order Processing = `notify` (correct for transactional event). **Acceptable.** | OK |
| 5 | 90-day Etsy listing refresh deadline passes | No agent owns it. Stale listings drag shop quality silently. | **P0** |
| 6 | Customer scales 1 → 500 Etsy listings | Volume play KB targets exactly this. Agent system prompts can handle it (50 listings/hour for Listing Copywriter). **But Pinterest pin rendering scales to 3,500 image briefs/week — operator bottleneck.** | P1 |
| 7 | Pinterest Traffic Pipe queue full but operator hasn't rendered images | Pin briefs sit unused. No alert. | P1 |
| 8 | Etsy MCP returns OAuth expired error | Per global no-retry rule, surfaces. **No automatic re-auth.** | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding (Etsy half)** | Setup Checklist + Copyright Firewall + Etsy SEO + seasonal calendar + volume play KBs | ✅ Strong for Etsy archetype |
| **Onboarding (DTC half)** | Generic store policies + product catalog + brand voice KB stubs | ⚠ Weak for DTC archetype |
| **Defaults** | `safetyMode: "auto_low_risk"` (different from most templates), **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 13 KB items. Etsy half is dense + actionable. DTC half is placeholder/stub. | ⚠ Asymmetric |
| **Voice** | "Helpful, efficient, trustworthy. Keep support responses warm and solution-oriented." Generic. **Etsy archetype gets premium specificity through KB content. DTC archetype gets generic shell.** | ⚠ Asymmetric |
| **Progress visibility** | Weekly business health + weekly inventory + cart recovery + post-purchase + product review = 5-tier weekly cadence. Daily abandoned cart. | ✅ |
| **Handoff moments** | Most workflows `review_after` or `notify`. Acceptable. | ✅ |
| **The 90% rule** | Etsy archetype: ~70% (volume play viable). DTC archetype: ~40% (most agents don't have tools to deliver). | ⚠ Asymmetric |
| **Bifurcated identity** | Setup Checklist makes operator pick archetype on Day 1 — same fork-in-road as `agency`. | ⚠ Structural |
| **Performance Analyst ghost** | SKU_SCORECARD.md references an agent that doesn't exist | **P0 bug** |

---

## C7. Cost efficiency

For an Etsy Digital Studio operator at 300 listings:
- LLM weekly: ~$5-10 (Listing Copywriter is heavy at 50 listings/hour cadence)
- Etsy fees: $0.20/listing × 300 = $60 + 6.5% transaction fee
- Printify: free + per-order costs
- Tailwind: $50/mo
- Resend: ~$20/mo
- Stripe: transaction fees only when applicable
- Optional: Canva Pro / fal.ai for image rendering ($13-30/mo), HubSpot ($20-50/mo), eRank ($5.99/mo), EverBee
- **Total: ~$140-300/mo at 300-listing Etsy operation**

For DTC Shopify operator at $50K MRR:
- LLM weekly: ~$3-5
- Shopify: $39-$2K+/mo depending on plan
- Resend: $20+/mo
- Stripe: 2.9% + $0.30 per transaction
- **Total: $80-2,200/mo on infra**

**Cost guardrails missing across both archetypes.**

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: Bifurcated identity — split into two templates (or specialize)
**What:** Setup Checklist literally says *"Pick your archetype first: DTC brand OR Etsy Digital Studio. The other agents stay dormant."* Same trap as `agency`. Customer pays for 7 agents, uses 4.

**Why it matters:** Priority 5 (Premium polish) + Priority 1 (Functional). Two products competing for one template slot.

**Fix options:**
- **Path A (recommended): Split into two templates.**
  - `etsy_digital_studio` — 4 agents focused on Etsy Digital Studio: Etsy Trend Hunter, Etsy Listing Copywriter, Pinterest Traffic Pipe, + a new Performance Analyst (the ghost agent). Required: `etsy_mcp`, `printify_mcp`, `tailwind_mcp`, `resend_mcp`. Suggested: `social_media_mcp`. **No Stripe required.**
  - `dtc_ecommerce` — 4 agents focused on Shopify DTC: CEO, Support Lead, CMO, Operations. Required: `shopify_mcp`, `stripe_mcp`, `resend_mcp`. Add Shopify tools to all 4 agents. **Tighten the voice — the current generic voice is the weakness.**
  - Effort: ~6-8 hours.
- **Path B: Eliminate the DTC half.** The Etsy Digital Studio half is genuinely good. The DTC half overlaps with `tiktok_shop` (physical products on TikTok Shop) and could be subsumed there. Effort: ~3 hours (delete DTC agents, rename template to `etsy_digital_studio`, drop Stripe required).

I lean toward **Path B** — the DTC archetype is underserved and `tiktok_shop` already serves a strong physical-product-on-platform workflow. **Etsy Digital Studio is distinctive and worth its own template.**

### P0-2: `Performance Analyst` agent referenced but doesn't exist
**What:** SKU_SCORECARD.md says *"Performance Analyst maintains this."* Etsy SEO KB says *"Performance Analyst runs 90-day scan weekly."* **No such agent in `starterAgents`.**

**Why it matters:** Priority 1 (Functional). Workspace doc references nonexistent agent. 90-day refresh never runs. Customer reads docs, expects feature, doesn't get it.

**Fix:** Either:
- (a) Add a `Performance Analyst` agent with weekly SKU re-scoring + 90-day re-tag tools, OR
- (b) Reassign the Performance Analyst role to the Etsy Listing Copywriter (rename or expand).

I lean (a) — performance analysis is distinct from listing copy production.

### P0-3: DTC archetype has no Shopify tools wired
**What:** CEO + Support Lead + CMO + Operations Manager all promise Shopify integration through their roles, but none has `shopify_*` tools in `tools[]`.

**Why it matters:** Priority 1 (Functional). DTC customer pays for autonomous management; gets generic 4-agent team that can't read orders, products, or inventory.

**Fix:** Add Shopify tools to the relevant agents:
```diff
  // CEO
  tools: [
    "send_email",
    "web_search",
    "knowledge_lookup",
+   // Shopify tools auto-attach when shopify_mcp installed:
+   // shopify_list_orders, shopify_get_order, shopify_list_products, shopify_get_analytics
  ]
  
  // Support Lead
  tools: [
    "send_email",
    "knowledge_lookup",
+   // shopify_get_order, shopify_list_customers, shopify_create_refund
  ]
  
  // Operations Manager — currently only knowledge_lookup
  tools: [
+   "send_email",
+   "send_telegram_message",
    "knowledge_lookup",
+   // shopify_list_inventory, shopify_get_inventory_levels, shopify_update_inventory
  ]
```
And update each agent's system prompt to enumerate the Shopify tools.

### P0-4: Stripe required for Etsy archetype that doesn't use it
**What:** Etsy operators sell via Etsy Payments (built into Etsy). Stripe isn't part of the Etsy checkout flow. **Etsy Digital Studio operators forced to install Stripe to create the business.**

**Fix:** If splitting per P0-1 Path A, this resolves automatically. If keeping merged, move `stripe_mcp` to suggested:
```diff
- requiredIntegrations: ["stripe_mcp", "resend_mcp"],
+ requiredIntegrations: ["resend_mcp"],
+ suggestedIntegrations: [
+   "stripe_mcp",  // Required for DTC Shopify operators
+   "shopify_mcp",
+   "etsy_mcp",
+   "printify_mcp",
+   "tailwind_mcp",
+   "hubspot_mcp",
+   "social_media_mcp"
+ ],
```

### P0-5: System prompts don't enumerate the actual tool runtime (library-wide pattern)
Same fix.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: 90-day Etsy refresh has no workflow
Add:
```typescript
{
  name: "90-Day Listing Refresh",
  description: "Performance Analyst (or Listing Copywriter) scans listings older than 90 days with 0 sales in last 30 days. Re-tags + refreshes title (within 140-char limit) + updates mockups. Etsy's algorithm rewards freshness signals.",
  trigger: "scheduled",
  output: "report",
  scheduleMode: "every",
  frequency: "weekly",
  approvalMode: "review_after"
}
```

### P1-3: No image gen for Pinterest Traffic Pipe / Etsy mockups (digital products)
For digital products (the larger Etsy archetype), no `generate_image` tool. Pin briefs go unrendered. **Same fix pattern as `pinterest_traffic` template — add `generate_image` to Pinterest Traffic Pipe + Etsy Listing Copywriter for digital-product mockups.**

### P1-4: No spend ceiling on AI imagery
Same library-wide.

### P1-5: CMO has no email-platform campaign tools
Same library-wide pattern.

### P1-6: Support Lead has no order-lookup tools
Even Etsy operators benefit from order lookup for support. Add `etsy_get_listing` + `etsy_list_orders` (if available).

### P1-7: HubSpot suggested but no agent uses it
Setup checklist references HubSpot for "Powers segmented email flows." No agent has hubspot tools.

### P1-8: Cross-posting via social_media_mcp not wired
Setup checklist mentions cross-posting Pinterest winners to IG/TikTok/FB. No agent owns this.

### P1-9: Inventory tracking on Operations Manager
Operations Manager has only `knowledge_lookup` — same as agency template's COO starvation.

### P1-10: Cart recovery email is `daily` scheduled but generic
Could be more sophisticated — operator-specific abandonment patterns, time-of-day optimization, segment by cart value.

---

## C10. P2 issues

### P2-1: SKU_SCORECARD.md template
Pre-seed with 1-2 example rows so Etsy operators see "what good looks like."

### P2-2: Pinterest 2:3 + 72-hour rule duplicated across templates
Same Pinterest rules in `pinterest_traffic` and `ecommerce`. Could share a Pinterest KB primitive.

### P2-3: Brand voice for DTC is genuinely thin
"Helpful, efficient, trustworthy" — could match any DTC brand. Premium feel requires niche-specific voice or operator-fillable voice samples.

### P2-4: Etsy Trend Hunter could pull more sources
Currently 4 sources (Pinterest Predicts + Etsy quarterly + eRank + Google Trends). Could add Reddit (r/Etsy, niche-specific subreddits), TikTok trends, Pinterest's native "trending searches" API if accessible.

### P2-5: Volume play KB targets are conservative
"$2K-$8K/mo at 300-500 listings" is realistic but lower-end. Top operators do $20K+/mo at this scale. Could expand the math.

---

## Summary fix-time for `ecommerce`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (5) | Split or specialize template, fix Performance Analyst ghost, DTC Shopify tool wiring, Stripe → suggested, system-prompt tool enumeration | **6-10 hours** depending on split path |
| P1 (10) | primaryModel + fallback, 90-day refresh workflow, image gen for Pinterest + digital products, spend ceiling, CMO campaign tools, Support Lead order lookup, HubSpot wiring, social cross-post, Operations tools, cart recovery sophistication | **4-5 hours** |
| P2 (5) | pre-seed SKU_SCORECARD, Pinterest KB sharing, DTC brand voice, more trend sources, expanded volume math | **1-2 hours** |

**Total to S-tier: ~11-17 hours.** This template has the same structural issue as `agency` — bifurcated identity. **The Etsy Digital Studio half is genuinely strong** (Copyright Firewall, 13-tag rule, seasonal calendar, volume play). **The DTC half is weak** and overlaps with `tiktok_shop` for physical products. **Recommended path: kill the DTC half, rename to `etsy_digital_studio`, and the template becomes ship-ready in ~6 hours.**

---

**Next message:** Section C for `saas_product` (rank #12). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/12 — saas_product  (transcript line 914, 19976 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `saas_product`.

---

# SECTION C — TEMPLATE 12/19: `saas_product` (SaaS / Software Product)

**Verdict:** **NEEDS WORK** (~6-8 hours to S-tier — but the more important question is whether 4 agents is enough for the buyer's expectations).
**Headline:** This is the most "shell template" in the SHIP-ranked half. The 4 agents (CEO + Support Lead + CMO + Product Analyst) cover the SaaS basics — activation, support, growth, analytics — but the wiring is thin and the voice is generic. **Stripe is genuinely required here** (unlike most other templates where it's overused) — SaaS billing flows through Stripe natively. **The real issues:** 4 agents is thin for SaaS complexity (no DevRel, no separate Customer Success, no Billing specialist, no separate Product Manager from Analyst), no Stripe tools are in any agent's `tools[]` even though it's required, the Product Analyst's role depends on PostHog/Amplitude/Mixpanel data that has no MCP wiring, and the brand voice ("the smartest friend who works in tech") is generic. The 48-hour activation window framing is strong; the rest is workmanlike.

## C1. Functional walkthrough — new-signup-to-paid happy path

The SaaS funnel: signup → 48-hour activation check → trial → trial-end conversion → retention → upgrade. Tracing one user lifecycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Signup webhook fires** | (workflow trigger) | Stripe / app webhook | Triggers New User Activation Check 48h later | (webhook handler) | Activation check queued | ✅ |
| **48h activation** | **CEO + CMO** | New user behavior data | Personalized nudge for users not at activation milestone | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Activation nudge email | ✅ EXPLICIT — but depends on operator pasting "key setup steps" data into KB |
| **Support** | **Support Lead** | Inbound ticket | Categorize (bug/feature/how-to/billing/integration), respond first contact, build self-serve docs | `send_email`, `knowledge_lookup` + BUILTIN | Ticket response + categorization data | 🟡 IMPLICIT — system prompt says "identify recurring problems for product fixes" but no escalation to engineering pipeline |
| **Trial-end** | **CMO** | Trial ending in 7 days (Stripe webhook) | 3-part email sequence | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Trial-ending email sequence drafts | ✅ EXPLICIT |
| **Churn risk** | **Product Analyst** | User inactive 7+ days | Win-back message draft | `web_search`, `knowledge_lookup` + BUILTIN | Win-back drafts (approve_first mode) | ✅ EXPLICIT |
| **Weekly health** | **CEO** | All metrics | Signups + activation + engagement + churn risk + revenue | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Weekly product health report | ✅ EXPLICIT |

### Break points

1. **No Stripe tools in any agent's `tools[]`** — `requiredIntegrations: ["stripe_mcp", "resend_mcp"]`. CEO's "monitor activation and churn metrics daily" + Product Analyst's churn signal detection both depend on Stripe data. **Auto-attach via `getToolsForAgent` handles runtime — but no agent system prompt enumerates Stripe tools or instructs the agent to use them.** Same library-wide pattern.

2. **No PostHog / Amplitude / Mixpanel MCP** — Product Analyst's role description explicitly: *"You track feature adoption — which features are used most, which are ignored, and which correlate with retention."* Setup checklist is honest: *"No direct analytics MCP yet. The Product Analyst works from metrics you paste into knowledge items."* But this is the Product Analyst's CORE function. **Without product analytics wiring, the analyst is paste-driven.**

3. **No GitHub tools in any agent's `tools[]`** — `github_mcp` is suggested for *"Support Lead references open issues in responses; CEO tracks roadmap progress."* No agent has `github_*` tools listed. Auto-attach handles runtime but agents aren't told they have these tools.

4. **No bug-to-engineering escalation workflow** — Support Lead categorizes tickets including "bug" type. **No workflow routes bug-categorized tickets to engineering, no agent owns developer coordination.** Operator picks up bugs manually.

5. **No customer success role** — Support Lead handles tickets. Customer Success in B2B SaaS is distinct: proactive account health, expansion opportunities, renewal management. **Not modeled.** Setup checklist hints at HubSpot for "sales-assisted motion" but no agent owns it.

6. **No DevRel / community function** — modern SaaS often runs Discord/Slack community + developer documentation + integration partner programs. None of this is in scope.

7. **No billing/dunning specialist** — payment failures are part of Churn Risk Detection but there's no separate agent for dunning sequences, payment retry logic, or failed-card recovery. **Failed-payment-recovery is a 5-15% revenue lever in SaaS — under-served here.**

8. **Trial Ending Sequence is `webhook`-triggered** — depends on Stripe webhook firing for trial events. **Need to verify webhook handler exists.** I'm flagging this as P1 — let me check if there's a Stripe trial webhook route.

9. **48-hour activation check is webhook-triggered** — same dependency on signup webhook. **What webhook fires 48h after signup?** If no scheduled job runs at +48h, this can't work. Possibly a delay-queue pattern.

10. **Inter-agent coordination via CEO** — standard pattern.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `stripe_mcp` | **Required** | When installed | ⚠ Auto-attach but no agent has Stripe tools in `tools[]` | CEO + Product Analyst churn detection both depend on Stripe data |
| `resend_mcp` | **Required** | When installed | ✅ Configured | CEO + Support Lead + CMO have `send_email` |
| `github_mcp` | Suggested | Auto-attach when installed | ⚠ No agent has github_* tools | Support Lead "references open issues" but no tool wiring |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot_* tools | "Sales-assisted motion for Team or Enterprise tiers" but no agent owns sales |
| `slack_mcp` | Suggested | When installed | ⚠ No agent has slack_* tools | "Post churn alerts and activation milestones to the team channel" — no wiring |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct — SaaS isn't video |
| PostHog / Amplitude / Mixpanel | Mentioned | ❌ NOT wired | ⚠ Operator-side | Honest disclosure |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** | |

### 8-sub-check audit (for the 2 wired integrations)

| Check | `stripe_mcp` | `resend_mcp` |
|---|---|---|
| Credential flow | Restricted key (read for reporting; write for refunds — not recommended initially per setup checklist) | Domain + SPF/DKIM ✅ |
| Call construction | ✅ Standard schema | ✅ |
| Rate limit awareness | ❌ | ❌ |
| Error handling | Per global no-retry rule | Same |
| Cost ceiling | N/A — read-only data + transaction-fee model | ❌ |
| Fallback path | ❌ | ❌ |
| Model/version pinning | ✅ | ✅ |
| Tool enumeration in system prompts | ❌ Not enumerated in any agent | ✅ via `send_email` |

---

## C3. Media generation deep-check

**Not applicable.** No image/video/voice/music generation. SaaS marketing content is text + screenshots + occasional video demos. **Auto-attached video stack absent (correctly excluded).** ✅

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $297? |
|---|---|---|---|---|---|
| **48-hour activation nudge email** | High when activation milestones in KB | Medium — depends on operator pasting milestones | High | High | ✅ Yes |
| **Trial-ending 3-part email sequence** | High — structured | Medium — generic without product specifics in KB | High | High | ✅ Yes |
| **Churn-risk win-back message** | High | Medium | High | High | ✅ Yes |
| **Support ticket response (categorized + first-contact resolution)** | High when KB populated | Medium — generic without product KB | High | High | ✅ Yes |
| **Self-serve doc draft (from recurring tickets)** | High | High | High | High | ✅ Yes |
| **Weekly product health report** | Medium when no Stripe data flowing | Medium | High | Medium | ⚠ Borderline |
| **Cohort analysis (Product Analyst)** | Low without product analytics tools | Low | Medium | Low — operator pastes data | ❌ Fails for premium analytics use |
| **Feature adoption analysis** | Same — operator-paste-driven | Low | Medium | Low | ❌ Fails |
| **Trial-to-paid campaign** | High — benefit-led | Medium | High | Medium — operator deploys | ⚠ Borderline |
| **Activation steps KB** | High when filled in | High | High | High | ✅ Yes |
| **Churn risk signals + retention playbook KB** | High when filled | High | High | High | ✅ Yes |

**Two outright fails on the analytics-dependent outputs.** Product Analyst's value crashes without PostHog/Amplitude/Mixpanel wiring. Other outputs are mostly Yes when KB is populated.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Operator's Stripe key invalid | CEO's MRR + Product Analyst's churn data fails. **Weekly product health report becomes empty/inaccurate.** | **P1** |
| 2 | Signup webhook doesn't fire (no integration with app) | New User Activation Check workflow doesn't trigger. **48-hour activation nudge silently never fires.** | **P0** — depends on operator wiring webhook properly |
| 3 | Operator hasn't pasted activation milestones into KB | Activation nudge emails are generic ("we noticed you haven't gotten started yet"). **Low conversion.** | **P0** — first-week trap |
| 4 | Trial-ending Stripe webhook doesn't fire | Trial Ending Sequence stalls. **High-revenue moment missed.** | **P0** |
| 5 | 3am unsupervised | All workflows `review_after`, `approve_first`, or `notify`. Acceptable. | OK |
| 6 | Operator runs Churn Risk Detection daily | `approve_first` mode — operator approves win-back messages. Acceptable. | OK |
| 7 | Customer scales 1 → 10K active users | Volume of weekly tickets grows. Support Lead can't respond to all if running solo. **No queue management.** | P1 |
| 8 | PostHog data is stale (operator forgot to paste) | Product Analyst works on outdated data. **No staleness check.** | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + 4 first-week actions explicit | ⚠ KB-populating burden is heavy — activation milestones, churn signals, top support questions all required from operator |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 8 KB items — Pricing tiers + Activation steps + Refund policy + Top support FAQs + Onboarding milestones + Churn risk signals + retention playbook | ✅ Adequate but not deep |
| **Voice** | "Clear, technical where needed, and genuinely helpful. Sound like the smartest friend who works in tech." | ⚠ Generic. Could be any SaaS template. |
| **Progress visibility** | Weekly product health + daily churn risk + 48h activation + 7-day-pre-trial-end = 4-tier cadence | ✅ |
| **Handoff moments** | Most workflows `review_after`. Churn risk = `approve_first`. Acceptable. | ✅ |
| **The 90% rule** | ~50-60% autonomous. Activation, trial, churn, support all KB- + Stripe-data-dependent. Without those, agents work in placeholder mode. | ⚠ Lower than implied |
| **48-hour activation framing** | Strong CEO system prompt: *"the most dangerous moment in a SaaS user's journey is the first 48 hours"* | ✅ Premium framing of one specific lever |

---

## C7. Cost efficiency

For a SaaS startup at $10K MRR with 200 active users:
- LLM weekly: ~$2-4 across 4 agents
- Stripe: 2.9% + $0.30 per transaction (revenue cost, not template cost)
- Resend: $20-50/mo
- Optional: GitHub (free for small teams), HubSpot ($20-50/mo), Slack (free or per-user)
- **Total: ~$30-80/mo template infrastructure**

**Cost guardrails:** None at template level. Agents call APIs unbounded. Acceptable for the scale (LLM costs are minimal here).

**Cost-tier-down opportunity:** Support Lead's first-contact responses + CMO's email drafts are pattern-heavy → Haiku candidates. Keep Sonnet 4.5 for Product Analyst's cohort analysis (requires reasoning) + CEO's weekly report (synthesis).

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: 4 agents is thin for SaaS premium SKU
**What:** SaaS operations at scale need: Customer Success (B2B), Billing/Dunning specialist, DevRel, Product Manager separate from Analyst, Sales (Team/Enterprise tiers). **4 agents covers the basics.** For a $297+ SaaS template, the buyer expects more depth.

**Why it matters:** Priority 5 (Premium polish). Comparison to other templates in the library: `tiktok_shop` has 11 agents, `faceless_youtube` 14, `dealhawk_empire` 14, `agency` 8, `ghost_operator` 5. SaaS Product at 4 is the thinnest C-suite-style template.

**Fix options:**
- **Path A: Add 2-3 specialist agents.** Specifically:
  - **Customer Success Manager** (B2B account health + expansion opportunities + renewal management) — distinct from Support Lead
  - **Billing & Dunning Specialist** (failed payment recovery, dunning sequences, subscription management) — distinct from CMO
  - Optional: **DevRel / Community Manager** (Discord/Slack community + integration partners)
- **Path B: Keep at 4 agents but tighten existing roles.** Expand Support Lead to include Customer Success. Expand Product Analyst to include billing/dunning analysis. Make CMO own DevRel.
- **Path C: Bifurcate by SaaS sub-archetype.** B2C SaaS (4 agents fine — focus on activation + retention + churn). B2B SaaS (more agents — add CS + Sales). Two templates.

I lean **Path A** — 6-7 agents matches the SaaS complexity and the buyer's expectation.

### P0-2: No Stripe tools in any agent's `tools[]`
**What:** `requiredIntegrations: ["stripe_mcp", "resend_mcp"]` — Stripe is core. CEO's MRR tracking + Product Analyst's churn signals + Trial-Ending Sequence all depend on Stripe data. **No agent's `tools[]` lists Stripe tools.**

**Fix:**
```diff
  // CEO
  tools: [
    "send_email",
    "web_search",
    "knowledge_lookup",
+   // Stripe tools auto-attach when stripe_mcp installed:
+   // stripe_list_subscriptions, stripe_list_charges, stripe_get_customer
+   // stripe_get_payment_intent, stripe_list_invoices
  ]
  
  // Product Analyst
  tools: [
    "web_search",
    "knowledge_lookup",
+   // stripe_list_subscriptions, stripe_get_customer, stripe_list_charges
  ]
```
Update each agent's system prompt to enumerate Stripe tools.

### P0-3: Webhook dependencies undocumented
**What:** New User Activation Check (`webhook` trigger) and Trial Ending Sequence (`webhook` trigger) depend on operator wiring webhooks correctly. Setup Checklist doesn't tell operator: (a) what webhook URLs to use, (b) where to configure them in Stripe + their app, (c) how to test the wiring.

**Why it matters:** Priority 1 (Functional). Operator creates business → workflows never fire → "AI doesn't do anything."

**Fix:** Add to Setup Checklist firstWeekActions:
```
- Configure Stripe webhooks (https://dashboard.stripe.com/webhooks):
  * customer.subscription.trial_will_end → /api/webhooks/stripe/[businessId]
  * customer.subscription.deleted → /api/webhooks/stripe/[businessId]
  * Verify the test event fires the appropriate workflow.
- Configure your app's signup webhook to fire to:
  /api/webhooks/saas/[businessId]/new-signup
- Run the New User Activation Check workflow MANUALLY first to verify
  it produces drafts you'd actually send.
```
And verify the webhook routes exist (`/api/webhooks/stripe/[businessId]`, `/api/webhooks/saas/[businessId]`). If they don't, build them or document that operator must implement.

### P0-4: PostHog/Amplitude/Mixpanel not wired — Product Analyst is paste-driven
**What:** Product Analyst's job is feature adoption + churn signals + cohort analysis. **None of this works without product analytics integration.** Setup Checklist is honest but the limitation is severe.

**Fix options:**
- **Path A:** Add a `posthog_mcp` (or Amplitude / Mixpanel MCP) as suggested integration. Wire `posthog_*` tools to Product Analyst's `tools[]`.
- **Path B:** Document the operator's paste-cadence requirement explicitly: *"Product Analyst expects weekly analytics paste from PostHog/Amplitude/Mixpanel into a designated KB item. Without this, churn risk + activation analysis are based on the operator's intuition."*

I lean Path A as roadmap; Path B as ship-fast.

### P0-5: System prompts don't enumerate the actual tool runtime (library-wide pattern)
Same fix.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No customer success / billing / dunning specialist
See P0-1 Path A.

### P1-3: No bug-to-engineering escalation workflow
Add:
```typescript
{
  name: "Bug Ticket Escalation",
  description: "Support Lead identifies bug-categorized tickets affecting 3+ users. Drafts a structured engineering ticket (steps to reproduce, expected vs actual behavior, user count, severity). Surfaces to CEO for engineering escalation.",
  trigger: "scheduled",
  output: "report",
  scheduleMode: "every",
  frequency: "daily",
  approvalMode: "review_after",
  agentRole: "Support Lead"
}
```

### P1-4: No competitor analysis workflow
Product Analyst's role mentions competitive analysis. No scheduled workflow.

### P1-5: No GitHub tool wiring
Add `github_*` tools to Support Lead + CEO `tools[]` (for issue lookup + roadmap visibility).

### P1-6: No Slack alerts for churn / activation milestones
Add `slack_post_message` to Product Analyst + CEO for real-time team alerts.

### P1-7: Trial-ending 3-part sequence is structured but not specific
Could pre-seed example email copy in KB so operators see the pattern.

### P1-8: No PLG (Product-Led Growth) playbook
PLG is the dominant SaaS go-to-market in 2026. KB has activation milestones but no PLG playbook (in-app upgrade prompts, expansion triggers, viral loops).

### P1-9: No referral program workflow
Most successful SaaS products have referral programs. Not modeled.

### P1-10: 4 workflows for 4 agents is light
Other templates in the SHIP-tier have 15-20 workflows. SaaS at 4 is thin operational cadence.

---

## C10. P2 issues

### P2-1: Pre-seed activation milestones KB
For "what good looks like" example.

### P2-2: Pre-seed top support questions KB
Same.

### P2-3: Brand voice generic
Could lean harder into a specific SaaS register (developer-friendly / no-bullshit / refuses-to-spam) similar to how `dealhawk_empire` voice is distinctive.

### P2-4: Customer story / case study pipeline missing
Like `agency` template's Case Study Producer.

### P2-5: SOC 2 / GDPR / HIPAA compliance not addressed
For B2B SaaS, security compliance is a sales blocker. Not modeled.

---

## Summary fix-time for `saas_product`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (5) | 4-agent shell expansion (or accept B2C scope), Stripe tool wiring, webhook documentation + verification, PostHog/analytics suggestion, system-prompt tool enumeration | **6-8 hours** (Path A — add agents) OR **3-4 hours** (Path B — document + tighten existing) |
| P1 (10) | primaryModel + fallback, bug escalation workflow, competitor workflow, GitHub wiring, Slack alerts, trial sequence pre-seeded, PLG playbook, referral workflow, more workflows | **3-4 hours** |
| P2 (5) | pre-seed KBs, brand voice, case study pipeline, security compliance | **1-2 hours** |

**Total to S-tier: ~10-14 hours** if expanding to 6-7 agents (Path A); **~7-10 hours** if keeping at 4 agents and tightening (Path B). **The 4-agent shell works for B2C SaaS at the lower price tier; B2B SaaS at $497+ probably needs more team depth.**

---

**Next message:** Section C for `high_ticket_coaching` (rank #13). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/13 — high_ticket_coaching  (transcript line 930, 20610 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `high_ticket_coaching`.

---

# SECTION C — TEMPLATE 13/19: `high_ticket_coaching` (High-Ticket Coaching / Mastermind)

**Verdict:** **NEEDS WORK** (~6-8 hours to S-tier — same shell-template profile as `saas_product`).
**Headline:** Tightly scoped to coaching/mastermind operators selling $2K–$25K offers. Stripe is genuinely required (payment plans + failed installment recovery is core CFO work). The "no income guarantees, no hype, no screenshot testimonials without written client permission" framing is hardcoded in the template description and CMO's escalation rules — **best FTC compliance in the library for the coaching category.** **But it's the thinnest shell:** 4 agents (CEO + Client Success + CMO + CFO), 4 workflows, generic voice ("authoritative, warm, results-focused — like a trusted mentor"), and no actual Stripe tools in CFO's `tools[]` despite Stripe being the agent's entire data source. Same library-wide patterns: `primaryModel` not set, system prompts don't enumerate runtime tools, no spend ceiling. The Launch Playbook KB exists but no scheduled workflow drives it.

## C1. Functional walkthrough — enrollment-to-graduation happy path

The high-ticket cycle: lead → discovery call → enrollment → payment plan → onboarding → milestone tracking → graduation → case study → next launch. Tracing one client lifecycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Lead qualification** | **CEO** | New lead webhook | Score lead, draft call prep brief + recommended follow-up sequence | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Call brief + follow-up plan | ✅ EXPLICIT (approve_first) |
| **Discovery call** | (operator runs the call) | Call brief + lead context | (operator-driven) | | Verbal commitment OR objection | 🟡 IMPLICIT — no agent owns transcribing the call |
| **Enrollment** | **CEO** | Enrolled client | Send welcome + payment instructions | `send_email` + BUILTIN | Welcome email + Stripe payment link instructions | 🟡 IMPLICIT — no Stripe tools to actually create payment link |
| **Payment plan** | **CFO** | Stripe webhook (subscription created) | Track payment plan health, flag at-risk | `knowledge_lookup` ONLY | Payment plan tracking | 🔴 BREAK — CFO has no Stripe tools to actually read |
| **Onboarding** | **Client Success** | Enrollment complete | Welcome sequence, expectation-setting, community access setup | `send_email`, `knowledge_lookup` + BUILTIN | Onboarding sequence | 🟡 IMPLICIT — no community-posting tools (Skool/Circle/Discord acknowledged as manual) |
| **Milestone tracking** | **Client Success** | Weekly client activity | Track milestones, draft check-ins for quiet clients, celebrate wins | `send_email`, `knowledge_lookup` + BUILTIN | Weekly client check-in drafts | ✅ EXPLICIT |
| **Failed payment** | **CFO** | Stripe failed payment webhook | Empathetic-but-firm follow-up sequence | `knowledge_lookup` ONLY | Follow-up draft (approve_first) | 🔴 BREAK — agent has no `send_email` or Stripe tools |
| **Graduation → case study** | **CMO** | Client wins | Case study + testimonial post + before/after narrative | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Case study draft | ✅ EXPLICIT |
| **Launch** | **CEO + CMO** | Launch trigger (manual) | Awareness/desire/enrollment/deadline phase content calendar | (CEO) + (CMO) | Launch content queue | 🟡 IMPLICIT — workflow is `manual` trigger, no auto-launch cadence |

### Break points

1. **CFO has only `knowledge_lookup`** — exact same starvation as agency template's COO and ecommerce template's Operations Manager. CFO's *entire role* is reading Stripe data and drafting follow-ups. Has neither `stripe_*` tools nor `send_email`. **Cannot read payment plans. Cannot send failed-payment recovery sequences.**

2. **No Stripe tools in any agent's `tools[]`** — Stripe required, but neither CEO nor CFO has Stripe tools. Auto-attach via `getToolsForAgent` handles runtime. **No agent system prompt instructs the agent to call Stripe.**

3. **Webhook dependencies undocumented** — New Lead Qualification (`webhook`) and Stripe Payment Follow-Up (`webhook`) both depend on operator wiring webhooks correctly. Setup Checklist doesn't tell operator: (a) what webhook URLs to configure in Stripe, (b) how to test the wiring, (c) what events to subscribe to.

4. **No discovery-call agent or workflow** — high-ticket coaching is sold on discovery calls. Operator runs the call manually. **No agent transcribes call recording or auto-extracts the qualification + objection data the CMO would use for case studies.**

5. **No community-posting tools** — Skool/Circle/Discord acknowledged as "no MCP." Client Success drafts community announcements; operator posts manually. **Acceptable disclosure but means Client Success is significantly less autonomous than the role description implies.**

6. **No webinar/VSL workflow** — Launch Playbook KB has the awareness/desire/enrollment/deadline framework, but no scheduled workflow drives webinar registration sequences, replay nudges, or post-webinar pitch calendar. Launch Content Queue is generic.

7. **No client onboarding workflow** — Client Success "runs client onboarding for every new enrollment" per role instructions, but the only Client Success-related workflow is Weekly Client Check-In. New enrollments don't trigger an onboarding workflow automatically.

8. **No referral workflow** — high-ticket coaching businesses rely heavily on referrals. None modeled.

9. **Voice is workmanlike, not premium** — "Authoritative, warm, results-focused." Could be any coaching template. Compared to `dealhawk_empire`'s "empathy-first, anti-pressure" or `tiptax_affiliate_engine`'s "calm, evidence-led, anti-hype," the coaching voice doesn't differentiate.

10. **Inter-agent coordination via CEO** — standard pattern.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `stripe_mcp` | **Required** | When installed | ⚠ Auto-attach but **no agent has Stripe tools in `tools[]`** | CFO's entire role depends on Stripe |
| `resend_mcp` | **Required** | When installed | ✅ Configured | CEO + Client Success + CMO have `send_email` (CFO does NOT) |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot_* tools | "Lead scoring + pipeline" referenced but not wired |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent has social tools | CMO drafts social content but can't publish |
| `whatsapp_cloud_mcp` / `twilio_mcp` / `telnyx_mcp` | Suggested (all 3) | When installed | ⚠ Same triad ambiguity as dealhawk/agency | Setup checklist mentions Twilio for "SMS discovery-call reminders" but no agent owns this |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct |
| Skool / Circle / Discord communities | Mentioned | ❌ Not wired | ⚠ Operator-side | Honest disclosure |
| GHL / GoHighLevel | Mentioned | ❌ Not wired | ⚠ Operator-side | "If you run on GHL today" — coaching operators commonly use GHL; setup checklist correctly says no MCP yet |
| Zoom / Google Meet | Mentioned | ❌ Not wired | ⚠ Operator-side | Calls happen on these platforms |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for the 2 wired)

| Check | `stripe_mcp` | `resend_mcp` |
|---|---|---|
| Credential flow | Restricted key with subscription read | Domain + SPF/DKIM ✅ |
| Call construction | ✅ Standard | ✅ |
| Rate limit awareness | ❌ | ❌ |
| Error handling | Per global no-retry rule | Same |
| Cost ceiling | N/A read-only | ❌ |
| Fallback path | ❌ | ❌ |
| Model/version pinning | ✅ | ✅ |
| Tool enumeration in system prompts | ❌ Not enumerated for CFO (the agent that needs it most) | ✅ via `send_email` |

---

## C3. Media generation deep-check

**Not applicable.** No image/video/voice/music gen. Coaching content is text + occasional video on operator's own platforms. Auto-attached video stack absent (correctly excluded). ✅

**Note:** A coaching template could benefit from `transcribe_audio` (Whisper) for discovery call recordings → automated case study generation. Not currently wired.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $297? |
|---|---|---|---|---|---|
| **Lead qualification call brief (CEO)** | High when KB populated (objections + offer + transformation) | Medium — generic without KB | High | High | ✅ Yes |
| **Discovery follow-up sequence** | High — 30-min response framing | High | High | High | ✅ Yes |
| **Weekly client check-in (Client Success)** | High — milestone-aware, personalized | High when KB has milestones | High | High | ✅ Yes |
| **Failed payment follow-up sequence (CFO)** | Empty without Stripe data — and CFO can't actually send | Low | Medium | LOW — CFO can't send, would need to delegate to CEO/Client Success | ❌ Fails |
| **Case study draft (CMO)** | High — client wins → case study pattern is solid | High when client's actual results documented | High | High | ✅ Yes |
| **Launch content calendar** | Medium — manual trigger, generic phase content | Medium | High | Medium | ⚠ Borderline |
| **Onboarding sequence** | High when KB has program structure | High | High | High | ✅ Yes |
| **Weekly client health report** | High when Client Success has milestone data | Medium — depends on operator paste of activity | High | High | ✅ Yes |
| **Monthly financial report (CFO)** | Empty without Stripe tools — paste-only | Low | Medium | Low | ❌ Fails |
| **Authority positioning content** | Medium — generic "authority-driven, story-based" | Medium | High | Medium | ⚠ Borderline |

**Two fails on CFO outputs.** Without Stripe tools wired, CFO is paste-driven for all of: payment plan tracking, failed payment recovery, monthly financial reports. **The agent paying customers most expect to be autonomous (financial ops) is the most starved.**

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Operator's Stripe key invalid | CFO can't read data. **Failed payment recovery sequences silently never send.** | **P0** |
| 2 | Stripe payment failed webhook doesn't fire | CFO never sees the failure. **Lost revenue + client churn risk silent.** | **P0** |
| 3 | New Lead Qualification webhook doesn't fire (operator hasn't wired) | CEO never gets call brief. **Manual paste required.** | **P1** |
| 4 | Operator hasn't pasted "Enrollment objections and approved answers" KB | CEO's call brief is generic. Conversion suffers. | **P1** |
| 5 | 3am unsupervised | Workflows: New Lead = `approve_first`, Stripe Failed = `approve_first`, Weekly Check-In = `review_after`, Launch Queue = `review_after`. **Acceptable.** | OK |
| 6 | Customer scales 1 → 50 active clients | Client Success handles all. **No queue management.** Personalized weekly check-ins for 50 clients = 50 LLM calls weekly. Cost-OK but operator review burden grows. | P1 |
| 7 | Client requests refund | CFO escalates per escalation rules. CEO handles. **No automated refund processing.** Acceptable. | OK |
| 8 | Customer disputes a payment (chargeback) | CFO escalates. **No agent owns chargeback evidence collection.** | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup Checklist + 4 first-week actions | ⚠ Heavy KB-populating burden (offer + transformation + pricing + objections + onboarding milestones + launch playbook) |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 7 KB items including Pricing/payment plans/refund policy + Enrollment objections + Launch playbook | ✅ Adequate but each is a stub |
| **Voice** | "Authoritative, warm, results-focused" | ⚠ Generic-coaching. Doesn't differentiate. |
| **FTC compliance** | "no income guarantees, no hype, no screenshot testimonials without written client permission" hardcoded | ✅ **Best in library on coaching-specific FTC compliance** |
| **Progress visibility** | Weekly Client Check-In + Weekly Client Health Report (referenced) + Monthly Financial Report (referenced) = 3-tier cadence | ✅ Adequate |
| **Handoff moments** | New Lead = `approve_first`, Stripe Failed = `approve_first`. Sensible. | ✅ |
| **The 90% rule** | ~50-60% autonomous. CFO is mostly paste-driven without Stripe. Discovery calls are operator-side. Community is operator-side. | ⚠ Lower than implied |

---

## C7. Cost efficiency

For a coaching business with 30 active clients at $5K avg program value:
- LLM weekly: ~$2-4 across 4 agents (Client Success weekly check-ins are the heaviest)
- Stripe: 2.9% + $0.30 per transaction (revenue cost)
- Resend: $20-50/mo
- Optional: HubSpot ($50/mo), Twilio ($30-50/mo SMS), Skool ($99/mo), Zoom ($15-20/mo)
- **Total: $35-150/mo template infrastructure**

**Cost guardrails:** None. SMS via Twilio if wired could blast unbounded.

**Cost-tier-down:** Client Success weekly check-ins are pattern-heavy → Haiku candidates. Keep Sonnet 4.5 for case studies + launch copy + lead qualification briefs.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: CFO has only `knowledge_lookup` — cannot read Stripe or send anything
**What:** CFO `tools: ["knowledge_lookup"]`. Role is *"track enrollment revenue, monitor all payment plan installments, draft follow-ups for failed payments, produce monthly financial reports."* **All four require either Stripe data (no tools) or email send (no tools).**

**Why it matters:** Priority 1 (Functional) + Priority 2 (Output Quality). CFO is the highest-ROI agent in this template (failed payment recovery is 5-15% of revenue) and it's the most starved. Customer pays for autonomous financial ops; gets paste-driven shell.

**Fix:**
```diff
  // CFO
  tools: [
    "knowledge_lookup",
+   "send_email",
+   "send_telegram_message",
+   // Stripe tools auto-attach when stripe_mcp installed:
+   // stripe_list_subscriptions, stripe_get_subscription, stripe_list_invoices,
+   // stripe_list_charges, stripe_get_customer, stripe_list_payment_intents
  ]
```
Update CFO system prompt to enumerate Stripe tools and explicitly drive failed-payment workflow:
```
You have direct access to Stripe via stripe_list_subscriptions / 
stripe_list_invoices / stripe_list_charges. Run a daily sweep of:
- Subscriptions with status="past_due" — draft empathetic-but-firm follow-up
- Subscriptions with cancellation requested in next 30 days — surface to Client Success for retention attempt
- Invoices marked uncollectible — escalate immediately to CEO

Send follow-ups via send_email after CEO approval (approve_first mode).
```

### P0-2: Stripe webhook dependencies undocumented
**What:** Stripe Payment Follow-Up workflow (`webhook` trigger) needs Stripe webhook routing. New Lead Qualification webhook (likely from app or Calendly) also needs routing. **Setup Checklist doesn't tell operator how to configure.**

**Why it matters:** Priority 1 (Functional). Workflows silently never fire. Operator thinks "the AI does it" — reality is they didn't wire the webhook.

**Fix:** Add to Setup Checklist firstWeekActions:
```
- Configure Stripe webhooks at https://dashboard.stripe.com/webhooks:
  Subscribe to: invoice.payment_failed, customer.subscription.deleted,
  customer.subscription.updated, charge.dispute.created
  Endpoint: /api/webhooks/stripe/[businessId]
- Configure your lead-capture system (Calendly, app form, Typeform) to fire
  POST to: /api/webhooks/highticket/[businessId]/new-lead
- Run New Lead Qualification + Stripe Payment Follow-Up MANUALLY first to
  verify wiring before trusting webhook automation.
```
And verify the webhook routes exist (`/api/webhooks/stripe/[businessId]`, `/api/webhooks/highticket/[businessId]`). Build them or document operator-side implementation.

### P0-3: Client onboarding has no workflow
**What:** Client Success "runs client onboarding for every new enrollment." **Only Client Success workflow is the Weekly Check-In.** New enrollments don't trigger an onboarding sequence automatically.

**Fix:** Add workflow:
```typescript
{
  name: "New Client Onboarding Sequence",
  description: "Triggers when Stripe webhook reports a new successful payment (initial deposit + first installment). Client Success drafts: welcome email + community access instructions + onboarding call invitation + first-week milestone checklist + week 1-30-day-90-day expectations. Aligns to the Client onboarding KB.",
  trigger: "webhook",
  output: "draft",
  approvalMode: "approve_first",
  agentRole: "Client Success"
}
```

### P0-4: System prompts don't enumerate the actual tool runtime (library-wide)
Same fix.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: 4 agents thin for high-ticket scale
For coaching businesses crossing $50K/mo, the team needs: **Sales Closer / Setter** (separate from CEO — runs discovery calls + objection handling) + **Community Manager** (separate from Client Success — owns Skool/Circle/Discord engagement). 4 → 6 agents.

**Fix options:**
- Path A: Add 2 agents (Sales Setter + Community Manager).
- Path B: Keep at 4 but acknowledge in description: *"For coaching businesses up to ~$50K/mo. Beyond that, you'll need additional team — paid offers handle Sales Setter / VA functions."*

### P1-3: No discovery call transcription / auto-case-study pipeline
Add `transcribe_audio` (Whisper) tool wiring. Workflow: operator records call → upload to R2 → Whisper transcribes → CEO/CMO extracts qualification data + case-study material.

### P1-4: No referral workflow
High-ticket relies on referrals. Add `Quarterly Referral Activation` workflow.

### P1-5: No webinar / launch sequence specifics
Launch Playbook KB exists but no scheduled workflow. Add:
```typescript
{
  name: "Launch Sequence Activation",
  description: "Manual trigger 14 days before launch open. Generates 14-day awareness phase + 7-day desire phase + 5-day enrollment phase + 48-hour deadline phase content. Email + social + DM sequences per phase.",
  trigger: "manual",
  output: "content_queue",
  approvalMode: "approve_first",
  agentRole: "CMO"
}
```

### P1-6: HubSpot suggested but no agent uses
Setup checklist mentions HubSpot for "lead scoring + pipeline" but no agent has hubspot tools. Same library-wide pattern.

### P1-7: Twilio SMS for discovery reminders not wired
Setup checklist mentions Twilio for SMS discovery-call reminders. No agent owns this. CEO could pick this up if `twilio_mcp` installed.

### P1-8: Brand voice generic
"Authoritative, warm, results-focused" matches every coaching template. Could differentiate: maybe "anti-hype, evidence-led, no income claims ever" with specific examples.

### P1-9: No spend ceiling
Same library-wide.

### P1-10: No chargeback evidence-collection workflow
When a chargeback fires, evidence collection has a deadline. No agent owns this.

---

## C10. P2 issues

### P2-1: Pre-seed objections KB
For "what good looks like" example.

### P2-2: Pre-seed launch playbook with example timing
Add a calendar template showing actual phase windows.

### P2-3: No client lifecycle stage tracking workspace doc
Like SHOP_HEALTH.md or PORTFOLIO_TRACKER.md — a CLIENT_LIFECYCLE.md tracking stage per client.

### P2-4: No "case study queue" workspace doc
Like agency template's CASE_STUDY_QUEUE.md.

### P2-5: GHL + Zoom integration roadmap callouts
Setup checklist correctly notes GHL + Zoom as no-MCP. Could surface as a Sprint 2/3 roadmap item.

---

## Summary fix-time for `high_ticket_coaching`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | CFO tool wiring, webhook documentation, onboarding workflow, system-prompt tool enumeration | **3-4 hours** |
| P1 (10) | primaryModel + fallback, 4-agent expansion (or scope acknowledgment), discovery transcription, referral workflow, launch sequence workflow, HubSpot wiring, Twilio SMS, voice tightening, spend ceiling, chargeback workflow | **3-4 hours** (Path B — keep 4 agents) **6-7 hours** (Path A — add agents) |
| P2 (5) | pre-seed objections, launch timing, client lifecycle doc, case study queue, roadmap callouts | **1-2 hours** |

**Total to S-tier: ~7-10 hours** (Path B) **or 10-13 hours** (Path A). **The 4-agent shell works for solo coaches up to $50K/mo. Beyond that, the buyer expects more team depth.** Same pattern as `saas_product` — structurally OK but thin and generic for premium SKU.

---

**Next message:** Section C for `real_estate` (rank #14). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/14 — real_estate  (transcript line 948, 21335 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `real_estate`.

---

# SECTION C — TEMPLATE 14/19: `real_estate` (Real Estate Agent / Team)

**Verdict:** **NEEDS WORK** (~5-7 hours to S-tier — same shell-template profile as saas_product / high_ticket_coaching, with one specific bug).
**Headline:** Tightly scoped to licensed agents serving buyers/sellers (explicitly NOT wholesalers — "switch to Dealhawk Empire" is the clean redirect). 4-hour lead response SLA is correctly framed. SMS-first response is acknowledged with concrete data ("SMS wins ~60% vs email <30%"). Setup checklist correctly calls out A2P 10DLC registration and acknowledges no MLS/IDX MCP exists. **But: Sales Agent has `["send_email", "knowledge_lookup"]` — no SMS tools, despite the entire SLA hinging on SMS. CMO drafts listing content but has no social_media_mcp tools to publish. Past Client Nurture workflow is `frequency: "weekly"` but description says "quarterly check-in" — frequency mismatch bug.** Voice is generic. State-specific compliance (Fair Housing, RESPA, dual-agency disclosures) not modeled. No buyer-vs-seller journey distinction.

## C1. Functional walkthrough — lead-to-close happy path

Real estate cycle: lead → 4-hour response → discovery → appointment → showing → offer → contract → transaction milestones → close → past-client nurture → referral. Tracing one cycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Lead capture** | (workflow trigger) | Webhook from Zillow / realtor.com / contact form | Triggers New Lead Follow-Up | (webhook handler) | Lead in queue | 🟡 IMPLICIT — no agent owns webhook routing |
| **First response** | **Sales Agent** | Lead data | Personalized first-touch w/in 4 hours (target: minutes) | `send_email`, `knowledge_lookup` + BUILTIN | Follow-up draft (approve_first) | 🔴 BREAK — no SMS tools, but template's value prop hinges on SMS-first |
| **Discovery** | **Sales Agent** | Lead response | Qualify motivation, timeline, budget | (same) | Discovery notes + appointment proposal | ✅ EXPLICIT |
| **Appointment** | (operator runs) | | (operator-driven showing or call) | | Verbal commitment | 🟡 IMPLICIT |
| **Listing content** | **CMO** | New listing | Description, social posts, email blast, open house invite | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Listing content package | 🔴 BREAK — drafts but can't publish to social |
| **Transaction milestones** | **Client Care** | Signed contract | Track inspection → appraisal → financing → title → walkthrough → close | `send_email`, `knowledge_lookup` + BUILTIN | Per-milestone update emails | ✅ EXPLICIT |
| **Past client nurture** | **Client Care** | Past clients | Quarterly check-in + market updates + anniversary messages | `send_email`, `knowledge_lookup` + BUILTIN | Nurture drafts | 🔴 BREAK — workflow scheduled `weekly` but description says quarterly |
| **Pipeline** | **CEO** | All leads + transactions | Weekly pipeline report w/ velocity + conversion + month-end forecast | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Weekly pipeline report | ✅ EXPLICIT |

### Break points

1. **Sales Agent has no SMS tools, but template's entire 4-hour SLA depends on SMS.** Setup checklist explicitly says *"The 4-hour lead-response SLA depends on SMS. Email lead response wins <30% of the time; SMS wins ~60%."* But Sales Agent's `tools: ["send_email", "knowledge_lookup"]`. **Auto-attach via `twilio_mcp` install would surface SMS tools — but the agent's system prompt doesn't tell it to use them.** Customer reads description, expects SMS automation, gets email-only.

2. **`Past Client Re-Engagement` workflow has `frequency: "weekly"` but description says "quarterly check-in"** — bug. Either the schedule should be quarterly (and the agent shouldn't fire weekly on the same client) OR the description should say weekly with rotating cohorts.

3. **CMO drafts but doesn't publish** — same library-wide pattern. Listing social posts queue as drafts; operator publishes manually.

4. **No MLS/IDX integration** — honestly disclosed in setup checklist. **But this means the CMO's "compelling listing content" relies on operator pasting listing details into KB, and the CEO's pipeline view has no inbound MLS lead data.** Significant operator-side burden.

5. **Webhook for New Lead Follow-Up** — Zillow / realtor.com / contact form integrations need operator-side wiring. Setup checklist doesn't tell operator how.

6. **No state-specific compliance** — Fair Housing language, RESPA disclosures, agency disclosure requirements vary by state. **Template guardrails say "never make legal advice" but don't model state-specific listing language requirements** (e.g., disability access, source-of-funds, military-service protections per local law).

7. **No buyer journey vs seller journey distinction** — Sales Agent treats both with the same prompt structure. **Buyer agents and seller agents have very different workflows** (buyer: tour scheduling, mortgage pre-approval, comparison research, offer writing; seller: listing prep, pricing, showings, offer evaluation).

8. **No referral-request cadence workflow** — past-client nurture is generic. **40%+ of future transactions come from referrals per CMO's own framing**, but no scheduled workflow drives explicit referral asks.

9. **No commission split / brokerage compliance** — agents work under a brokerage. Template doesn't address commission splits, brokerage-required disclosures, or transaction coordinator handoff (most teams use a TC).

10. **Inter-agent coordination via CEO** — standard pattern.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `resend_mcp` | **Required** | When installed | ✅ Configured | All 4 agents have `send_email` |
| `whatsapp_cloud_mcp` / `twilio_mcp` / `telnyx_mcp` | Suggested (all 3) | Auto-attach when installed | ⚠ **Sales Agent has no SMS tools in `tools[]`** | Setup checklist says "The 4-hour SLA depends on SMS." Auto-attach handles runtime — agent doesn't know |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot_* tools | "Replaces your transaction spreadsheet" but no wiring |
| `social_media_mcp` | Suggested | When installed | ⚠ CMO has no social tools | Listing cross-posts referenced but no wiring |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct (real estate has video, but template doesn't promise generation) |
| MLS / IDX feeds | Mentioned | ❌ NOT wired | ⚠ Operator-side | Honest disclosure |
| GoHighLevel / kvCORE / Follow Up Boss | Mentioned | ❌ NOT wired | ⚠ Operator-side | Honest |
| Zillow / Redfin / Realtor.com | Mentioned | ❌ Not wired (only `web_search`) | ⚠ Operator-side | Web search for comp research only |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for `resend_mcp` only — the only tightly-wired integration)

| Check | `resend_mcp` |
|---|---|
| Credential flow | Domain + SPF/DKIM ✅ |
| Call construction | Standard schema ✅ |
| Rate limit awareness | ❌ |
| Error handling | Per global no-retry rule |
| Cost ceiling | ❌ |
| Fallback path | ❌ |
| Model/version pinning | ✅ |
| Tool enumeration in system prompts | ✅ via `send_email` |

---

## C3. Media generation deep-check

**Not in scope.** Real estate marketing uses photos (operator-supplied or agent's own), occasional drone footage, virtual tours. Template doesn't promise media gen. Auto-attached video stack absent (correctly excluded).

**Note:** A real estate template could benefit from: (a) `generate_image` for AI-staged room mockups (de-cluttering, virtual staging), (b) listing-photo enhancement. Not currently wired. Could be a P2 addition.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $197? |
|---|---|---|---|---|---|
| **New lead first-touch (4-hour SLA)** | High when KB populated | Medium — generic without local KB content | High | Medium — email-only when SMS is required | ⚠ Borderline (SMS gap) |
| **Listing content package** | High — description + social + email + open house | High when listing details in KB | High | Medium — operator publishes manually | ⚠ Borderline |
| **Transaction milestone updates** | High — structured per-stage | High when milestone KB filled | High | High | ✅ Yes |
| **Quarterly past-client nurture** | High when "weekly" frequency bug fixed | High when KB has nurture strategy | High | High | ✅ Yes (after frequency fix) |
| **Monthly market report** | Medium — operator paste of market data required (no MLS) | Medium | High | Medium | ⚠ Borderline |
| **Pipeline report (CEO)** | Medium without CRM tools | Medium | High | Medium | ⚠ Borderline |
| **Discovery conversation notes (Sales Agent)** | High when CRM populated | Medium | High | Medium | ⚠ Borderline |
| **Open house invite** | High | High | High | High | ✅ Yes |
| **Past client anniversary message** | High | Medium — depends on operator-pasted client data | High | High | ✅ Yes |
| **Referral request** | (no workflow drives this) | N/A | N/A | N/A | ❌ Not modeled |

**Five borderline outputs** — all rooted in: SMS gap, no MLS/IDX, no CRM tools wired. Three Yes outputs. One missing entirely (referral requests).

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Customer's Twilio key invalid | Auto-attach for Sales Agent fails. **4-hour SLA breaks silently — leads get email-only.** | **P0** |
| 2 | New Lead webhook doesn't fire (operator hasn't wired Zillow/contact form) | Sales Agent never sees the lead. Manual entry required. | **P0** |
| 3 | Operator hasn't pasted MLS data into KB | CMO listing content is generic. Market updates rely on operator paste. | **P0** |
| 4 | Past Client Re-Engagement fires weekly on same clients | Frequency bug — workflow says "weekly" but description says "quarterly." **Same clients get nurtured 13× in 90 days = annoying churn.** | **P1** |
| 5 | 3am unsupervised | New Lead = `approve_first`, Listing = `review_after`, Past Client = `review_after`, Market Update = `review_after`. **Acceptable.** | OK |
| 6 | Customer scales 1 → 50 active clients | Client Care runs transaction milestones for all. **No queue management.** Each transaction is 8+ milestones × 50 clients = 400+ updates/month. | P1 |
| 7 | Lead asks "what's my house worth?" | Guardrails say "never make appraisal claims." Agent should escalate or refuse. **Unclear if agent enforces this without explicit instruction.** | P1 |
| 8 | A2P 10DLC not registered for Twilio | SMS won't send — Twilio throttles/blocks. **Setup checklist warns but no agent verifies.** | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + 4 first-week actions + clean differentiation from Dealhawk | ✅ Acceptable |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 6 KB items including Agent bio + Services + Lead follow-up + FAQ + Transaction milestones + Past client nurture | ⚠ Most are placeholder/stub — operator fills in |
| **Voice** | "Professional, local, trustworthy. Sound like the neighbor who happens to be the best agent in town" | ⚠ Generic real estate. Doesn't differentiate. |
| **Progress visibility** | Weekly pipeline + monthly market update + transaction milestone tracking + past client nurture = 4-tier cadence | ✅ Adequate |
| **Handoff moments** | New Lead = `approve_first`. Other workflows = `review_after`. Sensible. | ✅ |
| **The 90% rule** | ~50% autonomous. Listing content = drafts. SMS lead response = depends on Twilio install + tool wiring. MLS data = operator paste. CRM = operator paste. **Lower than implied.** | ⚠ |
| **Differentiation from Dealhawk** | Clean — explicit redirect for wholesalers | ✅ Premium framing |
| **State-specific compliance** | Not modeled | ⚠ Real risk |

---

## C7. Cost efficiency

For an agent doing 24 transactions/year at $400K avg:
- LLM weekly: ~$2-3 across 4 agents
- Resend: $20-50/mo
- Optional: Twilio ($30-50/mo with A2P 10DLC), HubSpot ($50/mo) or kvCORE ($40-100/mo) or Follow Up Boss ($69-499/mo)
- MLS/IDX: $50-150/mo (operator pays directly to MLS, not template)
- **Total: $50-200/mo template infra**

**Cost guardrails:** None. SMS via Twilio if wired could blast unbounded. Acceptable risk at typical real estate volume.

**Cost-tier-down:** Past Client Re-Engagement + Market Update Newsletter = pattern-heavy → Haiku candidates.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: Sales Agent has no SMS tools — 4-hour SLA depends on SMS
**What:** Setup checklist explicitly: *"The 4-hour SLA depends on SMS. Email lead response wins <30% of the time; SMS wins ~60%."* Sales Agent `tools: ["send_email", "knowledge_lookup"]`. **Auto-attach via `twilio_mcp` would surface `send_sms` at runtime — but agent system prompt doesn't tell it to use SMS.**

**Why it matters:** Priority 1 (Functional). The template's value prop is the 4-hour response window. SMS is the channel. Customer pays for the SLA-driven differentiation, gets email-only.

**Fix:**
```diff
  // Sales Agent
  tools: [
    "send_email",
    "knowledge_lookup",
+   // Auto-attach when twilio_mcp installed:
+   // send_sms, whatsapp_send_text_message
  ]
```
And update Sales Agent system prompt:
```
4-HOUR SLA STRATEGY:
First-touch within 5 minutes when possible — SMS-first via Twilio
(twilio_send_sms) when operator has Twilio installed and A2P 10DLC
registered. Email is the fallback. Never SMS without verifying the
A2P 10DLC registration is complete (un-registered numbers are
throttled by Twilio in the US).

If Twilio is not installed: surface to operator that SMS is the
template's primary lead-response channel and recommend they install
twilio_mcp before scaling lead volume.
```

### P0-2: Past Client Re-Engagement frequency bug
**What:** Workflow definition: `scheduleMode: "every", frequency: "weekly"`. Description says: *"Drafts a quarterly check-in message for past clients."*

**Why it matters:** Priority 1 (Functional) + Priority 4 (Error handling). Same clients get nurtured weekly (13× in 90 days) = annoying. Past clients churn from over-contact.

**Fix options:**
- (a) Change `frequency: "weekly"` → `frequency: "monthly"` and rotate clients (operator's nurture list divided into 3 cohorts, each touched once/quarter). Update description to say "monthly, rotating cohort of past clients."
- (b) Change `frequency: "weekly"` → `frequency: "quarterly"` and accept that the workflow drives ALL clients each quarter.
- (c) Build a real cohort-rotation logic into the agent system prompt with explicit segmentation.

I lean (a) — most realistic agent operating cadence.

```diff
  {
    name: "Past Client Re-Engagement",
    description:
-     "Drafts a quarterly check-in message for past clients to keep the referral relationship warm.",
+     "Drafts a monthly check-in message for one cohort (operator divides past-client list into 3 cohorts; each touched once per quarter). Rotates through cohorts so no client is contacted more than once every 90 days.",
    trigger: "scheduled",
    output: "draft",
    scheduleMode: "every",
-   frequency: "weekly",
+   frequency: "monthly",
    approvalMode: "review_after"
  }
```

### P0-3: New Lead webhook + MLS/IDX dependencies undocumented
**What:** New Lead Follow-Up workflow (`webhook`) needs Zillow/realtor.com/contact form integration. Setup checklist mentions but doesn't tell operator HOW to configure.

**Fix:** Add to Setup Checklist firstWeekActions:
```
- Configure your lead-source webhooks to fire to:
  /api/webhooks/realestate/[businessId]/new-lead
  Common sources: Zillow Premier Agent (configure in Zillow dashboard),
  realtor.com (Lead Stream), contact form on your website.
- Run New Lead Follow-Up MANUALLY for the first 5 leads to verify
  the call brief output is correct before trusting webhook automation.
```

### P0-4: System prompts don't enumerate the actual tool runtime (library-wide pattern)
Same fix.

### P0-5: No state-specific compliance modeling
**What:** Real estate is heavily regulated and state-specific. Fair Housing language, agency disclosure, RESPA, source-of-funds disclosure, military protections vary by state. **Template guardrails are generic** ("never make market predictions, appraisal claims, or legal advice"). **CMO can publish a listing description that violates Fair Housing without flagging.**

**Why it matters:** Priority 4 (Error handling) + regulatory exposure. A non-compliant listing post can get the agent fined or de-licensed.

**Fix:** Add a Compliance KB item with:
- Fair Housing protected classes + safe-language patterns + forbidden patterns ("perfect for couples", "ideal for young professional", "walking distance" can be ableist)
- Agency disclosure timing per major states (CA, TX, FL, NY, IL)
- RESPA Section 8 prohibitions on referral fees / kickbacks
- Source of funds + buyer occupation ban (some states)
- Military service / source of income protections per state

And update CMO escalation rules:
```diff
  escalationRules:
+   "Escalate any listing description language that references protected classes (race / color / religion / national origin / sex / familial status / disability / military service / source of income — varies by state) — Fair Housing violations carry HUD penalties up to $109K. Knowledge_lookup the State Compliance KB before publishing any listing copy."
```

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No buyer-journey vs seller-journey distinction
Sales Agent treats both generically. Add KB items:
- "Buyer journey workflow" — pre-qualification, mortgage pre-approval lookup, search criteria, tour scheduling, offer prep, due diligence, close
- "Seller journey workflow" — listing prep, pricing strategy, photos/staging, MLS entry, showings, offer evaluation, contract negotiation, close

### P1-3: No referral-request cadence
40%+ of future transactions come from referrals per CMO framing. Add:
```typescript
{
  name: "Quarterly Referral Activation",
  description: "Client Care drafts a personalized referral-request message for past clients hitting their home anniversary or 1-year-since-close milestone. Frames the ask gracefully ('know anyone thinking of moving in [neighborhood]?') and includes a no-pressure escape ('totally cool if not — just figured I'd ask').",
  trigger: "scheduled",
  output: "draft",
  scheduleMode: "every",
  frequency: "monthly",
  approvalMode: "review_after",
  agentRole: "Client Care"
}
```

### P1-4: No CRM tools wired (HubSpot, kvCORE, Follow Up Boss)
HubSpot suggested but no hubspot_* tools in any agent's `tools[]`. Most agents use kvCORE / Follow Up Boss / GHL — none have MCPs yet. Setup checklist correctly notes operator-side workflow.

### P1-5: No social_media_mcp tools on CMO
Listing posts go to drafts. Customer expects auto-publish.

### P1-6: No spend ceiling on SMS
Same library-wide.

### P1-7: No transaction coordinator role
Most real estate teams have a TC who handles the milestone coordination. Client Care covers this functionally but the role isn't named that.

### P1-8: No commission split / brokerage compliance
Agents work under a brokerage. Template doesn't address commission splits or brokerage disclosure requirements.

### P1-9: A2P 10DLC verification missing at agent level
Setup checklist warns but no agent verifies registration before sending SMS.

### P1-10: Voice generic
Could differentiate as e.g., "neighborhood-first, no-jargon, market-honest" with examples.

---

## C10. P2 issues

### P2-1: Pre-seed agent bio + neighborhoods KB
For "what good looks like."

### P2-2: Pre-seed transaction milestone checklist
Standard 12-step checklist (offer accepted → close) — could be canonical.

### P2-3: AI listing photo enhancement
`generate_image` for virtual staging or de-cluttered alternative. Not currently wired.

### P2-4: Listing video / drone tour not modeled
Increasingly expected for premium listings; no agent owns this.

### P2-5: Open house guest follow-up
After open houses, agents need to follow up with attendees. No workflow.

---

## Summary fix-time for `real_estate`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (5) | SMS tool wiring + system prompt update, frequency-bug fix, webhook documentation, system-prompt tool enumeration, state compliance KB | **3-4 hours** |
| P1 (10) | primaryModel + fallback, buyer vs seller journey KBs, referral workflow, CRM wiring, social tools, spend ceiling, TC role naming, brokerage compliance, A2P verification, voice tightening | **2-3 hours** |
| P2 (5) | pre-seed KBs, transaction checklist, photo enhancement, video/drone, open house follow-up | **1-2 hours** |

**Total to S-tier: ~6-9 hours.** Same shell-template profile as `saas_product` and `high_ticket_coaching` — clean ICP, honest setup checklist, but thin tool wiring and a specific frequency-bug. **The SMS gap is the single biggest fix and unlocks the template's stated value prop.** State compliance KB is the biggest defensive add.

---

**Next message:** Section C for `local_service` (rank #15). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/15 — local_service  (transcript line 964, 17311 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `local_service`.

---

# SECTION C — TEMPLATE 15/19: `local_service` (Local Service Business)

**Verdict:** **NEEDS WORK** (~5-7 hours to S-tier — same shell-template profile as the other 4-agent service templates).
**Headline:** Tightly scoped to home-services trades (plumbers/HVAC/roofers/cleaners/landscapers/tree/pest). Post-Job Follow-Up review request within 2 hours of completed job is best-in-library on review velocity for local services. Setup Checklist correctly identifies Twilio + Resend as required + A2P 10DLC + acknowledges no GBP MCP. **But: setup checklist says Twilio is "required" while `requiredIntegrations: ["resend_mcp"]` only lists Resend — mismatch bug. Sales & Booking has no SMS tools despite SLA depending on SMS (same as real_estate). No GBP/Yelp/Angi monitoring tools. No commercial-vs-residential or emergency-dispatch differentiation. Generic voice.** Same library-wide patterns: `primaryModel` not set, no fallback, no spend ceiling.

## C1. Functional walkthrough — inquiry-to-5-star happy path

The local-services cycle: inquiry → 4-hour response → estimate → booking → job → 2-hour review request → 5-star review → past-customer nurture → seasonal promo. Tracing one job:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Inquiry** | (workflow trigger) | Webhook from Google / Yelp / Nextdoor / Angi / contact form | Triggers New Inquiry Response | (handler) | Lead in queue | 🟡 IMPLICIT |
| **First response** | **Sales & Booking** | Lead | 4-hour response w/ estimate within approved ranges + booking | `send_email`, `knowledge_lookup` + BUILTIN | Estimate + booking proposal | 🔴 BREAK — no SMS tools, but SLA hinges on SMS |
| **Booking** | **Sales & Booking** | Customer accepts | Confirmation + 24h reminder | (same) | Confirmation email | 🟡 IMPLICIT — no calendar/booking-system tools |
| **Job complete** | (operator-driven) | Tech finishes | Status update | (operator-side, e.g., Jobber) | Job-complete webhook | 🟡 IMPLICIT |
| **Review request** | **Reputation Manager** | Job-complete event | Personalized review request within 2 hours | `send_email`, `knowledge_lookup` + BUILTIN | Review request draft (notify mode) | 🔴 BREAK — no SMS, no GBP tools to verify post-review |
| **Review response** | **Reputation Manager** | New review (manual paste OR future webhook) | Public response within 24h | (same) | Response draft | 🔴 BREAK — no GBP / Yelp posting tools (acknowledged) |
| **Marketing** | **Marketing Lead** | Past-customer database | Seasonal promos + referral program + social content | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Promo email/SMS drafts + social content | 🔴 BREAK — no social_media_mcp tools, no SMS for past-customer SMS blasts |
| **Pipeline** | **CEO** | All bookings + revenue | Weekly booking summary + capacity planning | `send_email`, `knowledge_lookup` + BUILTIN | Weekly summary | 🟡 IMPLICIT — no calendar/booking integration |

### Break points

1. **Setup checklist vs template metadata mismatch** — Setup checklist explicitly says *"Twilio + Resend are both required"* but `requiredIntegrations: ["resend_mcp"]` only lists Resend. **Bug.**

2. **Sales & Booking has no SMS tools** — same gap as `real_estate`. *"4-hour inquiry SLA and Post-Job Follow-Up review requests run on SMS. Email response rates in this category are ~25% of SMS."* But agent's `tools: ["send_email", "knowledge_lookup"]`.

3. **Reputation Manager has no GBP tools** — honestly disclosed in setup checklist (no GBP MCP yet). **But also has no `social_media_mcp` to monitor reviews on Yelp / Angi / Nextdoor / Facebook.** Agent works from operator-pasted reviews only.

4. **Marketing Lead has no social_media_mcp** — drafts content but can't publish. Same library-wide pattern.

5. **CEO has no calendar/booking system tools** — Jobber / Housecall Pro / ServiceTitan acknowledged as no-MCP. CEO can't actually see the booking calendar.

6. **No commercial-vs-residential distinction** — pricing, scope, sales cycle all differ between residential and commercial customers. Sales & Booking treats both with the same prompt.

7. **No emergency-dispatch / 24-7 differentiation** — many local services have emergency surcharge tiers ($X surcharge mentioned in coreOffers placeholder). No agent or workflow handles emergency dispatch routing.

8. **No fleet / multi-tech / route optimization** — single-operator template. Multi-tech operations need dispatch, route planning, tech-availability tracking.

9. **No invoicing/deposit workflow** — Stripe is suggested for "deposits + job invoicing" but no agent has Stripe tools or owns invoicing.

10. **Webhook routing undocumented** — Yelp/Google/Nextdoor/Angi/Thumbtack/contact form lead webhooks need operator-side wiring.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `resend_mcp` | **Required** | When installed | ✅ Configured | All 4 agents have `send_email` |
| `twilio_mcp` (or `telnyx`) | Suggested per metadata; **REQUIRED per setup checklist** | Auto-attach when installed | ⚠ **Mismatch + no SMS tools in agent `tools[]`** | Bug |
| `whatsapp_cloud_mcp` | Suggested | When installed | ⚠ Same triad ambiguity | |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot tools | |
| `stripe_mcp` | Suggested | When installed | ⚠ No agent has Stripe tools | "Enables deposit collection" but no wiring |
| `social_media_mcp` | NOT in suggestedIntegrations | ❌ Not declared | ⚠ But Marketing Lead's role implies it | Should be added to suggested |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct |
| Google Business Profile | Mentioned | ❌ NOT wired | ⚠ Operator-side | Honest |
| Jobber / Housecall Pro / ServiceTitan | Mentioned | ❌ NOT wired | ⚠ Operator-side | Honest |
| Yelp / Angi / Nextdoor / Thumbtack | Mentioned (review platforms) | ❌ NOT wired | ⚠ Operator-side | |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for `resend_mcp` only — the only tightly-wired integration)

| Check | `resend_mcp` |
|---|---|
| Credential flow | Domain + SPF/DKIM ✅ |
| Call construction | Standard schema ✅ |
| Rate limit awareness | ❌ |
| Error handling | Per global no-retry rule |
| Cost ceiling | ❌ |
| Fallback path | ❌ |
| Model/version pinning | ✅ |
| Tool enumeration in system prompts | ✅ via `send_email` |

---

## C3. Media generation deep-check

**Not in scope.** Marketing Lead "creates social media content showcasing completed work, before-and-after transformations" — but agent has no `generate_image` tool. Operator-supplied photos. Auto-attached video stack absent. ✅

**Note:** A local-services template could benefit from `generate_image` for AI-enhanced before/after photo treatments. Not currently wired. P2.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $197? |
|---|---|---|---|---|---|
| **New inquiry response (4h SLA)** | High when KB populated | Medium without local pricing/scope | High | Medium — email-only when SMS is the channel | ⚠ Borderline |
| **Estimate within approved ranges** | High when KB has pricing | High when filled | High | High | ✅ Yes |
| **24h booking confirmation** | High | High | High | High | ✅ Yes |
| **Post-job 2-hour review request** | High — niche-specific timing is best in library | High when KB has review templates | High | Medium — without SMS, lower response rates | ⚠ Borderline |
| **Review response (positive)** | High | High | High | Medium — operator pastes manually to GBP/Yelp | ⚠ Borderline |
| **Review response (negative)** | High — empathy + acknowledge + offline-resolve framing | High | High | Medium — same paste burden | ⚠ Borderline |
| **Seasonal promo email + SMS** | High when seasonal calendar in KB | High when filled | High | Medium — SMS gap | ⚠ Borderline |
| **Weekly booking summary (CEO)** | Medium without booking-system data | Medium | High | Medium — relies on operator paste | ⚠ Borderline |
| **Social content (before/after)** | Medium — without `generate_image` | Medium | High | Medium — operator publishes manually | ⚠ Borderline |
| **Referral program (Marketing Lead)** | High when filled | High | High | Medium | ⚠ Borderline |

**Almost every output is borderline** — every "Yes" path requires KB to be deeply populated AND SMS tools wired AND social tools wired AND booking-system data flowing. The shell works; the wiring + KB population is the operator's burden.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Customer's Twilio key invalid | Auto-attach fails. **4-hour SLA breaks silently — leads get email-only, ~25% of SMS conversion.** | **P0** |
| 2 | New Inquiry webhook doesn't fire | Sales & Booking never sees lead. Manual entry required. | **P0** |
| 3 | Operator hasn't pasted pricing ranges into KB | Sales & Booking can't quote. Estimates default to "we'll get back to you" — kills conversion. | **P0** — first-week trap |
| 4 | A2P 10DLC not registered | SMS won't send. Setup checklist warns but no agent verifies. | **P1** |
| 5 | 3am unsupervised | New Inquiry = `review_after`, Post-Job = `notify`, Weekly = `review_after`, Seasonal = `review_after`. **Acceptable for `safetyMode: auto_low_risk`.** | OK |
| 6 | Customer scales 1 → 20 inquiries/day | Sales & Booking handles all. **No queue management.** Email-only response further degrades conversion at volume. | P1 |
| 7 | Negative review fires before operator sees | Reputation Manager drafts response within 24h (review_after mode). **But operator must paste to GBP/Yelp manually — 24h gap during business hours possible.** | P1 |
| 8 | Customer asks for an emergency / same-day service | Template doesn't model emergency dispatch. Sales & Booking treats as normal inquiry. **Lost emergency revenue.** | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + 4 first-week actions + A2P 10DLC warning | ✅ Acceptable |
| **Defaults** | `safetyMode: "auto_low_risk"` ✅ (different from most — appropriate for low-risk responses), **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 6 KB items: Services + Pricing + Booking/cancellation/warranty + Common questions + Review generation + Seasonal calendar | ⚠ Mostly placeholder/stub — operator fills in |
| **Voice** | "Reliable, friendly, straight-talking. Sound like the local pro who shows up on time." | ⚠ Generic local-services. Doesn't differentiate. |
| **Progress visibility** | Weekly booking summary + post-job review request + seasonal campaigns + new inquiry response = 4-tier cadence | ✅ Adequate |
| **Handoff moments** | New Inquiry = `review_after`, Post-Job = `notify`, Weekly = `review_after`, Seasonal = `review_after`. **Acceptable.** | ✅ |
| **The 90% rule** | ~50% autonomous. SMS gap, GBP gap, booking-system gap, social gap. Marketing Lead drafts heavy. | ⚠ |
| **Trade-specific differentiation** | None — plumber, roofer, landscaper all get the same 4-agent shell | ⚠ Trade-specific KBs would be premium |

---

## C7. Cost efficiency

For a single-tech home-services operator at 100 jobs/month:
- LLM weekly: ~$2-3
- Resend: $20-50/mo
- Twilio: $30-50/mo + A2P 10DLC fees ($15-30/mo)
- Optional: HubSpot ($50/mo), Stripe (transaction fees), Jobber ($49+/mo), Housecall Pro ($65+/mo)
- **Total: $50-150/mo template infra**

**Cost guardrails:** None. SMS could blast unbounded. Acceptable risk at typical service-business volume.

**Cost-tier-down:** Marketing Lead seasonal promos + Sales & Booking estimates = pattern-heavy → Haiku candidates.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: Setup checklist vs template metadata mismatch on Twilio
**What:** Setup checklist's `requiredMcps` lists Twilio with *"4-hour inquiry SLA and Post-Job Follow-Up review requests run on SMS"*. But `requiredIntegrations: ["resend_mcp"]` only lists Resend. **Customer reads description + checklist, expects Twilio to be required, finds it's optional.**

**Fix:**
```diff
- requiredIntegrations: ["resend_mcp"],
+ requiredIntegrations: ["resend_mcp", "twilio_mcp"],
- suggestedIntegrations: [
-   "whatsapp_cloud_mcp",
-   "twilio_mcp",
-   "telnyx_mcp",
+ suggestedIntegrations: [
+   "whatsapp_cloud_mcp",
+   "telnyx_mcp",
    "hubspot_mcp",
    "stripe_mcp",
+   "social_media_mcp"
  ],
```
And add `social_media_mcp` to suggested (currently absent — bug given Marketing Lead's role).

### P0-2: Sales & Booking + Reputation Manager have no SMS tools
**What:** Same library-wide pattern. Both agents need `send_sms` (Twilio) for SLA-critical workflows.

**Fix:**
```diff
  // Sales & Booking
  tools: [
    "send_email",
    "knowledge_lookup",
+   // send_sms (auto-attach when twilio_mcp installed)
  ]
  
  // Reputation Manager
  tools: [
    "send_email",
    "knowledge_lookup",
+   // send_sms (review request follow-ups)
  ]
```
Update both agents' system prompts to enumerate SMS as the primary channel.

### P0-3: System prompts don't enumerate the actual tool runtime (library-wide)
Same fix.

### P0-4: Webhook routing undocumented
**What:** New Inquiry Response depends on Yelp/Google/Nextdoor/Angi/contact form webhook. Setup checklist doesn't tell operator how to wire.

**Fix:** Add to firstWeekActions:
```
- Configure your lead-source webhooks to fire to:
  /api/webhooks/localservice/[businessId]/new-inquiry
  Common sources: Yelp Lead Center (Yelp Pro), Angi Pro, Thumbtack Pro,
  Google contact form, your website's contact form.
- For Post-Job Follow-Up: configure your job-management system
  (Jobber webhook, Housecall Pro webhook, manual Zapier trigger) to fire
  on job-complete event to: /api/webhooks/localservice/[businessId]/job-complete
- Run New Inquiry Response MANUALLY for the first 5 inquiries to verify
  pricing + tone are right before trusting webhook automation.
```

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No commercial-vs-residential distinction
Sales & Booking treats both with same prompt. **Add KB items**: "Commercial customer playbook" + "Residential customer playbook." Pricing, scope, sales cycle, decision-makers all differ.

### P1-3: No emergency dispatch differentiation
Many local services have 24/7 emergency surcharge tiers. **Add a "Emergency / Same-Day" KB item with surcharge logic + dispatch availability.**

### P1-4: No GBP / Yelp monitoring
Reputation Manager monitors reviews — but only operator-pasted ones. Could add a `Daily Review Sweep` workflow that uses `web_search` to scrape latest reviews from each platform (low-fidelity but better than nothing).

### P1-5: No social_media_mcp wiring even when installed
Marketing Lead drafts content; operator publishes manually.

### P1-6: No invoicing/deposit workflow
Stripe suggested but no workflow drives invoicing or deposit collection.

### P1-7: No spend ceiling
Same library-wide.

### P1-8: No fleet / multi-tech operations
Single-operator scope. Multi-tech operations need dispatch + route + tech-availability features.

### P1-9: A2P 10DLC verification missing
Setup checklist warns but no agent verifies registration before sending SMS.

### P1-10: Voice generic
Could differentiate as e.g., "trade-specific honesty — no upselling, no hidden fees, fixed-price quotes" with examples.

---

## C10. P2 issues

### P2-1: Trade-specific pricing KB pre-seeds
Different trades have different pricing structures. Pre-seed templates for plumbing, HVAC, roofing, landscaping, etc.

### P2-2: AI before/after photo enhancement
`generate_image` for visual marketing.

### P2-3: Video walkthrough for review request
Some operators send a Loom-style "thanks for choosing us" video with the review request. No agent owns this.

### P2-4: Yelp / Angi / Thumbtack lead-fee math
These platforms charge per lead. KB could include the cost-per-lead by platform + when each pays back.

### P2-5: Customer history / repeat-job tracking workspace doc
Like dealhawk's PORTFOLIO_TRACKER.md — a CUSTOMER_HISTORY.md tracking every past job + review + repeat opportunity.

---

## Summary fix-time for `local_service`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (4) | Twilio metadata fix + social_media to suggested, SMS tool wiring, system-prompt tool enumeration, webhook documentation | **2-3 hours** |
| P1 (10) | primaryModel + fallback, commercial vs residential KBs, emergency dispatch, GBP monitoring, social wiring, invoicing workflow, spend ceiling, multi-tech model, A2P verification, voice tightening | **2-3 hours** |
| P2 (5) | trade-specific pricing pre-seeds, AI photo enhancement, video walkthroughs, lead-fee math, customer history doc | **1-2 hours** |

**Total to S-tier: ~5-8 hours.** Same shell-template profile as `saas_product` / `high_ticket_coaching` / `real_estate`. **The Twilio metadata mismatch is the cheapest cosmetic fix; the SMS tool wiring is the highest-leverage functional fix.** Trade-specific pricing pre-seeds are the cheapest way to make the template feel less generic.

---

**Next message:** Section C for `service_business` (rank #16). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/16 — service_business  (transcript line 981, 15239 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `service_business`.

---

# SECTION C — TEMPLATE 16/19: `service_business` (Service Business)

**Verdict:** **NEEDS WORK — strongest candidate for retirement / consolidation in the library** (~3-4 hours to specialize-or-merge).
**Headline:** This is the most generic 4-agent template in the library and the one with the worst identity overlap. Setup checklist *itself* admits the problem: *"the #1 reason service-business templates feel like a demo."* The 4 agents (CEO + Sales & Intake + CMO + Service Coordinator) overlap directly with `high_ticket_coaching` (CEO + Client Success + CMO + CFO), `social_media_agency` (rank #17, similar shell), `agency` (8-agent expansion of the same archetypes), and to a lesser degree `skool_community` (CEO + Community + CMO + CFO). **Two real bugs:** Quarterly Business Review workflow has `frequency: "weekly"` (description says "Quarterly"), and KB has a duplicate item — `Service catalog and pricing` and `Offers and delivery` cover the same content. Same library-wide patterns: `primaryModel` not set, system prompts don't enumerate runtime tools, no spend ceiling.

## C1. Functional walkthrough — generic service happy path

The cycle: lead → 24h response → discovery → proposal → signed → onboarding → delivery → testimonial → next sale. Tracing one cycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Pipeline** | **CEO** | All agent outputs | Weekly priorities, business health summary, pipeline tracking | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Weekly summary | ✅ EXPLICIT |
| **Lead intake** | **Sales & Intake** | Inbound webhook | Qualify lead, propose discovery call | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Lead qualification + proposal | ✅ EXPLICIT (approve_first) |
| **Discovery + proposal** | **Sales & Intake** | Discovery transcript (operator-pasted) | Custom proposal | (same) | Proposal draft | ✅ |
| **Onboarding** | **Service Coordinator** | New signed client | Welcome + kickoff agenda + access requests + milestone timeline | `send_email`, `knowledge_lookup` + BUILTIN | Onboarding sequence draft | ✅ EXPLICIT (manual trigger) |
| **Delivery tracking** | **Service Coordinator** | Active project status | Milestone tracking, at-risk flag, weekly delivery status | (same) | Weekly status report + at-risk client list | ✅ EXPLICIT |
| **Marketing** | **CMO** | Client wins | Testimonials + case studies + content calendar + email nurture | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Weekly content queue | 🔴 BREAK — no social_media_mcp tools, drafts only |
| **Quarterly review** | **CEO** | Quarterly metrics | Comprehensive quarterly review | (same) | Quarterly business review report | 🔴 BREAK — workflow scheduled `weekly` (bug) |

### Break points

1. **`Quarterly Business Review` workflow has `frequency: "weekly"`** — description says *"Quarterly review covering revenue, client retention, pipeline health, marketing performance, and strategic priorities for the next quarter"*. **Frequency-bug — runs weekly, generates quarterly content. Same operator gets 13 quarterly reviews per quarter.** Bug.

2. **Duplicate KB items** — `Service catalog and pricing` (line ~1518) and `Offers and delivery` (line ~1554) are essentially the same content with different titles. Cosmetic bug + KB redundancy.

3. **CMO has no social_media_mcp tools** — same library-wide pattern. Drafts content; operator publishes manually.

4. **No SMS tools in any agent** — telephony triad suggested but no agent has `send_sms`. Sales & Intake's "24-hour follow-up discipline" depends on the channels it doesn't have.

5. **Identity overlap with 3-4 other templates**:
   - `high_ticket_coaching` — same 4-agent shell, but specialized for $2K-$25K offers (better differentiated)
   - `social_media_agency` — same 4-agent shell, specialized for SMMA (rank #17 — coming up)
   - `skool_community` — same 4-agent shell, specialized for Skool/community
   - `agency` — 8-agent expansion that bifurcates into traditional + AI Reseller
   - **What does `service_business` distinctively serve?** "Coaches, consultants, freelancers, and solo service providers." But coaches are served by `high_ticket_coaching`. Consultants and freelancers are served by `agency` (or its proposed `agency_creative` split). **No clear distinct buyer.**

6. **Voice generic** — "Warm, credible, clear, supportive. Speak like a trusted advisor — never salesy or pushy." Could be any service template.

7. **Webhook for New Lead Intake undocumented** — same pattern.

8. **Inter-agent coordination via CEO** — standard pattern.

9. **No specific service-type pricing models** — hourly vs project-based vs retainer all common; template doesn't differentiate.

10. **Sales & Intake "manages follow-up sequences with precision — every lead gets the right touchpoint at the right time"** — but no follow-up workflow drives this beyond a generic "Follow-up Sequence" weekly workflow. **Not actually wired to specific lead-stage triggers.**

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `resend_mcp` | **Required** | When installed | ✅ Configured | All 4 agents have `send_email` |
| `stripe_mcp` | Suggested | When installed | ⚠ No agent has Stripe tools | "Lets the CEO pull revenue, MRR, and churn" — no wiring |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot tools | Same pattern |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent has social tools | CMO drafts but can't publish |
| `whatsapp_cloud_mcp` / `twilio_mcp` / `telnyx_mcp` | Suggested (all 3) | When installed | ⚠ No agent has SMS tools | Same triad ambiguity, no opinion |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for `resend_mcp` only — the only tightly-wired integration)

Same as `real_estate` and `local_service`. Single-row table:

| Check | `resend_mcp` |
|---|---|
| All 8 checks | Same shell template profile as the other generic 4-agent service templates — ✅ on call construction + provider lock + tool enumeration via `send_email`; ❌ on rate limit awareness, error handling, cost ceiling, fallback path |

---

## C3. Media generation deep-check

**Not in scope.** No image/video/voice/music. Auto-attached video stack absent. ✅

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $197? |
|---|---|---|---|---|---|
| **New lead intake (24h SLA)** | High when KB filled | Medium — generic without service catalog | High | Medium — email-only when SMS is suggested | ⚠ Borderline |
| **Discovery + proposal** | High when KB filled | Medium — generic | High | High | ⚠ Borderline |
| **Follow-up sequence (weekly)** | High when KB filled | Medium | High | Medium | ⚠ Borderline |
| **Client onboarding sequence** | High — structured | High when KB filled | High | High | ✅ Yes |
| **Weekly content queue (CMO)** | High | High when KB filled | High | Medium — operator publishes manually | ⚠ Borderline |
| **Weekly client health check** | High when KB has milestone data | High | High | High | ✅ Yes |
| **"Quarterly" Business Review (running weekly — bug)** | Bug — same data 13× per quarter | N/A | Medium | Low — bug | ❌ Fails until bug fixed |
| **Testimonial / case study templates** | High when KB filled | High | High | High | ✅ Yes |

**Generic shell + 1 outright bug.** Most outputs are borderline because they depend on operator filling KB heavily.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Quarterly Business Review fires weekly | Same data 13× per quarter. Operator confusion. | **P0** — bug |
| 2 | Operator hasn't filled service catalog KB | Sales & Intake quotes generically — kills conversion | **P0** — first-week trap |
| 3 | New Lead webhook doesn't fire | Sales & Intake never sees lead | **P0** |
| 4 | 3am unsupervised | All workflows `review_after` or `approve_first`. Acceptable. | OK |
| 5 | Customer scales 1 → 30 active clients | Service Coordinator handles all. **No queue management.** | P1 |
| 6 | Customer compares this to `high_ticket_coaching` or `agency` and asks "which one?" | **No clear answer.** Marketing description doesn't differentiate. | **P0** — pre-purchase confusion |
| 7 | Operator pastes wrong service-type pricing (hourly vs project vs retainer) | Template doesn't differentiate; agents work with whatever | P1 |
| 8 | CMO drafts but operator never publishes | Drafts pile up. No alert. | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + 4 first-week actions | ⚠ Heavy KB-population burden |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 8 KB items (Service catalog + Pricing guardrails + FAQ + Onboarding + Comm guidelines + Testimonials + What we do + Offers and delivery [duplicate]) | ⚠ Generic stubs + 1 duplicate item |
| **Voice** | Generic warm-trusted-advisor | ⚠ Doesn't differentiate from any other service template |
| **Progress visibility** | Weekly content + weekly follow-up + weekly client health + weekly summary + "weekly quarterly" review (bug) = 4-5 weekly cadence | ⚠ Heavy weekly load |
| **Handoff moments** | New Lead = `approve_first`, others = `review_after`. Sensible. | ✅ |
| **The 90% rule** | ~50%. Same gaps as other shell templates. | ⚠ |
| **Differentiation from peer templates** | None | ⚠ **Structural** |

---

## C7. Cost efficiency

For a solo service provider:
- LLM weekly: ~$2-3
- Resend: $20-50/mo
- Optional: Stripe (transaction fees), HubSpot ($20-50/mo), Twilio ($30-50/mo)
- **Total: $40-130/mo**

**Cost guardrails:** None. Acceptable risk at typical solo-service volume.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: `Quarterly Business Review` frequency bug
**What:** Workflow `frequency: "weekly"`. Description says quarterly. Same fix pattern as real_estate's Past Client Re-Engagement.

**Fix:**
```diff
  {
    name: "Quarterly Business Review",
    description: "...",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
-   frequency: "weekly",
+   frequency: "quarterly",
    approvalMode: "review_after"
  }
```
Or change description to say "weekly business health summary" and rename workflow.

### P0-2: Duplicate KB items
**What:** `Service catalog and pricing` and `Offers and delivery` cover the same content with different titles.

**Fix:** Delete `Offers and delivery` (the second, redundant one).

### P0-3: Bifurcated identity / overlap with peer templates
**What:** Setup checklist *literally admits* this template "feels like a demo." 4 agents overlap directly with `high_ticket_coaching`, `social_media_agency`, `skool_community`, and parts of `agency`.

**Why it matters:** Priority 5 (Premium polish) + Priority 1 (Functional). Customer browsing the template selector can't tell what makes this template distinct from peers. Pre-purchase confusion = abandoned carts. Post-purchase regret = refunds.

**Fix options:**
- **Path A: Retire entirely.** This template's audience (coaches, consultants, freelancers, solo service providers) is already served better by:
  - Coaches → `high_ticket_coaching` (specialized for premium offers)
  - Consultants → `agency_creative` (proposed split from `agency`)
  - Freelancers → `agency_creative` OR a new `solo_freelancer` template
  - Solo service providers → covered by `local_service` (trades) OR specialized templates
- **Path B: Specialize hard.** Pick ONE archetype this template owns. Most likely candidate: **freelancers / solopreneurs selling productized expertise** (digital products, courses, info products under $5K). Differentiate from `high_ticket_coaching` (premium $2K-$25K) and `agency` (multi-client agency). Rewrite voice + KB content + workflow specifics for the productized-solo archetype.
- **Path C: Merge into `agency_creative` (proposed).** Just delete this template; redirect operators to the agency split.

I lean **Path A (retire) or Path C (merge)** — Path B requires meaningful new product work for an unclear market.

### P0-4: System prompts don't enumerate the actual tool runtime (library-wide)
Same fix.

### P0-5: Webhook routing undocumented
Same pattern as other shell templates.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No SMS tools / no specific telephony opinion
Same library-wide.

### P1-3: No social_media_mcp tools on CMO
Same library-wide.

### P1-4: No spend ceiling
Same library-wide.

### P1-5: No service-type pricing differentiation
Hourly / project / retainer have very different operational models. Template treats all generically.

### P1-6: Sales & Intake's "follow-up sequences with precision" not wired
Generic weekly Follow-up Sequence workflow. No stage-specific triggers (post-discovery / post-proposal / post-objection).

### P1-7: Voice generic
Same library-wide.

### P1-8: No referral workflow
Service businesses live on referrals. None modeled.

### P1-9: No client-health-score model
Service Coordinator "flags at-risk clients" but no scoring rubric.

### P1-10: Stripe tools missing on CEO + Service Coordinator
Suggested but no wiring.

---

## C10. P2 issues

### P2-1: Pre-seed example KBs
Like other shell templates.

### P2-2: Testimonial collection workflow
Templates exist in KB but no scheduled workflow drives testimonial collection.

### P2-3: Capacity planning
Service Coordinator "handles scheduling, rescheduling, and capacity planning" — no tool, no workflow.

### P2-4: Client lifecycle workspace doc
Like `dealhawk_empire`'s PORTFOLIO_TRACKER.md.

### P2-5: No proposal-to-signed-contract conversion tracking
No workflow tracks proposal acceptance rate by service type.

---

## Summary fix-time for `service_business`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (5) | Frequency bug, duplicate KB delete, identity decision (retire/specialize/merge), system-prompt tool enumeration, webhook documentation | **2-3 hours** (Path A retire — fastest) **OR ~6-8 hours** (Path B specialize) |
| P1 (10) | primaryModel + fallback, SMS tools, social tools, spend ceiling, service-type pricing, follow-up triggers, voice, referral workflow, client health score, Stripe tools | **2-3 hours** if specializing; N/A if retiring |
| P2 (5) | KB pre-seeds, testimonial workflow, capacity planning, client lifecycle doc, conversion tracking | **1 hour** if specializing |

**Total to S-tier: ~3-4 hours (retire) OR ~10-12 hours (specialize).** **Recommended path: retire this template** and improve the targeting on `high_ticket_coaching` + the proposed `agency_creative` split + a new `solo_freelancer` template if there's actual buyer demand. **The library is stronger with 18 differentiated templates than with 19 templates that compete with each other.**

---

**Next message:** Section C for `social_media_agency` (rank #17). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/17 — social_media_agency  (transcript line 997, 20643 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `social_media_agency`.

---

# SECTION C — TEMPLATE 17/19: `social_media_agency` (Social Media Management Agency)

**Verdict:** **NEEDS WORK** but on the SHIP side of the line (~5-6 hours to S-tier).
**Headline:** Better-positioned than `service_business` because the SMMA archetype is well-defined and `social_media_mcp` is *correctly required* (the template's whole value prop is posting on behalf of clients). Auto-attached video stack via `VIDEO_PRODUCTION_TEMPLATES` is appropriate here — modern SMMAs produce short-form video. Multi-client OAuth model honestly disclosed. **But: `Monthly Client Report` workflow has `frequency: "weekly"` (same frequency-bug as service_business + real_estate). CEO has only `["web_search", "knowledge_lookup"]` — no `send_email`. Content Creator has no social_media_mcp or video-stack tools in `tools[]` despite being required + auto-attached. Same multi-client-isolation gap as `agency` template — no way to scope agent context per client. Voice generic.** Same library-wide patterns: `primaryModel` not set, no fallback model, no spend ceiling (especially concerning given AI video gen across multiple clients = potentially big spend).

## C1. Functional walkthrough — multi-client management happy path

The SMMA cycle: client onboarding → brand voice workshop → weekly content calendar → approval → publish → monthly report → renewal/upsell. Tracing one client month:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Onboarding** | **Account Manager** | New signed client | Brand voice workshop + content audit + competitor review + strategy alignment + first-month plan | `send_email`, `knowledge_lookup` + BUILTIN | Onboarding pack | ✅ EXPLICIT (manual trigger) |
| **Weekly content** | **Content Creator** | Client brand voice + platform mix | Platform-native captions + Reels scripts + carousels + stories + thread structures | `web_search`, `knowledge_lookup` + BUILTIN, + auto-attached video stack (HeyGen/Creatify/JSON2Video/B-Roll/fal.ai/ElevenLabs) | Content calendar drafts | 🔴 BREAK — agent's `tools[]` doesn't list video tools or social_publish_post; relies on auto-attach |
| **Approval** | **Account Manager** | DRAFT content | Send to client for approval, collect feedback, manage revisions | `send_email`, `knowledge_lookup` + BUILTIN | Approved content | ✅ |
| **Publish** | **Content Creator** | Approved content | Schedule via Social Media Hub | (auto-attach for `social_publish_post`/`schedule_post`) | Live posts | 🔴 BREAK — Content Creator's `tools[]` doesn't reference `social_publish_post` or `schedule_post` |
| **Daily trend monitor** | **Content Creator** | Niche + platforms | Surface 3 fast-turnaround post ideas based on trending audio/format/topic | `web_search`, `knowledge_lookup` + BUILTIN | Trend alert + post ideas | ✅ EXPLICIT |
| **Monthly report** | **Analytics Lead** | Per-client performance data | Polished monthly report leading with wins, business-outcome narrative, next-month recommendations | `web_search`, `knowledge_lookup` + BUILTIN | Monthly report | 🔴 BREAK — workflow scheduled `weekly` despite name + description saying "Monthly" |
| **Health check** | **Account Manager** | Client engagement signals | Track client satisfaction, flag at-risk + upsell opportunities | (same) | Client health dashboard | ✅ |
| **Agency operations** | **CEO** | All agent outputs | Weekly agency health report (revenue, satisfaction, production, pipeline) | `web_search`, `knowledge_lookup` + BUILTIN | Weekly agency health | 🔴 BREAK — CEO has no `send_email`, can't actually surface report to operator |

### Break points

1. **`Monthly Client Report` workflow has `frequency: "weekly"`** — same frequency-bug pattern. Workflow name + description say monthly. Schedule fires weekly. **Same client gets 4 monthly reports per month** = client confusion + operator confusion + waste.

2. **CEO has only `web_search` + `knowledge_lookup`** — no `send_email`. CEO can't actually email the team or operator. Weekly agency health report sits in chat — no email delivery. Most CEOs in other templates have `send_email`. **Bug or oversight.**

3. **Content Creator has no social_media_mcp tools in `tools[]`** — `social_media_mcp` is required. Content Creator's role is to publish via Social Media Hub. Agent's `tools[]` is `["web_search", "knowledge_lookup"]`. Auto-attach handles runtime via `getToolsForAgent` — but agent's system prompt doesn't enumerate or reference the social tools.

4. **Content Creator has no video-stack tools in `tools[]`** — auto-attached via `VIDEO_PRODUCTION_TEMPLATES` (HeyGen/Creatify/JSON2Video/B-Roll/fal.ai/ElevenLabs/Whisper). Same pattern: tools available at runtime, agent doesn't know.

5. **No multi-client isolation** — same as `agency` template. Account Manager + Content Creator handle ALL clients in one KB pool. **No `currentClient` scoping.** At 5+ clients, brand-voice cross-contamination is real risk.

6. **No agency-self-marketing function** — CEO + Account Manager + Content Creator + Analytics Lead all serve clients. **No agent runs the agency's own pipeline** (lead generation, prospecting, sales). Agency operators must do their own marketing.

7. **No client onboarding workflow auto-trigger** — `New Client Onboarding Pack` is `manual` trigger. New signed contracts need operator to remember to fire the workflow.

8. **No client-approval-deadline tracking** — Account Manager "manages content approval workflow" but if client doesn't approve in time, no auto-escalation or default-publish logic.

9. **No spend ceiling on AI video gen** — auto-attached HeyGen + Creatify could blast unbounded across multiple clients. **At 5 clients × 4 videos/week × $4/video = $80/week per agency** at minimum, scaling fast if Arcads or premium tiers used.

10. **Inter-agent coordination via CEO** — standard pattern. But CEO has no `delegate_task` shown in tools[] (it's BUILTIN, so still available — but worth verifying).

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `social_media_mcp` | **Required** | When installed | ⚠ No agent has social_* tools in `tools[]` | Auto-attach handles runtime |
| `resend_mcp` | **Required** | When installed | ✅ Configured | Account Manager has `send_email`. **CEO does not.** |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot tools | "Account Manager structured view of renewal dates" — no wiring |
| `stripe_mcp` | Suggested | When installed | ⚠ No agent has Stripe tools | "Past-due retainers" — no wiring |
| Auto-attached video stack | YES (in `VIDEO_PRODUCTION_TEMPLATES`) | ✅ Configured | ⚠ But Content Creator's `tools[]` doesn't enumerate video tools | Auto-attach handles runtime |
| Auto-attached YouTube tools | YES (in `YOUTUBE_API_TEMPLATES`) | ✅ Configured | ⚠ Reasonable — agencies that publish to YouTube | Some SMMAs don't publish YouTube; tool space pollution at the margin |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for `social_media_mcp` + auto-attached video stack)

| Check | `social_media_mcp` | Video stack (HeyGen/Creatify/etc.) |
|---|---|---|
| Credential flow | OAuth via `/admin/integrations` ✅ + per-client OAuth | API keys per service |
| Call construction | Standard schema ✅ | ✅ |
| Rate limit awareness | ❌ Not in any agent | ❌ |
| Error handling | Per global no-retry rule | Same |
| Cost ceiling | ⚠ Late/Ayrshare flat monthly + per-platform per-post API limits | ❌ HeyGen/Creatify per-video pricing × multiple clients = unbounded |
| Fallback path | ❌ Late ↔ Ayrshare alternatives not wired | ❌ HeyGen → Creatify fallback not designed |
| Model/version pinning | ✅ Provider-locked | ❌ Auto-attach picks defaults |
| Tool enumeration in system prompts | ❌ Content Creator doesn't enumerate social or video tools | ❌ |

---

## C3. Media generation deep-check

Auto-attached full video stack. Content Creator role description explicitly mentions "short-form video scripts with hooks in the first 2 seconds" and the setup checklist calls out the video stack. **But the agent's `tools[]` doesn't enumerate any video tools.**

### Image generation
- ❌ Prompts engineered for the specific model? Content Creator doesn't reference fal.ai, Midjourney, Ideogram, or Flux directly — auto-attach handles registration.
- ❌ Aspect ratio specified? Platform-native posts have specific ratios (1:1 IG feed, 4:5 IG feed, 9:16 Reels/TikTok/Shorts, 1.91:1 LinkedIn). Not enforced at tool-call level.
- ❌ Brand consistency across clients? Setup checklist mentions per-client brand asset library at `/admin/brand-assets` — but no agent system prompt instructs the Content Creator to call `get_brand_asset` before generation.

### Video generation (HeyGen / Creatify auto-attached)
- ❌ Platform-specific prompts? Content Creator system prompt doesn't differentiate Reels/TikTok/Shorts video grammar.
- ❌ Cost ceiling? No.
- ❌ Multi-shot continuity per client brand? No avatar-bible enforcement at tool-call time.
- ❌ Stitching step? JSON2Video auto-attached but Content Creator doesn't reference assemble_video.

### Voice / TTS (ElevenLabs auto-attached)
- ❌ Voice ID consistent per client? No per-client voice ID setting.

### Music
- ❌ Not in scope. Trending audio is platform-native. Acceptable.

### Avatar / UGC
- ❌ HeyGen + Creatify available but not enforced per-client.

**The auto-attach gives the team capability; the lack of system-prompt enumeration + per-client scoping means it's used inconsistently.**

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $197? |
|---|---|---|---|---|---|
| **New client onboarding pack** | High — brand voice + content audit + competitor review + first-month plan | High when KB workflow follows | High | High | ✅ Yes |
| **Weekly content calendar** | High — platform-native + brand-matched | High when client brand voice in KB | High when isolation works (it doesn't) | High | ⚠ Borderline (multi-client cross-contamination) |
| **Short-form video script** | Medium without explicit video-tool wiring guidance | Medium | High | Medium — operator routes through video stack manually | ⚠ Borderline |
| **Carousel concept** | High | High | High | High | ✅ Yes |
| **Story sequence** | High | High | High | High | ✅ Yes |
| **Twitter thread structure** | High | High | High | High | ✅ Yes |
| **Daily trending content alert** | High — 3 fast-turnaround ideas | High | High | High | ✅ Yes |
| **Monthly client report** | High when bug fixed + Analytics has data | High when KB has client metrics | High | Medium — bug means weekly delivery | ❌ Fails until frequency-bug fixed |
| **Brand voice file (per client)** | High when operator fills in | High | High | High | ✅ Yes |
| **Weekly agency health report** | Medium — CEO can't email it without `send_email` | Medium | High | Low — sits in chat without delivery channel | ⚠ Borderline |

**Two outputs degraded by bugs.** Multi-client cross-contamination + frequency-bug + CEO-can't-email gap. Most other outputs are Yes when KB is populated per client.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | One client's social_media_mcp OAuth expires | Auto-attach fails for that client. Content Creator drafts but can't publish. **Cross-client risk** — error on one client's account doesn't block others, but no per-client isolation visible. | P1 |
| 2 | Operator hasn't filled per-client brand voice KBs | Content Creator works generic. **Content sounds like template, not client.** | **P0** — first-week trap |
| 3 | Content approval delays beyond client deadline | No auto-escalation. Posts stay as drafts past planned go-live. | P1 |
| 4 | 3am unsupervised | Workflows mostly `review_after`. **Acceptable.** Daily trend alert runs autonomously. | OK |
| 5 | Customer scales 1 → 10 clients | Multi-client KB cross-contamination + weekly bug-driven report storm = operator chaos. | **P0** |
| 6 | Customer publishes content via Social Media Hub but client's account is suspended/restricted | No platform-health monitoring. | P1 |
| 7 | AI video gen burns budget | Auto-attached HeyGen/Creatify with no caps. **At $4/video × 5 clients × 4 videos/week = $80/week** unbounded as scale grows. | **P0** |
| 8 | Trending Content Alert misses a fast-moving trend | `frequency: "daily"` but trends move in hours. | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + 4 first-week actions including per-client brand voice KB | ✅ Strong onboarding for the multi-client model — even if multi-client isolation is missing |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 7 KB items including Service packages + Content approval + Platform strategy + Onboarding workflow + Pricing | ✅ Adequate. **Two duplicate-ish KB items** — `Service packages and deliverables` and `Service packages and pricing` cover similar content |
| **Voice** | "Creative, platform-native, and results-transparent" | ⚠ Generic SMMA. Doesn't differentiate. |
| **Progress visibility** | Daily trends + weekly content + weekly bug-driven monthly reports + weekly agency health = 4-tier cadence | ⚠ Frequency-bug breaks the cadence |
| **Handoff moments** | Most workflows `review_after`. Acceptable. | ✅ |
| **The 90% rule** | ~60-65% autonomous. Auto-attach gives video capability but agents don't enumerate. Multi-client cross-contamination hurts brand consistency. | ⚠ |
| **Multi-client model** | OAuth-per-client acknowledged honestly | ⚠ But no per-client KB scoping or per-client cost tracking |

---

## C7. Cost efficiency

For an SMMA managing 5 clients with weekly video content:
- LLM weekly: ~$5-10 across 4 agents × 5 clients
- Social Media Hub (Late or Ayrshare): $33-149/mo flat (covers all clients)
- Resend: $20-50/mo
- HeyGen + Creatify (auto-attached): $24+39/mo flat tier OR per-video billing
- AI video gen at scale: 5 clients × 4 videos/week × $4/video = $80/week = $320/mo
- Optional: HubSpot ($50/mo), Stripe (transaction fees)
- **Total: $250-700/mo template infrastructure for 5-client agency**

**Cost guardrails:** None. AI video gen could blast unbounded.

**Cost-tier-down:** Content Creator's caption/script writing = pattern-heavy → Haiku candidates. Keep Sonnet 4.5 for monthly reports + onboarding pack + analytics narratives.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: `Monthly Client Report` workflow has `frequency: "weekly"`
**What:** Workflow `frequency: "weekly"`. Description: *"Creates a polished monthly performance report for each client account."*

**Fix:**
```diff
  {
    name: "Monthly Client Report",
    description: "...",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
-   frequency: "weekly",
+   frequency: "monthly",
    approvalMode: "review_after"
  }
```

### P0-2: CEO has no `send_email`
**What:** CEO `tools: ["web_search", "knowledge_lookup"]`. Role produces "weekly agency health reports" but agent has no email tool. **Reports sit in chat without operator delivery.**

**Fix:**
```diff
  // CEO
  tools: [
+   "send_email",
+   "send_telegram_message",
    "web_search",
    "knowledge_lookup"
  ]
```

### P0-3: Content Creator has no social_media_mcp or video-stack tools in `tools[]`
**What:** `social_media_mcp` is required. Auto-attach handles runtime. **Content Creator's system prompt doesn't enumerate publishing tools or video-gen tools.** Agent doesn't know it can call them.

**Fix:** Add explicit tool whitelist + system prompt enumeration. Same library-wide pattern.

### P0-4: Multi-client isolation missing
**What:** Account Manager + Content Creator handle all clients in one KB pool. **No way to scope context per client.**

**Why it matters:** Priority 1 (Functional) + Priority 2 (Output Quality). At 5+ clients, brand voice cross-contamination is real. Premium agency operators with 10+ clients hit this wall fast.

**Fix:** Add a `currentClient` config field on the business + a per-client KB-tagging convention. **OR** acknowledge limit in setup checklist: *"This template scales to ~5 clients per operator. Beyond that, multi-tenant client isolation is on the roadmap."*

### P0-5: AI video spend ceiling
**What:** Auto-attached HeyGen/Creatify could blast unbounded across multiple clients.

**Fix:**
```
COST GUARDRAILS:
- Maximum 4 AI video generations per client per week
- Maximum 20 video generations / week across all clients
- Hard stop at $300/month video-gen budget unless operator raises ceiling
- Use Creatify (~$2-4/video) for routine clients; reserve HeyGen ($5-11/video)
  for premium clients
```

### P0-6: System prompts don't enumerate the actual tool runtime (library-wide)
Same fix.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No agency-self-marketing function
SMMA operators must do their own marketing for new client acquisition. **Add either**: (a) a Marketing/Pipeline agent for the agency itself, OR (b) document that this template focuses on client delivery and recommend pairing with `agency` (or proposed `agency_creative` split) for the new-business pipeline.

### P1-3: New Client Onboarding Pack is manual trigger
Should auto-fire on signed-contract event (Stripe webhook for new subscription).

### P1-4: No client-approval-deadline tracking
Account Manager doesn't escalate or default-publish if client doesn't approve in time.

### P1-5: HubSpot suggested but no agent uses
Same library-wide pattern.

### P1-6: Stripe suggested but no agent uses
Same library-wide pattern.

### P1-7: Daily Trending Content Alert frequency might miss fast trends
Trends move in hours. Daily-scheduled vs webhook-driven from a trends API.

### P1-8: No competitor analysis workflow per client
Setup mentions "competitor audit" in onboarding but no recurring competitor monitoring per client.

### P1-9: No platform-health monitoring (account suspensions, restrictions)
No agent monitors per-client account health on platforms.

### P1-10: Voice generic
"Creative, platform-native, results-transparent" is generic-SMMA. Could differentiate with niche specialization (B2B SaaS SMMA vs DTC e-commerce SMMA vs local-services SMMA).

### P1-11: Duplicate KB items
`Service packages and deliverables` + `Service packages and pricing` cover similar content. Same pattern as service_business + ecommerce.

---

## C10. P2 issues

### P2-1: Per-client cost tracking workspace doc
Multi-client agencies need per-client cost visibility. Add a `CLIENT_COST_TRACKER.md` workspace doc.

### P2-2: Brand voice exemplar library per client
Like `content_creator` (Newsletter Empire) template's "Operator voice samples." Pre-seed structure for each client's voice samples.

### P2-3: Content approval deadline auto-escalation
Workflow that pings client + escalates to Account Manager if approval not received by deadline.

### P2-4: AI image gen for static posts
`generate_image` tool wiring for IG feed posts, LinkedIn images, etc. Currently auto-attached but not enumerated.

### P2-5: Trending audio library per platform
KB tracking which audio tracks are working on TikTok/Reels per client niche.

---

## Summary fix-time for `social_media_agency`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (6) | Frequency-bug, CEO send_email, Content Creator tool enumeration, multi-client isolation (decision required), AI video spend ceiling, system-prompt tool enumeration | **3-5 hours** depending on multi-client isolation path |
| P1 (11) | primaryModel + fallback, agency-self-marketing, onboarding auto-trigger, approval-deadline tracking, HubSpot/Stripe wiring, trends frequency, competitor monitoring, platform-health monitoring, voice tightening, duplicate KB cleanup | **3-4 hours** |
| P2 (5) | per-client cost tracker, voice exemplar library, approval auto-escalation, AI image gen wiring, trending audio library | **1-2 hours** |

**Total to S-tier: ~7-11 hours.** This template is closer to SHIP than `service_business` because the SMMA archetype is well-defined and `social_media_mcp` is correctly required. **The frequency-bug + CEO send_email + multi-client isolation are the biggest functional fixes.** The auto-attached video stack actually fits this template (unlike `ghost_operator` and `agency` and `content_creator` where it's dead weight).

---

**Next message:** Section C for `skool_community` (rank #18). Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/18 — skool_community  (transcript line 1013, 17883 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `skool_community`.

---

# SECTION C — TEMPLATE 18/19: `skool_community` (Skool Community / Online Education)

**Verdict:** **NEEDS WORK** (~5-6 hours to S-tier).
**Headline:** Better-positioned than `service_business` because the community-operator archetype is well-defined and the three-tier member model (superfan / active / at-risk) is a real differentiator. **Curriculum gap detection from member questions** (Curriculum Designer) and **free-to-paid conversion gating** (Growth Specialist) are solid concepts. Stripe is correctly required (churn detection + free-to-paid metrics depend on it). No Skool API is honestly disclosed — agents draft, operator pastes. **But: same library-wide patterns:** CEO has only `["web_search", "knowledge_lookup"]` (no `send_email`), no agent has Stripe tools in `tools[]` despite Stripe being required, no social_media_mcp tools, generic voice, no spend ceiling, webhook dependencies undocumented. **And: no DM tools — Community Manager's "personal welcome" is public-thread only, not actual DM.** No multi-cohort/multi-program support. No content-completion tracking (Skool API gap acknowledged but the operator burden of pasting completion data weekly is real).

## C1. Functional walkthrough — member-lifecycle happy path

The community cycle: signup → 24h welcome → first-week activation → weekly engagement → curriculum progression → at-risk detection → re-engagement → churn or graduate. Tracing one member lifecycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **New member webhook** | (workflow trigger) | Stripe webhook (subscription.created) OR Skool platform webhook (manual setup) | Triggers New Member Welcome | (handler) | Welcome queued | 🟡 IMPLICIT — webhook dependency on operator wiring |
| **Personal welcome** | **Community Manager** | New member data | 24h personalized welcome referencing why they joined | `send_email`, `knowledge_lookup` + BUILTIN | Welcome post draft | 🔴 BREAK — no DM tool, agent posts in public feed not DM |
| **Engagement rituals** | **Community Manager** | Weekly slot | Discussion prompts, AMAs, challenges, polls, win spotlights | (same) | Weekly engagement post draft | ✅ EXPLICIT |
| **Curriculum** | **Curriculum Designer** | Member questions + content gaps | Module outlines, lesson content, drip schedules | `web_search`, `knowledge_lookup` + BUILTIN | Curriculum drafts | ✅ EXPLICIT |
| **Member tier tracking** | **Community Manager** | Member activity (operator-pasted from Skool) | Classify superfan / active / at-risk | (same) | Three-tier member dashboard | 🟡 IMPLICIT — depends on operator paste of activity data |
| **At-risk re-engagement** | **Community Manager** | At-risk member list | Personalized re-engagement messages (empathy not guilt) | (same) | Re-engagement drafts (approve_first) | ✅ EXPLICIT |
| **Churn risk** | **Growth Specialist** | Stripe webhook (failed payment OR subscription.deleted) | Retention message draft | `web_search`, `knowledge_lookup` + BUILTIN | Retention message draft (approve_first) | ✅ EXPLICIT |
| **Free-to-paid conversion** | **Growth Specialist** | Free member behavior + KB free-to-paid funnel | Weekly conversion experiments + recommendations | (same) | Weekly growth report | 🟡 IMPLICIT — no Stripe tools to read free vs paid status |
| **Community health** | **CEO** | All metrics | Weekly community health report | `web_search`, `knowledge_lookup` + BUILTIN | Weekly report | 🔴 BREAK — CEO has no `send_email`, no delivery channel |

### Break points

1. **CEO has only `["web_search", "knowledge_lookup"]`** — no `send_email`. Same exact gap as `social_media_agency`'s CEO. Weekly community health reports sit in chat, no email delivery.

2. **Community Manager has no DM tools** — role description: *"Welcomes every new member personally"* and *"draft re-engagement messages."* `tools: ["send_email", "knowledge_lookup"]`. **No social_media_mcp tools, no Skool DM tool (Skool API doesn't exist).** Agent posts welcomes in public feed, not as personal DM.

3. **No agent has Stripe tools in `tools[]`** — Stripe is required for Churn Risk Alert, free-to-paid conversion tracking, Growth Specialist's weekly report. Auto-attach handles runtime — no agent enumerates.

4. **Skool API doesn't exist — operator burden is significant** — Setup checklist is honest: *"Skool does not expose a public API for posting, member lists, or engagement data. Agents draft content for you to paste manually, and member activity data you want to reference has to be exported or pasted in by hand."* **Customer pays for autonomy; gets significant manual paste cycle.**

5. **No multi-cohort/multi-program support** — operators running 2+ separate programs get one pool. No per-program brand voice or per-cohort engagement tracking.

6. **No content-completion tracking** — Curriculum Designer can't actually verify members complete lessons (Skool API gap). Operator must paste completion data into KB.

7. **Webhook dependencies undocumented** — New Member Welcome (Stripe webhook on subscription.created) and Churn Risk Alert (Stripe webhook on subscription.deleted / payment_failed) need operator wiring. Setup checklist mentions but doesn't tell operator HOW.

8. **No agent enumerates tool runtime** — same library-wide pattern.

9. **No referral program automation** — Growth Specialist's role mentions "build referral programs that reward existing members" but no workflow.

10. **No social_media_mcp wiring on Community Manager or CEO** — suggested for cross-posting wins/spotlights.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `stripe_mcp` | **Required** | When installed | ⚠ No agent has Stripe tools in `tools[]` | Auto-attach handles runtime |
| `resend_mcp` | **Required** | When installed | ✅ Configured | Community Manager has `send_email`. **CEO does not.** Curriculum Designer + Growth Specialist also lack `send_email`. |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent has social tools | Setup checklist mentions cross-posting wins |
| `hubspot_mcp` | Suggested | When installed | ⚠ No agent has hubspot tools | "Captures top-of-funnel leads" — no wiring |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct |
| Skool / Circle / Discord platform APIs | Mentioned | ❌ NOT wired | ⚠ Operator-side | Honest disclosure (Skool has no public API) |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (for `stripe_mcp` + `resend_mcp`)

| Check | `stripe_mcp` | `resend_mcp` |
|---|---|---|
| Credential flow | Restricted key with subscription + customer read | Domain + SPF/DKIM ✅ |
| Call construction | Standard ✅ | ✅ |
| Rate limit awareness | ❌ | ❌ |
| Error handling | Per global no-retry rule | Same |
| Cost ceiling | N/A read-only | ❌ |
| Fallback path | ❌ | ❌ |
| Model/version pinning | ✅ | ✅ |
| Tool enumeration in system prompts | ❌ Not enumerated for any agent | ✅ via `send_email` (only Community Manager has it; CEO + Curriculum + Growth do not) |

---

## C3. Media generation deep-check

**Not in scope.** No image/video/voice/music. Auto-attached video stack absent. ✅

**Note:** Communities increasingly need video lessons + welcome videos. `generate_video` (Creatify or HeyGen) could be added as P2 enhancement.

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $197? |
|---|---|---|---|---|---|
| **24h new member welcome** | High when KB filled | High | High | Medium — public-feed not DM | ⚠ Borderline |
| **Weekly engagement post** | High — discussion prompt / poll / spotlight | High when KB has community voice | High | High | ✅ Yes |
| **At-risk re-engagement message** | High — empathy not guilt | High when activity data pasted | High | High | ✅ Yes |
| **Churn-risk retention message** | High when Stripe data flowing | Medium without Stripe tools | High | High | ✅ Yes (with Stripe wired) |
| **Curriculum module outline** | High — outcome-focused | High when KB has curriculum roadmap | High | High | ✅ Yes |
| **Curriculum gap analysis (from member questions)** | High when operator pastes member questions | High | High | Medium — depends on operator paste | ⚠ Borderline |
| **Free-to-paid conversion experiment** | High when KB has funnel | High | High | High | ✅ Yes |
| **Weekly growth report** | Medium without Stripe tools | Medium | High | Medium | ⚠ Borderline |
| **Weekly community health report (CEO)** | Medium — CEO can't email | Medium | High | Low — sits in chat without delivery | ⚠ Borderline |
| **Drip schedule** | High | High when curriculum filled | High | High | ✅ Yes |

**Three borderline outputs** — public-feed welcome (not DM), curriculum gap analysis (paste-driven), weekly community health (CEO can't deliver). Most others Yes.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Stripe webhook doesn't fire (operator hasn't wired) | Churn Risk Alert never fires. **Silent revenue loss.** | **P0** |
| 2 | Operator hasn't pasted weekly member activity data | Community Manager's three-tier classification is empty. At-risk detection broken. | **P0** — first-week trap |
| 3 | Operator pastes wrong member tier data | Re-engagement targets wrong members. Trust damaged. | P1 |
| 4 | 3am unsupervised | Workflows: New Member = `review_after`, Engagement = `review_after`, Re-Engagement = `approve_first`, Churn Risk = `approve_first`. **Acceptable.** | OK |
| 5 | Customer scales 1 → 1000 members | Community Manager handles all welcomes + tiering. **No queue management.** Personalized welcomes for 1000 = 1000 LLM calls. | P1 |
| 6 | Member sends DM to operator with question | Skool API gap — no DM tool. Operator handles manually. | P1 |
| 7 | Refund request from member | Growth Specialist escalates per rules. CEO handles. **No refund processing.** Acceptable. | OK |
| 8 | Member posts inappropriate content | Community Manager flags. **No autonomous moderation.** Setup checklist doesn't address moderation tooling. | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Setup checklist + 3 first-week actions | ⚠ Skool API gap means significant operator-side paste work |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 6 KB items including Membership tiers + Community rules + Voice + Curriculum roadmap + Free-to-paid funnel | ✅ Adequate but mostly stubs |
| **Voice** | "Encouraging, direct, community-first. Sound like the most supportive friend in the room" | ⚠ Generic. |
| **Progress visibility** | Weekly engagement + weekly re-engagement + weekly growth + weekly community health (no email delivery) | ⚠ CEO report has no delivery |
| **Handoff moments** | Re-Engagement + Churn Risk = `approve_first`. Sensible. | ✅ |
| **The 90% rule** | ~50%. Significant operator paste burden (member activity data, member questions, content completion). | ⚠ |
| **Three-tier member model** | Superfan / active / at-risk classification | ✅ Genuine differentiator |

---

## C7. Cost efficiency

For a 200-member community at $49/mo paid tier:
- LLM weekly: ~$3-5 across 4 agents (welcomes are the heaviest at scale)
- Stripe: 2.9% + $0.30 per transaction
- Resend: $20-50/mo
- Optional: Skool ($99/mo or $149/mo plans), HubSpot ($50/mo)
- **Total: $30-100/mo template infra**

**Cost guardrails:** None. Acceptable risk at this scale.

**Cost-tier-down:** Welcomes + engagement posts = pattern-heavy → Haiku candidates. Curriculum design + churn analysis stay on Sonnet 4.5.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: CEO has no `send_email`
**What:** Same exact gap as `social_media_agency`. Weekly community health report sits in chat without delivery.

**Fix:**
```diff
  // CEO
  tools: [
+   "send_email",
+   "send_telegram_message",
    "web_search",
    "knowledge_lookup"
  ]
```

### P0-2: No Stripe tools in any agent's `tools[]`
**What:** `stripe_mcp` is required. Churn Risk Alert + free-to-paid conversion + Growth Specialist's weekly report all depend on Stripe data.

**Fix:** Add Stripe tools to Growth Specialist + CEO + Community Manager `tools[]` (auto-attach handles runtime, but explicit is documented). Update system prompts to enumerate.

### P0-3: Webhook routing undocumented
**What:** New Member Welcome (Stripe `customer.subscription.created` OR Skool platform webhook) + Churn Risk Alert (Stripe `customer.subscription.deleted` / `invoice.payment_failed`) need operator wiring.

**Fix:** Add to Setup Checklist firstWeekActions:
```
- Configure Stripe webhooks at https://dashboard.stripe.com/webhooks:
  Subscribe to: customer.subscription.created, customer.subscription.deleted,
  invoice.payment_failed
  Endpoint: /api/webhooks/stripe/[businessId]
- Skool platform: no public API; you'll need to manually paste member
  activity data weekly into a designated KB item for the three-tier
  member model to work.
- Run New Member Welcome MANUALLY for the first 3-5 new members to
  verify tone before trusting webhook automation.
```

### P0-4: Community Manager's "personal welcome" is public-feed not DM
**What:** Role: *"Welcomes every new member personally."* No DM tool — Skool API doesn't exist, no platform DM MCP. **Agent's personalized welcome posts in public feed.**

**Why it matters:** Priority 2 (Output Quality). Public welcomes are good but the role description implies private DM. Customer expects direct outreach.

**Fix:** Update Community Manager system prompt:
```
NEW MEMBER WELCOME WORKFLOW (Skool platform reality):
Skool does not expose a DM API. Your "personal welcome" is delivered
in two channels:
1. Public welcome post in the community feed referencing why they joined
   (operator pastes from your draft).
2. Personal email via send_email with a more substantive intro + first-week
   resource recommendations + invitation to introduce themselves.

Always do BOTH — public post for community visibility + email for
direct connection. Email is the channel you control.
```

### P0-5: System prompts don't enumerate the actual tool runtime (library-wide)
Same fix.

### P0-6: Operator paste-burden for activity data is significant
**What:** Skool API gap means member activity data (posts, comments, course completion, login frequency) must be pasted weekly. **Three-tier classification depends on this paste.** Customer who falls behind on weekly paste loses the at-risk detection entirely.

**Fix:** Add a Setup Checklist callout that this is an ongoing operator commitment, not a one-time setup. Add a Weekly Member Activity Paste workspace doc template that the operator fills in. **OR** acknowledge this template is fundamentally limited until Skool/Circle/Discord MCPs exist and document a "manual paste" weekly workflow.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No multi-cohort/multi-program support
Operators with 2+ programs share one KB pool. **Add a `currentCohort` config** OR document the limit.

### P1-3: No referral program workflow
Growth Specialist's role mentions referral programs. No workflow drives this.

### P1-4: No social_media_mcp tools on any agent
Suggested for cross-posting wins. Same library-wide pattern.

### P1-5: No HubSpot tools
"Top-of-funnel lead capture" suggested. Same pattern.

### P1-6: No content-completion tracking
Curriculum Designer can't verify members complete lessons. Setup checklist hand-waves Skool API gap. Could add a manual completion-paste KB.

### P1-7: No spend ceiling
Same library-wide.

### P1-8: No content moderation tooling
Community Manager flags inappropriate content. **No autonomous moderation.** Could add `Daily Community Moderation Sweep` workflow.

### P1-9: Weekly Engagement Post output type is `content_queue` but no scheduler tool
Workflow output is `content_queue` but Community Manager has no `schedule_post` or social tools. Operator pastes manually.

### P1-10: Voice generic
Could differentiate as "celebratory + accountability-driven" with actual examples.

---

## C10. P2 issues

### P2-1: Pre-seed example KBs
Like other shell templates.

### P2-2: AI welcome video
`generate_video` (HeyGen) for personalized welcome videos at scale. Not currently wired.

### P2-3: Member journey workspace doc
Like dealhawk's PORTFOLIO_TRACKER.md — track every member's progression.

### P2-4: Community challenge template library
Operators run challenges regularly. Pre-seed challenge templates per niche.

### P2-5: Win-spotlight library
Templates for highlighting member wins (before/after, transformation, milestone celebration).

---

## Summary fix-time for `skool_community`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (6) | CEO send_email, Stripe tools, webhook documentation, public-feed-vs-DM clarification, system-prompt tool enumeration, operator-paste burden disclosure | **3-4 hours** |
| P1 (10) | primaryModel + fallback, multi-cohort, referral workflow, social wiring, HubSpot wiring, completion tracking, spend ceiling, moderation, scheduling tools, voice tightening | **2-3 hours** |
| P2 (5) | pre-seed KBs, AI welcome video, member journey doc, challenge library, win spotlight library | **1 hour** |

**Total to S-tier: ~6-8 hours.** Same shell-template profile as the other 4-agent service templates. **The Skool API gap is the biggest structural issue and it's honestly disclosed — but the operator's weekly paste burden is significant and should be louder in the buyer-facing description.**

---

**Next message:** Section C for `business_builder` (rank #19 — last per-template audit). Then onto Sections D-F. Send "go" if ready.


<!-- ============================================================ -->
<!-- Section C/19 — business_builder  (transcript line 1032, 17431 chars) -->
<!-- ============================================================ -->

Got the full picture. Writing Section C for `business_builder` — last per-template audit.

---

# SECTION C — TEMPLATE 19/19: `business_builder` (Business Builder)

**Verdict:** **NEEDS WORK — overlap with `ghost_operator` is the structural issue** (~3-4 hours to specialize/differentiate, OR consider retiring like service_business).
**Headline:** Honestly positioned as a flexible starter ("for any business type — Use this when you know you want agents running a business but haven't locked in the model yet"). `requiredIntegrations: []` is correct for a starter. KB items (business model canvas + ICP + competitive landscape) are an operator-fillable starting framework. **But: same audience as `ghost_operator`** (first-time founders / "I don't know what business yet") with different positioning. Operations Lead has only `["knowledge_lookup"]` (same starvation as agency's COO). The form-driven onboarding via `templateAnswers` is captured at create time but **no agent's system prompt references the answers**. Generic voice. Same library-wide patterns: `primaryModel` not set, no spend ceiling.

## C1. Functional walkthrough — generic-business happy path

The cycle: operator fills form → agents materialize → 4 weekly workflows run → operator picks specialty after 4-8 weeks → re-instantiate as specialty template. Tracing one cycle:

| Stage | Agent | INPUT | PROCESSING | TOOL CALLS | OUTPUT | HANDOFF |
|---|---|---|---|---|---|---|
| **Form intake** | (CreateBusinessFlow UI) | 4-question form (businessDescription / idealCustomers / mainGoalsRightNow / neverSayOrDo / handsOnPreference) | Stored as `templateAnswers` in business config | (UI handler) | Business config populated | 🔴 BREAK — see below |
| **Daily ops** | (no specific agent) | Open tasks + recommended next actions | Daily summary | (CEO probably owns this — not assigned via `agentRole`) | Daily report | ✅ |
| **Weekly strategy** | **CEO** | Week's progress + market developments | Synthesis + priority-setting for the coming week | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Weekly strategy review | ✅ EXPLICIT |
| **Competitor monitoring** | **Research Analyst** | Competitor activity + market movements | Structured intel brief | `web_search`, `knowledge_lookup` + BUILTIN | Competitor report | ✅ EXPLICIT |
| **Growth experiments** | **Growth Strategist** | Active experiments + metrics | Hypothesis + KPIs + recommendations for next experiments | `send_email`, `web_search`, `knowledge_lookup` + BUILTIN | Growth experiment report | ✅ EXPLICIT |
| **Operations** | **Operations Lead** | Repeating processes | Build SOPs, track milestones, run standups | `knowledge_lookup` ONLY | Task board + SOPs | 🔴 BREAK — only `knowledge_lookup`, can't email or delegate |

### Break points

1. **Form-driven onboarding doesn't reach the agents** — `BusinessForm.tsx` captures `templateAnswers` (businessDescription, idealCustomers, mainGoalsRightNow, neverSayOrDo, handsOnPreference). Stored in business config. **No agent system prompt references these answers or instructs agents to look them up.** The most personalized data the operator provides is invisible to the agents. **The `business_builder` template specifically benefits from this form (as does `ghost_operator`), but the connection isn't wired.**

2. **Operations Lead has only `["knowledge_lookup"]`** — Same exact starvation as agency template's COO. Role: *"runs daily standups, conducts weekly operations reviews, flags bottlenecks to the CEO."* **Cannot email standups. Cannot send Telegram. Cannot delegate.** Standups happen in chat without delivery.

3. **Identity overlap with `ghost_operator`** — Both target first-time founders. `ghost_operator` is positioned as "autonomous business builder" with marketing weight. `business_builder` is positioned as "flexible starter." **Same audience, different positioning.** Customer browsing the template selector can't tell which to pick.

4. **No bridge to specialty templates** — Description says *"Easiest template to pivot into a specialty (Newsletter Empire, Etsy Digital, Local Lead Gen, etc.)"* but **no workflow or mechanism actually pivots an instance.** Operator must create a NEW business with the specialty template + manually copy KB items + reset agents.

5. **No `agentRole` assignment on workflows** — Daily Summary, Weekly Strategy Review, Competitor Monitor, Growth Experiment Report — none have `agentRole` set. Falls back to default agent (CEO?) for all. **Workflow-to-agent routing is implicit.**

6. **System prompt template is one sentence** — *"You are the main operator for {{businessName}}. Keep every suggestion grounded in the business goals, stay clear and calm, and surface next steps in plain English."* For a $147 SKU starter, that's anemic.

7. **Guardrails template is two sentences** — same level.

8. **No agent has Stripe / Resend / social_media_mcp tools in `tools[]`** — all suggested integrations. Auto-attach handles runtime.

9. **`handsOnPreference` from form maps to safetyMode** — but only via `mapHandsOnPreferenceToSafetyMode()` in the API route's `buildBusinessBuilderDefaults()`, **not at agent level**. So the agents themselves don't know the operator's hands-on preference.

10. **Inter-agent coordination via CEO** — standard pattern.

---

## C2. Integration health

| Integration | Declared | Wired? | Status | Notes |
|---|---|---|---|---|
| `resend_mcp` | Suggested | When installed | ⚠ No agent has email tools beyond `send_email` (CEO + Growth) | Acceptable for starter template |
| `stripe_mcp` | Suggested | When installed | ⚠ No agent has Stripe tools | Setup checklist mentions for revenue data |
| `social_media_mcp` | Suggested | When installed | ⚠ No agent has social tools | Same pattern |
| Auto-attached video stack | NOT in `VIDEO_PRODUCTION_TEMPLATES` | ❌ Not auto-attached | ✅ Clean | Correct for starter |
| LLM | `primaryModel: (none set)` | ❌ Falls to platform default | **P1** |

### 8-sub-check audit (no required integrations — minimal table)

For the 3 suggested integrations, all auto-attached when installed. Same library-wide pattern: tool enumeration not in system prompts, no rate-limit awareness, no cost ceiling, no fallback.

---

## C3. Media generation deep-check

**Not in scope.** No image/video/voice/music. ✅

---

## C4. Output quality scorecard

| Deliverable | Polish | Specificity | Brand consistency | Usability | Pay $147? |
|---|---|---|---|---|---|
| **Daily Summary** | Medium — depends on KB population | Low — generic across all business types | Medium — depends on form answers being read | Medium | ⚠ Borderline |
| **Weekly Strategy Review** | Medium when KB filled | Low without business-specific data | Medium | Medium | ⚠ Borderline |
| **Competitor Monitor** | High — research grounded | High when KB has competitor list | High | High | ✅ Yes |
| **Growth Experiment Report** | High — hypothesis + KPI framing | Medium — generic experiments without channel data | High | Medium | ⚠ Borderline |
| **Business model canvas (KB-fillable)** | High — structured | High when filled | High | High | ✅ Yes |
| **ICP / Target customer profile** | High when filled | High | High | High | ✅ Yes |
| **Competitive landscape overview** | High when filled | High | High | High | ✅ Yes |
| **Operations playbook (KB)** | High when filled | High | High | High | ✅ Yes |

**Three borderline outputs** — all rooted in: form answers not reaching agents + KB only as good as operator fills it. The KB items are good frameworks; the agents are workmanlike.

---

## C5. Error-handling stress test

| # | Scenario | What happens | P-level |
|---|---|---|---|
| 1 | Operator fills form but agents don't reference answers | Agents work generically. Form data is collected and forgotten. | **P0** |
| 2 | Operator hasn't filled business model canvas KB | Agents work generically. **First-week trap.** | P1 |
| 3 | Operator pivots from "I don't know yet" to "I want a Newsletter Empire" | No bridge. Manual re-instantiation required. | **P1** |
| 4 | 3am unsupervised | All workflows `review_after`. Acceptable. | OK |
| 5 | Customer scales to actual revenue | Stripe not required, no revenue tracking. **Operator paste only.** | P1 |
| 6 | Customer asks "should I use this or `ghost_operator`?" | **No clear differentiator.** | **P0** — pre-purchase confusion |
| 7 | Operations Lead has only `knowledge_lookup` | Can't email standups. Reports sit in chat. | **P0** |
| 8 | Customer never picks a specialty | Stays as generic 4-agent shell forever. **Template doesn't expire or recommend specialty after N weeks.** | P1 |

---

## C6. Premium polish

| Aspect | State | Notes |
|---|---|---|
| **Onboarding** | Form-driven via `templateAnswers` | ⚠ Form answers don't reach agents |
| **Defaults** | `safetyMode: "ask_before_acting"` ✅, **`primaryModel` not set** ❌ | P1 |
| **Documentation** | 6 KB items including business model canvas + ICP + competitive landscape + revenue model + growth channels + operations playbook | ✅ Strong starter-framework KBs (operator-fillable) |
| **Voice** | Template-level system prompt is ONE SENTENCE | ⚠ Anemic |
| **Progress visibility** | Daily summary + weekly strategy + weekly competitor + weekly growth experiments | ✅ Adequate |
| **Handoff moments** | All workflows `review_after` | ✅ |
| **The 90% rule** | ~40-50%. Most agents are KB-paste-driven without specific channel tools. | ⚠ |
| **Bridge to specialty templates** | None | ⚠ |
| **Differentiation from `ghost_operator`** | Unclear | ⚠ |

---

## C7. Cost efficiency

For a first-time founder running this template:
- LLM weekly: ~$1-2 (lightweight, all 4 workflows run once/week)
- Optional: Resend ($20+/mo), Stripe (transaction fees)
- **Total: $0-30/mo template infra**

**Cheap.** ✅ Appropriate for a starter SKU.

**Cost-tier-down:** All workflows are pattern-heavy weekly summaries → Haiku candidates. No Sonnet 4.5 needed for this template.

---

## C8. P0 issues (BLOCKS SHIP)

### P0-1: Form answers (`templateAnswers`) don't reach the agents
**What:** `BusinessForm.tsx` captures `templateAnswers.businessDescription`, `idealCustomers`, `mainGoalsRightNow`, `neverSayOrDo`, `handsOnPreference`. Stored in business config. **No agent system prompt references these.**

**Why it matters:** Priority 2 (Output Quality). The form is the operator's most personalized input. Customer fills it expecting agents to use it. Agents don't.

**Fix:** Update `materializeTemplate()` for `business_builder` to seed the `templateAnswers` into a dedicated KB item at instantiation:

```typescript
// In materializeTemplate when template.id === "business_builder":
const formAnswersKb = {
  category: "about_business",
  title: "Founder's stated context (from setup form)",
  contentTemplate: `
**Business description:** ${context.templateAnswers?.businessDescription ?? "—"}
**Ideal customers:** ${context.templateAnswers?.idealCustomers ?? "—"}
**Main goals right now:** ${context.templateAnswers?.mainGoalsRightNow ?? "—"}
**Things to never say or do:** ${context.templateAnswers?.neverSayOrDo ?? "—"}
**Hands-on preference:** ${context.templateAnswers?.handsOnPreference ?? "—"}
  `,
};
// Inject before other KB items
```

And update each agent's system prompt: *"On every weekly review, knowledge_lookup the 'Founder's stated context (from setup form)' KB item to ground recommendations in what the operator actually said at setup."*

### P0-2: Operations Lead has only `knowledge_lookup`
**What:** Same starvation pattern as agency template's COO and high_ticket_coaching's CFO.

**Fix:**
```diff
  // Operations Lead
  tools: [
+   "send_email",
+   "send_telegram_message",
+   "delegate_task",
+   "propose_todo",
+   "list_todos",
    "knowledge_lookup"
  ]
```

### P0-3: Identity overlap with `ghost_operator`
**What:** Both target first-time founders. Both promise to help build a business. Different positioning, same audience. **Customer can't tell which to pick.**

**Why it matters:** Priority 5 (Premium polish). Pre-purchase confusion = abandoned carts. **Recommendation: retire `business_builder` and consolidate into `ghost_operator`.** Or specialize each:
- **Path A: Retire `business_builder`** — `ghost_operator` already serves this audience with stronger positioning ("autonomous business builder, set it, approve it, scale it"). Customers who want the "I don't know yet, just plan with me" experience get redirected.
- **Path B: Specialize.** `business_builder` becomes the "I have a business but it's outside the specialty templates" choice (consultants, niche professional services that don't fit anywhere). `ghost_operator` stays the "I don't have a business yet, find me one" choice. **Tighten the description language to make the choice obvious.**

I lean **Path A retire** — the library is stronger with 18 differentiated templates than 19 templates that compete.

### P0-4: System prompt template + guardrails template are anemic
**What:** Template-level systemPromptTemplate is ONE sentence. guardrailsTemplate is TWO sentences. For a $147 starter SKU, that's thin.

**Fix:** Expand to ~100-200 words covering: business-stage awareness, "use the founder's stated context KB on every recommendation," weekly cadence discipline, escalation thresholds for spend / strategy pivots / customer-facing claims.

### P0-5: System prompts don't enumerate the actual tool runtime (library-wide pattern)
Same fix.

---

## C9. P1 issues

### P1-1: `primaryModel` + fallback not set
Same library-wide.

### P1-2: No bridge to specialty templates
Description promises "easiest template to pivot into a specialty" but no mechanism. **Add a Monthly Specialty Recommendation workflow:**
```typescript
{
  name: "Monthly Specialty Recommendation",
  description: "Research Analyst reviews the past month's data + competitor analysis + Growth Strategist's experiment results. Recommends ONE specialty template to migrate to (Newsletter Empire / Etsy Digital / Local Lead Gen / Pinterest Traffic / etc.) with rationale. Only fires after Month 1 — not on Day 1.",
  trigger: "scheduled",
  output: "report",
  scheduleMode: "every",
  frequency: "monthly",
  approvalMode: "review_after",
  agentRole: "Research Analyst"
}
```

### P1-3: No Stripe / Resend / social tools wired even when installed
Same library-wide pattern.

### P1-4: No spend ceiling
Same library-wide. (Lower exposure for this template since it's lightweight.)

### P1-5: Voice generic
Same library-wide.

### P1-6: No `agentRole` on workflows
Daily Summary + Weekly Strategy + Competitor + Growth Experiments — none have `agentRole`. Falls back to default. Should be explicit.

### P1-7: `handsOnPreference` doesn't reach agents
Maps to safetyMode at create time but agents don't see it.

### P1-8: No KB pre-seed examples
Business model canvas + ICP + competitive landscape are placeholders. Could pre-seed 2-3 example sets so operator has "what good looks like."

### P1-9: 4 workflows for 4 agents is light
Most templates have 6-8 workflows. Could add: monthly KB review (operator updates business model canvas), weekly operations standup, monthly financial review.

### P1-10: No specialty-migration helper
If P1-2 recommends a specialty, no agent helps the migration.

---

## C10. P2 issues

### P2-1: Pre-seed KB examples
For "what good looks like."

### P2-2: Specialty migration tool
A helper that exports the current business's KB items and reformats for a target specialty template.

### P2-3: Founder journal workspace doc
Like dealhawk's PORTFOLIO_TRACKER.md — track founder's weekly reflections + decisions.

### P2-4: 4-question form could be richer
"Industry / niche" + "current revenue" + "team size" would help agents context-set. But more form fields = higher friction.

### P2-5: Generic Daily Summary could be smarter
Currently any open tasks + recommended next actions. Could include weekly progress vs goals, founder's stated context recall, market developments.

---

## Summary fix-time for `business_builder`

| Priority | Issues | Fix-time |
|---|---|---|
| P0 (5) | Form answers → KB injection at materialize, Operations Lead tools, identity overlap (retire vs specialize), expanded system prompt + guardrails, system-prompt tool enumeration | **3-4 hours** (Path B specialize) **OR ~1 hour** (Path A retire) |
| P1 (10) | primaryModel + fallback, specialty bridge workflow, integration tools, spend ceiling, voice tightening, agentRole assignment, handsOnPreference flow, KB pre-seeds, more workflows, specialty migration helper | **2-3 hours** (specialize) |
| P2 (5) | pre-seed KBs, migration tool, founder journal, richer form, smarter daily summary | **1-2 hours** |

**Total to S-tier: ~1 hour (retire) OR ~6-9 hours (specialize).** **Recommended path: retire `business_builder` and consolidate into `ghost_operator`** — same audience, `ghost_operator` has stronger positioning + marketing weight. The library doesn't lose anything; the SKU lineup gets clearer.

---

## ✅ All 19 per-template audits complete

**Next message: Section D — Library-wide findings + cross-cutting issues.** This is where I'll synthesize the patterns I've called out across templates (the library-wide P0s and P1s that recur) and propose the highest-leverage fixes that unlock multiple templates at once.

Then **Section E** (sequenced fix plan ordered by leverage) and **Section F** (re-audit triggers).

Send "go" when ready for Section D.


<!-- ============================================================ -->
<!-- Section D — Library-Wide Findings  (transcript line 1038, 22006 chars) -->
<!-- ============================================================ -->

# SECTION D — Library-Wide Findings

Synthesis of the patterns that recurred across 19 per-template audits. Ordered by leverage — the issues at the top unlock the most templates per fix-hour.

---

## D1. Cross-cutting issues (problems showing up in 3+ templates)

The highest-leverage fixes. Ranked by impact × number of templates affected.

| # | Issue | Templates affected | Severity | Why it matters |
|---|---|---|---:|---|
| **D1-1** | **System prompts don't enumerate the actual tool runtime** | All 19 | P0 | Agents don't know what tools they have at runtime. `getToolsForAgent()` auto-attaches BUILTIN_ALWAYS_ON, video stack (for VIDEO_PRODUCTION_TEMPLATES), YouTube stack (for YOUTUBE_API_TEMPLATES), and any installed MCP tools. **Agents see tools but their system prompts only reference the explicit `tools[]` whitelist** (often 2-3 tools out of 20-30 actually available). The Content Producer agent in tiktok_shop is told to "use TikTok Commercial Music Library audio" but isn't told it has `heygen_generate_video` available — so it produces text scripts and misses the video pipeline. |
| **D1-2** | **`primaryModel` not pinned** | 15/20 templates (only tiktok_shop, faceless_youtube, forex, dealhawk_empire pin it) | P1 | Falls through to platform default. **`tiptax_affiliate_engine` has `primaryModel: ""` (empty string typo) — different bug.** Output drift across runs as platform defaults change. |
| **D1-3** | **No `fallbackModel`** | All 20 templates | P1 | If primary model errors, no graceful failover. |
| **D1-4** | **No spend ceiling library-wide** | All 20 templates that loop generation (tiktok_shop UGC at $30-2200/wk uncapped, social_media_agency video gen unbounded across clients, content_creator + agency + ghost_operator cold outreach unbounded) | P0 for templates with loops | Customer scales, burns credits, refunds/chargebacks. |
| **D1-5** | **Specialist agent tool starvation** — agents whose role description requires specific tools have `["knowledge_lookup"]` only or near-empty arrays | 7 templates (Operations Manager in ecommerce, COO in agency, CFO in high_ticket_coaching + skool_community + tiktok_shop, Operations Lead in business_builder, Service Coordinator implicit, Reputation Manager / Marketing Lead in local_service) | P0 | Customer pays for autonomous role; gets paste-driven shell. **CFO in high_ticket_coaching is the most starved — entire role is failed-payment recovery via Stripe but agent has only `knowledge_lookup`.** |
| **D1-6** | **CEO/main agents missing `send_email`** | 3 templates: content_creator's CEO, social_media_agency's CEO, skool_community's CEO all have only `["web_search", "knowledge_lookup"]` | P0 | Weekly business health reports sit in chat with no delivery channel. Pattern of CEO-without-email is concentrated in content/community templates. |
| **D1-7** | **Webhook routing undocumented** | 8+ templates with `webhook` triggers (saas_product, high_ticket_coaching, real_estate, local_service, skool_community, ecommerce, social_media_agency, agency) | P0 | Setup checklists mention webhook integrations but don't tell operator: which Stripe events to subscribe to, what URL to use, how to test the wiring. **Workflows silently never fire in production.** |
| **D1-8** | **Frequency-bug pattern** — workflow scheduled at wrong cadence vs description | 4 templates: real_estate (Past Client Re-Engagement weekly but description "quarterly"), service_business (Quarterly Business Review weekly), social_media_agency (Monthly Client Report weekly), and 1 borderline in skool_community | P0 | Same client gets nurtured 13× per quarter, monthly reports fire weekly. Operator confusion + customer churn. |
| **D1-9** | **Inter-agent "coordinate with X" without `delegate_task`** | All 20 templates | P1 | Specialists don't have `delegate_task` (only leaders/`type: "main"` do). **Specialists asking each other to "coordinate" cannot actually delegate** — they surface intent only. Pattern works in templates with explicit coordinators (dealhawk's Deal Ops Lead, tiktok_shop's CEO) but is fragile. |
| **D1-10** | **Voice generic on service-tier templates** | 8 templates: service_business, real_estate, local_service, social_media_agency, skool_community, business_builder, saas_product, high_ticket_coaching all have generic voices | P1 | "Warm, helpful, professional" is library-default. Premium voices that differentiate: tiktok_shop, faceless_youtube, dealhawk_empire, tiptax, content_creator, pinterest_traffic. **Half the library doesn't sound premium.** |
| **D1-11** | **Auto-attached tool stack pollution** — templates in `VIDEO_PRODUCTION_TEMPLATES` / `YOUTUBE_API_TEMPLATES` that don't use those tools | 3 templates: ghost_operator (in VIDEO + no video usage), agency (in VIDEO + minimal usage), content_creator (in BOTH VIDEO + YOUTUBE despite being newsletter-only) | P1 | ~15-30 unused tools auto-attached per template. Pollutes agent decision space (more tools = harder to pick the right one). |
| **D1-12** | **`stripe_mcp` required where not needed** | 3 templates: ecommerce (Etsy operators use Etsy Payments, not Stripe), faceless_youtube (AdSense + sponsorships dominant; Stripe is stream 4), content_creator (newsletter ad-revenue path doesn't need Stripe). **`tiktok_shop` had this same bug pre-rebuild — fixed.** | P0 | Operators forced to install integrations they don't use. Same fix pattern as tiktok_shop rebuild: demote to suggested or move to optional addon. |
| **D1-13** | **Suggested integrations referenced in system prompts but no agent has the tools** ("declared ≠ wired") | 11+ templates: hubspot_mcp referenced everywhere but only 1 template has hubspot tools wired (none, actually — confirmed in Section A inventory). social_media_mcp referenced widely but only 4 templates have social tools in any agent's `tools[]`. | P0 | Customer reads "uses HubSpot" / "publishes to social" — agents don't actually do it without auto-attach AND system-prompt instruction. |
| **D1-14** | **Multi-client isolation missing** | 4 templates: agency, social_media_agency, content_creator (sponsor pipeline), ecommerce (multi-store) | P1 | All clients live in one KB pool. Agents at scale (10+ clients) hit cross-contamination of brand voice. |
| **D1-15** | **Bifurcated identity** — template tries to serve 2+ archetypes with one shell | 3 templates: agency (creative + AI Reseller), ecommerce (DTC + Etsy), business_builder (overlaps ghost_operator) | P0 | Customer browsing template selector can't tell what they're buying. Setup checklists in 2 templates literally say "Pick your archetype first." |
| **D1-16** | **Telephony triad ambiguity** | 5 templates: dealhawk_empire, agency, real_estate, local_service, high_ticket_coaching all suggest WhatsApp + Twilio + Telnyx with no opinion | P1 | Customer doesn't know which to install. Only `local_lead_gen` and (post-suggestion-only) `tiptax_affiliate_engine` actually surface an opinion. |
| **D1-17** | **No deduplication on workflow re-runs** | All templates with scheduled workflows | P1 | Operator runs Newsletter Draft twice in a week → two drafts. Past Client Re-Engagement weekly without cohort rotation → same clients get re-engaged 13× per quarter. |
| **D1-18** | **No A2P 10DLC verification at agent level** | 4 templates that wire SMS: real_estate, local_service, dealhawk, social_media_agency | P1 | Setup checklists warn but no agent verifies registration before sending. Unregistered numbers throttled silently. |
| **D1-19** | **Form/templateAnswers data not reaching agents** | 1 template critical (business_builder), 1 template implicit (every template that captures `templateAnswers` from the form) | P0 | The most personalized data the operator provides is invisible to agents. **Customer fills the form, agents work generically.** |
| **D1-20** | **No template-version migration path** | All templates | P2 | Existing businesses created on the OLD template definition keep their old agents/workflows/KB — only NEW businesses get the rebuilt structure. No migration tool exists. |

### Bugs (specific code defects, not patterns)

| # | Bug | Template | Fix |
|---|---|---|---|
| B-1 | `primaryModel: ""` empty-string typo | tiptax_affiliate_engine | Change to `"anthropic/claude-sonnet-4.5"` |
| B-2 | `Past Client Re-Engagement` workflow has `frequency: "weekly"` but description says "quarterly" | real_estate | Change to monthly cohort-rotation OR true quarterly |
| B-3 | `Quarterly Business Review` workflow has `frequency: "weekly"` | service_business | Same fix |
| B-4 | `Monthly Client Report` workflow has `frequency: "weekly"` | social_media_agency | Change to monthly |
| B-5 | `Performance Analyst` agent referenced in SKU_SCORECARD.md doesn't exist in starterAgents | ecommerce | Either add the agent or reassign role to existing agent |
| B-6 | Setup checklist says Twilio is required but `requiredIntegrations: ["resend_mcp"]` only | local_service | Move twilio_mcp to required |
| B-7 | `"hubspot_mcp"` listed as a tool name in Contractor Outreach's `tools[]` array (it's an MCP id, not a tool) | local_lead_gen | Remove the entry or replace with specific hubspot tool names |
| B-8 | Duplicate KB items: `Service catalog and pricing` + `Offers and delivery` | service_business | Delete one |
| B-9 | Duplicate KB items: `Service packages and deliverables` + `Service packages and pricing` | social_media_agency | Same |
| B-10 | `agentRole` not set on workflows in business_builder | business_builder | Add explicit agentRole |

---

## D2. Standardization recommendations

Single patterns that, once chosen and applied library-wide, eliminate entire classes of issues.

### S-1: Universal model-pinning rule
**Pattern:** Every template's `defaults` block sets:
```typescript
defaults: {
  primaryModel: "anthropic/claude-sonnet-4.5",  // or operator-overridable
  fallbackModel: "anthropic/claude-haiku-4.5",
  // ...
}
```
**Affected:** 15 templates that don't pin + 1 with empty-string typo.
**Effort:** ~1 hour for the whole library.

### S-2: System-prompt tool enumeration as a uniform block
**Pattern:** Every agent's system prompt ends with a "TOOLS YOU HAVE ACCESS TO (AT RUNTIME)" block listing the auto-attached + explicit-whitelist + BUILTIN tools relevant to the role. Generated programmatically from the tool registry, not hand-typed per agent (so it stays current as auto-attach rules evolve).

**Implementation:** A `composeAgentSystemPrompt(template, agent)` helper that pulls the realized tool list from `getToolsForAgent` (or a static equivalent for materialization) and appends it to the agent's `systemPromptTemplate`.

**Affected:** All 19 templates.
**Effort:** ~3-5 hours (build the helper + run a one-time refactor).

### S-3: Spend ceiling as a template-level config
**Pattern:** Every template that loops content generation OR cold outreach gets a `spendCeilings` block:
```typescript
defaults: {
  spendCeilings: {
    weeklyVideoGen: 100,    // USD
    weeklyColdEmail: 50,
    monthlyTotal: 500,
  },
  // ...
}
```
And agent-level guardrails reference these. Surfaced in Setup Checklist.

**Affected:** ~12 templates with looping output. **Highest dollar-impact fix in the library.**
**Effort:** ~2-3 hours (define schema + apply per template).

### S-4: Webhook routing standard + verification step
**Pattern:** Documented in setup checklist for every template with `trigger: "webhook"` workflows:
```
- Configure your webhook source to fire to:
  /api/webhooks/<source>/[businessId]/<event>
  Common events for this template: [list]
- Run the workflow MANUALLY first to verify the agent's output is correct.
- Test the webhook with a sample event before trusting automation.
```
**Affected:** 8+ templates.
**Effort:** ~2 hours (template-specific setup-checklist rewrites).

### S-5: Form-data-to-KB pipeline
**Pattern:** `materializeTemplate()` accepts `templateAnswers` and seeds a "Founder's stated context (from setup form)" KB item at instantiation. Every agent's system prompt references this KB on every reasoning cycle.

**Affected:** business_builder critically; would benefit ghost_operator + ecommerce + service_business + others if they collect form data.
**Effort:** ~2 hours (extend `materializeTemplate()` + update agent prompts).

### S-6: Premium voice rubric
**Pattern:** Every template's `brandVoice` field follows the rubric demonstrated by tiktok_shop / faceless_youtube / dealhawk_empire / pinterest_traffic / content_creator / tiptax: **specific, metric-driven, anti-hype, refuses generic AI babble.** Add an AI-tells blacklist KB item to every template (current best example: content_creator's blacklist of "in today's fast-paced world / delve into / let's dive into / in conclusion / em-dash clusters / tricolons").

**Affected:** 8 generic-voice templates.
**Effort:** ~3-4 hours (per-template voice rewrite).

### S-7: agentRole assignment on every workflow
**Pattern:** Every workflow has explicit `agentRole`. No fallback to default-agent routing.
**Affected:** business_builder critically; spot-fixes elsewhere.
**Effort:** ~1 hour.

### S-8: Telephony opinion at template level
**Pattern:** Templates that need SMS pick ONE primary (recommend Telnyx for cost; document Twilio as alternative for A2P features) + ONE secondary (WhatsApp Cloud for international). No more triple-suggestion-no-opinion.
**Affected:** 5 templates.
**Effort:** ~1-2 hours.

### S-9: Dedup on workflow re-runs
**Pattern:** Workflows that produce content check the workspace doc / KB / database for prior outputs from the same period before producing.
**Affected:** Most templates with weekly/daily content workflows.
**Effort:** ~3-4 hours (apply per workflow type).

---

## D3. Reusable primitive opportunities

Agents and patterns that repeat across templates — could become shared building blocks.

### P-1: Compliance Officer base
Templates with explicit Compliance Officer agents: tiktok_shop, faceless_youtube, dealhawk_empire, agency, forex_trading_desk. **Shared "Compliance Officer Base"** with niche-specific extensions.

Could collapse to a `BASE_COMPLIANCE_OFFICER` constant + per-template `complianceExtensions` field.

### P-2: Finance / Unit Economics analyst base
Templates: tiktok_shop, faceless_youtube, ecommerce, agency, ghost_operator, high_ticket_coaching, dealhawk_empire, skool_community, saas_product. **9 templates** with Finance/CFO/Revenue agents — same pattern (Stripe + revenue tracking + escalation rules).

Could be a `BASE_FINANCE_ANALYST` with revenue model swapped per-template.

### P-3: 12-week roadmap pattern
Templates: tiktok_shop (SPS-tier graduation), faceless_youtube (90-day launch + 20-video checkpoint), dealhawk_empire (research/outreach/contract phases), ghost_operator (5-step business build), content_creator (subscriber-stage gates).

Each implements the same "calendar-paced launch with milestone gates" pattern differently. Could be a shared **`PhasedLaunchRoadmap` primitive** with milestone-graduation criteria customized per template.

### P-4: Affiliate / Outreach manager
Templates: tiktok_shop, agency, dealhawk_empire (buyer outreach), tiptax_affiliate_engine, faceless_youtube (sponsor outreach), local_lead_gen (contractor outreach), pinterest_traffic. **7 templates** with cold-outreach-with-personalization-and-cadence pattern.

Could be a `BASE_OUTREACH_MANAGER` with channel + audience swapped per template.

### P-5: Customer Service / IM template library
Templates: tiktok_shop, faceless_youtube, ecommerce, service_business, real_estate, local_service, skool_community, saas_product. **8 templates** with response-template-library pattern.

### P-6: Workspace doc tracker pattern
Existing examples — SHOP_HEALTH.md (tiktok_shop), PORTFOLIO_TRACKER.md (dealhawk + local_lead_gen), MONETIZATION_CALENDAR.md + SPONSOR_PIPELINE.md (content_creator), PINTEREST_KEYWORD_MAP.md + PINTEREST_BOARD_ARCHITECTURE.md (pinterest_traffic), SKU_SCORECARD.md (ecommerce), CHANNEL_IDENTITY_BIBLE.md (faceless_youtube), PRODUCT_LADDER.md (tiktok_shop addon), CONTRACTOR_CONTRACTS.md (local_lead_gen), STATE_COMPLIANCE_MATRIX.md + LOI_TEMPLATE.md + OFFER_LETTER.md (dealhawk).

All variations of "operator-fillable structured tracker doc." **Shared `tracker(filePath, schema)` helper** could enforce consistent structure + tier + category fields.

### P-7: Webhook handler pattern
Multiple templates have `trigger: "webhook"` workflows but no shared route handler. **Generic `/api/webhooks/[mcpOrTemplate]/[businessId]/[event]` handler with per-template event mapping.**

### P-8: Setup-checklist generator improvements
`setupChecklistKb()` already exists. Could extend with:
- Auto-generated webhook configuration steps based on `trigger: "webhook"` workflows
- Auto-generated "what your tools[] includes vs auto-attaches" callouts
- Standard A2P 10DLC reminder if any agent has SMS in `tools[]`

---

## D4. Integration consolidation

Places where 2+ templates use different providers for the same job.

### IC-1: HubSpot vs GoHighLevel CRM choice
**Pattern across library:** HubSpot is suggested in 15 templates. GoHighLevel is suggested in 2 (agency, tiptax). **Agency template's setup checklist explicitly bifurcates: HubSpot for traditional creative, GHL for AI Automation Reseller.**

**Recommendation:** Make CRM choice an explicit "pick one at create time" decision. Templates that need a CRM either: (a) require a generic CRM choice, then auto-suggest HubSpot OR GHL based on archetype, or (b) document HubSpot as default with GHL as alternative for service-business archetypes.

**Affected:** 15 templates.

### IC-2: Cold email — Smartlead vs Instantly vs Resend
**Pattern:** Instantly suggested in agency, dealhawk-style outreach. Smartlead in agency + dealhawk + local_lead_gen. Resend everywhere as transactional. **Tiptax wires Smartlead and Instantly simultaneously — fine for a private template but redundant for retail.**

**Recommendation:** Document the intended use of each:
- **Resend** = transactional (welcome, confirmation, single-recipient)
- **Instantly** = cold-email campaigns at scale (multi-inbox + warmup + reply-handling)
- **Smartlead** = premium alternative when paired with Clay enrichment

Standardize "pick one cold-email engine" in setup checklist.

### IC-3: Telephony triad
Already covered in S-8.

### IC-4: Image gen — fal.ai vs Midjourney vs OpenAI DALL-E
**Pattern:** faceless_youtube + ecommerce reference fal.ai (Flux 1.1 Pro / Ideogram 3.0 / Kling). Pinterest_traffic and tiktok_shop reference Midjourney/Canva/OpenArt operator-side. **No template wires Midjourney directly (no official API).**

**Recommendation:** Consolidate around fal.ai as the multi-model aggregator (one API key, 600+ models). Document Midjourney as operator-side only. Move model-version pinning to a shared KB item (referenced via `knowledge_lookup`) so library-wide upgrades happen in one place.

### IC-5: Skool / Circle / Discord community platforms
**Pattern:** skool_community uses Skool. high_ticket_coaching mentions Skool/Circle/Slack/Discord. **None have community-platform MCPs.** All operator-paste-driven.

**Recommendation:** Document this as a coordinated Sprint 2-3 roadmap: build Skool + Circle + Discord MCPs together since they share the "post + read + DM + member-data" surface. Until then, every template that touches community platforms should have identical "no-API; agents draft, operator pastes" disclosure language.

### IC-6: Beehiiv / Substack / Kit / Ghost newsletter platforms
**Pattern:** content_creator hardcodes beehiiv. Other templates that touch newsletters (faceless_youtube's email list, ghost_operator's email funnel) don't pin a platform.

**Recommendation:** Same pattern as IC-5 — document as a Sprint 2-3 roadmap. Add Substack/Kit/Ghost MCPs alongside Beehiiv. Move beehiiv from required → suggested (also a P0 from content_creator's audit).

### IC-7: Stripe vs Shopify vs Etsy Payments
**Pattern:** ecommerce requires Stripe, but Etsy operators use Etsy Payments (different flow). DTC operators use Shopify Payments OR Stripe (Shopify usually).

**Recommendation:** When the bifurcated `ecommerce` template is split (per ecommerce P0-1), `etsy_digital_studio` requires no Stripe, `dtc_ecommerce` requires Shopify (which includes Shopify Payments OR routes to Stripe per operator setup).

---

## Library-wide P0 themes (synthesis)

The library has **5 root P0 themes** that cluster the issues above:

**Theme 1 — Tools-vs-prompts mismatch.** Auto-attach gives agents capability; system prompts don't enumerate. Customer reads "agent uses HeyGen/HubSpot/Stripe" and the agents may or may not actually call those tools. **Affects all 19 templates.** Fix: S-2 (system-prompt enumeration helper).

**Theme 2 — Webhook + signal plumbing.** Templates with `webhook` triggers depend on operator wiring that's undocumented. Stripe events, lead-source webhooks, Skool platform events — all silent-fail without proper wiring. **Affects 8+ templates.** Fix: S-4 (webhook routing standard).

**Theme 3 — Spend-ceiling absence.** Loops can burn unbounded credits. AI video gen, cold email blasts, SMS, image generation. **Affects ~12 templates.** Fix: S-3 (spendCeilings config).

**Theme 4 — Specialist agent starvation.** Roles that need specific tools have only `["knowledge_lookup"]`. Fix: enumerate the auto-attach + add `send_email`/`send_telegram_message` to every specialist + tighten the per-agent `tools[]` whitelist.

**Theme 5 — Bifurcated identity / overlap.** agency, ecommerce, business_builder, service_business, social_media_agency, skool_community, high_ticket_coaching, real_estate, local_service, saas_product all overlap in "service business with 4 agents + Stripe + Resend + suggested HubSpot." Fix: split bifurcated templates (agency, ecommerce), retire overlapping ones (service_business, business_builder), tighten differentiation on the rest.

---

**Next message:** Section E — sequenced fix plan ordered by leverage. Send "go" if ready.


<!-- ============================================================ -->
<!-- Section E — Sequenced Fix Plan  (transcript line 1046, 24899 chars) -->
<!-- ============================================================ -->

# SECTION E — Sequenced Fix Plan

Ordered by leverage. Phases 0-3 with explicit ordering, dependencies, and fix-time estimates. Each fix names the file/agent/workflow + what changes.

**Total estimated fix-time across the library: ~80-110 hours of focused work** (across 4 phases, parallelizable across ~3 phases). The right order matters — Phase 0 unlocks Phases 1-3.

---

## Phase 0 — Library-wide foundations (first; unlocks everything)

These compound. Every per-template P0 in Phase 1 leans on at least one of these.

### E0-1: Bug-batch the 10 specific defects (1-2 hours, low risk, high signal)

These are typo-class bugs that should ship before any structural work. Easy to verify via TypeScript + manual smoke test.

| Bug | File / location | Change |
|---|---|---|
| B-1: `primaryModel: ""` empty-string | `lib/templates/tiptax-affiliate-engine.ts:68` | Set to `"anthropic/claude-sonnet-4.5"` |
| B-2: `Past Client Re-Engagement` weekly vs description quarterly | `lib/templates/business-templates.ts` (real_estate, ~line 3868) | Change `frequency: "weekly"` → `"monthly"` + update description to "monthly cohort rotation (operator divides past-client list into 3 cohorts; each touched once per quarter)" |
| B-3: `Quarterly Business Review` weekly | `lib/templates/business-templates.ts` (service_business, ~line 1448) | Change `frequency: "weekly"` → `"quarterly"` |
| B-4: `Monthly Client Report` weekly | `lib/templates/business-templates.ts` (social_media_agency, ~line 4546) | Change `frequency: "weekly"` → `"monthly"` |
| B-5: `Performance Analyst` ghost agent | `lib/templates/business-templates.ts` (ecommerce SKU_SCORECARD.md ~line 1947) + `starterAgents` array | Either add `Performance Analyst` agent OR rename to existing agent (recommend: assign role to Etsy Listing Copywriter, rename in workspace doc) |
| B-6: local_service Twilio metadata mismatch | `lib/templates/business-templates.ts` (local_service ~line 3988) | Move `twilio_mcp` from suggested to `requiredIntegrations` per the setup checklist's claim |
| B-7: `"hubspot_mcp"` listed as tool name | `lib/templates/business-templates.ts` (local_lead_gen Contractor Outreach `tools[]` ~line 7555) | Remove the entry (HubSpot tools auto-attach when MCP installed) |
| B-8: Duplicate KB items in service_business | `lib/templates/business-templates.ts` (service_business, ~line 1518 + 1554) | Delete the second `Offers and delivery` KB item |
| B-9: Duplicate KB items in social_media_agency | `lib/templates/business-templates.ts` (social_media_agency, ~line 4618 + 4647) | Consolidate `Service packages and deliverables` + `Service packages and pricing` into one |
| B-10: `agentRole` not set on business_builder workflows | `lib/templates/business-templates.ts` (business_builder workflows ~line 1196) | Add explicit `agentRole` to all 4 workflows |

**Fix-time:** ~1.5-2 hours. **Validation:** TypeScript check + runtime template-load via tsx (same script we used for tiktok_shop verification).

### E0-2: Universal model pinning + fallback (S-1) (1 hour)

Add to every template's `defaults` block:
```typescript
defaults: {
  primaryModel: "anthropic/claude-sonnet-4.5",
  fallbackModel: "anthropic/claude-haiku-4.5",
  // ...rest
}
```

**Affected:** 15 templates that don't pin (and the 1 with empty-string typo if not caught in E0-1). **Sub-1-hour change.**

**Implementation note:** Some templates may benefit from Haiku as primary for cost-tier-down (e.g., business_builder, service_business). Default to Sonnet 4.5 + Haiku fallback; let later optimization tune per template.

### E0-3: System-prompt tool enumeration helper (S-2) (3-5 hours)

Build `composeAgentSystemPrompt(template, agent)` in `lib/templates/business-templates.ts`:

```typescript
/**
 * Compose an agent's runtime system prompt by appending the actual tool
 * runtime (BUILTIN_ALWAYS_ON + auto-attached video/youtube stack + agent's
 * explicit tools[] whitelist + any installed MCP tools) to the agent's
 * systemPromptTemplate.
 *
 * Why: agents that don't know what tools they have at runtime won't call
 * them. Currently 19/19 templates have this gap.
 */
export function composeAgentSystemPrompt(
  template: BusinessTemplate,
  agent: StarterAgentTemplate,
  installedMcpToolNames: string[] = []  // optional — for runtime hydration
): string {
  const builtins = Array.from(BUILTIN_ALWAYS_ON);
  const isVideo = VIDEO_PRODUCTION_TEMPLATES.has(template.id);
  const isYoutube = YOUTUBE_API_TEMPLATES.has(template.id);
  const videoTools = isVideo
    ? ["heygen_*", "creatify_*", "generate_voiceover", "broll_search",
       "auto_clip_*", "transcribe_audio", "assemble_video", "upload_to_r2"]
    : [];
  const youtubeTools = isYoutube
    ? ["youtube_upload_video", "youtube_get_video_analytics", /* etc */]
    : [];
  const explicit = agent.tools ?? [];
  const allTools = Array.from(new Set([
    ...builtins, ...videoTools, ...youtubeTools, ...explicit, ...installedMcpToolNames
  ]));

  const enumeration = `

──── TOOLS YOU HAVE ACCESS TO (AT RUNTIME) ────
${allTools.join(", ")}

Tools you do NOT have (operator runs externally): [per-template manual list].

Always prefer your actual tools over describing what an external workflow would do.
`;

  return agent.systemPromptTemplate + enumeration;
}
```

Then update `materializeTemplate()` to call this when creating each agent's `systemPrompt`:
```diff
- systemPrompt: applyContext(starterAgent.systemPromptTemplate, subContext),
+ systemPrompt: applyContext(
+   composeAgentSystemPrompt(template, starterAgent),
+   subContext
+ ),
```

**Fix-time:** ~3-5 hours including testing. **Affects all 19 templates simultaneously.** Highest-leverage single change in the audit.

### E0-4: Spend-ceiling config + agent guardrails (S-3) (2-3 hours)

Add `spendCeilings` to `BusinessTemplate.defaults`:
```typescript
defaults: {
  spendCeilings?: {
    weeklyVideoGen?: number;       // USD
    weeklyColdEmail?: number;
    weeklySmsBlast?: number;
    weeklyImageGen?: number;
    monthlyTotalCap?: number;
  },
  // ...
}
```

Per-template defaults (canonical examples):

| Template | Recommended spendCeilings |
|---|---|
| tiktok_shop | weeklyVideoGen: 300, weeklyColdEmail: 50, monthlyTotalCap: 1500 |
| faceless_youtube | weeklyVideoGen: 200, weeklyColdEmail: 50, monthlyTotalCap: 800 |
| social_media_agency | weeklyVideoGen: 300 (per-client × 5 clients = 1500), monthlyTotalCap: 1500 |
| dealhawk_empire | weeklyColdEmail: 100, weeklySmsBlast: 50, monthlyTotalCap: 500 |
| agency | weeklyColdEmail: 200, monthlyTotalCap: 600 |
| local_lead_gen | weeklyColdEmail: 50, monthlyTotalCap: 300 |
| ghost_operator | monthlyTotalCap: 500 (lower — first-time-founder buyer) |
| business_builder | monthlyTotalCap: 100 |
| Others | monthlyTotalCap: 300-500 default |

Update agent system prompts (via the composer in E0-3) to add a `COST GUARDRAILS` block that references the spendCeilings. **Fix-time:** ~2-3 hours.

### E0-5: Form-data-to-KB pipeline (S-5) (2 hours)

Update `materializeTemplate()` to inject `templateAnswers` (and similar form data) into a "Founder's stated context (from setup form)" KB item at instantiation:

```typescript
// In materializeTemplate, after enabledAddons resolution:
if (templateAnswers && Object.keys(templateAnswers).length > 0) {
  const formContextKb: StarterKnowledgeTemplate = {
    category: "about_business",
    title: "Founder's stated context (from setup form)",
    contentTemplate: formatTemplateAnswers(templateAnswers),
  };
  allStarterKnowledge.unshift(formContextKb);  // first, so it ranks high
}
```

Update each template's CEO/main agent system prompt (via the composer): *"On every reasoning cycle, knowledge_lookup the 'Founder's stated context' KB item to ground recommendations in what the operator stated at setup."*

**Affected:** business_builder critically; benefits ghost_operator, ecommerce, service_business, anywhere `templateAnswers` is captured. **Fix-time:** ~2 hours.

### E0-6: Webhook routing standard documentation (S-4) (2 hours)

Build a per-template setupChecklistKb extension that auto-generates the webhook configuration block based on the template's `starterWorkflows` array.

When a workflow has `trigger: "webhook"`, the generator inserts:
```
WEBHOOK CONFIGURATION:
- This template uses webhooks for: <list of workflows>
- Configure your webhook source to fire to:
  /api/webhooks/<source>/[businessId]/<event>
- For Stripe events: <list of Stripe event names this template subscribes to>
- For lead-source events: <list of common sources>
- Test the wiring with a sample event before trusting automation.
- Run each webhook-triggered workflow MANUALLY first to verify output.
```

**Affected:** 8+ templates. **Fix-time:** ~2 hours (one-time helper + auto-generation).

### E0-7: Verify webhook handler routes exist (1-2 hours)

Audit `app/api/webhooks/` for the routes referenced in templates:
- `/api/webhooks/stripe/[businessId]` — verify exists
- `/api/webhooks/instantly/[businessId]` — verify exists (per tiptax)
- `/api/webhooks/whatsapp/[businessId]` — verify
- `/api/webhooks/sendpilot/[businessId]` — verify
- `/api/webhooks/realestate/[businessId]/new-lead` — likely missing
- `/api/webhooks/saas/[businessId]/new-signup` — likely missing
- `/api/webhooks/highticket/[businessId]/new-lead` — likely missing
- `/api/webhooks/skool/[businessId]/new-member` — likely missing
- `/api/webhooks/localservice/[businessId]/new-inquiry` + `job-complete` — likely missing
- `/api/webhooks/socialmediaagency/[businessId]/new-client` — likely missing

For each missing route: build a generic `app/api/webhooks/[template]/[businessId]/[event]/route.ts` that resolves the corresponding workflow by name + fires it.

**Fix-time:** ~1-2 hours (audit + scaffold missing routes). **Critical:** Without these, P0-3-style "webhooks undocumented + actually missing" bugs ship. Without these, the entire webhook story is fictional.

### Phase 0 total: ~12-17 hours, completes the foundation

After Phase 0:
- All bugs fixed
- All templates pin a model with fallback
- All agent system prompts enumerate tool runtime at materialization
- All templates have spend ceilings
- Form data reaches agents
- Webhook routes documented + verified to exist

**Phase 0 unlocks Phase 1 by removing 6 of the 20 cross-cutting issues from D1.** Phase 1's per-template P0s become smaller and more focused after Phase 0.

---

## Phase 1 — Per-template P0 fixes (in ranked order)

After Phase 0, every template's P0 list shrinks. The per-template P0s remaining are template-specific functional gaps. **In ranked order from Section B (most-ready first, since these compound trust and momentum).**

### E1-1: `tiktok_shop` (rank #1) — already largely fixed via the rebuild
**Remaining P0s after Phase 0:**
- Affiliate Manager system prompt overpromises Affiliate API (no API MCP wired yet) — fix description language
- Finance & Settlement Analyst tool wiring (already fixed: it has `knowledge_lookup` only) — add `send_email`, `send_telegram_message`
- Customer Service & Reviews missing reply-comment tool

**Fix-time:** ~2 hours. **Files:** `lib/templates/business-templates.ts` (tiktok_shop block).

### E1-2: `faceless_youtube` (rank #2)
**Remaining P0s after Phase 0:**
- Stripe + Resend wrongly required → move to suggested (same fix pattern as tiktok_shop rebuild)
- Compliance pre-publish gate workflow missing → add new workflow
- AI disclosure flag verification on `youtube_upload_video` tool — verify schema exposes the disclosure params; if not, add

**Fix-time:** ~3 hours. **Files:** `lib/templates/business-templates.ts` (faceless_youtube), `lib/mcp/tool-registry.ts` (verify YouTube tool schema).

### E1-3: `dealhawk_empire` (rank #3)
**Remaining P0s after Phase 0:**
- TCPA attestation enforcement at agent-call layer (currently UI-only) — add `tcpa_attested` check inside `dealhawk_draft_outreach`
- Skip-trace provider clarity — add `provider` param to `dealhawk_skip_trace` tool

**Fix-time:** ~2-3 hours. **Files:** `lib/dealhawk/tools.ts` (or wherever `dealhawk_*` tools live) + `lib/templates/business-templates.ts`.

### E1-4: `forex_trading_desk` (rank #4) — RETIRE FROM PUBLIC
**Single change:**
```diff
  // forex_trading_desk template
+ visibility: "private",
+ ownerEmails: ["beardfacebeard@gmail.com"],
```
**Fix-time:** ~15 minutes. Already documented in Section C/4.

### E1-5: `tiptax_affiliate_engine` (rank #5)
**Remaining P0s after Phase 0:**
- Postgres schema dependency unguarded — add schema-version check tool
- Webhook route implementation verification — Phase 0 should catch this; if not, build them

**Fix-time:** ~3 hours. **Files:** `lib/templates/tiptax-affiliate-engine.ts` + new schema check tool.

### E1-6: `ghost_operator` (rank #6)
**Remaining P0s after Phase 0:**
- CMO publishing tools — add `social_publish_post`, `schedule_post`, `get_analytics`, `get_comments` to CMO `tools[]`
- CFO Stripe tools + move `stripe_mcp` to required (currently suggested)
- CTO/Builder description-vs-reality clarification — update template description language

**Fix-time:** ~3-4 hours. **Files:** `lib/templates/business-templates.ts` (ghost_operator).

### E1-7: `agency` (rank #7) — DECISION POINT
**Path A (recommended): split into `agency_creative` + `agency_ai_automation`** = 6-8 hours
**Path B: keep merged + fix in place** = 4 hours

Specific in-place P0s:
- Fulfillment Orchestrator tool wiring (or rename to "Build Architect" + clarify contract)
- COO tool wiring (`send_email`, Slack, project-management tools)
- HubSpot vs GHL clarity

### E1-8: `local_lead_gen` (rank #8)
**Remaining P0s after Phase 0:**
- Daily GBP Health Check workflow — add new workflow (GBP Optimizer monitors)
- CallRail invalidation alerting — add escalation rule + `send_telegram_message` to Call Tracking + Lead QA

**Fix-time:** ~3-4 hours.

### E1-9: `content_creator` (rank #9)
**Remaining P0s after Phase 0:**
- beehiiv → suggested (move out of required); Resend stays required
- Community Manager social tools (add `social_publish_post`, `get_comments`, `social_get_analytics`)
- Voice samples gating — add to Writer's system prompt: refuse to draft if KB Operator voice samples is empty/placeholder
- Remove `content_creator` from `VIDEO_PRODUCTION_TEMPLATES` AND `YOUTUBE_API_TEMPLATES` in `tool-registry.ts:4785, 4797`

**Fix-time:** ~3-4 hours.

### E1-10: `pinterest_traffic` (rank #10)
**Remaining P0s after Phase 0:**
- Pin Designer image-gen tools — add `generate_image`, `fal_check_generation`, `upload_to_r2`, `list_brand_assets`, `get_brand_asset` to Pin Designer's `tools[]` AND consider adding `pinterest_traffic` to a new `IMAGE_PRODUCTION_TEMPLATES` set in `tool-registry.ts`
- Funnel Architect deployment tools — document the Resend campaign-create gap OR wire campaign tools when Resend MCP supports them
- Stripe tools for revenue attribution — add to Funnel Architect + Analytics Agent

**Fix-time:** ~3-4 hours.

### E1-11: `ecommerce` (rank #11) — DECISION POINT
**Path A (recommended): split or specialize.** Eliminate the DTC half (overlaps `tiktok_shop` for physical products); rename to `etsy_digital_studio`. ~3 hours.
**Path B: split into `etsy_digital_studio` + `dtc_ecommerce`** = 6-8 hours.
**Path C: keep merged + fix in place** = 10-12 hours.

Specific P0s either way:
- Fix Performance Analyst ghost — add agent OR reassign role
- Stripe → suggested (Etsy operators don't use it)
- DTC Shopify tool wiring (if keeping DTC)

### E1-12: `saas_product` (rank #12)
**Remaining P0s after Phase 0:**
- 4-agent shell expansion (or scope acknowledgment in description)
- Stripe tool wiring on CEO + Product Analyst
- PostHog/analytics suggested integration → add to `mcp-definitions.ts` if not present
- Webhook documentation now in Phase 0

**Fix-time:** ~6-8 hours (Path A — add Customer Success + Billing/Dunning agents) **OR ~3-4 hours** (Path B — keep at 4 agents and tighten).

### E1-13: `high_ticket_coaching` (rank #13)
**Remaining P0s after Phase 0:**
- CFO tool wiring (`send_email` + auto-attached Stripe via system prompt enumeration)
- Onboarding workflow trigger — add new workflow

**Fix-time:** ~3-4 hours.

### E1-14: `real_estate` (rank #14)
**Remaining P0s after Phase 0:**
- SMS tool wiring on Sales Agent — add `send_sms`, `whatsapp_send_text_message` to `tools[]` + system prompt update
- State compliance KB — add Fair Housing + state-specific disclosure compliance rules

**Fix-time:** ~3-4 hours.

### E1-15: `local_service` (rank #15)
**Remaining P0s after Phase 0:**
- Twilio metadata fix is in Phase 0 (B-6)
- SMS tool wiring on Sales & Booking + Reputation Manager

**Fix-time:** ~2-3 hours.

### E1-16: `service_business` (rank #16) — RECOMMEND RETIRE
**Path A (recommended): retire entirely.** ~1 hour (deprecate the template, update template selector copy).
**Path B: specialize hard** = ~6-8 hours.

If retiring: customers searching for "consulting / freelance" templates get redirected to `agency_creative` (when split) OR `high_ticket_coaching`.

### E1-17: `social_media_agency` (rank #17)
**Remaining P0s after Phase 0:**
- CEO `send_email` (P0-2 → wait, B-style bug; should be in Phase 0 batch — adding here for safety): add to CEO's `tools[]`
- Multi-client isolation — decision required (acknowledge limit OR build per-client KB scoping)
- AI video spend ceiling — already in Phase 0's spendCeilings

**Fix-time:** ~2-3 hours.

### E1-18: `skool_community` (rank #18)
**Remaining P0s after Phase 0:**
- CEO `send_email`
- Community Manager DM-vs-public-feed clarification (system prompt update — add the "do BOTH public post AND personal email" instruction)
- Operator paste-burden disclosure — add to setup checklist
- Stripe tools on Growth Specialist + CEO (P0 from Section C/18 — depends on E0-3 enumeration)

**Fix-time:** ~2-3 hours.

### E1-19: `business_builder` (rank #19) — RECOMMEND RETIRE
**Path A (recommended): retire and consolidate into `ghost_operator`.** ~1 hour.
**Path B: specialize** = ~6-9 hours.

If retiring: form-data-to-KB pipeline (E0-5) still benefits any future template that uses templateAnswers.

### Phase 1 totals
- **All in-place P0 fixes (assuming retirement decisions A on bifurcated/overlap templates):** ~40-50 hours
- **All in-place P0 fixes (path B on every decision):** ~70-80 hours
- **Per-template parallelizable** — Phase 1 work on tiktok_shop is independent of Phase 1 work on local_service, so this work can split across multiple worktrees / sessions.

---

## Phase 2 — Per-template P1 fixes (in ranked order)

P1s are quality issues — the template ships at S-tier without them but feels less premium. Same ranked order. Highlights only:

| Rank | Template | Top P1s |
|---:|---|---|
| 1 | tiktok_shop | model fallback (handled in E0-2), delegation language fix on specialists, avatar-bible enforcement at tool-call time |
| 2 | faceless_youtube | fal.ai version pinning via shared KB, multi-shot continuity enforcement, Compliance Officer routing |
| 3 | dealhawk_empire | telephony triad opinion (S-8), State Compliance Matrix enforcement at tool-call time, Off-Market scraper TOS rules |
| 4 | (forex retired) | — |
| 5 | tiptax | spend ceiling (handled in E0-4), workflow approval audit, deliverability monitor |
| 6 | ghost_operator | Discovery Conversation workflow, Tier-4 buyer-fit tightening, video stack cleanup (remove from VIDEO_PRODUCTION_TEMPLATES if going lean) |
| 7 | agency | multi-client isolation OR scope acknowledgment, marketing agent for agency-self-marketing, retainer billing workflow |
| 8 | local_lead_gen | spend ceiling on cold email, weekly Lead-Classification Audit workflow, GBP suspension auto-detection |
| 9 | content_creator | CEO tool wiring, Sponsor Hunter HubSpot wiring, Monetization Stacker Stripe wiring, beehiiv outage fallback |
| 10 | pinterest_traffic | spend ceiling on AI image gen, briefs-without-renders alert, social cross-post tools |
| 11 | ecommerce | (depends on split path) |
| 12 | saas_product | bug-to-engineering escalation workflow, GitHub tool wiring, Slack alerts |
| 13 | high_ticket_coaching | discovery transcription via Whisper, referral workflow, launch sequence workflow |
| 14 | real_estate | buyer-vs-seller journey KBs, referral cadence workflow, CRM wiring, social tools |
| 15 | local_service | commercial-vs-residential KBs, emergency dispatch differentiation, GBP monitoring, social wiring |
| 16 | (service_business retired) | — |
| 17 | social_media_agency | agency-self-marketing function, onboarding auto-trigger, approval-deadline tracking, HubSpot/Stripe wiring |
| 18 | skool_community | multi-cohort support, referral workflow, content moderation tooling |
| 19 | (business_builder retired) | — |

**Phase 2 fix-time:** ~30-40 hours total. Parallelizable per-template.

---

## Phase 3 — Polish (P2s + library-wide nice-to-haves)

**Polish only after Phase 0-2 ships.** P2s are real but can wait.

### Library-wide P3 work
- **S-6 Premium voice rubric** (3-4 hours) — rewrite voice on the 8 generic-voice templates (after retirements: ~6 templates remaining). Add AI-tells blacklist KB to each.
- **S-7 agentRole on every workflow** (1 hour, beyond E0-1's bug fix) — audit all workflows.
- **S-9 Dedup on workflow re-runs** (3-4 hours) — apply per workflow type.
- **P-1 to P-7 reusable primitives** (8-12 hours) — extract Compliance Officer base, Finance Analyst base, 12-week roadmap pattern, Outreach Manager base, Customer Service base. Refactor templates to use shared bases.
- **IC-1 to IC-7 integration consolidation** (4-6 hours) — pick CRM defaults, document cold-email engine choice, telephony opinion across the library.
- **Demo data seeding** (2-3 hours per template) — emulate dealhawk_empire's seed pattern in templates that benefit (tiktok_shop, faceless_youtube, content_creator, local_lead_gen).

### Per-template P2 work
Per ranked order, ~1-2 hours per template, mostly:
- Pre-seed example KB items
- Brand voice tightening
- Demo data seeding
- Workspace doc enhancements (CLIENT_LIFECYCLE / CASE_STUDY_QUEUE / similar trackers)

**Phase 3 fix-time:** ~30-40 hours total.

---

## Sequenced execution plan

**Recommended order (one operator working linearly):**

```
WEEK 1 (Phase 0 + early Phase 1):
  Day 1: E0-1 bug batch (all 10 bugs)
  Day 2: E0-2 model pinning library-wide + E0-3 system-prompt enumeration helper (build + test)
  Day 3: E0-3 application across all 19 templates + E0-4 spend-ceiling defaults
  Day 4: E0-5 form-data-to-KB + E0-6 webhook docs + E0-7 webhook handler audit/build
  Day 5: E1-1 + E1-2 + E1-3 (tiktok_shop, faceless_youtube, dealhawk_empire P0s)
  Day 6: E1-4 (forex retire, 15 min) + E1-5 (tiptax) + decisions on E1-7 (agency split path), E1-11 (ecommerce path), E1-16 (service_business retire), E1-19 (business_builder retire)

WEEK 2 (rest of Phase 1):
  Day 7-10: E1-6 through E1-19 in ranked order, retirements first (E1-16 + E1-19), then in-place fixes

WEEK 3 (Phase 2):
  P1 fixes per template in ranked order. Parallelizable across worktrees.

WEEK 4+ (Phase 3):
  Library-wide voice rewrites, reusable primitives extraction, integration consolidation, demo data seeding, per-template P2 polish.
```

**Parallelizable variant (if you have multiple workstreams):**
- Workstream A: Phase 0 (~17 hours)
- Workstream B (after Phase 0): Phase 1 templates 1-7 (~20 hours)
- Workstream C (after Phase 0): Phase 1 templates 8-19 (~25 hours)
- Workstream D (after Phase 1): Phase 2 + Phase 3

**Total wall-clock with one operator:** ~3-4 weeks of focused work.
**Total fix-time:** ~80-110 hours.
**Result:** Library-wide ship-ready state, with retirements simplifying the SKU lineup from 19 → ~16 templates.

---

## Decision points the operator needs to make before Phase 1

These block specific Phase 1 fixes:

1. **`forex_trading_desk` retire decision** — already confirmed in Section C/4. Phase 1 fix is a 15-minute change.
2. **`agency` template path** (split into 2 OR keep merged) — affects E1-7 fix-time.
3. **`ecommerce` template path** (split / specialize-to-Etsy / keep merged) — affects E1-11 fix-time.
4. **`saas_product` agent expansion** (add 2-3 specialists OR keep at 4) — affects E1-12 fix-time.
5. **`high_ticket_coaching` agent expansion** (similar decision) — affects E1-13 fix-time.
6. **`service_business` retire decision** — already recommended. Affects E1-16 fix-time.
7. **`business_builder` retire decision** — already recommended. Affects E1-19 fix-time.
8. **Multi-client isolation roadmap** — add per-client scoping infrastructure NOW (in Phase 0) or defer to Sprint 2? Affects agency, social_media_agency, content_creator.
9. **Whether to ship the Pinterest IMAGE_PRODUCTION_TEMPLATES set** — affects E1-10 fix.
10. **Whether to ship a generic webhook handler scaffold or build per-template routes** — affects E0-7 fix-time.

---

**Next message:** Section F — re-audit triggers. Send "go" if ready.


<!-- ============================================================ -->
<!-- Section F — Re-Audit Triggers (bonus content)  (transcript line 1066, 14296 chars) -->
<!-- ============================================================ -->

# Section F — Re-Audit Triggers

After fixes ship, when do you re-audit? Specific triggers tied to specific phases — not "re-audit when ready."

---

## F1. Post-Phase 0 Re-Audit Triggers (after foundations land)

These re-audits are **mandatory** before declaring Phase 0 complete.

### F1-1. After E0-1 (bug batch ships)
**Re-audit:** Phase 1 functional walkthrough on all 4 templates touched by bug fixes (`tiptax_affiliate_engine`, `ecommerce`, `local_lead_gen`, plus any template with corrected workflow frequency).
**What to verify:**
- `tiptax_affiliate_engine.primaryModel` is now non-empty and routes correctly through `getModelForAgent`
- Workflow `frequency` enum matches the description for B-2/B-3/B-4 fixes (run a test schedule, confirm cadence in cron logs)
- Performance Analyst ghost reference removed from `ecommerce` SKU_SCORECARD.md OR agent added to starterAgents
- `local_lead_gen` Contractor Outreach `tools[]` no longer contains `"hubspot_mcp"` as a tool name
**Pass criteria:** Zero ghost references, zero empty model fields, zero frequency mismatches across all 19 templates (run lint script, not spot check).

### F1-2. After E0-2 (universal model pinning ships)
**Re-audit:** Read every template's `primaryModel`, every agent's `model` override, every workflow step's model setting.
**What to verify:**
- All 19 templates have an explicit `primaryModel` that exists in `lib/ai/models.ts`
- No agent overrides reference a deprecated model ID
- No workflow step uses a hardcoded model string that bypasses `getModelForAgent`
**Pass criteria:** Grep for `model:` across all templates returns only known-valid IDs. Build a `validateAllTemplateModels()` script and add to CI.

### F1-3. After E0-3 (system-prompt tool enumeration helper ships)
**Re-audit:** Phase 1 functional walkthrough on **every one of the 19 templates** — this is the highest-leverage fix, must verify universally.
**What to verify:**
- Every agent's runtime system prompt now lists the actual tools `getToolsForAgent` returns
- Auto-attached `VIDEO_PRODUCTION_TEMPLATES` and `YOUTUBE_API_TEMPLATES` tools surface in the prompt for the 6 video templates and 3 YouTube templates respectively
- `BUILTIN_ALWAYS_ON` tools surface universally
- Spot-check 3 agents per template by asking them "what tools do you have?" — answer must match `getToolsForAgent` output exactly
**Pass criteria:** Sample 10 agents, ask the meta-question, get accurate enumeration in 10/10. If even one hallucinates tools or omits real ones, helper is broken.

### F1-4. After E0-4 (spend-ceiling config ships)
**Re-audit:** Phase 8 cost efficiency on the 5 highest-spend templates (`faceless_youtube`, `tiktok_shop`, `content_creator`, `social_media_agency`, `ghost_operator`).
**What to verify:**
- Each template has a configured monthly spend ceiling that surfaces in the dashboard
- Trigger a synthetic over-budget event — agent halts, user gets notified, no silent overspend
- Per-agent and per-workflow spend tracking matches actual API invoice line items (±5%)
**Pass criteria:** Manual spend simulation hits ceiling, halts gracefully, surfaces clear UI message.

### F1-5. After E0-5 (form-data-to-KB pipeline ships)
**Re-audit:** Phase 1 onboarding flow on all 19 templates.
**What to verify:**
- Onboarding form answers persist as KB entries the agents can reference
- `composeTemplateSystemPrompt` injects form-derived context into prompts
- New business creation produces agents that "know" the user's niche/brand/style without re-prompting
**Pass criteria:** Create a fresh business in each of 5 representative templates, ask the lead agent a niche-specific question, confirm it draws from form data.

### F1-6. After E0-6 + E0-7 (webhook standard + handler audit)
**Re-audit:** Phase 6 error handling on every template that uses webhooks (`tiktok_shop`, `ecommerce`, `local_lead_gen`, `agency`, `saas_product`, `service_business`, `social_media_agency`, `dealhawk_empire`, `pinterest_traffic`).
**What to verify:**
- Every webhook endpoint validates signatures before processing
- Failed webhook deliveries retry with exponential backoff
- Webhook payload schemas have Zod validation
- Replay attacks blocked (idempotency keys honored)
**Pass criteria:** Send malformed/unsigned payloads to every webhook endpoint — all rejected with proper error codes, none crash the agent runtime.

---

## F2. Post-Phase 1 Re-Audit Triggers (after per-template P0s land)

Per-template re-audits in the order Phase 1 fixes shipped.

### F2-1. After each E1-N ships
**Re-audit:** Full Phase 1-7 walkthrough on **that one template only** (don't re-audit the whole library every time).
**What to verify:** All P0 issues from Section C/N are resolved. P1s and P2s for that template still tracked but not blocking.
**Pass criteria:** Template's C-section gets a fresh write-up showing ✅ on every previously-flagged P0. Score improvement from baseline (the C/N rank position) by at least 1 tier.

### F2-2. After all 19 E1-N fixes ship (Phase 1 complete)
**Re-audit:** Section B re-rank — every template gets a fresh ship-readiness score.
**What to verify:** New ranking matches expected order (templates with more fixes should jump in rank). No regressions (a previously-better template now scoring worse means a fix broke something).
**Pass criteria:** All 19 templates score ≥ "ship to power users" tier. Any template still in "internal use only" tier blocks Phase 2.

### F2-3. After Phase 1 Week 1 templates ship (the top 5: `dealhawk_empire`, `tiktok_shop`, `ghost_operator`, `faceless_youtube`, `business_builder`)
**Re-audit:** Run a real-customer beta test on the top 5. Recruit 5 users, one per template, observe Phase 1 onboarding through Phase 5 first-week output.
**What to verify:** Real users can complete onboarding without support tickets. First-week outputs match the "premium" claim made on the marketing page.
**Pass criteria:** 5/5 beta users complete onboarding unassisted. 4/5 rate first-week output as "worth $147+" in exit survey.

---

## F3. Ongoing Re-Audit Triggers (post-launch, recurring)

These fire on a condition or cadence, not on a one-time fix.

### F3-1. When `lib/mcp/tool-registry.ts` changes (any commit touching the file)
**Re-audit:** Phase 2 integration health on every template that uses the changed MCP server.
**Trigger condition:** Git diff on `tool-registry.ts` shows added/removed/renamed tools, or `BUILTIN_ALWAYS_ON` / `VIDEO_PRODUCTION_TEMPLATES` / `YOUTUBE_API_TEMPLATES` Sets change.
**What to verify:** No template's `requiredIntegrations` or agent `tools[]` references a tool that no longer exists. No new BUILTIN tool conflicts with a template's expected behavior.
**Pass criteria:** Run `validateAllTemplateTools()` lint script in CI on every PR that touches tool-registry. Block merge on failure.

### F3-2. When a new MCP server is added to the registry
**Re-audit:** Survey all 19 templates — does any template's domain (e.g., e-commerce, lead gen, content) gain meaningfully from the new MCP?
**Trigger condition:** New `*_mcp` server registered in `lib/mcp/servers/`.
**What to verify:** Decide explicitly whether to add to `suggestedIntegrations`, `requiredIntegrations`, or skip per template. Document the decision in the template's owner-notes block.
**Pass criteria:** Every new MCP gets a routing decision logged within 7 days of registration. No "we'll figure out where this goes later."

### F3-3. When platform reality shifts (TikTok, Meta, Google, YouTube, Etsy, Shopify, etc. policy or API change)
**Re-audit:** Phase 1 functional walkthrough on every template that depends on the affected platform.
**Trigger condition:** Platform announces a policy change, deprecates an API, or changes pricing/limits/eligibility rules.
**Examples:**
- TikTok Shop changes Settlement tier thresholds → re-audit `tiktok_shop`
- YouTube Shorts monetization rules change → re-audit `faceless_youtube`, `content_creator`
- Meta deprecates an Instagram Graph API endpoint → re-audit `social_media_agency`, `ecommerce`, `tiktok_shop`
- GMV Max replaced or augmented by a new ad format → re-audit `tiktok_shop`
- Stripe changes payout cadence or KYC rules → re-audit any template with Stripe required
**What to verify:** All KB entries, agent prompts, workflow steps, and starter docs reflect current platform reality. Outdated tactics removed.
**Pass criteria:** Affected template's KB entries pass a "is this still true as of [today]?" date-stamp check. Stale entries either updated or marked deprecated.

### F3-4. When a new template is added to `BUSINESS_TEMPLATES`
**Re-audit:** Full Phase 1-8 audit on the new template using the same C/1-C/10 framework. Never ship a new template without an audit.
**Trigger condition:** PR adds a new entry to `BUSINESS_TEMPLATES` array.
**What to verify:** New template hits "ship to power users" tier minimum on the same rubric used for the existing 19.
**Pass criteria:** New template's C-section write-up exists, P0 list is empty before merge.

### F3-5. When agent count in any template changes by ≥2
**Re-audit:** Phase 5 output quality on that template. Adding or removing agents shifts who-does-what.
**Trigger condition:** Diff on a template's `starterAgents` adds/removes ≥2 agents.
**What to verify:** Workflows still route correctly (no orphaned steps pointing at deleted agents). New agents have non-overlapping responsibilities with existing ones. KB items updated to reference current roster.
**Pass criteria:** End-to-end workflow run produces output identical-or-better than pre-change. No "Agent not found" errors in logs.

### F3-6. Quarterly KB freshness audit (date-driven, not event-driven)
**Re-audit:** Every 90 days, review KB entries across all 19 templates for staleness.
**Trigger condition:** Calendar — first Monday of Feb, May, Aug, Nov.
**What to verify:** KB entries with date references (e.g., "as of 2025", "in Q4", "post-July 2025") are still current. Tactics that worked 6 months ago may be dead.
**Pass criteria:** Each template owner signs off that their KB is current. Stale entries get a `lastVerified` timestamp bump or get rewritten.

### F3-7. When a template moves from `visibility: "private"` to `"public"`
**Re-audit:** Full Phase 1-8 audit + Phase 7 premium polish deep-dive. Private templates skip a lot of polish; going public requires it.
**Trigger condition:** Template visibility flips.
**What to verify:** Onboarding copy, marketing assets, help docs, error messages all match the public-launch quality bar. Private-mode shortcuts (hardcoded emails, internal-only KB references) all removed.
**Pass criteria:** Template scores ≥ "ship to paid customers" tier in re-audit.

### F3-8. After a customer support ticket cluster (≥3 tickets in 7 days for one template)
**Re-audit:** Phase 6 error handling + Phase 1 functional walkthrough on the affected template.
**Trigger condition:** Support inbox shows ≥3 tickets referencing the same template, agent, or workflow within 7 days.
**What to verify:** The actual root cause from tickets is fixed, not just the symptom. Error message clarity improved if users were confused.
**Pass criteria:** Ticket volume for that template drops by ≥50% in the following 14 days.

### F3-9. When `materializeTemplate` or `composeTemplateSystemPrompt` logic changes
**Re-audit:** Phase 1 onboarding flow on a representative sample (1 from each of: simple service, e-commerce, content, agency, trading-style if any survive removal).
**Trigger condition:** Diff on `lib/templates/business-templates.ts` touching the helper functions, or on `app/api/admin/businesses/route.ts`.
**What to verify:** New business creation still produces correctly-configured agents. Addon selection still composes prompts correctly. No template breaks because of a helper-level refactor.
**Pass criteria:** 5-template sample creates fresh businesses, runs first workflow, produces expected output.

### F3-10. When pricing changes (despite "don't worry about price" being locked at start of audit)
**Re-audit:** Phase 7 premium polish on every template — the polish bar is set by price.
**Trigger condition:** A template's price changes by ≥20% in either direction.
**What to verify:** Polish, output quality, and integration depth match the new price point. A $147 template moved to $497 needs more polish; a $997 dropped to $497 may be over-polished and confusing.
**Pass criteria:** Template's C-section polish score matches the new price tier (low/mid/high).

---

## F4. What does NOT trigger a re-audit

Avoid re-audit fatigue. These changes do NOT require a fresh pass:
- Typo fixes in starter docs or KB
- Minor copy edits to agent prompts that don't change behavior
- Cosmetic UI tweaks in dashboard widgets
- Adding a new addon to a template (audit the addon itself, not the whole template)
- Single-MCP version bump if the tool surface is unchanged
- Adding a new business owner email to `ownerEmails` for private templates

If you find yourself re-auditing for these, the rubric is too tight.

---

## F5. Re-audit deliverable format

Every re-audit produces:
1. **A diff doc** — what changed in the template's C-section since the prior audit
2. **A pass/fail flag** — did the template clear its tier? Yes / No
3. **A list of new P0/P1/P2s** — if any (most re-audits should find few or none)
4. **An updated rank in Section B** — if the change affects ship-readiness ordering

Re-audits don't restart from scratch — they reference the prior C/N write-up as the baseline and only document deltas.

---

## Audit Complete

That's Sections A through F. The full audit covers:
- **A** — inventory of all 19 active templates
- **B** — ship-readiness ranking
- **C/1-C/19** — per-template deep dives
- **D** — library-wide findings
- **E** — sequenced fix plan (Phase 0 foundations, Phase 1 per-template P0s, Phase 2 P1s, Phase 3 polish)
- **F** — re-audit triggers (this section)

**Next steps — pick one:**
1. **Compile the full audit** into a single `Ghost_ProtoClaw_Library_Audit_2026-05.md` deliverable doc for reference
2. **Start executing Phase 0** with E0-1 (the bug batch — `tiptax` empty model, workflow frequency mismatches, ghost agent, hubspot_mcp tool name)
3. **Make the 10 decision points** from end of Section E before any fix work starts

Tell me which.
