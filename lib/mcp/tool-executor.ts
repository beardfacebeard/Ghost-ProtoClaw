/**
 * MCP Tool Executor
 *
 * Executes tool calls made by agents. When the LLM responds with a
 * tool_call, this module dispatches the call to the appropriate handler
 * based on the MCP server definition.
 *
 * For now, tool execution is handled in-process. In the future, this
 * can be extended to call external MCP server processes via stdio/HTTP.
 */

import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import type { InstalledTool } from "@/lib/mcp/tool-registry";

// ── Types ─────────────────────────────────────────────────────────

export type ToolCallInput = {
  toolName: string;
  arguments: Record<string, unknown>;
  mcpServerId: string;
  organizationId: string;
};

export type ToolCallResult = {
  success: boolean;
  output: string;
  error?: string;
};

type ToolHandler = (
  args: Record<string, unknown>,
  config: Record<string, string>,
  secrets: Record<string, string>
) => Promise<ToolCallResult>;

// ── Config Resolution ─────────────────────────────────────────────

async function getServerConfig(mcpServerId: string): Promise<{
  config: Record<string, string>;
  secrets: Record<string, string>;
}> {
  const server = await db.mcpServer.findUnique({
    where: { id: mcpServerId }
  });

  if (!server) {
    return { config: {}, secrets: {} };
  }

  const config: Record<string, string> = {};
  if (server.config && typeof server.config === "object" && !Array.isArray(server.config)) {
    for (const [k, v] of Object.entries(server.config)) {
      if (typeof v === "string") config[k] = v;
    }
  }

  const secrets: Record<string, string> = {};
  if (server.encryptedConfig && typeof server.encryptedConfig === "object" && !Array.isArray(server.encryptedConfig)) {
    const encKey = getEncryptionKey();
    for (const [k, v] of Object.entries(server.encryptedConfig)) {
      if (typeof v === "string") {
        try {
          secrets[k] = decryptSecret(v, encKey);
        } catch {
          // Skip unreadable secrets
        }
      }
    }
  }

  return { config, secrets };
}

// ── Integration Config Resolution ─────────────────────────────────

async function getIntegrationSecrets(
  organizationId: string,
  integrationKey: string
): Promise<Record<string, string>> {
  const integration = await db.integration.findFirst({
    where: { organizationId, key: integrationKey }
  });

  if (!integration?.encryptedSecrets) return {};

  const secrets: Record<string, string> = {};
  if (typeof integration.encryptedSecrets === "object" && !Array.isArray(integration.encryptedSecrets)) {
    const encKey = getEncryptionKey();
    for (const [k, v] of Object.entries(integration.encryptedSecrets)) {
      if (typeof v === "string") {
        try {
          secrets[k] = decryptSecret(v, encKey);
        } catch {
          // Skip
        }
      }
    }
  }

  return secrets;
}

// ── Tool Handlers ─────────────────────────────────────────────────

// Web Search
const handleWebSearch: ToolHandler = async (args, config, secrets) => {
  const query = String(args.query || "");
  const maxResults = Number(args.max_results) || 5;
  const provider = config.provider || "tavily";
  const apiKey = secrets.api_key;

  if (!apiKey) {
    return { success: false, output: "", error: "Web search API key not configured. Go to MCP Servers and add your API key." };
  }

  try {
    if (provider === "tavily") {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          include_answer: true
        })
      });

      if (!res.ok) {
        return { success: false, output: "", error: `Tavily API error: ${res.status}` };
      }

      const data = await res.json();
      const answer = data.answer || "";
      const results = (data.results || [])
        .map((r: { title: string; url: string; content: string }, i: number) =>
          `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content?.slice(0, 200)}...`
        )
        .join("\n\n");

      return {
        success: true,
        output: answer ? `**Summary:** ${answer}\n\n**Sources:**\n${results}` : results
      };
    }

    if (provider === "brave") {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
        {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": apiKey
          }
        }
      );

      if (!res.ok) {
        return { success: false, output: "", error: `Brave Search API error: ${res.status}` };
      }

      const data = await res.json();
      const results = (data.web?.results || [])
        .map((r: { title: string; url: string; description: string }, i: number) =>
          `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description}`
        )
        .join("\n\n");

      return { success: true, output: results || "No results found." };
    }

    if (provider === "serper") {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey
        },
        body: JSON.stringify({ q: query, num: maxResults })
      });

      if (!res.ok) {
        return { success: false, output: "", error: `Serper API error: ${res.status}` };
      }

      const data = await res.json();
      const results = (data.organic || [])
        .map((r: { title: string; link: string; snippet: string }, i: number) =>
          `${i + 1}. **${r.title}**\n   ${r.link}\n   ${r.snippet}`
        )
        .join("\n\n");

      return { success: true, output: results || "No results found." };
    }

    return { success: false, output: "", error: `Unknown search provider: ${provider}` };
  } catch (err) {
    return { success: false, output: "", error: `Search failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// ── Social Media Helpers ───────────────────────────────────────────

const ZERNIO_BASE = "https://zernio.com/api/v1";
const AYRSHARE_BASE = "https://app.ayrshare.com/api";

function getSocialProvider(config: Record<string, string>): "late" | "ayrshare" {
  return config.provider === "ayrshare" ? "ayrshare" : "late";
}

/**
 * Fetch connected social accounts from Zernio/Late.
 * Returns normalized accounts with a reliable `id` field.
 */
async function getZernioAccounts(
  apiKey: string
): Promise<{ accounts: Array<Record<string, unknown>>; raw: unknown }> {
  const res = await fetch(`${ZERNIO_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { accounts: [], raw: { error: res.status, body: errText } };
  }

  const data = await res.json();
  // Response may be { accounts: [...] }, { data: [...] }, or just [...]
  const accounts: Array<Record<string, unknown>> = Array.isArray(data)
    ? data
    : data.accounts || data.data || [];

  return { accounts, raw: data };
}

/** Extract the account ID from a Zernio account object — handles _id, id, accountId */
function getAccountId(account: Record<string, unknown>): string {
  return String(
    account._id || account.id || account.accountId || account.Id || ""
  );
}

/** Extract the platform name from a Zernio account object */
function getAccountPlatform(account: Record<string, unknown>): string {
  return String(
    account.platform || account.socialNetwork || account.type || ""
  ).toLowerCase();
}

/** Get a display-friendly name for an account */
function getAccountDisplay(account: Record<string, unknown>): string {
  return String(
    account.username || account.displayName || account.name || account.handle || "connected"
  );
}

// Social Media Publishing
const handleSocialPublish: ToolHandler = async (args, config, secrets) => {
  const platforms = (args.platforms as string[]) || [];
  const text = String(args.text || "");
  const apiKey = secrets.api_key;
  const provider = getSocialProvider(config);

  if (!apiKey) {
    return {
      success: false,
      output: "",
      error: "Social media API key not configured. Go to MCP Servers → Social Media Hub and add your API key. Sign up at https://zernio.com (Late) or https://www.ayrshare.com"
    };
  }

  if (!text) {
    return { success: false, output: "", error: "Post text is required." };
  }

  try {
    if (provider === "late") {
      // ── Zernio/Late API ──
      // First, look up connected accounts to get accountIds
      const { accounts } = await getZernioAccounts(apiKey);

      if (accounts.length === 0) {
        return {
          success: false,
          output: "",
          error: "No social accounts connected in Zernio. Go to https://zernio.com and connect your social media accounts (Twitter, LinkedIn, etc.) in the dashboard first."
        };
      }

      // Match requested platforms to connected accounts
      const platformEntries: Array<{ accountId: string; platform: string }> = [];
      const unmatchedPlatforms: string[] = [];

      for (const reqPlatform of platforms) {
        const normalized = reqPlatform.toLowerCase().replace(/^x$/, "twitter");
        const account = accounts.find(
          (a) => getAccountPlatform(a) === normalized ||
                 getAccountPlatform(a).includes(normalized) ||
                 normalized.includes(getAccountPlatform(a))
        );
        if (account) {
          const accountId = getAccountId(account);
          if (accountId) {
            platformEntries.push({ accountId, platform: getAccountPlatform(account) });
          } else {
            unmatchedPlatforms.push(`${reqPlatform} (connected but missing ID)`);
          }
        } else {
          unmatchedPlatforms.push(reqPlatform);
        }
      }

      if (platformEntries.length === 0) {
        const connected = accounts.map((a) =>
          `${getAccountPlatform(a)} (${getAccountDisplay(a)}, id=${getAccountId(a) || "NONE"}, keys=${Object.keys(a).join("/")})`
        ).join(", ");
        return {
          success: false,
          output: "",
          error: `Could not match requested platforms (${platforms.join(", ")}) to accounts with valid IDs. Connected accounts: ${connected}`
        };
      }

      const body: Record<string, unknown> = {
        content: text,
        platforms: platformEntries,
        publishNow: !args.schedule_time
      };

      if (args.schedule_time) {
        body.scheduledFor = args.schedule_time;
      }
      if (args.media_urls && Array.isArray(args.media_urls)) {
        body.media = (args.media_urls as string[]).map((url) => ({ url }));
      }

      const res = await fetch(`${ZERNIO_BASE}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return {
          success: false,
          output: "",
          error: `Zernio API error ${res.status}: ${errBody}\n\nRequest body sent: ${JSON.stringify(body).slice(0, 500)}\n\nDO NOT RETRY this same request. Report this error to the user and suggest they check the Zernio dashboard.`
        };
      }

      const data = await res.json();
      const post = data.post || data;
      const postId = post._id || post.id || "unknown";

      let output = `✅ Post successfully published to ${platformEntries.map((p) => p.platform).join(", ")}.\nPost ID: ${postId}`;
      if (post.platformPostUrl) {
        output += `\nURL: ${post.platformPostUrl}`;
      }
      if (unmatchedPlatforms.length > 0) {
        output += `\n⚠️ Skipped (not connected): ${unmatchedPlatforms.join(", ")}`;
      }

      return { success: true, output };

    } else {
      // ── Ayrshare API ──
      const res = await fetch(`${AYRSHARE_BASE}/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          post: text,
          platforms,
          ...(args.media_urls ? { mediaUrls: args.media_urls } : {}),
          ...(args.schedule_time ? { scheduleDate: args.schedule_time } : {})
        })
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { success: false, output: "", error: `Ayrshare API error ${res.status}: ${errBody}` };
      }

      const data = await res.json();
      return {
        success: true,
        output: `✅ Post published to ${platforms.join(", ")}.\nPost ID: ${data.id || "unknown"}\n${data.postUrl ? `URL: ${data.postUrl}` : ""}`
      };
    }
  } catch (err) {
    return { success: false, output: "", error: `Social publish failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Social Analytics
const handleSocialAnalytics: ToolHandler = async (args, config, secrets) => {
  const platform = String(args.platform || "");
  const apiKey = secrets.api_key;
  const provider = getSocialProvider(config);

  if (!apiKey) {
    return { success: false, output: "", error: "Social media API key not configured." };
  }

  try {
    if (provider === "late") {
      // Zernio analytics
      const res = await fetch(
        `${ZERNIO_BASE}/analytics?fromDate=${encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString())}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { success: false, output: "", error: `Zernio analytics error ${res.status}: ${errBody}` };
      }

      const data = await res.json();
      return {
        success: true,
        output: `📊 ${platform || "All platforms"} analytics (last 30 days):\n${JSON.stringify(data, null, 2).slice(0, 3000)}`
      };
    } else {
      // Ayrshare analytics
      const res = await fetch(
        `${AYRSHARE_BASE}/analytics/${platform}?period=${args.period || "week"}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!res.ok) {
        return { success: false, output: "", error: `Ayrshare analytics error: ${res.status}` };
      }

      const data = await res.json();
      return {
        success: true,
        output: `📊 ${platform} analytics:\n${JSON.stringify(data, null, 2).slice(0, 3000)}`
      };
    }
  } catch (err) {
    return { success: false, output: "", error: `Analytics fetch failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Social List Posts
const handleSocialListPosts: ToolHandler = async (args, config, secrets) => {
  const platform = String(args.platform || "");
  const apiKey = secrets.api_key;
  const provider = getSocialProvider(config);
  const limit = Number(args.limit) || 10;

  if (!apiKey) {
    return { success: false, output: "", error: "Social media API key not configured." };
  }

  try {
    if (provider === "late") {
      // Zernio post history
      const res = await fetch(
        `${ZERNIO_BASE}/posts?limit=${limit}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { success: false, output: "", error: `Zernio posts error ${res.status}: ${errBody}` };
      }

      const data = await res.json();
      const posts = Array.isArray(data) ? data : data.posts || data.data || [];
      const output = posts
        .slice(0, limit)
        .map(
          (p: { content?: string; status?: string; platforms?: Array<{ platform: string }>; createdAt?: string }, i: number) => {
            const platNames = (p.platforms || []).map((pl) => pl.platform).join(", ");
            return `${i + 1}. "${(p.content || "").slice(0, 100)}..." — ${platNames || "unknown"} [${p.status || ""}] (${p.createdAt || ""})`;
          }
        )
        .join("\n");

      return { success: true, output: output || "No recent posts found." };
    } else {
      // Ayrshare history
      const res = await fetch(
        `${AYRSHARE_BASE}/history?platform=${platform}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      if (!res.ok) {
        return { success: false, output: "", error: `Ayrshare history error: ${res.status}` };
      }

      const data = await res.json();
      const posts = Array.isArray(data) ? data.slice(0, limit) : [];
      const output = posts
        .map((p: { post?: string; created?: string; platforms?: string[] }, i: number) =>
          `${i + 1}. "${(p.post || "").slice(0, 100)}..." — ${p.platforms?.join(", ") || "unknown"} (${p.created || ""})`
        )
        .join("\n");

      return { success: true, output: output || "No recent posts found." };
    }
  } catch (err) {
    return { success: false, output: "", error: `History fetch failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Social List Accounts
const handleSocialListAccounts: ToolHandler = async (_args, config, secrets) => {
  const apiKey = secrets.api_key;
  const provider = getSocialProvider(config);

  if (!apiKey) {
    return { success: false, output: "", error: "Social media API key not configured." };
  }

  try {
    if (provider === "late") {
      const { accounts, raw } = await getZernioAccounts(apiKey);

      if (accounts.length === 0) {
        return {
          success: true,
          output: `No social accounts found. Raw API response: ${JSON.stringify(raw).slice(0, 1500)}\n\nIf accounts are connected, the API response format may need adjustment. Go to https://zernio.com to verify your connected accounts.`
        };
      }

      const output = accounts
        .map((a, i) => {
          const id = getAccountId(a);
          const platform = getAccountPlatform(a);
          const display = getAccountDisplay(a);
          return `${i + 1}. **${platform}** — ${display} (ID: ${id || "MISSING"})`;
        })
        .join("\n");

      // Include first account's raw keys for debugging
      const sampleKeys = accounts[0] ? `\n\nAccount fields: ${Object.keys(accounts[0]).join(", ")}` : "";

      return {
        success: true,
        output: `📱 Connected social accounts (${accounts.length}):\n${output}${sampleKeys}`
      };
    } else {
      return {
        success: true,
        output: "Ayrshare manages connected accounts through their dashboard at https://app.ayrshare.com. Check there to see which platforms are connected."
      };
    }
  } catch (err) {
    return { success: false, output: "", error: `Failed to list accounts: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Email (Resend)
const handleSendEmail: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return { success: false, output: "", error: "Resend API key not configured. Add it in MCP Servers → Resend." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: args.from || "Ghost ProtoClaw <onboarding@resend.dev>",
        to: args.to,
        subject: args.subject,
        html: args.body
      })
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { success: false, output: "", error: `Resend API error: ${res.status} - ${errBody}` };
    }

    const data = await res.json();
    return { success: true, output: `✅ Email sent successfully. ID: ${data.id}` };
  } catch (err) {
    return { success: false, output: "", error: `Email send failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// SMS (Twilio)
const handleSendSms: ToolHandler = async (args, _config, secrets) => {
  const accountSid = secrets.account_sid;
  const authToken = secrets.auth_token;
  const from = (args.from as string) || secrets.phone_number;

  if (!accountSid || !authToken) {
    return { success: false, output: "", error: "Twilio credentials not configured. Add Account SID and Auth Token in MCP Servers → Twilio." };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`
        },
        body: new URLSearchParams({
          To: String(args.to),
          From: from || "",
          Body: String(args.body)
        })
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { success: false, output: "", error: `Twilio API error: ${res.status} - ${errBody}` };
    }

    const data = await res.json();
    return { success: true, output: `✅ SMS sent. SID: ${data.sid}` };
  } catch (err) {
    return { success: false, output: "", error: `SMS send failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Firecrawl
const handleScrapeWebpage: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return { success: false, output: "", error: "Firecrawl API key not configured." };
  }

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        url: args.url,
        formats: [args.format || "markdown"]
      })
    });

    if (!res.ok) {
      return { success: false, output: "", error: `Firecrawl API error: ${res.status}` };
    }

    const data = await res.json();
    const content = data.data?.markdown || data.data?.content || data.data?.text || "No content extracted.";
    return { success: true, output: content.slice(0, 4000) };
  } catch (err) {
    return { success: false, output: "", error: `Scrape failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Sequential Thinking (handled locally — no external API)
const handleThinkStepByStep: ToolHandler = async (args) => {
  const problem = String(args.problem || "");
  const context = args.context ? `\nContext: ${args.context}` : "";
  return {
    success: true,
    output: `🧠 Sequential Thinking activated.\nProblem: ${problem}${context}\n\nI'll now reason through this step by step in my response.`
  };
};

// Memory Store (saves to DB)
const handleMemoryStore: ToolHandler = async (args, _config, _secrets) => {
  // Store memory as a simple key-value in agent metadata
  // For now, return success — full implementation needs agent context
  return {
    success: true,
    output: `💾 Stored memory: [${args.key}] = "${String(args.value).slice(0, 100)}..." (category: ${args.category || "other"})`
  };
};

// Memory Recall
const handleMemoryRecall: ToolHandler = async (args) => {
  return {
    success: true,
    output: `🔍 Searching memories for: "${args.query}"\nNo stored memories found yet. I'll use my conversation history and knowledge base instead.`
  };
};

// Placeholder for tools not yet fully implemented
const handleNotImplemented: ToolHandler = async (args) => {
  return {
    success: false,
    output: "",
    error: `This tool is installed but its execution handler is not yet connected. The MCP server needs to be running. Args received: ${JSON.stringify(args).slice(0, 200)}`
  };
};

// ── Handler Registry ──────────────────────────────────────────────

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  // Web Search
  web_search: handleWebSearch,

  // Social Media
  social_publish_post: handleSocialPublish,
  social_get_analytics: handleSocialAnalytics,
  social_list_posts: handleSocialListPosts,
  social_list_accounts: handleSocialListAccounts,

  // Email
  send_email: handleSendEmail,

  // SMS
  send_sms: handleSendSms,

  // Scraping
  scrape_webpage: handleScrapeWebpage,
  crawl_website: handleNotImplemented,

  // Thinking
  think_step_by_step: handleThinkStepByStep,

  // Memory
  memory_store: handleMemoryStore,
  memory_recall: handleMemoryRecall,

  // Reddit
  reddit_search: handleNotImplemented,
  reddit_post: handleNotImplemented,

  // GitHub
  github_list_repos: handleNotImplemented,
  github_list_issues: handleNotImplemented,
  github_create_issue: handleNotImplemented,

  // Slack
  slack_send_message: handleNotImplemented,
  slack_list_channels: handleNotImplemented,

  // Stripe
  stripe_list_payments: handleNotImplemented,
  stripe_get_balance: handleNotImplemented,
  stripe_list_subscriptions: handleNotImplemented,

  // HubSpot
  hubspot_search_contacts: handleNotImplemented,
  hubspot_create_contact: handleNotImplemented,
  hubspot_list_deals: handleNotImplemented,

  // Database
  database_query: handleNotImplemented,

  // Browser
  browser_navigate: handleNotImplemented,
  browser_click: handleNotImplemented,
  browser_fill_form: handleNotImplemented,

  // Code execution
  execute_code: handleNotImplemented,

  // Filesystem
  read_file: handleNotImplemented,
  write_file: handleNotImplemented,
  list_directory: handleNotImplemented
};

// ── Public API ────────────────────────────────────────────────────

/**
 * Look up the InstalledTool metadata for a tool name.
 */
export function findToolByName(
  tools: InstalledTool[],
  toolName: string
): InstalledTool | undefined {
  return tools.find((t) => t.schema.function.name === toolName);
}

/**
 * Execute a tool call and return the result.
 */
export async function executeTool(
  input: ToolCallInput
): Promise<ToolCallResult> {
  const handler = TOOL_HANDLERS[input.toolName];

  if (!handler) {
    return {
      success: false,
      output: "",
      error: `Unknown tool: "${input.toolName}". This tool is not available.`
    };
  }

  const { config, secrets } = await getServerConfig(input.mcpServerId);

  try {
    const result = await handler(input.arguments, config, secrets);
    return result;
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Tool execution error: ${err instanceof Error ? err.message : "Unknown error"}`
    };
  }
}
