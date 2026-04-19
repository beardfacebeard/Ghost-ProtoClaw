import { BUSINESS_TEMPLATES } from "@/lib/templates/business-templates";

import type {
  WorkflowApprovalMode,
  WorkflowLibraryItem,
  WorkflowOutputKey,
  WorkflowScheduleMode,
  WorkflowTriggerKey
} from "./types";

function slug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asTrigger(value: string | undefined): WorkflowTriggerKey {
  const allowed: WorkflowTriggerKey[] = [
    "manual",
    "scheduled",
    "webhook",
    "new_email",
    "new_lead",
    "new_comment"
  ];
  return allowed.includes(value as WorkflowTriggerKey)
    ? (value as WorkflowTriggerKey)
    : "manual";
}

function asOutput(value: string | undefined): WorkflowOutputKey {
  const allowed: WorkflowOutputKey[] = [
    "chat",
    "telegram",
    "report",
    "draft",
    "crm_note",
    "content_queue"
  ];
  return allowed.includes(value as WorkflowOutputKey)
    ? (value as WorkflowOutputKey)
    : "chat";
}

function asScheduleMode(
  value: string | undefined
): WorkflowScheduleMode | undefined {
  const allowed: WorkflowScheduleMode[] = ["cron", "every", "definition_only"];
  return allowed.includes(value as WorkflowScheduleMode)
    ? (value as WorkflowScheduleMode)
    : undefined;
}

function asApprovalMode(value: string | undefined): WorkflowApprovalMode {
  const allowed: WorkflowApprovalMode[] = [
    "auto",
    "notify",
    "approve_first",
    "review_after"
  ];
  return allowed.includes(value as WorkflowApprovalMode)
    ? (value as WorkflowApprovalMode)
    : "review_after";
}

/**
 * Extract every starter workflow defined across every business template so
 * users can pull them into any business regardless of which template that
 * business originally activated.
 */
function extractTemplateWorkflows(): WorkflowLibraryItem[] {
  const items: WorkflowLibraryItem[] = [];
  for (const template of BUSINESS_TEMPLATES) {
    for (const workflow of template.starterWorkflows) {
      items.push({
        id: `template__${template.id}__${slug(workflow.name)}`,
        name: workflow.name,
        description: workflow.description,
        category: template.name,
        tags: [...template.tags, template.category],
        source: `${template.icon} ${template.name} template`,
        icon: template.icon,
        trigger: asTrigger(workflow.trigger),
        output: asOutput(workflow.output),
        outputs: [asOutput(workflow.output)],
        scheduleMode: asScheduleMode(workflow.scheduleMode),
        frequency: workflow.frequency,
        approvalMode: asApprovalMode(workflow.approvalMode)
      });
    }
  }
  return items;
}

const CORE_LIBRARY_SOURCE = "✨ Core Library";

/**
 * 25 curated power workflows that don't belong to any single business
 * template. These cover marketing, sales, content, ops, customer success,
 * and research — useful starting points for any business.
 */
export const CORE_WORKFLOWS: WorkflowLibraryItem[] = [
  {
    id: "core__daily_content_brief",
    name: "Daily Content Brief",
    description:
      "Morning brief with trending topics, content angles, and one ready-to-post hook for the day.",
    category: "Growth & Marketing",
    tags: ["content", "daily", "trends"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📰",
    trigger: "scheduled",
    output: "report",
    outputs: ["report", "telegram"],
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "review_after"
  },
  {
    id: "core__weekly_seo_audit",
    name: "Weekly SEO Audit",
    description:
      "Surfaces keyword opportunities, competitor movements, and content gaps worth filling this week.",
    category: "Growth & Marketing",
    tags: ["seo", "weekly", "research"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🔎",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  },
  {
    id: "core__linkedin_post_queue",
    name: "LinkedIn Post Queue",
    description:
      "Drafts five LinkedIn posts for the upcoming week grounded in your audience, products, and current wins.",
    category: "Growth & Marketing",
    tags: ["linkedin", "content", "weekly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "💼",
    trigger: "scheduled",
    output: "content_queue",
    outputs: ["content_queue", "draft"],
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "approve_first"
  },
  {
    id: "core__x_daily_thread",
    name: "X/Twitter Daily Thread",
    description:
      "Picks one angle for the day and drafts a scroll-stopping thread based on your brand voice and goals.",
    category: "Growth & Marketing",
    tags: ["twitter", "x", "content", "daily"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🧵",
    trigger: "scheduled",
    output: "draft",
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "approve_first"
  },
  {
    id: "core__newsletter_digest",
    name: "Weekly Newsletter Digest",
    description:
      "Compiles the week's published content, wins, and key insights into a newsletter draft ready to personalize.",
    category: "Growth & Marketing",
    tags: ["newsletter", "weekly", "content"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📬",
    trigger: "scheduled",
    output: "draft",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "approve_first"
  },
  {
    id: "core__cold_outreach_sequence",
    name: "Cold Outreach Sequence",
    description:
      "Drafts a four-email cold sequence (intro, value, soft-ask, close) tailored to a specific prospect and offer.",
    category: "Growth & Marketing",
    tags: ["outreach", "sales", "email"],
    source: CORE_LIBRARY_SOURCE,
    icon: "✉️",
    trigger: "manual",
    output: "draft",
    approvalMode: "approve_first"
  },
  {
    id: "core__landing_page_rewrite",
    name: "Landing Page Copy Rewrite",
    description:
      "Takes an existing page, diagnoses clarity and conversion issues, and drafts a rewritten version.",
    category: "Growth & Marketing",
    tags: ["copy", "conversion", "landing-page"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🧱",
    trigger: "manual",
    output: "draft",
    approvalMode: "review_after"
  },
  {
    id: "core__lead_scoring_pulse",
    name: "Lead Scoring Pulse",
    description:
      "Scores new leads against your ICP, ranks them hot/warm/cold, and recommends next best action.",
    category: "Sales & Revenue",
    tags: ["sales", "leads", "daily"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🎯",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "review_after"
  },
  {
    id: "core__proposal_generator",
    name: "Proposal Generator",
    description:
      "Builds a polished proposal from a client brief, your past proposals, and current pricing.",
    category: "Sales & Revenue",
    tags: ["sales", "proposal", "draft"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📑",
    trigger: "manual",
    output: "draft",
    approvalMode: "approve_first"
  },
  {
    id: "core__churn_risk_alert",
    name: "Churn Risk Alert",
    description:
      "Weekly scan for at-risk customers with reasons, signals, and recommended save plays.",
    category: "Customer Success",
    tags: ["churn", "retention", "weekly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "⚠️",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "notify"
  },
  {
    id: "core__win_loss_retrospective",
    name: "Win/Loss Retrospective",
    description:
      "Monthly synthesis of closed deals — patterns in wins, reasons for losses, and coaching suggestions.",
    category: "Sales & Revenue",
    tags: ["sales", "analysis", "monthly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📊",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "monthly",
    approvalMode: "review_after"
  },
  {
    id: "core__upsell_opportunity_scan",
    name: "Upsell Opportunity Scan",
    description:
      "Identifies customers ready for an upsell or cross-sell based on usage, tenure, and recent signals.",
    category: "Customer Success",
    tags: ["upsell", "expansion", "weekly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📈",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  },
  {
    id: "core__tiktok_hook_generator",
    name: "TikTok Hook Generator",
    description:
      "Produces ten scroll-stopping short-form hooks from a topic or product, tuned to your voice.",
    category: "Content & Creator",
    tags: ["tiktok", "short-form", "hooks"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🎬",
    trigger: "manual",
    output: "draft",
    approvalMode: "review_after"
  },
  {
    id: "core__youtube_script_outline",
    name: "YouTube Script Outline",
    description:
      "Beat-by-beat long-form script outline with A-roll lines, B-roll cues, and CTA placement.",
    category: "Content & Creator",
    tags: ["youtube", "script", "long-form"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🎥",
    trigger: "manual",
    output: "draft",
    approvalMode: "review_after"
  },
  {
    id: "core__repurpose_to_shorts",
    name: "Repurpose to Shorts",
    description:
      "Takes a long-form piece and slices it into five short-form ideas with ready-to-shoot scripts.",
    category: "Content & Creator",
    tags: ["repurpose", "short-form", "content"],
    source: CORE_LIBRARY_SOURCE,
    icon: "✂️",
    trigger: "manual",
    output: "content_queue",
    outputs: ["content_queue", "draft"],
    approvalMode: "review_after"
  },
  {
    id: "core__podcast_show_notes",
    name: "Podcast Show Notes",
    description:
      "Episode summary, timestamped chapters, pull-quotes, and a share-ready CTA.",
    category: "Content & Creator",
    tags: ["podcast", "show-notes", "content"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🎙️",
    trigger: "manual",
    output: "draft",
    approvalMode: "review_after"
  },
  {
    id: "core__ugc_creator_brief",
    name: "UGC Creator Brief",
    description:
      "Structured brief with hook options, talking points, shot list, and brand rules for a UGC creator.",
    category: "Content & Creator",
    tags: ["ugc", "brief", "creator"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📋",
    trigger: "manual",
    output: "draft",
    approvalMode: "approve_first"
  },
  {
    id: "core__daily_ops_digest",
    name: "Daily Ops Digest",
    description:
      "Five-point morning standup — yesterday's wins, today's priorities, blockers, and decisions needed.",
    category: "Operations",
    tags: ["ops", "daily", "standup"],
    source: CORE_LIBRARY_SOURCE,
    icon: "☀️",
    trigger: "scheduled",
    output: "chat",
    outputs: ["chat", "telegram"],
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "auto"
  },
  {
    id: "core__weekly_metrics_snapshot",
    name: "Weekly Metrics Snapshot",
    description:
      "All KPIs in one view with week-over-week deltas and a short read on what's working.",
    category: "Operations",
    tags: ["metrics", "weekly", "kpi"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📐",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  },
  {
    id: "core__sop_gap_finder",
    name: "SOP Gap Finder",
    description:
      "Monthly sweep that flags undocumented processes spotted in chats and runs, and drafts starter SOPs.",
    category: "Operations",
    tags: ["sop", "process", "monthly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🧩",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "monthly",
    approvalMode: "review_after"
  },
  {
    id: "core__expense_anomaly_check",
    name: "Expense Anomaly Check",
    description:
      "Weekly review of spending with anomalies, duplicates, and categories trending out of budget.",
    category: "Operations",
    tags: ["finance", "weekly", "anomaly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "💸",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "notify"
  },
  {
    id: "core__new_customer_welcome_pack",
    name: "New Customer Welcome Pack",
    description:
      "Drafts a personalized welcome email with onboarding resources the moment a new customer arrives.",
    category: "Customer Success",
    tags: ["onboarding", "welcome", "automation"],
    source: CORE_LIBRARY_SOURCE,
    icon: "👋",
    trigger: "new_lead",
    output: "draft",
    approvalMode: "approve_first"
  },
  {
    id: "core__feedback_digest",
    name: "Customer Feedback Digest",
    description:
      "Weekly synthesis of customer feedback themes from reviews, support, and surveys — with priority scores.",
    category: "Customer Success",
    tags: ["feedback", "weekly", "voc"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🗣️",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  },
  {
    id: "core__competitor_price_tracker",
    name: "Competitor Price Tracker",
    description:
      "Weekly snapshot of competitor pricing changes with positioning implications for your offers.",
    category: "Research & Intelligence",
    tags: ["competitor", "pricing", "weekly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🏷️",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  },
  {
    id: "core__agent_self_scan",
    name: "Agent Self-Scan",
    description:
      "Each morning your lead agent audits its own open loops — pending delegations, overdue approvals, stalled workflows, and unresolved goals — and posts a short digest so nothing slips.",
    category: "Operations",
    tags: ["agent", "self-scan", "accountability", "daily"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🧭",
    trigger: "scheduled",
    output: "chat",
    outputs: ["chat", "telegram"],
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "auto"
  },
  {
    id: "core__reddit_audience_scanner",
    name: "Reddit Audience Scanner",
    description:
      "Scans target subreddits on a schedule for posts matching your ICP signals, drafts helpful-first replies, and queues them in /admin/targets for one-click review. Also posts a digest to chat + Telegram.",
    category: "Growth & Marketing",
    tags: ["reddit", "outreach", "content", "community"],
    source: CORE_LIBRARY_SOURCE,
    icon: "👾",
    trigger: "scheduled",
    output: "chat",
    outputs: ["chat", "telegram", "report"],
    scheduleMode: "every",
    frequency: "6 hours",
    approvalMode: "auto"
  },
  {
    id: "core__hn_signal_scanner",
    name: "Hacker News Signal Scanner",
    description:
      "Watches HN stories and comments for your target keywords. Drafts helpful, context-aware replies for high-signal threads (HN readers are sensitive to self-promo, so drafts lean on value first). Queues them in /admin/targets; digest to chat + Telegram.",
    category: "Growth & Marketing",
    tags: ["hackernews", "outreach", "b2b", "developer"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🔶",
    trigger: "scheduled",
    output: "chat",
    outputs: ["chat", "telegram", "report"],
    scheduleMode: "every",
    frequency: "6 hours",
    approvalMode: "auto"
  },
  {
    id: "core__stackoverflow_pain_scanner",
    name: "Stack Overflow Pain Scanner",
    description:
      "Finds unanswered or underserved questions tagged with your target stack. Drafts a concrete, technically correct answer that solves the question and discloses affiliation when relevant. Queues in /admin/targets; digest to chat + Telegram.",
    category: "Growth & Marketing",
    tags: ["stackoverflow", "developer", "support", "outreach"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📚",
    trigger: "scheduled",
    output: "chat",
    outputs: ["chat", "telegram", "report"],
    scheduleMode: "every",
    frequency: "12 hours",
    approvalMode: "auto"
  },
  {
    id: "core__broll_text_overlay_pack",
    name: "B-Roll + Text Overlay Pack",
    description:
      "Generates 3–5 ready-to-assemble scene packs: each has a hook line, an ordered text-overlay sequence, matched Pexels B-roll URLs, and a platform-specific caption. Drop the URLs into CapCut and you have a scene in 5–10 minutes. Queues in /admin/clips; digest to chat + Telegram.",
    category: "Content & Creator",
    tags: ["video", "broll", "short-form", "pexels"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🎞️",
    trigger: "manual",
    output: "chat",
    outputs: ["chat", "telegram"],
    approvalMode: "auto"
  },
  {
    id: "core__ai_avatar_weekly_batch",
    name: "AI Avatar Weekly Batch",
    description:
      "Weekly batch of 5 HeyGen avatar videos — founder-voice talking heads built from the current week's content pillar and offer ladder. Disclosure rules enforced. Final URLs delivered to chat + Telegram.",
    category: "Content & Creator",
    tags: ["heygen", "avatar", "video", "weekly"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🎤",
    trigger: "scheduled",
    output: "chat",
    outputs: ["chat", "telegram"],
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "approve_first"
  },
  {
    id: "core__creatify_hook_variations",
    name: "Creatify Hook Variation Batch",
    description:
      "For one active product/angle, generates 10–20 Creatify UGC variations across hook types and angles — each as a separate job. Poll-and-collect the finished URLs. Use for cost-efficient hook testing before pouring budget into winners.",
    category: "Content & Creator",
    tags: ["creatify", "ugc", "hook-testing", "volume"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🧪",
    trigger: "manual",
    output: "chat",
    outputs: ["chat", "telegram"],
    approvalMode: "auto"
  },
  {
    id: "core__auto_clip_long_form",
    name: "Auto-Clip Long-Form",
    description:
      "Hand it a long-form URL (YouTube or an R2-hosted mp4). Submits to Klap (or Opus Clip once configured) and polls until clips are ready. Returns the list of generated clip URLs for review in chat.",
    category: "Content & Creator",
    tags: ["auto-clip", "klap", "opus-clip", "long-form"],
    source: CORE_LIBRARY_SOURCE,
    icon: "✂️",
    trigger: "manual",
    output: "chat",
    outputs: ["chat", "telegram"],
    approvalMode: "auto"
  },
  {
    id: "core__video_to_shorts_clip_miner",
    name: "Video-to-Shorts Clip Miner",
    description:
      "Feed it a YouTube URL in chat. The agent fetches the real transcript, scans for the 5–10 strongest clip-worthy moments, and queues each one with exact timestamps, a hook, and a platform-specific caption in /admin/clips. You cut them manually — we never auto-cut.",
    category: "Content & Creator",
    tags: ["video", "shorts", "tiktok", "youtube", "clips"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🎬",
    trigger: "manual",
    output: "chat",
    outputs: ["chat", "telegram"],
    approvalMode: "auto"
  },
  {
    id: "core__github_competitor_issue_radar",
    name: "GitHub Competitor Issue Radar",
    description:
      "Monitors configured competitor repositories for new issues and discussions. Scores each for fit with your ICP, drafts a reply that acknowledges the issue and offers your approach as an alternative. Queues in /admin/targets.",
    category: "Growth & Marketing",
    tags: ["github", "competitor", "developer", "outreach"],
    source: CORE_LIBRARY_SOURCE,
    icon: "🐙",
    trigger: "scheduled",
    output: "chat",
    outputs: ["chat", "telegram", "report"],
    scheduleMode: "every",
    frequency: "12 hours",
    approvalMode: "auto"
  },
  {
    id: "core__market_trend_radar",
    name: "Market Trend Radar",
    description:
      "Weekly industry news and signals worth acting on, filtered for your niche and annotated with takeaways.",
    category: "Research & Intelligence",
    tags: ["trends", "weekly", "market"],
    source: CORE_LIBRARY_SOURCE,
    icon: "📡",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  }
];

const SOLO_SOURCE = "🚀 Solopreneur Growth Stack";

/**
 * Solopreneur Growth Stack — marketing and operating workflows for a
 * founder-led product, course, or tool business. Designed around
 * short-form content, UGC, affiliate, and weekly growth reviews.
 */
export const SOLOPRENEUR_WORKFLOWS: WorkflowLibraryItem[] = [
  {
    id: "solo__daily_content_engine",
    name: "Daily Content Engine",
    description:
      "Three content hooks every morning — one X thread, one TikTok, one LinkedIn — anchored in audience pain and current offers.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "content", "daily"],
    source: SOLO_SOURCE,
    icon: "🎯",
    trigger: "scheduled",
    output: "draft",
    outputs: ["draft", "telegram"],
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "review_after"
  },
  {
    id: "solo__weekly_growth_review",
    name: "Weekly Growth Review",
    description:
      "Funnel snapshot, what moved the numbers, and three prioritized experiments to run next week.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "growth", "weekly"],
    source: SOLO_SOURCE,
    icon: "📈",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  },
  {
    id: "solo__short_form_idea_generator",
    name: "Short-Form Idea Generator",
    description:
      "Turns one pillar topic into ten short-form scripts with hooks, beats, CTAs, and visual cues.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "short-form", "content"],
    source: SOLO_SOURCE,
    icon: "✨",
    trigger: "manual",
    output: "content_queue",
    outputs: ["content_queue", "draft"],
    approvalMode: "review_after"
  },
  {
    id: "solo__tiktok_shop_spotlight",
    name: "TikTok Shop Product Spotlight",
    description:
      "Picks a product from your catalog and drafts a creator-style script that feels native to TikTok Shop.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "tiktok", "ecommerce"],
    source: SOLO_SOURCE,
    icon: "🛒",
    trigger: "scheduled",
    output: "draft",
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "review_after"
  },
  {
    id: "solo__ugc_request_queue",
    name: "UGC Request Queue",
    description:
      "Weekly list of UGC briefs to send to creators, matched to upcoming launches and current content gaps.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "ugc", "weekly"],
    source: SOLO_SOURCE,
    icon: "🎬",
    trigger: "scheduled",
    output: "content_queue",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "approve_first"
  },
  {
    id: "solo__affiliate_outreach",
    name: "Affiliate & Partner Outreach",
    description:
      "Drafts personalized outreach to potential affiliates, creators, and cross-promo partners.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "affiliate", "partnerships"],
    source: SOLO_SOURCE,
    icon: "🤝",
    trigger: "manual",
    output: "draft",
    approvalMode: "approve_first"
  },
  {
    id: "solo__support_reply_drafter",
    name: "Support Reply Drafter",
    description:
      "When a support email lands, drafts a reply grounded in your KB and brand voice for one-click review.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "support", "email"],
    source: SOLO_SOURCE,
    icon: "💬",
    trigger: "new_email",
    output: "draft",
    approvalMode: "approve_first"
  },
  {
    id: "solo__lead_magnet_funnel_check",
    name: "Lead Magnet Funnel Check",
    description:
      "Weekly review of opt-in rates, drop-off steps, and two quick fixes to ship before next week.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "funnel", "weekly"],
    source: SOLO_SOURCE,
    icon: "🧲",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "review_after"
  },
  {
    id: "solo__course_module_planner",
    name: "Course Module Planner",
    description:
      "Outlines a new module with lessons, exercises, transformation promise, and a short sales angle.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "course", "curriculum"],
    source: SOLO_SOURCE,
    icon: "🎓",
    trigger: "manual",
    output: "draft",
    approvalMode: "review_after"
  },
  {
    id: "solo__launch_war_room",
    name: "Launch Week War Room",
    description:
      "During launch week, a rolling snapshot of sales, traffic, conversations, and the next best move.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "launch", "daily"],
    source: SOLO_SOURCE,
    icon: "🚨",
    trigger: "scheduled",
    output: "report",
    outputs: ["report", "telegram"],
    scheduleMode: "every",
    frequency: "daily",
    approvalMode: "auto"
  },
  {
    id: "solo__monthly_scorecard",
    name: "Monthly Solopreneur Scorecard",
    description:
      "Revenue, CAC, LTV, active pipeline, and one bold prediction for the next month.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "metrics", "monthly"],
    source: SOLO_SOURCE,
    icon: "🏆",
    trigger: "scheduled",
    output: "report",
    scheduleMode: "every",
    frequency: "monthly",
    approvalMode: "review_after"
  },
  {
    id: "solo__founder_newsletter_weekly",
    name: "Founder Newsletter (Weekly)",
    description:
      "Drafts a personal founder-voice newsletter — lesson, story, and a soft CTA to your flagship offer.",
    category: "Solopreneur Growth",
    tags: ["solopreneur", "newsletter", "weekly"],
    source: SOLO_SOURCE,
    icon: "✉️",
    trigger: "scheduled",
    output: "draft",
    scheduleMode: "every",
    frequency: "weekly",
    approvalMode: "approve_first"
  }
];

let cachedLibrary: WorkflowLibraryItem[] | null = null;

export function getWorkflowLibrary(): WorkflowLibraryItem[] {
  if (cachedLibrary) {
    return cachedLibrary;
  }
  const combined = [
    ...CORE_WORKFLOWS,
    ...SOLOPRENEUR_WORKFLOWS,
    ...extractTemplateWorkflows()
  ];
  const seen = new Set<string>();
  const deduped: WorkflowLibraryItem[] = [];
  for (const item of combined) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  cachedLibrary = deduped;
  return deduped;
}

export function getWorkflowLibraryCategories(): string[] {
  const categories = new Set<string>();
  for (const item of getWorkflowLibrary()) {
    categories.add(item.category);
  }
  return Array.from(categories).sort();
}

export function getWorkflowLibraryItem(
  id: string
): WorkflowLibraryItem | undefined {
  return getWorkflowLibrary().find((item) => item.id === id);
}
