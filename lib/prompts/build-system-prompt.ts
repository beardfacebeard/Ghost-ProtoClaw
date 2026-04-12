/**
 * System Prompt Builder
 *
 * Assembles a rich, context-aware system prompt for agent runtime by
 * combining the agent's own configuration with the business context.
 *
 * Used by all runtime injection points:
 * - Agent test endpoint
 * - Workflow bridge
 * - Approval forwarding
 *
 * The business fields (summary, brandVoice, mainGoals, coreOffers,
 * guardrails, bannedClaims, offerAndAudienceNotes) are injected so
 * agents actually use the context the user provides during setup.
 */

type BusinessContext = {
  name?: string | null;
  summary?: string | null;
  brandVoice?: string | null;
  mainGoals?: string | null;
  coreOffers?: string | null;
  systemPrompt?: string | null;
  guardrails?: string | null;
  offerAndAudienceNotes?: string | null;
  bannedClaims?: string | null;
  safetyMode?: string | null;
};

type AgentContext = {
  displayName?: string | null;
  role?: string | null;
  purpose?: string | null;
  systemPrompt?: string | null;
  roleInstructions?: string | null;
  outputStyle?: string | null;
  constraints?: string | null;
  escalationRules?: string | null;
  askBeforeDoing?: string | null;
  safetyMode?: string | null;
};

/**
 * Build a complete system prompt for an agent at runtime.
 *
 * Priority order:
 * 1. Agent-level system prompt (most specific)
 * 2. Agent role, purpose, and instructions
 * 3. Business-level context (summary, voice, goals, offers)
 * 4. Business-level guardrails and constraints
 */
export function buildAgentSystemPrompt(
  agent: AgentContext,
  business?: BusinessContext | null
): string {
  const sections: string[] = [];

  // ── AGENT IDENTITY ──────────────────────────────────────────────────
  if (agent.systemPrompt) {
    sections.push(agent.systemPrompt);
  } else {
    // Fall back to structured identity if no custom system prompt
    const identity = [
      agent.displayName ? `You are "${agent.displayName}".` : "",
      agent.role ? `Role: ${agent.role}.` : "",
      agent.purpose ? `Purpose: ${agent.purpose}.` : ""
    ]
      .filter(Boolean)
      .join(" ");

    if (identity) {
      sections.push(identity);
    }
  }

  // ── BUSINESS CONTEXT ────────────────────────────────────────────────
  if (business) {
    const businessParts: string[] = [];

    if (business.name) {
      businessParts.push(`Business: ${business.name}`);
    }
    if (business.summary) {
      businessParts.push(`About: ${business.summary}`);
    }
    if (business.brandVoice) {
      businessParts.push(
        `Brand Voice: ${business.brandVoice} — Always match this tone in all communications.`
      );
    }
    if (business.mainGoals) {
      businessParts.push(
        `Current Goals: ${business.mainGoals} — Prioritize actions that move these forward.`
      );
    }
    if (business.coreOffers) {
      businessParts.push(
        `Core Offers: ${business.coreOffers} — Reference these when discussing products or services.`
      );
    }
    if (business.offerAndAudienceNotes) {
      businessParts.push(
        `Audience & Positioning: ${business.offerAndAudienceNotes}`
      );
    }

    if (businessParts.length > 0) {
      sections.push(
        "── BUSINESS CONTEXT ──\n" + businessParts.join("\n")
      );
    }

    // Business-level system prompt (operator-level instructions)
    if (business.systemPrompt && business.systemPrompt !== agent.systemPrompt) {
      sections.push(
        "── OPERATOR INSTRUCTIONS ──\n" + business.systemPrompt
      );
    }
  }

  // ── AGENT INSTRUCTIONS ──────────────────────────────────────────────
  if (agent.roleInstructions) {
    sections.push(
      "── YOUR INSTRUCTIONS ──\n" + agent.roleInstructions
    );
  }

  if (agent.outputStyle) {
    sections.push(`Output Style: ${agent.outputStyle}`);
  }

  // ── CONSTRAINTS & GUARDRAILS ────────────────────────────────────────
  const guardrailParts: string[] = [];

  if (business?.guardrails) {
    guardrailParts.push(business.guardrails);
  }
  if (agent.constraints) {
    guardrailParts.push(agent.constraints);
  }
  if (business?.bannedClaims) {
    guardrailParts.push(
      `BANNED — Never state, imply, or reference: ${business.bannedClaims}`
    );
  }

  if (guardrailParts.length > 0) {
    sections.push(
      "── GUARDRAILS ──\n" + guardrailParts.join("\n")
    );
  }

  // ── ESCALATION RULES ────────────────────────────────────────────────
  if (agent.escalationRules) {
    sections.push(
      "── ESCALATION RULES ──\n" + agent.escalationRules
    );
  }

  // ── SAFETY MODE ─────────────────────────────────────────────────────
  const safetyMode = agent.safetyMode || business?.safetyMode;
  if (safetyMode) {
    const safetyLabel = SAFETY_MODE_LABELS[safetyMode] ?? safetyMode;
    sections.push(`Safety Mode: ${safetyLabel}`);
  }

  // ── CONTINUOUS LEARNING ─────────────────────────────────────────────
  sections.push(CONTINUOUS_LEARNING_DIRECTIVE);

  return sections.join("\n\n");
}

const CONTINUOUS_LEARNING_DIRECTIVE = `── CONTINUOUS LEARNING ──
You are designed to get smarter and more efficient with every interaction. Follow these learning behaviors:

1. RECALL BEFORE ACTING — Before starting a task you've done before, use memory_recall to check for past learnings, preferences, and outcomes. Apply what worked. Avoid what didn't.

2. LEARN FROM EVERY OUTCOME — After completing a significant task, use learn_from_outcome to record: what the task was, the result, what worked well, what didn't, and what you'd do differently. Be specific — "the curiosity gap hook got 45% completion rate" is useful, "it went well" is not.

3. TRACK PATTERNS — When you notice something working consistently (a format, a phrase, a strategy, a timing), store it as a memory with high importance. When something fails repeatedly, store that too so you stop trying it.

4. ADAPT YOUR APPROACH — If a user corrects you, prefers a different style, or gives feedback, store that preference immediately. Next conversation, recall and apply it without being told again.

5. COMPOUND KNOWLEDGE — Each week you should be measurably better than the previous week. Your memory should grow with insights about what converts, what the audience responds to, what the business priorities are, and what processes are most efficient.

6. SHARE LEARNINGS — When you discover something valuable, make it available to the team. If a content format outperforms others, if a supplier is unreliable, if a compliance rule changed — record it so any agent can recall it.

You have access to these learning tools:
- memory_store: Save any fact, preference, or insight for future recall
- memory_recall: Search your stored memories before acting on familiar tasks
- learn_from_outcome: Structured post-task reflection (task, outcome, what worked, what didn't, next time)

The goal is not just to complete tasks, but to complete them better each time.`;

const SAFETY_MODE_LABELS: Record<string, string> = {
  ask_before_acting:
    "Ask Before Acting — Always get explicit approval before taking actions that are irreversible, public-facing, or involve spending money.",
  auto_low_risk:
    "Auto for Low Risk — Execute routine and low-risk tasks automatically. Ask for approval on anything high-stakes, financial, or public.",
  full_auto:
    "Full Auto — Execute tasks autonomously. Only escalate critical errors, financial decisions, and legal concerns."
};

/**
 * Build a lightweight context string for workflow execution.
 * Includes business context so workflows are grounded in the business.
 */
export function buildWorkflowContext(
  agent: AgentContext | null,
  business: BusinessContext | null
): string {
  const parts: string[] = [];

  if (agent) {
    if (agent.systemPrompt) {
      parts.push(agent.systemPrompt);
    } else {
      const identity = [
        agent.displayName ? `You are "${agent.displayName}".` : "",
        agent.role ? `Role: ${agent.role}.` : "",
        agent.purpose ? `Purpose: ${agent.purpose}.` : ""
      ]
        .filter(Boolean)
        .join(" ");
      if (identity) parts.push(identity);
    }
  }

  if (business) {
    const biz: string[] = [];
    if (business.name) biz.push(`Business: ${business.name}`);
    if (business.summary) biz.push(`About: ${business.summary}`);
    if (business.brandVoice) biz.push(`Brand Voice: ${business.brandVoice}`);
    if (business.mainGoals) biz.push(`Current Goals: ${business.mainGoals}`);
    if (business.coreOffers) biz.push(`Core Offers: ${business.coreOffers}`);
    if (business.guardrails) biz.push(`Guardrails: ${business.guardrails}`);
    if (biz.length > 0) parts.push(biz.join("\n"));
  }

  return parts.join("\n\n");
}
