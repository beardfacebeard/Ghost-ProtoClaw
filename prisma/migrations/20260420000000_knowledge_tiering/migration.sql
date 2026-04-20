-- Knowledge tiering + semantic search.
--
-- Three-tier loading to keep agent token budgets under control:
--   hot  — always injected into every agent's system prompt
--   warm — injected only for agents whose id is in assignedAgentIds
--          (empty array = all agents on the business, back-compat with
--          today's "every agent gets everything" behavior)
--   cold — never auto-injected; only retrieved on demand via the
--          knowledge_lookup tool
--
-- Embedding stored as a native Float[] with in-app cosine similarity so
-- we don't need the pgvector extension. Up to ~500 items per business
-- is plenty fast. We can upgrade to pgvector later if volume demands.

ALTER TABLE "KnowledgeItem"
  ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'warm',
  ADD COLUMN "assignedAgentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  ADD COLUMN "embeddingModel" TEXT,
  ADD COLUMN "embeddingGeneratedAt" TIMESTAMP(3);

CREATE INDEX "KnowledgeItem_businessId_tier_idx"
  ON "KnowledgeItem"("businessId", "tier");
