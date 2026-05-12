export type McpConfigField = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url" | "select" | "textarea";
  required?: boolean;
  helpText?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
};

export type McpDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category:
    | "search"
    | "data"
    | "communication"
    | "developer"
    | "productivity"
    | "ai"
    | "social"
    | "automation";
  publisher: string;
  version: string;
  installCommand?: string;
  configFields: McpConfigField[];
  secretFields: string[];
  capabilities: string[];
  useCases: string[];
  requiresIntegration?: string;
  docs?: string;
  comingSoon?: boolean;
  /** Visible on the card — tells the user where to sign up or get an API key. */
  setupNote?: string;
};

function configField(field: McpConfigField): McpConfigField {
  return field;
}

export const MCP_DEFINITIONS: McpDefinition[] = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web in real-time",
    icon: "🔎",
    category: "search",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "provider",
        label: "Search Provider",
        placeholder: "Choose a provider",
        type: "select",
        required: true,
        options: [
          { value: "tavily", label: "Tavily" },
          { value: "brave", label: "Brave Search" },
          { value: "serper", label: "Serper" }
        ]
      })
    ],
    secretFields: ["api_key"],
    capabilities: ["web_search", "news_search", "link_fetching"],
    useCases: [
      "Research competitors",
      "Find current news",
      "Look up information for customers"
    ],
    docs: "https://modelcontextprotocol.io/introduction",
    setupNote:
      "Requires an API key from your chosen provider. Tavily: https://tavily.com (free tier). Brave Search: https://brave.com/search/api (2,000 free queries/mo). Serper: https://serper.dev (free tier)."
  },
  {
    id: "filesystem",
    name: "File System Access",
    description: "Read and write files in the workspace",
    icon: "📂",
    category: "developer",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "base_path",
        label: "Base Directory Path",
        placeholder: "/businesses/my-business/",
        type: "text",
        required: true
      })
    ],
    secretFields: [],
    capabilities: ["file_read", "file_write", "directory_list"],
    useCases: [
      "Read and write agent workspace files",
      "Manage business documents"
    ],
    docs: "https://modelcontextprotocol.io/introduction"
  },
  {
    id: "github_mcp",
    name: "GitHub MCP",
    description: "Interact with GitHub repos, issues, and PRs",
    icon: "🐙",
    category: "developer",
    publisher: "Model Context Protocol",
    version: "1.0.0",
    configFields: [],
    secretFields: [],
    capabilities: ["repo_read", "issues", "pull_requests", "code_search"],
    useCases: [
      "Track project progress",
      "Review code changes",
      "Summarize PR activity"
    ],
    requiresIntegration: "github",
    docs: "https://modelcontextprotocol.io/introduction",
    setupNote:
      "Requires a GitHub connection. Generate a Personal Access Token at https://github.com/settings/tokens then connect it in Integrations."
  },
  {
    id: "slack_mcp",
    name: "Slack MCP",
    description: "Send messages and read channels in Slack",
    icon: "💬",
    category: "communication",
    publisher: "Model Context Protocol",
    version: "1.0.0",
    configFields: [],
    secretFields: [],
    capabilities: ["send_message", "read_channel", "list_channels"],
    useCases: [
      "Send team updates",
      "Monitor mentions",
      "Broadcast workflow results"
    ],
    requiresIntegration: "slack",
    docs: "https://modelcontextprotocol.io/introduction",
    setupNote:
      "Requires a Slack connection. Create a Slack App at https://api.slack.com/apps then connect it in Integrations."
  },
  {
    id: "stripe_mcp",
    name: "Stripe MCP",
    description: "Query Stripe for payment and subscription data",
    icon: "💳",
    category: "data",
    publisher: "Model Context Protocol",
    version: "1.0.0",
    configFields: [],
    secretFields: [],
    capabilities: [
      "read_payments",
      "read_customers",
      "read_subscriptions"
    ],
    useCases: [
      "Check revenue metrics",
      "Look up customer accounts",
      "Monitor failed payments"
    ],
    requiresIntegration: "stripe",
    docs: "https://modelcontextprotocol.io/introduction",
    setupNote:
      "Requires a Stripe connection. Get your API keys at https://dashboard.stripe.com/apikeys then connect in Integrations."
  },
  {
    id: "hubspot_mcp",
    name: "HubSpot MCP",
    description: "Read and write HubSpot CRM contacts and deals",
    icon: "🧲",
    category: "data",
    publisher: "Model Context Protocol",
    version: "1.0.0",
    configFields: [],
    secretFields: [],
    capabilities: [
      "read_contacts",
      "write_contacts",
      "read_deals",
      "write_notes"
    ],
    useCases: [
      "Log call notes",
      "Update contact records",
      "Check deal pipeline"
    ],
    requiresIntegration: "hubspot",
    docs: "https://modelcontextprotocol.io/introduction",
    setupNote:
      "Requires a HubSpot connection. Create a private app at https://app.hubspot.com → Settings → Integrations → Private Apps, then connect in Integrations."
  },
  {
    id: "postgres_mcp",
    name: "PostgreSQL MCP",
    description: "Query your PostgreSQL database directly",
    icon: "🗄️",
    category: "data",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "connection_string",
        label: "Connection String",
        placeholder: "postgresql://user:password@host:5432/database",
        type: "password",
        required: true,
        helpText: "This connection string is stored encrypted."
      })
    ],
    secretFields: ["connection_string"],
    capabilities: ["sql_query", "schema_inspect"],
    useCases: [
      "Query business data",
      "Generate reports from your DB",
      "Inspect data for anomalies"
    ],
    docs: "https://modelcontextprotocol.io/introduction"
  },
  {
    id: "memory_mcp",
    name: "Persistent Memory",
    description: "Give agents long-term memory across sessions",
    icon: "🧠",
    category: "ai",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "storage_mode",
        label: "Storage Mode",
        placeholder: "Choose a storage mode",
        type: "select",
        required: true,
        options: [
          { value: "database", label: "Database" },
          { value: "file", label: "File" }
        ]
      })
    ],
    secretFields: [],
    capabilities: ["remember", "recall", "forget"],
    useCases: [
      "Remember customer preferences",
      "Track conversation history",
      "Build up business context over time"
    ],
    docs: "https://modelcontextprotocol.io/introduction"
  },

  // ── Reasoning ───────────────────────────────────────────────────────

  {
    id: "sequential_thinking",
    name: "Sequential Thinking",
    description:
      "Force agents to reason step-by-step with branching, revision, and hypothesis verification before answering",
    icon: "🧩",
    category: "ai",
    publisher: "Anthropic",
    version: "1.0.0",
    configFields: [],
    secretFields: [],
    capabilities: [
      "step_by_step_reasoning",
      "branch_and_revise",
      "hypothesis_verification",
      "thought_chain"
    ],
    useCases: [
      "Break down complex multi-step business problems",
      "Improve accuracy on planning and strategy tasks",
      "Force careful analysis before taking actions",
      "Reduce hallucinations on research-heavy workflows"
    ],
    docs: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking"
  },

  // ── Communication & Outreach ──────────────────────────────────────

  {
    id: "resend_mcp",
    name: "Resend Email",
    description:
      "Send emails, manage contacts, and run broadcasts through Resend — the same provider Mission Control already uses",
    icon: "✉️",
    category: "communication",
    publisher: "Resend",
    version: "1.0.0",
    configFields: [
      configField({
        key: "api_key",
        label: "Resend API Key",
        placeholder: "re_...",
        type: "password",
        required: true,
        helpText:
          "Use your existing Resend API key from https://resend.com/api-keys — same one Mission Control uses."
      }),
      configField({
        key: "from_email",
        label: "Default Sender",
        placeholder: "Your Brand <hello@yourdomain.com>",
        type: "text",
        required: false,
        helpText:
          "Default from address for outbound emails. Must be a verified domain in Resend."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "send_email",
      "batch_send",
      "manage_contacts",
      "manage_audiences",
      "broadcasts",
      "domain_management"
    ],
    useCases: [
      "Send personalized outreach emails on behalf of your business",
      "Automate follow-up sequences and drip campaigns",
      "Broadcast announcements to contact lists",
      "Manage email audiences and contact segments"
    ],
    docs: "https://github.com/resend/resend-mcp",
    setupNote:
      "Sign up free at https://resend.com/signup (3,000 emails/month on free tier). Get your API key at https://resend.com/api-keys. If you already set up Resend for Mission Control, you can use the same key."
  },

  {
    id: "twilio_mcp",
    name: "Twilio SMS & Voice",
    description:
      "Send SMS, MMS, WhatsApp messages, and make voice calls through Twilio's 1,400+ API endpoints",
    icon: "📞",
    category: "communication",
    publisher: "Twilio",
    version: "1.0.0",
    configFields: [
      configField({
        key: "account_sid",
        label: "Account SID",
        placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        type: "text",
        required: true,
        helpText: "Your Twilio Account SID from https://console.twilio.com"
      }),
      configField({
        key: "auth_token",
        label: "Auth Token",
        placeholder: "Your Twilio auth token",
        type: "password",
        required: true,
        helpText: "Found next to your Account SID in the Twilio console."
      }),
      configField({
        key: "from_number",
        label: "Default From Number",
        placeholder: "+15551234567",
        type: "text",
        required: false,
        helpText:
          "Default Twilio phone number to send from. Must be a number you own in Twilio."
      })
    ],
    secretFields: ["auth_token"],
    capabilities: [
      "send_sms",
      "send_mms",
      "send_whatsapp",
      "make_voice_call",
      "manage_conversations",
      "lookup_phone"
    ],
    useCases: [
      "Send appointment reminders and confirmations via SMS",
      "Reach customers on WhatsApp for support or updates",
      "Automate voice call workflows and IVR",
      "Verify phone numbers and look up carrier info"
    ],
    docs: "https://github.com/twilio-labs/mcp",
    setupNote:
      "Sign up for a free trial at https://www.twilio.com/try-twilio. Get your Account SID and Auth Token from https://console.twilio.com. You'll also need to buy or provision a phone number in the Twilio console."
  },

  // ── Scraping & Extraction ─────────────────────────────────────────

  {
    id: "firecrawl_mcp",
    name: "Firecrawl",
    description:
      "Scrape web pages, crawl entire sites, and extract structured data — turns search results into actual content",
    icon: "🔥",
    category: "search",
    publisher: "Firecrawl",
    version: "1.0.0",
    configFields: [
      configField({
        key: "api_key",
        label: "Firecrawl API Key",
        placeholder: "fc-...",
        type: "password",
        required: true,
        helpText:
          "Get a free API key at https://firecrawl.dev — 500 credits/month on free tier."
      }),
      configField({
        key: "api_url",
        label: "API URL (optional)",
        placeholder: "https://api.firecrawl.dev",
        type: "url",
        required: false,
        helpText:
          "Override if self-hosting Firecrawl. Leave blank for the hosted service."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "scrape_page",
      "crawl_site",
      "search_and_extract",
      "structured_extraction",
      "page_interaction",
      "batch_scrape"
    ],
    useCases: [
      "Extract full content from web pages found by search",
      "Crawl competitor websites for pricing and product data",
      "Pull structured data from directories, listings, and databases",
      "Research leads by scraping company pages and profiles"
    ],
    docs: "https://github.com/firecrawl/firecrawl-mcp-server",
    setupNote:
      "Sign up free at https://firecrawl.dev (500 credits/month on free tier, paid plans from $16/mo). Get your API key from the Firecrawl dashboard after signing up."
  },

  // ── Browser Automation ────────────────────────────────────────────

  {
    id: "playwright_mcp",
    name: "Playwright Browser",
    description:
      "Automate web browsers — navigate pages, fill forms, click buttons, and extract data using accessibility tree snapshots",
    icon: "🎭",
    category: "automation",
    publisher: "Microsoft",
    version: "1.0.0",
    configFields: [
      configField({
        key: "browser",
        label: "Browser Engine",
        placeholder: "Choose a browser",
        type: "select",
        required: false,
        options: [
          { value: "chromium", label: "Chromium (default)" },
          { value: "firefox", label: "Firefox" },
          { value: "webkit", label: "WebKit (Safari)" }
        ]
      }),
      configField({
        key: "headless",
        label: "Headless Mode",
        placeholder: "Choose mode",
        type: "select",
        required: false,
        options: [
          { value: "true", label: "Headless (no visible browser)" },
          { value: "false", label: "Headed (visible browser window)" }
        ]
      })
    ],
    secretFields: [],
    capabilities: [
      "navigate",
      "click",
      "fill_form",
      "screenshot",
      "extract_text",
      "wait_for_element",
      "execute_javascript"
    ],
    useCases: [
      "Fill out web forms and submit applications automatically",
      "Navigate dashboards and extract data from web apps",
      "Automate repetitive browser-based workflows",
      "Screenshot pages for visual reports and monitoring"
    ],
    docs: "https://github.com/microsoft/playwright-mcp"
  },

  // ── Code Execution ────────────────────────────────────────────────

  {
    id: "e2b_code_execution",
    name: "E2B Code Sandbox",
    description:
      "Run code safely in isolated cloud sandboxes — Python, JavaScript, Bash, and more with ~150ms startup",
    icon: "⚡",
    category: "developer",
    publisher: "E2B",
    version: "1.0.0",
    configFields: [
      configField({
        key: "api_key",
        label: "E2B API Key",
        placeholder: "e2b_...",
        type: "password",
        required: true,
        helpText:
          "Get a free API key at https://e2b.dev — includes free sandbox minutes."
      }),
      configField({
        key: "template",
        label: "Sandbox Template",
        placeholder: "base",
        type: "text",
        required: false,
        helpText:
          "Custom sandbox template ID. Leave blank for the default base template with Python + Node.js."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "run_python",
      "run_javascript",
      "run_bash",
      "install_packages",
      "file_operations",
      "long_running_processes"
    ],
    useCases: [
      "Run data analysis scripts on business data",
      "Generate reports and charts with Python",
      "Execute calculations and transformations safely",
      "Test and validate code without risking the host system"
    ],
    docs: "https://github.com/e2b-dev/mcp-server",
    setupNote:
      "Sign up free at https://e2b.dev (includes free sandbox minutes). Get your API key from the E2B dashboard at https://e2b.dev/dashboard."
  },

  // ── Social Media ────────────────────────────────────────────────────

  {
    id: "reddit_mcp",
    name: "Reddit",
    description:
      "Read, search, and post on Reddit — subreddit monitoring, engagement, and content publishing",
    icon: "🤖",
    category: "social",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "client_id",
        label: "Reddit App Client ID",
        placeholder: "Your Reddit app client ID",
        type: "text",
        required: true,
        helpText:
          "Create a 'script' app at https://www.reddit.com/prefs/apps to get this."
      }),
      configField({
        key: "client_secret",
        label: "Reddit App Client Secret",
        placeholder: "Your Reddit app secret",
        type: "password",
        required: true,
        helpText: "The secret shown under your Reddit script app."
      }),
      configField({
        key: "username",
        label: "Reddit Username",
        placeholder: "your_reddit_username",
        type: "text",
        required: true,
        helpText: "The Reddit account the agent will act as."
      }),
      configField({
        key: "password",
        label: "Reddit Password",
        placeholder: "••••••••",
        type: "password",
        required: true,
        helpText: "Password for the Reddit account above."
      }),
      configField({
        key: "user_agent",
        label: "User Agent",
        placeholder: "GhostProtoClaw/1.0 by your_username",
        type: "text",
        required: false,
        helpText:
          "Custom user-agent string. Reddit requires a descriptive UA. A default is used if blank."
      })
    ],
    secretFields: ["client_secret", "password"],
    capabilities: [
      "read_posts",
      "search_reddit",
      "create_post",
      "reply_to_post",
      "read_comments",
      "subreddit_info",
      "user_info",
      "vote"
    ],
    useCases: [
      "Monitor brand mentions across subreddits",
      "Engage with community questions and discussions",
      "Publish content and announcements to relevant subreddits",
      "Research trending topics in your niche"
    ],
    docs: "https://www.reddit.com/dev/api/",
    setupNote:
      "Go to https://www.reddit.com/prefs/apps and click 'create another app'. Choose 'script' as the type. Your Client ID is the string under the app name, and the Client Secret is shown below it. You'll also need the username and password for the Reddit account the agent will use."
  },

  {
    id: "social_media_mcp",
    name: "Social Media Hub",
    description:
      "Unified TikTok, LinkedIn, Reddit, X, Facebook, Instagram, Threads, Pinterest, and Bluesky publishing — schedule posts, view analytics, and manage profiles from one integration. Reddit auth handled provider-side, so no Reddit API app approval needed.",
    icon: "📱",
    category: "social",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "provider",
        label: "Social Media API Provider",
        placeholder: "Choose a provider",
        type: "select",
        required: true,
        options: [
          { value: "late", label: "Late (getlate.dev)" },
          { value: "ayrshare", label: "Ayrshare" },
          { value: "zernio", label: "Zernio (zernio.com)" }
        ]
      }),
      configField({
        key: "api_key",
        label: "API Key",
        placeholder: "Your provider API key",
        type: "password",
        required: true,
        helpText:
          "Late: get at https://getlate.dev — Ayrshare: get at https://ayrshare.com — Zernio: get at https://zernio.com/dashboard/api-keys (Bearer token)"
      }),
      configField({
        key: "profile_key",
        label: "Profile Key (optional)",
        placeholder: "Profile or workspace key",
        type: "text",
        required: false,
        helpText:
          "If your plan supports multiple profiles, enter the profile key here."
      }),
      configField({
        key: "enabled_platforms",
        label: "Enabled Platforms",
        placeholder: "tiktok,linkedin,reddit,twitter,facebook,instagram",
        type: "text",
        required: false,
        helpText:
          "Comma-separated list of platforms to enable. Leave blank to enable all connected platforms."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "publish_post",
      "schedule_post",
      "delete_post",
      "get_analytics",
      "get_post_history",
      "upload_media",
      "get_profiles",
      "get_comments"
    ],
    useCases: [
      "Publish to TikTok, LinkedIn, Reddit, X, Facebook, Instagram, Threads, Pinterest, Bluesky from a single command",
      "Schedule social media content across platforms",
      "Pull engagement analytics for published posts",
      "Manage cross-platform social media campaigns",
      "Reddit posting without the Reddit API app-approval process — provider (Late / Ayrshare / Zernio) handles Reddit OAuth on their side"
    ],
    docs: "https://docs.getlate.dev (Late) · https://docs.ayrshare.com (Ayrshare) · https://docs.zernio.com (Zernio)",
    setupNote:
      "Choose a provider and sign up: Late (recommended price, ~$33/mo) at https://getlate.dev, Ayrshare (~$149/mo) at https://ayrshare.com, or Zernio (usage-based per connected account) at https://zernio.com. After signing up, connect your social accounts (TikTok, LinkedIn, Reddit, X, Facebook, Instagram, Threads, Pinterest, Bluesky) through the provider's dashboard, then copy your API key here. Reddit auth is handled provider-side, so you do NOT need to apply for a Reddit API app — the provider has their own approved app. Zernio uses Bearer-token auth (POST /api/v1/posts) and also offers OAuth 2.1 + PKCE for third-party apps."
  },

  // ── Forex data + trading (Phase 2 of the Forex Research & Execution Desk) ──

  {
    id: "twelvedata_forex",
    name: "TwelveData — Forex Quotes",
    description:
      "Real-time and historical forex quotes for all majors, crosses, and tier-1 exotics.",
    icon: "📈",
    category: "data",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [],
    secretFields: ["api_key"],
    capabilities: ["forex_quote", "forex_bars"],
    useCases: [
      "Live price quotes for G10 majors and crosses",
      "OHLC bars for backtests and signal generation",
      "Feed the Data QA Agent's freshness and spread-vs-median checks"
    ],
    docs: "https://twelvedata.com/docs",
    setupNote:
      "Sign up at https://twelvedata.com (free tier: 800 requests/day, 8 requests/minute). Copy your API key from the dashboard and paste it above. The free tier is enough to run the Morning Briefing and daily strategy validation — upgrade only if you move to minute-level strategies."
  },
  {
    id: "fred_macro",
    name: "FRED — Federal Reserve Macro Data",
    description:
      "US macro time series: CPI, PCE, NFP, GDP, unemployment, Fed funds, yields, and thousands more.",
    icon: "🏛️",
    category: "data",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [],
    secretFields: ["api_key"],
    capabilities: ["forex_macro_release"],
    useCases: [
      "Pull US CPI, PCE, NFP, and yield prints for the Macro Synthesis Agent",
      "Feed the Macro & Calendar Agent's historical-volatility baseline",
      "Research-grade backtest inputs for carry and momentum strategies"
    ],
    docs: "https://fred.stlouisfed.org/docs/api/fred/",
    setupNote:
      "Free. Create a FRED account at https://fredaccount.stlouisfed.org/apikey and request an API key (instant). Paste it above. The FRED API has no rate limit for casual use."
  },
  {
    id: "finnhub_news",
    name: "Finnhub — News & Earnings Calendar",
    description:
      "Financial news headlines, earnings calendars, and economic releases for the News & Sentiment Agent.",
    icon: "📰",
    category: "data",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [],
    secretFields: ["api_key"],
    capabilities: ["forex_news"],
    useCases: [
      "Central-bank speaker news for the News & Sentiment Agent",
      "Economic-release calendar for the Macro & Calendar Agent",
      "Geopolitical / fiscal announcement monitoring"
    ],
    docs: "https://finnhub.io/docs/api",
    setupNote:
      "Sign up at https://finnhub.io (free tier: 60 calls/minute, sufficient for scheduled briefing workflows). Copy your API key from the dashboard and paste it above."
  },
  {
    id: "tradovate_futures",
    name: "Tradovate — CME Futures Broker (US-Accessible, Prop-Firm Path)",
    description:
      "Tradovate API for CME FX futures (6E, 6J, 6B, E-micros) and other CME products. The US futures path for Apex Trader Funding, Topstep, and other US-eligible prop firms. Supports both Demo and Live environments; start with Demo.",
    icon: "🏛️",
    category: "data",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "environment",
        label: "Environment",
        placeholder: "Demo (simulation) or Live",
        type: "select",
        required: true,
        options: [
          { value: "demo", label: "Demo (simulation) — demo.tradovateapi.com" },
          { value: "live", label: "Live — live.tradovateapi.com" }
        ],
        helpText:
          "Start with Demo. Live is only useful once your business's tradingMode has been upgraded to Live-with-approval."
      }),
      configField({
        key: "app_id",
        label: "App ID",
        placeholder: "Sample App",
        type: "text",
        required: true,
        helpText:
          "Your Tradovate API app ID. Register one at https://api.tradovate.com (free). The default 'Sample App' works for testing."
      }),
      configField({
        key: "app_version",
        label: "App Version",
        placeholder: "1.0",
        type: "text",
        required: true,
        helpText: "Version string of your API app (e.g. '1.0')."
      })
    ],
    secretFields: ["username", "password", "cid", "sec"],
    capabilities: [
      "tradovate_get_account",
      "tradovate_get_positions",
      "tradovate_place_order"
    ],
    useCases: [
      "Route CME FX futures orders for US-based traders (Dodd-Frank-safe path)",
      "Connect to Apex Trader Funding / Topstep via Tradovate",
      "Trade 6E, 6J, 6B, and E-micro FX futures with central clearing"
    ],
    docs: "https://api.tradovate.com/",
    setupNote:
      "1) Open a Tradovate account at https://www.tradovate.com (Demo is free). 2) Register an API app at https://api.tradovate.com to get your cid and sec values. 3) Paste your Tradovate username, password, cid, and sec here, plus app_id + app_version. The handler exchanges these for a short-lived access_token on every call."
  },
  {
    id: "oanda_forex",
    name: "OANDA v20 — Retail FX Broker (US-Accessible)",
    description:
      "OANDA v20 REST API for retail FX quotes, accounts, positions, and orders. Phase 2a ships read-only; order placement remains locked behind the tradingMode gate.",
    icon: "🏦",
    category: "data",
    publisher: "Ghost ProtoClaw",
    version: "1.0.0",
    configFields: [
      configField({
        key: "account_id",
        label: "Account ID",
        placeholder: "001-001-1234567-001",
        type: "text",
        required: true,
        helpText:
          "Your OANDA account ID (format: XXX-XXX-XXXXXXX-XXX). Find it in the OANDA dashboard under Manage Funds."
      }),
      configField({
        key: "environment",
        label: "Environment",
        placeholder: "Demo (practice) or Live",
        type: "select",
        required: true,
        options: [
          { value: "practice", label: "Practice (demo) — api-fxpractice.oanda.com" },
          { value: "live", label: "Live — api-fxtrade.oanda.com" }
        ],
        helpText:
          "Start with Practice. Live is only useful once your business's tradingMode has been upgraded past 'research', which is a separate consent flow."
      })
    ],
    secretFields: ["api_key"],
    capabilities: ["oanda_get_account", "oanda_get_positions", "oanda_get_instrument_pricing"],
    useCases: [
      "Read your OANDA account balance, margin, and open positions",
      "Stream live pricing for majors and crosses into the desk",
      "Phase 2b: place paper / live orders gated by the approval queue"
    ],
    docs: "https://developer.oanda.com/rest-live-v20/introduction/",
    setupNote:
      "Sign up at https://www.oanda.com and open a practice account (instant, no deposit). Go to Manage API Access (https://www.oanda.com/account/tpa/personal_token) and generate a personal access token. Paste it above. OANDA's practice environment is free and persistent — ideal for Paper mode when Phase 2b ships."
  },
  // ── Sprint 1: Template expansion MCPs (Nov 2026) ─────────────────────
  // Newsletter, e-commerce/Etsy, agency, local lead gen, and Pinterest
  // templates all gained requiredIntegrations pointing at these. Each
  // wrapper calls a publicly-published MCP server (official where
  // available, third-party otherwise — noted in `publisher`).
  {
    id: "beehiiv_mcp",
    name: "beehiiv",
    description:
      "Newsletter analytics, post scheduling, and subscriber data for newsletters published on beehiiv. The 2026-preferred platform over Substack because of 0% subscription fees and the built-in ad network.",
    icon: "📬",
    category: "communication",
    publisher: "beehiiv (official)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "publication_id",
        label: "Publication ID",
        placeholder: "pub_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        type: "text",
        required: true,
        helpText:
          "Find in your beehiiv dashboard → Settings → API. Format is pub_ followed by a UUID."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "beehiiv_get_publication",
      "beehiiv_list_posts",
      "beehiiv_get_post_analytics",
      "beehiiv_list_subscribers",
      "beehiiv_get_subscriber",
      "beehiiv_list_segments",
      "beehiiv_list_ad_network_offers"
    ],
    useCases: [
      "Pull open rate, click-through, and subscriber growth by issue for the weekly analytics brief",
      "Surface top-performing issues so the Writer agent learns what resonates",
      "Track subscriber velocity and flag the 30/60/90-day inactive cohort for re-engagement",
      "Read Ad Network offer inventory so the Sponsor Hunter agent can match revenue opportunities"
    ],
    docs: "https://developers.beehiiv.com/",
    setupNote:
      "beehiiv's v1 API is read-only (the v2 write API is rolling out across 2026 — agents will gain post creation + subscriber tagging as it ships). Sign up at https://beehiiv.com/pricing (free tier works; Scale at $43/mo unlocks the full API). Generate an API key under Settings → API + Integrations."
  },
  {
    id: "etsy_mcp",
    name: "Etsy",
    description:
      "Create, update, and manage Etsy listings, shop sections, and inventory. Powers the Etsy Digital Studio agents — batch listing creation, tag optimization, seasonal refresh.",
    icon: "🧶",
    category: "automation",
    publisher: "Community (profplum700/etsy-mcp-server)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "shop_id",
        label: "Shop ID",
        placeholder: "12345678",
        type: "text",
        required: true,
        helpText:
          "Your numeric Etsy shop ID. Find it in Shop Manager → Settings → Options, or in the URL when viewing your shop on etsy.com."
      }),
      configField({
        key: "oauth_redirect_uri",
        label: "OAuth Redirect URI",
        placeholder: "https://your-domain.com/oauth/etsy/callback",
        type: "url",
        required: true,
        helpText:
          "Register this exact URL as an approved redirect in Etsy's developer portal."
      })
    ],
    secretFields: ["keystring", "shared_secret", "oauth_refresh_token"],
    capabilities: [
      "etsy_create_listing",
      "etsy_update_listing",
      "etsy_delete_listing",
      "etsy_list_listings",
      "etsy_upload_listing_image",
      "etsy_update_listing_inventory",
      "etsy_list_shop_sections",
      "etsy_get_shop_receipts"
    ],
    useCases: [
      "Ship the 50-listing weekly drop pipeline without manual data entry",
      "Enforce the 13-tag rule automatically on every listing write",
      "Refresh stale listings every 90 days per the Etsy algorithm playbook",
      "Pull daily orders + reviews for the Performance Analyst agent"
    ],
    docs: "https://developers.etsy.com/documentation/",
    setupNote:
      "Register an Etsy developer app at https://www.etsy.com/developers/register — instant approval for personal apps. Copy the keystring + shared secret. The OAuth 2.0 flow requires user authorization per shop; the MCP handles token refresh automatically. NOTE: Etsy's API is rate-limited to 10 req/sec per shop — the agents space writes appropriately."
  },
  {
    id: "printify_mcp",
    name: "Printify",
    description:
      "Product catalog, variant management, mockup generation, and Etsy/Shopify sync for print-on-demand businesses. Full R+W via the Printify v2 API.",
    icon: "👕",
    category: "automation",
    publisher: "Community (TSavo/printify-mcp)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "shop_id",
        label: "Printify Shop ID",
        placeholder: "1234567",
        type: "text",
        required: true,
        helpText:
          "Numeric shop ID. Find in Printify dashboard → My Stores → [your store] → URL contains /app/store/XXXXXXX."
      })
    ],
    secretFields: ["api_token"],
    capabilities: [
      "printify_list_catalog_blueprints",
      "printify_create_product",
      "printify_update_product",
      "printify_publish_product",
      "printify_generate_mockup",
      "printify_list_shops",
      "printify_list_orders"
    ],
    useCases: [
      "Push AI-generated designs onto 900+ blueprint products (tees, mugs, tumblers, phone cases, etc.)",
      "Generate high-quality mockups automatically for every Etsy listing",
      "Sync the POD catalog to an Etsy store without double-data-entry",
      "Monitor production + fulfillment SLAs per order"
    ],
    docs: "https://developers.printify.com/",
    setupNote:
      "Sign up at https://printify.com/app/account/api and generate a Personal Access Token. Free to use — Printify charges per order, not per API call. Printful and Gelato are alternatives with similar MCPs in the ecosystem; Printify wins on catalog size (900+ products)."
  },
  {
    id: "instantly_mcp",
    name: "Instantly.ai",
    description:
      "Cold email campaigns, inbox warmup, and automated reply handling. Market leader for agency cold outreach in 2026 — multi-inbox sending, intent tracking, built-in lead database.",
    icon: "📨",
    category: "communication",
    publisher: "Instantly.ai (official)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "workspace_id",
        label: "Workspace ID",
        placeholder: "ws_xxxxxxxxxxxx",
        type: "text",
        required: false,
        helpText:
          "Optional — only required if your account has multiple workspaces. Find in Instantly dashboard → Settings → API."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "instantly_create_campaign",
      "instantly_launch_campaign",
      "instantly_pause_campaign",
      "instantly_add_leads_to_campaign",
      "instantly_list_campaigns",
      "instantly_get_campaign_analytics",
      "instantly_list_replies",
      "instantly_send_reply"
    ],
    useCases: [
      "Spin up cold email campaigns from the Lead Gen Agent without leaving Ghost ProtoClaw",
      "Load niche-specific ICPs into campaigns per AI Agency Reseller workflow",
      "Pull reply-rate + booked-call analytics into the weekly agency dashboard",
      "Auto-handle inbox warmup (15 min/day) to maintain deliverability"
    ],
    docs: "https://developer.instantly.ai/",
    setupNote:
      "Sign up at https://app.instantly.ai/ (paid plan required for API — Hypergrowth at $97/mo is the cheapest tier with API access). Generate API key under Settings → Integrations. Budget the warmup period (10–14 days) before expecting real reply rates."
  },
  {
    id: "sendpilot_mcp",
    name: "Sendpilot (LinkedIn)",
    description:
      "LinkedIn outbound automation — DMs, connection requests, lead tracking, unified inbox. Native proxy/session management per connected LinkedIn account so automation stays under LinkedIn's safety thresholds. Reply events arrive via webhook.",
    icon: "💼",
    category: "communication",
    publisher: "Sendpilot",
    version: "1.0.0",
    configFields: [
      configField({
        key: "connect_campaign_id",
        label: "Default 'Connect Only' campaign ID",
        placeholder: "cmp_xxxxxxxxxxxx",
        type: "text",
        required: false,
        helpText:
          "Optional but recommended. Create an evergreen campaign in Sendpilot whose first step is a Connection Request with {{note}} merge field. sendpilot_send_connection_request drops leads into this campaign."
      })
    ],
    secretFields: ["api_key", "webhook_secret"],
    capabilities: [
      "sendpilot_send_dm",
      "sendpilot_send_connection_request",
      "sendpilot_list_senders",
      "sendpilot_list_campaigns",
      "sendpilot_list_leads",
      "sendpilot_update_lead_status"
    ],
    useCases: [
      "Pitch Composer drafts + Channel Operator sends LinkedIn DMs directly (no more operator-manual via Sales Navigator)",
      "Auto-drop Tier A multi-unit prospects into a connection-request campaign",
      "Reply Triager ingests LinkedIn replies via webhook → same triage flow as email",
      "Sub-Affiliate Recruiter DMs members of sales/affiliate communities"
    ],
    docs: "https://docs.sendpilot.ai/",
    setupNote:
      "API + webhooks available on: AppSumo Lifetime Tier 1+, Team ($199/mo), Agency, Enterprise. AppSumo Tier 2 (the typical lifetime deal) includes 3 LinkedIn senders, 3,000 leads/month, 3,000 extractions/month — plan the agent's monthly volume against these caps. Setup: Sendpilot → Settings → API → create key. Settings → Webhooks → URL = https://<host>/api/webhooks/sendpilot/<businessId>, store the webhook_secret it shows you once. Connect at least one LinkedIn account and let it finish warming (status: active) before the agent starts sending."
  },
  {
    id: "manychat_mcp",
    name: "ManyChat (FB Messenger + Instagram)",
    description:
      "Inbound reply automation + engagement growth tools for Facebook Messenger and Instagram. Use for: responding to DMs on your own Page/IG within the 24h Meta window, comment-to-DM funnels on your own posts/ads, subscriber CRM with tags + custom fields. Does NOT enable cold DMs — Meta platform policy requires user-initiated contact first. Pair with your TipTax Page's paid/organic content to convert engagement into DM-eligible subscribers.",
    icon: "💬",
    category: "communication",
    publisher: "ManyChat",
    version: "1.0.0",
    configFields: [
      configField({
        key: "page_id",
        label: "Default Page ID",
        placeholder: "123456789012345",
        type: "text",
        required: false,
        helpText:
          "Optional — only needed if your ManyChat account manages multiple FB Pages / IG accounts and you want the agent to target a default one."
      })
    ],
    secretFields: ["api_key", "webhook_secret"],
    capabilities: [
      "manychat_send_content",
      "manychat_send_flow",
      "manychat_find_subscriber_by_email",
      "manychat_get_subscriber_info",
      "manychat_add_tag",
      "manychat_remove_tag",
      "manychat_set_custom_field",
      "manychat_list_subscribers_by_tag"
    ],
    useCases: [
      "Reply Triager handles FB Messenger + IG DMs that land on TipTax's Page within the 24h Meta window",
      "Comment-to-DM funnel: restaurant owner comments on TipTax organic/paid FB or IG post → ManyChat auto-DMs them with the outcome infographic",
      "Tag subscribers by engagement source + state so Data Analyst can attribute signed affiliates back to specific content",
      "Send a pre-built ManyChat flow (e.g., eligibility quiz) when a subscriber crosses an engagement threshold"
    ],
    docs: "https://api.manychat.com/swagger",
    setupNote:
      "Pro plan (~$15/mo at 500 contacts, scales with list size) or Business tier required for API access (community reports 2026 repricing may gate full API behind ~$200/mo — verify). Setup: Settings → API → generate token (Bearer). Dev Tools → External Requests: configure webhook at https://<host>/api/webhooks/manychat/<businessId>?secret=<random-secret>. Store the secret on the ManyChat Integration as encrypted webhook_secret — we verify it on every inbound POST since ManyChat's webhook signing isn't well-documented. Cannot be used for cold outreach — only warm, 24h-window, and post-engagement flows. ManyChat supports BOTH FB Messenger and Instagram subscribers under the same /fb/ API path (the prefix is legacy naming, not channel-specific)."
  },
  {
    id: "gohighlevel_mcp",
    name: "GoHighLevel",
    description:
      "Agency-in-a-box: CRM, pipelines, email, SMS, funnels, booking, and membership for clients served by AI agencies and high-ticket coaches. Official GHL MCP ships 21 tools (250+ planned).",
    icon: "🔷",
    category: "automation",
    publisher: "GoHighLevel (official)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "location_id",
        label: "Location ID",
        placeholder: "abc123xyz",
        type: "text",
        required: true,
        helpText:
          "The GHL sub-account ID. Agency accounts have multiple locations; each location = one client's workspace."
      })
    ],
    secretFields: ["private_integration_token"],
    capabilities: [
      "ghl_create_contact",
      "ghl_update_contact",
      "ghl_list_contacts",
      "ghl_create_opportunity",
      "ghl_update_opportunity",
      "ghl_list_pipelines",
      "ghl_send_sms",
      "ghl_send_email",
      "ghl_book_appointment",
      "ghl_list_appointments",
      "ghl_create_workflow_webhook"
    ],
    useCases: [
      "Run a full agency CRM without spinning up HubSpot — leads, opportunities, pipelines all live here",
      "Trigger drip SMS + email sequences from agent workflows",
      "Manage client sub-accounts from the agency operator's master location",
      "Book discovery calls + consultations from agent-driven lead flows",
      "Retroactively fixes the High-Ticket Coaching template's 'GHL not wired' caveat from Phase 2"
    ],
    docs: "https://marketplace.gohighlevel.com/docs/other/mcp",
    setupNote:
      "GHL's MCP requires a Private Integration Token (not the legacy API key). In your GHL location go to Settings → Private Integrations → Create New. Grant the scopes you want the agents to use (contacts, opportunities, calendars, conversations). Free tier of GHL does not include API access — Agency Unlimited ($297/mo) is the minimum."
  },
  {
    id: "tailwind_mcp",
    name: "Tailwind (Pinterest)",
    description:
      "Pinterest pin creation, scheduling, board management, and SmartLoop evergreen content. Official Tailwind MCP — full R+W for the Pinterest Traffic Operator and E-Commerce/Etsy templates.",
    icon: "📌",
    category: "social",
    publisher: "Tailwind (official)",
    version: "1.0.0",
    configFields: [],
    secretFields: ["api_key"],
    capabilities: [
      "tailwind_create_pin",
      "tailwind_schedule_pin",
      "tailwind_list_pins",
      "tailwind_list_boards",
      "tailwind_create_smartloop",
      "tailwind_get_pin_analytics"
    ],
    useCases: [
      "Schedule 20+ fresh pins per blog post / Etsy listing with the 72-hour same-URL rule enforced",
      "Run SmartLoop evergreen queues so winning pins recycle automatically",
      "Generate pins in the 2:3 aspect ratio Pinterest now requires (algorithmic penalty otherwise)",
      "Pull pin-level analytics for the Content Multiplier agent"
    ],
    docs: "https://api-docs.tailwind.ai/mcp",
    setupNote:
      "Tailwind is $50/mo for serious operators and is the ONLY Pinterest posting path we recommend — Pinterest's own API write access is heavily restricted and `pinterest_mcp` third-party wrappers are read-only. Sign up at https://www.tailwindapp.com, connect your Pinterest Business account, generate an API key under Settings → API."
  },
  {
    id: "whatsapp_cloud_mcp",
    name: "WhatsApp (Cloud API)",
    description:
      "WhatsApp Business messaging via Meta's Cloud API — dramatically cheaper than Twilio SMS and the dominant messaging channel in LATAM, EU, and SEA markets. Template-approved messages + opt-in required.",
    icon: "💬",
    category: "communication",
    publisher: "Meta (Cloud API)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "waba_id",
        label: "WhatsApp Business Account ID",
        placeholder: "123456789012345",
        type: "text",
        required: true,
        helpText:
          "Your WABA ID from Meta Business Manager → Business Settings → WhatsApp Accounts."
      }),
      configField({
        key: "phone_number_id",
        label: "Phone Number ID",
        placeholder: "987654321098765",
        type: "text",
        required: true,
        helpText:
          "The phone number ID (NOT the E.164 number). Find in WhatsApp Manager → Phone Numbers."
      })
    ],
    secretFields: ["system_user_access_token"],
    capabilities: [
      "whatsapp_send_template_message",
      "whatsapp_send_text_message",
      "whatsapp_send_media_message",
      "whatsapp_list_message_templates",
      "whatsapp_submit_message_template",
      "whatsapp_list_conversations",
      "whatsapp_mark_as_read"
    ],
    useCases: [
      "Primary outreach channel for the Local Lead Gen Agency in non-US markets — cheaper + higher reply rates than SMS",
      "Appointment reminders + booking confirmations for local service + coaching templates",
      "Customer support responses on e-commerce orders",
      "Escape the Twilio pricing cliff for operators doing volume messaging"
    ],
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api/",
    setupNote:
      "Meta's Cloud API is FREE to use — you pay per conversation (~$0.005–0.04 per 24-hour window vs. Twilio's $0.01–0.02 per SMS segment). Setup: create a Meta Business Account → Business Verification (1–7 days) → WhatsApp Business Account → phone number → System User with whatsapp_business_messaging permission. For marketing messages, every template must be submitted for Meta approval (24–72h review). Budget the onboarding time — it's real, but only paid once."
  },
  {
    id: "telnyx_mcp",
    name: "Telnyx SMS",
    description:
      "SMS sending via Telnyx — a drop-in replacement for Twilio at ~50% the per-message cost. Same A2P 10DLC compliance path in the US. Used for US-focused Local Lead Gen or any operator cost-sensitive to Twilio.",
    icon: "📲",
    category: "communication",
    publisher: "Telnyx (official)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "messaging_profile_id",
        label: "Messaging Profile ID",
        placeholder: "40017a80-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        type: "text",
        required: true,
        helpText:
          "Find under Mission Control → Messaging → Profiles. One profile per brand/campaign for A2P 10DLC."
      }),
      configField({
        key: "from_number",
        label: "Sender Number (E.164)",
        placeholder: "+15551234567",
        type: "text",
        required: true,
        helpText:
          "Your Telnyx number in E.164 format. A2P 10DLC registration required for US business SMS."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "telnyx_send_sms",
      "telnyx_send_mms",
      "telnyx_list_messages",
      "telnyx_get_message_status"
    ],
    useCases: [
      "US SMS outreach for Local Lead Gen Agency — ~50% cheaper than Twilio",
      "Drop-in swap for any template that currently references twilio_mcp",
      "Bulk lead-response SMS where operators hit the Twilio cost cliff"
    ],
    docs: "https://developers.telnyx.com/docs/messaging/messages",
    setupNote:
      "Sign up at https://telnyx.com — pay-as-you-go, no monthly minimum. For US SMS: complete A2P 10DLC brand + campaign registration ($4/mo brand fee + $2–10/mo per campaign). Takes 1–3 weeks for carrier approval. Same compliance path as Twilio, just cheaper underlying pricing."
  },
  // ── Sprint 2: Lead gen + SEO + fulfillment MCPs (Nov 2026) ───────────
  // Local Lead Gen Agency + Pinterest Traffic Operator templates + AI
  // Automation Reseller fulfillment depth depend on these. Each wraps a
  // publicly-published MCP server.
  {
    id: "callrail_mcp",
    name: "CallRail",
    description:
      "Call tracking, recording, transcription, and attribution for rank-and-rent operators and local service agencies. Proves lead quality to contractor clients — the #1 objection-killer in rank-and-rent deals. Accessed via Zapier's CallRail MCP integration.",
    icon: "📞",
    category: "communication",
    publisher: "Zapier (CallRail integration)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "account_id",
        label: "CallRail Account ID",
        placeholder: "ACTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        type: "text",
        required: true,
        helpText:
          "Find in CallRail settings → Account → Account ID (format starts with AC followed by 32 chars)."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "callrail_list_calls",
      "callrail_get_call",
      "callrail_get_call_recording",
      "callrail_get_call_transcript",
      "callrail_list_tracking_numbers",
      "callrail_create_tracking_number",
      "callrail_tag_call",
      "callrail_send_to_webhook"
    ],
    useCases: [
      "Score every inbound call (spam / tire-kicker / real lead) before forwarding to the contractor",
      "Generate monthly contractor-facing reports with call count + conversion proxies",
      "Flag call patterns suggesting a site got scraped by a competitor or hit a spike",
      "Power per-site revenue attribution in the rank-and-rent portfolio dashboard"
    ],
    docs: "https://zapier.com/mcp/callrail",
    setupNote:
      "CallRail's own official MCP is not yet available; the Zapier CallRail MCP integration is the production-ready path. Sign up at https://www.callrail.com/pricing (lowest tier with API access is Analytics at $50/mo per location). Create a Zapier account, enable the CallRail integration, generate the MCP connection token under Zapier MCP settings. Alternative: direct CallRail REST API without MCP — more work, same capabilities."
  },
  {
    id: "smartlead_mcp",
    name: "Smartlead",
    description:
      "Cold email at scale via Smartlead — alternative to Instantly with stronger enterprise features. The 'premium agency' stack pairs Smartlead (sending) with Clay (data enrichment). Used by ColdIQ and other $5K+/mo agencies.",
    icon: "📧",
    category: "communication",
    publisher: "Smartlead (official) / LeadMagic (113-tool wrapper)",
    version: "1.0.0",
    configFields: [],
    secretFields: ["api_key"],
    capabilities: [
      "smartlead_create_campaign",
      "smartlead_launch_campaign",
      "smartlead_pause_campaign",
      "smartlead_add_leads",
      "smartlead_list_campaigns",
      "smartlead_get_campaign_stats",
      "smartlead_list_email_accounts",
      "smartlead_list_replies",
      "smartlead_send_reply",
      "smartlead_get_sequence_variant_stats"
    ],
    useCases: [
      "Run multi-inbox cold campaigns from the Business Developer agent in AI Automation Reseller",
      "A/B test sequence variants and track which subject lines + CTA framings close deals",
      "Sync campaign analytics to the weekly agency dashboard for pipeline forecasting",
      "Built-in inbox rotation across 10+ sending domains without hitting send-limit ceilings"
    ],
    docs: "https://helpcenter.smartlead.ai/articles/300",
    setupNote:
      "Sign up at https://smartlead.ai — cheapest API-enabled tier is Basic at $39/mo. Generate API key under Settings → Integrations. Smartlead + Clay is the 2026 premium agency stack; Instantly is the solo operator default. Warm your sending domain 10-14 days at low volume before launching cold campaigns — same rule as Instantly."
  },
  {
    id: "clay_mcp",
    name: "Clay",
    description:
      "AI-orchestrated data enrichment for cold outreach. Pulls firmographics, technographics, and trigger events (hiring, funding, tech stack changes) to turn generic prospect lists into hyper-personalized 1-to-1 campaigns.",
    icon: "🧱",
    category: "data",
    publisher: "Clay (official)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "workspace_id",
        label: "Workspace ID",
        placeholder: "wsp_xxxxxxxx",
        type: "text",
        required: true,
        helpText:
          "Your Clay workspace ID. Find in the URL: clay.com/workspaces/<workspace_id>."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "clay_list_tables",
      "clay_enrich_contact",
      "clay_enrich_company",
      "clay_run_workflow",
      "clay_list_workflow_runs",
      "clay_upload_leads",
      "clay_export_table"
    ],
    useCases: [
      "Enrich cold email lead lists with firmographic + tech-stack data for personalization",
      "Trigger-event-based outreach: pitch AI agencies when prospects post JD for repetitive-process roles",
      "Build ICP-scored lead lists that feed directly into Smartlead or Instantly",
      "Supports the 'show them you did the research' advantage over generic cold campaigns"
    ],
    docs: "https://docs.clay.com/",
    setupNote:
      "Clay is usage-based ($149/mo Starter, $349/mo Pro, higher tiers for volume). Sign up at https://www.clay.com, create a workspace, and generate an API key under Settings → API. Clay pairs naturally with Smartlead — the 'premium agency' stack — but also works alongside Instantly for mid-tier operators. Expensive relative to Instantly alone; justified once deal sizes are >$5K."
  },
  {
    id: "ahrefs_mcp",
    name: "Ahrefs",
    description:
      "Keyword research, backlink analysis, competitor gap analysis, and SERP tracking. The default SEO tool for rank-and-rent operators and content marketers. Read-only MCP — Ahrefs doesn't write; agents use it for research.",
    icon: "📊",
    category: "search",
    publisher: "Ahrefs (official)",
    version: "1.0.0",
    configFields: [],
    secretFields: ["api_key"],
    capabilities: [
      "ahrefs_keyword_overview",
      "ahrefs_keyword_difficulty",
      "ahrefs_search_volume",
      "ahrefs_serp_overview",
      "ahrefs_backlink_profile",
      "ahrefs_competitor_gap",
      "ahrefs_site_audit",
      "ahrefs_rank_tracking"
    ],
    useCases: [
      "Niche + City Scanner agent (Local Lead Gen) validates keyword volume and competitor difficulty before recommending a site build",
      "Competitor Rank Monitor fires daily rank-check alerts when a money site drops",
      "SEO Query Bank for Etsy / Pinterest content: identify high-volume low-difficulty long-tail queries",
      "Content Engine agent mines 'People Also Ask' + featured snippet gaps for blog targeting"
    ],
    docs: "https://docs.ahrefs.com/docs/mcp",
    setupNote:
      "Ahrefs is expensive ($129/mo Lite, $249/mo Standard, $449/mo Advanced). API access is included on all paid tiers. Sign up at https://ahrefs.com, generate an API token under Account → API. For operators who can't justify Ahrefs, SEMrush MCP (below) is the main alternative at similar pricing; Keywords Everywhere ($10/mo) is the budget-tier fallback with no MCP."
  },
  {
    id: "semrush_mcp",
    name: "SEMrush",
    description:
      "Keyword research + competitor intelligence + rank tracking across 50+ cities. Ahrefs alternative, stronger at tracking multi-location rankings — a critical feature for rank-and-rent operators running city-by-niche portfolios.",
    icon: "📈",
    category: "search",
    publisher: "SEMrush (official)",
    version: "1.0.0",
    configFields: [],
    secretFields: ["api_key"],
    capabilities: [
      "semrush_keyword_overview",
      "semrush_keyword_magic",
      "semrush_domain_overview",
      "semrush_competitor_research",
      "semrush_position_tracking",
      "semrush_backlink_audit",
      "semrush_site_audit",
      "semrush_local_pack_tracking"
    ],
    useCases: [
      "Track rank positions across 50+ cities × niches for rank-and-rent portfolio operators",
      "Local Pack tracking — map-pack position monitoring for every money site",
      "Competitor gap analysis to find keywords competitors rank for that you don't yet",
      "Content Engine mines topic clusters SEMrush's Keyword Magic surfaces"
    ],
    docs: "https://www.semrush.com/api-documentation/",
    setupNote:
      "SEMrush pricing: $139/mo Pro, $249/mo Guru, $499/mo Business. API access included on all tiers but call limits vary — Business is the minimum for portfolio-scale rank tracking. Sign up at https://www.semrush.com, generate API key under Profile → API Units. Use SEMrush for multi-location portfolio tracking; Ahrefs for deep backlink + SERP research. Picking one is fine for most operators."
  },
  {
    id: "n8n_mcp",
    name: "n8n",
    description:
      "Self-hostable workflow automation — the 2026 operator favorite for AI automation agency fulfillment. Build client-side automations the agency sells, OR spin up internal workflows that connect data sources without custom code.",
    icon: "🔗",
    category: "automation",
    publisher: "n8n (official MCP Server Trigger node) + czlonkowski/n8n-mcp (builder)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "instance_url",
        label: "n8n instance URL",
        placeholder: "https://n8n.yourdomain.com",
        type: "url",
        required: true,
        helpText:
          "Your n8n instance URL. Self-hosted (free) or n8n.cloud ($20+/mo). The API path is /rest/."
      })
    ],
    secretFields: ["api_key"],
    capabilities: [
      "n8n_list_workflows",
      "n8n_get_workflow",
      "n8n_create_workflow",
      "n8n_update_workflow",
      "n8n_activate_workflow",
      "n8n_deactivate_workflow",
      "n8n_list_executions",
      "n8n_trigger_workflow",
      "n8n_list_credentials"
    ],
    useCases: [
      "AI Automation Reseller Fulfillment Orchestrator builds + deploys client workflows programmatically",
      "Agency operators spin up internal orchestrations without writing custom code",
      "Trigger Ghost ProtoClaw agent workflows from external webhooks (Stripe payment → onboarding email sequence)",
      "Deploy n8n 'MCP Server Trigger' nodes to expose agency-built workflows as tools the client's AI can call"
    ],
    docs: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.toolmcp/",
    setupNote:
      "n8n is free self-hosted (Docker in 5 minutes) or $20+/mo managed via n8n.cloud. Generate API key in Settings → API. Two MCP paths: (1) n8n's own 'MCP Server Trigger' node exposes workflows as tools — use for agency-delivered work; (2) czlonkowski/n8n-mcp is a third-party builder that CREATES workflows via API — use for the Fulfillment Orchestrator. Pick based on what role you want the agents to play."
  },
  {
    id: "make_mcp",
    name: "Make.com",
    description:
      "Visual automation platform (formerly Integromat) — easier than n8n for non-developers, richer integration library than Zapier. Official MCP exposes scenario triggers, run management, and connection configuration.",
    icon: "⚡",
    category: "automation",
    publisher: "Make.com (official)",
    version: "1.0.0",
    configFields: [
      configField({
        key: "team_id",
        label: "Team ID",
        placeholder: "12345",
        type: "text",
        required: true,
        helpText:
          "Your Make team ID. Find in Make dashboard → URL contains /teams/<team_id>."
      }),
      configField({
        key: "zone",
        label: "Zone",
        placeholder: "us1 or eu1",
        type: "select",
        required: true,
        options: [
          { value: "us1", label: "US1 — us1.make.com" },
          { value: "us2", label: "US2 — us2.make.com" },
          { value: "eu1", label: "EU1 — eu1.make.com" },
          { value: "eu2", label: "EU2 — eu2.make.com" }
        ],
        helpText:
          "Your Make account's region. Check the URL when signed in (us1.make.com / eu1.make.com / etc.)."
      })
    ],
    secretFields: ["api_token"],
    capabilities: [
      "make_list_scenarios",
      "make_get_scenario",
      "make_run_scenario",
      "make_create_scenario",
      "make_clone_scenario",
      "make_list_executions",
      "make_list_connections",
      "make_create_webhook"
    ],
    useCases: [
      "Alternative to n8n for AI Automation Reseller operators whose clients prefer a visual builder",
      "Clone template scenarios per client for productized delivery (build once, deploy 10 times)",
      "Trigger Make scenarios from agent workflows for platform-specific automations",
      "Stronger integration library than n8n for enterprise SaaS (Salesforce, Workday, NetSuite)"
    ],
    docs: "https://developers.make.com/mcp-server",
    setupNote:
      "Make.com has a free tier (1,000 operations/mo) — enough for demos + small clients. Paid tiers start at $9/mo Core. Generate API token under Profile → API. Make vs. n8n tradeoff: Make is easier for non-developers + has better SaaS integrations; n8n is self-hostable + free at scale. AI agencies that serve small clients often start with Make, graduate to n8n at scale."
  },
  {
    id: "a_leads_mcp",
    name: "A-Leads (Personal Email Finder)",
    description:
      "Lead enrichment for outbound prospecting — given a LinkedIn username, retrieves a personal email when available. Credits are deducted only on successful matches. Use to enrich LinkedIn-sourced prospects (CFOs, brokers, freight forwarders, affiliate-creator candidates) with email before cold outreach.",
    icon: "📇",
    category: "data",
    publisher: "A-Leads",
    version: "1.0.0",
    configFields: [
      configField({
        key: "default_request_uuid_prefix",
        label: "Default request UUID prefix",
        placeholder: "gpc-prospect-",
        type: "text",
        required: false,
        helpText:
          "Optional. The API accepts a request_uuid for tracking each search; the agent will auto-generate one if blank. Prefix is prepended to the agent's UUID so you can grep your A-Leads dashboard for engine-driven queries."
      })
    ],
    secretFields: ["api_key"],
    capabilities: ["a_leads_find_personal_email"],
    useCases: [
      "Prospect Hunter enriches LinkedIn-sourced prospects with personal email before handing off to Pitch Composer",
      "Affiliate Recruiter finds personal email for high-fit niche-creator targets (logistics / freight / CPA / consultant LinkedIn accounts)",
      "Broker Relationship Agent enriches broker prospects sourced from public state license rolls (LinkedIn lookup → email enrichment)",
      "CFO outreach: enrich finance-leader LinkedIn profiles to bypass LinkedIn DM rate limits"
    ],
    docs: "https://api.a-leads.co/gateway/v1/search",
    setupNote:
      "Sign up at https://a-leads.co. Get your API key from the dashboard. Rate limits: 200 req/min, 600 req/hour, 6,000 req/day. Credits are deducted ONLY when an email is successfully found — failed lookups are free. The agent sends an `x-api-key` header on every request. The API returns `data.personal_email` (nullable) — null means 'not found,' not an error."
  }
];

export function getMcpDefinitionById(id: string) {
  return MCP_DEFINITIONS.find((definition) => definition.id === id);
}

export function getMcpsByCategory(category: string) {
  return MCP_DEFINITIONS.filter((definition) => definition.category === category);
}
