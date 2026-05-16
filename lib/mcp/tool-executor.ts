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

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { resolveIntegrationCredentials } from "@/lib/integrations/resolve";
import type { InstalledTool } from "@/lib/mcp/tool-registry";
import { DANGEROUS_TOOLS, gateToolCall } from "@/lib/safety/approval-gate";

// ── Types ─────────────────────────────────────────────────────────

export type ToolCallInput = {
  toolName: string;
  arguments: Record<string, unknown>;
  mcpServerId: string;
  organizationId: string;
  agentId?: string;
  businessId?: string;
  /** Conversation this tool call originated from. Threaded into args as
   *  _conversationId so tools like delegate_task can record the origin and
   *  post results back there when their work completes. */
  conversationId?: string;
  /** Set by approveRequest() when re-running a previously-approved tool
   *  call. Skips the approval gate (we already have approval). The flag is
   *  intentionally narrow: it never appears in tool arguments and is read
   *  only by executeTool itself. */
  bypassApprovalGate?: boolean;
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

      const requestedReddit = platformEntries.some(
        (p) => p.platform.toLowerCase() === "reddit"
      );
      let output = `Zernio/Late accepted the post for ${platformEntries.map((p) => p.platform).join(", ")}.\nPost ID: ${postId}`;
      if (post.platformPostUrl) {
        output += `\nURL: ${post.platformPostUrl}`;
      }
      if (unmatchedPlatforms.length > 0) {
        output += `\n⚠️ Skipped (not connected): ${unmatchedPlatforms.join(", ")}`;
      }
      // CRITICAL honesty: third-party accept != platform delivery.
      // Reddit especially shadow-bans API-originated posts silently.
      // Agents previously reported "published" based on this response
      // and confidently told the user their posts were live when they
      // weren't. Force the agent to verify.
      output += `\n\n⚠️ IMPORTANT — Do NOT tell the user this post is "live" or "published on <platform>" yet. Zernio accepting the job is NOT the same as the platform accepting the post. Reddit in particular silently shadow-bans API submissions; ditto LinkedIn's spam filter. Before claiming success to the user, VERIFY:`;
      if (requestedReddit) {
        output += `\n  • For Reddit: call verify_reddit_post with the returned URL, OR call reddit_get_user_posts with the account username and confirm the post is visible.`;
      }
      output += `\n  • For other platforms: ask the user to open their profile and confirm. If it's not visible, tell them the middleman accepted it but the platform rejected — recommend posting manually.`;

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

      const zernioOutput = output || "No recent posts found.";
      return {
        success: true,
        output:
          zernioOutput +
          "\n\n⚠️ IMPORTANT: The `status` shown here reflects Zernio/Late's internal queue — typically 'published' means Zernio sent the content to the target platform. It does NOT confirm the post is visible on the actual platform. Reddit in particular silently shadow-bans API-originated submissions. To verify a Reddit post actually reached the user's profile, use verify_reddit_post or reddit_get_user_posts. If the user reports not seeing posts that this tool shows as 'published', trust the user, NOT these logs."
      };
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

// ── Built-in Tools ────────────────────────────────────────────────

// Delegate Task — creates a conversation with the target agent and queues the
// task for the in-process delegation executor (lib/workflows/delegation-executor.ts)
// to pick up on its next tick. Unlike the previous version of this handler,
// the delegated work actually runs — the executor auto-invokes the target
// agent, stores the result, and writes a summary memory on the delegating
// agent so it can recall the outcome on its next turn.
const handleDelegateTask: ToolHandler = async (args) => {
  const agentId = String(args.agent_id || "");
  const agentName = String(args.agent_name || "");
  const task = String(args.task || "");
  const priority = String(args.priority || "medium");
  const context = args.context ? String(args.context) : "";
  const delegatingAgentId = args._agentId ? String(args._agentId) : null;
  const originConversationId = args._conversationId
    ? String(args._conversationId)
    : null;

  if (!agentId || !task) {
    return { success: false, output: "", error: "agent_id and task are required." };
  }

  try {
    const targetAgent = await db.agent.findUnique({
      where: { id: agentId },
      select: { id: true, displayName: true, role: true, status: true, businessId: true }
    });

    if (!targetAgent) {
      return { success: false, output: "", error: `Agent "${agentName}" (${agentId}) not found.` };
    }

    if (targetAgent.status === "disabled") {
      return { success: false, output: "", error: `Agent "${targetAgent.displayName}" is currently disabled and cannot accept tasks.` };
    }

    let delegatorName = agentName;
    if (delegatingAgentId) {
      const delegator = await db.agent.findUnique({
        where: { id: delegatingAgentId },
        select: { displayName: true }
      });
      if (delegator?.displayName) delegatorName = delegator.displayName;
    }

    // Resolve the origin conversation's channel so the executor knows where
    // to post the result on completion (in-chat message, Telegram, both).
    let originChannel: string | null = null;
    if (originConversationId) {
      const origin = await db.conversationLog.findUnique({
        where: { id: originConversationId },
        select: { channel: true }
      });
      originChannel = origin?.channel ?? null;
    }

    const conversation = await db.conversationLog.create({
      data: {
        agentId: targetAgent.id,
        businessId: targetAgent.businessId!,
        title: `[Delegated] ${task.slice(0, 80)}`,
        channel: "delegation",
        status: "active",
        metadata: {
          delegatedBy: delegatorName,
          delegatedByAgentId: delegatingAgentId,
          priority,
          originalTask: task,
          executorState: "pending",
          originConversationId,
          originChannel
        } as any
      }
    });

    const fullMessage = context
      ? `**Delegated Task (${priority} priority):**\n${task}\n\n**Context:**\n${context}`
      : `**Delegated Task (${priority} priority):**\n${task}`;

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: fullMessage
      }
    });

    await db.conversationLog.update({
      where: { id: conversation.id },
      data: { messageCount: 1 }
    });

    // Make the delegation immediately visible in Pulse. Without this, the
    // only breadcrumb of a delegation happening was the downstream
    // "completed" entry, which the executor writes ~30s later. If the
    // delegation never executed, the user had no way to tell whether the
    // CEO actually called delegate_task or hallucinated doing it.
    try {
      await db.activityEntry.create({
        data: {
          businessId: targetAgent.businessId!,
          type: "agent",
          title: `Task queued: ${targetAgent.displayName}`,
          detail: task.slice(0, 200),
          status: "pending",
          metadata: {
            delegatedConversationId: conversation.id,
            delegatedByAgentId: delegatingAgentId,
            delegatedByName: delegatorName,
            targetAgentId: targetAgent.id,
            targetAgentName: targetAgent.displayName,
            priority
          }
        }
      });
    } catch {
      /* best-effort */
    }

    return {
      success: true,
      output:
        `📋 Task queued for ${targetAgent.displayName} (${targetAgent.role}).\n\n` +
        `Task: ${task}\nPriority: ${priority}\nConversation ID: ${conversation.id}\n\n` +
        `The delegation executor will auto-run this within ~30 seconds.\n\n` +
        `When it completes, the result will be AUTOMATICALLY POSTED BACK to ` +
        `this conversation${originChannel === "telegram" ? " and sent via Telegram" : ""}. ` +
        `You do NOT need to promise a follow-up — the system handles it.\n\n` +
        `Tell the user plainly: "Queued for ${targetAgent.displayName} — the ` +
        `result will post here when it lands." Do NOT say "I'll update you" or ` +
        `invent an ETA. Use check_task_status only if the user asks for progress.`
    };
  } catch (err) {
    return { success: false, output: "", error: `Delegation failed: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Check Task Status — reports on tasks the calling agent has delegated.
// Reads ConversationLog rows where channel="delegation" and metadata
// indicates this agent was the delegator. Returns status + outcome so the
// CEO can honestly tell the user what's happening instead of inventing an
// ETA.
const handleCheckTaskStatus: ToolHandler = async (args) => {
  const delegatingAgentId = args._agentId ? String(args._agentId) : "";
  if (!delegatingAgentId) {
    return {
      success: false,
      output: "",
      error: "Missing agent context — check_task_status can only be used from an authenticated agent turn."
    };
  }

  const statusFilter = typeof args.status === "string" ? args.status : "all";
  const limitRaw = Number(args.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(Math.floor(limitRaw), 25))
    : 10;

  try {
    // Prisma JSON filtering varies by Postgres version; do an in-memory
    // filter on the metadata.delegatedByAgentId field which we know we set
    // at delegation-create time.
    const rows = await db.conversationLog.findMany({
      where: {
        channel: "delegation",
        ...(statusFilter !== "all" ? { status: statusFilter } : {})
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        agent: {
          select: { id: true, displayName: true, role: true, emoji: true }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { role: true, content: true, createdAt: true }
        }
      }
    });

    const mine = rows.filter((row) => {
      if (!row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) {
        return false;
      }
      const meta = row.metadata as Record<string, unknown>;
      return meta.delegatedByAgentId === delegatingAgentId;
    });

    if (mine.length === 0) {
      return {
        success: true,
        output:
          "You have no delegated tasks on record. Either you haven't delegated anything yet, or the delegations were made by a different agent identity."
      };
    }

    const lines = mine.slice(0, limit).map((row) => {
      const meta = row.metadata as Record<string, unknown>;
      const task =
        typeof meta.originalTask === "string"
          ? meta.originalTask.slice(0, 140)
          : row.title ?? "(no task)";
      const target = `${row.agent.emoji ?? "🤖"} ${row.agent.displayName}`;
      const latest = row.messages[0];
      const snippet = latest
        ? ` — latest (${latest.role}): "${latest.content.slice(0, 140).replace(/\n/g, " ")}"`
        : "";
      const completed = row.endedAt ? ` · finished ${row.endedAt.toISOString()}` : "";
      return `• [${row.status}] ${target}: ${task}${completed}${snippet}`;
    });

    const headline =
      `📊 Your delegations (${mine.length} total, showing ${Math.min(mine.length, limit)}):\n\n` +
      lines.join("\n");

    return { success: true, output: headline };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Failed to check task status: ${err instanceof Error ? err.message : "Unknown error"}`
    };
  }
};

// List Team — returns all agents in the same business
const handleListTeam: ToolHandler = async (args, _config, _secrets) => {
  return {
    success: true,
    output: "Your team members are listed in your system context above under 'YOUR TEAM'. Use the agent IDs shown there to delegate tasks with the delegate_task tool."
  };
};

// Suggest Agent Config — recommends optimal settings for a new agent
const handleSuggestAgentConfig: ToolHandler = async (args) => {
  const role = String(args.role || "");
  const requirements = args.requirements ? String(args.requirements) : "";

  if (!role) {
    return { success: false, output: "", error: "Role is required." };
  }

  // The LLM itself has the knowledge block — this tool just structures the output
  return {
    success: true,
    output: `🧠 Agent Configuration Analysis for: "${role}"${requirements ? `\nRequirements: ${requirements}` : ""}

Use your AGENT BUILDING KNOWLEDGE to recommend the best configuration. Structure your recommendation as:

1. **Recommended Model** — Pick the best primary + fallback model for this role
2. **Runtime** — Which runtime fits best (openclaw for general, opencode/codex/claude for code tasks, hermes for lightweight)
3. **Safety Mode** — What autonomy level is appropriate
4. **Agent Type** — main (leader), specialist (domain expert), or global (org-wide utility)
5. **Key Settings** — systemPrompt, roleInstructions, outputStyle, constraints, escalationRules
6. **Estimated Token Budget** — maxTokensPerCall recommendation

Present this as a clear proposal the user can review and approve.`
  };
};

// Create Agent — generates a proposal for user approval
const handleCreateAgent: ToolHandler = async (args) => {
  const displayName = String(args.displayName || "");
  const role = String(args.role || "");
  const type = String(args.type || "specialist");

  if (!displayName || !role) {
    return { success: false, output: "", error: "displayName and role are required." };
  }

  // Build the proposal — we do NOT create the agent yet
  const proposal: Record<string, unknown> = {
    displayName,
    role,
    type,
    ...(args.emoji ? { emoji: args.emoji } : {}),
    ...(args.purpose ? { purpose: args.purpose } : {}),
    ...(args.primaryModel ? { primaryModel: args.primaryModel } : {}),
    ...(args.fallbackModel ? { fallbackModel: args.fallbackModel } : {}),
    ...(args.runtime ? { runtime: args.runtime } : { runtime: "openclaw" }),
    ...(args.safetyMode ? { safetyMode: args.safetyMode } : { safetyMode: "ask_before_acting" }),
    ...(args.systemPrompt ? { systemPrompt: args.systemPrompt } : {}),
    ...(args.roleInstructions ? { roleInstructions: args.roleInstructions } : {}),
    ...(args.outputStyle ? { outputStyle: args.outputStyle } : {}),
    ...(args.constraints ? { constraints: args.constraints } : {}),
    ...(args.escalationRules ? { escalationRules: args.escalationRules } : {}),
    ...(args.maxTokensPerCall ? { maxTokensPerCall: args.maxTokensPerCall } : {})
  };

  const configSummary = Object.entries(proposal)
    .map(([k, v]) => {
      const val = typeof v === "string" && v.length > 120 ? v.slice(0, 120) + "..." : v;
      return `  • **${k}**: ${val}`;
    })
    .join("\n");

  return {
    success: true,
    output: `📋 **Agent Creation Proposal**\n\nI'd like to create a new agent with the following configuration:\n\n${configSummary}\n\n⚠️ **This requires your approval.** Please review the configuration above and confirm:\n- Reply **"Yes, create it"** or **"Approved"** to create this agent\n- Reply with changes if you'd like to adjust anything first\n\n_The agent will NOT be created until you explicitly approve._\n\n[PENDING_CREATE_AGENT:${Buffer.from(JSON.stringify(proposal)).toString("base64")}]`
  };
};

// Edit Agent — generates a change proposal for user approval
const handleEditAgent: ToolHandler = async (args) => {
  const agentId = String(args.agent_id || "");
  const agentName = String(args.agent_name || "");
  const reason = String(args.reason || "");
  let changes: Record<string, unknown> = {};

  if (!agentId) {
    return { success: false, output: "", error: "agent_id is required." };
  }

  try {
    changes = typeof args.changes === "string"
      ? JSON.parse(args.changes)
      : (args.changes as Record<string, unknown>) || {};
  } catch {
    return { success: false, output: "", error: "Invalid changes format. Must be a valid JSON object." };
  }

  if (Object.keys(changes).length === 0) {
    return { success: false, output: "", error: "No changes specified." };
  }

  // Verify agent exists
  try {
    const agent = await db.agent.findUnique({
      where: { id: agentId },
      select: { id: true, displayName: true, role: true, primaryModel: true, runtime: true, safetyMode: true }
    });

    if (!agent) {
      return { success: false, output: "", error: `Agent "${agentName}" (${agentId}) not found.` };
    }

    const currentValues = Object.entries(changes).map(([k]) => {
      const current = (agent as Record<string, unknown>)[k];
      return `  • **${k}**: ${current ?? "(not set)"}`;
    }).join("\n");

    const newValues = Object.entries(changes).map(([k, v]) => {
      const val = typeof v === "string" && v.length > 120 ? v.slice(0, 120) + "..." : v;
      return `  • **${k}**: ${val}`;
    }).join("\n");

    return {
      success: true,
      output: `📝 **Agent Edit Proposal: ${agent.displayName}**\n\n**Reason:** ${reason}\n\n**Current values:**\n${currentValues}\n\n**Proposed changes:**\n${newValues}\n\n⚠️ **This requires your approval.** Please review the changes above and confirm:\n- Reply **"Yes, apply changes"** or **"Approved"** to update this agent\n- Reply with modifications if you'd like to adjust anything\n\n_Changes will NOT be applied until you explicitly approve._\n\n[PENDING_EDIT_AGENT:${agentId}:${Buffer.from(JSON.stringify(changes)).toString("base64")}]`
    };
  } catch (err) {
    return { success: false, output: "", error: `Failed to look up agent: ${err instanceof Error ? err.message : "Unknown error"}` };
  }
};

// Confirm Create Agent — actually creates the agent after user approval
const handleConfirmCreateAgent: ToolHandler = async (args) => {
  const token = String(args.proposal_token || "");
  const businessId = String(args.business_id || "");

  if (!token) {
    return { success: false, output: "", error: "proposal_token is required. Extract it from the [PENDING_CREATE_AGENT:...] marker in your previous response." };
  }
  if (!businessId) {
    return { success: false, output: "", error: "business_id is required." };
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const proposal = JSON.parse(decoded) as Record<string, unknown>;

    // Validate required fields
    if (!proposal.displayName || !proposal.role || !proposal.type) {
      return { success: false, output: "", error: "Invalid proposal — missing required fields (displayName, role, type)." };
    }

    // Create the agent
    const agent = await db.agent.create({
      data: {
        businessId: (proposal.type as string) === "global" ? null : businessId,
        displayName: String(proposal.displayName),
        emoji: proposal.emoji ? String(proposal.emoji) : null,
        role: String(proposal.role),
        purpose: proposal.purpose ? String(proposal.purpose) : null,
        type: String(proposal.type) as "main" | "specialist" | "global",
        status: "active",
        primaryModel: proposal.primaryModel ? String(proposal.primaryModel) : null,
        fallbackModel: proposal.fallbackModel ? String(proposal.fallbackModel) : null,
        runtime: (proposal.runtime as string) || "openclaw",
        safetyMode: (proposal.safetyMode as string) || "ask_before_acting",
        systemPrompt: proposal.systemPrompt ? String(proposal.systemPrompt) : null,
        roleInstructions: proposal.roleInstructions ? String(proposal.roleInstructions) : null,
        outputStyle: proposal.outputStyle ? String(proposal.outputStyle) : null,
        constraints: proposal.constraints ? String(proposal.constraints) : null,
        escalationRules: proposal.escalationRules ? String(proposal.escalationRules) : null,
        maxTokensPerCall: proposal.maxTokensPerCall ? Number(proposal.maxTokensPerCall) : null,
        depth: (proposal.type as string) === "specialist" ? 1 : 0
      }
    });

    return {
      success: true,
      output: `✅ **Agent Created Successfully!**\n\n• **Name:** ${agent.displayName} ${agent.emoji || ""}\n• **Role:** ${agent.role}\n• **Type:** ${agent.type}\n• **Model:** ${agent.primaryModel || "system default"}\n• **Runtime:** ${agent.runtime}\n• **Safety:** ${agent.safetyMode}\n• **ID:** ${agent.id}\n\nThe new agent is now active and ready to use. They will appear in your team list.`
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("JSON")) {
      return { success: false, output: "", error: "Invalid proposal token — could not decode. Make sure you're using the exact token from the [PENDING_CREATE_AGENT:...] marker." };
    }
    return { success: false, output: "", error: `Failed to create agent: ${message}` };
  }
};

// Confirm Edit Agent — actually applies changes after user approval
const handleConfirmEditAgent: ToolHandler = async (args) => {
  const agentId = String(args.agent_id || "");
  const token = String(args.proposal_token || "");

  if (!agentId || !token) {
    return { success: false, output: "", error: "agent_id and proposal_token are required." };
  }

  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const changes = JSON.parse(decoded) as Record<string, unknown>;

    if (Object.keys(changes).length === 0) {
      return { success: false, output: "", error: "No changes to apply." };
    }

    // Verify agent exists
    const existing = await db.agent.findUnique({
      where: { id: agentId },
      select: { id: true, displayName: true }
    });

    if (!existing) {
      return { success: false, output: "", error: `Agent ${agentId} not found.` };
    }

    // Allowlist of updatable fields
    const ALLOWED_FIELDS = new Set([
      "displayName", "emoji", "role", "purpose", "type", "status",
      "primaryModel", "fallbackModel", "runtime", "safetyMode",
      "systemPrompt", "roleInstructions", "outputStyle", "constraints",
      "escalationRules", "maxTokensPerCall"
    ]);

    const safeChanges: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changes)) {
      if (ALLOWED_FIELDS.has(k)) {
        safeChanges[k] = v;
      }
    }

    if (Object.keys(safeChanges).length === 0) {
      return { success: false, output: "", error: "No valid fields to update." };
    }

    const updated = await db.agent.update({
      where: { id: agentId },
      data: safeChanges as any
    });

    const changeList = Object.entries(safeChanges)
      .map(([k, v]) => {
        const val = typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "..." : v;
        return `  • **${k}** → ${val}`;
      })
      .join("\n");

    return {
      success: true,
      output: `✅ **Agent Updated: ${updated.displayName}**\n\nApplied changes:\n${changeList}\n\nThe changes are now live.`
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("JSON")) {
      return { success: false, output: "", error: "Invalid proposal token — could not decode." };
    }
    return { success: false, output: "", error: `Failed to update agent: ${message}` };
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

// Memory Store (saves to AgentMemory DB table)
const handleMemoryStore: ToolHandler = async (args, _config, _secrets) => {
  const key = String(args.key || "");
  const value = String(args.value || "");
  const category = String(args.category || "other");

  if (!key || !value) {
    return { success: false, output: "", error: "key and value are required." };
  }

  // Map category to AgentMemory type
  const typeMap: Record<string, string> = {
    preference: "learned_preference",
    fact: "system_observation",
    decision: "task_outcome",
    contact: "contact_note",
    project: "task_outcome",
    learning: "learned_preference",
    outcome: "task_outcome",
    other: "system_observation"
  };
  const memoryType = typeMap[category] || "system_observation";

  try {
    // Route through the embedding-aware helper so memory_recall can find
    // this entry semantically next time.
    const { createAgentMemoryWithEmbedding } = await import(
      "@/lib/repository/memory"
    );
    await createAgentMemoryWithEmbedding({
      agentId: String(args._agentId || "system"),
      businessId: String(args._businessId || "system"),
      type: memoryType,
      content: `[${key}] ${value}`,
      importance:
        category === "decision" ||
        category === "outcome" ||
        category === "learning"
          ? 8
          : 5,
      tier: "hot",
      metadata: { key, category, originalValue: value } as Prisma.InputJsonValue,
      organizationId: args._organizationId
        ? String(args._organizationId)
        : undefined
    });

    return {
      success: true,
      output: `💾 Memory stored: [${key}] = "${value.slice(0, 150)}${value.length > 150 ? "..." : ""}" (type: ${memoryType})`
    };
  } catch (err) {
    // If AgentMemory table doesn't exist yet, gracefully degrade
    return {
      success: true,
      output: `💾 Noted: [${key}] = "${value.slice(0, 150)}${value.length > 150 ? "..." : ""}" (category: ${category}). Memory will be available in conversation context.`
    };
  }
};

// Memory Recall (semantic + keyword fallback against AgentMemory)
const handleMemoryRecall: ToolHandler = async (args) => {
  const rawQuery = String(args.query || "");
  if (!rawQuery.trim()) {
    return { success: false, output: "", error: "query is required." };
  }
  const query = rawQuery.toLowerCase();

  try {
    const agentId = String(args._agentId || "");
    const businessId = String(args._businessId || "");
    const organizationId = String(args._organizationId || "");

    // 1) Semantic recall when we have org + business + agent context.
    //    Returns null if embeddings aren't available (OpenAI unset, or no
    //    memories have been embedded yet) — fall through to keyword.
    if (agentId && businessId && organizationId) {
      const { searchAgentMemorySemantic } = await import(
        "@/lib/repository/memory"
      );
      const semantic = await searchAgentMemorySemantic({
        agentId,
        businessId,
        organizationId,
        query: rawQuery,
        limit: 8
      });
      if (semantic && semantic.length > 0) {
        const output = semantic
          .map(
            (m, i) =>
              `${i + 1}. [${m.type}] ${m.content} (importance: ${
                m.importance
              }/10, score: ${m.score.toFixed(2)}, ${m.createdAt.toLocaleDateString()})`
          )
          .join("\n");
        return {
          success: true,
          output: `🔍 Found ${semantic.length} semantically-related memories for "${rawQuery}":\n${output}`
        };
      }
    }

    // 2) Keyword fallback — kept verbatim from the prior implementation so
    //    installs without OpenAI keep working.
    const memories = await db.agentMemory.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        ...(businessId ? { businessId } : {}),
        content: { contains: query, mode: "insensitive" as Prisma.QueryMode }
      },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: 10
    });

    if (memories.length === 0) {
      const words = query.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) {
        const broadMemories = await db.agentMemory.findMany({
          where: {
            ...(agentId ? { agentId } : {}),
            ...(businessId ? { businessId } : {}),
            OR: words.map((word) => ({
              content: {
                contains: word,
                mode: "insensitive" as Prisma.QueryMode
              }
            }))
          },
          orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
          take: 10
        });

        if (broadMemories.length > 0) {
          const output = broadMemories
            .map(
              (m, i) =>
                `${i + 1}. [${m.type}] ${m.content} (importance: ${
                  m.importance
                }/10, ${m.createdAt.toLocaleDateString()})`
            )
            .join("\n");
          return {
            success: true,
            output: `🔍 Found ${broadMemories.length} keyword-related memories:\n${output}`
          };
        }
      }

      return {
        success: true,
        output: `🔍 No memories found for "${rawQuery}". This is a new topic — I'll learn from our conversation and store insights for next time.`
      };
    }

    const output = memories
      .map(
        (m, i) =>
          `${i + 1}. [${m.type}] ${m.content} (importance: ${m.importance}/10, ${m.createdAt.toLocaleDateString()})`
      )
      .join("\n");

    return {
      success: true,
      output: `🔍 Found ${memories.length} memories for "${rawQuery}":\n${output}`
    };
  } catch {
    return {
      success: true,
      output: `🔍 Memory search for "${rawQuery}": No stored memories found yet. I'll use conversation history and knowledge base instead.`
    };
  }
};

// Send Telegram Message — agent-initiated outbound message
const handleSendTelegramMessage: ToolHandler = async (args) => {
  const text = String(args.text || "").trim();
  const explicitChatId = args.chat_id ? String(args.chat_id).trim() : "";
  const organizationId = String(args._organizationId || "");
  const agentId = String(args._agentId || "");
  const businessId = String(args._businessId || "");

  if (!text) {
    return { success: false, output: "", error: "`text` is required." };
  }

  if (!organizationId) {
    return {
      success: false,
      output: "",
      error: "Missing organization context."
    };
  }

  const integration = await db.integration.findFirst({
    where: { organizationId, key: "telegram", status: "connected" }
  });

  if (!integration) {
    return {
      success: false,
      output: "",
      error:
        "Telegram is not connected for this organization. Go to Settings → Integrations → Telegram to connect."
    };
  }

  if (
    integration.scope === "business" &&
    businessId &&
    !(integration.assignedBusinessIds ?? []).includes(businessId)
  ) {
    return {
      success: false,
      output: "",
      error:
        "Telegram is connected, but not assigned to this business. Assign it to this business in Settings → Integrations → Telegram."
    };
  }

  const encKey = getEncryptionKey();
  let botToken = "";
  if (
    integration.encryptedSecrets &&
    typeof integration.encryptedSecrets === "object" &&
    !Array.isArray(integration.encryptedSecrets)
  ) {
    const encrypted = (integration.encryptedSecrets as Record<string, unknown>)
      .bot_token;
    if (typeof encrypted === "string") {
      try {
        botToken = decryptSecret(encrypted, encKey);
      } catch {
        // handled below via empty token check
      }
    }
  }

  if (!botToken) {
    return {
      success: false,
      output: "",
      error:
        "Telegram bot token is missing or unreadable. Reconnect Telegram in Settings → Integrations."
    };
  }

  const config = (integration.config ?? {}) as Record<string, unknown>;
  const defaultChatId =
    typeof config.chat_id === "string" ? config.chat_id.trim() : "";

  // Resolve targets: explicit chat_id > linked chats for this agent > default.
  const targets: string[] = [];
  if (explicitChatId) {
    targets.push(explicitChatId);
  } else if (agentId) {
    const links = await db.telegramChat.findMany({
      where: { agentId, active: true },
      select: { telegramChatId: true }
    });
    for (const link of links) {
      if (link.telegramChatId && !targets.includes(link.telegramChatId)) {
        targets.push(link.telegramChatId);
      }
    }
    if (targets.length === 0 && defaultChatId) {
      targets.push(defaultChatId);
    }
  } else if (defaultChatId) {
    targets.push(defaultChatId);
  }

  if (targets.length === 0) {
    return {
      success: false,
      output: "",
      error:
        "No Telegram chat to send to. Either the user needs to /start your bot first to pair their chat with you, or pass an explicit chat_id, or set a Default Chat ID on the Telegram integration."
    };
  }

  const { sendMessage } = await import("@/lib/telegram/client");

  const delivered: string[] = [];
  const failed: Array<{ chatId: string; error: string }> = [];

  for (const chatId of targets) {
    try {
      const result = await sendMessage(botToken, chatId, text);
      if (result?.ok) {
        delivered.push(chatId);
      } else {
        failed.push({
          chatId,
          error: result?.description || "Unknown error"
        });
      }
    } catch (err) {
      failed.push({
        chatId,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }

  if (delivered.length === 0) {
    return {
      success: false,
      output: "",
      error: `Telegram delivery failed. ${failed
        .map((f) => `${f.chatId}: ${f.error}`)
        .join("; ")}`
    };
  }

  const lines = [
    `📨 Sent to ${delivered.length} Telegram chat${delivered.length === 1 ? "" : "s"}.`
  ];
  if (failed.length > 0) {
    lines.push(
      `⚠️ Failed on ${failed.length}: ${failed
        .map((f) => `${f.chatId} (${f.error})`)
        .join("; ")}`
    );
  }

  return { success: true, output: lines.join("\n") };
};

// ── Alternate Approver Escalation ─────────────────────────────────
//
// Pings the operator's designated alternate approver when the primary
// operator (Brandon) is unreachable on a severity=HIGH issue. Reads
// alternate_approver_* fields from the Telegram Integration's `config`
// JSON (same row that holds the primary chat_id). Sends to BOTH
// Telegram + email when both are configured; fails clean when neither
// is set. Audit-logs to ActivityEntry.

const handleEscalateToAlternateApprover: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  const agentId = String(args._agentId || "");

  if (!organizationId) {
    return { success: false, output: "", error: "Missing organization context." };
  }

  const severity = String(args.severity || "").toLowerCase();
  if (severity !== "high") {
    return {
      success: false,
      output: "",
      error:
        "escalate_to_alternate_approver only handles severity=high. Lower severities use the primary operator queue via send_telegram_message."
    };
  }

  const incidentSummary = String(args.incident_summary || "").trim();
  const recommendedAction = String(args.recommended_action || "").trim();
  if (!incidentSummary || !recommendedAction) {
    return {
      success: false,
      output: "",
      error: "incident_summary and recommended_action are required"
    };
  }

  const operatorSilentHours = Number(args.operator_silent_hours) || 0;
  const kbRef = String(args.kb_ref || "").trim();

  const integration = await db.integration.findFirst({
    where: { organizationId, key: "telegram", status: "connected" }
  });
  if (!integration) {
    return {
      success: false,
      output: "",
      error:
        "Telegram integration not connected — alternate-approver config lives on the Telegram Integration row. Connect Telegram first, then configure the alternate via PUT /api/admin/integrations/telegram/alternate-approver."
    };
  }

  const cfg = (integration.config ?? {}) as Record<string, unknown>;
  const alternateChatId =
    typeof cfg.alternate_approver_chat_id === "string"
      ? cfg.alternate_approver_chat_id.trim()
      : "";
  const alternateEmail =
    typeof cfg.alternate_approver_email === "string"
      ? cfg.alternate_approver_email.trim()
      : "";
  const alternateName =
    typeof cfg.alternate_approver_name === "string" &&
    cfg.alternate_approver_name.trim().length > 0
      ? cfg.alternate_approver_name.trim()
      : "Alternate approver";

  if (!alternateChatId && !alternateEmail) {
    return {
      success: false,
      output: "",
      error:
        "No alternate approver configured. Set alternate_approver_chat_id (Telegram, strongly recommended) and/or alternate_approver_email via PUT /api/admin/integrations/telegram/alternate-approver. KB-13 documents the protocol."
    };
  }

  const heading = "🚨 ALTERNATE APPROVER ESCALATION — severity=HIGH";
  const silenceLine =
    operatorSilentHours > 0
      ? `Primary operator silent for ${operatorSilentHours.toFixed(1)}h.`
      : "Primary operator unreachable on a severity=HIGH issue.";
  const bodyLines = [
    heading,
    "",
    silenceLine,
    "",
    `**Incident:** ${incidentSummary}`,
    "",
    `**Recommended action:** ${recommendedAction}`,
    kbRef ? "" : null,
    kbRef ? `**Reference:** ${kbRef}` : null,
    "",
    `Hi ${alternateName} — you're receiving this because you're the designated alternate approver on this org's Telegram integration. The primary operator has been pinged but has not responded within the SLA documented in KB-13. Please make a call: approve a holding statement, pause the affected pathway, or hand off to the right professional.`,
    "",
    "Reply here to close the loop. The agent will record your decision in the audit trail."
  ].filter((line): line is string => line !== null);
  const messageBody = bodyLines.join("\n");

  const delivered: Array<{ channel: string; target: string }> = [];
  const failed: Array<{ channel: string; target: string; error: string }> = [];

  // Channel A: Telegram (reuses the org's Telegram bot)
  if (alternateChatId) {
    try {
      const encKey = getEncryptionKey();
      let botToken = "";
      if (
        integration.encryptedSecrets &&
        typeof integration.encryptedSecrets === "object" &&
        !Array.isArray(integration.encryptedSecrets)
      ) {
        const encrypted = (integration.encryptedSecrets as Record<string, unknown>)
          .bot_token;
        if (typeof encrypted === "string") {
          try {
            botToken = decryptSecret(encrypted, encKey);
          } catch {
            /* handled below */
          }
        }
      }
      if (!botToken) {
        failed.push({
          channel: "telegram",
          target: alternateChatId,
          error: "bot_token missing or unreadable on Telegram integration"
        });
      } else {
        const { sendMessage } = await import("@/lib/telegram/client");
        const result = await sendMessage(botToken, alternateChatId, messageBody);
        if (result?.ok) {
          delivered.push({ channel: "telegram", target: alternateChatId });
        } else {
          failed.push({
            channel: "telegram",
            target: alternateChatId,
            error: result?.description || "Unknown Telegram error"
          });
        }
      }
    } catch (err) {
      failed.push({
        channel: "telegram",
        target: alternateChatId,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }

  // Channel B: Email (uses the Resend MCP if installed; skipped clean otherwise)
  if (alternateEmail) {
    try {
      const resendServer = await db.mcpServer.findFirst({
        where: {
          organizationId,
          definitionId: "resend_mcp",
          status: "active"
        },
        select: { encryptedConfig: true }
      });
      let resendKey = "";
      if (
        resendServer?.encryptedConfig &&
        typeof resendServer.encryptedConfig === "object" &&
        !Array.isArray(resendServer.encryptedConfig)
      ) {
        const encKey = getEncryptionKey();
        const encryptedApiKey = (
          resendServer.encryptedConfig as Record<string, unknown>
        ).api_key;
        if (typeof encryptedApiKey === "string") {
          try {
            resendKey = decryptSecret(encryptedApiKey, encKey);
          } catch {
            /* skip */
          }
        }
      }
      if (!resendKey) {
        failed.push({
          channel: "email",
          target: alternateEmail,
          error: "Resend MCP not installed or api_key unreadable — Telegram-only delivery"
        });
      } else {
        const htmlBody = messageBody
          .split("\n")
          .map((line) => {
            if (!line) return "<br/>";
            if (line.startsWith("**")) {
              return `<p style="margin:8px 0;"><strong>${line.replace(/^\*\*|\*\*/g, "").replace(/\*\*/g, "")}</strong></p>`;
            }
            if (line.startsWith("🚨")) {
              return `<h2 style="color:#b91c1c;margin:8px 0;">${line}</h2>`;
            }
            return `<p style="margin:6px 0;">${line}</p>`;
          })
          .join("");
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: "Ghost ProtoClaw <onboarding@resend.dev>",
            to: alternateEmail,
            subject: `[SEVERITY=HIGH] Alternate approver needed — ${incidentSummary.slice(0, 60)}`,
            html: `<div style="font-family:-apple-system,sans-serif;line-height:1.55;color:#111;max-width:640px;">${htmlBody}</div>`
          })
        });
        if (res.ok) {
          delivered.push({ channel: "email", target: alternateEmail });
        } else {
          const errText = await res.text().catch(() => "");
          failed.push({
            channel: "email",
            target: alternateEmail,
            error: `Resend ${res.status}: ${errText.slice(0, 200)}`
          });
        }
      }
    } catch (err) {
      failed.push({
        channel: "email",
        target: alternateEmail,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }

  // Audit log
  if (businessId) {
    await db.activityEntry
      .create({
        data: {
          businessId,
          type: "alternate_approver_escalation",
          title: `Alternate approver escalation — severity=high`,
          detail: incidentSummary.slice(0, 300),
          status: delivered.length > 0 ? "sent" : "failed",
          metadata: JSON.parse(
            JSON.stringify({
              severity,
              alternate_name: alternateName,
              alternate_chat_id: alternateChatId || null,
              alternate_email: alternateEmail || null,
              operator_silent_hours: operatorSilentHours,
              kb_ref: kbRef,
              recommended_action: recommendedAction,
              channels_delivered: delivered,
              channels_failed: failed,
              agent_id: agentId
            })
          )
        }
      })
      .catch((err) => {
        console.error("[escalate_to_alternate_approver] audit log failed:", err);
      });
  }

  if (delivered.length === 0) {
    return {
      success: false,
      output: "",
      error: `All alternate-approver channels failed: ${failed.map((f) => `${f.channel}(${f.target})=${f.error}`).join("; ")}`
    };
  }

  return {
    success: true,
    output: JSON.stringify({
      alternate_name: alternateName,
      delivered: delivered.map((d) => d.channel),
      failed: failed.map((f) => ({ channel: f.channel, error: f.error })),
      next_step:
        "Wait for alternate's response. If no response within 4h either, pause all outbound on the affected pathway and log to Lesson Memory for retrospective."
    })
  };
};

// Ask CEO Agent — master agent delegates a question to a business's CEO
const handleAskCeoAgent: ToolHandler = async (args) => {
  const businessIdOrName = String(args.business || "").trim();
  const question = String(args.question || "").trim();
  const organizationId = String(args._organizationId || "");
  const masterAgentId = String(args._agentId || "");

  if (!businessIdOrName || !question) {
    return {
      success: false,
      output: "",
      error: "Both `business` and `question` are required."
    };
  }

  if (!organizationId) {
    return {
      success: false,
      output: "",
      error: "Missing organization context — ask_ceo_agent can only be used from an authenticated chat."
    };
  }

  const { askCeoAgent } = await import("@/lib/llm/master-agent");

  // Resolve the master agent's display name for framing the message.
  let masterDisplayName = "the master agent";
  if (masterAgentId) {
    const master = await db.agent.findUnique({
      where: { id: masterAgentId },
      select: { displayName: true }
    });
    if (master?.displayName) masterDisplayName = master.displayName;
  }

  const result = await askCeoAgent({
    organizationId,
    businessIdOrName,
    question,
    masterAgentDisplayName: masterDisplayName
  });

  if (!result.success) {
    return { success: false, output: "", error: result.error };
  }

  return {
    success: true,
    output: `💬 **${result.ceoName}** (${result.businessName}) replied:\n\n${result.response}`
  };
};

// List Businesses — master agent gets a snapshot of the org's businesses
const handleListBusinesses: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error: "Missing organization context — list_businesses can only be used from an authenticated chat."
    };
  }

  const { listOrganizationBusinesses } = await import(
    "@/lib/llm/master-agent"
  );
  const businesses = await listOrganizationBusinesses(organizationId);

  if (businesses.length === 0) {
    return {
      success: true,
      output: "No businesses are configured in this organization yet."
    };
  }

  const lines = businesses.map((b) => {
    const ceo = b.ceo
      ? `CEO: ${b.ceo.emoji || "🤖"} ${b.ceo.displayName} (${b.ceo.role})`
      : "CEO: none configured";
    return `• **${b.name}** [${b.status}] — ${ceo}\n  id: ${b.id}`;
  });

  return {
    success: true,
    output: `🏢 Businesses in this organization (${businesses.length}):\n\n${lines.join("\n")}`
  };
};

// Get Agent Config — full configuration snapshot for one agent. Available
// to leader (CEO/main) and master agents. Org-scoped so a CEO in business A
// cannot read agents in business B unless they're the org's master.
const handleGetAgentConfig: ToolHandler = async (args) => {
  const agentIdArg = String(args.agent_id || "").trim();
  const organizationId = String(args._organizationId || "");
  const callingAgentId = String(args._agentId || "");

  if (!agentIdArg) {
    return { success: false, output: "", error: "agent_id is required." };
  }
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error: "Missing organization context — get_agent_config requires authenticated chat."
    };
  }

  // Figure out the caller's type so we can scope. Master sees any agent in
  // the org; non-master is scoped to its own business (and to global agents
  // in the org).
  const caller = callingAgentId
    ? await db.agent.findUnique({
        where: { id: callingAgentId },
        select: { type: true, businessId: true, organizationId: true }
      })
    : null;
  const callerIsMaster = caller?.type === "master";

  const target = await db.agent.findUnique({
    where: { id: agentIdArg },
    select: {
      id: true,
      organizationId: true,
      businessId: true,
      parentAgentId: true,
      displayName: true,
      emoji: true,
      role: true,
      purpose: true,
      type: true,
      status: true,
      depth: true,
      primaryModel: true,
      fallbackModel: true,
      modelSource: true,
      runtime: true,
      safetyMode: true,
      systemPrompt: true,
      roleInstructions: true,
      outputStyle: true,
      constraints: true,
      escalationRules: true,
      askBeforeDoing: true,
      tools: true,
      lastRun: true,
      sessionsCount: true,
      business: { select: { id: true, name: true, organizationId: true } }
    }
  });

  if (!target) {
    return { success: false, output: "", error: `No agent found with id "${agentIdArg}".` };
  }

  // Org scope — master agents have organizationId on the row directly;
  // business-scoped agents have it via business.organizationId.
  const targetOrgId = target.organizationId ?? target.business?.organizationId ?? null;
  if (targetOrgId && targetOrgId !== organizationId) {
    return { success: false, output: "", error: "Agent is not in your organization." };
  }

  // Non-master callers cannot peek into other businesses.
  if (!callerIsMaster && caller?.businessId && target.businessId && target.businessId !== caller.businessId) {
    return {
      success: false,
      output: "",
      error: "You can only read agent configs in your own business. Ask the Master Agent or that business's CEO."
    };
  }

  const toolsList = Array.isArray(target.tools) ? (target.tools as string[]) : [];

  const summary = [
    `🤖 **${target.emoji ?? ""}${target.emoji ? " " : ""}${target.displayName}**`,
    `Role: ${target.role}${target.purpose ? ` — ${target.purpose}` : ""}`,
    `Type: ${target.type} | Status: ${target.status} | Depth: ${target.depth}`,
    `Business: ${target.business?.name ?? "(org-scoped)"} (${target.businessId ?? "none"})`,
    target.parentAgentId ? `Parent agent: ${target.parentAgentId}` : "Parent agent: (top-level)",
    "",
    `**Model**: primary=${target.primaryModel ?? "(business default)"} | fallback=${target.fallbackModel ?? "(none)"} | source=${target.modelSource}`,
    `**Runtime**: ${target.runtime} | **Safety mode**: ${target.safetyMode ?? "(business default)"}`,
    `**Tools (whitelist)**: ${toolsList.length > 0 ? toolsList.join(", ") : "(all default tools for type)"}`,
    "",
    target.systemPrompt ? `**System prompt** (full):\n${target.systemPrompt}` : "(no system prompt set)",
    target.roleInstructions ? `\n**Role instructions**:\n${target.roleInstructions}` : "",
    target.outputStyle ? `\n**Output style**: ${target.outputStyle}` : "",
    target.constraints ? `\n**Constraints**: ${target.constraints}` : "",
    target.escalationRules ? `\n**Escalation rules**: ${target.escalationRules}` : "",
    target.askBeforeDoing ? `\n**Ask before doing**: ${target.askBeforeDoing}` : "",
    "",
    `Sessions: ${target.sessionsCount} | Last run: ${target.lastRun ? target.lastRun.toISOString() : "never"}`
  ]
    .filter(Boolean)
    .join("\n");

  return { success: true, output: summary };
};

// List Integration Health — every integration in the org with status,
// scope, and per-business assignment. Available to leaders and master.
const handleListIntegrationHealth: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const callingAgentId = String(args._agentId || "");
  const statusFilter = String(args.status || "all").toLowerCase();
  const explicitBusinessId = args.business_id ? String(args.business_id) : "";

  if (!organizationId) {
    return {
      success: false,
      output: "",
      error: "Missing organization context — list_integration_health requires authenticated chat."
    };
  }

  const caller = callingAgentId
    ? await db.agent.findUnique({
        where: { id: callingAgentId },
        select: { type: true, businessId: true }
      })
    : null;
  const callerIsMaster = caller?.type === "master";

  // CEOs are scoped to their own business; master can pass any business id
  // or leave it blank for org-wide.
  const businessIdForScope = callerIsMaster
    ? explicitBusinessId || null
    : (caller?.businessId ?? null);

  const where: { organizationId: string; status?: string } = { organizationId };
  if (statusFilter !== "all" && ["connected", "disconnected", "error"].includes(statusFilter)) {
    where.status = statusFilter;
  }

  const integrations = await db.integration.findMany({
    where,
    select: {
      key: true,
      name: true,
      description: true,
      status: true,
      scope: true,
      assignedBusinessIds: true,
      updatedAt: true
    },
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });

  const filtered = integrations.filter((i) => {
    if (i.scope !== "business") return true;
    if (!businessIdForScope) return true; // master agent org-wide view
    return (i.assignedBusinessIds ?? []).includes(businessIdForScope);
  });

  if (filtered.length === 0) {
    return {
      success: true,
      output: `No integrations match (status=${statusFilter}${businessIdForScope ? `, business=${businessIdForScope}` : ""}).`
    };
  }

  const counts = { connected: 0, disconnected: 0, error: 0 } as Record<string, number>;
  const lines = filtered.map((i) => {
    counts[i.status] = (counts[i.status] ?? 0) + 1;
    const badge = i.status === "connected" ? "✅" : i.status === "error" ? "⚠️" : "⛔";
    const scopeLabel = i.scope === "business" ? "this business" : "organization-wide";
    const desc = i.description ? ` — ${i.description}` : "";
    return `${badge} **${i.name}** (${i.key}) [${scopeLabel}] — status: ${i.status}${desc}`;
  });

  const header = `🔌 Integrations (${filtered.length}) — connected: ${counts.connected ?? 0}, disconnected: ${counts.disconnected ?? 0}, errored: ${counts.error ?? 0}`;

  return { success: true, output: `${header}\n\n${lines.join("\n")}` };
};

// Get Business Settings — master-agent view of one business. CEO callers
// could also use this to learn about their own business, but they already
// see most of this in their YOUR ORG STATE block; we don't restrict it
// because there's no privacy concern within the same org.
const handleGetBusinessSettings: ToolHandler = async (args) => {
  const businessArg = String(args.business || "").trim();
  const organizationId = String(args._organizationId || "");

  if (!businessArg) {
    return { success: false, output: "", error: "`business` is required." };
  }
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error: "Missing organization context — get_business_settings requires authenticated chat."
    };
  }

  // Try id first, then name fuzzy.
  let business = await db.business.findFirst({
    where: { id: businessArg, organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      summary: true,
      safetyMode: true,
      primaryModel: true,
      fallbackModel: true,
      modelSource: true,
      jurisdiction: true,
      tradingMode: true,
      dealMode: true,
      globalPaused: true,
      pausedReason: true,
      autoApproveExternalActions: true,
      config: true,
      operatorName: true,
      escalationContactName: true
    }
  });

  if (!business) {
    business = await db.business.findFirst({
      where: {
        organizationId,
        name: { contains: businessArg, mode: "insensitive" }
      },
      select: {
        id: true,
        name: true,
        status: true,
        summary: true,
        safetyMode: true,
        primaryModel: true,
        fallbackModel: true,
        modelSource: true,
        jurisdiction: true,
        tradingMode: true,
        dealMode: true,
        globalPaused: true,
        pausedReason: true,
        autoApproveExternalActions: true,
        config: true,
        operatorName: true,
        escalationContactName: true
      }
    });
  }

  if (!business) {
    return { success: false, output: "", error: `No business in this org matches "${businessArg}".` };
  }

  const { parseSubAgentPolicy } = await import("@/lib/sub-agent-policy");
  const policy = parseSubAgentPolicy(business.config);

  // Integration counts for this business.
  const allIntegrations = await db.integration.findMany({
    where: { organizationId },
    select: { status: true, scope: true, assignedBusinessIds: true }
  });
  const visibleIntegrations = allIntegrations.filter((i) =>
    i.scope !== "business" ? true : (i.assignedBusinessIds ?? []).includes(business!.id)
  );
  const intCounts = visibleIntegrations.reduce(
    (acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const lines = [
    `🏢 **${business.name}** [${business.status}] — id: ${business.id}`,
    business.summary ? business.summary : "",
    "",
    `**Operator**: ${business.operatorName ?? "(unset)"} | **Escalation**: ${business.escalationContactName ?? "(unset)"}`,
    `**Model**: primary=${business.primaryModel ?? "(system default)"} | fallback=${business.fallbackModel ?? "(none)"} | source=${business.modelSource}`,
    `**Safety mode**: ${business.safetyMode}`,
    `**Auto-approve external actions**: ${business.autoApproveExternalActions}`,
    `**Global paused**: ${business.globalPaused}${business.pausedReason ? ` (${business.pausedReason})` : ""}`,
    business.jurisdiction ? `**Jurisdiction**: ${business.jurisdiction}` : "",
    `**Trading mode**: ${business.tradingMode} | **Deal mode**: ${business.dealMode}`,
    "",
    `**Sub-agent policy**: ${policy.enabled ? `ENABLED — depth≤${policy.maxDepth}, ≤${policy.maxChildrenPerAgent}/parent, ≤${policy.maxSubAgentsPerBusiness} total, modelStrategy=${policy.defaultModelStrategy}, recursive=${policy.allowRecursiveSpawning}, humanApproval=${policy.requireHumanApproval}, autoDisable=${policy.autoDisableAfterMinutes}min` : "DISABLED"}`,
    `**Integrations**: connected=${intCounts.connected ?? 0}, disconnected=${intCounts.disconnected ?? 0}, errored=${intCounts.error ?? 0}`
  ].filter(Boolean);

  return { success: true, output: lines.join("\n") };
};

// Learn From Outcome — structured learning tool for continuous improvement
const handleLearnFromOutcome: ToolHandler = async (args) => {
  const task = String(args.task || "");
  const outcome = String(args.outcome || "");
  const whatWorked = String(args.what_worked || "");
  const whatDidnt = String(args.what_didnt_work || "");
  const nextTime = String(args.next_time || "");

  if (!task || !outcome) {
    return { success: false, output: "", error: "task and outcome are required." };
  }

  const learningContent = [
    `TASK: ${task}`,
    `OUTCOME: ${outcome}`,
    whatWorked ? `WHAT WORKED: ${whatWorked}` : "",
    whatDidnt ? `WHAT DIDN'T WORK: ${whatDidnt}` : "",
    nextTime ? `NEXT TIME: ${nextTime}` : ""
  ].filter(Boolean).join(" | ");

  try {
    const { createAgentMemoryWithEmbedding } = await import(
      "@/lib/repository/memory"
    );
    await createAgentMemoryWithEmbedding({
      agentId: String(args._agentId || "system"),
      businessId: String(args._businessId || "system"),
      type: "task_outcome",
      content: learningContent,
      importance: 8,
      tier: "hot",
      metadata: {
        task,
        outcome,
        whatWorked,
        whatDidnt,
        nextTime,
        type: "learning"
      } as Prisma.InputJsonValue,
      organizationId: args._organizationId
        ? String(args._organizationId)
        : undefined
    });

    return {
      success: true,
      output: `📚 Learning recorded:\n• Task: ${task}\n• Outcome: ${outcome}${whatWorked ? `\n• What worked: ${whatWorked}` : ""}${whatDidnt ? `\n• What didn't work: ${whatDidnt}` : ""}${nextTime ? `\n• Next time: ${nextTime}` : ""}\n\nThis insight will inform future decisions.`
    };
  } catch {
    return {
      success: true,
      output: `📚 Learning noted:\n• Task: ${task}\n• Outcome: ${outcome}${whatWorked ? `\n• What worked: ${whatWorked}` : ""}${whatDidnt ? `\n• What didn't work: ${whatDidnt}` : ""}\n\nI'll apply this insight in future conversations.`
    };
  }
};

// ── Reddit (read-only + draft logging) ───────────────────────────
//
// Uses Reddit's public .json endpoints — no OAuth required for reading.
// Writing (reddit_post_comment / reddit_submit_post) intentionally remains
// unimplemented because Reddit shadowbans fast and a wrong reply damages
// the user's brand. Instead, the agent drafts replies and calls
// log_reddit_target to queue them for human review in /admin/reddit.

const REDDIT_UA =
  "MissionControl/1.0 (+https://ghostprotoclaw.com; content-discovery)";

function stripMarkup(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function truncateText(input: string, max: number) {
  const normalized = stripMarkup(input);
  return normalized.length > max ? normalized.slice(0, max) + "…" : normalized;
}

type RedditPost = {
  id: string;
  subreddit: string;
  title: string;
  author: string;
  url: string;
  permalink: string;
  selftext: string;
  score: number;
  numComments: number;
  createdAt: string;
  ageHours: number;
};

function mapRedditChild(child: unknown): RedditPost | null {
  if (!child || typeof child !== "object") return null;
  const data = (child as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== "object") return null;
  const createdUtc =
    typeof data.created_utc === "number" ? data.created_utc : null;
  if (!createdUtc) return null;
  const ageHours = (Date.now() / 1000 - createdUtc) / 3600;
  return {
    id: String(data.id ?? ""),
    subreddit: String(data.subreddit ?? ""),
    title: truncateText(String(data.title ?? ""), 200),
    author: String(data.author ?? ""),
    url: String(data.url ?? ""),
    permalink: `https://www.reddit.com${String(data.permalink ?? "")}`,
    selftext: truncateText(String(data.selftext ?? ""), 600),
    score: typeof data.score === "number" ? data.score : 0,
    numComments:
      typeof data.num_comments === "number" ? data.num_comments : 0,
    createdAt: new Date(createdUtc * 1000).toISOString(),
    ageHours: Math.round(ageHours * 10) / 10
  };
}

async function fetchReddit(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": REDDIT_UA,
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(
      `Reddit ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
    );
  }
  return response.json();
}

const handleRedditSearch: ToolHandler = async (args) => {
  const subreddits = Array.isArray(args.subreddits)
    ? (args.subreddits as unknown[])
        .map((s) => String(s ?? "").replace(/^r\//, "").trim())
        .filter(Boolean)
    : [];
  const keywords = Array.isArray(args.keywords)
    ? (args.keywords as unknown[])
        .map((k) => String(k ?? "").trim())
        .filter(Boolean)
    : typeof args.query === "string"
      ? [String(args.query).trim()].filter(Boolean)
      : [];
  const timeWindow = ["hour", "day", "week", "month", "year"].includes(
    String(args.timeWindow ?? "")
  )
    ? String(args.timeWindow)
    : "day";
  const minScore =
    typeof args.minScore === "number" ? Number(args.minScore) : 0;
  const perSubLimit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 25))
      : 15;
  const sort = ["new", "relevance", "top", "hot"].includes(
    String(args.sort ?? "")
  )
    ? String(args.sort)
    : "new";

  if (keywords.length === 0) {
    return {
      success: false,
      output: "",
      error:
        "reddit_search requires at least one keyword (pass `keywords: [...]` or `query: \"...\"`)."
    };
  }

  const query = keywords.map((k) => `"${k.replace(/"/g, "")}"`).join(" OR ");
  const targets = subreddits.length > 0 ? subreddits : [null];

  const seen = new Set<string>();
  const posts: RedditPost[] = [];
  const errors: string[] = [];

  for (const sub of targets) {
    const base = sub
      ? `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json`
      : "https://www.reddit.com/search.json";
    const params = new URLSearchParams({
      q: query,
      sort,
      t: timeWindow,
      limit: String(perSubLimit),
      ...(sub ? { restrict_sr: "on" } : {})
    });
    try {
      const data = (await fetchReddit(`${base}?${params.toString()}`)) as {
        data?: { children?: unknown[] };
      };
      const children = data.data?.children ?? [];
      for (const child of children) {
        const post = mapRedditChild(child);
        if (!post) continue;
        if (seen.has(post.permalink)) continue;
        if (post.score < minScore) continue;
        seen.add(post.permalink);
        posts.push(post);
      }
    } catch (err) {
      errors.push(
        `${sub ?? "all-of-reddit"}: ${err instanceof Error ? err.message : "error"}`
      );
    }
  }

  posts.sort((a, b) => a.ageHours - b.ageHours);
  const limited = posts.slice(0, Math.min(perSubLimit * 2, 50));

  const summary = {
    searched: {
      subreddits: subreddits.length > 0 ? subreddits : ["__all__"],
      keywords,
      timeWindow,
      minScore,
      sort
    },
    matchCount: limited.length,
    errors: errors.length > 0 ? errors : undefined,
    posts: limited
  };

  return {
    success: true,
    output: JSON.stringify(summary)
  };
};

const handleRedditThreadScan: ToolHandler = async (args) => {
  const permalinkOrId = String(args.permalink || args.postId || args.url || "");
  if (!permalinkOrId) {
    return {
      success: false,
      output: "",
      error:
        "reddit_thread_scan requires either `permalink` (full URL) or `postId`."
    };
  }
  const topN =
    typeof args.topComments === "number"
      ? Math.max(1, Math.min(Number(args.topComments), 25))
      : 10;

  let url: string;
  if (/^https?:\/\//i.test(permalinkOrId)) {
    url =
      permalinkOrId.replace(/\/?$/, "").replace(/\.json$/i, "") + ".json?limit=" + topN;
  } else {
    url = `https://www.reddit.com/comments/${encodeURIComponent(permalinkOrId)}.json?limit=${topN}`;
  }

  try {
    const data = (await fetchReddit(url)) as unknown[];
    if (!Array.isArray(data) || data.length < 2) {
      return {
        success: false,
        output: "",
        error: "Unexpected Reddit thread shape."
      };
    }
    const postListing = data[0] as { data?: { children?: unknown[] } };
    const commentListing = data[1] as { data?: { children?: unknown[] } };
    const post = mapRedditChild(postListing.data?.children?.[0]);
    const comments = (commentListing.data?.children ?? [])
      .map((child) => {
        const cd = (child as { data?: Record<string, unknown> }).data;
        if (!cd || typeof cd !== "object") return null;
        if (cd.body == null) return null;
        return {
          author: String(cd.author ?? ""),
          score: typeof cd.score === "number" ? cd.score : 0,
          body: truncateText(String(cd.body ?? ""), 500)
        };
      })
      .filter(Boolean)
      .slice(0, topN);

    return {
      success: true,
      output: JSON.stringify({
        post,
        comments
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `reddit_thread_scan failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Reddit ground-truth verification ─────────────────────────────
//
// Agents repeatedly hallucinated "post was published" based on a
// middleman platform's (Zernio/Ayrshare/etc.) internal status. Reddit
// shadow-bans API posts silently — the post shows "published" in
// our logs but isn't on the user's profile. These tools let agents
// verify against Reddit itself before claiming success.

const handleRedditGetUserPosts: ToolHandler = async (args) => {
  const username = String(args.username || "").replace(/^u\//i, "").trim();
  if (!username) {
    return {
      success: false,
      output: "",
      error: "reddit_get_user_posts requires `username` (no u/ prefix)."
    };
  }
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 100))
      : 25;
  const timeWindow = ["hour", "day", "week", "month", "year", "all"].includes(
    String(args.timeWindow ?? "")
  )
    ? String(args.timeWindow)
    : "week";
  const kind = String(args.kind || "submitted"); // submitted | comments | overview
  const validKinds = new Set(["submitted", "comments", "overview"]);
  const finalKind = validKinds.has(kind) ? kind : "submitted";

  const url = `https://www.reddit.com/user/${encodeURIComponent(username)}/${finalKind}.json?limit=${limit}&t=${timeWindow}`;
  try {
    const data = (await fetchReddit(url)) as {
      data?: { children?: unknown[] };
    };
    const children = data.data?.children ?? [];
    const items = children
      .map((child) => {
        const c = child as { kind?: string; data?: Record<string, unknown> };
        const d = c.data;
        if (!d || typeof d !== "object") return null;
        return {
          type: c.kind,
          id: String(d.id ?? ""),
          subreddit: String(d.subreddit ?? ""),
          title: d.title ? String(d.title).slice(0, 200) : null,
          body: d.body ? truncateText(String(d.body), 300) : null,
          selftext: d.selftext
            ? truncateText(String(d.selftext), 300)
            : null,
          permalink: d.permalink
            ? `https://www.reddit.com${String(d.permalink)}`
            : null,
          url: d.url ? String(d.url) : null,
          score: typeof d.score === "number" ? d.score : null,
          numComments:
            typeof d.num_comments === "number" ? d.num_comments : null,
          createdUtc:
            typeof d.created_utc === "number"
              ? new Date(d.created_utc * 1000).toISOString()
              : null,
          removed: d.removed_by_category
            ? String(d.removed_by_category)
            : null,
          approved: d.approved === true
        };
      })
      .filter(Boolean);
    return {
      success: true,
      output: JSON.stringify({
        username,
        kind: finalKind,
        timeWindow,
        count: items.length,
        items,
        note:
          items.length === 0
            ? "Zero items returned for this user + kind + window. Either (a) the account has nothing in this range, (b) posts were removed/shadowbanned by Reddit, or (c) the username is wrong. If you submitted content via a third-party platform and it's NOT here, Reddit did not actually post it — do NOT tell the user it was published."
            : "These are the posts Reddit actually shows for this user. If our logs say we published something that's NOT here, our logs are wrong — the third-party API call succeeded but Reddit rejected or shadow-banned the post."
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `reddit_get_user_posts failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleVerifyRedditPost: ToolHandler = async (args) => {
  const rawUrl = String(args.url || "").trim();
  if (!rawUrl) {
    return {
      success: false,
      output: "",
      error: "verify_reddit_post requires `url` (full Reddit permalink)."
    };
  }
  const match = rawUrl.match(/reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
  if (!match) {
    return {
      success: false,
      output: "",
      error:
        "URL doesn't look like a Reddit post permalink. Expected format: https://www.reddit.com/r/<sub>/comments/<id>/..."
    };
  }
  const [, subreddit, postId] = match;
  const jsonUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/comments/${postId}.json`;
  try {
    const data = (await fetchReddit(jsonUrl)) as unknown[];
    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: true,
        output: JSON.stringify({
          url: rawUrl,
          exists: false,
          reason:
            "Reddit returned no post for this URL. Either the post was removed, the URL is wrong, or Reddit shadow-banned the submission entirely."
        })
      };
    }
    const listing = data[0] as { data?: { children?: unknown[] } };
    const post = mapRedditChild(listing.data?.children?.[0]);
    if (!post) {
      return {
        success: true,
        output: JSON.stringify({
          url: rawUrl,
          exists: false,
          reason: "Post shape unrecognized — likely removed or never visible."
        })
      };
    }
    const raw =
      (listing.data?.children?.[0] as { data?: Record<string, unknown> })
        ?.data ?? {};
    const removed = raw.removed_by_category
      ? String(raw.removed_by_category)
      : null;
    const author = String(raw.author ?? "[deleted]");
    return {
      success: true,
      output: JSON.stringify({
        url: rawUrl,
        exists: true,
        post,
        author,
        removed,
        visible: !removed && author !== "[deleted]",
        note: removed
          ? `Post exists but was removed (reason: ${removed}). Not visible on Reddit.`
          : "Post exists and appears visible. If the author says they don't see it, ask them to check from a logged-out browser or incognito — they may be shadow-banned at account level."
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `verify_reddit_post failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Hacker News ──────────────────────────────────────────────────
//
// Uses Algolia's HN Search API (official, free, generous quotas, no auth).
// https://hn.algolia.com/api

const HN_UA = "MissionControl/1.0 (+https://ghostprotoclaw.com; discovery)";

type HnHit = {
  id: string;
  title: string;
  author: string;
  url: string | null;
  hnUrl: string;
  points: number;
  numComments: number;
  createdAt: string;
  ageHours: number;
  storyText: string;
  commentText: string;
  tags: string[];
};

function mapHnHit(hit: unknown): HnHit | null {
  if (!hit || typeof hit !== "object") return null;
  const h = hit as Record<string, unknown>;
  const id = String(h.objectID ?? "");
  const createdAt = typeof h.created_at === "string" ? h.created_at : null;
  if (!id || !createdAt) return null;
  const createdTs = Date.parse(createdAt);
  const ageHours = (Date.now() - createdTs) / 3600000;
  return {
    id,
    title: truncateText(String(h.title ?? h.story_title ?? ""), 200),
    author: String(h.author ?? ""),
    url:
      typeof h.url === "string" && h.url.length > 0
        ? String(h.url)
        : typeof h.story_url === "string"
          ? String(h.story_url)
          : null,
    hnUrl: `https://news.ycombinator.com/item?id=${id}`,
    points: typeof h.points === "number" ? h.points : 0,
    numComments: typeof h.num_comments === "number" ? h.num_comments : 0,
    createdAt,
    ageHours: Math.round(ageHours * 10) / 10,
    storyText: truncateText(String(h.story_text ?? ""), 600),
    commentText: truncateText(String(h.comment_text ?? ""), 600),
    tags: Array.isArray(h._tags)
      ? (h._tags as unknown[]).map((t) => String(t))
      : []
  };
}

const handleHackerNewsSearch: ToolHandler = async (args) => {
  const keywords = Array.isArray(args.keywords)
    ? (args.keywords as unknown[]).map((k) => String(k ?? "").trim()).filter(Boolean)
    : typeof args.query === "string"
      ? [String(args.query).trim()].filter(Boolean)
      : [];
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 50))
      : 25;
  const sort = String(args.sort ?? "") === "relevance" ? "search" : "search_by_date";
  const kinds = Array.isArray(args.kinds)
    ? (args.kinds as unknown[]).map((k) => String(k))
    : ["story", "comment"];
  const timeWindow = ["hour", "day", "week", "month", "year"].includes(
    String(args.timeWindow ?? "")
  )
    ? String(args.timeWindow)
    : "day";
  const minPoints =
    typeof args.minPoints === "number" ? Number(args.minPoints) : 0;

  if (keywords.length === 0) {
    return {
      success: false,
      output: "",
      error: "hn_search requires `keywords` or `query`."
    };
  }

  const windowSeconds: Record<string, number> = {
    hour: 3600,
    day: 86400,
    week: 86400 * 7,
    month: 86400 * 30,
    year: 86400 * 365
  };
  const minCreatedAt = Math.floor(
    (Date.now() - (windowSeconds[timeWindow] ?? 86400) * 1000) / 1000
  );

  const query = keywords.join(" OR ");
  const tags = kinds.length ? `(${kinds.join(",")})` : "(story,comment)";

  const base = `https://hn.algolia.com/api/v1/${sort}`;
  const params = new URLSearchParams({
    query,
    tags,
    numericFilters: `created_at_i>${minCreatedAt}${
      minPoints > 0 ? `,points>=${minPoints}` : ""
    }`,
    hitsPerPage: String(limit)
  });

  try {
    const response = await fetch(`${base}?${params.toString()}`, {
      headers: { "User-Agent": HN_UA, Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`HN ${response.status}`);
    }
    const data = (await response.json()) as { hits?: unknown[] };
    const hits = (data.hits ?? [])
      .map(mapHnHit)
      .filter((h): h is HnHit => h !== null);

    return {
      success: true,
      output: JSON.stringify({
        searched: { keywords, kinds, timeWindow, minPoints, sort },
        matchCount: hits.length,
        hits
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `hn_search failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleHackerNewsThreadScan: ToolHandler = async (args) => {
  const id = String(args.id || args.itemId || "");
  const max =
    typeof args.maxKids === "number"
      ? Math.max(1, Math.min(Number(args.maxKids), 30))
      : 15;
  if (!id) {
    return {
      success: false,
      output: "",
      error: "hn_thread_scan requires `id` (HN item id)."
    };
  }
  try {
    const rootResp = await fetch(
      `https://hacker-news.firebaseio.com/v0/item/${encodeURIComponent(id)}.json`,
      { headers: { "User-Agent": HN_UA, Accept: "application/json" } }
    );
    if (!rootResp.ok) throw new Error(`HN ${rootResp.status}`);
    const root = (await rootResp.json()) as Record<string, unknown> | null;
    if (!root) {
      return { success: false, output: "", error: "Item not found." };
    }
    const kidIds = Array.isArray(root.kids)
      ? (root.kids as unknown[]).slice(0, max).map((n) => String(n))
      : [];
    const kids = await Promise.all(
      kidIds.map(async (kid) => {
        try {
          const r = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${kid}.json`,
            { headers: { "User-Agent": HN_UA, Accept: "application/json" } }
          );
          if (!r.ok) return null;
          const k = (await r.json()) as Record<string, unknown> | null;
          if (!k) return null;
          return {
            id: String(k.id ?? kid),
            author: String(k.by ?? ""),
            text: truncateText(String(k.text ?? ""), 500)
          };
        } catch {
          return null;
        }
      })
    );
    return {
      success: true,
      output: JSON.stringify({
        post: {
          id: String(root.id ?? id),
          title: truncateText(String(root.title ?? ""), 200),
          author: String(root.by ?? ""),
          url:
            typeof root.url === "string"
              ? root.url
              : `https://news.ycombinator.com/item?id=${id}`,
          text: truncateText(String(root.text ?? ""), 800),
          score: typeof root.score === "number" ? root.score : 0,
          descendants:
            typeof root.descendants === "number" ? root.descendants : 0
        },
        kids: kids.filter(Boolean)
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `hn_thread_scan failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Stack Overflow ───────────────────────────────────────────────
//
// Uses the StackExchange API. Unauthenticated gets 300 req/day per IP —
// plenty for one-or-two-daily scans. Users can raise this by setting
// STACKEXCHANGE_KEY env var (10k/day).

type StackHit = {
  questionId: number;
  title: string;
  link: string;
  tags: string[];
  score: number;
  isAnswered: boolean;
  answerCount: number;
  viewCount: number;
  createdAt: string;
  ageHours: number;
  excerpt: string;
  author: string;
  site: string;
};

const handleStackOverflowSearch: ToolHandler = async (args) => {
  const keywords = Array.isArray(args.keywords)
    ? (args.keywords as unknown[]).map((k) => String(k ?? "").trim()).filter(Boolean)
    : typeof args.query === "string"
      ? [String(args.query).trim()].filter(Boolean)
      : [];
  const tagsArg = Array.isArray(args.tags)
    ? (args.tags as unknown[]).map((t) => String(t ?? "").trim()).filter(Boolean)
    : [];
  const site = String(args.site || "stackoverflow");
  const timeWindow = ["hour", "day", "week", "month", "year"].includes(
    String(args.timeWindow ?? "")
  )
    ? String(args.timeWindow)
    : "week";
  const minScore =
    typeof args.minScore === "number" ? Number(args.minScore) : -5;
  const answered =
    typeof args.answered === "boolean" ? Boolean(args.answered) : null;
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 50))
      : 20;

  if (keywords.length === 0 && tagsArg.length === 0) {
    return {
      success: false,
      output: "",
      error: "stackoverflow_search requires at least one of `keywords` or `tags`."
    };
  }

  const windowSeconds: Record<string, number> = {
    hour: 3600,
    day: 86400,
    week: 86400 * 7,
    month: 86400 * 30,
    year: 86400 * 365
  };
  const fromDate = Math.floor(
    (Date.now() - (windowSeconds[timeWindow] ?? 86400 * 7) * 1000) / 1000
  );

  const params = new URLSearchParams({
    order: "desc",
    sort: "creation",
    site,
    fromdate: String(fromDate),
    pagesize: String(limit),
    filter: "withbody"
  });
  if (keywords.length > 0) params.set("q", keywords.join(" "));
  if (tagsArg.length > 0) params.set("tagged", tagsArg.join(";"));
  if (answered !== null) params.set("accepted", answered ? "True" : "False");
  const key = process.env.STACKEXCHANGE_KEY?.trim();
  if (key) params.set("key", key);

  try {
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?${params.toString()}`,
      { headers: { "User-Agent": HN_UA, Accept: "application/json" } }
    );
    if (!response.ok) {
      throw new Error(`StackExchange ${response.status}`);
    }
    const data = (await response.json()) as {
      items?: Array<Record<string, unknown>>;
    };
    const items = data.items ?? [];
    const hits: StackHit[] = items
      .map((item) => {
        const createdEpoch =
          typeof item.creation_date === "number" ? item.creation_date : 0;
        const score = typeof item.score === "number" ? item.score : 0;
        if (score < minScore) return null;
        const ageHours = (Date.now() / 1000 - createdEpoch) / 3600;
        return {
          questionId:
            typeof item.question_id === "number" ? item.question_id : 0,
          title: truncateText(String(item.title ?? ""), 200),
          link: String(item.link ?? ""),
          tags: Array.isArray(item.tags)
            ? (item.tags as unknown[]).map((t) => String(t))
            : [],
          score,
          isAnswered:
            typeof item.is_answered === "boolean" ? item.is_answered : false,
          answerCount:
            typeof item.answer_count === "number" ? item.answer_count : 0,
          viewCount:
            typeof item.view_count === "number" ? item.view_count : 0,
          createdAt: new Date(createdEpoch * 1000).toISOString(),
          ageHours: Math.round(ageHours * 10) / 10,
          excerpt: truncateText(String(item.body ?? ""), 600),
          author: String(
            (item.owner as Record<string, unknown> | undefined)?.display_name ??
              ""
          ),
          site
        } satisfies StackHit;
      })
      .filter((h): h is StackHit => h !== null);

    return {
      success: true,
      output: JSON.stringify({
        searched: { keywords, tags: tagsArg, site, timeWindow, minScore, answered },
        matchCount: hits.length,
        hits
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `stackoverflow_search failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── GitHub Issues / Discussions ─────────────────────────────────
//
// Uses the GitHub Search API. Unauthenticated: 30 req/min per IP.
// Authenticated via GITHUB_TOKEN env var raises this to 5000/hour.

const handleGitHubSearchIssues: ToolHandler = async (args) => {
  const keywords = Array.isArray(args.keywords)
    ? (args.keywords as unknown[]).map((k) => String(k ?? "").trim()).filter(Boolean)
    : typeof args.query === "string"
      ? [String(args.query).trim()].filter(Boolean)
      : [];
  const repos = Array.isArray(args.repos)
    ? (args.repos as unknown[]).map((r) => String(r ?? "").trim()).filter(Boolean)
    : [];
  const language = typeof args.language === "string" ? String(args.language) : "";
  const labels = Array.isArray(args.labels)
    ? (args.labels as unknown[]).map((l) => String(l ?? "").trim()).filter(Boolean)
    : [];
  const isOpen = typeof args.isOpen === "boolean" ? Boolean(args.isOpen) : true;
  const kind = String(args.kind || "issue"); // issue, pr, or any
  const timeWindow = ["hour", "day", "week", "month", "year"].includes(
    String(args.timeWindow ?? "")
  )
    ? String(args.timeWindow)
    : "week";
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 50))
      : 25;

  if (keywords.length === 0 && repos.length === 0) {
    return {
      success: false,
      output: "",
      error: "github_search_issues requires at least one of `keywords` or `repos`."
    };
  }

  const windowSeconds: Record<string, number> = {
    hour: 3600,
    day: 86400,
    week: 86400 * 7,
    month: 86400 * 30,
    year: 86400 * 365
  };
  const since = new Date(
    Date.now() - (windowSeconds[timeWindow] ?? 86400 * 7) * 1000
  )
    .toISOString()
    .split("T")[0];

  const qParts: string[] = [];
  if (keywords.length > 0) qParts.push(keywords.join(" "));
  for (const repo of repos) qParts.push(`repo:${repo}`);
  if (language) qParts.push(`language:${language}`);
  for (const label of labels) qParts.push(`label:"${label}"`);
  qParts.push(kind === "any" ? "" : `is:${kind}`);
  qParts.push(isOpen ? "is:open" : "is:closed");
  qParts.push(`created:>=${since}`);

  const params = new URLSearchParams({
    q: qParts.filter(Boolean).join(" "),
    sort: "created",
    order: "desc",
    per_page: String(limit)
  });

  const headers: Record<string, string> = {
    "User-Agent": HN_UA,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const ghToken = process.env.GITHUB_TOKEN?.trim();
  if (ghToken) headers.Authorization = `Bearer ${ghToken}`;

  try {
    const response = await fetch(
      `https://api.github.com/search/issues?${params.toString()}`,
      { headers }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`GitHub ${response.status} ${text.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      items?: Array<Record<string, unknown>>;
    };
    const hits = (data.items ?? []).map((item) => {
      const createdAt =
        typeof item.created_at === "string" ? item.created_at : "";
      const ageHours = createdAt
        ? Math.round(((Date.now() - Date.parse(createdAt)) / 3600000) * 10) / 10
        : null;
      return {
        number: typeof item.number === "number" ? item.number : 0,
        title: truncateText(String(item.title ?? ""), 200),
        url: String(item.html_url ?? ""),
        repository: (() => {
          const u = String(item.repository_url ?? "");
          const m = u.match(/repos\/([^/]+\/[^/]+)/);
          return m ? m[1] : "";
        })(),
        author: String(
          (item.user as Record<string, unknown> | undefined)?.login ?? ""
        ),
        state: String(item.state ?? ""),
        isPr: Boolean((item as Record<string, unknown>).pull_request),
        comments: typeof item.comments === "number" ? item.comments : 0,
        labels: Array.isArray(item.labels)
          ? (item.labels as Array<Record<string, unknown>>).map((l) =>
              String(l?.name ?? "")
            )
          : [],
        createdAt,
        ageHours,
        excerpt: truncateText(String(item.body ?? ""), 600)
      };
    });
    return {
      success: true,
      output: JSON.stringify({
        searched: {
          keywords,
          repos,
          language,
          labels,
          kind,
          isOpen,
          timeWindow
        },
        authenticated: Boolean(ghToken),
        matchCount: hits.length,
        hits
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `github_search_issues failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Outreach target logging (platform-agnostic) ─────────────────
//
// Writes an ActivityEntry with type="outreach_target" and status="pending"
// carrying the platform in metadata.platform. The /admin/targets review
// UI renders any of these regardless of platform; legacy reddit_target
// entries are still picked up there too.

type OutreachPlatform =
  | "reddit"
  | "hackernews"
  | "stackoverflow"
  | "github"
  | "slack"
  | "other";

function normalizeOutreachPlatform(value: unknown): OutreachPlatform {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("hacker") || s === "hn") return "hackernews";
  if (s.includes("stack")) return "stackoverflow";
  if (s.includes("github") || s === "gh") return "github";
  if (s.includes("reddit")) return "reddit";
  if (s.includes("slack")) return "slack";
  if (!s) return "other";
  return "other";
}

function platformPrettyName(platform: OutreachPlatform): string {
  switch (platform) {
    case "reddit":
      return "Reddit";
    case "hackernews":
      return "Hacker News";
    case "stackoverflow":
      return "Stack Overflow";
    case "github":
      return "GitHub";
    case "slack":
      return "Slack";
    default:
      return "Outreach";
  }
}

type OutreachLogInput = {
  businessId: string;
  platform: OutreachPlatform;
  url: string;
  title: string;
  excerpt: string;
  draftReply: string;
  reasoning: string;
  score: number | null;
  author: string;
  community: string;
  platformExtras: Record<string, unknown>;
  agentId?: string;
};

// Outreach drafts live in /admin/approvals for 14 days by default.
// Long enough to review after a vacation, short enough to auto-expire
// stale suggestions on the nightly expireStaleApprovals sweep.
const OUTREACH_APPROVAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

async function createOutreachTarget(
  input: OutreachLogInput
): Promise<
  | { success: true; output: string }
  | { success: false; output: string; error: string }
> {
  const { businessId, platform } = input;
  if (!input.url || !input.draftReply || !input.title) {
    return {
      success: false,
      output: "",
      error:
        "An outreach target requires url, title, and draftReply at minimum."
    };
  }

  const pretty = platformPrettyName(platform);
  const communityLabel = input.community
    ? platform === "reddit"
      ? `r/${input.community}`
      : input.community
    : "";
  const displayTitle = `${pretty}${communityLabel ? ` · ${communityLabel}` : ""} — ${input.title.slice(0, 120)}`;

  const metadata = {
    source: "outreach_target",
    platform,
    community: input.community,
    url: input.url,
    postTitle: input.title,
    postExcerpt: input.excerpt.slice(0, 1200),
    draftReply: input.draftReply.slice(0, 2000),
    reasoning: input.reasoning.slice(0, 800),
    score: input.score,
    authorHandle: input.author,
    // Keep these for back-compat with the old reddit-specific cards.
    ...(platform === "reddit" ? { subreddit: input.community } : {}),
    platformExtras: input.platformExtras
  };

  try {
    const existing = await db.activityEntry.findFirst({
      where: {
        businessId,
        type: { in: ["outreach_target", "reddit_target"] },
        title: {
          contains: input.title.slice(0, 80),
          mode: "insensitive"
        }
      },
      select: { id: true, status: true }
    });
    if (existing) {
      return {
        success: true,
        output: `Already logged (status=${existing.status}). Existing target id=${existing.id}.`
      };
    }

    const created = await db.activityEntry.create({
      data: {
        businessId,
        type: "outreach_target",
        title: displayTitle,
        detail: input.reasoning.slice(0, 300) || input.excerpt.slice(0, 300),
        status: "pending",
        // JSON-roundtrip so Prisma accepts the value as InputJsonValue —
        // platformExtras can be any shape the caller passed.
        metadata: JSON.parse(JSON.stringify(metadata))
      }
    });

    // Also create an ApprovalRequest so the draft shows up in the
    // /admin/approvals inbox with real approve/reject buttons. Without
    // this, drafts only lived as "pending" ActivityEntry rows, which
    // Pulse rendered with a spinner that looked stuck forever. The
    // approval's actionDetail carries a back-pointer to the activity
    // entry so approve/reject can flip the target to posted/dismissed.
    let approvalId: string | null = null;
    try {
      const approval = await db.approvalRequest.create({
        data: {
          businessId,
          agentId: input.agentId ?? null,
          actionType: "outreach_reply",
          actionDetail: JSON.parse(
            JSON.stringify({
              platform,
              community: input.community,
              communityLabel,
              url: input.url,
              postTitle: input.title,
              postExcerpt: input.excerpt.slice(0, 1200),
              draftReply: input.draftReply.slice(0, 2000),
              reasoning: input.reasoning.slice(0, 800),
              score: input.score,
              authorHandle: input.author,
              platformExtras: input.platformExtras,
              activityEntryId: created.id
            })
          ),
          status: "pending",
          reason: `Drafted ${pretty} reply awaiting your manual post.`,
          expiresAt: new Date(Date.now() + OUTREACH_APPROVAL_WINDOW_MS),
          requestedBy: input.agentId ?? "agent"
        }
      });
      approvalId = approval.id;
      await db.activityEntry.update({
        where: { id: created.id },
        data: {
          metadata: JSON.parse(
            JSON.stringify({ ...metadata, approvalRequestId: approval.id })
          )
        }
      });
    } catch (err) {
      // Approval creation is best-effort — the target still lives on
      // /admin/targets either way, but we log so the user can tell why
      // the Approvals inbox might be empty.
      console.error(
        "[log_outreach_target] failed to create ApprovalRequest:",
        err
      );
    }

    return {
      success: true,
      output:
        `Logged as ${pretty} outreach target id=${created.id}.` +
        (approvalId
          ? ` Approval request ${approvalId} created — review in /admin/approvals or /admin/targets.`
          : " Review in /admin/targets.")
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `log_outreach_target failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}

const handleLogOutreachTarget: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "log_outreach_target requires an authenticated agent context with a business."
    };
  }
  const agentId = args._agentId ? String(args._agentId) : undefined;
  const platform = normalizeOutreachPlatform(args.platform);
  const score =
    typeof args.score === "number"
      ? Math.max(1, Math.min(Math.round(Number(args.score)), 10))
      : null;
  return createOutreachTarget({
    businessId,
    platform,
    url: String(args.url || args.permalink || args.link || ""),
    title: String(args.title || args.postTitle || ""),
    excerpt: String(args.excerpt || args.postExcerpt || ""),
    draftReply: String(args.draftReply || args.draft || ""),
    reasoning: String(args.reasoning || ""),
    score,
    author: String(args.author || ""),
    community: String(
      args.community || args.subreddit || args.repo || args.site || args.tag || ""
    ).replace(/^r\//, ""),
    platformExtras:
      args.platformExtras && typeof args.platformExtras === "object"
        ? (args.platformExtras as Record<string, unknown>)
        : {},
    agentId
  });
};

/**
 * Back-compat alias. The old schema took subreddit/postTitle/etc; we
 * accept those fields and forward to the generalized logger with
 * platform="reddit". Agents calling log_reddit_target still work.
 */
const handleLogRedditTarget: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "log_reddit_target requires an authenticated agent context with a business."
    };
  }
  const agentId = args._agentId ? String(args._agentId) : undefined;
  const score =
    typeof args.score === "number"
      ? Math.max(1, Math.min(Math.round(Number(args.score)), 10))
      : null;
  return createOutreachTarget({
    businessId,
    platform: "reddit",
    url: String(args.url || args.permalink || ""),
    title: String(args.postTitle || args.title || ""),
    excerpt: String(args.postExcerpt || args.excerpt || ""),
    draftReply: String(args.draftReply || args.draft || ""),
    reasoning: String(args.reasoning || ""),
    score,
    author: String(args.author || ""),
    community: String(args.subreddit || "").replace(/^r\//, ""),
    platformExtras: {},
    agentId
  });
};

// ── Video transcript + clip mining ────────────────────────────────
//
// Phase 1 of the video-to-shorts flow: give agents a way to actually
// *read* a video (today they hallucinate understanding YouTube URLs)
// and queue timestamped clip suggestions the human can cut manually.
//
// No new npm deps — we hit YouTube's public caption endpoint via plain
// fetch so the build stays clean. Works on any public YouTube with
// captions (auto-generated included), which covers >95% of uploads.

const VIDEO_UA =
  "MissionControl/1.0 (+https://ghostprotoclaw.com; video-discovery)";

function extractYouTubeId(input: string): string | null {
  const trimmed = String(input || "").trim();
  if (!trimmed) return null;
  // Already an 11-char id?
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const shortsMatch = url.pathname.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
      const embedMatch = url.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
    }
  } catch {
    /* fall through */
  }
  const anyMatch = trimmed.match(/([A-Za-z0-9_-]{11})/);
  return anyMatch ? anyMatch[1] : null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const secs = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${mm.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${m}:${secs.toString().padStart(2, "0")}`;
}

type TranscriptSegment = {
  startSec: number;
  durSec: number;
  endSec: number;
  start: string;
  end: string;
  text: string;
};

type VideoMeta = {
  videoId: string;
  url: string;
  title: string;
  author: string;
  durationSec: number | null;
  language: string | null;
  captionKind: "manual" | "auto" | "unknown";
};

async function fetchYouTubeTranscript(
  videoId: string
): Promise<{ meta: VideoMeta; segments: TranscriptSegment[] }> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await (
    await fetch(watchUrl, {
      headers: { "User-Agent": VIDEO_UA, "Accept-Language": "en" }
    })
  ).text();

  // Extract ytInitialPlayerResponse JSON blob from the watch page.
  const playerResponseMatch =
    html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*var\s/s) ||
    html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*<\/script>/s);
  if (!playerResponseMatch) {
    throw new Error(
      "Could not find ytInitialPlayerResponse (video may be private, age-gated, or region-blocked)."
    );
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(playerResponseMatch[1]);
  } catch {
    throw new Error("Failed to parse YouTube player response JSON.");
  }

  const videoDetails =
    (parsed.videoDetails as Record<string, unknown> | undefined) ?? {};
  const captions = parsed.captions as
    | {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<Record<string, unknown>>;
        };
      }
    | undefined;
  const tracks =
    captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) {
    throw new Error(
      "This video has no captions (manual or auto-generated). Captions are required to transcribe."
    );
  }

  const preferred =
    tracks.find((t) => String(t.languageCode ?? "").startsWith("en")) ??
    tracks[0];
  const baseUrl = String(preferred.baseUrl ?? "");
  if (!baseUrl) {
    throw new Error("Caption track had no baseUrl.");
  }

  const captionXml = await (
    await fetch(baseUrl, {
      headers: { "User-Agent": VIDEO_UA }
    })
  ).text();

  // Parse <text start="1.2" dur="3.4">hello</text> entries.
  const segments: TranscriptSegment[] = [];
  const regex =
    /<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(captionXml)) !== null) {
    const startSec = Number.parseFloat(match[1]);
    const durSec = Number.parseFloat(match[2]);
    const rawText = match[3] ?? "";
    const text = decodeXmlEntities(rawText)
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    segments.push({
      startSec,
      durSec,
      endSec: startSec + durSec,
      start: formatTimestamp(startSec),
      end: formatTimestamp(startSec + durSec),
      text
    });
  }

  const kind =
    String(preferred.kind ?? "") === "asr" ? "auto" : "manual";

  return {
    meta: {
      videoId,
      url: watchUrl,
      title: String(videoDetails.title ?? ""),
      author: String(videoDetails.author ?? ""),
      durationSec:
        typeof videoDetails.lengthSeconds === "string"
          ? Number.parseInt(String(videoDetails.lengthSeconds), 10)
          : typeof videoDetails.lengthSeconds === "number"
            ? (videoDetails.lengthSeconds as number)
            : null,
      language: String(preferred.languageCode ?? "") || null,
      captionKind: kind
    },
    segments
  };
}

const handleFetchVideoTranscript: ToolHandler = async (args) => {
  const url = String(args.url || args.videoUrl || args.videoId || "");
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return {
      success: false,
      output: "",
      error:
        "fetch_video_transcript currently supports only YouTube (full URL, short URL, Shorts URL, or 11-char video id). Passed: " +
        url.slice(0, 200)
    };
  }
  const maxSegments =
    typeof args.maxSegments === "number"
      ? Math.max(10, Math.min(Number(args.maxSegments), 2000))
      : 800;
  const mergeGapSec =
    typeof args.mergeGapSec === "number"
      ? Math.max(0, Math.min(Number(args.mergeGapSec), 5))
      : 0;

  try {
    const { meta, segments } = await fetchYouTubeTranscript(videoId);
    // Optional gap-merge: auto-captions arrive as 1-2 second chunks.
    // Merging <= mergeGapSec makes the transcript more readable for the
    // LLM without losing timing precision (still keep startSec of the
    // first chunk).
    let merged = segments;
    if (mergeGapSec > 0 && segments.length > 0) {
      merged = [];
      let current = { ...segments[0] };
      for (let i = 1; i < segments.length; i++) {
        const next = segments[i];
        const gap = next.startSec - current.endSec;
        if (gap <= mergeGapSec) {
          current.endSec = next.endSec;
          current.durSec = current.endSec - current.startSec;
          current.end = formatTimestamp(current.endSec);
          current.text = `${current.text} ${next.text}`.trim();
        } else {
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);
    }
    const capped = merged.slice(0, maxSegments);
    return {
      success: true,
      output: JSON.stringify({
        meta,
        segmentCount: capped.length,
        truncated: merged.length > capped.length,
        segments: capped
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `fetch_video_transcript failed: ${
        err instanceof Error ? err.message : "unknown"
      }`
    };
  }
};

/**
 * The agent calls this after reading the transcript and picking one
 * clip-worthy segment. Same architecture as log_outreach_target —
 * writes an ActivityEntry (type="video_clip", status="pending") plus
 * a linked ApprovalRequest (actionType="video_clip") so it shows up in
 * Pulse, /admin/clips, AND /admin/approvals with bidirectional sync.
 */
const handleLogVideoClip: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "log_video_clip requires an authenticated agent context with a business."
    };
  }
  const agentId = args._agentId ? String(args._agentId) : null;
  const videoUrl = String(args.videoUrl || args.url || "");
  const videoTitle = String(args.videoTitle || args.title || "");
  const startSec =
    typeof args.startSec === "number" ? Number(args.startSec) : null;
  const endSec =
    typeof args.endSec === "number" ? Number(args.endSec) : null;
  const hookLine = String(args.hookLine || args.hook || "");
  const caption = String(args.caption || "");
  const targetPlatform = String(args.targetPlatform || "tiktok").toLowerCase();
  const aspectRatio = String(args.aspectRatio || "9:16");
  const reasoning = String(args.reasoning || "");
  const score =
    typeof args.score === "number"
      ? Math.max(1, Math.min(Math.round(Number(args.score)), 10))
      : null;
  const transcript = String(args.transcriptExcerpt || args.transcript || "");

  if (
    !videoUrl ||
    startSec === null ||
    endSec === null ||
    !hookLine ||
    !caption
  ) {
    return {
      success: false,
      output: "",
      error:
        "log_video_clip requires videoUrl, startSec, endSec, hookLine, and caption."
    };
  }
  if (endSec <= startSec) {
    return {
      success: false,
      output: "",
      error: "log_video_clip: endSec must be greater than startSec."
    };
  }

  const durationSec = Math.round((endSec - startSec) * 10) / 10;
  const startLabel = formatTimestamp(startSec);
  const endLabel = formatTimestamp(endSec);
  const displayTitle = `Clip: ${videoTitle ? videoTitle.slice(0, 80) + " · " : ""}${startLabel}–${endLabel} (${durationSec}s) · ${targetPlatform}`;

  const metadata = {
    source: "video_clip",
    videoUrl,
    videoTitle,
    startSec,
    endSec,
    startLabel,
    endLabel,
    durationSec,
    hookLine: hookLine.slice(0, 200),
    caption: caption.slice(0, 600),
    transcriptExcerpt: transcript.slice(0, 800),
    targetPlatform,
    aspectRatio,
    reasoning: reasoning.slice(0, 500),
    score
  };

  try {
    const existing = await db.activityEntry.findFirst({
      where: {
        businessId,
        type: "video_clip",
        title: { contains: displayTitle.slice(0, 60), mode: "insensitive" }
      },
      select: { id: true, status: true }
    });
    if (existing) {
      return {
        success: true,
        output: `Already logged (status=${existing.status}). Existing clip id=${existing.id}.`
      };
    }

    const created = await db.activityEntry.create({
      data: {
        businessId,
        type: "video_clip",
        title: displayTitle,
        detail: hookLine.slice(0, 280),
        status: "pending",
        metadata: JSON.parse(JSON.stringify(metadata))
      }
    });

    let approvalId: string | null = null;
    try {
      const approval = await db.approvalRequest.create({
        data: {
          businessId,
          agentId,
          actionType: "video_clip",
          actionDetail: JSON.parse(
            JSON.stringify({ ...metadata, activityEntryId: created.id })
          ),
          status: "pending",
          reason: `Clip suggestion awaiting your manual cut.`,
          expiresAt: new Date(Date.now() + OUTREACH_APPROVAL_WINDOW_MS),
          requestedBy: agentId ?? "agent"
        }
      });
      approvalId = approval.id;
      await db.activityEntry.update({
        where: { id: created.id },
        data: {
          metadata: JSON.parse(
            JSON.stringify({ ...metadata, approvalRequestId: approval.id })
          )
        }
      });
    } catch (err) {
      console.error(
        "[log_video_clip] failed to create ApprovalRequest:",
        err
      );
    }

    return {
      success: true,
      output:
        `Logged clip ${startLabel}–${endLabel} for ${targetPlatform} as id=${created.id}.` +
        (approvalId
          ? ` Review in /admin/clips or /admin/approvals.`
          : " Review in /admin/clips.")
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `log_video_clip failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── HeyGen (AI avatar talking-head video generation) ─────────────
//
// Docs: https://docs.heygen.com/
// Requires HEYGEN_API_KEY on Railway. The API is async — generate
// returns a video_id, then the agent polls check_video until ready.

/**
 * Uniform error shape for tools that aren't configured. Tells the
 * agent (and the user, via Pulse) exactly where to go to fix it: the
 * in-app Integrations page is the preferred path; env vars on Railway
 * are the advanced fallback.
 */
function missingConfigError(
  tool: string,
  integrationName: string,
  envVars: string[]
): ToolCallResult {
  return {
    success: false,
    output: "",
    error:
      `${tool} is not configured for this business. ` +
      `Add ${integrationName} under /admin/integrations (recommended) ` +
      `or set ${envVars.join(", ")} on Railway.`
  };
}

/** Integration-key → { dbField: envVar } map for every integration
 *  these tools depend on. Keep this in sync with integration-definitions.ts. */
const INTEGRATION_FIELD_MAP = {
  heygen: { api_key: "HEYGEN_API_KEY" },
  creatify: {
    api_id: "CREATIFY_API_ID",
    api_key: "CREATIFY_API_KEY"
  },
  auto_clip: {
    klap_api_key: "KLAP_API_KEY",
    opusclip_api_key: "OPUSCLIP_API_KEY"
  },
  pexels: { api_key: "PEXELS_API_KEY" },
  elevenlabs: {
    api_key: "ELEVENLABS_API_KEY",
    default_voice_id: "ELEVENLABS_DEFAULT_VOICE_ID",
    model_id: "ELEVENLABS_MODEL"
  },
  json2video: {
    api_key: "JSON2VIDEO_API_KEY",
    default_project_id: "JSON2VIDEO_PROJECT_ID"
  },
  youtube: {
    client_id: "YOUTUBE_CLIENT_ID",
    client_secret: "YOUTUBE_CLIENT_SECRET",
    refresh_token: "YOUTUBE_REFRESH_TOKEN",
    channel_id: "YOUTUBE_CHANNEL_ID",
    access_token: "YOUTUBE_ACCESS_TOKEN",
    access_token_expires_at: "YOUTUBE_ACCESS_TOKEN_EXPIRES_AT"
  },
  openai: {
    api_key: "OPENAI_API_KEY"
  },
  blotato: {
    api_key: "BLOTATO_API_KEY"
  },
  a_leads: {
    api_key: "A_LEADS_API_KEY"
  },
  rentcast: {
    api_key: "RENTCAST_API_KEY"
  },
  axesso_zillow: {
    subscription_key: "AXESSO_SUBSCRIPTION_KEY"
  },
  realie: {
    api_key: "REALIE_API_KEY"
  },
  attom: {
    api_key: "ATTOM_API_KEY"
  },
  browserbase: {
    api_key: "BROWSERBASE_API_KEY",
    project_id: "BROWSERBASE_PROJECT_ID"
  },
  apify: {
    api_key: "APIFY_API_KEY"
  },
  firecrawl: {
    api_key: "FIRECRAWL_API_KEY"
  }
} as const;

/**
 * Tool-name prefix → integration key. Used by executeTool to pull
 * org-scoped credentials from the Integration table and merge them into
 * the `secrets` argument the handler receives. Lets the admin paste an
 * API key in /admin/integrations and have all tools in the family pick
 * it up — without forcing each handler to call resolveIntegrationCredentials
 * directly.
 */
const INTEGRATION_KEY_FOR_TOOL: Record<string, string> = {
  blotato_: "blotato",
  a_leads_: "a_leads",
  rentcast_: "rentcast",
  axesso_zillow_: "axesso_zillow",
  realie_: "realie",
  attom_: "attom",
  browserbase_: "browserbase",
  apify_: "apify",
  firecrawl_: "firecrawl"
};

/** Match a tool name against the prefix map; "blotato_create_post" → "blotato_". */
function toolFamilyPrefix(toolName: string): string {
  const candidates = Object.keys(INTEGRATION_KEY_FOR_TOOL);
  for (const prefix of candidates) {
    if (toolName.startsWith(prefix)) return prefix;
  }
  return "";
}

async function heygenFetch(
  organizationId: string | undefined,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "heygen",
    INTEGRATION_FIELD_MAP.heygen
  );
  const apiKey = creds.api_key;
  if (!apiKey) throw new Error("HeyGen API key not configured");
  const response = await fetch(`https://api.heygen.com${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "X-Api-Key": apiKey,
      Accept: "application/json"
    }
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* empty */
  }
  return { ok: response.ok, status: response.status, body };
}

const handleHeygenListAvatars: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "heygen",
    INTEGRATION_FIELD_MAP.heygen
  );
  if (!creds.api_key) {
    return missingConfigError("heygen_list_avatars", "HeyGen", [
      "HEYGEN_API_KEY"
    ]);
  }
  try {
    const { ok, status, body } = await heygenFetch(organizationId, "/v2/avatars");
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `HeyGen ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const data = body as {
      data?: {
        avatars?: Array<Record<string, unknown>>;
        talking_photos?: Array<Record<string, unknown>>;
      };
    };
    const avatars = (data.data?.avatars ?? []).slice(0, 40).map((a) => ({
      avatar_id: String(a.avatar_id ?? ""),
      avatar_name: String(a.avatar_name ?? ""),
      gender: String(a.gender ?? ""),
      preview_image_url: String(a.preview_image_url ?? "")
    }));
    const photos = (data.data?.talking_photos ?? []).slice(0, 20).map((p) => ({
      talking_photo_id: String(p.talking_photo_id ?? ""),
      talking_photo_name: String(p.talking_photo_name ?? ""),
      preview_image_url: String(p.preview_image_url ?? "")
    }));
    return {
      success: true,
      output: JSON.stringify({ avatars, talkingPhotos: photos })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `heygen_list_avatars failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleHeygenGenerateVideo: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "heygen",
    INTEGRATION_FIELD_MAP.heygen
  );
  if (!creds.api_key) {
    return missingConfigError("heygen_generate_video", "HeyGen", [
      "HEYGEN_API_KEY"
    ]);
  }
  const avatarId = String(args.avatar_id || args.avatarId || "");
  const voiceId = String(args.voice_id || args.voiceId || "");
  const text = String(args.text || args.script || "");
  const title = String(args.title || "");
  if (!avatarId || !voiceId || !text) {
    return {
      success: false,
      output: "",
      error:
        "heygen_generate_video requires avatar_id, voice_id, and text. Call heygen_list_avatars first."
    };
  }
  if (text.length > 1500) {
    return {
      success: false,
      output: "",
      error:
        "heygen_generate_video: text must be <= 1500 chars for one scene. Split into multiple scenes."
    };
  }
  try {
    const { ok, status, body } = await heygenFetch(organizationId, "/v2/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: avatarId,
              avatar_style: "normal"
            },
            voice: {
              type: "text",
              input_text: text,
              voice_id: voiceId
            }
          }
        ],
        dimension: {
          width: 720,
          height: 1280
        },
        ...(title ? { title } : {})
      })
    });
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `HeyGen ${status}: ${JSON.stringify(body).slice(0, 300)}`
      };
    }
    const data = body as { data?: { video_id?: string } };
    const videoId = data.data?.video_id;
    if (!videoId) {
      return {
        success: false,
        output: "",
        error: "HeyGen accepted the request but returned no video_id."
      };
    }
    return {
      success: true,
      output: JSON.stringify({
        videoId,
        status: "processing",
        note: "Call heygen_check_video with this videoId every 30–60s until status=completed, then use the video_url."
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `heygen_generate_video failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleHeygenCheckVideo: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "heygen",
    INTEGRATION_FIELD_MAP.heygen
  );
  if (!creds.api_key) {
    return missingConfigError("heygen_check_video", "HeyGen", [
      "HEYGEN_API_KEY"
    ]);
  }
  const videoId = String(args.video_id || args.videoId || "");
  if (!videoId) {
    return {
      success: false,
      output: "",
      error: "heygen_check_video requires video_id."
    };
  }
  try {
    const { ok, status, body } = await heygenFetch(
      organizationId,
      `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `HeyGen ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const data = body as {
      data?: {
        status?: string;
        video_url?: string;
        thumbnail_url?: string;
        duration?: number;
        error?: unknown;
      };
    };
    return {
      success: true,
      output: JSON.stringify(data.data ?? {})
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `heygen_check_video failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Creatify (high-volume AI UGC avatar videos) ──────────────────
//
// Docs: https://docs.creatify.ai
// Auth: X-API-ID + X-API-KEY headers.

async function creatifyFetch(
  organizationId: string | undefined,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "creatify",
    INTEGRATION_FIELD_MAP.creatify
  );
  const apiId = creds.api_id;
  const apiKey = creds.api_key;
  if (!apiId || !apiKey) {
    throw new Error("Creatify credentials not configured");
  }
  const response = await fetch(`https://api.creatify.ai${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "X-API-ID": apiId,
      "X-API-KEY": apiKey,
      Accept: "application/json"
    }
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* empty */
  }
  return { ok: response.ok, status: response.status, body };
}

const handleCreatifyListAvatars: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "creatify",
    INTEGRATION_FIELD_MAP.creatify
  );
  if (!creds.api_id || !creds.api_key) {
    return missingConfigError("creatify_list_avatars", "Creatify", [
      "CREATIFY_API_ID",
      "CREATIFY_API_KEY"
    ]);
  }
  try {
    const { ok, status, body } = await creatifyFetch(organizationId, "/api/personas/");
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `Creatify ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const arr = Array.isArray(body) ? body : [];
    const personas = arr.slice(0, 60).map((p) => {
      const r = p as Record<string, unknown>;
      return {
        id: String(r.id ?? ""),
        name: String(r.creator_name ?? r.persona_name ?? ""),
        gender: String(r.gender ?? ""),
        preview_image_url: String(r.preview_image_url ?? r.thumbnail_url ?? "")
      };
    });
    return { success: true, output: JSON.stringify({ personas }) };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `creatify_list_avatars failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleCreatifyGenerateUgc: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "creatify",
    INTEGRATION_FIELD_MAP.creatify
  );
  if (!creds.api_id || !creds.api_key) {
    return missingConfigError("creatify_generate_ugc", "Creatify", [
      "CREATIFY_API_ID",
      "CREATIFY_API_KEY"
    ]);
  }
  const personaId = String(args.persona_id || args.personaId || "");
  const script = String(args.script || args.text || "");
  const name = String(args.name || "UGC video");
  const aspectRatio = String(args.aspect_ratio || args.aspectRatio || "9x16");
  if (!personaId || !script) {
    return {
      success: false,
      output: "",
      error:
        "creatify_generate_ugc requires persona_id and script. Call creatify_list_avatars first."
    };
  }
  try {
    const { ok, status, body } = await creatifyFetch(organizationId, "/api/lipsyncs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        script,
        creator: personaId,
        aspect_ratio: aspectRatio
      })
    });
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `Creatify ${status}: ${JSON.stringify(body).slice(0, 300)}`
      };
    }
    const data = (body as Record<string, unknown>) ?? {};
    const id = String(data.id ?? "");
    return {
      success: true,
      output: JSON.stringify({
        id,
        status: "queued",
        note: "Poll creatify_check_ugc with this id every 30–60s until status=done."
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `creatify_generate_ugc failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleCreatifyCheckUgc: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "creatify",
    INTEGRATION_FIELD_MAP.creatify
  );
  if (!creds.api_id || !creds.api_key) {
    return missingConfigError("creatify_check_ugc", "Creatify", [
      "CREATIFY_API_ID",
      "CREATIFY_API_KEY"
    ]);
  }
  const id = String(args.id || "");
  if (!id) {
    return {
      success: false,
      output: "",
      error: "creatify_check_ugc requires id."
    };
  }
  try {
    const { ok, status, body } = await creatifyFetch(
      organizationId,
      `/api/lipsyncs/${encodeURIComponent(id)}/`
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `Creatify ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    return { success: true, output: JSON.stringify(body ?? {}) };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `creatify_check_ugc failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Auto-clip (Klap, with Opus Clip hook) ────────────────────────
//
// Klap (https://klap.app) is the open-API auto-clip service — takes a
// long-form video URL, returns short clips with captions. Opus Clip's
// API is enterprise-gated; set KLAP_API_KEY to use Klap, or
// OPUSCLIP_API_KEY + OPUSCLIP_API_BASE later when you get their API
// access and I'll flip the provider.

type AutoClipProvider = "klap" | "opusclip" | null;

async function resolveAutoClipCredentials(
  organizationId: string | undefined
): Promise<{ provider: AutoClipProvider; apiKey: string | null }> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "auto_clip",
    INTEGRATION_FIELD_MAP.auto_clip
  );
  if (creds.klap_api_key) return { provider: "klap", apiKey: creds.klap_api_key };
  if (creds.opusclip_api_key)
    return { provider: "opusclip", apiKey: creds.opusclip_api_key };
  return { provider: null, apiKey: null };
}

async function klapFetch(
  apiKey: string,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(`https://api.klap.app/v2${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    }
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* empty */
  }
  return { ok: response.ok, status: response.status, body };
}

const handleAutoClipSubmit: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const { provider, apiKey } = await resolveAutoClipCredentials(organizationId);
  if (!provider || !apiKey) {
    return missingConfigError(
      "auto_clip_submit",
      "Auto-Clip (Klap or Opus Clip)",
      ["KLAP_API_KEY", "OPUSCLIP_API_KEY"]
    );
  }
  const videoUrl = String(args.video_url || args.videoUrl || "");
  if (!videoUrl) {
    return {
      success: false,
      output: "",
      error:
        "auto_clip_submit requires video_url (public URL of the long-form video)."
    };
  }
  const language = String(args.language || "en");
  const maxDuration =
    typeof args.max_duration === "number"
      ? Number(args.max_duration)
      : 60;

  if (provider === "klap") {
    try {
      const { ok, status, body } = await klapFetch(apiKey, "/tasks/video-to-shorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_video_url: videoUrl,
          language,
          max_duration: maxDuration,
          max_clip_count:
            typeof args.max_clips === "number" ? Number(args.max_clips) : 10
        })
      });
      if (!ok) {
        return {
          success: false,
          output: "",
          error: `Klap ${status}: ${JSON.stringify(body).slice(0, 300)}`
        };
      }
      const data = (body as Record<string, unknown>) ?? {};
      return {
        success: true,
        output: JSON.stringify({
          provider: "klap",
          taskId: String(data.id ?? ""),
          status: String(data.status ?? "queued"),
          note: "Poll auto_clip_check with taskId. Klap typically takes 2–5 min per long-form video."
        })
      };
    } catch (err) {
      return {
        success: false,
        output: "",
        error: `auto_clip_submit (klap) failed: ${err instanceof Error ? err.message : "unknown"}`
      };
    }
  }

  return {
    success: false,
    output: "",
    error:
      "Opus Clip API is gated. Build this endpoint wiring once you have their base URL and auth, or set KLAP_API_KEY to use Klap as the auto-clip provider."
  };
};

const handleAutoClipCheck: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const { provider, apiKey } = await resolveAutoClipCredentials(organizationId);
  if (!provider || !apiKey) {
    return missingConfigError(
      "auto_clip_check",
      "Auto-Clip (Klap or Opus Clip)",
      ["KLAP_API_KEY", "OPUSCLIP_API_KEY"]
    );
  }
  const taskId = String(args.task_id || args.taskId || "");
  if (!taskId) {
    return {
      success: false,
      output: "",
      error: "auto_clip_check requires task_id."
    };
  }
  if (provider === "klap") {
    try {
      const { ok, status, body } = await klapFetch(
        apiKey,
        `/tasks/${encodeURIComponent(taskId)}`
      );
      if (!ok) {
        return {
          success: false,
          output: "",
          error: `Klap ${status}: ${JSON.stringify(body).slice(0, 200)}`
        };
      }
      const data = (body as Record<string, unknown>) ?? {};
      return { success: true, output: JSON.stringify(data) };
    } catch (err) {
      return {
        success: false,
        output: "",
        error: `auto_clip_check (klap) failed: ${err instanceof Error ? err.message : "unknown"}`
      };
    }
  }
  return {
    success: false,
    output: "",
    error: "Opus Clip API wiring pending."
  };
};

// ── Pexels B-Roll search (free, commercial-use-allowed) ──────────
//
// Docs: https://www.pexels.com/api/documentation/
// Requires PEXELS_API_KEY (free self-serve at pexels.com/api/new).

const handleBrollSearch: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "pexels",
    INTEGRATION_FIELD_MAP.pexels
  );
  const apiKey = creds.api_key;
  if (!apiKey) {
    return missingConfigError("broll_search", "Pexels", ["PEXELS_API_KEY"]);
  }
  const keywords = Array.isArray(args.keywords)
    ? (args.keywords as unknown[]).map((k) => String(k ?? "").trim()).filter(Boolean)
    : typeof args.query === "string"
      ? [String(args.query).trim()]
      : [];
  if (keywords.length === 0) {
    return {
      success: false,
      output: "",
      error: "broll_search requires `keywords` or `query`."
    };
  }
  const orientation = ["portrait", "landscape", "square"].includes(
    String(args.orientation ?? "")
  )
    ? String(args.orientation)
    : "portrait";
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 30))
      : 15;
  const minDur =
    typeof args.minDurationSec === "number"
      ? Number(args.minDurationSec)
      : 4;
  const maxDur =
    typeof args.maxDurationSec === "number"
      ? Number(args.maxDurationSec)
      : 20;
  const query = keywords.join(" ");
  const params = new URLSearchParams({
    query,
    orientation,
    per_page: String(limit)
  });
  try {
    const response = await fetch(
      `https://api.pexels.com/videos/search?${params.toString()}`,
      {
        headers: {
          Authorization: apiKey,
          "User-Agent": VIDEO_UA,
          Accept: "application/json"
        }
      }
    );
    if (!response.ok) {
      return {
        success: false,
        output: "",
        error: `Pexels ${response.status}`
      };
    }
    const data = (await response.json()) as {
      videos?: Array<Record<string, unknown>>;
    };
    const hits = (data.videos ?? [])
      .map((v) => {
        const dur = typeof v.duration === "number" ? v.duration : 0;
        if (dur < minDur || dur > maxDur) return null;
        const files = Array.isArray(v.video_files)
          ? (v.video_files as Array<Record<string, unknown>>)
          : [];
        // Prefer HD mp4.
        const hd = files.find(
          (f) =>
            String(f.quality ?? "").toLowerCase() === "hd" &&
            String(f.file_type ?? "").includes("mp4")
        );
        const fallback = files.find((f) =>
          String(f.file_type ?? "").includes("mp4")
        );
        const chosen = hd ?? fallback;
        return {
          pexels_id: typeof v.id === "number" ? v.id : 0,
          pageUrl: String(v.url ?? ""),
          previewImage: String(v.image ?? ""),
          durationSec: dur,
          width:
            typeof chosen?.width === "number" ? (chosen.width as number) : null,
          height:
            typeof chosen?.height === "number"
              ? (chosen.height as number)
              : null,
          downloadUrl: String(chosen?.link ?? ""),
          photographer: String(
            (v.user as Record<string, unknown> | undefined)?.name ?? ""
          ),
          photographerUrl: String(
            (v.user as Record<string, unknown> | undefined)?.url ?? ""
          )
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      success: true,
      output: JSON.stringify({
        searched: { keywords, orientation, minDur, maxDur },
        matchCount: hits.length,
        attribution:
          "Videos from Pexels. Attribution optional but recommended (link to photographer page when feasible).",
        hits
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `broll_search failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── log_broll_scene: queue a B-roll + text overlay scene ─────────
//
// Same architecture as log_video_clip — writes an ActivityEntry
// (type="video_clip") AND a linked ApprovalRequest so scenes show up
// in /admin/clips + /admin/approvals. Different from log_video_clip
// in that the source isn't one long-form you're cutting — it's one or
// more B-roll URLs the agent sourced (Pexels or uploaded) + a text
// overlay sequence the human burns in during editing.

const handleLogBrollScene: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "log_broll_scene requires an authenticated agent context with a business."
    };
  }
  const agentId = args._agentId ? String(args._agentId) : null;
  const hookLine = String(args.hookLine || args.hook || "");
  const caption = String(args.caption || "");
  const overlays = Array.isArray(args.overlays) ? args.overlays : [];
  const brollClips = Array.isArray(args.brollClips) ? args.brollClips : [];
  const targetPlatform = String(args.targetPlatform || "tiktok").toLowerCase();
  const aspectRatio = String(args.aspectRatio || "9:16");
  const reasoning = String(args.reasoning || "");
  const score =
    typeof args.score === "number"
      ? Math.max(1, Math.min(Math.round(Number(args.score)), 10))
      : null;
  const totalDuration =
    typeof args.totalDurationSec === "number"
      ? Math.max(3, Math.min(Number(args.totalDurationSec), 120))
      : null;

  if (!hookLine || !caption || overlays.length === 0 || brollClips.length === 0) {
    return {
      success: false,
      output: "",
      error:
        "log_broll_scene requires hookLine, caption, at least one overlay, and at least one brollClip."
    };
  }

  const displayTitle = `B-Roll scene: ${hookLine.slice(0, 80)} (${targetPlatform})`;

  const metadata = {
    source: "broll_scene",
    kind: "broll_scene",
    hookLine: hookLine.slice(0, 200),
    caption: caption.slice(0, 600),
    overlays: overlays.slice(0, 20),
    brollClips: brollClips.slice(0, 10),
    targetPlatform,
    aspectRatio,
    totalDurationSec: totalDuration,
    reasoning: reasoning.slice(0, 500),
    score
  };

  try {
    const existing = await db.activityEntry.findFirst({
      where: {
        businessId,
        type: "video_clip",
        title: { contains: hookLine.slice(0, 60), mode: "insensitive" }
      },
      select: { id: true, status: true }
    });
    if (existing) {
      return {
        success: true,
        output: `Already logged (status=${existing.status}). Existing scene id=${existing.id}.`
      };
    }
    const created = await db.activityEntry.create({
      data: {
        businessId,
        type: "video_clip",
        title: displayTitle,
        detail: hookLine.slice(0, 280),
        status: "pending",
        metadata: JSON.parse(JSON.stringify(metadata))
      }
    });
    let approvalId: string | null = null;
    try {
      const approval = await db.approvalRequest.create({
        data: {
          businessId,
          agentId,
          actionType: "video_clip",
          actionDetail: JSON.parse(
            JSON.stringify({ ...metadata, activityEntryId: created.id })
          ),
          status: "pending",
          reason: `B-roll scene draft awaiting your manual assembly.`,
          expiresAt: new Date(Date.now() + OUTREACH_APPROVAL_WINDOW_MS),
          requestedBy: agentId ?? "agent"
        }
      });
      approvalId = approval.id;
      await db.activityEntry.update({
        where: { id: created.id },
        data: {
          metadata: JSON.parse(
            JSON.stringify({ ...metadata, approvalRequestId: approval.id })
          )
        }
      });
    } catch (err) {
      console.error(
        "[log_broll_scene] failed to create ApprovalRequest:",
        err
      );
    }

    return {
      success: true,
      output:
        `Logged B-roll scene id=${created.id}.` +
        (approvalId
          ? ` Review in /admin/clips or /admin/approvals.`
          : " Review in /admin/clips.")
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `log_broll_scene failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Knowledge lookup (semantic + tier-aware) ─────────────────────
//
// Pulls the most relevant warm/cold KB items for a query. Uses OpenAI
// embeddings when available, falls back to keyword match when not.
// Respects per-agent warm-tier assignments so one agent can't peek at
// another's private playbook.

const handleKnowledgeLookup: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "knowledge_lookup requires an authenticated agent context with a business."
    };
  }
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const agentId = args._agentId ? String(args._agentId) : undefined;
  const query = String(args.query || "").trim();
  if (query.length < 3) {
    return {
      success: false,
      output: "",
      error: "knowledge_lookup requires a query of at least 3 characters."
    };
  }
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 15))
      : 5;
  const includeHot =
    typeof args.includeHot === "boolean" ? Boolean(args.includeHot) : false;

  try {
    const { searchKnowledgeSemantic } = await import(
      "@/lib/repository/knowledge"
    );
    const result = await searchKnowledgeSemantic({
      businessId,
      query,
      organizationId,
      agentId,
      limit,
      includeHot
    });
    if (result.hits.length === 0) {
      return {
        success: true,
        output: JSON.stringify({
          mode: result.mode,
          matchCount: 0,
          message:
            "No matching knowledge items. Either nothing documented or your query needs to be broader."
        })
      };
    }
    return {
      success: true,
      output: JSON.stringify({
        mode: result.mode,
        matchCount: result.hits.length,
        hits: result.hits
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `knowledge_lookup failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Knowledge base management (leader-only) ──────────────────────
//
// Lets the CEO (or any leader agent) audit and re-tier the business's
// knowledge base. The whole point is token-budget optimization:
//   • hot items land in every agent's prompt every turn
//   • warm items land in specific agents' prompts
//   • cold items stay out of prompts; agents pull via knowledge_lookup
// The CEO uses list_knowledge_items → get_knowledge_budget → makes a
// recommendation → calls update_knowledge_tiering to execute.

const handleListKnowledgeItems: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "list_knowledge_items requires an authenticated agent context with a business."
    };
  }
  const tier = ["hot", "warm", "cold", "all"].includes(String(args.tier ?? ""))
    ? String(args.tier)
    : "all";
  const category =
    typeof args.category === "string" ? args.category.trim() : "";
  const enabled =
    typeof args.enabled === "boolean" ? Boolean(args.enabled) : undefined;
  const agentId =
    typeof args.agentId === "string" ? args.agentId.trim() : "";
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 200))
      : 50;

  try {
    const items = await db.knowledgeItem.findMany({
      where: {
        businessId,
        ...(tier !== "all" ? { tier } : {}),
        ...(category ? { category } : {}),
        ...(typeof enabled === "boolean" ? { enabled } : {})
      },
      orderBy: [{ tier: "asc" }, { tokenCount: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        category: true,
        tier: true,
        assignedAgentIds: true,
        enabled: true,
        tokenCount: true,
        updatedAt: true
      }
    });
    const scoped = agentId
      ? items.filter((item) => {
          const assigned = item.assignedAgentIds ?? [];
          return (
            item.tier === "hot" ||
            (item.tier === "warm" &&
              (assigned.length === 0 || assigned.includes(agentId)))
          );
        })
      : items;
    return {
      success: true,
      output: JSON.stringify({
        count: scoped.length,
        items: scoped.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          tier: item.tier,
          assignedAgentIds: item.assignedAgentIds,
          enabled: item.enabled,
          tokenCount: item.tokenCount ?? 0,
          updatedAt: item.updatedAt.toISOString()
        }))
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `list_knowledge_items failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleGetKnowledgeBudget: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "get_knowledge_budget requires an authenticated agent context with a business."
    };
  }
  try {
    const { getKnowledgeTokenBudget } = await import(
      "@/lib/repository/knowledge"
    );
    const budget = await getKnowledgeTokenBudget(businessId);
    return {
      success: true,
      output: JSON.stringify({
        ...budget,
        note:
          "`autoInjected` is what lands in EVERY agent's prompt each turn — hot tier plus warm items that have no specific agent assignment. Lowering this is the primary goal of retiering."
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `get_knowledge_budget failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleUpdateKnowledgeTiering: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  const organizationId = String(args._organizationId || "");
  if (!businessId || !organizationId) {
    return {
      success: false,
      output: "",
      error:
        "update_knowledge_tiering requires an authenticated agent context with a business."
    };
  }

  const itemIds = Array.isArray(args.itemIds)
    ? (args.itemIds as unknown[]).map((v) => String(v)).filter(Boolean)
    : [];
  if (itemIds.length === 0 || itemIds.length > 100) {
    return {
      success: false,
      output: "",
      error:
        "update_knowledge_tiering requires itemIds (1–100). Use list_knowledge_items first to get real ids."
    };
  }

  const tier = ["hot", "warm", "cold"].includes(String(args.tier ?? ""))
    ? (String(args.tier) as "hot" | "warm" | "cold")
    : undefined;
  const assignedAgentIdsInput = Array.isArray(args.assignedAgentIds)
    ? (args.assignedAgentIds as unknown[])
        .map((v) => String(v).trim())
        .filter(Boolean)
    : null;
  const replaceAssigned =
    typeof args.replaceAssigned === "boolean"
      ? Boolean(args.replaceAssigned)
      : true;
  const enabled =
    typeof args.enabled === "boolean" ? Boolean(args.enabled) : undefined;

  if (
    tier === undefined &&
    assignedAgentIdsInput === null &&
    enabled === undefined
  ) {
    return {
      success: false,
      output: "",
      error:
        "update_knowledge_tiering needs at least one of: tier, assignedAgentIds, enabled."
    };
  }

  // Scope-check every id belongs to this business before writing.
  const scoped = await db.knowledgeItem.findMany({
    where: { id: { in: itemIds }, businessId },
    select: { id: true, assignedAgentIds: true }
  });
  const scopedIds = new Set(scoped.map((item) => item.id));
  const unknownIds = itemIds.filter((id) => !scopedIds.has(id));

  try {
    const { updateKnowledgeItem } = await import(
      "@/lib/repository/knowledge"
    );
    const updated: string[] = [];
    for (const item of scoped) {
      const nextAssigned =
        assignedAgentIdsInput === null
          ? undefined
          : replaceAssigned
            ? assignedAgentIdsInput
            : Array.from(
                new Set([
                  ...(item.assignedAgentIds ?? []),
                  ...assignedAgentIdsInput
                ])
              );
      await updateKnowledgeItem(item.id, organizationId, {
        ...(tier !== undefined ? { tier } : {}),
        ...(nextAssigned !== undefined
          ? { assignedAgentIds: nextAssigned }
          : {}),
        ...(enabled !== undefined ? { enabled } : {}),
        actorEmail: "agent:update_knowledge_tiering"
      });
      updated.push(item.id);
    }

    const { getKnowledgeTokenBudget } = await import(
      "@/lib/repository/knowledge"
    );
    const budget = await getKnowledgeTokenBudget(businessId);

    return {
      success: true,
      output: JSON.stringify({
        updated: updated.length,
        unknown: unknownIds,
        newBudget: budget
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `update_knowledge_tiering failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── fal.ai image + video generation ──────────────────────────────
//
// Single provider covering FLUX (images), Recraft (vector logos),
// Kling / Luma / LTX (video), and dozens more. Submit → poll → fetch
// → persist to R2 → create a BrandAsset row so the human can see it
// in /admin/brand-assets and agents can reference it later via
// list_brand_assets / get_brand_asset.
//
// Docs: https://docs.fal.ai/

const FAL_IMAGE_MODELS = new Set([
  "fal-ai/flux/dev",
  "fal-ai/flux/schnell",
  "fal-ai/flux-pro",
  "fal-ai/flux-pro/v1.1-ultra",
  "fal-ai/recraft-v3",
  "fal-ai/recraft-20b",
  "fal-ai/ideogram/v2",
  "fal-ai/stable-diffusion-v35-large"
]);

const FAL_VIDEO_MODELS = new Set([
  "fal-ai/kling-video/v1.6/standard/text-to-video",
  "fal-ai/kling-video/v1.6/pro/image-to-video",
  "fal-ai/luma-dream-machine",
  "fal-ai/ltx-video",
  "fal-ai/minimax-video-01",
  "fal-ai/runway-gen3/turbo/image-to-video"
]);

const BRAND_ASSET_CATEGORIES = new Set([
  "logo",
  "brand_guide",
  "product_image",
  "marketing",
  "document",
  "general"
]);

async function resolveFalKey(
  organizationId: string | undefined
): Promise<string | null> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "fal_ai",
    { api_key: "FAL_KEY" }
  );
  return creds.api_key || null;
}

type FalSubmitResult =
  | { success: true; requestId: string; statusUrl: string; responseUrl: string }
  | { success: false; error: string };

async function falSubmitJob(params: {
  apiKey: string;
  modelId: string;
  body: Record<string, unknown>;
}): Promise<FalSubmitResult> {
  try {
    const response = await fetch(
      `https://queue.fal.run/${params.modelId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${params.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(params.body)
      }
    );
    const data = (await response.json()) as {
      request_id?: string;
      status_url?: string;
      response_url?: string;
      detail?: string;
    };
    if (!response.ok || !data.request_id) {
      return {
        success: false,
        error:
          data.detail ??
          `fal.ai ${response.status}: ${JSON.stringify(data).slice(0, 200)}`
      };
    }
    return {
      success: true,
      requestId: data.request_id,
      statusUrl:
        data.status_url ??
        `https://queue.fal.run/${params.modelId}/requests/${data.request_id}/status`,
      responseUrl:
        data.response_url ??
        `https://queue.fal.run/${params.modelId}/requests/${data.request_id}`
    };
  } catch (err) {
    return {
      success: false,
      error: `fal.ai submit failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}

type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

async function falPollOnce(
  apiKey: string,
  statusUrl: string
): Promise<{ status: FalStatus | "UNKNOWN"; raw: unknown }> {
  const response = await fetch(statusUrl, {
    headers: { Authorization: `Key ${apiKey}` }
  });
  const raw = await response.json().catch(() => ({}));
  const status = (raw as { status?: string })?.status;
  if (
    status === "IN_QUEUE" ||
    status === "IN_PROGRESS" ||
    status === "COMPLETED" ||
    status === "FAILED"
  ) {
    return { status, raw };
  }
  return { status: "UNKNOWN", raw };
}

async function falFetchResult(
  apiKey: string,
  responseUrl: string
): Promise<Record<string, unknown>> {
  const response = await fetch(responseUrl, {
    headers: { Authorization: `Key ${apiKey}` }
  });
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Poll fal.ai until the job completes or we hit timeoutMs. Small
 * exponential backoff so we don't hammer them for fast jobs but pick
 * up quickly on slow ones.
 */
async function falPollUntilDone(params: {
  apiKey: string;
  statusUrl: string;
  responseUrl: string;
  timeoutMs: number;
}): Promise<
  | { done: true; result: Record<string, unknown> }
  | { done: false; lastStatus: string }
> {
  const start = Date.now();
  let wait = 1500;
  while (Date.now() - start < params.timeoutMs) {
    const { status } = await falPollOnce(params.apiKey, params.statusUrl);
    if (status === "COMPLETED") {
      const result = await falFetchResult(params.apiKey, params.responseUrl);
      return { done: true, result };
    }
    if (status === "FAILED") {
      return { done: false, lastStatus: "FAILED" };
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
    wait = Math.min(wait * 1.3, 6000);
  }
  return { done: false, lastStatus: "TIMED_OUT" };
}

function extractFirstMedia(result: Record<string, unknown>): {
  url: string | null;
  contentType: string | null;
} {
  const out = { url: null as string | null, contentType: null as string | null };
  const candidates: unknown[] = [];
  const images = (result as { images?: unknown[] }).images;
  const videos = (result as { video?: unknown; videos?: unknown[] });
  if (Array.isArray(images)) candidates.push(...images);
  if (videos.video) candidates.push(videos.video);
  if (Array.isArray(videos.videos)) candidates.push(...videos.videos);
  const topUrl = (result as { url?: unknown }).url;
  if (typeof topUrl === "string") candidates.push({ url: topUrl });
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      out.url = candidate;
      return out;
    }
    if (typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      if (typeof record.url === "string") {
        out.url = record.url;
        if (typeof record.content_type === "string") {
          out.contentType = record.content_type;
        }
        return out;
      }
    }
  }
  return out;
}

async function persistFalResultAsBrandAsset(params: {
  organizationId: string;
  businessId: string;
  sourceUrl: string;
  kind: "image" | "video";
  category: string;
  description: string;
  prompt: string;
  modelId: string;
  fallbackExt: string;
}): Promise<{
  brandAssetId: string;
  publicUrl: string;
  contentType: string;
}> {
  const { buildUploadKey, fetchAndStoreInR2 } = await import(
    "@/lib/storage/r2"
  );
  const ext =
    params.sourceUrl.match(/\.(\w{2,4})(?:\?|$)/)?.[1] ?? params.fallbackExt;
  const filename = `${params.kind}-${Date.now()}.${ext}`;
  const key = buildUploadKey({
    organizationId: params.organizationId,
    businessId: params.businessId,
    folder: `generated/${params.kind}`,
    filename
  });
  const stored = await fetchAndStoreInR2({
    organizationId: params.organizationId,
    sourceUrl: params.sourceUrl,
    key
  });
  // Build a description that carries the generation context so future
  // agents can understand what this asset represents without a separate
  // metadata column. BrandAsset doesn't have a `metadata` field yet, so
  // we bake the prompt into the description string.
  const descriptionWithContext =
    `${params.description.trim()}\n\n` +
    `— Generated by ${params.modelId} via fal.ai.\n` +
    `Prompt: ${params.prompt.slice(0, 400)}`;

  const brandAsset = await db.brandAsset.create({
    data: {
      organizationId: params.organizationId,
      businessId: params.businessId,
      fileName: filename,
      fileType: params.kind,
      mimeType: stored.contentType,
      fileSize: stored.size,
      storageKey: stored.key,
      url: stored.publicUrl,
      description: descriptionWithContext.slice(0, 1000),
      category: BRAND_ASSET_CATEGORIES.has(params.category)
        ? params.category
        : "general"
    }
  });
  return {
    brandAssetId: brandAsset.id,
    publicUrl: stored.publicUrl,
    contentType: stored.contentType
  };
}

const IMAGE_POLL_TIMEOUT_MS = 90_000;
const VIDEO_POLL_TIMEOUT_MS = 180_000;

const handleGenerateImage: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  if (!organizationId || !businessId) {
    return {
      success: false,
      output: "",
      error:
        "generate_image requires an authenticated agent context with a business."
    };
  }
  const apiKey = await resolveFalKey(organizationId);
  if (!apiKey) {
    return missingConfigError(
      "generate_image",
      "fal.ai (Image + Video Generation)",
      ["FAL_KEY"]
    );
  }
  const prompt = String(args.prompt || "").trim();
  if (prompt.length < 5) {
    return {
      success: false,
      output: "",
      error: "generate_image requires a descriptive prompt (5+ chars)."
    };
  }
  const modelId = String(args.model || "fal-ai/flux/dev");
  if (!FAL_IMAGE_MODELS.has(modelId)) {
    return {
      success: false,
      output: "",
      error: `Unknown image model "${modelId}". Pick one of: ${[...FAL_IMAGE_MODELS].join(", ")}`
    };
  }
  const imageSize = String(args.image_size || args.imageSize || "square_hd");
  const numImages =
    typeof args.num_images === "number"
      ? Math.max(1, Math.min(Number(args.num_images), 4))
      : 1;
  const category = String(args.category || "general");
  const description = String(
    args.description || `Generated from prompt: ${prompt.slice(0, 200)}`
  );

  const body: Record<string, unknown> = {
    prompt,
    image_size: imageSize,
    num_images: numImages
  };
  if (args.seed !== undefined && typeof args.seed === "number") {
    body.seed = args.seed;
  }

  const submitted = await falSubmitJob({ apiKey, modelId, body });
  if (!submitted.success) {
    return { success: false, output: "", error: submitted.error };
  }

  const polled = await falPollUntilDone({
    apiKey,
    statusUrl: submitted.statusUrl,
    responseUrl: submitted.responseUrl,
    timeoutMs: IMAGE_POLL_TIMEOUT_MS
  });
  if (!polled.done) {
    return {
      success: true,
      output: JSON.stringify({
        status: polled.lastStatus,
        requestId: submitted.requestId,
        modelId,
        note: `Not done yet. Call fal_check_generation with requestId=${submitted.requestId} and modelId=${modelId} to fetch the result once it's ready.`
      })
    };
  }

  const { url: mediaUrl, contentType } = extractFirstMedia(polled.result);
  if (!mediaUrl) {
    return {
      success: false,
      output: "",
      error: `fal.ai returned no image URL. Raw result: ${JSON.stringify(polled.result).slice(0, 300)}`
    };
  }

  try {
    const saved = await persistFalResultAsBrandAsset({
      organizationId,
      businessId,
      sourceUrl: mediaUrl,
      kind: "image",
      category,
      description,
      prompt,
      modelId,
      fallbackExt: "png"
    });
    return {
      success: true,
      output: JSON.stringify({
        brandAssetId: saved.brandAssetId,
        publicUrl: saved.publicUrl,
        contentType: saved.contentType ?? contentType,
        modelId,
        prompt
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `generate_image produced an image but failed to save it: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleGenerateVideo: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  if (!organizationId || !businessId) {
    return {
      success: false,
      output: "",
      error:
        "generate_video requires an authenticated agent context with a business."
    };
  }
  const apiKey = await resolveFalKey(organizationId);
  if (!apiKey) {
    return missingConfigError(
      "generate_video",
      "fal.ai (Image + Video Generation)",
      ["FAL_KEY"]
    );
  }
  const prompt = String(args.prompt || "").trim();
  if (prompt.length < 5) {
    return {
      success: false,
      output: "",
      error: "generate_video requires a descriptive prompt (5+ chars)."
    };
  }
  const modelId = String(
    args.model || "fal-ai/kling-video/v1.6/standard/text-to-video"
  );
  if (!FAL_VIDEO_MODELS.has(modelId)) {
    return {
      success: false,
      output: "",
      error: `Unknown video model "${modelId}". Pick one of: ${[...FAL_VIDEO_MODELS].join(", ")}`
    };
  }
  const duration =
    typeof args.duration === "number" ? Math.round(Number(args.duration)) : 5;
  const aspectRatio = String(args.aspect_ratio || args.aspectRatio || "9:16");
  const imageUrl = typeof args.image_url === "string" ? String(args.image_url) : "";
  const category = String(args.category || "marketing");
  const description = String(
    args.description || `Generated from prompt: ${prompt.slice(0, 200)}`
  );

  const body: Record<string, unknown> = {
    prompt,
    duration: `${duration}`,
    aspect_ratio: aspectRatio
  };
  if (imageUrl) body.image_url = imageUrl;

  const submitted = await falSubmitJob({ apiKey, modelId, body });
  if (!submitted.success) {
    return { success: false, output: "", error: submitted.error };
  }

  const polled = await falPollUntilDone({
    apiKey,
    statusUrl: submitted.statusUrl,
    responseUrl: submitted.responseUrl,
    timeoutMs: VIDEO_POLL_TIMEOUT_MS
  });
  if (!polled.done) {
    return {
      success: true,
      output: JSON.stringify({
        status: polled.lastStatus,
        requestId: submitted.requestId,
        modelId,
        note: `Video still rendering. Call fal_check_generation with requestId=${submitted.requestId} and modelId=${modelId} every 30s until status=COMPLETED.`
      })
    };
  }

  const { url: mediaUrl, contentType } = extractFirstMedia(polled.result);
  if (!mediaUrl) {
    return {
      success: false,
      output: "",
      error: `fal.ai returned no video URL. Raw result: ${JSON.stringify(polled.result).slice(0, 300)}`
    };
  }

  try {
    const saved = await persistFalResultAsBrandAsset({
      organizationId,
      businessId,
      sourceUrl: mediaUrl,
      kind: "video",
      category,
      description,
      prompt,
      modelId,
      fallbackExt: "mp4"
    });
    return {
      success: true,
      output: JSON.stringify({
        brandAssetId: saved.brandAssetId,
        publicUrl: saved.publicUrl,
        contentType: saved.contentType ?? contentType,
        modelId,
        prompt
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `generate_video produced a video but failed to save it: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleFalCheckGeneration: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  if (!organizationId || !businessId) {
    return {
      success: false,
      output: "",
      error:
        "fal_check_generation requires an authenticated agent context with a business."
    };
  }
  const apiKey = await resolveFalKey(organizationId);
  if (!apiKey) {
    return missingConfigError(
      "fal_check_generation",
      "fal.ai (Image + Video Generation)",
      ["FAL_KEY"]
    );
  }
  const modelId = String(args.model || args.modelId || "");
  const requestId = String(args.request_id || args.requestId || "");
  if (!modelId || !requestId) {
    return {
      success: false,
      output: "",
      error:
        "fal_check_generation requires `model` and `request_id` from the earlier generate_image / generate_video call."
    };
  }
  const kind =
    FAL_VIDEO_MODELS.has(modelId) ? "video" : "image";
  const category = String(args.category || (kind === "video" ? "marketing" : "general"));
  const description = String(args.description || "");
  const prompt = String(args.prompt || "");

  const statusUrl = `https://queue.fal.run/${modelId}/requests/${requestId}/status`;
  const responseUrl = `https://queue.fal.run/${modelId}/requests/${requestId}`;
  try {
    const { status } = await falPollOnce(apiKey, statusUrl);
    if (status === "IN_QUEUE" || status === "IN_PROGRESS") {
      return {
        success: true,
        output: JSON.stringify({ status, requestId, modelId })
      };
    }
    if (status !== "COMPLETED") {
      return {
        success: false,
        output: "",
        error: `Generation ${status.toLowerCase()}. Try again with a different prompt.`
      };
    }
    const result = await falFetchResult(apiKey, responseUrl);
    const { url: mediaUrl, contentType } = extractFirstMedia(result);
    if (!mediaUrl) {
      return {
        success: false,
        output: "",
        error: `fal.ai job completed but returned no URL. Raw: ${JSON.stringify(result).slice(0, 300)}`
      };
    }
    const saved = await persistFalResultAsBrandAsset({
      organizationId,
      businessId,
      sourceUrl: mediaUrl,
      kind,
      category,
      description: description || `Completed via fal_check_generation (${modelId}).`,
      prompt,
      modelId,
      fallbackExt: kind === "video" ? "mp4" : "png"
    });
    return {
      success: true,
      output: JSON.stringify({
        status: "COMPLETED",
        brandAssetId: saved.brandAssetId,
        publicUrl: saved.publicUrl,
        contentType: saved.contentType ?? contentType,
        modelId
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `fal_check_generation failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Brand asset query tools ───────────────────────────────────────

const handleListBrandAssets: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  const organizationId = String(args._organizationId || "");
  if (!businessId || !organizationId) {
    return {
      success: false,
      output: "",
      error:
        "list_brand_assets requires an authenticated agent context with a business."
    };
  }
  const category =
    typeof args.category === "string" ? String(args.category).trim() : "";
  const fileType =
    typeof args.fileType === "string" ? String(args.fileType).trim() : "";
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 60))
      : 20;
  try {
    const rows = await db.brandAsset.findMany({
      where: {
        organizationId,
        businessId,
        ...(category ? { category } : {}),
        ...(fileType ? { fileType } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        fileName: true,
        fileType: true,
        mimeType: true,
        fileSize: true,
        url: true,
        description: true,
        category: true,
        createdAt: true
      }
    });
    return {
      success: true,
      output: JSON.stringify({
        count: rows.length,
        assets: rows.map((row) => ({
          id: row.id,
          fileName: row.fileName,
          fileType: row.fileType,
          mimeType: row.mimeType,
          fileSize: row.fileSize,
          url: row.url,
          description: row.description,
          category: row.category,
          createdAt: row.createdAt.toISOString()
        }))
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `list_brand_assets failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleGetBrandAsset: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  const organizationId = String(args._organizationId || "");
  if (!businessId || !organizationId) {
    return {
      success: false,
      output: "",
      error:
        "get_brand_asset requires an authenticated agent context with a business."
    };
  }
  const id = String(args.id || "").trim();
  if (!id) {
    return {
      success: false,
      output: "",
      error: "get_brand_asset requires an `id` (from list_brand_assets)."
    };
  }
  try {
    const asset = await db.brandAsset.findFirst({
      where: { id, organizationId, businessId }
    });
    if (!asset) {
      return {
        success: false,
        output: "",
        error: "Brand asset not found in this business."
      };
    }
    return {
      success: true,
      output: JSON.stringify({
        id: asset.id,
        fileName: asset.fileName,
        fileType: asset.fileType,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        url: asset.url,
        description: asset.description,
        category: asset.category,
        tags: asset.tags,
        uploadedBy: asset.uploadedBy,
        createdAt: asset.createdAt.toISOString()
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `get_brand_asset failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Todos (brain-dump + activation) ──────────────────────────────
//
// Two tools every non-master agent gets:
//   propose_todo — agent suggests something the user should do. Lower
//     commitment than delegate_task. Lands in the user's /admin/todos
//     queue with createdByAgentId set so the UI flags it as a
//     suggestion. User activates when ready.
//   list_todos — agent checks what's already on the user's plate
//     before proposing another one. Prevents dupes.

const handleProposeTodo: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  const organizationId = String(args._organizationId || "");
  if (!businessId || !organizationId) {
    return {
      success: false,
      output: "",
      error:
        "propose_todo requires an authenticated agent context with a business."
    };
  }
  const agentId = args._agentId ? String(args._agentId) : null;
  const title = String(args.title || "").trim();
  const description =
    typeof args.description === "string" ? args.description.trim() : null;
  if (title.length < 3) {
    return {
      success: false,
      output: "",
      error: "propose_todo requires a title of at least 3 characters."
    };
  }
  const type = args.type === "idea" ? "idea" : "todo";
  const priority = ["low", "medium", "high", "urgent"].includes(
    String(args.priority ?? "")
  )
    ? String(args.priority)
    : "medium";
  const rationale =
    typeof args.rationale === "string" ? args.rationale.trim() : "";
  const tags = Array.isArray(args.tags)
    ? (args.tags as unknown[]).map((t) => String(t)).filter(Boolean).slice(0, 6)
    : [];
  const dueAt =
    typeof args.dueAt === "string" && !Number.isNaN(Date.parse(args.dueAt))
      ? new Date(args.dueAt)
      : null;
  const suggestedAgentId =
    typeof args.suggestedAgentId === "string"
      ? String(args.suggestedAgentId)
      : null;

  try {
    const { createTodo } = await import("@/lib/repository/todos");
    const created = await createTodo({
      organizationId,
      businessId,
      type,
      title,
      description,
      priority,
      agentId: suggestedAgentId,
      dueAt,
      tags,
      createdVia: "agent",
      createdByAgentId: agentId,
      metadata: rationale ? { rationale } : null
    });
    return {
      success: true,
      output: JSON.stringify({
        todoId: created.id,
        type: created.type,
        title: created.title,
        message: `Proposed to the user. Visible in /admin/todos under Ideas/Active queue with an "agent-proposed" flag. The user activates when ready.`
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `propose_todo failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleListTodos: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  const organizationId = String(args._organizationId || "");
  if (!businessId || !organizationId) {
    return {
      success: false,
      output: "",
      error:
        "list_todos requires an authenticated agent context with a business."
    };
  }
  const type = args.type === "idea" || args.type === "todo" ? args.type : undefined;
  const statusArg = typeof args.status === "string" ? args.status : undefined;
  const limit =
    typeof args.limit === "number"
      ? Math.max(1, Math.min(Number(args.limit), 100))
      : 30;

  try {
    const { listTodos } = await import("@/lib/repository/todos");
    const items = await listTodos({
      organizationId,
      businessId,
      type: type as "idea" | "todo" | undefined,
      status: statusArg as
        | "captured"
        | "active"
        | "snoozed"
        | "done"
        | "dismissed"
        | undefined,
      limit
    });
    return {
      success: true,
      output: JSON.stringify({
        count: items.length,
        items: items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          description: item.description,
          status: item.status,
          priority: item.priority,
          agentId: item.agentId,
          dueAt: item.dueAt ? item.dueAt.toISOString() : null,
          tags: item.tags,
          createdByAgentId: item.createdByAgentId,
          createdAt: item.createdAt.toISOString()
        }))
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `list_todos failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ─────────────────────────────────────────────────────────────────────
// Production pipeline: R2 upload, ElevenLabs, Whisper, JSON2Video, YouTube.
//
// These turn the Faceless YouTube Empire template (and any other
// "produce a video end-to-end" workflow) from aspirational into real.
// ─────────────────────────────────────────────────────────────────────

/**
 * Persist a partial set of encrypted secrets back to an Integration
 * row, merging with existing secrets. Used by the YouTube OAuth refresh
 * flow to stash a fresh access_token without overwriting refresh_token.
 */
async function updateIntegrationSecrets(
  organizationId: string,
  integrationKey: string,
  partial: Record<string, string>
): Promise<void> {
  const encKey = getEncryptionKey();
  const integration = await db.integration.findUnique({
    where: { organizationId_key: { organizationId, key: integrationKey } }
  });
  if (!integration) return;
  const existing =
    integration.encryptedSecrets &&
    typeof integration.encryptedSecrets === "object" &&
    !Array.isArray(integration.encryptedSecrets)
      ? (integration.encryptedSecrets as Record<string, string>)
      : {};
  const merged: Record<string, string> = { ...existing };
  for (const [field, value] of Object.entries(partial)) {
    merged[field] = encryptSecret(value, encKey);
  }
  await db.integration.update({
    where: { id: integration.id },
    data: { encryptedSecrets: merged }
  });
}

function inferMimeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    txt: "text/plain",
    json: "application/json"
  };
  return map[ext] ?? "application/octet-stream";
}

function fileTypeFromMime(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

// ── upload_to_r2 ────────────────────────────────────────────────────────

const handleUploadToR2: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  if (!organizationId || !businessId) {
    return {
      success: false,
      output: "",
      error:
        "upload_to_r2 requires an authenticated agent context with a business."
    };
  }
  const sourceUrl =
    typeof args.source_url === "string" ? args.source_url.trim() : "";
  const base64 = typeof args.base64 === "string" ? args.base64.trim() : "";
  const filename = String(args.filename || "").trim();
  if (!filename) {
    return {
      success: false,
      output: "",
      error: "upload_to_r2 requires a filename."
    };
  }
  if (!sourceUrl && !base64) {
    return {
      success: false,
      output: "",
      error: "upload_to_r2 requires either source_url or base64."
    };
  }
  const folder = String(args.folder || "uploads");
  const category = String(args.category || "general");
  const description = String(args.description || "");
  const providedContentType =
    typeof args.content_type === "string" ? args.content_type : undefined;
  const {
    buildUploadKey,
    fetchAndStoreInR2,
    uploadBufferToR2,
    resolvePublicUrl
  } = await import("@/lib/storage/r2");
  const key = buildUploadKey({ organizationId, businessId, folder, filename });

  try {
    let stored: {
      publicUrl: string;
      key: string;
      contentType: string;
      size: number;
    };
    if (sourceUrl) {
      stored = await fetchAndStoreInR2({
        organizationId,
        sourceUrl,
        key,
        contentType: providedContentType
      });
    } else {
      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > 25 * 1024 * 1024) {
        return {
          success: false,
          output: "",
          error:
            "base64 payload exceeds the 25 MB cap. Use source_url for larger files."
        };
      }
      const contentType =
        providedContentType ?? inferMimeFromFilename(filename);
      await uploadBufferToR2({
        organizationId,
        key,
        body: buffer,
        contentType
      });
      const publicUrl = await resolvePublicUrl(organizationId, key);
      stored = { publicUrl, key, contentType, size: buffer.byteLength };
    }
    const fileType = fileTypeFromMime(stored.contentType);
    const brandAsset = await db.brandAsset.create({
      data: {
        organizationId,
        businessId,
        fileName: filename,
        fileType,
        mimeType: stored.contentType,
        fileSize: stored.size,
        storageKey: stored.key,
        url: stored.publicUrl,
        description: description.slice(0, 1000) || undefined,
        category: BRAND_ASSET_CATEGORIES.has(category) ? category : "general"
      }
    });
    return {
      success: true,
      output: JSON.stringify({
        brandAssetId: brandAsset.id,
        publicUrl: stored.publicUrl,
        key: stored.key,
        contentType: stored.contentType,
        size: stored.size
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `upload_to_r2 failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── ElevenLabs ──────────────────────────────────────────────────────────

async function elevenlabsFetch(
  organizationId: string | undefined,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "elevenlabs",
    INTEGRATION_FIELD_MAP.elevenlabs
  );
  const apiKey = creds.api_key;
  if (!apiKey) throw new Error("ElevenLabs API key not configured");
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "xi-api-key": apiKey
    }
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* empty */
  }
  return { ok: response.ok, status: response.status, body };
}

const handleListElevenlabsVoices: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "elevenlabs",
    INTEGRATION_FIELD_MAP.elevenlabs
  );
  if (!creds.api_key) {
    return missingConfigError(
      "list_elevenlabs_voices",
      "ElevenLabs (AI Voiceover)",
      ["ELEVENLABS_API_KEY"]
    );
  }
  try {
    const { ok, status, body } = await elevenlabsFetch(
      organizationId,
      "/v1/voices"
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `ElevenLabs ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const data = body as {
      voices?: Array<{
        voice_id?: string;
        name?: string;
        category?: string;
        description?: string;
        labels?: Record<string, unknown>;
      }>;
    };
    const search = String(args.search || "").toLowerCase();
    const all = data.voices ?? [];
    const filtered = search
      ? all.filter((v) =>
          `${v.name ?? ""} ${v.description ?? ""}`
            .toLowerCase()
            .includes(search)
        )
      : all;
    return {
      success: true,
      output: JSON.stringify({
        count: filtered.length,
        voices: filtered.slice(0, 50).map((v) => ({
          voice_id: v.voice_id,
          name: v.name,
          category: v.category ?? null,
          description: v.description ?? null,
          labels: v.labels ?? null
        }))
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `list_elevenlabs_voices failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleGenerateVoiceover: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  if (!organizationId || !businessId) {
    return {
      success: false,
      output: "",
      error:
        "generate_voiceover requires an authenticated agent context with a business."
    };
  }
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "elevenlabs",
    INTEGRATION_FIELD_MAP.elevenlabs
  );
  if (!creds.api_key) {
    return missingConfigError(
      "generate_voiceover",
      "ElevenLabs (AI Voiceover)",
      ["ELEVENLABS_API_KEY"]
    );
  }
  const text = String(args.text || "").trim();
  if (text.length < 3) {
    return {
      success: false,
      output: "",
      error: "generate_voiceover requires non-empty text."
    };
  }
  if (text.length > 5000) {
    return {
      success: false,
      output: "",
      error:
        "generate_voiceover text exceeds 5000 chars. Split the script into scene-level chunks and call once per chunk."
    };
  }
  const voiceId =
    typeof args.voice_id === "string" && args.voice_id.trim()
      ? args.voice_id.trim()
      : creds.default_voice_id;
  if (!voiceId) {
    return {
      success: false,
      output: "",
      error:
        "generate_voiceover needs a voice_id — pass one or set default_voice_id on the elevenlabs integration."
    };
  }
  const modelId =
    typeof args.model_id === "string" && args.model_id.trim()
      ? args.model_id.trim()
      : creds.model_id || "eleven_multilingual_v2";
  const stability =
    typeof args.stability === "number" ? Number(args.stability) : 0.5;
  const similarityBoost =
    typeof args.similarity_boost === "number"
      ? Number(args.similarity_boost)
      : 0.75;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": creds.api_key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost
          }
        })
      }
    );
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        success: false,
        output: "",
        error: `ElevenLabs ${response.status}: ${errText.slice(0, 200)}`
      };
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename =
      typeof args.filename === "string" && args.filename.trim()
        ? args.filename.trim()
        : `voiceover-${Date.now()}.mp3`;
    const { buildUploadKey, uploadBufferToR2, resolvePublicUrl } =
      await import("@/lib/storage/r2");
    const key = buildUploadKey({
      organizationId,
      businessId,
      folder: "voiceover",
      filename
    });
    await uploadBufferToR2({
      organizationId,
      key,
      body: buffer,
      contentType: "audio/mpeg"
    });
    const publicUrl = await resolvePublicUrl(organizationId, key);
    const characterCount = text.length;
    const costPerThousand =
      modelId === "eleven_flash_v2_5" || modelId === "eleven_turbo_v2_5"
        ? 0.05
        : 0.11;
    const estCostUsd = Number(
      ((characterCount / 1000) * costPerThousand).toFixed(4)
    );

    const brandAsset = await db.brandAsset.create({
      data: {
        organizationId,
        businessId,
        fileName: filename,
        fileType: "audio",
        mimeType: "audio/mpeg",
        fileSize: buffer.byteLength,
        storageKey: key,
        url: publicUrl,
        description:
          `ElevenLabs voiceover (${modelId}, voice_id=${voiceId.slice(0, 12)}). ` +
          `${characterCount} chars ≈ $${estCostUsd}. Script: ${text.slice(0, 240)}`,
        category: "general"
      }
    });

    return {
      success: true,
      output: JSON.stringify({
        brandAssetId: brandAsset.id,
        publicUrl,
        key,
        voiceId,
        modelId,
        characterCount,
        estCostUsd
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `generate_voiceover failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Whisper transcription (via existing openai integration) ────────────

const handleTranscribeAudio: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "openai",
    INTEGRATION_FIELD_MAP.openai
  );
  if (!creds.api_key) {
    return missingConfigError("transcribe_audio", "OpenAI", [
      "OPENAI_API_KEY"
    ]);
  }
  const audioUrl = String(args.audio_url || "").trim();
  if (!audioUrl) {
    return {
      success: false,
      output: "",
      error: "transcribe_audio requires audio_url."
    };
  }
  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return {
        success: false,
        output: "",
        error: `Failed to fetch audio (${audioResponse.status}).`
      };
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    const mime = audioResponse.headers.get("content-type") ?? "audio/mpeg";
    const extFromMime = mime.includes("wav")
      ? "wav"
      : mime.includes("mp4") || mime.includes("m4a")
        ? "m4a"
        : mime.includes("ogg")
          ? "ogg"
          : "mp3";
    const filename = `audio.${extFromMime}`;

    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: mime }), filename);
    form.append("model", "whisper-1");
    if (typeof args.language === "string" && args.language.trim()) {
      form.append("language", String(args.language).trim());
    }
    if (typeof args.prompt === "string" && args.prompt.trim()) {
      form.append("prompt", String(args.prompt).slice(0, 2000));
    }
    form.append("response_format", "verbose_json");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.api_key}`
        },
        body: form
      }
    );
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        success: false,
        output: "",
        error: `OpenAI ${response.status}: ${errText.slice(0, 200)}`
      };
    }
    const body = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
    };
    return {
      success: true,
      output: JSON.stringify({
        text: body.text ?? "",
        language: body.language ?? null,
        durationSec:
          typeof body.duration === "number" ? body.duration : null
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `transcribe_audio failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── JSON2Video ─────────────────────────────────────────────────────────

async function json2videoFetch(
  organizationId: string | undefined,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "json2video",
    INTEGRATION_FIELD_MAP.json2video
  );
  const apiKey = creds.api_key;
  if (!apiKey) throw new Error("JSON2Video API key not configured");
  const response = await fetch(`https://api.json2video.com${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "x-api-key": apiKey,
      Accept: "application/json"
    }
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* empty */
  }
  return { ok: response.ok, status: response.status, body };
}

const handleAssembleVideo: ToolHandler = async (args) => {
  const organizationId = args._organizationId
    ? String(args._organizationId)
    : undefined;
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "json2video",
    INTEGRATION_FIELD_MAP.json2video
  );
  if (!creds.api_key) {
    return missingConfigError(
      "assemble_video",
      "JSON2Video (Timeline Assembly)",
      ["JSON2VIDEO_API_KEY"]
    );
  }
  const template = args.template;
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    return {
      success: false,
      output: "",
      error:
        "assemble_video requires a `template` object (JSON2Video movie schema)."
    };
  }
  const resolution =
    typeof args.resolution === "string" ? args.resolution : "full-hd";
  const quality = typeof args.quality === "string" ? args.quality : "high";
  const title = typeof args.title === "string" ? args.title : undefined;
  const movie = {
    ...(template as Record<string, unknown>),
    resolution,
    quality,
    ...(title ? { comment: title } : {})
  };
  try {
    const { ok, status, body } = await json2videoFetch(
      organizationId,
      "/v2/movies",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(movie)
      }
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `JSON2Video ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const data = body as { success?: boolean; project?: string };
    if (!data.project) {
      return {
        success: false,
        output: "",
        error: `JSON2Video returned no project id. Raw: ${JSON.stringify(body).slice(0, 300)}`
      };
    }
    return {
      success: true,
      output: JSON.stringify({
        project_id: data.project,
        status: "queued",
        note: "Poll with check_video_assembly every 30-60s."
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `assemble_video failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleCheckVideoAssembly: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  if (!organizationId || !businessId) {
    return {
      success: false,
      output: "",
      error:
        "check_video_assembly requires an authenticated agent context with a business."
    };
  }
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "json2video",
    INTEGRATION_FIELD_MAP.json2video
  );
  if (!creds.api_key) {
    return missingConfigError(
      "check_video_assembly",
      "JSON2Video (Timeline Assembly)",
      ["JSON2VIDEO_API_KEY"]
    );
  }
  const projectId = String(args.project_id || "").trim();
  if (!projectId) {
    return {
      success: false,
      output: "",
      error: "check_video_assembly requires project_id."
    };
  }
  try {
    const { ok, status, body } = await json2videoFetch(
      organizationId,
      `/v2/movies?project=${encodeURIComponent(projectId)}`
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `JSON2Video ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const data = body as {
      movie?: {
        status?: string;
        url?: string;
        progress?: number;
        message?: string;
        duration?: number;
      };
    };
    const movie = data.movie ?? {};
    const renderStatus = String(movie.status ?? "queued").toLowerCase();
    if (renderStatus === "error" || renderStatus === "failed") {
      return {
        success: false,
        output: "",
        error: `JSON2Video render failed: ${movie.message ?? "unknown error"}`
      };
    }
    if (renderStatus !== "done") {
      return {
        success: true,
        output: JSON.stringify({
          status: renderStatus,
          progress: typeof movie.progress === "number" ? movie.progress : null,
          project_id: projectId
        })
      };
    }
    const mediaUrl = movie.url;
    if (!mediaUrl) {
      return {
        success: false,
        output: "",
        error: "JSON2Video reported done but returned no URL."
      };
    }
    const category = String(args.category || "marketing");
    const description = String(
      args.description || `Assembled via JSON2Video (project ${projectId}).`
    );
    const { buildUploadKey, fetchAndStoreInR2 } = await import(
      "@/lib/storage/r2"
    );
    const filename = `assembly-${Date.now()}.mp4`;
    const key = buildUploadKey({
      organizationId,
      businessId,
      folder: "final-cut",
      filename
    });
    const stored = await fetchAndStoreInR2({
      organizationId,
      sourceUrl: mediaUrl,
      key
    });
    const brandAsset = await db.brandAsset.create({
      data: {
        organizationId,
        businessId,
        fileName: filename,
        fileType: "video",
        mimeType: stored.contentType,
        fileSize: stored.size,
        storageKey: stored.key,
        url: stored.publicUrl,
        description: description.slice(0, 1000),
        category: BRAND_ASSET_CATEGORIES.has(category) ? category : "marketing"
      }
    });
    return {
      success: true,
      output: JSON.stringify({
        status: "done",
        project_id: projectId,
        brandAssetId: brandAsset.id,
        publicUrl: stored.publicUrl,
        durationSec:
          typeof movie.duration === "number" ? movie.duration : null
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `check_video_assembly failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── YouTube (Data API v3 + Analytics API) ─────────────────────────────

async function getYoutubeAccessToken(
  organizationId: string
): Promise<string> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "youtube",
    INTEGRATION_FIELD_MAP.youtube
  );
  if (!creds.client_id || !creds.client_secret || !creds.refresh_token) {
    throw new Error(
      "YouTube integration not configured — client_id, client_secret, and refresh_token are required."
    );
  }
  // If a cached access_token is still valid for >60s, reuse it.
  if (creds.access_token && creds.access_token_expires_at) {
    const expires = Number.parseInt(creds.access_token_expires_at, 10);
    if (Number.isFinite(expires) && expires - Date.now() > 60_000) {
      return creds.access_token;
    }
  }
  // Refresh.
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google OAuth refresh failed (${response.status}): ${text.slice(0, 200)}`
    );
  }
  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error("Google OAuth returned no access_token.");
  }
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  await updateIntegrationSecrets(organizationId, "youtube", {
    access_token: data.access_token,
    access_token_expires_at: String(expiresAt)
  });
  return data.access_token;
}

async function youtubeQuotaConsume(
  organizationId: string,
  cost: number
): Promise<{ ok: boolean; used: number; cap: number }> {
  const cap = Number(process.env.YOUTUBE_QUOTA_DAILY_CAP ?? 10000);
  const today = new Date();
  const dateOnly = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    )
  );
  const updated = await db.youTubeQuotaUsage.upsert({
    where: {
      organizationId_date: { organizationId, date: dateOnly }
    },
    create: { organizationId, date: dateOnly, unitsUsed: cost },
    update: { unitsUsed: { increment: cost } }
  });
  if (updated.unitsUsed > cap) {
    // Roll the increment back so a retry later in the day works.
    await db.youTubeQuotaUsage.update({
      where: { id: updated.id },
      data: { unitsUsed: { decrement: cost } }
    });
    return { ok: false, used: updated.unitsUsed - cost, cap };
  }
  return { ok: true, used: updated.unitsUsed, cap };
}

async function youtubeFetch(
  organizationId: string,
  url: string,
  init: RequestInit & { quotaCost?: number } = {}
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const cost = init.quotaCost ?? 1;
  const quota = await youtubeQuotaConsume(organizationId, cost);
  if (!quota.ok) {
    return {
      ok: false,
      status: 429,
      body: {
        error: `YouTube quota cap reached (${quota.used}/${quota.cap} units used today). Try again after 00:00 UTC or request a quota increase in Google Cloud Console.`
      }
    };
  }
  const accessToken = await getYoutubeAccessToken(organizationId);
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* empty */
  }
  return { ok: response.ok, status: response.status, body };
}

const handleYoutubeUploadVideo: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  const businessId = String(args._businessId || "");
  if (!organizationId || !businessId) {
    return {
      success: false,
      output: "",
      error:
        "youtube_upload_video requires an authenticated agent context with a business."
    };
  }
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "youtube",
    INTEGRATION_FIELD_MAP.youtube
  );
  if (!creds.refresh_token) {
    return missingConfigError(
      "youtube_upload_video",
      "YouTube (Publish + Analytics)",
      [
        "YOUTUBE_CLIENT_ID",
        "YOUTUBE_CLIENT_SECRET",
        "YOUTUBE_REFRESH_TOKEN"
      ]
    );
  }
  const videoUrl = String(args.video_url || "").trim();
  const title = String(args.title || "").trim();
  if (!videoUrl || !title) {
    return {
      success: false,
      output: "",
      error: "youtube_upload_video requires video_url and title."
    };
  }
  const description = String(args.description || "");
  const tags = Array.isArray(args.tags)
    ? args.tags.map((t) => String(t))
    : [];
  const categoryId = String(args.category_id || "22");
  const privacyStatus = String(args.privacy_status || "private");
  const madeForKids = Boolean(args.made_for_kids ?? false);
  const publishAt =
    typeof args.publish_at === "string" ? args.publish_at : undefined;

  // Preflight quota check so we fail fast BEFORE consuming a 1600-unit
  // upload budget we can't complete.
  const quota = await youtubeQuotaConsume(organizationId, 1600);
  if (!quota.ok) {
    return {
      success: false,
      output: "",
      error: `YouTube quota cap reached (${quota.used}/${quota.cap}). An upload costs 1600 units. Try again after 00:00 UTC or request a quota increase.`
    };
  }

  try {
    const accessToken = await getYoutubeAccessToken(organizationId);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      await db.youTubeQuotaUsage.updateMany({
        where: { organizationId },
        data: { unitsUsed: { decrement: 1600 } }
      });
      return {
        success: false,
        output: "",
        error: `Failed to fetch video_url (${videoResponse.status}).`
      };
    }
    const videoBytes = await videoResponse.arrayBuffer();
    const mime = videoResponse.headers.get("content-type") ?? "video/mp4";

    const snippet: Record<string, unknown> = {
      title: title.slice(0, 100),
      description: description.slice(0, 5000),
      categoryId
    };
    if (tags.length > 0) snippet.tags = tags.slice(0, 15);
    const status: Record<string, unknown> = {
      privacyStatus,
      selfDeclaredMadeForKids: madeForKids
    };
    if (publishAt) status.publishAt = publishAt;

    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mime,
          "X-Upload-Content-Length": String(videoBytes.byteLength)
        },
        body: JSON.stringify({ snippet, status })
      }
    );
    if (!initResponse.ok) {
      const text = await initResponse.text().catch(() => "");
      await db.youTubeQuotaUsage.updateMany({
        where: { organizationId },
        data: { unitsUsed: { decrement: 1600 } }
      });
      return {
        success: false,
        output: "",
        error: `YouTube upload init ${initResponse.status}: ${text.slice(0, 300)}`
      };
    }
    const uploadUrl = initResponse.headers.get("Location");
    if (!uploadUrl) {
      await db.youTubeQuotaUsage.updateMany({
        where: { organizationId },
        data: { unitsUsed: { decrement: 1600 } }
      });
      return {
        success: false,
        output: "",
        error: "YouTube upload init returned no resumable URL."
      };
    }

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "Content-Length": String(videoBytes.byteLength)
      },
      body: videoBytes
    });
    if (!putResponse.ok) {
      const text = await putResponse.text().catch(() => "");
      return {
        success: false,
        output: "",
        error: `YouTube upload ${putResponse.status}: ${text.slice(0, 300)}`
      };
    }
    const uploaded = (await putResponse.json()) as {
      id?: string;
      status?: { uploadStatus?: string };
    };
    if (!uploaded.id) {
      return {
        success: false,
        output: "",
        error: `YouTube upload completed but returned no video id. Raw: ${JSON.stringify(uploaded).slice(0, 200)}`
      };
    }
    return {
      success: true,
      output: JSON.stringify({
        videoId: uploaded.id,
        uploadStatus: uploaded.status?.uploadStatus ?? "uploaded",
        quotaUsed: 1600,
        watchUrl: `https://www.youtube.com/watch?v=${uploaded.id}`
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `youtube_upload_video failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleYoutubeUpdateVideoMetadata: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error:
        "youtube_update_video_metadata requires an authenticated agent context."
    };
  }
  const videoId = String(args.video_id || "").trim();
  if (!videoId) {
    return {
      success: false,
      output: "",
      error: "youtube_update_video_metadata requires video_id."
    };
  }
  const snippet: Record<string, unknown> = {};
  if (typeof args.title === "string") snippet.title = args.title;
  if (typeof args.description === "string")
    snippet.description = args.description;
  if (Array.isArray(args.tags))
    snippet.tags = args.tags.map((t) => String(t)).slice(0, 15);
  if (typeof args.category_id === "string") snippet.categoryId = args.category_id;

  const hasSnippet = Object.keys(snippet).length > 0;
  const hasStatus = typeof args.privacy_status === "string";
  if (!hasSnippet && !hasStatus) {
    return {
      success: false,
      output: "",
      error: "No metadata fields to update."
    };
  }
  const parts: string[] = [];
  if (hasSnippet) parts.push("snippet");
  if (hasStatus) parts.push("status");

  const payload: Record<string, unknown> = { id: videoId };
  if (hasSnippet) payload.snippet = snippet;
  if (hasStatus)
    payload.status = { privacyStatus: String(args.privacy_status) };

  try {
    const { ok, status, body } = await youtubeFetch(
      organizationId,
      `https://www.googleapis.com/youtube/v3/videos?part=${parts.join(",")}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        quotaCost: 50
      }
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `YouTube ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    return {
      success: true,
      output: JSON.stringify({ videoId, updated: true, quotaUsed: 50 })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `youtube_update_video_metadata failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleYoutubeSetThumbnail: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error:
        "youtube_set_thumbnail requires an authenticated agent context."
    };
  }
  const videoId = String(args.video_id || "").trim();
  const imageUrl = String(args.image_url || "").trim();
  if (!videoId || !imageUrl) {
    return {
      success: false,
      output: "",
      error: "youtube_set_thumbnail requires video_id and image_url."
    };
  }
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return {
        success: false,
        output: "",
        error: `Failed to fetch image_url (${imageResponse.status}).`
      };
    }
    const imageBytes = await imageResponse.arrayBuffer();
    if (imageBytes.byteLength > 2 * 1024 * 1024) {
      return {
        success: false,
        output: "",
        error: "Thumbnail exceeds YouTube's 2MB limit."
      };
    }
    const mime = imageResponse.headers.get("content-type") ?? "image/jpeg";
    const quota = await youtubeQuotaConsume(organizationId, 50);
    if (!quota.ok) {
      return {
        success: false,
        output: "",
        error: `YouTube quota cap reached (${quota.used}/${quota.cap}).`
      };
    }
    const accessToken = await getYoutubeAccessToken(organizationId);
    const response = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mime
        },
        body: imageBytes
      }
    );
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        output: "",
        error: `YouTube ${response.status}: ${text.slice(0, 200)}`
      };
    }
    const data = (await response.json()) as {
      items?: Array<{ default?: { url?: string } }>;
    };
    return {
      success: true,
      output: JSON.stringify({
        videoId,
        thumbnailUrl: data.items?.[0]?.default?.url ?? null,
        quotaUsed: 50
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `youtube_set_thumbnail failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleYoutubeListChannelVideos: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error:
        "youtube_list_channel_videos requires an authenticated agent context."
    };
  }
  const maxResults = Math.min(
    Math.max(Number(args.max_results ?? 10), 1),
    50
  );
  const pageToken =
    typeof args.page_token === "string" ? args.page_token : undefined;

  try {
    // channels.list + playlistItems.list is the cheap path (3-5 units)
    // vs search.list forMine (100 units). Per YouTube docs.
    const { ok: chOk, body: chBody } = await youtubeFetch(
      organizationId,
      "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
      { quotaCost: 1 }
    );
    if (!chOk) {
      return {
        success: false,
        output: "",
        error: `YouTube channels.list failed: ${JSON.stringify(chBody).slice(0, 200)}`
      };
    }
    const chData = chBody as {
      items?: Array<{
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }>;
    };
    const uploadsPlaylistId =
      chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return {
        success: false,
        output: "",
        error: "YouTube channel has no uploads playlist."
      };
    }
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(maxResults)
    });
    if (pageToken) params.set("pageToken", pageToken);
    const { ok, status, body } = await youtubeFetch(
      organizationId,
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      { quotaCost: 1 }
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `YouTube ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const data = body as {
      items?: Array<{
        snippet?: { title?: string; publishedAt?: string };
        contentDetails?: { videoId?: string };
      }>;
      nextPageToken?: string;
    };
    const videoIds = (data.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((v): v is string => typeof v === "string");
    let statsByVideo: Record<
      string,
      { views?: number; likes?: number; comments?: number }
    > = {};
    if (videoIds.length > 0) {
      const { ok: sOk, body: sBody } = await youtubeFetch(
        organizationId,
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(",")}`,
        { quotaCost: 1 }
      );
      if (sOk) {
        const sData = sBody as {
          items?: Array<{
            id?: string;
            statistics?: {
              viewCount?: string;
              likeCount?: string;
              commentCount?: string;
            };
          }>;
        };
        statsByVideo = Object.fromEntries(
          (sData.items ?? []).map((v) => [
            v.id ?? "",
            {
              views: Number(v.statistics?.viewCount ?? 0),
              likes: Number(v.statistics?.likeCount ?? 0),
              comments: Number(v.statistics?.commentCount ?? 0)
            }
          ])
        );
      }
    }
    return {
      success: true,
      output: JSON.stringify({
        count: data.items?.length ?? 0,
        nextPageToken: data.nextPageToken ?? null,
        videos: (data.items ?? []).map((i) => ({
          videoId: i.contentDetails?.videoId ?? null,
          title: i.snippet?.title ?? null,
          publishedAt: i.snippet?.publishedAt ?? null,
          stats: statsByVideo[i.contentDetails?.videoId ?? ""] ?? null
        }))
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `youtube_list_channel_videos failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleYoutubePostCommunityUpdate: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error:
        "youtube_post_community_update requires an authenticated agent context."
    };
  }
  // As of 2026-04, the YouTube Data API v3's public surface has NO
  // stable endpoint for creating Community Posts — the endpoint is
  // allowlisted to select partners. Rather than fake a post, surface
  // the prepared content so the user can paste it into Studio.
  const text = String(args.text || "").trim();
  if (!text) {
    return {
      success: false,
      output: "",
      error: "youtube_post_community_update requires text."
    };
  }
  return {
    success: true,
    output: JSON.stringify({
      status: "requires_manual_post",
      note: "YouTube Community Posts API is allowlisted only. Paste this text into YouTube Studio → Community.",
      text,
      image_url: typeof args.image_url === "string" ? args.image_url : null
    })
  };
};

const handleYoutubeGetVideoAnalytics: ToolHandler = async (args) => {
  const organizationId = String(args._organizationId || "");
  if (!organizationId) {
    return {
      success: false,
      output: "",
      error:
        "youtube_get_video_analytics requires an authenticated agent context."
    };
  }
  const videoIds = Array.isArray(args.video_ids)
    ? args.video_ids.map((v) => String(v)).filter(Boolean)
    : [];
  if (videoIds.length === 0) {
    return {
      success: false,
      output: "",
      error: "youtube_get_video_analytics requires video_ids[]."
    };
  }
  const now = new Date();
  const end =
    typeof args.end_date === "string"
      ? args.end_date
      : now.toISOString().slice(0, 10);
  const start =
    typeof args.start_date === "string"
      ? args.start_date
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
  const metrics = Array.isArray(args.metrics)
    ? args.metrics.map((m) => String(m))
    : [
        "views",
        "impressions",
        "impressionsCtr",
        "averageViewDuration",
        "averageViewPercentage",
        "subscribersGained"
      ];
  try {
    const params = new URLSearchParams({
      ids: "channel==MINE",
      startDate: start,
      endDate: end,
      metrics: metrics.join(","),
      dimensions: "video",
      filters: `video==${videoIds.join(",")}`
    });
    const { ok, status, body } = await youtubeFetch(
      organizationId,
      `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`,
      { quotaCost: 1 }
    );
    if (!ok) {
      return {
        success: false,
        output: "",
        error: `YouTube Analytics ${status}: ${JSON.stringify(body).slice(0, 200)}`
      };
    }
    const data = body as {
      rows?: Array<Array<string | number>>;
      columnHeaders?: Array<{ name: string }>;
    };
    const headers = (data.columnHeaders ?? []).map((h) => h.name);
    const rows = (data.rows ?? []).map((row) => {
      const record: Record<string, string | number> = {};
      headers.forEach((h, i) => {
        record[h] = row[i];
      });
      return record;
    });
    return {
      success: true,
      output: JSON.stringify({
        startDate: start,
        endDate: end,
        metrics,
        rowCount: rows.length,
        rows
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `youtube_get_video_analytics failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// Placeholder for tools not yet fully implemented
const handleNotImplemented: ToolHandler = async (args) => {
  return {
    success: false,
    output: "",
    error: `This tool is installed but its execution handler is not yet connected. The MCP server needs to be running. Args received: ${JSON.stringify(args).slice(0, 200)}`
  };
};

/**
 * The set of tool names that actually have a working handler wired up. Used
 * by buildChatMessages to hide stubbed tools from the agent's toolset
 * entirely — if the handler is handleNotImplemented, the agent should never
 * see the tool in its prompt, never propose it, never call it. Without
 * this filter the CEO spent its turns telling the user "our database isn't
 * connected" instead of doing the actual social-media work the user wants.
 */
export const IMPLEMENTED_TOOL_NAMES = new Set<string>([
  "web_search",
  "social_publish_post",
  "social_get_analytics",
  "social_list_posts",
  "social_list_accounts",
  "send_email",
  "send_sms",
  "scrape_webpage",
  "delegate_task",
  "list_team",
  "check_task_status",
  "suggest_agent_config",
  "create_agent",
  "edit_agent",
  "confirm_create_agent",
  "confirm_edit_agent",
  "think_step_by_step",
  "memory_store",
  "memory_recall",
  "learn_from_outcome",
  "ask_ceo_agent",
  "list_businesses",
  "get_agent_config",
  "list_integration_health",
  "get_business_settings",
  "send_telegram_message",
  "reddit_search",
  "reddit_thread_scan",
  "reddit_get_user_posts",
  "verify_reddit_post",
  "log_reddit_target",
  "reddit_create_post",
  "reddit_reply_to_post",
  "instantly_create_campaign",
  "instantly_launch_campaign",
  "instantly_pause_campaign",
  "instantly_add_leads_to_campaign",
  "instantly_list_campaigns",
  "instantly_get_campaign_analytics",
  "instantly_list_replies",
  "instantly_send_reply",
  "whatsapp_send_text_message",
  "whatsapp_send_template_message",
  "whatsapp_send_media_message",
  "whatsapp_list_message_templates",
  "whatsapp_submit_message_template",
  "whatsapp_list_conversations",
  "whatsapp_mark_as_read",
  "prospect_record_source",
  "prospect_record_qualification",
  "prospect_transition",
  "prospect_funnel_summary",
  "sendpilot_send_dm",
  "sendpilot_send_connection_request",
  "sendpilot_list_senders",
  "sendpilot_list_campaigns",
  "sendpilot_list_leads",
  "sendpilot_update_lead_status",
  "manychat_send_content",
  "manychat_send_flow",
  "manychat_find_subscriber_by_email",
  "manychat_get_subscriber_info",
  "manychat_add_tag",
  "manychat_remove_tag",
  "manychat_set_custom_field",
  "manychat_list_subscribers_by_tag",
  "log_outreach_target",
  "hn_search",
  "hn_thread_scan",
  "stackoverflow_search",
  "github_search_issues",
  "fetch_video_transcript",
  "log_video_clip",
  "log_broll_scene",
  "knowledge_lookup",
  "list_knowledge_items",
  "get_knowledge_budget",
  "update_knowledge_tiering",
  "generate_image",
  "generate_video",
  "fal_check_generation",
  "list_brand_assets",
  "get_brand_asset",
  "propose_todo",
  "list_todos",
  "heygen_list_avatars",
  "heygen_generate_video",
  "heygen_check_video",
  "creatify_list_avatars",
  "creatify_generate_ugc",
  "creatify_check_ugc",
  "auto_clip_submit",
  "auto_clip_check",
  "broll_search",
  "upload_to_r2",
  "list_elevenlabs_voices",
  "generate_voiceover",
  "transcribe_audio",
  "assemble_video",
  "check_video_assembly",
  "youtube_upload_video",
  "youtube_update_video_metadata",
  "youtube_set_thumbnail",
  "youtube_list_channel_videos",
  "youtube_post_community_update",
  "youtube_get_video_analytics",
  "forex_quote",
  "forex_bars",
  "forex_macro_release",
  "forex_news",
  "oanda_get_account",
  "oanda_get_positions",
  "oanda_get_instrument_pricing",
  "oanda_place_order",
  "oanda_close_position",
  "oanda_modify_order",
  "tradovate_get_account",
  "tradovate_get_positions",
  "tradovate_place_order",
  "dealhawk_search_properties",
  "dealhawk_create_deal",
  "dealhawk_score_lead",
  "dealhawk_skip_trace",
  "dealhawk_compute_mao",
  "dealhawk_qualify_sub_to",
  "dealhawk_update_deal",
  "dealhawk_draft_outreach",
  "dealhawk_log_touch",
  "dealhawk_coach_objection",
  "dealhawk_schedule_followup",
  "dealhawk_add_buyer",
  "dealhawk_list_buyers",
  "dealhawk_match_buyers",
  "dealhawk_build_deal_package",
  "dealhawk_design_creative_structure",
  "dealhawk_compliance_check",
  // Blotato — unified cross-platform publishing + AI visual generation +
  // content extraction across 9 social platforms. See handleBlotato* + the
  // blotato_mcp tool registry block + the Blotato Operational Playbook KB
  // on the 15 templates that ship Blotato as required or suggested.
  "blotato_get_user",
  "blotato_list_accounts",
  "blotato_list_subaccounts",
  "blotato_create_post",
  "blotato_get_post_status",
  "blotato_list_posts",
  "blotato_create_source",
  "blotato_get_source_status",
  "blotato_list_visual_templates",
  "blotato_create_visual",
  "blotato_get_visual_status",
  "blotato_list_schedules",
  "blotato_get_schedule",
  "blotato_update_schedule",
  "blotato_delete_schedule",
  "blotato_list_schedule_slots",
  "blotato_create_schedule_slots",
  "blotato_update_schedule_slot",
  "blotato_delete_schedule_slot",
  "blotato_find_next_available_slot",
  "blotato_create_presigned_upload_url",
  // A-Leads — people + company enrichment + email/phone finder. Used by
  // TRA's Prospect Hunter + tiptax sourcing workflows.
  "a_leads_advanced_search",
  "a_leads_bulk_advanced_search",
  "a_leads_company_search",
  "a_leads_company_search_bulk",
  "a_leads_company_similar",
  "a_leads_find_email",
  "a_leads_find_personal_email",
  "a_leads_find_phone",
  "a_leads_verify_email",

  // Real-estate property data — RentCast, Axesso Zillow, Realie.
  // Recommended for Dealhawk Empire sourcing. Each provider is
  // optional; unified property_* tools route to whichever is configured.
  "rentcast_search_properties",
  "rentcast_value_estimate",
  "rentcast_rent_estimate",
  "rentcast_sale_listings",
  "rentcast_rental_listings",
  "rentcast_market_data",
  "axesso_zillow_search_by_location",
  "axesso_zillow_search_by_url",
  "axesso_zillow_property_details",
  "axesso_zillow_zestimate",
  "axesso_zillow_price_history",
  "axesso_zillow_comparable_homes",
  "axesso_zillow_neighborhood",
  "axesso_zillow_accessibility_scores",
  "axesso_zillow_market_trends",
  "axesso_zillow_agent_listings",
  "realie_address_lookup",
  "realie_location_search",
  "realie_property_search",
  "realie_owner_search",
  "realie_parcel_lookup",
  "realie_comparables_search",
  "realie_premium_owner_search",
  "property_search",
  "property_lookup",
  "property_value_estimate",
  "property_rent_estimate",
  "property_owner_lookup",
  "property_comps",
  "property_distressed_search",

  // Slack Outreach (handlers exist; only the IMPLEMENTED_TOOL_NAMES entries
  // were missing — runtime filter was stripping the tools).
  "slack_outreach_lookup_user_by_email",
  "slack_outreach_create_connect_channel",
  "slack_outreach_invite_connect_by_email",
  "slack_outreach_post_message",
  "slack_outreach_list_connect_invites",
  "slack_outreach_log_target",
  "slack_outreach_handoff_from_email_reply"
]);

// ── Forex Data + Trading Handlers (Phase 2a — read-only) ──────────

/**
 * TwelveData — real-time forex quote for a single pair.
 * Free tier: 800 req/day, 8 req/min. The handler calls /price for a lightweight
 * lookup and falls back to /quote if a fuller snapshot was requested.
 */
const handleForexQuote: ToolHandler = async (args, _config, secrets) => {
  const symbol = String(args.symbol || "").trim();
  if (!symbol) {
    return { success: false, output: "", error: "symbol is required (e.g. 'EUR/USD')." };
  }
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return {
      success: false,
      output: "",
      error:
        "TwelveData API key not configured. Add it under Integrations → TwelveData — Forex Quotes."
    };
  }

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, output: "", error: `TwelveData error: ${res.status}` };
    }
    const data = await res.json();
    if (data.status === "error" || data.code) {
      return {
        success: false,
        output: "",
        error: `TwelveData: ${data.message ?? "unknown error"}`
      };
    }

    const output = {
      symbol: data.symbol,
      close: data.close,
      open: data.open,
      high: data.high,
      low: data.low,
      bid: data.bid ?? null,
      ask: data.ask ?? null,
      previous_close: data.previous_close,
      change: data.change,
      percent_change: data.percent_change,
      is_market_open: data.is_market_open,
      timestamp: data.timestamp
    };
    return { success: true, output: JSON.stringify(output, null, 2) };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `forex_quote failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

/**
 * TwelveData — OHLC bars for a pair at a chosen interval.
 * Defaults to 30 bars to preserve the free-tier quota.
 */
const handleForexBars: ToolHandler = async (args, _config, secrets) => {
  const symbol = String(args.symbol || "").trim();
  const interval = String(args.interval || "").trim();
  const outputsize = Number(args.outputsize) > 0 ? Number(args.outputsize) : 30;
  if (!symbol || !interval) {
    return {
      success: false,
      output: "",
      error: "symbol and interval are both required."
    };
  }
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return {
      success: false,
      output: "",
      error:
        "TwelveData API key not configured. Add it under Integrations → TwelveData — Forex Quotes."
    };
  }

  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, output: "", error: `TwelveData error: ${res.status}` };
    }
    const data = await res.json();
    if (data.status === "error") {
      return {
        success: false,
        output: "",
        error: `TwelveData: ${data.message ?? "unknown error"}`
      };
    }

    const values = Array.isArray(data.values) ? data.values.slice(0, 100) : [];
    return {
      success: true,
      output: JSON.stringify(
        {
          symbol: data.meta?.symbol ?? symbol,
          interval: data.meta?.interval ?? interval,
          count: values.length,
          values
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `forex_bars failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

/**
 * FRED — Federal Reserve Economic Data. No per-minute rate limit for casual use.
 * Returns the last `limit` observations for the requested series_id.
 */
const handleForexMacroRelease: ToolHandler = async (args, _config, secrets) => {
  const seriesId = String(args.series_id || "").trim();
  const limit = Number(args.limit) > 0 ? Number(args.limit) : 12;
  if (!seriesId) {
    return { success: false, output: "", error: "series_id is required." };
  }
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return {
      success: false,
      output: "",
      error:
        "FRED API key not configured. Add it under Integrations → FRED — Federal Reserve Macro Data."
    };
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(apiKey)}&file_type=json&limit=${limit}&sort_order=desc`;
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, output: "", error: `FRED error: ${res.status}` };
    }
    const data = await res.json();
    if (data.error_code) {
      return { success: false, output: "", error: `FRED: ${data.error_message}` };
    }
    const observations = Array.isArray(data.observations)
      ? data.observations.slice(0, limit).map((o: { date: string; value: string }) => ({
          date: o.date,
          value: o.value
        }))
      : [];
    return {
      success: true,
      output: JSON.stringify(
        {
          series_id: seriesId,
          count: observations.length,
          observations
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `forex_macro_release failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

/**
 * Finnhub — general / forex news headlines. Free tier is 60 calls/min.
 * Returns up to `max_results` items with headline, source, timestamp, related.
 */
const handleForexNews: ToolHandler = async (args, _config, secrets) => {
  const category = String(args.category || "forex").trim();
  const maxResults = Math.min(Number(args.max_results) || 10, 20);
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return {
      success: false,
      output: "",
      error:
        "Finnhub API key not configured. Add it under Integrations → Finnhub — News & Earnings Calendar."
    };
  }

  try {
    const url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, output: "", error: `Finnhub error: ${res.status}` };
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return {
        success: false,
        output: "",
        error: "Finnhub returned an unexpected response."
      };
    }
    const items = data.slice(0, maxResults).map(
      (n: {
        headline: string;
        summary: string;
        source: string;
        datetime: number;
        related: string;
        url: string;
      }) => ({
        headline: n.headline,
        summary: n.summary,
        source: n.source,
        timestamp: new Date((n.datetime || 0) * 1000).toISOString(),
        related: n.related || "",
        url: n.url
      })
    );
    return {
      success: true,
      output: JSON.stringify({ category, count: items.length, items }, null, 2)
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `forex_news failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

/**
 * OANDA v20 — helper that picks the practice vs live host based on config.
 * Practice is the default; agents should never touch live until tradingMode
 * is upgraded in Phase 2b.
 */
function oandaHost(config: Record<string, string>): string {
  return config.environment === "live"
    ? "https://api-fxtrade.oanda.com"
    : "https://api-fxpractice.oanda.com";
}

const handleOandaGetAccount: ToolHandler = async (_args, config, secrets) => {
  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    return {
      success: false,
      output: "",
      error:
        "OANDA not fully configured. Add account_id and api_key under Integrations → OANDA v20."
    };
  }

  try {
    const url = `${oandaHost(config)}/v3/accounts/${encodeURIComponent(accountId)}/summary`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      return { success: false, output: "", error: `OANDA error: ${res.status}` };
    }
    const data = await res.json();
    return {
      success: true,
      output: JSON.stringify(data.account ?? data, null, 2)
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `oanda_get_account failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

const handleOandaGetPositions: ToolHandler = async (_args, config, secrets) => {
  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    return {
      success: false,
      output: "",
      error:
        "OANDA not fully configured. Add account_id and api_key under Integrations → OANDA v20."
    };
  }

  try {
    const url = `${oandaHost(config)}/v3/accounts/${encodeURIComponent(accountId)}/openPositions`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      return { success: false, output: "", error: `OANDA error: ${res.status}` };
    }
    const data = await res.json();
    return {
      success: true,
      output: JSON.stringify(
        {
          lastTransactionID: data.lastTransactionID,
          positions: data.positions ?? []
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `oanda_get_positions failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

// ── Tradovate handlers (CME FX futures via Tradovate API) ─────────

const handleTradovateGetAccount: ToolHandler = async (args, config, secrets) => {
  const { extractTradovateCredentials, tradovateGet, withTradovateRetry } =
    await import("@/lib/trading/tradovate-client");
  const creds = extractTradovateCredentials(config, secrets);
  if (!creds) {
    return {
      success: false,
      output: "",
      error:
        "Tradovate not fully configured. Add username, password, cid, sec, app_id, app_version under Integrations → Tradovate Futures."
    };
  }
  try {
    const listRes = await withTradovateRetry(creds, (token) =>
      tradovateGet(creds, token, "/account/list")
    );
    if (!listRes.ok) {
      return {
        success: false,
        output: "",
        error: `Tradovate /account/list error: ${listRes.status}`
      };
    }
    const accounts = (await listRes.json()) as Array<{ id: number; name: string }>;
    const targetId =
      typeof args.account_id === "number" && args.account_id > 0
        ? args.account_id
        : accounts[0]?.id;
    if (!targetId) {
      return {
        success: false,
        output: "",
        error: "No Tradovate accounts found for this user."
      };
    }
    const sumRes = await withTradovateRetry(creds, (token) =>
      tradovateGet(
        creds,
        token,
        `/cashBalance/getcashbalancesnapshot?accountId=${targetId}`
      )
    );
    const summary = sumRes.ok ? await sumRes.json() : null;
    return {
      success: true,
      output: JSON.stringify(
        {
          environment: creds.environment,
          accounts,
          targetAccountId: targetId,
          cashBalanceSnapshot: summary
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : "tradovate_get_account failed"
    };
  }
};

const handleTradovateGetPositions: ToolHandler = async (args, config, secrets) => {
  const { extractTradovateCredentials, tradovateGet, withTradovateRetry } =
    await import("@/lib/trading/tradovate-client");
  const creds = extractTradovateCredentials(config, secrets);
  if (!creds) {
    return {
      success: false,
      output: "",
      error:
        "Tradovate not fully configured. Add credentials under Integrations → Tradovate Futures."
    };
  }
  try {
    let accountId = typeof args.account_id === "number" ? args.account_id : null;
    if (!accountId) {
      const listRes = await withTradovateRetry(creds, (token) =>
        tradovateGet(creds, token, "/account/list")
      );
      if (listRes.ok) {
        const list = (await listRes.json()) as Array<{ id: number }>;
        accountId = list[0]?.id ?? null;
      }
    }
    if (!accountId) {
      return {
        success: false,
        output: "",
        error: "No Tradovate accounts found for this user."
      };
    }
    const res = await withTradovateRetry(creds, (token) =>
      tradovateGet(creds, token, `/position/list?accountId=${accountId}`)
    );
    if (!res.ok) {
      return {
        success: false,
        output: "",
        error: `Tradovate /position/list error: ${res.status}`
      };
    }
    const positions = await res.json();
    return {
      success: true,
      output: JSON.stringify({ accountId, positions }, null, 2)
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : "tradovate_get_positions failed"
    };
  }
};

/**
 * Tradovate place_order — the US futures execution tool. Mode-gated
 * identically to oanda_place_order: research refuses, demo fires to
 * demo.tradovateapi.com, live queues a tradovate_place_order approval.
 */
const handleTradovatePlaceOrder: ToolHandler = async (args, config, secrets) => {
  const businessId = typeof args._businessId === "string" ? args._businessId : "";
  const agentId = typeof args._agentId === "string" ? args._agentId : null;

  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "tradovate_place_order requires a business context. Calls from org-wide agents are not supported."
    };
  }

  const required = [
    "symbol",
    "side",
    "contracts",
    "stop_loss_price",
    "thesis",
    "catalyst",
    "invalidation"
  ];
  for (const field of required) {
    if (args[field] === undefined || args[field] === null || args[field] === "") {
      return {
        success: false,
        output: "",
        error: `tradovate_place_order: missing required field "${field}".`
      };
    }
  }

  const symbol = String(args.symbol).toUpperCase();
  const side = String(args.side) as "buy" | "sell";
  const contracts = Number(args.contracts);
  const stopLossPrice = Number(args.stop_loss_price);
  const takeProfitPrice =
    args.take_profit_price !== undefined && args.take_profit_price !== null
      ? Number(args.take_profit_price)
      : null;
  const thesis = String(args.thesis);
  const catalyst = String(args.catalyst);
  const invalidation = String(args.invalidation);
  const expectedHoldingHours =
    args.expected_holding_hours !== undefined
      ? Number(args.expected_holding_hours)
      : null;

  if (side !== "buy" && side !== "sell") {
    return { success: false, output: "", error: "side must be 'buy' or 'sell'." };
  }
  if (!Number.isFinite(contracts) || contracts <= 0) {
    return {
      success: false,
      output: "",
      error: "contracts must be a positive integer."
    };
  }

  const { getBusinessTradingMode, decideTradingAction } = await import(
    "@/lib/trading/mode-gate"
  );
  const mode = await getBusinessTradingMode(businessId);
  const decision = decideTradingAction(mode);

  if (decision.action === "reject") {
    return { success: false, output: "", error: decision.reason };
  }

  // Phase 2d: use the futures-specific worst-case loss estimator for the
  // prop-firm pre-trade check. We don't have the entry price at order
  // time (it's MARKET), but most futures rules are expressed as absolute
  // dollars, so we use stop_distance × tick_value as a lower-bound check.
  try {
    const { getPropFirmHeadroom } = await import("@/lib/trading/prop-firm-headroom");
    const { estimateFuturesWorstCaseLossUsd } = await import(
      "@/lib/trading/pip-values"
    );
    const summary = await getPropFirmHeadroom(businessId);
    if (summary) {
      // We need an entry price guess. The conservative approach: use
      // the current best-ask (for buy) or best-bid (for sell). For
      // simplicity in Phase 2d we skip the live quote and rely on the
      // operator to also supply a size that respects the daily-DD
      // envelope. The prop-firm agent surfaces headroom; the operator
      // sizes accordingly.
      if (summary.overallWarning === "bust") {
        return {
          success: false,
          output: "",
          error:
            "A prop-firm rule is already busted on this business. No new futures orders can be placed until the profile is reset."
        };
      }
      const worst = estimateFuturesWorstCaseLossUsd({
        symbol,
        entryPrice: stopLossPrice, // degenerate — forces 0 estimate
        stopPrice: stopLossPrice,
        contracts
      });
      // When entry price can't be known at MARKET-order time, worst-case
      // is 0 from our estimator. Skip the rule rejection in that case —
      // the approval queue + human click is the real gate for live,
      // and the headroom dashboard is visible in all modes.
      if (worst > 0) {
        const dd = summary.rules.find((r) => r.name === "maxDrawdown");
        if (dd && dd.remainingUsd < worst) {
          return {
            success: false,
            output: "",
            error: `Order would exceed max-drawdown headroom. Worst-case ~$${worst.toFixed(2)}, remaining $${dd.remainingUsd.toFixed(2)}.`
          };
        }
      }
    }
  } catch {
    // pre-trade check is best-effort — don't block the order if the
    // helper errors.
  }

  const intent = {
    broker: "tradovate",
    symbol,
    side,
    contracts,
    stopLossPrice,
    takeProfitPrice,
    thesis,
    catalyst,
    invalidation,
    expectedHoldingHours,
    submittedAt: new Date().toISOString(),
    tradingMode: mode,
    agentId
  };

  if (decision.action === "queue") {
    try {
      const activityEntry = await db.activityEntry.create({
        data: {
          businessId,
          type: "forex_order",
          title: `${side === "buy" ? "LONG" : "SHORT"} ${symbol} · ${contracts} contracts`,
          detail: thesis,
          status: "pending",
          metadata: intent
        }
      });
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);
      const approval = await db.approvalRequest.create({
        data: {
          businessId,
          agentId,
          actionType: "place_futures_order",
          actionDetail: { ...intent, activityEntryId: activityEntry.id },
          status: "pending",
          expiresAt
        }
      });
      return {
        success: true,
        output: `Futures order QUEUED for live approval (expires in 2h). Approval id: ${approval.id}. No order has been placed yet — fires only when the operator clicks Approve.`
      };
    } catch (err) {
      return {
        success: false,
        output: "",
        error: `tradovate queue failed: ${err instanceof Error ? err.message : "unknown"}`
      };
    }
  }

  // Demo mode — fire immediately against demo.tradovateapi.com. We refuse
  // if the integration is configured for 'live' (mismatch with Paper).
  const {
    buildTradovateBracketBody,
    extractTradovateCredentials,
    tradovateGet,
    tradovatePost,
    withTradovateRetry
  } = await import("@/lib/trading/tradovate-client");
  const creds = extractTradovateCredentials(config, secrets);
  if (!creds) {
    return {
      success: false,
      output: "",
      error:
        "Tradovate not fully configured. Add credentials under Integrations → Tradovate Futures."
    };
  }
  if (creds.environment === "live") {
    return {
      success: false,
      output: "",
      error:
        "Paper mode cannot fire against a Tradovate live environment. Switch the Tradovate integration environment to 'demo'."
    };
  }

  try {
    const listRes = await withTradovateRetry(creds, (token) =>
      tradovateGet(creds, token, "/account/list")
    );
    const accounts = listRes.ok
      ? ((await listRes.json()) as Array<{ id: number }>)
      : [];
    const accountId = accounts[0]?.id;
    if (!accountId) {
      return {
        success: false,
        output: "",
        error: "No Tradovate accounts found for this user."
      };
    }
    // placeOSO (one-sends-others) attaches protective stop + optional
    // take-profit at the broker on fill — not in our metadata only.
    const orderBody = buildTradovateBracketBody({
      accountSpec: creds.username,
      accountId,
      side,
      symbol,
      contracts,
      stopPrice: stopLossPrice,
      takeProfitPrice: takeProfitPrice
    });
    const res = await withTradovateRetry(creds, (token) =>
      tradovatePost(creds, token, "/order/placeoso", orderBody)
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        output: "",
        error: `Tradovate demo placeOSO error (${res.status}): ${JSON.stringify(data).slice(0, 300)}`
      };
    }

    // Log completed paper trade so the paper→live gate can count it.
    await db.activityEntry.create({
      data: {
        businessId,
        type: "forex_order",
        title: `[PAPER FUT] ${side === "buy" ? "LONG" : "SHORT"} ${symbol} · ${contracts}`,
        detail: thesis,
        status: "completed",
        metadata: { ...intent, tradovateResponse: data }
      }
    });

    return {
      success: true,
      output: JSON.stringify(
        {
          mode: "paper",
          environment: creds.environment,
          entry: "Market",
          bracketStop: stopLossPrice,
          bracketTake: takeProfitPrice,
          response: data
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: err instanceof Error ? err.message : "tradovate_place_order failed"
    };
  }
};

/**
 * OANDA close_position — close all or part of an open position. Research
 * refuses, paper fires to practice, live_approval queues an approval.
 */
const handleOandaClosePosition: ToolHandler = async (args, config, secrets) => {
  const businessId = typeof args._businessId === "string" ? args._businessId : "";
  const agentId = typeof args._agentId === "string" ? args._agentId : null;

  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "oanda_close_position requires a business context."
    };
  }

  const instrument = typeof args.instrument === "string" ? args.instrument : "";
  const side = typeof args.side === "string" ? args.side : "both";
  const units = typeof args.units === "string" && args.units ? args.units : "ALL";
  const reason = typeof args.reason === "string" ? args.reason : "";

  if (!instrument || !reason) {
    return {
      success: false,
      output: "",
      error: "instrument and reason are both required."
    };
  }

  const { getBusinessTradingMode, decideTradingAction } = await import(
    "@/lib/trading/mode-gate"
  );
  const mode = await getBusinessTradingMode(businessId);
  const decision = decideTradingAction(mode);

  if (decision.action === "reject") {
    return { success: false, output: "", error: decision.reason };
  }

  const intent = {
    action: "close_position",
    instrument,
    side,
    units,
    reason,
    agentId,
    submittedAt: new Date().toISOString(),
    tradingMode: mode
  };

  // Shared close helper so the live-approve path and the kill-switch path
  // can both invoke it later with resolved credentials.
  async function fireClose(
    host: string,
    accountId: string,
    apiKey: string
  ) {
    const body: Record<string, string> = {};
    if (side === "long" || side === "both") body.longUnits = units;
    if (side === "short" || side === "both") body.shortUnits = units;
    const res = await fetch(
      `${host}/v3/accounts/${encodeURIComponent(accountId)}/positions/${encodeURIComponent(instrument)}/close`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  if (decision.action === "queue") {
    try {
      const activityEntry = await db.activityEntry.create({
        data: {
          businessId,
          type: "forex_order",
          title: `CLOSE ${instrument} · ${side} · ${units}`,
          detail: reason,
          status: "pending",
          metadata: intent
        }
      });
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);
      const approval = await db.approvalRequest.create({
        data: {
          businessId,
          agentId,
          actionType: "close_forex_position",
          actionDetail: { ...intent, activityEntryId: activityEntry.id },
          status: "pending",
          expiresAt
        }
      });
      return {
        success: true,
        output: `Position close QUEUED for approval. Approval id: ${approval.id}. Expires in 2h.`
      };
    } catch (err) {
      return {
        success: false,
        output: "",
        error: `close queue failed: ${err instanceof Error ? err.message : "unknown error"}`
      };
    }
  }

  // Paper mode — fire against practice endpoint.
  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    return {
      success: false,
      output: "",
      error: "OANDA not fully configured. Add credentials under Integrations."
    };
  }
  if (config.environment === "live") {
    return {
      success: false,
      output: "",
      error:
        "Paper mode cannot fire against an OANDA live environment. Switch the OANDA integration to 'practice'."
    };
  }

  try {
    const result = await fireClose(
      "https://api-fxpractice.oanda.com",
      accountId,
      apiKey
    );
    if (!result.ok) {
      return {
        success: false,
        output: "",
        error: `OANDA practice close error (${result.status}): ${JSON.stringify(result.data).slice(0, 300)}`
      };
    }
    await db.activityEntry.create({
      data: {
        businessId,
        type: "forex_order",
        title: `[PAPER CLOSE] ${instrument} · ${side} · ${units}`,
        detail: reason,
        status: "completed",
        metadata: { ...intent, oandaResponse: result.data }
      }
    });
    return {
      success: true,
      output: JSON.stringify(
        { mode: "paper", closed: instrument, response: result.data },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `close failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

/**
 * OANDA modify_order — adjust stop-loss / take-profit on an open trade.
 * Research refuses, paper fires to practice, live_approval queues an
 * approval with actionType "modify_forex_order".
 */
const handleOandaModifyOrder: ToolHandler = async (args, config, secrets) => {
  const businessId = typeof args._businessId === "string" ? args._businessId : "";
  const agentId = typeof args._agentId === "string" ? args._agentId : null;

  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "oanda_modify_order requires a business context."
    };
  }

  const tradeId = typeof args.trade_id === "string" ? args.trade_id : "";
  const newStop =
    args.new_stop_loss_price !== undefined && args.new_stop_loss_price !== null
      ? Number(args.new_stop_loss_price)
      : null;
  const newTake =
    args.new_take_profit_price !== undefined && args.new_take_profit_price !== null
      ? Number(args.new_take_profit_price)
      : null;
  const reason = typeof args.reason === "string" ? args.reason : "";

  if (!tradeId || !reason) {
    return { success: false, output: "", error: "trade_id and reason are required." };
  }
  if (newStop === null && newTake === null) {
    return {
      success: false,
      output: "",
      error: "At least one of new_stop_loss_price or new_take_profit_price must be provided."
    };
  }

  const { getBusinessTradingMode, decideTradingAction } = await import(
    "@/lib/trading/mode-gate"
  );
  const mode = await getBusinessTradingMode(businessId);
  const decision = decideTradingAction(mode);

  if (decision.action === "reject") {
    return { success: false, output: "", error: decision.reason };
  }

  const intent = {
    action: "modify_order",
    tradeId,
    newStopLossPrice: newStop,
    newTakeProfitPrice: newTake,
    reason,
    agentId,
    submittedAt: new Date().toISOString(),
    tradingMode: mode
  };

  async function fireModify(host: string, accountId: string, apiKey: string) {
    const body: Record<string, unknown> = {};
    if (newStop !== null) {
      body.stopLoss = { price: newStop.toFixed(5), timeInForce: "GTC" };
    }
    if (newTake !== null) {
      body.takeProfit = { price: newTake.toFixed(5), timeInForce: "GTC" };
    }
    const res = await fetch(
      `${host}/v3/accounts/${encodeURIComponent(accountId)}/trades/${encodeURIComponent(tradeId)}/orders`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  if (decision.action === "queue") {
    try {
      const activityEntry = await db.activityEntry.create({
        data: {
          businessId,
          type: "forex_order",
          title: `MODIFY trade ${tradeId}`,
          detail: reason,
          status: "pending",
          metadata: intent
        }
      });
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);
      const approval = await db.approvalRequest.create({
        data: {
          businessId,
          agentId,
          actionType: "modify_forex_order",
          actionDetail: { ...intent, activityEntryId: activityEntry.id },
          status: "pending",
          expiresAt
        }
      });
      return {
        success: true,
        output: `Modify QUEUED for approval. Approval id: ${approval.id}. Expires in 2h.`
      };
    } catch (err) {
      return {
        success: false,
        output: "",
        error: `modify queue failed: ${err instanceof Error ? err.message : "unknown error"}`
      };
    }
  }

  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    return {
      success: false,
      output: "",
      error: "OANDA not fully configured."
    };
  }
  if (config.environment === "live") {
    return {
      success: false,
      output: "",
      error:
        "Paper mode cannot fire against an OANDA live environment. Switch the integration to 'practice'."
    };
  }

  try {
    const result = await fireModify(
      "https://api-fxpractice.oanda.com",
      accountId,
      apiKey
    );
    if (!result.ok) {
      return {
        success: false,
        output: "",
        error: `OANDA practice modify error (${result.status}): ${JSON.stringify(result.data).slice(0, 300)}`
      };
    }
    await db.activityEntry.create({
      data: {
        businessId,
        type: "forex_order",
        title: `[PAPER MODIFY] trade ${tradeId}`,
        detail: reason,
        status: "completed",
        metadata: { ...intent, oandaResponse: result.data }
      }
    });
    return {
      success: true,
      output: JSON.stringify(
        { mode: "paper", tradeId, response: result.data },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `modify failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

/**
 * OANDA place_order — the first write tool. Mode-gated: research refuses,
 * paper fires against the practice endpoint, live_approval creates an
 * ApprovalRequest + ActivityEntry and waits for a human click.
 *
 * The handler NEVER hits the live endpoint directly. Live firing happens
 * from the approval execute-on-approve hook in
 * app/api/admin/approvals/[id]/route.ts which calls fireOandaOrder after
 * validating the approval record.
 */
const handleOandaPlaceOrder: ToolHandler = async (args, config, secrets) => {
  // Context plumbed by executeTool — see tool-executor args.
  const businessId = typeof args._businessId === "string" ? args._businessId : "";
  const agentId = typeof args._agentId === "string" ? args._agentId : null;

  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "oanda_place_order requires a business context. Calls from org-wide agents (Master Agent) are not supported — route through the Chief of Desk of a specific business."
    };
  }

  const required = ["instrument", "side", "units", "stop_loss_price", "thesis", "catalyst", "invalidation"];
  for (const field of required) {
    if (args[field] === undefined || args[field] === null || args[field] === "") {
      return {
        success: false,
        output: "",
        error: `oanda_place_order: missing required field "${field}". The Risk Gate rejects orders without every risk-language field (thesis, catalyst, invalidation, stop_loss_price).`
      };
    }
  }

  const instrument = String(args.instrument);
  const side = String(args.side) as "buy" | "sell";
  const units = Number(args.units);
  const stopLossPrice = Number(args.stop_loss_price);
  const takeProfitPrice =
    args.take_profit_price !== undefined && args.take_profit_price !== null
      ? Number(args.take_profit_price)
      : null;
  const thesis = String(args.thesis);
  const catalyst = String(args.catalyst);
  const invalidation = String(args.invalidation);
  const expectedHoldingHours =
    args.expected_holding_hours !== undefined
      ? Number(args.expected_holding_hours)
      : null;

  if (side !== "buy" && side !== "sell") {
    return { success: false, output: "", error: "side must be 'buy' or 'sell'." };
  }
  if (!Number.isFinite(units) || units <= 0) {
    return {
      success: false,
      output: "",
      error: "units must be a positive number (the handler encodes direction from side)."
    };
  }

  // tradingMode gate — the defining Phase 2b enforcement point.
  const { getBusinessTradingMode, decideTradingAction } = await import("@/lib/trading/mode-gate");
  const mode = await getBusinessTradingMode(businessId);
  const decision = decideTradingAction(mode);

  if (decision.action === "reject") {
    return { success: false, output: "", error: decision.reason };
  }

  // Phase 2c pre-trade check: if a PropFirmProfile is active for this
  // business, verify the worst-case loss fits inside the rule headroom.
  // Phase 2d: passes instrument so the pip-values lookup can handle
  // JPY-quoted pairs accurately. See lib/trading/pip-values.ts.
  const { checkPropFirmOrder } = await import("@/lib/trading/prop-firm-headroom");
  const propCheck = await checkPropFirmOrder(businessId, {
    instrument,
    entryPrice: undefined, // agent should pass an entry if it wants a real check
    stopLossPrice,
    units,
    side
  });
  if (!propCheck.ok) {
    return {
      success: false,
      output: "",
      error: `Prop-firm rule check failed: ${propCheck.reason ?? "unknown"}. Detach the active PropFirmProfile or request a smaller position.`
    };
  }

  // Build the canonical order intent. Used identically for paper execution,
  // approval actionDetail, and the journal entry.
  const intent = {
    instrument,
    side,
    units,
    signedUnits: side === "buy" ? units : -units,
    stopLossPrice,
    takeProfitPrice,
    thesis,
    catalyst,
    invalidation,
    expectedHoldingHours,
    submittedAt: new Date().toISOString(),
    tradingMode: mode,
    agentId
  };

  if (decision.action === "queue") {
    // Live mode — create ActivityEntry + ApprovalRequest and return the
    // approval id so the agent can reference it in its journal. We do NOT
    // hit OANDA's live endpoint here.
    try {
      const activityEntry = await db.activityEntry.create({
        data: {
          businessId,
          type: "forex_order",
          title: `${side === "buy" ? "LONG" : "SHORT"} ${instrument} · ${units} units`,
          detail: thesis,
          status: "pending",
          metadata: intent
        }
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const approval = await db.approvalRequest.create({
        data: {
          businessId,
          agentId,
          actionType: "place_forex_order",
          actionDetail: {
            ...intent,
            activityEntryId: activityEntry.id
          },
          status: "pending",
          expiresAt
        }
      });

      return {
        success: true,
        output: `Order QUEUED for live approval (expires in 2h). Approval id: ${approval.id}. No order has been placed yet — the fill happens ONLY when the operator clicks Approve in /admin/approvals. If the 2h window closes without approval, the order auto-expires.`
      };
    } catch (err) {
      return {
        success: false,
        output: "",
        error: `oanda_place_order queue failed: ${err instanceof Error ? err.message : "unknown error"}`
      };
    }
  }

  // Paper mode — fire against the OANDA practice endpoint immediately.
  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  if (!accountId || !apiKey) {
    return {
      success: false,
      output: "",
      error:
        "OANDA not fully configured. Add account_id (practice) and api_key under Integrations → OANDA v20 before Paper mode can fire orders."
    };
  }
  if (config.environment === "live") {
    // Defensive: even in Paper mode we refuse a live-endpoint configuration.
    return {
      success: false,
      output: "",
      error:
        "Paper mode cannot fire against an OANDA live environment. Open the OANDA integration and switch environment to 'practice', or attach a practice account_id."
    };
  }

  try {
    const host = "https://api-fxpractice.oanda.com";
    const orderBody = {
      order: {
        type: "MARKET",
        instrument,
        units: String(intent.signedUnits),
        timeInForce: "FOK",
        positionFill: "DEFAULT",
        stopLossOnFill: {
          price: stopLossPrice.toFixed(5),
          timeInForce: "GTC"
        },
        ...(takeProfitPrice
          ? {
              takeProfitOnFill: {
                price: takeProfitPrice.toFixed(5),
                timeInForce: "GTC"
              }
            }
          : {})
      }
    };

    const res = await fetch(
      `${host}/v3/accounts/${encodeURIComponent(accountId)}/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderBody)
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        output: "",
        error: `OANDA practice endpoint error (${res.status}): ${JSON.stringify(data).slice(0, 300)}`
      };
    }

    // Log completed paper trade so the paper→live gate can count it.
    await db.activityEntry.create({
      data: {
        businessId,
        type: "forex_order",
        title: `[PAPER] ${side === "buy" ? "LONG" : "SHORT"} ${instrument} · ${units} units`,
        detail: thesis,
        status: "completed",
        metadata: {
          ...intent,
          oandaResponse: data
        }
      }
    });

    return {
      success: true,
      output: JSON.stringify(
        {
          mode: "paper",
          environment: "practice",
          orderCreateTransaction: data.orderCreateTransaction ?? null,
          orderFillTransaction: data.orderFillTransaction ?? null,
          message: "Paper order filled on OANDA practice endpoint."
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `oanda_place_order paper fill failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

const handleOandaGetInstrumentPricing: ToolHandler = async (args, config, secrets) => {
  const accountId = config.account_id;
  const apiKey = secrets.api_key;
  const instruments = Array.isArray(args.instruments)
    ? (args.instruments as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (!accountId || !apiKey) {
    return {
      success: false,
      output: "",
      error:
        "OANDA not fully configured. Add account_id and api_key under Integrations → OANDA v20."
    };
  }
  if (instruments.length === 0) {
    return {
      success: false,
      output: "",
      error: "instruments must be a non-empty array (e.g. ['EUR_USD', 'USD_JPY'])."
    };
  }

  try {
    const q = instruments.map(encodeURIComponent).join("%2C");
    const url = `${oandaHost(config)}/v3/accounts/${encodeURIComponent(accountId)}/pricing?instruments=${q}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) {
      return { success: false, output: "", error: `OANDA error: ${res.status}` };
    }
    const data = await res.json();
    return { success: true, output: JSON.stringify(data.prices ?? [], null, 2) };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `oanda_get_instrument_pricing failed: ${err instanceof Error ? err.message : "unknown error"}`
    };
  }
};

// ── Dealhawk Empire — Sourcing tool handlers ──────────────────────

import {
  BASE_WEIGHTS as DEALHAWK_BASE_WEIGHTS,
  computeMotivationScore as dealhawkComputeMotivation,
  recommendExit as dealhawkRecommendExit,
  type DistressSignalType as DealhawkSignalType,
} from "@/lib/dealhawk/distress-score";
import {
  getProviderForBusiness as getDealhawkProvider,
} from "@/lib/dealhawk/providers";
import {
  ProviderCredentialError as DealhawkProviderCredentialError,
} from "@/lib/dealhawk/providers/types";

const handleDealhawkSearchProperties: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "dealhawk_search_properties requires a business context. This tool is only available inside a Dealhawk business chat.",
    };
  }
  const provider = (args.provider as "demo" | "batchdata") ?? "demo";
  const state = args.state as string | undefined;
  if (!state || !/^[A-Za-z]{2}$/.test(state)) {
    return {
      success: false,
      output: "",
      error: "state must be a 2-letter USPS code (e.g., 'TX', 'AZ').",
    };
  }
  try {
    const adapter = await getDealhawkProvider(businessId, provider);
    if (!adapter.isConfigured() && provider !== "demo") {
      return {
        success: false,
        output: "",
        error: `${provider} provider is not configured. Set the API key under Business integrations or fall back to provider="demo".`,
      };
    }
    const results = await adapter.search({
      state: state.toUpperCase(),
      city: (args.city as string | undefined) ?? null,
      signalTypes: args.signal_types as DealhawkSignalType[] | undefined,
      minMotivation: args.min_motivation as number | undefined,
      maxResults: args.max_results as number | undefined,
    });
    const normalized = results.map((r) => {
      const motivationScore =
        r.motivationScore ??
        dealhawkComputeMotivation({
          signals: r.signals.map((s) => ({ signalType: s.signalType })),
          equityPercent: r.equityPercent ?? undefined,
          tenureYears: r.tenureYears ?? undefined,
        }).score;
      const arvMid = r.arvEstimate ?? null;
      const recommendedExit = dealhawkRecommendExit({
        motivationScore,
        maoWholesale: arvMid !== null ? Math.round(arvMid * 0.7) : null,
        maoBrrrr: null,
        maoFlip: arvMid !== null ? Math.round(arvMid * 0.75) : null,
        arvMid,
        rentEstimate: null,
      });
      return {
        providerRef: r.providerRef,
        address: `${r.propertyAddress}, ${r.propertyCity}, ${r.propertyState} ${r.propertyZip}`,
        ownerName: r.ownerName ?? null,
        ownerEntityType: r.ownerEntityType ?? null,
        equityPercent: r.equityPercent ?? null,
        tenureYears: r.tenureYears ?? null,
        arvEstimate: r.arvEstimate ?? null,
        signals: r.signals.map((s) => s.signalType),
        motivationScore,
        recommendedExit,
      };
    });
    return {
      success: true,
      output: JSON.stringify(
        {
          provider,
          count: normalized.length,
          results: normalized,
        },
        null,
        2
      ),
    };
  } catch (err) {
    if (err instanceof DealhawkProviderCredentialError) {
      return { success: false, output: "", error: err.message };
    }
    return {
      success: false,
      output: "",
      error: `dealhawk_search_properties failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
};

const handleDealhawkCreateDeal: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const organizationId = args._organizationId as string | undefined;
  if (!businessId || !organizationId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_create_deal requires a business + org context.",
    };
  }
  const propertyAddress = args.property_address as string | undefined;
  const propertyCity = args.property_city as string | undefined;
  const propertyStateRaw = args.property_state as string | undefined;
  const propertyZip = args.property_zip as string | undefined;
  if (!propertyAddress || !propertyCity || !propertyStateRaw || !propertyZip) {
    return {
      success: false,
      output: "",
      error:
        "property_address, property_city, property_state, and property_zip are required.",
    };
  }
  const propertyState = propertyStateRaw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(propertyState)) {
    return {
      success: false,
      output: "",
      error: `property_state must be a 2-letter USPS code; got "${propertyStateRaw}".`,
    };
  }

  const equityPercent = args.equity_percent as number | undefined;
  const tenureYears = args.tenure_years as number | undefined;
  const arvEstimate = args.arv_estimate as number | undefined;

  type RawSignal = {
    signal_type?: string;
    signalType?: string;
    source_ref?: string | null;
    sourceRef?: string | null;
    notes?: string | null;
  };
  const rawSignals = (args.signals as RawSignal[] | undefined) ?? [];
  const validSignals = rawSignals
    .map((s) => {
      const type = (s.signal_type ?? s.signalType) as
        | DealhawkSignalType
        | undefined;
      if (!type || !(type in DEALHAWK_BASE_WEIGHTS)) return null;
      return {
        signalType: type,
        sourceRef: (s.source_ref ?? s.sourceRef) ?? null,
        notes: s.notes ?? null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const { score: motivationScore } = dealhawkComputeMotivation({
    signals: validSignals.map((s) => ({ signalType: s.signalType })),
    equityPercent,
    tenureYears,
  });
  const maoWholesale =
    typeof arvEstimate === "number" ? Math.round(arvEstimate * 0.7) : null;
  const recommendedExit = dealhawkRecommendExit({
    motivationScore,
    maoWholesale,
    maoBrrrr: null,
    maoFlip:
      typeof arvEstimate === "number" ? Math.round(arvEstimate * 0.75) : null,
    arvMid: arvEstimate ?? null,
    rentEstimate: null,
  });

  try {
    const deal = await db.$transaction(async (tx) => {
      const created = await tx.deal.create({
        data: {
          organizationId,
          businessId,
          status: "lead",
          propertyAddress,
          propertyCity,
          propertyState,
          propertyZip,
          ownerName: (args.owner_name as string | undefined) ?? null,
          ownerMailingAddress:
            (args.owner_mailing_address as string | undefined) ?? null,
          ownerEntityType:
            (args.owner_entity_type as string | undefined) ?? null,
          arvMid: arvEstimate ?? null,
          maoWholesale,
          motivationScore,
          recommendedExit,
          source: (args.source as string | undefined) ?? "manual_import",
          notes:
            (args.notes as string | undefined) ??
            `Created by agent on ${new Date().toISOString().slice(0, 10)}.`,
          config: {
            createdByAgent: true,
            agentId:
              typeof args._agentId === "string" ? args._agentId : null,
            createdAt: new Date().toISOString(),
          },
        },
      });
      for (const signal of validSignals) {
        await tx.dealSignal.create({
          data: {
            organizationId,
            dealId: created.id,
            signalType: signal.signalType,
            sourceType: "manual",
            sourceRef: signal.sourceRef,
            weight: DEALHAWK_BASE_WEIGHTS[signal.signalType],
            confidence: "medium",
            notes: signal.notes,
          },
        });
      }
      return created;
    });
    return {
      success: true,
      output: JSON.stringify(
        {
          dealId: deal.id,
          motivationScore,
          recommendedExit,
          signalsAttached: validSignals.length,
          message: `Deal created at ${propertyAddress}, ${propertyCity}, ${propertyState} ${propertyZip} — score ${motivationScore}/100, exit "${recommendedExit}".`,
        },
        null,
        2
      ),
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `dealhawk_create_deal failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
};

const handleDealhawkScoreLead: ToolHandler = async (args) => {
  const rawSignals = (args.signals as string[] | undefined) ?? [];
  const validSignals = rawSignals
    .filter((s): s is DealhawkSignalType => s in DEALHAWK_BASE_WEIGHTS)
    .map((signalType) => ({ signalType }));
  if (validSignals.length === 0 && (args.signals as string[] | undefined)?.length) {
    return {
      success: false,
      output: "",
      error: `No recognized signal types in input. Recognized: ${Object.keys(DEALHAWK_BASE_WEIGHTS).join(", ")}.`,
    };
  }
  const result = dealhawkComputeMotivation({
    signals: validSignals,
    equityPercent: args.equity_percent as number | undefined,
    tenureYears: args.tenure_years as number | undefined,
  });
  return {
    success: true,
    output: JSON.stringify(result, null, 2),
  };
};

import {
  computeFourMAOs as dealhawkComputeFourMAOs,
  qualifySubTo as dealhawkQualifySubTo,
  type MarketTemper as DealhawkMarketTemper,
  type AssumptionClauseStatus as DealhawkAssumptionClauseStatus,
} from "@/lib/dealhawk/underwriting";

const handleDealhawkComputeMao: ToolHandler = async (args) => {
  const arv = args.arv as number | undefined;
  const rehab = args.rehab as number | undefined;
  if (typeof arv !== "number" || arv <= 0) {
    return {
      success: false,
      output: "",
      error: "arv must be a positive number.",
    };
  }
  if (typeof rehab !== "number" || rehab < 0) {
    return {
      success: false,
      output: "",
      error: "rehab must be a non-negative number.",
    };
  }
  const rent = args.rent as number | undefined;
  const market = args.market as DealhawkMarketTemper | undefined;
  const result = dealhawkComputeFourMAOs({
    arv,
    rehab,
    rent,
    market,
  });
  return {
    success: true,
    output: JSON.stringify(result, null, 2),
  };
};

const handleDealhawkQualifySubTo: ToolHandler = async (args) => {
  const required = ["arv", "rent", "loan_balance", "loan_rate", "piti"];
  for (const key of required) {
    if (typeof args[key] !== "number") {
      return {
        success: false,
        output: "",
        error: `${key} is required and must be a number.`,
      };
    }
  }
  const result = dealhawkQualifySubTo({
    arv: args.arv as number,
    rent: args.rent as number,
    loanBalance: args.loan_balance as number,
    loanRate: args.loan_rate as number,
    piti: args.piti as number,
    hasHeloc: args.has_heloc as boolean | undefined,
    recentRefi: args.recent_refi as boolean | undefined,
    assumptionClause: args.assumption_clause as
      | DealhawkAssumptionClauseStatus
      | undefined,
    inForbearance: args.in_forbearance as boolean | undefined,
    isVaLoan: args.is_va_loan as boolean | undefined,
  });
  return {
    success: true,
    output: JSON.stringify(result, null, 2),
  };
};

const handleDealhawkUpdateDeal: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const dealId = args.deal_id as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_update_deal requires a business context.",
    };
  }
  if (!dealId) {
    return {
      success: false,
      output: "",
      error: "deal_id is required.",
    };
  }
  // Look up the deal first to confirm it belongs to this business.
  const existing = await db.deal.findFirst({
    where: { id: dealId, businessId },
    select: { id: true, notes: true },
  });
  if (!existing) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} not found for this business.`,
    };
  }
  const updates: Parameters<typeof db.deal.update>[0]["data"] = {};
  const numericFields = [
    "arv_low",
    "arv_mid",
    "arv_high",
    "rent_estimate",
    "rehab_light",
    "rehab_medium",
    "rehab_heavy",
    "mao_wholesale",
    "mao_brrrr",
    "mao_flip",
    "sub_to_score",
  ] as const;
  const fieldMap: Record<(typeof numericFields)[number], string> = {
    arv_low: "arvLow",
    arv_mid: "arvMid",
    arv_high: "arvHigh",
    rent_estimate: "rentEstimate",
    rehab_light: "rehabLight",
    rehab_medium: "rehabMedium",
    rehab_heavy: "rehabHeavy",
    mao_wholesale: "maoWholesale",
    mao_brrrr: "maoBrrrr",
    mao_flip: "maoFlip",
    sub_to_score: "subToScore",
  };
  for (const key of numericFields) {
    if (typeof args[key] === "number") {
      (updates as Record<string, unknown>)[fieldMap[key]] = args[key];
    }
  }
  if (typeof args.sub_to_viability === "string") {
    (updates as Record<string, unknown>).subToViability = args.sub_to_viability;
  }
  if (typeof args.recommended_exit === "string") {
    (updates as Record<string, unknown>).recommendedExit = args.recommended_exit;
  }
  const notesAppend = args.notes_append as string | undefined;
  if (typeof notesAppend === "string" && notesAppend.trim().length > 0) {
    const stamp = new Date().toISOString().slice(0, 10);
    const nextNotes = existing.notes
      ? `${existing.notes}\n\n[${stamp}] ${notesAppend.trim()}`
      : `[${stamp}] ${notesAppend.trim()}`;
    (updates as Record<string, unknown>).notes = nextNotes;
  }
  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      output: "",
      error: "No valid fields to update. Provide at least one underwriting field or a notes_append.",
    };
  }
  const deal = await db.deal.update({
    where: { id: dealId },
    data: updates,
    select: {
      id: true,
      arvMid: true,
      rentEstimate: true,
      maoWholesale: true,
      maoBrrrr: true,
      maoFlip: true,
      subToScore: true,
      subToViability: true,
      recommendedExit: true,
    },
  });
  return {
    success: true,
    output: JSON.stringify(
      {
        updated: Object.keys(updates),
        deal,
        message: `Deal ${dealId} updated: ${Object.keys(updates).join(", ")}.`,
      },
      null,
      2
    ),
  };
};

// ── Dealhawk Empire — Compliance handler (Phase 7) ───────────────

import { runComplianceChecklist as dealhawkRunCompliance } from "@/lib/dealhawk/compliance";

const handleDealhawkComplianceCheck: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_compliance_check requires a business context.",
    };
  }
  const report = await dealhawkRunCompliance(businessId);
  return {
    success: true,
    output: JSON.stringify(report, null, 2),
  };
};

// ── Dealhawk Empire — Disposition + Creative Finance handlers (Phase 5) ──

import {
  archiveBuyer as dealhawkArchiveBuyer,
  createBuyer as dealhawkCreateBuyer,
  listActiveBuyers as dealhawkListActiveBuyers,
  matchBuyersForDeal as dealhawkMatchBuyersForDeal,
  type BuyBox as DealhawkBuyBox,
  type ContactMethod as DealhawkContactMethod,
  type FinancingType as DealhawkFinancingType,
  type RehabLevel as DealhawkRehabLevel,
} from "@/lib/dealhawk/buyer-list";
import { buildDealPackage as dealhawkBuildDealPackage } from "@/lib/dealhawk/disposition";
import {
  recommendCreativeStructure as dealhawkRecommendCreative,
  type CreativeFinanceInput as DealhawkCreativeInput,
} from "@/lib/dealhawk/creative-finance";

const handleDealhawkAddBuyer: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const organizationId = args._organizationId as string | undefined;
  if (!businessId || !organizationId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_add_buyer requires a business + org context.",
    };
  }
  const name = args.name as string | undefined;
  if (!name || name.trim().length === 0) {
    return { success: false, output: "", error: "name is required." };
  }
  try {
    const buyer = await dealhawkCreateBuyer({
      businessId,
      organizationId,
      data: {
        name,
        llc: (args.llc as string | undefined) ?? null,
        contactMethod: args.contact_method as DealhawkContactMethod | undefined,
        email: (args.email as string | undefined) ?? null,
        phone: (args.phone as string | undefined) ?? null,
        buyBox: args.buy_box as DealhawkBuyBox | undefined,
        zipPreferences: args.zip_preferences as string[] | undefined,
        minPurchasePrice: (args.min_purchase_price as number | undefined) ?? null,
        maxPurchasePrice: (args.max_purchase_price as number | undefined) ?? null,
        preferredRehabLevel: args.preferred_rehab_level as
          | DealhawkRehabLevel
          | undefined,
        financingType: args.financing_type as DealhawkFinancingType | undefined,
        notes: (args.notes as string | undefined) ?? null,
      },
    });
    return {
      success: true,
      output: JSON.stringify(
        {
          buyer,
          message: `Buyer added: ${buyer.name}${buyer.llc ? ` (${buyer.llc})` : ""} — buy box "${buyer.buyBox}", financing "${buyer.financingType}".`,
        },
        null,
        2
      ),
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `dealhawk_add_buyer failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
};

const handleDealhawkListBuyers: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_list_buyers requires a business context.",
    };
  }
  const all = await dealhawkListActiveBuyers(businessId);
  const zip = (args.zip as string | undefined)?.trim();
  const buyBox = args.buy_box as string | undefined;
  let filtered = all;
  if (zip) {
    filtered = filtered.filter((b) => {
      const zips = Array.isArray(b.zipPreferences)
        ? (b.zipPreferences as string[])
        : [];
      return zips.length === 0 || zips.includes(zip);
    });
  }
  if (buyBox) {
    filtered = filtered.filter((b) => b.buyBox === buyBox);
  }
  return {
    success: true,
    output: JSON.stringify(
      {
        count: filtered.length,
        totalActive: all.length,
        buyers: filtered.map((b) => ({
          id: b.id,
          name: b.name,
          llc: b.llc,
          buyBox: b.buyBox,
          financingType: b.financingType,
          email: b.email,
          phone: b.phone,
          zipPreferences: b.zipPreferences,
          dealsLast12Mo: b.dealsLast12Mo,
          lastDealDate: b.lastDealDate,
        })),
      },
      null,
      2
    ),
  };
};

const handleDealhawkMatchBuyers: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const dealId = args.deal_id as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_match_buyers requires a business context.",
    };
  }
  if (!dealId) {
    return { success: false, output: "", error: "deal_id is required." };
  }
  const deal = await db.deal.findFirst({
    where: { id: dealId, businessId },
    select: {
      propertyZip: true,
      arvMid: true,
      purchasePrice: true,
      rehabHeavy: true,
      recommendedExit: true,
    },
  });
  if (!deal) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} not found for this business.`,
    };
  }
  const { buyers, reasons } = await dealhawkMatchBuyersForDeal(businessId, deal);
  return {
    success: true,
    output: JSON.stringify(
      {
        dealId,
        matched: buyers.length,
        reasons,
        buyers: buyers.map((b) => ({
          id: b.id,
          name: b.name,
          llc: b.llc,
          buyBox: b.buyBox,
          financingType: b.financingType,
          email: b.email,
          phone: b.phone,
          dealsLast12Mo: b.dealsLast12Mo,
        })),
      },
      null,
      2
    ),
  };
};

const handleDealhawkBuildDealPackage: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const dealId = args.deal_id as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_build_deal_package requires a business context.",
    };
  }
  if (!dealId) {
    return { success: false, output: "", error: "deal_id is required." };
  }
  const operatorName = args.operator_name as string | undefined;
  const operatorContact = args.operator_contact as string | undefined;
  if (!operatorName || !operatorContact) {
    return {
      success: false,
      output: "",
      error: "operator_name and operator_contact are required.",
    };
  }
  const deal = await db.deal.findFirst({
    where: { id: dealId, businessId },
  });
  if (!deal) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} not found for this business.`,
    };
  }
  if (!deal.purchasePrice || !deal.assignmentFee) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} is missing purchasePrice and/or assignmentFee. The contract must be locked before generating a disposition package — use dealhawk_update_deal to set these first, or move the deal to under_contract via the pipeline UI.`,
    };
  }

  const result = dealhawkBuildDealPackage({
    propertyAddress: deal.propertyAddress,
    propertyCity: deal.propertyCity,
    propertyState: deal.propertyState,
    propertyZip: deal.propertyZip,
    bedrooms: deal.bedrooms,
    bathrooms: deal.bathrooms,
    livingSqft: deal.livingSqft,
    yearBuilt: deal.yearBuilt,
    arvLow: deal.arvLow,
    arvMid: deal.arvMid,
    arvHigh: deal.arvHigh,
    rehabLight: deal.rehabLight,
    rehabMedium: deal.rehabMedium,
    rehabHeavy: deal.rehabHeavy,
    rentEstimate: deal.rentEstimate,
    maoWholesale: deal.maoWholesale,
    maoBrrrr: deal.maoBrrrr,
    maoFlip: deal.maoFlip,
    purchasePrice: deal.purchasePrice,
    assignmentFee: deal.assignmentFee,
    closingDate: (args.closing_date as string | undefined) ?? null,
    earnestMoneyDeposit: (args.earnest_money_deposit as number | undefined) ?? null,
    operatorName,
    operatorContact,
    photoUrls: args.photo_urls as string[] | undefined,
  });
  return {
    success: true,
    output: JSON.stringify(
      {
        dealId,
        ...result,
        nextStep:
          "Review the markdown for accuracy. Use dealhawk_match_buyers to get the A-list of buyers for this deal, then send the package via send_email to each. Per-message customization (subject line, opener) is the agent's responsibility.",
      },
      null,
      2
    ),
  };
};

const handleDealhawkDesignCreative: ToolHandler = async (args) => {
  const required = ["arv", "rent_estimate", "property_state"];
  for (const key of required) {
    if (
      args[key] === undefined ||
      (key === "property_state" && typeof args[key] !== "string")
    ) {
      return {
        success: false,
        output: "",
        error: `${key} is required.`,
      };
    }
  }
  const input: DealhawkCreativeInput = {
    arv: args.arv as number,
    rentEstimate: args.rent_estimate as number,
    propertyState: (args.property_state as string).toUpperCase(),
    loanBalance: (args.loan_balance as number | undefined) ?? null,
    loanRate: (args.loan_rate as number | undefined) ?? null,
    piti: (args.piti as number | undefined) ?? null,
    hasHeloc: args.has_heloc as boolean | undefined,
    recentRefi: args.recent_refi as boolean | undefined,
    isVaLoan: args.is_va_loan as boolean | undefined,
    inForbearance: args.in_forbearance as boolean | undefined,
    sellerCashTarget:
      (args.seller_cash_target as number | undefined) ?? null,
    sellerProfile: args.seller_profile as
      | DealhawkCreativeInput["sellerProfile"]
      | undefined,
    wholesaleMao: (args.wholesale_mao as number | undefined) ?? null,
  };
  const result = dealhawkRecommendCreative(input);
  return {
    success: true,
    output: JSON.stringify(result, null, 2),
  };
};

// ── Dealhawk Empire — Outreach tool handlers (Phase 4) ───────────

import {
  decideOutreachAction as dealhawkDecideOutreach,
  getBusinessDealMode as dealhawkGetMode,
} from "@/lib/dealhawk/mode-gate";
import {
  findObjectionMatch as dealhawkFindObjection,
  KNOWN_OBJECTIONS as DEALHAWK_KNOWN_OBJECTIONS,
  renderOutreach as dealhawkRenderOutreach,
  type OutreachChannel as DealhawkOutreachChannel,
} from "@/lib/dealhawk/outreach";

const handleDealhawkDraftOutreach: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const dealId = args.deal_id as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_draft_outreach requires a business context.",
    };
  }
  if (!dealId) {
    return { success: false, output: "", error: "deal_id is required." };
  }

  // Mode gate — research mode never produces outreach drafts.
  const mode = await dealhawkGetMode(businessId);
  const decision = dealhawkDecideOutreach(mode);
  if (decision.action === "reject") {
    return { success: false, output: "", error: decision.reason };
  }

  // E1-3 (2026-05 audit) — TCPA attestation enforcement at agent-call
  // layer. The UI surface already requires the operator to attest before
  // outreach mode unlocks, but the agent-callable tool ALSO needs to
  // refuse when attestation is missing — otherwise an agent could reach
  // the tool via a path that bypasses the UI gate (direct API call,
  // restored backup, race between UI flip and agent run) and produce
  // drafts before DNC scrubbing was confirmed.
  const businessForTcpa = await db.business.findUnique({
    where: { id: businessId },
    select: { tcpaAttestedAt: true, tcpaAttestedBy: true },
  });
  if (!businessForTcpa?.tcpaAttestedAt) {
    return {
      success: false,
      output: "",
      error:
        "TCPA attestation not on file for this business. Outreach drafts are blocked until the operator confirms DNC scrubbing, opt-out plumbing, and state wholesaler-disclosure compliance via the Dealhawk Desk panel.",
    };
  }

  const deal = await db.deal.findFirst({
    where: { id: dealId, businessId },
    include: { signals: { select: { signalType: true } } },
  });
  if (!deal) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} not found for this business.`,
    };
  }
  if (deal.motivationScore < 40) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} scored ${deal.motivationScore}/100 — below the 40/100 outreach threshold. Per Dealhawk failure rule #1 (pursuing leads with no motivation), this tool refuses to draft outreach for unscored or low-motivation leads. Either re-score the deal or have the Deal Ops Lead log an explicit override reason and pass it via the operator chat.`,
    };
  }

  // E1-3 Phase 2 (2026-05 audit) — State Compliance Matrix enforcement at
  // tool-call time. The matrix lives as a workspace doc the operator fills
  // in per state of operation; if the deal's state isn't represented in the
  // matrix the tool refuses to draft outreach for that state. Catches the
  // failure mode where an operator scales into a new state without filling
  // in state-specific wholesaler disclosure / contract-assignability rules.
  const dealState = (deal.propertyState ?? "").trim().toUpperCase();
  if (dealState) {
    const matrix = await db.workspaceDocument.findFirst({
      where: { businessId, filePath: "STATE_COMPLIANCE_MATRIX.md" },
      select: { content: true },
    });
    if (matrix?.content) {
      const content = matrix.content;
      // Operator marks states as filled-in by including either the
      // 2-letter code (preceded by ## or | or whitespace) or the full
      // state name in a row. Unfilled rows still have placeholder text
      // like "fill in" / "TODO" / "[state-specific]" — we treat those
      // as unfilled.
      const stateRegex = new RegExp(
        `(^|[\\s|#])${dealState}([\\s|]|$)`,
        "im"
      );
      const stateInMatrix = stateRegex.test(content);
      const placeholderCount = (
        content.match(/\b(fill in|todo|placeholder|\[state)/gi) || []
      ).length;
      if (!stateInMatrix) {
        return {
          success: false,
          output: "",
          error: `State Compliance Matrix has no entry for ${dealState}. Outreach drafts in states the matrix doesn't cover are blocked — wholesaler disclosure rules, contract-assignability, double-close legality, and licensure requirements vary by state. Open STATE_COMPLIANCE_MATRIX.md in the workspace, fill in the ${dealState} row (attorney-reviewed), and retry. (${placeholderCount} placeholder marker${
            placeholderCount === 1 ? "" : "s"
          } detected in the matrix; assume those rows are unverified.)`,
        };
      }
    } else {
      return {
        success: false,
        output: "",
        error:
          "STATE_COMPLIANCE_MATRIX.md is missing from this business's workspace. Materialize the dealhawk_empire template or restore the matrix before drafting outreach — state-specific wholesaler disclosure / contract-assignability rules are load-bearing for compliance.",
      };
    }
  }

  const operatorName = args.operator_name as string;
  if (!operatorName || operatorName.trim().length === 0) {
    return {
      success: false,
      output: "",
      error: "operator_name is required.",
    };
  }

  const channel = args.channel as DealhawkOutreachChannel;
  const ownerName = deal.ownerName ?? null;
  const ownerFirstName = ownerName
    ? ownerName.split(/\s+/)[0]
    : null;

  const result = dealhawkRenderOutreach({
    channel,
    signals: deal.signals.map((s) => s.signalType) as Parameters<
      typeof dealhawkRenderOutreach
    >[0]["signals"],
    vars: {
      ownerName,
      ownerFirstName,
      propertyAddress: deal.propertyAddress,
      propertyCity: deal.propertyCity,
      propertyState: deal.propertyState,
      operatorName,
      operatorPhone: (args.operator_phone as string | undefined) ?? null,
      operatorEmail: (args.operator_email as string | undefined) ?? null,
    },
    templateLabel: args.template_label as string | undefined,
  });

  if ("error" in result) {
    return { success: false, output: "", error: result.error };
  }

  // Phase 7 — output sanitizer. Last-line defense against prohibited
  // claims slipping into seller-facing outreach. The agent system
  // prompts already forbid these phrases, but TCPA / FTC / state AGs
  // care about WHAT WAS SENT, not what the prompt said not to.
  const { sanitizeAgentOutput } = await import("@/lib/dealhawk/compliance");
  const sanitized = sanitizeAgentOutput(result.body);
  if (sanitized.requiresRegeneration) {
    return {
      success: false,
      output: "",
      error: `Draft contains prohibited phrases that have no safe substitution: ${sanitized.hits
        .filter((h) => h.replacement === null)
        .map((h) => `"${h.phrase}" (${h.rationale})`)
        .join("; ")}. Regenerate with different wording.`,
    };
  }
  const finalBody = sanitized.cleaned;
  const sanitizationNotes =
    sanitized.hits.length > 0
      ? sanitized.hits.map(
          (h) =>
            `Auto-replaced "${h.phrase}" — ${h.rationale}`
        )
      : [];

  return {
    success: true,
    output: JSON.stringify(
      {
        dealId,
        ownerName,
        propertyAddress: `${deal.propertyAddress}, ${deal.propertyCity}, ${deal.propertyState} ${deal.propertyZip}`,
        motivationScore: deal.motivationScore,
        recommendedExit: deal.recommendedExit,
        template: result.template,
        body: finalBody,
        complianceNotes: [...result.complianceNotes, ...sanitizationNotes],
        nextStep:
          "Review the draft, send via your configured SMS / email / mail provider (use send_sms or send_email), then call dealhawk_log_touch to record the activity in the pipeline.",
      },
      null,
      2
    ),
  };
};

const handleDealhawkLogTouch: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const dealId = args.deal_id as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_log_touch requires a business context.",
    };
  }
  if (!dealId) {
    return { success: false, output: "", error: "deal_id is required." };
  }
  const channel = args.channel as string;
  if (!channel) {
    return { success: false, output: "", error: "channel is required." };
  }

  const existing = await db.deal.findFirst({
    where: { id: dealId, businessId },
    select: {
      id: true,
      status: true,
      contactAttempts: true,
      firstContactAt: true,
      notes: true,
    },
  });
  if (!existing) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} not found for this business.`,
    };
  }

  const now = new Date();
  const updates: Parameters<typeof db.deal.update>[0]["data"] = {
    lastContactAt: now,
    contactAttempts: (existing.contactAttempts ?? 0) + 1,
  };
  if (!existing.firstContactAt) {
    updates.firstContactAt = now;
  }
  // Auto-promote lead → contacted on first touch (only if not dead /
  // closed / further along).
  if (existing.status === "lead") {
    updates.status = "contacted";
  }
  const sellerResponseState = args.seller_response_state as
    | string
    | undefined;
  if (sellerResponseState) {
    updates.sellerResponseState = sellerResponseState;
    if (sellerResponseState === "not_interested") {
      // Hard opt-out path: mark dead immediately so the Follow-Up
      // Sequencer stops touching this lead.
      updates.status = "dead";
      updates.nextTouchAt = null;
    }
  }
  const outcomeSummary = args.outcome_summary as string | undefined;
  if (outcomeSummary && outcomeSummary.trim().length > 0) {
    const stamp = now.toISOString().slice(0, 10);
    const noteLine = `[${stamp}] ${channel} touch: ${outcomeSummary.trim()}`;
    updates.notes = existing.notes
      ? `${existing.notes}\n\n${noteLine}`
      : noteLine;
  }

  const deal = await db.deal.update({
    where: { id: dealId },
    data: updates,
    select: {
      id: true,
      status: true,
      contactAttempts: true,
      lastContactAt: true,
      sellerResponseState: true,
    },
  });

  return {
    success: true,
    output: JSON.stringify(
      {
        deal,
        autoPromoted:
          existing.status === "lead" &&
          deal.status === "contacted",
        autoMarkedDead:
          sellerResponseState === "not_interested" && deal.status === "dead",
        message: `Touch logged on ${dealId} (${channel}). Contacts: ${deal.contactAttempts}.`,
      },
      null,
      2
    ),
  };
};

const handleDealhawkCoachObjection: ToolHandler = async (args) => {
  const sellerQuote = args.seller_quote as string | undefined;
  const exitStrategy = args.exit_strategy as string | undefined;
  if (!sellerQuote) {
    return { success: false, output: "", error: "seller_quote is required." };
  }
  if (!exitStrategy) {
    return { success: false, output: "", error: "exit_strategy is required." };
  }

  const match = dealhawkFindObjection(sellerQuote);

  // Always check for "ready" flags regardless of pre-canned match.
  const lower = sellerQuote.toLowerCase();
  const notReadyFlags: string[] = [];
  if (
    /confused|don'?t (understand|get it)|panic|scared|crying|overwhelmed/.test(
      lower
    )
  ) {
    notReadyFlags.push(
      "Seller language suggests confusion, panic, or distress. Recommend pausing the call and rescheduling with a family member or trusted advisor present."
    );
  }
  if (
    /my (son|daughter|grandson|granddaughter|kids?) said|let me ask my (son|daughter|kids?)/.test(
      lower
    )
  ) {
    notReadyFlags.push(
      "Seller is referencing family input. Recommend looping the family member into the next conversation directly — don't push for a same-call commitment."
    );
  }
  if (
    /can'?t (read|see|hear) (it|that)|too (small|fast)/.test(lower) ||
    /(my )?(eyes|hearing)/.test(lower)
  ) {
    notReadyFlags.push(
      "Possible accessibility issue. Slow down, offer to send written summary, or arrange a follow-up at the seller's preferred pace."
    );
  }

  if (match) {
    return {
      success: true,
      output: JSON.stringify(
        {
          source: "known_objection_library",
          underlyingConcern: match.underlyingConcern,
          primaryLine: match.primaryLine,
          backupLine: match.backupLine,
          toneNotes: match.toneNotes,
          flagIfSellerNotReady: notReadyFlags.length > 0 ? notReadyFlags : null,
          guardrails: [
            "NEVER promise the bank won't trigger DOS.",
            "NEVER promise credit outcomes.",
            "NEVER commit to a closing date before title search.",
            "Use conditional language ('in my experience', 'when payments stay current').",
          ],
        },
        null,
        2
      ),
    };
  }

  // No pre-canned match — return library examples + structure for the
  // agent to compose a fresh response.
  return {
    success: true,
    output: JSON.stringify(
      {
        source: "no_pre_canned_match",
        instruction:
          "No pre-canned objection match. Compose a 3-part response from these guardrails. Match the agent's Objection Handler system prompt: empathetic-first, never pushy, never promise legal / tax / bank outcomes.",
        relatedExamples: DEALHAWK_KNOWN_OBJECTIONS.slice(0, 2).map((o) => ({
          underlyingConcern: o.underlyingConcern,
          primaryLine: o.primaryLine,
        })),
        flagIfSellerNotReady: notReadyFlags.length > 0 ? notReadyFlags : null,
        guardrails: [
          "NEVER promise the bank won't trigger DOS.",
          "NEVER promise credit outcomes.",
          "NEVER commit to a closing date before title search.",
          "Use conditional language ('in my experience', 'when payments stay current').",
          `Tailor the response to the active exit strategy: ${exitStrategy}.`,
        ],
      },
      null,
      2
    ),
  };
};

const handleDealhawkScheduleFollowup: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  const dealId = args.deal_id as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_schedule_followup requires a business context.",
    };
  }
  if (!dealId) {
    return { success: false, output: "", error: "deal_id is required." };
  }
  const clear = args.clear === true;
  const days = args.days_from_now as number | undefined;
  if (!clear && (typeof days !== "number" || days < 0 || days > 365)) {
    return {
      success: false,
      output: "",
      error: "Provide either days_from_now (0-365) or clear=true.",
    };
  }

  const existing = await db.deal.findFirst({
    where: { id: dealId, businessId },
    select: { id: true, notes: true },
  });
  if (!existing) {
    return {
      success: false,
      output: "",
      error: `Deal ${dealId} not found for this business.`,
    };
  }

  const updates: Parameters<typeof db.deal.update>[0]["data"] = {};
  if (clear) {
    updates.nextTouchAt = null;
  } else {
    const target = new Date();
    target.setDate(target.getDate() + (days as number));
    updates.nextTouchAt = target;
  }
  const reason = args.reason as string | undefined;
  if (reason && reason.trim().length > 0) {
    const stamp = new Date().toISOString().slice(0, 10);
    const noteLine = clear
      ? `[${stamp}] Follow-up cleared: ${reason.trim()}`
      : `[${stamp}] Follow-up scheduled +${days}d: ${reason.trim()}`;
    updates.notes = existing.notes
      ? `${existing.notes}\n\n${noteLine}`
      : noteLine;
  }

  const deal = await db.deal.update({
    where: { id: dealId },
    data: updates,
    select: { id: true, nextTouchAt: true },
  });

  return {
    success: true,
    output: JSON.stringify(
      {
        deal,
        message: clear
          ? `Cleared next touch on ${dealId}.`
          : `Scheduled next touch on ${dealId} for ${deal.nextTouchAt?.toISOString().slice(0, 10)}.`,
      },
      null,
      2
    ),
  };
};

const handleDealhawkSkipTrace: ToolHandler = async (args) => {
  const businessId = args._businessId as string | undefined;
  if (!businessId) {
    return {
      success: false,
      output: "",
      error: "dealhawk_skip_trace requires a business context.",
    };
  }
  const provider = (args.provider as "demo" | "batchdata") ?? "demo";
  const required = [
    "owner_name",
    "property_address",
    "property_city",
    "property_state",
    "property_zip",
  ];
  for (const key of required) {
    if (!args[key]) {
      return {
        success: false,
        output: "",
        error: `${key} is required for dealhawk_skip_trace.`,
      };
    }
  }
  try {
    const adapter = await getDealhawkProvider(businessId, provider);
    if (!adapter.skipTrace) {
      return {
        success: false,
        output: "",
        error: `Provider "${provider}" does not implement skip-trace.`,
      };
    }
    const result = await adapter.skipTrace({
      ownerName: args.owner_name as string,
      propertyAddress: args.property_address as string,
      propertyCity: args.property_city as string,
      propertyState: (args.property_state as string).toUpperCase(),
      propertyZip: args.property_zip as string,
    });
    return {
      success: true,
      output: JSON.stringify(result, null, 2),
    };
  } catch (err) {
    if (err instanceof DealhawkProviderCredentialError) {
      return { success: false, output: "", error: err.message };
    }
    return {
      success: false,
      output: "",
      error: `dealhawk_skip_trace failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
};

// ── Instantly (cold email) ────────────────────────────────────────

const INSTANTLY_API_BASE = "https://api.instantly.ai/api/v2";

async function instantlyFetch(
  path: string,
  apiKey: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  return fetch(`${INSTANTLY_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: init?.body ? JSON.stringify(init.body) : undefined
  });
}

const handleInstantlyCreateCampaign: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return { success: false, output: "", error: "Instantly API key missing. Add it in MCP Servers → Instantly." };
  }
  const fromEmails = String(args.from_emails || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const res = await instantlyFetch("/campaigns", apiKey, {
      method: "POST",
      body: {
        name: String(args.name || "").trim(),
        campaign_schedule: {
          schedules: [
            {
              name: "Default",
              timing: { from: "09:00", to: "17:00" },
              days: { "0": false, "1": true, "2": true, "3": true, "4": true, "5": true, "6": false },
              timezone: "America/New_York"
            }
          ]
        },
        sequences: [
          {
            steps: [
              {
                type: "email",
                delay: 0,
                variants: [
                  {
                    subject: String(args.sequence_subject || ""),
                    body: String(args.sequence_body || "")
                  }
                ]
              }
            ]
          }
        ],
        email_list: fromEmails,
        daily_limit: Number(args.daily_limit) || 50
      }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `instantly_create_campaign failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleInstantlyLaunchCampaign: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Instantly API key missing." };
  const campaignId = String(args.campaign_id || "");
  if (!campaignId) return { success: false, output: "", error: "campaign_id required" };
  try {
    const res = await instantlyFetch(`/campaigns/${campaignId}/activate`, apiKey, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: `Campaign ${campaignId} activated.` };
  } catch (err) {
    return { success: false, output: "", error: `instantly_launch_campaign failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleInstantlyPauseCampaign: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Instantly API key missing." };
  const campaignId = String(args.campaign_id || "");
  if (!campaignId) return { success: false, output: "", error: "campaign_id required" };
  try {
    const res = await instantlyFetch(`/campaigns/${campaignId}/pause`, apiKey, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: `Campaign ${campaignId} paused.` };
  } catch (err) {
    return { success: false, output: "", error: `instantly_pause_campaign failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleInstantlyAddLeads: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Instantly API key missing." };
  const campaignId = String(args.campaign_id || "");
  if (!campaignId) return { success: false, output: "", error: "campaign_id required" };
  let leads: unknown;
  try {
    leads = JSON.parse(String(args.leads_json || "[]"));
  } catch {
    return { success: false, output: "", error: "leads_json is not valid JSON" };
  }
  if (!Array.isArray(leads)) {
    return { success: false, output: "", error: "leads_json must be a JSON array" };
  }
  try {
    const res = await instantlyFetch(`/leads`, apiKey, {
      method: "POST",
      body: { campaign: campaignId, leads }
    });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: `Added ${leads.length} leads to campaign ${campaignId}. ${JSON.stringify(data).slice(0, 300)}` };
  } catch (err) {
    return { success: false, output: "", error: `instantly_add_leads_to_campaign failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleInstantlyListCampaigns: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Instantly API key missing." };
  const limit = Number(args.limit) || 50;
  try {
    const res = await instantlyFetch(`/campaigns?limit=${limit}`, apiKey);
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `instantly_list_campaigns failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleInstantlyCampaignAnalytics: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Instantly API key missing." };
  const campaignId = String(args.campaign_id || "");
  if (!campaignId) return { success: false, output: "", error: "campaign_id required" };
  try {
    const res = await instantlyFetch(`/campaigns/analytics?id=${encodeURIComponent(campaignId)}`, apiKey);
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `instantly_get_campaign_analytics failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleInstantlyListReplies: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Instantly API key missing." };
  const params = new URLSearchParams();
  params.set("limit", String(Number(args.limit) || 50));
  params.set("email_type", "received");
  if (args.campaign_id) params.set("campaign_id", String(args.campaign_id));
  if (args.unread_only === true) params.set("is_unread", "true");
  try {
    const res = await instantlyFetch(`/emails?${params.toString()}`, apiKey);
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `instantly_list_replies failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleInstantlySendReply: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Instantly API key missing." };
  const threadId = String(args.thread_id || "");
  const body = String(args.body || "");
  if (!threadId || !body) {
    return { success: false, output: "", error: "thread_id and body required" };
  }
  try {
    const res = await instantlyFetch(`/emails/reply`, apiKey, {
      method: "POST",
      body: { reply_to_uuid: threadId, body }
    });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `Instantly API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: `Reply sent. ${JSON.stringify(data).slice(0, 300)}` };
  } catch (err) {
    return { success: false, output: "", error: `instantly_send_reply failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

// ── WhatsApp Cloud (Meta Graph API) ───────────────────────────────

const WHATSAPP_API_VERSION = "v21.0";

async function whatsappFetch(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  return fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: init?.body ? JSON.stringify(init.body) : undefined
  });
}

function whatsappCreds(config: Record<string, string>, secrets: Record<string, string>) {
  return {
    token: secrets.system_user_access_token,
    wabaId: config.waba_id,
    phoneNumberId: config.phone_number_id
  };
}

const handleWhatsappSendText: ToolHandler = async (args, config, secrets) => {
  const { token, phoneNumberId } = whatsappCreds(config, secrets);
  if (!token || !phoneNumberId) {
    return { success: false, output: "", error: "WhatsApp credentials incomplete (need system_user_access_token + phone_number_id)." };
  }
  try {
    const res = await whatsappFetch(`/${phoneNumberId}/messages`, token, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        to: String(args.phone_number || ""),
        type: "text",
        text: { body: String(args.body || "") }
      }
    });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `WhatsApp API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: JSON.stringify(data) };
  } catch (err) {
    return { success: false, output: "", error: `whatsapp_send_text_message failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleWhatsappSendTemplate: ToolHandler = async (args, config, secrets) => {
  const { token, phoneNumberId } = whatsappCreds(config, secrets);
  if (!token || !phoneNumberId) {
    return { success: false, output: "", error: "WhatsApp credentials incomplete." };
  }
  let variables: string[] = [];
  if (args.variables_json) {
    try {
      const parsed = JSON.parse(String(args.variables_json));
      if (Array.isArray(parsed)) variables = parsed.map(String);
    } catch {
      return { success: false, output: "", error: "variables_json must be a JSON array of strings" };
    }
  }
  const components = variables.length
    ? [
        {
          type: "body",
          parameters: variables.map((v) => ({ type: "text", text: v }))
        }
      ]
    : undefined;
  try {
    const res = await whatsappFetch(`/${phoneNumberId}/messages`, token, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        to: String(args.phone_number || ""),
        type: "template",
        template: {
          name: String(args.template_name || ""),
          language: { code: String(args.language_code || "en_US") },
          ...(components ? { components } : {})
        }
      }
    });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `WhatsApp API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: JSON.stringify(data) };
  } catch (err) {
    return { success: false, output: "", error: `whatsapp_send_template_message failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleWhatsappSendMedia: ToolHandler = async (args, config, secrets) => {
  const { token, phoneNumberId } = whatsappCreds(config, secrets);
  if (!token || !phoneNumberId) {
    return { success: false, output: "", error: "WhatsApp credentials incomplete." };
  }
  const mediaType = String(args.media_type || "image");
  if (!["image", "video", "document"].includes(mediaType)) {
    return { success: false, output: "", error: "media_type must be image|video|document" };
  }
  const mediaPayload: Record<string, unknown> = { link: String(args.media_url || "") };
  if (args.caption && mediaType !== "document") mediaPayload.caption = String(args.caption);
  try {
    const res = await whatsappFetch(`/${phoneNumberId}/messages`, token, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        to: String(args.phone_number || ""),
        type: mediaType,
        [mediaType]: mediaPayload
      }
    });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `WhatsApp API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: JSON.stringify(data) };
  } catch (err) {
    return { success: false, output: "", error: `whatsapp_send_media_message failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleWhatsappListTemplates: ToolHandler = async (args, config, secrets) => {
  const { token, wabaId } = whatsappCreds(config, secrets);
  if (!token || !wabaId) {
    return { success: false, output: "", error: "WhatsApp credentials incomplete (need waba_id)." };
  }
  const limit = Number(args.limit) || 50;
  try {
    const res = await whatsappFetch(`/${wabaId}/message_templates?limit=${limit}`, token);
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `WhatsApp API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `whatsapp_list_message_templates failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleWhatsappSubmitTemplate: ToolHandler = async (args, config, secrets) => {
  const { token, wabaId } = whatsappCreds(config, secrets);
  if (!token || !wabaId) {
    return { success: false, output: "", error: "WhatsApp credentials incomplete (need waba_id)." };
  }
  try {
    const res = await whatsappFetch(`/${wabaId}/message_templates`, token, {
      method: "POST",
      body: {
        name: String(args.name || "").toLowerCase(),
        category: String(args.category || "UTILITY"),
        language: String(args.language_code || "en_US"),
        components: [{ type: "BODY", text: String(args.body_text || "") }]
      }
    });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `WhatsApp API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: `Template submitted (approval can take 24-72h). ${JSON.stringify(data).slice(0, 300)}` };
  } catch (err) {
    return { success: false, output: "", error: `whatsapp_submit_message_template failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleWhatsappListConversations: ToolHandler = async (_args, _config, _secrets) => {
  // Meta does not expose a "list conversations" endpoint on the Cloud API.
  // Conversations are reconstructed from webhook events logged by
  // app/api/webhooks/whatsapp/route.ts. Until that webhook is wired and
  // writes to a dedicated inbound-message table, this tool returns guidance
  // rather than a fake answer.
  return {
    success: false,
    output: "",
    error:
      "whatsapp_list_conversations requires the /api/webhooks/whatsapp route to be deployed and logging inbound messages. Once wired, this reads from the inbound-message table. For now, check messages in the WhatsApp app directly."
  };
};

const handleWhatsappMarkAsRead: ToolHandler = async (args, config, secrets) => {
  const { token, phoneNumberId } = whatsappCreds(config, secrets);
  if (!token || !phoneNumberId) {
    return { success: false, output: "", error: "WhatsApp credentials incomplete." };
  }
  const messageId = String(args.message_id || "");
  if (!messageId) return { success: false, output: "", error: "message_id required" };
  try {
    const res = await whatsappFetch(`/${phoneNumberId}/messages`, token, {
      method: "POST",
      body: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId
      }
    });
    const data = await res.json();
    if (!res.ok) return { success: false, output: "", error: `WhatsApp API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    return { success: true, output: `Marked ${messageId} as read.` };
  } catch (err) {
    return { success: false, output: "", error: `whatsapp_mark_as_read failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

// ── Reddit direct posting (replaces the earlier log_reddit_target-only path) ──
//
// Uses Reddit's "script app" OAuth password grant. The reddit_mcp integration
// already collects the four creds (client_id, client_secret, username,
// password) and optional user_agent. We fetch an access token on demand,
// cached briefly to avoid hammering /api/v1/access_token.

type RedditTokenCache = { token: string; exp: number };
const REDDIT_TOKEN_CACHE = new Map<string, RedditTokenCache>();

async function getRedditAccessToken(
  config: Record<string, string>,
  secrets: Record<string, string>
): Promise<{ token: string; userAgent: string } | { error: string }> {
  const clientId = secrets.client_id;
  const clientSecret = secrets.client_secret;
  const username = secrets.username;
  const password = secrets.password;
  const userAgent =
    config.user_agent || `ghost-protoclaw-reddit/1.0 (by u/${username || "unknown"})`;

  if (!clientId || !clientSecret || !username || !password) {
    return {
      error:
        "Reddit credentials incomplete. Need client_id, client_secret, username, password on the reddit_mcp MCP server."
    };
  }

  const cacheKey = `${clientId}:${username}`;
  const cached = REDDIT_TOKEN_CACHE.get(cacheKey);
  if (cached && cached.exp > Date.now() + 60_000) {
    return { token: cached.token, userAgent };
  }

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "password",
      username,
      password
    });
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent
      },
      body
    });
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !data.access_token) {
      return {
        error: `Reddit token fetch ${res.status}: ${data.error || JSON.stringify(data).slice(0, 200)}`
      };
    }
    REDDIT_TOKEN_CACHE.set(cacheKey, {
      token: data.access_token,
      exp: Date.now() + (data.expires_in ?? 3600) * 1000
    });
    return { token: data.access_token, userAgent };
  } catch (err) {
    return {
      error: `Reddit token fetch failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}

const handleRedditCreatePost: ToolHandler = async (args, config, secrets) => {
  const tokenRes = await getRedditAccessToken(config, secrets);
  if ("error" in tokenRes) {
    return { success: false, output: "", error: tokenRes.error };
  }
  const subreddit = String(args.subreddit || "").replace(/^r\//, "");
  const title = String(args.title || "");
  const body = String(args.body || "");
  const postKind = String(args.kind || "self"); // "self" (text) or "link"
  const url = String(args.url || "");
  if (!subreddit || !title) {
    return { success: false, output: "", error: "subreddit and title are required" };
  }
  const params = new URLSearchParams();
  params.set("sr", subreddit);
  params.set("title", title);
  params.set("kind", postKind === "link" ? "link" : "self");
  params.set("api_type", "json");
  if (postKind === "link") {
    if (!url) return { success: false, output: "", error: "url required when kind=link" };
    params.set("url", url);
  } else {
    params.set("text", body);
  }
  try {
    const res = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenRes.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": tokenRes.userAgent
      },
      body: params
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Reddit API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    const errors = (data?.json?.errors ?? []) as unknown[];
    if (errors.length) {
      return { success: false, output: "", error: `Reddit rejected: ${JSON.stringify(errors)}` };
    }
    return { success: true, output: JSON.stringify(data?.json?.data ?? data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `reddit_create_post failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleRedditReplyToPost: ToolHandler = async (args, config, secrets) => {
  const tokenRes = await getRedditAccessToken(config, secrets);
  if ("error" in tokenRes) {
    return { success: false, output: "", error: tokenRes.error };
  }
  // Reddit "thing_id" format: t3_xxx for posts, t1_xxx for comments.
  const thingId = String(args.thing_id || "");
  const text = String(args.text || "");
  if (!thingId || !text) {
    return { success: false, output: "", error: "thing_id (e.g., t3_abc) and text are required" };
  }
  const params = new URLSearchParams();
  params.set("thing_id", thingId);
  params.set("text", text);
  params.set("api_type", "json");
  try {
    const res = await fetch("https://oauth.reddit.com/api/comment", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenRes.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": tokenRes.userAgent
      },
      body: params
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Reddit API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    const errors = (data?.json?.errors ?? []) as unknown[];
    if (errors.length) {
      return { success: false, output: "", error: `Reddit rejected: ${JSON.stringify(errors)}` };
    }
    return { success: true, output: JSON.stringify(data?.json?.data ?? data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `reddit_reply_to_post failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

// ── Sendpilot (LinkedIn automation) ───────────────────────────────
//
// API: https://api.sendpilot.ai/v1, X-API-Key header auth.
// Webhook: HMAC-SHA256 over `${timestamp}.${raw_body}` with webhook_secret,
// header `Webhook-Signature: v1,t=<ts>,s=<hex>`. See webhook route handler.

const SENDPILOT_API_BASE = "https://api.sendpilot.ai/v1";

async function sendpilotFetch(
  path: string,
  apiKey: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  return fetch(`${SENDPILOT_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json"
    },
    body: init?.body ? JSON.stringify(init.body) : undefined
  });
}

const handleSendpilotSendDm: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return { success: false, output: "", error: "Sendpilot API key missing. Add it in MCP Servers → Sendpilot." };
  }
  const leadId = String(args.lead_id || "");
  const senderId = String(args.sender_id || "");
  const message = String(args.message || "");
  if (!leadId || !senderId || !message) {
    return { success: false, output: "", error: "lead_id, sender_id, and message are required" };
  }
  try {
    const res = await sendpilotFetch("/messages", apiKey, {
      method: "POST",
      body: { leadId, senderId, message }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Sendpilot API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `sendpilot_send_dm failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleSendpilotSendConnectionRequest: ToolHandler = async (args, config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Sendpilot API key missing." };
  const linkedinUrl = String(args.linkedin_url || "");
  if (!linkedinUrl) return { success: false, output: "", error: "linkedin_url required" };
  const campaignId =
    String(args.campaign_id || "") || config.connect_campaign_id || "";
  if (!campaignId) {
    return {
      success: false,
      output: "",
      error:
        "campaign_id required (or set connect_campaign_id on the Sendpilot MCP config). Create a campaign in Sendpilot whose first step is a Connection Request with a {{note}} merge field."
    };
  }
  const lead: Record<string, unknown> = { linkedinUrl };
  if (args.first_name) lead.firstName = String(args.first_name);
  if (args.last_name) lead.lastName = String(args.last_name);
  if (args.note) lead.customFields = { note: String(args.note) };
  try {
    const res = await sendpilotFetch("/leads", apiKey, {
      method: "POST",
      body: { campaignId, leads: [lead] }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Sendpilot API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `sendpilot_send_connection_request failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleSendpilotListSenders: ToolHandler = async (_args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Sendpilot API key missing." };
  try {
    const res = await sendpilotFetch("/senders", apiKey);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Sendpilot API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `sendpilot_list_senders failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleSendpilotListCampaigns: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Sendpilot API key missing." };
  const params = new URLSearchParams();
  if (args.status) params.set("status", String(args.status));
  try {
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await sendpilotFetch(`/campaigns${qs}`, apiKey);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Sendpilot API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `sendpilot_list_campaigns failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleSendpilotListLeads: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Sendpilot API key missing." };
  const params = new URLSearchParams();
  if (args.campaign_id) params.set("campaignId", String(args.campaign_id));
  if (args.status) params.set("status", String(args.status));
  params.set("limit", String(Number(args.limit) || 50));
  try {
    const res = await sendpilotFetch(`/leads?${params.toString()}`, apiKey);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Sendpilot API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `sendpilot_list_leads failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleSendpilotUpdateLeadStatus: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "Sendpilot API key missing." };
  const leadId = String(args.lead_id || "");
  const status = String(args.status || "");
  if (!leadId || !status) {
    return { success: false, output: "", error: "lead_id and status are required" };
  }
  try {
    const res = await sendpilotFetch(`/leads/${leadId}/status`, apiKey, {
      method: "PATCH",
      body: { status }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `Sendpilot API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: `Lead ${leadId} → ${status}. ${JSON.stringify(data).slice(0, 200)}` };
  } catch (err) {
    return { success: false, output: "", error: `sendpilot_update_lead_status failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

// ── Slack Outreach (Slack Connect cold-outreach wedge) ────────────
//
// API: https://slack.com/api/{method}, Bearer token auth. Two token types
// matter:
//   - bot_token  (xoxb-…): suitable for users.lookupByEmail + chat.postMessage
//   - user_token (xoxp-…): required for conversations.create on Slack Connect
//                          + conversations.inviteShared
// Some workspaces only allow Slack Connect channel creation under a user
// token with the conversations.connect:manage scope; we accept either and
// prefer user_token when both are present.
//
// Rate-limit governance: ≤30 Connect invites per business per 24h. Counted
// from ActivityEntry rows (type=slack_outreach_invite). Exceeding the cap
// returns an explicit `rate_limited_by_governance` error the agent should
// NOT retry — Slack flags workspaces that spam invites.

const SLACK_API_BASE = "https://slack.com/api/";
const SLACK_INVITE_DAILY_CAP = 30;

async function slackFetch(
  method: string,
  token: string,
  body?: Record<string, unknown>,
  httpMethod: "POST" | "GET" = "POST"
): Promise<Record<string, unknown> & { ok: boolean; error?: string }> {
  let url = `${SLACK_API_BASE}${method}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8"
  };
  let fetchBody: string | undefined;
  if (httpMethod === "GET" && body) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    url += `?${qs.toString()}`;
  } else if (body) {
    fetchBody = JSON.stringify(body);
  }
  const res = await fetch(url, {
    method: httpMethod,
    headers,
    body: fetchBody
  });
  const json = await res.json().catch(() => ({
    ok: false,
    error: `http_${res.status}`
  }));
  return json as Record<string, unknown> & { ok: boolean; error?: string };
}

const handleSlackLookupUserByEmail: ToolHandler = async (args, _config, secrets) => {
  const token = secrets.bot_token || secrets.user_token;
  if (!token) {
    return {
      success: false,
      output: "",
      error: "Slack token missing. Add bot_token in MCP Servers → Slack Outreach."
    };
  }
  const email = String(args.email || "").trim();
  if (!email) {
    return { success: false, output: "", error: "email is required" };
  }
  try {
    const res = await slackFetch("users.lookupByEmail", token, { email });
    if (!res.ok) {
      if (res.error === "users_not_found") {
        return {
          success: true,
          output: JSON.stringify({ found: false, email })
        };
      }
      return { success: false, output: "", error: `Slack API: ${res.error}` };
    }
    const user = (res.user || {}) as Record<string, unknown>;
    const profile = (user.profile || {}) as Record<string, unknown>;
    return {
      success: true,
      output: JSON.stringify({
        found: true,
        email,
        user_id: user.id,
        team_id: user.team_id,
        real_name: user.real_name,
        display_name: profile.display_name,
        is_external_team:
          Boolean(user.is_stranger) || Boolean(user.is_invited_user)
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `slack_outreach_lookup_user_by_email failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleSlackCreateConnectChannel: ToolHandler = async (args, _config, secrets) => {
  const token = secrets.user_token || secrets.bot_token;
  if (!token) {
    return {
      success: false,
      output: "",
      error:
        "Slack user_token (preferred) or bot_token missing. Slack Connect channel creation typically requires user-token scopes (conversations.connect:manage)."
    };
  }
  const rawName = String(args.name || "").trim();
  if (!rawName) {
    return { success: false, output: "", error: "name is required" };
  }
  const name = rawName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (!name) {
    return {
      success: false,
      output: "",
      error:
        "name contains no valid channel characters (a-z, 0-9, _, -). Provide a different name."
    };
  }
  const topic = String(args.topic || "").slice(0, 250);
  try {
    const res = await slackFetch("conversations.create", token, {
      name,
      is_private: true
    });
    if (!res.ok) {
      return { success: false, output: "", error: `Slack API: ${res.error}` };
    }
    const channel = (res.channel || {}) as Record<string, unknown>;
    const channelId = String(channel.id || "");
    let topicSet = false;
    if (topic && channelId) {
      const t = await slackFetch("conversations.setTopic", token, {
        channel: channelId,
        topic
      });
      topicSet = Boolean(t.ok);
    }
    return {
      success: true,
      output: JSON.stringify({
        channel_id: channelId,
        channel_name: channel.name,
        is_private: true,
        topic_set: topicSet
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `slack_outreach_create_connect_channel failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleSlackInviteConnectByEmail: ToolHandler = async (args, _config, secrets) => {
  const token = secrets.user_token || secrets.bot_token;
  if (!token) {
    return { success: false, output: "", error: "Slack token missing." };
  }
  const channel = String(args.channel_id || "").trim();
  const email = String(args.email || "").trim();
  const customMessage = String(args.custom_message || "").trim();
  if (!channel || !email || !customMessage) {
    return {
      success: false,
      output: "",
      error: "channel_id, email, and custom_message are required"
    };
  }
  const externalLimited =
    args.external_limited === undefined
      ? true
      : Boolean(args.external_limited);

  const businessId = String(args._businessId || "");
  const agentId = args._agentId ? String(args._agentId) : null;

  if (businessId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCount = await db.activityEntry.count({
      where: {
        businessId,
        type: "slack_outreach_invite",
        createdAt: { gte: since }
      }
    });
    if (dailyCount >= SLACK_INVITE_DAILY_CAP) {
      return {
        success: false,
        output: "",
        error: `rate_limited_by_governance: ${dailyCount}/${SLACK_INVITE_DAILY_CAP} Slack Connect invites already sent in the last 24h for this business. Stop and resume tomorrow — more invites today risk Slack flagging the workspace.`
      };
    }
  }

  try {
    const res = await slackFetch("conversations.inviteShared", token, {
      channel,
      emails: [email],
      external_limited: externalLimited,
      custom_message: customMessage.slice(0, 500)
    });
    if (!res.ok) {
      return { success: false, output: "", error: `Slack API: ${res.error}` };
    }
    const inviteIdRaw =
      (res as Record<string, unknown>).invite_id ??
      ((res as Record<string, unknown>).invite_ids as unknown[] | undefined)?.[0] ??
      "";
    const inviteId = String(inviteIdRaw);

    if (businessId) {
      await db.activityEntry
        .create({
          data: {
            businessId,
            type: "slack_outreach_invite",
            title: `Slack Connect invite → ${email}`,
            detail: customMessage.slice(0, 300),
            status: "sent",
            metadata: JSON.parse(
              JSON.stringify({
                source: "slack_outreach_invite",
                channel_id: channel,
                email,
                invite_id: inviteId,
                agent_id: agentId
              })
            )
          }
        })
        .catch((err) => {
          console.error("[slack_outreach_invite] audit log failed:", err);
        });
    }

    return {
      success: true,
      output: JSON.stringify({
        invite_id: inviteId,
        channel_id: channel,
        status: "sent",
        email
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `slack_outreach_invite_connect_by_email failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleSlackPostMessage: ToolHandler = async (args, _config, secrets) => {
  const token = secrets.bot_token || secrets.user_token;
  if (!token) {
    return { success: false, output: "", error: "Slack token missing." };
  }
  const channel = String(args.channel || "").trim();
  const text = String(args.text || "").trim();
  if (!channel || !text) {
    return { success: false, output: "", error: "channel and text are required" };
  }
  const threadTs = args.thread_ts ? String(args.thread_ts) : undefined;
  try {
    const body: Record<string, unknown> = {
      channel,
      text: text.slice(0, 4000)
    };
    if (threadTs) body.thread_ts = threadTs;
    const res = await slackFetch("chat.postMessage", token, body);
    if (!res.ok) {
      return { success: false, output: "", error: `Slack API: ${res.error}` };
    }
    const ts = String((res as Record<string, unknown>).ts || "");
    const postedChannel = String(
      (res as Record<string, unknown>).channel || channel
    );
    let permalink = "";
    if (ts && postedChannel) {
      const pl = await slackFetch(
        "chat.getPermalink",
        token,
        { channel: postedChannel, message_ts: ts },
        "GET"
      ).catch(() => null);
      if (pl && pl.ok) {
        permalink = String((pl as Record<string, unknown>).permalink || "");
      }
    }
    return {
      success: true,
      output: JSON.stringify({
        ts,
        channel: postedChannel,
        posted_at: new Date().toISOString(),
        permalink
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `slack_outreach_post_message failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleSlackListConnectInvites: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "slack_outreach_list_connect_invites requires an authenticated agent context with a business."
    };
  }
  const statusArg = String(args.status || "sent").toLowerCase();
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
  try {
    const invites = await db.activityEntry.findMany({
      where: {
        businessId,
        type: "slack_outreach_invite",
        ...(statusArg !== "all" ? { status: statusArg } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        detail: true,
        status: true,
        createdAt: true,
        metadata: true
      }
    });
    const formatted = invites.map((i) => {
      const meta = (i.metadata || {}) as Record<string, unknown>;
      return {
        invite_id: String(meta.invite_id || ""),
        channel_id: String(meta.channel_id || ""),
        invited_email: String(meta.email || ""),
        status: i.status,
        invited_at: i.createdAt.toISOString(),
        accepted_at: meta.accepted_at ? String(meta.accepted_at) : null,
        custom_message_preview: String(i.detail || "").slice(0, 120)
      };
    });
    return {
      success: true,
      output: JSON.stringify({
        invites: formatted,
        total: formatted.length,
        source: "internal_audit_log"
      })
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `slack_outreach_list_connect_invites failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleSlackOutreachHandoffFromEmailReply: ToolHandler = async (
  args,
  config,
  secrets
) => {
  const prospectEmail = String(args.prospect_email || "").trim();
  const prospectName = String(args.prospect_name || prospectEmail).trim();
  const replyText = String(args.reply_text || "").trim();
  const originalContext = String(args.original_context || "").trim();
  const channelPrefix =
    String(args.channel_name_prefix || "outreach").trim() || "outreach";
  const dryRun = Boolean(args.dry_run);

  if (!prospectEmail || !prospectName) {
    return {
      success: false,
      output: "",
      error: "prospect_email and prospect_name are required"
    };
  }

  const ctx = {
    _agentId: args._agentId,
    _businessId: args._businessId,
    _organizationId: args._organizationId,
    _conversationId: args._conversationId
  };
  const withCtx = (extra: Record<string, unknown>): Record<string, unknown> => ({
    ...ctx,
    ...extra
  });

  const firstName = prospectName.split(/\s+/)[0] || prospectName;
  const sigFromConfig = String(config.default_invite_signature || "").trim();
  const replyExcerpt = replyText.length > 400
    ? `${replyText.slice(0, 400)}…`
    : replyText;

  const bodyLines = [
    `Hi ${firstName} —`,
    "",
    originalContext
      ? `Picking up from the email about ${originalContext}.`
      : "Picking up from our email thread.",
    "",
    replyExcerpt
      ? `Your note: "${replyExcerpt.replace(/"/g, "'")}"`
      : "",
    replyExcerpt ? "" : "",
    "Slack is a cleaner home for back-and-forth than my inbox. If this isn't useful, close the channel and we go back to email.",
    sigFromConfig ? "" : "",
    sigFromConfig
  ].filter((line) => line !== "");
  const customMessage = bodyLines.join("\n").slice(0, 480);

  // 1. Reachability lookup
  const lookupRes = await handleSlackLookupUserByEmail(
    withCtx({ email: prospectEmail }),
    config,
    secrets
  );
  if (!lookupRes.success) return lookupRes;
  let lookupData: Record<string, unknown> = {};
  try {
    lookupData = JSON.parse(lookupRes.output);
  } catch {
    /* ignore */
  }
  const alreadyReachable =
    lookupData.found === true && typeof lookupData.user_id === "string";

  if (dryRun) {
    return {
      success: true,
      output: JSON.stringify({
        dry_run: true,
        plan: alreadyReachable
          ? {
              path: "direct_dm",
              to_user_id: lookupData.user_id,
              body: customMessage
            }
          : {
              path: "invite_via_new_channel",
              channel_prefix: channelPrefix,
              invite_message: customMessage
            }
      })
    };
  }

  // 2a. Reachable: DM directly via user_id (Slack opens an IM automatically)
  if (alreadyReachable) {
    const postRes = await handleSlackPostMessage(
      withCtx({
        channel: lookupData.user_id,
        text: customMessage
      }),
      config,
      secrets
    );
    if (!postRes.success) return postRes;
    let postData: Record<string, unknown> = {};
    try {
      postData = JSON.parse(postRes.output);
    } catch {
      /* ignore */
    }
    return {
      success: true,
      output: JSON.stringify({
        path: "direct_dm",
        prospect_email: prospectEmail,
        ts: postData.ts,
        channel: postData.channel,
        permalink: postData.permalink,
        invite_message_preview: customMessage.slice(0, 120)
      })
    };
  }

  // 2b. Not reachable: create channel + send Connect invite
  const randomSuffix = Math.floor(Math.random() * 0xffff)
    .toString(36)
    .padStart(3, "0");
  const channelNameRaw = `${channelPrefix}-${prospectName}-${randomSuffix}`;
  const topic = originalContext
    ? `Continuing email thread: ${originalContext}`.slice(0, 250)
    : `Continuing email thread with ${prospectName}`.slice(0, 250);

  const channelRes = await handleSlackCreateConnectChannel(
    withCtx({ name: channelNameRaw, topic }),
    config,
    secrets
  );
  if (!channelRes.success) return channelRes;
  let channelData: Record<string, unknown> = {};
  try {
    channelData = JSON.parse(channelRes.output);
  } catch {
    /* ignore */
  }
  const channelId = String(channelData.channel_id || "");
  if (!channelId) {
    return {
      success: false,
      output: "",
      error: "create_connect_channel returned no channel_id"
    };
  }

  const inviteRes = await handleSlackInviteConnectByEmail(
    withCtx({
      channel_id: channelId,
      email: prospectEmail,
      custom_message: customMessage,
      external_limited: true
    }),
    config,
    secrets
  );
  if (!inviteRes.success) {
    // Bubble the rate-limit / API error verbatim so Reply Triager can re-queue.
    return inviteRes;
  }
  let inviteData: Record<string, unknown> = {};
  try {
    inviteData = JSON.parse(inviteRes.output);
  } catch {
    /* ignore */
  }

  return {
    success: true,
    output: JSON.stringify({
      path: "invite_via_new_channel",
      prospect_email: prospectEmail,
      channel_id: channelId,
      channel_name: channelData.channel_name,
      invite_id: inviteData.invite_id,
      invite_message_preview: customMessage.slice(0, 120)
    })
  };
};

const handleSlackLogTarget: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return {
      success: false,
      output: "",
      error:
        "slack_outreach_log_target requires an authenticated agent context with a business."
    };
  }
  const agentId = args._agentId ? String(args._agentId) : undefined;
  const email = String(args.email || "").trim();
  if (!email) {
    return { success: false, output: "", error: "email is required" };
  }
  const score =
    typeof args.score === "number"
      ? Math.max(1, Math.min(Math.round(Number(args.score)), 10))
      : null;
  const prospectName = String(args.prospect_name || email);
  return createOutreachTarget({
    businessId,
    platform: "slack",
    url: String(args.permalink || `mailto:${email}`),
    title: prospectName,
    excerpt: "",
    draftReply: String(args.draft_message || ""),
    reasoning: String(args.reasoning || ""),
    score,
    author: prospectName,
    community: String(args.workspace_or_community || ""),
    platformExtras: { email },
    agentId
  });
};

// ── ManyChat (FB Messenger + Instagram DMs) ───────────────────────
//
// API: https://api.manychat.com, Bearer token auth. The /fb/ path prefix
// handles BOTH Facebook Messenger and Instagram subscribers — legacy
// naming from when ManyChat was FB-only. Meta's 24-hour messaging window
// is enforced by Meta, not ManyChat — calls outside the window without a
// valid message_tag will fail at send time.
//
// Webhook: ManyChat's signature verification isn't clearly documented —
// we use a shared secret embedded in the webhook URL query string, verified
// in the webhook route against the Integration's encrypted webhook_secret.

const MANYCHAT_API_BASE = "https://api.manychat.com";

async function manychatFetch(
  path: string,
  apiKey: string,
  init?: { method?: string; body?: unknown }
): Promise<Response> {
  return fetch(`${MANYCHAT_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: init?.body ? JSON.stringify(init.body) : undefined
  });
}

const handleManychatSendContent: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) {
    return { success: false, output: "", error: "ManyChat API key missing. Add it in MCP Servers → ManyChat." };
  }
  const subscriberId = String(args.subscriber_id || "");
  const messageText = String(args.message_text || "");
  if (!subscriberId || !messageText) {
    return { success: false, output: "", error: "subscriber_id and message_text required" };
  }
  const messageTag = String(args.message_tag || "RESPONSE");
  try {
    const res = await manychatFetch("/fb/sending/sendContent", apiKey, {
      method: "POST",
      body: {
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
            messages: [{ type: "text", text: messageText }]
          }
        },
        message_tag: messageTag
      }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `manychat_send_content failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleManychatSendFlow: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "ManyChat API key missing." };
  const subscriberId = String(args.subscriber_id || "");
  const flowNs = String(args.flow_ns || "");
  if (!subscriberId || !flowNs) {
    return { success: false, output: "", error: "subscriber_id and flow_ns required" };
  }
  try {
    const res = await manychatFetch("/fb/sending/sendFlow", apiKey, {
      method: "POST",
      body: { subscriber_id: subscriberId, flow_ns: flowNs }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `manychat_send_flow failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleManychatFindSubscriberByEmail: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "ManyChat API key missing." };
  const email = String(args.email || "");
  if (!email) return { success: false, output: "", error: "email required" };
  try {
    const params = new URLSearchParams({ email });
    const res = await manychatFetch(`/fb/subscriber/findByEmail?${params.toString()}`, apiKey);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `manychat_find_subscriber_by_email failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleManychatGetSubscriberInfo: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "ManyChat API key missing." };
  const subscriberId = String(args.subscriber_id || "");
  if (!subscriberId) return { success: false, output: "", error: "subscriber_id required" };
  try {
    const params = new URLSearchParams({ subscriber_id: subscriberId });
    const res = await manychatFetch(`/fb/subscriber/getInfo?${params.toString()}`, apiKey);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `manychat_get_subscriber_info failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleManychatAddTag: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "ManyChat API key missing." };
  const subscriberId = String(args.subscriber_id || "");
  const tagName = String(args.tag_name || "");
  if (!subscriberId || !tagName) {
    return { success: false, output: "", error: "subscriber_id and tag_name required" };
  }
  try {
    const res = await manychatFetch("/fb/subscriber/addTagByName", apiKey, {
      method: "POST",
      body: { subscriber_id: subscriberId, tag_name: tagName }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: `Tag '${tagName}' added to ${subscriberId}.` };
  } catch (err) {
    return { success: false, output: "", error: `manychat_add_tag failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleManychatRemoveTag: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "ManyChat API key missing." };
  const subscriberId = String(args.subscriber_id || "");
  const tagName = String(args.tag_name || "");
  if (!subscriberId || !tagName) {
    return { success: false, output: "", error: "subscriber_id and tag_name required" };
  }
  try {
    const res = await manychatFetch("/fb/subscriber/removeTagByName", apiKey, {
      method: "POST",
      body: { subscriber_id: subscriberId, tag_name: tagName }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: `Tag '${tagName}' removed from ${subscriberId}.` };
  } catch (err) {
    return { success: false, output: "", error: `manychat_remove_tag failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleManychatSetCustomField: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "ManyChat API key missing." };
  const subscriberId = String(args.subscriber_id || "");
  const fieldName = String(args.field_name || "");
  const fieldValue = String(args.field_value || "");
  if (!subscriberId || !fieldName) {
    return { success: false, output: "", error: "subscriber_id and field_name required" };
  }
  try {
    const res = await manychatFetch("/fb/subscriber/setCustomFieldByName", apiKey, {
      method: "POST",
      body: {
        subscriber_id: subscriberId,
        field_name: fieldName,
        field_value: fieldValue
      }
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: `Set ${fieldName}='${fieldValue}' on ${subscriberId}.` };
  } catch (err) {
    return { success: false, output: "", error: `manychat_set_custom_field failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

const handleManychatListSubscribersByTag: ToolHandler = async (args, _config, secrets) => {
  const apiKey = secrets.api_key;
  if (!apiKey) return { success: false, output: "", error: "ManyChat API key missing." };
  const tagName = String(args.tag_name || "");
  if (!tagName) return { success: false, output: "", error: "tag_name required" };
  const limit = Number(args.limit) || 100;
  try {
    const params = new URLSearchParams({ tag_name: tagName, limit: String(limit) });
    const res = await manychatFetch(`/fb/subscriber/getSubscribersByTag?${params.toString()}`, apiKey);
    const data = await res.json();
    if (!res.ok) {
      return { success: false, output: "", error: `ManyChat API ${res.status}: ${JSON.stringify(data).slice(0, 400)}` };
    }
    return { success: true, output: JSON.stringify(data, null, 2) };
  } catch (err) {
    return { success: false, output: "", error: `manychat_list_subscribers_by_tag failed: ${err instanceof Error ? err.message : "unknown"}` };
  }
};

// ── TipTax Prospect funnel tools ─────────────────────────────────
//
// Backed by lib/repository/prospects.ts. Each handler reads the agent's
// _businessId from the runtime-injected context, calls the repository,
// and returns the resulting Prospect or summary as JSON. Template gating
// is enforced upstream (only tiptax_affiliate_engine agents see these
// tools), so handlers don't need to re-check templateId.

const handleProspectRecordSource: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return { success: false, output: "", error: "prospect_record_source requires authenticated business context" };
  }
  const businessName = String(args.business_name || "").trim();
  if (!businessName) {
    return { success: false, output: "", error: "business_name is required" };
  }
  try {
    const { recordProspectSource } = await import("@/lib/repository/prospects");
    const { prospect, created } = await recordProspectSource({
      businessId,
      businessName,
      state: typeof args.state === "string" ? args.state : null,
      metro: typeof args.metro === "string" ? args.metro : null,
      email: typeof args.email === "string" ? args.email.toLowerCase() : null,
      phone: typeof args.phone === "string" ? args.phone : null,
      website: typeof args.website === "string" ? args.website : null,
      sourceType: typeof args.source_type === "string" ? args.source_type : null,
      sourceUrl: typeof args.source_url === "string" ? args.source_url : null,
      cuisine: typeof args.cuisine === "string" ? args.cuisine : null,
      liquorClass: typeof args.liquor_class === "string" ? args.liquor_class : null,
      seatsEstimate: typeof args.seats_estimate === "number" ? args.seats_estimate : null,
      reviewCount: typeof args.review_count === "number" ? args.review_count : null,
      multiUnitFlag: args.multi_unit_flag === true
    });
    return {
      success: true,
      output: JSON.stringify(
        { prospect_id: prospect.id, stage: prospect.stage, created },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `prospect_record_source failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleProspectRecordQualification: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return { success: false, output: "", error: "prospect_record_qualification requires authenticated business context" };
  }
  const prospectId = String(args.prospect_id || "");
  const tier = args.tier === "A" || args.tier === "B" || args.tier === "C" ? args.tier : null;
  const fitScore = Number(args.fit_score);
  if (!prospectId || !tier || !Number.isFinite(fitScore)) {
    return {
      success: false,
      output: "",
      error: "prospect_id, tier (A|B|C), and fit_score (1-10) are required"
    };
  }
  let fitNotes: Record<string, unknown> | null = null;
  if (typeof args.fit_notes === "string" && args.fit_notes.trim().length > 0) {
    try {
      fitNotes = JSON.parse(args.fit_notes) as Record<string, unknown>;
    } catch {
      fitNotes = { raw: args.fit_notes };
    }
  }
  try {
    const { recordProspectQualification } = await import("@/lib/repository/prospects");
    const prospect = await recordProspectQualification({
      prospectId,
      tier: tier as "A" | "B" | "C",
      fitScore: Math.max(1, Math.min(10, Math.round(fitScore))),
      estimatedRecoveryBand:
        typeof args.estimated_recovery_band === "string" ? args.estimated_recovery_band : null,
      multiUnitFlag: args.multi_unit_flag === true ? true : undefined,
      fitNotes
    });
    return {
      success: true,
      output: JSON.stringify(
        {
          prospect_id: prospect.id,
          tier: prospect.tier,
          fit_score: prospect.fitScore,
          stage: prospect.stage
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `prospect_record_qualification failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleProspectTransition: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return { success: false, output: "", error: "prospect_transition requires authenticated business context" };
  }
  const prospectId = String(args.prospect_id || "");
  const toStage = String(args.to_stage || "");
  if (!prospectId || !toStage) {
    return { success: false, output: "", error: "prospect_id and to_stage are required" };
  }
  try {
    const { transitionProspect } = await import("@/lib/repository/prospects");
    const prospect = await transitionProspect({
      prospectId,
      toStage,
      reason: typeof args.reason === "string" ? args.reason : null,
      channel: typeof args.channel === "string" ? args.channel : null,
      buyerState: typeof args.buyer_state === "string" ? args.buyer_state : undefined,
      engagementScore:
        typeof args.engagement_score === "number" ? args.engagement_score : undefined,
      engagementTier: typeof args.engagement_tier === "string" ? args.engagement_tier : undefined,
      fallingTrust: args.falling_trust === true ? true : undefined,
      utmCampaign: typeof args.utm_campaign === "string" ? args.utm_campaign : undefined,
      utmContent: typeof args.utm_content === "string" ? args.utm_content : undefined
    });
    return {
      success: true,
      output: JSON.stringify(
        {
          prospect_id: prospect.id,
          stage: prospect.stage,
          buyer_state: prospect.buyerState,
          engagement_tier: prospect.engagementTier,
          last_transition_at: prospect.lastTransitionAt
        },
        null,
        2
      )
    };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `prospect_transition failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

const handleProspectFunnelSummary: ToolHandler = async (args) => {
  const businessId = String(args._businessId || "");
  if (!businessId) {
    return { success: false, output: "", error: "prospect_funnel_summary requires authenticated business context" };
  }
  const windowDays =
    typeof args.window_days === "number" && args.window_days > 0
      ? Math.min(365, Math.round(args.window_days))
      : 30;
  try {
    const { computeFunnelSummary } = await import("@/lib/repository/prospects");
    const summary = await computeFunnelSummary(businessId, windowDays);
    return { success: true, output: JSON.stringify(summary, null, 2) };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `prospect_funnel_summary failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
};

// ── Real-estate property data handlers ────────────────────────────
// Three providers wired in for Dealhawk Empire sourcing. Each is
// recommended (not required); the unified `property_*` tools below
// pick the best-configured provider per query. Operators paste their
// API key in /admin/integrations and the executor auto-injects it
// via INTEGRATION_KEY_FOR_TOOL above.
//
//   - rentcast       — AVM, listings, comps, market data (best AVM)
//   - axesso_zillow  — 20+ Zillow GET endpoints (ZPID lookups, Zestimate)
//   - realie         — parcel + ownership data (best skip-trace)
//
// All handlers degrade gracefully when the provider isn't configured:
// they return a clean error with the connect URL so the agent can
// surface "this capability needs RentCast — operator can connect at
// /admin/integrations" instead of throwing.

const RENTCAST_BASE = "https://api.rentcast.io/v1";

async function rentcastFetch(
  apiKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ToolCallResult> {
  if (!apiKey) {
    return {
      success: false,
      output: "",
      error:
        "RentCast not configured. Connect it at /admin/integrations (free tier: 50 calls/month) to enable rentcast_* and property_* tools."
    };
  }
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  try {
    const res = await fetch(`${RENTCAST_BASE}${path}${qs}`, {
      method: "GET",
      headers: { "X-Api-Key": apiKey, Accept: "application/json" }
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const status = res.status;
      const hint =
        status === 401
          ? "Auth failed. Verify the API key at /admin/integrations."
          : status === 429
          ? "RentCast rate limit hit. Free tier: 50/month; paid tiers scale up. See developers.rentcast.io for limits."
          : status >= 500
          ? "RentCast server error. Retry with 5-10s backoff up to 3 attempts."
          : `Permanent error (${status}). Fix input — do not retry.`;
      return {
        success: false,
        output: "",
        error: `RentCast ${status} on GET ${path}: ${text}\n\n${hint}`
      };
    }
    return { success: true, output: text || "{}" };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `RentCast fetch failed on ${path}: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}

const handleRentcastSearchProperties: ToolHandler = async (args, _config, secrets) =>
  rentcastFetch(secrets.api_key, "/properties", {
    address: args.address as string | undefined,
    city: args.city as string | undefined,
    state: args.state as string | undefined,
    zipCode: args.zipCode as string | undefined,
    latitude: args.latitude as number | undefined,
    longitude: args.longitude as number | undefined,
    radius: args.radius as number | undefined,
    propertyType: args.propertyType as string | undefined,
    bedrooms: args.bedrooms as number | undefined,
    bathrooms: args.bathrooms as number | undefined,
    squareFootage: args.squareFootage as number | undefined,
    yearBuilt: args.yearBuilt as number | undefined,
    saleDateRange: args.saleDateRange as number | undefined,
    limit: (args.limit as number | undefined) ?? 25,
    offset: args.offset as number | undefined
  });

const handleRentcastValueEstimate: ToolHandler = async (args, _config, secrets) =>
  rentcastFetch(secrets.api_key, "/avm/value", {
    address: args.address as string | undefined,
    latitude: args.latitude as number | undefined,
    longitude: args.longitude as number | undefined,
    propertyType: args.propertyType as string | undefined,
    bedrooms: args.bedrooms as number | undefined,
    bathrooms: args.bathrooms as number | undefined,
    squareFootage: args.squareFootage as number | undefined,
    maxRadius: args.maxRadius as number | undefined,
    daysOld: args.daysOld as number | undefined,
    compCount: (args.compCount as number | undefined) ?? 10
  });

const handleRentcastRentEstimate: ToolHandler = async (args, _config, secrets) =>
  rentcastFetch(secrets.api_key, "/avm/rent/long-term", {
    address: args.address as string | undefined,
    latitude: args.latitude as number | undefined,
    longitude: args.longitude as number | undefined,
    propertyType: args.propertyType as string | undefined,
    bedrooms: args.bedrooms as number | undefined,
    bathrooms: args.bathrooms as number | undefined,
    squareFootage: args.squareFootage as number | undefined,
    maxRadius: args.maxRadius as number | undefined,
    compCount: (args.compCount as number | undefined) ?? 10
  });

const handleRentcastSaleListings: ToolHandler = async (args, _config, secrets) =>
  rentcastFetch(secrets.api_key, "/listings/sale", {
    address: args.address as string | undefined,
    city: args.city as string | undefined,
    state: args.state as string | undefined,
    zipCode: args.zipCode as string | undefined,
    latitude: args.latitude as number | undefined,
    longitude: args.longitude as number | undefined,
    radius: args.radius as number | undefined,
    propertyType: args.propertyType as string | undefined,
    bedrooms: args.bedrooms as number | undefined,
    bathrooms: args.bathrooms as number | undefined,
    daysOld: args.daysOld as number | undefined,
    status: (args.status as string | undefined) ?? "Active",
    limit: (args.limit as number | undefined) ?? 25
  });

const handleRentcastRentalListings: ToolHandler = async (args, _config, secrets) =>
  rentcastFetch(secrets.api_key, "/listings/rental/long-term", {
    address: args.address as string | undefined,
    city: args.city as string | undefined,
    state: args.state as string | undefined,
    zipCode: args.zipCode as string | undefined,
    latitude: args.latitude as number | undefined,
    longitude: args.longitude as number | undefined,
    radius: args.radius as number | undefined,
    propertyType: args.propertyType as string | undefined,
    bedrooms: args.bedrooms as number | undefined,
    bathrooms: args.bathrooms as number | undefined,
    daysOld: args.daysOld as number | undefined,
    status: (args.status as string | undefined) ?? "Active",
    limit: (args.limit as number | undefined) ?? 25
  });

const handleRentcastMarketData: ToolHandler = async (args, _config, secrets) =>
  rentcastFetch(secrets.api_key, "/markets", {
    zipCode: args.zipCode as string | undefined,
    dataType: (args.dataType as string | undefined) ?? "All",
    historyRange: args.historyRange as number | undefined
  });

// ── Axesso Zillow handlers ────────────────────────────────────────
// 10 most-useful Axesso Zillow endpoints. Axesso documents 20+ but
// these cover the operational surface Dealhawk's agents need. Auth
// via Azure API Management subscription key. If Axesso renames an
// endpoint path in the future, only the path constants below need
// updating — the rest of the chain stays stable.

const AXESSO_ZILLOW_BASE = "https://api.axesso.de/zlw";

async function axessoZillowFetch(
  subscriptionKey: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ToolCallResult> {
  if (!subscriptionKey) {
    return {
      success: false,
      output: "",
      error:
        "Axesso Zillow API not configured. Connect it at /admin/integrations (signup at axesso.developer.azure-api.net) to enable axesso_zillow_* tools."
    };
  }
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  try {
    const res = await fetch(`${AXESSO_ZILLOW_BASE}${path}${qs}`, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        Accept: "application/json"
      }
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const status = res.status;
      const hint =
        status === 401
          ? "Auth failed. Verify the subscription key at /admin/integrations."
          : status === 404
          ? `Endpoint ${path} not found on Axesso. The path may have been renamed — check axesso.developer.azure-api.net for current paths.`
          : status === 429
          ? "Axesso rate limit hit. Check your subscription tier on the developer portal."
          : status >= 500
          ? "Axesso server error. Retry with backoff."
          : `Permanent error (${status}). Fix input — do not retry.`;
      return {
        success: false,
        output: "",
        error: `Axesso Zillow ${status} on GET ${path}: ${text}\n\n${hint}`
      };
    }
    return { success: true, output: text || "{}" };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Axesso Zillow fetch failed on ${path}: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}

const handleAxessoZillowSearchByLocation: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/search-by-location", {
    location: args.location as string | undefined,
    page: (args.page as number | undefined) ?? 1
  });

const handleAxessoZillowSearchByUrl: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/search-by-url", {
    url: args.url as string | undefined,
    page: (args.page as number | undefined) ?? 1
  });

const handleAxessoZillowPropertyDetails: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/lookup", {
    zpid: args.zpid as string | undefined,
    url: args.url as string | undefined
  });

const handleAxessoZillowZestimate: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/zestimate", {
    zpid: args.zpid as string | undefined,
    url: args.url as string | undefined
  });

const handleAxessoZillowPriceHistory: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/price-history", {
    zpid: args.zpid as string | undefined,
    url: args.url as string | undefined
  });

const handleAxessoZillowComparableHomes: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/comparable-homes", {
    zpid: args.zpid as string | undefined,
    url: args.url as string | undefined
  });

const handleAxessoZillowNeighborhood: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/neighborhood", {
    zpid: args.zpid as string | undefined,
    url: args.url as string | undefined
  });

const handleAxessoZillowAccessibilityScores: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/accessibility-scores", {
    zpid: args.zpid as string | undefined,
    url: args.url as string | undefined
  });

const handleAxessoZillowMarketTrends: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/market-trends", {
    location: args.location as string | undefined
  });

const handleAxessoZillowAgentListings: ToolHandler = async (args, _config, secrets) =>
  axessoZillowFetch(secrets.subscription_key, "/agent-listings", {
    agentEncodedZuid: args.agentEncodedZuid as string | undefined,
    page: (args.page as number | undefined) ?? 1
  });

// ── Realie handlers ───────────────────────────────────────────────
// Realie's strength: parcel + ownership data. 7 GET endpoints, all
// auth via Bearer token. Free tier available; paid from $50/mo.

const REALIE_BASE = "https://api.realie.ai";

async function realieFetch(
  token: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ToolCallResult> {
  if (!token) {
    return {
      success: false,
      output: "",
      error:
        "Realie not configured. Connect it at /admin/integrations (free tier available, paid from $50/mo) to enable realie_* tools and property_owner_lookup."
    };
  }
  const qs = params
    ? "?" +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  try {
    const res = await fetch(`${REALIE_BASE}${path}${qs}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const status = res.status;
      const hint =
        status === 401
          ? "Auth failed. Verify the API token at /admin/integrations."
          : status === 429
          ? "Realie rate limit hit. Check your plan at realie.ai/pricing."
          : status >= 500
          ? "Realie server error. Retry with backoff."
          : `Permanent error (${status}). Fix input — do not retry.`;
      return {
        success: false,
        output: "",
        error: `Realie ${status} on GET ${path}: ${text}\n\n${hint}`
      };
    }
    return { success: true, output: text || "{}" };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Realie fetch failed on ${path}: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}

const handleRealieAddressLookup: ToolHandler = async (args, _config, secrets) =>
  realieFetch(secrets.api_key, "/property/address-lookup", {
    address: args.address as string | undefined,
    city: args.city as string | undefined,
    state: args.state as string | undefined,
    zipCode: args.zipCode as string | undefined
  });

const handleRealieLocationSearch: ToolHandler = async (args, _config, secrets) =>
  realieFetch(secrets.api_key, "/property/location-search", {
    latitude: args.latitude as number | undefined,
    longitude: args.longitude as number | undefined,
    radius: args.radius as number | undefined,
    limit: (args.limit as number | undefined) ?? 100
  });

const handleRealiePropertySearch: ToolHandler = async (args, _config, secrets) =>
  realieFetch(secrets.api_key, "/property/property-search", {
    state: args.state as string | undefined,
    county: args.county as string | undefined,
    city: args.city as string | undefined,
    zipCode: args.zipCode as string | undefined,
    propertyType: args.propertyType as string | undefined,
    minBedrooms: args.minBedrooms as number | undefined,
    maxBedrooms: args.maxBedrooms as number | undefined,
    minSqft: args.minSqft as number | undefined,
    maxSqft: args.maxSqft as number | undefined,
    minYearBuilt: args.minYearBuilt as number | undefined,
    maxYearBuilt: args.maxYearBuilt as number | undefined,
    minValue: args.minValue as number | undefined,
    maxValue: args.maxValue as number | undefined,
    ownerOccupied: args.ownerOccupied as boolean | undefined,
    distressedOnly: args.distressedOnly as boolean | undefined,
    cursor: args.cursor as string | undefined,
    limit: (args.limit as number | undefined) ?? 100
  });

const handleRealieOwnerSearch: ToolHandler = async (args, _config, secrets) =>
  realieFetch(secrets.api_key, "/property/owner-search", {
    ownerName: args.ownerName as string | undefined,
    state: args.state as string | undefined,
    city: args.city as string | undefined,
    limit: (args.limit as number | undefined) ?? 100
  });

const handleRealieParcelLookup: ToolHandler = async (args, _config, secrets) =>
  realieFetch(secrets.api_key, "/property/parcel-id-lookup", {
    parcelId: args.parcelId as string | undefined,
    state: args.state as string | undefined,
    county: args.county as string | undefined
  });

const handleRealiePremiumComparables: ToolHandler = async (args, _config, secrets) =>
  realieFetch(secrets.api_key, "/premium/comparables-search", {
    address: args.address as string | undefined,
    state: args.state as string | undefined,
    radius: args.radius as number | undefined,
    minBedrooms: args.minBedrooms as number | undefined,
    maxBedrooms: args.maxBedrooms as number | undefined,
    minSqft: args.minSqft as number | undefined,
    maxSqft: args.maxSqft as number | undefined,
    soldWithinDays: args.soldWithinDays as number | undefined,
    limit: (args.limit as number | undefined) ?? 25
  });

const handleRealiePremiumOwnerSearch: ToolHandler = async (args, _config, secrets) =>
  realieFetch(secrets.api_key, "/premium/owner-search", {
    query: args.query as string | undefined,
    state: args.state as string | undefined,
    fuzzy: args.fuzzy as boolean | undefined,
    limit: (args.limit as number | undefined) ?? 50
  });

// ── Unified property tools ────────────────────────────────────────
// Agent-facing routing layer. Each unified tool inspects which
// providers are configured for the org and picks the priority
// provider for the query type, then delegates to that provider's
// raw handler. Agents prefer these over the raw tools because they
// degrade gracefully when one provider isn't configured.

async function loadPropertyProviderKeys(organizationId: string): Promise<{
  rentcast: string | null;
  axesso_zillow: string | null;
  realie: string | null;
}> {
  const [rentcast, axesso, realie] = await Promise.all([
    resolveIntegrationCredentials(organizationId, "rentcast", INTEGRATION_FIELD_MAP.rentcast),
    resolveIntegrationCredentials(
      organizationId,
      "axesso_zillow",
      INTEGRATION_FIELD_MAP.axesso_zillow
    ),
    resolveIntegrationCredentials(organizationId, "realie", INTEGRATION_FIELD_MAP.realie)
  ]);
  return {
    rentcast: rentcast.api_key || null,
    axesso_zillow: axesso.subscription_key || null,
    realie: realie.api_key || null
  };
}

function noProviderConfigured(neededFor: string): ToolCallResult {
  return {
    success: false,
    output: "",
    error: `No property-data provider configured for ${neededFor}. Connect RentCast, Axesso Zillow, or Realie at /admin/integrations.`
  };
}

const handlePropertySearch: ToolHandler = async (args) => {
  const orgId = String(args._organizationId || "");
  if (!orgId) return { success: false, output: "", error: "Missing organization context." };
  const keys = await loadPropertyProviderKeys(orgId);
  // Priority for geographic search: Realie (paginated, designed for it) → Rentcast → Axesso
  if (keys.realie) {
    return realieFetch(keys.realie, "/property/property-search", {
      state: args.state as string | undefined,
      county: args.county as string | undefined,
      city: args.city as string | undefined,
      zipCode: args.zipCode as string | undefined,
      propertyType: args.propertyType as string | undefined,
      minBedrooms: args.minBedrooms as number | undefined,
      maxBedrooms: args.maxBedrooms as number | undefined,
      minSqft: args.minSqft as number | undefined,
      maxSqft: args.maxSqft as number | undefined,
      minValue: args.minValue as number | undefined,
      maxValue: args.maxValue as number | undefined,
      distressedOnly: args.distressedOnly as boolean | undefined,
      cursor: args.cursor as string | undefined,
      limit: (args.limit as number | undefined) ?? 100
    });
  }
  if (keys.rentcast) {
    return rentcastFetch(keys.rentcast, "/properties", {
      city: args.city as string | undefined,
      state: args.state as string | undefined,
      zipCode: args.zipCode as string | undefined,
      propertyType: args.propertyType as string | undefined,
      bedrooms: args.minBedrooms as number | undefined,
      limit: (args.limit as number | undefined) ?? 25
    });
  }
  if (keys.axesso_zillow) {
    const loc = (args.city as string | undefined) || (args.zipCode as string | undefined) || "";
    return axessoZillowFetch(keys.axesso_zillow, "/search-by-location", {
      location: loc,
      page: (args.page as number | undefined) ?? 1
    });
  }
  return noProviderConfigured("property_search");
};

const handlePropertyLookup: ToolHandler = async (args) => {
  const orgId = String(args._organizationId || "");
  if (!orgId) return { success: false, output: "", error: "Missing organization context." };
  const keys = await loadPropertyProviderKeys(orgId);
  // Address → Realie (clean parcel + owner data); ZPID → Axesso; URL → Axesso
  const zpid = args.zpid as string | undefined;
  const url = args.url as string | undefined;
  if (zpid || url) {
    if (keys.axesso_zillow) {
      return axessoZillowFetch(keys.axesso_zillow, "/lookup", { zpid, url });
    }
  }
  if (keys.realie) {
    return realieFetch(keys.realie, "/property/address-lookup", {
      address: args.address as string | undefined,
      city: args.city as string | undefined,
      state: args.state as string | undefined,
      zipCode: args.zipCode as string | undefined
    });
  }
  if (keys.rentcast) {
    return rentcastFetch(keys.rentcast, "/properties", {
      address: args.address as string | undefined
    });
  }
  return noProviderConfigured("property_lookup");
};

const handlePropertyValueEstimate: ToolHandler = async (args) => {
  const orgId = String(args._organizationId || "");
  if (!orgId) return { success: false, output: "", error: "Missing organization context." };
  const keys = await loadPropertyProviderKeys(orgId);
  // RentCast's specialty. Fall back to Axesso Zestimate.
  if (keys.rentcast) {
    return rentcastFetch(keys.rentcast, "/avm/value", {
      address: args.address as string | undefined,
      propertyType: args.propertyType as string | undefined,
      bedrooms: args.bedrooms as number | undefined,
      bathrooms: args.bathrooms as number | undefined,
      squareFootage: args.squareFootage as number | undefined,
      compCount: (args.compCount as number | undefined) ?? 10
    });
  }
  if (keys.axesso_zillow && (args.zpid || args.url)) {
    return axessoZillowFetch(keys.axesso_zillow, "/zestimate", {
      zpid: args.zpid as string | undefined,
      url: args.url as string | undefined
    });
  }
  return noProviderConfigured("property_value_estimate");
};

const handlePropertyRentEstimate: ToolHandler = async (args) => {
  const orgId = String(args._organizationId || "");
  if (!orgId) return { success: false, output: "", error: "Missing organization context." };
  const keys = await loadPropertyProviderKeys(orgId);
  if (keys.rentcast) {
    return rentcastFetch(keys.rentcast, "/avm/rent/long-term", {
      address: args.address as string | undefined,
      propertyType: args.propertyType as string | undefined,
      bedrooms: args.bedrooms as number | undefined,
      bathrooms: args.bathrooms as number | undefined,
      squareFootage: args.squareFootage as number | undefined,
      compCount: (args.compCount as number | undefined) ?? 10
    });
  }
  return noProviderConfigured("property_rent_estimate");
};

const handlePropertyOwnerLookup: ToolHandler = async (args) => {
  const orgId = String(args._organizationId || "");
  if (!orgId) return { success: false, output: "", error: "Missing organization context." };
  const keys = await loadPropertyProviderKeys(orgId);
  // Realie's specialty (Lucene fuzzy owner matching).
  if (keys.realie) {
    if (args.ownerName || args.query) {
      return realieFetch(keys.realie, "/premium/owner-search", {
        query: (args.query as string | undefined) || (args.ownerName as string | undefined),
        state: args.state as string | undefined,
        fuzzy: true,
        limit: (args.limit as number | undefined) ?? 50
      });
    }
    return realieFetch(keys.realie, "/property/address-lookup", {
      address: args.address as string | undefined,
      city: args.city as string | undefined,
      state: args.state as string | undefined,
      zipCode: args.zipCode as string | undefined
    });
  }
  return noProviderConfigured("property_owner_lookup");
};

const handlePropertyComps: ToolHandler = async (args) => {
  const orgId = String(args._organizationId || "");
  if (!orgId) return { success: false, output: "", error: "Missing organization context." };
  const keys = await loadPropertyProviderKeys(orgId);
  // Realie premium → Rentcast AVM (includes comps) → Axesso comparable-homes.
  if (keys.realie) {
    return realieFetch(keys.realie, "/premium/comparables-search", {
      address: args.address as string | undefined,
      state: args.state as string | undefined,
      radius: (args.radius as number | undefined) ?? 1,
      minBedrooms: args.minBedrooms as number | undefined,
      maxBedrooms: args.maxBedrooms as number | undefined,
      soldWithinDays: (args.soldWithinDays as number | undefined) ?? 180,
      limit: (args.limit as number | undefined) ?? 15
    });
  }
  if (keys.rentcast) {
    return rentcastFetch(keys.rentcast, "/avm/value", {
      address: args.address as string | undefined,
      compCount: (args.compCount as number | undefined) ?? 15,
      maxRadius: (args.radius as number | undefined) ?? 1
    });
  }
  if (keys.axesso_zillow && (args.zpid || args.url)) {
    return axessoZillowFetch(keys.axesso_zillow, "/comparable-homes", {
      zpid: args.zpid as string | undefined,
      url: args.url as string | undefined
    });
  }
  return noProviderConfigured("property_comps");
};

const handlePropertyDistressedSearch: ToolHandler = async (args) => {
  const orgId = String(args._organizationId || "");
  if (!orgId) return { success: false, output: "", error: "Missing organization context." };
  const keys = await loadPropertyProviderKeys(orgId);
  // Realie's property-search with distressedOnly is the only structured
  // path. RentCast/Axesso don't expose distress filters directly.
  if (keys.realie) {
    return realieFetch(keys.realie, "/property/property-search", {
      state: args.state as string | undefined,
      county: args.county as string | undefined,
      city: args.city as string | undefined,
      zipCode: args.zipCode as string | undefined,
      propertyType: args.propertyType as string | undefined,
      minValue: args.minValue as number | undefined,
      maxValue: args.maxValue as number | undefined,
      distressedOnly: true,
      cursor: args.cursor as string | undefined,
      limit: (args.limit as number | undefined) ?? 100
    });
  }
  return {
    success: false,
    output: "",
    error:
      "Distressed search requires Realie (filter-driven). Connect Realie at /admin/integrations, or fall back to web_search + Distress Signal Analyst scoring for low-volume work."
  };
};

// ── Blotato Handlers ──────────────────────────────────────────────
// Blotato is a unified publishing + visual-generation + content-extraction
// API across 9 social platforms. Base URL is the REST endpoint; the agents
// authenticate with the operator's API key from the MCP config. The native
// MCP endpoint at https://mcp.blotato.com/mcp is NOT used here — Ghost
// ProtoClaw calls the REST API directly so we have full control over the
// agent's tool surface and runtime contract.
//
// Operational patterns encoded in tool descriptions (Polling cadences:
// 2-5s for sources/posts, 5s for visuals; failures are PERMANENT — agents
// log and escalate, never auto-retry; 5xx retry with backoff; 4xx fail-
// immediately; 429 respect Retry-After). Handlers below DON'T poll —
// agents call the matching get_*_status tool explicitly so they can
// reason about progress between polls.

const BLOTATO_BASE = "https://backend.blotato.com/v2";

async function blotatoFetch(
  apiKey: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<ToolCallResult> {
  if (!apiKey) {
    return {
      success: false,
      output: "",
      error:
        "Blotato API key not configured. Go to /admin/integrations, add Blotato, and paste your API key from https://my.blotato.com (Settings → API)."
    };
  }
  try {
    const init: RequestInit = {
      method,
      headers: {
        "blotato-api-key": apiKey,
        "Content-Type": "application/json"
      }
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${BLOTATO_BASE}${path}`, init);
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const status = res.status;
      // Retry guidance per Blotato Protocol and Recipes:
      // 5xx → transient, retry with backoff; 4xx → permanent, fail; 429 → respect Retry-After.
      const retryHint =
        status === 429
          ? `Rate-limited. Respect Retry-After header value. DO NOT retry immediately.`
          : status >= 500
          ? `Server error. Retry with 5-10s backoff up to 3 attempts.`
          : `Permanent error (${status}). DO NOT retry the same request — fix the input first.`;
      return {
        success: false,
        output: "",
        error: `Blotato API error ${status} on ${method} ${path}: ${text}\n\n${retryHint}`
      };
    }
    return { success: true, output: text || "{}" };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Blotato fetch failed on ${method} ${path}: ${
        err instanceof Error ? err.message : "unknown"
      }`
    };
  }
}

const handleBlotatoGetUser: ToolHandler = async (_args, _config, secrets) =>
  blotatoFetch(secrets.api_key, "GET", "/users/me");

const handleBlotatoListAccounts: ToolHandler = async (args, _config, secrets) => {
  const platform = typeof args.platform === "string" ? args.platform : "";
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  return blotatoFetch(secrets.api_key, "GET", `/users/me/accounts${qs}`);
};

const handleBlotatoListSubaccounts: ToolHandler = async (args, _config, secrets) => {
  const accountId = typeof args.accountId === "string" ? args.accountId : "";
  if (!accountId) {
    return { success: false, output: "", error: "accountId is required." };
  }
  return blotatoFetch(
    secrets.api_key,
    "GET",
    `/users/me/accounts/${encodeURIComponent(accountId)}/subaccounts`
  );
};

const handleBlotatoCreatePost: ToolHandler = async (args, config, secrets) => {
  // Inject Pinterest boardId from MCP config when the operator publishes
  // to Pinterest and didn't pass one inline. Blotato can't fetch boardId
  // via API so the operator pastes it once at integration setup.
  const boardId = config.pinterest_board_id;
  if (
    boardId &&
    args.post &&
    typeof args.post === "object" &&
    args.post !== null
  ) {
    const post = args.post as Record<string, unknown>;
    const target = post.target;
    if (target && typeof target === "object" && target !== null) {
      const t = target as Record<string, unknown>;
      if (t.targetType === "pinterest" && !t.boardId) {
        t.boardId = boardId;
      }
    }
  }
  return blotatoFetch(secrets.api_key, "POST", "/posts", args);
};

const handleBlotatoGetPostStatus: ToolHandler = async (args, _config, secrets) => {
  const id = typeof args.postSubmissionId === "string" ? args.postSubmissionId : "";
  if (!id) {
    return { success: false, output: "", error: "postSubmissionId is required." };
  }
  return blotatoFetch(secrets.api_key, "GET", `/posts/${encodeURIComponent(id)}`);
};

const handleBlotatoListPosts: ToolHandler = async (args, _config, secrets) => {
  const params = new URLSearchParams();
  if (typeof args.status === "string") params.set("status", args.status);
  if (typeof args.limit === "number") params.set("limit", String(args.limit));
  if (typeof args.cursor === "string") params.set("cursor", args.cursor);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return blotatoFetch(secrets.api_key, "GET", `/posts${qs}`);
};

const handleBlotatoCreateSource: ToolHandler = async (args, _config, secrets) =>
  blotatoFetch(secrets.api_key, "POST", "/source-resolutions-v3", args);

const handleBlotatoGetSourceStatus: ToolHandler = async (args, _config, secrets) => {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { success: false, output: "", error: "id is required." };
  return blotatoFetch(
    secrets.api_key,
    "GET",
    `/source-resolutions-v3/${encodeURIComponent(id)}`
  );
};

const handleBlotatoListVisualTemplates: ToolHandler = async (
  args,
  _config,
  secrets
) => {
  const fields = typeof args.fields === "string" ? args.fields : "";
  const qs = fields ? `?fields=${encodeURIComponent(fields)}` : "";
  return blotatoFetch(secrets.api_key, "GET", `/videos/templates${qs}`);
};

const handleBlotatoCreateVisual: ToolHandler = async (args, _config, secrets) =>
  blotatoFetch(secrets.api_key, "POST", "/videos/from-templates", args);

const handleBlotatoGetVisualStatus: ToolHandler = async (
  args,
  _config,
  secrets
) => {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { success: false, output: "", error: "id is required." };
  return blotatoFetch(
    secrets.api_key,
    "GET",
    `/videos/creations/${encodeURIComponent(id)}`
  );
};

const handleBlotatoListSchedules: ToolHandler = async (args, _config, secrets) => {
  const params = new URLSearchParams();
  if (typeof args.limit === "number") params.set("limit", String(args.limit));
  if (typeof args.cursor === "string") params.set("cursor", args.cursor);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return blotatoFetch(secrets.api_key, "GET", `/schedules${qs}`);
};

const handleBlotatoGetSchedule: ToolHandler = async (args, _config, secrets) => {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { success: false, output: "", error: "id is required." };
  return blotatoFetch(secrets.api_key, "GET", `/schedules/${encodeURIComponent(id)}`);
};

const handleBlotatoUpdateSchedule: ToolHandler = async (args, _config, secrets) => {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { success: false, output: "", error: "id is required." };
  const patch = args.patch;
  if (!patch) {
    return { success: false, output: "", error: "patch is required." };
  }
  return blotatoFetch(
    secrets.api_key,
    "PATCH",
    `/schedules/${encodeURIComponent(id)}`,
    { patch }
  );
};

const handleBlotatoDeleteSchedule: ToolHandler = async (args, _config, secrets) => {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { success: false, output: "", error: "id is required." };
  return blotatoFetch(
    secrets.api_key,
    "DELETE",
    `/schedules/${encodeURIComponent(id)}`
  );
};

const handleBlotatoListScheduleSlots: ToolHandler = async (
  _args,
  _config,
  secrets
) => blotatoFetch(secrets.api_key, "GET", "/schedule/slots");

const handleBlotatoCreateScheduleSlots: ToolHandler = async (
  args,
  _config,
  secrets
) => blotatoFetch(secrets.api_key, "POST", "/schedule/slots", args);

const handleBlotatoUpdateScheduleSlot: ToolHandler = async (
  args,
  _config,
  secrets
) => {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { success: false, output: "", error: "id is required." };
  const patch = args.patch;
  if (!patch) {
    return { success: false, output: "", error: "patch is required." };
  }
  return blotatoFetch(
    secrets.api_key,
    "PATCH",
    `/schedule/slots/${encodeURIComponent(id)}`,
    { patch }
  );
};

const handleBlotatoDeleteScheduleSlot: ToolHandler = async (
  args,
  _config,
  secrets
) => {
  const id = typeof args.id === "string" ? args.id : "";
  if (!id) return { success: false, output: "", error: "id is required." };
  // Per Blotato spec, the DELETE path here is /schedules/slots/:id (note: schedules plural)
  return blotatoFetch(
    secrets.api_key,
    "DELETE",
    `/schedules/slots/${encodeURIComponent(id)}`
  );
};

const handleBlotatoFindNextAvailableSlot: ToolHandler = async (
  args,
  _config,
  secrets
) => blotatoFetch(secrets.api_key, "POST", "/schedule/slots/next-available", args);

const handleBlotatoCreatePresignedUploadUrl: ToolHandler = async (
  args,
  _config,
  secrets
) => blotatoFetch(secrets.api_key, "POST", "/media/uploads", args);

// ── A-Leads Handlers ──────────────────────────────────────────────
// A-Leads (a-leads.co) is the people + company enrichment + email/phone
// finder used by TRA's Prospect Hunter and other audience-sourcing
// workflows. Auth via x-api-key header. Rate limits 200/min, 600/hour,
// 6000/day shared across all endpoints. Base path is /gateway/v1.

const A_LEADS_BASE = "https://api.a-leads.co/gateway/v1";

async function aLeadsFetch(
  apiKey: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<ToolCallResult> {
  if (!apiKey) {
    return {
      success: false,
      output: "",
      error:
        "A-Leads API key not configured. Go to MCP Servers → A-Leads and paste your API key from the a-leads.co dashboard."
    };
  }
  try {
    const init: RequestInit = {
      method,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      }
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${A_LEADS_BASE}${path}`, init);
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const status = res.status;
      const retryHint =
        status === 429
          ? `Rate-limited (200/min, 600/hour, 6000/day shared). Back off; respect headers if present.`
          : status >= 500
          ? `Server error. Retry with 5-10s backoff up to 3 attempts.`
          : `Permanent error (${status}). Fix the input — DO NOT retry the same request.`;
      return {
        success: false,
        output: "",
        error: `A-Leads API error ${status} on ${method} ${path}: ${text}\n\n${retryHint}`
      };
    }
    return { success: true, output: text || "{}" };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `A-Leads fetch failed on ${method} ${path}: ${
        err instanceof Error ? err.message : "unknown"
      }`
    };
  }
}

const handleALeadsAdvancedSearch: ToolHandler = async (args, _config, secrets) =>
  aLeadsFetch(secrets.api_key, "POST", "/advanced-search", args);

const handleALeadsBulkAdvancedSearch: ToolHandler = async (
  args,
  _config,
  secrets
) => aLeadsFetch(secrets.api_key, "POST", "/bulk-advanced-search", args);

const handleALeadsCompanySearch: ToolHandler = async (args, _config, secrets) =>
  aLeadsFetch(secrets.api_key, "POST", "/company-search", args);

const handleALeadsCompanySearchBulk: ToolHandler = async (
  args,
  _config,
  secrets
) => aLeadsFetch(secrets.api_key, "POST", "/company-search-bulk", args);

const handleALeadsCompanySimilar: ToolHandler = async (args, _config, secrets) =>
  aLeadsFetch(secrets.api_key, "POST", "/company-similar", args);

const handleALeadsFindEmail: ToolHandler = async (args, _config, secrets) =>
  aLeadsFetch(secrets.api_key, "POST", "/find-email", args);

const handleALeadsFindPersonalEmail: ToolHandler = async (
  args,
  _config,
  secrets
) => aLeadsFetch(secrets.api_key, "POST", "/find-email/personal", args);

const handleALeadsFindPhone: ToolHandler = async (args, _config, secrets) =>
  aLeadsFetch(secrets.api_key, "POST", "/find-phone", args);

const handleALeadsVerifyEmail: ToolHandler = async (args, _config, secrets) =>
  aLeadsFetch(secrets.api_key, "POST", "/verify-email", args);

// ── Handler Registry ──────────────────────────────────────────────

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  // Blotato (21)
  blotato_get_user: handleBlotatoGetUser,
  blotato_list_accounts: handleBlotatoListAccounts,
  blotato_list_subaccounts: handleBlotatoListSubaccounts,
  blotato_create_post: handleBlotatoCreatePost,
  blotato_get_post_status: handleBlotatoGetPostStatus,
  blotato_list_posts: handleBlotatoListPosts,
  blotato_create_source: handleBlotatoCreateSource,
  blotato_get_source_status: handleBlotatoGetSourceStatus,
  blotato_list_visual_templates: handleBlotatoListVisualTemplates,
  blotato_create_visual: handleBlotatoCreateVisual,
  blotato_get_visual_status: handleBlotatoGetVisualStatus,
  blotato_list_schedules: handleBlotatoListSchedules,
  blotato_get_schedule: handleBlotatoGetSchedule,
  blotato_update_schedule: handleBlotatoUpdateSchedule,
  blotato_delete_schedule: handleBlotatoDeleteSchedule,
  blotato_list_schedule_slots: handleBlotatoListScheduleSlots,
  blotato_create_schedule_slots: handleBlotatoCreateScheduleSlots,
  blotato_update_schedule_slot: handleBlotatoUpdateScheduleSlot,
  blotato_delete_schedule_slot: handleBlotatoDeleteScheduleSlot,
  blotato_find_next_available_slot: handleBlotatoFindNextAvailableSlot,
  blotato_create_presigned_upload_url: handleBlotatoCreatePresignedUploadUrl,

  // A-Leads (9)
  a_leads_advanced_search: handleALeadsAdvancedSearch,
  a_leads_bulk_advanced_search: handleALeadsBulkAdvancedSearch,
  a_leads_company_search: handleALeadsCompanySearch,
  a_leads_company_search_bulk: handleALeadsCompanySearchBulk,
  a_leads_company_similar: handleALeadsCompanySimilar,
  a_leads_find_email: handleALeadsFindEmail,
  a_leads_find_personal_email: handleALeadsFindPersonalEmail,
  a_leads_find_phone: handleALeadsFindPhone,
  a_leads_verify_email: handleALeadsVerifyEmail,

  // RentCast (6)
  rentcast_search_properties: handleRentcastSearchProperties,
  rentcast_value_estimate: handleRentcastValueEstimate,
  rentcast_rent_estimate: handleRentcastRentEstimate,
  rentcast_sale_listings: handleRentcastSaleListings,
  rentcast_rental_listings: handleRentcastRentalListings,
  rentcast_market_data: handleRentcastMarketData,

  // Axesso Zillow (10)
  axesso_zillow_search_by_location: handleAxessoZillowSearchByLocation,
  axesso_zillow_search_by_url: handleAxessoZillowSearchByUrl,
  axesso_zillow_property_details: handleAxessoZillowPropertyDetails,
  axesso_zillow_zestimate: handleAxessoZillowZestimate,
  axesso_zillow_price_history: handleAxessoZillowPriceHistory,
  axesso_zillow_comparable_homes: handleAxessoZillowComparableHomes,
  axesso_zillow_neighborhood: handleAxessoZillowNeighborhood,
  axesso_zillow_accessibility_scores: handleAxessoZillowAccessibilityScores,
  axesso_zillow_market_trends: handleAxessoZillowMarketTrends,
  axesso_zillow_agent_listings: handleAxessoZillowAgentListings,

  // Realie (7)
  realie_address_lookup: handleRealieAddressLookup,
  realie_location_search: handleRealieLocationSearch,
  realie_property_search: handleRealiePropertySearch,
  realie_owner_search: handleRealieOwnerSearch,
  realie_parcel_lookup: handleRealieParcelLookup,
  realie_comparables_search: handleRealiePremiumComparables,
  realie_premium_owner_search: handleRealiePremiumOwnerSearch,

  // Unified property tools (6)
  property_search: handlePropertySearch,
  property_lookup: handlePropertyLookup,
  property_value_estimate: handlePropertyValueEstimate,
  property_rent_estimate: handlePropertyRentEstimate,
  property_owner_lookup: handlePropertyOwnerLookup,
  property_comps: handlePropertyComps,
  property_distressed_search: handlePropertyDistressedSearch,

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

  // Team Management (built-in)
  delegate_task: handleDelegateTask,
  list_team: handleListTeam,
  check_task_status: handleCheckTaskStatus,

  // Agent Management (built-in)
  suggest_agent_config: handleSuggestAgentConfig,
  create_agent: handleCreateAgent,
  edit_agent: handleEditAgent,
  confirm_create_agent: handleConfirmCreateAgent,
  confirm_edit_agent: handleConfirmEditAgent,

  // Thinking
  think_step_by_step: handleThinkStepByStep,

  // Memory & Learning
  memory_store: handleMemoryStore,
  memory_recall: handleMemoryRecall,
  learn_from_outcome: handleLearnFromOutcome,

  // Master Agent (read-only delegation)
  ask_ceo_agent: handleAskCeoAgent,
  list_businesses: handleListBusinesses,

  // Cross-cutting visibility (leaders + master)
  get_agent_config: handleGetAgentConfig,
  list_integration_health: handleListIntegrationHealth,
  get_business_settings: handleGetBusinessSettings,

  // Telegram outbound
  send_telegram_message: handleSendTelegramMessage,

  // Alternate-approver escalation (operator-fallback for severity=high)
  escalate_to_alternate_approver: handleEscalateToAlternateApprover,

  // Outreach discovery — read-only + draft logging. Posting stays manual
  // for brand safety across every platform.
  reddit_search: handleRedditSearch,
  reddit_thread_scan: handleRedditThreadScan,
  reddit_get_user_posts: handleRedditGetUserPosts,
  verify_reddit_post: handleVerifyRedditPost,
  log_reddit_target: handleLogRedditTarget,
  reddit_create_post: handleRedditCreatePost,
  reddit_reply_to_post: handleRedditReplyToPost,
  instantly_create_campaign: handleInstantlyCreateCampaign,
  instantly_launch_campaign: handleInstantlyLaunchCampaign,
  instantly_pause_campaign: handleInstantlyPauseCampaign,
  instantly_add_leads_to_campaign: handleInstantlyAddLeads,
  instantly_list_campaigns: handleInstantlyListCampaigns,
  instantly_get_campaign_analytics: handleInstantlyCampaignAnalytics,
  instantly_list_replies: handleInstantlyListReplies,
  instantly_send_reply: handleInstantlySendReply,
  whatsapp_send_text_message: handleWhatsappSendText,
  whatsapp_send_template_message: handleWhatsappSendTemplate,
  whatsapp_send_media_message: handleWhatsappSendMedia,
  whatsapp_list_message_templates: handleWhatsappListTemplates,
  whatsapp_submit_message_template: handleWhatsappSubmitTemplate,
  whatsapp_list_conversations: handleWhatsappListConversations,
  whatsapp_mark_as_read: handleWhatsappMarkAsRead,
  prospect_record_source: handleProspectRecordSource,
  prospect_record_qualification: handleProspectRecordQualification,
  prospect_transition: handleProspectTransition,
  prospect_funnel_summary: handleProspectFunnelSummary,
  sendpilot_send_dm: handleSendpilotSendDm,
  sendpilot_send_connection_request: handleSendpilotSendConnectionRequest,
  sendpilot_list_senders: handleSendpilotListSenders,
  sendpilot_list_campaigns: handleSendpilotListCampaigns,
  sendpilot_list_leads: handleSendpilotListLeads,
  sendpilot_update_lead_status: handleSendpilotUpdateLeadStatus,
  slack_outreach_lookup_user_by_email: handleSlackLookupUserByEmail,
  slack_outreach_create_connect_channel: handleSlackCreateConnectChannel,
  slack_outreach_invite_connect_by_email: handleSlackInviteConnectByEmail,
  slack_outreach_post_message: handleSlackPostMessage,
  slack_outreach_list_connect_invites: handleSlackListConnectInvites,
  slack_outreach_log_target: handleSlackLogTarget,
  slack_outreach_handoff_from_email_reply: handleSlackOutreachHandoffFromEmailReply,
  manychat_send_content: handleManychatSendContent,
  manychat_send_flow: handleManychatSendFlow,
  manychat_find_subscriber_by_email: handleManychatFindSubscriberByEmail,
  manychat_get_subscriber_info: handleManychatGetSubscriberInfo,
  manychat_add_tag: handleManychatAddTag,
  manychat_remove_tag: handleManychatRemoveTag,
  manychat_set_custom_field: handleManychatSetCustomField,
  manychat_list_subscribers_by_tag: handleManychatListSubscribersByTag,
  log_outreach_target: handleLogOutreachTarget,
  hn_search: handleHackerNewsSearch,
  hn_thread_scan: handleHackerNewsThreadScan,
  stackoverflow_search: handleStackOverflowSearch,
  github_search_issues: handleGitHubSearchIssues,
  fetch_video_transcript: handleFetchVideoTranscript,
  log_video_clip: handleLogVideoClip,
  log_broll_scene: handleLogBrollScene,
  knowledge_lookup: handleKnowledgeLookup,
  list_knowledge_items: handleListKnowledgeItems,
  get_knowledge_budget: handleGetKnowledgeBudget,
  update_knowledge_tiering: handleUpdateKnowledgeTiering,
  generate_image: handleGenerateImage,
  generate_video: handleGenerateVideo,
  fal_check_generation: handleFalCheckGeneration,
  list_brand_assets: handleListBrandAssets,
  get_brand_asset: handleGetBrandAsset,
  propose_todo: handleProposeTodo,
  list_todos: handleListTodos,
  heygen_list_avatars: handleHeygenListAvatars,
  heygen_generate_video: handleHeygenGenerateVideo,
  heygen_check_video: handleHeygenCheckVideo,
  creatify_list_avatars: handleCreatifyListAvatars,
  creatify_generate_ugc: handleCreatifyGenerateUgc,
  creatify_check_ugc: handleCreatifyCheckUgc,
  auto_clip_submit: handleAutoClipSubmit,
  auto_clip_check: handleAutoClipCheck,
  broll_search: handleBrollSearch,

  // Production pipeline (end-to-end YouTube).
  upload_to_r2: handleUploadToR2,
  list_elevenlabs_voices: handleListElevenlabsVoices,
  generate_voiceover: handleGenerateVoiceover,
  transcribe_audio: handleTranscribeAudio,
  assemble_video: handleAssembleVideo,
  check_video_assembly: handleCheckVideoAssembly,
  youtube_upload_video: handleYoutubeUploadVideo,
  youtube_update_video_metadata: handleYoutubeUpdateVideoMetadata,
  youtube_set_thumbnail: handleYoutubeSetThumbnail,
  youtube_list_channel_videos: handleYoutubeListChannelVideos,
  youtube_post_community_update: handleYoutubePostCommunityUpdate,
  youtube_get_video_analytics: handleYoutubeGetVideoAnalytics,

  // Forex Research & Execution Desk — Phase 2a (read-only data + OANDA).
  // Order placement is not in this phase; tradingMode enforcement happens
  // in Phase 2b when write tools are added.
  forex_quote: handleForexQuote,
  forex_bars: handleForexBars,
  forex_macro_release: handleForexMacroRelease,
  forex_news: handleForexNews,

  // Dealhawk Empire — sourcing tools (auto-attached when business
  // templateId === "dealhawk_empire" via getBuiltInTools).
  dealhawk_search_properties: handleDealhawkSearchProperties,
  dealhawk_create_deal: handleDealhawkCreateDeal,
  dealhawk_score_lead: handleDealhawkScoreLead,
  dealhawk_skip_trace: handleDealhawkSkipTrace,

  // Dealhawk Empire — underwriting tools (Phase 3).
  dealhawk_compute_mao: handleDealhawkComputeMao,
  dealhawk_qualify_sub_to: handleDealhawkQualifySubTo,
  dealhawk_update_deal: handleDealhawkUpdateDeal,

  // Dealhawk Empire — outreach tools (Phase 4).
  dealhawk_draft_outreach: handleDealhawkDraftOutreach,
  dealhawk_log_touch: handleDealhawkLogTouch,
  dealhawk_coach_objection: handleDealhawkCoachObjection,
  dealhawk_schedule_followup: handleDealhawkScheduleFollowup,

  // Dealhawk Empire — disposition + creative finance (Phase 5).
  dealhawk_add_buyer: handleDealhawkAddBuyer,
  dealhawk_list_buyers: handleDealhawkListBuyers,
  dealhawk_match_buyers: handleDealhawkMatchBuyers,
  dealhawk_build_deal_package: handleDealhawkBuildDealPackage,
  dealhawk_design_creative_structure: handleDealhawkDesignCreative,

  // Dealhawk Empire — compliance (Phase 7).
  dealhawk_compliance_check: handleDealhawkComplianceCheck,
  oanda_get_account: handleOandaGetAccount,
  oanda_get_positions: handleOandaGetPositions,
  oanda_get_instrument_pricing: handleOandaGetInstrumentPricing,
  oanda_place_order: handleOandaPlaceOrder,
  oanda_close_position: handleOandaClosePosition,
  oanda_modify_order: handleOandaModifyOrder,
  tradovate_get_account: handleTradovateGetAccount,
  tradovate_get_positions: handleTradovateGetPositions,
  tradovate_place_order: handleTradovatePlaceOrder,

  reddit_post: handleNotImplemented,
  reddit_post_comment: handleNotImplemented,

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

  // Approval gate. Dangerous tools (send_email, social_publish_post, etc.)
  // are short-circuited into an ApprovalRequest unless the business has
  // opted into auto-approval or this call is re-running an already-approved
  // request. The LLM sees the pending-approval message and surfaces it to
  // the operator.
  const gate = await gateToolCall(
    {
      toolName: input.toolName,
      arguments: input.arguments,
      agentId: input.agentId ?? null,
      businessId: input.businessId ?? null,
      organizationId: input.organizationId,
      conversationId: input.conversationId ?? null
    },
    { bypass: input.bypassApprovalGate === true }
  );
  if (!gate.allowed) {
    return {
      success: false,
      output: gate.message,
      error: gate.message
    };
  }

  // Inject agent/business/org context into arguments for memory, learning,
  // and master-agent tools. Also inject the originating conversationId so
  // tools like delegate_task can record where to post the result when the
  // downstream work finishes.
  if (input.agentId || input.businessId || input.organizationId) {
    input.arguments._agentId = input.agentId;
    input.arguments._businessId = input.businessId;
    input.arguments._organizationId = input.organizationId;
  }
  if (input.conversationId) {
    input.arguments._conversationId = input.conversationId;
  }

  const { config, secrets } = await getServerConfig(input.mcpServerId);

  // For tool families that opt into org-scoped integration credentials,
  // layer them onto `secrets` so handlers that read `secrets.api_key`
  // pick them up automatically. The MCP-server-config path still wins
  // when both are set (operator's explicit choice for that server).
  const integrationKey = INTEGRATION_KEY_FOR_TOOL[
    toolFamilyPrefix(input.toolName)
  ];
  if (integrationKey && input.organizationId) {
    const fieldMap = (INTEGRATION_FIELD_MAP as Record<
      string,
      Record<string, string>
    >)[integrationKey];
    if (fieldMap) {
      try {
        const creds = await resolveIntegrationCredentials(
          input.organizationId,
          integrationKey,
          fieldMap
        );
        for (const [k, v] of Object.entries(creds)) {
          if (typeof v === "string" && v.length > 0 && !secrets[k]) {
            secrets[k] = v;
          }
        }
      } catch {
        /* fall through with whatever the MCP server config provided */
      }
    }
  }

  const isDangerous = DANGEROUS_TOOLS.has(input.toolName);
  const startedAt = isDangerous ? Date.now() : 0;

  try {
    const result = await handler(input.arguments, config, secrets);

    // External-action audit log. Every dangerous tool that actually fires
    // (after the approval gate cleared) writes an AuditEvent capturing
    // who/what/when. This is what an operator queries when a customer
    // says "the agent emailed the wrong person yesterday at 3pm." We
    // don't audit reads or internal-state tools — those would drown the
    // table without adding signal.
    if (isDangerous) {
      void writeToolCallAudit({
        toolName: input.toolName,
        arguments: input.arguments,
        result,
        organizationId: input.organizationId,
        agentId: input.agentId ?? null,
        businessId: input.businessId ?? null,
        latencyMs: Date.now() - startedAt
      });
    }

    return result;
  } catch (err) {
    if (isDangerous) {
      void writeToolCallAudit({
        toolName: input.toolName,
        arguments: input.arguments,
        result: {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : "tool threw"
        },
        organizationId: input.organizationId,
        agentId: input.agentId ?? null,
        businessId: input.businessId ?? null,
        latencyMs: Date.now() - startedAt
      });
    }
    return {
      success: false,
      output: "",
      error: `Tool execution error: ${err instanceof Error ? err.message : "Unknown error"}`
    };
  }
}

// ── Audit-log helper ──────────────────────────────────────────────────

/**
 * Persist an AuditEvent for a dangerous tool call. Captures the inbound
 * arguments (sans ephemeral `_*` context keys), a redacted+truncated
 * version of the tool result, and timing. Best-effort: a logging
 * failure never breaks the original tool result.
 *
 * The query path is:
 *   AuditEvent.eventType  = "tool_call.<toolName>"
 *   AuditEvent.entityType = "tool_call"
 *   AuditEvent.entityId   = "<organizationId>:<agentId or '-'>"
 *   AuditEvent.beforeJson = arguments
 *   AuditEvent.afterJson  = { success, output, error, latencyMs }
 */
async function writeToolCallAudit(params: {
  toolName: string;
  arguments: Record<string, unknown>;
  result: ToolCallResult;
  organizationId: string;
  agentId: string | null;
  businessId: string | null;
  latencyMs: number;
}) {
  try {
    const cleanedArgs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params.arguments)) {
      if (k.startsWith("_")) continue;
      cleanedArgs[k] = v;
    }

    // Output can be long (e.g. social_publish full text + URL). Cap it so
    // the audit table doesn't bloat. The full output is also in the
    // ActionRun / ActivityEntry chain when relevant.
    const output = (params.result.output ?? "").toString();
    const truncatedOutput = output.length > 4000 ? `${output.slice(0, 4000)}…` : output;

    await db.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        eventType: `tool_call.${params.toolName}`,
        entityType: "tool_call",
        entityId: `${params.organizationId}:${params.agentId ?? "-"}`,
        beforeJson: cleanedArgs as Prisma.InputJsonValue,
        afterJson: {
          success: params.result.success,
          output: truncatedOutput,
          error: params.result.error ?? null,
          latencyMs: params.latencyMs,
          agentId: params.agentId,
          businessId: params.businessId
        } as Prisma.InputJsonValue
      }
    });
  } catch (err) {
    // Lazy-load to keep the executor's hot path slim.
    const { getLogger } = await import("@/lib/observability/logger");
    getLogger("tool-audit").warn("dropped tool-call audit row", {
      toolName: params.toolName,
      err
    });
  }
}
