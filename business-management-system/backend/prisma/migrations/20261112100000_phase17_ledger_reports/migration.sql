-- Phase 17 - Bank Book & Account Ledger reports.
-- Additive only. One new table stores saved Bank Book report preferences.
-- No existing table, column, index or accounting record is modified.

CREATE TYPE "BankBookDetailMode" AS ENUM ('DETAIL', 'SUMMARY');

CREATE TABLE "bank_book_saved_reports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "report_name" TEXT NOT NULL,
    "bank_ledger_account_id" TEXT NOT NULL,
    "detail_mode" "BankBookDetailMode" NOT NULL DEFAULT 'DETAIL',
    "report_type" TEXT NOT NULL DEFAULT 'DAILY',
    "filter_field" TEXT,
    "filter_text" TEXT,
    "party_group_id" TEXT,
    "from_date" TIMESTAMP(3),
    "to_date" TIMESTAMP(3),
    "columns" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_book_saved_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_book_saved_reports_company_id_report_name_key" ON "bank_book_saved_reports"("company_id", "report_name");
CREATE INDEX "bank_book_saved_reports_company_id_bank_ledger_account_id_idx" ON "bank_book_saved_reports"("company_id", "bank_ledger_account_id");

ALTER TABLE "bank_book_saved_reports" ADD CONSTRAINT "bank_book_saved_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_book_saved_reports" ADD CONSTRAINT "bank_book_saved_reports_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_book_saved_reports" ADD CONSTRAINT "bank_book_saved_reports_company_id_bank_ledger_account_id_fkey" FOREIGN KEY ("company_id", "bank_ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_book_saved_reports" ADD CONSTRAINT "bank_book_saved_reports_company_id_party_group_id_fkey" FOREIGN KEY ("company_id", "party_group_id") REFERENCES "party_groups"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;