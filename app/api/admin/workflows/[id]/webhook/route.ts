import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { encryptSecret } from "@/lib/auth/crypto";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  serverError,
  unauthorized
} from "@/lib/errors";
import { getWorkflowById } from "@/lib/repository/workflows";

const webhookConfigSchema = z.object({
  provider: z.enum(["generic", "stripe", "github", "custom"]).optional(),
  secret: z
    .union([z.string().trim().max(512), z.literal(""), z.null()])
    .optional(),
  enabled: z.boolean().optional()
});

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sanitizeEndpointForAudit(endpoint: {
  id: string;
  businessId: string;
  workflowId: string | null;
  provider: string;
  enabled: boolean;
  lastReceivedAt: Date | null;
  totalReceived: number;
  createdAt: Date;
  updatedAt: Date;
  secret?: string | null;
  encryptedSecret?: string | null;
}) {
  return {
    id: endpoint.id,
    businessId: endpoint.businessId,
    workflowId: endpoint.workflowId,
    provider: endpoint.provider,
    enabled: endpoint.enabled,
    lastReceivedAt: endpoint.lastReceivedAt,
    totalReceived: endpoint.totalReceived,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
    hasSecret: Boolean(endpoint.secret || endpoint.encryptedSecret)
  };
}

function getEncryptionKey() {
  return process.env.ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY;
}

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const workflow = await getWorkflowById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!workflow) {
      throw notFound("Workflow not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, workflow.businessId);
    }

    const endpoint = await db.webhookEndpoint.findFirst({
      where: {
        workflowId: workflow.id
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    if (!endpoint) {
      throw notFound("Webhook endpoint not found.");
    }

    const recentEvents = await db.webhookEvent.findMany({
      where: {
        endpointId: endpoint.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    });

    return addSecurityHeaders(
      NextResponse.json({
        endpoint: {
          id: endpoint.id,
          businessId: endpoint.businessId,
          workflowId: endpoint.workflowId,
          provider: endpoint.provider,
          enabled: endpoint.enabled,
          lastReceivedAt: endpoint.lastReceivedAt,
          totalReceived: endpoint.totalReceived,
          createdAt: endpoint.createdAt,
          updatedAt: endpoint.updatedAt,
          hasSecret: Boolean(endpoint.secret || endpoint.encryptedSecret)
        },
        recentEvents
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const workflow = await getWorkflowById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!workflow) {
      throw notFound("Workflow not found.");
    }

    if (workflow.trigger !== "webhook") {
      throw badRequest("Only webhook-triggered workflows can manage webhook settings.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, workflow.businessId);
    }

    const body = webhookConfigSchema.parse(await request.json());
    const encryptionKey = getEncryptionKey();

    if (
      body.secret !== undefined &&
      body.secret !== null &&
      body.secret.trim().length > 0 &&
      !encryptionKey
    ) {
      throw serverError("Webhook encryption key is not configured.");
    }

    const existing = await db.webhookEndpoint.findFirst({
      where: {
        workflowId: workflow.id
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const nextSecret =
      body.secret === undefined
        ? undefined
        : body.secret === null || body.secret.trim().length === 0
          ? null
          : body.secret.trim();

    const endpoint = await db.$transaction(async (tx) => {
      const updatedEndpoint = existing
        ? await tx.webhookEndpoint.update({
            where: {
              id: existing.id
            },
            data: {
              ...(body.provider ? { provider: body.provider } : {}),
              ...(typeof body.enabled === "boolean"
                ? {
                    enabled: body.enabled
                  }
                : {}),
              ...(nextSecret !== undefined
                ? {
                    secret: null,
                    encryptedSecret:
                      nextSecret && encryptionKey
                        ? encryptSecret(nextSecret, encryptionKey)
                        : null
                  }
                : {})
            }
          })
        : await tx.webhookEndpoint.create({
            data: {
              businessId: workflow.businessId,
              workflowId: workflow.id,
              provider: body.provider ?? "generic",
              enabled: body.enabled ?? true,
              secret: null,
              encryptedSecret:
                nextSecret && encryptionKey
                  ? encryptSecret(nextSecret, encryptionKey)
                  : null
            }
          });

      await tx.activityEntry.create({
        data: {
          businessId: workflow.businessId,
          type: "workflow",
          title: "Webhook settings updated",
          detail: `${workflow.name} webhook security settings were updated.`,
          status: updatedEndpoint.enabled ? "enabled" : "disabled",
          metadata: {
            workflowId: workflow.id,
            endpointId: updatedEndpoint.id,
            provider: updatedEndpoint.provider
          }
        }
      });

      await tx.logEvent.create({
        data: {
          businessId: workflow.businessId,
          level: "info",
          action: "workflow_webhook_updated",
          message: `${workflow.name} webhook configuration changed.`,
          metadata: toJsonValue({
            workflowId: workflow.id,
            endpointId: updatedEndpoint.id,
            provider: updatedEndpoint.provider,
            hasSecret: Boolean(updatedEndpoint.encryptedSecret)
          })
        }
      });

      await tx.auditEvent.create({
        data: {
          organizationId: session.organizationId,
          actorUserId: session.userId,
          actorEmail: session.email,
          ipAddress: request.headers.get("x-forwarded-for"),
          eventType: existing
            ? "workflow_webhook_updated"
            : "workflow_webhook_created",
          entityType: "webhook_endpoint",
          entityId: updatedEndpoint.id,
          beforeJson: existing
            ? toJsonValue(sanitizeEndpointForAudit(existing))
            : Prisma.JsonNull,
          afterJson: toJsonValue(sanitizeEndpointForAudit(updatedEndpoint))
        }
      });

      return updatedEndpoint;
    });

    return addSecurityHeaders(
      NextResponse.json({
        endpoint: {
          id: endpoint.id,
          businessId: endpoint.businessId,
          workflowId: endpoint.workflowId,
          provider: endpoint.provider,
          enabled: endpoint.enabled,
          lastReceivedAt: endpoint.lastReceivedAt,
          totalReceived: endpoint.totalReceived,
          createdAt: endpoint.createdAt,
          updatedAt: endpoint.updatedAt,
          hasSecret: Boolean(endpoint.secret || endpoint.encryptedSecret),
          generatedSecret: nextSecret ?? undefined
        }
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
