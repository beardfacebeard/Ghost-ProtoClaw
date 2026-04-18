/**
 * Auto-capture user rejections as agent memories.
 *
 * When a user pushes back on something the agent proposed ("we don't need
 * email automation," "stop suggesting that," "I already told you no"), the
 * correction usually evaporates at the end of the conversation. The agent
 * re-proposes the same idea a day later and the user has to push back
 * again. This module catches those corrections at message time and writes
 * a high-importance AgentMemory for the responding agent so the rejection
 * auto-injects into every future system prompt.
 *
 * The detection is intentionally conservative — false positives would
 * quickly pollute the memory store with irrelevant "rejections." Triggers
 * only when the user's message contains an explicit rejection phrase AND
 * there's a prior assistant turn that proposed something to reject.
 *
 * Called after the assistant turn is saved in the chat message route. Runs
 * asynchronously best-effort; never fails the chat turn.
 */

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { safeEllipsize } from "@/lib/llm/safe-text";

// Regex blobs that indicate a rejection / correction. Kept explicit so a
// casual "we don't want to overdo it" doesn't accidentally trigger — the
// phrases all express direct refusal or annoyance at repeat proposals.
const REJECTION_PATTERNS: RegExp[] = [
  /\b(we|i)\s+don'?t\s+(need|want|use|do)\b/i,
  /\b(we|i)\s+already\s+(said|told\s+you)\b/i,
  /\b(stop|quit)\s+(suggesting|proposing|mentioning|recommending)\b/i,
  /\bnot\s+(needed|interested|going\s+to|required|necessary)\b/i,
  /\bno,\s+(we|i)\s+/i,
  /\bnever(\s+mind)?\b/i,
  /\bthat'?s\s+(not\s+it|wrong|not\s+what\s+(we|i))\b/i,
  /\bdon'?t\s+(do|make|create|build|set\s*up|send)\b/i,
  /\bwe\s+don'?t\s+have\b/i,
  /\bforget\s+(about\s+)?(the|that)\b/i
];

const MIN_RELEVANT_ASSISTANT_LENGTH = 20;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function detectRejection(userMessage: string): boolean {
  if (!userMessage || userMessage.trim().length === 0) return false;
  return REJECTION_PATTERNS.some((pattern) => pattern.test(userMessage));
}

/**
 * Extract a compact subject line from the assistant's prior message so the
 * stored memory is searchable later. Prefers the first full sentence.
 */
function extractSubject(assistantMessage: string): string {
  const trimmed = assistantMessage.trim();
  if (!trimmed) return "";
  // Split on sentence boundaries; take the first sentence as the "what was
  // proposed" subject. Fall back to a hard cut if no punctuation.
  const match = trimmed.match(/^([^.!?\n]{10,220})/);
  const subject = match ? match[1].trim() : trimmed;
  return safeEllipsize(subject, 220);
}

export type CaptureRejectionParams = {
  conversationId: string;
  agentId: string;
  businessId: string;
  userMessage: string;
};

/**
 * If the user message looks like a rejection of the immediately prior
 * assistant turn in the same conversation, store an AgentMemory capturing
 * it. Best-effort — logs and swallows errors; never throws.
 */
export async function captureRejectionIfAny(
  params: CaptureRejectionParams
): Promise<{ captured: boolean; reason?: string }> {
  try {
    if (!detectRejection(params.userMessage)) {
      return { captured: false, reason: "no rejection signal" };
    }

    // Pull the most recent assistant message in this conversation (before
    // the user turn we're processing). We need something to describe WHAT
    // was rejected.
    const priorAssistant = await db.message.findFirst({
      where: {
        conversationId: params.conversationId,
        role: "assistant"
      },
      orderBy: { createdAt: "desc" },
      select: { content: true, createdAt: true }
    });

    if (!priorAssistant || priorAssistant.content.length < MIN_RELEVANT_ASSISTANT_LENGTH) {
      return { captured: false, reason: "no substantive prior assistant turn" };
    }

    const subject = extractSubject(priorAssistant.content);
    if (!subject) return { captured: false, reason: "could not extract subject" };

    const now = new Date();
    const dateLabel = now.toISOString().slice(0, 10);
    const userSnippet = safeEllipsize(params.userMessage.trim(), 220);

    const memoryContent =
      `[rejection ${dateLabel}] User rejected: "${subject}". ` +
      `User's own words: "${userSnippet}". ` +
      `Do NOT re-propose this or equivalent ideas unless the user explicitly asks for it. If asked about it, acknowledge the prior rejection.`;

    await db.agentMemory.create({
      data: {
        agentId: params.agentId,
        businessId: params.businessId,
        type: "learned_preference",
        content: memoryContent,
        importance: 9,
        tier: "hot",
        metadata: toJsonValue({
          source: "rejection_capture",
          conversationId: params.conversationId,
          capturedAt: now.toISOString(),
          priorAssistantAt: priorAssistant.createdAt.toISOString()
        })
      }
    });

    return { captured: true };
  } catch (err) {
    console.error("[capture-rejections] error:", err);
    return { captured: false, reason: "error" };
  }
}
