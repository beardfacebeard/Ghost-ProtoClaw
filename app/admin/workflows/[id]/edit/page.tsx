import { notFound } from "next/navigation";

import { EditWorkflowClient } from "@/components/admin/workflows/EditWorkflowClient";
import type { WorkflowFormValues } from "@/components/admin/workflows/schema";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { getWorkflowById } from "@/lib/repository/workflows";

export const dynamic = "force-dynamic";

type EditWorkflowPageProps = {
  params: {
    id: string;
  };
};

export default async function EditWorkflowPage({
  params
}: EditWorkflowPageProps) {
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

  const [workflow, businesses, agents, integrations] = await Promise.all([
    getWorkflowById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    ),
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
    })
  ]);

  if (!workflow) {
    notFound();
  }

  const integrationKeys = integrations.map((integration) => integration.key);

  return (
    <EditWorkflowClient
      workflowId={workflow.id}
      workflowName={workflow.name}
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
      defaultValues={{
        businessId: workflow.businessId,
        agentId: workflow.agentId ?? "",
        name: workflow.name,
        description: workflow.description ?? "",
        trigger: workflow.trigger as WorkflowFormValues["trigger"],
        output: workflow.output as WorkflowFormValues["output"],
        scheduleMode:
          (workflow.scheduleMode as WorkflowFormValues["scheduleMode"]) ??
          undefined,
        frequency: workflow.frequency ?? "",
        cronExpression: workflow.cronExpression ?? "",
        timezone: workflow.timezone ?? "UTC",
        approvalMode:
          (workflow.approvalMode as WorkflowFormValues["approvalMode"]) ??
          "approve_first",
        safetyMode: workflow.safetyMode ?? "",
        overrideSafetyMode: Boolean(workflow.safetyMode),
        actionType: workflow.actionType ?? "",
        enabled: workflow.enabled
      }}
    />
  );
}
