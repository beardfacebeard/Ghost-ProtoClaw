-- Dealhawk Empire — backfill existing business summaries to match the
-- Option C attorney posture.
--
-- The template's default summary in lib/templates/business-templates.ts was
-- updated in commit 5191b27 to say "attorney review is strongly recommended"
-- instead of "requires a licensed real-estate attorney on file in the
-- property's state." But that template change only affects businesses
-- materialized AFTER the fix — existing Dealhawk businesses already had the
-- old summary text copied into their Business.summary column.
--
-- This migration does a targeted text REPLACE on any Business row whose
-- summary contains the old requires-attorney phrase, swapping in the new
-- advisory wording. Idempotent (re-runs are no-ops because the old phrase
-- will no longer be present). Does not touch summaries that don't contain
-- the old text.

UPDATE "Business"
SET "summary" = REPLACE(
  "summary",
  'Contract mode unlocks binding agreements (purchase agreements, assignments, Sub-To packages, LOIs) and requires a licensed real-estate attorney on file in the property''s state.',
  'Contract mode unlocks binding agreements (purchase agreements, assignments, Sub-To packages, LOIs); attorney review is strongly recommended for Sub-To and other creative-finance structures and in statute-heavy states, and when an attorney is on file for the property''s state they are cited in generated paperwork.'
)
WHERE "summary" IS NOT NULL
  AND "summary" LIKE '%requires a licensed real-estate attorney on file in the property%';
