import Link from "next/link";
import { Bot, Crown, FolderTree } from "lucide-react";

import { AgentCard } from "@/components/admin/agents/AgentCard";
import { AgentsFilterBar } from "@/components/admin/agents/AgentsFilterBar";
import { EmptyState } from "@/components/admin/EmptyState";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/auth/server-session";
import { getSystemDefaultModel } from "@/lib/models/agent-models";
import { db } from "@/lib/db";
import { listAgents } from "@/lib/repository/agents";

export const dynamic = "force-dynamic";

type AgentsPageProps = {
  searchParams?: {
    businessId?: string;
    type?: string;
    status?: string;
    search?: string;
    view?: "grouped" | "list";
  };
};

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const session = await requireServerSession();
  const businessId = searchParams?.businessId;
  const type = searchParams?.type ?? "all";
  const status = searchParams?.status ?? "active";
  const search = searchParams?.search ?? "";
  const view = searchParams?.view ?? "grouped";
  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId ?? undefined,
          id: {
            in: session.businessIds
          }
        }
      : {
          organizationId: session.organizationId ?? undefined
        };

  const [businesses, agents] = await Promise.all([
    session.organizationId
      ? db.business.findMany({
          where: businessWhere,
          select: {
            id: true,
            name: true,
            slug: true,
            primaryModel: true,
            fallbackModel: true,
            safetyMode: true
          },
          orderBy: {
            name: "asc"
          }
        })
      : [],
    session.organizationId
      ? listAgents({
          organizationId: session.organizationId,
          businessId,
          type,
          status,
          search,
          businessIds: session.role === "admin" ? session.businessIds : undefined
        })
      : []
  ]);

  const systemDefaultModel = getSystemDefaultModel();
  const businessGroups = businesses
    .map((business) => ({
      business,
      agents: agents.filter((agent) => agent.businessId === business.id)
    }))
    .filter((group) => group.agents.length > 0);
  const globalAgents = agents.filter((agent) => agent.type === "global");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agents"
        description="Your AI operators - configure identity, prompts, tools, and model settings"
        action={
          <Button asChild>
            <Link href="/admin/agents/create">New Agent</Link>
          </Button>
        }
      />

      <AgentsFilterBar
        initialSearch={search}
        currentBusinessId={businessId ?? "all"}
        currentType={type}
        currentStatus={status}
        currentView={view}
        businesses={businesses.map(({ id, name }) => ({ id, name }))}
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-6 w-6" />}
          title="No agents yet"
          description="Create your first agent to define how Mission Control thinks, responds, and acts."
          action={
            <Button asChild>
              <Link href="/admin/agents/create">Create Agent</Link>
            </Button>
          }
        />
      ) : view === "list" ? (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              showBusiness
              systemDefault={systemDefaultModel}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {businessGroups.map(({ business, agents: groupedAgents }) => {
            const mainAgent = groupedAgents.find((agent) => agent.type === "main");
            const specialistAgents = groupedAgents.filter(
              (agent) => agent.type === "specialist"
            );

            return (
              <section key={business.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-bg-surface-2 text-steel-bright">
                    <FolderTree className="h-5 w-5" />
                  </div>
                  <div>
                    <Link
                      href={`/admin/businesses/${business.id}`}
                      className="text-lg font-semibold text-white transition-colors hover:text-steel-bright"
                    >
                      {business.name}
                    </Link>
                    <div className="text-sm text-ink-muted">
                      {groupedAgents.length} agent{groupedAgents.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                {mainAgent ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-state-warning/30 bg-state-warning/10 px-3 py-1 text-xs text-state-warning">
                      <Crown className="h-3.5 w-3.5" />
                      Main Agent
                    </div>
                    <AgentCard
                      agent={mainAgent}
                      systemDefault={systemDefaultModel}
                    />
                  </div>
                ) : null}

                {specialistAgents.length > 0 ? (
                  <div className="ml-0 grid gap-3 xl:ml-6">
                    {specialistAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        systemDefault={systemDefaultModel}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}

          {globalAgents.length > 0 ? (
            <section className="space-y-4">
              <div>
                <div className="text-lg font-semibold text-white">Global Agents</div>
                <div className="text-sm text-ink-muted">
                  Org-wide utilities and shared operators
                </div>
              </div>
              <div className="grid gap-4">
                {globalAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    systemDefault={systemDefaultModel}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
