import { resolveOpenAiKey } from "@/lib/brain/embeddings";

/**
 * Lightweight LLM pass that takes free-form todo text and returns:
 *   - suggested agent (from the team)
 *   - tags
 *   - extracted due date (if the text mentions one — "Monday", "tomorrow")
 *   - detected recurring pattern (if the text reads like "weekly", "every
 *     Friday", "each morning")
 *   - a cleaner title (if the raw text was a braindump)
 *
 * Called from the create-todo flow + Telegram /todo capture. Graceful
 * degradation: if OpenAI isn't configured we just echo the raw title
 * with no suggestions — the todo still gets created.
 */

export type TodoAutoAssignSuggestion = {
  title: string;
  description: string | null;
  agentId: string | null;
  agentName: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  type: "todo" | "idea";
  tags: string[];
  dueAt: string | null;
  recurringPattern: string | null;
  rationale: string;
};

export type TodoAutoAssignResult =
  | { success: true; suggestion: TodoAutoAssignSuggestion }
  | { success: false; error: string };

const MODEL = "gpt-4o-mini";

type AgentContext = {
  id: string;
  displayName: string;
  role: string;
  purpose?: string | null;
  type?: string | null;
};

export async function autoAssignTodo(params: {
  rawText: string;
  organizationId: string;
  agents: AgentContext[];
  timezone?: string;
  nowIso?: string;
}): Promise<TodoAutoAssignResult> {
  const apiKey = await resolveOpenAiKey(params.organizationId);
  if (!apiKey) {
    return {
      success: false,
      error: "OpenAI not configured — skipping auto-assign."
    };
  }

  const nowIso = params.nowIso ?? new Date().toISOString();
  const timezone = params.timezone ?? "UTC";
  const agentList = params.agents
    .slice(0, 20)
    .map((agent) => {
      const purpose = agent.purpose ? ` — ${agent.purpose.slice(0, 120)}` : "";
      return `- id=${agent.id} | ${agent.displayName} (${agent.role})${purpose}`;
    })
    .join("\n");

  const system = `You are a concise dispatcher. Given a user's free-form todo/idea text, return STRICT JSON with:
- title: a clean 2–10 word title
- description: longer context as a single string, or null if the input is already short
- agentId: one of the ids listed below, or null if no good match
- agentName: the matching displayName, or null
- priority: low | medium | high | urgent (default medium)
- type: "todo" (concrete actionable) or "idea" (fuzzy brain-dump, needs more thought)
- tags: 0–4 short lowercase tags
- dueAt: ISO-8601 string if the user mentioned a date/time, else null
- recurringPattern: plain-English like "weekly", "every Monday", "each morning" — or null if one-off
- rationale: 1 sentence explaining your agent + tier choices

Current time: ${nowIso} (${timezone}).
Team:
${agentList}

Return ONLY JSON. No preamble, no markdown fences.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: params.rawText.trim().slice(0, 2000) }
        ]
      })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        error: `OpenAI ${response.status}: ${text.slice(0, 200)}`
      };
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const agentId =
      typeof parsed.agentId === "string" && parsed.agentId.length > 0
        ? String(parsed.agentId)
        : null;
    const agent = agentId
      ? params.agents.find((a) => a.id === agentId)
      : null;

    const suggestion: TodoAutoAssignSuggestion = {
      title:
        typeof parsed.title === "string" && parsed.title.length > 0
          ? parsed.title.trim()
          : params.rawText.trim().slice(0, 80),
      description:
        typeof parsed.description === "string"
          ? parsed.description.trim() || null
          : null,
      agentId: agent ? agent.id : null,
      agentName: agent ? agent.displayName : null,
      priority: ["low", "medium", "high", "urgent"].includes(
        String(parsed.priority)
      )
        ? (String(parsed.priority) as "low" | "medium" | "high" | "urgent")
        : "medium",
      type: parsed.type === "idea" ? "idea" : "todo",
      tags: Array.isArray(parsed.tags)
        ? (parsed.tags as unknown[])
            .map((t) => String(t).trim().toLowerCase())
            .filter((t) => t.length > 0 && t.length < 30)
            .slice(0, 6)
        : [],
      dueAt:
        typeof parsed.dueAt === "string" && !Number.isNaN(Date.parse(parsed.dueAt))
          ? new Date(parsed.dueAt).toISOString()
          : null,
      recurringPattern:
        typeof parsed.recurringPattern === "string" &&
        parsed.recurringPattern.trim().length > 0
          ? parsed.recurringPattern.trim()
          : null,
      rationale:
        typeof parsed.rationale === "string" ? parsed.rationale.trim() : ""
    };

    return { success: true, suggestion };
  } catch (err) {
    return {
      success: false,
      error: `auto-assign failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}
