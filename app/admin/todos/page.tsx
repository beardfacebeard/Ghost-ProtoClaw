import { SectionHeader } from "@/components/admin/SectionHeader";
import { TodosClient } from "@/components/admin/todos/TodosClient";
import type { TodoRecord } from "@/components/admin/todos/TodosClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const session = await requireServerSession();
  if (!session.organizationId) return null;

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: { in: session.businessIds }
        }
      : { organizationId: session.organizationId };

  const businesses = await db.business.findMany({
    where: businessWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  const businessIds = businesses.map((b) => b.id);
  const nameById = new Map(businesses.map((b) => [b.id, b.name]));

  const [todoRows, agents] = await Promise.all([
    businessIds.length
      ? db.todo.findMany({
          where: {
            organizationId: session.organizationId,
            businessId: { in: businessIds }
          },
          orderBy: [
            { status: "asc" },
            { priority: "desc" },
            { createdAt: "desc" }
          ],
          take: 500
        })
      : Promise.resolve([]),
    businessIds.length
      ? db.agent.findMany({
          where: {
            businessId: { in: businessIds },
            status: { not: "disabled" }
          },
          select: {
            id: true,
            displayName: true,
            emoji: true,
            businessId: true
          },
          orderBy: { displayName: "asc" }
        })
      : Promise.resolve([])
  ]);

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const todos: TodoRecord[] = todoRows.map((row) => {
    const agent = row.agentId ? agentMap.get(row.agentId) : null;
    return {
      id: row.id,
      businessId: row.businessId,
      businessName: nameById.get(row.businessId) ?? "Unknown",
      type: row.type,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      agentId: row.agentId,
      agentName: agent?.displayName ?? null,
      agentEmoji: agent?.emoji ?? null,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      snoozedUntil: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
      createdVia: row.createdVia,
      createdBy: row.createdBy,
      createdByAgentId: row.createdByAgentId,
      tags: row.tags,
      recurringPattern: row.recurringPattern,
      activatedAt: row.activatedAt ? row.activatedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      delegatedConversationId: row.delegatedConversationId,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt)
    };
  });

  const defaultBusinessId = businesses[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Work · Todos & Ideas"
        title="Capture now. Activate later."
        description="Brain-dump anything. Shape it when you're ready. Activate one and an agent picks it up — results post back to chat."
      />
      <TodosClient
        businesses={businesses}
        defaultBusinessId={defaultBusinessId}
        todos={todos}
        agents={agents.flatMap((agent) =>
          typeof agent.businessId === "string"
            ? [
                {
                  id: agent.id,
                  displayName: agent.displayName,
                  emoji: agent.emoji,
                  businessId: agent.businessId
                }
              ]
            : []
        )}
      />
    </div>
  );
}
