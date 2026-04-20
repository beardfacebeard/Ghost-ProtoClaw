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
import { resolveIntegrationCredentials } from "@/lib/integrations/resolve";
import type { InstalledTool } from "@/lib/mcp/tool-registry";

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
    // We need agentId and businessId — passed via executeTool's organizationId context
    // For now, store with the org context and retrieve via search
    await db.agentMemory.create({
      data: {
        agentId: String(args._agentId || "system"),
        businessId: String(args._businessId || "system"),
        type: memoryType,
        content: `[${key}] ${value}`,
        importance: category === "decision" || category === "outcome" || category === "learning" ? 8 : 5,
        tier: "hot",
        metadata: { key, category, originalValue: value } as any
      }
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

// Memory Recall (searches AgentMemory DB table)
const handleMemoryRecall: ToolHandler = async (args) => {
  const query = String(args.query || "").toLowerCase();

  if (!query) {
    return { success: false, output: "", error: "query is required." };
  }

  try {
    const agentId = String(args._agentId || "");
    const businessId = String(args._businessId || "");

    // Search memories by content match
    const memories = await db.agentMemory.findMany({
      where: {
        ...(agentId ? { agentId } : {}),
        ...(businessId ? { businessId } : {}),
        content: { contains: query, mode: "insensitive" as any }
      },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: 10
    });

    if (memories.length === 0) {
      // Try broader search with individual words
      const words = query.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        const broadMemories = await db.agentMemory.findMany({
          where: {
            ...(agentId ? { agentId } : {}),
            ...(businessId ? { businessId } : {}),
            OR: words.map(word => ({
              content: { contains: word, mode: "insensitive" as any }
            }))
          },
          orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
          take: 10
        });

        if (broadMemories.length > 0) {
          const output = broadMemories
            .map((m, i) => `${i + 1}. [${m.type}] ${m.content} (importance: ${m.importance}/10, ${m.createdAt.toLocaleDateString()})`)
            .join("\n");
          return { success: true, output: `🔍 Found ${broadMemories.length} related memories:\n${output}` };
        }
      }

      return { success: true, output: `🔍 No memories found for "${query}". This is a new topic — I'll learn from our conversation and store insights for next time.` };
    }

    const output = memories
      .map((m, i) => `${i + 1}. [${m.type}] ${m.content} (importance: ${m.importance}/10, ${m.createdAt.toLocaleDateString()})`)
      .join("\n");

    return { success: true, output: `🔍 Found ${memories.length} memories for "${query}":\n${output}` };
  } catch {
    return { success: true, output: `🔍 Memory search for "${query}": No stored memories found yet. I'll use conversation history and knowledge base instead.` };
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
    await db.agentMemory.create({
      data: {
        agentId: String(args._agentId || "system"),
        businessId: String(args._businessId || "system"),
        type: "task_outcome",
        content: learningContent,
        importance: 8,
        tier: "hot",
        metadata: { task, outcome, whatWorked, whatDidnt, nextTime, type: "learning" } as any
      }
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
  | "other";

function normalizeOutreachPlatform(value: unknown): OutreachPlatform {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("hacker") || s === "hn") return "hackernews";
  if (s.includes("stack")) return "stackoverflow";
  if (s.includes("github") || s === "gh") return "github";
  if (s.includes("reddit")) return "reddit";
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
  pexels: { api_key: "PEXELS_API_KEY" }
} as const;

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
  "send_telegram_message",
  "reddit_search",
  "reddit_thread_scan",
  "reddit_get_user_posts",
  "verify_reddit_post",
  "log_reddit_target",
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
  "broll_search"
]);

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

  // Telegram outbound
  send_telegram_message: handleSendTelegramMessage,

  // Outreach discovery — read-only + draft logging. Posting stays manual
  // for brand safety across every platform.
  reddit_search: handleRedditSearch,
  reddit_thread_scan: handleRedditThreadScan,
  reddit_get_user_posts: handleRedditGetUserPosts,
  verify_reddit_post: handleVerifyRedditPost,
  log_reddit_target: handleLogRedditTarget,
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
