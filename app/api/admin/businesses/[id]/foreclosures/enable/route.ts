/**
 * Pre-foreclosure addon enable/disable toggle.
 *
 * Flips Business.config.preForeclosure.enabled. Enabling is the
 * single user-visible gate that activates the daily pre-foreclosure
 * sweep + the addon's agent surface; it does NOT bypass any
 * downstream compliance gates (per-state attestation + GLBA
 * attestation are still required before outreach or skip-trace fire).
 *
 * Disabling is reversible — recorded attestations stay on file in
 * config so the operator can re-enable without re-attesting.
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

    // Only Dealhawk-templated businesses can enable the addon.
    const config =
      business.config && typeof business.config === "object" && !Array.isArray(business.config)
        ? (business.config as Record<string, unknown>)
        : {};
    const templateId =
      typeof config.templateId === "string" ? (config.templateId as string) : null;
    if (templateId !== "dealhawk_empire") {
      throw badRequest(
        "The pre-foreclosure addon is only available on businesses materialized from the Dealhawk Empire template."
      );
    }

    const existingPre =
      config.preForeclosure && typeof config.preForeclosure === "object" && !Array.isArray(config.preForeclosure)
        ? (config.preForeclosure as Record<string, unknown>)
        : {};

    const newConfig = {
      ...config,
      preForeclosure: {
        ...existingPre,
        enabled: body.enabled
      }
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
          ? "Pre-foreclosure addon enabled. Daily sweep will fire at the next sourcing-sweep hour. Outreach is still blocked until you complete per-state attestations + the GLBA attestation."
          : "Pre-foreclosure addon disabled. Daily sweep paused. Existing ForeclosureRecord rows + attestations are preserved."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
