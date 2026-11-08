-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DebitNoteType" AS ENUM ('SALES', 'PURCHASE', 'BOTH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DebitNoteReason" AS ENUM ('CASH_DISCOUNT', 'QUANTITY_DISCOUNT', 'RATE_DIFFERENCE', 'INTEREST', 'TCS', 'PURCHASE_RETURN', 'WEIGHT_SHORTAGE', 'QUALITY_DEDUCTION', 'QUANTITY_SHORTAGE', 'EXCESS_BILLING_ADJUSTMENT', 'OTHER_PURCHASE_ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DebitNoteCalculationBasis" AS ENUM ('BILL_AMOUNT', 'TAXABLE_AMOUNT', 'BASIC_AMOUNT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DebitNoteStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'POSTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DebitNoteGstStatus" AS ENUM ('NOT_APPLICABLE', 'AWAITING_SUPPLIER_CREDIT_NOTE', 'RECEIVED', 'VERIFIED', 'RECONCILED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GeneralPurchaseType" AS ENUM ('EXPENSE', 'NON_STOCK_CONSUMABLE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GeneralPurchaseStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PurchaseTaxTreatment" AS ENUM ('TAXABLE', 'EXEMPT', 'NIL_RATED', 'NON_GST');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "debit_note_id" TEXT;
ALTER TABLE "journal_lines" ADD COLUMN IF NOT EXISTS "general_purchase_id" TEXT;
ALTER TABLE "journal_lines" ALTER COLUMN "voucher_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "debit_note_books" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "book_name" TEXT NOT NULL,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "balance_type" "BalanceType" NOT NULL DEFAULT 'CREDIT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_note_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "debit_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "voucher_number" INTEGER NOT NULL,
    "note_number" TEXT NOT NULL,
    "note_date" TIMESTAMP(3) NOT NULL,
    "party_note_no" TEXT,
    "note_type" "DebitNoteType" NOT NULL DEFAULT 'SALES',
    "party_id" TEXT NOT NULL,
    "due_days" INTEGER NOT NULL DEFAULT 0,
    "credit_account_id" TEXT NOT NULL,
    "os_effect" TEXT NOT NULL DEFAULT '2.OS(+)',
    "reason" "DebitNoteReason" NOT NULL DEFAULT 'INTEREST',
    "calculation_basis" "DebitNoteCalculationBasis" NOT NULL DEFAULT 'BILL_AMOUNT',
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "tds_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "tds_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tds_section" TEXT,
    "tds_account" TEXT DEFAULT 'TDS RECEIVABLE',
    "remark" TEXT,
    "adjustment_reason" TEXT,
    "purchase_bill_id" TEXT,
    "supplier_name" TEXT,
    "supplier_gstin" TEXT,
    "supplier_address" TEXT,
    "supplier_state" TEXT,
    "original_invoice_number" TEXT,
    "original_invoice_date" TIMESTAMP(3),
    "is_manual_reference" BOOLEAN NOT NULL DEFAULT false,
    "total_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "cess_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "stock_movement_posted" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "posted_at" TIMESTAMP(3),
    "gst_status" "DebitNoteGstStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "supplier_credit_note_number" TEXT,
    "supplier_credit_note_date" TIMESTAMP(3),
    "gst_taxable_amount" DECIMAL(15,2),
    "gst_cgst_amount" DECIMAL(15,2),
    "gst_sgst_amount" DECIMAL(15,2),
    "gst_igst_amount" DECIMAL(15,2),
    "gst_cess_amount" DECIMAL(15,2),
    "gst_supporting_reference" TEXT,
    "gst_notes" TEXT,
    "basic_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "taxable_value" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "tcs_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "round_off" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "status" "DebitNoteStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "debit_note_bill_lines" (
    "id" TEXT NOT NULL,
    "debit_note_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "bill_no" TEXT NOT NULL,
    "bill_date" TIMESTAMP(3) NOT NULL,
    "total_days" INTEGER NOT NULL DEFAULT 0,
    "dhara_days" INTEGER NOT NULL DEFAULT 0,
    "interest_days" INTEGER NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "paid_date" TIMESTAMP(3),
    "item_description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    "bill_taxable" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "bill_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "unpaid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "rate" DECIMAL(15,4) NOT NULL DEFAULT 0.00,
    "basic_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "source_bill_id" TEXT,
    "source_bill_type" TEXT,

    CONSTRAINT "debit_note_bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "general_purchases" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "voucher_number" TEXT NOT NULL,
    "voucher_date" TIMESTAMP(3) NOT NULL,
    "party_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "supplier_gstin" TEXT,
    "supplier_address" TEXT,
    "supplier_city" TEXT,
    "supplier_state" TEXT,
    "supplier_state_code" TEXT,
    "supplier_pincode" TEXT,
    "purchase_type" "GeneralPurchaseType" NOT NULL DEFAULT 'EXPENSE',
    "tax_treatment" "PurchaseTaxTreatment" NOT NULL DEFAULT 'TAXABLE',
    "supplier_invoice_number" TEXT,
    "supplier_invoice_date" TIMESTAMP(3),
    "reference_number" TEXT,
    "payment_terms" TEXT,
    "due_date" TIMESTAMP(3),
    "place_of_supply" TEXT,
    "place_of_supply_state_code" TEXT,
    "tax_type" "OrderTaxType" NOT NULL DEFAULT 'INTRA_STATE',
    "total_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "cess_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "packing_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "other_charges" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "freight_ledger_id" TEXT,
    "packing_ledger_id" TEXT,
    "other_charges_ledger_id" TEXT,
    "round_off_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "narration" TEXT,
    "remarks" TEXT,
    "status" "GeneralPurchaseStatus" NOT NULL DEFAULT 'POSTED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "posting_date" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "general_purchase_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "general_purchase_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "expense_ledger_id" TEXT NOT NULL,
    "item_id" TEXT,
    "item_code" TEXT,
    "description" TEXT NOT NULL,
    "hsn_sac" TEXT,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "unit" TEXT NOT NULL DEFAULT 'NOS',
    "rate" DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "gross_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "debit_note_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "debit_note_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "purchase_bill_item_id" TEXT,
    "item_id" TEXT,
    "item_code" TEXT,
    "item_name" TEXT NOT NULL,
    "yarn_quality" TEXT,
    "yarn_count" TEXT,
    "yarn_grade" TEXT,
    "lot_number" TEXT,
    "original_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "previously_adjusted_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "accepted_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "current_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "original_rate" DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    "revised_rate" DECIMAL(15,4),
    "rate_difference" DECIMAL(15,4),
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "weighbridge_slip_number" TEXT,
    "weighment_date" TIMESTAMP(3),
    "inspection_reference" TEXT,
    "supporting_reference" TEXT,
    "line_reason" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_note_books_company_id_id_key" ON "debit_note_books"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_note_books_company_id_financial_year_id_id_key" ON "debit_note_books"("company_id", "financial_year_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_note_books_company_id_financial_year_id_book_name_key" ON "debit_note_books"("company_id", "financial_year_id", "book_name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_note_books_company_id_financial_year_id_prefix_key" ON "debit_note_books"("company_id", "financial_year_id", "prefix");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debit_notes_company_id_financial_year_id_note_date_idx" ON "debit_notes"("company_id", "financial_year_id", "note_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debit_notes_company_id_party_id_idx" ON "debit_notes"("company_id", "party_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debit_notes_company_id_book_id_idx" ON "debit_notes"("company_id", "book_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debit_notes_company_id_purchase_bill_id_idx" ON "debit_notes"("company_id", "purchase_bill_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_notes_company_id_financial_year_id_book_id_voucher_nu_key" ON "debit_notes"("company_id", "financial_year_id", "book_id", "voucher_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_notes_company_id_financial_year_id_note_number_key" ON "debit_notes"("company_id", "financial_year_id", "note_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debit_note_bill_lines_debit_note_id_idx" ON "debit_note_bill_lines"("debit_note_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_note_bill_lines_debit_note_id_line_number_key" ON "debit_note_bill_lines"("debit_note_id", "line_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "general_purchases_company_id_financial_year_id_voucher_date_idx" ON "general_purchases"("company_id", "financial_year_id", "voucher_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "general_purchases_company_id_party_id_idx" ON "general_purchases"("company_id", "party_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "general_purchases_company_id_financial_year_id_status_idx" ON "general_purchases"("company_id", "financial_year_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "general_purchases_company_id_supplier_invoice_number_idx" ON "general_purchases"("company_id", "supplier_invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "general_purchases_company_id_financial_year_id_voucher_numb_key" ON "general_purchases"("company_id", "financial_year_id", "voucher_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "general_purchases_company_id_id_key" ON "general_purchases"("company_id", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "general_purchase_lines_general_purchase_id_idx" ON "general_purchase_lines"("general_purchase_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "general_purchase_lines_company_id_expense_ledger_id_idx" ON "general_purchase_lines"("company_id", "expense_ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "general_purchase_lines_general_purchase_id_line_number_key" ON "general_purchase_lines"("general_purchase_id", "line_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debit_note_lines_debit_note_id_idx" ON "debit_note_lines"("debit_note_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debit_note_lines_company_id_purchase_bill_item_id_idx" ON "debit_note_lines"("company_id", "purchase_bill_item_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debit_note_lines_debit_note_id_line_number_key" ON "debit_note_lines"("debit_note_id", "line_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_lines_company_id_general_purchase_id_idx" ON "journal_lines"("company_id", "general_purchase_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_lines_company_id_debit_note_id_idx" ON "journal_lines"("company_id", "debit_note_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_general_purchase_id_fkey" FOREIGN KEY ("general_purchase_id") REFERENCES "general_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_note_books" ADD CONSTRAINT "debit_note_books_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_note_books" ADD CONSTRAINT "debit_note_books_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "debit_note_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_credit_account_id_fkey" FOREIGN KEY ("company_id", "credit_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_purchase_bill_id_fkey" FOREIGN KEY ("purchase_bill_id") REFERENCES "purchase_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_note_bill_lines" ADD CONSTRAINT "debit_note_bill_lines_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchases" ADD CONSTRAINT "general_purchases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchases" ADD CONSTRAINT "general_purchases_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchases" ADD CONSTRAINT "general_purchases_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchases" ADD CONSTRAINT "general_purchases_freight_ledger_id_fkey" FOREIGN KEY ("freight_ledger_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchases" ADD CONSTRAINT "general_purchases_packing_ledger_id_fkey" FOREIGN KEY ("packing_ledger_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchases" ADD CONSTRAINT "general_purchases_other_charges_ledger_id_fkey" FOREIGN KEY ("other_charges_ledger_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchase_lines" ADD CONSTRAINT "general_purchase_lines_general_purchase_id_fkey" FOREIGN KEY ("general_purchase_id") REFERENCES "general_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchase_lines" ADD CONSTRAINT "general_purchase_lines_expense_ledger_id_fkey" FOREIGN KEY ("expense_ledger_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "general_purchase_lines" ADD CONSTRAINT "general_purchase_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_purchase_bill_item_id_fkey" FOREIGN KEY ("purchase_bill_item_id") REFERENCES "purchase_bill_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

