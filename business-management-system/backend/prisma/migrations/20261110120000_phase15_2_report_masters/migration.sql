-- AlterTable
ALTER TABLE "debit_notes" ADD COLUMN     "broker_id" TEXT,
ADD COLUMN     "salesperson_id" TEXT,
ADD COLUMN     "transporter_id" TEXT,
ADD COLUMN     "vehicle_number" TEXT;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "item_group_id" TEXT;

-- AlterTable
ALTER TABLE "parties" ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "party_group_id" TEXT;

-- AlterTable
ALTER TABLE "purchase_bill_items" ADD COLUMN     "item_id" TEXT,
ADD COLUMN     "yarn_grade_id" TEXT,
ADD COLUMN     "yarn_quality_id" TEXT;

-- AlterTable
ALTER TABLE "purchase_bills" ADD COLUMN     "book_id" TEXT,
ADD COLUMN     "broker_id" TEXT,
ADD COLUMN     "delivery_party_id" TEXT,
ADD COLUMN     "salesperson_id" TEXT,
ADD COLUMN     "transporter_id" TEXT,
ADD COLUMN     "vehicle_number" TEXT;

-- CreateTable
CREATE TABLE "party_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "party_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "area_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brokers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "broker_code" TEXT NOT NULL,
    "broker_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transporters" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "transporter_code" TEXT NOT NULL,
    "transporter_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transporters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salespersons" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "salesperson_code" TEXT NOT NULL,
    "salesperson_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salespersons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_books" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "book_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "party_groups_company_id_is_active_idx" ON "party_groups"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "party_groups_company_id_id_key" ON "party_groups"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "party_groups_company_id_group_name_key" ON "party_groups"("company_id", "group_name");

-- CreateIndex
CREATE INDEX "areas_company_id_is_active_idx" ON "areas"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "areas_company_id_id_key" ON "areas"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "areas_company_id_area_name_key" ON "areas"("company_id", "area_name");

-- CreateIndex
CREATE INDEX "brokers_company_id_is_active_idx" ON "brokers"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "brokers_company_id_id_key" ON "brokers"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "brokers_company_id_broker_code_key" ON "brokers"("company_id", "broker_code");

-- CreateIndex
CREATE INDEX "transporters_company_id_is_active_idx" ON "transporters"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "transporters_company_id_id_key" ON "transporters"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "transporters_company_id_transporter_code_key" ON "transporters"("company_id", "transporter_code");

-- CreateIndex
CREATE INDEX "salespersons_company_id_is_active_idx" ON "salespersons"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "salespersons_company_id_id_key" ON "salespersons"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "salespersons_company_id_salesperson_code_key" ON "salespersons"("company_id", "salesperson_code");

-- CreateIndex
CREATE INDEX "item_groups_company_id_is_active_idx" ON "item_groups"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "item_groups_company_id_id_key" ON "item_groups"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "item_groups_company_id_group_name_key" ON "item_groups"("company_id", "group_name");

-- CreateIndex
CREATE INDEX "purchase_books_company_id_financial_year_id_is_active_idx" ON "purchase_books"("company_id", "financial_year_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_books_company_id_id_key" ON "purchase_books"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_books_company_id_financial_year_id_id_key" ON "purchase_books"("company_id", "financial_year_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_books_company_id_financial_year_id_book_name_key" ON "purchase_books"("company_id", "financial_year_id", "book_name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_books_company_id_financial_year_id_prefix_key" ON "purchase_books"("company_id", "financial_year_id", "prefix");

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_company_id_party_group_id_fkey" FOREIGN KEY ("company_id", "party_group_id") REFERENCES "party_groups"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parties" ADD CONSTRAINT "parties_company_id_area_id_fkey" FOREIGN KEY ("company_id", "area_id") REFERENCES "areas"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_groups" ADD CONSTRAINT "party_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transporters" ADD CONSTRAINT "transporters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_groups" ADD CONSTRAINT "item_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_books" ADD CONSTRAINT "purchase_books_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_books" ADD CONSTRAINT "purchase_books_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_company_id_delivery_party_id_fkey" FOREIGN KEY ("company_id", "delivery_party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_company_id_financial_year_id_book_id_fkey" FOREIGN KEY ("company_id", "financial_year_id", "book_id") REFERENCES "purchase_books"("company_id", "financial_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_company_id_broker_id_fkey" FOREIGN KEY ("company_id", "broker_id") REFERENCES "brokers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_company_id_transporter_id_fkey" FOREIGN KEY ("company_id", "transporter_id") REFERENCES "transporters"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bills" ADD CONSTRAINT "purchase_bills_company_id_salesperson_id_fkey" FOREIGN KEY ("company_id", "salesperson_id") REFERENCES "salespersons"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_yarn_quality_id_fkey" FOREIGN KEY ("yarn_quality_id") REFERENCES "yarn_qualities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill_items" ADD CONSTRAINT "purchase_bill_items_yarn_grade_id_fkey" FOREIGN KEY ("yarn_grade_id") REFERENCES "yarn_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_item_group_id_fkey" FOREIGN KEY ("company_id", "item_group_id") REFERENCES "item_groups"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_broker_id_fkey" FOREIGN KEY ("company_id", "broker_id") REFERENCES "brokers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_transporter_id_fkey" FOREIGN KEY ("company_id", "transporter_id") REFERENCES "transporters"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_salesperson_id_fkey" FOREIGN KEY ("company_id", "salesperson_id") REFERENCES "salespersons"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

