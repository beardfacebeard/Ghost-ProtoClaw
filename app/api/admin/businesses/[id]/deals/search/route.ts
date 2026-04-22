import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  BASE_WEIGHTS,
  computeMotivationScore,
  recommendExit,
  type DistressSignalType,
} from "@/lib/dealhawk/distress-score";
import {
  getProviderForBusiness,
  listProvidersForBusiness,
} from "@/lib/dealhawk/providers";
import {
  ProviderCredentialError,
  UnsupportedFeatureError,
  type ProviderSearchResult,
} from "@/lib/dealhawk/providers/types";
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
  };
};

const searchSchema = z.object({
  provider: z.enum(["demo", "batchdata"]),
  city: z.string().optional().nullable(),
  state: z.string().length(2),
  zips: z.array(z.string()).optional(),
  signalTypes: z
    .array(
      z.enum([
        "pre_foreclosure",
        "tax_delinquent",
        "probate",
        "divorce",
        "code_violation",
        "vacancy",
        "absentee",
        "eviction",
        "expired_listing",
      ])
    )
    .optional(),
  minMotivation: z.number().int().min(0).max(100).optional(),
  maxResults: z.number().int().min(1).max(200).optional(),
  /** If true, creates Deal rows from the results (in addition to returning
   *  them). Defaults to false — the two-step preview-then-import flow is
   *  the safer default. */
  importAfterSearch: z.boolean().optional(),
});

/**
 * GET — list enabled providers with configuration status. Used by the
 * search dialog to populate the provider selector and flag which ones
 * need credentials.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }
    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!business) throw notFound("Business not found.");
    const providers = await listProvidersForBusiness(params.id);
    return addSecurityHeaders(NextResponse.json({ providers }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * POST — run a property search against the specified provider. Returns
 * the scored results; if importAfterSearch is true, also creates Deal
 * rows for every result in the same request (skipping duplicates by
 * propertyAddress + propertyZip).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") {
      requireBusinessAccess(session, params.id);
    }
    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, organizationId: true },
    });
    if (!business) throw notFound("Business not found.");

    const body = searchSchema.parse(await request.json());

    const provider = await getProviderForBusiness(params.id, body.provider);
    if (!provider.isConfigured() && body.provider !== "demo") {
      throw badRequest(
        `Provider "${body.provider}" is not configured. Add the API key under Business integrations or the appropriate env var.`
      );
    }

    let results: ProviderSearchResult[];
    try {
      results = await provider.search({
        city: body.city ?? null,
        state: body.state.toUpperCase(),
        zips: body.zips,
        signalTypes: body.signalTypes as DistressSignalType[] | undefined,
        minMotivation: body.minMotivation,
        maxResults: body.maxResults,
      });
    } catch (err) {
      if (err instanceof ProviderCredentialError) {
        throw badRequest(err.message);
      }
      if (err instanceof UnsupportedFeatureError) {
        throw badRequest(err.message);
      }
      throw err;
    }

    // Normalize each result: compute motivationScore if the provider
    // didn't, and attach a recommendedExit heuristic. Keeps the UI
    // rendering consistent across providers.
    const normalized = results.map((r) => {
      const motivationScore =
        r.motivationScore ??
        computeMotivationScore({
          signals: r.signals.map((s) => ({ signalType: s.signalType })),
          equityPercent: r.equityPercent ?? undefined,
          tenureYears: r.tenureYears ?? undefined,
        }).score;
      const arvMid = r.arvEstimate ?? null;
      const recommendedExit = recommendExit({
        motivationScore,
        maoWholesale: arvMid !== null ? Math.round(arvMid * 0.7) : null,
        maoBrrrr: null,
        maoFlip: arvMid !== null ? Math.round(arvMid * 0.75) : null,
        arvMid,
        rentEstimate: null,
      });
      return {
        ...r,
        motivationScore,
        recommendedExit,
      };
    });

    if (!body.importAfterSearch) {
      return addSecurityHeaders(
        NextResponse.json({
          provider: body.provider,
          count: normalized.length,
          results: normalized,
        })
      );
    }

    // Import: dedupe against existing deals by (propertyAddress,
    // propertyZip) so re-searching the same market doesn't create
    // duplicates. Run in a single transaction.
    const existingDeals = await db.deal.findMany({
      where: {
        businessId: params.id,
        propertyZip: { in: normalized.map((r) => r.propertyZip) },
        propertyAddress: {
          in: normalized.map((r) => r.propertyAddress),
        },
      },
      select: { propertyAddress: true, propertyZip: true },
    });
    const existingSet = new Set(
      existingDeals.map((d) => `${d.propertyAddress}|${d.propertyZip}`)
    );
    const toImport = normalized.filter(
      (r) => !existingSet.has(`${r.propertyAddress}|${r.propertyZip}`)
    );

    let imported = 0;
    let signalsCreated = 0;
    const createdDealIds: string[] = [];
    await db.$transaction(async (tx) => {
      for (const r of toImport) {
        const arvMid = r.arvEstimate ?? null;
        const maoWholesale =
          arvMid !== null ? Math.round(arvMid * 0.7) : null;
        const maoFlip =
          arvMid !== null ? Math.round(arvMid * 0.75) : null;
        const deal = await tx.deal.create({
          data: {
            organization: { connect: { id: business.organizationId } },
            business: { connect: { id: business.id } },
            status: "lead",
            propertyAddress: r.propertyAddress,
            propertyCity: r.propertyCity,
            propertyState: r.propertyState,
            propertyZip: r.propertyZip,
            propertyType: r.propertyType ?? "sfr",
            bedrooms: r.bedrooms ?? null,
            bathrooms: r.bathrooms ?? null,
            livingSqft: r.livingSqft ?? null,
            yearBuilt: r.yearBuilt ?? null,
            ownerName: r.ownerName ?? null,
            ownerMailingAddress: r.ownerMailingAddress ?? null,
            ownerEntityType: r.ownerEntityType ?? null,
            arvMid,
            maoWholesale,
            maoFlip,
            motivationScore: r.motivationScore,
            recommendedExit: r.recommendedExit,
            source: body.provider === "demo" ? "manual_import" : body.provider,
            sourceRef: r.providerRef,
            notes: `Imported from ${body.provider} on ${new Date().toISOString().slice(0, 10)}.`,
            config: {
              provider: body.provider,
              providerRef: r.providerRef,
              importedAt: new Date().toISOString(),
            },
          },
        });
        createdDealIds.push(deal.id);
        imported++;
        for (const signal of r.signals) {
          await tx.dealSignal.create({
            data: {
              organizationId: business.organizationId,
              dealId: deal.id,
              signalType: signal.signalType,
              sourceType: body.provider,
              sourceRef: signal.sourceRef ?? null,
              citedDate: signal.citedDate ? new Date(signal.citedDate) : null,
              weight: BASE_WEIGHTS[signal.signalType],
              confidence: "medium",
              notes: signal.notes ?? null,
            },
          });
          signalsCreated++;
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        provider: body.provider,
        count: normalized.length,
        imported,
        skipped: normalized.length - imported,
        signalsCreated,
        dealIds: createdDealIds,
        results: normalized,
        message: `Imported ${imported} lead${imported === 1 ? "" : "s"} from ${body.provider}${
          normalized.length - imported > 0
            ? ` (${normalized.length - imported} duplicate${normalized.length - imported === 1 ? "" : "s"} skipped)`
            : ""
        }.`,
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
