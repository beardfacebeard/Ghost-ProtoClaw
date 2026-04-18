/**
 * Unified activity stream.
 *
 * Merges three live-ish data sources into a single normalized event shape
 * that the Activity view (Feed, Radar, Neural Map) can consume:
 *
 *   - ActivityEntry — workflow/approval/backup/agent lifecycle events
 *   - ActionRun     — individual agent action executions (pending/running/done)
 *   - Message       — conversation messages, filtered to ones with tool calls
 *
 * All three get flattened into a common event type and sorted by time.
 * Scoped to a single organization via each record's business relation.
 */

import { db } from "@/lib/db";

export type ActivityEventKind =
  | "workflow"
  | "approval"
  | "backup"
  | "integration"
  | "agent"
  | "system"
  | "action_run"
  | "tool_call"
  | "message";

export type ActivityEvent = {
  id: string;
  kind: ActivityEventKind;
  title: string;
  detail: string | null;
  status: string | null;
  businessId: string | null;
  businessName: string | null;
  agentId: string | null;
  agentName: string | null;
  agentEmoji: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type StreamParams = {
  organizationId: string;
  businessIds?: string[];
  businessId?: string;
  agentId?: string;
  kind?: ActivityEventKind;
  since?: Date;
  limit?: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampLimit(limit?: number) {
  if (!limit) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(limit, MAX_LIMIT));
}

/**
 * Query the three source tables in parallel, normalize each row into an
 * ActivityEvent, and return the merged list sorted newest first.
 *
 * The individual queries each pull `limit` rows; the merged list is then
 * trimmed to `limit` after sorting. That over-fetches a little but keeps
 * the ordering correct across sources without complex pagination state.
 */
export async function loadActivityStream(
  params: StreamParams
): Promise<ActivityEvent[]> {
  const limit = clampLimit(params.limit);

  // RBAC scope: either a single businessId, the caller's accessible set, or
  // fall back to the organizationId filter via the business relation.
  const businessFilter = params.businessId
    ? { businessId: params.businessId }
    : params.businessIds
      ? { businessId: { in: params.businessIds } }
      : {
          business: { organizationId: params.organizationId }
        };

  const wantsKind = (kinds: ActivityEventKind[]) =>
    !params.kind || kinds.includes(params.kind);

  const [activityEntries, actionRuns, toolMessages] = await Promise.all([
    wantsKind([
      "workflow",
      "approval",
      "backup",
      "integration",
      "agent",
      "system"
    ])
      ? db.activityEntry.findMany({
          where: {
            ...businessFilter,
            ...(params.since ? { createdAt: { gte: params.since } } : {})
          },
          include: {
            business: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: "desc" },
          take: limit
        })
      : Promise.resolve([]),
    wantsKind(["action_run"])
      ? db.actionRun.findMany({
          where: {
            ...businessFilter,
            ...(params.agentId ? { agentId: params.agentId } : {}),
            ...(params.since ? { createdAt: { gte: params.since } } : {})
          },
          include: {
            business: { select: { id: true, name: true } },
            agent: {
              select: { id: true, displayName: true, emoji: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: limit
        })
      : Promise.resolve([]),
    wantsKind(["tool_call", "message"])
      ? db.message.findMany({
          where: {
            conversation: {
              ...businessFilter,
              ...(params.agentId ? { agentId: params.agentId } : {})
            },
            role: "assistant",
            ...(params.since ? { createdAt: { gte: params.since } } : {})
          },
          include: {
            conversation: {
              select: {
                id: true,
                businessId: true,
                agentId: true,
                channel: true,
                business: { select: { id: true, name: true } },
                agent: {
                  select: { id: true, displayName: true, emoji: true }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: limit
        })
      : Promise.resolve([])
  ]);

  const events: ActivityEvent[] = [];

  for (const entry of activityEntries) {
    events.push({
      id: `activity:${entry.id}`,
      kind: (entry.type as ActivityEventKind) || "system",
      title: entry.title,
      detail: entry.detail,
      status: entry.status,
      businessId: entry.businessId,
      businessName: entry.business?.name ?? null,
      agentId: null,
      agentName: null,
      agentEmoji: null,
      createdAt: entry.createdAt.toISOString(),
      metadata:
        entry.metadata && typeof entry.metadata === "object"
          ? (entry.metadata as Record<string, unknown>)
          : null
    });
  }

  for (const run of actionRuns) {
    const actionLabel = run.action.replace(/_/g, " ");
    // For failed runs we want the error on the list row itself — "Manual run
    // requested by …" is not useful when the user is trying to understand
    // why it failed. Put the error in detail; the original reason still
    // lives in metadata.
    const detail =
      run.status === "failed"
        ? run.error ?? run.reason ?? "Run failed without a recorded error."
        : run.reason ?? run.error ?? null;
    events.push({
      id: `run:${run.id}`,
      kind: "action_run",
      title:
        run.status === "pending"
          ? `Pending: ${actionLabel}`
          : run.status === "running"
            ? `Running: ${actionLabel}`
            : run.status === "completed"
              ? `Completed: ${actionLabel}`
              : run.status === "failed"
                ? `Failed: ${actionLabel}`
                : `${actionLabel} (${run.status})`,
      detail,
      status: run.status,
      businessId: run.businessId,
      businessName: run.business?.name ?? null,
      agentId: run.agentId,
      agentName: run.agent?.displayName ?? null,
      agentEmoji: run.agent?.emoji ?? null,
      createdAt: (run.startedAt ?? run.createdAt).toISOString(),
      metadata: {
        workflowId: run.workflowId,
        completedAt: run.completedAt?.toISOString() ?? null,
        reason: run.reason,
        error: run.error,
        rawResult: run.result
      }
    });
  }

  for (const msg of toolMessages) {
    const meta =
      msg.metadata && typeof msg.metadata === "object" && !Array.isArray(msg.metadata)
        ? (msg.metadata as Record<string, unknown>)
        : null;
    const toolsUsed = Array.isArray(meta?.toolsUsed)
      ? (meta.toolsUsed as string[])
      : [];

    // Skip messages that didn't invoke any tool — for the "tool_call" slice,
    // plain assistant responses are noise. Keep message kind for a future
    // unfiltered view.
    if (toolsUsed.length === 0 && params.kind !== "message") continue;

    const conv = msg.conversation;
    events.push({
      id: `msg:${msg.id}`,
      kind: toolsUsed.length > 0 ? "tool_call" : "message",
      title:
        toolsUsed.length > 0
          ? `Tool call: ${toolsUsed.join(", ")}`
          : "Agent response",
      detail: msg.content.length > 200
        ? msg.content.slice(0, 200) + "…"
        : msg.content,
      status: "completed",
      businessId: conv.businessId,
      businessName: conv.business?.name ?? null,
      agentId: conv.agentId,
      agentName: conv.agent?.displayName ?? null,
      agentEmoji: conv.agent?.emoji ?? null,
      createdAt: msg.createdAt.toISOString(),
      metadata: {
        conversationId: conv.id,
        channel: conv.channel,
        toolsUsed,
        latencyMs: msg.latencyMs,
        model: msg.model
      }
    });
  }

  events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return events.slice(0, limit);
}
