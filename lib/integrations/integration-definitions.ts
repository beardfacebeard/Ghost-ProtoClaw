export type IntegrationField = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url" | "select" | "textarea";
  required: boolean;
  secret: boolean;
  helpText?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
};

export type IntegrationDefinition = {
  key: string;
  name: string;
  description: string;
  icon: string;
  category:
    | "email"
    | "calendar"
    | "crm"
    | "payment"
    | "storage"
    | "communication"
    | "developer"
    | "marketing"
    | "ai";
  scope: "organization" | "business" | "both";
  authType: "api_key" | "oauth" | "bearer" | "multi_key";
  oauthProvider?: string;
  fields: IntegrationField[];
  requiredFields: string[];
  secretFields: string[];
  docs?: string;
  /** Provider's homepage — shown as a "Visit site" link on the card. */
  website?: string;
  /** Short free-text pricing line (e.g. "From $29/mo", "Free"). */
  pricingNote?: string;
  /** Coarse pricing tier; renders a colored badge on the card. */
  pricingTier?: "free" | "freemium" | "paid";
  /** Ordered step-by-step setup instructions shown on the card. */
  setupSteps?: string[];
  setupNotes?: string;
  tags: string[];
  comingSoon?: boolean;
};

function field(definition: IntegrationField): IntegrationField {
  return definition;
}

export const INTEGRATION_DEFINITIONS: IntegrationDefinition[] = [
  {
    key: "gmail",
    name: "Google Gmail",
    description:
      "Send, read, and triage incoming Gmail messages from Mission Control.",
    icon: "📧",
    category: "email",
    scope: "both",
    authType: "oauth",
    oauthProvider: "google",
    fields: [
      field({
        key: "client_id",
        label: "Google Client ID",
        placeholder: "Paste your Google OAuth client ID",
        type: "text",
        required: true,
        secret: false,
        helpText: "Found in Google Cloud Console under OAuth 2.0 Client IDs."
      }),
      field({
        key: "client_secret",
        label: "Google Client Secret",
        placeholder: "Paste your Google OAuth client secret",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "refresh_token",
        label: "Refresh Token",
        placeholder: "Filled automatically after OAuth, or paste manually",
        type: "password",
        required: true,
        secret: true,
        helpText: "Stored securely and used to refresh Gmail access."
      })
    ],
    requiredFields: ["client_id", "client_secret", "refresh_token"],
    secretFields: ["client_secret", "refresh_token", "access_token"],
    docs: "https://developers.google.com/gmail/api/guides",
    setupNotes:
      "Connect via Google OAuth below, or enter credentials manually.",
    tags: ["email", "google"]
  },
  {
    key: "google_calendar",
    name: "Google Calendar",
    description:
      "Read calendars, create events, and coordinate schedules automatically.",
    icon: "📅",
    category: "calendar",
    scope: "both",
    authType: "oauth",
    oauthProvider: "google",
    fields: [
      field({
        key: "client_id",
        label: "Google Client ID",
        placeholder: "Paste your Google OAuth client ID",
        type: "text",
        required: true,
        secret: false
      }),
      field({
        key: "client_secret",
        label: "Google Client Secret",
        placeholder: "Paste your Google OAuth client secret",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "refresh_token",
        label: "Refresh Token",
        placeholder: "Filled automatically after OAuth, or paste manually",
        type: "password",
        required: true,
        secret: true
      })
    ],
    requiredFields: ["client_id", "client_secret", "refresh_token"],
    secretFields: ["client_secret", "refresh_token", "access_token"],
    docs: "https://developers.google.com/calendar/api/guides/overview",
    setupNotes:
      "Connect via Google OAuth below, or enter credentials manually.",
    tags: ["calendar", "google"]
  },
  {
    key: "sendgrid",
    name: "SendGrid",
    description:
      "Deliver transactional emails, sequences, and automated notifications.",
    icon: "✉️",
    category: "email",
    scope: "both",
    authType: "api_key",
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Paste your SendGrid API key",
        type: "password",
        required: true,
        secret: true
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://docs.sendgrid.com/api-reference",
    tags: ["email", "transactional"]
  },
  {
    key: "hubspot",
    name: "HubSpot",
    description:
      "Sync CRM contacts, deals, notes, and pipeline activity into your AI operations.",
    icon: "🧲",
    category: "crm",
    scope: "both",
    authType: "oauth",
    oauthProvider: "hubspot",
    fields: [
      field({
        key: "access_token",
        label: "Access Token",
        placeholder: "Paste your HubSpot access token",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "portal_id",
        label: "Portal ID",
        placeholder: "Optional HubSpot portal ID",
        type: "text",
        required: false,
        secret: false
      })
    ],
    requiredFields: ["access_token"],
    secretFields: ["access_token"],
    docs: "https://developers.hubspot.com/docs/api/overview",
    tags: ["crm", "marketing"]
  },
  {
    key: "pipedrive",
    name: "Pipedrive",
    description:
      "Track leads, deals, and contact activity from your Pipedrive account.",
    icon: "📈",
    category: "crm",
    scope: "both",
    authType: "api_key",
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Paste your Pipedrive API token",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "company_domain",
        label: "Company Domain",
        placeholder: "yourcompany",
        type: "text",
        required: true,
        secret: false,
        helpText: "Use the subdomain from your Pipedrive workspace URL."
      })
    ],
    requiredFields: ["api_key", "company_domain"],
    secretFields: ["api_key"],
    docs: "https://developers.pipedrive.com/docs/api/v1",
    tags: ["crm", "sales"]
  },
  {
    key: "gohighlevel",
    name: "GoHighLevel",
    description:
      "Connect agency CRM data, locations, and campaign activity from GoHighLevel.",
    icon: "🏁",
    category: "crm",
    scope: "both",
    authType: "api_key",
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Paste your GoHighLevel API key",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "location_id",
        label: "Location ID",
        placeholder: "Paste the location ID you want to connect",
        type: "text",
        required: true,
        secret: false
      })
    ],
    requiredFields: ["api_key", "location_id"],
    secretFields: ["api_key"],
    docs: "https://highlevel.stoplight.io/docs/integrations",
    tags: ["crm", "marketing", "agency"]
  },
  {
    key: "stripe",
    name: "Stripe",
    description:
      "Track payments, subscriptions, and billing events with secure webhook support.",
    icon: "💳",
    category: "payment",
    scope: "both",
    authType: "multi_key",
    fields: [
      field({
        key: "secret_key",
        label: "Secret Key",
        placeholder: "sk_live_...",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "publishable_key",
        label: "Publishable Key",
        placeholder: "pk_live_...",
        type: "text",
        required: false,
        secret: false
      }),
      field({
        key: "webhook_secret",
        label: "Webhook Secret",
        placeholder: "whsec_...",
        type: "password",
        required: true,
        secret: true
      })
    ],
    requiredFields: ["secret_key", "webhook_secret"],
    secretFields: ["secret_key", "webhook_secret"],
    docs: "https://docs.stripe.com/api",
    setupNotes:
      "Webhook secret is found in Stripe Dashboard -> Developers -> Webhooks after adding your endpoint.",
    tags: ["payment", "ecommerce"]
  },
  {
    key: "slack",
    name: "Slack",
    description:
      "Send team updates, monitor channels, and route workflow results into Slack.",
    icon: "💬",
    category: "communication",
    scope: "both",
    authType: "oauth",
    oauthProvider: "slack",
    fields: [
      field({
        key: "bot_token",
        label: "Bot Token",
        placeholder: "xoxb-...",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "signing_secret",
        label: "Signing Secret",
        placeholder: "Paste your Slack signing secret",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "channel_id",
        label: "Default Channel ID",
        placeholder: "C0123456789",
        type: "text",
        required: false,
        secret: false
      })
    ],
    requiredFields: ["bot_token", "signing_secret"],
    secretFields: ["bot_token", "signing_secret"],
    docs: "https://api.slack.com/web",
    tags: ["communication", "team"]
  },
  {
    key: "telegram",
    name: "Telegram",
    description:
      "Send messages, approvals, and alerts into Telegram chats and channels.",
    icon: "✈️",
    category: "communication",
    scope: "both",
    authType: "api_key",
    fields: [
      field({
        key: "bot_token",
        label: "Bot Token",
        placeholder: "Paste the bot token from BotFather",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "chat_id",
        label: "Default Chat ID (optional)",
        placeholder: "Auto-detected when users message the bot",
        type: "text",
        required: false,
        secret: false
      })
    ],
    requiredFields: ["bot_token"],
    secretFields: ["bot_token"],
    docs: "https://core.telegram.org/bots/api",
    setupNotes:
      "1. Open Telegram and search for @BotFather (https://t.me/BotFather). " +
      "2. Send /newbot and follow the prompts to name your bot. " +
      "3. Copy the bot token BotFather gives you and paste it above. " +
      "4. After connecting, go to Settings → Integrations → Telegram and click 'Register Webhook' to activate. " +
      "5. Open your bot in Telegram and send /start to link it to an agent. " +
      "Use /agents to list available agents and /switch <name> to change agents.",
    tags: ["communication", "messaging"]
  },
  {
    key: "twilio",
    name: "Twilio",
    description:
      "Send SMS updates and automate voice or messaging workflows through Twilio.",
    icon: "📱",
    category: "communication",
    scope: "both",
    authType: "multi_key",
    fields: [
      field({
        key: "account_sid",
        label: "Account SID",
        placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "text",
        required: true,
        secret: false
      }),
      field({
        key: "auth_token",
        label: "Auth Token",
        placeholder: "Paste your Twilio auth token",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "phone_number",
        label: "Phone Number",
        placeholder: "+1 555 000 0000",
        type: "text",
        required: false,
        secret: false
      })
    ],
    requiredFields: ["account_sid", "auth_token"],
    secretFields: ["auth_token"],
    docs: "https://www.twilio.com/docs/api",
    tags: ["communication", "sms"]
  },
  {
    key: "github",
    name: "GitHub",
    description:
      "Give agents secure access to repositories, pull requests, issues, and code search.",
    icon: "💻",
    category: "developer",
    scope: "both",
    authType: "bearer",
    fields: [
      field({
        key: "personal_access_token",
        label: "Personal Access Token",
        placeholder: "ghp_...",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "org_or_username",
        label: "Organization or Username",
        placeholder: "ghostprotoclaw",
        type: "text",
        required: false,
        secret: false
      }),
      field({
        key: "default_repo",
        label: "Default Repository",
        placeholder: "mission-control",
        type: "text",
        required: false,
        secret: false
      })
    ],
    requiredFields: ["personal_access_token"],
    secretFields: ["personal_access_token"],
    docs: "https://docs.github.com/en/rest",
    tags: ["developer", "git"]
  },
  {
    key: "google_drive",
    name: "Google Drive",
    description:
      "Access files, folders, and shared documents from Google Drive.",
    icon: "📁",
    category: "storage",
    scope: "both",
    authType: "oauth",
    oauthProvider: "google",
    fields: [
      field({
        key: "client_id",
        label: "Google Client ID",
        placeholder: "Paste your Google OAuth client ID",
        type: "text",
        required: true,
        secret: false
      }),
      field({
        key: "client_secret",
        label: "Google Client Secret",
        placeholder: "Paste your Google OAuth client secret",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "refresh_token",
        label: "Refresh Token",
        placeholder: "Filled automatically after OAuth, or paste manually",
        type: "password",
        required: true,
        secret: true
      })
    ],
    requiredFields: ["client_id", "client_secret", "refresh_token"],
    secretFields: ["client_secret", "refresh_token", "access_token"],
    docs: "https://developers.google.com/drive/api/guides/about-sdk",
    setupNotes:
      "Connect via Google OAuth below, or enter credentials manually.",
    tags: ["storage", "google"]
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    description:
      "Use one connection to access 100+ models, including free and paid options.",
    icon: "🧠",
    category: "ai",
    scope: "both",
    authType: "oauth",
    oauthProvider: "openrouter",
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Paste your OpenRouter API key",
        type: "password",
        required: true,
        secret: true
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://openrouter.ai/docs/overview/introduction",
    setupNotes:
      "OpenRouter lets you use 100+ models with one key. Free models available - no credit card required.",
    tags: ["ai", "models"]
  },
  {
    key: "openai",
    name: "OpenAI",
    description:
      "Powers GPT model routing for agents AND semantic search over your knowledge base (text-embedding-3-small). Paste your key once — the knowledge_lookup tool flips on automatically.",
    icon: "🤖",
    category: "ai",
    scope: "both",
    authType: "api_key",
    website: "https://platform.openai.com/",
    pricingTier: "paid",
    pricingNote:
      "Pay-as-you-go. Embeddings are cheap (~$0.02 / 1M tokens — embedding 40 KB items ≈ $0.001). GPT model usage billed separately.",
    setupSteps: [
      "Create / log in at platform.openai.com.",
      "Open Dashboard → API keys → Create new secret key. Copy immediately (shown once).",
      "Add at least $5 of credit under Settings → Billing so the key is active.",
      "Paste the key below and save. Test by asking any agent to call knowledge_lookup."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "sk-...",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "org_id",
        label: "Organization ID",
        placeholder: "org_...",
        type: "text",
        required: false,
        secret: false,
        helpText:
          "Only needed if your account belongs to multiple orgs. Leave blank otherwise."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://platform.openai.com/docs/api-reference",
    tags: ["ai", "models", "embeddings"]
  },
  {
    key: "anthropic",
    name: "Anthropic",
    description:
      "Connect Claude models directly for long-context reasoning and writing tasks.",
    icon: "🪶",
    category: "ai",
    scope: "both",
    authType: "api_key",
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "sk-ant-...",
        type: "password",
        required: true,
        secret: true
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://docs.anthropic.com/en/api/overview",
    tags: ["ai", "models"]
  },
  {
    key: "meta_ads",
    name: "Meta (Facebook / Instagram)",
    description:
      "Sync Meta Ads and social campaign data into Mission Control.",
    icon: "📣",
    category: "marketing",
    scope: "both",
    authType: "oauth",
    oauthProvider: "meta",
    fields: [],
    requiredFields: [],
    secretFields: [],
    docs: "https://developers.facebook.com/docs/marketing-apis",
    tags: ["marketing", "social", "ads"],
    comingSoon: true
  },
  {
    key: "cloudflare_r2",
    name: "Cloudflare R2 Storage",
    description:
      "S3-compatible object storage for big video uploads, brand assets, and generated content. Direct browser uploads to R2 skip the 25 MB Next.js limit.",
    icon: "☁️",
    category: "storage",
    scope: "organization",
    authType: "multi_key",
    website: "https://www.cloudflare.com/developer-platform/products/r2/",
    pricingTier: "freemium",
    pricingNote: "Free: 10 GB storage + 1M writes/mo. Paid: $0.015/GB/mo, $0 egress.",
    setupSteps: [
      "Create a Cloudflare account at cloudflare.com (free).",
      "In the dashboard, open R2 → Create bucket, name it (e.g. ghost-protoclaw-assets).",
      "Open R2 → Manage R2 API Tokens → Create API Token.",
      "Token permissions: check BOTH 'Object Read + Write' AND 'Admin Read + Write'. The Admin scope is what lets the app auto-configure CORS for you on first upload — skip it and you'll have to paste the CORS JSON into Cloudflare by hand (the app walks you through it with copy buttons, but it's an extra step).",
      "Copy the access key id and secret on the next screen (shown once).",
      "Copy your Account ID from the right sidebar of the dashboard.",
      "Optional: set up a public dev subdomain (bucket → Settings → Public access) and paste that URL into Public Base URL for stable shareable links.",
      "After saving here, visit /admin/brand-assets or /admin/uploads and try an upload. If your token has Admin Write the first upload auto-configures CORS silently. If not, an amber panel appears with a step-by-step + JSON to paste into Cloudflare → your bucket → Settings → CORS Policy → + Add (60-second one-time fix)."
    ],
    fields: [
      field({
        key: "account_id",
        label: "Account ID",
        placeholder: "32-character Cloudflare account id",
        type: "text",
        required: true,
        secret: false,
        helpText:
          "Cloudflare dashboard → right sidebar → Account ID (the value, not the label)."
      }),
      field({
        key: "access_key_id",
        label: "Access Key ID",
        placeholder: "R2 API token access key",
        type: "text",
        required: true,
        secret: true,
        helpText:
          "R2 → Manage R2 API Tokens → Create API Token with Object Read+Write on your bucket."
      }),
      field({
        key: "secret_access_key",
        label: "Secret Access Key",
        placeholder: "R2 API token secret",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "bucket",
        label: "Bucket Name",
        placeholder: "ghost-protoclaw-assets",
        type: "text",
        required: true,
        secret: false
      }),
      field({
        key: "public_base_url",
        label: "Public Base URL (optional)",
        placeholder: "https://pub-XXXX.r2.dev or your custom domain",
        type: "url",
        required: false,
        secret: false,
        helpText:
          "When set, uploaded files get a stable public URL. Without it, we fall back to 24-hour presigned GET URLs."
      })
    ],
    requiredFields: ["account_id", "access_key_id", "secret_access_key", "bucket"],
    secretFields: ["access_key_id", "secret_access_key"],
    docs: "https://developers.cloudflare.com/r2/api/s3/tokens/",
    setupNotes:
      "R2 is S3-compatible. Create a bucket first, then an API token scoped to that bucket.",
    tags: ["storage", "r2", "uploads"]
  },
  {
    key: "heygen",
    name: "HeyGen (AI Avatar Video)",
    description:
      "Generate avatar talking-head videos from a script. Best for single-avatar quality — course promos, explainers, founder-voice content.",
    icon: "🎤",
    category: "ai",
    scope: "both",
    authType: "api_key",
    website: "https://www.heygen.com/",
    pricingTier: "paid",
    pricingNote: "API access from $99/mo (Creator API plan). No free API tier — web trial is UI-only.",
    setupSteps: [
      "Sign up at heygen.com and verify your email.",
      "Upgrade to a plan that includes API access (Creator API at $99/mo or Enterprise).",
      "Click your avatar (top right) → Settings → API.",
      "Create a new API token and copy it immediately (shown once).",
      "Paste the token below and save. Test with heygen_list_avatars in any agent chat to confirm."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Paste your HeyGen API key",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "heygen.com → Profile → Subscriptions (API plan) → Settings → API."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://docs.heygen.com/",
    tags: ["ai", "video", "avatar"]
  },
  {
    key: "creatify",
    name: "Creatify (AI UGC Videos)",
    description:
      "High-volume AI UGC avatar video generation. Cheaper per-video than HeyGen — ideal for 10–20 hook-variation testing batches.",
    icon: "🧪",
    category: "ai",
    scope: "both",
    authType: "multi_key",
    website: "https://creatify.ai/",
    pricingTier: "paid",
    pricingNote: "From $39/mo (Starter). API access included on Pro plan ($99/mo) and above.",
    setupSteps: [
      "Sign up at creatify.ai and upgrade to a plan with API access (Pro or higher).",
      "Open Workspace Settings → API → Generate.",
      "Copy BOTH the X-API-ID and X-API-KEY values — you need both.",
      "Paste them in the fields below and save.",
      "Test with creatify_list_avatars in any agent chat to confirm."
    ],
    fields: [
      field({
        key: "api_id",
        label: "API ID",
        placeholder: "X-API-ID header value",
        type: "text",
        required: true,
        secret: true,
        helpText:
          "Creatify → Settings → API. Both the API ID and the API Key are required."
      }),
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "X-API-KEY header value",
        type: "password",
        required: true,
        secret: true
      })
    ],
    requiredFields: ["api_id", "api_key"],
    secretFields: ["api_id", "api_key"],
    docs: "https://docs.creatify.ai",
    tags: ["ai", "video", "ugc"]
  },
  {
    key: "auto_clip",
    name: "Auto-Clip (Klap / Opus Clip)",
    description:
      "Automatically cut long-form videos into short-form clips with burned-in captions. Uses Klap by default (open API). Paste an Opus Clip key instead once you have their enterprise API access.",
    icon: "✂️",
    category: "ai",
    scope: "both",
    authType: "api_key",
    website: "https://klap.app/",
    pricingTier: "freemium",
    pricingNote: "Klap: limited free trial, then $29/mo (Basic) or $79/mo (Pro). Opus Clip API is enterprise-gated.",
    setupSteps: [
      "Sign up at klap.app and verify your email.",
      "Open Account → API (visible once you're on a paid plan — Basic or higher).",
      "Generate an API key and copy it.",
      "Paste it into Klap API Key below and save.",
      "Leave Opus Clip API Key blank unless you have their enterprise access — we'll use Klap automatically."
    ],
    fields: [
      field({
        key: "klap_api_key",
        label: "Klap API Key",
        placeholder: "Klap API key (preferred — public API)",
        type: "password",
        required: false,
        secret: true,
        helpText: "klap.app → Settings → API."
      }),
      field({
        key: "opusclip_api_key",
        label: "Opus Clip API Key (optional)",
        placeholder: "Opus Clip enterprise API key",
        type: "password",
        required: false,
        secret: true,
        helpText:
          "Only fill this once you have Opus Clip's enterprise API access — otherwise leave blank and we'll use Klap."
      })
    ],
    requiredFields: [],
    secretFields: ["klap_api_key", "opusclip_api_key"],
    docs: "https://klap.app/api",
    setupNotes: "At least one of the two keys must be set for auto_clip_* tools to work.",
    tags: ["ai", "video", "auto-clip"]
  },
  {
    key: "fal_ai",
    name: "fal.ai (Image + Video Generation)",
    description:
      "Single API that gives your agents FLUX for images, Recraft for vector logos, Kling / Luma / LTX for video, and dozens of other models. Backs the generate_image and generate_video tools — your agents can produce logos, social banners, B-roll, product shots, and short videos on demand.",
    icon: "🎨",
    category: "ai",
    scope: "both",
    authType: "api_key",
    website: "https://fal.ai/",
    pricingTier: "paid",
    pricingNote:
      "Pay-per-generation. FLUX ~\\$0.025/image, Recraft ~\\$0.04/image, Kling video ~\\$0.35/5s clip. Free \\$5 credit on signup.",
    setupSteps: [
      "Sign up at fal.ai (GitHub or Google auth).",
      "Go to fal.ai/dashboard/keys → Add API Key.",
      "Copy the key (starts with 'fal-' or a UUID).",
      "Paste it below and save.",
      "Optional: add a payment method under Billing. You get \\$5 free credit which is enough for 100+ images or a few video clips."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Paste your fal.ai API key",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "fal.ai/dashboard/keys → Add API Key. Copy once; shown only at creation."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://docs.fal.ai/",
    tags: ["ai", "image", "video", "generation"]
  },
  {
    key: "elevenlabs",
    name: "ElevenLabs (AI Voiceover)",
    description:
      "High-quality text-to-speech with voice cloning. Powers the generate_voiceover tool — agents turn approved scripts into mp3 voiceovers that land directly in R2. One custom-cloned voice per channel is the industry standard; set default_voice_id once so every call uses it.",
    icon: "🗣️",
    category: "ai",
    scope: "both",
    authType: "api_key",
    website: "https://elevenlabs.io/",
    pricingTier: "freemium",
    pricingNote:
      "Free: 10 000 chars/mo, no commercial rights. Starter $5/mo (30K chars + commercial). Creator $22/mo (100K chars + Voice Cloning). ~$0.10–$0.12 per 1K chars on v2/v3.",
    setupSteps: [
      "Sign up at elevenlabs.io and upgrade to Starter ($5/mo) or Creator ($22/mo) — Voice Cloning requires Creator.",
      "Voice Lab → Instant Voice Cloning → upload 1+ minute of clean audio of the channel's voice OR pick a prebuilt voice from the Voice Library.",
      "Click the voice → copy its voice ID (the hash after /voices/).",
      "Profile → API Keys → Create API Key → copy it.",
      "Paste API Key + default Voice ID below. Test with list_elevenlabs_voices in any agent chat."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Your ElevenLabs API key",
        type: "password",
        required: true,
        secret: true,
        helpText: "elevenlabs.io → Profile → API Keys → Create API Key."
      }),
      field({
        key: "default_voice_id",
        label: "Default Voice ID (optional but recommended)",
        placeholder: "e.g. 21m00Tcm4TlvDq8ikWAM",
        type: "text",
        required: false,
        secret: false,
        helpText:
          "The one voice this channel uses forever — a cloned voice or a prebuilt one. When set, generate_voiceover uses it unless the agent passes a different voice_id."
      }),
      field({
        key: "model_id",
        label: "Default Model",
        placeholder: "eleven_multilingual_v2",
        type: "select",
        required: false,
        secret: false,
        options: [
          { value: "eleven_multilingual_v2", label: "Multilingual v2 (balanced, default)" },
          { value: "eleven_multilingual_v3", label: "Multilingual v3 (highest quality)" },
          { value: "eleven_flash_v2_5", label: "Flash v2.5 (fastest, draft quality)" },
          { value: "eleven_turbo_v2_5", label: "Turbo v2.5 (low-latency streaming)" }
        ]
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://elevenlabs.io/docs/api-reference",
    tags: ["ai", "voice", "tts"]
  },
  {
    key: "json2video",
    name: "JSON2Video (Timeline Assembly)",
    description:
      "Programmatic video editor that turns a JSON template (voiceover + B-roll + on-screen text + transitions + music) into a finished mp4. The Assembly Engineer agent calls assemble_video with a template and check_video_assembly to fetch the result into R2.",
    icon: "🎬",
    category: "ai",
    scope: "both",
    authType: "api_key",
    website: "https://json2video.com/",
    pricingTier: "paid",
    pricingNote:
      "From $49.95/mo (200 min render + TTS credits included). Pay-per-minute option above the plan cap.",
    setupSteps: [
      "Sign up at json2video.com and pick a plan.",
      "Account → API Key → Create → copy the key.",
      "Paste it below and save. Test with assemble_video in any agent chat.",
      "Optional: if you manage multiple channels on one account, set a Default Project ID so jobs are grouped in their dashboard."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Your JSON2Video API key",
        type: "password",
        required: true,
        secret: true,
        helpText: "json2video.com → Account → API Key."
      }),
      field({
        key: "default_project_id",
        label: "Default Project ID (optional)",
        placeholder: "Leave blank unless multi-channel",
        type: "text",
        required: false,
        secret: false
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://json2video.com/docs/",
    tags: ["ai", "video", "assembly"]
  },
  {
    key: "youtube",
    name: "YouTube (Publish + Analytics)",
    description:
      "Upload videos, set metadata + thumbnails, post Community updates, and pull per-video analytics (CTR, AVD, returning viewers) for any channel you own. Uses Google OAuth — connect your YouTube channel once and every agent tool that touches YouTube will work.",
    icon: "▶️",
    category: "marketing",
    scope: "both",
    authType: "oauth",
    oauthProvider: "google",
    website: "https://developers.google.com/youtube/v3",
    pricingTier: "free",
    pricingNote:
      "API is free. Default quota 10 000 units/day — an upload costs 1600 units, so ~6 uploads/day per channel before needing a quota increase request.",
    setupSteps: [
      "Go to console.cloud.google.com → create a new project (or reuse one).",
      "APIs & Services → Library → enable BOTH 'YouTube Data API v3' and 'YouTube Analytics API'.",
      "APIs & Services → OAuth consent screen → External → add scopes: youtube.upload, youtube.readonly, yt-analytics.readonly, youtube.force-ssl.",
      "Credentials → Create Credentials → OAuth client ID (Web application). Add authorized redirect URI pointing to /api/integrations/youtube/callback on your deployed app.",
      "Copy the Client ID + Client Secret into the fields below.",
      "Click 'Connect with Google' (coming soon — for now paste the refresh_token manually from a one-off Google OAuth playground flow).",
      "Optional: paste the specific Channel ID if you want to pin the integration to one channel (leave blank for the authenticated user's default channel)."
    ],
    fields: [
      field({
        key: "client_id",
        label: "Google OAuth Client ID",
        placeholder: "abc123.apps.googleusercontent.com",
        type: "text",
        required: true,
        secret: false,
        helpText:
          "Google Cloud Console → Credentials → OAuth 2.0 Client IDs (Web application)."
      }),
      field({
        key: "client_secret",
        label: "Google OAuth Client Secret",
        placeholder: "Paste the client secret",
        type: "password",
        required: true,
        secret: true
      }),
      field({
        key: "refresh_token",
        label: "Refresh Token",
        placeholder: "Filled by OAuth callback — or paste manually",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "Granted once during the Google OAuth dance. Stored encrypted and used to mint short-lived access tokens."
      }),
      field({
        key: "channel_id",
        label: "Channel ID (optional)",
        placeholder: "UC... (leave blank for default channel)",
        type: "text",
        required: false,
        secret: false,
        helpText:
          "Only needed if the authenticated Google account manages multiple YouTube channels."
      })
    ],
    requiredFields: ["client_id", "client_secret", "refresh_token"],
    secretFields: [
      "client_secret",
      "refresh_token",
      "access_token",
      "access_token_expires_at"
    ],
    docs: "https://developers.google.com/youtube/v3/docs",
    setupNotes:
      "An upload costs 1600 of your daily 10 000 quota units. Plan publishes accordingly — the built-in quota ledger blocks uploads that would exceed the cap and surfaces a clean error instead of a mid-upload failure.",
    tags: ["marketing", "video", "youtube", "publish", "analytics"]
  },
  {
    key: "pexels",
    name: "Pexels (Free Stock B-Roll)",
    description:
      "Free, commercial-use B-roll video search. Powers the B-Roll + Text Overlay Pack workflow.",
    icon: "🎞️",
    category: "ai",
    scope: "both",
    authType: "api_key",
    website: "https://www.pexels.com/",
    pricingTier: "free",
    pricingNote: "100% free. 200 requests/hour, 20 000/month. Attribution optional.",
    setupSteps: [
      "Create a free account at pexels.com.",
      "Go to pexels.com/api/new and describe what you're building (one sentence is fine).",
      "Your API key appears instantly — copy it.",
      "Paste it below and save. Test with broll_search in any agent chat."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Your Pexels API key",
        type: "password",
        required: true,
        secret: true,
        helpText: "pexels.com/api/new — free self-serve, takes about 60 seconds."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://www.pexels.com/api/documentation/",
    tags: ["ai", "video", "broll"]
  },
  {
    key: "blotato",
    name: "Blotato",
    description:
      "Publish to 9 social platforms (TikTok, IG, X, YouTube, FB, LinkedIn, Threads, Pinterest, Reddit) from one queue. Powers blotato_* tools.",
    icon: "🐦",
    category: "marketing",
    scope: "both",
    authType: "api_key",
    setupSteps: [
      "Sign up at https://my.blotato.com — free trial available.",
      "Connect at least one social account in Blotato's dashboard.",
      "Open Settings → API and copy your API key.",
      "Paste below and save. Test with blotato_list_accounts in any agent chat."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Your Blotato API key",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "my.blotato.com → Settings → API. Note: you must connect the social accounts you want to post to inside Blotato first."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://docs.blotato.com",
    tags: ["social", "publishing", "multi-platform"]
  },
  {
    key: "a_leads",
    name: "A-Leads",
    description:
      "B2B prospect data — search companies, find emails and phones, verify contacts. Powers a_leads_* tools.",
    icon: "🔎",
    category: "crm",
    scope: "both",
    authType: "api_key",
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Your A-Leads API key",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "Available on your A-Leads account dashboard. Shared rate limits: 200/min, 600/hour, 6000/day."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://a-leads.io/docs",
    tags: ["prospect-data", "b2b", "outreach"]
  },
  {
    key: "rentcast",
    name: "RentCast",
    description:
      "140M+ property records, AVM value + rent estimates, sale & rental listings, comps, and market data. Powers rentcast_* tools and the unified property_* search tools. Recommended for Dealhawk Empire.",
    icon: "🏠",
    category: "ai",
    scope: "both",
    authType: "api_key",
    pricingTier: "freemium",
    pricingNote: "Free tier: 50 calls/month. Paid from ~$74/mo for 1,000 calls.",
    setupSteps: [
      "Sign up at https://www.rentcast.io/api — free tier requires no credit card.",
      "After signup, open your API dashboard and generate an API key.",
      "Paste the key below and save.",
      "Test with rentcast_value_estimate or property_value_estimate in any agent chat."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Key",
        placeholder: "Your RentCast API key",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "developers.rentcast.io → API Dashboard. Free tier is 50 calls/month; paid plans start ~$74/mo for 1,000 calls."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://developers.rentcast.io/reference",
    website: "https://www.rentcast.io/api",
    tags: ["real-estate", "property-data", "avm", "comps", "dealhawk"]
  },
  {
    key: "axesso_zillow",
    name: "Axesso Zillow API",
    description:
      "20+ Zillow GET endpoints — property search, ZPID lookup, Zestimate, price history, comps, neighborhood data, accessibility scores. Powers axesso_zillow_* tools. Recommended for Dealhawk Empire when you need Zillow-native data (ZPIDs, Zestimates, Zillow's own price history).",
    icon: "🗺️",
    category: "ai",
    scope: "both",
    authType: "api_key",
    pricingTier: "paid",
    pricingNote: "Tiered subscription via Azure API Management. Pricing on the developer portal.",
    setupSteps: [
      "Sign up at https://axesso.developer.azure-api.net/signup.",
      "Subscribe to the Zillow API product on the Products page.",
      "Open your profile → Subscriptions and copy your primary key.",
      "Paste below and save.",
      "Test with axesso_zillow_search_by_location or axesso_zillow_property_details in any agent chat."
    ],
    fields: [
      field({
        key: "subscription_key",
        label: "Subscription Key",
        placeholder: "Your Azure API Management subscription key",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "Azure API Management subscription key (sent as Ocp-Apim-Subscription-Key header). Find it on the Axesso developer portal under your profile → Subscriptions."
      })
    ],
    requiredFields: ["subscription_key"],
    secretFields: ["subscription_key"],
    docs: "https://axesso.developer.azure-api.net/api-details",
    website: "https://axesso.de/zillow-api/",
    tags: ["real-estate", "zillow", "property-data", "dealhawk"]
  },
  {
    key: "realie",
    name: "Realie",
    description:
      "Nationwide property + ownership data API. Address lookup, parcel lookup, location search, owner search (incl. Lucene fuzzy matching), comparables. Powers realie_* tools and the unified property_owner_lookup tool. Recommended for Dealhawk Empire skip-trace / owner research.",
    icon: "📇",
    category: "ai",
    scope: "both",
    authType: "bearer",
    pricingTier: "freemium",
    pricingNote: "Free tier available. Paid plans from $50/mo, 100 parcels per request.",
    setupSteps: [
      "Sign up at https://www.realie.ai/pricing — free tier requires no credit card.",
      "After signup, open the dashboard and copy your API token.",
      "Paste below and save.",
      "Test with realie_address_lookup or property_owner_lookup in any agent chat."
    ],
    fields: [
      field({
        key: "api_key",
        label: "API Token",
        placeholder: "Your Realie API token",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "Sent as Authorization: Bearer <token>. Get it from your Realie dashboard after signup. Free tier available."
      })
    ],
    requiredFields: ["api_key"],
    secretFields: ["api_key"],
    docs: "https://docs.realie.ai/",
    website: "https://www.realie.ai/real-estate-data-api",
    tags: ["real-estate", "property-data", "owner-data", "skip-trace", "dealhawk"]
  }
];

export function getIntegrationByKey(key: string) {
  return INTEGRATION_DEFINITIONS.find((definition) => definition.key === key);
}

export function getIntegrationsByCategory(category: string) {
  return INTEGRATION_DEFINITIONS.filter(
    (definition) => definition.category === category
  );
}

export function getIntegrationCategories() {
  return [...new Set(INTEGRATION_DEFINITIONS.map((definition) => definition.category))];
}
