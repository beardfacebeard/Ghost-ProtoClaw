-- PropFirmProfile: the active prop-firm ruleset attached to a Forex
-- Research & Execution Desk business. One active profile per business;
-- rules stored as JSON so we can evolve individual rule shapes (static
-- vs trailing drawdown, consistency %, minimum trading days) without
-- schema migrations. Default presets live in
-- lib/trading/prop-firm-presets.ts — Apex, FTMO, FundedNext, etc.

CREATE TABLE "PropFirmProfile" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "organizationId"  TEXT         NOT NULL,
  "businessId"      TEXT         NOT NULL,
  "firmKey"         TEXT         NOT NULL,
  "planName"        TEXT         NOT NULL,
  "startingBalance" DOUBLE PRECISION NOT NULL,
  "highWaterMark"   DOUBLE PRECISION NOT NULL,
  "rules"           JSONB        NOT NULL,
  "isActive"        BOOLEAN      NOT NULL DEFAULT true,
  "status"          TEXT         NOT NULL DEFAULT 'active',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PropFirmProfile_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PropFirmProfile_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PropFirmProfile_organizationId_idx"
  ON "PropFirmProfile"("organizationId");

CREATE INDEX "PropFirmProfile_businessId_idx"
  ON "PropFirmProfile"("businessId");

CREATE INDEX "PropFirmProfile_businessId_isActive_idx"
  ON "PropFirmProfile"("businessId", "isActive");
