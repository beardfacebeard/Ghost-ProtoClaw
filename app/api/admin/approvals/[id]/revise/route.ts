import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";
import { executeAgentChat } from "@/lib/llm/agent-chat";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  instructions: z.string().trim().min(3).max(1000)
});

type RouteContext = { params: { id: string } };

/**
 * Which JSON fields inside actionDetail represent the "draft" for each
 * approval action type. For outreach replies and video captions we
 * rewrite a single string; for B-roll scenes the agent produces both
 * a caption AND a hookLine — we revise both in one pass.
 */
const DRAFT_FIELDS: Record<string, string[]> = {
  outreach_reply: ["draftReply"],
  video_clip: ["caption", "hookLine"]
};

function describeActionForPrompt(actionType: string): string {
  switch (actionType) {
    case "outreach_reply":
      return "an outbound reply that will be posted on Reddit / Hacker News / Stack Overflow / GitHub";
    case "video_clip":
      return "a short-form video clip caption and hook for TikTok / Shorts / Reels / X";
    default:
      return `a draft for action type "${actionType}"`;
  }
}

function extractStringField(
  detail: Record<string, unknown>,
  field: string
): string {
  const value = detail[field];
  return typeof value === "string" ? value : "";
}

function buildRevisionPrompt(params: {
  actionType: string;
  currentDraft: Record<string, string>;
  instructions: string;
}): string {
  const intro = `You previously drafted ${describeActionForPrompt(
    params.actionType
  )}. The user wants you to revise it based on their feedback.`;

  const draftBlock = Object.entries(params.currentDraft)
    .map(([field, value]) => `[${field}]\n${value}`)
    .join("\n\n");

  const fields = Object.keys(params.currentDraft).join(", ");

  return `${intro}

CURRENT DRAFT:
${draftBlock}

USER FEEDBACK:
${params.instructions}

INSTRUCTIONS:
Rewrite the draft per the user feedback. Keep the brand voice (honest,
concrete, no banned phrases like "passive income" / "guaranteed" /
"game-changer"). Stay within the draft's original purpose and platform
conventions.

Return ONLY a JSON object matching this exact shape — no preamble, no
markdown fences, no explanation:

{${Object.keys(params.currentDraft)
  .map((k) => `\n  "${k}": "<revised ${k} here>"`)
  .join(",")}\n}

The JSON keys must be exactly: ${fields}. Values must be plain strings.`;
}

function parseRevisedJson(
  response: string,
  expectedFields: string[]
): Record<string, string> | null {
  // LLMs sometimes wrap JSON in ``` fences despite instructions.
  const fenced = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const candidates = fenced
    ? [fenced[1], response]
    : [response];
  // Also try to find the first { ... } block if the model still added
  // a preamble.
  const bareMatch = response.match(/\{[\s\S]*\}/);
  if (bareMatch) candidates.push(bareMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        continue;
      }
      const result: Record<string, string> = {};
      for (const field of expectedFields) {
        const value = (parsed as Record<string, unknown>)[field];
        if (typeof value !== "string") {
          continue;
        }
        result[field] = value.trim();
      }
      if (Object.keys(result).length > 0) {
        return result;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = bodySchema.parse(await request.json());

    const approval = await db.approvalRequest.findUnique({
      where: { id: params.id },
      include: {
        business: {
          select: { id: true, organizationId: true, name: true }
        },
        agent: true
      }
    });

    if (!approval) throw notFound("Approval request not found.");
    if (approval.business?.organizationId !== session.organizationId) {
      throw notFound("Approval request not found.");
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, approval.businessId);
    }
    if (approval.status !== "pending") {
      throw badRequest(
        "Only pending approvals can be revised. This one is already " +
          `${approval.status}.`
      );
    }

    const draftFields = DRAFT_FIELDS[approval.actionType];
    if (!draftFields) {
      throw badRequest(
        `Action type "${approval.actionType}" does not support inline revision yet.`
      );
    }

    const currentDetail =
      approval.actionDetail &&
      typeof approval.actionDetail === "object" &&
      !Array.isArray(approval.actionDetail)
        ? (approval.actionDetail as Record<string, unknown>)
        : {};

    const currentDraft: Record<string, string> = {};
    for (const field of draftFields) {
      const value = extractStringField(currentDetail, field);
      if (value.length > 0) {
        currentDraft[field] = value;
      }
    }
    if (Object.keys(currentDraft).length === 0) {
      throw badRequest(
        "This approval has no revisable draft text — nothing to rewrite."
      );
    }

    // Resolve the agent to run. Prefer the original authoring agent;
    // fall back to any main-tier agent on the business so revision
    // works even when the original agent was deleted.
    let agent = approval.agent;
    if (!agent) {
      agent = await db.agent.findFirst({
        where: {
          businessId: approval.businessId,
          type: "main"
        }
      });
    }
    if (!agent) {
      throw badRequest(
        "No agent available to revise this draft. Add a main agent to this business first."
      );
    }

    const business = await db.business.findUnique({
      where: { id: approval.businessId }
    });
    if (!business) throw notFound("Business not found.");

    const prompt = buildRevisionPrompt({
      actionType: approval.actionType,
      currentDraft,
      instructions: body.instructions
    });

    const result = await executeAgentChat({
      agent: agent as unknown as Parameters<typeof executeAgentChat>[0]["agent"],
      business: business as unknown as Parameters<
        typeof executeAgentChat
      >[0]["business"],
      messages: [
        {
          role: "system",
          content:
            "You are a concise copy editor. Rewrite drafts per the user's feedback. Return STRICT JSON matching the requested shape — no preamble, no markdown fences, no commentary."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      organizationId: session.organizationId,
      endpoint: "approval_revision",
      tools: []
    });

    if (!result.success) {
      throw badRequest(result.hint ?? result.error ?? "Agent call failed.");
    }

    const revised = parseRevisedJson(
      result.response,
      Object.keys(currentDraft)
    );
    if (!revised) {
      throw badRequest(
        "Agent returned content that didn't parse as the expected JSON shape. Try rephrasing your instructions."
      );
    }

    // Build revised actionDetail, preserving everything else (url,
    // timestamps, etc.) and pushing the previous draft into a
    // revisions[] audit trail.
    const revisions = Array.isArray(currentDetail.revisions)
      ? [...(currentDetail.revisions as unknown[])]
      : [];
    revisions.push({
      at: new Date().toISOString(),
      instructions: body.instructions,
      previous: currentDraft,
      revisedBy: session.email ?? session.userId
    });

    const nextDetail = {
      ...currentDetail,
      ...revised,
      revisions
    };

    const updatedApproval = await db.approvalRequest.update({
      where: { id: approval.id },
      data: {
        actionDetail: JSON.parse(JSON.stringify(nextDetail))
      }
    });

    // Mirror to the linked ActivityEntry so /admin/targets and
    // /admin/clips show the revised draft immediately.
    const activityEntryId =
      typeof currentDetail.activityEntryId === "string"
        ? currentDetail.activityEntryId
        : null;
    if (activityEntryId) {
      try {
        const entry = await db.activityEntry.findUnique({
          where: { id: activityEntryId },
          select: { id: true, metadata: true }
        });
        if (entry) {
          const metadata =
            (entry.metadata as Record<string, unknown> | null) ?? {};
          await db.activityEntry.update({
            where: { id: entry.id },
            data: {
              metadata: JSON.parse(
                JSON.stringify({
                  ...metadata,
                  ...revised,
                  revisedAt: new Date().toISOString(),
                  revisedBy: session.email ?? session.userId
                })
              )
            }
          });
        }
      } catch (error) {
        console.error(
          "[approvals/revise] failed to mirror revision to ActivityEntry:",
          error
        );
      }
    }

    await db.activityEntry.create({
      data: {
        businessId: approval.businessId,
        type: "approval",
        title: "Approval draft revised",
        detail: `Draft revised by ${session.email ?? "admin"}: "${body.instructions.slice(0, 180)}"`,
        status: "pending",
        metadata: {
          approvalId: approval.id,
          actionType: approval.actionType,
          revisionCount: revisions.length
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        approval: {
          id: updatedApproval.id,
          actionDetail: updatedApproval.actionDetail
        },
        revised,
        revisions
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
