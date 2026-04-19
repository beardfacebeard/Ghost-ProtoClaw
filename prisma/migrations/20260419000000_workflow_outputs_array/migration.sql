-- Multi-output fan-out for workflows. Additive; existing rows default to an
-- empty array and the runner falls back to the legacy single `output` field
-- when `outputs` is empty.
ALTER TABLE "Workflow" ADD COLUMN "outputs" TEXT[] DEFAULT ARRAY[]::TEXT[];
