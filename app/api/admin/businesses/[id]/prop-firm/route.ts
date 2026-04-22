import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { apiErrorResponse, badRequest, notFound, unauthorized } from "@/lib/errors";
import { getPresetByKey } from "@/lib/trading/prop-firm-presets";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

const attachSchema = z.object({
  firmKey: z.string().trim().min(1),
  planName: z.string().trim().min(1).optional(),
  startingBalance: z.number().positive(),
  // If true, pull the preset's rules as-is. If false, caller must provide
  // customRules — used for "custom" firmKey.
  usePreset: z.boolean(),
  customRules: z.unknown().optional()
});

/**
 * GET — returns the active PropFirmProfile for a business (or null).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) {
      throw unauthorized();
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true }
    });
    if (!business) {
      throw notFound("Business not found.");
    }

    const profile = await db.propFirmProfile.findFirst({
      where: { businessId: params.id, isActive: true },
      orderBy: { createdAt: "desc" }
    });

    return addSecurityHeaders(NextResponse.json({ profile }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * POST — attach a new active PropFirmProfile. Any previously-active profile
 * for the same business is marked inactive in the same transaction so only
 * one active profile exists at a time.
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

    const body = attachSchema.parse(await request.json());

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, jurisdiction: true, config: true }
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

    if (templateId !== "forex_trading_desk") {
      throw badRequest(
        "PropFirmProfiles can only be attached to Forex Research & Execution Desk businesses."
      );
    }

    // Resolve the preset if usePreset=true.
    let planName = body.planName;
    let rules: unknown;
    if (body.usePreset) {
      const preset = getPresetByKey(body.firmKey);
      if (!preset) {
        throw badRequest(
          `Unknown prop-firm key "${body.firmKey}". Use GET /api/admin/prop-firm-presets to see the list.`
        );
      }
      if (
        business.jurisdiction &&
        !preset.jurisdictionFit.includes(business.jurisdiction)
      ) {
        throw badRequest(
          `The "${preset.firmName}" preset does not accept traders from jurisdiction "${business.jurisdiction}". Pick a compatible firm or use "custom".`
        );
      }
      planName = planName ?? preset.planName;
      rules = preset.rules;
    } else {
      if (!body.customRules) {
        throw badRequest(
          "When usePreset is false, customRules must be provided."
        );
      }
      planName = planName ?? "Custom Plan";
      rules = body.customRules;
    }

    const profile = await db.$transaction(async (tx) => {
      // Deactivate any existing active profile.
      await tx.propFirmProfile.updateMany({
        where: { businessId: params.id, isActive: true },
        data: { isActive: false, status: "archived" }
      });
      // Create the new one.
      return tx.propFirmProfile.create({
        data: {
          organizationId: session.organizationId!,
          businessId: params.id,
          firmKey: body.firmKey,
          planName: planName!,
          startingBalance: body.startingBalance,
          highWaterMark: body.startingBalance,
          rules: rules as object,
          isActive: true,
          status: "active"
        }
      });
    });

    return addSecurityHeaders(
      NextResponse.json({
        profile,
        message: `Attached ${profile.planName}. The Prop-Firm Compliance Agent will now track headroom against this ruleset.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * DELETE — detach the active profile (marks inactive + archived).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) {
      throw unauthorized();
    }
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true }
    });
    if (!business) {
      throw notFound("Business not found.");
    }

    const result = await db.propFirmProfile.updateMany({
      where: { businessId: params.id, isActive: true },
      data: { isActive: false, status: "archived" }
    });

    return addSecurityHeaders(
      NextResponse.json({
        detached: result.count,
        message:
          result.count > 0
            ? `Detached ${result.count} active profile. The Prop-Firm Compliance Agent stops tracking until a new profile is attached.`
            : "No active profile to detach."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
