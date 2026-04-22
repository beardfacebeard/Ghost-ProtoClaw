/**
 * MCP Tool Registry
 *
 * Converts installed MCP server configurations into tool schemas
 * that can be passed to LLM providers (OpenAI function-calling format).
 *
 * This is the bridge between the MCP catalog/management system and
 * the agent runtime. When an agent chats, we:
 *   1. Look up which MCP servers are installed for the business/org
 *   2. Convert their capabilities into tool schemas
 *   3. Pass the schemas to the LLM so it can decide to call tools
 *   4. Execute tool calls via the tool executor
 */

import { db } from "@/lib/db";
import { MCP_DEFINITIONS, type McpDefinition } from "@/lib/integrations/mcp-definitions";

// ── Types ─────────────────────────────────────────────────────────

export type ToolParameter = {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
};

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
};

export type InstalledTool = {
  mcpServerId: string;
  definitionId: string;
  serverName: string;
  schema: ToolSchema;
};

// ── Tool Definitions per MCP ──────────────────────────────────────

/**
 * Maps MCP definition IDs to the concrete tools they expose.
 * Each tool has an OpenAI function-calling schema.
 */
const MCP_TOOL_SCHEMAS: Record<string, ToolSchema[]> = {
  web_search: [
    {
      type: "function",
      function: {
        name: "web_search",
        description:
          "Search the web for current information. Use this when you need to find recent news, research topics, look up facts, or find information that may not be in your training data.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query"
            },
            max_results: {
              type: "number",
              description: "Maximum number of results to return (default: 5)"
            }
          },
          required: ["query"]
        }
      }
    }
  ],
  filesystem: [
    {
      type: "function",
      function: {
        name: "read_file",
        description:
          "Read the contents of a file. Use this to access documents, data files, brand assets, or any file the business has made available.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path relative to the workspace base directory"
            }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description:
          "Write content to a file. Use this to create or update documents, reports, drafts, and other files.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path relative to the workspace base directory"
            },
            content: {
              type: "string",
              description: "The content to write to the file"
            }
          },
          required: ["path", "content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_directory",
        description:
          "List files and folders in a directory. Use this to browse available files, brand assets, and documents.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Directory path relative to the workspace base directory (use '/' for root)"
            }
          },
          required: ["path"]
        }
      }
    }
  ],
  github_mcp: [
    {
      type: "function",
      function: {
        name: "github_list_repos",
        description: "List GitHub repositories for the connected account.",
        parameters: {
          type: "object",
          properties: {
            org: {
              type: "string",
              description: "Organization or user name (optional)"
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "github_list_issues",
        description:
          "List issues for a repository with optional filters.",
        parameters: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Repository in owner/repo format"
            },
            state: {
              type: "string",
              description: "Filter by state",
              enum: ["open", "closed", "all"]
            },
            labels: {
              type: "string",
              description: "Comma-separated list of label names"
            }
          },
          required: ["repo"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "github_create_issue",
        description: "Create a new issue in a GitHub repository.",
        parameters: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "Repository in owner/repo format"
            },
            title: {
              type: "string",
              description: "Issue title"
            },
            body: {
              type: "string",
              description: "Issue body/description in Markdown"
            },
            labels: {
              type: "array",
              description: "Labels to add",
              items: { type: "string" }
            }
          },
          required: ["repo", "title"]
        }
      }
    }
  ],
  slack_mcp: [
    {
      type: "function",
      function: {
        name: "slack_send_message",
        description:
          "Send a message to a Slack channel. Use this to post updates, notifications, or communicate with the team.",
        parameters: {
          type: "object",
          properties: {
            channel: {
              type: "string",
              description: "Slack channel ID or name (e.g. #general or C0123456789)"
            },
            text: {
              type: "string",
              description: "The message text to send"
            }
          },
          required: ["channel", "text"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "slack_list_channels",
        description: "List available Slack channels.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    }
  ],
  stripe_mcp: [
    {
      type: "function",
      function: {
        name: "stripe_list_payments",
        description:
          "List recent Stripe payments. Use this to check revenue, recent transactions, or payment status.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of payments to return (default: 10, max: 100)"
            },
            status: {
              type: "string",
              description: "Filter by status",
              enum: ["succeeded", "pending", "failed"]
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "stripe_get_balance",
        description: "Get the current Stripe account balance.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "stripe_list_subscriptions",
        description: "List active subscriptions.",
        parameters: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Filter by subscription status",
              enum: ["active", "canceled", "past_due", "trialing"]
            },
            limit: {
              type: "number",
              description: "Number of subscriptions to return (default: 10)"
            }
          },
          required: []
        }
      }
    }
  ],
  hubspot_mcp: [
    {
      type: "function",
      function: {
        name: "hubspot_search_contacts",
        description:
          "Search HubSpot contacts by name, email, or other properties.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (name, email, company, etc.)"
            },
            limit: {
              type: "number",
              description: "Max results (default: 10)"
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "hubspot_create_contact",
        description: "Create a new contact in HubSpot CRM.",
        parameters: {
          type: "object",
          properties: {
            email: { type: "string", description: "Contact email address" },
            firstname: { type: "string", description: "First name" },
            lastname: { type: "string", description: "Last name" },
            company: { type: "string", description: "Company name" },
            phone: { type: "string", description: "Phone number" }
          },
          required: ["email"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "hubspot_list_deals",
        description: "List deals in the HubSpot pipeline.",
        parameters: {
          type: "object",
          properties: {
            stage: { type: "string", description: "Filter by deal stage" },
            limit: { type: "number", description: "Max results (default: 10)" }
          },
          required: []
        }
      }
    }
  ],
  postgres_mcp: [
    {
      type: "function",
      function: {
        name: "database_query",
        description:
          "Execute a read-only SQL query against the business database. Use this to look up data, generate reports, or answer questions about stored information.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SQL SELECT query to execute (read-only)"
            }
          },
          required: ["query"]
        }
      }
    }
  ],
  persistent_memory: [
    {
      type: "function",
      function: {
        name: "memory_store",
        description:
          "Store a fact, preference, or important information for long-term recall. Use this to remember things the user tells you, decisions made, or important business context.",
        parameters: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "A short descriptive key for the memory (e.g. 'user_preference_tone', 'project_deadline')"
            },
            value: {
              type: "string",
              description: "The information to remember"
            },
            category: {
              type: "string",
              description: "Category for organization",
              enum: ["preference", "fact", "decision", "contact", "project", "other"]
            }
          },
          required: ["key", "value"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "memory_recall",
        description:
          "Recall stored memories by searching for a topic or key. Use this before answering questions where past context might be relevant.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term or topic to recall memories about"
            }
          },
          required: ["query"]
        }
      }
    }
  ],
  reddit_mcp: [
    {
      type: "function",
      function: {
        name: "reddit_search",
        description:
          "Search Reddit for recent posts matching keywords. Uses the public read-only JSON API (no auth). Returns title, permalink, selftext excerpt, score, numComments, and ageHours for each match. Restrict searches to specific subreddits whenever possible to avoid noise.",
        parameters: {
          type: "object",
          properties: {
            subreddits: {
              type: "array",
              items: { type: "string" },
              description:
                "Subreddit names without r/ prefix (e.g. [\"Entrepreneur\", \"smallbusiness\"]). If empty, searches all of Reddit — far noisier."
            },
            keywords: {
              type: "array",
              items: { type: "string" },
              description:
                "Keywords or phrases. Multiple entries are OR'd together. Prefer specific multi-word phrases (\"AI agent stack\") over single generic words."
            },
            timeWindow: {
              type: "string",
              enum: ["hour", "day", "week", "month", "year"],
              description: "How fresh the posts should be. Default: day."
            },
            sort: {
              type: "string",
              enum: ["new", "relevance", "top", "hot"],
              description: "Default: new."
            },
            minScore: {
              type: "number",
              description:
                "Minimum post score (upvotes minus downvotes) to include. Default 0."
            },
            limit: {
              type: "number",
              description:
                "Max posts per subreddit (1–25). Default 15. Final merged list is capped at 50."
            }
          },
          required: ["keywords"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "reddit_thread_scan",
        description:
          "Fetch a Reddit post and its top comments to gauge intent before drafting a reply. Pass either the full permalink URL or the base-36 postId.",
        parameters: {
          type: "object",
          properties: {
            permalink: {
              type: "string",
              description:
                "Full Reddit URL (e.g. https://www.reddit.com/r/foo/comments/abc123/title/)."
            },
            postId: {
              type: "string",
              description:
                "Reddit's base-36 post id (e.g. abc123). Use this or `permalink`."
            },
            topComments: {
              type: "number",
              description: "Number of top-level comments to return (1–25). Default 10."
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "log_reddit_target",
        description:
          "Save a vetted Reddit post as a reviewable target for the human to post manually. Use this for every high-signal match you would actually reply to. Creates an entry in /admin/reddit so the user can copy your draft, open the thread, and mark it posted or dismissed. Do NOT include self-promotional language — drafts must be helpful-first.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Full permalink URL to the Reddit post."
            },
            subreddit: { type: "string", description: "Subreddit name without r/ prefix." },
            postTitle: { type: "string", description: "The post's title." },
            postExcerpt: {
              type: "string",
              description: "First ~1200 characters of the post for review context."
            },
            draftReply: {
              type: "string",
              description:
                "The reply you drafted. Helpful-first, follows brand voice, adheres to subreddit self-promo rules, and discloses affiliation when relevant. Max ~2000 chars."
            },
            reasoning: {
              type: "string",
              description: "Why this post matches the ICP. 1–3 sentences."
            },
            score: {
              type: "number",
              description:
                "Confidence this is a good target, 1–10. 8+ only for clear ICP matches with genuine intent."
            },
            author: {
              type: "string",
              description: "Post author's Reddit handle (no u/ prefix)."
            }
          },
          required: ["url", "subreddit", "postTitle", "draftReply"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "reddit_post",
        description:
          "Submit a new post to a subreddit. NOT YET IMPLEMENTED — use log_reddit_target to queue drafts for human review instead.",
        parameters: {
          type: "object",
          properties: {
            subreddit: { type: "string", description: "Subreddit name without r/." },
            title: { type: "string", description: "Post title." },
            content: { type: "string", description: "Post body." }
          },
          required: ["subreddit", "title", "content"]
        }
      }
    }
  ],
  social_media_mcp: [
    {
      type: "function",
      function: {
        name: "social_publish_post",
        description:
          "Publish a post to one or more social media platforms (Twitter/X, LinkedIn, TikTok, Facebook, Instagram).",
        parameters: {
          type: "object",
          properties: {
            platforms: {
              type: "array",
              description: "Platforms to publish to",
              items: { type: "string" }
            },
            text: {
              type: "string",
              description: "The post text/caption"
            },
            media_urls: {
              type: "array",
              description: "URLs of media to attach (images, videos)",
              items: { type: "string" }
            },
            schedule_time: {
              type: "string",
              description: "ISO 8601 datetime to schedule the post (optional, publishes immediately if omitted)"
            }
          },
          required: ["platforms", "text"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "social_get_analytics",
        description: "Get analytics and engagement metrics for social media accounts.",
        parameters: {
          type: "object",
          properties: {
            platform: {
              type: "string",
              description: "The platform to get analytics for",
              enum: ["twitter", "linkedin", "tiktok", "facebook", "instagram"]
            },
            period: {
              type: "string",
              description: "Time period for analytics",
              enum: ["day", "week", "month"]
            }
          },
          required: ["platform"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "social_list_posts",
        description: "List recent posts from a social media account.",
        parameters: {
          type: "object",
          properties: {
            platform: {
              type: "string",
              description: "Platform to list posts from",
              enum: ["twitter", "linkedin", "tiktok", "facebook", "instagram"]
            },
            limit: {
              type: "number",
              description: "Number of posts to return (default: 10)"
            }
          },
          required: ["platform"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "social_list_accounts",
        description:
          "List all connected social media accounts. Use this first to check which platforms are connected before trying to post.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    }
  ],
  sequential_thinking: [
    {
      type: "function",
      function: {
        name: "think_step_by_step",
        description:
          "Break down a complex problem into sequential reasoning steps. Use this for planning, analysis, strategy development, or any task that benefits from structured thinking.",
        parameters: {
          type: "object",
          properties: {
            problem: {
              type: "string",
              description: "The problem or question to reason through"
            },
            context: {
              type: "string",
              description: "Additional context or constraints"
            }
          },
          required: ["problem"]
        }
      }
    }
  ],
  resend_mcp: [
    {
      type: "function",
      function: {
        name: "send_email",
        description:
          "Send an email using Resend. Use this for outreach, notifications, follow-ups, and transactional emails.",
        parameters: {
          type: "object",
          properties: {
            to: {
              type: "string",
              description: "Recipient email address"
            },
            subject: {
              type: "string",
              description: "Email subject line"
            },
            body: {
              type: "string",
              description: "Email body (supports HTML)"
            },
            from: {
              type: "string",
              description: "Sender email (must be a verified domain in Resend)"
            }
          },
          required: ["to", "subject", "body"]
        }
      }
    }
  ],
  twilio_mcp: [
    {
      type: "function",
      function: {
        name: "send_sms",
        description: "Send an SMS message via Twilio.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient phone number (E.164 format, e.g. +15551234567)" },
            body: { type: "string", description: "SMS message text (max 1600 characters)" },
            from: { type: "string", description: "Sender phone number (must be a Twilio number)" }
          },
          required: ["to", "body"]
        }
      }
    }
  ],
  firecrawl_mcp: [
    {
      type: "function",
      function: {
        name: "scrape_webpage",
        description:
          "Scrape a webpage and extract its content as clean text or structured data. Use this to read articles, product pages, competitor websites, or any web content.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to scrape"
            },
            format: {
              type: "string",
              description: "Output format",
              enum: ["markdown", "text", "html"]
            }
          },
          required: ["url"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "crawl_website",
        description: "Crawl multiple pages of a website starting from a URL.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "Starting URL to crawl" },
            max_pages: { type: "number", description: "Maximum number of pages to crawl (default: 10)" }
          },
          required: ["url"]
        }
      }
    }
  ],
  playwright_mcp: [
    {
      type: "function",
      function: {
        name: "browser_navigate",
        description: "Navigate a browser to a URL and return the page content.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to navigate to" },
            wait_for: { type: "string", description: "CSS selector to wait for before returning content" }
          },
          required: ["url"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_click",
        description: "Click an element on the current page.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of element to click" }
          },
          required: ["selector"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_fill_form",
        description: "Fill in a form field on the current page.",
        parameters: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector of the input element" },
            value: { type: "string", description: "Value to fill in" }
          },
          required: ["selector", "value"]
        }
      }
    }
  ],
  e2b_code_execution: [
    {
      type: "function",
      function: {
        name: "execute_code",
        description:
          "Execute code in a secure sandboxed environment. Supports Python, JavaScript/TypeScript, and shell commands. Use this for data analysis, calculations, generating charts, or running any code.",
        parameters: {
          type: "object",
          properties: {
            code: { type: "string", description: "The code to execute" },
            language: {
              type: "string",
              description: "Programming language",
              enum: ["python", "javascript", "typescript", "shell"]
            }
          },
          required: ["code", "language"]
        }
      }
    }
  ],

  // ── Forex data + trading (Phase 2 of the Forex Research & Execution Desk) ──

  twelvedata_forex: [
    {
      type: "function",
      function: {
        name: "forex_quote",
        description:
          "Get the real-time quote for a forex pair from TwelveData. Returns bid, ask, mid, spread in pips, and timestamp. Use this for current price snapshots; for historical bars use forex_bars instead.",
        parameters: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description:
                "The forex pair in TwelveData format (e.g. 'EUR/USD', 'USD/JPY', 'GBP/USD'). Always include the slash."
            }
          },
          required: ["symbol"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "forex_bars",
        description:
          "Get OHLC bars for a forex pair from TwelveData for a given interval. Use this for backtests, chart analysis, and signal generation. Respect the free-tier quota (800 req/day, 8 req/min).",
        parameters: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description:
                "The forex pair in TwelveData format (e.g. 'EUR/USD'). Always include the slash."
            },
            interval: {
              type: "string",
              description:
                "Bar interval. Common values: '1min', '5min', '15min', '1h', '4h', '1day', '1week'.",
              enum: [
                "1min",
                "5min",
                "15min",
                "30min",
                "45min",
                "1h",
                "2h",
                "4h",
                "1day",
                "1week",
                "1month"
              ]
            },
            outputsize: {
              type: "number",
              description:
                "Number of bars to return (max 5000; default 30 to preserve quota)."
            }
          },
          required: ["symbol", "interval"]
        }
      }
    }
  ],

  fred_macro: [
    {
      type: "function",
      function: {
        name: "forex_macro_release",
        description:
          "Fetch a US macro time series from FRED (Federal Reserve Economic Data). Use this for CPI, PCE, NFP, unemployment, GDP, Fed funds rate, yield curve, and thousands of other US macro series. Returns the last N observations with their dates.",
        parameters: {
          type: "object",
          properties: {
            series_id: {
              type: "string",
              description:
                "The FRED series ID. Common examples: 'CPIAUCSL' (CPI), 'PCEPILFE' (core PCE), 'PAYEMS' (NFP), 'UNRATE' (unemployment), 'FEDFUNDS' (Fed funds rate), 'DGS10' (10-year treasury)."
            },
            limit: {
              type: "number",
              description:
                "Number of most-recent observations to return (default 12)."
            }
          },
          required: ["series_id"]
        }
      }
    }
  ],

  finnhub_news: [
    {
      type: "function",
      function: {
        name: "forex_news",
        description:
          "Fetch recent forex-relevant news headlines from Finnhub. Use this for central-bank speaker coverage, geopolitical events, fiscal announcements, and commodity-price context. Returns up to 20 recent items with headline, summary, source, timestamp, and related symbol when available.",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description:
                "News category. 'forex' for FX-specific, 'general' for broader market news.",
              enum: ["forex", "general"]
            },
            max_results: {
              type: "number",
              description:
                "How many items to return (default 10, max 20)."
            }
          },
          required: ["category"]
        }
      }
    }
  ],

  tradovate_futures: [
    {
      type: "function",
      function: {
        name: "tradovate_get_account",
        description:
          "Get the Tradovate account summary: balance, realizedPL, openPL, marginBalance, auto-liquidate flag. Available in every tradingMode. Uses the first account attached to the authenticated user unless account_id is specified.",
        parameters: {
          type: "object",
          properties: {
            account_id: {
              type: "number",
              description:
                "Optional Tradovate account id. Leave blank to use the first account returned by /account/list."
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "tradovate_get_positions",
        description:
          "List open positions on the Tradovate account. Returns instrument, netPos (signed contracts), avgPrice, and unrealizedPL per position.",
        parameters: {
          type: "object",
          properties: {
            account_id: {
              type: "number",
              description: "Optional Tradovate account id."
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "tradovate_place_order",
        description:
          "Propose a CME futures order via Tradovate. Behavior depends on the business's tradingMode: research → REFUSED; demo → executed against demo.tradovateapi.com; live_approval → queued to the Approvals queue, fires only on explicit human click. ALWAYS include a stop-loss (as a linked bracket order) and the risk-language fields (thesis, catalyst, invalidation).",
        parameters: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description:
                "Tradovate contract symbol (e.g. '6EZ5' for Dec 2025 EUR/USD futures, 'M6EZ5' for the E-micro version). Use tradovate_get_positions to see your open contracts or ask the Chief of Desk for the front-month symbol."
            },
            side: {
              type: "string",
              enum: ["buy", "sell"],
              description: "Trade direction."
            },
            contracts: {
              type: "number",
              description:
                "Number of contracts to trade (positive integer). For CME 6E: 1 contract = €125,000 notional. For M6E (E-micro): 1 contract = €12,500."
            },
            stop_loss_price: {
              type: "number",
              description:
                "Absolute price for the stop-loss. REQUIRED — the Risk Gate rejects orders without a stop."
            },
            take_profit_price: {
              type: "number",
              description: "Optional take-profit price."
            },
            thesis: {
              type: "string",
              description: "One-sentence hypothesis. Required for journaling."
            },
            catalyst: {
              type: "string",
              description: "What triggered this trade."
            },
            invalidation: {
              type: "string",
              description:
                "What market behavior proves the thesis wrong."
            },
            expected_holding_hours: {
              type: "number",
              description: "Rough expected holding period in hours."
            }
          },
          required: [
            "symbol",
            "side",
            "contracts",
            "stop_loss_price",
            "thesis",
            "catalyst",
            "invalidation"
          ]
        }
      }
    }
  ],

  oanda_forex: [
    {
      type: "function",
      function: {
        name: "oanda_get_account",
        description:
          "Get the OANDA account summary: balance, unrealized P&L, margin used, margin available, open trade count, open position count. Available in every tradingMode.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "oanda_get_positions",
        description:
          "List all open positions on the OANDA account with long/short direction, units, average price, and unrealized P&L per instrument. Available in every tradingMode.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "oanda_get_instrument_pricing",
        description:
          "Get live tradeable pricing for one or more instruments on this OANDA account (includes bid, ask, mid, and tradeable flag). Available in every tradingMode for quote-only lookups.",
        parameters: {
          type: "object",
          properties: {
            instruments: {
              type: "array",
              items: { type: "string" },
              description:
                "OANDA instrument names (e.g. ['EUR_USD', 'USD_JPY']). Note the underscore, not slash, in OANDA's format."
            }
          },
          required: ["instruments"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "oanda_close_position",
        description:
          "Close an open OANDA position (full close or partial units). In research mode this is REFUSED. In paper mode it closes against the practice endpoint immediately. In live_approval mode it queues a 'close_forex_position' approval for a human click. Requires a reason so the Trade Journal Agent can write the exit rationale.",
        parameters: {
          type: "object",
          properties: {
            instrument: {
              type: "string",
              description: "OANDA instrument to close (e.g. 'EUR_USD'). Underscore format."
            },
            side: {
              type: "string",
              enum: ["long", "short", "both"],
              description: "Which side of the position to close. 'long' closes the long units only, 'short' the short units, 'both' flattens whatever's there."
            },
            units: {
              type: "string",
              description: "Units to close. Use 'ALL' (default) for a full close, or a positive integer string for a partial close."
            },
            reason: {
              type: "string",
              description: "One-sentence exit rationale. Required — the journal needs it."
            }
          },
          required: ["instrument", "side", "reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "oanda_modify_order",
        description:
          "Modify a pending order or working position's stop-loss / take-profit levels. In research mode this is REFUSED. In paper mode it hits the practice endpoint immediately. In live_approval mode it queues a 'modify_forex_order' approval. Changing risk levels mid-trade is an audit-worthy event — include a reason.",
        parameters: {
          type: "object",
          properties: {
            trade_id: {
              type: "string",
              description: "The OANDA trade ID to modify (returned by place_order's orderFillTransaction.tradeID)."
            },
            new_stop_loss_price: {
              type: "number",
              description: "New absolute price for the stop-loss. Pass null to leave unchanged."
            },
            new_take_profit_price: {
              type: "number",
              description: "New absolute price for the take-profit. Pass null to leave unchanged."
            },
            reason: {
              type: "string",
              description: "One-sentence rationale. Required — every risk-level change is journal-worthy."
            }
          },
          required: ["trade_id", "reason"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "oanda_place_order",
        description:
          "Propose a forex order. Behavior depends on the business's tradingMode: research → REFUSED (research mode is read-only); paper → executed against the OANDA practice endpoint; live_approval → queued to the Approvals queue, fires only on explicit human click. Always include a stop-loss and the risk-language fields (thesis, catalyst, invalidation) — the Risk Gate rejects orders without them.",
        parameters: {
          type: "object",
          properties: {
            instrument: {
              type: "string",
              description:
                "OANDA instrument (e.g. 'EUR_USD', 'USD_JPY'). Underscore, not slash."
            },
            side: {
              type: "string",
              enum: ["buy", "sell"],
              description: "Trade direction."
            },
            units: {
              type: "number",
              description:
                "Size in base-currency units (positive integer). OANDA uses signed integers under the hood — the handler encodes the side."
            },
            stop_loss_price: {
              type: "number",
              description: "Absolute price level for the stop-loss. REQUIRED — the Risk Gate rejects orders without a stop."
            },
            take_profit_price: {
              type: "number",
              description: "Optional take-profit price level."
            },
            thesis: {
              type: "string",
              description:
                "One-sentence hypothesis. Required for the journal and approval trade card."
            },
            catalyst: {
              type: "string",
              description:
                "What event / condition triggered this trade (release, price level, macro re-pricing, etc.)."
            },
            invalidation: {
              type: "string",
              description:
                "What market behavior proves the thesis wrong. Distinct from the stop — the stop is the mechanical exit, the invalidation is the logical one."
            },
            expected_holding_hours: {
              type: "number",
              description: "Rough expected holding period in hours."
            }
          },
          required: [
            "instrument",
            "side",
            "units",
            "stop_loss_price",
            "thesis",
            "catalyst",
            "invalidation"
          ]
        }
      }
    }
  ]
};

// ── Lookup ─────────────────────────────────────────────────────────

const definitionMap = new Map<string, McpDefinition>();
for (const def of MCP_DEFINITIONS) {
  definitionMap.set(def.id, def);
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Get all available tools for an agent based on their business's installed MCP servers.
 * Returns both the tool schemas (for LLM) and metadata (for execution).
 */
export async function getToolsForAgent(
  organizationId: string,
  businessId: string | null
): Promise<InstalledTool[]> {
  // Fetch installed MCP servers scoped to this org + business
  const servers = await db.mcpServer.findMany({
    where: {
      organizationId,
      status: "active",
      OR: [
        { businessId: null },          // org-wide servers
        ...(businessId ? [{ businessId }] : [])  // business-specific
      ]
    }
  });

  const tools: InstalledTool[] = [];

  for (const server of servers) {
    const schemas = MCP_TOOL_SCHEMAS[server.definitionId];
    if (!schemas) continue;

    for (const schema of schemas) {
      tools.push({
        mcpServerId: server.id,
        definitionId: server.definitionId,
        serverName: server.name,
        schema
      });
    }
  }

  return tools;
}

/**
 * Build a description of available tools for the system prompt.
 * This helps the agent understand what it can do.
 */
export function buildToolsDescription(tools: InstalledTool[]): string {
  if (tools.length === 0) return "";

  const grouped = new Map<string, InstalledTool[]>();
  for (const tool of tools) {
    const group = grouped.get(tool.definitionId) ?? [];
    group.push(tool);
    grouped.set(tool.definitionId, group);
  }

  const sections: string[] = [
    "── AVAILABLE TOOLS ──",
    "You have access to the following tools. Use them when appropriate to complete tasks, look up information, or take actions. Call tools by name when you need them.\n\nIMPORTANT RULES:\n- If a tool call fails, DO NOT retry the same call. Report the error to the user.\n- When testing multiple platforms, post to ALL of them in a SINGLE tool call using the platforms array, not one at a time.\n- Be efficient with tool calls — combine operations when possible.\n- After using tools, summarize results clearly for the user."
  ];

  for (const [defId, groupTools] of grouped) {
    const definition = definitionMap.get(defId);
    const serverName = definition?.name ?? groupTools[0]?.serverName ?? defId;
    const icon = definition?.icon ?? "🔧";

    const toolNames = groupTools.map((t) => t.schema.function.name);
    sections.push(
      `${icon} ${serverName}: ${toolNames.join(", ")}`
    );
  }

  return sections.join("\n");
}

// ── Built-in Tools (not MCP-dependent) ────────────────────────────

const DELEGATE_TASK_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "delegate_task",
    description:
      "Delegate a task to another agent on your team. The delegation executor auto-runs the target agent within ~30 seconds and writes the outcome back to your memory. After calling delegate_task, do NOT invent an ETA or claim the task is in progress beyond what you can confirm — the next turn's memory will include the real outcome, or use check_task_status to query current state. Never tell the user 'results in X hours' or similar fabricated timelines.",
    parameters: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "The ID of the agent to delegate to (from your team list)"
        },
        agent_name: {
          type: "string",
          description: "The display name of the agent (for confirmation)"
        },
        task: {
          type: "string",
          description: "Clear description of the task to be completed"
        },
        priority: {
          type: "string",
          description: "Task priority level",
          enum: ["low", "medium", "high", "urgent"]
        },
        context: {
          type: "string",
          description: "Additional context or background information to help the agent complete the task"
        }
      },
      required: ["agent_id", "agent_name", "task"]
    }
  }
};

const LIST_TEAM_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "list_team",
    description:
      "List all agents on your team with their roles, status, and capabilities. Use this to check who is available and who is best suited for a task.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

const CHECK_TASK_STATUS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "check_task_status",
    description:
      "Check the status of tasks you've delegated to other agents. Returns pending/running/completed/failed delegations with latest update, tools used, and outcome summary. Call this BEFORE telling the user about delegation progress — do not invent progress or ETAs. If nothing is returned for a task you delegated, the task is still in the queue.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max delegations to return (default 10, cap 25)."
        },
        status: {
          type: "string",
          description: "Filter by status",
          enum: ["active", "completed", "failed", "all"]
        }
      },
      required: []
    }
  }
};

// ── Agent Management Tools (leader-only) ─────────────────────────

const SUGGEST_AGENT_CONFIG_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "suggest_agent_config",
    description:
      "Suggest the optimal configuration for a new agent. Analyzes the desired role and recommends the best model, runtime, safety mode, and other settings. Use this before creating an agent to plan the configuration.",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: "The desired role/purpose for the new agent (e.g. 'Social Media Manager', 'Customer Support Lead')"
        },
        requirements: {
          type: "string",
          description: "Any specific requirements, constraints, or capabilities needed"
        }
      },
      required: ["role"]
    }
  }
};

const CREATE_AGENT_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "create_agent",
    description:
      "Propose creating a new agent. This generates a proposal that the user must approve before the agent is created. Include all relevant configuration fields.",
    parameters: {
      type: "object",
      properties: {
        displayName: {
          type: "string",
          description: "Agent display name (2-60 chars)"
        },
        emoji: {
          type: "string",
          description: "Emoji icon for the agent (e.g. '📊', '🎨')"
        },
        role: {
          type: "string",
          description: "Short role title (2-80 chars, e.g. 'Social Media Manager')"
        },
        purpose: {
          type: "string",
          description: "Detailed description of the agent's purpose"
        },
        type: {
          type: "string",
          description: "Agent type",
          enum: ["main", "specialist", "global"]
        },
        primaryModel: {
          type: "string",
          description: "Primary LLM model ID (e.g. 'anthropic/claude-sonnet-4.5', 'openai/gpt-4o')"
        },
        fallbackModel: {
          type: "string",
          description: "Fallback LLM model ID"
        },
        runtime: {
          type: "string",
          description: "Agent runtime environment",
          enum: ["openclaw", "hermes", "opencode", "codex", "claude"]
        },
        safetyMode: {
          type: "string",
          description: "Safety/autonomy level",
          enum: ["ask_before_acting", "auto_low_risk", "full_auto"]
        },
        systemPrompt: {
          type: "string",
          description: "Custom system prompt for the agent"
        },
        roleInstructions: {
          type: "string",
          description: "Specific instructions for how the agent should perform its role"
        },
        outputStyle: {
          type: "string",
          description: "Preferred output format/style (e.g. 'concise', 'detailed with bullet points')"
        },
        constraints: {
          type: "string",
          description: "Rules or limitations the agent must follow"
        },
        escalationRules: {
          type: "string",
          description: "When and how the agent should escalate issues"
        },
        maxTokensPerCall: {
          type: "number",
          description: "Max tokens per LLM call (100-200000)"
        }
      },
      required: ["displayName", "role", "type"]
    }
  }
};

const CONFIRM_CREATE_AGENT_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "confirm_create_agent",
    description:
      "Execute a previously proposed agent creation AFTER the user has explicitly approved it. Takes the proposal token from a prior create_agent call. ONLY call this after the user says 'yes', 'approved', 'create it', or similar confirmation.",
    parameters: {
      type: "object",
      properties: {
        proposal_token: {
          type: "string",
          description: "The base64 proposal token from the [PENDING_CREATE_AGENT:...] marker in the previous create_agent response"
        },
        business_id: {
          type: "string",
          description: "The business ID to assign the agent to (from your business context)"
        }
      },
      required: ["proposal_token", "business_id"]
    }
  }
};

const CONFIRM_EDIT_AGENT_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "confirm_edit_agent",
    description:
      "Execute a previously proposed agent edit AFTER the user has explicitly approved it. Takes the proposal token from a prior edit_agent call. ONLY call this after the user says 'yes', 'approved', 'apply changes', or similar confirmation.",
    parameters: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "The ID of the agent to edit"
        },
        proposal_token: {
          type: "string",
          description: "The base64 proposal token from the [PENDING_EDIT_AGENT:...] marker in the previous edit_agent response"
        }
      },
      required: ["agent_id", "proposal_token"]
    }
  }
};

const EDIT_AGENT_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "edit_agent",
    description:
      "Propose changes to an existing agent's configuration. This generates a proposal that the user must approve before changes are applied. Only include the fields you want to change.",
    parameters: {
      type: "object",
      properties: {
        agent_id: {
          type: "string",
          description: "The ID of the agent to edit (from your team list)"
        },
        agent_name: {
          type: "string",
          description: "Current name of the agent (for confirmation)"
        },
        changes: {
          type: "string",
          description: "JSON object of fields to change. Valid fields: displayName, emoji, role, purpose, type, primaryModel, fallbackModel, runtime, safetyMode, systemPrompt, roleInstructions, outputStyle, constraints, escalationRules, maxTokensPerCall, status"
        },
        reason: {
          type: "string",
          description: "Explanation of why these changes are recommended"
        }
      },
      required: ["agent_id", "agent_name", "changes", "reason"]
    }
  }
};

// ── Master Agent Tools (read-only delegation) ─────────────────────

const ASK_CEO_AGENT_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "ask_ceo_agent",
    description:
      "Ask the CEO (main) agent of a specific business a question and receive their answer. Use this to gather information, get status updates, or relay questions from the user to a business's leadership agent. You can only communicate with CEO agents — you cannot directly execute actions on their behalf. If the user wants action taken, ask the CEO agent to perform it.",
    parameters: {
      type: "object",
      properties: {
        business: {
          type: "string",
          description:
            "The business id or a recognizable part of the business name. Use list_businesses first if you're unsure which businesses exist."
        },
        question: {
          type: "string",
          description:
            "The exact question or request to send to the CEO agent. Write it as you would to a colleague — direct and specific."
        }
      },
      required: ["business", "question"]
    }
  }
};

const LIST_BUSINESSES_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "list_businesses",
    description:
      "List all businesses in the organization along with their CEO (main) agent. Use this when you need to know what businesses exist before asking their CEO agents questions.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

// ── Telegram Outbound Tool (all agents) ──────────────────────────

const SEND_TELEGRAM_MESSAGE_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "send_telegram_message",
    description:
      "Send a proactive message to the user via Telegram. Use this for status updates, reports, alerts, or any time you want to reach the user outside the current chat thread. By default the message goes to every Telegram chat that has paired with you via /start; pass chat_id to target a specific chat. Requires the Telegram integration to be connected for this business.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "The message to send. Markdown is supported. Keep it concise — Telegram caps individual messages at ~4000 characters (longer messages will be split automatically)."
        },
        chat_id: {
          type: "string",
          description:
            "Optional. A specific Telegram chat id to target. If omitted, sends to every chat linked to you via /start. Also accepts the default chat id configured on the integration."
        }
      },
      required: ["text"]
    }
  }
};

// ── Reddit (read-only + draft logging) ───────────────────────────

const REDDIT_SEARCH_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "reddit_search",
    description:
      "Search Reddit for recent posts matching keywords. Uses the public read-only JSON API (no auth). Restrict searches to specific subreddits whenever possible to avoid noise. Returns title, permalink, selftext excerpt, score, numComments, and ageHours per match.",
    parameters: {
      type: "object",
      properties: {
        subreddits: {
          type: "array",
          items: { type: "string" },
          description:
            "Subreddit names without r/ prefix. Empty array searches all of Reddit — noisy, avoid unless intentional."
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description:
            "Keywords or phrases. Multiple entries are OR'd together. Prefer specific multi-word phrases over single generic words."
        },
        timeWindow: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year"],
          description: "Default: day."
        },
        sort: {
          type: "string",
          enum: ["new", "relevance", "top", "hot"],
          description: "Default: new."
        },
        minScore: {
          type: "number",
          description: "Minimum post score. Default 0."
        },
        limit: {
          type: "number",
          description: "Max posts per subreddit (1–25). Default 15."
        }
      },
      required: ["keywords"]
    }
  }
};

const REDDIT_THREAD_SCAN_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "reddit_thread_scan",
    description:
      "Fetch a Reddit post and its top comments to gauge intent before drafting a reply. Pass either `permalink` (full URL) or `postId` (base-36).",
    parameters: {
      type: "object",
      properties: {
        permalink: {
          type: "string",
          description: "Full Reddit URL."
        },
        postId: {
          type: "string",
          description: "Base-36 post id (use this or permalink)."
        },
        topComments: {
          type: "number",
          description: "1–25. Default 10."
        }
      },
      required: []
    }
  }
};

const REDDIT_GET_USER_POSTS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "reddit_get_user_posts",
    description:
      "Ground-truth check of what a Reddit user has ACTUALLY posted. Hits https://www.reddit.com/user/<name>/<kind>.json directly. Use this whenever you need to confirm whether a post our system logged as 'published' (via Zernio/Ayrshare/etc.) actually made it onto the user's Reddit profile — middlemen report success as soon as they accept the job, but Reddit silently shadow-bans API submissions all the time. If the user asks 'did this post?', call this tool before answering — do NOT trust our internal logs alone.",
    parameters: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Reddit username without the u/ prefix."
        },
        kind: {
          type: "string",
          enum: ["submitted", "comments", "overview"],
          description:
            "Which feed to pull. 'submitted' = the user's posts (default, usually what you want). 'comments' = their comments. 'overview' = both."
        },
        limit: {
          type: "number",
          description: "1–100. Default 25."
        },
        timeWindow: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year", "all"],
          description: "How far back to look. Default week."
        }
      },
      required: ["username"]
    }
  }
};

const VERIFY_REDDIT_POST_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "verify_reddit_post",
    description:
      "Confirm whether a specific Reddit post URL is actually live. Returns { exists, visible, removed, author, post } so you can tell the user definitively whether a submission survived. If our logs claim we posted a reply but the URL doesn't resolve here, our logs are lying — the third-party API call succeeded but Reddit rejected the post. Use this anytime a user asks you to verify a specific post.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "Full Reddit permalink (e.g. https://www.reddit.com/r/Entrepreneur/comments/abc123/...)."
        }
      },
      required: ["url"]
    }
  }
};

const LOG_REDDIT_TARGET_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "log_reddit_target",
    description:
      "Save a vetted Reddit post as a reviewable target so the human can post the reply manually. Use this for every high-signal match you would actually reply to. Creates an entry in /admin/reddit the user can approve, copy, or dismiss. Drafts must be helpful-first and follow subreddit self-promo rules.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full Reddit permalink." },
        subreddit: { type: "string", description: "Subreddit name without r/." },
        postTitle: { type: "string", description: "Post title." },
        postExcerpt: {
          type: "string",
          description: "First ~1200 characters of the post for review context."
        },
        draftReply: {
          type: "string",
          description: "Helpful-first reply following brand voice. Max ~2000 chars."
        },
        reasoning: {
          type: "string",
          description: "Why this post matches the ICP. 1–3 sentences."
        },
        score: {
          type: "number",
          description: "Confidence 1–10. 8+ only for clear ICP matches with genuine intent."
        },
        author: { type: "string", description: "Post author's Reddit handle (no u/)." }
      },
      required: ["url", "subreddit", "postTitle", "draftReply"]
    }
  }
};

// ── Hacker News ──────────────────────────────────────────────────

const HN_SEARCH_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "hn_search",
    description:
      "Search Hacker News stories and comments by keyword using Algolia's free public API. Great for B2B / developer-tool / SaaS audiences. Restrict `kinds` to [\"story\"] for posts, [\"comment\"] to mine discussion, or both.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description:
            "Keywords or phrases. Multiple entries are OR'd together."
        },
        kinds: {
          type: "array",
          items: { type: "string" },
          description: "HN kinds to include: \"story\", \"comment\". Default both."
        },
        timeWindow: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year"],
          description: "Default: day."
        },
        sort: {
          type: "string",
          enum: ["relevance", "recency"],
          description: "Default: recency."
        },
        minPoints: {
          type: "number",
          description: "Minimum story points to include. Default 0."
        },
        limit: {
          type: "number",
          description: "1–50. Default 25."
        }
      },
      required: ["keywords"]
    }
  }
};

const HN_THREAD_SCAN_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "hn_thread_scan",
    description:
      "Fetch a Hacker News item and its top-level comments to gauge intent before drafting a reply.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "HN item id (the number after ?id= in a news.ycombinator.com URL)."
        },
        maxKids: {
          type: "number",
          description: "Max top-level comments to return (1–30). Default 15."
        }
      },
      required: ["id"]
    }
  }
};

// ── Stack Overflow ───────────────────────────────────────────────

const STACKOVERFLOW_SEARCH_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "stackoverflow_search",
    description:
      "Search Stack Overflow (or any Stack Exchange site) for recent questions matching keywords or tags. Ideal for finding developers struggling with problems your product solves.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to search in title/body. OR'd together."
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Tag filters (e.g. [\"nextjs\", \"prisma\"]). Questions must match ALL listed tags."
        },
        site: {
          type: "string",
          description:
            "Stack Exchange site key. Default \"stackoverflow\"; other examples: \"serverfault\", \"superuser\"."
        },
        timeWindow: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year"],
          description: "Default: week."
        },
        answered: {
          type: "boolean",
          description:
            "If true, only questions with accepted answers; false for unanswered only; omit for both."
        },
        minScore: {
          type: "number",
          description: "Minimum question score. Default -5."
        },
        limit: {
          type: "number",
          description: "1–50. Default 20."
        }
      },
      required: []
    }
  }
};

// ── GitHub Issues / PRs ─────────────────────────────────────────

const GITHUB_SEARCH_ISSUES_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "github_search_issues",
    description:
      "Search public GitHub issues and pull requests via GitHub's Search API. Useful for finding people filing bugs about a competing tool, or users asking for features in adjacent projects.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Full-text search across title + body."
        },
        repos: {
          type: "array",
          items: { type: "string" },
          description:
            "Full repo names in \"owner/name\" format to restrict the search (e.g. [\"vercel/next.js\"])."
        },
        language: {
          type: "string",
          description: "Filter by repo primary language (e.g. \"TypeScript\")."
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Issue labels that must be present (e.g. [\"bug\"])."
        },
        kind: {
          type: "string",
          enum: ["issue", "pr", "any"],
          description: "Default: issue."
        },
        isOpen: {
          type: "boolean",
          description: "Default: true."
        },
        timeWindow: {
          type: "string",
          enum: ["hour", "day", "week", "month", "year"],
          description: "Default: week."
        },
        limit: {
          type: "number",
          description: "1–50. Default 25."
        }
      },
      required: []
    }
  }
};

// ── Platform-agnostic outreach target logging ───────────────────

const LOG_OUTREACH_TARGET_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "log_outreach_target",
    description:
      "Save a vetted post (from any platform) as a reviewable target so the human can post the reply manually. Use this for every high-signal match you would actually reply to — it surfaces in /admin/targets with a platform filter. Drafts must be helpful-first and follow the platform's self-promo rules. Replaces log_reddit_target for all new platforms.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["reddit", "hackernews", "stackoverflow", "github", "other"],
          description: "Which platform the target came from."
        },
        url: {
          type: "string",
          description: "Canonical URL to the post / issue / question."
        },
        title: { type: "string", description: "Post or thread title." },
        community: {
          type: "string",
          description:
            "Subreddit name, GitHub repo (owner/name), Stack Exchange tag, or left blank for HN."
        },
        excerpt: { type: "string", description: "First ~1200 chars for review context." },
        draftReply: {
          type: "string",
          description:
            "Helpful-first reply following brand voice and the platform's rules. Max ~2000 chars."
        },
        reasoning: {
          type: "string",
          description: "Why this target matches the ICP. 1–3 sentences."
        },
        score: {
          type: "number",
          description: "Confidence 1–10. 8+ only for clear ICP matches with intent."
        },
        author: {
          type: "string",
          description: "The poster's handle (no u/ or @ prefix)."
        },
        platformExtras: {
          type: "object",
          description:
            "Free-form platform-specific metadata (e.g. issue number, question_id, HN points). Pass as a JSON object; it's stored verbatim on the target."
        }
      },
      required: ["platform", "url", "title", "draftReply"]
    }
  }
};

// ── Video transcript + clip mining ────────────────────────────────

const FETCH_VIDEO_TRANSCRIPT_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "fetch_video_transcript",
    description:
      "Fetch a time-coded transcript for a YouTube video (full URL, short URL, Shorts URL, or 11-char video id). Uses the public caption track — works for any public YouTube with captions (auto-captions included). Returns the video's title, author, duration, language, and an array of segments with start/end timestamps so you can propose exact clip boundaries. Before suggesting clips, always fetch the transcript first — do NOT guess or hallucinate what the video says.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "YouTube URL or 11-character video id. Accepts youtu.be, youtube.com/watch?v=..., youtube.com/shorts/..., and embed URLs."
        },
        maxSegments: {
          type: "number",
          description: "Cap the number of segments returned (10–2000). Default 800."
        },
        mergeGapSec: {
          type: "number",
          description:
            "If > 0, merge adjacent caption chunks whose gap is <= this many seconds. Useful for auto-captions which arrive as tiny 1–2s pieces. Default 0 (no merge)."
        }
      },
      required: ["url"]
    }
  }
};

const LOG_VIDEO_CLIP_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "log_video_clip",
    description:
      "Queue a suggested short-form clip cut from a video. Use this AFTER fetch_video_transcript, once you've picked a segment worth cutting. Creates an entry in /admin/clips so the human can copy the timestamps, open the source video, and cut the clip manually in their editor. Every suggestion must have a real hook and a platform-specific caption that follows the brand voice. Drafts that violate the red-line marketing rules will be auto-rejected.",
    parameters: {
      type: "object",
      properties: {
        videoUrl: { type: "string", description: "URL of the source video." },
        videoTitle: { type: "string", description: "Title of the source video." },
        startSec: {
          type: "number",
          description: "Clip start time in seconds (use exact transcript timestamps)."
        },
        endSec: {
          type: "number",
          description: "Clip end time in seconds. Must be greater than startSec."
        },
        hookLine: {
          type: "string",
          description:
            "The first-3-seconds hook as it should appear on screen or be spoken. Max ~200 chars."
        },
        caption: {
          type: "string",
          description:
            "Platform-appropriate caption to paste with the uploaded short. Must follow the brand voice and disclosure rules."
        },
        targetPlatform: {
          type: "string",
          enum: ["tiktok", "shorts", "reels", "x", "linkedin", "other"],
          description: "Where this clip is intended to be posted. Default tiktok."
        },
        aspectRatio: {
          type: "string",
          enum: ["9:16", "1:1", "16:9", "4:5"],
          description: "Aspect ratio to cut. Default 9:16."
        },
        transcriptExcerpt: {
          type: "string",
          description:
            "The exact transcript text between startSec and endSec so the human can verify before cutting."
        },
        reasoning: {
          type: "string",
          description: "Why this makes a good clip. 1–3 sentences."
        },
        score: {
          type: "number",
          description: "Confidence 1–10. 8+ only for obvious bangers."
        }
      },
      required: [
        "videoUrl",
        "startSec",
        "endSec",
        "hookLine",
        "caption"
      ]
    }
  }
};

// ── HeyGen (AI avatar talking-head video) ───────────────────────

const HEYGEN_LIST_AVATARS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "heygen_list_avatars",
    description:
      "List all HeyGen avatars + talking-photos on the account. Call this before heygen_generate_video so you have valid avatar_id and voice_id values. Requires HEYGEN_API_KEY.",
    parameters: { type: "object", properties: {}, required: [] }
  }
};

const HEYGEN_GENERATE_VIDEO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "heygen_generate_video",
    description:
      "Kick off an AI avatar video generation with HeyGen. Returns a video_id — async, typically 60–180s to finish. Poll with heygen_check_video every 30–60s until status=completed. Keep scripts under 1500 chars; split longer content into multiple scenes. Always add AI disclosure per brand rules when published.",
    parameters: {
      type: "object",
      properties: {
        avatar_id: {
          type: "string",
          description: "Avatar id from heygen_list_avatars."
        },
        voice_id: {
          type: "string",
          description: "Voice id (HeyGen's voice library)."
        },
        text: {
          type: "string",
          description:
            "Script the avatar reads. Conversational, first-person, brand-voice-compliant. Max ~1500 chars."
        },
        title: {
          type: "string",
          description: "Human-readable title for the video."
        }
      },
      required: ["avatar_id", "voice_id", "text"]
    }
  }
};

const HEYGEN_CHECK_VIDEO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "heygen_check_video",
    description:
      "Check generation status of a HeyGen video. Returns status (processing | completed | failed) and video_url when completed. Poll every 30–60 seconds after heygen_generate_video.",
    parameters: {
      type: "object",
      properties: {
        video_id: { type: "string", description: "The video_id from heygen_generate_video." }
      },
      required: ["video_id"]
    }
  }
};

// ── Creatify (high-volume AI UGC) ────────────────────────────────

const CREATIFY_LIST_AVATARS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "creatify_list_avatars",
    description:
      "List Creatify personas/avatars you can generate UGC-style videos with. Requires CREATIFY_API_ID + CREATIFY_API_KEY.",
    parameters: { type: "object", properties: {}, required: [] }
  }
};

const CREATIFY_GENERATE_UGC_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "creatify_generate_ugc",
    description:
      "Submit a Creatify UGC-style video job. Async — returns id; poll with creatify_check_ugc. Ideal for high-volume hook-variation testing (cheaper per video than HeyGen).",
    parameters: {
      type: "object",
      properties: {
        persona_id: {
          type: "string",
          description: "Persona id from creatify_list_avatars."
        },
        script: {
          type: "string",
          description: "Conversational first-person script. Brand-voice compliant."
        },
        name: { type: "string", description: "Display name for this job." },
        aspect_ratio: {
          type: "string",
          enum: ["9x16", "1x1", "16x9"],
          description: "Default 9x16 for shorts."
        }
      },
      required: ["persona_id", "script"]
    }
  }
};

const CREATIFY_CHECK_UGC_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "creatify_check_ugc",
    description:
      "Check Creatify job status. Returns status and output video URL when finished.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The id from creatify_generate_ugc." }
      },
      required: ["id"]
    }
  }
};

// ── Auto-clip (Klap / Opus Clip) ─────────────────────────────────

const AUTO_CLIP_SUBMIT_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "auto_clip_submit",
    description:
      "Submit a long-form video URL for automatic clip extraction. Uses Klap by default (KLAP_API_KEY); switches to Opus Clip when OPUSCLIP_API_KEY is added. Async — returns taskId for auto_clip_check. Prefer this for batch cutting; use fetch_video_transcript + log_video_clip when you want human-reviewable suggestions without an auto-cut credit spend.",
    parameters: {
      type: "object",
      properties: {
        video_url: {
          type: "string",
          description: "Public URL of the long-form video (YouTube URL OR an R2-uploaded mp4 URL)."
        },
        language: {
          type: "string",
          description: "ISO 639-1 language code. Default en."
        },
        max_duration: {
          type: "number",
          description: "Max clip length in seconds. Default 60."
        },
        max_clips: {
          type: "number",
          description: "Max clips to generate. Default 10."
        }
      },
      required: ["video_url"]
    }
  }
};

const AUTO_CLIP_CHECK_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "auto_clip_check",
    description:
      "Poll an auto-clip task. Returns the clip list with individual URLs when processing is complete.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task id from auto_clip_submit." }
      },
      required: ["task_id"]
    }
  }
};

// ── B-Roll search (Pexels) ───────────────────────────────────────

const BROLL_SEARCH_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "broll_search",
    description:
      "Search free, commercial-use B-roll footage on Pexels. Returns HD mp4 download URLs + a photographer attribution link (attribution optional but recommended). Default orientation is portrait (9:16) for shorts. Use before log_broll_scene.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description:
            "Keywords describing the visual you want (e.g. [\"laptop typing\", \"coffee shop\"])."
        },
        orientation: {
          type: "string",
          enum: ["portrait", "landscape", "square"],
          description: "Default portrait."
        },
        minDurationSec: {
          type: "number",
          description: "Minimum clip duration. Default 4."
        },
        maxDurationSec: {
          type: "number",
          description: "Maximum clip duration. Default 20."
        },
        limit: {
          type: "number",
          description: "1–30. Default 15."
        }
      },
      required: ["keywords"]
    }
  }
};

const LOG_BROLL_SCENE_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "log_broll_scene",
    description:
      "Queue a B-roll + text-overlay scene for manual assembly. Builds a scene spec: a hook line, a caption, one or more Pexels/uploaded B-roll clips with their download URLs and durations, and a text-overlay timeline. Use AFTER broll_search to bundle a shoot-ready scene the user can assemble in CapCut / Descript in 5–10 minutes.",
    parameters: {
      type: "object",
      properties: {
        hookLine: {
          type: "string",
          description: "The 10-word-max on-screen hook for the first 2 seconds."
        },
        caption: {
          type: "string",
          description: "Platform-appropriate caption to post with the video."
        },
        overlays: {
          type: "array",
          items: { type: "string" },
          description:
            "Ordered list of on-screen text lines as they should appear over the B-roll, one per beat. Keep each under 10 words."
        },
        brollClips: {
          type: "array",
          items: { type: "string" },
          description:
            "Ordered list of B-roll download URLs (from broll_search) in the order they should appear. Each clip is typically 2–5s on screen."
        },
        targetPlatform: {
          type: "string",
          enum: ["tiktok", "shorts", "reels", "x", "linkedin", "other"],
          description: "Where this scene is intended to be posted. Default tiktok."
        },
        aspectRatio: {
          type: "string",
          enum: ["9:16", "1:1", "16:9", "4:5"],
          description: "Default 9:16."
        },
        totalDurationSec: {
          type: "number",
          description: "Target total length in seconds (3–120). Typically 22–45 for shorts."
        },
        reasoning: {
          type: "string",
          description: "Why this scene works — angle, ICP fit, proof anchor. 1–3 sentences."
        },
        score: {
          type: "number",
          description: "Confidence 1–10. Only queue 6+."
        }
      },
      required: ["hookLine", "caption", "overlays", "brollClips"]
    }
  }
};

// ── Dealhawk Empire — Sourcing tools ─────────────────────────────
// Always available (built-in) when the agent's business is materialized
// from the dealhawk_empire template. No MCP install required — the Demo
// provider works zero-config; the BatchData provider activates the moment
// BATCHDATA_API_KEY (env or Business.currentIntegrations.batchdata.apiKey)
// is set.

const DEALHAWK_SEARCH_PROPERTIES_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "dealhawk_search_properties",
    description:
      "Search a real-estate data provider (Demo or BatchData) for distressed properties in a target market. Returns ranked results with motivation scores, recommended exit strategies, and stacked distress signals. Use this when sourcing new leads — pre-foreclosures, tax-delinquents, probate, divorce, code-violations, absentee landlords, etc. Does NOT create Deal rows; preview-then-import is the safe pattern (use dealhawk_create_deal to persist selected results).",
    parameters: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          enum: ["demo", "batchdata"],
          description:
            "Which data provider to query. 'demo' returns synthetic but realistic seeded data — useful for testing and zero-config demos. 'batchdata' requires the operator to have configured BATCHDATA_API_KEY."
        },
        state: {
          type: "string",
          description:
            "Required. 2-letter USPS state code (e.g., 'TX', 'AZ', 'GA') for the target market."
        },
        city: {
          type: "string",
          description:
            "Optional. City name to scope the search (e.g., 'Phoenix'). Omit for state-wide."
        },
        signal_types: {
          type: "array",
          description:
            "Optional. Subset of distress signals to require. If omitted, all signal types are eligible.",
          items: { type: "string" }
        },
        min_motivation: {
          type: "number",
          description:
            "Optional. Minimum motivation score (0-100). Default 0. Distress Signal Analyst threshold for outreach is 40."
        },
        max_results: {
          type: "number",
          description:
            "Optional. Cap on results returned (default 30, max 200). Larger pulls cost more provider credits."
        }
      },
      required: ["provider", "state"]
    }
  }
};

const DEALHAWK_CREATE_DEAL_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "dealhawk_create_deal",
    description:
      "Persist a single property as a Deal in the business's pipeline (status = 'lead'). Optionally attach distress signals which contribute to the motivation score. Use this after a search to commit a vetted property, or when manually entering a lead from a referral / direct phone call. The motivation score is auto-computed if not provided.",
    parameters: {
      type: "object",
      properties: {
        property_address: {
          type: "string",
          description: "Required. Street address (number + street name, no city/state)."
        },
        property_city: {
          type: "string",
          description: "Required. City."
        },
        property_state: {
          type: "string",
          description: "Required. 2-letter USPS state code."
        },
        property_zip: {
          type: "string",
          description: "Required. Zip code."
        },
        owner_name: {
          type: "string",
          description: "Optional. Owner of record."
        },
        owner_mailing_address: {
          type: "string",
          description: "Optional. Owner's mailing address (different from property = absentee)."
        },
        owner_entity_type: {
          type: "string",
          enum: ["individual", "llc", "trust", "estate", "corporation"],
          description: "Optional. Owner entity type."
        },
        arv_estimate: {
          type: "number",
          description: "Optional. Rough ARV from comp data."
        },
        equity_percent: {
          type: "number",
          description: "Optional. Owner equity percent (0-100). Triggers high-equity multiplier (×1.5) when >= 40."
        },
        tenure_years: {
          type: "number",
          description: "Optional. Years current owner has held the property. Triggers long-tenure multiplier (×1.3) when >= 7."
        },
        signals: {
          type: "array",
          description:
            "Optional. Stacked distress signals — each is { signal_type, source_ref?, notes? }. Recognized signal_types: pre_foreclosure, tax_delinquent, probate, divorce, code_violation, vacancy, absentee, eviction, expired_listing.",
          items: { type: "object" }
        },
        notes: {
          type: "string",
          description: "Optional. Operator-facing notes."
        },
        source: {
          type: "string",
          description:
            "Optional. Lead origin: 'mls_stale', 'off_market', 'distress', 'absentee', 'manual_import', 'referral', or a provider name like 'demo' or 'batchdata'."
        }
      },
      required: ["property_address", "property_city", "property_state", "property_zip"]
    }
  }
};

const DEALHAWK_SCORE_LEAD_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "dealhawk_score_lead",
    description:
      "Compute a 0-100 motivation score for a hypothetical or real distress-signal stack — without persisting anything. Use this when you want to reason about whether a property would clear the outreach threshold (40/100 default), compare two candidate stacks, or explain to the operator why a lead earned its score. Returns the score, the base weight sum, the multiplier, and a human-readable breakdown.",
    parameters: {
      type: "object",
      properties: {
        signals: {
          type: "array",
          description:
            "Distress-signal types to stack. Recognized: pre_foreclosure (40), tax_delinquent (25), probate (30), divorce (25), code_violation (15), vacancy (15), absentee (10), eviction (20), expired_listing (10).",
          items: { type: "string" }
        },
        equity_percent: {
          type: "number",
          description: "Optional. Equity %. Triggers high-equity multiplier ×1.5 when >= 40."
        },
        tenure_years: {
          type: "number",
          description: "Optional. Years owned. Triggers long-tenure multiplier ×1.3 when >= 7."
        }
      },
      required: ["signals"]
    }
  }
};

const DEALHAWK_COMPUTE_MAO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "dealhawk_compute_mao",
    description:
      "Compute the four Maximum Allowable Offer (MAO) numbers for a property — Wholesale, BRRRR, and Fix-and-flip. (Sub-To viability is a separate computation; use dealhawk_qualify_sub_to for that.) Applies the 2026 'Sophisticated Wholesaler' market adjustments: 65% for <$100K ARV, 78% in hot markets, 68% in cold markets, 70% standard. Returns rounded whole-dollar MAOs plus human-readable rationale notes explaining every adjustment.",
    parameters: {
      type: "object",
      properties: {
        arv: {
          type: "number",
          description: "Required. ARV mid estimate in dollars."
        },
        rehab: {
          type: "number",
          description:
            "Required. Rehab estimate in dollars — use the conservative end of the range (medium or heavy scenario, not light)."
        },
        rent: {
          type: "number",
          description:
            "Optional. Monthly market-rent estimate in dollars. Required for BRRRR MAO; if omitted, BRRRR will be null in the output."
        },
        market: {
          type: "string",
          enum: ["hot", "normal", "cold"],
          description:
            "Optional. Market temper. 'hot' bumps wholesale pct to 78% (flippers paying up); 'cold' drops to 68% (buyer pool thinner). Default 'normal' (70%)."
        }
      },
      required: ["arv", "rehab"]
    }
  }
};

const DEALHAWK_QUALIFY_SUB_TO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "dealhawk_qualify_sub_to",
    description:
      "Evaluate a property for Subject-To fit. Returns a 0-100 score, a viability tier (grand_slam / good / marginal / decline), monthly cashflow, acquisition equity, loan-to-ARV percent, DOS-risk notes, recommended structure (straight_sub_to / sub_to_plus_carry / sub_to_plus_wrap / decline), and the mandatory attorney disclaimer. The four 'ideal deal' conditions evaluated: (1) loan rate <5%, (2) PITI <=80% of market rent, (3) balance/ARV <85%, (4) minimal equity or distressed seller. DOS risk factors (HELOC, recent refi, assumption-clause status, forbearance, VA loan) drop the score and/or override viability to 'decline'. Every response MUST preserve the attorney disclaimer verbatim.",
    parameters: {
      type: "object",
      properties: {
        arv: { type: "number", description: "Required. ARV mid estimate." },
        rent: { type: "number", description: "Required. Monthly market rent." },
        loan_balance: {
          type: "number",
          description: "Required. Outstanding loan balance."
        },
        loan_rate: {
          type: "number",
          description:
            "Required. Loan rate as a decimal percentage (e.g., 3.125 for 3.125%)."
        },
        piti: {
          type: "number",
          description:
            "Required. Monthly PITI (principal + interest + taxes + insurance)."
        },
        has_heloc: {
          type: "boolean",
          description:
            "Optional. True if the seller has an open HELOC with available equity — the single biggest DOS trap."
        },
        recent_refi: {
          type: "boolean",
          description:
            "Optional. True if the seller refinanced within the last 2 years."
        },
        assumption_clause: {
          type: "string",
          enum: ["unknown", "none", "transfer_to_llc_prohibited", "prohibited"],
          description:
            "Optional. Status of the loan's assumption / transfer clause. Default 'unknown' when loan docs haven't been pulled."
        },
        in_forbearance: {
          type: "boolean",
          description:
            "Optional. True if the loan is in active forbearance or modification."
        },
        is_va_loan: {
          type: "boolean",
          description:
            "Optional. True if the loan is a VA loan — assumability interacts unusually with DOS."
        }
      },
      required: ["arv", "rent", "loan_balance", "loan_rate", "piti"]
    }
  }
};

const DEALHAWK_UPDATE_DEAL_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "dealhawk_update_deal",
    description:
      "Persist underwriting / signal updates to an existing Deal row. Use this after computing MAOs or Sub-To viability to write the results back to the pipeline so the dashboard reflects current analysis. Also the right tool for recording ARV range (low/mid/high), rent estimate, rehab scenarios (Light/Medium/Heavy), or appending operator notes. Does NOT move pipeline stage — use the PATCH /deals/[id] endpoint for that.",
    parameters: {
      type: "object",
      properties: {
        deal_id: {
          type: "string",
          description: "Required. The Deal.id to update."
        },
        arv_low: { type: "number", description: "Optional." },
        arv_mid: { type: "number", description: "Optional." },
        arv_high: { type: "number", description: "Optional." },
        rent_estimate: { type: "number", description: "Optional." },
        rehab_light: { type: "number", description: "Optional." },
        rehab_medium: { type: "number", description: "Optional." },
        rehab_heavy: { type: "number", description: "Optional." },
        mao_wholesale: { type: "number", description: "Optional." },
        mao_brrrr: { type: "number", description: "Optional." },
        mao_flip: { type: "number", description: "Optional." },
        sub_to_score: {
          type: "number",
          description: "Optional. 0-100 Sub-To fit score."
        },
        sub_to_viability: {
          type: "string",
          enum: ["grand_slam", "good", "marginal", "decline"],
          description: "Optional."
        },
        recommended_exit: {
          type: "string",
          description:
            "Optional. Override the automated recommended exit. Values: wholesale / brrrr / flip / sub_to / novation / wrap / lease_option / contract_for_deed / decline."
        },
        notes_append: {
          type: "string",
          description:
            "Optional. Text to append to Deal.notes. Agent should use this to record analysis context — e.g. 'Sub-To scored 78/100 grand-slam per 2026-04-22 analysis; DOS risk: recent refi 2024.'"
        }
      },
      required: ["deal_id"]
    }
  }
};

const DEALHAWK_SKIP_TRACE_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "dealhawk_skip_trace",
    description:
      "Skip-trace an owner — look up phone numbers, email addresses, and alternate addresses via the configured provider. Demo returns 555-prefixed phones (safe for testing). BatchData returns real records and consumes credits. Use sparingly during outreach prep; do NOT skip-trace the same owner twice in a session.",
    parameters: {
      type: "object",
      properties: {
        provider: {
          type: "string",
          enum: ["demo", "batchdata"],
          description: "Provider to use. 'batchdata' requires BATCHDATA_API_KEY."
        },
        owner_name: {
          type: "string",
          description: "Required. Owner's full name."
        },
        property_address: {
          type: "string",
          description: "Required. Property street address."
        },
        property_city: {
          type: "string",
          description: "Required. Property city."
        },
        property_state: {
          type: "string",
          description: "Required. 2-letter USPS state code."
        },
        property_zip: {
          type: "string",
          description: "Required. Property zip."
        }
      },
      required: ["provider", "owner_name", "property_address", "property_city", "property_state", "property_zip"]
    }
  }
};

// ── Knowledge lookup (tier-aware semantic search) ────────────────

const KNOWLEDGE_LOOKUP_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "knowledge_lookup",
    description:
      "Search the business's knowledge base for the most relevant items for a specific question. Use this when a user question touches products, pricing, policies, FAQs, processes, or any operator-documented fact — ESPECIALLY when the auto-injected knowledge section tells you there are 'additional reference items available on demand.' Uses semantic search (embeddings) when OpenAI is configured, falls back to keyword match otherwise. By default searches warm + cold tier items only (hot items are already in your system prompt so searching them is wasted). Returns titles, tiers, and content excerpts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A short natural-language query (3-200 chars) — e.g. 'refund policy for courses', 'our pricing for high-ticket offers', 'brand voice rules for ads'."
        },
        limit: {
          type: "number",
          description: "Max hits to return (1-15). Default 5."
        },
        includeHot: {
          type: "boolean",
          description:
            "If true, also search hot-tier items (usually redundant since they're already in your prompt). Default false."
        }
      },
      required: ["query"]
    }
  }
};

// ── fal.ai image + video generation (all non-master agents) ─────

const GENERATE_IMAGE_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "generate_image",
    description:
      "Generate an image (logo, social banner, product mockup, thumbnail, static ad) via fal.ai. The result is downloaded, persisted to Cloudflare R2, and registered as a BrandAsset so the user can review it in /admin/brand-assets. Use category=\"logo\" for logos, \"marketing\" for social posts, \"product_image\" for product mockups. Default model fal-ai/flux/dev is a strong all-purpose choice; switch to fal-ai/recraft-v3 when you specifically need text/typography or vector-style logos. ALWAYS describe colors, style, composition, and mood in the prompt — short prompts produce generic output.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Detailed generation prompt. Include style, subject, composition, colors, mood. Min 5 chars; longer is better."
        },
        model: {
          type: "string",
          enum: [
            "fal-ai/flux/dev",
            "fal-ai/flux/schnell",
            "fal-ai/flux-pro",
            "fal-ai/flux-pro/v1.1-ultra",
            "fal-ai/recraft-v3",
            "fal-ai/recraft-20b",
            "fal-ai/ideogram/v2",
            "fal-ai/stable-diffusion-v35-large"
          ],
          description:
            "Which image model. flux/dev = balanced. flux-pro/v1.1-ultra = premium. recraft-v3 = best for text + vector-feel logos. ideogram/v2 = typography-heavy designs."
        },
        image_size: {
          type: "string",
          description:
            "Size preset: square_hd (1024x1024 — logos, profile photos), landscape_16_9 (banners), portrait_16_9 (stories), portrait_4_3, landscape_4_3. Default square_hd."
        },
        num_images: {
          type: "number",
          description: "1–4 images in one call. Default 1."
        },
        seed: {
          type: "number",
          description: "Optional seed for reproducible variations."
        },
        category: {
          type: "string",
          enum: [
            "logo",
            "brand_guide",
            "product_image",
            "marketing",
            "document",
            "general"
          ],
          description: "BrandAsset category. Default general."
        },
        description: {
          type: "string",
          description:
            "Short description saved on the BrandAsset row so you + future agents know what this is for."
        }
      },
      required: ["prompt"]
    }
  }
};

const GENERATE_VIDEO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "generate_video",
    description:
      "Generate a short video clip (B-roll, product reveal, brand loop, social ad) via fal.ai. Result is persisted to Cloudflare R2 and registered as a BrandAsset. Videos take 60–180s to render — the tool polls and waits up to 3 minutes. If it times out, use fal_check_generation with the returned request_id. Default model fal-ai/kling-video/v1.6/standard/text-to-video is a solid text-to-video baseline; use image-to-video variants when you already have a still to animate.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Describe the scene, motion, camera movement, and mood. Kling and Luma reward cinematic descriptions."
        },
        model: {
          type: "string",
          enum: [
            "fal-ai/kling-video/v1.6/standard/text-to-video",
            "fal-ai/kling-video/v1.6/pro/image-to-video",
            "fal-ai/luma-dream-machine",
            "fal-ai/ltx-video",
            "fal-ai/minimax-video-01",
            "fal-ai/runway-gen3/turbo/image-to-video"
          ],
          description:
            "Which video model. Kling = default. Luma = cinematic. LTX = fastest + cheapest. Runway + Kling image-to-video need image_url."
        },
        image_url: {
          type: "string",
          description:
            "Public URL of a still image to animate (required for image-to-video models). Get one from list_brand_assets or generate_image first."
        },
        duration: {
          type: "number",
          description: "Clip length in seconds (typically 5 or 10). Default 5."
        },
        aspect_ratio: {
          type: "string",
          enum: ["9:16", "1:1", "16:9", "4:5"],
          description: "Default 9:16 for shorts."
        },
        category: {
          type: "string",
          enum: [
            "logo",
            "brand_guide",
            "product_image",
            "marketing",
            "document",
            "general"
          ],
          description: "BrandAsset category. Default marketing."
        },
        description: {
          type: "string",
          description: "Short description saved on the BrandAsset row."
        }
      },
      required: ["prompt"]
    }
  }
};

const FAL_CHECK_GENERATION_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "fal_check_generation",
    description:
      "Poll a previously-submitted fal.ai generation job. Use when generate_image or generate_video returned a request_id instead of a final URL (the job took longer than the tool's inline wait). Once the job is COMPLETED, this fetches the result, persists it to R2, and creates the BrandAsset row — same end state as a direct call.",
    parameters: {
      type: "object",
      properties: {
        request_id: {
          type: "string",
          description: "Request id returned from the original generate_* call."
        },
        model: {
          type: "string",
          description: "The same model id passed to the original call."
        },
        category: {
          type: "string",
          enum: [
            "logo",
            "brand_guide",
            "product_image",
            "marketing",
            "document",
            "general"
          ],
          description: "BrandAsset category on save."
        },
        description: {
          type: "string",
          description: "Short description on the BrandAsset row."
        },
        prompt: {
          type: "string",
          description: "Original prompt — stored on the BrandAsset metadata for later reference."
        }
      },
      required: ["request_id", "model"]
    }
  }
};

// ── Production pipeline — R2 upload, ElevenLabs, JSON2Video, YouTube ─
//
// These tools turn the Faceless YouTube Empire template (and any other
// "produce a video end-to-end" workflow) from aspirational into real.
// Every tool lands finished assets in R2 (so the user's creator CDN is
// the source of truth) and writes a BrandAsset row where appropriate
// so /admin/brand-assets stays in sync.

const UPLOAD_TO_R2_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "upload_to_r2",
    description:
      "Land an external URL (or a small base64 payload) directly in Cloudflare R2 so you have a stable public URL. Use this when a 3rd-party tool hands you a short-lived download URL (fal.ai CDN, JSON2Video output, a Pexels mp4, an ElevenLabs buffer) and you need the asset to persist in the user's own storage before passing it to youtube_upload_video, assemble_video, or any long-running flow. Creates a BrandAsset row automatically so the file shows up in /admin/brand-assets. Prefer `source_url` for anything > 5 MB. `base64` has a ~25 MB ceiling to protect the server.",
    parameters: {
      type: "object",
      properties: {
        source_url: {
          type: "string",
          description:
            "Public URL to fetch and store. Either this OR base64 must be provided."
        },
        base64: {
          type: "string",
          description:
            "Raw base64 payload (without data: prefix). Either this OR source_url must be provided."
        },
        filename: {
          type: "string",
          description:
            "Filename to store as (e.g. 'episode-001-voiceover.mp3'). Extension is used to infer content type when not provided."
        },
        content_type: {
          type: "string",
          description:
            "MIME type to store. Inferred from filename when omitted."
        },
        folder: {
          type: "string",
          description:
            "Folder inside the bucket (e.g. 'voiceover', 'final-cut', 'thumbnails'). Default 'uploads'."
        },
        category: {
          type: "string",
          enum: [
            "logo",
            "brand_guide",
            "product_image",
            "marketing",
            "document",
            "general"
          ],
          description: "BrandAsset category on save. Default 'general'."
        },
        description: {
          type: "string",
          description: "Short description on the BrandAsset row."
        }
      },
      required: ["filename"]
    }
  }
};

// ── ElevenLabs — voiceover generation + voice discovery ──────────

const ELEVENLABS_LIST_VOICES_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "list_elevenlabs_voices",
    description:
      "List the voices available on the connected ElevenLabs account — both the prebuilt voice library and any custom-cloned voices the user has created. Use this BEFORE generate_voiceover if the user hasn't already set a default_voice_id on the integration, or when they ask you to pick a voice that matches a specific description (warm male, gravelly documentary, etc.). Returns voice_id, name, category, and sample labels.",
    parameters: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description:
            "Optional free-text filter (case-insensitive) on voice name or description."
        }
      },
      required: []
    }
  }
};

const GENERATE_VOICEOVER_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "generate_voiceover",
    description:
      "Synthesize a voiceover from a script using ElevenLabs TTS. Stores the resulting mp3 in R2 and creates a BrandAsset row (fileType='audio', category='general'). Returns brandAssetId, publicUrl, characterCount, and approximate cost in USD. HARD RULES: (1) only call AFTER the script has cleared the human HITL approval gate — do not generate voiceover on unapproved scripts; (2) use ONE consistent voice per channel — pass the channel's custom-cloned voice_id or omit to use the integration's default_voice_id. ~$0.10–$0.12 per 1K chars on v2/v3; a 10-minute voiceover ≈ 9K chars ≈ $0.90–$1.10.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "Script text to voice. Keep under 5000 chars per call — split longer scripts into scene-level chunks for better error recovery."
        },
        voice_id: {
          type: "string",
          description:
            "ElevenLabs voice id. Omit to use the integration's default_voice_id. Call list_elevenlabs_voices first if unsure."
        },
        model_id: {
          type: "string",
          enum: [
            "eleven_multilingual_v2",
            "eleven_multilingual_v3",
            "eleven_flash_v2_5",
            "eleven_turbo_v2_5"
          ],
          description:
            "Default is integration's model_id or eleven_multilingual_v2. Use eleven_flash_v2_5 for drafts ($0.05/1K) and v2/v3 for final cuts."
        },
        stability: {
          type: "number",
          description:
            "0.0–1.0. Lower = more expressive variance, higher = more monotone/consistent. Default 0.5."
        },
        similarity_boost: {
          type: "number",
          description:
            "0.0–1.0. How closely to match the cloned voice's timbre. Default 0.75."
        },
        filename: {
          type: "string",
          description:
            "Optional output filename (e.g. 'ep-003-voiceover.mp3'). Auto-generated from timestamp when omitted."
        }
      },
      required: ["text"]
    }
  }
};

// ── Whisper transcription (uses existing openai integration) ─────

const TRANSCRIBE_AUDIO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "transcribe_audio",
    description:
      "Transcribe an audio file (mp3/wav/m4a) using OpenAI Whisper. Primary use case: the Voice Director's Whisper diff — transcribe a generated voiceover and compare against the source script to catch ElevenLabs mispronunciations of technical terms, named entities, or numbers BEFORE the voiceover ships into video assembly. Also useful for transcribing podcast-style long-form content for repurposing. Requires the `openai` integration (API key).",
    parameters: {
      type: "object",
      properties: {
        audio_url: {
          type: "string",
          description:
            "Public URL to the audio file — typically an R2 URL from generate_voiceover or upload_to_r2."
        },
        language: {
          type: "string",
          description:
            "ISO 639-1 language code (e.g. 'en', 'es'). Omit for auto-detect."
        },
        prompt: {
          type: "string",
          description:
            "Optional context hint — pass the script's technical terms or named entities here so Whisper transcribes them consistently."
        }
      },
      required: ["audio_url"]
    }
  }
};

// ── JSON2Video — timeline assembly ───────────────────────────────

const ASSEMBLE_VIDEO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "assemble_video",
    description:
      "Submit a full JSON2Video timeline (voiceover + B-roll + on-screen text + transitions + music + end card) for rendering. Async — returns a project_id that check_video_assembly polls. When complete, check_video_assembly fetches the finished mp4 into R2 and creates the BrandAsset row automatically. Use this AFTER: generate_voiceover landed in R2, broll_search picked clips, and thumbnail is ready. Feed in the template as a JSON2Video `movie` object — the Assembly Engineer agent knows this schema.",
    parameters: {
      type: "object",
      properties: {
        template: {
          type: "object",
          description:
            "JSON2Video `movie` template (scenes array, elements, transitions, etc.). Pass the full schema — do NOT try to simplify it."
        },
        resolution: {
          type: "string",
          enum: ["sd", "hd", "full-hd"],
          description: "Render resolution. Default full-hd (1080p)."
        },
        quality: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Encode quality. Default high."
        },
        title: {
          type: "string",
          description: "Human-readable title for the render job."
        }
      },
      required: ["template"]
    }
  }
};

const CHECK_VIDEO_ASSEMBLY_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "check_video_assembly",
    description:
      "Poll a JSON2Video render job. Returns status (queued | running | done | error), progress %, and — when done — the public R2 URL + brandAssetId after the finished mp4 is pulled into the user's R2 bucket. Poll every 30-60 seconds after assemble_video.",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "project_id returned from assemble_video."
        },
        category: {
          type: "string",
          enum: [
            "logo",
            "brand_guide",
            "product_image",
            "marketing",
            "document",
            "general"
          ],
          description: "BrandAsset category on save. Default 'marketing'."
        },
        description: {
          type: "string",
          description: "Description stored on the BrandAsset row."
        }
      },
      required: ["project_id"]
    }
  }
};

// ── YouTube Data API v3 — publish + manage ───────────────────────

const YOUTUBE_UPLOAD_VIDEO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "youtube_upload_video",
    description:
      "Upload a finished video to the user's connected YouTube channel via Data API v3 (resumable upload). Costs 1600 quota units — the 10k/day ceiling only allows ~6 uploads/day per channel, so this is a high-stakes call. Always pass an R2 URL (from check_video_assembly or upload_to_r2) — never a third-party CDN URL that might TTL mid-upload. Returns videoId and the upload URL. The video is set to 'private' by default; use youtube_update_video_metadata afterwards to set title/description/tags and schedule the publish time.",
    parameters: {
      type: "object",
      properties: {
        video_url: {
          type: "string",
          description:
            "Public URL to the final mp4 (should be an R2 URL you control)."
        },
        title: {
          type: "string",
          description: "Video title (packaging-approved, 45–55 chars for Browse)."
        },
        description: {
          type: "string",
          description:
            "Video description. Put the core premise in the first 2 lines — that's what shows in search snippets."
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "3–5 essential tags only. YouTube docs say tags play a minimal role in discovery — don't stuff."
        },
        category_id: {
          type: "string",
          description:
            "YouTube category id. Common: '22' People & Blogs, '27' Education, '28' Science & Technology, '24' Entertainment. Default '22'."
        },
        privacy_status: {
          type: "string",
          enum: ["private", "unlisted", "public"],
          description:
            "Initial privacy. Default 'private' so you can verify metadata and thumbnail before going live."
        },
        made_for_kids: {
          type: "boolean",
          description: "Required field. Default false."
        },
        publish_at: {
          type: "string",
          description:
            "ISO 8601 timestamp for scheduled public release. Only meaningful when privacy_status=private."
        }
      },
      required: ["video_url", "title"]
    }
  }
};

const YOUTUBE_UPDATE_VIDEO_METADATA_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "youtube_update_video_metadata",
    description:
      "Update a video's title, description, tags, or category after upload. Costs 50 quota units. Use to refresh metadata on older videos at 30/90 days based on performance, or to fix mistakes post-publish.",
    parameters: {
      type: "object",
      properties: {
        video_id: { type: "string", description: "YouTube video id." },
        title: { type: "string", description: "New title (45–55 chars)." },
        description: {
          type: "string",
          description: "New description (core premise in first 2 lines)."
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Replacement tag list (3–5 essential tags)."
        },
        category_id: {
          type: "string",
          description: "YouTube category id (e.g. '22', '27', '28')."
        },
        privacy_status: {
          type: "string",
          enum: ["private", "unlisted", "public"],
          description: "Change the video's privacy status."
        }
      },
      required: ["video_id"]
    }
  }
};

const YOUTUBE_SET_THUMBNAIL_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "youtube_set_thumbnail",
    description:
      "Set the custom thumbnail on an uploaded video. Costs 50 quota units. Pass an R2 URL (from generate_image or a Thumbnail Designer output). YouTube requires jpg/png, ≤2MB, 1280×720 recommended.",
    parameters: {
      type: "object",
      properties: {
        video_id: { type: "string", description: "YouTube video id." },
        image_url: {
          type: "string",
          description: "Public URL to the thumbnail image (prefer R2)."
        }
      },
      required: ["video_id", "image_url"]
    }
  }
};

const YOUTUBE_LIST_CHANNEL_VIDEOS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "youtube_list_channel_videos",
    description:
      "List recent videos from the connected YouTube channel with view counts, publish dates, and status. Costs ~3 quota units. Use this for weekly audits, comment-reply workflows, or analytics correlation. Returns at most 50 videos per call.",
    parameters: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "1–50. Default 10."
        },
        page_token: {
          type: "string",
          description: "Pagination token from a previous response."
        }
      },
      required: []
    }
  }
};

const YOUTUBE_POST_COMMUNITY_UPDATE_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "youtube_post_community_update",
    description:
      "Post a Community tab update (teaser, poll prompt, contradiction post, playlist handoff). NOTE: YouTube's Community Posts API is currently in limited rollout — this tool will return a 'requires allowlist + 500 subs' error if the channel isn't eligible. In that case, surface the suggested post text to the user for manual posting.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Community post body. Under 2000 chars."
        },
        image_url: {
          type: "string",
          description:
            "Optional image URL to attach (prefer R2). Image-only posts are allowed."
        }
      },
      required: ["text"]
    }
  }
};

// ── YouTube Analytics API — CTR, AVD, returning viewers ──────────

const YOUTUBE_GET_VIDEO_ANALYTICS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "youtube_get_video_analytics",
    description:
      "Pull per-video analytics from the YouTube Analytics API (separate endpoint, same OAuth). The 2026 algorithm's three signal groups: click (impressions, CTR), watch (AVD, APV, session time), and satisfaction (returning viewers). Use this for the 48-hour CTR audit (below 3% = YouTube stops promoting), retention analysis (<30% = algorithmic penalty), and the 20-video checkpoint decision matrix. Pass multiple video_ids to batch a channel audit in one call.",
    parameters: {
      type: "object",
      properties: {
        video_ids: {
          type: "array",
          items: { type: "string" },
          description: "1–50 video ids."
        },
        start_date: {
          type: "string",
          description: "ISO date (YYYY-MM-DD). Default 7 days ago."
        },
        end_date: {
          type: "string",
          description: "ISO date (YYYY-MM-DD). Default today."
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description:
            "Metrics to fetch. Default: views, impressions, impressionsCtr (CTR), averageViewDuration (AVD), averageViewPercentage, subscribersGained."
        }
      },
      required: ["video_ids"]
    }
  }
};

// ── Brand asset query tools (all non-master agents) ──────────────

const LIST_BRAND_ASSETS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "list_brand_assets",
    description:
      "Enumerate brand assets (logos, product images, brand guides, marketing media, documents) the user has uploaded or you previously generated. BEFORE you generate_image or generate_video for anything branded, call this FIRST — if the user already has a logo or brand guide, use it instead of generating a new one. Returns id, fileName, fileType (image/video/document/audio/other), mimeType, category, description, and public url per asset.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "logo",
            "brand_guide",
            "product_image",
            "marketing",
            "document",
            "general"
          ],
          description: "Filter by category. Omit for all."
        },
        fileType: {
          type: "string",
          enum: ["image", "video", "audio", "document", "other"],
          description: "Filter by file type. Omit for all."
        },
        limit: {
          type: "number",
          description: "1–60. Default 20."
        }
      },
      required: []
    }
  }
};

const GET_BRAND_ASSET_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "get_brand_asset",
    description:
      "Fetch full details of one brand asset by id. Use after list_brand_assets when you need the full description, metadata, or exact URL (e.g. to pass to generate_video's image_url). Returns the same shape plus the metadata JSON.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Brand asset id from list_brand_assets."
        }
      },
      required: ["id"]
    }
  }
};

// ── Todos (non-master agents) ────────────────────────────────────

const PROPOSE_TODO_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "propose_todo",
    description:
      "Suggest a todo or idea for the user to consider — LOWER COMMITMENT than delegate_task. Use when: (1) you notice something worth doing but it's the user's call, (2) the user asked you to think but not act, (3) you want to save something for later without running it now. The todo lands in /admin/todos flagged as agent-proposed. The user decides if/when to activate it. Do NOT use propose_todo when the user explicitly asked you to do something — use delegate_task or just do it.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "2–10 word title of the action (or idea)."
        },
        description: {
          type: "string",
          description:
            "Optional longer context — why this matters, what outcome you'd aim for, what you'd need from the user."
        },
        type: {
          type: "string",
          enum: ["todo", "idea"],
          description:
            "\"todo\" for concrete actionable items; \"idea\" for fuzzier brain-dump items that need more shape. Default todo."
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "Default medium."
        },
        suggestedAgentId: {
          type: "string",
          description:
            "Agent id you'd recommend to handle this when the user activates it. Get from list_team."
        },
        dueAt: {
          type: "string",
          description: "ISO-8601 string if time-sensitive, else omit."
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "0–6 short lowercase tags."
        },
        rationale: {
          type: "string",
          description:
            "1–2 sentences on WHY you're suggesting this. Helps the user decide fast."
        }
      },
      required: ["title"]
    }
  }
};

const LIST_TODOS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "list_todos",
    description:
      "Check what's already on the user's todo list before proposing another one. Prevents duplicate suggestions. Returns up to 100 items with status and priority.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["todo", "idea"],
          description: "Filter by type. Omit for both."
        },
        status: {
          type: "string",
          enum: ["captured", "active", "snoozed", "done", "dismissed"],
          description: "Filter by status. Omit for all."
        },
        limit: {
          type: "number",
          description: "1–100. Default 30."
        }
      },
      required: []
    }
  }
};

// ── Knowledge base management (leader-only) ──────────────────────

const LIST_KNOWLEDGE_ITEMS_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "list_knowledge_items",
    description:
      "Audit the business's knowledge base. Returns id, title, category, tier, assignedAgentIds, enabled, and tokenCount for each item. Use this BEFORE proposing tier or assignment changes so you know what actually exists and which items are heaviest. Default limit 50 — items are returned sorted by tier then by tokenCount descending (biggest first).",
    parameters: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["hot", "warm", "cold", "all"],
          description: "Filter by tier. Default all."
        },
        category: {
          type: "string",
          description:
            "Filter by category key (about_business / products_services / pricing / policies / faqs / contacts / brand_voice / processes / custom)."
        },
        enabled: {
          type: "boolean",
          description: "If set, only return items with matching enabled state."
        },
        agentId: {
          type: "string",
          description:
            "Optional — if provided, filter to items that agent would actually see (hot + warm items assigned to that agent or unassigned)."
        },
        limit: {
          type: "number",
          description: "1–200. Default 50."
        }
      },
      required: []
    }
  }
};

const GET_KNOWLEDGE_BUDGET_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "get_knowledge_budget",
    description:
      "Returns the current token budget breakdown for the business's KB: hot/warm/cold totals plus the critical `autoInjected` number — what lands in EVERY agent's prompt each turn. Lowering autoInjected is the primary goal of retiering. Use this before and after update_knowledge_tiering to measure impact and explain the token savings to the user.",
    parameters: { type: "object", properties: {}, required: [] }
  }
};

const UPDATE_KNOWLEDGE_TIERING_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "update_knowledge_tiering",
    description:
      "Bulk-retier and/or reassign knowledge items to optimize token budgets. You MUST explain WHY to the user before calling — which items, what tier change, what token savings, and why each affected agent still has what it needs. Call get_knowledge_budget before and after to show the savings. Never move brand voice or red-line rules to cold — they're needed every turn. Move bulky reference items (playbooks, SOPs, case studies) to cold. Pin role-specific items to the relevant agent only (CMO gets marketing, Ops gets SOPs). Item assignments REPLACE the previous list by default — set replaceAssigned=false to merge instead.",
    parameters: {
      type: "object",
      properties: {
        itemIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Knowledge item ids to update (1–100). Get them from list_knowledge_items."
        },
        tier: {
          type: "string",
          enum: ["hot", "warm", "cold"],
          description: "New tier. Omit to leave tier unchanged."
        },
        assignedAgentIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Agent ids to pin these items to (warm tier only affects loading; hot is always loaded for everyone). Get agent ids from list_team. Omit to leave assignments unchanged. Pass [] to clear and share with all agents."
        },
        replaceAssigned: {
          type: "boolean",
          description:
            "When true (default), replaces the existing assignedAgentIds list. When false, merges new ids with the existing list."
        },
        enabled: {
          type: "boolean",
          description:
            "Enable or disable these items. Disabled items stay stored but aren't loaded at all."
        }
      },
      required: ["itemIds"]
    }
  }
};

// ── Learning & Memory Tools (all agents) ─────────────────────────

const LEARN_FROM_OUTCOME_TOOL: ToolSchema = {
  type: "function",
  function: {
    name: "learn_from_outcome",
    description:
      "Record a learning from a completed task or interaction. Use this after finishing a task, receiving feedback, or observing a result to capture what worked, what didn't, and what to do differently next time. These learnings persist across conversations and make you smarter over time.",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "What task or action was performed"
        },
        outcome: {
          type: "string",
          description: "What was the result — success, failure, partial, or specific metrics"
        },
        what_worked: {
          type: "string",
          description: "What specifically went well and should be repeated"
        },
        what_didnt_work: {
          type: "string",
          description: "What failed or underperformed and should be avoided or changed"
        },
        next_time: {
          type: "string",
          description: "Concrete action to take differently next time this situation arises"
        }
      },
      required: ["task", "outcome"]
    }
  }
};

/**
 * Get built-in tools that are always available (not MCP-dependent).
 * ALL agents get learning tools. Leader agents also get delegation + management tools.
 * Master agents get a restricted communicate-only toolset.
 */
export function getBuiltInTools(agent: {
  type?: string;
  depth?: number;
  /** When provided and equal to "dealhawk_empire", the four Dealhawk
   *  sourcing tools (search_properties / create_deal / score_lead /
   *  skip_trace) are added to every non-master agent's toolset. */
  templateId?: string | null;
}): InstalledTool[] {
  const isMaster = agent.type === "master";
  // Master is not a "leader" in the delegate/create-agent sense — it has its
  // own narrow toolset and must not be given the team-management tools.
  const isLeader =
    !isMaster && (agent.type === "main" || agent.depth === 0);
  const tools: InstalledTool[] = [];

  // Learning tool — available to ALL agents
  tools.push({
    mcpServerId: "__builtin__",
    definitionId: "__learning__",
    serverName: "Continuous Learning",
    schema: LEARN_FROM_OUTCOME_TOOL
  });

  // Outbound Telegram — available to every non-master agent. Business-scoped:
  // the handler looks up the bot token from the business's telegram
  // integration at call time, so the tool being listed here doesn't imply
  // Telegram is actually connected.
  if (!isMaster) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__telegram_outbound__",
      serverName: "Telegram",
      schema: SEND_TELEGRAM_MESSAGE_TOOL
    });
  }

  // Knowledge lookup — on-demand retrieval for warm/cold KB items.
  // Available to every non-master agent so they can pull deeper
  // reference info when the auto-injected KB section isn't enough.
  if (!isMaster) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__knowledge__",
      serverName: "Knowledge",
      schema: KNOWLEDGE_LOOKUP_TOOL
    });
  }

  // Brand assets — query tools so agents can check what the user has
  // already uploaded (logos, brand guides, product images, marketing
  // media) BEFORE generating something new. Available to every
  // non-master agent.
  if (!isMaster) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__brand_assets__",
      serverName: "Brand Assets",
      schema: LIST_BRAND_ASSETS_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__brand_assets__",
      serverName: "Brand Assets",
      schema: GET_BRAND_ASSET_TOOL
    });
  }

  // Todos — propose/list so agents can augment the user's queue
  // without committing to running the work. Lower commitment than
  // delegate_task; visible in /admin/todos flagged as agent-proposed.
  if (!isMaster) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__todos__",
      serverName: "Todos",
      schema: PROPOSE_TODO_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__todos__",
      serverName: "Todos",
      schema: LIST_TODOS_TOOL
    });
  }

  // fal.ai image + video generation. Produces content on demand for
  // logos, banners, product mockups, B-roll, short video ads, etc.
  // Generated files are persisted to R2 and registered as BrandAsset
  // rows so the user can review in /admin/brand-assets.
  if (!isMaster) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__fal_ai__",
      serverName: "fal.ai Images",
      schema: GENERATE_IMAGE_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__fal_ai__",
      serverName: "fal.ai Videos",
      schema: GENERATE_VIDEO_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__fal_ai__",
      serverName: "fal.ai Queue",
      schema: FAL_CHECK_GENERATION_TOOL
    });
  }

  // Outreach discovery — read-only search + draft logging across every
  // supported platform. Posting stays manual (via /admin/targets) for
  // brand safety on every platform. Available to every non-master agent.
  if (!isMaster) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Reddit",
      schema: REDDIT_SEARCH_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Reddit",
      schema: REDDIT_THREAD_SCAN_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Reddit",
      schema: REDDIT_GET_USER_POSTS_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Reddit",
      schema: VERIFY_REDDIT_POST_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Hacker News",
      schema: HN_SEARCH_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Hacker News",
      schema: HN_THREAD_SCAN_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Stack Overflow",
      schema: STACKOVERFLOW_SEARCH_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "GitHub",
      schema: GITHUB_SEARCH_ISSUES_TOOL
    });
    // Both loggers are exposed: log_outreach_target is the preferred one
    // going forward, log_reddit_target stays for back-compat with agents
    // already prompted to call it.
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Outreach",
      schema: LOG_OUTREACH_TARGET_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__outreach__",
      serverName: "Reddit",
      schema: LOG_REDDIT_TARGET_TOOL
    });

    // Video transcript + clip mining — every non-master agent can read a
    // YouTube video and queue short-form clip suggestions for review.
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "Video",
      schema: FETCH_VIDEO_TRANSCRIPT_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "Video",
      schema: LOG_VIDEO_CLIP_TOOL
    });

    // B-Roll + scene assembly
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "B-Roll",
      schema: BROLL_SEARCH_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "B-Roll",
      schema: LOG_BROLL_SCENE_TOOL
    });

    // Auto-clip (Klap / Opus Clip)
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "Auto-Clip",
      schema: AUTO_CLIP_SUBMIT_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "Auto-Clip",
      schema: AUTO_CLIP_CHECK_TOOL
    });

    // HeyGen — AI avatar talking-head video generation
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "HeyGen",
      schema: HEYGEN_LIST_AVATARS_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "HeyGen",
      schema: HEYGEN_GENERATE_VIDEO_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "HeyGen",
      schema: HEYGEN_CHECK_VIDEO_TOOL
    });

    // Creatify — high-volume UGC avatar video generation
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "Creatify",
      schema: CREATIFY_LIST_AVATARS_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "Creatify",
      schema: CREATIFY_GENERATE_UGC_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__video__",
      serverName: "Creatify",
      schema: CREATIFY_CHECK_UGC_TOOL
    });

    // R2 upload — land any external URL or small base64 payload in the
    // user's Cloudflare R2 bucket so we have a stable public URL to pass
    // to other tools (youtube_upload_video, assemble_video, etc.).
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__storage__",
      serverName: "R2 Storage",
      schema: UPLOAD_TO_R2_TOOL
    });

    // ElevenLabs — voiceover generation + voice discovery.
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__elevenlabs__",
      serverName: "ElevenLabs",
      schema: ELEVENLABS_LIST_VOICES_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__elevenlabs__",
      serverName: "ElevenLabs",
      schema: GENERATE_VOICEOVER_TOOL
    });

    // Whisper transcription (uses existing openai integration).
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__whisper__",
      serverName: "OpenAI Whisper",
      schema: TRANSCRIBE_AUDIO_TOOL
    });

    // JSON2Video — timeline assembly.
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__json2video__",
      serverName: "JSON2Video",
      schema: ASSEMBLE_VIDEO_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__json2video__",
      serverName: "JSON2Video",
      schema: CHECK_VIDEO_ASSEMBLY_TOOL
    });

    // YouTube Data API v3 — publish, metadata, thumbnail, list, community.
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__youtube__",
      serverName: "YouTube",
      schema: YOUTUBE_UPLOAD_VIDEO_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__youtube__",
      serverName: "YouTube",
      schema: YOUTUBE_UPDATE_VIDEO_METADATA_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__youtube__",
      serverName: "YouTube",
      schema: YOUTUBE_SET_THUMBNAIL_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__youtube__",
      serverName: "YouTube",
      schema: YOUTUBE_LIST_CHANNEL_VIDEOS_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__youtube__",
      serverName: "YouTube",
      schema: YOUTUBE_POST_COMMUNITY_UPDATE_TOOL
    });

    // YouTube Analytics API — CTR, AVD, returning viewers.
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__youtube_analytics__",
      serverName: "YouTube Analytics",
      schema: YOUTUBE_GET_VIDEO_ANALYTICS_TOOL
    });
  }

  if (isMaster) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__master_agent__",
      serverName: "Master Agent",
      schema: LIST_BUSINESSES_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__master_agent__",
      serverName: "Master Agent",
      schema: ASK_CEO_AGENT_TOOL
    });
    return tools;
  }

  if (isLeader) {
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__delegation__",
      serverName: "Team Management",
      schema: DELEGATE_TASK_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__delegation__",
      serverName: "Team Management",
      schema: LIST_TEAM_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__delegation__",
      serverName: "Team Management",
      schema: CHECK_TASK_STATUS_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__agent_management__",
      serverName: "Agent Management",
      schema: SUGGEST_AGENT_CONFIG_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__agent_management__",
      serverName: "Agent Management",
      schema: CREATE_AGENT_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__agent_management__",
      serverName: "Agent Management",
      schema: EDIT_AGENT_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__agent_management__",
      serverName: "Agent Management",
      schema: CONFIRM_CREATE_AGENT_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__agent_management__",
      serverName: "Agent Management",
      schema: CONFIRM_EDIT_AGENT_TOOL
    });

    // Knowledge-base management — leaders can audit and retier the KB
    // for token-budget optimization. Non-leader agents can't reshape
    // the whole business's knowledge; they can only read (via
    // knowledge_lookup) and use what's loaded into their own prompt.
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__knowledge_management__",
      serverName: "Knowledge Management",
      schema: LIST_KNOWLEDGE_ITEMS_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__knowledge_management__",
      serverName: "Knowledge Management",
      schema: GET_KNOWLEDGE_BUDGET_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__knowledge_management__",
      serverName: "Knowledge Management",
      schema: UPDATE_KNOWLEDGE_TIERING_TOOL
    });
  }

  // Dealhawk Empire — sourcing tools. Available to every non-master agent
  // when the business was materialized from the dealhawk_empire template.
  // Demo provider always works zero-config; BatchData provider activates
  // when BATCHDATA_API_KEY (env or Business.currentIntegrations) is set.
  if (!isMaster && agent.templateId === "dealhawk_empire") {
    // Sourcing tools (Phase 2c).
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__dealhawk__",
      serverName: "Dealhawk",
      schema: DEALHAWK_SEARCH_PROPERTIES_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__dealhawk__",
      serverName: "Dealhawk",
      schema: DEALHAWK_CREATE_DEAL_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__dealhawk__",
      serverName: "Dealhawk",
      schema: DEALHAWK_SCORE_LEAD_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__dealhawk__",
      serverName: "Dealhawk",
      schema: DEALHAWK_SKIP_TRACE_TOOL
    });
    // Underwriting tools (Phase 3).
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__dealhawk__",
      serverName: "Dealhawk",
      schema: DEALHAWK_COMPUTE_MAO_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__dealhawk__",
      serverName: "Dealhawk",
      schema: DEALHAWK_QUALIFY_SUB_TO_TOOL
    });
    tools.push({
      mcpServerId: "__builtin__",
      definitionId: "__dealhawk__",
      serverName: "Dealhawk",
      schema: DEALHAWK_UPDATE_DEAL_TOOL
    });
  }

  return tools;
}

/**
 * Convert InstalledTool schemas to the format expected by OpenAI/OpenRouter API.
 */
export function toOpenAITools(tools: InstalledTool[]): ToolSchema[] {
  return tools.map((t) => t.schema);
}

/**
 * Convert InstalledTool schemas to the format expected by Anthropic API.
 */
export function toAnthropicTools(
  tools: InstalledTool[]
): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return tools.map((t) => ({
    name: t.schema.function.name,
    description: t.schema.function.description,
    input_schema: t.schema.function.parameters
  }));
}
