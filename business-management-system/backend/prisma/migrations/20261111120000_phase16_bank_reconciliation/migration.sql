-- Phase 16 - Bank Reconciliation (additive only).
-- Reconciliation metadata is stored against the real bank-side JournalLine.
-- No existing table, column, index or historical row is modified except for the
-- additive unique criterion JournalLine needs to be a composite FK target.

CREATE TYPE "BankReconciliationAction" AS ENUM (
  'SET_CLEARING_DATE',
  'REMOVE_CLEARING_DATE',
  'OPENING_BALANCE_SET',
  'OPENING_BALANCE_ACKNOWLEDGED',
  'STATEMENT_SAVED'
);

CREATE TYPE "BankReconciliationStatus" AS ENUM ('DRAFT', 'BALANCED', 'UNBALANCED');

CREATE UNIQUE INDEX "journal_lines_company_id_id_key" ON "journal_lines"("company_id", "id");

CREATE TABLE "bank_reconciliation_openings" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "financial_year_id" TEXT NOT NULL,
  "bank_ledger_account_id" TEXT NOT NULL,
  "opening_date" TIMESTAMP(3) NOT NULL,
  "opening_statement_balance" DECIMAL(15,2) NOT NULL,
  "opening_book_balance" DECIMAL(15,2) NOT NULL,
  "difference" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
  "acknowledged_at" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_reconciliation_openings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "bank_reconciliation_marks" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "financial_year_id" TEXT NOT NULL,
  "bank_ledger_account_id" TEXT NOT NULL,
  "bank_journal_line_id" TEXT NOT NULL,
  "clearing_date" TIMESTAMP(3) NOT NULL,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_reconciliation_marks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_reconciliation_audits" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "financial_year_id" TEXT NOT NULL,
  "bank_ledger_account_id" TEXT NOT NULL,
  "reconciliation_mark_id" TEXT,
  "bank_journal_line_id" TEXT,
  "action" "BankReconciliationAction" NOT NULL,
  "previous_clearing_date" TIMESTAMP(3),
  "new_clearing_date" TIMESTAMP(3),
  "changed_by" TEXT,
  "reason" TEXT,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_reconciliation_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_reconciliation_statements" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "financial_year_id" TEXT NOT NULL,
  "bank_ledger_account_id" TEXT NOT NULL,
  "from_date" TIMESTAMP(3) NOT NULL,
  "to_date" TIMESTAMP(3) NOT NULL,
  "opening_statement_balance" DECIMAL(15,2) NOT NULL,
  "closing_statement_balance" DECIMAL(15,2) NOT NULL,
  "book_opening_balance" DECIMAL(15,2) NOT NULL,
  "book_closing_balance" DECIMAL(15,2) NOT NULL,
  "uncleared_payments" DECIMAL(15,2) NOT NULL,
  "uncleared_receipts" DECIMAL(15,2) NOT NULL,
  "calculated_bank_balance" DECIMAL(15,2) NOT NULL,
  "difference" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  "status" "BankReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_reconciliation_statements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bank_reconciliation_openings_company_id_financial_year_id_bank_ledger_account_id_key" ON "bank_reconciliation_openings"("company_id", "financial_year_id", "bank_ledger_account_id");
CREATE INDEX "bank_reconciliation_openings_company_id_bank_ledger_account_id_idx" ON "bank_reconciliation_openings"("company_id", "bank_ledger_account_id");
CREATE UNIQUE INDEX "bank_reconciliation_marks_company_id_bank_journal_line_id_key" ON "bank_reconciliation_marks"("company_id", "bank_journal_line_id");
CREATE INDEX "bank_reconciliation_marks_company_id_financial_year_id_bank_ledger_account_id_idx" ON "bank_reconciliation_marks"("company_id", "financial_year_id", "bank_ledger_account_id");
CREATE INDEX "bank_reconciliation_audits_company_id_financial_year_id_bank_ledger_account_id_changed_at_idx" ON "bank_reconciliation_audits"("company_id", "financial_year_id", "bank_ledger_account_id", "changed_at");
CREATE INDEX "bank_reconciliation_audits_company_id_bank_journal_line_id_idx" ON "bank_reconciliation_audits"("company_id", "bank_journal_line_id");
CREATE INDEX "bank_reconciliation_statements_company_id_financial_year_id_bank_ledger_account_id_to_date_idx" ON "bank_reconciliation_statements"("company_id", "financial_year_id", "bank_ledger_account_id", "to_date");

ALTER TABLE "bank_reconciliation_openings" ADD CONSTRAINT "bank_reconciliation_openings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_openings" ADD CONSTRAINT "bank_reconciliation_openings_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_openings" ADD CONSTRAINT "bank_reconciliation_openings_company_id_bank_ledger_account_id_fkey" FOREIGN KEY ("company_id", "bank_ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_reconciliation_marks" ADD CONSTRAINT "bank_reconciliation_marks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_marks" ADD CONSTRAINT "bank_reconciliation_marks_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_marks" ADD CONSTRAINT "bank_reconciliation_marks_company_id_bank_ledger_account_id_fkey" FOREIGN KEY ("company_id", "bank_ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_marks" ADD CONSTRAINT "bank_reconciliation_marks_company_id_bank_journal_line_id_fkey" FOREIGN KEY ("company_id", "bank_journal_line_id") REFERENCES "journal_lines"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_audits" ADD CONSTRAINT "bank_reconciliation_audits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_audits" ADD CONSTRAINT "bank_reconciliation_audits_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_audits" ADD CONSTRAINT "bank_reconciliation_audits_company_id_bank_ledger_account_id_fkey" FOREIGN KEY ("company_id", "bank_ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_audits" ADD CONSTRAINT "bank_reconciliation_audits_reconciliation_mark_id_fkey" FOREIGN KEY ("reconciliation_mark_id") REFERENCES "bank_reconciliation_marks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_reconciliation_statements" ADD CONSTRAINT "bank_reconciliation_statements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_statements" ADD CONSTRAINT "bank_reconciliation_statements_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliation_statements" ADD CONSTRAINT "bank_reconciliation_statements_company_id_bank_ledger_account_id_fkey" FOREIGN KEY ("company_id", "bank_ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;