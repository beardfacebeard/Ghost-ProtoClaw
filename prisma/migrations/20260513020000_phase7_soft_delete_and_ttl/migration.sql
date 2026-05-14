-- Phase 7: Soft-delete columns + indexes for retention sweeps.
--
-- The May audit flagged two related schema gaps:
--   - No soft-delete pattern. "Archive" was implemented in app code by
--     setting status="archived" on Business, but Organization, Agent,
--     Workflow, Integration, and KnowledgeItem had no equivalent. A
--     mistaken delete is unrecoverable.
--   - Unbounded growth on Message, ConversationLog, TokenUsageLog,
--     LogEvent, ActivityEntry, ActionRun, AgentMemory, AuditEvent. The
--     scheduler's retention sweep (existing for ActivityEntry) needs an
--     index on (createdAt) for those tables it doesn't already index, so
--     time-range deletes don't full-scan.
--
-- This migration is additive only. No data is touched. Existing queries
-- continue to work unchanged.

ALTER TABLE "Organization"  ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Business"      ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Agent"         ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Workflow"      ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Integration"   ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "KnowledgeItem" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Partial indexes — only index rows where deletedAt IS NULL so the index
-- stays tight even when many rows get archived. Queries that filter
-- `WHERE deletedAt IS NULL` (the standard repository pattern after this
-- migration) hit these indexes.
CREATE INDEX "Organization_deletedAt_idx"  ON "Organization"  ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "Business_deletedAt_idx"      ON "Business"      ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "Agent_deletedAt_idx"         ON "Agent"         ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "Workflow_deletedAt_idx"      ON "Workflow"      ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "Integration_deletedAt_idx"   ON "Integration"   ("deletedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "KnowledgeItem_deletedAt_idx" ON "KnowledgeItem" ("deletedAt") WHERE "deletedAt" IS NULL;

-- Retention-sweep indexes. The scheduler now sweeps rows older than the
-- per-table cap. Without (createdAt) indexes on these high-write tables
-- the DELETE WHERE createdAt < cutoff scans the heap, which is fine at
-- low row counts and brutal at 10M+. Add the indexes now so the sweep
-- stays fast as growth compounds.
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx"        ON "Message"        ("createdAt");
CREATE INDEX IF NOT EXISTS "LogEvent_createdAt_idx"       ON "LogEvent"       ("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEntry_createdAt_idx"  ON "ActivityEntry"  ("createdAt");
CREATE INDEX IF NOT EXISTS "TokenUsageLog_createdAt_idx"  ON "TokenUsageLog"  ("createdAt");
CREATE INDEX IF NOT EXISTS "ActionRun_createdAt_idx"      ON "ActionRun"      ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx"     ON "AuditEvent"     ("createdAt");
