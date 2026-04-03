import {
  createHmac,
  timingSafeEqual
} from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { decryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";
import { runWorkflowOnOpenClaw } from "@/lib/openclaw/workflow-bridge";

type RouteContext = {
  params: {
    endpointId: string;
  };
};

type VerificationResult = {
  verified: boolean;
  error?: string;
};

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function compareSignature(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getEncryptionKey() {
  return process.env.ENCRYPTION_KEY || process.env.INTEGRATION_ENCRYPTION_KEY;
}

function getEndpointSecret(encryptedSecret?: string | null, secret?: string | null) {
  if (secret) {
    return {
      secret,
      configured: true,
      decryptError: false
    };
  }

  if (!encryptedSecret) {
    return {
      secret: null,
      configured: false,
      decryptError: false
    };
  }

  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    return {
      secret: null,
      configured: true,
      decryptError: true
    };
  }

  try {
    return {
      secret: decryptSecret(encryptedSecret, encryptionKey),
      configured: true,
      decryptError: false
    };
  } catch {
    return {
      secret: null,
      configured: true,
      decryptError: true
    };
  }
}

function verifyStripeSignature(
  rawBody: string,
  headerValue: string | null,
  secret: string
): VerificationResult {
  if (!headerValue) {
    return {
      verified: false,
      error: "Missing Stripe signature."
    };
  }

  const parts = Object.fromEntries(
    headerValue.split(",").map((entry) => {
      const [key, value] = entry.split("=");
      return [key?.trim() || "", value?.trim() || ""];
    })
  );

  const timestamp = Number.parseInt(parts.t || "", 10);
  const signature = parts.v1;

  if (!Number.isFinite(timestamp) || !signature) {
    return {
      verified: false,
      error: "Invalid Stripe signature format."
    };
  }

  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return {
      verified: false,
      error: "Stripe signature expired."
    };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return {
    verified: compareSignature(expected, signature),
    error: "Stripe signature verification failed."
  };
}

function verifyGithubSignature(
  rawBody: string,
  headerValue: string | null,
  secret: string
): VerificationResult {
  if (!headerValue?.startsWith("sha256=")) {
    return {
      verified: false,
      error: "Missing GitHub signature."
    };
  }

  const expected = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  return {
    verified: compareSignature(expected, headerValue),
    error: "GitHub signature verification failed."
  };
}

function verifyGenericSignature(
  rawBody: string,
  headerValue: string | null,
  secret: string
): VerificationResult {
  if (!headerValue) {
    return {
      verified: false,
      error: "Missing webhook signature."
    };
  }

  const provided = headerValue.startsWith("sha256=")
    ? headerValue.slice(7)
    : headerValue;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  return {
    verified: compareSignature(expected, provided),
    error: "Webhook signature verification failed."
  };
}

function detectEventType(
  provider: string,
  headers: Headers,
  payload: Record<string, unknown>
) {
  switch (provider) {
    case "stripe":
      return typeof payload.type === "string" ? payload.type : "stripe.event";
    case "github":
      return headers.get("x-github-event") || "github.event";
    default:
      return (
        (typeof payload.event === "string" && payload.event) ||
        (typeof payload.type === "string" && payload.type) ||
        (typeof payload.event_type === "string" && payload.event_type) ||
        "generic.event"
      );
  }
}

async function processWorkflowForWebhook(params: {
  workflowId: string;
  eventId: string;
  payload: Record<string, unknown>;
}) {
  const workflow = await db.workflow.findUnique({
    where: {
      id: params.workflowId
    }
  });

  if (!workflow || !workflow.enabled) {
    await db.webhookEvent.update({
      where: {
        id: params.eventId
      },
      data: {
        status: "failed",
        processedAt: new Date(),
        error: "Linked workflow is unavailable."
      }
    });
    return;
  }

  await db.webhookEvent.update({
    where: {
      id: params.eventId
    },
    data: {
      status: "processing",
      dispatchedAt: new Date()
    }
  });

  try {
    if (workflow.approvalMode === "approve_first") {
      const approval = await db.approvalRequest.create({
        data: {
          businessId: workflow.businessId,
          agentId: workflow.agentId,
          workflowId: workflow.id,
          actionType: "trigger_workflow",
          actionDetail: toJsonValue(params.payload),
          status: "pending",
          requestedBy: "webhook",
          reason: "Webhook-triggered workflow requires approval",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      await Promise.all([
        db.webhookEvent.update({
          where: {
            id: params.eventId
          },
          data: {
            status: "completed",
            processedAt: new Date()
          }
        }),
        db.activityEntry.create({
          data: {
            businessId: workflow.businessId,
            type: "approval",
            title: "Webhook awaiting approval",
            detail: `${workflow.name} is waiting for approval before it runs.`,
            status: "pending",
            metadata: toJsonValue({
              workflowId: workflow.id,
              approvalId: approval.id
            })
          }
        })
      ]);

      return;
    }

    if (workflow.approvalMode === "notify" || workflow.approvalMode === "review_after") {
      const run = await db.actionRun.create({
        data: {
          businessId: workflow.businessId,
          agentId: workflow.agentId,
          workflowId: workflow.id,
          action: "run_workflow",
          status: "pending",
          reason: "Webhook event queued for follow-up",
          result: toJsonValue(params.payload)
        }
      });

      await Promise.all([
        db.webhookEvent.update({
          where: {
            id: params.eventId
          },
          data: {
            status: "completed",
            processedAt: new Date()
          }
        }),
        db.activityEntry.create({
          data: {
            businessId: workflow.businessId,
            type: "workflow",
            title: "Webhook queued a workflow run",
            detail: `${workflow.name} captured a webhook event and queued it for review.`,
            status: run.status,
            metadata: toJsonValue({
              workflowId: workflow.id,
              actionRunId: run.id
            })
          }
        })
      ]);

      return;
    }

    const run = await db.actionRun.create({
      data: {
        businessId: workflow.businessId,
        agentId: workflow.agentId,
        workflowId: workflow.id,
        action: "run_workflow",
        status: "running",
        reason: "Triggered by webhook event",
        result: toJsonValue(params.payload),
        startedAt: new Date()
      }
    });

    const runtimeResult = await runWorkflowOnOpenClaw({
      workflowId: workflow.id,
      businessId: workflow.businessId,
      agentId: workflow.agentId,
      trigger: workflow.trigger,
      payload: params.payload
    });

    const status = runtimeResult.success ? "completed" : "failed";
    const resultPayload = runtimeResult.success
      ? runtimeResult.result ?? { message: "Workflow completed." }
      : { error: runtimeResult.error ?? "Workflow failed." };

    await Promise.all([
      db.actionRun.update({
        where: {
          id: run.id
        },
        data: {
          status,
          result: toJsonValue(resultPayload),
          error: runtimeResult.success ? null : runtimeResult.error,
          completedAt: new Date()
        }
      }),
      db.workflow.update({
        where: {
          id: workflow.id
        },
        data: {
          lastRunAt: new Date(),
          resultStatus: status,
          lastRunResult: toJsonValue(resultPayload),
          ...(runtimeResult.runtimeJobId
            ? {
                runtimeJobId: runtimeResult.runtimeJobId
              }
            : {})
        }
      }),
      db.webhookEvent.update({
        where: {
          id: params.eventId
        },
        data: {
          status: runtimeResult.success ? "completed" : "failed",
          processedAt: new Date(),
          error: runtimeResult.success ? null : runtimeResult.error
        }
      }),
      db.activityEntry.create({
        data: {
          businessId: workflow.businessId,
          type: "workflow",
          title: "Webhook triggered workflow",
          detail: runtimeResult.success
            ? `${workflow.name} completed successfully from a webhook event.`
            : `${workflow.name} failed while processing a webhook event.`,
          status,
          metadata: toJsonValue({
            workflowId: workflow.id,
            actionRunId: run.id,
            latencyMs: runtimeResult.latencyMs
          })
        }
      })
    ]);
  } catch (error) {
    await db.webhookEvent.update({
      where: {
        id: params.eventId
      },
      data: {
        status: "failed",
        processedAt: new Date(),
        error: error instanceof Error ? error.message : "Webhook processing failed."
      }
    });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: RouteContext) {
  const rawBody = await request.text();
  const rawBodyBytes = Buffer.byteLength(rawBody, "utf8");

  if (rawBodyBytes > MAX_WEBHOOK_BODY_BYTES) {
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: "Webhook payload is too large."
        },
        { status: 413 }
      )
    );
  }

  const endpoint = await db.webhookEndpoint.findUnique({
    where: {
      id: params.endpointId
    }
  });

  if (!endpoint || !endpoint.enabled) {
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: "Webhook endpoint not found."
        },
        { status: 404 }
      )
    );
  }

  const provider = endpoint.provider || "generic";
  const secretState = getEndpointSecret(endpoint.encryptedSecret, endpoint.secret);
  const secret = secretState.secret;

  const verification = secretState.decryptError
    ? {
        verified: false,
        error: "Webhook signature verification failed."
      }
    :
    secret && provider === "stripe"
      ? verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret)
      : secret && provider === "github"
        ? verifyGithubSignature(
            rawBody,
            request.headers.get("x-hub-signature-256"),
            secret
          )
        : secret
          ? verifyGenericSignature(
              rawBody,
              request.headers.get("x-signature") || request.headers.get("x-webhook-secret"),
              secret
            )
          : {
              verified: true
            };

  let parsedBody: Record<string, unknown> = {};
  try {
    parsedBody =
      rawBody.trim().length > 0
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : {};
  } catch {
    parsedBody = {
      raw: rawBody
    };
  }

  const eventType = detectEventType(provider, request.headers, parsedBody);

  const createdEvent = await db.$transaction(async (tx) => {
    const event = await tx.webhookEvent.create({
      data: {
        endpointId: endpoint.id,
        businessId: endpoint.businessId,
        provider,
        eventType,
        payload: toJsonValue(parsedBody),
        rawBody,
        verified: verification.verified,
        status: verification.verified ? "received" : "failed",
        error: verification.verified ? null : verification.error
      }
    });

    await tx.webhookEndpoint.update({
      where: {
        id: endpoint.id
      },
      data: {
        lastReceivedAt: new Date(),
        totalReceived: {
          increment: 1
        }
      }
    });

    if (!secretState.configured) {
      await tx.logEvent.create({
        data: {
          businessId: endpoint.businessId,
          level: "warning",
          action: "webhook_unsecured",
          message: `Webhook endpoint ${endpoint.id} accepted an unsigned request.`,
          metadata: toJsonValue({
            endpointId: endpoint.id,
            provider
          })
        }
      });
    }

    return event;
  });

  if (!verification.verified) {
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: "Webhook signature verification failed."
        },
        { status: 401 }
      )
    );
  }

  if (endpoint.workflowId) {
    void processWorkflowForWebhook({
      workflowId: endpoint.workflowId,
      eventId: createdEvent.id,
      payload: parsedBody
    }).catch((error) => {
      console.error("Webhook processing failed", error);
    });
  }

  return addSecurityHeaders(
    NextResponse.json({
      received: true,
      eventId: createdEvent.id
    })
  );
}
