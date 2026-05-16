/**
 * Fair Housing quarterly audit attestation for the code-violation
 * addon (decision-default: quarterly cadence).
 *
 * GET  → returns current audit status (signedAt + signedBy + notes).
 * POST → records a new audit. Operator types verbatim phrase + may
 *        attach notes documenting the audit process (census tract
 *        breakdown, methodology, anomalies). Same pattern as the
 *        existing GLBA / per-state attestations.
 *
 * Stored on Business.config.codeViolation.{fairHousingAuditedAt,
 * fairHousingAuditedBy, fairHousingAuditNotes}.
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

const FAIR_HOUSING_PHRASE = "I COMPLETED A FAIR HOUSING DISPARATE IMPACT REVIEW";

const postSchema = z.object({
  acceptedPhrase: z.string(),
  notes: z.string().max(4000).optional(),
  action: z.enum(["sign", "retract"]).default("sign")
});

function ageDaysFromIso(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

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
    const cv = cfg?.codeViolation as
      | {
          fairHousingAuditedAt?: string;
          fairHousingAuditedBy?: string;
          fairHousingAuditNotes?: string;
        }
      | undefined;

    const ageDays = ageDaysFromIso(cv?.fairHousingAuditedAt);

    return addSecurityHeaders(
      NextResponse.json({
        businessId: business.id,
        businessName: business.name,
        attestationPhrase: FAIR_HOUSING_PHRASE,
        audit: {
          signedAt: cv?.fairHousingAuditedAt ?? null,
          signedBy: cv?.fairHousingAuditedBy ?? null,
          notes: cv?.fairHousingAuditNotes ?? null,
          ageDays,
          stale: ageDays === null || ageDays > 90,
          dueAt: cv?.fairHousingAuditedAt
            ? new Date(
                new Date(cv.fairHousingAuditedAt).getTime() +
                  90 * 24 * 60 * 60 * 1000
              ).toISOString()
            : null
        }
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
    const existingCv =
      existingConfig.codeViolation &&
      typeof existingConfig.codeViolation === "object" &&
      !Array.isArray(existingConfig.codeViolation)
        ? (existingConfig.codeViolation as Record<string, unknown>)
        : {};

    if (body.action === "retract") {
      const nextCv = { ...existingCv };
      delete nextCv.fairHousingAuditedAt;
      delete nextCv.fairHousingAuditedBy;
      delete nextCv.fairHousingAuditNotes;
      const newConfig = { ...existingConfig, codeViolation: nextCv };
      await db.business.update({
        where: { id: params.id },
        data: { config: newConfig as Prisma.InputJsonValue }
      });
      return addSecurityHeaders(
        NextResponse.json({
          ok: true,
          message:
            "Fair Housing audit retracted. The State Compliance Review Agent will surface a warning on every outreach draft until you re-audit."
        })
      );
    }

    if (
      (body.acceptedPhrase ?? "").trim().toUpperCase() !== FAIR_HOUSING_PHRASE
    ) {
      throw badRequest(
        `To record a Fair Housing audit, type exactly "${FAIR_HOUSING_PHRASE}" in the confirmation field. This records your acknowledgment that you have run a disparate-impact review across the operator's lead-selection algorithm + outreach lists by census tract.`
      );
    }

    const newCv = {
      ...existingCv,
      fairHousingAuditedAt: new Date().toISOString(),
      fairHousingAuditedBy: session.email ?? session.userId ?? "unknown",
      fairHousingAuditNotes: body.notes?.trim() || undefined
    };
    const newConfig = { ...existingConfig, codeViolation: newCv };
    await db.business.update({
      where: { id: params.id },
      data: { config: newConfig as Prisma.InputJsonValue }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        message:
          "Fair Housing audit recorded. Next audit due in ~90 days; the dashboard will surface a reminder before then."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
