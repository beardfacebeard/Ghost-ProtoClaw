import { notFound } from "next/navigation";

import { CreateAgentClient } from "@/components/admin/agents/CreateAgentClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { getSystemDefaultModel } from "@/lib/models/agent-models";
import { db } from "@/lib/db";
import { getAgentById } from "@/lib/repository/agents";

export const dynamic = "force-dynamic";

type CreateAgentPageProps = {
  searchParams?: {
    businessId?: string;
    duplicateFrom?: string;
  };
};

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export default async function CreateAgentPage({
  searchParams
}: CreateAgentPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    notFound();
  }

  const businesses = await db.business.findMany({
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
  });

  const mainAgents = await db.agent.findMany({
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
  });

  const existingMainAgents = mainAgents.reduce<Record<string, string>>(
    (map, agent) => {
      if (agent.businessId) {
        map[agent.businessId] = agent.id;
      }
      return map;
    },
    {}
  );

  const duplicateSource = searchParams?.duplicateFrom
    ? await getAgentById(
        searchParams.duplicateFrom,
        session.organizationId,
        session.role === "admin" ? session.businessIds : undefined
      )
    : null;

  if (searchParams?.duplicateFrom && !duplicateSource) {
    notFound();
  }

  const defaultValues = duplicateSource
    ? {
        businessId: duplicateSource.businessId ?? "",
        displayName: `${duplicateSource.displayName} Copy`,
        emoji: duplicateSource.emoji ?? "🤖",
        role: duplicateSource.role,
        purpose: duplicateSource.purpose ?? "",
        type: duplicateSource.type as "main" | "specialist" | "global",
        status: duplicateSource.status,
        systemPrompt: duplicateSource.systemPrompt ?? "",
        roleInstructions: duplicateSource.roleInstructions ?? "",
        outputStyle: duplicateSource.outputStyle ?? "",
        constraints: duplicateSource.constraints ?? "",
        escalationRules: duplicateSource.escalationRules ?? "",
        askBeforeDoing: duplicateSource.askBeforeDoing ?? "",
        primaryModel: duplicateSource.primaryModel ?? "",
        fallbackModel: duplicateSource.fallbackModel ?? "",
        modelSource: duplicateSource.modelSource ?? "",
        safetyMode: duplicateSource.safetyMode ?? "",
        tools: getStringArray(duplicateSource.tools),
        workspacePath: duplicateSource.workspacePath ?? ""
      }
    : {
        businessId: searchParams?.businessId ?? ""
      };

  return (
    <CreateAgentClient
      businesses={businesses}
      defaultValues={defaultValues}
      existingMainAgents={existingMainAgents}
      allowGlobal={session.role === "super_admin"}
      systemDefaultModel={getSystemDefaultModel()}
      duplicatedFromName={duplicateSource?.displayName}
    />
  );
}
