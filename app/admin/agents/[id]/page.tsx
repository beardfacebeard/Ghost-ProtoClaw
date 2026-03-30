import { notFound } from "next/navigation";

import { AgentDetailClient } from "@/components/admin/agents/AgentDetailClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { getSystemDefaultModel } from "@/lib/models/agent-models";
import { getAgentById } from "@/lib/repository/agents";
import { listAgentMemories } from "@/lib/repository/memory";

export const dynamic = "force-dynamic";

type AgentDetailPageProps = {
  params: {
    id: string;
  };
};

export default async function AgentDetailPage({
  params
}: AgentDetailPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    notFound();
  }

  const [agent, memories] = await Promise.all([
    getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    ),
    listAgentMemories({
      organizationId: session.organizationId,
      agentId: params.id,
      limit: 100
    })
  ]);

  if (!agent) {
    notFound();
  }

  return (
    <AgentDetailClient
      agent={agent}
      memories={memories}
      systemDefaultModel={getSystemDefaultModel()}
    />
  );
}
