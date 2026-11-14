-- Phase 19.3 - WhatsApp QR integration document delivery log.
-- Additive only: one new audit table. No existing table, column, index or
-- accounting model is altered, and no historical migration is edited.

-- CreateTable
CREATE TABLE "whatsapp_message_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "party_id" TEXT,
    "recipient_number" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_company_id_financial_year_id_created_at_idx" ON "whatsapp_message_logs"("company_id", "financial_year_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_company_id_document_type_document_id_idx" ON "whatsapp_message_logs"("company_id", "document_type", "document_id");