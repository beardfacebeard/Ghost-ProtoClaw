-- Phase 1: Safety Gates
--
-- Adds runtime kill-switch fields and the per-business
-- approval-bypass toggle. Purely additive; no existing data is touched.
--
-- Three concepts:
--
-- 1. Organization.globalPaused + paused{At,By,Reason}
--    Org-wide emergency stop. When true, every agent run, scheduled
--    workflow, delegation, and master-agent call short-circuits. The org
--    toggle exists in addition to the per-business toggle so an operator
--    can halt all tenants at once from a single button.
--
-- 2. Business.globalPaused + paused{At,By,Reason}
--    Per-business emergency stop. Independent of Organization.globalPaused
--    so a single business can be quarantined without affecting peers.
--
-- 3. Business.autoApproveExternalActions
--    When false (default), any external-action tool (send_email, send_sms,
--    social_publish_post, reddit_create_post, blotato_* publishing, etc.)
--    is gated behind an ApprovalRequest the operator must approve in the
--    UI before the action fires. Operators can flip per-business to true
--    once they explicitly trust the agent team for that business.

ALTER TABLE "Organization"
  ADD COLUMN "globalPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "pausedBy" TEXT,
  ADD COLUMN "pausedReason" TEXT;

ALTER TABLE "Business"
  ADD COLUMN "globalPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "pausedBy" TEXT,
  ADD COLUMN "pausedReason" TEXT,
  ADD COLUMN "autoApproveExternalActions" BOOLEAN NOT NULL DEFAULT false;
