import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { updateBusiness } from "@/lib/repository/businesses";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized,
} from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const bodySchema = z.object({
  targetMode: z.enum(["research", "outreach", "contract"]),
  // The client passes the exact disclosure phrase the user typed, so the
  // server can validate it rather than trusting a boolean.
  acceptedDisclosure: z.string().optional(),
});

const OUTREACH_UPGRADE_PHRASE = "I ATTEST TCPA COMPLIANCE";
const CONTRACT_UPGRADE_PHRASE = "I ACCEPT CONTRACT RESPONSIBILITY";

/**
 * Deal-mode transition handler for the Dealhawk Empire template.
 *
 * Tier rules:
 *   - Downgrades (any → research, or contract → outreach) are always
 *     allowed and take effect immediately.
 *   - Research → Outreach: requires the business to be materialized from
 *     the dealhawk_empire template AND the client to confirm the TCPA
 *     attestation phrase. On success, tcpaAttestedAt / tcpaAttestedBy are
 *     stamped to the Business.
 *   - Outreach → Contract: requires (a) dealhawk_empire template, (b)
 *     TCPA attestation on file (i.e. the research → outreach transition
 *     has already happened at some point), (c) at least one active
 *     AttorneyProfile on the business, AND (d) the client to confirm
 *     the attorney-on-file phrase. Per-deal state verification still
 *     happens at binding-contract generation time — see
 *     lib/dealhawk/mode-gate.ts → decideContractAction.
 *
 * Upgrades also work transitively (research → contract in a single call)
 * as long as all preconditions for both hops are satisfied.
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
        dealMode: true,
        tcpaAttestedAt: true,
        config: true,
      },
    });

    if (!business) {
      throw notFound("Business not found.");
    }

    const templateId =
      business.config &&
      typeof business.config === "object" &&
      !Array.isArray(business.config) &&
      typeof (business.config as { templateId?: unknown }).templateId ===
        "string"
        ? (business.config as { templateId: string }).templateId
        : null;

    const current = (business.dealMode ?? "research") as
      | "research"
      | "outreach"
      | "contract";
    const target = body.targetMode;

    if (current === target) {
      return addSecurityHeaders(
        NextResponse.json({ business: { id: business.id, dealMode: current } })
      );
    }

    const isDealhawkTemplate = templateId === "dealhawk_empire";

    // Downgrades are always allowed as a safety no-op.
    const isDowngrade =
      (current === "contract" &&
        (target === "outreach" || target === "research")) ||
      (current === "outreach" && target === "research");

    if (isDowngrade) {
      await updateBusiness(params.id, session.organizationId, {
        dealMode: target,
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for"),
      });
      return addSecurityHeaders(
        NextResponse.json({
          business: { id: business.id, dealMode: target },
          message: `Deal mode downgraded to ${target}. Outreach and contract generation are now gated accordingly.`,
        })
      );
    }

    // Upgrade: research → outreach.
    if (current === "research" && target === "outreach") {
      if (!isDealhawkTemplate) {
        throw badRequest(
          "Only businesses materialized from the Dealhawk Empire template can switch to Outreach mode."
        );
      }
      if (
        (body.acceptedDisclosure ?? "").trim().toUpperCase() !==
        OUTREACH_UPGRADE_PHRASE
      ) {
        throw badRequest(
          `To upgrade to Outreach mode, type exactly "${OUTREACH_UPGRADE_PHRASE}" in the confirmation field. This attests that every SMS / cold call / mail touch will honor the TCPA, the national DNC list, opt-outs, and state-specific wholesaler disclosure requirements.`
        );
      }
      await updateBusiness(params.id, session.organizationId, {
        dealMode: "outreach",
        tcpaAttestedAt: new Date(),
        tcpaAttestedBy: session.email ?? session.userId ?? "unknown",
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for"),
      });
      return addSecurityHeaders(
        NextResponse.json({
          business: { id: business.id, dealMode: "outreach" },
          message:
            "Deal mode upgraded to Outreach. TCPA attestation recorded. Seller-facing SMS, mail, and cold calls are now allowed through the approval queue. Binding contracts are still blocked until you add attorneys on file and upgrade to Contract mode.",
        })
      );
    }

    // Upgrade: outreach → contract (or transitively research → contract).
    if (target === "contract") {
      if (!isDealhawkTemplate) {
        throw badRequest(
          "Only businesses materialized from the Dealhawk Empire template can switch to Contract mode."
        );
      }
      if (
        current === "research" &&
        (body.acceptedDisclosure ?? "").trim().toUpperCase() !==
          CONTRACT_UPGRADE_PHRASE
      ) {
        // Transitive upgrade attempt without first attesting TCPA — block.
        throw badRequest(
          "Upgrade to Outreach first so you can complete the TCPA attestation, then upgrade to Contract. Research → Contract in one hop is not supported as a safety rail."
        );
      }
      if (!business.tcpaAttestedAt) {
        throw badRequest(
          "TCPA attestation is not on file for this business. Downgrade to Research and upgrade to Outreach first to record the attestation."
        );
      }
      if (
        (body.acceptedDisclosure ?? "").trim().toUpperCase() !==
        CONTRACT_UPGRADE_PHRASE
      ) {
        throw badRequest(
          `To upgrade to Contract mode, type exactly "${CONTRACT_UPGRADE_PHRASE}" in the confirmation field.`
        );
      }
      await updateBusiness(params.id, session.organizationId, {
        dealMode: "contract",
        actorUserId: session.userId,
        actorEmail: session.email,
        ipAddress: request.headers.get("x-forwarded-for"),
      });
      return addSecurityHeaders(
        NextResponse.json({
          business: { id: business.id, dealMode: "contract" },
          message:
            "Deal mode upgraded to Contract. The desk may now generate binding purchase agreements, assignments, Sub-To packages, LOIs, and disposition blasts. Attorney review is STRONGLY recommended for Sub-To and other creative-finance structures (novation, wraps, lease-options, contract-for-deed) and in statute-heavy states (IL, OK, NJ, NY, CA, etc.) — add attorneys on file in the roster to get them cited in generated paperwork.",
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
