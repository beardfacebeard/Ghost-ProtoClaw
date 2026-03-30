import { performance } from "node:perf_hooks";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { getSystemDefaultModel, resolveAgentModel } from "@/lib/models/agent-models";
import { getAgentById } from "@/lib/repository/agents";

const testSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(4000)
});

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = testSchema.parse(await request.json());
    const agent = await getAgentById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!agent) {
      throw notFound("Agent not found.");
    }

    const openclawUrl =
      process.env.OPENCLAW_API_URL ?? process.env.OPENCLAW_GATEWAY_URL;

    if (!openclawUrl) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "OpenClaw not configured",
            hint: "Configure OPENCLAW_API_URL in Settings"
          },
          { status: 400 }
        )
      );
    }

    const systemDefault = getSystemDefaultModel();
    const resolved = resolveAgentModel(agent, agent.business, systemDefault);
    const startedAt = performance.now();

    const response = await fetch(
      `${openclawUrl.replace(/\/$/, "")}/agents/test`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.OPENCLAW_GATEWAY_TOKEN
            ? {
                Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`
              }
            : {})
        },
        body: JSON.stringify({
          agentId: agent.id,
          organizationId: session.organizationId,
          businessId: agent.businessId,
          model: resolved.model,
          message: body.message,
          context: {
            displayName: agent.displayName,
            role: agent.role,
            purpose: agent.purpose,
            tools: Array.isArray(agent.tools) ? agent.tools : []
          }
        })
      }
    );

    const latencyMs = Math.round(performance.now() - startedAt);
    const payload = (await response.json().catch(() => null)) as
      | {
          response?: string;
          model?: string;
          error?: string;
          hint?: string;
        }
      | null;

    if (!response.ok) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: payload?.error || "Agent test failed",
            hint:
              payload?.hint ||
              "Check your OpenClaw connection and runtime settings."
          },
          { status: response.status }
        )
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        response:
          payload?.response ||
          "OpenClaw responded without a message payload.",
        latencyMs,
        model: payload?.model || resolved.model
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
