-- YouTube Data API v3 quota ledger. Default project-level quota is 10 000
-- units/day. An upload costs 1600 units, metadata update 50, list 3,
-- analytics effectively free. Tools increment unitsUsed before calling so
-- they can preflight "would this blow the cap" and return a clean error
-- instead of a mid-upload failure.

CREATE TABLE "YouTubeQuotaUsage" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "date"           DATE NOT NULL,
  "unitsUsed"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "YouTubeQuotaUsage_organizationId_date_key"
  ON "YouTubeQuotaUsage"("organizationId", "date");

CREATE INDEX "YouTubeQuotaUsage_organizationId_idx"
  ON "YouTubeQuotaUsage"("organizationId");
