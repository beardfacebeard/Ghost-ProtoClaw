import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { mapDataset, parseCsv } from "@/lib/dealhawk/csv-import";
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

const bodySchema = z.object({
  /** Raw CSV text. Either csv or rows must be provided. */
  csv: z.string().optional(),
  /**
   * Pre-parsed rows (each row is an object whose keys are column names,
   * values are cell values as strings). Use this path for client-side
   * preview flows that have already parsed the CSV.
   */
  rows: z.array(z.record(z.string(), z.string())).optional(),
  /** Optional source tag. Defaults to "manual_import". */
  source: z.string().optional(),
});

/**
 * POST — bulk-import leads into a business's pipeline from CSV or JSON.
 *
 * Each row becomes a Deal (status = "lead") + optional DealSignal rows for
 * any recognized distress flags. Motivation score is computed at import
 * time via lib/dealhawk/distress-score.ts so the imported leads are
 * immediately rankable against existing deals.
 *
 * Idempotency: this endpoint does NOT dedupe against existing deals. The
 * operator is responsible for not re-importing the same export twice. A
 * future enhancement will add an optional upsert-by-address mode.
 *
 * Limits:
 *   - Max 1,000 rows per import (app enforces; DB transaction would
 *     tolerate more but a single 10k-row import would time out Railway's
 *     default request window).
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
    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, organizationId: true },
    });
    if (!business) {
      throw notFound("Business not found.");
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

    const { rows, errors } = mapDataset(dataset, body.source ?? "manual_import");

    if (rows.length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            imported: 0,
            signalsCreated: 0,
            errors,
            message:
              "No valid rows to import. Check the error list — most common cause is missing address / city / state / zip columns.",
          },
          { status: 400 }
        )
      );
    }

    let signalsCreated = 0;
    const createdDealIds: string[] = [];
    await db.$transaction(async (tx) => {
      for (const row of rows) {
        const deal = await tx.deal.create({
          data: {
            ...row.deal,
            organization: { connect: { id: business.organizationId } },
            business: { connect: { id: business.id } },
          },
        });
        createdDealIds.push(deal.id);
        for (const signal of row.signals) {
          await tx.dealSignal.create({
            data: {
              organizationId: business.organizationId,
              dealId: deal.id,
              signalType: signal.signalType,
              sourceType: "manual",
              sourceRef: signal.sourceRef,
              weight: signal.weight,
              confidence: signal.confidence,
              notes: signal.notes,
            },
          });
          signalsCreated++;
        }
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        imported: createdDealIds.length,
        signalsCreated,
        dealIds: createdDealIds,
        errors,
        message: `Imported ${createdDealIds.length} lead${
          createdDealIds.length === 1 ? "" : "s"
        }${errors.length > 0 ? ` (${errors.length} row${errors.length === 1 ? "" : "s"} skipped — see errors).` : "."}`,
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
