import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
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
    dealId: string;
  };
};

const VALID_STATUSES = new Set([
  "lead",
  "contacted",
  "qualified",
  "under_contract",
  "assigned",
  "closed",
  "dead",
]);

const VALID_RESPONSE_STATES = new Set([
  "no_response",
  "not_interested",
  "wanted_time",
  "objection",
  "warm",
  "closed",
]);

const patchSchema = z.object({
  status: z.string().optional(),
  sellerResponseState: z.union([z.string(), z.null()]).optional(),
  notes: z.string().optional(),
  nextTouchAt: z
    .union([z.string().datetime(), z.null()])
    .optional()
    .transform((value) =>
      value === undefined
        ? undefined
        : value === null
          ? null
          : new Date(value)
    ),
});

async function authorize(
  request: NextRequest,
  businessId: string
): Promise<string> {
  const session = await getVerifiedSession(request);
  if (!session?.organizationId) {
    throw unauthorized();
  }
  if (session.role === "admin") {
    requireBusinessAccess(session, businessId);
  }
  const business = await db.business.findFirst({
    where: { id: businessId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!business) {
    throw notFound("Business not found.");
  }
  return session.organizationId;
}

/**
 * GET — single deal with its full signal stack.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await authorize(request, params.id);
    const deal = await db.deal.findFirst({
      where: { id: params.dealId, businessId: params.id },
      include: {
        signals: {
          orderBy: { weight: "desc" },
        },
      },
    });
    if (!deal) {
      throw notFound("Deal not found.");
    }
    return addSecurityHeaders(NextResponse.json({ deal }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * PATCH — update a subset of deal fields. Primary use: moving deals between
 * pipeline stages, recording seller response state, appending notes, and
 * scheduling next follow-up touches.
 *
 * Note: contract-generation fields (contractSignedAt, contractType,
 * purchasePrice, assignmentFee) are NOT settable via this route — they
 * flow through the binding-contract handlers (Phase 5) which re-verify
 * dealMode="contract" + AttorneyProfile for the property's state via
 * decideContractAction.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await authorize(request, params.id);
    const body = patchSchema.parse(await request.json());

    const existing = await db.deal.findFirst({
      where: { id: params.dealId, businessId: params.id },
      select: {
        id: true,
        status: true,
        contactAttempts: true,
        firstContactAt: true,
      },
    });
    if (!existing) {
      throw notFound("Deal not found.");
    }

    const updates: Parameters<typeof db.deal.update>[0]["data"] = {};

    if (body.status !== undefined) {
      if (!VALID_STATUSES.has(body.status)) {
        throw badRequest(
          `Invalid status "${body.status}". Must be one of: lead, contacted, qualified, under_contract, assigned, closed, dead.`
        );
      }
      updates.status = body.status;
      // Stamp firstContactAt on first move out of "lead" if not already set.
      if (
        existing.status === "lead" &&
        body.status !== "lead" &&
        body.status !== "dead" &&
        !existing.firstContactAt
      ) {
        updates.firstContactAt = new Date();
        updates.lastContactAt = new Date();
        updates.contactAttempts = (existing.contactAttempts ?? 0) + 1;
      }
    }

    if (body.sellerResponseState !== undefined) {
      if (
        body.sellerResponseState !== null &&
        !VALID_RESPONSE_STATES.has(body.sellerResponseState)
      ) {
        throw badRequest(
          `Invalid sellerResponseState "${body.sellerResponseState}".`
        );
      }
      updates.sellerResponseState = body.sellerResponseState;
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    if (body.nextTouchAt !== undefined) {
      updates.nextTouchAt = body.nextTouchAt;
    }

    if (Object.keys(updates).length === 0) {
      throw badRequest("No valid fields to update.");
    }

    const deal = await db.deal.update({
      where: { id: params.dealId },
      data: updates,
    });

    return addSecurityHeaders(NextResponse.json({ deal }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
