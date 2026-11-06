-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('KG', 'GRAM', 'METER', 'YARD', 'PIECE', 'ROLL', 'BOX', 'CARTON', 'PACKET', 'NOS');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('YARN', 'RAW_MATERIAL', 'FABRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderDocumentType" AS ENUM ('SALES_ORDER', 'PURCHASE_ORDER');

-- CreateEnum
CREATE TYPE "OrderTaxType" AS ENUM ('INTRA_STATE', 'INTER_STATE');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'CONFIRMED', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'COPIED', 'CANCELLED', 'STATUS_CHANGED', 'FULFILMENT_RECORDED');

-- CreateEnum
CREATE TYPE "OrderFulfilmentDocumentType" AS ENUM ('SALES_INVOICE', 'DELIVERY_CHALLAN', 'PURCHASE_BILL', 'GOODS_RECEIPT');

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_category" TEXT,
    "item_type" "ItemType" NOT NULL DEFAULT 'OTHER',
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'KG',
    "hsn_code" TEXT,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "default_sales_rate" DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    "default_purchase_rate" DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    "barcode" TEXT,
    "description" TEXT,
    "yarn_quality_id" TEXT,
    "yarn_grade_id" TEXT,
    "yarn_count" TEXT,
    "denier" TEXT,
    "lot_number" TEXT,
    "fabric_type" TEXT,
    "fabric_design" TEXT,
    "colour" TEXT,
    "size_specification" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sequences" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "order_type" "OrderDocumentType" NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "party_id" TEXT NOT NULL,
    "customer_reference_number" TEXT,
    "customer_reference_date" TIMESTAMP(3),
    "billing_address" TEXT,
    "delivery_address" TEXT,
    "expected_delivery_date" TIMESTAMP(3),
    "salesperson" TEXT,
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "freight_terms" TEXT,
    "order_valid_until" TIMESTAMP(3),
    "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "place_of_supply_state" TEXT,
    "tax_type" "OrderTaxType" NOT NULL DEFAULT 'INTRA_STATE',
    "total_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "packing_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "other_charges" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "round_off_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "schedule_is_partial" BOOLEAN NOT NULL DEFAULT false,
    "narration" TEXT,
    "remarks" TEXT,
    "terms_and_conditions" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" TEXT,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "yarn_quality_name" TEXT,
    "yarn_grade_name" TEXT,
    "yarn_count" TEXT,
    "denier" TEXT,
    "colour" TEXT,
    "design" TEXT,
    "specification" TEXT,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'KG',
    "quantity" DECIMAL(15,3) NOT NULL,
    "rate" DECIMAL(15,4) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "expected_delivery_date" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_schedules" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_line_id" TEXT NOT NULL,
    "schedule_date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "party_id" TEXT NOT NULL,
    "supplier_quotation_number" TEXT,
    "supplier_quotation_date" TIMESTAMP(3),
    "supplier_reference" TEXT,
    "supplier_gstin" TEXT,
    "billing_address" TEXT,
    "delivery_location_id" TEXT,
    "expected_delivery_date" TIMESTAMP(3),
    "buyer_name" TEXT,
    "payment_terms" TEXT,
    "delivery_terms" TEXT,
    "freight_terms" TEXT,
    "transport_details" TEXT,
    "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "place_of_supply_state" TEXT,
    "tax_type" "OrderTaxType" NOT NULL DEFAULT 'INTRA_STATE',
    "total_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "packing_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "other_charges" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "round_off_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "narration" TEXT,
    "remarks" TEXT,
    "terms_and_conditions" TEXT,
    "supplier_confirmation_date" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_id" TEXT,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "yarn_quality_name" TEXT,
    "yarn_count" TEXT,
    "denier" TEXT,
    "yarn_grade_name" TEXT,
    "lot_number" TEXT,
    "specification" TEXT,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'KG',
    "quantity" DECIMAL(15,3) NOT NULL,
    "rate" DECIMAL(15,4) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "line_total" DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    "expected_receipt_date" TIMESTAMP(3),
    "revised_delivery_date" TIMESTAMP(3),
    "delivery_location_id" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "order_type" "OrderDocumentType" NOT NULL,
    "sales_order_id" TEXT,
    "purchase_order_id" TEXT,
    "action" "OrderHistoryAction" NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "note" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_fulfilment_links" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "order_type" "OrderDocumentType" NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_line_id" TEXT NOT NULL,
    "document_type" "OrderFulfilmentDocumentType" NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "document_date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_fulfilment_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "items_company_id_is_active_item_type_idx" ON "items"("company_id", "is_active", "item_type");

-- CreateIndex
CREATE INDEX "items_company_id_item_name_idx" ON "items"("company_id", "item_name");

-- CreateIndex
CREATE UNIQUE INDEX "items_company_id_id_key" ON "items"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "items_company_id_item_code_key" ON "items"("company_id", "item_code");

-- CreateIndex
CREATE UNIQUE INDEX "order_sequences_company_id_financial_year_id_order_type_key" ON "order_sequences"("company_id", "financial_year_id", "order_type");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_financial_year_id_order_date_idx" ON "sales_orders"("company_id", "financial_year_id", "order_date");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_financial_year_id_status_idx" ON "sales_orders"("company_id", "financial_year_id", "status");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_financial_year_id_expected_delivery_idx" ON "sales_orders"("company_id", "financial_year_id", "expected_delivery_date");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_party_id_idx" ON "sales_orders"("company_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_company_id_financial_year_id_order_number_key" ON "sales_orders"("company_id", "financial_year_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_company_id_id_key" ON "sales_orders"("company_id", "id");

-- CreateIndex
CREATE INDEX "sales_order_lines_company_id_item_id_idx" ON "sales_order_lines"("company_id", "item_id");

-- CreateIndex
CREATE INDEX "sales_order_lines_sales_order_id_idx" ON "sales_order_lines"("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_sales_order_id_line_number_key" ON "sales_order_lines"("sales_order_id", "line_number");

-- CreateIndex
CREATE INDEX "sales_order_schedules_sales_order_id_schedule_date_idx" ON "sales_order_schedules"("sales_order_id", "schedule_date");

-- CreateIndex
CREATE INDEX "sales_order_schedules_sales_order_line_id_idx" ON "sales_order_schedules"("sales_order_line_id");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_financial_year_id_order_date_idx" ON "purchase_orders"("company_id", "financial_year_id", "order_date");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_financial_year_id_status_idx" ON "purchase_orders"("company_id", "financial_year_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_financial_year_id_expected_deliv_idx" ON "purchase_orders"("company_id", "financial_year_id", "expected_delivery_date");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_party_id_idx" ON "purchase_orders"("company_id", "party_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_company_id_financial_year_id_order_number_key" ON "purchase_orders"("company_id", "financial_year_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_company_id_id_key" ON "purchase_orders"("company_id", "id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_company_id_item_id_idx" ON "purchase_order_lines"("company_id", "item_id");

-- CreateIndex
CREATE INDEX "purchase_order_lines_purchase_order_id_idx" ON "purchase_order_lines"("purchase_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_lines_purchase_order_id_line_number_key" ON "purchase_order_lines"("purchase_order_id", "line_number");

-- CreateIndex
CREATE INDEX "order_status_history_company_id_order_type_sales_order_id_c_idx" ON "order_status_history"("company_id", "order_type", "sales_order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_status_history_company_id_order_type_purchase_order_i_idx" ON "order_status_history"("company_id", "order_type", "purchase_order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_fulfilment_links_company_id_order_type_order_id_idx" ON "order_fulfilment_links"("company_id", "order_type", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_fulfilment_links_company_id_order_type_order_line_id__key" ON "order_fulfilment_links"("company_id", "order_type", "order_line_id", "document_type", "document_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_yarn_quality_id_fkey" FOREIGN KEY ("company_id", "yarn_quality_id") REFERENCES "yarn_qualities"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_yarn_grade_id_fkey" FOREIGN KEY ("company_id", "yarn_grade_id") REFERENCES "yarn_grades"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sequences" ADD CONSTRAINT "order_sequences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sequences" ADD CONSTRAINT "order_sequences_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_company_id_item_id_fkey" FOREIGN KEY ("company_id", "item_id") REFERENCES "items"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_schedules" ADD CONSTRAINT "sales_order_schedules_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_schedules" ADD CONSTRAINT "sales_order_schedules_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_delivery_location_id_fkey" FOREIGN KEY ("company_id", "delivery_location_id") REFERENCES "locations"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_company_id_item_id_fkey" FOREIGN KEY ("company_id", "item_id") REFERENCES "items"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_company_id_delivery_location_id_fkey" FOREIGN KEY ("company_id", "delivery_location_id") REFERENCES "locations"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfilment_links" ADD CONSTRAINT "order_fulfilment_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfilment_links" ADD CONSTRAINT "order_fulfilment_links_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

