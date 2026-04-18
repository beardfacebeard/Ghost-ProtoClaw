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
        description: "Search Reddit for posts and discussions on a topic.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            subreddit: { type: "string", description: "Specific subreddit to search in (optional)" },
            sort: { type: "string", description: "Sort order", enum: ["relevance", "hot", "new", "top"] },
            limit: { type: "number", description: "Number of results (default: 10)" }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "reddit_post",
        description: "Submit a new post to a subreddit.",
        parameters: {
          type: "object",
          properties: {
            subreddit: { type: "string", description: "Target subreddit (without r/ prefix)" },
            title: { type: "string", description: "Post title" },
            content: { type: "string", description: "Post body text" },
            type: { type: "string", description: "Post type", enum: ["text", "link"] },
            url: { type: "string", description: "URL for link posts" }
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
      "Delegate a task to another agent on your team. Use this when a task falls outside your expertise or when you want to assign work to a specialist. The task will be sent to the specified agent and they will work on it.",
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
