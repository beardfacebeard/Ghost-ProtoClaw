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
  /** Single state code OR — for bulk-attest — an array of codes.
   *  Exactly one of `state` / `states` must be present. */
  state: z.string().min(2).max(2).optional(),
  states: z.array(z.string().min(2).max(2)).optional(),
  acceptedPhrase: z.string(),
  /** Optional counsel-reviewed override. When present, replaces the
   *  ship-default statutoryNotice for outreach in this state. Not
   *  applied in bulk mode (per-state override is operator-by-state). */
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

    // Normalize to a list of state codes. Exactly one of state / states.
    const stateKeysRaw = body.states ?? (body.state ? [body.state] : []);
    if (stateKeysRaw.length === 0) {
      throw badRequest("Either `state` or `states[]` is required.");
    }
    if (body.states && body.state) {
      throw badRequest("Pass only one of `state` or `states[]`, not both.");
    }
    const stateKeys = Array.from(
      new Set(stateKeysRaw.map((s) => s.trim().toUpperCase()))
    );

    // Validate every code before any DB write.
    const unknown: string[] = [];
    for (const sk of stateKeys) {
      if (!getForeclosureCompliance(sk)) unknown.push(sk);
    }
    if (unknown.length > 0) {
      throw badRequest(
        `Unknown state code(s) "${unknown.join(", ")}". Use 2-letter USPS codes (or "DC").`
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
      const next: Record<string, StateAttestation> = { ...existingAttestations };
      for (const sk of stateKeys) delete next[sk];
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
          states: stateKeys,
          retracted: stateKeys.length,
          message:
            stateKeys.length === 1
              ? `Retracted attestation for ${stateKeys[0]}. Outreach is now blocked until you re-attest.`
              : `Retracted attestations for ${stateKeys.length} states. Outreach to leads in those states is now blocked until you re-attest.`
        })
      );
    }

    // Attest. Verify the verbatim phrase ONCE for the whole batch.
    if (
      (body.acceptedPhrase ?? "").trim().toUpperCase() !== ATTESTATION_PHRASE
    ) {
      throw badRequest(
        `To attest, type exactly "${ATTESTATION_PHRASE}" in the confirmation field. This records your acknowledgment that you have reviewed each state's ship-default statutory notice (or your counsel-reviewed override) and accept responsibility for compliance in each state.`
      );
    }

    const attestedAt = new Date().toISOString();
    const attestedBy = session.email ?? session.userId ?? "unknown";

    const next: Record<string, StateAttestation> = { ...existingAttestations };
    for (const sk of stateKeys) {
      const attestation: StateAttestation = { attestedAt, attestedBy };
      // Per-state templateOverride is only honored in single-state mode.
      if (stateKeys.length === 1 && body.templateOverride?.trim()) {
        attestation.templateOverride = body.templateOverride.trim();
      }
      next[sk] = attestation;
    }
    const newConfig = {
      ...existingConfig,
      preForeclosure: { ...existingPre, attestations: next }
    };
    await db.business.update({
      where: { id: params.id },
      data: { config: newConfig }
    });

    // Build a friendly message; flag any criminal-exposure states in the batch.
    const criminalCodes = stateKeys.filter((sk) => {
      const entry = getForeclosureCompliance(sk);
      return entry?.tier === "criminal_exposure";
    });

    let message: string;
    if (stateKeys.length === 1) {
      const sk = stateKeys[0];
      const entry = getForeclosureCompliance(sk);
      const isCriminal = entry?.tier === "criminal_exposure";
      message = `Attested for ${entry?.fullName ?? sk}. Outreach to leads in ${sk} is now permitted${
        isCriminal
          ? " — note this state carries criminal exposure for non-compliance; verify your draft with counsel before launch"
          : ""
      }.`;
    } else {
      message = `Attested for ${stateKeys.length} states (${stateKeys.join(", ")}).${
        criminalCodes.length > 0
          ? ` ${criminalCodes.length} of them carry criminal exposure (${criminalCodes.join(", ")}) — verify your drafts with counsel before launch.`
          : ""
      }`;
    }

    // For backward compat: single-state callers expect attestation +
    // state + attested fields on the response.
    if (stateKeys.length === 1) {
      return addSecurityHeaders(
        NextResponse.json({
          ok: true,
          state: stateKeys[0],
          attested: true,
          attestation: next[stateKeys[0]],
          message
        })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        states: stateKeys,
        attested: stateKeys.length,
        message
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
