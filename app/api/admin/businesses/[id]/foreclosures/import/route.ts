import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { preForeclosureScore } from "@/lib/dealhawk/distress-score";
import {
  mapForeclosureDataset,
  parseCsv
} from "@/lib/dealhawk/foreclosure-csv-import";
import {
  hasStateAttestation
} from "@/lib/dealhawk/foreclosure-state-compliance";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const bodySchema = z.object({
  csv: z.string().optional(),
  rows: z.array(z.record(z.string(), z.string())).optional(),
  sourceType: z.string().optional()
});

/**
 * POST — bulk-import ForeclosureRecord rows from CSV.
 *
 * Mirrors the existing /deals/import route shape so the operator's
 * client-side import flow looks consistent. Idempotent at the DB level
 * via the unique (businessId, sourceType, sourceUrl, filingDate) index —
 * duplicates are skipped silently and reported in the response. Refuses
 * to import unless the pre_foreclosure addon is enabled on the business
 * (Business.config.preForeclosure.enabled === true).
 *
 * Limits: 1,000 rows per request (split larger imports into batches).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, organizationId: true, config: true }
    });
    if (!business) throw notFound("Business not found.");

    // Gate on the addon being enabled. Refuse to import otherwise so the
    // operator can't accidentally write foreclosure data to a business
    // that hasn't opted in to the compliance surface.
    const cfg = business.config as Record<string, unknown> | null;
    const preCfg = cfg?.preForeclosure as { enabled?: unknown } | undefined;
    if (preCfg?.enabled !== true) {
      throw badRequest(
        "Pre-foreclosure addon is not enabled for this business. Enable it in /admin/businesses/[id]/settings before importing foreclosure records."
      );
    }

    const body = bodySchema.parse(await request.json());

    let dataset: Record<string, string>[] = [];
    if (body.csv) {
      dataset = parseCsv(body.csv);
    } else if (body.rows) {
      dataset = body.rows;
    } else {
      throw badRequest(
        "Provide either `csv` (raw CSV text) or `rows` (array of column-keyed objects)."
      );
    }
    if (dataset.length === 0) {
      throw badRequest("Parsed dataset is empty — no rows to import.");
    }
    if (dataset.length > 1000) {
      throw badRequest(
        `Refusing to import ${dataset.length} rows in a single request. Split into batches of 1,000 or fewer.`
      );
    }

    const { rows, errors } = mapForeclosureDataset(
      dataset,
      body.sourceType ?? "csv_import"
    );
    if (rows.length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            imported: 0,
            duplicatesSkipped: 0,
            errors,
            message:
              "No valid rows to import. Common causes: missing propertyAddress / county / state / ownerName / filingDate / foreclosureStage. See errors list."
          },
          { status: 400 }
        )
      );
    }

    // GLBA attestation is read once per import (same posture across rows).
    const pre = cfg?.preForeclosure as
      | { enabled?: unknown; glbaAttestation?: { signedAt?: string } }
      | undefined;
    const glbaAttested = Boolean(pre?.glbaAttestation?.signedAt);

    let imported = 0;
    let duplicatesSkipped = 0;
    for (const row of rows) {
      // Score each row at import time so the dashboard renders meaningful
      // sort + filter immediately, not after a follow-up scoring pass.
      const scoreResult = preForeclosureScore({
        foreclosureStage: row.foreclosureStage,
        daysUntilAuction: daysUntil(row.auctionDate),
        ownerOccupied: row.ownerMailingAddress
          ? row.ownerMailingAddress.toLowerCase().trim() ===
            row.propertyAddress.toLowerCase().trim()
          : null,
        stateAttested: hasStateAttestation(business.config, row.state),
        glbaAttested,
        sourceCount: 1
      });

      try {
        await db.foreclosureRecord.create({
          data: {
            businessId: business.id,
            propertyAddress: row.propertyAddress,
            county: row.county,
            state: row.state,
            apn: row.apn,
            foreclosureStage: row.foreclosureStage,
            documentType: row.documentType,
            filingDate: row.filingDate,
            auctionDate: row.auctionDate,
            caseNumber: row.caseNumber,
            ownerName: row.ownerName,
            ownerMailingAddress: row.ownerMailingAddress,
            trusteeName: row.trusteeName,
            lenderName: row.lenderName,
            plaintiffAttorney: row.plaintiffAttorney,
            reinstatementAmount: row.reinstatementAmount
              ? new Prisma.Decimal(row.reinstatementAmount)
              : null,
            judgmentAmount: row.judgmentAmount
              ? new Prisma.Decimal(row.judgmentAmount)
              : null,
            sourceType: row.sourceType,
            sourceUrl: row.sourceUrl,
            sourceDocumentUrl: row.sourceDocumentUrl,
            // CSV imports skip the document parser; flag as enriched so
            // the rest of the pipeline picks them up.
            enrichmentStatus: "enriched",
            // Manual import: operator vouches for the fields, so confidence
            // is high. The dedicated parser bumps this on its own runs.
            parserConfidence: 0.9,
            scoreSnapshot: scoreResult.total
          }
        });
        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes("Unique constraint") ||
          message.includes("unique constraint")
        ) {
          duplicatesSkipped++;
        } else {
          errors.push({
            rowNumber: 0,
            message: `insert failed for ${row.propertyAddress}: ${message.slice(0, 200)}`
          });
        }
      }
    }

    return addSecurityHeaders(
      NextResponse.json({
        imported,
        duplicatesSkipped,
        errors,
        message: `Imported ${imported} foreclosure record${imported === 1 ? "" : "s"}${
          duplicatesSkipped > 0
            ? `, ${duplicatesSkipped} duplicate${duplicatesSkipped === 1 ? "" : "s"} skipped`
            : ""
        }${errors.length > 0 ? ` (${errors.length} row${errors.length === 1 ? "" : "s"} failed — see errors)` : ""}.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
