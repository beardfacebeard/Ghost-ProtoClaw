#!/usr/bin/env node
/**
 * Ghost ProtoClaw — Shared Runtime Server
 *
 * A lightweight Node.js server that acts as an AI runtime for Ghost ProtoClaw.
 * Deploys as Hermes, Codex, or Claude Code depending on RUNTIME_ID env var.
 *
 * Endpoints:
 *   GET  /health              — Health check
 *   POST /v1/chat/completions — OpenAI-compatible chat completion (proxy to OpenRouter)
 *   POST /hooks/agent         — Isolated agent execution (Hermes + OpenClaw style)
 *   POST /execute             — Agent execution (Claude Code style)
 *   POST /orchestrate         — Deep orchestration (Codex style)
 *
 * Env vars:
 *   PORT               — Listen port (default 3000)
 *   API_KEY            — Required Bearer token for auth
 *   OPENROUTER_API_KEY — Required for proxying LLM calls
 *   RUNTIME_ID         — "hermes" | "codex" | "claude-code" (default: "generic")
 *   DEFAULT_MODEL      — Default model if none specified (default: "anthropic/claude-sonnet-4-20250514")
 */

const http = require("http");
const https = require("https");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3000", 10);
const API_KEY = process.env.API_KEY || "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const RUNTIME_ID = process.env.RUNTIME_ID || "generic";
const DEFAULT_MODEL =
  process.env.DEFAULT_MODEL || "anthropic/claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

function authenticate(req) {
  if (!API_KEY) return true; // no key = open (dev mode)
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${API_KEY}`;
}

// ---------------------------------------------------------------------------
// OpenRouter Proxy
// ---------------------------------------------------------------------------

function callOpenRouter(body) {
  return new Promise((resolve, reject) => {
    const providerKey =
      body._providerApiKey || OPENROUTER_KEY;

    if (!providerKey) {
      return resolve({
        success: false,
        error: "No OPENROUTER_API_KEY configured on this runtime.",
      });
    }

    // Clean up internal fields
    const clean = { ...body };
    delete clean._providerApiKey;

    if (!clean.model) {
      clean.model = DEFAULT_MODEL;
    }

    const payload = JSON.stringify(clean);
    const start = Date.now();

    const options = {
      hostname: "openrouter.ai",
      path: "/api/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: `Bearer ${providerKey}`,
        "HTTP-Referer": "https://ghost-protoclaw.app",
        "X-Title": `Ghost-ProtoClaw-${RUNTIME_ID}`,
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const latencyMs = Date.now() - start;
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (res.statusCode >= 400) {
            resolve({
              success: false,
              error: `OpenRouter ${res.statusCode}: ${data?.error?.message || JSON.stringify(data)}`,
              latencyMs,
            });
          } else {
            resolve({ success: true, data, latencyMs });
          }
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse OpenRouter response: ${e.message}`,
            latencyMs,
          });
        }
      });
    });

    req.on("error", (e) =>
      resolve({ success: false, error: e.message, latencyMs: Date.now() - start })
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({
        success: false,
        error: "Request to OpenRouter timed out (60s).",
        latencyMs: 60000,
      });
    });

    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

async function handleHealth(_req, res) {
  jsonResponse(res, 200, {
    status: "ok",
    runtime: RUNTIME_ID,
    timestamp: new Date().toISOString(),
    configured: Boolean(OPENROUTER_KEY),
  });
}

async function handleChatCompletion(req, res) {
  const body = await readBody(req);
  if (!body || !body.messages) {
    return jsonResponse(res, 400, { error: "messages field is required" });
  }

  // Pass through provider key if supplied
  const providerKey = req.headers["x-provider-api-key"];
  if (providerKey) {
    body._providerApiKey = providerKey;
  }

  const result = await callOpenRouter(body);

  if (!result.success) {
    return jsonResponse(res, 502, {
      error: { message: result.error },
      latencyMs: result.latencyMs,
    });
  }

  // Return OpenAI-compatible response
  jsonResponse(res, 200, result.data);
}

async function handleHookAgent(req, res) {
  const body = await readBody(req);
  if (!body || !body.message) {
    return jsonResponse(res, 400, { error: "message field is required" });
  }

  // Convert hook format to chat completion
  const messages = [
    {
      role: "system",
      content:
        "You are an AI agent executing a specific task. Complete the task described in the user message. Be concise and action-oriented.",
    },
    { role: "user", content: body.message },
  ];

  const chatBody = {
    model: body.model || DEFAULT_MODEL,
    messages,
  };

  const providerKey = req.headers["x-provider-api-key"];
  if (providerKey) {
    chatBody._providerApiKey = providerKey;
  }

  const result = await callOpenRouter(chatBody);

  if (!result.success) {
    return jsonResponse(res, 502, {
      success: false,
      error: result.error,
      latencyMs: result.latencyMs,
    });
  }

  const content =
    result.data?.choices?.[0]?.message?.content || "No response generated.";

  jsonResponse(res, 200, {
    success: true,
    content,
    model: result.data?.model || DEFAULT_MODEL,
    latencyMs: result.latencyMs,
  });
}

// Codex-specific orchestration endpoint
async function handleOrchestrate(req, res) {
  const body = await readBody(req);
  if (!body || !body.message) {
    return jsonResponse(res, 400, { error: "message field is required" });
  }

  const messages = [
    {
      role: "system",
      content:
        "You are a code-focused AI agent performing orchestrated development tasks. Analyze the request, break it into steps, and provide detailed technical output. Include code snippets when relevant.",
    },
    { role: "user", content: body.message },
  ];

  const chatBody = {
    model: body.model || DEFAULT_MODEL,
    messages,
  };

  const providerKey = req.headers["x-provider-api-key"];
  if (providerKey) {
    chatBody._providerApiKey = providerKey;
  }

  const result = await callOpenRouter(chatBody);

  if (!result.success) {
    return jsonResponse(res, 502, {
      success: false,
      error: result.error,
      latencyMs: result.latencyMs,
    });
  }

  const content =
    result.data?.choices?.[0]?.message?.content || "No response generated.";

  jsonResponse(res, 200, {
    success: true,
    content,
    model: result.data?.model || DEFAULT_MODEL,
    latencyMs: result.latencyMs,
  });
}

// Claude Code execution endpoint
async function handleExecute(req, res) {
  const body = await readBody(req);
  if (!body || !body.message) {
    return jsonResponse(res, 400, { error: "message field is required" });
  }

  const messages = [
    {
      role: "system",
      content:
        "You are Claude Code, an AI agent specialized in code execution, analysis, and multi-step reasoning. Execute the task described, provide detailed results, and include any artifacts or code produced.",
    },
    { role: "user", content: body.message },
  ];

  const chatBody = {
    model: body.model || "anthropic/claude-sonnet-4-20250514",
    messages,
  };

  const providerKey = req.headers["x-provider-api-key"];
  if (providerKey) {
    chatBody._providerApiKey = providerKey;
  }

  const result = await callOpenRouter(chatBody);

  if (!result.success) {
    return jsonResponse(res, 502, {
      success: false,
      error: result.error,
      latencyMs: result.latencyMs,
    });
  }

  const content =
    result.data?.choices?.[0]?.message?.content || "No response generated.";

  jsonResponse(res, 200, {
    success: true,
    content,
    model: result.data?.model || "anthropic/claude-sonnet-4-20250514",
    latencyMs: result.latencyMs,
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const method = req.method;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Health check is always open
  if (path === "/health" && method === "GET") {
    return handleHealth(req, res);
  }

  // All other endpoints require auth
  if (!authenticate(req)) {
    return jsonResponse(res, 401, { error: "Unauthorized" });
  }

  if (path === "/v1/chat/completions" && method === "POST") {
    return handleChatCompletion(req, res);
  }

  if (path === "/hooks/agent" && method === "POST") {
    return handleHookAgent(req, res);
  }

  if (path === "/orchestrate" && method === "POST") {
    return handleOrchestrate(req, res);
  }

  if (path === "/execute" && method === "POST") {
    return handleExecute(req, res);
  }

  // Fallback
  jsonResponse(res, 404, {
    error: "Not found",
    availableEndpoints: [
      "GET /health",
      "POST /v1/chat/completions",
      "POST /hooks/agent",
      "POST /orchestrate",
      "POST /execute",
    ],
  });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    console.error(`[${RUNTIME_ID}] Unhandled error:`, err);
    jsonResponse(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${RUNTIME_ID}] Runtime server listening on port ${PORT}`);
  console.log(`[${RUNTIME_ID}] OpenRouter key: ${OPENROUTER_KEY ? "configured" : "MISSING"}`);
  console.log(`[${RUNTIME_ID}] API key auth: ${API_KEY ? "enabled" : "disabled (open)"}`);
  console.log(`[${RUNTIME_ID}] Default model: ${DEFAULT_MODEL}`);
});
