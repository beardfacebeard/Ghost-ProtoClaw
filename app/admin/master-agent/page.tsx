import { requireServerSession } from "@/lib/auth/server-session";
import { getMasterAgent } from "@/lib/llm/master-agent";
import { MasterAgentChat } from "@/components/admin/master-agent/MasterAgentChat";
import { MasterAgentProvisioner } from "@/components/admin/master-agent/MasterAgentProvisioner";

export const dynamic = "force-dynamic";

export default async function MasterAgentPage() {
  const session = await requireServerSession();
  if (!session.organizationId) {
    return null;
  }

  const master = await getMasterAgent(session.organizationId);

  if (!master) {
    return <MasterAgentProvisioner />;
  }

  return (
    <MasterAgentChat
      master={{
        id: master.id,
        displayName: master.displayName,
        emoji: master.emoji,
        status: master.status
      }}
    />
  );
}
