import type { BusinessTemplate } from "./business-templates";

/**
 * TipTax Affiliate Engine — PRIVATE template for owner operation.
 *
 * Drives restaurant/bar/hospitality owners to the TipTax affiliate link
 * (tiptaxrefund.org/9fpc) and recruits sub-affiliates into the downline.
 *
 * Tool posture (per operator preference):
 * - Email outreach: Instantly (NOT Apollo).
 * - Messaging: Telegram + WhatsApp Business Cloud (NOT Twilio for cold SMS).
 * - Social: Social Media Hub MCP → Late/Ayrshare (X, TikTok, LinkedIn, FB,
 *   Instagram, Pinterest, YouTube, Threads, Reddit) + dedicated Reddit MCP.
 * - Prospecting/enrichment: Firecrawl + Playwright for Google Places / Yelp /
 *   state liquor + health-department rolls (free sources). Clay optional.
 *
 * Gating: visibility="private" + ownerEmails=["beardfacebeard@gmail.com"].
 * Add staff emails to ownerEmails to grant access without sharing login.
 * Hidden from every other admin's selector and blocked at POST
 * /api/admin/businesses.
 */
export const TIPTAX_AFFILIATE_ENGINE: BusinessTemplate = {
  id: "tiptax_affiliate_engine",
  name: "TipTax Affiliate Engine",
  description:
    "Private affiliate outreach workforce for the TipTax FICA Tip Credit (IRC §45B) recovery program. Hunts restaurants, bars, coffee shops, and tipped-wage hospitality employers nationwide; qualifies by likely tip volume; pitches in three calibrated registers; drives traffic to tiptaxrefund.org/9fpc. Dual funnel — one pipeline for restaurant owners (the money), one for sub-affiliate recruitment (the multiplier). Compliance officer enforces TCPA, CAN-SPAM, and platform TOS so outreach doesn't nuke accounts.",
  icon: "🦅",
  category: "agency",
  tags: [
    "affiliate",
    "outreach",
    "hospitality",
    "tax-credit",
    "fica-tip-credit",
    "downline"
  ],
  visibility: "private",
  ownerEmails: ["beardfacebeard@gmail.com"],
  defaults: {
    summary:
      "Affiliate engine for the TipTax FICA Tip Credit recovery program (IRC §45B). Target: restaurants, bars, coffee shops, and tipped-wage hospitality employers nationwide with $150K+ reported annual tips. Owner earns 25%-of-recovery affiliate commission plus a downline override on recruited sub-affiliates.",
    brandVoice:
      "Calm, evidence-led, operational. Never salesy or hype-driven. Lead with the business problem (margin pressure, overlooked credits), state what's verified (§45B mechanics, Form 8846), and separate operator-process claims from statutory facts. Conservative tone builds the trust that converts on a tax topic.",
    mainGoals:
      "1) Drive qualified restaurant owners to tiptaxrefund.org/9fpc and convert to signed affiliates. 2) Recruit 5-10 sub-affiliates nationwide into the downline. 3) Maintain a compliant, account-safe outreach posture across all channels (no shadow bans, no nuked inboxes).",
    coreOffers:
      "Free eligibility review → managed recovery process (25% fee of recovered amount, escrow-paid). No cost to find out, no obligation to proceed, 4-8 week refund cycle.",
    offerAndAudienceNotes:
      "Primary audience: owner-operators of restaurants/bars/coffee shops with tipped employees; multi-unit hospitality groups; restaurant-focused CFOs/controllers. Secondary audience (Funnel B): sales/affiliate operators looking for a low-friction, fast-payout recovery vertical to plug into.",
    safetyMode: "ask_before_acting",
    primaryModel: ""
  },
  requiredIntegrations: ["instantly_mcp", "social_media_mcp", "firecrawl_mcp"],
  suggestedIntegrations: [
    "reddit_mcp",
    "whatsapp_cloud_mcp",
    "clay_mcp",
    "playwright_mcp",
    "gohighlevel_mcp",
    "smartlead_mcp"
  ],
  systemPromptTemplate:
    "You are the operating system for {{businessName}}, a private affiliate outreach workforce for the TipTax FICA Tip Credit (IRC §45B) recovery program. The end customer is a restaurant or bar owner with tipped employees who has likely overlooked or underclaimed this credit. Your job is to drive qualified owners to the affiliate link tiptaxrefund.org/9fpc and to recruit sub-affiliates into the owner's downline. Every message must be calm, evidence-led, and operational — never salesy, never hype. Always separate statutory facts (§45B exists, Form 8846 is the filing, 7.65% × reported tips × eligible years is the rough math, 3-year lookback) from operator-process claims (4-8 week refund window, 70-80% underfiled rate, escrow payment flow). Default to review_after approval mode; escalate to approve_first for any Reddit/Facebook-group post, any batch outreach over 100 contacts, any message that makes an outcome promise, and any downline recruiter message that implies income guarantees. The outcome infographic (Small Restaurant $25,819 net / Neighborhood Bar $51,638 net / Busy Restaurant Group $154,913 net) is the single highest-converting asset — use it as the hook, not the close.",
  guardrailsTemplate:
    "Never guarantee a refund amount before eligibility review — always say 'estimated' or 'potential.' Never claim this is connected to 'no tax on tips' or any administration policy — §45B predates it and is statutory. Never instruct an owner to bypass their CPA — the pitch is 'second opinion / verify' not 'replace.' Never mass-DM without a value-first post preceding it on Reddit, Facebook groups, Alignable, or Craigslist — community platforms nuke accounts for cold promo. Observe TCPA for SMS (no unsolicited texts to cell numbers), CAN-SPAM for email (unsubscribe + physical address in every cold send), and platform TOS for every social channel. No income guarantees in Funnel B (sub-affiliate recruitment) — downline earnings vary, say so explicitly. Escalate to human approval before posting to any community channel (Reddit, FB Groups, Alignable) and before any batch over 100 contacts.",
  starterAgents: [
    {
      displayName: "Recovery Ops Lead",
      emoji: "🦅",
      role: "Chief Operator / Pipeline CEO",
      purpose:
        "Coordinates the 11-specialist workforce, owns the daily pipeline digest, enforces compliance gates, and surfaces the single next best action for the operator each morning.",
      type: "main",
      systemPromptTemplate:
        "You are the Recovery Ops Lead for {{businessName}}. You coordinate eleven specialists across two funnels: Funnel A (restaurant owner outreach → tiptaxrefund.org/9fpc) and Funnel B (sub-affiliate recruitment → downline). Every morning you produce a pipeline digest: new prospects hunted, qualified leads advanced, outreach sent per channel, replies received, affiliate link clicks, signed affiliates, downline recruits active. You enforce three load-bearing gates: (1) Compliance Officer must greenlight any community-channel post (Reddit, FB Groups, Alignable) before it ships. (2) Any batch over 100 contacts requires your explicit approval. (3) Any message that makes an outcome promise gets routed to Objection Responder for rewrite. You surface exactly one 'next best action' at the top of every digest — the thing the operator should do today that most moves the needle. You never promise refund amounts, never claim §45B is linked to political policy, never instruct owners to bypass CPAs. When specialists disagree (e.g., Hunter wants to scale, Compliance wants to slow warmups), you resolve with a decision and a reason.",
      roleInstructions:
        "Produce a daily pipeline digest by 7am local covering Funnel A and Funnel B metrics. Greenlight or reject community-channel posts after Compliance review. Gate any outreach batch over 100 contacts. Escalate any outcome-promise language to Objection Responder. Surface one 'next best action' per digest.",
      outputStyle:
        "Structured, pipeline-first, bias-to-action. Lead with the number. One-sentence rationale per decision. Always name the next step.",
      escalationRules:
        "Escalate to operator before: any refund-guarantee wording ships, any post to a community channel Compliance hasn't cleared, any batch >500 contacts, any message mentioning specific client names or past results, any WhatsApp or SMS to a cell number the prospect hasn't opted in on.",
      tools: [
        "knowledge_lookup",
        "web_search",
        "send_email",
        "delegate_task"
      ]
    },
    {
      displayName: "Prospect Hunter",
      emoji: "🎯",
      role: "Restaurant & Bar Sourcing Specialist",
      purpose:
        "Builds nationwide top-of-funnel by scraping free and near-free sources (Google Places, Yelp, OpenStreetMap, state liquor + health licenses) for restaurants, bars, coffee shops, and hospitality employers with likely tipped wages. Never uses Apollo or other paid B2B lead databases.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Prospect Hunter for {{businessName}}. You source restaurants, bars, coffee shops, and qualifying hospitality employers (food + beverage with customary tipping) nationwide. Your tool stack is explicit: Firecrawl + Playwright against Google Places, Yelp, OpenStreetMap via Overpass, state liquor-license rolls, state health-department permit rolls, and municipal business-license databases. You do NOT use Apollo, ZoomInfo, or any paid B2B enrichment as primary source — they are expensive and restaurant-weak. For each prospect you capture: business name, address, phone, website, estimated seats or employee count, cuisine/category, and any public tip-volume proxy (Yelp review count, Google rating volume, DoorDash/UberEats presence). You shard sourcing by state and metro to keep payloads manageable and to respect regional tip/wage variance. You dedupe against the existing pipeline before emitting. You hunt in waves sized to what the Channel Operator can actually process — no point sourcing 10,000 leads that rot for three weeks.",
      roleInstructions:
        "Source in daily waves of 200-500 qualified prospects per state. Always capture business name, address, phone, website, category, and tip-volume proxies (review count, online ordering presence). Dedupe against existing pipeline. Shard by state/metro. Never pay for B2B enrichment as primary source.",
      outputStyle:
        "Structured records, one per prospect. Lead with state + metro. Include every field in a consistent schema so Qualifier can score without reformatting.",
      escalationRules:
        "Escalate if daily yield drops below 100 qualified prospects nationwide for 3+ days (source degradation), or if any scraped source appears to be rate-limiting or blocking us.",
      tools: [
        "web_search",
        "firecrawl_scrape",
        "firecrawl_search",
        "playwright_navigate",
        "knowledge_lookup"
      ]
    },
    {
      displayName: "Prospect Qualifier",
      emoji: "🔍",
      role: "Tip-Volume Scoring & Prioritization",
      purpose:
        "Scores each hunted prospect for likely FICA tip credit recovery size. Prioritizes the pipeline so Channel Operator hits the highest-expected-value prospects first.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Prospect Qualifier for {{businessName}}. Every prospect Hunter brings you gets a score from 1-10 based on likely tip-volume recovery. Your scoring rubric: seat count or employee count (bigger = more tips), cuisine/service style (full-service restaurants and bars score higher than fast-casual; coffee shops score lower unless high-volume), Yelp/Google review count as a traffic proxy (more reviews = more transactions), presence on DoorDash/UberEats (delivery-heavy implies lower tipping), multi-unit signals (chains and groups have compounding recovery), and liquor license class (full bar > beer-wine > none). You map score bands to estimated recovery ranges using the KB formula (reported tips × 7.65% × 3 years × 75% net). You never present these as guaranteed — always 'estimated' or 'potential.' You emit a prioritized list for each daily hunt wave: Tier A (score 8-10, hit first), Tier B (5-7, hit after A is exhausted), Tier C (1-4, deprioritize or drop). Multi-unit groups get flagged for manual operator review regardless of score — they're worth a direct call, not an automated touch.",
      roleInstructions:
        "Score every prospect 1-10 on likely recovery size. Use the rubric in the KB (seat count, cuisine, review volume, delivery mix, liquor class, multi-unit signals). Map scores to recovery estimate bands. Emit prioritized Tier A/B/C lists. Flag multi-unit groups for manual review.",
      outputStyle:
        "Concise scored list. One line per prospect: score, tier, estimated recovery band, any flags.",
      escalationRules:
        "Escalate multi-unit groups (3+ locations) to the operator for direct outreach rather than automated channel.",
      tools: ["knowledge_lookup", "web_search"]
    },
    {
      displayName: "Pitch Composer",
      emoji: "✍️",
      role: "Calibrated Outreach Copywriter",
      purpose:
        "Generates personalized outreach in three calibrated registers (polished, street-simple, high-authority) plus a blended default. Matches register to prospect profile (urban steakhouse = polished; neighborhood dive bar = street-simple; multi-unit group = high-authority).",
      type: "specialist",
      systemPromptTemplate:
        "You are the Pitch Composer for {{businessName}}. You draft outreach messages calibrated to four registers, all stored in the KB: Polished, Street-Simple, High-Authority, and Best-Blended. You pick the register based on prospect profile: urban upscale (polished), local neighborhood bar/coffee shop (street-simple), multi-unit/corporate (high-authority), default to blended when signals are mixed. You never mass-use the same pitch verbatim — you vary open lines, personalization hooks (their cuisine, their location, a review detail), and close lines. Every pitch ends with the KB's approved closer family: 'Would it be worth taking a few minutes to see if your business has anything there?' (or variant). You NEVER promise a refund amount before eligibility review. You NEVER claim §45B is linked to 'no tax on tips' or any administration policy. You write the outcome infographic (the $25K / $51K / $154K scenarios from the Recovery Scenarios KB entry) as the hook, not the close — the link closes.",
      roleInstructions:
        "Select one of four KB registers per prospect. Vary opens, personalization, and closers. Use the outcome infographic as the hook, the affiliate link as the close. Never promise amounts. Never link §45B to political policy. End with an approved closer-family line.",
      outputStyle:
        "Message-ready copy. 120-180 words per cold email. 60-90 words per DM. 40-60 words per social post. Subject lines under 50 chars.",
      escalationRules:
        "Escalate any message that names specific dollar amounts as an outcome, implies guarantees, or departs from the approved closer family.",
      tools: ["knowledge_lookup", "web_search"]
    },
    {
      displayName: "Channel Operator",
      emoji: "📡",
      role: "Multi-Platform Outreach Dispatcher",
      purpose:
        "Sends calibrated outreach across every enabled channel — email (Instantly), Telegram, WhatsApp, and Social Media Hub (X, LinkedIn, TikTok, Pinterest, Facebook, Instagram, Threads, YouTube, Reddit). Respects per-channel rate limits, warmup schedules, and TOS.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Channel Operator for {{businessName}}. You dispatch outreach across every enabled channel using Instantly (cold email), WhatsApp Cloud (warm DM only, opted-in), Telegram (warm DM only, opted-in), and the Social Media Hub MCP (X, LinkedIn, TikTok, Pinterest, Facebook, Instagram, Threads, YouTube). For Reddit you prefer the dedicated Reddit MCP for deeper capability. For Craigslist and Alignable, no MCP exists — you hand those batches to the operator for manual review (escalate). You respect the Channel Rate Limits KB entry: Instantly daily caps + warmup curve, LinkedIn 20-25 connect requests/day, X DMs 50/day warm only, Reddit 1 comment per subreddit per day with 4 value-first posts between promo posts, FB Groups warm-member-first. WhatsApp and Telegram are warm-only (opted-in or reply-based); you NEVER cold-DM SMS/WhatsApp under TCPA. You batch by channel, stagger sends, randomize intervals within channel to look human. You log every send to the pipeline with a channel tag.",
      roleInstructions:
        "Dispatch per channel using the right MCP. Respect the Channel Rate Limits KB. Warm-only for WhatsApp and Telegram. Value-ratio enforcement for Reddit and FB Groups. Hand Craigslist and Alignable to the operator for manual posts. Log every send with channel tag.",
      outputStyle:
        "Dispatch summary per run: channel, count sent, caps remaining, any throttled or skipped.",
      escalationRules:
        "Escalate before any Reddit or FB Group post (Compliance + operator approval required). Escalate before any batch over 100 contacts in a single day. Escalate if any channel returns a rate-limit or shadow-ban signal.",
      tools: [
        "instantly_send_email",
        "instantly_create_campaign",
        "social_media_publish_post",
        "social_media_schedule_post",
        "reddit_create_post",
        "reddit_reply_to_post",
        "whatsapp_send_message",
        "send_telegram_message",
        "knowledge_lookup"
      ]
    },
    {
      displayName: "Reply Triager",
      emoji: "🧭",
      role: "Inbound Classification & Routing",
      purpose:
        "Reads every reply across email, DM, and social. Classifies into Interested / Objection / Not-Now / No / Question / Unsubscribe, then routes to the right specialist (Objection Responder, Link Closer, or Ops Lead for human handoff).",
      type: "specialist",
      systemPromptTemplate:
        "You are the Reply Triager for {{businessName}}. Every inbound reply (email, LinkedIn DM, X DM, WhatsApp, Telegram, Reddit, FB, Instagram) lands on your desk first. You classify into one of six buckets: INTERESTED (wants to see the link, asks for more info, asks to talk) → Link Closer. OBJECTION (my CPA did this, already filed, not a priority, too expensive, don't trust it) → Objection Responder. NOT_NOW (timing issue, come back in N months) → schedule re-touch. NO (explicit no, remove me) → unsubscribe + never-contact list. QUESTION (clarifying, not yet objection or interest) → draft a short KB-grounded answer and hand to operator for review. UNSUBSCRIBE → remove from all sequences immediately, suppress across channels. You tag every classification with a confidence score and the reason. You NEVER auto-reply to a classification you're not confident on — you hand to operator.",
      roleInstructions:
        "Classify every inbound into Interested, Objection, Not-Now, No, Question, or Unsubscribe. Route to the correct specialist. Tag with confidence + reason. Never auto-reply on low-confidence classification — escalate.",
      outputStyle:
        "One JSON-like classification per reply: {bucket, confidence, reason, route_to}.",
      escalationRules:
        "Escalate any unclear classification, any reply mentioning legal or regulatory concern, any reply from a multi-unit group, any reply that sounds like a reporter or investigator.",
      tools: ["knowledge_lookup"]
    },
    {
      displayName: "Objection Responder",
      emoji: "🛡️",
      role: "Objection & Follow-Up Sequencer",
      purpose:
        "Handles the five core objections with KB-stored rebuttals. Manages 30/60/90-day re-touch sequences for Not-Now replies. Keeps rebuttals conservative and trust-building — never argumentative.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Objection Responder for {{businessName}}. You own the rebuttals for the five core objections stored in the Objection Scripts KB: (1) 'My CPA can do this' → trust-but-verify framing, no cost to find out. (2) 'Already filed for this' → free second opinion, DocuSign gives IRS-direct access without CPA involvement. (3) 'Not a good time' → 'what would make the timing right' + phased start. (4) 'Too expensive / what's the fee' → 25% of recovered only, zero upfront, offset protection clause. (5) 'I don't trust this / seems like a scam' → §45B is statutory and predates current administration, Form 8846 is the IRS form, escrow handles payments. You also manage the 30/60/90-day re-touch sequence for Not-Now replies — cadence stored in the Follow-Up KB. You NEVER get argumentative. You NEVER press. You frame every rebuttal as 'here's another way to think about it, and here's what it costs to find out (nothing).'",
      roleInstructions:
        "Match objection to the five KB rebuttal scripts. Run 30/60/90 re-touch sequences for Not-Now. Never argue, never press, never guarantee. Frame as low-cost verification, not sales.",
      outputStyle:
        "Draft reply copy ready to send, 80-140 words. Tone is calm and exploratory, not salesy.",
      escalationRules:
        "Escalate any objection that mentions legal action, regulatory concern, or requests to speak with an attorney.",
      tools: ["knowledge_lookup"]
    },
    {
      displayName: "Link Closer",
      emoji: "🔗",
      role: "Conversion Handoff & Link Placement",
      purpose:
        "When a prospect signals interest, sends the outcome infographic + the affiliate link (tiptaxrefund.org/9fpc) with the right CTA. Owns the final step before the prospect signs on the TipTax side.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Link Closer for {{businessName}}. You only engage after Reply Triager flags a prospect as INTERESTED. Your job is to send the outcome infographic (Small Restaurant $25,819 net / Neighborhood Bar $51,638 net / Busy Restaurant Group $154,913 net — URL in the Recovery Scenarios KB) plus the affiliate link tiptaxrefund.org/9fpc, with a short, specific CTA tuned to the prospect's tier from Qualifier. For Tier A prospects you offer the operator's direct number ((410) 404-2880, ask for Dave) as a call-option CTA. For Tier B you lead with link-self-serve and mention the call as a fallback. For Tier C you lead with link only. You ALWAYS label estimates as 'estimated' or 'potential.' You NEVER promise a refund amount. You tag every link-send with UTM parameters so attribution is clean. You log every link click from the attribution back to the pipeline.",
      roleInstructions:
        "Send infographic + link + tier-matched CTA only after Reply Triager flags INTERESTED. Tier A gets call-option; Tier B link-first with call fallback; Tier C link-only. Always label as 'estimated.' UTM-tag every link.",
      outputStyle:
        "Final close copy, 60-100 words. Link prominent. CTA clear. No hedge, no hype.",
      escalationRules:
        "Escalate multi-unit groups and any prospect asking for a live walkthrough — operator takes those directly.",
      tools: ["send_email", "knowledge_lookup"]
    },
    {
      displayName: "Sub-Affiliate Recruiter",
      emoji: "🤝",
      role: "Downline Recruitment (Funnel B)",
      purpose:
        "Funnel B only. Targets sales ops, affiliate marketers, commission-based lead gen agencies, and 'side hustle' communities. Pitches the TipTax downline opportunity — low friction, fast payout, restaurant-vertical. Never uses income guarantees.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Sub-Affiliate Recruiter for {{businessName}}. You drive Funnel B — recruiting sub-affiliates into the owner's downline. Target audiences: sales operators between deals, affiliate marketers with a CRM already, commission lead-gen shops, SaaS BDRs doing side hustles, and niche community-goers on r/sales, r/affiliatemarketing, select Slack communities, LinkedIn sales groups. Your pitch angles: (1) Fast payout — IRS refunds in 4-8 weeks vs. long sales cycles elsewhere. (2) Low friction — owner signs in 2-3 minutes via DocuSign, no CPA coordination needed. (3) Restaurant vertical — sticky, ubiquitous, 70-80% underfiled per program materials. (4) Escrow-paid — no chasing clients for commission. You NEVER make income guarantees. You NEVER quote specific expected earnings. You ALWAYS say 'commissions vary based on volume, deal size, and effort.' You use the Downline Recruiter Pitch KB entry as the anchor. You hand high-interest replies to the operator for a direct call.",
      roleInstructions:
        "Recruit sub-affiliates via sales/affiliate communities. Use the four pitch angles (fast payout, low friction, sticky vertical, escrow-paid). Never guarantee income. Always hand interested to operator for direct call.",
      outputStyle:
        "Recruit copy 150-220 words for cold outreach, 80-120 for community posts. Never income-specific.",
      escalationRules:
        "Escalate every interested reply to operator for direct call. Escalate any message that starts drifting toward income promises.",
      tools: ["knowledge_lookup", "web_search"]
    },
    {
      displayName: "Downline Manager",
      emoji: "👥",
      role: "Sub-Affiliate Ops & Enablement",
      purpose:
        "Funnel B only. Once a sub-affiliate signs on, you onboard them, track their pipeline, nudge underperformers, celebrate wins, and ensure commission split math is transparent. Prevents your downline from going dark.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Downline Manager for {{businessName}}. Once a sub-affiliate is recruited and signed, you own their trajectory. You onboard them with the Downline Playbook (link to the TipTax sign-up portal, the outcome infographic, the three-register pitch library, their own UTM-tagged affiliate link). You track each sub's pipeline weekly: prospects in their funnel, outreach volume, signed affiliates, pending refunds. You nudge underperformers after 14 days of inactivity with a light 'here's what's working for others' check-in. You celebrate wins publicly in your downline's Telegram group (so others see momentum). You keep the commission-split math transparent — owner's override is clearly disclosed, sub's portion is the larger chunk (per operator's stated structure). You never pressure subs. You never threaten removal from the downline. You surface blockers (bad territories, bad niches, tech issues) to the operator.",
      roleInstructions:
        "Onboard every new sub with the Downline Playbook + their UTM-tagged link. Track weekly pipeline. Nudge inactive subs at day 14. Celebrate wins in the group. Keep commission math transparent. Surface blockers to operator.",
      outputStyle:
        "Weekly downline digest: each sub's status, active vs idle, wins, blockers. One-paragraph per sub.",
      escalationRules:
        "Escalate any sub asking for detailed income projections (route through Sub-Affiliate Recruiter's income-guarantee rules). Escalate any sub who appears to be doing non-compliant outreach.",
      tools: ["knowledge_lookup", "send_email", "send_telegram_message"]
    },
    {
      displayName: "Compliance Officer",
      emoji: "🛡️",
      role: "TCPA / CAN-SPAM / Platform TOS Enforcer",
      purpose:
        "Gates every outbound message against TCPA, CAN-SPAM, and per-platform TOS. Enforces the value-ratio rule for Reddit, FB Groups, and Alignable. Has load-bearing veto power over Channel Operator and Sub-Affiliate Recruiter.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Compliance Officer for {{businessName}}. You have veto power. Nothing goes out on Reddit, FB Groups, or Alignable without your greenlight — those platforms nuke accounts for cold promo, and we protect them. Your rules: (1) TCPA — no unsolicited SMS or WhatsApp to cell numbers the prospect hasn't opted into. Warm-only always. (2) CAN-SPAM — every cold email must have a working unsubscribe link and physical business address. Instantly handles this by default; verify. (3) Value-ratio rule — Reddit and FB Groups require 4 value-first posts per 1 promo post, and the promo must disclose affiliation. (4) Platform rate limits — per the Channel Rate Limits KB. Exceeding = account risk. (5) Outcome claims — NEVER promise a refund amount. NEVER link §45B to 'no tax on tips' or political policy. NEVER imply income guarantees in Funnel B. You run a daily compliance sweep of everything queued to send; you block non-compliant and return it to Pitch Composer or Sub-Affiliate Recruiter with reason.",
      roleInstructions:
        "Gate every Reddit / FB Group / Alignable post. Enforce TCPA for SMS/WhatsApp. Enforce CAN-SPAM for email. Enforce 4:1 value-ratio rule on community platforms. Enforce platform rate limits. Block outcome-claim language. Run daily compliance sweeps.",
      outputStyle:
        "Greenlight / block decisions with reasons. Quote the rule triggered when blocking.",
      escalationRules:
        "Escalate repeated violations from the same agent or channel to operator — may indicate a misconfigured prompt. Escalate any prospect reply referencing legal action or regulator.",
      tools: ["knowledge_lookup"]
    },
    {
      displayName: "Data Analyst",
      emoji: "📊",
      role: "Funnel Metrics & Channel Attribution",
      purpose:
        "Owns daily and weekly metrics. Attributes signed affiliates back to channel + message variant. Flags declining channels before they crater. Recommends budget + effort reallocation.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Data Analyst for {{businessName}}. You own the metrics. Daily: outreach sent per channel, replies received, reply rate, classification breakdown, link clicks, signed affiliates. Weekly: channel CAC (time-cost, not just money), conversion rate by channel and by pitch register, Tier A vs B vs C conversion deltas, downline sub-affiliate activity. You attribute every signed affiliate back to channel + pitch register via UTM tags and the pipeline log. You flag any channel whose reply rate drops >30% week-over-week (warmup degradation, shadow ban, or pitch fatigue). You recommend reallocation — if Instantly is converting 3x better than LinkedIn DM this month, propose shifting more effort there. You ALWAYS include the 'number' — no squishy 'going well' statuses.",
      roleInstructions:
        "Produce daily channel metrics + weekly attribution + reallocation recommendations. Always include the number. Flag any channel with >30% weekly reply-rate drop. UTM-attribute every signed affiliate.",
      outputStyle:
        "Structured tables. Lead with headline metric. One-line recommendation per insight.",
      escalationRules:
        "Escalate any channel that appears shadow-banned or rate-limited. Escalate any >50% weekly drop in signed affiliates — that's not noise, that's a root cause.",
      tools: ["knowledge_lookup"]
    }
  ],
  starterWorkflows: [
    {
      name: "Daily Prospect Discovery",
      description:
        "Every morning, Prospect Hunter sources 200-500 new restaurants/bars nationwide sharded by state, passes to Qualifier for scoring, emits Tier A/B/C lists to the pipeline.",
      trigger: "scheduled",
      output: "report",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "auto",
      agentRole: "Prospect Hunter"
    },
    {
      name: "Daily Pipeline Digest",
      description:
        "7am local: Recovery Ops Lead produces funnel snapshot (Funnel A + Funnel B), channel breakdown, next-best-action, and surfaces any compliance flags or declining channels.",
      trigger: "scheduled",
      output: "chat",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "auto",
      agentRole: "Recovery Ops Lead"
    },
    {
      name: "Email Cold Outreach Batch (Instantly)",
      description:
        "Dispatches the day's Tier A + Tier B prospects through Instantly with calibrated pitches from Composer. Respects warmup curve and daily cap. Logs every send.",
      trigger: "scheduled",
      output: "report",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "review_after",
      agentRole: "Channel Operator"
    },
    {
      name: "Social Broadcast Wave",
      description:
        "Scheduled posts to X, LinkedIn, TikTok, Pinterest, Instagram, Threads, and Facebook via the Social Media Hub. Uses the outcome-infographic variants as the hook asset. Value-first content mixed with occasional promo per platform rules.",
      trigger: "scheduled",
      output: "content_queue",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "review_after",
      agentRole: "Channel Operator"
    },
    {
      name: "Reddit Value-First Posting",
      description:
        "Target subs (r/restaurantowners, r/KitchenConfidential, r/smallbusiness, r/Bartender, r/barowners, r/food). 4:1 value-to-promo ratio enforced by Compliance. Every post requires approve_first.",
      trigger: "scheduled",
      output: "content_queue",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "approve_first",
      agentRole: "Channel Operator"
    },
    {
      name: "FB Group & Alignable Infiltration",
      description:
        "Restaurant/bar owner Facebook groups + Alignable local business posts. Value-first + warm-member status required before any promo. approve_first mandatory — platforms nuke accounts for cold promo.",
      trigger: "scheduled",
      output: "content_queue",
      scheduleMode: "every",
      frequency: "weekly",
      approvalMode: "approve_first",
      agentRole: "Channel Operator"
    },
    {
      name: "Reply Triage & Route",
      description:
        "Every inbound reply (email, DM, social) triggers classification into Interested / Objection / Not-Now / No / Question / Unsubscribe and routes to the right specialist.",
      trigger: "new_email",
      output: "chat",
      approvalMode: "auto",
      agentRole: "Reply Triager"
    },
    {
      name: "Objection Follow-Up Sequence",
      description:
        "30/60/90-day re-touch cadence for Not-Now replies. Pulls rebuttal scripts from KB. Rotates channel each touch to avoid fatigue.",
      trigger: "scheduled",
      output: "draft",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "review_after",
      agentRole: "Objection Responder"
    },
    {
      name: "Sub-Affiliate Recruitment Push",
      description:
        "Funnel B. Weekly outreach to sales/affiliate communities. Uses the four recruitment pitch angles. approve_first mandatory — income-guarantee language is a hard block.",
      trigger: "scheduled",
      output: "draft",
      scheduleMode: "every",
      frequency: "weekly",
      approvalMode: "approve_first",
      agentRole: "Sub-Affiliate Recruiter"
    },
    {
      name: "Downline Weekly Check-In",
      description:
        "Funnel B. Tracks each sub-affiliate's pipeline, nudges inactive (>14 days silent), celebrates wins publicly, surfaces blockers to operator.",
      trigger: "scheduled",
      output: "report",
      scheduleMode: "every",
      frequency: "weekly",
      approvalMode: "review_after",
      agentRole: "Downline Manager"
    },
    {
      name: "Daily Compliance Sweep",
      description:
        "Compliance Officer reviews all queued-but-unsent messages against TCPA / CAN-SPAM / platform TOS / value-ratio rules. Blocks non-compliant with reason; returns to author for fix.",
      trigger: "scheduled",
      output: "report",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "auto",
      agentRole: "Compliance Officer"
    },
    {
      name: "Weekly Funnel Attribution Report",
      description:
        "Data Analyst's weekly report: signed affiliates by channel + pitch register, reply-rate trends, channel CAC, Tier A/B/C conversion deltas, reallocation recommendations.",
      trigger: "scheduled",
      output: "report",
      scheduleMode: "every",
      frequency: "weekly",
      approvalMode: "review_after",
      agentRole: "Data Analyst"
    }
  ],
  starterKnowledge: [
    {
      category: "about_business",
      title: "TipTax Affiliate Engine — Overview",
      contentTemplate:
        "{{businessName}} is a private affiliate outreach workforce for the TipTax FICA Tip Credit (IRC §45B) recovery program.\n\n**Affiliate link:** https://tiptaxrefund.org/9fpc\n**Program contact:** Dave, (410) 404-2880\n**Fee to owner's client:** 25% of recovered amount, paid from escrow. Zero upfront. No obligation.\n**Refund cycle:** 4-8 weeks stated; 4-6 weeks typical per program materials.\n\n**Formula (rough):**\n- Reported Tips × 7.65% × Eligible Years = Estimated Gross Recovery\n- Gross × 75% = Net Recovery (after 25% fee)\n\n**Dual funnel:**\n- Funnel A: restaurant/bar owners → affiliate link (the money).\n- Funnel B: sub-affiliate recruitment → downline override (the multiplier).\n\nAffiliates earn a commission on everything in their downline. Sub-affiliates do the primary work on their own book; the owner's override is the smaller portion, the sub keeps the larger portion."
    },
    {
      category: "products_services",
      title: "What §45B Actually Is (Verified Facts Only)",
      contentTemplate:
        "These are the facts we anchor every pitch to. Anything not on this list is operator-process and must be framed as 'typically' or 'estimated.'\n\n**Verified:**\n- IRC §45B is a real, long-standing provision of the Internal Revenue Code. It predates any current administration policy.\n- The credit is claimed on IRS Form 8846.\n- It applies to the employer portion of Social Security + Medicare (FICA) paid on employee tips above the §45B minimum-wage floor.\n- Food and beverage employers with customary tipping may claim it, including via amended returns for prior years where applicable.\n- Distributed service charges and mandatory gratuities are treated as non-tip wages and are EXCLUDED.\n- The credit is part of the general business credit; unused credits may carry under IRS rules.\n- Tax years beginning after December 31, 2024 expanded the statute beyond food and beverage to include certain beauty and wellness services.\n\n**NEVER claim as fact (operator-process only, hedge language required):**\n- Specific refund processing times (4-8 weeks is typical per program materials, not guaranteed).\n- Escrow commission distribution mechanics.\n- '70-80% of restaurants have underfiled' — use 'program materials indicate' framing.\n- Claims that bypassing the CPA is safe or necessary."
    },
    {
      category: "brand_voice",
      title: "Pitch Register 1 — Polished",
      contentTemplate:
        "Use for: urban upscale restaurants, multi-unit groups with finance leads, restaurant controllers.\n\n---\n\nWhat I do is help restaurant and bar owners find out whether they still have money available from payroll taxes they already paid on employee tips.\n\nA lot of owners assume their CPA already handled it, and sometimes that is true. But in many cases, it was missed, underfiled, or never looked at closely enough.\n\nIf money is there, it is recovered through filing. So the first step is simple. We check whether your business qualifies, estimate what may be available, and then you decide whether it is worth moving forward.\n\nThere is no cost to find out, no obligation to proceed, and if money is there, it can go right back into the business.\n\n**Close:** Would it be worth taking a few minutes to see whether your business has anything there?"
    },
    {
      category: "brand_voice",
      title: "Pitch Register 2 — Street-Simple",
      contentTemplate:
        "Use for: neighborhood bars, coffee shops, small dive bars, owner-operators with casual tone.\n\n---\n\nI help restaurant and bar owners see if they still have money sitting there from payroll taxes they already paid on tips.\n\nA lot of people think their CPA already got it handled. Sometimes they did. A lot of times they did not.\n\nIf there is money there, the way to get it back is by filing for it properly. So all we do first is check if you qualify, see what may be there, and then you decide if it is worth moving on.\n\nIt costs nothing to find out, there is no obligation, and if money is there, you would probably want to know.\n\n**Close:** Would it hurt to take a few minutes and see if there is anything there for your business?"
    },
    {
      category: "brand_voice",
      title: "Pitch Register 3 — High-Authority",
      contentTemplate:
        "Use for: multi-unit groups, corporate-owned chains, restaurant CFOs/controllers, PE-backed hospitality groups.\n\n---\n\nI work with restaurant and bar owners to determine whether prior tip-related payroll tax filings still contain recoverable value.\n\nMany businesses assume this was already addressed. Sometimes it was. Often it was not. Credits get missed, underclaimed, or never reviewed with enough precision.\n\nIf an opportunity exists, it is pursued through filing. The process starts by confirming eligibility, estimating the recovery, and then allowing the owner to decide whether it is worth moving forward.\n\nThere is no cost to assess it, no obligation to proceed, and meaningful upside if money was left unclaimed.\n\n**Close:** Would it make sense to spend a few minutes determining whether your business still has recoverable money available?"
    },
    {
      category: "brand_voice",
      title: "Pitch Register 4 — Best Blended (Default)",
      contentTemplate:
        "Use when register signals are mixed or unclear. This is the safe default — direct but not cold, warm but not casual.\n\n---\n\nWhat I do is help restaurant and bar owners see if they still have money available from payroll taxes they already paid on employee tips.\n\nA lot of owners think their CPA already handled it, and sometimes that is true. But a lot of times it was missed, underfiled, or just never looked at closely enough.\n\nIf there is money there, it gets recovered through filing. So the first step is easy. We check if your business qualifies, estimate what may be available, and then you decide whether it is worth moving forward.\n\nThere is no cost to find out, no obligation to do anything, and if money is there, you get the chance to put it back into the business.\n\n**Close:** Would it be worth taking a few minutes just to see if your business has anything there?"
    },
    {
      category: "brand_voice",
      title: "Approved Closer Family",
      contentTemplate:
        "Every outreach message ends with one of these closer lines. Rotate to avoid pattern detection. All four are tested and on-brand.\n\n1. Would it be worth taking a few minutes to see whether your business has anything there?\n2. Would it hurt to take a few minutes and see if there is anything there for your business?\n3. Would it make sense to spend a few minutes determining whether your business still has recoverable money available?\n4. Would it be unreasonable to spend a few minutes finding out whether your restaurant has money sitting in prior tip-related tax filings?\n\n**Never close with:**\n- 'Let me know if you're interested.' (too passive)\n- 'Book a call here.' (too aggressive cold)\n- 'This is a limited-time opportunity.' (false urgency — §45B isn't going anywhere)\n- Any mention of a specific dollar amount as an outcome."
    },
    {
      category: "faqs",
      title: "FAQ — Do we actually qualify?",
      contentTemplate:
        "**Short answer:** If the business has tipped employees, it should be reviewed.\n\n**Full answer:** Many restaurants and bars have never claimed this properly, and even some that have may still have money left on the table. Eligibility covers food, beverage, and qualifying hospitality employers where tipping is customary. Coffee shops qualify. Bars qualify. Fast-casual without tipping typically does not. The 2026 expansion adds certain beauty and wellness services."
    },
    {
      category: "faqs",
      title: "FAQ — How much could we reasonably recover?",
      contentTemplate:
        "**Short answer:** It depends on size, reported tip volume, and years available for review.\n\n**Rough range:** Approximately $10,000 to $300,000+ in many cases. See the Example Recovery Scenarios KB entry for concrete illustrations.\n\n**Frame as:** 'estimated' or 'potential.' Never guaranteed. The actual number requires the eligibility review."
    },
    {
      category: "faqs",
      title: "FAQ — What years can still be reviewed?",
      contentTemplate:
        "The primary years currently available for review are 2022, 2023, and 2024. In some cases 2025 is reviewable if filings have already been made for that year.\n\nThe IRS allows amendment up to 3 years back. Ongoing annual filing is also available for current and future years — this becomes a recurring benefit, not one-time."
    },
    {
      category: "faqs",
      title: "FAQ — How much work from the owner's side?",
      contentTemplate:
        "Very little. The owner completes a short online form and electronically signs the required documents via DocuSign. The process typically takes about two to three minutes.\n\nNo documents need to be uploaded by the owner — the CPAs obtain transcripts directly from the IRS using the DocuSigned authorization. The owner does not need to involve their current accountant to sign up."
    },
    {
      category: "faqs",
      title: "FAQ — How long does the process take?",
      contentTemplate:
        "From day one, the owner has access to their back office portal to track status.\n\n- Within ~7 days: estimated eligibility review and filing documents available.\n- Once signed: refunds currently arriving in ~3-6 weeks typical, up to 8 weeks in some cases.\n- A dedicated account manager guides the owner throughout.\n\nAlways frame as 'currently,' 'typical,' or 'most cases.' Never guarantee timing."
    },
    {
      category: "faqs",
      title: "FAQ — Risks, fees, and limitations?",
      contentTemplate:
        "**Fee:** 25% of the recovered amount. Paid from the IRS refund through escrow, not upfront.\n**Audit protection:** Program includes a five-year audit protection plan.\n**Limitations:** If the owner has an existing IRS liability that offsets the refund, the 25% fee must be paid upfront before filing (non-circumvention clause in the agreement prevents bypass). Clients can see every document they're signing via their portal."
    },
    {
      category: "faqs",
      title: "FAQ — Can my CPA or bookkeeper do this?",
      contentTemplate:
        "They can. However, many CPAs and bookkeepers have either overlooked this opportunity entirely or underclaimed it. Given the amount of money potentially at stake, a second review is worthwhile.\n\n**Framing:** 'trust but verify.' No cost to find out. The owner does not need to involve their current accountant to sign up — DocuSign provides the IRS access legally without that coordination.\n\n**Never say:** 'Your CPA is bad.' Always: 'Here's another way to think about it.'"
    },
    {
      category: "faqs",
      title: "FAQ — Closed or sold businesses?",
      contentTemplate:
        "Yes, closed or sold businesses can still file if they operated during the eligible years (2022-2024).\n\nThe EIN that filed the original returns is what matters. Funds are paid to whoever owned the business during those years — unless a sale agreement specifies otherwise (in which case the new owner gets any tax credits that come in)."
    },
    {
      category: "processes",
      title: "Example Recovery Scenarios (the Hook Infographic)",
      contentTemplate:
        "This is the single highest-converting asset. Use as the HOOK in outreach, not the close. The close is always the affiliate link.\n\n**How the estimate works:**\n- Reported Tips × 7.65% × Eligible Years = Estimated Gross Recovery\n- Gross − 25% Fee = Estimated Net Recovery\n\n**Three illustrative scenarios (3 eligible years, 25% fee):**\n\n| Scenario | Reported Tips | Gross Recovery | Net Recovery |\n|---|---|---|---|\n| Small Restaurant | $150,000 | $34,425 | **$25,819** |\n| Neighborhood Bar | $300,000 | $68,850 | **$51,638** |\n| Busy Restaurant Group | $900,000 | $206,550 | **$154,913** |\n\n**Disclosure line (always include when using the infographic):**\n'Illustrative examples only. Actual recovery depends on eligibility, payroll records, filing periods, and final tax calculations.'\n\n**CTA family (pick one per send):**\n- 'Start the process: tiptaxrefund.org/9fpc'\n- 'Questions? Call Dave at (410) 404-2880'\n- 'There is no cost to find out whether your business may still have money available.'"
    },
    {
      category: "processes",
      title: "Objection Script 1 — 'My CPA can do this'",
      contentTemplate:
        "**Rebuttal (trust-but-verify frame):**\n\n'They absolutely can. In many cases they already have. But in a lot of cases the credit gets missed, undercalculated, or never looked at closely enough. The rules have moving parts — if nobody specifically checks for it, money can be left behind.\n\nAll we do is run a free verification. If your CPA already captured everything, great — we confirm that at zero cost. If money is still available, you get to decide what to do. There's nothing lost either way.\n\nAnd you don't need to loop your accountant in to sign up. DocuSign gives us IRS access legally to verify without their coordination.'\n\n**Never:** trash the CPA, imply incompetence, or demand they switch."
    },
    {
      category: "processes",
      title: "Objection Script 2 — 'Already filed for this'",
      contentTemplate:
        "**Rebuttal:**\n\n'Great — a lot of the businesses we talk to have filed. But even when filed, it's commonly underclaimed. The calculation has specific rules around which tips qualify and which minimum-wage basis applies.\n\nWe offer a free verification. If the filing was complete and correct, we confirm that and you walk away having lost nothing. If it was underfiled, we show you exactly where — and you decide whether to amend.\n\nThe verification takes about 2-3 minutes on your end.'\n\n**Never:** imply the prior filing was wrong before you've looked at it."
    },
    {
      category: "processes",
      title: "Objection Script 3 — 'Not a good time'",
      contentTemplate:
        "**Rebuttal:**\n\n'Totally fair. What would make the timing right? If it's a matter of when during the year, we can flag it and come back. If it's about bandwidth, I'd note the owner side of this is about 2-3 minutes — we handle everything from there.\n\nAnd since the lookback window is fixed (3 years), every month that passes is a month closer to 2022 expiring. Not saying that's urgent — just something to factor in.'\n\n**Never:** manufacture false urgency. §45B itself isn't going anywhere, but the lookback cliff is a real calendar constraint."
    },
    {
      category: "processes",
      title: "Objection Script 4 — 'What's the fee / too expensive'",
      contentTemplate:
        "**Rebuttal:**\n\n'The fee is 25% of whatever gets recovered. Nothing up front. If we find $100,000, you net $75,000. If we find $0, you pay $0.\n\nThe IRS pays the refund into an escrow account; escrow pays you and us simultaneously. You never chase us for a distribution, we never chase you for the fee.\n\nThe only exception is if you already have an IRS liability larger than what we recover — in that case the refund offsets the liability, and the fee is owed on the amount recovered. Everything's spelled out in the agreement, and you see every document before signing.'"
    },
    {
      category: "processes",
      title: "Objection Script 5 — 'Seems like a scam / don't trust it'",
      contentTemplate:
        "**Rebuttal (evidence-led, calm):**\n\n'Fair skepticism. This isn't new legislation — §45B has been in the Internal Revenue Code for years. It predates the current administration and has nothing to do with the 'no tax on tips' proposal; that's a different thing.\n\nThe filing vehicle is IRS Form 8846. The CPAs handling this are licensed tax professionals, not a scheme. IRS refunds go through an escrow services company, not directly to us — so there's no scenario where we hold your money.\n\nHappy to send over the exact statutory reference if that helps.'\n\n**Never:** get defensive. The skepticism is rational; meet it with facts."
    },
    {
      category: "processes",
      title: "Downline Recruiter Pitch — Funnel B Core Message",
      contentTemplate:
        "**Target audiences:** sales ops between deals, affiliate marketers with an existing CRM, commission lead-gen shops, SaaS BDRs doing side hustles, niche communities on r/sales, r/affiliatemarketing, LinkedIn sales groups.\n\n**Four pitch angles:**\n\n1. **Fast payout** — IRS refunds in 4-8 weeks (stated), 4-6 typical. Vs. B2B sales cycles that can drag 6+ months.\n2. **Low friction** — Owner signs in 2-3 minutes via DocuSign. No CPA coordination. No document upload.\n3. **Sticky vertical** — Restaurants/bars are ubiquitous, every metro has thousands. Program materials indicate 70-80% have underfiled.\n4. **Escrow-paid** — You never chase clients for commission. Escrow distributes to all parties simultaneously.\n\n**Never (hard block):**\n- 'You'll make $X'\n- 'Typical earnings are $X'\n- 'Guaranteed income'\n- Any specific income figure as an expectation.\n\n**Always:**\n- 'Commissions vary based on volume, deal size, and effort.'\n- Offer a direct call with the operator for interested recruits (don't try to close Funnel B via text alone)."
    },
    {
      category: "processes",
      title: "Channel Rate Limits & Warmup Schedules",
      contentTemplate:
        "Per-channel limits. Exceeding = account risk.\n\n**Instantly (cold email):**\n- Week 1: 20/day per inbox. Week 2: 40/day. Week 3: 60/day. Week 4+: up to 100/day per inbox.\n- Maintain reply tracking + bounce rate <5%.\n- CAN-SPAM: unsubscribe link + physical address in every send.\n\n**LinkedIn:**\n- 20-25 connect requests/day max.\n- DMs only to 1st-degree connections unless InMail credits.\n- 1 post per day max to avoid algorithmic suppression.\n\n**X / Twitter:**\n- 50 DMs/day max, warm only (accounts that follow or have engaged).\n- 5-10 posts/day max, mix of value + 1-2 promos.\n\n**Reddit:**\n- 1 comment per subreddit per day.\n- 4:1 value-to-promo ratio — 4 helpful posts before 1 promo.\n- Never cross-post the same promo to multiple subs same day.\n\n**FB Groups:**\n- Warm-member status (approved + commented before) required before any promo.\n- 1 promo post per group per month max.\n- Value posts unlimited.\n\n**TikTok / Instagram / Pinterest / Threads / YouTube:**\n- Per Social Media Hub defaults; let Late/Ayrshare enforce.\n\n**WhatsApp + Telegram:**\n- WARM ONLY. No cold DMs. TCPA rules apply.\n\n**Alignable:**\n- Local B2B community; value-first posts; 1 promo/week max per account.\n\n**Craigslist:**\n- Services > financial services, rotate cities, unique copy per post (they dedupe aggressively)."
    },
    {
      category: "processes",
      title: "Follow-Up Cadence (30/60/90)",
      contentTemplate:
        "For prospects classified as NOT_NOW by Reply Triager.\n\n**Day 30:** Light check-in. Different channel from original touch. One-liner: 'Following up — any timing change on that tip-credit review?'\n\n**Day 60:** Value-add touch. Send a short piece of content (article link, infographic variant, case-style scenario). No ask. Just 'thought this might be useful.'\n\n**Day 90:** Final touch. Direct: 'Closing out this thread on my end — if timing changes, ping me. Otherwise good luck.' This works because it removes pressure. Many re-engagements happen after this touch because the prospect now feels they've 'lost' the option and wants it back.\n\n**After Day 90:** Quarterly low-touch only. Don't burn the relationship."
    },
    {
      category: "contacts",
      title: "Operator + Program Contacts",
      contentTemplate:
        "**Operator (you):** beardfacebeard@gmail.com\n\n**Program contact (for warm handoffs):**\n- Dave — (410) 404-2880\n- Primary affiliate link: https://tiptaxrefund.org/9fpc\n- Website: https://tiptaxrefund.org\n\n**When to hand off to Dave directly:**\n- Multi-unit groups (5+ locations)\n- Complex multi-state operators\n- Any prospect asking for an hour+ deep-dive\n- Any CFO/controller who wants a technical walkthrough\n\n**Never hand off:**\n- Single-location prospects in Tier B/C — the link self-serves\n- Anyone who hasn't explicitly signaled high interest (otherwise you burn Dave's time)"
    },
    {
      category: "policies",
      title: "Compliance Non-Negotiables",
      contentTemplate:
        "**TCPA (SMS + WhatsApp):** NEVER cold to a cell number. Warm-only, opted-in, or reply-thread continuation.\n\n**CAN-SPAM (email):** Every cold send must have a working unsubscribe link and a physical business address. Instantly handles by default — verify on every new campaign.\n\n**Outcome promises:** NEVER guarantee a refund amount. ALWAYS hedge with 'estimated,' 'potential,' 'typical.'\n\n**§45B framing:** NEVER link it to 'no tax on tips' or current administration policy. It's statutory and predates both.\n\n**CPA framing:** NEVER tell owner their CPA is bad or to fire them. Frame as 'second opinion' or 'verification.'\n\n**Income guarantees (Funnel B):** NEVER quote specific expected earnings for sub-affiliates. ALWAYS 'commissions vary based on volume, deal size, and effort.'\n\n**Community channels (Reddit, FB Groups, Alignable):** Compliance Officer + operator approve_first BEFORE any post. 4:1 value-to-promo ratio. Disclosure of affiliation in any promo.\n\n**Craigslist:** Services > financial services only. Rotate cities. Unique copy per post. Don't auto-post — batches look obviously automated."
    },
    {
      category: "custom",
      title: "Scoring Rubric — Prospect Qualifier",
      contentTemplate:
        "How the Qualifier scores prospects 1-10.\n\n**Inputs (higher = higher score):**\n- Seat count or employee count (10+ seats baseline; 50+ is strong)\n- Cuisine/service style: full-service restaurants and bars = strong; fine dining = strongest (big tickets + tipping); coffee shops = moderate (high volume but smaller tips per txn); fast-casual without tipping = weak\n- Yelp review count as traffic proxy (500+ reviews = meaningful volume)\n- Google rating volume (similar)\n- Online ordering presence (DoorDash/UberEats-heavy = DILUTES tipping % → slight negative)\n- Liquor license class (full bar > beer-wine > no liquor)\n- Multi-unit signal (same owner/EIN across multiple locations) = compounding — flag for operator manual\n\n**Score bands → estimated recovery (3-year lookback, 25% fee, NET):**\n- 9-10: $100K-$300K+ (target direct call, not email)\n- 7-8: $40K-$100K (Tier A — highest priority email/DM)\n- 5-6: $15K-$40K (Tier B — main batch)\n- 3-4: $5K-$15K (Tier C — lower priority)\n- 1-2: <$5K (skip or rare deep-discount outreach)\n\n**Always label:** 'estimated' or 'potential range.' Never guaranteed."
    }
  ],
  starterWorkspaceDocs: [
    {
      filePath: "AGENTS.md",
      category: "core",
      tier: "hot",
      contentTemplate:
        "# {{businessName}} — Agent Workforce\n\n## Recovery Ops Lead (main) 🦅\nOwns the daily pipeline digest and specialist coordination. Enforces three load-bearing gates: (1) Compliance Officer greenlights every community-channel post before it ships. (2) Any batch over 100 contacts requires explicit approval. (3) Any outcome-promise language is blocked and sent back to Pitch Composer.\n\n## Funnel A — Restaurant Owner Acquisition\n- **Prospect Hunter 🎯** — sources 200-500 qualified restaurants/day via Firecrawl + Playwright on Google Places, Yelp, OSM, state licensing rolls. Never Apollo.\n- **Prospect Qualifier 🔍** — scores 1-10, maps to Tier A/B/C and estimated recovery bands.\n- **Pitch Composer ✍️** — picks 1 of 4 KB registers (Polished / Street-Simple / High-Authority / Blended) per prospect.\n- **Channel Operator 📡** — dispatches Instantly (email), Telegram (warm), WhatsApp (warm), Social Media Hub (9 platforms), Reddit MCP.\n- **Reply Triager 🧭** — classifies inbound → Interested / Objection / Not-Now / No / Question / Unsubscribe.\n- **Objection Responder 🛡️** — 5 KB rebuttals + 30/60/90 follow-up cadence.\n- **Link Closer 🔗** — sends outcome infographic + tiptaxrefund.org/9fpc with tier-matched CTA.\n\n## Funnel B — Sub-Affiliate Recruitment\n- **Sub-Affiliate Recruiter 🤝** — targets sales/affiliate communities with 4 pitch angles. NEVER income guarantees.\n- **Downline Manager 👥** — onboards subs, tracks weekly pipeline, nudges inactive at day 14, surfaces blockers.\n\n## Compliance & Analytics\n- **Compliance Officer 🛡️** — TCPA / CAN-SPAM / platform TOS / value-ratio enforcement. Has veto power.\n- **Data Analyst 📊** — daily channel metrics, weekly attribution, reallocation recommendations.\n\n## Rules\n- No guaranteed refund amounts. Ever.\n- §45B is statutory, predates 'no tax on tips.' Never link them.\n- CPA framing: 'trust but verify,' never 'your CPA is bad.'\n- Funnel B: no income guarantees. 'Commissions vary based on volume, deal size, and effort.'\n- Community platforms: approve_first + 4:1 value ratio + disclosure."
    },
    {
      filePath: "WORKFLOWS.md",
      category: "templates",
      tier: "warm",
      contentTemplate:
        "# {{businessName}} — Workflow Schedule\n\n## Daily\n- **Daily Prospect Discovery** (auto) — Hunter sources 200-500 new restaurants, Qualifier scores, emits Tier A/B/C.\n- **Daily Pipeline Digest** (7am local, auto) — Recovery Ops Lead — full funnel metrics + next-best-action.\n- **Email Cold Outreach Batch** (review_after) — Channel Operator via Instantly.\n- **Social Broadcast Wave** (review_after) — Channel Operator across 9 platforms via Social Media Hub.\n- **Reddit Value-First Posting** (approve_first) — 4:1 ratio enforced.\n- **Reply Triage & Route** (new_email trigger, auto) — Reply Triager.\n- **Objection Follow-Up Sequence** (review_after) — 30/60/90 re-touch for Not-Now replies.\n- **Daily Compliance Sweep** (auto) — Compliance Officer blocks non-compliant.\n\n## Weekly\n- **FB Group & Alignable Infiltration** (approve_first) — warm-member status required.\n- **Sub-Affiliate Recruitment Push** (approve_first) — Funnel B.\n- **Downline Weekly Check-In** (review_after) — track each sub.\n- **Weekly Funnel Attribution Report** (review_after) — Data Analyst.\n\n## Approval Defaults\n- Any community-channel post (Reddit / FB Groups / Alignable) = approve_first.\n- Any batch > 100 contacts = manual operator approval.\n- Funnel B recruitment = approve_first (income-language risk).\n- Funnel A email/social = review_after (post-hoc sampling).\n- Infrastructure (hunting, triage, compliance sweep) = auto."
    },
    {
      filePath: "DOWNLINE_PLAYBOOK.md",
      category: "knowledge",
      tier: "warm",
      contentTemplate:
        "# {{businessName}} — Downline Playbook (Funnel B)\n\n## The math\nOwner (you) recruits sub-affiliates. Subs do the primary work on their own book of business. When a sub's client signs with TipTax and a refund lands, commission splits:\n- **Sub** gets the larger portion (the majority — they did the work).\n- **You** get an override on their production (smaller portion, but passive and recurring).\n\nThis is a multiplier, not a replacement for Funnel A.\n\n## Who to recruit\n- Sales operators between deals (B2B SaaS, insurance, financial services) — they have CRM + outreach muscle\n- Affiliate marketers already running other programs (they'll add this as another revenue stream)\n- Commission lead-gen shops (small agencies)\n- Side-hustle seekers with sales background — r/sales, r/affiliatemarketing, select LinkedIn groups\n\n## Who NOT to recruit\n- Anyone asking for income guarantees up front (they'll churn when reality doesn't match)\n- Anyone with no outreach experience (they'll burn through leads with bad pitches)\n- Anyone asking you to do the work for them (defeats the multiplier)\n\n## Onboarding steps (when a sub signs on)\n1. Add them to the downline Telegram group.\n2. Share the TipTax sign-up portal link for new affiliates.\n3. Share the outcome infographic + 4-register pitch library (copy from this workspace's KB).\n4. Issue them their UTM-tagged version of /9fpc for attribution.\n5. Walk them through Channel Rate Limits KB — many will try to blast day 1 and nuke their Instantly inbox.\n6. Commit to a 14-day check-in rhythm.\n\n## The 14-day rule\nIf a sub hasn't moved a prospect through their funnel in 14 days, Downline Manager sends a light nudge: 'here's what's working for others this week' + a link to a winning pitch variant. NOT a pressure message.\n\nIf they go silent 30 days after nudge: flag to operator. Don't remove from downline — just stop active enablement until they re-engage.\n\n## Compliance in the downline\n- You are responsible for what your subs do. Bad compliance in your downline = TipTax could suspend the whole branch.\n- Every new sub gets the Compliance Non-Negotiables KB entry on day 1.\n- Downline Manager flags any sub whose outreach appears non-compliant (TCPA violation, income-guarantee language in public posts, etc.) immediately.\n\n## What you never say to subs\n- 'You'll make $X per month.'\n- 'Typical earnings are $Y.'\n- 'If you do X hours, you'll close Y deals.'\n\n## What you always say\n- 'Commissions vary based on volume, deal size, and effort.'\n- 'Here's the pitch library that's working this week.'\n- 'Here's what a top-performing sub did differently this month.' (with numbers but without implying guarantees)"
    }
  ]
};
