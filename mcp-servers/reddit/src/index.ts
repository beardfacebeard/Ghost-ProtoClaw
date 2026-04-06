#!/usr/bin/env node

/**
 * Ghost ProtoClaw — Reddit MCP Server
 *
 * Exposes Reddit read/write capabilities through the Model Context Protocol.
 * Designed to run as a stdio MCP server spawned by Ghost ProtoClaw agents.
 *
 * Required environment variables:
 *   REDDIT_CLIENT_ID
 *   REDDIT_CLIENT_SECRET
 *   REDDIT_USERNAME
 *   REDDIT_PASSWORD
 *
 * Optional:
 *   REDDIT_USER_AGENT
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createRedditClient } from "./reddit-client.js";
import { REDDIT_TOOLS } from "./tools.js";

// ── Config from environment ────────────────────────────────────────

const REQUIRED_ENV = [
  "REDDIT_CLIENT_ID",
  "REDDIT_CLIENT_SECRET",
  "REDDIT_USERNAME",
  "REDDIT_PASSWORD",
] as const;

function loadConfig() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  return {
    clientId: process.env.REDDIT_CLIENT_ID!,
    clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    username: process.env.REDDIT_USERNAME!,
    password: process.env.REDDIT_PASSWORD!,
    userAgent: process.env.REDDIT_USER_AGENT,
  };
}

// ── Bootstrap ──────────────────────────────────────────────────────

async function main() {
  const config = loadConfig();
  createRedditClient(config);

  const server = new McpServer({
    name: "ghost-protoclaw-reddit",
    version: "1.0.0",
  });

  // Register every tool from the tools module
  for (const [name, tool] of Object.entries(REDDIT_TOOLS)) {
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
            error?.message ?? "Unknown Reddit API error";
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
  console.error("Reddit MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting Reddit MCP server:", err);
  process.exit(1);
});
