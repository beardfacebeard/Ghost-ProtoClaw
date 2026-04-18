/**
 * Master agent — an optional, org-wide agent that can communicate with the
 * per-business CEO agents (type="main") on the user's behalf. It is read-only
 * by design: its toolset is restricted to `ask_ceo_agent` and
 * `list_businesses`, so it can relay questions to CEO agents and surface
 * answers, but it cannot directly execute tools that send, post, or mutate
 * state. When it needs to "do" something, it must ask the relevant CEO agent.
 *
 * The feature turns on the moment an admin clicks "Create Master Agent" in
 * the UI — if a master agent row exists for the org, the feature is live;
 * otherwise the provisioning surface is shown. No env flag required.
 */

import { db } from "@/lib/db";
import type { ChatMessage } from "@/lib/openclaw/client";

export const MASTER_AGENT_TYPE = "master";

/**
 * Feature is always "available" now — the on/off switch is whether a master
 * agent has been provisioned. Kept as a function so existing call sites
 * don't break; returns true unconditionally.
 */
export function isMasterAgentEnabled(): boolean {
  return true;
}

/** Whether a given agent record is the master agent. */
export function isMasterAgent(agent: { type?: string | null } | null | undefined) {
  return agent?.type === MASTER_AGENT_TYPE;
}

/**
 * Look up the master agent for an organization. There is at most one per
 * organization — identified by type="master", businessId=null, and the
 * agent's own organizationId column.
 */
export async function getMasterAgent(organizationId: string) {
  return db.agent.findFirst({
    where: {
      type: MASTER_AGENT_TYPE,
      businessId: null,
      organizationId
    }
  });
}

/**
 * Resolve a CEO (type="main") agent in the given organization by business id
 * or fuzzy business-name match. Returns null if none found.
 */
export async function findCeoAgentForBusiness(
  organizationId: string,
  businessIdOrName: string
) {
  const trimmed = businessIdOrName.trim();
  if (!trimmed) return null;

  // Try by exact business id first.
  const byId = await db.agent.findFirst({
    where: {
      type: "main",
      status: "active",
      business: {
        organizationId,
        id: trimmed
      }
    },
    include: { business: true }
  });
  if (byId) return byId;

  // Fall back to name match on the business.
  return db.agent.findFirst({
    where: {
      type: "main",
      status: "active",
      business: {
        organizationId,
        name: { contains: trimmed, mode: "insensitive" }
      }
    },
    include: { business: true }
  });
}

/**
 * Snapshot of all businesses in the organization along with whether each has
 * an active CEO agent. Returned as plain data the master can format into a
 * response.
 */
export async function listOrganizationBusinesses(organizationId: string) {
  const businesses = await db.business.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      summary: true,
      agents: {
        where: { type: "main", status: "active" },
        select: { id: true, displayName: true, emoji: true, role: true }
      }
    },
    orderBy: { name: "asc" }
  });

  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    summary: b.summary,
    ceo: b.agents[0] ?? null
  }));
}

/**
 * Send a one-shot question to a business's CEO agent and return the text
 * response. Reuses the standard agent-chat execution path so the CEO agent
 * answers with its full system prompt, tools, and memory context.
 *
 * This is the master agent's primary mechanism for getting anything done.
 * The conversation is ephemeral — no persistent ConversationLog is created,
 * so the CEO's main inbox isn't polluted by internal master-agent queries.
 */
export async function askCeoAgent(params: {
  organizationId: string;
  businessIdOrName: string;
  question: string;
  masterAgentDisplayName: string;
}): Promise<{ success: true; response: string; ceoName: string; businessName: string } | { success: false; error: string }> {
  const { organizationId, businessIdOrName, question, masterAgentDisplayName } = params;

  if (!question.trim()) {
    return { success: false, error: "Question is empty." };
  }

  const ceo = await findCeoAgentForBusiness(organizationId, businessIdOrName);

  if (!ceo || !ceo.business) {
    return {
      success: false,
      error: `No active CEO agent found for business "${businessIdOrName}".`
    };
  }

  // Lazy-import executeAgentChat/buildChatMessages to avoid a circular import
  // with agent-chat.ts (which imports tools that reference master-agent).
  const { executeAgentChat, buildChatMessages } = await import(
    "@/lib/llm/agent-chat"
  );

  const framedQuestion =
    `Message from ${masterAgentDisplayName} (master agent):\n\n${question}`;

  const { messages, tools } = await buildChatMessages(
    ceo as Record<string, unknown>,
    ceo.business as Record<string, unknown>,
    [],
    framedQuestion,
    organizationId,
    ceo.businessId
  );

  const result = await executeAgentChat({
    agent: ceo as unknown as Parameters<typeof executeAgentChat>[0]["agent"],
    business: ceo.business as unknown as Parameters<typeof executeAgentChat>[0]["business"],
    messages: messages as ChatMessage[],
    organizationId,
    endpoint: "master_agent_delegation",
    tools
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    response: result.response,
    ceoName: (ceo as { displayName: string }).displayName,
    businessName: (ceo.business as { name: string }).name
  };
}
