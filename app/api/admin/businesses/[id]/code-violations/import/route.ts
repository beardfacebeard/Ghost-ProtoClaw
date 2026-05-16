import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  mapCodeViolationDataset,
  parseCsv
} from "@/lib/dealhawk/code-violation-csv-import";
import { codeViolationScore } from "@/lib/dealhawk/distress-score";
import { hasStateAttestation } from "@/lib/dealhawk/foreclosure-state-compliance";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const bodySchema = z.object({
  csv: z.string().optional(),
  rows: z.array(z.record(z.string(), z.string())).optional(),
  sourceType: z.string().optional()
});

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function fairHousingAuditRecent(config: unknown): boolean {
  if (!config || typeof config !== "object") return false;
  const cv = (config as Record<string, unknown>).codeViolation as
    | { fairHousingAuditedAt?: string }
    | undefined;
  if (!cv?.fairHousingAuditedAt) return false;
  const auditDate = new Date(cv.fairHousingAuditedAt);
  if (Number.isNaN(auditDate.getTime())) return false;
  return (Date.now() - auditDate.getTime()) / (24 * 60 * 60 * 1000) < 90;
}

/**
 * POST — bulk-import CodeViolationRecord rows from CSV.
 *
 * Idempotent via the unique (businessId, sourceType, sourceUrl,
 * caseNumber) index. Refuses to import unless the code-violation addon
 * is enabled on the business.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();
    if (session.role === "admin") requireBusinessAccess(session, params.id);

    const business = await db.business.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      select: { id: true, config: true }
    });
    if (!business) throw notFound("Business not found.");

    const cfg = business.config as Record<string, unknown> | null;
    const cvCfg = cfg?.codeViolation as { enabled?: unknown } | undefined;
    if (cvCfg?.enabled !== true) {
      throw badRequest(
        "Code-violation addon is not enabled for this business. Enable it before importing code-violation records."
      );
    }

    const pre = cfg?.preForeclosure as
      | { glbaAttestation?: { signedAt?: string } }
      | undefined;
    const glbaAttested = Boolean(pre?.glbaAttestation?.signedAt);
    const fhAuditRecent = fairHousingAuditRecent(business.config);

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

    const { rows, errors } = mapCodeViolationDataset(
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
              "No valid rows to import. Common causes: missing propertyAddress / city / state / violationDescription / filingDate. See errors list."
          },
          { status: 400 }
        )
      );
    }

    let imported = 0;
    let duplicatesSkipped = 0;
    for (const row of rows) {
      const ownerAbsentee =
        row.ownerMailingAddress && row.propertyAddress
          ? row.ownerMailingAddress.toLowerCase().trim() !==
            row.propertyAddress.toLowerCase().trim()
          : null;
      const scoreResult = codeViolationScore({
        severityTier: row.severityTier,
        caseAgeDays: daysSince(row.filingDate),
        openCaseCount: 1,
        ownerAbsentee,
        ownerEntityType: row.ownerName?.match(/\b(LLC|TRUST|ESTATE|INC|CORP)\b/i)
          ? "llc"
          : "individual",
        stateAttested: hasStateAttestation(business.config, row.state),
        glbaAttested,
        fairHousingAuditRecent: fhAuditRecent
      });

      try {
        await db.codeViolationRecord.create({
          data: {
            businessId: business.id,
            propertyAddress: row.propertyAddress,
            city: row.city,
            state: row.state,
            county: row.county,
            apn: row.apn,
            violationCode: row.violationCode,
            violationDescription: row.violationDescription,
            severityTier: row.severityTier,
            status: row.status,
            filingDate: row.filingDate,
            lastActionDate: row.lastActionDate,
            hearingDate: row.hearingDate,
            caseNumber: row.caseNumber,
            ownerName: row.ownerName,
            ownerMailingAddress: row.ownerMailingAddress,
            ownerOccupied: ownerAbsentee === null ? null : !ownerAbsentee,
            fineAmount: row.fineAmount
              ? new Prisma.Decimal(row.fineAmount)
              : null,
            sourceType: row.sourceType,
            sourceUrl: row.sourceUrl,
            sourceTimestamp: new Date(),
            parserConfidence: 0.9,
            enrichmentStatus: "enriched",
            scoreSnapshot: scoreResult.total,
            scoreBreakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
            needsForeclosureRescueReview:
              row.state === "MD" &&
              (row.status === "scheduled_hearing" ||
                row.status === "condemned" ||
                row.status === "demolition_ordered")
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
        message: `Imported ${imported} code-violation record${imported === 1 ? "" : "s"}${
          duplicatesSkipped > 0
            ? `, ${duplicatesSkipped} duplicate${duplicatesSkipped === 1 ? "" : "s"} skipped`
            : ""
        }${errors.length > 0 ? ` (${errors.length} row${errors.length === 1 ? "" : "s"} failed)` : ""}.`
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
