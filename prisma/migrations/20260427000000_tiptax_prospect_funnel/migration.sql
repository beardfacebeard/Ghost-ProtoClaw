-- TipTax Prospect funnel telemetry — Commit C of the strategic upgrade
-- (after buyer-state machine in Commit A and engagement scoring in B).
--
-- Adds two models:
--
-- 1. Prospect: one row per restaurant/bar Hunter sources. Carries fit
--    scoring (Tier A/B/C), buyer state, engagement score, and lifecycle
--    stage. The `stage` column drives the funnel drop-off dashboard
--    widget. Sparse per-stage timestamps let Data Analyst compute
--    time-in-stage for the leakiest-stage report.
--
-- 2. ProspectStageEvent: append-only log of every stage transition with
--    reason + metadata. Lets Data Analyst reconstruct trajectory across
--    multi-touch conversations.
--
-- Both are purely additive — no existing data is touched, no existing
-- queries are affected. Safe to deploy without downtime.
--
-- onDelete behavior: ProspectStageEvent CASCADEs from Prospect (deleting a
-- prospect deletes its history). Prospect.business uses Prisma's default
-- (no action — application code is responsible for cleanup if a Business
-- is ever deleted, which currently never happens).

CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "state" TEXT,
    "metro" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "sourceType" TEXT,
    "sourceUrl" TEXT,
    "cuisine" TEXT,
    "liquorClass" TEXT,
    "seatsEstimate" INTEGER,
    "reviewCount" INTEGER,
    "tier" TEXT,
    "fitScore" INTEGER,
    "fitNotes" JSONB,
    "estimatedRecoveryBand" TEXT,
    "multiUnitFlag" BOOLEAN NOT NULL DEFAULT false,
    "buyerState" TEXT,
    "engagementScore" INTEGER,
    "engagementTier" TEXT,
    "fallingTrust" BOOLEAN NOT NULL DEFAULT false,
    "stage" TEXT NOT NULL DEFAULT 'sourced',
    "stageReason" TEXT,
    "primaryChannel" TEXT,
    "contactedChannels" JSONB,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "sourcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "engagedAt" TIMESTAMP(3),
    "linkSentAt" TIMESTAMP(3),
    "formStartedAt" TIMESTAMP(3),
    "formCompletedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "deadAt" TIMESTAMP(3),
    "stalledAt" TIMESTAMP(3),
    "lastTransitionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prospect_businessId_stage_idx" ON "Prospect"("businessId", "stage");
CREATE INDEX "Prospect_businessId_tier_idx" ON "Prospect"("businessId", "tier");
CREATE INDEX "Prospect_businessId_lastTransitionAt_idx" ON "Prospect"("businessId", "lastTransitionAt");
CREATE INDEX "Prospect_businessId_state_idx" ON "Prospect"("businessId", "state");
CREATE INDEX "Prospect_businessId_email_idx" ON "Prospect"("businessId", "email");
CREATE INDEX "Prospect_businessId_phone_idx" ON "Prospect"("businessId", "phone");

ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "ProspectStageEvent" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectStageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProspectStageEvent_prospectId_createdAt_idx" ON "ProspectStageEvent"("prospectId", "createdAt");
CREATE INDEX "ProspectStageEvent_businessId_createdAt_idx" ON "ProspectStageEvent"("businessId", "createdAt");
CREATE INDEX "ProspectStageEvent_businessId_toStage_idx" ON "ProspectStageEvent"("businessId", "toStage");

ALTER TABLE "ProspectStageEvent" ADD CONSTRAINT "ProspectStageEvent_prospectId_fkey"
    FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProspectStageEvent" ADD CONSTRAINT "ProspectStageEvent_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
