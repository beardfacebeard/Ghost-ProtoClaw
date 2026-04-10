import { notFound } from "next/navigation";

import { requireServerSession } from "@/lib/auth/server-session";
import {
  getConversationById,
  listMessages
} from "@/lib/repository/conversations";
import { ChatHeader } from "@/components/admin/chat/ChatHeader";
import { MessageThread } from "@/components/admin/chat/MessageThread";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { conversationId: string };
};

export default async function ConversationPage({ params }: PageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const conversation = await getConversationById(
    params.conversationId,
    session.organizationId,
    session.role === "admin" ? session.businessIds : undefined
  );

  if (!conversation) {
    notFound();
  }

  const messages = await listMessages(params.conversationId, { limit: 100 });

  const serializedMessages = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
    model: m.model,
    latencyMs: m.latencyMs,
    createdAt: m.createdAt.toISOString()
  }));

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        conversationId={conversation.id}
        title={conversation.title}
        status={conversation.status}
        agent={{
          displayName: conversation.agent.displayName,
          emoji: conversation.agent.emoji,
          role: conversation.agent.role
        }}
        businessName={conversation.business.name}
      />
      <div className="flex-1 overflow-hidden">
        <MessageThread
          conversationId={conversation.id}
          agent={{
            id: conversation.agent.id,
            displayName: conversation.agent.displayName,
            emoji: conversation.agent.emoji,
            role: conversation.agent.role
          }}
          initialMessages={serializedMessages}
          conversationStatus={conversation.status}
        />
      </div>
    </div>
  );
}
