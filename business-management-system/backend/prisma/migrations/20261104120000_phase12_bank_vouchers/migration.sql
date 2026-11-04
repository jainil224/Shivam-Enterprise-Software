-- CreateEnum
CREATE TYPE "LedgerAccountGroup" AS ENUM ('BANK', 'SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'DIRECT_EXPENSES', 'INDIRECT_EXPENSES', 'DIRECT_INCOME', 'INDIRECT_INCOME', 'ASSETS', 'LIABILITIES', 'CAPITAL', 'OTHERS');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BankVoucherType" AS ENUM ('RECEIPT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "BankVoucherStatus" AS ENUM ('POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_group" "LedgerAccountGroup" NOT NULL,
    "account_type" "LedgerAccountType" NOT NULL,
    "balance_type" "BalanceType" NOT NULL DEFAULT 'DEBIT',
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "is_bank_account" BOOLEAN NOT NULL DEFAULT false,
    "bank_name" TEXT,
    "branch_name" TEXT,
    "account_holder_name" TEXT,
    "ifsc_code" TEXT,
    "bank_account_number" TEXT,
    "party_id" TEXT,
    "is_auto_created" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_vouchers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "voucher_type" "BankVoucherType" NOT NULL,
    "voucher_number" TEXT NOT NULL,
    "voucher_date" TIMESTAMP(3) NOT NULL,
    "party_id" TEXT,
    "counterparty_ledger_id" TEXT NOT NULL,
    "bank_account_ledger_id" TEXT NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reference_number" TEXT,
    "cheque_number" TEXT,
    "cheque_date" TIMESTAMP(3),
    "bank_name" TEXT,
    "branch_name" TEXT,
    "narration" TEXT,
    "remarks" TEXT,
    "status" "BankVoucherStatus" NOT NULL DEFAULT 'POSTED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "ledger_account_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "line_number" INTEGER NOT NULL,
    "debit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "credit_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "is_reversal" BOOLEAN NOT NULL DEFAULT false,
    "posting_date" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_sequences" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "voucher_type" "BankVoucherType" NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_company_id_account_name_idx" ON "ledger_accounts"("company_id", "account_name");

-- CreateIndex
CREATE INDEX "ledger_accounts_company_id_account_group_idx" ON "ledger_accounts"("company_id", "account_group");

-- CreateIndex
CREATE INDEX "ledger_accounts_company_id_is_bank_account_is_active_idx" ON "ledger_accounts"("company_id", "is_bank_account", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_company_id_id_key" ON "ledger_accounts"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_company_id_account_code_key" ON "ledger_accounts"("company_id", "account_code");

-- CreateIndex
CREATE INDEX "bank_vouchers_company_id_financial_year_id_voucher_date_idx" ON "bank_vouchers"("company_id", "financial_year_id", "voucher_date");

-- CreateIndex
CREATE INDEX "bank_vouchers_company_id_voucher_type_status_idx" ON "bank_vouchers"("company_id", "voucher_type", "status");

-- CreateIndex
CREATE INDEX "bank_vouchers_company_id_party_id_idx" ON "bank_vouchers"("company_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_vouchers_company_id_financial_year_id_voucher_type_vou_key" ON "bank_vouchers"("company_id", "financial_year_id", "voucher_type", "voucher_number");

-- CreateIndex
CREATE UNIQUE INDEX "bank_vouchers_company_id_id_key" ON "bank_vouchers"("company_id", "id");

-- CreateIndex
CREATE INDEX "journal_lines_company_id_financial_year_id_ledger_account_i_idx" ON "journal_lines"("company_id", "financial_year_id", "ledger_account_id");

-- CreateIndex
CREATE INDEX "journal_lines_company_id_voucher_id_idx" ON "journal_lines"("company_id", "voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_sequences_company_id_financial_year_id_voucher_type_key" ON "voucher_sequences"("company_id", "financial_year_id", "voucher_type");

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_vouchers" ADD CONSTRAINT "bank_vouchers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_vouchers" ADD CONSTRAINT "bank_vouchers_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_vouchers" ADD CONSTRAINT "bank_vouchers_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_vouchers" ADD CONSTRAINT "bank_vouchers_company_id_counterparty_ledger_id_fkey" FOREIGN KEY ("company_id", "counterparty_ledger_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_vouchers" ADD CONSTRAINT "bank_vouchers_company_id_bank_account_ledger_id_fkey" FOREIGN KEY ("company_id", "bank_account_ledger_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "bank_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_company_id_ledger_account_id_fkey" FOREIGN KEY ("company_id", "ledger_account_id") REFERENCES "ledger_accounts"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_sequences" ADD CONSTRAINT "voucher_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_sequences" ADD CONSTRAINT "voucher_sequences_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

