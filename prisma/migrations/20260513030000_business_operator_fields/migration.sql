-- Editable per-business identity values that templates render via the
-- {{operatorName}}, {{operatorPhone}}, {{operatorEmail}},
-- {{escalationContactName}}, and {{escalationContactPhone}} placeholders.
--
-- Replaces hardcoded "Brandon" / "Dave at (410) 404-2880" baked into the
-- private templates. Operators set these once per business via the
-- business edit form; the template substitution layer reads them at
-- materialize time and at every agent run.
--
-- Purely additive — every field is optional and existing rows stay
-- untouched.

ALTER TABLE "Business"
  ADD COLUMN "operatorName"            TEXT,
  ADD COLUMN "operatorPhone"           TEXT,
  ADD COLUMN "operatorEmail"           TEXT,
  ADD COLUMN "escalationContactName"   TEXT,
  ADD COLUMN "escalationContactPhone"  TEXT;
