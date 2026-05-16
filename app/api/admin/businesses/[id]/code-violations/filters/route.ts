/**
 * Code-violation sourcing filters — operator-managed shape that the
 * daily sweep reads from Business.config.codeViolation.
 *
 * GET → returns current filters + the option catalogs the UI renders.
 * PUT → writes the filters back. Idempotent + additive — leaves the
 *       enabled flag, customAdapters, and Fair Housing audit metadata
 *       untouched.
 *
 * Closes the gap where the setup-walkthrough Step 5 said "operator UI
 * for this lands in Commit 3 follow-up; for now, admin DB tools."
 */

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { listScraperSummaries } from "@/lib/dealhawk/code-scrapers/registry";
import { db } from "@/lib/db";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const putSchema = z.object({
  /** Cities the sweep should target, in "City, ST" format
   *  (e.g. "Chicago, IL"). Empty means "all Tier-1 cities". */
  cities: z.array(z.string()).max(50).optional(),
  /** Severity tiers to ingest. Default [1, 2, 3] (skips tier-4 noise). */
  severityFilter: z.array(z.number().int().min(1).max(4)).optional(),
  /** Hard ingest cap per sweep. Default 500. */
  dailyIngestCap: z.number().int().min(0).max(2000).optional()
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
    const cv = cfg?.codeViolation as Record<string, unknown> | undefined;
    const filters = {
      enabled: cv?.enabled === true,
      cities: Array.isArray(cv?.cities) ? (cv?.cities as string[]) : [],
      severityFilter: Array.isArray(cv?.severityFilter)
        ? (cv?.severityFilter as number[])
        : [1, 2, 3],
      dailyIngestCap:
        typeof cv?.dailyIngestCap === "number" ? (cv?.dailyIngestCap as number) : 500
    };

    // Build Tier-1 city catalog from the static registry.
    const tier1Cities = listScraperSummaries().flatMap((s) =>
      s.cities.flatMap((city) =>
        s.states.map((state) => ({
          value: `${city}, ${state}`,
          label: `${city}, ${state}`,
          scraperId: s.id,
          scraperLabel: s.label
        }))
      )
    );

    return addSecurityHeaders(
      NextResponse.json({
        businessId: business.id,
        businessName: business.name,
        filters,
        catalogs: {
          tier1Cities,
          severityTiers: [
            { value: 1, label: "Tier 1 — Extreme (condemned, demolition ordered)" },
            { value: 2, label: "Tier 2 — Strong (unsafe, vacant, scheduled hearing)" },
            { value: 3, label: "Tier 3 — Moderate (open violation w/ fine)" },
            { value: 4, label: "Tier 4 — Low (minor, often noise — skip by default)" }
          ]
        }
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const body = putSchema.parse(await request.json());

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

    const newCv: Record<string, unknown> = {
      ...existingCv,
      ...(body.cities !== undefined ? { cities: body.cities } : {}),
      ...(body.severityFilter !== undefined
        ? { severityFilter: body.severityFilter }
        : {}),
      ...(body.dailyIngestCap !== undefined
        ? { dailyIngestCap: body.dailyIngestCap }
        : {})
    };

    const newConfig = { ...existingConfig, codeViolation: newCv };
    await db.business.update({
      where: { id: params.id },
      data: { config: newConfig as Prisma.InputJsonValue }
    });

    return addSecurityHeaders(
      NextResponse.json({
        ok: true,
        message: "Code-violation filters saved. Next sweep applies the new filters."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
