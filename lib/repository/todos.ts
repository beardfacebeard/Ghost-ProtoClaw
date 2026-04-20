import { Prisma, type Todo } from "@prisma/client";

import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

export type TodoType = "idea" | "todo";
export type TodoStatus =
  | "captured"
  | "active"
  | "snoozed"
  | "done"
  | "dismissed";
export type TodoPriority = "low" | "medium" | "high" | "urgent";

type AuditContext = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeStatus(value: unknown): TodoStatus {
  const allowed: TodoStatus[] = [
    "captured",
    "active",
    "snoozed",
    "done",
    "dismissed"
  ];
  return allowed.includes(value as TodoStatus)
    ? (value as TodoStatus)
    : "captured";
}

function normalizeType(value: unknown): TodoType {
  return value === "idea" ? "idea" : "todo";
}

function normalizePriority(value: unknown): TodoPriority {
  const allowed: TodoPriority[] = ["low", "medium", "high", "urgent"];
  return allowed.includes(value as TodoPriority)
    ? (value as TodoPriority)
    : "medium";
}

export async function listTodos(params: {
  organizationId: string;
  businessId: string;
  type?: TodoType;
  status?: TodoStatus | TodoStatus[];
  limit?: number;
}): Promise<Todo[]> {
  const take = Math.max(1, Math.min(params.limit ?? 100, 500));
  const statusFilter = Array.isArray(params.status)
    ? { in: params.status }
    : params.status
      ? { equals: params.status }
      : undefined;
  return db.todo.findMany({
    where: {
      organizationId: params.organizationId,
      businessId: params.businessId,
      ...(params.type ? { type: params.type } : {}),
      ...(statusFilter ? { status: statusFilter } : {})
    },
    orderBy: [
      { status: "asc" },
      { priority: "desc" },
      { dueAt: "asc" },
      { createdAt: "desc" }
    ],
    take
  });
}

export async function getTodoById(
  id: string,
  organizationId: string
): Promise<Todo | null> {
  return db.todo.findFirst({ where: { id, organizationId } });
}

export async function createTodo(
  data: AuditContext & {
    organizationId: string;
    businessId: string;
    type?: TodoType | string;
    title: string;
    description?: string | null;
    status?: TodoStatus | string;
    priority?: TodoPriority | string;
    agentId?: string | null;
    dueAt?: Date | string | null;
    tags?: string[];
    recurringPattern?: string | null;
    createdVia?: string;
    createdByAgentId?: string | null;
    metadata?: Record<string, unknown> | null;
  }
): Promise<Todo> {
  const dueAt =
    data.dueAt instanceof Date
      ? data.dueAt
      : data.dueAt
        ? new Date(data.dueAt)
        : null;
  return db.todo.create({
    data: {
      organizationId: data.organizationId,
      businessId: data.businessId,
      type: normalizeType(data.type ?? "todo"),
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: normalizeStatus(data.status ?? "captured"),
      priority: normalizePriority(data.priority ?? "medium"),
      agentId: data.agentId ?? null,
      dueAt,
      tags: Array.from(new Set((data.tags ?? []).filter(Boolean))),
      recurringPattern: data.recurringPattern?.trim() || null,
      createdVia: data.createdVia ?? "web",
      createdBy: data.actorEmail ?? data.actorUserId ?? null,
      createdByAgentId: data.createdByAgentId ?? null,
      metadata: data.metadata ? toJson(data.metadata) : Prisma.JsonNull
    }
  });
}

export type UpdateTodoInput = Partial<{
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  agentId: string | null;
  dueAt: Date | string | null;
  snoozedUntil: Date | string | null;
  tags: string[];
  recurringPattern: string | null;
}>;

export async function updateTodo(
  id: string,
  organizationId: string,
  data: UpdateTodoInput & AuditContext
): Promise<Todo> {
  const existing = await getTodoById(id, organizationId);
  if (!existing) throw notFound("Todo not found.");

  const updateData: Prisma.TodoUncheckedUpdateInput = {};
  if (data.type !== undefined) updateData.type = normalizeType(data.type);
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }
  if (data.status !== undefined) {
    updateData.status = normalizeStatus(data.status);
    if (data.status === "done") {
      updateData.completedAt = new Date();
    } else if (data.status === "captured" || data.status === "snoozed") {
      // re-opening — clear completion marker
      updateData.completedAt = null;
    }
  }
  if (data.priority !== undefined) {
    updateData.priority = normalizePriority(data.priority);
  }
  if (data.agentId !== undefined) updateData.agentId = data.agentId;
  if (data.dueAt !== undefined) {
    updateData.dueAt =
      data.dueAt instanceof Date
        ? data.dueAt
        : data.dueAt
          ? new Date(data.dueAt)
          : null;
  }
  if (data.snoozedUntil !== undefined) {
    updateData.snoozedUntil =
      data.snoozedUntil instanceof Date
        ? data.snoozedUntil
        : data.snoozedUntil
          ? new Date(data.snoozedUntil)
          : null;
  }
  if (data.tags !== undefined) {
    updateData.tags = Array.from(new Set(data.tags.filter(Boolean)));
  }
  if (data.recurringPattern !== undefined) {
    updateData.recurringPattern = data.recurringPattern?.trim() || null;
  }

  if (Object.keys(updateData).length === 0) return existing;

  return db.todo.update({ where: { id }, data: updateData });
}

export async function deleteTodo(
  id: string,
  organizationId: string
): Promise<void> {
  const existing = await getTodoById(id, organizationId);
  if (!existing) throw notFound("Todo not found.");
  await db.todo.delete({ where: { id } });
}

/**
 * Promote a captured idea into a todo. Keeps the original id and audit
 * trail; just flips type + status so it shows up in the actionable
 * todo tab.
 */
export async function promoteIdeaToTodo(
  id: string,
  organizationId: string
): Promise<Todo> {
  const existing = await getTodoById(id, organizationId);
  if (!existing) throw notFound("Todo not found.");
  return db.todo.update({
    where: { id },
    data: {
      type: "todo",
      status: existing.status === "captured" ? "captured" : "captured"
    }
  });
}

export type TodoSummary = {
  captured: number;
  active: number;
  snoozed: number;
  done: number;
  dismissed: number;
  overdue: number;
  ideas: number;
};

export async function getTodoSummary(
  organizationId: string,
  businessId: string
): Promise<TodoSummary> {
  const rows = await db.todo.findMany({
    where: { organizationId, businessId },
    select: { status: true, type: true, dueAt: true }
  });
  const summary: TodoSummary = {
    captured: 0,
    active: 0,
    snoozed: 0,
    done: 0,
    dismissed: 0,
    overdue: 0,
    ideas: 0
  };
  const now = Date.now();
  for (const row of rows) {
    if (row.type === "idea") {
      summary.ideas += 1;
      continue;
    }
    const status = normalizeStatus(row.status);
    summary[status] += 1;
    if (
      row.dueAt &&
      (status === "captured" || status === "active") &&
      row.dueAt.getTime() < now
    ) {
      summary.overdue += 1;
    }
  }
  return summary;
}
