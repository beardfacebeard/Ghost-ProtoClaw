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

  return sections.join("\n\n");
}

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
