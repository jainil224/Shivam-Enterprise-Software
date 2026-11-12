-- Phase 18 - Bank Receipt Entry (Cheque Receipt)
-- Additive only: new tables/enums plus one nullable column on bank_vouchers.
-- The Phase 12 double-entry engine (journal_lines) remains the single posted
-- accounting source of truth; nothing here duplicates it.

-- CreateEnum
CREATE TYPE "BankReceiptAdjustmentMode" AS ENUM ('NO_ADJUSTMENT', 'AGAINST_BILL', 'SKIP_IN_OS');

-- CreateEnum
CREATE TYPE "BankReceiptAllocationStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateEnum
CREATE TYPE "BankReceiptDrCr" AS ENUM ('DR', 'CR');

-- CreateEnum
CREATE TYPE "BankReceiptCalculationType" AS ENUM ('AMT', 'INT', 'TDS');

-- AlterTable
ALTER TABLE "bank_vouchers" ADD COLUMN "bank_receipt_book_id" TEXT;

-- CreateTable
CREATE TABLE "bank_receipt_books" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "book_name" TEXT NOT NULL,
    "bank_account_ledger_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_receipt_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_instruments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_voucher_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "bank_voucher_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "party_id" TEXT NOT NULL,
    "party_ledger_account_id" TEXT NOT NULL,
    "bank_instrument_id" TEXT,
    "bank_name_code" TEXT,
    "cheque_number" TEXT,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "adjustment_mode" "BankReceiptAdjustmentMode" NOT NULL DEFAULT 'NO_ADJUSTMENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_receipt_bill_allocations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "bank_voucher_line_id" TEXT NOT NULL,
    "purchase_bill_id" TEXT NOT NULL,
    "source_document_type" TEXT NOT NULL DEFAULT 'PURCHASE_BILL',
    "source_document_number" TEXT NOT NULL,
    "bill_date" TIMESTAMP(3) NOT NULL,
    "due_value" INTEGER,
    "bill_amount" DECIMAL(15,2) NOT NULL,
    "bill_tds" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "previous_received" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "allocated_amount" DECIMAL(15,2) NOT NULL,
    "balance_after" DECIMAL(15,2) NOT NULL,
    "status" "BankReceiptAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_receipt_bill_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_receipt_adjustment_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "bank_voucher_line_id" TEXT NOT NULL,
    "allocation_id" TEXT,
    "adjustment_ledger_account_id" TEXT NOT NULL,
    "calculation_type" "BankReceiptCalculationType" NOT NULL DEFAULT 'AMT',
    "interest_percent" DECIMAL(5,2),
    "due_value" INTEGER,
    "tds_percent" DECIMAL(5,2),
    "adjustment_amount" DECIMAL(15,2) NOT NULL,
    "dr_cr" "BankReceiptDrCr" NOT NULL,
    "note" TEXT,
    "status" "BankReceiptAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_receipt_adjustment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_receipt_books_company_id_id_key" ON "bank_receipt_books"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_receipt_books_company_id_financial_year_id_id_key" ON "bank_receipt_books"("company_id", "financial_year_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_receipt_books_company_id_financial_year_id_book_name_key" ON "bank_receipt_books"("company_id", "financial_year_id", "book_name");

-- CreateIndex
CREATE UNIQUE INDEX "bank_receipt_books_company_id_financial_year_id_prefix_key" ON "bank_receipt_books"("company_id", "financial_year_id", "prefix");

-- CreateIndex
CREATE INDEX "bank_receipt_books_company_id_financial_year_id_is_active_idx" ON "bank_receipt_books"("company_id", "financial_year_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "bank_instruments_company_id_id_key" ON "bank_instruments"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_instruments_company_id_code_key" ON "bank_instruments"("company_id", "code");

-- CreateIndex
CREATE INDEX "bank_instruments_company_id_is_active_idx" ON "bank_instruments"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "bank_voucher_lines_company_id_id_key" ON "bank_voucher_lines"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_voucher_lines_bank_voucher_id_revision_row_number_key" ON "bank_voucher_lines"("bank_voucher_id", "revision", "row_number");

-- CreateIndex
CREATE INDEX "bank_voucher_lines_company_id_financial_year_id_bank_vouche_idx" ON "bank_voucher_lines"("company_id", "financial_year_id", "bank_voucher_id");

-- CreateIndex
CREATE INDEX "bank_voucher_lines_company_id_party_id_idx" ON "bank_voucher_lines"("company_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_receipt_bill_allocations_company_id_id_key" ON "bank_receipt_bill_allocations"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_receipt_bill_allocations_bank_voucher_line_id_purchase_key" ON "bank_receipt_bill_allocations"("bank_voucher_line_id", "purchase_bill_id", "revision");

-- CreateIndex
CREATE INDEX "bank_receipt_bill_allocations_company_id_financial_year_id__idx" ON "bank_receipt_bill_allocations"("company_id", "financial_year_id", "purchase_bill_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_receipt_adjustment_lines_company_id_id_key" ON "bank_receipt_adjustment_lines"("company_id", "id");

-- CreateIndex
CREATE INDEX "bank_receipt_adjustment_lines_company_id_financial_year_id__idx" ON "bank_receipt_adjustment_lines"("company_id", "financial_year_id", "bank_voucher_line_id");

-- CreateIndex
CREATE INDEX "bank_receipt_adjustment_lines_company_id_adjustment_ledger__idx" ON "bank_receipt_adjustment_lines"("company_id", "adjustment_ledger_account_id");

-- AddForeignKey
ALTER TABLE "bank_receipt_books" ADD CONSTRAINT "bank_receipt_books_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_books" ADD CONSTRAINT "bank_receipt_books_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_books" ADD CONSTRAINT "bank_receipt_books_company_id_bank_account_ledger_id_fkey" FOREIGN KEY ("company_id", "bank_account_ledger_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_vouchers" ADD CONSTRAINT "bank_vouchers_company_id_bank_receipt_book_id_fkey" FOREIGN KEY ("company_id", "bank_receipt_book_id") REFERENCES "bank_receipt_books"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_instruments" ADD CONSTRAINT "bank_instruments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_voucher_lines" ADD CONSTRAINT "bank_voucher_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_voucher_lines" ADD CONSTRAINT "bank_voucher_lines_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_voucher_lines" ADD CONSTRAINT "bank_voucher_lines_company_id_bank_voucher_id_fkey" FOREIGN KEY ("company_id", "bank_voucher_id") REFERENCES "bank_vouchers"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_voucher_lines" ADD CONSTRAINT "bank_voucher_lines_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_voucher_lines" ADD CONSTRAINT "bank_voucher_lines_company_id_party_ledger_account_id_fkey" FOREIGN KEY ("company_id", "party_ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_voucher_lines" ADD CONSTRAINT "bank_voucher_lines_company_id_bank_instrument_id_fkey" FOREIGN KEY ("company_id", "bank_instrument_id") REFERENCES "bank_instruments"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_bill_allocations" ADD CONSTRAINT "bank_receipt_bill_allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_bill_allocations" ADD CONSTRAINT "bank_receipt_bill_allocations_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_bill_allocations" ADD CONSTRAINT "bank_receipt_bill_allocations_company_id_bank_voucher_line_fkey" FOREIGN KEY ("company_id", "bank_voucher_line_id") REFERENCES "bank_voucher_lines"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_bill_allocations" ADD CONSTRAINT "bank_receipt_bill_allocations_purchase_bill_id_fkey" FOREIGN KEY ("purchase_bill_id") REFERENCES "purchase_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_adjustment_lines" ADD CONSTRAINT "bank_receipt_adjustment_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_adjustment_lines" ADD CONSTRAINT "bank_receipt_adjustment_lines_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_adjustment_lines" ADD CONSTRAINT "bank_receipt_adjustment_lines_company_id_bank_voucher_line_fkey" FOREIGN KEY ("company_id", "bank_voucher_line_id") REFERENCES "bank_voucher_lines"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_adjustment_lines" ADD CONSTRAINT "bank_receipt_adjustment_lines_company_id_allocation_id_fkey" FOREIGN KEY ("company_id", "allocation_id") REFERENCES "bank_receipt_bill_allocations"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_receipt_adjustment_lines" ADD CONSTRAINT "bank_receipt_adjustment_lines_company_id_adjustment_ledger_fkey" FOREIGN KEY ("company_id", "adjustment_ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;