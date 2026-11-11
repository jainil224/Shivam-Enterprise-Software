-- Phase 15.1 - Persistent, company-scoped report column layouts.
-- Additive only: no existing table, column, index or migration is modified.

CREATE TABLE IF NOT EXISTS "report_column_layouts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL DEFAULT 'BILL_BASE',
    "layout_name" TEXT NOT NULL,
    "selected_columns" JSONB NOT NULL,
    "column_order" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "report_column_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "report_column_layouts_company_id_report_type_layout_name_key"
    ON "report_column_layouts"("company_id", "report_type", "layout_name");

CREATE INDEX IF NOT EXISTS "report_column_layouts_company_id_report_type_idx"
    ON "report_column_layouts"("company_id", "report_type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_column_layouts_company_id_fkey'
  ) THEN
    ALTER TABLE "report_column_layouts"
      ADD CONSTRAINT "report_column_layouts_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
