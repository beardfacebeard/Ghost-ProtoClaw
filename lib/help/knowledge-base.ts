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

Available out of the box: Gmail, Resend (for outbound email), GHL (Go High Level CRM), Stripe, Telegram, Skool, AWS S3, Cloudflare R2, ElevenLabs voiceover, JSON2Video, YouTube Data + Analytics, fal.ai image and video generation, and a generic HTTP webhook for anything else. You can also connect MCP servers, which are standardized connectors for third-party apps.

Each integration is scoped — you decide if it's available to one business or to your whole organization. And each one has its own credentials that are encrypted in the database.

When you add an integration, its tools become available to your agents. You'll see them in the agent's tool list with a toggle. Turning one on means that agent can call that service. Turning it off means it can't.

For the trickier integrations (getting API keys, OAuth flows, paste-in-Railway variables), jump to the "Integration Setup Guides" section below. There's a step-by-step walkthrough for every one.`,
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
    id: "integrations-setup",
    title: "Integration Setup Guides",
    description:
      "Step-by-step walkthroughs for every integration that needs a key, token, or OAuth flow. Written for people who have never seen an API key before.",
    articles: [
      {
        id: "openrouter-setup",
        title: "OpenRouter — the one AI key you actually need",
        summary:
          "OpenRouter is the master key that unlocks Claude, GPT, Gemini, and hundreds of models from a single account.",
        body: `OpenRouter is the single most important key in this whole app. With it, every agent can reach every major AI model. Without it, nothing works.

Step-by-step:

1. Go to openrouter.ai and sign up. Free to start.
2. Add a payment method. OpenRouter bills you directly for usage — usually cents per agent conversation.
3. Visit openrouter.ai/keys and click "Create Key." Give it a name like "Ghost ProtoClaw — Production."
4. Copy the key (starts with sk-or-v1-...).
5. In Mission Control, open Settings → AI Providers. Paste the key and save.
6. If you deployed via the Railway template, the env variable is already named OPENROUTER_API_KEY. Pasting into Settings writes it there.

That's it. Every agent you create can now use any model OpenRouter offers. You can see your balance and per-model cost at openrouter.ai any time.

Why OpenRouter over direct keys from Anthropic / OpenAI / Google? One account, one bill, one place to top up. And when a new model ships, OpenRouter usually has it the same week.`,
        links: [
          { label: "Settings → AI Providers", href: "/admin/settings" },
          { label: "Costs", href: "/admin/costs" }
        ],
        keywords: [
          "openrouter",
          "ai",
          "api key",
          "setup",
          "claude",
          "gpt",
          "gemini",
          "model"
        ]
      },
      {
        id: "elevenlabs-setup",
        title: "ElevenLabs — voiceover generation",
        summary:
          "Set up ElevenLabs so agents can generate broadcast-quality voiceovers from text.",
        body: `ElevenLabs turns scripts into lifelike audio. Set it up once and any agent with the ElevenLabs tools turned on can generate voiceovers.

Step-by-step:

1. Go to elevenlabs.io and sign up. The free tier gives you ~10k characters/month to test.
2. Click your profile icon → "API Keys." Click "Create New Secret Key" and copy it.
3. In Mission Control, go to Integrations and click "Add Integration."
4. Select ElevenLabs from the list.
5. Paste your API key in the api_key field.
6. Optional: set default_voice_id. If you leave it blank, agents pick a voice at call time. To find voice IDs, just let an agent call list_elevenlabs_voices once and note the ones you like.
7. Choose scope — Organization (every business can use it) or a specific business.
8. Save.

What happens next: agents that have the generate_voiceover tool enabled can now turn any script into an mp3. The finished audio lands in your R2 bucket automatically and shows up in Brand Assets (fileType = audio). Cost runs about $0.10–$0.12 per 1,000 characters on v2/v3 models — a 10-minute video voiceover is typically less than $1.

Troubleshooting: if your voiceovers fail with "401," the API key was copied wrong or revoked. Generate a fresh one in ElevenLabs and paste it again.`,
        links: [
          { label: "Integrations", href: "/admin/integrations" },
          { label: "Brand Assets", href: "/admin/brand-assets" }
        ],
        keywords: [
          "elevenlabs",
          "voiceover",
          "tts",
          "text to speech",
          "audio",
          "voice",
          "api key"
        ]
      },
      {
        id: "json2video-setup",
        title: "JSON2Video — assembling finished videos",
        summary:
          "Connect JSON2Video so agents can assemble voiceover + B-roll + text + music into a finished mp4.",
        body: `JSON2Video is the renderer. Your agents hand it a timeline (a JSON description of the video — voiceover clip, B-roll clips, text overlays, music, end card), and it returns a finished mp4.

Step-by-step:

1. Go to json2video.com and sign up. They offer a free tier and paid plans starting around $49.95/month (200 minutes of render time).
2. In your JSON2Video dashboard, copy your API key.
3. In Mission Control, go to Integrations → Add Integration → JSON2Video.
4. Paste your API key in the api_key field.
5. Optional: enter a project_id if you want all renders grouped under a specific JSON2Video project.
6. Choose scope (Organization or a specific business) and save.

How it works: an agent calls assemble_video with a timeline and gets back a project_id. The agent then polls check_video_assembly every 30–60 seconds until the render finishes. When it does, the finished mp4 auto-lands in your R2 bucket and a new Brand Asset row is created. Nothing is stored on JSON2Video's servers long-term.

Typical cost: 1–2 minutes of render time per finished video. If you render ten 60-second videos a day, that's about 10–20 minutes/day against your plan.

Troubleshooting: if assemble_video returns "rate limited," you've hit your plan's concurrent-render cap. Either wait for in-flight renders to finish or upgrade the JSON2Video plan.`,
        links: [
          { label: "Integrations", href: "/admin/integrations" },
          { label: "Brand Assets", href: "/admin/brand-assets" }
        ],
        keywords: [
          "json2video",
          "video assembly",
          "render",
          "timeline",
          "setup",
          "api key"
        ]
      },
      {
        id: "fal-ai-setup",
        title: "fal.ai — image and video generation",
        summary:
          "Set up fal.ai so agents can generate images (Flux, Recraft, Ideogram) and videos (Kling, Luma, Runway).",
        body: `fal.ai is how your agents create images and short video clips from scratch. It routes to the best current model for each job — FLUX for photorealistic, Recraft for logos/vector, Ideogram for text-in-image, Kling/Luma/Runway for video.

Step-by-step:

1. Go to fal.ai and sign up. New accounts get $5 in credit.
2. Open the Keys page and click "Create Key." Copy the value (starts with fal- or a UUID).
3. In Mission Control, go to Integrations → Add Integration → fal.ai.
4. Paste the key in the api_key field.
5. Choose scope and save.

What agents can do now: call generate_image with one of eight models (default is fal-ai/flux/dev), or generate_video with six video models. Both return a hosted URL plus a Brand Asset row that lands in your R2 bucket automatically. For long-running generations, agents poll with fal_check_generation.

Typical costs: FLUX image ≈ $0.025, Recraft image ≈ $0.04, Kling 5-second video ≈ $0.35. Most ad creative and thumbnails are pennies per variation.

Important: if you already uploaded a logo or brand guide to Brand Assets, agents will reference those before generating new images — so the outputs stay on-brand without you having to retype the brand description in every prompt.`,
        links: [
          { label: "Integrations", href: "/admin/integrations" },
          { label: "Brand Assets", href: "/admin/brand-assets" }
        ],
        keywords: [
          "fal.ai",
          "fal",
          "flux",
          "recraft",
          "ideogram",
          "kling",
          "image generation",
          "video generation",
          "api key"
        ]
      },
      {
        id: "youtube-oauth-setup",
        title: "YouTube — OAuth, refresh tokens, and channel access",
        summary:
          "The hardest integration. This walks you through every step of getting a refresh token.",
        body: `YouTube is the most involved setup in the app, because Google requires OAuth instead of a simple API key. You only have to do this once per channel. After that, uploads, metadata edits, thumbnails, and analytics all "just work."

You need three things: a Google Cloud project with the YouTube APIs enabled, OAuth credentials (client ID + client secret), and a refresh token for your channel.

PART 1 — Google Cloud project

1. Go to console.cloud.google.com and sign in with the Google account that owns your YouTube channel.
2. Create a new project. Name it "Ghost ProtoClaw."
3. Open APIs & Services → Library. Enable these three:
   • YouTube Data API v3
   • YouTube Analytics API
   • YouTube Reporting API (optional, for long-term analytics exports)
4. Open APIs & Services → OAuth consent screen. Pick "External," fill out the minimum fields (app name, support email, dev contact). Under "Scopes," add:
   • https://www.googleapis.com/auth/youtube.upload
   • https://www.googleapis.com/auth/youtube.readonly
   • https://www.googleapis.com/auth/youtube.force-ssl
   • https://www.googleapis.com/auth/yt-analytics.readonly
5. Under "Test users," add your Google account email. Save.

PART 2 — OAuth client

1. In APIs & Services → Credentials, click "Create Credentials" → "OAuth client ID."
2. Application type: "Web application."
3. Authorized redirect URIs: add https://developers.google.com/oauthplayground (this lets you use Google's playground to mint a refresh token).
4. Create. Copy the Client ID and Client Secret — you'll paste them in a minute.

PART 3 — Refresh token via Google OAuth Playground

1. Go to developers.google.com/oauthplayground.
2. Click the gear icon (top right) → check "Use your own OAuth credentials." Paste the Client ID and Client Secret from PART 2.
3. In the Step 1 scope list on the left, find "YouTube Data API v3" and select https://www.googleapis.com/auth/youtube.upload, .readonly, and .force-ssl. Find "YouTube Analytics API v2" and select yt-analytics.readonly.
4. Click "Authorize APIs." Sign in with the Google account that owns the channel. Grant access.
5. Step 2: click "Exchange authorization code for tokens." A refresh_token appears.
6. Copy the refresh_token value.

PART 4 — Paste into Mission Control

1. In Mission Control, go to Integrations → Add Integration → YouTube.
2. Paste the Client ID, Client Secret, and refresh token into their fields.
3. Optional: paste your channel_id (find it at youtube.com/account_advanced).
4. Choose scope — Organization or a single business (usually a single business, since one YouTube channel = one brand).
5. Save.

That's it. Agents with the YouTube tools enabled can now upload videos, update metadata, set thumbnails, list your channel, and pull analytics. The access token auto-refreshes every ~60 minutes using the refresh token you pasted — you don't have to do this again.

If you'd rather skip the OAuth Playground, you can also set the env variables GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in Railway. The integration will fall back to those if the per-integration fields are empty.

Watch out for: the daily 10,000-unit YouTube quota. See the "YouTube quota exceeded" article in Troubleshooting if you hit it.`,
        links: [
          { label: "Integrations", href: "/admin/integrations" }
        ],
        keywords: [
          "youtube",
          "oauth",
          "refresh token",
          "google cloud",
          "youtube data api",
          "youtube analytics",
          "setup",
          "channel",
          "upload"
        ]
      },
      {
        id: "telegram-setup",
        title: "Telegram — the bot for /todo, /idea, and workflow outputs",
        summary:
          "Create a Telegram bot, connect it, and start capturing ideas on the go.",
        body: `The Telegram integration is useful for two things: capturing todos and ideas from your phone with one message, and having workflows deliver their output straight to your phone instead of waking you up with email.

Step-by-step to create the bot:

1. Open Telegram and search for @BotFather. Start a chat.
2. Send /newbot. BotFather asks for a name (what people see) and a username (has to end in "bot").
3. Once created, BotFather gives you a token. It looks like 1234567890:AAH... — copy it.
4. In Mission Control, go to Integrations → Add Integration → Telegram.
5. Paste the bot token.
6. Leave chat_id blank for now — it gets auto-detected the first time you message your bot.
7. Choose scope — Organization is the usual choice so the same bot serves every business.
8. Save.

Send /start to your bot from your own Telegram account once. Mission Control records your chat_id the first time you message the bot so it knows where to reply.

Commands you can send:
• /todo <text> — creates a todo. Example: "/todo record the weekly sales update video by Friday"
• /idea <text> — creates an idea instead of a todo. Ideas are parked for later; todos are on your radar now.

The auto-assign layer reads the text and, when it can, fills in the right agent, tags, due date, and priority. You can fix anything it got wrong later from the Todos page.

Using Telegram as a workflow output: in any workflow's settings, set Output = telegram. Successful runs will post their result to whichever chat is configured (agent-paired chat, business chat, or the integration default — in that priority order).

Troubleshooting: if commands aren't working, it's almost always the bot token being mistyped, or you haven't sent /start to your bot yet.`,
        links: [
          { label: "Integrations", href: "/admin/integrations" },
          { label: "Todos & Ideas", href: "/admin/todos" }
        ],
        keywords: [
          "telegram",
          "bot",
          "botfather",
          "todo",
          "idea",
          "commands",
          "setup"
        ]
      },
      {
        id: "r2-storage-setup",
        title: "Cloudflare R2 — storage for generated media",
        summary:
          "Set up Cloudflare R2 so voiceovers, generated images, and finished videos all land in a bucket you control.",
        body: `R2 is Cloudflare's storage — it's where your voiceovers, generated images, rendered videos, and uploaded brand assets actually live. It's almost always cheaper than AWS S3 and has zero egress fees.

Step-by-step:

1. Go to dash.cloudflare.com and sign up (free).
2. In the left nav, click R2 Object Storage. Enable it if it's your first time (adds a payment method but no charge until you exceed the 10 GB free tier).
3. Create a bucket. Name it something like "ghost-protoclaw-media." Pick a region close to you.
4. In R2 → Manage R2 API Tokens, click "Create API Token."
5. Crucial: set permissions to Object Read + Write AND Admin Read + Write. The "Admin" scope is what lets Mission Control auto-configure CORS later.
6. Scope the token to the bucket you just made. Set TTL to "forever" or a long duration.
7. Create. Cloudflare shows you: Access Key ID, Secret Access Key, and an S3-compatible endpoint URL.
8. In Mission Control, go to Integrations → Add Integration → Cloudflare R2 (or paste the values directly into Settings → Storage if that's wired up).
9. Fields:
   • account_id — your Cloudflare account ID (top-right of the dashboard)
   • access_key_id — from step 7
   • secret_access_key — from step 7
   • bucket — your bucket name
   • public_base_url — optional; if you've set up a custom CDN domain like media.yourbrand.com, put it here; otherwise leave blank
10. Save.

First upload test: go to the Uploads page and drop a file. If everything's wired, it lands in your bucket within a few seconds.

If upload fails with a CORS error: click "Configure CORS" on the page. If your token has the Admin scope, it configures CORS automatically. If the token is Object-only, the page shows a JSON snippet to paste into Cloudflare → your bucket → Settings → CORS Policy. One-time setup, about 60 seconds.

Env var fallback: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL. The integration takes priority if both are set.`,
        links: [
          { label: "Integrations", href: "/admin/integrations" },
          { label: "Uploads", href: "/admin/uploads" },
          { label: "Brand Assets", href: "/admin/brand-assets" }
        ],
        keywords: [
          "r2",
          "cloudflare",
          "storage",
          "bucket",
          "cors",
          "upload",
          "setup"
        ]
      }
    ]
  },
  {
    id: "power-tools",
    title: "Power Tools",
    description:
      "The features you'll unlock once the basics are running — brand assets, outreach scans, ad cloning, library packs, the Master Agent, and more.",
    articles: [
      {
        id: "master-agent",
        title: "The Master Agent — your cross-business chief of staff",
        summary:
          "One agent above all the others. Talk to it instead of jumping between businesses.",
        body: `The Master Agent sits above every business's agent team. Think of it as your chief of staff. Instead of opening three businesses and chatting with three different CEO agents, you talk to the Master Agent and it relays to the right one.

Create it:

1. Go to Master Agent in the sidebar.
2. Click "Create Master Agent" (if it doesn't already exist). The app provisions one org-wide agent named Mission Control.
3. That's it. It's ready.

What it can actually do:
• list_businesses — enumerate every business in your organization
• ask_ceo_agent — relay a message to a specific business's main/CEO agent and return the answer

Important: the Master Agent is deliberately read-only at its own layer. It can't send emails, post to social, or spend money. It asks other agents to do those things. That means you can trust it to summarize and coordinate without worrying that it'll misfire a destructive action.

When it's most useful:
• "What's happening today across all my businesses?"
• "Which business had the best revenue week?"
• "Tell my TikTok business to draft three hook ideas for tomorrow."
• "Pull a status update from every CEO and send me the digest."

If you only run one business, you probably don't need the Master Agent. Once you hit three or more, it becomes the fastest way to stay on top of everything without opening five tabs.`,
        links: [
          { label: "Master Agent", href: "/admin/master-agent" }
        ],
        keywords: [
          "master agent",
          "mission control",
          "chief of staff",
          "cross-business",
          "multi-business"
        ]
      },
      {
        id: "brand-assets",
        title: "Brand Assets — the single source of truth for your visual identity",
        summary:
          "Upload logos, brand guides, product shots once. Every agent uses them automatically.",
        body: `Brand Assets is where your logo, brand guide PDF, product photos, and marketing media live. Every agent that generates images or video checks here BEFORE making something new. That means outputs stay on-brand without you having to re-describe the brand in every prompt.

How to use it:

1. Go to Brand Assets.
2. Click Upload and drop a file. Supported: images (PNG/JPG/SVG), PDFs, mp4 video, mp3/wav audio, and generic documents.
3. Tag it. Categories are:
   • logo — your primary mark
   • brand_guide — PDF with colors, fonts, voice
   • product_image — individual product shots
   • marketing — banners, social graphics, existing ad creative
   • document — anything else you want agents to reference
   • general — default if you're not sure
4. Save.

From then on, when an agent is about to generate an image or video, it calls list_brand_assets first. If you have a logo uploaded, the agent uses it as a reference. If you have a brand guide PDF, the agent reads it for colors and tone. The outputs come back looking like YOUR brand, not generic stock.

Everything agents generate (voiceovers, images, assembled videos, transcriptions) also auto-creates a Brand Asset row. So this page is also a library of every piece of media your agents have made.

Pro tip: upload 3–5 product photos and 1 brand guide PDF on day one. The difference in agent output quality is immediate.`,
        links: [
          { label: "Brand Assets", href: "/admin/brand-assets" }
        ],
        keywords: [
          "brand assets",
          "logo",
          "brand guide",
          "assets",
          "media",
          "upload"
        ]
      },
      {
        id: "uploads-page",
        title: "Uploads — direct-to-storage file uploads",
        summary:
          "The page for pushing files straight to your R2 bucket without going through Brand Assets.",
        body: `Uploads is a direct-to-bucket upload tool. Useful when you want to get a file into R2 quickly without categorizing it as a brand asset — e.g. a reference doc you'll delete later, a one-off background track, a test video.

How it works:

1. Go to Uploads.
2. Drag a file onto the panel or click to pick one.
3. The browser uploads directly to R2 using a short-lived pre-signed URL. The file never touches the Mission Control server.
4. The resulting URL appears in the list. Copy it and you can paste it into any agent prompt.

Brand Assets vs Uploads — what's the difference?
• Brand Assets = categorized, searchable, auto-consumed by agents.
• Uploads = quick-and-dirty dump into your bucket. Agents can still use the URL if you paste it into a prompt, but it won't be surfaced automatically.

If upload fails with "CORS error," it means your R2 bucket's CORS rules aren't set up yet. Click the Configure CORS button on the page. If your R2 API token has the Admin scope, it auto-configures. If not, you'll see a JSON snippet to paste into Cloudflare → your bucket → Settings → CORS Policy. Takes about a minute. Only has to be done once per bucket.`,
        links: [
          { label: "Uploads", href: "/admin/uploads" },
          { label: "Brand Assets", href: "/admin/brand-assets" }
        ],
        keywords: [
          "uploads",
          "file upload",
          "r2",
          "cors",
          "storage"
        ]
      },
      {
        id: "video-clips",
        title: "Video Clips — timestamps for clip-worthy moments",
        summary:
          "Where your agents surface the best 15–60 second cuts from long-form video. Human-cut, not auto-cut.",
        body: `Video Clips is a queue of clip-worthy moments your agents have identified inside your long-form videos. Each entry has a source video, a start and end timestamp, a suggested caption, and the agent's reason for flagging it.

Important: this page does NOT auto-cut video. It surfaces markers. You do the cutting in whatever editor you already use (CapCut, Premiere, DaVinci, Descript). Why human-cut?
• Agent-selected hooks are great starting points but often need one more round of taste.
• Keeps the platform neutral on which editor you use.
• Avoids re-rendering the same video three times just for different clip lengths.

How clips get here: an agent with the video-analysis tool runs over a long-form source (from YouTube, from a file upload, from a direct URL). It returns start/end timestamps + a reason. Those land in the Video Clips queue.

How to use a clip:
1. Click the entry. You see the source URL, start/end, caption, and reason.
2. Open the source in your editor at the noted timestamp.
3. Trim, add captions if needed, export.
4. Mark the clip "completed" in the queue so it drops off the list.

If you want full end-to-end clipping with captions and auto-export, that's a bigger project — ping the Help Assistant for the current plan on Klap/Opus Clip / HeyGen direct integration. For now, clips is intentionally a curated list of timestamps.`,
        links: [
          { label: "Video Clips", href: "/admin/clips" }
        ],
        keywords: [
          "video clips",
          "clips",
          "timestamps",
          "short form",
          "auto cut"
        ]
      },
      {
        id: "outreach-targets",
        title: "Outreach Targets — scanners for Reddit, HN, Stack Overflow, GitHub",
        summary:
          "Your agents surface real threads where a thoughtful reply would help. You write and post.",
        body: `Outreach Targets is a queue of real posts and threads — on Reddit, Hacker News, Stack Overflow, GitHub — where someone asked a question your business can help with. Your agent finds the thread, drafts a reply in your voice, and stops. You read the draft, edit if needed, and post manually.

Why manually? Because auto-posting comments is the fastest way to get a sub banned or a GitHub account flagged. This app's honesty layer includes shadow-ban detection on Reddit — we've seen accounts quietly stop showing up in subreddit feeds because of one over-eager auto-reply. We don't go there.

How it works:

1. Enable an outreach workflow on one of your agents. Templates include Reddit monitors, Hacker News Who's Hiring / Ask HN, Stack Overflow tag scanners, GitHub issue scanners.
2. The agent runs on a schedule (usually once or twice a day).
3. When it finds a thread that matches your business, it drafts a reply and lands the draft here.
4. Go to Outreach Targets, read the thread via the source URL, read the agent's draft, edit.
5. Copy → paste into the source platform → hit post.
6. Mark the target "completed."

Each queued target shows: the platform, the source URL, the original post, the agent's draft reply, and the reason the agent flagged it. You can also reject drafts — the agent learns from the rejection.

This is not spam. The point is to show up in exactly the threads where your expertise actually helps someone, not to post canned responses everywhere.`,
        links: [
          { label: "Outreach Targets", href: "/admin/targets" }
        ],
        keywords: [
          "outreach",
          "targets",
          "reddit",
          "hacker news",
          "stack overflow",
          "github",
          "replies",
          "comments"
        ]
      },
      {
        id: "todos-and-ideas",
        title: "Todos & Ideas — brain dump now, activate later",
        summary:
          "Capture thoughts from anywhere, let AI triage, activate when you're ready.",
        body: `Todos and Ideas is a capture-first inbox. The point is to get the thought out of your head fast, with zero friction, and sort it later.

Three ways to capture:
• On the web — go to Todos, click New, type.
• From Telegram — /todo "record the weekly update" or /idea "new landing page angle about time saved."
• From an agent — agents can call propose_todo when they spot something you should do. Those land with a small "proposed" tag.

The auto-assign layer reads the text when you capture and fills in what it can: the right agent, tags, a priority, and a due date. You can fix anything it got wrong from the Todos page.

The status flow:
• Captured — brand new, hasn't been looked at yet.
• Active — you've committed to working on it. Activating creates a live conversation with the assigned agent so you can get going immediately.
• Snoozed — park it for later, pick a re-surface date.
• Done — finished.
• Dismissed — not going to happen, don't re-surface.

Todos vs Ideas:
• Todo = action I will take (or delegate).
• Idea = thought worth keeping but no commitment.

A handy promotion path: if an idea turns out to be a repeating job, you can "promote to workflow" from the idea's detail menu. The current text becomes the starting point for a workflow you can schedule. If the text included a hint like "weekly" or "every Monday," that becomes the default cron.

Pro tip: drive this from Telegram. Getting in the habit of /todo'ing thoughts while walking is the highest-leverage move this system enables.`,
        links: [
          { label: "Todos & Ideas", href: "/admin/todos" },
          { label: "Telegram setup", href: "/admin/help#section-integrations-setup" }
        ],
        keywords: [
          "todos",
          "ideas",
          "tasks",
          "capture",
          "telegram",
          "brain dump"
        ]
      },
      {
        id: "ad-clone-tool",
        title: "Ad Clone Tool — 5 variations, pick your favorite, render to video",
        summary:
          "Go from a product and a brand to five ad-copy image variations to a finished ad video.",
        body: `The Ad Clone Tool is a structured pipeline for producing ad creative at scale. Instead of asking an agent "make me an ad" and getting one mediocre result, you give it a product and a brand, and it produces five variations, you pick a favorite, it iterates, then renders to video.

Structure:

1. Products — the thing you're advertising. Name, image, notes (who buys it, why, key claims).
2. Brands — your brand's visual identity. Font, brand colors, website, logo. You can have multiple brands if you run multiple storefronts.
3. Projects — one ad campaign = one project. Each project links a product + a brand, and stores every variation as you iterate.

The flow inside a project:
1. Generate 5 AI variations from the product + brand. Each saves to aiVersion1Url through aiVersion5Url.
2. Pick a favorite. Saves to chosenFavoriteUrl.
3. Iterate — describe what you want changed (round 1 → editedImage1Url). Repeat if needed (round 2).
4. Finalize the static image. Lands in finalImageUrl.
5. Render to video — the final image + voiceover + music becomes an mp4 at videoUrl.
6. Resize for platforms — the tool auto-produces 9:16 (TikTok/Reels), 1:1 (feed), and 4:3 (display) versions at resized916Url / resized11Url / resized43Url.

Project statuses: draft → in_progress → editing → finalized. At finalized, the creative is ready to upload to your ad platform.

The image generation uses fal.ai (so make sure that integration is set up first). Video render uses JSON2Video. Both must be connected for this to work end-to-end.

Where this shines: if you're running paid ads and need 10 creative variations a week, this is the difference between that being a 20-hour-a-week job and a 2-hour-a-week job.`,
        links: [
          { label: "Ad Clone", href: "/admin/ad-clone" },
          { label: "fal.ai setup", href: "/admin/help#section-integrations-setup" },
          { label: "JSON2Video setup", href: "/admin/help#section-integrations-setup" }
        ],
        keywords: [
          "ad clone",
          "ads",
          "creative",
          "variations",
          "ad generation",
          "paid ads"
        ]
      },
      {
        id: "library-packs",
        title: "Library packs — installing pre-built knowledge and workflows",
        summary:
          "Browse the Library and one-click-install curated packs into any business.",
        body: `The Library is a collection of pre-built knowledge entries and workflows you can drop into any business. Three libraries live here:

• Knowledge Library — /admin/knowledge/library — installable knowledge entries (FAQs, policies, brand voice starters, industry references).
• Workflow Library — /admin/workflows/library — installable workflows (daily content brief, weekly SEO audit, LinkedIn queue, cold outreach, newsletter digest, and about 25 more).
• Workspace Library — /admin/workspace/library — installable workspace docs (SOPs, runbooks).

Notable packs:

• 🎥 AI Video Production Pipeline — the full end-to-end playbook for the Faceless YouTube Empire template. Covers script structure, voiceover prompts, B-roll sourcing, retention tactics, and the 48-hour post-publish audit. Install this into any business that's producing video content.

• Solopreneur Growth Stack — complete knowledge set for a one-person operator: brand voice, pricing pages, FAQs, outreach scripts, onboarding docs. Great as a starting point that you edit into your own voice.

How to install:

1. Go to the library you want (Knowledge, Workflow, or Workspace).
2. Pick a business in the top dropdown — this is where the pack gets installed.
3. Browse packs, click the one you want.
4. Click Install. The pack's entries or workflows get created in that business.
5. Edit from there. Installed items are full copies, not references — you can customize freely without affecting the library original.

Nothing is destructive. Installing a pack never overwrites anything you already have; it only adds.`,
        links: [
          { label: "Knowledge Library", href: "/admin/knowledge/library" },
          { label: "Workflow Library", href: "/admin/workflows/library" }
        ],
        keywords: [
          "library",
          "packs",
          "install",
          "video pipeline",
          "knowledge pack",
          "workflow pack"
        ]
      },
      {
        id: "sub-agent-policies",
        title: "Sub-agent policies — letting agents spawn helpers",
        summary:
          "Turn on sub-agents carefully. Here's how the policy controls keep it safe.",
        body: `Sub-agents are helpers a running agent can spawn on the fly to tackle a piece of a larger job. They're powerful — one agent can kick off three research streams in parallel — and they're expensive if uncapped. The Sub-agent Policy page controls exactly how and when this is allowed.

Where: under Settings (look for "Sub-agent policies"). Policy is defined at the organization level by default and can be overridden per business.

Policy knobs:

• Enabled — master switch. OFF by default. Off means no agent can spawn sub-agents at all.
• Max nesting depth — how deep the tree can go. Depth 1 means agents can spawn helpers, but those helpers can't spawn further helpers. Depth 2 allows one more level. Rare to need more than 2.
• Max children per agent — cap on how many sub-agents any one parent can create in a single run. Usually 3–5.
• Max total sub-agents per business — cap on the whole tree across a single session. Usually 10.
• Model inheritance — either "inherit parent's model" (safer, more capable, more expensive) or "use the cheapest model" (fine for simple classification helpers).
• Human approval required — if on, sub-agent creation shows up in Approvals before it runs.
• Allow recursive spawning — should sub-agents spawn their own sub-agents? Off unless you really mean it.
• Auto-disable on inactivity — kill long-running sub-agents that stop making progress.

Recommendation for a first rollout:

1. Enable at the org level with depth=2, max 3 children, max 10 total, human approval ON for the first week.
2. Watch the Approvals queue for a week — you'll see every sub-agent creation request.
3. If the pattern is healthy, flip human approval OFF and let them run.
4. If anything gets weird, flip Enabled OFF and everything stops instantly.

Sub-agents are how you go from "one agent at a time" to "one agent orchestrating three research streams in parallel." They're not necessary for most businesses, but when you need them, they're the difference between waiting ten minutes and waiting thirty seconds.`,
        links: [
          { label: "Settings", href: "/admin/settings" },
          { label: "Approvals", href: "/admin/approvals" }
        ],
        keywords: [
          "sub-agents",
          "subagents",
          "helpers",
          "spawn",
          "policy",
          "nesting",
          "depth"
        ]
      }
    ]
  },
  {
    id: "forex-desk",
    title: "The Forex Trading Desk",
    description:
      "The Forex Research & Execution Desk is a specialized template with regulatory guardrails, tiered execution modes, and a 14-agent mesh. These articles cover what it does, what it doesn't, and how to get it running safely. Not financial advice.",
    articles: [
      {
        id: "forex-desk-overview",
        title: "What the Forex Trading Desk is (and what it isn't)",
        summary:
          "A jurisdiction-aware, controls-first trading research template — not a profit bot.",
        body: `The Forex Research & Execution Desk is a Ghost ProtoClaw template. It materializes a 14-agent mesh with system prompts grounded in the 2025 BIS commentary, the FX Global Code, and the peer-reviewed academic literature on FX risk premia. It ships with a starter knowledge pack, six scheduled workflows, and a risk-engine config that encodes hard pre-trade gates.

What it is:
• A research operation that produces daily macro briefings, scenario trees, strategy proposals, backtest reports, and blameless post-trade journals.
• A rule engine that encodes your jurisdiction (US, UK, EU, AU, CA, SG, JP, or self-certified), caps leverage at the regulator's retail limit, and adjusts broker availability accordingly.
• A prop-firm compliance layer that tracks distance-to-bust on Apex / FTMO / FundedNext-style rules in real time.
• A tiered execution model — Research, Paper, Live-with-approval — that starts in the safest tier by default and upgrades only with explicit consent.

What it isn't:
• An autopilot. Every order in Live mode requires a human click.
• A profit machine. The Surveillance Agent actively blocks any response containing "guaranteed" / "risk-free" / "easy money" / "cannot lose" and escalates. Your agents will refuse to make income claims, and so will this help content.
• A replacement for judgment, capital discipline, or legal counsel. Regulators in every major jurisdiction (CFTC/NFA, FCA, ESMA, ASIC, MAS, FFAJ) publish data showing most retail CFD traders lose money. The desk exists to make losing less likely, not impossible.

Who it's for: someone who wants a disciplined systematic trading operation run by an AI team, with the audit trail and risk plumbing a real desk needs. Not scalpers, not arbitrage hunters, not HFT.

Who it isn't for: anyone looking for signals, tips, or a way around their jurisdiction's rules.`,
        links: [{ label: "Businesses", href: "/admin/businesses" }],
        keywords: [
          "forex",
          "trading",
          "desk",
          "overview",
          "template",
          "what is"
        ]
      },
      {
        id: "forex-desk-tiers",
        title: "The three execution modes: Research, Paper, Live-with-approval",
        summary:
          "Research by default. Paper after consent. Live only after proof + a typed confirmation.",
        body: `The desk runs in exactly one of three tiers at any time, stored on the business's tradingMode field. Every fresh business starts in Research mode — you cannot accidentally fire a live order on day one.

Research mode (default)
• Agents produce briefings, backtests, research notes, and journal entries.
• NO orders are placed anywhere — not live, not paper. The Execution Agent explicitly refuses even simulated routing.
• No broker credentials required.
• Safe to use immediately and for as long as you want.

Paper mode (tier 2)
Unlocked after you:
• Confirm your jurisdiction
• Accept the long-form risk disclosure
• Connect a broker demo account (OANDA demo / Tradovate demo / IBKR paper)
• Generate at least one research briefing

In Paper, orders route to the broker's demo endpoint only. Real-time fills simulated with empirical slippage from the desk's own backtest pipeline. Zero capital at risk.

Live-with-approval mode (tier 3)
Unlocked after you:
• Run 30+ paper trades with non-negative expectancy
• Connect Telegram for alerts
• Set a daily loss cap and a monthly budget
• Type "I ACCEPT LIVE TRADING RISK" in the confirmation dialog
• Verify the kill switch fires correctly from your phone

In Live, every order queues in Ghost ProtoClaw's approval queue with the full trade card — thesis, catalyst, invalidation, stop-distance in USD, position size, portfolio impact, prop-firm rule headroom. Orders only fire when you click Approve. Downgrades (Live → Paper → Research) are instant and auto-cancel any open live orders.

There is no "fully autonomous live" mode and there never will be. That's by design.`,
        links: [{ label: "Approvals", href: "/admin/approvals" }],
        keywords: [
          "research mode",
          "paper mode",
          "live mode",
          "tier",
          "execution",
          "approval",
          "safety"
        ]
      },
      {
        id: "forex-desk-jurisdictions",
        title: "Jurisdiction — what happens when you pick yours",
        summary:
          "One template, eight regulator-aware configurations. The list changes based on who you declare to be.",
        body: `When you create a business from the Forex Research & Execution Desk template, you declare your jurisdiction. That declaration is stored on the business and drives four things hard:

1. Broker availability. US businesses never see CFD brokers in the integration UI — they see OANDA-US, IBKR, FOREX.com for retail FX, and Apex / Topstep / Earn2Trade for futures prop firms. UK businesses see OANDA-UK, Pepperstone-UK, IG, CMC. Each jurisdiction has its own list.

2. Leverage cap. Hard-enforced in the Risk Gate Agent — US 50:1 majors / 20:1 minors, UK/EU/AU 30:1 majors / 20:1 minors, Japan 25x individual. The broker may offer higher; the desk does not.

3. Product universe. US retail CFDs are banned by the CFTC. US businesses trade spot FX through NFA-regulated brokers or CME FX futures through IBKR. EU/UK/AU businesses see spot + CFDs + futures + options per their broker.

4. Risk-disclosure language. Every tier upgrade shows the regulator's exact language — "71% of retail investor accounts lose money when trading CFDs…" for FCA, the CFTC risk disclosure for US, the ASIC target-market-determination text for AU.

Important honesty note for US residents: you cannot legally use most Australian or UK brokers as a US retail FX customer — that's the Dodd-Frank Act at work. Attempts to work around this (VPNs, claiming foreign residency, offshore broker subsidiaries) either violate US law or leave you with an unregulated offshore entity with no capital protection. The desk does not support those paths. Your real US-eligible options are: OANDA-US, IBKR (for CME FX futures), and the futures prop firms (Apex, Topstep, Earn2Trade).

Changing jurisdiction after business creation is possible but requires a super-admin action, because it invalidates connected brokers and disclosures.`,
        keywords: [
          "jurisdiction",
          "regulation",
          "broker",
          "US",
          "UK",
          "EU",
          "AU",
          "leverage cap",
          "dodd-frank"
        ]
      },
      {
        id: "forex-desk-setup",
        title: "Setting up your Forex Research Desk — the first 24 hours",
        summary:
          "The order of operations to go from 'just created' to 'first morning briefing in Telegram.'",
        body: `A realistic first-24-hour rollout:

Hour 0 — Materialize the template
• Businesses → Create.
• Pick "Forex Research & Execution Desk."
• Name your business (e.g. "Systematic FX Desk" or your personal handle).
• Declare your jurisdiction. This one is load-bearing — pick carefully.
• Accept the research-mode risk disclosure.

Hour 1 — Review the agent mesh
• Open Agents → the new business. You'll see 14 specialists, with the Chief of Desk as the main agent.
• Read the Chief of Desk's system prompt. It's the single most important doc — if you understand what this agent is supposed to do, you understand the whole desk.
• Skim the other 13 — the Risk Gate and Prop-Firm Compliance agents are the ones that genuinely protect you.

Hour 2 — Wire Telegram (optional but recommended)
• Integrations → Add Integration → Telegram.
• Follow the BotFather flow (see "Telegram — the bot for /todo, /idea, and workflow outputs" in Integration Setup Guides).
• Send /start to your bot so the desk knows where to deliver briefings.

Hour 3 — Trigger the first briefing manually
• Go to Workflows → "Morning Briefing" → Run.
• Watch the Macro & Calendar / News & Sentiment / Macro Synthesis agents produce their feeds.
• The Chief of Desk composes the final brief and delivers it to Telegram (or to the Activity feed if Telegram isn't wired).

Hour 4 onward — Configure your prop firm (if applicable)
• If you're going for an Apex challenge (US) or FTMO / FundedNext (non-US), open the Prop-Firm Compliance agent's config.
• Pick your plan — $50k / $100k / $150k Apex, or FTMO's classic 2-step, or whatever you're signed up for.
• The agent loads the rule set and begins tracking headroom.

Day 2–14 — Let it run in Research mode.
• Every morning you'll get a briefing. Every evening a wrap.
• Propose a strategy hypothesis to the Chief of Desk in chat. The agent will walk you through writing it in risk-language, then route to the Backtest & Eval Agent for walk-forward + Deflated Sharpe validation.
• Spend this time watching whether the briefings are useful, whether your hypothesis survives backtesting, and whether the desk's defaults (Kelly 0.25×, daily loss stop, event cap) feel right for your risk budget.

Day 14 and beyond — Paper mode
• When you've seen at least one strategy pass backtest and feel the Research deliverables are genuinely helping, upgrade to Paper mode.
• From Paper, the same agents now route to your broker's demo account.
• Run 30+ paper trades before considering Live.

There is no shortcut past this sequence. The desk is deliberately slower than "just start trading" — that's the feature.`,
        links: [
          { label: "Workflows", href: "/admin/workflows" },
          { label: "Integrations", href: "/admin/integrations" }
        ],
        keywords: [
          "setup",
          "forex",
          "first 24 hours",
          "onboarding",
          "getting started"
        ]
      },
      {
        id: "forex-desk-prop-firm",
        title: "Prop firms 101 — why this is usually the right starting point",
        summary:
          "Pay a small fee, pass a challenge, trade the firm's capital. Lower personal risk than trading your own money.",
        body: `A prop firm is a trading company that funds traders who can pass a documented evaluation. You pay a one-time fee (typically $100–$500 for smaller accounts, more for larger), demonstrate a rule-compliant trading record over a challenge period, and if you pass, the firm puts $25k–$250k+ behind you. You keep 70–100% of the profits.

Why this is often the right first step:

• Lower personal capital risk. If you bust the challenge, you lose the fee — not your savings. If you pass and blow up a funded account, the firm eats it.
• Rules are codeable. The Risk Gate Agent and Prop-Firm Compliance Agent encode the firm's specific drawdown / consistency / trading-days rules as hard pre-trade gates. The desk's objective function under a prop firm is literally: maximize P(pass) × expected_payout − fee.
• Structure forces discipline. The daily drawdown rule in particular is the discipline mechanism most independent traders lack.

Supported rulesets in Phase 1:

US (CME futures — US retail CFDs are banned):
• Apex Trader Funding — the biggest and most systematic-trader-friendly.
• Topstep — oldest and most established.
• Earn2Trade — strong rule clarity.

Non-US (MT4/MT5/cTrader):
• FTMO — the classic 2-step evaluation.
• FundedNext — multiple plan types (Stellar, Evaluation, Express).
• The Funded Trader — wide plan selection.
• E8 Markets — 3-step Track plan.
• Alpha Capital Group, The5%ers, FundingPips, FunderPro — all supported rule families.

A few things the desk is honest about:

• Most prop-firm accounts also blow up. The published pass rates for 2-step evaluations are usually 10–20%, and funded-account survival rates are lower than the marketing implies.
• Some firms have had operational issues — MyForexFunds was shut by regulators in 2023, True Forex Funds closed in 2024 after MetaQuotes broker restrictions, FTMO no longer accepts US traders as of 2024–2025. The desk's KB is updated as these change.
• A prop firm is not a substitute for actually having edge. The rules are a floor, not a ceiling.

If this sounds like the right starting point for you, flip the Prop-Firm Compliance Agent on in your business config, pick your plan, and the agent takes it from there.`,
        keywords: [
          "prop firm",
          "apex",
          "ftmo",
          "fundednext",
          "topstep",
          "challenge",
          "funded account"
        ]
      },
      {
        id: "forex-desk-not-financial-advice",
        title: "Not financial advice — why the desk says this constantly",
        summary: "Why the 'not financial advice' banner exists and what it means.",
        body: `Every response from the Forex Desk's agents includes (or is logged alongside) a "Not financial advice" banner. This is not boilerplate. It's the honest truth, and it's there for three reasons:

1. Legal reality. Offering personalized investment advice requires licensing in most jurisdictions — Series 65 / Series 3 / Series 7 in the US, similar credentials in UK, EU, AU. The desk is not licensed. It produces research, runs risk checks, and journals trades you decide to take. It does not recommend which currency to trade with your money.

2. Every recommendation is conditional. A macro agent that tells you "EURUSD is set up to fall this week" is stating a hypothesis with an invalidation, not a prediction. The difference matters — if you take it as a prediction you will lose money when the hypothesis is wrong (and it will be, often).

3. You are the last decision. The desk can reject an order that violates a risk rule. It can queue an order in Approvals for you to review. But every trade that fires in Live mode happens because YOU clicked approve. That's deliberate. Responsibility cannot be delegated to software.

The Surveillance Agent actively blocks any outgoing response containing "guaranteed" / "risk-free" / "easy money" / "cannot lose" / "double your account." If you see those phrases in an agent's output, it's a bug — please flag it. They should never appear.

If you want personalized financial advice, talk to a licensed advisor in your jurisdiction. This desk is a disciplined research and operations tool; it is not your advisor.`,
        keywords: [
          "disclaimer",
          "not financial advice",
          "compliance",
          "legal",
          "licensing"
        ]
      }
    ]
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
        id: "youtube-quota-exceeded",
        title: "YouTube quota exceeded",
        summary: "What the daily 10,000-unit cap means and how to get more.",
        body: `Every Google Cloud project gets a daily quota of 10,000 units for the YouTube Data API. That number doesn't translate evenly to "calls" because different actions cost different amounts:

• Upload a video — 1,600 units
• Update a video's metadata or set a thumbnail — 50 units each
• List your channel's videos — about 3 units
• A single analytics query — 1 unit

So at 10,000 units/day you get roughly 6 uploads before you're capped, or 200 metadata edits, or thousands of analytics pulls. The ledger resets at midnight Pacific Time.

Mission Control tracks this in real time in the YouTubeQuotaUsage table (one row per organization per day). Every YouTube tool call preflight-checks the remaining balance before hitting the API, so if you're going to go over, the call fails cleanly with a clear error instead of mid-upload.

When you hit the cap:

1. Wait until midnight Pacific — the counter auto-resets.
2. Or, request a quota increase from Google. In Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas, you'll see a link to request more. Increases go through Google's review queue (typically a week) and require a brief description of your use case.
3. For short bursts (e.g. uploading a week's worth of content in one session), batch non-upload actions on days when you don't plan to upload. Metadata edits and analytics pulls rarely eat meaningful quota.
4. If you run multiple YouTube channels, consider creating separate Google Cloud projects for each channel. Each project has its own 10,000-unit/day cap.

To see your current usage: the Health page shows today's YouTube unit consumption once there's been any activity. If a workflow that uses YouTube has been failing, check Health first — a capped quota is the most common reason.`,
        links: [
          { label: "Health", href: "/admin/health" },
          { label: "Integrations", href: "/admin/integrations" }
        ],
        keywords: [
          "youtube",
          "quota",
          "10000 units",
          "daily limit",
          "exceeded",
          "rate limit",
          "upload failed"
        ]
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
