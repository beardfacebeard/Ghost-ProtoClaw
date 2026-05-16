-- Dealhawk Empire — Code Violation Module (Commit 1, ships dark).
--
-- Adds two new tables (CodeViolationRecord, FieldVisitNote) plus three
-- additive columns on Deal. All changes are nullable/defaulted so
-- existing rows continue to work unchanged. No data backfill required.
--
-- CodeViolationRecord: raw code-enforcement case record ingested from
-- a city's open-data portal (Socrata/ArcGIS) or via CSV upload.
-- Multiple records may attach to the same Deal as cases stack on a
-- single property.
--
-- FieldVisitNote: operator field-visit log. SHARED between
-- pre_foreclosure and code_violation modules per decision #9.
-- Nullable FKs to both CodeViolationRecord and ForeclosureRecord;
-- sourceModule distinguishes producer. Retained 5 years.
--
-- Deal additive columns: codeViolationCount, codeViolationSeverity-
-- Highest, lastCodeViolationDate — denormalized for fast filter
-- on the unified distress-leads dashboard.

-- ── Deal additive columns ───────────────────────────────────────────
ALTER TABLE "Deal"
  ADD COLUMN "codeViolationCount"           INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN "codeViolationSeverityHighest" INTEGER,
  ADD COLUMN "lastCodeViolationDate"        TIMESTAMP(3);

CREATE INDEX "Deal_businessId_codeViolationSeverityHighest_idx"
  ON "Deal"("businessId", "codeViolationSeverityHighest");
CREATE INDEX "Deal_businessId_lastCodeViolationDate_idx"
  ON "Deal"("businessId", "lastCodeViolationDate");

-- ── CodeViolationRecord ─────────────────────────────────────────────
CREATE TABLE "CodeViolationRecord" (
  "id"                           TEXT             NOT NULL PRIMARY KEY,
  "businessId"                   TEXT             NOT NULL,
  "dealId"                       TEXT,
  "propertyAddress"              TEXT             NOT NULL,
  "propertyAddressNormalized"    TEXT,
  "apn"                          TEXT,
  "city"                         TEXT             NOT NULL,
  "county"                       TEXT,
  "state"                        TEXT             NOT NULL,
  "violationCode"                TEXT,
  "violationDescription"         TEXT             NOT NULL,
  "severityTier"                 INTEGER          NOT NULL,
  "status"                       TEXT             NOT NULL,
  "filingDate"                   TIMESTAMP(3)     NOT NULL,
  "lastActionDate"               TIMESTAMP(3),
  "hearingDate"                  TIMESTAMP(3),
  "caseNumber"                   TEXT,
  "ownerName"                    TEXT,
  "ownerMailingAddress"          TEXT,
  "ownerOccupied"                BOOLEAN,
  "ownerEntityType"              TEXT,
  "inspectorId"                  TEXT,
  "fineAmount"                   DECIMAL(65,30),
  "totalFinesParcelOpen"         DECIMAL(65,30),
  "sourceType"                   TEXT             NOT NULL,
  "sourceUrl"                    TEXT,
  "sourceTimestamp"              TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "parserConfidence"             DOUBLE PRECISION,
  "parserRawText"                TEXT,
  "parserRawJson"                JSONB,
  "enrichmentStatus"             TEXT             NOT NULL DEFAULT 'pending',
  "enrichmentAttempts"           INTEGER          NOT NULL DEFAULT 0,
  "scoreSnapshot"                INTEGER,
  "scoreBreakdown"               JSONB,
  "needsForeclosureRescueReview" BOOLEAN          NOT NULL DEFAULT false,
  "deletedAt"                    TIMESTAMP(3),
  "createdAt"                    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                    TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "CodeViolationRecord_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CodeViolationRecord_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CodeViolationRecord_businessId_idx"
  ON "CodeViolationRecord"("businessId");
CREATE INDEX "CodeViolationRecord_businessId_severityTier_idx"
  ON "CodeViolationRecord"("businessId", "severityTier");
CREATE INDEX "CodeViolationRecord_businessId_status_idx"
  ON "CodeViolationRecord"("businessId", "status");
CREATE INDEX "CodeViolationRecord_state_filingDate_idx"
  ON "CodeViolationRecord"("state", "filingDate");
CREATE UNIQUE INDEX "CodeViolationRecord_businessId_sourceType_sourceUrl_caseNumber_key"
  ON "CodeViolationRecord"("businessId", "sourceType", "sourceUrl", "caseNumber");

-- ── FieldVisitNote ──────────────────────────────────────────────────
CREATE TABLE "FieldVisitNote" (
  "id"                    TEXT             NOT NULL PRIMARY KEY,
  "businessId"            TEXT             NOT NULL,
  "codeViolationRecordId" TEXT,
  "foreclosureRecordId"   TEXT,
  "dealId"                TEXT,
  "operatorUserId"        TEXT,
  "visitedAt"             TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "outcome"               TEXT             NOT NULL,
  "signageObserved"       JSONB            NOT NULL,
  "photos"                JSONB            NOT NULL,
  "notes"                 TEXT,
  "visitLat"              DOUBLE PRECISION,
  "visitLng"              DOUBLE PRECISION,
  "sourceModule"          TEXT             NOT NULL DEFAULT 'manual',
  "deletedAt"             TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "FieldVisitNote_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FieldVisitNote_codeViolationRecordId_fkey"
    FOREIGN KEY ("codeViolationRecordId") REFERENCES "CodeViolationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FieldVisitNote_foreclosureRecordId_fkey"
    FOREIGN KEY ("foreclosureRecordId") REFERENCES "ForeclosureRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FieldVisitNote_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "FieldVisitNote_businessId_idx"
  ON "FieldVisitNote"("businessId");
CREATE INDEX "FieldVisitNote_businessId_visitedAt_idx"
  ON "FieldVisitNote"("businessId", "visitedAt");
CREATE INDEX "FieldVisitNote_codeViolationRecordId_idx"
  ON "FieldVisitNote"("codeViolationRecordId");
CREATE INDEX "FieldVisitNote_foreclosureRecordId_idx"
  ON "FieldVisitNote"("foreclosureRecordId");
