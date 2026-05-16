/**
 * Per-state operator attestation for the pre-foreclosure addon.
 *
 * GET   → returns the attestation map + the full FORECLOSURE_STATE_COMPLIANCE
 *         catalog so the UI can render every state's status (attested /
 *         not-yet) + the ship-default statutory notice it would surface.
 * POST  → records an attestation for one state. Mirrors the deal-mode
 *         attestation pattern (verbatim attestation phrase required;
 *         counsel-reviewed templateOverride optional).
 *
 * Storage shape: Business.config.preForeclosure.attestations is a
 * Record<stateCode, { attestedAt, attestedBy, templateOverride? }>.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  FORECLOSURE_STATE_COMPLIANCE,
  allForeclosureStateCodes,
  getForeclosureCompliance,
  parseAttestations,
  type StateAttestation
} from "@/lib/dealhawk/foreclosure-state-compliance";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const ATTESTATION_PHRASE = "I HAVE REVIEWED THE STATE NOTICE";

const postSchema = z.object({
  state: z.string().min(2).max(2),
  acceptedPhrase: z.string(),
  /** Optional counsel-reviewed override. When present, replaces the
   *  ship-default statutoryNotice for outreach in this state. */
  templateOverride: z.string().optional(),
  /** Operator can also retract an existing attestation. */
  action: z.enum(["attest", "retract"]).default("attest")
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

    const attestations = parseAttestations(business.config);
    const states = allForeclosureStateCodes().map((code) => {
      const entry = FORECLOSURE_STATE_COMPLIANCE[code];
      const attestation = attestations[code];
      return {
        state: entry.state,
        fullName: entry.fullName,
        tier: entry.tier,
        regime: entry.regime,
        rescissionDays: entry.rescissionDays,
        rescissionBusinessDays: entry.rescissionBusinessDays ?? false,
        statutoryNotice: entry.statutoryNotice,
        exposureSummary: entry.exposureSummary,
        references: entry.references,
        lastReviewedAt: entry.lastReviewedAt,
        attested: Boolean(attestation?.attestedAt),
        attestedAt: attestation?.attestedAt ?? null,
        attestedBy: attestation?.attestedBy ?? null,
        hasTemplateOverride: Boolean(attestation?.templateOverride?.trim())
      };
    });

    return addSecurityHeaders(
      NextResponse.json({
        businessId: business.id,
        businessName: business.name,
        attestationPhrase: ATTESTATION_PHRASE,
        states
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
    const stateKey = body.state.trim().toUpperCase();
    const entry = getForeclosureCompliance(stateKey);
    if (!entry) {
      throw badRequest(
        `Unknown state code "${body.state}". Use a 2-letter USPS code (or "DC").`
      );
    }

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
    const existingAttestations =
      existingPre.attestations &&
      typeof existingPre.attestations === "object" &&
      !Array.isArray(existingPre.attestations)
        ? (existingPre.attestations as Record<string, StateAttestation>)
        : {};

    if (body.action === "retract") {
      const next = { ...existingAttestations };
      delete next[stateKey];
      const newConfig = {
        ...existingConfig,
        preForeclosure: { ...existingPre, attestations: next }
      };
      await db.business.update({
        where: { id: params.id },
        data: { config: newConfig }
      });
      return addSecurityHeaders(
        NextResponse.json({
          ok: true,
          state: stateKey,
          attested: false,
          message: `Retracted attestation for ${entry.fullName}. Outreach to leads in ${stateKey} is now blocked until you re-attest.`
        })
      );
    }

    // Attest. Verify the verbatim phrase.
    if (
      (body.acceptedPhrase ?? "").trim().toUpperCase() !== ATTESTATION_PHRASE
    ) {
      throw badRequest(
        `To attest for ${entry.fullName}, type exactly "${ATTESTATION_PHRASE}" in the confirmation field. This records your acknowledgment that you have reviewed the ship-default statutory notice (or your counsel-reviewed override) and accept responsibility for compliance in ${entry.fullName}.`
      );
    }

    const attestation: StateAttestation = {
      attestedAt: new Date().toISOString(),
      attestedBy: session.email ?? session.userId ?? "unknown"
    };
    if (body.templateOverride?.trim()) {
      attestation.templateOverride = body.templateOverride.trim();
    }

    const next = { ...existingAttestations, [stateKey]: attestation };
    const newConfig = {
      ...existingConfig,
      preForeclosure: { ...existingPre, attestations: next }
    };
    await db.business.update({
      where: { id: params.id },
      data: { config: newConfig }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        state: stateKey,
        attested: true,
        attestation,
        message: `Attested for ${entry.fullName}. Outreach to leads in ${stateKey} is now permitted${
          entry.tier === "criminal_exposure"
            ? " — note this state carries criminal exposure for non-compliance; verify your draft with counsel before launch"
            : ""
        }.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
