-- Jurisdiction + trading-mode fields on Business, introduced for the Forex
-- Research & Execution Desk template. Both are additive and nullable/defaulted
-- so existing businesses continue to work unchanged.
--
-- jurisdiction drives broker availability, leverage caps, and the wording of
-- mandatory risk disclosures for regulated templates.
-- allowed values: "US" | "UK" | "EU" | "AU" | "CA" | "SG" | "JP" | "OTHER"
--
-- tradingMode gates live execution. Defaults to "research" so no freshly
-- materialized business can accidentally fire live orders. Upgrading the tier
-- (research -> paper -> live_approval) is guarded in the UI + server.
-- allowed values: "research" | "paper" | "live_approval"

ALTER TABLE "Business"
  ADD COLUMN "jurisdiction" TEXT,
  ADD COLUMN "tradingMode"  TEXT NOT NULL DEFAULT 'research';

CREATE INDEX "Business_jurisdiction_idx" ON "Business"("jurisdiction");
