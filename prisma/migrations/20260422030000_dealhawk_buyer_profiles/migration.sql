-- Dealhawk Empire — BuyerProfile model (Phase 5).
--
-- Cash-buyer / landlord / flipper rows in the operator's buyer database.
-- The Buyer List Builder agent populates this from public-record cash-
-- sale scraping + REI club lists; the Disposition Agent sorts the active
-- set by zip × buy-box when a deal is locked up to produce the A-list
-- for the disposition blast.

CREATE TABLE "BuyerProfile" (
  "id"                  TEXT             NOT NULL PRIMARY KEY,
  "organizationId"      TEXT             NOT NULL,
  "businessId"          TEXT             NOT NULL,
  "name"                TEXT             NOT NULL,
  "llc"                 TEXT,
  "contactMethod"       TEXT             NOT NULL DEFAULT 'email',
  "email"               TEXT,
  "phone"               TEXT,
  "buyBox"              TEXT             NOT NULL DEFAULT 'any',
  "zipPreferences"      JSONB,
  "minPurchasePrice"    DOUBLE PRECISION,
  "maxPurchasePrice"    DOUBLE PRECISION,
  "preferredRehabLevel" TEXT             NOT NULL DEFAULT 'any',
  "financingType"       TEXT             NOT NULL DEFAULT 'cash',
  "lastDealDate"        TIMESTAMP(3),
  "dealsLast12Mo"       INTEGER          NOT NULL DEFAULT 0,
  "status"              TEXT             NOT NULL DEFAULT 'active',
  "notes"               TEXT,
  "createdAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "BuyerProfile_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BuyerProfile_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BuyerProfile_organizationId_idx" ON "BuyerProfile"("organizationId");
CREATE INDEX "BuyerProfile_businessId_idx" ON "BuyerProfile"("businessId");
CREATE INDEX "BuyerProfile_businessId_status_idx" ON "BuyerProfile"("businessId", "status");
CREATE INDEX "BuyerProfile_businessId_buyBox_idx" ON "BuyerProfile"("businessId", "buyBox");
