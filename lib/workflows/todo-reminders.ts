/**
 * Todo due-date reminders over Telegram.
 *
 * Runs on every scheduler tick. Finds todos that need attention and
 * haven't been nudged yet. Sends a single Telegram message per item
 * (not a stream of re-reminders) and stamps remindedAt so we don't
 * spam on the next tick.
 *
 * Reminder window:
 *   - dueAt is within the next 24h (approaching or just-overdue)
 *   - dueAt is not more than 72h in the past (stop nagging on
 *     long-overdue items — at that point they're either going to
 *     happen or not)
 *   - status is captured or active (we don't nag snoozed / done items)
 *   - remindedAt is null (one nudge per todo)
 *
 * If the business has no linked TelegramChat (or Telegram isn't
 * configured at all), the reminder no-ops but remindedAt still gets
 * set so we don't re-scan the same row forever.
 */

import { db } from "@/lib/db";
import { executeTool } from "@/lib/mcp/tool-executor";

const TELEGRAM_MAX_PER_TICK = 20;

export async function runTodoReminders(): Promise<number> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const was72hAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  // Pull candidates. Index is on (businessId, dueAt) so this is cheap.
  const candidates = await db.todo.findMany({
    where: {
      dueAt: { gte: was72hAgo, lte: in24h },
      status: { in: ["captured", "active"] },
      remindedAt: null
    },
    orderBy: { dueAt: "asc" },
    take: TELEGRAM_MAX_PER_TICK,
    select: {
      id: true,
      organizationId: true,
      businessId: true,
      agentId: true,
      title: true,
      description: true,
      priority: true,
      dueAt: true,
      type: true,
      business: {
        select: {
          name: true,
          telegramChats: {
            where: { active: true },
            select: { id: true }
          }
        }
      }
    }
  });

  if (candidates.length === 0) return 0;

  let sent = 0;
  for (const todo of candidates) {
    try {
      const hasTelegram = (todo.business?.telegramChats?.length ?? 0) > 0;
      if (hasTelegram && todo.dueAt) {
        const due = todo.dueAt;
        const delta = due.getTime() - now.getTime();
        const overdueBy =
          delta < 0
            ? `${Math.abs(Math.round(delta / 3600000))}h overdue`
            : delta < 3600000
              ? "due within the hour"
              : delta < 86400000
                ? `due in ${Math.round(delta / 3600000)}h`
                : "due tomorrow";

        const priorityPrefix =
          todo.priority === "urgent"
            ? "🚨 URGENT"
            : todo.priority === "high"
              ? "⚠️"
              : todo.type === "idea"
                ? "💡"
                : "📋";

        const body = [
          `${priorityPrefix} Reminder: *${todo.title}*`,
          `Status: ${overdueBy}`,
          todo.description
            ? `\n${todo.description.slice(0, 200)}${todo.description.length > 200 ? "…" : ""}`
            : "",
          `\nActivate or snooze in /admin/todos.`
        ]
          .filter(Boolean)
          .join("\n");

        await executeTool({
          toolName: "send_telegram_message",
          arguments: { text: body },
          mcpServerId: "__builtin__",
          organizationId: todo.organizationId,
          agentId: todo.agentId ?? undefined,
          businessId: todo.businessId,
          // System-generated reminder, not an agent decision — never gate.
          bypassApprovalGate: true
        });
        sent += 1;
      }

      // Always stamp remindedAt so we don't re-scan the same row
      // forever — even when Telegram isn't configured. Otherwise a
      // business without Telegram has every reminder candidate hit
      // this loop on every tick.
      await db.todo.update({
        where: { id: todo.id },
        data: { remindedAt: now }
      });
    } catch (err) {
      console.error(
        `[todo-reminders] failed for todo=${todo.id}:`,
        err
      );
      // Still stamp remindedAt so one bad send doesn't wedge the loop.
      try {
        await db.todo.update({
          where: { id: todo.id },
          data: { remindedAt: now }
        });
      } catch {
        /* best-effort */
      }
    }
  }

  return sent;
}
