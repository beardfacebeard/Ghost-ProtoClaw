-- Phase 4: Memory embeddings
--
-- Adds OpenAI text-embedding-3-small vectors to AgentMemory rows, mirroring
-- the KnowledgeItem pattern (Float[] in Postgres, no pgvector dependency,
-- cosine similarity computed in the app layer).
--
-- When OpenAI is configured, memory.recall surfaces semantically-related
-- memories instead of only substring matches. When OpenAI is unavailable
-- the column stays empty and the existing keyword search keeps working.
-- Purely additive — no existing data is touched.

ALTER TABLE "AgentMemory"
  ADD COLUMN "embedding" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  ADD COLUMN "embeddingModel" TEXT,
  ADD COLUMN "embeddingGeneratedAt" TIMESTAMP(3);
