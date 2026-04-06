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
    | "social";
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
    docs: "https://modelcontextprotocol.io/introduction"
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
    docs: "https://modelcontextprotocol.io/introduction"
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
    docs: "https://modelcontextprotocol.io/introduction"
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
    docs: "https://modelcontextprotocol.io/introduction"
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
    docs: "https://modelcontextprotocol.io/introduction"
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
    docs: "https://www.reddit.com/dev/api/"
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
    docs: "https://docs.getlate.dev"
  }
];

export function getMcpDefinitionById(id: string) {
  return MCP_DEFINITIONS.find((definition) => definition.id === id);
}

export function getMcpsByCategory(category: string) {
  return MCP_DEFINITIONS.filter((definition) => definition.category === category);
}
