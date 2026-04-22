-- Dealhawk Empire schema — Phase 0b-1.
--
-- Adds dealMode / tcpaAttestedAt / tcpaAttestedBy to Business, plus three new
-- models (AttorneyProfile, Deal, DealSignal) for the real-estate deal-hunting
-- template. All additions are defaulted or nullable so existing businesses
-- continue to work unchanged.
--
-- dealMode gates which Dealhawk capabilities the desk may exercise:
--   "research"  — signal building + KB research only (default; never fires
--                  seller outreach or binding contracts).
--   "outreach"  — TCPA-compliant seller contact unlocks after attestation.
--   "contract"  — binding contracts unlock, re-gated per property state
--                  via an active AttorneyProfile.
--
-- AttorneyProfile: per-state attorney on file. Application-enforced "one
-- active per (businessId, state)" invariant in lib/dealhawk/attorney.ts —
-- no DB unique constraint so archived historical profiles accumulate for
-- audit purposes.
--
-- Deal: the pipeline row. Stages enforced in the app layer: lead ->
-- contacted -> qualified -> under_contract -> assigned -> closed or dead.
--
-- DealSignal: stacked distress signals per deal. Cascades on deal delete so
-- signals never outlive their parent.

-- ── Business field additions ────────────────────────────────────────────────
ALTER TABLE "Business"
  ADD COLUMN "dealMode"       TEXT         NOT NULL DEFAULT 'research',
  ADD COLUMN "tcpaAttestedAt" TIMESTAMP(3),
  ADD COLUMN "tcpaAttestedBy" TEXT;

-- ── AttorneyProfile ─────────────────────────────────────────────────────────
CREATE TABLE "AttorneyProfile" (
  "id"                TEXT         NOT NULL PRIMARY KEY,
  "organizationId"    TEXT         NOT NULL,
  "businessId"        TEXT         NOT NULL,
  "state"             TEXT         NOT NULL,
  "name"              TEXT         NOT NULL,
  "firmName"          TEXT,
  "email"             TEXT         NOT NULL,
  "phone"             TEXT,
  "barNumber"         TEXT,
  "licenseVerifiedAt" TIMESTAMP(3),
  "isActive"          BOOLEAN      NOT NULL DEFAULT true,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AttorneyProfile_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttorneyProfile_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AttorneyProfile_organizationId_idx"
  ON "AttorneyProfile"("organizationId");
CREATE INDEX "AttorneyProfile_businessId_idx"
  ON "AttorneyProfile"("businessId");
CREATE INDEX "AttorneyProfile_businessId_state_idx"
  ON "AttorneyProfile"("businessId", "state");
CREATE INDEX "AttorneyProfile_businessId_state_isActive_idx"
  ON "AttorneyProfile"("businessId", "state", "isActive");

-- ── Deal ────────────────────────────────────────────────────────────────────
CREATE TABLE "Deal" (
  "id"                  TEXT             NOT NULL PRIMARY KEY,
  "organizationId"      TEXT             NOT NULL,
  "businessId"          TEXT             NOT NULL,
  "status"              TEXT             NOT NULL DEFAULT 'lead',
  "propertyAddress"     TEXT             NOT NULL,
  "propertyCity"        TEXT             NOT NULL,
  "propertyState"       TEXT             NOT NULL,
  "propertyZip"         TEXT             NOT NULL,
  "propertyType"        TEXT             NOT NULL DEFAULT 'sfr',
  "bedrooms"            INTEGER,
  "bathrooms"           DOUBLE PRECISION,
  "livingSqft"          INTEGER,
  "lotSqft"             INTEGER,
  "yearBuilt"           INTEGER,
  "ownerName"           TEXT,
  "ownerMailingAddress" TEXT,
  "ownerPhone"          TEXT,
  "ownerEmail"          TEXT,
  "ownerEntityType"     TEXT,
  "arvLow"              DOUBLE PRECISION,
  "arvMid"              DOUBLE PRECISION,
  "arvHigh"             DOUBLE PRECISION,
  "rentEstimate"        DOUBLE PRECISION,
  "rehabLight"          DOUBLE PRECISION,
  "rehabMedium"         DOUBLE PRECISION,
  "rehabHeavy"          DOUBLE PRECISION,
  "maoWholesale"        DOUBLE PRECISION,
  "maoBrrrr"            DOUBLE PRECISION,
  "maoFlip"             DOUBLE PRECISION,
  "subToScore"          INTEGER,
  "subToViability"      TEXT,
  "motivationScore"     INTEGER          NOT NULL DEFAULT 0,
  "recommendedExit"     TEXT,
  "source"              TEXT,
  "sourceRef"           TEXT,
  "firstContactAt"      TIMESTAMP(3),
  "lastContactAt"       TIMESTAMP(3),
  "nextTouchAt"         TIMESTAMP(3),
  "contactAttempts"     INTEGER          NOT NULL DEFAULT 0,
  "sellerResponseState" TEXT,
  "contractSignedAt"    TIMESTAMP(3),
  "contractType"        TEXT,
  "purchasePrice"       DOUBLE PRECISION,
  "assignmentFee"       DOUBLE PRECISION,
  "notes"               TEXT,
  "config"              JSONB,
  "createdAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "Deal_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Deal_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Deal_organizationId_idx" ON "Deal"("organizationId");
CREATE INDEX "Deal_businessId_idx" ON "Deal"("businessId");
CREATE INDEX "Deal_businessId_status_idx" ON "Deal"("businessId", "status");
CREATE INDEX "Deal_businessId_motivationScore_idx"
  ON "Deal"("businessId", "motivationScore");
CREATE INDEX "Deal_propertyState_idx" ON "Deal"("propertyState");

-- ── DealSignal ──────────────────────────────────────────────────────────────
CREATE TABLE "DealSignal" (
  "id"             TEXT         NOT NULL PRIMARY KEY,
  "organizationId" TEXT         NOT NULL,
  "dealId"         TEXT         NOT NULL,
  "signalType"     TEXT         NOT NULL,
  "sourceType"     TEXT         NOT NULL,
  "sourceRef"      TEXT,
  "citedDate"      TIMESTAMP(3),
  "weight"         INTEGER      NOT NULL,
  "confidence"    TEXT         NOT NULL DEFAULT 'medium',
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DealSignal_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DealSignal_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DealSignal_organizationId_idx" ON "DealSignal"("organizationId");
CREATE INDEX "DealSignal_dealId_idx" ON "DealSignal"("dealId");
CREATE INDEX "DealSignal_dealId_signalType_idx"
  ON "DealSignal"("dealId", "signalType");
