import { notFound } from "next/navigation";

import { CreateWorkflowClient } from "@/components/admin/workflows/CreateWorkflowClient";
import type { WorkflowFormValues } from "@/components/admin/workflows/schema";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { getWorkflowById } from "@/lib/repository/workflows";

export const dynamic = "force-dynamic";

type CreateWorkflowPageProps = {
  searchParams?: {
    businessId?: string;
    duplicateFrom?: string;
  };
};

export default async function CreateWorkflowPage({
  searchParams
}: CreateWorkflowPageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    notFound();
  }

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: {
            in: session.businessIds
          }
        }
      : {
          organizationId: session.organizationId
        };

  const [businesses, agents, integrations, duplicateSource] = await Promise.all([
    db.business.findMany({
      where: businessWhere,
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    db.agent.findMany({
      where:
        session.role === "admin"
          ? {
              OR: [
                {
                  businessId: {
                    in: session.businessIds
                  }
                },
                {
                  type: "global",
                  organizationId: session.organizationId
                }
              ],
              status: {
                not: "disabled"
              }
            }
          : {
              OR: [
                {
                  business: {
                    organizationId: session.organizationId
                  }
                },
                {
                  type: "global",
                  organizationId: session.organizationId
                }
              ],
              status: {
                not: "disabled"
              }
            },
      select: {
        id: true,
        displayName: true,
        emoji: true,
        businessId: true,
        type: true
      },
      orderBy: [{ type: "asc" }, { displayName: "asc" }]
    }),
    db.integration.findMany({
      where: {
        organizationId: session.organizationId,
        status: "connected"
      },
      select: {
        key: true
      }
    }),
    searchParams?.duplicateFrom
      ? getWorkflowById(
          searchParams.duplicateFrom,
          session.organizationId,
          session.role === "admin" ? session.businessIds : undefined
        )
      : null
  ]);

  if (searchParams?.duplicateFrom && !duplicateSource) {
    notFound();
  }

  const integrationKeys = integrations.map((integration) => integration.key);

  return (
    <CreateWorkflowClient
      businesses={businesses}
      agents={agents}
      integrationStatus={{
        gmail: integrationKeys.includes("gmail"),
        crm:
          integrationKeys.includes("hubspot") ||
          integrationKeys.includes("pipedrive") ||
          integrationKeys.includes("ghl"),
        comments:
          integrationKeys.includes("telegram") ||
          integrationKeys.includes("slack") ||
          integrationKeys.includes("skool")
      }}
      duplicatedFromName={duplicateSource?.name ?? null}
      defaultValues={
        duplicateSource
          ? {
              businessId: duplicateSource.businessId,
              agentId: duplicateSource.agentId ?? "",
              name: `${duplicateSource.name} Copy`,
              description: duplicateSource.description ?? "",
              trigger: duplicateSource.trigger as WorkflowFormValues["trigger"],
              output: duplicateSource.output as WorkflowFormValues["output"],
              scheduleMode:
                (duplicateSource.scheduleMode as WorkflowFormValues["scheduleMode"]) ??
                undefined,
              frequency: duplicateSource.frequency ?? "",
              cronExpression: duplicateSource.cronExpression ?? "",
              timezone: duplicateSource.timezone ?? "UTC",
              approvalMode:
                (duplicateSource.approvalMode as WorkflowFormValues["approvalMode"]) ??
                "approve_first",
              safetyMode: duplicateSource.safetyMode ?? "",
              overrideSafetyMode: Boolean(duplicateSource.safetyMode),
              actionType: duplicateSource.actionType ?? "",
              enabled: duplicateSource.enabled
            }
          : {
              businessId: searchParams?.businessId ?? ""
            }
      }
    />
  );
}
