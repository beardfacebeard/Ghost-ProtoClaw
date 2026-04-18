-- Add nextRunAt + composite index so the in-process scheduler can find due
-- scheduled workflows efficiently. Fully additive — existing rows default
-- to NULL and will be backfilled by the scheduler on its first tick.
ALTER TABLE "Workflow" ADD COLUMN "nextRunAt" TIMESTAMP(3);
CREATE INDEX "Workflow_trigger_enabled_nextRunAt_idx"
  ON "Workflow"("trigger", "enabled", "nextRunAt");
