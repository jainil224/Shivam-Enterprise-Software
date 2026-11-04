-- Phase 8: Production Record Management
-- Adds cancellation_reason and cancelled_at fields to production_receives table
-- These are nullable — existing CONFIRMED records remain unaffected.

ALTER TABLE "production_receives"
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;

-- Index to efficiently query non-cancelled records
CREATE INDEX IF NOT EXISTS "production_receives_status_idx"
  ON "production_receives" ("company_id", "financial_year_id", "status");

