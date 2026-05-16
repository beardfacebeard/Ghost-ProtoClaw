/**
 * Code-violation addon enable/disable toggle.
 *
 * Flips Business.config.codeViolation.enabled. Enabling activates the
 * daily code-violation sweep + the addon's agents. Does not bypass
 * any compliance gates — Fair Housing audit + State Compliance Review
 * + per-state attestation (when cross-module) are still required
 * before outreach fires.
 *
 * Disabling preserves all attestations, filters, and audit history
 * so the operator can re-enable without re-attesting.
 */

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const bodySchema = z.object({
  enabled: z.boolean()
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const body = bodySchema.parse(await request.json());

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, config: true }
    });
    if (!business) throw notFound("Business not found.");

    const config =
      business.config && typeof business.config === "object" && !Array.isArray(business.config)
        ? (business.config as Record<string, unknown>)
        : {};
    const templateId =
      typeof config.templateId === "string" ? (config.templateId as string) : null;
    if (templateId !== "dealhawk_empire") {
      throw badRequest(
        "The code-violation addon is only available on businesses materialized from the Dealhawk Empire template."
      );
    }

    const existingCv =
      config.codeViolation &&
      typeof config.codeViolation === "object" &&
      !Array.isArray(config.codeViolation)
        ? (config.codeViolation as Record<string, unknown>)
        : {};

    const newConfig = {
      ...config,
      codeViolation: { ...existingCv, enabled: body.enabled }
    };

    await db.business.update({
      where: { id: params.id },
      data: { config: newConfig as Prisma.InputJsonValue }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        enabled: body.enabled,
        message: body.enabled
          ? "Code-violation addon enabled. Daily sweep will fire at the next sourcing-sweep hour. Outreach is still gated by the Fair Housing audit + per-state attestation (when a code-violation lead also has a foreclosure signal)."
          : "Code-violation addon disabled. Daily sweep paused. Existing CodeViolationRecord rows + Fair Housing audit history are preserved."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
