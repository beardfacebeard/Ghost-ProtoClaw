/**
 * Help Center knowledge base.
 *
 * This module is the single source of truth for the in-app Help section.
 * Both the /admin/help page UI and the Help Assistant chatbot pull from
 * the same articles so they never drift out of sync.
 *
 * Articles are written in plain English for non-technical users.
 */

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  /** Markdown-ish prose. Rendered as paragraphs/bullets — no HTML injection. */
  body: string;
  /** Related in-app links a user might want to jump to. */
  links?: Array<{ label: string; href: string }>;
  /** Search keywords the chatbot and client search can match against. */
  keywords?: string[];
};

export type HelpSection = {
  id: string;
  title: string;
  description: string;
  articles: HelpArticle[];
};

export const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description:
      "If this is your first time here, start with these. They walk you through the whole setup from signing in to having your first AI agent running.",
    articles: [
      {
        id: "what-is-ghost-protoclaw",
        title: "What is Ghost ProtoClaw?",
        summary:
          "A plain-English overview of what this app does for you.",
        body: `Ghost ProtoClaw is your AI business control panel. Think of it as the cockpit where you set up AI workers ("agents"), give them jobs to do ("workflows"), connect them to the tools you already use (like email and your CRM), and watch over everything they do.

You don't have to write any code. You don't have to understand how the AI works under the hood. You describe the work you want done in plain English, approve what matters, and the system takes care of the rest.

A good way to picture it: if you hired a small team of virtual assistants, this app is the place where you would:

• Define what each assistant is good at
• Give them step-by-step playbooks to follow
• Connect them to your email, your contacts, and your files
• Review their work before it goes out (if you want to)
• Keep an eye on costs and activity

Everything they learn, everything they do, and everything they produce lives inside this app.`,
        keywords: ["overview", "introduction", "about", "what does this do"],
      },
      {
        id: "first-steps",
        title: "Your first 15 minutes",
        summary: "The shortest path from \"just deployed\" to \"my AI is working.\"",
        body: `Here's the order I recommend:

1. Create a business. Click Businesses → Create. A business is a folder that groups together the agents, workflows, and knowledge for one operation. If you only have one company, make one. If you run several, make one per company.

2. Pick a template when you create it. Templates (like "TikTok Shop" or "UGC Creator") come with starter agents, workflows, and a knowledge base pre-filled. You can change anything later — the template just saves you from building from scratch.

3. Add your OpenRouter key under Settings → AI Providers. OpenRouter is the service that gives the AI access to models like Claude, GPT, and Gemini from one API key. You only need one key. If you deployed via the Railway template, this is already filled in.

4. Meet your agents. Click Agents. Each agent has a name, personality, and set of tools. Open one and chat with it to see how it responds. If the tone is off, edit its system prompt.

5. Run your first workflow. Click Workflows. Pick one, click Run, and review the output. Most workflows have an "approval mode" — you can require your sign-off before anything goes out.

6. Check Health. Click Health (bottom of the sidebar). Green checks across the board means everything is wired up correctly.

If anything here is unclear, type a question to the Help Assistant on this page.`,
        links: [
          { label: "Create a business", href: "/admin/businesses/create" },
          { label: "AI Provider settings", href: "/admin/settings" },
          { label: "Agents", href: "/admin/agents" },
          { label: "Workflows", href: "/admin/workflows" },
          { label: "Health", href: "/admin/health" },
        ],
        keywords: ["setup", "first time", "quickstart", "onboarding"],
      },
      {
        id: "deploy-from-railway",
        title: "Deploying your copy (Railway)",
        summary: "How click-to-deploy works and what you need to bring.",
        body: `This app is designed to be deployed with a single click from Railway. You get your own private copy — your data stays on your infrastructure, not someone else's.

What you need before clicking Deploy:

• An OpenRouter API key (free to sign up at openrouter.ai)
• A Resend API key for email (free to sign up at resend.com)
• A Railway account (free to start)

When you click the template link, Railway spins up six services for you:

• Ghost ProtoClaw — this app
• OpenClaw — runs the AI jobs
• Hermes, Codex, Claude Code — three specialized runtimes
• Postgres — the database that stores your agents, workflows, and knowledge

The first deploy takes 5–10 minutes. When it's done, you'll see one public URL (your Ghost ProtoClaw app). Sign in with the admin email and password you set when deploying.

If a service stays red, click it in Railway → Deployments → View Logs. The error will almost always point at a missing environment variable.`,
        keywords: ["railway", "deploy", "install", "hosting"],
      },
    ],
  },
  {
    id: "core-features",
    title: "Core Features",
    description:
      "The five main building blocks of the app. Understand these and you understand everything.",
    articles: [
      {
        id: "businesses",
        title: "Businesses",
        summary: "What a business is and why you'd have more than one.",
        body: `A business is a container. Each business has its own agents, its own workflows, its own knowledge base, and its own integrations. They don't share data unless you explicitly move something across.

Use cases:

• Running one company → one business.
• Running a main company and a side project → two businesses.
• Agency running client operations → one business per client.

You can switch between businesses from the top bar. Most pages show you data from the business you currently have selected.

When you create a business, you'll be offered a template. Templates pre-fill agents, workflows, and a starter knowledge base so you're not staring at a blank screen. Nothing in a template is locked — you can rename, edit, or delete any piece of it.`,
        links: [{ label: "Businesses", href: "/admin/businesses" }],
        keywords: ["business", "workspace", "multi-tenant", "clients"],
      },
      {
        id: "agents",
        title: "Agents",
        summary: "Your AI workers — what they are and how to customize them.",
        body: `An agent is an AI worker. Each agent has:

• A name and optional emoji
• A system prompt — this is the personality and instructions. Think of it as the job description you'd give a new hire.
• A model — the underlying AI (e.g. Claude Opus 4.6, GPT-4o). You pick which one it uses.
• Tools — what it's allowed to do. E.g. send an email, look something up in the knowledge base, or call a specialist agent.
• An escalation rule — what happens when it gets stuck.

Every business has one Main Agent (the general-purpose one) and as many specialist agents as you want. Specialists handle narrow jobs — a "Content Writer" agent, a "Customer Support" agent, a "Research" agent.

You can chat with any agent directly from the Chat page to test it. If the answers are off, go back to the agent and edit its system prompt. It's the single biggest lever you have.`,
        links: [{ label: "Agents", href: "/admin/agents" }],
        keywords: ["agent", "ai worker", "assistant", "bot"],
      },
      {
        id: "workflows",
        title: "Workflows",
        summary: "Automated playbooks your agents follow on a schedule or trigger.",
        body: `A workflow is an automation. Instead of asking an agent to do something in chat, you define it once and let it run.

Each workflow has:

• A trigger — manual (you click Run), scheduled (every day at 9am), or webhook (something else kicks it off).
• Steps — the sequence of things to do. Each step can call an agent, fetch data, transform it, or send output.
• An output — an email, a post, a new row in the knowledge base, a webhook call, etc.
• An approval mode — auto (runs without asking), review (waits for your sign-off), or staged (posts a draft for you to edit).

Examples you'll see in templates:

• Daily morning briefing — at 8am, summarize yesterday's activity and email it to you.
• Content queue — every weekday, draft three social posts and queue them for approval.
• Lead intake — when a webhook fires from your CRM, add the lead to the knowledge base and draft a follow-up.

You can edit any workflow step. You can clone a workflow if you want a variation. And you can turn any workflow off without deleting it.`,
        links: [{ label: "Workflows", href: "/admin/workflows" }],
        keywords: ["workflow", "automation", "schedule", "playbook"],
      },
      {
        id: "knowledge-base",
        title: "Knowledge Base",
        summary: "Where your agents learn from. The more you feed it, the smarter they get.",
        body: `The knowledge base is your agents' memory. Anything you add here, agents can search and reference when they respond.

What to put in it:

• Your brand voice guidelines
• Product descriptions, pricing, FAQs
• Past successful emails or posts you want the agent to emulate
• Your customer profiles and buyer personas
• Process docs — "how we handle returns," "how we price custom work"

You can add entries manually, upload files, or let a workflow populate it. Each entry is tagged, and agents only pull in what's relevant to the current task, so you don't need to worry about the knowledge base getting too big.

One important rule: if an agent is giving you responses that don't sound right, the fix is usually in the knowledge base, not the system prompt. The system prompt sets tone and rules. The knowledge base provides facts.`,
        links: [{ label: "Knowledge Base", href: "/admin/knowledge" }],
        keywords: ["knowledge", "rag", "memory", "training", "docs"],
      },
      {
        id: "integrations",
        title: "Integrations",
        summary: "How your agents talk to the rest of your stack.",
        body: `Integrations connect your agents to the tools you already use. Email, CRM, calendar, social platforms — if it has an API, there's probably an integration for it.

Available out of the box: Gmail, Resend (for outbound email), GHL (Go High Level CRM), Stripe, Telegram, Skool, AWS S3, and a generic HTTP webhook for anything else. You can also connect MCP servers, which are standardized connectors for third-party apps.

Each integration is scoped — you decide if it's available to one business or to your whole organization. And each one has its own credentials that are encrypted in the database.

When you add an integration, its tools become available to your agents. You'll see them in the agent's tool list with a toggle. Turning one on means that agent can call that service. Turning it off means it can't.`,
        links: [
          { label: "Integrations", href: "/admin/integrations" },
          { label: "MCP Servers", href: "/admin/mcp" },
        ],
        keywords: ["integration", "api", "connect", "crm", "email"],
      },
      {
        id: "approvals",
        title: "Approvals",
        summary: "The safety net — you stay in control of what goes out.",
        body: `Approvals are how you keep your hand on the wheel. When a workflow or agent wants to take an action that needs your sign-off — send an email, post publicly, spend money — it creates an approval request instead of just doing it.

You'll see pending approvals as a red badge in the sidebar. Click Approvals to review them. For each one you can:

• Approve — the action goes ahead as-is.
• Edit then approve — modify the content first, then approve.
• Reject — decline with an optional reason (the agent learns from this).

You control which actions require approval. In Settings, you can set the default approval mode per business. For any specific workflow, you can override it.

If you disappear for a week, nothing destructive happens. Approvals just stack up waiting for you.`,
        links: [{ label: "Approvals", href: "/admin/approvals" }],
        keywords: ["approval", "review", "safety", "sign-off"],
      },
    ],
  },
  {
    id: "staying-updated",
    title: "Staying Updated",
    description:
      "How new versions of the app and the AI runtimes reach your deployment.",
    articles: [
      {
        id: "how-updates-work",
        title: "How updates reach your copy",
        summary:
          "Most things update automatically. A few require one click. Here's the map.",
        body: `Different parts of the app update in different ways. Here's exactly what happens to each:

• Ghost ProtoClaw (the app itself) — auto-deploys. When a new version ships, your Railway service redeploys within about a minute. You don't do anything.

• Hermes, Codex, Claude Code (the three AI runtimes) — also auto-deploy. Same as above.

• OpenClaw (the AI engine) — does NOT auto-update. It's pinned to a specific version so a bad upstream release can't break your deployment overnight. To upgrade, open Railway → OpenClaw → Deployments → click "Redeploy" on the latest image.

• Postgres (your database) — pinned to major version 17. Never auto-upgraded. You wouldn't want a database auto-upgrading anyway — too risky.

• The Railway template itself — does NOT retroactively change existing deployments. If I publish a template fix after you deployed, your existing services stay on the version they have. To pick up template-level fixes, the usual path is just to redeploy the affected service.

If you ever want to turn off auto-deploy (e.g. before a vacation), go to the service in Railway → Settings → Source → toggle "Automatic Deploys" off. Flip it back on when you're ready.`,
        keywords: ["update", "upgrade", "version", "auto-deploy", "railway"],
      },
      {
        id: "what-changed-recently",
        title: "What's new since launch",
        summary: "The plain-English changelog for everything added since v1.",
        body: `Since Ghost ProtoClaw first shipped, a lot has been added. Here's the running list, grouped so you can find what's relevant to you.

NEW TEMPLATES
• 🎥 Faceless YouTube Empire — 14-agent studio that produces, uploads, and monitors videos end-to-end. Script → voiceover (ElevenLabs) → assembly (JSON2Video) → YouTube publish → analytics. Targets YouTube Partner Program in ~90 days.
• 🛍️ TikTok Shop Operator — 13 agents for product research, AI UGC scripts, affiliate outreach, GMV Max ads, returns, review management. Full TikTok commerce ops.
• 👻 Ghost Operator — 5-agent autonomous business builder: research → plan → execute → market → optimize. Great for solopreneurs starting from zero.
• Plus 13 additional templates (Real Estate, SaaS, Service Business, Agency, High-Ticket Coaching, Skool Community, Local Service, and more). 16 total as of the latest deploy.

NEW TOOLS WIRED INTO AGENTS
• ElevenLabs voiceover — generate_voiceover / list_elevenlabs_voices (lands MP3s in R2).
• JSON2Video timeline assembly — assemble_video + check_video_assembly (polls until done, pulls finished mp4 into R2).
• YouTube Data API — youtube_upload_video, youtube_update_video_metadata, youtube_set_thumbnail, youtube_list_channel_videos, youtube_post_community_update. OAuth token management + per-org daily quota ledger built in.
• YouTube Analytics — youtube_get_video_analytics (CTR, AVD, returning viewers for the 48-hour audit).
• Whisper transcription — transcribe_audio (diff voiceover vs script to catch TTS mispronunciations).
• R2 upload — upload_to_r2 (lands any external URL in the user's own R2 bucket).
• HeyGen + Creatify + Auto-Clip (Klap/Opus Clip) for video generation + clip extraction.

NEW FEATURES
• Command palette (⌘K / Ctrl+K anywhere in the app) — jump to any page, business, agent, or workflow.
• Sidebar compact mode — collapse the left rail to a 56px icon-only view. Preference persists per device.
• Skills editing + agent assignment — edit a skill's name/description/instructions/required flag; add or remove specific agents from a skill in one dialog.
• Individual memory editing — click the pencil on any memory row to fix content, change type/tier/importance. Audit-logged.
• Brand Assets — upload logos, brand guides, product shots, marketing media. Agents check this BEFORE generating anything new.
• Video Clips page — clip-worthy timestamps your agents surface from long-form video.
• Outreach Targets page — queued reply drafts from Reddit / HN / Stack Overflow / GitHub scanners. Human-reviewed, human-posted. We never auto-comment.
• Todos & Ideas — brain-dump capture, activate later, Telegram /todo and /idea commands, AI auto-assign (agent/tags/due date).
• Master Agent — one layer above per-business agents; your chief-of-staff across every business.
• Ad Clone Tool (/admin/ad-clone) — stock, personas, and variations for ad creative at scale.

UPGRADED WORKFLOWS / TEMPLATES
• UGC workflows in TikTok Shop (18+ per template now).
• Continuous learning across every template — agents now log what worked and what didn't in a structured LEARNING_LOG.
• Knowledge Library + Workflow Library + Workspace Library — installable packs for common business types (Solopreneur Growth Stack, AI Video Production Pipeline, etc.).
• 3-tier Knowledge system (hot/warm/cold) with semantic lookups.
• Honesty layer — agents now verify that published actions actually went live (posts, uploads). They surface failures instead of hiding them.

UI REDESIGN (2026)
• Entire admin surface rebuilt in a black + steel-blue palette with Geist typography.
• New sidebar IA: 6 clean sections (Today / Work / Team / Automate / Library / Connect) + a collapsible System drawer.
• Dashboard, Today, Health, Approvals, Inbox, Costs, Chat, Master Agent, Knowledge, and every list page now share a unified premium visual language.
• Motion primitives — pulsing steel dots for live states, subtle ambient drift on hero panels.
• The old "neural" Pulse feed was retired; Pulse redirects to Activity.

INFRASTRUCTURE
• Postgres cold-start fix (fresh deploys come up green; the app waits for the database before running migrations).
• YouTube quota ledger (prevents mid-upload failure by preflight-checking the daily 10,000-unit cap).
• OAuth refresh persistence for YouTube (access tokens cached in encryptedSecrets, auto-refreshed per call).

If you deployed before any of these and don't see them, a redeploy of the affected service is usually all it takes. The bigger items (new templates, new KB packs) need to be installed per business from /admin/knowledge → Library or by spinning up a fresh business.`,
        keywords: [
          "changelog",
          "what's new",
          "changes",
          "history",
          "updates",
          "version"
        ],
      },
      {
        id: "flagship-templates",
        title: "The three flagship templates",
        summary:
          "Ghost Operator, TikTok Shop, and Faceless YouTube — when to pick each.",
        body: `Three templates are designed to work end-to-end out of the box. Each one has a distinct shape.

👻 GHOST OPERATOR (5 agents)
For: solopreneurs or aspiring entrepreneurs starting from zero.
Team: CEO (strategy + research), COO (planning), CTO (setup + execution), CMO (free social marketing), CFO (revenue tracking).
What it does: researches the best online business for YOUR goals/resources, plans it phase by phase, executes step-by-step with your approval, markets across 8 free channels, and watches the numbers. 24/7 with the right approval rules. Great when you don't yet know what to build.

🛍️ TIKTOK SHOP OPERATOR (13 agents)
For: anyone selling (or wanting to sell) on TikTok Shop.
Team: CEO, Product Analyst, Growth Strategist, Script Producer, AI UGC Producer, Compliance Officer, Supplier Manager, Content Creator, Affiliate Manager, Ads Manager, Customer Service, Finance Analyst, Analytics Lead.
What it does: sources products, scripts + produces faceless UGC video, lists the product, seeds to affiliate creators, runs GMV Max ads, handles refunds and reviews, and tracks per-SKU unit economics (target CM2 ≥ 20%). All under TikTok Shop compliance rules baked in.

🎥 FACELESS YOUTUBE EMPIRE (14 agents)
For: creators who want media income without being on camera.
Team: Studio Head + 13 specialists spanning niche/packaging, research, script, hook QA, voice direction, visual production, thumbnail design, assembly, SEO/publishing, community, compliance, monetization, and analytics.
What it does: picks a niche, researches outlier videos, scripts retention-engineered content, runs it through a mandatory HITL approval gate (you inject 10–20% of the content — this is your compliance insurance with YouTube's 2025 AI policy), generates voiceover via ElevenLabs, assembles via JSON2Video, uploads to YouTube with thumbnail + metadata, and pulls CTR/AVD analytics for the 48-hour audit and the 20-video checkpoint. Targets YouTube Partner Program in 90 days. ~$3–4 variable per 10-minute video.

Required integrations per template:
• Ghost Operator: the minimum set (OpenAI/Anthropic + one social outbound).
• TikTok Shop: add HeyGen or Creatify for AI UGC, plus your TikTok Shop seller account.
• Faceless YouTube: ElevenLabs ($22/mo), JSON2Video ($49.95/mo), Cloudflare R2 (~$5/mo), fal.ai (pay-per-use), and YouTube OAuth (free API with 10k/day quota).`,
        keywords: [
          "template",
          "flagship",
          "ghost operator",
          "tiktok shop",
          "faceless youtube",
          "pick a template"
        ],
      },
      {
        id: "video-pipeline",
        title: "The video production pipeline",
        summary:
          "End-to-end script → voiceover → assembly → YouTube upload.",
        body: `If you connect ElevenLabs, JSON2Video, and YouTube, your agents can produce and publish finished videos without you touching anything between approval and upload review.

The 7-step chain:

1. SCRIPT — your Script Writer agent drafts with hook architecture and retention engineering. MANDATORY: a human reviews and edits ~10–20% with personal anecdote, proprietary data, or opinion. The generate_voiceover tool refuses to run until this HITL gate is cleared — this is your compliance insurance under YouTube's 2025 inauthentic-content policy.

2. VOICEOVER — generate_voiceover(text, voice_id, model_id). Uses your integration's default_voice_id unless overridden. Lands the MP3 in R2. Cost: ~$0.10–$0.12 per 1K chars on v2/v3, so a 10-minute (~9K char) voiceover runs about $1.00.

3. VISUALS — broll_search (Pexels stock) OR generate_image (fal.ai Flux/Ideogram) OR generate_video (fal.ai Kling/Veo, 5–10 sec hero clips only). Reuse existing via list_brand_assets BEFORE generating new.

4. THUMBNAIL — generate_image again, 1280×720 jpg/png ≤2MB.

5. R2 PERSIST — if any tool returns a non-R2 URL you'll reuse, call upload_to_r2 immediately. CDN URLs expire.

6. ASSEMBLE — assemble_video(template). Template is a JSON2Video movie schema. Poll check_video_assembly until status=done. Finished mp4 auto-lands in R2.

7. PUBLISH — youtube_upload_video (1600 quota units, always starts as "private"), youtube_set_thumbnail (50 units), youtube_update_video_metadata (50 units) for final title/description/tags, then flip privacy_status to "public" after your review. 48 hours later: youtube_get_video_analytics to check CTR and AVD.

Cost math: ~$3–4 variable per video + ~$200/month fixed for integrations. Monthly publishing budget: 10,000 YouTube quota units/day = 6 uploads/day max.

All of this is wrapped in the "AI Video Production Pipeline" knowledge pack installable from /admin/knowledge → Library. Install it into any business and your agents get the full playbook.`,
        links: [
          { label: "Knowledge Library", href: "/admin/knowledge/library" },
          { label: "Integrations", href: "/admin/integrations" },
          { label: "Brand Assets", href: "/admin/brand-assets" },
          { label: "Uploads", href: "/admin/uploads" }
        ],
        keywords: [
          "video",
          "youtube",
          "elevenlabs",
          "json2video",
          "voiceover",
          "pipeline",
          "production",
          "upload"
        ],
      },
      {
        id: "command-palette",
        title: "The ⌘K command palette",
        summary: "Jump anywhere in the app with one keystroke.",
        body: `Press ⌘K on Mac or Ctrl+K on Windows/Linux from any page in the admin. A glassmorphism overlay opens with:

• Every page in the sidebar (Dashboard, Today, Work, Team, Automate, Library, Connect, System, Settings, Help).
• Quick actions (Create Business, Create Agent, Create Workflow).
• Full-text search across your businesses, agents, and workflows.

Keyboard-first:
• Type to filter
• ↑ ↓ to move
• ↵ to open
• ESC to close

The sidebar itself can also collapse to a 56px icon-only rail — click the "Collapse" button above the user pill. Preference persists per-device in localStorage. Tooltips show every item's name on hover when collapsed.`,
        keywords: [
          "command palette",
          "keyboard shortcut",
          "cmd k",
          "ctrl k",
          "search",
          "sidebar",
          "compact",
          "collapse"
        ],
      },
      {
        id: "skills-and-memory",
        title: "Editing skills and memory",
        summary:
          "Fix a wrong memory. Reassign a skill. Add a skill to an agent.",
        body: `SKILLS
A skill is a reusable capability you can attach to any agent. Example: "Customer Support" skill with specific instructions for de-escalation. Any agent that has the skill will apply those instructions.

From /admin/skills you can:
• Create a skill — name, category, description, instructions, "required for all agents" flag.
• Click any skill to see its detail dialog.
• Edit any field via the Edit button.
• See every agent that has this skill assigned.
• Remove a specific agent from the skill (× button on their row).
• Add any agent in the org to the skill (Add an agent dropdown).
• Archive the skill (it stays in history for existing assignments, but new agents can't take it).

MEMORY
Agent memories come from real conversations — what an agent has learned about your customers, preferences, or results. False memories are real (an agent can "remember" wrong facts). Individual edit prevents you from having to wipe-and-rebuild.

From /admin/memory you can:
• Filter by agent, tier (hot/warm/cold), and type.
• Click the pencil on any memory row to open the Edit dialog.
• Edit: content, type, importance (1–10), tier.
• Every edit writes an activity entry and an audit event so you can trace what changed and when.
• Delete a memory outright if it's not salvageable.
• Clear an entire tier or agent's memories from the header button (confirmed dialog).`,
        links: [
          { label: "Skills", href: "/admin/skills" },
          { label: "Memory", href: "/admin/memory" }
        ],
        keywords: [
          "skill",
          "skills",
          "memory",
          "agent memory",
          "edit",
          "assign",
          "redact",
          "remove"
        ],
      },
      {
        id: "backups",
        title: "Backups",
        summary: "What gets backed up, how often, and how to restore.",
        body: `The Backups page shows you what's been backed up and when. A backup includes your businesses, agents, workflows, knowledge base entries, and integration settings (with credentials redacted).

Backups are stored in the database and optionally mirrored to S3 if you've connected AWS credentials. You can trigger a manual backup any time from the Backups page.

To restore, click the backup you want and choose Restore. Restoring overwrites your current state with the snapshot — there's a confirmation step before anything happens.

Before a big change (e.g. trying out a new template, deleting a business), take a manual backup first. It's your safety net.`,
        links: [{ label: "Backups", href: "/admin/backups" }],
        keywords: ["backup", "restore", "snapshot", "recovery"],
      },
    ],
  },
  {
    id: "everyday-tasks",
    title: "Everyday Tasks",
    description: "The handful of things you'll do most often.",
    articles: [
      {
        id: "chat-with-agent",
        title: "Chatting with an agent",
        summary: "Start a conversation and see how your agents respond.",
        body: `Open Chat from the sidebar. If you don't have a conversation yet, click "New Conversation" and pick an agent.

Chat works like you'd expect — type a message, hit send, the agent responds. But a few things worth knowing:

• The full conversation is saved. The agent remembers what you said ten messages ago.
• You can use chat to test an agent before you put it in a workflow. If it sounds off here, it'll sound off there.
• Files you drop into chat get added to the conversation context. For quick one-offs, that's fine. For anything you'll want to reuse, put it in the knowledge base instead.`,
        links: [{ label: "Chat", href: "/admin/chat" }],
        keywords: ["chat", "conversation", "talk to agent"],
      },
      {
        id: "create-workflow",
        title: "Creating a workflow",
        summary: "The shortest path from an idea to an automated task.",
        body: `Click Workflows → Create. You'll go through a short form:

1. Name and description — what is this workflow for?
2. Trigger — manual, scheduled (pick a cron expression or use the simple schedule picker), or webhook.
3. Steps — the actions to take in order. Each step is either "call an agent" or "run a built-in action" (like "send email" or "add to knowledge base").
4. Approval mode — auto, review, or staged.
5. Output — what happens with the result.

When in doubt, start with a manual trigger and approval mode = "review." You can always flip to automatic once you've seen a few runs succeed.`,
        links: [{ label: "Create workflow", href: "/admin/workflows" }],
        keywords: ["workflow", "create", "automate"],
      },
      {
        id: "invite-teammates",
        title: "Inviting teammates",
        summary: "Add others to your organization.",
        body: `Settings → Team → Invite. Enter their email address and choose a role:

• Super Admin — full access to everything, including other super admins.
• Admin — full access to the businesses you grant them. Cannot manage other admins.

The invitee gets a magic-link email. They click it, set a password, and they're in.

You can revoke access any time from the same page.`,
        links: [{ label: "Settings", href: "/admin/settings" }],
        keywords: ["team", "invite", "users", "permissions"],
      },
      {
        id: "add-knowledge",
        title: "Adding to the knowledge base",
        summary: "Three ways to get information in front of your agents.",
        body: `Go to Knowledge. From there:

• Quick add — click Add Entry, paste or type the content, tag it, save.
• Upload — click Upload, drop a PDF, DOCX, TXT, or MD file. The system extracts text and creates entries from it.
• Bulk — click Import, upload a spreadsheet of entries at once (with columns for title, content, tags).

Once entries exist, your agents can search them. The more specific the tag and title, the more accurately the right entry gets pulled into a response.`,
        links: [{ label: "Knowledge", href: "/admin/knowledge" }],
        keywords: ["knowledge", "add", "upload", "documents"],
      },
      {
        id: "view-costs",
        title: "Keeping an eye on costs",
        summary: "What the AI is spending and how to keep it in check.",
        body: `Every call to an AI model costs money. It's usually fractions of a cent per call, but it adds up across lots of automated runs.

Go to Usage & Costs. You'll see:

• Total spend for the current month
• Spend by agent
• Spend by model
• A breakdown of tokens used

You can set a monthly budget per business. When you hit 80% of the budget, you get a warning. When you hit 100%, workflows pause until you raise the limit or the month resets. This protects you from a runaway loop burning through your credit.`,
        links: [{ label: "Usage & Costs", href: "/admin/costs" }],
        keywords: ["cost", "budget", "spending", "billing", "usage"],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description: "When something's wrong, start here.",
    articles: [
      {
        id: "health-red",
        title: "Health shows something red",
        summary: "What to do when the dashboard flags a problem.",
        body: `Open the Health page. The first red item is almost always the root cause — fix it first before worrying about the others.

• Database red — the app can't reach Postgres. Check that the Postgres service in Railway is running. If it's restarting in a loop, look at its logs.
• AI runtime red — OpenClaw isn't responding. Open the OpenClaw service in Railway, check Deployments → logs. Often a missing OPENROUTER_API_KEY.
• Email red — Resend key is missing or invalid. Paste a fresh key in Settings → Email.
• Integration red — one of your connected services rejected a call. Click the integration to see the exact error.

For anything you can't figure out, copy the error and paste it into the Help Assistant on this page. It's been trained on what each error means.`,
        links: [{ label: "Health", href: "/admin/health" }],
        keywords: ["health", "red", "error", "broken", "down"],
      },
      {
        id: "agent-off",
        title: "An agent is giving weird responses",
        summary: "Three levers to pull, in order.",
        body: `When an agent goes off-tone or makes things up, check these in order:

1. The knowledge base. The agent may be guessing because the facts aren't there. Add an entry with the correct information, make sure it's tagged well, and try again.

2. The system prompt. If the tone is wrong, the fix is here. Be specific: "Always respond in a warm, casual voice. Never use bullet points. Keep replies under 100 words." The clearer your instructions, the more consistent the output.

3. The model. Different models have different personalities. If the agent is consistently too verbose, try a different model in the agent settings. Claude models tend to be more cautious; GPT tends to be more direct; Gemini is often the best price-to-quality for high-volume tasks.`,
        links: [{ label: "Agents", href: "/admin/agents" }],
        keywords: ["agent", "wrong", "weird", "bad output"],
      },
      {
        id: "workflow-failed",
        title: "A workflow failed",
        summary: "How to read the error and fix it.",
        body: `Open the workflow and look at its Run History. Click the failed run. You'll see:

• Which step failed
• The input to that step
• The error message

Most failures are one of three things:

• A missing integration credential (fix it in Integrations)
• A missing environment variable (check the app's Settings page)
• A model returning something unexpected (try the same prompt in Chat to see what's happening)

You can retry a failed run from the same page. If it succeeds on retry, the original failure was transient (flaky network, rate limit). If it fails the same way twice, it's deterministic and needs a real fix.`,
        links: [{ label: "Workflows", href: "/admin/workflows" }],
        keywords: ["workflow", "failed", "error", "retry"],
      },
      {
        id: "cant-sign-in",
        title: "Can't sign in",
        summary: "Magic links, passwords, and lockouts.",
        body: `If the magic-link email isn't arriving:

• Check spam / junk.
• Check that the Resend API key is valid (Settings → Email).
• If you can't get into Settings because you can't sign in, use the admin email + password you set when you deployed the Railway template. Those are in your Railway variables for the Ghost ProtoClaw service.

If you forgot your password, the admin password is in the MISSION_CONTROL_ADMIN_PASSWORD variable in Railway. You can change it there and redeploy.`,
        keywords: ["login", "sign in", "password", "magic link", "locked out"],
      },
    ],
  },
  {
    id: "glossary",
    title: "Glossary",
    description: "Quick definitions of terms you'll see around the app.",
    articles: [
      {
        id: "terms",
        title: "The words and what they mean",
        summary: "Short definitions, plain English.",
        body: `Agent — an AI worker with a name, personality, and set of tools.

Approval — a pause point where the system waits for your sign-off before taking an action.

Business — a container for agents, workflows, and knowledge that belong to one operation.

Integration — a connection to an external service (email, CRM, etc.) that agents can use.

Knowledge base — a searchable store of information your agents draw from.

Magic link — a one-time sign-in link emailed to you, no password required.

MCP — Model Context Protocol. A standard way to connect third-party tools to agents.

Model — the underlying AI (Claude, GPT, Gemini). Each has different strengths, speeds, and costs.

OpenClaw — the service that actually runs your AI jobs. Sits between this app and the AI providers.

OpenRouter — a service that gives you one API key for dozens of AI models.

Runtime — a worker service that executes specialized tasks. Hermes handles quick jobs, Codex handles code tasks, Claude Code handles Claude-specific tasks.

System prompt — the instructions that define an agent's personality and behavior.

Template — a pre-filled bundle of agents, workflows, and knowledge for a specific use case.

Tool — something an agent is allowed to do (send email, search knowledge, call another agent).

Webhook — a URL that other services can call to trigger something in this app.

Workflow — an automated sequence of steps the system runs on a trigger.`,
        keywords: ["glossary", "definitions", "terms", "jargon"],
      },
    ],
  },
];

/** Build a single plain-text knowledge blob the chatbot can use as context. */
export function renderKnowledgeBase(): string {
  const parts: string[] = [];
  for (const section of helpSections) {
    parts.push(`# ${section.title}`);
    parts.push(section.description);
    parts.push("");
    for (const article of section.articles) {
      parts.push(`## ${article.title}`);
      if (article.summary) parts.push(`*${article.summary}*`);
      parts.push("");
      parts.push(article.body);
      if (article.links?.length) {
        parts.push("");
        parts.push(
          "Relevant in-app links: " +
            article.links.map((l) => `${l.label} (${l.href})`).join(", "),
        );
      }
      parts.push("");
    }
    parts.push("");
  }
  return parts.join("\n");
}

/** Flat list of all articles for search. */
export function allArticles(): Array<HelpArticle & { sectionId: string; sectionTitle: string }> {
  return helpSections.flatMap((s) =>
    s.articles.map((a) => ({ ...a, sectionId: s.id, sectionTitle: s.title })),
  );
}
