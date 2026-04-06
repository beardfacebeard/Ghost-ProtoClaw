#!/usr/bin/env node

/**
 * Ghost ProtoClaw — Social Media Hub MCP Server
 *
 * Unified social media publishing via Late (getlate.dev) or Ayrshare.
 * Supports TikTok, LinkedIn, Reddit, Twitter/X, Facebook, Instagram, and more.
 *
 * Required environment variables:
 *   SOCIAL_PROVIDER    — "late" or "ayrshare"
 *   SOCIAL_API_KEY     — API key for the chosen provider
 *
 * Optional:
 *   SOCIAL_PROFILE_KEY — Profile key for multi-profile plans
 *   SOCIAL_PLATFORMS   — Comma-separated allowed platforms (default: all)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { LateProvider, AyrshareProvider } from "./providers/index.js";
import type { SocialProvider } from "./providers/index.js";
import { buildTools } from "./tools.js";

// ── Config from environment ────────────────────────────────────────

function loadConfig() {
  const provider = process.env.SOCIAL_PROVIDER?.toLowerCase();
  const apiKey = process.env.SOCIAL_API_KEY;

  if (!provider || !apiKey) {
    console.error(
      "Missing required env vars: SOCIAL_PROVIDER and SOCIAL_API_KEY"
    );
    process.exit(1);
  }

  if (provider !== "late" && provider !== "ayrshare") {
    console.error(
      `Invalid SOCIAL_PROVIDER "${provider}". Use "late" or "ayrshare".`
    );
    process.exit(1);
  }

  return {
    provider: provider as "late" | "ayrshare",
    apiKey,
    profileKey: process.env.SOCIAL_PROFILE_KEY || undefined,
    platforms: process.env.SOCIAL_PLATFORMS
      ? process.env.SOCIAL_PLATFORMS.split(",").map((p) => p.trim())
      : undefined,
  };
}

// ── Bootstrap ──────────────────────────────────────────────────────

async function main() {
  const config = loadConfig();

  // Create the appropriate provider
  let socialProvider: SocialProvider;
  if (config.provider === "late") {
    socialProvider = new LateProvider(config.apiKey, config.profileKey);
  } else {
    socialProvider = new AyrshareProvider(config.apiKey, config.profileKey);
  }

  const server = new McpServer({
    name: "ghost-protoclaw-social-media",
    version: "1.0.0",
  });

  // Register all tools
  const tools = buildTools(socialProvider);

  for (const [name, tool] of Object.entries(tools)) {
    server.tool(
      name,
      tool.description,
      tool.schema.shape,
      async (args: any) => {
        try {
          const result = await tool.handler(args);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error: any) {
          const message =
            error?.message ?? "Unknown social media API error";
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: message }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Social Media Hub MCP server running (provider: ${config.provider})`
  );
}

main().catch((err) => {
  console.error("Fatal error starting Social Media Hub MCP server:", err);
  process.exit(1);
});
