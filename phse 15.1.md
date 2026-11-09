# PHASE 15.1 — SALES & PURCHASE REPORT ENHANCEMENTS
## OpenCode Implementation Prompt — Complete Remaining Work

**Project:** SHIVAM ENTERPRISE Business Management System  
**Feature:** Sales & Purchase Bill Base Report  
**Existing Phase:** Phase 15 — Implemented  
**Enhancement Phase:** Phase 15.1  
**Stack:** React + TypeScript + Vite, Express + TypeScript, Prisma, PostgreSQL 18

---

# 1. OBJECTIVE

Phase 15 has already been implemented and verified.

Do not rebuild it.

The previous completion report confirms:

- 160/160 Phase 15 automated assertions passed.
- 31/31 Phase 15 browser assertions passed.
- 191/191 Phase 14 assertions passed.
- Phase 13: 135/135 passed.
- Phase 12: 85/85 passed.
- Frontend and backend TypeScript compilation passed.
- No browser console errors.
- No database migration was needed in Phase 15.

However, several improvements remain.

Your task is to inspect the latest repository and implement the remaining improvements listed below.

The main priorities are:

1. Fix the Item filter limitation.
2. Improve report grouping to match Chandni Software.
3. Make column filters work across the entire filtered dataset.
4. Store custom column layouts in PostgreSQL instead of only browser localStorage.
5. Improve direct PDF export.
6. Test large datasets and multi-page reports.
7. Investigate partially supported report formats and complete only those that can use genuine existing data.

This must be a targeted enhancement, not a rewrite.

# 2. PROTECT THE EXISTING IMPLEMENTATION

First inspect the latest repository.

Read:

- `backend/src/types/reportTypes.ts`
- `backend/src/utils/xlsxWriter.ts`
- `backend/src/repositories/reportRepository.ts`
- `backend/src/services/reportService.ts`
- `backend/src/controllers/reportController.ts`
- `backend/src/routes/reportRoutes.ts`
- `frontend/src/types/reports.ts`
- `frontend/src/components/ReportColumnSelector.tsx`
- `frontend/src/components/ReportMenuPanel.tsx`
- `frontend/src/pages/ReportBillBaseConfigPage.tsx`
- `frontend/src/pages/ReportBillBaseResultsPage.tsx`
- `frontend/src/pages/ReportBillBasePrintPage.tsx`
- Existing report API services.
- Current Prisma schema and migrations.

Also inspect:

- Current `git status`.
- Existing PurchaseBill and PurchaseBillItem models.
- DebitNote and DebitNoteLine models.
- Party and Item models.
- Existing authentication/user model, if present.
- Existing PDF/export dependencies.
- Existing Phase 14 and Phase 15 tests.

## Strict protection rules

- Do not reset PostgreSQL.
- Do not delete existing transactions.
- Do not modify historical migrations.
- Do not run `git reset`, `git clean` or destructive checkout commands.
- Do not delete previous uncommitted user changes.
- Do not commit or push.
- Do not replace existing report functionality with mocked data.
- Do not rewrite the report engine unnecessarily.
- Preserve the existing API contracts unless a backward-compatible enhancement is necessary.

Before making changes, identify the exact current limitations and files responsible.

Proceed with implementation after inspection.

# 3. FIX THE ITEM FILTER

## Current problem

Phase 15 reports that the Item filter is disabled because the Item Master contains no records.

However, existing Purchase Bills contain actual saved item descriptions and their corresponding purchase-bill lines.

The item filter should not depend exclusively on an Item Master foreign key.

## Required behaviour

Inspect the existing PurchaseBillItem schema and actual stored data.

If Purchase Bill lines have genuine item descriptions but no Item Master ID:

- Fetch distinct valid item descriptions from actual PurchaseBillItem records.
- Return them through the report filter-options API.
- Allow users to select these values.
- Apply the selected item filter to report queries.
- Match the actual stored item description using safe, normalized comparison.
- Preserve the original item description in report output.

Support Item Master-linked items as well whenever they exist.

Use the best available real-data source.

Do not create fake Item Master records to make the dropdown appear populated.

Do not seed demo items into production data.

If neither Item Master records nor stored purchase-bill item descriptions exist, show a genuine empty state and explain why the filter is unavailable.

### Acceptance test

1. Create or use actual test PurchaseBillItem records with multiple item descriptions.
2. Open report configuration.
3. Verify the item dropdown displays those real descriptions.
4. Select one item.
5. Generate the report.
6. Verify that only matching bill rows/item details are returned.
7. Verify other items are excluded.
8. Verify the filtered totals are correct.

Clean up test data after execution.

# 4. IMPLEMENT DRAG-AND-DROP GROUPING

## Current limitation

Phase 15 uses a drag-free expandable group tree.

The Chandni reference screenshot shows:

`Drag a column to group`

I want that interaction added.

## Required UI

At the top of the results grid, add a grouping drop zone.

Display a hint:

`Drag a column here to group the report`

Allow the user to drag an eligible column header into the grouping zone.

Example:

Dragging `Party Name` into the zone should group the report by party.

Display:

- Group field name.
- Remove-group control.
- Grouping order.
- Clear all groups.

Support nested grouping:

Example:

1. Party Name.
2. Quality Name.

The order of fields determines the nested grouping order.

Allow reordering the grouping fields.

Maintain an accessible alternative for users who cannot use drag and drop, such as a grouping-field selector.

## Grouping rules

- Grouping must happen across the complete filtered dataset.
- Group totals must not be calculated only from the visible page.
- Grand totals must remain consistent with the complete filtered dataset.
- Group nodes must expand and collapse.
- Group headers must show the group value and record count.
- Subtotals must be correct.
- Expandable bill rows must continue to show actual stored item details.
- Do not double-count bill totals when item details are expanded.
- Invalid grouping fields must return a clear validation error.
- Do not group by fields unavailable in the selected source data.

Reuse the existing backend grouping service where possible.

Do not move all report data into the browser merely to implement dragging.

### Acceptance test

1. Generate a real purchase report.
2. Drag Party Name into the group zone.
3. Verify party-wise grouping.
4. Add Quality Name as the second grouping field where supported.
5. Verify nested groups.
6. Expand and collapse groups.
7. Verify dataset-wide totals.
8. Remove a group.
9. Verify the report returns to the correct ungrouped state.

# 5. CHANGE COLUMN FILTERS FROM PAGE-SCOPED TO DATASET-WIDE

## Current limitation

Phase 15 currently labels its column filters:

`filter page`

This means filtering may only apply to currently visible rows.

That is not sufficient for a professional ERP report.

## Required behaviour

Column filters must operate against the complete matching dataset.

When a user filters a column:

1. Send the column filter to the backend.
2. Combine it with the existing report configuration filters.
3. Query the complete matching dataset.
4. Apply grouping and sorting.
5. Calculate correct group and grand totals.
6. Apply pagination to the resulting dataset.
7. Update the row count.
8. Update the filter UI state.

For example:

If a report contains 500 bills and the visible page shows only 25 bills, filtering for a particular party must search all 500 matching bills, not just the 25 currently displayed.

Support:

- Text contains.
- Exact match.
- Numeric equality.
- Numeric range where appropriate.
- Date range.
- Empty/non-empty filters where meaningful.

Only expose filter operators appropriate to each column data type.

Do not silently ignore an unsupported filter.

Display active filters clearly.

Provide a Clear Filters action.

## Totals

Filtered totals must always reflect all records matching the complete filter set, not only the current page.

Preserve the correct accounting source signs and per-source subtotals.

### Acceptance test

1. Generate a report containing more than one page.
2. Apply a party filter that matches records across multiple pages.
3. Verify all matching rows are included.
4. Verify the total matches the full filtered dataset.
5. Move between pages.
6. Verify totals remain unchanged.
7. Remove the filter.
8. Verify the original dataset and totals return.

# 6. PERSIST CUSTOM COLUMN LAYOUTS IN POSTGRESQL

## Current limitation

Current Phase 15 saves layouts using:

`localStorage: bms_report_bill_base_layouts_<companyId>`

This means saved layouts may not be available across browsers or devices.

I want a persistent database-backed column layout system.

## Required behaviour

Inspect whether an existing user-preference or saved-report configuration model exists.

Reuse it if suitable.

Otherwise introduce a minimal additive model.

Suggested model:

`ReportColumnLayout`

Possible fields:

- id
- companyId
- userId, if an authenticated user model exists
- reportType
- layoutName
- selectedColumns
- columnOrder
- isDefault
- createdAt
- updatedAt

Store selected columns as validated structured JSON or an appropriate relational structure.

Do not create an unnecessary new user-management system.

If there is no user identity infrastructure, scope layouts to the company and store an optional creator reference only if supported.

## API

Suggested endpoints:

- GET `/api/reports/column-layouts`
- GET `/api/reports/column-layouts/:id`
- POST `/api/reports/column-layouts`
- PUT `/api/reports/column-layouts/:id`
- DELETE `/api/reports/column-layouts/:id`
- POST `/api/reports/column-layouts/:id/default`

Adapt endpoint names to existing route conventions.

## UI

The current options must keep working:

1. Standard.
2. Selected.
3. New.
4. Edit.

Add:

- Save Layout.
- Rename Layout.
- Delete Layout.
- Set Default.
- Load Saved Layout.

Rules:

- Prevent duplicate layout names within the relevant company/user scope.
- Validate all saved column IDs against the current column catalogue.
- Prevent users from removing required columns.
- Preserve column order.
- Preserve layouts across browser restarts.
- Do not expose layouts belonging to other companies.
- Handle deleted or unavailable columns gracefully.

## Migration safety

Use a new additive Prisma migration.

Do not modify old migrations.

Do not reset the database.

### Acceptance test

1. Create a custom layout.
2. Save it.
3. Refresh browser.
4. Verify it remains available.
5. Open another browser session under the same permitted scope.
6. Verify the same layout can be loaded.
7. Edit column order.
8. Save changes.
9. Verify updated layout.
10. Attempt cross-company access and confirm it is rejected.

# 7. IMPLEMENT REAL DIRECT PDF EXPORT

## Current limitation

Current Phase 15 PDF behaviour uses the browser print dialog, with the user manually selecting Save as PDF.

The UI honestly discloses this.

I want a genuine direct PDF download as an additional option.

## First inspect

Check whether a PDF library or report-generation system already exists.

Reuse existing working infrastructure where possible.

Avoid installing a large or overlapping dependency without justification.

## Required behaviour

Add a separate button:

`Download PDF`

When selected:

1. Use the active report filters.
2. Use the active selected column layout.
3. Use the active grouping configuration.
4. Include item details according to the selected setting.
5. Include all matching records, not just the visible page.
6. Include correct group subtotals.
7. Include correct grand totals.
8. Generate a valid PDF document.
9. Start a genuine `.pdf` download.

Do not create an HTML file and rename it `.pdf`.

Do not create an image and rename it `.pdf`.

Do not create a browser print page and falsely describe it as direct PDF generation.

## PDF layout

Include:

- Company name.
- Company address.
- GSTIN.
- Financial year.
- Report title.
- Report type.
- From and To dates.
- Selected filters.
- Table headings.
- Actual report data.
- Group headings.
- Group totals.
- Grand total.
- Page number.

Support:

- A4 portrait.
- A4 landscape.
- Repeated table headers.
- Multi-page output.
- Correct currency formatting.
- Correct date formatting.
- No clipped columns.
- No missing totals.

The existing browser Print / Save as PDF option should remain available as a separate action.

Excel export must continue to generate a valid XLSX.

### Acceptance test

- Verify file extension is `.pdf`.
- Verify actual PDF signature/header.
- Verify PDF can be opened by a PDF reader.
- Verify page count.
- Verify correct report title and company.
- Verify actual invoice values.
- Verify totals.
- Verify landscape and portrait.
- Verify multi-page content.
- Verify the full filtered dataset is exported.

# 8. REVIEW PARTIALLY SUPPORTED REPORT FORMATS

The current status is:

FULL:
- Bill No Wise
- Date Wise
- Party Wise
- City Wise
- Month Wise
- Month Wise All Report
- Purchase Serial Wise

PARTIAL:
- Quality Wise
- Party + Quality Wise
- Book Wise
- Month + Quality Wise
- Quality + Month Wise

UNAVAILABLE:
- Group + Party Wise
- Area Wise
- Broker + Party Wise
- Transporter Wise
- Salesman + Party Wise
- Salesman + Party Wise (duplicate label)
- Expense Wise
- Vehicle Wise

Inspect each partially supported format.

If the necessary grouping information can be obtained from actual stored data, complete the report.

If the required field does not exist:

- Keep the format partially supported or unavailable.
- Explain the exact missing field.
- Do not fabricate values.
- Do not invent new master records.

Do not implement new Broker, Transporter, Salesperson, Vehicle or Area masters in this task just to make every report name available.

Those must be separate future features.

Preserve the duplicate Salesman + Party Wise labels until their distinction can be established.

# 9. SALES REPORT SOURCE — DO NOT FABRICATE

The current report cannot support ordinary Sales bills because there is no working Sales Invoice/Sales Bill model.

Inspect the latest project again.

If a real Sales Invoice/Sales Bill module has been implemented since Phase 15:

- Build a proper source adapter.
- Use its real bill headers and item lines.
- Use real party, tax, book, date, quantity and amount fields.
- Add Sales mode to filter configuration.
- Support Sales and Purchase together in Selected mode only when both source types are valid.
- Validate accounting direction and cancellations.
- Test actual source records.

If no Sales Invoice/Sales Bill model exists:

- Keep Sales mode disabled.
- Keep its explanation visible.
- Do not invent a Sales Invoice model as part of this enhancement.
- Do not count Sales Orders as completed Sales Bills.
- Do not count Sales Debit Notes as ordinary Sales Invoices.

Prepare a separate technical proposal for the future Sales Invoice module.

Do not implement that separate module without an explicit specification or real screen references.

# 10. PERFORMANCE AND LARGE-DATASET TESTING

The report must remain reliable when transaction counts increase.

Test:

- 100 bills.
- 1,000 bills.
- 5,000 bills.
- Multiple item lines per bill.
- Multiple parties.
- Multiple books.
- Several pages.
- Nested grouping.
- Dataset-wide column filters.
- Full XLSX export.
- Full direct PDF export.

Use test-only fixtures or a dedicated isolated database environment.

Do not seed demo invoices into production.

Do not consume real customer data for destructive tests.

## Query rules

- Use PostgreSQL-side filtering.
- Avoid N+1 queries.
- Use appropriate indexes.
- Use Decimal-safe aggregation.
- Paginate large screen results.
- Calculate totals over the complete filtered dataset.
- Avoid downloading every record just to filter it in React.
- Reuse the same report query/aggregation logic for screen, PDF and Excel.
- Avoid generating inconsistent totals in different export implementations.

Report actual performance and any limits honestly.

# 11. REGRESSION PROTECTION

Preserve:

- Company Management.
- Financial Year Management.
- Party Master.
- Item Master.
- Purchase Bill.
- Debit Note.
- Ledger Account Master.
- Bank Receipt.
- Bank Payment.
- Sales Order.
- Purchase Order.
- GSTINAPI integration.
- Production Receive.
- Production Challan.
- Packing Slip.
- Phase 15 existing report features.
- Existing XLSX export.

Do not change unrelated modules.

Do not change the accounting direction of existing vouchers.

Do not update or delete existing append-only JournalLine records.

Do not modify historical migrations.

Do not reset PostgreSQL.

# 12. REQUIRED TESTING

Create or extend Phase 15.1 tests.

### Item filter

- Real item names are loaded from PurchaseBillItem.
- Item Master items are supported.
- Item filtering works across the full dataset.
- Empty state is correct when no data exists.

### Grouping

- Drag a column into the group zone.
- Reorder grouping fields.
- Nested grouping works.
- Group totals are correct.
- Grand totals are correct.
- Expand/collapse works.
- Invalid fields are rejected.

### Dataset-wide filtering

- Filters search all records.
- Filters combine correctly.
- Pagination works after filtering.
- Totals remain dataset-wide.
- Clear filters restores the full result.

### Saved layouts

- Create.
- Read.
- Update.
- Rename.
- Delete.
- Set default.
- Reload across sessions.
- Company isolation.

### PDF

- Valid PDF output.
- Correct content.
- Correct totals.
- All pages present.
- Portrait/landscape.
- No clipping.

### Regression

Re-run:

- Phase 12 tests.
- Phase 13 tests.
- Phase 14 tests.
- Phase 15 tests.
- Existing backend regression suites.
- Browser verification.

Do not rewrite existing tests to hide failures.

# 13. FINAL ACCEPTANCE CRITERIA

The enhancement is complete only when:

1. The Item filter can use genuine stored purchase-bill item descriptions.
2. Drag-and-drop report grouping works.
3. Nested grouping works.
4. Group totals match the complete dataset.
5. Column filters operate over the full dataset, not just the visible page.
6. Dataset-wide totals remain correct after filtering.
7. Custom layouts are persisted in PostgreSQL.
8. Layouts survive browser refresh and new sessions.
9. Direct PDF downloads work.
10. Browser Print / Save as PDF remains available.
11. XLSX export remains valid.
12. Large reports and multi-page output are verified.
13. Unsupported report sources remain honestly unavailable.
14. Existing Phase 15 functionality remains intact.
15. Existing regression suites pass.

# 14. FINAL COMPLETION REPORT

Provide:

1. Phase 15.1 summary.
2. Item filter fix.
3. Grouping improvements.
4. Dataset-wide filtering.
5. Database-backed layouts.
6. New migration name and status.
7. PDF generation implementation.
8. XLSX regression result.
9. Large dataset performance results.
10. Report formats completed.
11. Formats still unavailable and why.
12. Sales report source status.
13. Files created.
14. Files modified.
15. Backend TypeScript results.
16. Frontend build results.
17. Phase 15.1 tests.
18. Phase 12–15 regression results.
19. Browser verification.
20. Remaining limitations.

Only report tests that were actually run.

Do not claim a missing feature was implemented.

Do not commit or push.

Stop after the final report for manual review.

---

# FINAL DEVELOPMENT INSTRUCTION

This is an enhancement to a working Phase 15 module, not a replacement.

Work efficiently, reuse existing code, fix the identified limitations and preserve all previously completed features.

Priority order:

1. Real Item filter.
2. Drag-and-drop grouping.
3. Dataset-wide filtering.
4. PostgreSQL saved layouts.
5. Direct PDF export.
6. Large dataset testing.
7. Complete partially supported formats only where actual source data supports them.

Do not start a new Sales Invoice module in this task. Provide its separate technical proposal because it requires its own business workflow and screen specification.

The final result must be a reliable, fully data-driven Sales & Purchase Bill Base reporting system for SHIVAM ENTERPRISE.