-- DropForeignKey
ALTER TABLE "production_books" DROP CONSTRAINT "production_books_financial_year_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_financial_year_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_location_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_machine_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_operator_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_party_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_production_book_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_yarn_grade_id_fkey";

-- DropForeignKey
ALTER TABLE "production_receives" DROP CONSTRAINT "production_receives_yarn_quality_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "financial_years_company_id_id_key" ON "financial_years"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_company_id_id_key" ON "locations"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "machines_company_id_id_key" ON "machines"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "operators_company_id_id_key" ON "operators"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "parties_company_id_id_key" ON "parties"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "production_books_company_id_id_key" ON "production_books"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "production_books_company_id_financial_year_id_id_key" ON "production_books"("company_id", "financial_year_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "yarn_grades_company_id_id_key" ON "yarn_grades"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "yarn_qualities_company_id_id_key" ON "yarn_qualities"("company_id", "id");

-- AddForeignKey (Composite: ProductionBook must belong to same Company as FinancialYear)
ALTER TABLE "production_books" ADD CONSTRAINT "production_books_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive must belong to same Company as FinancialYear)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_financial_year_id_fkey" FOREIGN KEY ("company_id", "financial_year_id") REFERENCES "financial_years"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive must belong to same Company and FinancialYear as ProductionBook)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_financial_year_id_productio_fkey" FOREIGN KEY ("company_id", "financial_year_id", "production_book_id") REFERENCES "production_books"("company_id", "financial_year_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive party must belong to same Company)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_party_id_fkey" FOREIGN KEY ("company_id", "party_id") REFERENCES "parties"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive machine must belong to same Company)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_machine_id_fkey" FOREIGN KEY ("company_id", "machine_id") REFERENCES "machines"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive operator must belong to same Company)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_operator_id_fkey" FOREIGN KEY ("company_id", "operator_id") REFERENCES "operators"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive yarnQuality must belong to same Company)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_yarn_quality_id_fkey" FOREIGN KEY ("company_id", "yarn_quality_id") REFERENCES "yarn_qualities"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive yarnGrade must belong to same Company)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_yarn_grade_id_fkey" FOREIGN KEY ("company_id", "yarn_grade_id") REFERENCES "yarn_grades"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (Composite: ProductionReceive location must belong to same Company)
ALTER TABLE "production_receives" ADD CONSTRAINT "production_receives_company_id_location_id_fkey" FOREIGN KEY ("company_id", "location_id") REFERENCES "locations"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- DATABASE TRIGGER: Financial Year Overlap Prevention per Company
-- =====================================================================
CREATE OR REPLACE FUNCTION check_financial_year_overlap()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate date chronology
    IF NEW.start_date >= NEW.end_date THEN
        RAISE EXCEPTION 'Financial year start date (%) must be strictly before end date (%)', NEW.start_date, NEW.end_date;
    END IF;

    -- Check for overlapping date ranges within the same company
    IF EXISTS (
        SELECT 1
        FROM financial_years
        WHERE company_id = NEW.company_id
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
          AND NEW.start_date <= end_date
          AND NEW.end_date >= start_date
    ) THEN
        RAISE EXCEPTION 'Financial year date range (% to %) overlaps with an existing financial year for company %', 
            NEW.start_date, NEW.end_date, NEW.company_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_financial_year_overlap ON financial_years;
CREATE TRIGGER trg_check_financial_year_overlap
BEFORE INSERT OR UPDATE ON financial_years
FOR EACH ROW
EXECUTE FUNCTION check_financial_year_overlap();

