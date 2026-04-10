import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { ConversationSidebar } from "@/components/admin/chat/ConversationSidebar";
import { listConversations } from "@/lib/repository/conversations";

export const dynamic = "force-dynamic";

export default async function ChatLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const businessIds =
    session.role === "admin" ? session.businessIds : undefined;

  // Load conversations for the sidebar
  const conversations = await listConversations({
    organizationId: session.organizationId,
    adminUserId: session.userId,
    limit: 50,
    businessIds
  });

  // Load available agents for the "New Conversation" dialog
  const agents = await db.agent.findMany({
    where: {
      businessId: { not: null },
      ...(businessIds ? { businessId: { in: businessIds } } : {}),
      business: { organizationId: session.organizationId }
    },
    select: {
      id: true,
      displayName: true,
      emoji: true,
      role: true,
      type: true,
      status: true,
      businessId: true,
      business: {
        select: {
          name: true
        }
      }
    },
    orderBy: [{ type: "asc" }, { displayName: "asc" }]
  });

  const agentOptions = agents.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    emoji: a.emoji,
    role: a.role,
    businessId: a.businessId,
    businessName: a.business?.name ?? "Unknown",
    status: a.status
  }));

  const conversationItems = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    updatedAt: c.updatedAt.toISOString(),
    agent: {
      id: c.agent.id,
      displayName: c.agent.displayName,
      emoji: c.agent.emoji,
      role: c.agent.role
    },
    business: {
      id: c.business.id,
      name: c.business.name
    },
    messages: c.messages.map((m) => ({
      content: m.content,
      role: m.role,
      createdAt: m.createdAt.toISOString()
    }))
  }));

  return (
    <div className="-mx-6 -mt-6 flex h-[calc(100vh-4rem)] overflow-hidden">
      <ConversationSidebar
        conversations={conversationItems}
        agents={agentOptions}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
