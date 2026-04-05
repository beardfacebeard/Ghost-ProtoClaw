-- Add maxTokensPerCall to Agent
ALTER TABLE "Agent" ADD COLUMN "maxTokensPerCall" INTEGER;

-- Create TokenUsageLog table
CREATE TABLE "TokenUsageLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT,
    "agentId" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endpoint" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsageLog_pkey" PRIMARY KEY ("id")
);

-- Create BudgetConfig table
CREATE TABLE "BudgetConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessId" TEXT,
    "monthlyLimitUsd" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "alertThresholdPct" INTEGER NOT NULL DEFAULT 80,
    "hardStop" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetConfig_pkey" PRIMARY KEY ("id")
);

-- Create indexes for TokenUsageLog
CREATE INDEX "TokenUsageLog_organizationId_idx" ON "TokenUsageLog"("organizationId");
CREATE INDEX "TokenUsageLog_businessId_idx" ON "TokenUsageLog"("businessId");
CREATE INDEX "TokenUsageLog_agentId_idx" ON "TokenUsageLog"("agentId");
CREATE INDEX "TokenUsageLog_createdAt_idx" ON "TokenUsageLog"("createdAt");
CREATE INDEX "TokenUsageLog_organizationId_createdAt_idx" ON "TokenUsageLog"("organizationId", "createdAt");

-- Create indexes and unique constraint for BudgetConfig
CREATE UNIQUE INDEX "BudgetConfig_organizationId_businessId_key" ON "BudgetConfig"("organizationId", "businessId");
CREATE INDEX "BudgetConfig_organizationId_idx" ON "BudgetConfig"("organizationId");
