/**
 * Detector for CEO hallucinations where the agent claims to have delegated
 * or scheduled work without actually invoking the delegate_task tool.
 *
 * The single most common failure mode reported by users: "the CEO says
 * agents are working on it and will report back in a couple hours, five
 * hours later nothing has happened." That's the agent generating text like
 * "I've assigned this to the CMO" without firing the tool that creates a
 * delegated conversation — so the delegation executor has nothing to pick
 * up and the CEO's claim is a pure hallucination.
 *
 * We can't force the LLM to behave. But we CAN post-process its response,
 * detect the claim, and:
 *   1. Write a warning ActivityEntry so the user sees the dishonesty in
 *      Pulse in real-time instead of waiting hours to realize nothing
 *      happened.
 *   2. Stash a high-importance AgentMemory so the next turn's system
 *      prompt includes "previous turn: you claimed to delegate X without
 *      actually calling delegate_task. Call the tool this time or don't
 *      make the claim."
 *
 * False positives are acceptable here (the agent may use the word
 * "delegate" descriptively). The goal is to surface ALL claims of
 * delegation so the user can spot-check. Worst case the user sees a few
 * extra warnings; best case they catch the agent lying.
 */

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const DELEGATION_CLAIM_PATTERNS: RegExp[] = [
  /\b(i'?ll|i\s+will|i'?ve|i\s+have|i'?m\s+going\s+to|i\s+am\s+going\s+to)\s+(delegate|assign|send|forward|task)\s+/i,
  /\b(delegating|assigning|tasking)\s+.+?\s+(to|with)\s+/i,
  /\b(the|our)\s+(\w+\s+)?(team|agents|specialist|ceo|coo|cmo|cfo|cto)\s+(will|is|are|'s|is\s+already|are\s+already)\s+(handle|handling|work|working|investigat|on\s+it|on\s+that)/i,
  /\b(i'?ve|i\s+have)\s+(queued|scheduled|started|kicked\s+off|spun\s+up)\s+/i,
  /\b(results|updates|report|findings|deliverable)s?\s+(in|within|by)\s+(a\s+few|a\s+couple|\d+)\s+(minutes|hours|days)/i,
  /\b(you'?ll|you\s+will|you\s+should)\s+(have|see|get|receive)\s+.+?\s+(in|within|by)\s+/i,
  /\bETA\s*[:\-]?\s*\d+/i
];

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function findClaim(text: string): string | null {
  if (!text) return null;
  for (const pattern of DELEGATION_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

export type DetectFalseDelegationParams = {
  conversationId: string;
  agentId: string;
  businessId: string;
  assistantResponse: string;
  toolsUsed: string[];
};

/**
 * If the agent's response text claims delegation or hands out an ETA but
 * the turn's toolsUsed list doesn't include delegate_task, log the
 * discrepancy to Pulse and write a corrective memory. No-ops when the
 * response looks honest.
 */
export async function detectFalseDelegation(
  params: DetectFalseDelegationParams
): Promise<{ flagged: boolean; claim?: string }> {
  try {
    if (
      params.toolsUsed.includes("delegate_task") ||
      params.toolsUsed.includes("send_telegram_message") ||
      params.toolsUsed.includes("send_email") ||
      params.toolsUsed.includes("social_publish_post")
    ) {
      // Agent actually acted this turn. Even if it also made delegation-
      // like claims, it backed them with real tool calls, so we don't flag.
      return { flagged: false };
    }

    const claim = findClaim(params.assistantResponse);
    if (!claim) return { flagged: false };

    const snippet = claim.length > 200 ? claim.slice(0, 200) + "…" : claim;

    // Log to Pulse.
    try {
      await db.activityEntry.create({
        data: {
          businessId: params.businessId,
          type: "agent",
          title: "Agent claimed work without calling a tool",
          detail:
            `Agent wrote: "${snippet}" but did not call delegate_task, send_email, send_telegram_message, or social_publish_post. ` +
            `This is almost certainly a hallucinated delegation — no downstream agent was actually triggered. ` +
            `Ask the agent to re-do the turn and actually invoke the tool.`,
          status: "warning",
          metadata: {
            agentId: params.agentId,
            conversationId: params.conversationId,
            claim,
            toolsUsed: params.toolsUsed
          }
        }
      });
    } catch {
      /* best-effort */
    }

    // Memory: make the next turn's system prompt include this correction so
    // the model sees its own prior hallucination and is nudged to actually
    // call the tool this time.
    try {
      await db.agentMemory.create({
        data: {
          agentId: params.agentId,
          businessId: params.businessId,
          type: "system_observation",
          content:
            `[hallucination-check] On ${new Date().toISOString()} you told the user "${snippet}" ` +
            `but DID NOT call delegate_task (or any action tool). That claim was false — ` +
            `no downstream agent ran. Next time you intend to delegate, you MUST call ` +
            `delegate_task in the same turn or do not claim to have delegated. If you ` +
            `cannot delegate for any reason (no subordinate, no tool available), say so plainly instead.`,
          importance: 10,
          tier: "hot",
          metadata: toJsonValue({
            source: "false_delegation_check",
            conversationId: params.conversationId,
            claim
          })
        }
      });
    } catch {
      /* best-effort */
    }

    return { flagged: true, claim };
  } catch (err) {
    console.error("[detect-false-delegation] error:", err);
    return { flagged: false };
  }
}
