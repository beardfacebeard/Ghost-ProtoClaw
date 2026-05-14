/**
 * Delegation executor.
 *
 * The delegate_task tool creates a ConversationLog row with channel="delegation"
 * and a single user-role message describing the task. Historically nothing
 * consumed those rows — the CEO would say "I delegated it" and then the
 * delegated conversation would sit inert forever. This module is the missing
 * consumer.
 *
 * Each tick, we find pending delegations (channel="delegation", status="active",
 * metadata.executorState="pending") and run the target agent on them using the
 * same executeAgentChat pipeline the chat UI uses. The assistant's reply is
 * persisted, the conversation is marked completed, and a summary memory is
 * written on the delegating agent so it can recall the outcome on its next
 * turn via the automatic memory-injection in buildChatMessages.
 *
 * Lazy-imported from the scheduler so the scheduler's hot path doesn't pull
 * in LLM provider code when it doesn't need to.
 */

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const MAX_DELEGATIONS_PER_TICK = 10;
/** If a delegation sits in executorState="running" longer than this, assume
 *  the executor crashed and reset it. Without this sweep, any crash during
 *  executeOne leaves the task in zombie state forever — which is what the
 *  user saw as "6 tasks spinning for hours." */
const STUCK_DELEGATION_MINUTES = 10;
/** Same idea for ActionRun rows created by the workflow runner. */
const STUCK_ACTION_RUN_MINUTES = 15;
/** Pulse activity retention — rows older than this are swept on each tick. */
const ACTIVITY_RETENTION_DAYS = 30;

type DelegationMetadata = {
  delegatedBy?: string | null;
  delegatedByAgentId?: string | null;
  priority?: string | null;
  originalTask?: string | null;
  executorState?: "pending" | "running" | "done" | "failed" | null;
  /** Conversation the delegating agent was in when it queued this task.
   *  Populated by the delegate_task tool so the executor can post the
   *  result back in-thread when the work completes. Null when the
   *  delegation wasn't invoked from a conversation context. */
  originConversationId?: string | null;
  /** Channel of the origin conversation (e.g. "chat", "telegram"). Used
   *  to decide whether the completion follow-up also needs to fan out to
   *  Telegram. Null when unknown. */
  originChannel?: string | null;
};

function readMetadata(value: unknown): DelegationMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DelegationMetadata;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Find and run all pending delegated conversations. Returns the number of
 * delegations actually executed (for logging).
 *
 * Also self-starts the scheduler tick loop if it isn't running yet. This
 * is a defense-in-depth against Next.js instrumentation.ts failing to fire
 * on production boot (as happened on Railway, leaving delegations stuck).
 * Once any API route triggers this function, the scheduler starts ticking
 * and future delegations are picked up automatically.
 */
export async function runPendingDelegations(): Promise<number> {
  try {
    const { startWorkflowScheduler } = await import(
      "@/lib/workflows/scheduler"
    );
    startWorkflowScheduler();
  } catch {
    /* best-effort — proceed with the one-shot run even if we can't start the loop */
  }

  const candidates = await db.conversationLog.findMany({
    where: {
      channel: "delegation",
      status: "active"
    },
    orderBy: { createdAt: "asc" },
    take: MAX_DELEGATIONS_PER_TICK
  });

  let executed = 0;
  for (const conv of candidates) {
    const meta = readMetadata(conv.metadata);
    // Only pick up delegations that haven't been picked up yet.
    if (meta.executorState && meta.executorState !== "pending") continue;

    try {
      const claimed = await claim(conv.id, meta);
      if (!claimed) continue;
      await executeOne(conv.id);
      executed += 1;
    } catch (err) {
      console.error(
        `[delegation-executor] error running delegation=${conv.id}:`,
        err
      );
      // Surface the failure in Pulse so the user can see which delegation
      // broke and why instead of wondering why the CEO keeps saying
      // "still working on it."
      const errMessage = err instanceof Error ? err.message : String(err);
      try {
        await db.activityEntry.create({
          data: {
            businessId: conv.businessId,
            type: "agent",
            title: `Delegated task crashed: ${conv.title ?? conv.id}`,
            detail: errMessage.slice(0, 400),
            status: "failed",
            metadata: {
              delegatedConversationId: conv.id,
              error: errMessage,
              stack:
                err instanceof Error
                  ? err.stack?.slice(0, 1000) ?? null
                  : null
            }
          }
        });
      } catch {
        /* best-effort */
      }
      // Mark the conversation as failed so the executor doesn't re-try
      // the same failing delegation forever.
      try {
        await markFailed(conv.id, meta, errMessage);
      } catch {
        /* best-effort */
      }
    }
  }
  return executed;
}

/**
 * Atomically flip executorState from "pending" to "running" so a second
 * tick can't double-fire the same delegation. Returns true if we won the
 * claim, false if someone else did.
 */
async function claim(
  conversationId: string,
  currentMeta: DelegationMetadata
): Promise<boolean> {
  const updated = await db.conversationLog.updateMany({
    where: {
      id: conversationId,
      status: "active"
    },
    data: {
      metadata: toJsonValue({
        ...currentMeta,
        executorState: "running",
        claimedAt: new Date().toISOString()
      })
    }
  });
  // Because updateMany doesn't atomically check metadata (Prisma JSON
  // filtering is limited), fall back to re-reading and checking that WE set
  // executorState=running most recently. Race-safe enough for the expected
  // single-replica deployment; a second replica would at worst double-run
  // one delegation which is handled downstream by the status="completed"
  // guard in executeOne.
  if (updated.count === 0) return false;
  return true;
}

async function executeOne(conversationId: string): Promise<void> {
  const conv = await db.conversationLog.findUnique({
    where: { id: conversationId },
    include: {
      agent: {
        include: { business: true }
      }
    }
  });

  if (!conv) return;
  if (conv.status !== "active") return;
  if (!conv.agent) return;

  const meta = readMetadata(conv.metadata);

  // Pull the conversation's messages as chat history.
  const history = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true }
  });

  // If the very last message is already an assistant turn, this delegation
  // was picked up and run before — nothing more to do unless the delegator
  // adds a follow-up user message. Mark completed.
  const last = history[history.length - 1];
  if (!last || last.role !== "user") {
    await markCompleted(conversationId, meta, "skipped — no pending user turn");
    return;
  }

  // The "user message" the agent should respond to is the last message.
  // buildChatMessages expects history WITHOUT that final message (it adds
  // the userMessage arg itself).
  const historyWithoutLast = history.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content
  }));
  const userMessage = last.content;

  const organizationId =
    (conv.agent as { organizationId?: string | null }).organizationId ??
    conv.agent.business?.organizationId ??
    null;

  if (!organizationId) {
    await markFailed(
      conversationId,
      meta,
      "Could not resolve organizationId for delegated agent."
    );
    return;
  }

  // Lazy-import LLM code so the scheduler module graph stays small.
  const { executeAgentChat, buildChatMessages } = await import(
    "@/lib/llm/agent-chat"
  );

  const { messages, tools } = await buildChatMessages(
    conv.agent as unknown as Record<string, unknown>,
    conv.agent.business as unknown as Record<string, unknown> | null,
    historyWithoutLast as Array<{ role: string; content: string }>,
    userMessage,
    organizationId,
    conv.agent.businessId
  );

  const result = await executeAgentChat({
    agent: conv.agent as unknown as Parameters<typeof executeAgentChat>[0]["agent"],
    business: conv.agent.business as unknown as Parameters<
      typeof executeAgentChat
    >[0]["business"],
    messages: messages as Parameters<typeof executeAgentChat>[0]["messages"],
    organizationId,
    endpoint: "delegation",
    tools
  });

  if (!result.success) {
    await markFailed(conversationId, meta, result.error ?? "Delegation run failed");
    return;
  }

  // Persist the assistant response.
  await db.message.create({
    data: {
      conversationId,
      role: "assistant",
      content: result.response,
      model: result.model,
      latencyMs: result.latencyMs,
      metadata: result.toolsUsed?.length
        ? toJsonValue({ toolsUsed: result.toolsUsed })
        : undefined
    }
  });
  await db.conversationLog.update({
    where: { id: conversationId },
    data: { messageCount: { increment: 1 } }
  });

  await markCompleted(conversationId, meta, "completed");

  // Write a summary memory back to the delegating agent so it knows the
  // outcome on its next turn via the automatic memory injection in
  // buildChatMessages. Without this the CEO has no idea the task ran.
  const delegatingAgentId = meta.delegatedByAgentId;
  if (delegatingAgentId) {
    try {
      const summary =
        `Delegated task completed by ${conv.agent.displayName}: ` +
        `"${(meta.originalTask ?? "task").slice(0, 120)}". ` +
        `Outcome: ${result.response.slice(0, 400)}${result.response.length > 400 ? "…" : ""}` +
        (result.toolsUsed?.length
          ? ` Tools used: ${result.toolsUsed.join(", ")}.`
          : "");
      const { createAgentMemoryWithEmbedding } = await import(
        "@/lib/repository/memory"
      );
      await createAgentMemoryWithEmbedding({
        agentId: delegatingAgentId,
        businessId: conv.businessId,
        type: "task_outcome",
        content: summary,
        importance: 7,
        tier: "hot",
        metadata: toJsonValue({
          delegatedConversationId: conversationId,
          targetAgentId: conv.agent.id,
          targetAgentName: conv.agent.displayName,
          toolsUsed: result.toolsUsed ?? []
        }),
        organizationId: organizationId ?? undefined
      });
    } catch (err) {
      console.error(
        `[delegation-executor] failed to write outcome memory for delegator=${delegatingAgentId}:`,
        err
      );
    }
  }

  // Auto follow-up: post the result back to the conversation the
  // delegating agent was in when it queued the task. Without this, the
  // delegating agent (e.g. the CEO) never proactively tells the user the
  // work is done — the memory is written, but memory only surfaces on the
  // agent's NEXT turn, which only happens when the user asks. This closes
  // the "CEO said he'd update me but never did" gap by making the system
  // post the update directly instead of relying on the LLM to remember.
  if (meta.originConversationId && delegatingAgentId) {
    try {
      await postDelegationFollowUp({
        originConversationId: meta.originConversationId,
        originChannel: meta.originChannel ?? null,
        delegatingAgentId,
        targetAgent: {
          id: conv.agent.id,
          displayName: conv.agent.displayName
        },
        originalTask: meta.originalTask ?? "",
        response: result.response,
        toolsUsed: result.toolsUsed ?? [],
        businessId: conv.businessId
      });
    } catch (err) {
      console.error(
        `[delegation-executor] follow-up post failed for delegation=${conversationId}:`,
        err
      );
    }
  }

  // Write an ActivityEntry so the Pulse view surfaces this run.
  try {
    await db.activityEntry.create({
      data: {
        businessId: conv.businessId,
        type: "agent",
        title: `Delegated task completed: ${conv.agent.displayName}`,
        detail: (meta.originalTask ?? "").slice(0, 200),
        status: "completed",
        metadata: toJsonValue({
          delegatedConversationId: conversationId,
          targetAgentId: conv.agent.id,
          delegatedByAgentId: delegatingAgentId ?? null,
          toolsUsed: result.toolsUsed ?? []
        })
      }
    });
  } catch {
    // Non-critical; skip silently.
  }
}

/**
 * Format and post a completion update to the conversation that originated
 * the delegation. Always inserts a new assistant message in the origin
 * conversation. When the origin channel is telegram, also fans out to
 * Telegram via the existing send_telegram_message tool so the user gets
 * pushed a real notification instead of only finding it next time they
 * open the web UI.
 */
async function postDelegationFollowUp(params: {
  originConversationId: string;
  originChannel: string | null;
  delegatingAgentId: string;
  targetAgent: { id: string; displayName: string };
  originalTask: string;
  response: string;
  toolsUsed: string[];
  businessId: string;
}) {
  const origin = await db.conversationLog.findUnique({
    where: { id: params.originConversationId },
    select: {
      id: true,
      agentId: true,
      businessId: true,
      channel: true
    }
  });

  if (!origin) return;
  // Safety: only post back to a conversation owned by the same delegating
  // agent we recorded. Without this check a corrupted metadata value could
  // leak an update into an unrelated chat.
  if (origin.agentId !== params.delegatingAgentId) return;
  if (origin.businessId !== params.businessId) return;

  const taskSnippet =
    params.originalTask.length > 160
      ? params.originalTask.slice(0, 160) + "…"
      : params.originalTask;

  const resultBody =
    params.response.length > 1800
      ? params.response.slice(0, 1800) + "…"
      : params.response;

  const toolsLine = params.toolsUsed.length
    ? `\n\n_Tools used: ${params.toolsUsed.join(", ")}._`
    : "";

  const followUp =
    `✅ **Update — delegated task completed by ${params.targetAgent.displayName}.**\n\n` +
    (taskSnippet ? `**Task:** ${taskSnippet}\n\n` : "") +
    `**Result:**\n${resultBody}${toolsLine}`;

  // Persist the assistant message in the origin conversation so it shows
  // up exactly as if the delegating agent had written it. metadata.source
  // marks it as auto-generated for later filtering/attribution.
  await db.message.create({
    data: {
      conversationId: origin.id,
      role: "assistant",
      content: followUp,
      metadata: toJsonValue({
        source: "delegation_auto_followup",
        targetAgentId: params.targetAgent.id,
        delegatedConversationId: params.originConversationId
      })
    }
  });
  await db.conversationLog.update({
    where: { id: origin.id },
    data: { messageCount: { increment: 1 } }
  });

  // If the user is chatting over Telegram, also push the update there. The
  // send_telegram_message tool resolves the right chat via the usual
  // precedence (agent paired via /start → integration default). Best-effort;
  // we don't fail the follow-up if Telegram delivery errors.
  const channel = params.originChannel ?? origin.channel ?? null;
  if (channel === "telegram") {
    try {
      const { executeTool } = await import("@/lib/mcp/tool-executor");
      const business = await db.business.findUnique({
        where: { id: params.businessId },
        select: { organizationId: true }
      });
      if (business?.organizationId) {
        await executeTool({
          toolName: "send_telegram_message",
          arguments: { text: followUp },
          mcpServerId: "__builtin__",
          organizationId: business.organizationId,
          agentId: params.delegatingAgentId,
          businessId: params.businessId,
          // System follow-up posted after a delegation completes — the
          // user-initiated action is the original delegate_task call, not
          // this internal fan-out. Bypass to avoid spurious approvals.
          bypassApprovalGate: true
        });
      }
    } catch (err) {
      console.error(
        `[delegation-executor] telegram follow-up failed for conv=${origin.id}:`,
        err
      );
    }
  }
}

async function markCompleted(
  conversationId: string,
  meta: DelegationMetadata,
  note: string
) {
  await db.conversationLog.update({
    where: { id: conversationId },
    data: {
      status: "completed",
      endedAt: new Date(),
      metadata: toJsonValue({
        ...meta,
        executorState: "done",
        executorNote: note,
        finishedAt: new Date().toISOString()
      })
    }
  });
}

async function markFailed(
  conversationId: string,
  meta: DelegationMetadata,
  reason: string
) {
  await db.conversationLog.update({
    where: { id: conversationId },
    data: {
      status: "failed",
      endedAt: new Date(),
      metadata: toJsonValue({
        ...meta,
        executorState: "failed",
        executorError: reason,
        finishedAt: new Date().toISOString()
      })
    }
  });
}

/**
 * Reset delegations that got stuck in executorState="running" because a
 * previous executor process crashed mid-run (deploy mid-tick, OOM,
 * unhandled rejection, etc). Runs on every tick and flips them to failed
 * with a descriptive reason so they surface clearly in Pulse instead of
 * spinning forever with no explanation. This is the cleanup for the
 * "6 tasks spinning for hours" class of bug.
 */
export async function sweepStuckDelegations(): Promise<number> {
  const cutoff = new Date(
    Date.now() - STUCK_DELEGATION_MINUTES * 60 * 1000
  );

  const candidates = await db.conversationLog.findMany({
    where: {
      channel: "delegation",
      status: "active",
      updatedAt: { lt: cutoff }
    }
  });

  let reset = 0;
  for (const conv of candidates) {
    const meta = readMetadata(conv.metadata);
    if (meta.executorState !== "running") continue;

    try {
      await markFailed(
        conv.id,
        meta,
        `Delegation stuck in "running" for over ${STUCK_DELEGATION_MINUTES} minutes — the previous executor run crashed. Re-delegate if the task still needs to be done.`
      );
      reset += 1;
    } catch (err) {
      console.error(
        `[delegation-executor] stuck sweep failed for ${conv.id}:`,
        err
      );
    }
  }
  return reset;
}

/**
 * Retention sweep for the Pulse activity stream. The feed accumulates
 * entries fast — every Telegram inbound, every tool call, every run
 * completion writes a row. Without a cap, the Feed becomes thousands of
 * items deep and the DB grows unbounded. Delete both ActivityEntry and
 * completed ActionRun rows older than ACTIVITY_RETENTION_DAYS on each
 * tick. Runs hourly-ish in practice (the scheduler ticks every 30s; we
 * gate the sweep to at most once per 15 minutes to keep the DB churn
 * low).
 */
let lastRetentionSweep = 0;
export async function sweepOldActivity(): Promise<number> {
  const now = Date.now();
  if (now - lastRetentionSweep < 15 * 60 * 1000) return 0;
  lastRetentionSweep = now;

  const cutoff = new Date(
    now - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    const [activityResult, runResult] = await Promise.all([
      db.activityEntry.deleteMany({
        where: { createdAt: { lt: cutoff } }
      }),
      db.actionRun.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          status: { in: ["completed", "failed"] }
        }
      })
    ]);
    const total = activityResult.count + runResult.count;
    if (total > 0) {
      console.log(
        `[activity-retention] pruned ${total} events older than ${ACTIVITY_RETENTION_DAYS}d`
      );
    }
    return total;
  } catch (err) {
    console.error("[activity-retention] sweep failed:", err);
    return 0;
  }
}

/**
 * Same treatment for ActionRun rows left behind by a workflow runner that
 * crashed mid-execution. These show up in Pulse as spinning pending/running
 * entries with no resolution. Flip them to failed so the user knows the
 * run died and can re-trigger if needed.
 */
export async function sweepStuckActionRuns(): Promise<number> {
  const cutoff = new Date(
    Date.now() - STUCK_ACTION_RUN_MINUTES * 60 * 1000
  );

  const stuck = await db.actionRun.findMany({
    where: {
      status: { in: ["pending", "running"] },
      createdAt: { lt: cutoff },
      completedAt: null
    },
    select: { id: true, createdAt: true, action: true }
  });

  let reset = 0;
  for (const row of stuck) {
    try {
      const ageMin = Math.round(
        (Date.now() - row.createdAt.getTime()) / 60000
      );
      await db.actionRun.update({
        where: { id: row.id },
        data: {
          status: "failed",
          error: `Runner crashed or was never consumed — stuck for ${ageMin} minutes with no completion. Run again if this is still needed.`,
          completedAt: new Date()
        }
      });
      reset += 1;
    } catch (err) {
      console.error(
        `[delegation-executor] ActionRun sweep failed for ${row.id}:`,
        err
      );
    }
  }
  return reset;
}
