import { notFound } from "next/navigation";

import { AgentEditClient } from "@/components/admin/agents/AgentEditClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { getSystemDefaultModel } from "@/lib/models/agent-models";
import { db } from "@/lib/db";
import { getAgentById } from "@/lib/repository/agents";

export const dynamic = "force-dynamic";

type EditAgentPageProps = {
  params: {
    id: string;
  };
};

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export default async function EditAgentPage({ params }: EditAgentPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    notFound();
  }

  const [agent, businesses, mainAgents] = await Promise.all([
    getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    ),
    db.business.findMany({
      where:
        session.role === "admin"
          ? {
              organizationId: session.organizationId,
              id: {
                in: session.businessIds
              }
            }
          : {
              organizationId: session.organizationId
            },
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
    }),
    db.agent.findMany({
      where:
        session.role === "admin"
          ? {
              businessId: {
                in: session.businessIds
              },
              type: "main",
              status: {
                not: "disabled"
              }
            }
          : {
              OR: [
                {
                  organizationId: session.organizationId
                },
                {
                  business: {
                    organizationId: session.organizationId
                  }
                }
              ],
              type: "main",
              status: {
                not: "disabled"
              }
            },
      select: {
        id: true,
        businessId: true
      }
    })
  ]);

  if (!agent) {
    notFound();
  }

  const existingMainAgents = mainAgents.reduce<Record<string, string>>(
    (map, mainAgent) => {
      if (mainAgent.businessId) {
        map[mainAgent.businessId] = mainAgent.id;
      }
      return map;
    },
    {}
  );

  return (
    <AgentEditClient
      agentId={agent.id}
      agentName={agent.displayName}
      businesses={businesses}
      existingMainAgents={existingMainAgents}
      allowGlobal={session.role === "super_admin"}
      systemDefaultModel={getSystemDefaultModel()}
      defaultValues={{
        businessId: agent.businessId ?? "",
        displayName: agent.displayName,
        emoji: agent.emoji ?? "🤖",
        role: agent.role,
        purpose: agent.purpose ?? "",
        type: agent.type as "main" | "specialist" | "global",
        status: agent.status,
        systemPrompt: agent.systemPrompt ?? "",
        roleInstructions: agent.roleInstructions ?? "",
        outputStyle: agent.outputStyle ?? "",
        constraints: agent.constraints ?? "",
        escalationRules: agent.escalationRules ?? "",
        askBeforeDoing: agent.askBeforeDoing ?? "",
        primaryModel: agent.primaryModel ?? "",
        fallbackModel: agent.fallbackModel ?? "",
        modelSource: agent.modelSource ?? "",
        safetyMode: agent.safetyMode ?? "",
        tools: getStringArray(agent.tools),
        workspacePath: agent.workspacePath ?? ""
      }}
    />
  );
}
