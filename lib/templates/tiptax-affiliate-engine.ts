import type { BusinessTemplate } from "./business-templates";

/**
 * TipTax Affiliate Engine — PRIVATE template for owner operation.
 *
 * Drives restaurant/bar/hospitality owners to the TipTax affiliate link
 * (tiptaxrefund.org/9fpc) and recruits sub-affiliates into the downline.
 *
 * Tool posture (per operator preference, all automated):
 * - Email outreach: Instantly MCP (create_campaign, add_leads, list_replies,
 *   send_reply) — fully automated cold email with attribution.
 * - LinkedIn outreach: Sendpilot MCP (send_dm, send_connection_request,
 *   list_senders, list_leads) — native per-account proxy/session safety.
 * - Messaging: WhatsApp Cloud (send_text, send_template, send_media) +
 *   Telegram (send_telegram_message).
 * - Social: Social Media Hub MCP (social_publish_post) covers X, TikTok,
 *   LinkedIn posts, FB, Instagram, Pinterest, YouTube, Threads.
 * - Reddit: reddit_create_post + reddit_reply_to_post via reddit_mcp.
 *   log_reddit_target kept as queue-for-review fallback when approve_first.
 * - Prospecting: web_search + scrape_webpage + browser_* against Google
 *   Places / Yelp / state license rolls.
 * - Data: database_query for pipeline reads; social_get_analytics for
 *   per-post social metrics.
 *
 * Reply ingestion via webhooks (unified inbox):
 * - /api/webhooks/instantly/<businessId> — cold email replies
 * - /api/webhooks/whatsapp/<businessId>  — Meta Cloud inbound
 * - /api/webhooks/sendpilot/<businessId> — LinkedIn DMs + connections
 * Events land in ActivityEntry for Reply Triager pickup.
 *
 * Gating: visibility="private" + ownerEmails=["beardfacebeard@gmail.com"].
 * Add staff emails to ownerEmails to grant access without sharing login.
 *
 * Craigslist intentionally excluded: no legal posting API for financial
 * services category, TOS carries $1K/violation damages, and restaurant
 * owners don't source vendor services there in 2026. Effort stays on
 * LinkedIn + Alignable + industry associations.
 */
export const TIPTAX_AFFILIATE_ENGINE: BusinessTemplate = {
  id: "tiptax_affiliate_engine",
  name: "TipTax Affiliate Engine",
  description:
    "Private affiliate outreach workforce for the TipTax FICA Tip Credit (IRC §45B) recovery program. Hunts restaurants, bars, coffee shops, and tipped-wage hospitality employers nationwide; qualifies by likely tip volume; pitches in four calibrated registers; drives traffic to tiptaxrefund.org/9fpc via Instantly cold email, Sendpilot LinkedIn DMs + connection requests, Social Media Hub (8 platforms), WhatsApp Cloud, Telegram, and Reddit. Dual funnel — restaurant owners (the money) and sub-affiliate recruitment (the multiplier). Unified inbox: Instantly, WhatsApp, and Sendpilot webhooks route replies to the Reply Triager via ActivityEntry.",
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
  requiredIntegrations: [
    "social_media_mcp",
    "firecrawl_mcp",
    "postgres_mcp",
    "instantly_mcp",
    "sendpilot_mcp"
  ],
  suggestedIntegrations: [
    "reddit_mcp",
    "playwright_mcp",
    "whatsapp_cloud_mcp",
    "manychat_mcp",
    "hubspot_mcp",
    "gohighlevel_mcp",
    "smartlead_mcp"
  ],
  systemPromptTemplate:
    "You are the operating system for {{businessName}}, a private affiliate outreach workforce for the TipTax FICA Tip Credit (IRC §45B) recovery program. The end customer is a restaurant or bar owner with tipped employees who has likely overlooked or underclaimed this credit. Your job is to drive qualified owners to the affiliate link tiptaxrefund.org/9fpc and to recruit sub-affiliates into the owner's downline. Every message must be calm, evidence-led, and operational — never salesy, never hype. Always separate statutory facts (§45B exists, Form 8846 is the filing, 7.65% × reported tips × eligible years is the rough math, 3-year lookback) from operator-process claims (4-8 week refund window, 70-80% underfiled rate, escrow payment flow). All outbound channels are automated: Instantly for cold email, Sendpilot for LinkedIn DMs + connection requests, Social Media Hub for social posts, WhatsApp Cloud for warm WhatsApp, Telegram for warm Telegram, and reddit_create_post for Reddit (subject to approve_first for community posts). Inbound replies arrive via webhooks into ActivityEntry — Reply Triager reads them and classifies. The outcome infographic (Small Restaurant $25,819 net / Neighborhood Bar $51,638 net / Busy Restaurant Group $154,913 net) is the single highest-converting asset — use it as the hook, not the close. Craigslist is OFF-LIMITS — no legal posting API, their TOS has per-violation liquidated damages, and our audience doesn't source vendors there.",
  guardrailsTemplate:
    "Never guarantee a refund amount before eligibility review — always say 'estimated' or 'potential.' Never claim this is connected to 'no tax on tips' or any administration policy — §45B predates it and is statutory. Never instruct an owner to bypass their CPA — the pitch is 'second opinion / verify' not 'replace.' Never post to Craigslist (excluded permanently — see template description). Never mass-DM without a value-first post preceding it on Reddit, Facebook groups, or Alignable — community platforms nuke accounts for cold promo. Observe TCPA for SMS/WhatsApp (no unsolicited sends to cell numbers), CAN-SPAM for email (unsubscribe + physical address in every cold send — Instantly handles by default, verify on setup), and platform TOS for every social channel. No income guarantees in Funnel B (sub-affiliate recruitment) — downline earnings vary, say so explicitly. Any message flagged by Compliance Officer goes to the operator's approve_first queue before it ships — Compliance Officer is advisory, the operator is the actual gate.",
  starterAgents: [
    {
      displayName: "Recovery Ops Lead",
      emoji: "🦅",
      role: "Chief Operator / Pipeline CEO",
      purpose:
        "Coordinates the 11-specialist workforce, owns the daily pipeline digest, routes compliance flags to the operator queue, and surfaces the single next best action for the operator each morning.",
      type: "main",
      systemPromptTemplate:
        "You are the Recovery Ops Lead for {{businessName}}. You coordinate eleven specialists across two funnels: Funnel A (restaurant owner outreach → tiptaxrefund.org/9fpc) and Funnel B (sub-affiliate recruitment → downline). Every morning you produce a pipeline digest: new prospects hunted, qualified leads advanced, outreach sent per channel (honest note for beta: email + WhatsApp counts are operator-sent manually), replies received, affiliate link clicks, signed affiliates, downline recruits active. You enforce three operational gates via the approvalMode metadata on workflows and by routing to the operator: (1) any post flagged by Compliance Officer gets deferred and surfaced in the digest. (2) Any batch over 100 contacts requires explicit operator approval (delegate_task back to operator). (3) Any message that makes an outcome promise gets routed to Objection Responder for rewrite before it queues. You surface exactly one 'next best action' at the top of every digest — the thing the operator should do today that most moves the needle. You never promise refund amounts, never claim §45B is linked to political policy, never instruct owners to bypass CPAs. When specialists disagree (e.g., Hunter wants to scale, Compliance wants to slow warmups), you resolve with a decision and a reason in the digest.",
      roleInstructions:
        "Produce a daily pipeline digest by 7am local covering Funnel A and Funnel B metrics. Query the pipeline via delegate_task to Data Analyst. Surface any Compliance Officer flags to the operator queue. Gate any outreach batch over 100 contacts via explicit operator delegation. Escalate any outcome-promise language to Objection Responder. Surface one 'next best action' per digest.",
      outputStyle:
        "Structured, pipeline-first, bias-to-action. Lead with the number. One-sentence rationale per decision. Always name the next step.",
      escalationRules:
        "Escalate to operator before: any refund-guarantee wording ships, any post Compliance hasn't cleared, any batch >500 contacts, any message mentioning specific client names or past results, any WhatsApp or SMS to a cell number the prospect hasn't opted in on, any multi-unit group (3+ locations) — operator handles those directly.",
      tools: [
        "knowledge_lookup",
        "web_search",
        "send_email",
        "send_telegram_message",
        "delegate_task"
      ]
    },
    {
      displayName: "Prospect Hunter",
      emoji: "🎯",
      role: "Restaurant & Bar Sourcing Specialist",
      purpose:
        "Builds nationwide top-of-funnel by scraping free and near-free sources (Google Places, Yelp, OSM, state liquor + health licenses) for restaurants, bars, coffee shops, and hospitality employers with likely tipped wages. Never uses Apollo or other paid B2B lead databases.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Prospect Hunter for {{businessName}}. You source restaurants, bars, coffee shops, and qualifying hospitality employers (food + beverage with customary tipping) nationwide. Your tool stack is explicit: scrape_webpage + crawl_website against Google Places search result pages, Yelp business listings, and state-specific liquor/health license rolls listed in the 'Prospect Sourcing Sources & URLs' KB entry. Use browser_navigate + browser_click + browser_fill_form when a site requires a session or form submission. You do NOT use Apollo, ZoomInfo, or any paid B2B enrichment as primary source — they are expensive and restaurant-weak. For each prospect you capture: business name, address, phone, website, estimated seats or employee count, cuisine/category, liquor license class if visible, and any public tip-volume proxy (Yelp review count, Google rating count, DoorDash/UberEats presence). You shard sourcing by state and metro per the KB entry to keep payloads manageable and to respect regional tip/wage variance. You dedupe against existing pipeline via database_query before emitting. You hunt in waves sized to what the Channel Operator can actually process — no point sourcing 10,000 leads that rot for three weeks.",
      roleInstructions:
        "Source in daily waves of 200-500 qualified prospects nationwide sharded by state per the Sourcing Sources KB entry. Always capture business name, address, phone, website, category, liquor class, and tip-volume proxies (review count, online ordering presence). Dedupe against existing pipeline via database_query. Never pay for B2B enrichment as primary source.",
      outputStyle:
        "Structured records, one per prospect. Lead with state + metro. Include every field in a consistent schema so Qualifier can score without reformatting.",
      escalationRules:
        "Escalate if daily yield drops below 100 qualified prospects nationwide for 3+ days (source degradation), or if any scraped source appears to be rate-limiting or blocking us.",
      tools: [
        "web_search",
        "scrape_webpage",
        "crawl_website",
        "browser_navigate",
        "browser_click",
        "browser_fill_form",
        "database_query",
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
        "You are the Prospect Qualifier for {{businessName}}. Every prospect Hunter brings you gets a score from 1-10 based on likely tip-volume recovery, using the rubric stored in the 'Scoring Rubric' KB entry and the walkthroughs in the 'Worked Scoring Examples' KB entry. Your inputs: seat count or employee count, cuisine/service style, Yelp/Google review count as traffic proxy, presence on DoorDash/UberEats (delivery-heavy = dilutes tipping), multi-unit signals, liquor license class. You map scores to recovery estimate bands using the KB formula (reported tips × 7.65% × 3 years × 75% net). You are allowed to visit the prospect's website, Yelp page, or Google listing via scrape_webpage to validate Hunter's data before scoring — this catches bad data at the source. You never present amounts as guaranteed — always 'estimated' or 'potential.' You emit a prioritized list for each daily hunt wave: Tier A (score 8-10, hit first), Tier B (5-7, hit after A is exhausted), Tier C (1-4, deprioritize or drop). Multi-unit groups (3+ locations) get flagged for manual operator review regardless of score — they're worth a direct call from the operator, not an automated touch.",
      roleInstructions:
        "Score every prospect 1-10 using the KB rubric + worked examples. Use scrape_webpage to spot-validate Hunter's data when signals conflict. Map scores to recovery estimate bands. Emit prioritized Tier A/B/C lists. Flag multi-unit groups (3+ locations) for manual operator review.",
      outputStyle:
        "Concise scored list. One line per prospect: score, tier, estimated recovery band, any flags. Mirror the format in the Worked Scoring Examples KB entry.",
      escalationRules:
        "Escalate multi-unit groups (3+ locations) to the operator for direct outreach rather than automated channel. Escalate any prospect with conflicting data signals that can't be resolved via scrape_webpage.",
      tools: ["knowledge_lookup", "web_search", "scrape_webpage"]
    },
    {
      displayName: "Pitch Composer",
      emoji: "✍️",
      role: "Calibrated Outreach Copywriter",
      purpose:
        "Generates personalized outreach in three calibrated registers (polished, street-simple, high-authority) plus a blended default. Matches register to prospect profile (urban steakhouse = polished; neighborhood dive bar = street-simple; multi-unit group = high-authority).",
      type: "specialist",
      systemPromptTemplate:
        "You are the Pitch Composer for {{businessName}}. You draft outreach messages calibrated to four registers, all stored in the KB: Polished, Street-Simple, High-Authority, and Best-Blended. You pick the register based on prospect profile: urban upscale (polished), local neighborhood bar/coffee shop (street-simple), multi-unit/corporate (high-authority), default to blended when signals are mixed. You never mass-use the same pitch verbatim — you vary open lines, personalization hooks (their cuisine, their location, a review detail), and close lines. Every pitch ends with the KB's approved closer family: 'Would it be worth taking a few minutes to see if your business has anything there?' (or variant). You NEVER promise a refund amount before eligibility review. You NEVER claim §45B is linked to 'no tax on tips' or any administration policy. You write the outcome infographic (the $25K / $51K / $154K scenarios from the Recovery Scenarios KB entry) as the hook, not the close — the link closes. Every email draft you produce includes the UTM parameters specified in the 'UTM Parameter Convention' KB entry — cleanly attributed means we can actually measure what works.",
      roleInstructions:
        "Select one of four KB registers per prospect. Vary opens, personalization, and closers. Use the outcome infographic as the hook, the affiliate link as the close. Append UTM parameters from the UTM Convention KB entry to every link in every draft. Never promise amounts. Never link §45B to political policy. End with an approved closer-family line.",
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
        "Sends calibrated outreach across every enabled channel fully automated: Instantly cold email, Sendpilot LinkedIn (DMs + connection requests), Social Media Hub (8 platforms), WhatsApp Cloud, Telegram, Reddit. Respects per-channel rate limits, warmup schedules, and platform TOS.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Channel Operator for {{businessName}}. You dispatch outreach across every enabled channel. **Cold email:** instantly_create_campaign + instantly_add_leads_to_campaign + instantly_launch_campaign — compose the subject + body with UTM'd link per UTM Convention, batch leads, launch. Use instantly_list_campaigns to check state before creating duplicates. **LinkedIn:** sendpilot_send_connection_request to send connection invites (drops into a pre-configured connect-only campaign, with optional note); once accepted, sendpilot_send_dm to send the actual pitch. Use sendpilot_list_senders first to pick a sender whose status=active (Sendpilot enforces per-account warmup). **Social posts:** social_publish_post across X, LinkedIn, TikTok, Pinterest, Facebook, Instagram, Threads, YouTube — platform enum is lowercase ('twitter', 'linkedin', etc.). **Reddit:** reddit_create_post for direct posting (self=text, link=URL post), reddit_reply_to_post for comments (thing_id t3_ for posts, t1_ for comments). Community posts still require approve_first per Compliance Officer + 4:1 value ratio. log_reddit_target remains available for queue-for-review workflows. **WhatsApp:** whatsapp_send_text_message for warm (24h reply window), whatsapp_send_template_message for cold (Meta-approved template required). **Telegram:** send_telegram_message for warm DMs. **Email close:** send_email for Link Closer's final affiliate-link send. You respect the Channel Rate Limits KB: Instantly daily caps + warmup curve, LinkedIn 20-25 connect requests/day (Sendpilot enforces server-side too), Reddit 1 comment per subreddit per day with 4:1 value ratio. WhatsApp and Telegram are warm-only under TCPA — you NEVER propose cold DMs. You batch by channel, stagger sends, randomize intervals. You log every send with a channel tag + UTM campaign. Compliance Officer flags route to the operator queue — do not ship flagged content without operator override.",
      roleInstructions:
        "Dispatch per channel using the right tool. For Instantly: create campaign → add leads → launch. For Sendpilot: pick active sender → connect request → (after acceptance) DM. For social: social_publish_post. For Reddit: reddit_create_post + reddit_reply_to_post (approve_first on community posts). For WhatsApp: text (warm only) or template (cold, Meta-approved). UTM-tag every link per the UTM Convention KB. Never propose Craigslist. Log every send with channel + UTM campaign.",
      outputStyle:
        "Dispatch summary per run: channel, tool called, count sent, campaign/thread IDs, any throttled or skipped.",
      escalationRules:
        "Escalate before any Reddit or FB Group post (Compliance + operator approval required). Escalate before any batch over 100 contacts in a single day. Escalate if any channel returns a rate-limit or shadow-ban signal. Escalate if Sendpilot sender status=warming for the chosen account (wait for active).",
      tools: [
        "instantly_create_campaign",
        "instantly_add_leads_to_campaign",
        "instantly_launch_campaign",
        "instantly_list_campaigns",
        "instantly_send_reply",
        "sendpilot_send_dm",
        "sendpilot_send_connection_request",
        "sendpilot_list_senders",
        "social_publish_post",
        "reddit_create_post",
        "reddit_reply_to_post",
        "log_reddit_target",
        "whatsapp_send_text_message",
        "whatsapp_send_template_message",
        "send_telegram_message",
        "send_email",
        "manychat_send_content",
        "manychat_send_flow",
        "manychat_add_tag",
        "manychat_set_custom_field",
        "knowledge_lookup"
      ]
    },
    {
      displayName: "Reply Triager",
      emoji: "🧭",
      role: "Inbound Classification & Routing",
      purpose:
        "Reads every inbound reply across all channels. Replies arrive via webhooks (Instantly, WhatsApp, Sendpilot, ManyChat for FB Messenger + IG DMs) into ActivityEntry rows tagged with their provider. Triager queries ActivityEntry via database_query, classifies into Interested / Objection / Not-Now / No / Question / Unsubscribe, then routes via delegate_task to the right specialist.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Reply Triager for {{businessName}}. Every inbound reply lands in the ActivityEntry table via a provider webhook (Instantly, WhatsApp Cloud, Sendpilot, ManyChat for FB Messenger + IG DMs, plus new_email triggers for the business inbox). You pull recent entries via database_query: `SELECT * FROM \"ActivityEntry\" WHERE \"businessId\" = $1 AND type = 'integration' AND status = 'info' AND \"createdAt\" > now() - interval '1 hour' ORDER BY \"createdAt\" DESC` and filter to provider∈('instantly','whatsapp_cloud','sendpilot','manychat'). For each reply you classify into six buckets with an explicit confidence score (0-100): INTERESTED (wants the link, asks to talk) → route to Link Closer via delegate_task. OBJECTION (CPA did this, already filed, not a priority, too expensive, don't trust) → Objection Responder via delegate_task. NOT_NOW (timing issue, come back in N months) → schedule re-touch per the 30/60/90 cadence. NO (explicit no, remove me) → suppress via instantly_list_replies mark + sendpilot_update_lead_status='disqualified' as appropriate. QUESTION (clarifying, not yet objection or interest) → draft a short KB-grounded answer and delegate to operator for review. UNSUBSCRIBE → remove from all sequences immediately, suppress across channels. **Confidence threshold:** route automatically only at confidence ≥80. Between 60-79, draft the routing decision and delegate to operator for one-click approval. Below 60, escalate to operator directly — do NOT auto-route. Explicitly tag the channel of origin in every classification (pulled from the ActivityEntry.metadata.provider field). **ManyChat replies are 24h-windowed** — if the reply is from ManyChat and you need to send a response, use manychat_send_content; it will fail at send-time if the window has closed, in which case escalate to operator to send a Utility Template.",
      roleInstructions:
        "Query ActivityEntry for inbound provider events (instantly / whatsapp_cloud / sendpilot / manychat) via database_query. Classify every inbound into Interested, Objection, Not-Now, No, Question, or Unsubscribe with a confidence score. Route ≥80 confidence automatically via delegate_task. Route 60-79 via operator approval. Below 60, escalate. Explicitly tag channel of origin. For ManyChat replies in window, use manychat_send_content directly for quick replies; escalate if window closed.",
      outputStyle:
        "One JSON-like classification per reply: {bucket, confidence, reason, channel, activityEntryId, route_to, auto_routed: boolean}.",
      escalationRules:
        "Escalate any classification below 60 confidence. Escalate any reply mentioning legal or regulatory concern. Escalate any reply from a multi-unit group. Escalate any reply that sounds like a reporter or investigator.",
      tools: [
        "knowledge_lookup",
        "database_query",
        "delegate_task",
        "instantly_list_replies",
        "sendpilot_list_leads",
        "sendpilot_update_lead_status",
        "manychat_send_content",
        "manychat_get_subscriber_info",
        "manychat_add_tag"
      ]
    },
    {
      displayName: "Objection Responder",
      emoji: "🛡️",
      role: "Objection & Follow-Up Sequencer",
      purpose:
        "Handles the five core objections with KB-stored rebuttals. Manages 30/60/90-day re-touch sequences for Not-Now replies. Keeps rebuttals conservative and trust-building — never argumentative.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Objection Responder for {{businessName}}. You own the rebuttals for the five core objections stored in the Objection Scripts KB: (1) 'My CPA can do this' → trust-but-verify framing, no cost to find out. (2) 'Already filed for this' → free second opinion, DocuSign gives IRS-direct access without CPA involvement. (3) 'Not a good time' → 'what would make the timing right' + phased start. (4) 'Too expensive / what's the fee' → 25% of recovered only, zero upfront, offset protection clause. (5) 'I don't trust this / seems like a scam' → §45B is statutory and predates current administration, Form 8846 is the IRS form, escrow handles payments. You also manage the 30/60/90-day re-touch sequence for Not-Now replies — cadence stored in the Follow-Up KB. You NEVER get argumentative. You NEVER press. You frame every rebuttal as 'here's another way to think about it, and here's what it costs to find out (nothing).' Every rebuttal gets drafted with the UTM parameters from the UTM Convention KB entry so we can attribute which rebuttal brought the prospect back.",
      roleInstructions:
        "Match objection to the five KB rebuttal scripts. Run 30/60/90 re-touch sequences for Not-Now. Never argue, never press, never guarantee. Frame as low-cost verification, not sales. Append UTM params per the UTM Convention KB on every link.",
      outputStyle:
        "Draft reply copy ready to send, 80-140 words. Tone is calm and exploratory, not salesy.",
      escalationRules:
        "Escalate any objection that mentions legal action, regulatory concern, or requests to speak with an attorney.",
      tools: ["knowledge_lookup", "send_email"]
    },
    {
      displayName: "Link Closer",
      emoji: "🔗",
      role: "Conversion Handoff & Link Placement",
      purpose:
        "When a prospect signals interest, sends the outcome infographic + the affiliate link (tiptaxrefund.org/9fpc) with the right CTA. Owns the final step before the prospect signs on the TipTax side.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Link Closer for {{businessName}}. You only engage after Reply Triager flags a prospect as INTERESTED. Your job is to send the outcome infographic (Small Restaurant $25,819 net / Neighborhood Bar $51,638 net / Busy Restaurant Group $154,913 net — see Recovery Scenarios KB) plus the affiliate link tiptaxrefund.org/9fpc, with a short, specific CTA tuned to the prospect's tier from Qualifier. For Tier A prospects you offer the operator's direct number ((410) 404-2880, ask for Dave) as a call-option CTA. For Tier B you lead with link-self-serve and mention the call as a fallback. For Tier C you lead with link only. You ALWAYS label estimates as 'estimated' or 'potential.' You NEVER promise a refund amount. You append UTM parameters per the UTM Convention KB entry — exact format — so attribution is clean and Data Analyst can traceback every signed affiliate to channel + pitch register.",
      roleInstructions:
        "Send infographic + link + tier-matched CTA only after Reply Triager flags INTERESTED. Tier A gets call-option; Tier B link-first with call fallback; Tier C link-only. Always label as 'estimated.' UTM-tag every link per the UTM Convention KB.",
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
        "Funnel B only. Targets sales ops, affiliate marketers, commission-based lead gen agencies, and specific communities listed in the Recruitment Communities KB. Pitches the TipTax downline opportunity — low friction, fast payout, restaurant-vertical. Never uses income guarantees.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Sub-Affiliate Recruiter for {{businessName}}. You drive Funnel B — recruiting sub-affiliates into the owner's downline. Target audiences and specific communities are in the 'Recruitment Communities' KB entry (subreddits, LinkedIn groups, Slack workspaces with URLs and entry criteria). Your pitch angles per the Downline Recruiter Pitch KB: (1) Fast payout — IRS refunds in 4-8 weeks. (2) Low friction — 2-3 minute DocuSign signup, no CPA coordination. (3) Restaurant vertical — sticky, ubiquitous, 70-80% underfiled per program materials. (4) Escrow-paid — no chasing clients for commission. You NEVER make income guarantees. You NEVER quote specific expected earnings. You ALWAYS say 'commissions vary based on volume, deal size, and effort.' You use the Downline Recruiter Pitch KB entry as the anchor and vary per community (a post in r/sales reads different than a LinkedIn DM). You hand high-interest replies to the operator for a direct call — recruiter conversations close on video, not text. You can use social_publish_post to queue LinkedIn / Twitter / Reddit content. You can use log_reddit_target to queue Reddit posts for operator approval. Email drafts go into the operator queue (Instantly is draft-only in beta).",
      roleInstructions:
        "Recruit sub-affiliates via the specific communities in the Recruitment Communities KB. Use the four pitch angles from the Downline Recruiter Pitch KB. Never guarantee income. Always hand interested replies to operator for direct call. Queue Reddit via log_reddit_target; queue Instantly drafts for operator.",
      outputStyle:
        "Recruit copy 150-220 words for cold outreach, 80-120 for community posts. Never income-specific.",
      escalationRules:
        "Escalate every interested reply to operator for direct call. Escalate any message that starts drifting toward income promises. Compliance Officer review on every first-time post to a new community.",
      tools: [
        "social_publish_post",
        "log_reddit_target",
        "knowledge_lookup",
        "web_search"
      ]
    },
    {
      displayName: "Downline Manager",
      emoji: "👥",
      role: "Sub-Affiliate Ops & Enablement",
      purpose:
        "Funnel B only. Once a sub-affiliate signs on, you onboard them, track their pipeline via database_query, nudge underperformers, celebrate wins, and ensure commission split math is transparent. Prevents your downline from going dark.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Downline Manager for {{businessName}}. Once a sub-affiliate is recruited and signed, you own their trajectory. You onboard them with the Downline Playbook (link to the TipTax sign-up portal, the outcome infographic, the four-register pitch library, their own UTM-tagged affiliate link per the UTM Convention KB). You track each sub's pipeline weekly via database_query: prospects in their funnel, outreach volume, signed affiliates, pending refunds. You nudge underperformers after 14 days of inactivity with a light 'here's what's working for others' check-in. You celebrate wins in your downline's Telegram group (so others see momentum). You keep the commission-split math transparent — owner's override is clearly disclosed, sub's portion is the larger chunk (per operator's stated structure). You never pressure subs. You never threaten removal from the downline. You surface blockers (bad territories, bad niches, tech issues) to the operator. If a sub goes silent >30 days after the day-14 nudge, you tag them 'inactive' and stop active enablement until they re-engage.",
      roleInstructions:
        "Onboard every new sub with the Downline Playbook + their UTM-tagged link per UTM Convention KB. Track weekly pipeline via database_query. Nudge inactive subs at day 14. Celebrate wins in the group. Keep commission math transparent. Tag 'inactive' at 30 days post-nudge. Surface blockers to operator.",
      outputStyle:
        "Weekly downline digest: each sub's status, active vs idle, wins, blockers. One-paragraph per sub.",
      escalationRules:
        "Escalate any sub asking for detailed income projections (route through Sub-Affiliate Recruiter's income-guarantee rules). Escalate any sub who appears to be doing non-compliant outreach.",
      tools: [
        "knowledge_lookup",
        "send_email",
        "send_telegram_message",
        "database_query"
      ]
    },
    {
      displayName: "Compliance Officer",
      emoji: "🛡️",
      role: "TCPA / CAN-SPAM / Platform TOS Advisor",
      purpose:
        "Advisory role. Reviews drafted messages against TCPA, CAN-SPAM, and per-platform TOS. Flags non-compliant drafts for operator review via delegate_task. The OPERATOR is the actual gate — Compliance flags, operator acts via approve_first approvals.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Compliance Officer for {{businessName}}. You are ADVISORY, not a runtime gate — you flag, the operator actually gates. Your flags route through delegate_task to Recovery Ops Lead, who surfaces them in the morning digest for operator review. Your rules: (1) TCPA — no unsolicited SMS or WhatsApp to cell numbers the prospect hasn't opted into. Warm-only always. (2) CAN-SPAM — every cold email must have a working unsubscribe link and physical business address. Instantly handles by default; verify on every new campaign setup. (3) Value-ratio rule — Reddit and FB Groups require 4 value-first posts per 1 promo post, and the promo must disclose affiliation. (4) Platform rate limits — per the Channel Rate Limits KB. Exceeding = account risk. (5) Outcome claims — NEVER a specific refund-amount promise. NEVER link §45B to 'no tax on tips' or political policy. NEVER income guarantees in Funnel B. (6) Craigslist — hard block. Template excludes it; any agent that proposes a Craigslist post gets flagged immediately. You run a daily compliance sweep of everything queued to send; you flag non-compliant and delegate back to author for fix. You cite the specific rule triggered in every flag. Your flags that go unactioned for 24h auto-escalate to operator as a 'priority review' item in the next digest.",
      roleInstructions:
        "Review every queued draft (social, Reddit, email, DM, recruiter) against TCPA, CAN-SPAM, platform TOS, value-ratio, outcome claims, income guarantees, and Craigslist exclusion. Flag non-compliant with the specific rule citation. Delegate flags to Recovery Ops Lead for operator review. Auto-escalate un-actioned flags at 24h. You are advisory — the operator is the gate.",
      outputStyle:
        "Flag decisions with specific rule citations. Format: 'FLAG: [draft ID] — [rule] — [specific violation]'. Clean markdown table per sweep.",
      escalationRules:
        "Escalate repeated violations from the same agent or channel to operator — may indicate a misconfigured prompt. Escalate any prospect reply referencing legal action or regulator. Escalate any flag unactioned for 24h.",
      tools: ["knowledge_lookup", "delegate_task"]
    },
    {
      displayName: "Data Analyst",
      emoji: "📊",
      role: "Funnel Metrics & Channel Attribution",
      purpose:
        "Owns daily and weekly metrics via database_query on the pipeline + get_analytics on social posts. Attributes signed affiliates back to channel + message variant via UTM parameters. Flags declining channels before they crater. Recommends budget + effort reallocation.",
      type: "specialist",
      systemPromptTemplate:
        "You are the Data Analyst for {{businessName}}. You own the metrics, using precise definitions from the 'Metric Definitions & Formulas' KB entry — no squishy numbers. Daily (via database_query on pipeline + get_analytics on social): outreach sent per channel, replies received, reply rate (replies / unique prospects contacted), classification breakdown, link clicks, signed affiliates. Weekly: channel CAC (time-cost formula in KB), conversion rate by channel and by pitch register, Tier A vs B vs C conversion deltas, downline sub-affiliate activity. You attribute every signed affiliate back to channel + pitch register via the UTM Convention KB format and the pipeline log. You flag any channel whose reply rate drops >30% week-over-week (warmup degradation, shadow ban, or pitch fatigue). You recommend reallocation — if LinkedIn is converting 3x better than X this month, propose shifting effort there. You ALWAYS include the 'number' — no 'going well' statuses. BETA note: Instantly reply-rate and WhatsApp send-count come from the operator's manual tallies until those MCPs are implemented — state this caveat in every weekly report.",
      roleInstructions:
        "Produce daily channel metrics + weekly attribution + reallocation recommendations using database_query and get_analytics. Use the Metric Definitions & Formulas KB exactly — no invented metrics. Always include the number. Flag any channel with >30% weekly reply-rate drop. UTM-attribute every signed affiliate per the UTM Convention KB. Disclose the beta-caveat on Instantly + WhatsApp data.",
      outputStyle:
        "Structured tables. Lead with headline metric. One-line recommendation per insight. Disclose operator-manual tally sources.",
      escalationRules:
        "Escalate any channel that appears shadow-banned or rate-limited. Escalate any >50% weekly drop in signed affiliates — that's not noise, that's a root cause.",
      tools: ["knowledge_lookup", "database_query", "get_analytics"]
    }
  ],
  starterWorkflows: [
    {
      name: "Daily Prospect Discovery",
      description:
        "Prospect Hunter sources 200-500 new restaurants/bars nationwide sharded by state per the Sourcing Sources KB. Qualifier scores against rubric + worked examples. Emits Tier A/B/C lists into the pipeline. Dedupes via database_query first.",
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
        "7am local: Recovery Ops Lead queries pipeline via Data Analyst delegation, produces funnel snapshot (Funnel A + Funnel B), channel breakdown with automated vs operator-manual send split, any Compliance flags awaiting review, and surfaces one next-best-action.",
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
        "Channel Operator composes pitches from Composer with UTM params per convention, calls instantly_create_campaign (or adds to an existing campaign), adds leads via instantly_add_leads_to_campaign, and launches. Fully automated end-to-end. Warmup-respecting daily caps per Channel Rate Limits KB.",
      trigger: "scheduled",
      output: "report",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "review_after",
      agentRole: "Channel Operator"
    },
    {
      name: "LinkedIn Outreach (Sendpilot)",
      description:
        "Channel Operator picks an active Sendpilot sender via sendpilot_list_senders, sends calibrated connection requests via sendpilot_send_connection_request (drops lead into the connect-only campaign), and once Sendpilot's webhook fires connection.accepted, delegates a DM draft to Link Closer / Objection Responder. Respects AppSumo Tier 2 caps (3 senders / 3,000 leads/mo).",
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
        "Scheduled posts to X, LinkedIn, TikTok, Pinterest, Instagram, Threads, and Facebook via social_publish_post. Uses the outcome-infographic variants as the hook asset. Value-first content mixed with occasional promo per platform rules. All UTM-tagged.",
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
        "Channel Operator uses reddit_create_post (direct via reddit_mcp) for approved content and reddit_reply_to_post for thread replies. Target subs (r/restaurantowners, r/KitchenConfidential, r/smallbusiness, r/Bartender, r/barowners, r/food). 4:1 value-to-promo ratio enforced by Compliance. approve_first mandatory — posts go through Compliance Officer → operator queue before shipping.",
      trigger: "scheduled",
      output: "content_queue",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "approve_first",
      agentRole: "Channel Operator"
    },
    {
      name: "Alignable + FB Groups Infiltration (Operator-Manual)",
      description:
        "Restaurant/bar owner Facebook groups + Alignable local business posts. Operator posts MANUALLY — no public API exists for FB Groups since Meta's April 2024 Graph API deprecation. Warm-member status required before any promo. Value-first ratio enforced. Strategy: post in groups manually with a CTA 'DM the TipTax Page' so ManyChat catches inbound DMs on the Page and routes to Reply Triager.",
      trigger: "scheduled",
      output: "content_queue",
      scheduleMode: "every",
      frequency: "weekly",
      approvalMode: "approve_first",
      agentRole: "Channel Operator"
    },
    {
      name: "TipTax FB/IG Page Engagement Loop",
      description:
        "Channel Operator publishes TipTax restaurant-owner-targeted content to the TipTax FB Page + IG Pro account via social_publish_post. Content invites comments + DMs. When a restaurant owner comments or DMs: ManyChat's comment-to-DM or native DM triggers fire → webhook posts to /api/webhooks/manychat/<businessId> → ActivityEntry → Reply Triager. This is the ONLY Meta-compliant path to restaurant-owner DMs at scale — cold DMs to strangers' Pages are blocked by Meta platform policy. Tag subscribers via manychat_add_tag with source + state for Data Analyst attribution.",
      trigger: "scheduled",
      output: "content_queue",
      scheduleMode: "every",
      frequency: "daily",
      approvalMode: "review_after",
      agentRole: "Channel Operator"
    },
    {
      name: "Reply Triage & Route",
      description:
        "Reply Triager polls ActivityEntry via database_query every 15 min for new inbound events (provider ∈ instantly / whatsapp_cloud / sendpilot / manychat) + catches new_email triggers. Classifies into Interested / Objection / Not-Now / No / Question / Unsubscribe with confidence score. Auto-routes ≥80 via delegate_task, operator-approves 60-79, escalates <60.",
      trigger: "scheduled",
      output: "chat",
      scheduleMode: "every",
      frequency: "15 minutes",
      approvalMode: "auto",
      agentRole: "Reply Triager"
    },
    {
      name: "Objection Follow-Up Sequence",
      description:
        "30/60/90-day re-touch cadence for Not-Now replies. Pulls rebuttal scripts from KB. Rotates channel each touch — Instantly for D30, Sendpilot LinkedIn for D60, Instantly again for D90. Drafts include UTM params per the UTM Convention KB.",
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
        "Funnel B. Weekly outreach to specific communities in the Recruitment Communities KB (subreddits, LinkedIn groups, Slack workspaces). Uses the four recruitment pitch angles. approve_first mandatory — income-guarantee language is a hard block.",
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
        "Funnel B. Downline Manager queries each sub's pipeline via database_query, nudges inactive (>14 days silent), celebrates wins in the Telegram group, surfaces blockers. Tags subs inactive if silent >30 days post-nudge.",
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
        "Compliance Officer reviews all queued-but-unsent drafts (social, Reddit, email drafts, recruiter posts) against TCPA / CAN-SPAM / platform TOS / value-ratio / outcome-claim / income-guarantee / Craigslist-exclusion rules. Flags via delegate_task to Recovery Ops Lead with specific rule citations. Advisory only — operator is the gate via approve_first approvals.",
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
        "Data Analyst uses database_query on pipeline + get_analytics on social posts to produce weekly attribution: signed affiliates by channel + pitch register, reply-rate trends, channel CAC (time-cost formula in Metrics KB), Tier A/B/C conversion deltas, reallocation recommendations. BETA caveat stated: Instantly + WhatsApp metrics from operator manual tallies.",
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
        "{{businessName}} is a private affiliate outreach workforce for the TipTax FICA Tip Credit (IRC §45B) recovery program.\n\n**Affiliate link:** https://tiptaxrefund.org/9fpc\n**Program contact:** Dave, (410) 404-2880\n**Fee to owner's client:** 25% of recovered amount, paid from escrow. Zero upfront. No obligation.\n**Refund cycle:** 4-8 weeks stated; 4-6 weeks typical per program materials.\n\n**Formula (rough):**\n- Reported Tips × 7.65% × Eligible Years = Estimated Gross Recovery\n- Gross × 75% = Net Recovery (after 25% fee)\n\n**Dual funnel:**\n- Funnel A: restaurant/bar owners → affiliate link (the money).\n- Funnel B: sub-affiliate recruitment → downline override (the multiplier).\n\nAffiliates earn a commission on everything in their downline. Sub-affiliates do the primary work on their own book; the owner's override is the smaller portion, the sub keeps the larger portion.\n\n**BETA status:** Automated channels: social posts (social_publish_post), Reddit target queuing (log_reddit_target), Telegram, pipeline data (database_query), social analytics (get_analytics). Draft-only channels (operator sends manually): Instantly cold email, WhatsApp. See the Automation Gaps KB entry."
    },
    {
      category: "about_business",
      title: "Channel Automation Coverage",
      contentTemplate:
        "What runs automatically vs what still requires operator hands.\n\n## Fully automated — outbound\n- **Cold email** via Instantly: `instantly_create_campaign`, `instantly_add_leads_to_campaign`, `instantly_launch_campaign`, `instantly_send_reply`\n- **LinkedIn DMs + connection requests** via Sendpilot: `sendpilot_send_dm`, `sendpilot_send_connection_request`, `sendpilot_list_senders`, `sendpilot_list_leads`, `sendpilot_update_lead_status` (AppSumo Tier 2: 3 senders, 3,000 leads/mo cap)\n- **Social posts** (X, LinkedIn posts, TikTok, Pinterest, FB, IG, Threads, YouTube) via `social_publish_post`\n- **Social post analytics** via `social_get_analytics`\n- **Reddit posts + replies** via `reddit_create_post` / `reddit_reply_to_post` (approve_first on community posts + 4:1 value ratio)\n- **WhatsApp** via `whatsapp_send_text_message` (warm, 24h window) / `whatsapp_send_template_message` (cold via Meta-approved template) / `whatsapp_send_media_message`\n- **Telegram DMs** (warm) via `send_telegram_message`\n- **Warm email close** via `send_email` (Resend)\n\n## Fully automated — prospecting + data\n- **Sourcing**: `scrape_webpage`, `crawl_website`, `browser_navigate`/`browser_click`/`browser_fill_form` against Google Places, Yelp, state license rolls\n- **Pipeline reads**: `database_query` (Prospect Qualifier dedupe, Data Analyst metrics, Downline Manager sub-tracking)\n- **Web search**: `web_search`\n- **Agent coordination**: `delegate_task`\n\n## Fully automated — inbound (unified inbox)\nWebhooks drop events into `ActivityEntry` for the Reply Triager to pick up via `database_query`:\n- `/api/webhooks/instantly/<businessId>` — cold email replies\n- `/api/webhooks/whatsapp/<businessId>` — Meta Cloud inbound\n- `/api/webhooks/sendpilot/<businessId>` — LinkedIn DMs, connection accepts, campaign lifecycle\n- `/api/webhooks/manychat/<businessId>?secret=...` — FB Messenger + Instagram DMs via ManyChat (24h window)\n- `new_email` trigger on the business inbox\n\nReply Triager also has polling fallbacks (`instantly_list_replies`, `sendpilot_list_leads` with status='replied') for when webhooks are unreliable.\n\n## Warm automation (24h window / opt-in required)\n- **Facebook Messenger + Instagram DMs via ManyChat** — `manychat_send_content`, `manychat_send_flow`, `manychat_add_tag`, `manychat_set_custom_field`. 24h window enforced by Meta, not a ManyChat quirk. Valid only AFTER subscriber has messaged our Page/IG or engaged via comment-to-DM / ref link / story reply. Meta deprecated broadcast Message Tags on Feb 9, 2026 — outside the 24h window, use Utility Templates or Marketing Messages API.\n\n## Operator-manual today (no compliant API exists)\n- **Cold FB Messenger + IG DMs to strangers' Pages** — Meta platform policy blocks ALL tools. Not a gap we can close.\n- **X DMs** — Social Media Hub is posts+comments only, no DM tool.\n- **FB Group posts** — Meta deprecated the Groups Graph API in April 2024. No public API since. Operator posts manually; post CTAs should direct comments/DMs to the TipTax Page so ManyChat can catch them.\n- **Alignable posts** — no MCP.\n\n## Explicitly excluded\n- **Craigslist** — no legal API for our categories, TOS damages ($1K/violation), audience isn't there. Do not propose Craigslist posting.\n\n## Required webhook secrets (operator setup)\n- Instantly Integration → encrypted secret `webhook_secret` (shown in Instantly webhook setup)\n- WhatsApp Integration → encrypted secret `app_secret` (Meta app secret) + config `verify_token` (your choice, echoed to Meta)\n- Sendpilot Integration → encrypted secret `webhook_secret` (shown once in Sendpilot webhook setup)\n- ManyChat Integration → encrypted secret `webhook_secret` (your choice). Put the same value as `?secret=<value>` on the webhook URL you configure in ManyChat Dev Tools → External Requests. ManyChat's native signing isn't documented, so we authenticate via shared secret in the URL instead."
    },
    {
      category: "products_services",
      title: "What §45B Actually Is (Verified Facts Only)",
      contentTemplate:
        "These are the facts we anchor every pitch to. Anything not on this list is operator-process and must be framed as 'typically' or 'estimated.'\n\n**Verified:**\n- IRC §45B is a real, long-standing provision of the Internal Revenue Code. It predates any current administration policy.\n- The credit is claimed on IRS Form 8846.\n- It applies to the employer portion of Social Security + Medicare (FICA) paid on employee tips above the §45B minimum-wage floor.\n- Food and beverage employers with customary tipping may claim it, including via amended returns for prior years where applicable.\n- Distributed service charges and mandatory gratuities are treated as non-tip wages and are EXCLUDED.\n- The credit is part of the general business credit; unused credits may carry under IRS rules.\n- Tax years beginning after December 31, 2024 expanded the statute beyond food and beverage to include certain beauty and wellness services.\n\n**NEVER claim as fact (operator-process only, hedge language required):**\n- Specific refund processing times (4-8 weeks is typical per program materials, not guaranteed).\n- Escrow commission distribution mechanics.\n- '70-80% of restaurants have underfiled' — use 'program materials indicate' framing.\n- Claims that bypassing the CPA is safe or necessary."
    },
    {
      category: "processes",
      title: "Prospect Sourcing Sources & URLs",
      contentTemplate:
        "Where Prospect Hunter actually looks. Free or near-free only. No Apollo.\n\n## Google Places (via scrape_webpage + web_search)\n- Search queries: `site:google.com/maps \"restaurant\" \"{city}\"` for discovery\n- Direct: `https://www.google.com/maps/search/restaurants+in+{city}` — scrape result cards for name/address/phone/rating/review count\n- Use web_search with queries like `best bars {city}` or `top restaurants {city}` to surface curated lists\n\n## Yelp (via scrape_webpage)\n- `https://www.yelp.com/search?find_desc=Restaurants&find_loc={city}%2C+{state}`\n- `https://www.yelp.com/search?find_desc=Bars&find_loc={city}%2C+{state}`\n- Individual biz pages: `/biz/{business-slug}` — extract review count, price tier ($$/$$$), categories, photos count (proxy for traffic)\n\n## OpenStreetMap (via Overpass API — free)\n- Endpoint: `https://overpass-api.de/api/interpreter`\n- Query shape:\n  ```\n  [out:json];\n  area[\"name\"=\"{state}\"][\"admin_level\"=\"4\"]->.a;\n  (node[\"amenity\"~\"restaurant|bar|pub|cafe\"](area.a);\n   way[\"amenity\"~\"restaurant|bar|pub|cafe\"](area.a);\n   relation[\"amenity\"~\"restaurant|bar|pub|cafe\"](area.a);\n  );\n  out body;\n  ```\n- Returns name, address, coordinates, contact info when tagged\n\n## State liquor license rolls (most states publish openly)\nTop 20 state URLs — scrape_webpage or browser_navigate:\n- **CA:** https://www.abc.ca.gov/licensing/licensing-reports/ (monthly CSV)\n- **NY:** https://data.ny.gov/Economic-Development/Liquor-Authority-Quarterly-List-of-Active-Licenses/hrvs-fxs2\n- **TX:** https://www.tabc.texas.gov/public-information/public-inquiry/\n- **FL:** https://www.myfloridalicense.com/DBPR/alcoholic-beverages-and-tobacco/\n- **IL:** https://www2.illinois.gov/ilcc/Pages/PublicDatabase.aspx\n- **PA:** https://www.lcb.pa.gov/Licensing/Pages/License-Lookup.aspx\n- **OH:** https://www.com.ohio.gov/liqr/LicenseSearch.aspx\n- **GA:** https://dor.georgia.gov/alcohol-tobacco/licensing/license-search\n- **NC:** https://abc.nc.gov/Permit/Permits/Search\n- **NJ:** https://www.njoag.gov/about/divisions-and-offices/division-of-alcoholic-beverage-control-home/licensees/\n- **VA:** https://www.abc.virginia.gov/licensees/license-lookup\n- **MA:** https://www.mass.gov/lists/liquor-licensees\n- **WA:** https://lcb.wa.gov/records/frequently-requested-lists\n- **AZ:** https://azliquor.gov/query/license_query.cfm\n- **CO:** https://sbg.colorado.gov/business-licenses\n- **MD:** https://comptroller.marylandtaxes.gov/Business_Taxes/Business_Tax_Types/Alcohol_Tax/Statistics/\n- **TN:** https://www.tn.gov/abc/licensing/licensee-lookup.html\n- **MO:** https://atc.dps.mo.gov/licensing/\n- **IN:** https://www.in.gov/atc/enforcement/licensee-lookup/\n- **WI:** https://www.revenue.wi.gov/Pages/ATR/Home.aspx\n\nFor other states, search: `{state} liquor license public database` or `{state} ABC licensee search`.\n\n## State/county health department permits (restaurants)\n- Often available via county level: `{county} health department food permit search`\n- Examples: NYC Open Data https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j\n- LA County: http://publichealth.lacounty.gov/eh/\n\n## Municipal business-license databases\n- Most cities publish active business licenses. Search: `{city} open data business license`\n- NYC: https://data.cityofnewyork.us/Business/Legally-Operating-Businesses/w7w3-xahh\n- Chicago: https://data.cityofchicago.org/Community-Economic-Development/Business-Licenses/r5kz-chrr\n\n## What to capture per prospect (schema for Qualifier)\n```\n{\n  state: string,\n  metro: string,\n  business_name: string,\n  address: string,\n  phone: string?,\n  website: string?,\n  category: 'restaurant' | 'bar' | 'cafe' | 'pub' | 'other',\n  liquor_class: 'full_bar' | 'beer_wine' | 'none' | 'unknown',\n  yelp_review_count: number?,\n  google_review_count: number?,\n  price_tier: '$' | '$$' | '$$$' | '$$$$' | null,\n  online_ordering: ('doordash' | 'ubereats' | 'grubhub' | 'direct')[],\n  multi_unit_hint: boolean,\n  seats_estimate: number | null,\n  source: string  // which URL produced this record\n}\n```\n\n## Daily volume targets (nationwide, sharded)\n- 200-500 prospects/day nationwide\n- Shard by state: aim for 10-20 prospects/day per state across top 20 states, with opportunistic picks in lower-volume states\n- Dedupe against existing pipeline via `database_query` BEFORE emitting — duplicate outreach nukes reputation"
    },
    {
      category: "processes",
      title: "UTM Parameter Convention",
      contentTemplate:
        "Every link in every outreach gets UTM-tagged per this exact format. Used by Link Closer, Objection Responder, Pitch Composer, Sub-Affiliate Recruiter, Data Analyst.\n\n## The format\n```\nhttps://tiptaxrefund.org/9fpc\n  ?utm_source={channel}\n  &utm_medium={medium}\n  &utm_campaign={campaign_slug}\n  &utm_content={pitch_register}\n  &utm_term={tier_or_subnet}\n```\n\n## Field values (exact vocabulary — don't invent)\n\n**utm_source** — the originating channel:\n- `instantly` — cold email via Instantly\n- `linkedin` — LinkedIn post or DM\n- `twitter` — X (the enum is `twitter` for the Social Media Hub)\n- `tiktok` — TikTok\n- `facebook` — Facebook post or group\n- `instagram` — Instagram\n- `pinterest` — Pinterest\n- `threads` — Threads\n- `youtube` — YouTube\n- `reddit` — Reddit post or comment\n- `alignable` — Alignable post or DM\n- `telegram` — Telegram DM\n- `whatsapp` — WhatsApp DM\n- `referral` — sub-affiliate referral\n\n**utm_medium**:\n- `email` — cold or warm email\n- `dm` — direct message (any platform)\n- `post` — public social post\n- `comment` — reply to someone else's post\n- `group` — FB/LinkedIn group post\n- `subreddit` — Reddit post\n- `referral` — affiliate-to-affiliate\n\n**utm_campaign** — slug for the outreach campaign:\n- `tier_a_restaurants` — Tier A prospects from Qualifier\n- `tier_b_restaurants` — Tier B\n- `tier_c_restaurants` — Tier C\n- `multi_unit_groups` — 3+ location operators\n- `funnel_b_recruit` — sub-affiliate recruitment\n- `followup_d30` / `followup_d60` / `followup_d90` — objection follow-up touches\n- `win_back` — re-engagement for silent NOT_NOW prospects\n\n**utm_content** — which pitch register was used:\n- `polished`\n- `street_simple`\n- `high_authority`\n- `blended`\n- `recruiter_angle_1_fast_payout`\n- `recruiter_angle_2_low_friction`\n- `recruiter_angle_3_sticky_vertical`\n- `recruiter_angle_4_escrow_paid`\n\n**utm_term** — optional sub-identifier:\n- For recruiter: specific community (e.g., `r_sales`, `r_affiliatemarketing`, `linkedin_saas_sales`)\n- For Funnel A: state abbreviation (e.g., `tx`, `ca`, `ny`)\n- Leave blank if not useful\n\n## Examples\n\n**Tier A restaurant in Texas, polished register, Instantly email:**\n```\nhttps://tiptaxrefund.org/9fpc?utm_source=instantly&utm_medium=email&utm_campaign=tier_a_restaurants&utm_content=polished&utm_term=tx\n```\n\n**Sub-affiliate recruitment on r/sales, fast-payout angle:**\n```\nhttps://tiptaxrefund.org/9fpc?utm_source=reddit&utm_medium=subreddit&utm_campaign=funnel_b_recruit&utm_content=recruiter_angle_1_fast_payout&utm_term=r_sales\n```\n\n**Day-60 follow-up to a previous Not-Now, via LinkedIn DM:**\n```\nhttps://tiptaxrefund.org/9fpc?utm_source=linkedin&utm_medium=dm&utm_campaign=followup_d60&utm_content=blended\n```\n\n## Rules\n- ALL lowercase. No spaces (use underscores).\n- Never invent new source/medium values — extend this KB entry first.\n- Never strip UTM — every link ALWAYS has it.\n- Data Analyst parses these for attribution. Invented values = broken attribution."
    },
    {
      category: "processes",
      title: "Metric Definitions & Formulas",
      contentTemplate:
        "Data Analyst uses these exact definitions. No invented metrics.\n\n## Per-channel daily metrics\n- **outreach_sent**: count of sends per channel per day (draft-only channels count as 'queued for operator' separately)\n- **replies_received**: count of distinct inbound messages in response to our outreach\n- **reply_rate** = `replies_received / unique_prospects_contacted` (NOT per send — dedupe contacts in denominator)\n- **link_clicks**: count of clicks on our UTM'd affiliate link, attributed by utm_source\n- **click_rate** = `link_clicks / outreach_sent`\n- **signed_affiliates**: count of prospects who completed TipTax DocuSign signup, attributed by UTM\n- **conversion_rate** = `signed_affiliates / unique_prospects_contacted`\n\n## Channel CAC (time-cost formula)\n- `CAC_channel = (operator_minutes_per_week_on_channel × $operator_hourly_rate / 60) / signed_affiliates_from_channel_per_week`\n- Operator hourly rate default: **$150/hr** (adjust in business config if different)\n- For channels that also have external cost (e.g., Instantly subscription, residential proxy fees): add `/ 4.33` weekly amortization\n\n## Pitch-register attribution\n- Read `utm_content` per signed affiliate\n- `register_conversion_rate = signed_affiliates_per_register / outreach_sent_per_register`\n- Compare across registers weekly — reallocation signal\n\n## Tier conversion deltas\n- `tier_a_conversion_rate`, `tier_b_conversion_rate`, `tier_c_conversion_rate`\n- Expected ordering: A > B > C. If B > A, something is wrong with Qualifier's scoring — escalate.\n\n## Channel health flags (trigger investigation)\n- **Reply rate drop >30% WoW**: warmup degradation, shadow ban, or pitch fatigue\n- **Click rate drop >40% WoW**: link issue or pitch-hook fatigue\n- **Conversion rate drop >50% WoW**: root cause — escalate immediately\n- **Zero signed affiliates for 14 consecutive days on a channel**: channel is dead — reallocate\n\n## Downline (Funnel B) metrics\n- **active_subs_count**: subs with at least one outreach sent this week\n- **idle_subs_count**: subs with no outreach in last 14 days\n- **inactive_subs_count**: subs flagged inactive (30+ days silent post-nudge)\n- **sub_signed_affiliates**: count of signed affiliates attributed to each sub\n- **downline_override_revenue**: sum of owner's override on sub-signed affiliates this period\n\n## Reporting cadence\n- Daily: pipeline snapshot (Recovery Ops Lead consumes)\n- Weekly: attribution + reallocation (Data Analyst produces)\n- Monthly: channel CAC + downline override revenue\n\n## BETA caveats (state in every weekly report)\n- Instantly reply-rate: operator manual tally until MCP implemented\n- WhatsApp send-count: operator manual tally until MCP implemented\n- LinkedIn DM send-count: operator manual tally (no DM MCP exists)"
    },
    {
      category: "processes",
      title: "Sub-Affiliate Recruitment Communities",
      contentTemplate:
        "Where Sub-Affiliate Recruiter actually posts. Specific, verified as active (April 2026). Check each for current rules before posting — communities change TOS often.\n\n## Subreddits (via log_reddit_target, approve_first)\n- **r/sales** (~750k members) — direct sales ops. Strict self-promo rules — use value-first posts, no direct pitches.\n  - Weekly self-promo thread (check sidebar) is the ONLY place for direct pitches.\n- **r/affiliatemarketing** (~200k) — more receptive to programs. Still value-first ratio applies.\n- **r/sidehustle** (~2M) — broad audience, B2B side gigs fit.\n- **r/Entrepreneur** (~4M) — very strict self-promo rules, almost impossible to post direct pitches. Value content only; link in profile/comments.\n- **r/smallbusiness** (~2M) — restaurant owners sometimes here too (Funnel A), but valuable for Funnel B content angles.\n- **r/digital_marketing** (~200k) — affiliate marketers adjacent audience.\n- **r/salestechniques** (~50k) — tighter, more technical, higher-quality engagement.\n\n## LinkedIn Groups (via operator manual post — no group API in social_media_mcp)\n- **Sales Best Practices** (~350k members)\n- **Sales Gravy** (~130k)\n- **Affiliate Marketing Experts** (~80k)\n- **The Sales Hunter** (~120k)\n- **Sales Innovators** (~90k)\n- **Revenue Collective** (~50k — invite-based, worth applying to)\n- Search approach: LinkedIn > Groups > filter by Sales / Marketing / Side Hustle / Small Business. Prioritize groups with weekly posts and visible admin moderation (dead groups waste time).\n\n## Slack + Discord workspaces\nCheck current status (these change — some may be inactive by 2026):\n- **Revenue Collective** (Slack, paid membership ~$2k/yr) — premium B2B sales community, highest-ROI for sub-affiliate recruitment if budget allows\n- **Modern Sales Pros** (Slack, paid) — senior sales ops\n- **Pavilion** (Slack, paid) — sales leaders\n- **Side Hustle Nation** (Discord, free) — broad side-hustle audience\n- **SaaS Nation** (Slack) — SaaS-adjacent, BDRs and salespeople often cross over\n- **Indie Hackers** (various channels) — bootstrapper audience, affiliate-friendly\n- Research: search `{niche} slack community` and `{niche} discord invite` on Reddit + Google\n\n## LinkedIn direct DM (operator manual — no DM MCP)\nTargeting criteria for LinkedIn Sales Navigator searches:\n- Current role: 'Affiliate Marketer,' 'Sales Representative,' 'Business Development,' 'BDR,' 'Account Executive'\n- Between jobs (open to work), 1-3 years experience\n- Skills: 'Cold Outreach,' 'Affiliate Marketing,' 'Lead Generation,' 'B2B Sales'\n- Exclude: 'Restaurant' (they could be dual-funnel leads instead — send to Funnel A)\n\n## Other directories\n- **AffiliateWP / Affiliate Marketing Forum**: `https://www.affiliateinsider.com/` — affiliate marketing news + community\n- **STM Forum** (affiliate marketing, paid): `https://stmforum.com/` — aggressive affiliate marketers, higher intent\n- **AffLIFT** (affiliate forum, paid tier): `https://afflift.com/` — newer, growing\n- **Warrior Forum** (free tier) — check self-promo thread\n\n## Always use the Downline Recruiter Pitch KB entry as the anchor. Vary per community:\n- **r/sales post**: casual, peer-to-peer. 'Anyone here running restaurant-vertical affiliate? Fast payout + escrow — thoughts?'\n- **LinkedIn post**: professional, numbers-focused. '4-8 week IRS refund cycle is changing affiliate economics for restaurant services. Worth a look.'\n- **Slack DM (warm)**: casual-direct. 'Saw your post in X — thought this might match. Nothing to buy, just worth a look if you have restaurant-adjacent clients.'\n\n## What to avoid\n- Never quote specific income expectations — always 'varies by effort.'\n- Never post the same message across multiple communities (pattern-detected, shadow-banned).\n- Never cold-DM on LinkedIn without a connection request first (unless InMail credits available).\n- Never join a community and post a pitch in the first week — read the room, contribute value."
    },
    {
      category: "processes",
      title: "Worked Scoring Examples",
      contentTemplate:
        "Five examples for Qualifier to calibrate against. Same format as the Scoring Rubric KB — score 1-10 + tier + recovery band.\n\n---\n\n## Example 1 — 'Luigi's Italian Kitchen'\n**Data from Hunter:**\n- State/metro: MA / Boston\n- Category: restaurant (full-service Italian)\n- Seats: 60 (estimated)\n- Liquor class: full bar (confirmed via MA liquor search)\n- Yelp review count: 840\n- Google review count: 1,200\n- Price tier: $$$\n- Online ordering: DoorDash + UberEats (moderate)\n- Multi-unit: no\n- Website: yes\n\n**Scoring:**\n- Seats 60 = strong baseline\n- Full-service Italian + full bar = tips-heavy\n- 840+1200 reviews = high traffic\n- $$$ = higher ticket, higher tip $ per txn\n- Moderate delivery = slight tipping dilution\n- Single location = no multi-unit bonus\n\n**Score: 8 (Tier A)**\n**Estimated recovery band:** $40K-$100K NET (3-year lookback, 25% fee)\n**Notes:** Tier A; hit first; attach polished register.\n\n---\n\n## Example 2 — 'The Cozy Cat Coffee'\n**Data from Hunter:**\n- State/metro: OR / Portland\n- Category: cafe\n- Seats: 25 (estimated)\n- Liquor class: none\n- Yelp review count: 320\n- Google review count: 450\n- Price tier: $$\n- Online ordering: DoorDash only\n- Multi-unit: no\n- Website: yes\n\n**Scoring:**\n- Coffee shop + no liquor = moderate tip volume per txn\n- 25 seats = small\n- 320+450 reviews = decent traffic\n- $$ = lower ticket\n- DoorDash = some delivery tipping dilution\n\n**Score: 4 (Tier C)**\n**Estimated recovery band:** $5K-$15K NET\n**Notes:** Tier C; lower priority. Use street-simple register. Email only, no direct call.\n\n---\n\n## Example 3 — 'Blackstone Tavern Group' (multi-unit)\n**Data from Hunter:**\n- State/metro: TX / Dallas-Fort Worth\n- Category: bar/restaurant hybrid\n- Seats per location: 80-120\n- Liquor class: full bar (all locations)\n- Total Yelp reviews across locations: 4,500+\n- Price tier: $$$-$$$$\n- Online ordering: minimal\n- Multi-unit: YES — 6 locations\n- Website: yes, corporate\n\n**Scoring:**\n- Multi-unit = compounding recovery\n- Full bar + tavern = tips-very-heavy\n- 6 locations × large size = substantial annual tips\n- High review count = strong traffic\n\n**Score: 10 (Tier A + Multi-unit flag)**\n**Estimated recovery band:** $200K-$500K+ NET\n**Notes:** FLAG FOR OPERATOR MANUAL HANDLING — do not automate outreach. Operator calls Dave at (410) 404-2880 first to align on approach for multi-unit groups, then uses high-authority register for any initial contact. Likely a 30-60 min video call is the actual close here.\n\n---\n\n## Example 4 — 'Joe's Pizza' (corner slice shop)\n**Data from Hunter:**\n- State/metro: NY / Manhattan\n- Category: restaurant (pizza by the slice)\n- Seats: 10 (counter service primarily)\n- Liquor class: beer/wine\n- Yelp review count: 180\n- Google review count: 250\n- Price tier: $\n- Online ordering: heavy (all 3 platforms)\n- Multi-unit: no\n- Website: minimal\n\n**Scoring:**\n- Counter service = lower tipping %\n- Small seats + $ tier = small ticket\n- Heavy delivery = significant tipping dilution\n- 180+250 reviews = moderate traffic but low tip density\n\n**Score: 3 (Tier C)**\n**Estimated recovery band:** $3K-$8K NET\n**Notes:** Tier C, probably not worth automated outreach at this size. Deprioritize.\n\n---\n\n## Example 5 — 'The Rooftop' (upscale urban bar)\n**Data from Hunter:**\n- State/metro: IL / Chicago\n- Category: bar (rooftop cocktail)\n- Seats: 120 (including rooftop seating)\n- Liquor class: full bar\n- Yelp review count: 1,800\n- Google review count: 2,400\n- Price tier: $$$$\n- Online ordering: none (dine-in only)\n- Multi-unit: no\n- Website: yes, strong\n\n**Scoring:**\n- Upscale cocktail bar = highest tip % (no delivery dilution)\n- $$$$ = highest ticket per customer\n- 120 seats = substantial capacity\n- 1,800+2,400 reviews = very high traffic\n- No delivery = clean tips\n\n**Score: 9 (Tier A)**\n**Estimated recovery band:** $80K-$200K NET\n**Notes:** Tier A, high priority. Polished register + call-option CTA. Likely multi-year high-volume tips.\n\n---\n\n## Rules when scoring\n- Default to the LOWER tier if signals are mixed\n- Always flag multi-unit regardless of score\n- Note any conflicting data in 'Notes' — don't paper over it\n- Pizza/fast-casual/counter-service consistently underperform vs full-service; trust the pattern\n- Upscale bars consistently overperform; trust the pattern\n- If no liquor and no waitstaff, score drops by 2-3 points (less tip volume)"
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
        "**Rebuttal (evidence-led, calm):**\n\n'Fair skepticism. This isn't new legislation — §45B has been in the Internal Revenue Code for years. It predates the current administration and has nothing to do with the \"no tax on tips\" proposal; that's a different thing.\n\nThe filing vehicle is IRS Form 8846. The CPAs handling this are licensed tax professionals, not a scheme. IRS refunds go through an escrow services company, not directly to us — so there's no scenario where we hold your money.\n\nHappy to send over the exact statutory reference if that helps.'\n\n**Never:** get defensive. The skepticism is rational; meet it with facts."
    },
    {
      category: "processes",
      title: "Downline Recruiter Pitch — Funnel B Core Message",
      contentTemplate:
        "**Target audiences:** sales ops between deals, affiliate marketers with an existing CRM, commission lead-gen shops, SaaS BDRs doing side hustles, specific communities in the Recruitment Communities KB.\n\n**Four pitch angles (utm_content values map to these — use the right one per send):**\n\n1. **Fast payout** (`recruiter_angle_1_fast_payout`) — IRS refunds in 4-8 weeks. Vs. B2B sales cycles that can drag 6+ months.\n2. **Low friction** (`recruiter_angle_2_low_friction`) — Owner signs in 2-3 minutes via DocuSign. No CPA coordination. No document upload.\n3. **Sticky vertical** (`recruiter_angle_3_sticky_vertical`) — Restaurants/bars are ubiquitous, every metro has thousands. Program materials indicate 70-80% have underfiled.\n4. **Escrow-paid** (`recruiter_angle_4_escrow_paid`) — You never chase clients for commission. Escrow distributes to all parties simultaneously.\n\n**Never (hard block):**\n- 'You'll make $X'\n- 'Typical earnings are $X'\n- 'Guaranteed income'\n- Any specific income figure as an expectation.\n\n**Always:**\n- 'Commissions vary based on volume, deal size, and effort.'\n- Offer a direct call with the operator for interested recruits (don't try to close Funnel B via text alone).\n- UTM-tag every link per the UTM Convention KB."
    },
    {
      category: "processes",
      title: "Channel Rate Limits & Warmup Schedules",
      contentTemplate:
        "Per-channel limits. Exceeding = account risk OR a hit to your monthly cap.\n\n**Instantly (cold email — instantly_create_campaign + add_leads + launch):**\n- Week 1: 20/day per inbox. Week 2: 40/day. Week 3: 60/day. Week 4+: up to 100/day per inbox.\n- Maintain reply tracking + bounce rate <5%.\n- CAN-SPAM: unsubscribe link + physical address in every send — Instantly handles by default.\n- No hard account cap on leads — scales with inboxes + warmup.\n\n**Sendpilot LinkedIn (AppSumo Lifetime Tier 2 caps — HARD LIMITS):**\n- **3 LinkedIn senders** (connected accounts).\n- **3,000 leads per month** across the whole workspace.\n- **3,000 extractions per month** (scrape / search pulls).\n- **3,000 enrichments per month**.\n- Per-account LinkedIn safety (enforced by Sendpilot server-side): ~20-25 connection requests/day, ~50-75 DMs/day (warm only, 1st-degree connections), spread across senders.\n- **Monthly planning math:** 3,000 leads ÷ 30 days = ~100 LinkedIn leads/day max across all 3 senders. Combined with Instantly email at ~200/day per inbox, plan total daily outbound accordingly so you don't burn the monthly Sendpilot cap in the first week.\n- **Sender rotation:** Channel Operator must call sendpilot_list_senders and only use senders with status='active' — status='warming' means Sendpilot hasn't finished account aging; using it triggers LinkedIn flags.\n- Upgrade path: Tier 3 lifts to 5 senders / 8,000 leads. Team monthly plan is different.\n\n**Other social posts (via social_publish_post — X, LinkedIn posts, TikTok, Pinterest, Facebook, Instagram, Threads, YouTube):**\n- LinkedIn: 1 post/day max (algorithmic suppression beyond that).\n- X: 5-10 posts/day max, mix of value + 1-2 promos.\n- TikTok / Instagram / Pinterest / Threads / YouTube: per Social Media Hub defaults — aggregator enforces.\n\n**Reddit (via reddit_create_post + reddit_reply_to_post, or log_reddit_target for approve_first queue):**\n- 1 comment per subreddit per day.\n- 4:1 value-to-promo ratio — 4 helpful posts before 1 promo.\n- Never cross-post the same promo to multiple subs same day.\n- Compliance Officer gates every community-channel post.\n\n**WhatsApp (whatsapp_send_text_message / whatsapp_send_template_message):**\n- WARM ONLY for text messages (24h reply window per Meta rules).\n- COLD requires whatsapp_send_template_message with a Meta-approved template.\n- TCPA rules apply — no cold SMS/WhatsApp to cell numbers unless opted in.\n\n**FB Messenger + Instagram DMs via ManyChat (manychat_send_content / manychat_send_flow):**\n- WARM ONLY — 24h window enforced by Meta, not ManyChat.\n- Subscriber must have messaged our Page/IG or engaged via comment-to-DM / ref link / story reply first.\n- Message Tags were deprecated Feb 9, 2026 — outside 24h window, use Utility Template or Marketing Messages API (EU excluded).\n- COLD DMs to strangers' Pages: NOT POSSIBLE via any compliant tool. Meta blocks at platform layer.\n- ~200 automated DMs/hr/account rate cap on Instagram per Meta.\n- Per-subscriber: do not spam (1-2 messages per 24h window max to avoid being reported).\n\n**Telegram (send_telegram_message):**\n- WARM ONLY. TCPA same rules.\n\n**X / LinkedIn DMs (native — no DM API):**\n- X DMs not automatable via Social Media Hub. Operator-manual.\n- LinkedIn DMs now automated via Sendpilot (see above).\n\n**FB Groups (operator-manual):**\n- Warm-member status (approved + commented before) required before any promo.\n- 1 promo post per group per month max.\n\n**Alignable (operator-manual):**\n- Local B2B community; value-first posts; 1 promo/week max per account.\n\n**Craigslist: EXCLUDED.** Do not propose. See Automation Gaps KB."
    },
    {
      category: "processes",
      title: "Follow-Up Cadence (30/60/90)",
      contentTemplate:
        "For prospects classified as NOT_NOW by Reply Triager.\n\n**Day 30:** Light check-in. Different channel from original touch. One-liner: 'Following up — any timing change on that tip-credit review?' UTM campaign `followup_d30`.\n\n**Day 60:** Value-add touch. Send a short piece of content (article link, infographic variant, case-style scenario). No ask. Just 'thought this might be useful.' UTM `followup_d60`.\n\n**Day 90:** Final touch. Direct: 'Closing out this thread on my end — if timing changes, ping me. Otherwise good luck.' UTM `followup_d90`. This works because it removes pressure. Many re-engagements happen after this touch because the prospect now feels they've 'lost' the option and wants it back.\n\n**After Day 90:** Quarterly low-touch only. Don't burn the relationship. UTM `win_back` campaign."
    },
    {
      category: "contacts",
      title: "Operator + Program Contacts",
      contentTemplate:
        "**Operator (you):** beardfacebeard@gmail.com\n\n**Program contact (for warm handoffs):**\n- Dave — (410) 404-2880\n- Primary affiliate link: https://tiptaxrefund.org/9fpc\n- Website: https://tiptaxrefund.org\n\n**When to hand off to Dave directly:**\n- Multi-unit groups (3+ locations)\n- Complex multi-state operators\n- Any prospect asking for an hour+ deep-dive\n- Any CFO/controller who wants a technical walkthrough\n\n**Never hand off:**\n- Single-location prospects in Tier B/C — the link self-serves\n- Anyone who hasn't explicitly signaled high interest (otherwise you burn Dave's time)"
    },
    {
      category: "policies",
      title: "Compliance Non-Negotiables",
      contentTemplate:
        "**TCPA (SMS + WhatsApp):** NEVER cold to a cell number. Warm-only, opted-in, or reply-thread continuation. Relevant law: 47 USC §227; FCC rules at 47 CFR §64.1200.\n\n**CAN-SPAM (email):** Every cold send must have a working unsubscribe link and a physical business address. Instantly handles by default — verify on every new campaign. Relevant law: 15 USC §7701-7713.\n\n**Outcome promises:** NEVER guarantee a refund amount. ALWAYS hedge with 'estimated,' 'potential,' 'typical.'\n\n**§45B framing:** NEVER link it to 'no tax on tips' or current administration policy. It's statutory and predates both.\n\n**CPA framing:** NEVER tell owner their CPA is bad or to fire them. Frame as 'second opinion' or 'verification.'\n\n**Income guarantees (Funnel B):** NEVER quote specific expected earnings for sub-affiliates. ALWAYS 'commissions vary based on volume, deal size, and effort.' Relevant: FTC guidance on earnings claims (16 CFR §437 for business opportunity rule, though may not strictly apply; treat as best practice anyway).\n\n**Community channels (Reddit, FB Groups, Alignable):** Compliance Officer + operator approve_first BEFORE any post. 4:1 value-to-promo ratio. Disclosure of affiliation in any promo (FTC 16 CFR §255).\n\n**Craigslist: HARD BLOCK.** Template excludes. Any proposal to post to Craigslist gets flagged and escalated. Reasons: no legal posting API for services category, TOS liquidated damages ($1K/violation, $3K/day), audience is absent in 2026. See the Automation Gaps KB entry.\n\n## Value-first content examples (what counts as 'value' on Reddit/FB Groups)\n- **Value post example #1:** Post about a restaurant operations topic (labor costs, seasonal staffing, POS choice) with genuine insight and no link.\n- **Value post example #2:** Answer a question someone asked in the community with specific, useful info — no self-reference.\n- **Value post example #3:** Share a data point or chart relevant to the community (e.g., average tip % trends by region) with source cited.\n- **Value post example #4:** Amplify another member's post with a genuine comment (not a copy-paste).\n- **Promo post example (AFTER 4 value posts):** 'Running into a tax-credit program for restaurants — thought folks here might find it useful. [brief intro to §45B, link].'\n\n## What is NOT value\n- Any post with your link in the body or first comment\n- Any post that starts with 'DM me for details'\n- Any post that's a subtle pitch disguised as a question ('Has anyone heard of §45B credits? asking for a friend' — the community sees through this)"
    },
    {
      category: "custom",
      title: "Scoring Rubric — Prospect Qualifier",
      contentTemplate:
        "How the Qualifier scores prospects 1-10. Pair with the 'Worked Scoring Examples' KB entry for calibration.\n\n**Inputs (higher = higher score):**\n- Seat count or employee count (10+ seats baseline; 50+ is strong)\n- Cuisine/service style: full-service restaurants and bars = strong; fine dining = strongest (big tickets + tipping); coffee shops = moderate (high volume but smaller tips per txn); fast-casual without tipping = weak\n- Yelp review count as traffic proxy (500+ reviews = meaningful volume)\n- Google rating volume (similar)\n- Online ordering presence (DoorDash/UberEats-heavy = DILUTES tipping % → slight negative)\n- Liquor license class (full bar > beer-wine > none)\n- Multi-unit signal (same owner/EIN across multiple locations) = compounding — flag for operator manual\n\n**Score bands → estimated recovery (3-year lookback, 25% fee, NET):**\n- 9-10: $100K-$300K+ (target direct call, not email)\n- 7-8: $40K-$100K (Tier A — highest priority email/DM)\n- 5-6: $15K-$40K (Tier B — main batch)\n- 3-4: $5K-$15K (Tier C — lower priority)\n- 1-2: <$5K (skip or rare deep-discount outreach)\n\n**Always label:** 'estimated' or 'potential range.' Never guaranteed.\n\n**Default to LOWER tier when signals mixed.** Better to be pleasantly surprised than to over-invest on a bad signal.\n\n**Multi-unit flag overrides score** — always route 3+ locations to operator manual, regardless of score."
    }
  ],
  starterWorkspaceDocs: [
    {
      filePath: "AGENTS.md",
      category: "core",
      tier: "hot",
      contentTemplate:
        "# {{businessName}} — Agent Workforce\n\n## Recovery Ops Lead (main) 🦅\nOwns the daily pipeline digest and specialist coordination. Routes Compliance Officer flags to the operator queue. Three operational gates: (1) Compliance flags surfaced in every digest. (2) Any batch over 100 contacts requires explicit operator approval. (3) Any outcome-promise language routes to Objection Responder for rewrite.\n\n## Funnel A — Restaurant Owner Acquisition\n- **Prospect Hunter 🎯** — sources 200-500 qualified restaurants/day via scrape_webpage + crawl_website + browser_* against Google Places, Yelp, OSM, state license rolls. Sourcing URLs in KB. Never Apollo.\n- **Prospect Qualifier 🔍** — scores 1-10 using the rubric + worked examples KB. Validates Hunter data via scrape_webpage when signals conflict. Maps to Tier A/B/C and estimated recovery bands.\n- **Pitch Composer ✍️** — picks 1 of 4 KB registers per prospect. UTM-tags every link per UTM Convention KB.\n- **Channel Operator 📡** — fully automated dispatch: Instantly (create_campaign + add_leads + launch), Sendpilot (send_dm + send_connection_request), social_publish_post across 8 platforms, reddit_create_post / reddit_reply_to_post, whatsapp_send_text_message + whatsapp_send_template_message, send_telegram_message, ManyChat (manychat_send_content + manychat_send_flow for warm FB/IG replies).\n- **Reply Triager 🧭** — polls ActivityEntry every 15min for webhook events (Instantly / WhatsApp / Sendpilot / ManyChat). Classifies with confidence score. Auto-routes ≥80 via delegate_task, operator-approves 60-79, escalates <60.\n- **Objection Responder 🛡️** — 5 KB rebuttals + 30/60/90 follow-up with channel rotation (Instantly → Sendpilot → Instantly).\n- **Link Closer 🔗** — sends outcome infographic + tiptaxrefund.org/9fpc with tier-matched CTA. UTM-tagged.\n\n## Funnel B — Sub-Affiliate Recruitment\n- **Sub-Affiliate Recruiter 🤝** — targets specific communities in Recruitment Communities KB with 4 pitch angles. NEVER income guarantees.\n- **Downline Manager 👥** — onboards subs, tracks weekly pipeline via database_query, nudges inactive at day 14, tags inactive at day 30 post-nudge.\n\n## Compliance & Analytics\n- **Compliance Officer 🛡️** — ADVISORY. Flags non-compliant drafts with specific rule citations. Routes flags to Recovery Ops Lead via delegate_task. Operator is the actual gate via approve_first.\n- **Data Analyst 📊** — daily channel metrics + weekly attribution via database_query + social_get_analytics + instantly_get_campaign_analytics. Uses Metric Definitions KB for formulas.\n\n## Rules\n- No guaranteed refund amounts. Ever.\n- §45B is statutory, predates 'no tax on tips.' Never link them.\n- CPA framing: 'trust but verify,' never 'your CPA is bad.'\n- Funnel B: no income guarantees. 'Commissions vary based on volume, deal size, and effort.'\n- Community platforms: approve_first + 4:1 value ratio + disclosure.\n- **Craigslist: excluded.** See Channel Automation Coverage KB for why.\n- Every link gets UTM parameters per the UTM Convention KB — no exceptions.\n\n## Sendpilot caps (AppSumo Lifetime Tier 2)\n- 3 LinkedIn senders (connected accounts).\n- 3,000 leads/month across the workspace — plan ~100/day max.\n- 3,000 extractions/month, 3,000 enrichments/month.\n- Channel Operator MUST check sendpilot_list_senders and only use status='active' accounts."
    },
    {
      filePath: "WORKFLOWS.md",
      category: "templates",
      tier: "warm",
      contentTemplate:
        "# {{businessName}} — Workflow Schedule\n\n## Daily\n- **Daily Prospect Discovery** (auto) — Hunter sources 200-500 new restaurants, Qualifier scores using rubric + worked examples, emits Tier A/B/C.\n- **Daily Pipeline Digest** (7am local, auto) — Recovery Ops Lead — full funnel metrics via Data Analyst delegation + Compliance flags queue + one next-best-action.\n- **Email Cold Outreach Batch (Instantly)** (review_after) — Channel Operator: create_campaign → add_leads → launch. UTM-tagged.\n- **LinkedIn Outreach (Sendpilot)** (review_after) — Channel Operator: sendpilot_list_senders (pick active) → sendpilot_send_connection_request. Post-acceptance webhook triggers DM flow.\n- **Social Broadcast Wave** (review_after) — Channel Operator across 8 platforms via social_publish_post. UTM-tagged.\n- **Reddit Value-First Posting** (approve_first) — reddit_create_post / reddit_reply_to_post through Compliance + 4:1 value ratio.\n- **Reply Triage & Route** (scheduled every 15 min, auto) — Reply Triager polls ActivityEntry for webhook events (Instantly + WhatsApp + Sendpilot) + catches new_email. Auto-routes ≥80 confidence.\n- **Objection Follow-Up Sequence** (review_after) — 30/60/90 re-touch rotates Instantly → Sendpilot → Instantly. UTM campaigns.\n- **Daily Compliance Sweep** (auto) — Compliance Officer flags non-compliant via delegate_task to Recovery Ops Lead.\n\n## Daily (continued)\n- **TipTax FB/IG Page Engagement Loop** (review_after) — Channel Operator publishes restaurant-owner content to TipTax FB Page + IG via social_publish_post. ManyChat catches comment-to-DM and native DM events → Reply Triager handles.\n\n## Weekly\n- **Alignable + FB Groups Infiltration (Operator-Manual)** (approve_first) — FB Groups have no public posting API since Meta's April 2024 deprecation. Operator posts manually with a CTA directing replies to TipTax Page so ManyChat can catch the inbound DM.\n- **Sub-Affiliate Recruitment Push** (approve_first) — Funnel B to specific communities.\n- **Downline Weekly Check-In** (review_after) — database_query each sub, nudge inactive, celebrate wins.\n- **Weekly Funnel Attribution Report** (review_after) — Data Analyst; instantly_get_campaign_analytics + social_get_analytics + manychat_list_subscribers_by_tag + database_query.\n\n## Approval Defaults\n- Any community-channel post (Reddit / FB Groups / Alignable) = approve_first.\n- Any batch > 100 contacts = manual operator approval via delegate_task.\n- Funnel B recruitment = approve_first (income-language risk).\n- Funnel A email/social/LinkedIn = review_after (auto-sent then sampled).\n- FB/IG Page posts = review_after (auto-sent; agent enforces brand voice).\n- Infrastructure (hunting, triage, compliance sweep) = auto.\n\n## Webhook endpoints to configure (one-time setup)\n- Instantly → https://<host>/api/webhooks/instantly/<businessId>  (secret: webhook_secret on Instantly Integration)\n- WhatsApp → https://<host>/api/webhooks/whatsapp/<businessId>   (app_secret + verify_token on WhatsApp Integration)\n- Sendpilot → https://<host>/api/webhooks/sendpilot/<businessId> (webhook_secret on Sendpilot Integration)\n- ManyChat → https://<host>/api/webhooks/manychat/<businessId>?secret=<value> (webhook_secret on ManyChat Integration; same value in URL query)"
    },
    {
      filePath: "DOWNLINE_PLAYBOOK.md",
      category: "knowledge",
      tier: "warm",
      contentTemplate:
        "# {{businessName}} — Downline Playbook (Funnel B)\n\n## The math\nOwner (you) recruits sub-affiliates. Subs do the primary work on their own book of business. When a sub's client signs with TipTax and a refund lands, commission splits:\n- **Sub** gets the larger portion (the majority — they did the work).\n- **You** get an override on their production (smaller portion, but passive and recurring).\n\nThis is a multiplier, not a replacement for Funnel A.\n\n## Who to recruit\n- Sales operators between deals (B2B SaaS, insurance, financial services) — they have CRM + outreach muscle\n- Affiliate marketers already running other programs (they'll add this as another revenue stream)\n- Commission lead-gen shops (small agencies)\n- Side-hustle seekers with sales background — communities in the Recruitment Communities KB\n\n## Who NOT to recruit\n- Anyone asking for income guarantees up front (they'll churn when reality doesn't match)\n- Anyone with no outreach experience (they'll burn through leads with bad pitches)\n- Anyone asking you to do the work for them (defeats the multiplier)\n\n## Onboarding steps (when a sub signs on)\n1. Add them to the downline Telegram group.\n2. Share the TipTax sign-up portal link for new affiliates.\n3. Share the outcome infographic + 4-register pitch library (copy from this workspace's KB).\n4. Issue them their UTM-tagged version of /9fpc for attribution — use utm_source=referral, utm_campaign=funnel_b_recruit, utm_term={their_handle}.\n5. Walk them through Channel Rate Limits KB — many will try to blast day 1 and nuke their Instantly inbox.\n6. Commit to a 14-day check-in rhythm.\n\n## The 14-day rule\nIf a sub hasn't moved a prospect through their funnel in 14 days, Downline Manager sends a light nudge: 'here's what's working for others this week' + a link to a winning pitch variant. NOT a pressure message.\n\nIf they go silent 30+ days after nudge: Downline Manager tags them 'inactive' and stops active enablement until they re-engage. Do not remove from downline — just stop spending effort on them.\n\n## Compliance in the downline\n- You are responsible for what your subs do. Bad compliance in your downline = TipTax could suspend the whole branch.\n- Every new sub gets the Compliance Non-Negotiables KB entry on day 1.\n- Downline Manager flags any sub whose outreach appears non-compliant (TCPA violation, income-guarantee language in public posts, etc.) immediately.\n\n## What you never say to subs\n- 'You'll make $X per month.'\n- 'Typical earnings are $Y.'\n- 'If you do X hours, you'll close Y deals.'\n\n## What you always say\n- 'Commissions vary based on volume, deal size, and effort.'\n- 'Here's the pitch library that's working this week.'\n- 'Here's what a top-performing sub did differently this month.' (with numbers but without implying guarantees)"
    }
  ]
};
