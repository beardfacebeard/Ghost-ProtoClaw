-- Todo / Idea capture. Fills the gap between workflows (scheduled
-- automation), approvals (agent-requested permission), goals (outcome
-- targets), and projects (multi-step initiatives). This is the user's
-- notepad + agent trigger — brain-dump now, activate later.

CREATE TABLE "Todo" (
  "id"                      TEXT NOT NULL PRIMARY KEY,
  "organizationId"          TEXT NOT NULL,
  "businessId"              TEXT NOT NULL,
  "type"                    TEXT NOT NULL DEFAULT 'todo',
  "title"                   TEXT NOT NULL,
  "description"             TEXT,
  "status"                  TEXT NOT NULL DEFAULT 'captured',
  "priority"                TEXT NOT NULL DEFAULT 'medium',
  "agentId"                 TEXT,
  "dueAt"                   TIMESTAMP(3),
  "snoozedUntil"            TIMESTAMP(3),
  "createdVia"              TEXT NOT NULL DEFAULT 'web',
  "createdBy"               TEXT,
  "createdByAgentId"        TEXT,
  "delegatedConversationId" TEXT,
  "activatedAt"             TIMESTAMP(3),
  "completedAt"             TIMESTAMP(3),
  "tags"                    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "recurringPattern"        TEXT,
  "remindedAt"              TIMESTAMP(3),
  "metadata"                JSONB,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL
);

ALTER TABLE "Todo"
  ADD CONSTRAINT "Todo_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Todo_businessId_idx" ON "Todo"("businessId");
CREATE INDEX "Todo_businessId_status_idx" ON "Todo"("businessId", "status");
CREATE INDEX "Todo_businessId_type_status_idx" ON "Todo"("businessId", "type", "status");
CREATE INDEX "Todo_businessId_dueAt_idx" ON "Todo"("businessId", "dueAt");
CREATE INDEX "Todo_businessId_snoozedUntil_idx" ON "Todo"("businessId", "snoozedUntil");
