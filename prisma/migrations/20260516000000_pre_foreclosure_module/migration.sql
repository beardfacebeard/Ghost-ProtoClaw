-- Dealhawk Empire — Pre-Foreclosure Module (Commit 1, ships dark).
--
-- Adds two new tables (ForeclosureRecord, SkipTraceResult) plus additive
-- columns on Deal and DealSignal. All changes are nullable/defaulted so
-- existing rows continue to work unchanged. No data backfill required.
--
-- ForeclosureRecord: raw foreclosure-record row, the authoritative
-- source-of-truth for a single foreclosure filing on a property. Multiple
-- records may attach to the same Deal as the foreclosure progresses
-- (NOD -> NOTS -> Notice of Sale). Created by the County Records Scraper
-- Agent, ATTOM feed ingest, CSV import, or manually. Parsed into
-- structured fields by the Foreclosure Document Parser Agent.
--
-- SkipTraceResult: result of a single skip-trace query, per-query
-- permissible-purpose attestation captured in purposeCode for GLBA/DPPA
-- defense. Retained 5 years.
--
-- Deal additive columns: denormalized fast-filter mirror of the latest
-- ForeclosureRecord. Null for non-foreclosure-sourced deals.
--
-- DealSignal additive columns: auctionTimelineJson + documentParserConfidence
-- for foreclosure-sourced signals.

-- ── Deal additive columns ────────────────────────────────────────────────
ALTER TABLE "Deal"
  ADD COLUMN "foreclosureStage"       TEXT,
  ADD COLUMN "auctionDate"            TIMESTAMP(3),
  ADD COLUMN "nodFilingDate"          TIMESTAMP(3),
  ADD COLUMN "caseNumber"             TEXT,
  ADD COLUMN "lenderName"             TEXT,
  ADD COLUMN "trusteeName"            TEXT,
  ADD COLUMN "reinstatementAmount"    DECIMAL(65,30),
  ADD COLUMN "foreclosureDocumentUrl" TEXT;

CREATE INDEX "Deal_businessId_auctionDate_idx"
  ON "Deal"("businessId", "auctionDate");
CREATE INDEX "Deal_businessId_foreclosureStage_idx"
  ON "Deal"("businessId", "foreclosureStage");

-- ── DealSignal additive columns ─────────────────────────────────────────
ALTER TABLE "DealSignal"
  ADD COLUMN "auctionTimelineJson"      JSONB,
  ADD COLUMN "documentParserConfidence" DOUBLE PRECISION;

-- ── ForeclosureRecord ────────────────────────────────────────────────────
CREATE TABLE "ForeclosureRecord" (
  "id"                        TEXT         NOT NULL PRIMARY KEY,
  "businessId"                TEXT         NOT NULL,
  "dealId"                    TEXT,
  "propertyAddress"           TEXT         NOT NULL,
  "propertyAddressNormalized" TEXT,
  "apn"                       TEXT,
  "county"                    TEXT         NOT NULL,
  "state"                     TEXT         NOT NULL,
  "foreclosureStage"          TEXT         NOT NULL,
  "documentType"              TEXT         NOT NULL,
  "filingDate"                TIMESTAMP(3) NOT NULL,
  "auctionDate"               TIMESTAMP(3),
  "caseNumber"                TEXT,
  "ownerName"                 TEXT         NOT NULL,
  "ownerMailingAddress"       TEXT,
  "ownerOccupied"             BOOLEAN,
  "trusteeName"               TEXT,
  "trusteeContact"            TEXT,
  "lenderName"                TEXT,
  "plaintiffAttorney"         TEXT,
  "reinstatementAmount"       DECIMAL(65,30),
  "judgmentAmount"            DECIMAL(65,30),
  "estimatedEquity"           DECIMAL(65,30),
  "estimatedPropertyValue"    DECIMAL(65,30),
  "loanBalanceEstimate"       DECIMAL(65,30),
  "sourceType"                TEXT         NOT NULL,
  "sourceUrl"                 TEXT,
  "sourceDocumentUrl"         TEXT,
  "sourceTimestamp"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "parserConfidence"          DOUBLE PRECISION,
  "parserRawText"             TEXT,
  "enrichmentStatus"          TEXT         NOT NULL DEFAULT 'pending',
  "enrichmentAttempts"        INTEGER      NOT NULL DEFAULT 0,
  "scoreSnapshot"             INTEGER,
  "deletedAt"                 TIMESTAMP(3),
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ForeclosureRecord_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ForeclosureRecord_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ForeclosureRecord_businessId_idx"
  ON "ForeclosureRecord"("businessId");
CREATE INDEX "ForeclosureRecord_businessId_auctionDate_idx"
  ON "ForeclosureRecord"("businessId", "auctionDate");
CREATE INDEX "ForeclosureRecord_businessId_foreclosureStage_idx"
  ON "ForeclosureRecord"("businessId", "foreclosureStage");
CREATE INDEX "ForeclosureRecord_state_filingDate_idx"
  ON "ForeclosureRecord"("state", "filingDate");
CREATE UNIQUE INDEX "ForeclosureRecord_businessId_sourceType_sourceUrl_filingDate_key"
  ON "ForeclosureRecord"("businessId", "sourceType", "sourceUrl", "filingDate");

-- ── SkipTraceResult ─────────────────────────────────────────────────────
CREATE TABLE "SkipTraceResult" (
  "id"                  TEXT         NOT NULL PRIMARY KEY,
  "foreclosureRecordId" TEXT,
  "dealId"              TEXT,
  "businessId"          TEXT         NOT NULL,
  "queryOwnerName"      TEXT         NOT NULL,
  "queryAddress"        TEXT         NOT NULL,
  "queryApn"            TEXT,
  "purposeCode"         TEXT         NOT NULL,
  "purposeNotes"        TEXT,
  "vendor"              TEXT         NOT NULL,
  "vendorRequestId"     TEXT,
  "vendorRawResponse"   JSONB,
  "phones"              JSONB        NOT NULL,
  "emails"              JSONB        NOT NULL,
  "alternateAddresses"  JSONB        NOT NULL,
  "confidenceOverall"   DOUBLE PRECISION NOT NULL,
  "isOwnerOccupied"     BOOLEAN,
  "costCents"           INTEGER,
  "queriedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "staleAfter"          TIMESTAMP(3) NOT NULL,
  "deletedAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SkipTraceResult_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SkipTraceResult_foreclosureRecordId_fkey"
    FOREIGN KEY ("foreclosureRecordId") REFERENCES "ForeclosureRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SkipTraceResult_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SkipTraceResult_businessId_idx"
  ON "SkipTraceResult"("businessId");
CREATE INDEX "SkipTraceResult_businessId_queriedAt_idx"
  ON "SkipTraceResult"("businessId", "queriedAt");
CREATE INDEX "SkipTraceResult_foreclosureRecordId_idx"
  ON "SkipTraceResult"("foreclosureRecordId");
CREATE INDEX "SkipTraceResult_dealId_idx"
  ON "SkipTraceResult"("dealId");
