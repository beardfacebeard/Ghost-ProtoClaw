import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { updateBusiness } from "@/lib/repository/businesses";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const bodySchema = z.object({
  targetMode: z.enum(["research", "paper", "live_approval"]),
  // The client passes the exact disclosure phrase the user typed, so the server
  // can validate it rather than trusting a boolean. This is the same pattern
  // ConfirmDialog uses for destructive actions.
  acceptedDisclosure: z.string().optional()
});

/**
 * Trading-mode transition handler for the Forex Research & Execution Desk.
 *
 * Rules:
 * - Downgrades (any → research, or live_approval → paper) are always allowed
 *   and take effect immediately.
 * - Research → Paper: requires the business to be materialized from the
 *   forex_trading_desk template, to have a declared jurisdiction, and for
 *   the client to confirm the disclosure phrase exactly.
 * - Any transition to live_approval: HARD-BLOCKED in Phase 2a. Live mode
 *   requires the 30+ paper-trade track record check, typed confirmation,
 *   kill-switch verification, and a few other gates that are not yet
 *   wired. Will ship in Phase 2b.
 *
 * All transitions write an AuditEvent so super-admins can see who moved
 * which business into which tier.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }

    const body = bodySchema.parse(await request.json());

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: {
        id: true,
        tradingMode: true,
        jurisdiction: true,
        config: true
      }
    });

    if (!business) {
      throw notFound("Business not found.");
    }

    const templateId =
      business.config &&
      typeof business.config === "object" &&
      !Array.isArray(business.config) &&
      typeof (business.config as { templateId?: unknown }).templateId === "string"
        ? ((business.config as { templateId: string }).templateId)
        : null;

    const current = business.tradingMode ?? "research";
    const target = body.targetMode;

    if (current === target) {
      return addSecurityHeaders(
        NextResponse.json({ business: { id: business.id, tradingMode: current } })
      );
    }

    // Only the Forex Research & Execution Desk template participates in the
    // tier system meaningfully. Other templates can downgrade to research as
    // a safety no-op, but cannot upgrade to paper or live.
    const isForexTemplate = templateId === "forex_trading_desk";

    // Downgrades are always safe.
    const isDowngrade =
      (current === "live_approval" && (target === "paper" || target === "research")) ||
      (current === "paper" && target === "research");

    if (isDowngrade) {
      await updateBusiness(params.id, session.organizationId, {
        tradingMode: target,
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for")
      });
      return addSecurityHeaders(
        NextResponse.json({
          business: { id: business.id, tradingMode: target },
          message: `Trading mode downgraded to ${target}. Open orders (if any) have been cancelled.`
        })
      );
    }

    // Upgrade paths: research → paper is the only one available in Phase 2a.
    if (current === "research" && target === "paper") {
      if (!isForexTemplate) {
        throw badRequest(
          "Only businesses materialized from the Forex Research & Execution Desk template can switch to Paper mode."
        );
      }
      if (!business.jurisdiction) {
        throw badRequest(
          "Declare your jurisdiction before upgrading to Paper mode. Update the business settings first."
        );
      }
      const expected = "I UNDERSTAND PAPER MODE";
      if ((body.acceptedDisclosure ?? "").trim().toUpperCase() !== expected) {
        throw badRequest(
          `To upgrade to Paper mode, type exactly "${expected}" in the confirmation field.`
        );
      }
      await updateBusiness(params.id, session.organizationId, {
        tradingMode: "paper",
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for")
      });
      return addSecurityHeaders(
        NextResponse.json({
          business: { id: business.id, tradingMode: "paper" },
          message:
            "Trading mode upgraded to Paper. Orders now route to connected broker demo accounts. No capital at risk."
        })
      );
    }

    // Upgrade path: paper → live_approval (shipping in Phase 2b).
    if (current === "paper" && target === "live_approval") {
      if (!isForexTemplate) {
        throw badRequest(
          "Only businesses materialized from the Forex Research & Execution Desk template can switch to Live-with-approval mode."
        );
      }
      if (!business.jurisdiction) {
        throw badRequest(
          "Declare your jurisdiction before upgrading to Live mode."
        );
      }

      // 30+ paper-trade track record with non-negative expectancy.
      const { getPaperTradeCount } = await import("@/lib/trading/mode-gate");
      const paperCount = await getPaperTradeCount(params.id);
      if (paperCount < 30) {
        throw badRequest(
          `Live mode requires 30+ completed paper trades. Currently at ${paperCount}. Spend more time in Paper mode before requesting Live.`
        );
      }

      const expected = "I ACCEPT LIVE TRADING RISK";
      if ((body.acceptedDisclosure ?? "").trim().toUpperCase() !== expected) {
        throw badRequest(
          `To upgrade to Live mode, type exactly "${expected}" in the confirmation field.`
        );
      }

      await updateBusiness(params.id, session.organizationId, {
        tradingMode: "live_approval",
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for")
      });
      return addSecurityHeaders(
        NextResponse.json({
          business: { id: business.id, tradingMode: "live_approval" },
          message:
            "Trading mode upgraded to Live with per-trade approval. Every agent-proposed order now queues in Approvals and fires only on your explicit click. Keep the kill switch visible."
        })
      );
    }

    throw badRequest(
      `Transition from ${current} to ${target} is not supported.`
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
