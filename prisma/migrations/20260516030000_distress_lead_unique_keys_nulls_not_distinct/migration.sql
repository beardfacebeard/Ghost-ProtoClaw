-- Distress-lead modules: re-uploading the same CSV produced duplicate rows
-- because the existing unique indexes included nullable sourceUrl (and
-- caseNumber for code violations), and Postgres's default treats NULLs as
-- distinct. The dedup pre-check inside the sweep handled only the ATTOM
-- source — anything else fell through to the constraint catch, which was
-- effectively void when the nullable columns were null.
--
-- Postgres 15+ NULLS NOT DISTINCT makes "(b, type, null, date)" collide
-- with "(b, type, null, date)" the way operators expect.
--
-- Before re-creating the index we dedup pre-existing rows in case the
-- module has been live long enough to have collected dupes. Keeping the
-- row with the smallest id (oldest insertion) per logical key.

-- ── ForeclosureRecord ──
DELETE FROM "ForeclosureRecord" a
USING "ForeclosureRecord" b
WHERE a.id > b.id
  AND a."businessId" = b."businessId"
  AND a."sourceType" = b."sourceType"
  AND COALESCE(a."sourceUrl", '') = COALESCE(b."sourceUrl", '')
  AND a."filingDate" IS NOT DISTINCT FROM b."filingDate";

DROP INDEX IF EXISTS "ForeclosureRecord_businessId_sourceType_sourceUrl_filingDate_key";
CREATE UNIQUE INDEX "ForeclosureRecord_businessId_sourceType_sourceUrl_filingDate_key"
  ON "ForeclosureRecord" ("businessId", "sourceType", "sourceUrl", "filingDate") NULLS NOT DISTINCT;

-- ── CodeViolationRecord ──
DELETE FROM "CodeViolationRecord" a
USING "CodeViolationRecord" b
WHERE a.id > b.id
  AND a."businessId" = b."businessId"
  AND a."sourceType" = b."sourceType"
  AND COALESCE(a."sourceUrl", '') = COALESCE(b."sourceUrl", '')
  AND COALESCE(a."caseNumber", '') = COALESCE(b."caseNumber", '');

DROP INDEX IF EXISTS "CodeViolationRecord_businessId_sourceType_sourceUrl_caseNumber_key";
CREATE UNIQUE INDEX "CodeViolationRecord_businessId_sourceType_sourceUrl_caseNumber_key"
  ON "CodeViolationRecord" ("businessId", "sourceType", "sourceUrl", "caseNumber") NULLS NOT DISTINCT;

-- FieldVisitNote: the GET handler at /api/admin/businesses/[id]/field-visits
-- filters by (businessId, sourceModule). Without this index the query did
-- a full-business scan to discriminate foreclosure vs code-violation rows.
CREATE INDEX IF NOT EXISTS "FieldVisitNote_businessId_sourceModule_idx"
  ON "FieldVisitNote" ("businessId", "sourceModule");
