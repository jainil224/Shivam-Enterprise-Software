-- Phase 14 cleanup: remove out-of-scope General Purchase objects.
-- Additive-only migration. Historical migrations are not modified.

ALTER TABLE "journal_lines" DROP CONSTRAINT IF EXISTS "journal_lines_general_purchase_id_fkey";
DROP INDEX IF EXISTS "journal_lines_company_id_general_purchase_id_idx";
ALTER TABLE "journal_lines" DROP COLUMN IF EXISTS "general_purchase_id";

DROP TABLE IF EXISTS "general_purchase_lines" CASCADE;
DROP TABLE IF EXISTS "general_purchases" CASCADE;

DROP TYPE IF EXISTS "GeneralPurchaseType";
DROP TYPE IF EXISTS "GeneralPurchaseStatus";
DROP TYPE IF EXISTS "PurchaseTaxTreatment";