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
      "Unified TikTok, LinkedIn, and Reddit publishing — schedule posts, view analytics, and manage profiles from one integration",
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
          { value: "ayrshare", label: "Ayrshare" }
        ]
      }),
      configField({
        key: "api_key",
        label: "API Key",
        placeholder: "Your provider API key",
        type: "password",
        required: true,
        helpText:
          "Late: get at https://getlate.dev — Ayrshare: get at https://ayrshare.com"
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
      "Publish to TikTok, LinkedIn, and Reddit from a single command",
      "Schedule social media content across platforms",
      "Pull engagement analytics for published posts",
      "Manage cross-platform social media campaigns"
    ],
    docs: "https://docs.getlate.dev",
    setupNote:
      "Choose a provider and sign up: Late (recommended, $33/mo) at https://getlate.dev or Ayrshare ($149/mo) at https://ayrshare.com. After signing up, connect your social accounts (TikTok, LinkedIn, Reddit, etc.) through the provider's dashboard, then copy your API key here."
  }
];

export function getMcpDefinitionById(id: string) {
  return MCP_DEFINITIONS.find((definition) => definition.id === id);
}

export function getMcpsByCategory(category: string) {
  return MCP_DEFINITIONS.filter((definition) => definition.category === category);
}
