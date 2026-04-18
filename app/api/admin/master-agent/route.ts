import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import {
  MASTER_AGENT_TYPE,
  getMasterAgent,
  isMasterAgentEnabled
} from "@/lib/llm/master-agent";

export const dynamic = "force-dynamic";

const DEFAULT_MASTER_SYSTEM_PROMPT = `You are the Master Agent for Ghost ProtoClaw Mission Control. You operate at the organization level — above the per-business CEO agents.

Your role:
- You are the user's single entry point into Mission Control. When the user asks a question, you either answer directly (if it's about the platform itself or common knowledge) or you consult the relevant business's CEO agent.
- You have two tools: list_businesses (to see which businesses exist) and ask_ceo_agent (to ask a specific business's CEO a question).
- You CANNOT directly execute actions — no sending emails, no posting to social, no database changes. If an action is needed, you ask the appropriate CEO agent to perform it, and you report back what they did.
- Always name the CEO agent and business when you're relaying information, so the user knows who said what.

Communication style:
- Be concise and direct. Give the user the answer, not a process explanation.
- If multiple businesses are relevant, consult them in parallel when possible.
- If a CEO agent is unavailable, say so clearly rather than guessing.`;

/** GET — return the feature flag state and the current master agent (if any). */
export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const enabled = isMasterAgentEnabled();
    const master = enabled ? await getMasterAgent(session.organizationId) : null;

    return addSecurityHeaders(
      NextResponse.json({
        enabled,
        master: master
          ? {
              id: master.id,
              displayName: master.displayName,
              emoji: master.emoji,
              status: master.status,
              primaryModel: master.primaryModel,
              systemPrompt: master.systemPrompt
            }
          : null
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** POST — provision a master agent for this organization (one per org). */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    if (!isMasterAgentEnabled()) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "Master agent is disabled.",
            hint: "Set MASTER_AGENT_ENABLED=true in your environment to enable this feature."
          },
          { status: 403 }
        )
      );
    }

    const existing = await getMasterAgent(session.organizationId);
    if (existing) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "A master agent already exists for this organization.",
            masterAgentId: existing.id
          },
          { status: 409 }
        )
      );
    }

    const agent = await db.agent.create({
      data: {
        organizationId: session.organizationId,
        businessId: null,
        type: MASTER_AGENT_TYPE,
        status: "active",
        displayName: "Mission Control",
        emoji: "🛰️",
        role: "Master Agent",
        purpose:
          "Single entry point for the organization. Communicates with business CEO agents on the user's behalf.",
        systemPrompt: DEFAULT_MASTER_SYSTEM_PROMPT,
        modelSource: "system",
        runtime: "openclaw",
        safetyMode: "ask_before_acting",
        depth: 0
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        master: {
          id: agent.id,
          displayName: agent.displayName,
          emoji: agent.emoji,
          status: agent.status
        }
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
