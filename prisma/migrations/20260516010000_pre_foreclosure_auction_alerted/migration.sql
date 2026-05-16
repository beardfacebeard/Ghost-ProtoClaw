-- Dealhawk Pre-Foreclosure addon — auction-imminent notification idempotency.
--
-- Adds ForeclosureRecord.auctionAlertedAt. The auction-imminent notification
-- workflow (decision #12 in DEALHAWK_PRE_FORECLOSURE_MODULE_PLAN.md) fires
-- once per record when scoreSnapshot >= 75 AND auctionDate is < 30 days
-- away. This timestamp records the first fire so subsequent scheduler
-- ticks don't re-ping the same record.

ALTER TABLE "ForeclosureRecord"
  ADD COLUMN "auctionAlertedAt" TIMESTAMP(3);
