/**
 * GLBA / DPPA attestation for the pre-foreclosure addon's skip-trace flow.
 *
 * Mirrors the existing TCPA attestation pattern on deal-mode upgrades.
 * The operator types a verbatim phrase confirming they understand the
 * GLBA/DPPA permissible-purpose framework and accept responsibility for
 * recording purposeCode on every skip-trace query.
 *
 * Storage: Business.config.preForeclosure.glbaAttestation = {
 *   signedAt: ISO datetime,
 *   signedBy: email,
 *   agreedText: the phrase the operator typed (for the audit trail)
 * }.
 *
 * Without this attestation on file, the Skip Trace Agent refuses to
 * fire — every skip-trace query becomes a hard manual operator-approval
 * step (consistent with the $0/mo default cap from decision #6).
 */

import { Prisma } from "@prisma/client";
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

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const GLBA_PHRASE = "I ACCEPT GLBA AND DPPA RESPONSIBILITY";

const postSchema = z.object({
  acceptedPhrase: z.string(),
  action: z.enum(["sign", "retract"]).default("sign")
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, name: true, config: true }
    });
    if (!business) throw notFound("Business not found.");

    const cfg = business.config as Record<string, unknown> | null;
    const pre = cfg?.preForeclosure as Record<string, unknown> | undefined;
    const glba = pre?.glbaAttestation as
      | { signedAt?: string; signedBy?: string; agreedText?: string }
      | undefined;

    return addSecurityHeaders(
      NextResponse.json({
        businessId: business.id,
        businessName: business.name,
        attestationPhrase: GLBA_PHRASE,
        signed: Boolean(glba?.signedAt),
        signedAt: glba?.signedAt ?? null,
        signedBy: glba?.signedBy ?? null
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const body = postSchema.parse(await request.json());

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, config: true }
    });
    if (!business) throw notFound("Business not found.");

    const existingConfig =
      business.config && typeof business.config === "object" && !Array.isArray(business.config)
        ? (business.config as Record<string, unknown>)
        : {};
    const existingPre =
      existingConfig.preForeclosure &&
      typeof existingConfig.preForeclosure === "object" &&
      !Array.isArray(existingConfig.preForeclosure)
        ? (existingConfig.preForeclosure as Record<string, unknown>)
        : {};

    if (body.action === "retract") {
      const nextPre = { ...existingPre };
      delete nextPre.glbaAttestation;
      const newConfig = { ...existingConfig, preForeclosure: nextPre };
      await db.business.update({
        where: { id: params.id },
        data: { config: newConfig as Prisma.InputJsonValue }
      });
      return addSecurityHeaders(
        NextResponse.json({
          ok: true,
          signed: false,
          message:
            "GLBA/DPPA attestation retracted. The Skip Trace Agent will now refuse skip-trace queries until you re-sign."
        })
      );
    }

    if ((body.acceptedPhrase ?? "").trim().toUpperCase() !== GLBA_PHRASE) {
      throw badRequest(
        `To sign the GLBA/DPPA attestation, type exactly "${GLBA_PHRASE}" in the confirmation field. This records your acknowledgment that you understand the permissible-purpose framework under GLBA § 6802 and DPPA § 2721, and that you will record a valid purposeCode on every skip-trace query.`
      );
    }

    const newPre = {
      ...existingPre,
      glbaAttestation: {
        signedAt: new Date().toISOString(),
        signedBy: session.email ?? session.userId ?? "unknown",
        agreedText: GLBA_PHRASE
      }
    };
    const newConfig = { ...existingConfig, preForeclosure: newPre };
    await db.business.update({
      where: { id: params.id },
      data: { config: newConfig as Prisma.InputJsonValue }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        signed: true,
        message:
          "GLBA/DPPA attestation recorded. Skip-trace queries are still gated by the per-business spend cap (default $0/mo = manual operator approval per query) — raise the cap in spend ceilings to switch to auto-fire mode."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
