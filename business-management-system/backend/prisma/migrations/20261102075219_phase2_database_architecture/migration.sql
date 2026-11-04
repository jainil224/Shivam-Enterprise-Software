/*
  Warnings:

  - You are about to drop the column `createdAt` on the `system_settings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `system_settings` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `system_settings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'BOTH');

-- CreateEnum
CREATE TYPE "BalanceType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ProductionReceiveStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "company_code" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "gstin" TEXT,
    "pan_number" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "logo_path" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_years" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "year_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "party_name" TEXT NOT NULL,
    "party_code" TEXT NOT NULL,
    "party_type" "PartyType" NOT NULL DEFAULT 'CUSTOMER',
    "gstin" TEXT,
    "pan_number" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "balance_type" "BalanceType" NOT NULL DEFAULT 'DEBIT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "machine_code" TEXT NOT NULL,
    "machine_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "operator_code" TEXT NOT NULL,
    "operator_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yarn_qualities" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "quality_name" TEXT NOT NULL,
    "denier" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yarn_qualities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yarn_grades" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "grade_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yarn_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_books" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "book_name" TEXT NOT NULL,
    "opening_balance" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_receives" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "production_book_id" TEXT NOT NULL,
    "challan_number" TEXT NOT NULL,
    "challan_date" TIMESTAMP(3) NOT NULL,
    "party_id" TEXT,
    "machine_id" TEXT,
    "operator_id" TEXT,
    "yarn_quality_id" TEXT,
    "yarn_grade_id" TEXT,
    "lot_number" TEXT,
    "twist" TEXT,
    "empty_cops_weight" DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    "location_id" TEXT,
    "remarks" TEXT,
    "status" "ProductionReceiveStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_receives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_receive_items" (
    "id" TEXT NOT NULL,
    "production_receive_id" TEXT NOT NULL,
    "carton_number" TEXT NOT NULL,
    "carton_weight" DECIMAL(10,3) NOT NULL,
    "cops" INTEGER NOT NULL,
    "gross_weight" DECIMAL(10,3) NOT NULL,
    "cops_weight" DECIMAL(10,3) NOT NULL,
    "tare_weight" DECIMAL(10,3) NOT NULL,
    "net_weight" DECIMAL(10,3) NOT NULL,
    "twist" TEXT,
    "lot_number" TEXT,
    "grade" TEXT,
    "average_weight" DECIMAL(10,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_receive_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_company_code_key" ON "companies"("company_code");

-- CreateIndex
CREATE INDEX "financial_years_company_id_is_active_idx" ON "financial_years"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "financial_years_company_id_start_date_end_date_idx" ON "financial_years"("company_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_company_id_year_name_key" ON "financial_years"("company_id", "year_name");

-- CreateIndex
CREATE INDEX "parties_company_id_party_type_idx" ON "parties"("company_id", "party_type");

-- CreateIndex
CREATE INDEX "parties_company_id_party_name_idx" ON "parties"("company_id", "party_name");

-- CreateIndex
CREATE UNIQUE INDEX "parties_company_id_party_code_key" ON "parties"("company_id", "party_code");

-- CreateIndex
CREATE UNIQUE INDEX "machines_company_id_machine_code_key" ON "machines"("company_id", "machine_code");

-- CreateIndex
CREATE UNIQUE INDEX "operators_company_id_operator_code_key" ON "operators"("company_id", "operator_code");

-- CreateIndex
CREATE UNIQUE INDEX "locations_company_id_location_name_key" ON "locations"("company_id", "location_name");

-- CreateIndex
CREATE UNIQUE INDEX "yarn_qualities_company_id_quality_name_key" ON "yarn_qualities"("company_id", "quality_name");

-- CreateIndex
CREATE UNIQUE INDEX "yarn_grades_company_id_grade_name_key" ON "yarn_grades"("company_id", "grade_name");

-- CreateIndex
CREATE UNIQUE INDEX "production_books_company_id_financial_year_id_book_name_key" ON "production_books"("company_id", "financial_year_id", "book_name");

-- CreateIndex
CREATE UNIQUE INDEX "production_books_company_id_financial_year_id_prefix_key" ON "production_books"("company_id", "financial_year_id", "prefix");

-- CreateIndex
CREATE INDEX "production_receives_company_id_financial_year_id_challan_da_idx" ON "production_receives"("company_id", "financial_year_id", "challan_date");

-- CreateIndex
CREATE INDEX "production_receives_company_id_party_id_idx" ON "production_receives"("company_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_receives_company_id_financial_year_id_production_key" ON "production_receives"("company_id", "financial_year_id", "production_book_id", "challan_number");

-- CreateIndex
CREATE INDEX "production_receive_items_production_receive_id_idx" ON "production_receive_items"("production_receive_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_receive_items_production_receive_id_carton_numbe_key" ON "production_receive_items"("production_receive_id", "carton_number");

-- AddForeignKey
ALTER TABLE "financial_years" ADD CONSTRAINT "financial_years_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operators" ADD CONSTRAINT "operators_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yarn_qualities" ADD CONSTRAINT "yarn_qualities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yarn_grades" ADD CONSTRAINT "yarn_grades_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_books" ADD CONSTRAINT "production_books_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_books" ADD CONSTRAINT "production_books_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_production_book_id_fkey" FOREIGN KEY ("production_book_id") REFERENCES "production_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_yarn_quality_id_fkey" FOREIGN KEY ("yarn_quality_id") REFERENCES "yarn_qualities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_yarn_grade_id_fkey" FOREIGN KEY ("yarn_grade_id") REFERENCES "yarn_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_receive_items" ADD CONSTRAINT "production_receive_items_production_receive_id_fkey" FOREIGN KEY ("production_receive_id") REFERENCES "production_receives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
