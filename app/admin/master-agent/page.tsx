import { requireServerSession } from "@/lib/auth/server-session";
import {
  getMasterAgent,
  isMasterAgentEnabled
} from "@/lib/llm/master-agent";
import { MasterAgentChat } from "@/components/admin/master-agent/MasterAgentChat";
import { MasterAgentProvisioner } from "@/components/admin/master-agent/MasterAgentProvisioner";

export const dynamic = "force-dynamic";

export default async function MasterAgentPage() {
  const session = await requireServerSession();
  if (!session.organizationId) {
    return null;
  }

  const enabled = isMasterAgentEnabled();

  if (!enabled) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md space-y-3 rounded-2xl border border-ghost-border bg-ghost-surface p-6 text-center">
          <div className="text-4xl">🛰️</div>
          <h2 className="text-lg font-semibold text-white">
            Master Agent is disabled
          </h2>
          <p className="text-sm text-slate-400">
            To enable the organization-wide master agent, set
            <code className="mx-1 rounded bg-ghost-raised px-1.5 py-0.5 text-xs text-brand-cyan">
              MASTER_AGENT_ENABLED=true
            </code>
            in your environment and restart the server.
          </p>
        </div>
      </div>
    );
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
