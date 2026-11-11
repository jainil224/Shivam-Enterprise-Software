# PHASE 15.2 — COMPLETE SALES & PURCHASE BILL BASE REPORT
## UI Redesign + All Report Formats + Chandni-Style Print Preview

**Project:** SHIVAM ENTERPRISE Business Management System  
**Feature:** Sales & Purchase Bill Base Report  
**Reference Software:** Chandni Weaving Software  
**Frontend:** React + TypeScript + Vite  
**Backend:** Express + TypeScript  
**Database:** PostgreSQL 18  
**ORM:** Prisma  
**Development Agent:** OpenCode

---

# 1. MAIN OBJECTIVE

Improve the existing Phase 15 and Phase 15.1 Sales & Purchase Bill Base Report.

The current UI is not matching the reference layout properly, and several report formats still show PARTIAL or N/A.

I want a complete, professional reporting module inspired by Chandni Software.

There are three main deliverables:

1. Redesign the report configuration UI to match the reference layout.
2. Make all 20 report formats and available filter sections genuinely functional.
3. Rebuild the A4 print preview to closely match the Chandni-style printed report.

**Important:** OpenCode may not have access to the screenshots. All reference details are therefore specified in this prompt. Do not depend on image attachments.

Do not simply modify CSS while keeping broken functionality.

Do not just change PARTIAL/N/A labels to READY.

Implement the actual report algorithms, underlying data fields, master-data relationships, filtering and calculations.

# 2. PROTECT EXISTING PHASE 15.1

Phase 15 and 15.1 are already implemented and verified.

The reported results include:

- Phase 15: 161/161 tests.
- Phase 15.1: 134/134 tests.
- Performance tests: 48/48.
- Phase 14: 191/191 tests.
- Phase 13: 135/135 tests.
- Phase 12: 85/85 tests.
- Desktop and mobile browser verification.
- Genuine XLSX generation.
- Genuine PDF generation.
- Database-backed report column layouts.
- Dataset-wide filters.
- Nested grouping.

Preserve all these working features.

Before editing, inspect the latest repository, current Git status, tests, migration history and report implementation.

Never discard existing user modifications.

Do not use:

- `git reset --hard`
- `git clean`
- Destructive checkout commands
- Database reset
- Historical migration modification

Do not commit or push.

Do not delete unrelated untracked files or user data.

# 3. EXACT UI REDESIGN — CONFIGURATION SCREEN

The current configuration screen has:

- A left report-name panel.
- Large white filter cards.
- Three-column filter arrangement.
- Large stretched form controls.
- Top BMS navigation.

The desired reference is different.

## A. Overall Layout

Preserve the existing BMS global navigation and company/FY selector.

Redesign only the report module's inner content.

Use this layout:

```text
--------------------------------------------------------------
| BMS GLOBAL NAVIGATION                                      |
--------------------------------------------------------------
| REPORT CONFIGURATION TITLE                       [Close]    |
--------------------------------------------------------------
| REPORT NAME PANEL | REPORT FILTER CONFIGURATION             |
|                   |                                         |
| 1. Bill No Wise   | Select Bill Date                        |
| 2. Date Wise      | From Bill: [Date]   To: [Date]           |
| 3. Party Wise     |                                         |
| 4. Group+Party    | 1. Sales/Purchase: [Dropdown]            |
| 5. Quality Wise   | 2. Company: [Dropdown]                   |
| 6. Party+Quality  | 3. Book: [Dropdown]                      |
| 7. Book Wise      | 4. Schedule: [Dropdown]                  |
| 8. City Wise      | 5. Party Group: [Dropdown]               |
| 9. Area Wise      | 6. Party: [Dropdown]                     |
| ...               | 7. Delivery Party: [Dropdown]             |
|                   | 8. Item: [Dropdown]                       |
|                   | 8.1 Item Group: [Dropdown]               |
|                   | 9. Broker: [Dropdown]                    |
|                   | 10. Detail/Summary: [Dropdown]            |
|                   | 11. Sales Person: [Dropdown]              |
|                   | 13. Print Item Details: [Checkbox]        |
|                   | 14. Rate Column: [Dropdown]               |
|                   | 14.1 Rate Filter: [From] [To]             |
|                   | 15. Wise Type: [Dropdown]                 |
|                   | Attrib 1 / 2 / 3                          |
|                   | 16. Quantity Columns: [Dropdown]          |
|                   | 17. Column Selection: [Dropdown]          |
|                   | 18. Transporter: [Dropdown]               |
|                   |                                         |
|                   | [Submit / Preview]                       |
--------------------------------------------------------------
```

## B. Left Report Panel

Width should be approximately 185–195 pixels on a desktop viewport.

Display:

- REPORT NAME heading.
- Report count: 20.
- All 20 report names.
- Vertical scrolling.
- Current selection highlight.
- READY/PARTIAL/N/A status labels only when accurate.

Use compact rows.

Each row should have:

- Reference number/letter.
- Report name.
- Status.

Keep the panel fixed or sticky within the report screen so users can switch report formats easily.

Do not let the report list consume excessive horizontal space.

## C. Right Filter Panel

The right area should use the compact Chandni-style field layout.

Important differences from the current UI:

- Do not stretch all controls across the complete page.
- Do not arrange every field in large full-width cards.
- Do not create three oversized columns.
- Do not give every filter a separate large card.
- Keep labels and controls compact.
- Keep the form concentrated in the upper-left portion of the available workspace.
- Allow enough blank workspace to the right, as seen in the reference.

Suggested desktop dimensions:

- Label width: approximately 125–140 pixels.
- Control width: approximately 170–190 pixels.
- Field row gap: compact and consistent.
- Main form max width: approximately 850 pixels.

Use aligned rows of:

`Field Number + Label + Colon + Dropdown/Input`

Arrange the right-side fields such as Print Item Details, Rate Column, Rate Filter and Wise Type alongside the main filter controls where practical.

## D. Date Selection

At the top of the form, display:

**Select Bill Date**

- From Bill.
- To.

Default date range must use the active financial year.

Validate both dates.

Do not hardcode the example 2025 or 2026 dates.

## E. Filter Sections

Provide all available controls:

1. Sales / Purchase.
2. Company Selection.
3. Book.
4. Schedule.
5. Party Group.
6. Party.
7. Delivery Party.
8. Item.
8.1 Item Group.
9. Broker.
10. Detail / Summary.
11. Sales Person.
13. Print Item Details.
14. Rate Column.
14.1 Rate Filter From / To.
15. Wise Type.
Attrib 1 / 2 / 3.
16. Quantity Columns.
17. Column Selection.
18. Transporter.

Controls must display actual backend values.

Do not create fake options to make the dropdown appear populated.

If the supporting model is missing, implement the required data structure and real master-management functionality as explained later in this prompt.

## F. Bottom Toolbar

Add a fixed or consistently accessible bottom toolbar:

- Preview (Page Down).
- Reset.
- Close.

Page Down should execute Preview safely.

Enter must not submit the report while the user is selecting filters.

Escape should close the report configuration screen or popup safely.

# 4. ALL 20 REPORT FORMATS MUST WORK

The reference report list contains 20 entries, counting both Salesman + Party Wise entries separately.

Implement every report format.

| Code | Report Name |
|---|---|
| 1 | Bill No Wise |
| 2 | Date Wise |
| 3 | Party Wise |
| 4 | Group + Party Wise |
| 5 | Quality Wise |
| 6 | Party + Quality Wise |
| 7 | Book Wise |
| 8 | City Wise |
| 9 | Area Wise |
| A | Broker + Party Wise |
| B | Transporter Wise |
| M | Month Wise |
| N | Month Wise All Report |
| O | Month + Quality Wise |
| P | Quality + Month Wise |
| Q | Salesman + Party Wise |
| R | Salesman + Party Wise |
| S | Expense Wise |
| T | Vehicle Wise |
| U | Purchase Serial Wise |

Do not remove duplicate-looking reference entries.

Preserve the original names until the business meaning of both entries is established.

## Status requirements

A report should be marked READY when:

- Its query works.
- Its grouping works.
- Its totals are correct.
- Its result grid works.
- Its print output works.
- Its export works.
- Its data dependencies are supported.

A report may return zero rows and still be READY if the implementation is genuinely supported.

An empty database is not a reason to mark a functional report N/A.

A report must not be marked READY if its underlying data is missing or its results are fabricated.

PARTIAL must explain exactly what is missing.

N/A must explain exactly why the feature is unsupported.

The goal is to eliminate unnecessary PARTIAL/N/A states by implementing genuine missing dependencies.

# 5. IMPLEMENT MISSING MASTER-DATA DEPENDENCIES

Phase 15.1 reported missing data fields for some report formats.

Inspect the actual Prisma schema before changing it.

Do not infer missing relationships using text matching.

Where required, introduce properly related, company-scoped master data.

Potential dependencies include:

## A. Party Group

Used by:

- Group + Party Wise.

Add or reuse:

- PartyGroup master.
- Company-scoped PartyGroup records.
- Party-to-PartyGroup relation.

Update Party Master so users can select a real Party Group.

Existing parties without a group must remain unassigned.

Do not automatically assign a fabricated group.

## B. Area

Used by:

- Area Wise.

Add or reuse an Area Master.

Add a real Party-to-Area relationship where appropriate.

Allow Area to be assigned/edited in Party Master.

Existing parties without an area should remain unassigned.

## C. Broker

Used by:

- Broker + Party Wise.

Inspect existing masters first.

If absent, introduce a company-scoped Broker Master.

Add actual Broker selection to the relevant transaction entry workflow.

## D. Transporter

Used by:

- Transporter Wise.

If absent, introduce a company-scoped Transporter Master.

Allow the user to associate the actual transporter with supported purchase/sales documents.

## E. Salesperson

Used by:

- Salesman + Party Wise.

If absent, introduce a company-scoped Salesperson Master.

Support salesperson assignment to the relevant transaction.

Preserve the two original report names.

Investigate whether they represent two distinct report modes or duplicated labels.

Do not invent their difference.

## F. Vehicle

Used by:

- Vehicle Wise.

Add a vehicle master or an appropriately validated transaction vehicle reference.

Allow vehicle assignment on relevant documents.

Store the actual vehicle number and related reference.

## G. Quality

Used by:

- Quality Wise.
- Party + Quality Wise.
- Month + Quality Wise.
- Quality + Month Wise.

Phase 15.1 reported that PurchaseBillItem has no Item Master foreign key.

Inspect the real source data.

Use existing YarnQuality/YarnGrade masters if they accurately represent the required dimension.

Add a proper optional foreign-key relation to the purchase bill item where necessary.

Provide a real quality selector in purchase entry.

Do not infer quality IDs automatically from item-description text.

For historical lines, allow an explicit mapping workflow if appropriate.

Unmapped historical lines should appear as Unassigned rather than fabricated quality values.

## H. Book

Used by:

- Book Wise.

Inspect whether Purchase Books exist.

If no appropriate Purchase Book Master exists, create one with:

- Prefix.
- Book Name.
- Company.
- Financial Year applicability.
- Active/inactive status.
- Relevant numbering configuration.

Connect purchase documents to the correct book.

Do not misuse Production Books or Bank Voucher sequences.

Historical bills without a book remain Unassigned.

## I. Item Group

Use actual Item Master relations.

Allow item filtering and grouping by actual Item Group.

Do not introduce duplicate item groups.

# 6. TRANSACTION ENTRY INTEGRATION

A report field is not fully functional if the corresponding data cannot be recorded anywhere.

Update existing data-entry forms where necessary.

Potentially affected forms:

- Purchase Bill Entry.
- Sales Invoice/Sales Bill Entry, if implemented.
- Debit Note Entry.
- Relevant return/credit-note entry screens, if implemented.

Add selectors only for the fields genuinely needed by each transaction.

Examples:

- Book.
- Broker.
- Transporter.
- Salesperson.
- Vehicle.
- Party Group/Area where applicable.
- Yarn Quality.

Use existing masters and transaction architecture.

Do not create duplicate transaction modules.

Do not break old records.

Existing transactions with missing values must remain valid.

New records should capture the relevant information.

Do not fabricate values for existing transactions.

# 7. TRANSACTION SOURCE SUPPORT

Inspect all real transaction sources.

Potential report types include:

- Sales.
- Purchase.
- General Purchase.
- Sales Return.
- Purchase Return.
- Sales Debit Note.
- Purchase Debit Note.
- Sales Credit Note.
- Purchase Credit Note.

Only expose source types backed by actual implemented database transactions.

Where a required source does not exist:

- Identify the missing module.
- Explain what model/workflow is required.
- Do not count Sales Orders or Purchase Orders as completed bills.
- Do not treat Debit Notes as normal Sales or Purchase invoices.
- Do not fabricate records.

If implementing a missing source module is necessary to meet a required report format, inspect the business requirements and existing accounting architecture first. Implement the smallest genuinely usable module with correct validation and accounting only when that dependency falls within this task's declared scope.

Do not create large unrelated modules or fake source adapters solely to change a status badge.

Report any remaining upstream dependency clearly.

# 8. REPORT FORMAT IMPLEMENTATION

Create one reusable report engine with format-specific configuration.

## Bill No Wise

- One row per bill.
- Expandable item details.

## Date Wise

- Group by bill date.
- Date-wise subtotal.

## Party Wise

- Group by party.
- Party-wise subtotal.

## Group + Party Wise

- Group by Party Group.
- Nested Party grouping.

## Quality Wise

- Group by actual Yarn Quality/Quality.
- Quality totals.

## Party + Quality Wise

- Party first.
- Quality second.

## Book Wise

- Group by transaction book.

## City Wise

- Group by Party city.

## Area Wise

- Group by actual Area Master.

## Broker + Party Wise

- Broker first.
- Party second.

## Transporter Wise

- Group by actual Transporter.

## Month Wise

- Calendar-month grouping within the selected date range.

## Month Wise All Report

- Monthly report covering all selected compatible source types.

## Month + Quality Wise

- Month first.
- Quality second.

## Quality + Month Wise

- Quality first.
- Month second.

## Salesman + Party Wise

- Salesperson first.
- Party second.

## Second Salesman + Party Wise entry

Preserve the second original entry and investigate its meaning.

Do not silently merge it into the first.

## Expense Wise

- Group using actual expense-head or expense-ledger data.
- Include supported General Purchase records if a real source exists.

## Vehicle Wise

- Group by actual vehicle.

## Purchase Serial Wise

- Group/sort by the actual purchase serial/document sequence.

Each format requires:

- Correct filtering.
- Correct grouping.
- Correct subtotals.
- Correct grand totals.
- Expandable detail where appropriate.
- Correct pagination.
- Correct print output.
- Correct XLSX export.

Do not implement one generic grouping for every report type.

# 9. COLUMN SELECTION

Preserve the existing database-backed custom column layout system.

Support:

- Standard.
- Selected.
- New.
- Edit.

The layout selector must provide:

- Available columns.
- Selected columns.
- Add.
- Remove.
- Remove all.
- Move up.
- Move down.
- Search.
- Live preview.
- Save.
- Rename.
- Delete.
- Set Default.

Support actual bill fields such as:

- Sr No.
- Bill Date.
- Bill No.
- Due Days.
- Party Name.
- GST No.
- Item Description.
- Item Group.
- Quality.
- Grade.
- Lot.
- HSN.
- Quantity.
- Unit.
- Basic Rate.
- Average Rate.
- Net Rate.
- Basic Amount.
- Discount.
- Freight.
- Taxable Amount.
- SGST.
- CGST.
- IGST.
- Bill Amount.
- Book.
- Broker.
- Transporter.
- Salesperson.
- Vehicle.

Only display a column if the selected source actually supports it or the field has been properly implemented.

Preserve custom layouts in PostgreSQL.

# 10. FILTER FUNCTIONALITY

All displayed controls must actually function.

Implement:

- Date From/To.
- Sales/Purchase.
- Company.
- Book.
- Schedule.
- Party Group.
- Party.
- Delivery Party.
- Item.
- Item Group.
- Broker.
- Detail/Summary.
- Salesperson.
- Rate Column.
- Rate From/To.
- Wise Type.
- Attributes.
- Quantity Columns.
- Transporter.

Requirements:

- Searchable dropdowns.
- Real backend options.
- Correct dependent filtering.
- Clear filters.
- Validation.
- Empty states.
- Active filter summary.

Changing Party must refresh relevant bill data.

Changing Sales/Purchase source must refresh compatible Party, Book and other options.

Changing report format should preserve compatible filters and reset incompatible filters safely.

Dataset-wide filtering must occur before grouping, totals and pagination.

Do not filter only the currently visible page.

# 11. DATA AND ACCOUNTING ACCURACY

Preserve existing report-engine rules.

- Company isolation.
- Financial-year isolation.
- Exclude cancelled documents by default.
- Optional Include Cancelled.
- Correct accounting signs for returns and credit/debit notes.
- Correct Decimal precision.
- No double-counting expanded item lines.
- Complete-dataset group and grand totals.
- No duplicate bill rows.

All report operations must remain read-only.

They must not create:

- JournalLine records.
- BankVoucher records.
- Invoice records.
- Stock movements.
- Voucher sequence increments.

# 12. PRINT PREVIEW REDESIGN — MATCH THE REFERENCE

The current print preview is a modern web document page.

Redesign it to resemble the classic Chandni-style desktop print-preview workspace.

## A. Workspace Layout

Create:

- Neutral grey preview background.
- Centered white A4 sheet.
- Thin paper border/shadow.
- Top toolbar.
- Narrow left-side vertical export toolbar if practical.
- Zoom or fit-to-page controls.
- Page X of Y.
- Close action.

The paper itself must remain a real HTML/CSS print layout or genuine PDF output, not a screenshot.

## B. Vertical Toolbar

Provide working actions for:

- WhatsApp/share, only when a real workflow is supported.
- PDF.
- Excel.

Do not show nonfunctional icons.

## C. Main Preview Toolbar

Provide:

- Print.
- Save, only if it performs a real supported action.
- Previous page.
- Next page.
- Page number / total pages.
- Portrait.
- Landscape.
- Close.

Preserve the existing genuine PDF and XLSX export.

## D. Printed A4 Document

Create a compact traditional ERP report.

At the top:

**Left:**
- Company name.
- Company address.
- Phone.
- GSTIN.

**Right:**
- Financial Year.
- Page X of Y.
- From date.
- To date.

Centered under the header:

- Report title.
- Report format.
- Transaction type.

Below:

- Column headings.
- Actual report rows.
- Optional item detail subrows.
- Group labels.
- Subtotals.
- Grand total.

Use compact text and spacing similar to a printed accounting report.

Do not make the table oversized or stretch content to fill the entire page.

Use appropriate font sizes for A4 printing.

## E. Pagination

Support:

- A4 portrait.
- A4 landscape.
- Repeated table header.
- Repeated report/company header where appropriate.
- Correct page number.
- Proper page breaks.
- No missing rows.
- No duplicate rows.
- No clipped columns.
- No clipped total.
- No unexpected blank pages.

Print preview, downloaded PDF and browser Save as PDF must show the same data.

## F. PDF Text Support

The existing custom PDF writer reportedly uses base-14 Courier and replaces non-ASCII characters with `?`.

Improve this if practical.

Support Indian company names and addresses, Gujarati/Unicode names where available, and the ₹ currency symbol using a suitable embedded Unicode font or an established existing PDF library.

Do not share or expose licensed font files improperly.

If full Unicode embedding is not feasible, document the limitation clearly rather than corrupting text silently.

# 13. RESULTS SCREEN DESIGN

Keep the existing interactive results functionality but make the appearance consistent with the new configuration and print-preview style.

Include:

- Compact title bar.
- Report name.
- Date range.
- Transaction source.
- Group By drop zone.
- Grouping controls.
- Expand/collapse.
- Column filters.
- Sorting.
- Pagination.
- Dataset-wide totals.
- Export Excel.
- Print / PDF.

Column filters must work against the complete filtered dataset.

Grouping must operate across all matching records.

Do not calculate totals only from the current page.

# 14. MOBILE AND RESPONSIVE DESIGN

The desktop layout is the priority, but the interface must remain usable on mobile.

At 390px width:

- Collapse the report-name panel into a drawer or report selector.
- Use a single-column filter layout.
- Avoid tiny controls.
- Keep bottom actions accessible.
- Allow report grids to scroll horizontally inside their own container.
- Never allow whole-page horizontal overflow.
- Let the print preview scroll vertically around the A4 sheet.

Do not shrink all desktop fields into unreadable narrow columns.

# 15. DATABASE MIGRATIONS

If new masters or transaction fields are required:

- Add new Prisma models or relations.
- Use an additive migration.
- Add appropriate company-scoped uniqueness.
- Add indexes.
- Add safe foreign keys.
- Preserve old records.
- Keep historical migration files unchanged.

Never reset PostgreSQL.

Historical records with missing values must remain unassigned.

Provide a proper manual mapping/edit workflow where necessary.

Do not automatically infer historical relationships.

# 16. AUTOMATED TESTING

Create or extend the Phase 15.2 suite.

## Configuration UI

- All 20 report names appear.
- Selecting each report loads its correct configuration.
- Filter controls work.
- Dependent dropdowns refresh.
- Column selector works.
- Saved layouts work.
- Reset works.
- Preview works.

## Report format testing

Test all 20 report formats against actual test database records.

For each report:

- Correct grouping.
- Correct row count.
- Correct subtotal.
- Correct grand total.
- Correct date range.
- Correct party/source filtering.
- Correct empty state.
- Correct item details.

## Master-data tests

- Party Groups.
- Areas.
- Brokers.
- Transporters.
- Salespersons.
- Vehicles.
- Quality relations.
- Books.

Verify company isolation and correct relations.

## Print tests

- A4 portrait.
- A4 landscape.
- Multi-page.
- Repeated header.
- Page numbers.
- Group subtotals.
- Item details.
- Unicode support.
- PDF file validity.
- XLSX validity.
- Preview/output consistency.

## Regression tests

Re-run Phase 12, 13, 14, 15 and 15.1 test suites.

Do not weaken old assertions to obtain passing results.

# 17. FINAL ACCEPTANCE CRITERIA

The task is complete only when:

1. The configuration screen visually follows the compact Chandni reference.
2. The report list is usable and vertically scrollable.
3. Filters are aligned and compact.
4. All implemented filters work against real database data.
5. All 20 report formats are fully implemented and tested wherever their source data is available.
6. Unavailable dependencies are resolved where they fall within the task scope.
7. No status is changed to READY without actual working functionality.
8. Column layouts continue to persist in PostgreSQL.
9. Grouping and filtering work over the full dataset.
10. Results grid is reliable.
11. Print preview follows the classic A4 report layout.
12. PDF and Excel exports are genuine files.
13. Mobile layout is usable.
14. No accounting or stock side effects occur while generating reports.
15. All previous regression tests remain passing.

If a format genuinely requires a transaction module outside the report scope, identify that dependency explicitly and explain what must be built. Do not fake it.

# 18. FINAL REPORT

After implementation, provide:

1. Configuration UI changes.
2. Results screen changes.
3. Print preview changes.
4. Report formats completed.
5. Filters made functional.
6. Masters added or reused.
7. Database migration names.
8. API changes.
9. Files created.
10. Files modified.
11. PDF/Excel test results.
12. Browser verification results.
13. Desktop/mobile results.
14. Phase 12–15.2 regression results.
15. Any remaining dependencies.

Use real test counts and actual command output.

Do not claim full completion if anything remains unsupported.

Do not commit or push.

Stop after presenting the final report for manual review.

---

# FINAL INSTRUCTION TO OPENCODE

The objective is to make this existing BMS report module behave and look like a professional Chandni-inspired ERP report system.

Prioritise:

1. Correct configuration layout.
2. Fully functional report list.
3. Real filter and master-data integration.
4. Correct report calculations.
5. Interactive results.
6. Professional A4 print preview.
7. Genuine PDF and Excel.
8. Full regression safety.

Do not merely modify labels, status badges or colours.

Implement the underlying functionality so every feature that is marked READY genuinely works.