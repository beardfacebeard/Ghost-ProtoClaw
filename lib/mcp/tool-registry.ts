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
