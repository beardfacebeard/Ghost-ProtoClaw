# Library Integration Consolidation Reference

**Audit ref:** Section D / IC-1 through IC-7 of `Ghost_ProtoClaw_Library_Audit_2026-05.md`.

The library audit identified seven places where 2+ templates use different providers for the same job. This doc resolves each into the canonical decision the library now defaults to. Each template's `setupChecklistKb` references this canonical decision.

---

## IC-1 — CRM (HubSpot vs GoHighLevel)

**Pattern:** HubSpot suggested in 15 templates. GoHighLevel suggested in 2 (`agency`, `tiptax_affiliate_engine`). The agency template's setup checklist already bifurcates: HubSpot for traditional creative agencies, GHL for AI Automation Resellers.

**Decision:**
- **Default:** HubSpot Free tier ($0) for any operator running <500 contacts. Switch to HubSpot Starter ($45/mo) at 500–10,000 contacts.
- **Alternative path:** GoHighLevel for: (a) agency operators selling AI Automation Reseller productized offers (GHL's sub-account architecture maps cleanly to per-client isolation), (b) operators in lead-gen / wholesale-real-estate / contractor-rental verticals where GHL's call + SMS + pipeline + drip-automation bundling beats HubSpot's separated stack.
- **Operator picks at create time** via the setup checklist; the template's CRM tool wiring uses `hubspot_*` if HubSpot is installed and `ghl_*` if GoHighLevel is installed. Both are suggested integrations, not required.

**Affected templates:** All except `tiktok_shop` (closed-loop), `faceless_youtube` (sponsor pipeline only — HubSpot wins), and `dealhawk_empire` (deal pipeline lives in dealhawk-specific schema).

---

## IC-2 — Cold Email Engine (Smartlead vs Instantly vs Resend)

**Pattern:** Resend used everywhere as transactional. Instantly suggested in `agency` + `tiptax_affiliate_engine` + dealhawk-style outreach. Smartlead suggested in `agency` + `local_lead_gen`. Tiptax wires both Smartlead AND Instantly.

**Decision (canonical use):**
- **Resend** = transactional only (welcome emails, single-recipient confirmation, password resets, monthly client reports). NEVER use for cold-email-at-scale — Resend isn't built for warmup, multi-inbox sending, or reply-handling.
- **Instantly.ai** = cold-email-at-scale default. Multi-inbox sending, automated warmup, AI reply handling, $37/mo entry. Best for solo operators + small teams sending 100–2,000 cold emails/day.
- **Smartlead.ai** = premium alternative when paired with Clay enrichment for high-ticket B2B outreach (agency → enterprise, $5K+ AOV). $59/mo entry, deeper inbox-pool sophistication. Pick when Clay data drives personalization.
- **Domain warmup is non-negotiable** — every cold-email engine bundles a warmup tool; never bypass.

**Affected templates:** `agency`, `local_lead_gen`, `tiptax_affiliate_engine`, `dealhawk_empire` (Seller Outreach), `faceless_youtube` (Sponsor Hunter outreach).

---

## IC-3 — Telephony Triad (Twilio vs Telnyx vs WhatsApp Cloud)

**Pattern:** 7 templates suggest all three simultaneously. No template tells the operator which to pick.

**Decision:**
- **Twilio** = US-first SMS + voice default. Strongest A2P 10DLC compliance tooling. ~$0.0079/SMS in the US. Pick when the operator is US-based and wants fast time-to-first-text.
- **Telnyx** = ~50% cheaper than Twilio for the same SMS + voice capabilities. Pick when the operator is sending >2,000 SMS/month and the savings matter. Slightly steeper setup.
- **WhatsApp Cloud (Meta)** = international default + ANY operator whose buyers prefer WhatsApp (LATAM, India, MENA, EU, APAC). Free up to 1,000 service conversations/month. Pick when the operator's audience reaches you on WhatsApp before they reach you on SMS.
- **A2P 10DLC registration is mandatory** for any US business SMS via Twilio or Telnyx — failure = first SMS blast bounces 100%.
- **Pick ONE for primary outbound; the other two stay uninstalled** unless cross-channel routing actually matters.

**Affected templates:** `service_business`, `ghost_operator`, `high_ticket_coaching`, `real_estate`, `local_service`, `dealhawk_empire`, `local_lead_gen`, `tiptax_affiliate_engine`.

---

## IC-4 — Image Generation (fal.ai vs Midjourney vs OpenAI)

**Pattern:** `faceless_youtube` + `ecommerce` + `etsy_digital_studio` + `pinterest_traffic` reference fal.ai (Flux 1.1 Pro / Ideogram 3.0 / Kling). `tiktok_shop` + `social_media_agency` reference Midjourney + Canva + OpenArt operator-side.

**Decision:**
- **fal.ai** = library-wide default. Single API key, 600+ models, pay-per-use. Pinned model versions in `faceless_youtube`'s "fal.ai + Replicate + ElevenLabs version pin reference" KB — every template referencing fal.ai uses those pins.
- **Midjourney** = operator-side ONLY. No official API. Don't use third-party Midjourney aggregators — TOS violation, ban risk. Operator runs Midjourney externally and uploads outputs to brand assets when needed.
- **OpenAI DALL-E / Sora** = inference-cost prohibitive at scale. Avoid except for one-off prototypes where fal.ai's Flux + Ideogram families don't fit.
- **OpenArt** = operator-side avatar bible builder for `tiktok_shop` AI UGC pipeline. Not API-driven; lives in the operator's playbook, not the agent's tool stack.

**Affected templates:** `faceless_youtube`, `ecommerce`, `etsy_digital_studio`, `pinterest_traffic`, `tiktok_shop`, `social_media_agency`.

---

## IC-5 — Community Platforms (Skool vs Circle vs Discord)

**Pattern:** `skool_community` uses Skool. `high_ticket_coaching` mentions all four (Skool / Circle / Slack / Discord). None have first-party MCPs. All operator-paste-driven.

**Decision:**
- **No first-party MCPs exist for any community platform as of 2026.** Templates that touch communities must say so explicitly — agents DRAFT community-feed posts AND personal emails simultaneously; operator pastes the public post into the platform; the personal email ships through Resend.
- **Roadmap:** Skool + Circle + Discord MCPs share a "post + read + DM + member-data" surface. When implemented, build all three together rather than one-at-a-time.
- **Until then:** every template that touches communities standardizes the disclaimer: "no community-platform MCP wired — DRAFT both public + personal outputs."

**Affected templates:** `skool_community` (canonical), `high_ticket_coaching`, anywhere a "community" appears in the operator's stack.

---

## IC-6 — Newsletter Platforms (Beehiiv vs Substack vs Kit vs Ghost)

**Pattern:** `content_creator` originally hardcoded Beehiiv as required. Other templates (`faceless_youtube`'s email list, `ghost_operator`'s email funnel) don't pin a platform.

**Decision (post-E1-9 fix):**
- `beehiiv_mcp` is now `suggested`, not `required` (operators on Substack / Kit / ConvertKit / Ghost are no longer locked out).
- **Roadmap:** Substack / Kit / Ghost MCPs share a "draft + send + analytics + subscriber-list" surface. When implemented, build all four together with a unified `newsletter_mcp` interface.
- **Until then:** Resend handles transactional + welcome flows for all newsletter operators regardless of platform; operator manages their actual newsletter platform (drafts via copy-paste from agent output, scheduling in their platform's UI).

**Affected templates:** `content_creator`, `faceless_youtube`, `ghost_operator`, `high_ticket_coaching` (cohort emails).

---

## IC-7 — Payments (Stripe vs Shopify vs Etsy Payments)

**Pattern:** Original `ecommerce` template required Stripe — but Etsy operators use Etsy Payments and Shopify operators use Shopify Payments natively.

**Decision (post-E1-11 split):**
- **`etsy_digital_studio`** — Etsy Payments handles checkout. Stripe is suggested only if the operator runs a parallel Shopify / Gumroad. Resend stays required.
- **`ecommerce` (DTC + hybrid)** — Stripe is suggested (not required). Operators using Shopify default to Shopify Payments; operators on Stripe-direct or with custom checkout opt in.
- **`tiktok_shop`** — Stripe required ONLY when the Organic Ladder addon is enabled (off-platform digital products). TikTok Shop Settlement Reports are the closed-loop revenue source for the core template.
- **`faceless_youtube`, `content_creator`** — Stripe suggested only at the digital-products / SaaS-funnel monetization tier. AdSense / sponsorships / affiliates run without it.
- **`high_ticket_coaching`, `skool_community`, `saas_product`** — Stripe REQUIRED. Premium-program payment flows depend on it.

**Affected templates:** `ecommerce`, `etsy_digital_studio`, `tiktok_shop`, `faceless_youtube`, `content_creator`, `high_ticket_coaching`, `skool_community`, `saas_product`.

---

## How templates reference this doc

Every template's `setupChecklistKb.summary` ends with: *"For library-wide integration choices (CRM / cold email / telephony / image-gen / community / newsletter / payments), see `docs/library-integration-consolidation-2026-05.md`."*

When an operator opens the setup checklist for any template, they get the template-specific guidance plus a link to this doc for cross-cutting decisions.

---

## Update protocol

This doc is reviewed quarterly (first Monday of Feb / May / Aug / Nov per the audit's F3-6 trigger). Any new MCP added to the library forces an update + decision: where does it fit in the canonical stack vs which existing provider does it replace.
