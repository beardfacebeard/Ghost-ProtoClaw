-- Dealhawk Empire: operator's saved sourcing buy-box.
--
-- The Daily Lead Sourcing Sweep workflow reads this column to query
-- structured property data providers (RentCast / Axesso Zillow / Realie)
-- for fresh leads each morning. JSON blob so the shape can evolve
-- without further migrations. Purely additive.

ALTER TABLE "Business"
  ADD COLUMN "sourcingBuyBox" JSONB;
