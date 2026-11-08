# SALES & PURCHASE REPORT — BILL BASE
## OpenCode Full-Stack Implementation Prompt
### SHIVAM ENTERPRISE BMS | Chandni Software-Inspired Reporting

**Project:** Business Management System  
**Feature:** Sales & Purchase Report — Bill Base  
**Reference:** Chandni Weaving Software  
**Frontend:** React + TypeScript + Vite  
**Backend:** Express + TypeScript  
**Database:** PostgreSQL 18  
**ORM:** Prisma

## 1. OBJECTIVE

Implement a fully working Sales & Purchase Report module using the 11 supplied Chandni Software screenshots as the primary UI and workflow reference.

The required navigation is:

`Report → Final Reports → Sale/Pur Details → Sale/Pur Bill Base`

This feature must allow users to:

1. Select a report format.
2. Choose date and transaction filters.
3. Select Sales, Purchase or specific document types.
4. Configure report columns.
5. Generate a report using actual database transactions.
6. View interactive report results.
7. Group, filter, sort and expand report rows.
8. View calculated totals.
9. Open a separate print preview.
10. Print and export PDF/Excel.

This is a READ-ONLY reporting module.

Do not create, edit or delete any Sales, Purchase, Debit Note, Credit Note or other transaction records while generating reports.

Do not use mock data, sample invoices, fake totals or hardcoded report rows.

**Performance priority:** Implement this efficiently by reusing the current BMS transaction services, report components, tables and export utilities. Avoid unnecessary refactoring and unnecessary dependencies.

---

# 2. FIRST INSPECT THE EXISTING PROJECT

Before implementation, inspect the latest repository state.

Check:

### Frontend

- `frontend/src/App.tsx`
- `frontend/src/config/navigation.ts`
- `frontend/src/layouts/RootLayout.tsx`
- `frontend/src/components/TopNavigationBar.tsx`
- Existing Report pages.
- Existing registers and grids.
- Existing filters and dropdown components.
- Existing table/grid library.
- Existing PDF and Excel export utilities.
- Company/FY context.

### Backend

- Prisma schema.
- Sales transaction models, if available.
- Purchase Bill models.
- General Purchase model, if available.
- Sales Return and Purchase Return models, if available.
- Debit Note and Credit Note models, if available.
- LedgerAccount and JournalLine.
- VoucherSequence.
- Party Master.
- Item Master.
- Item Group, Yarn Quality and Yarn Grade.
- Book, Broker, Transporter and Salesperson masters, if available.
- Existing report APIs and query services.

### Critical source inspection

Create a source registry for the transaction types that genuinely exist.

Potential sources shown in Chandni's selection popup:

1. Sales
2. Purchase
3. General Purchase
4. Sales Return
5. Purchase Return
6. Sales Debit Note
7. Purchase Debit Note
8. Sales Credit Note
9. Purchase Credit Note

Do not assume all nine already exist in BMS.

For every source, identify:

- Actual Prisma model.
- Actual bill/document header.
- Actual document lines.
- Party relation.
- Item relation.
- Bill date.
- Book reference.
- Quantity.
- Rate.
- Taxable amount.
- GST amount.
- Total bill amount.
- Document status.
- Cancellation/reversal behaviour.

Build a report source adapter only for a real implemented source.

If a source transaction does not exist, do not create a fake report adapter. Hide or clearly mark it unavailable and document it.

**Important:** Sales Orders and Purchase Orders are not Sales/Purchase Bills. Do not include orders as completed bill transactions in this report.

## Git protection

- Inspect `git status`.
- Preserve all uncommitted Phase 12, Phase 13 and other user changes.
- Do not run `git reset`, `git clean` or destructive checkout commands.
- Do not modify historical migrations.
- Do not reset PostgreSQL.
- Do not commit or push.

After targeted inspection, implement the feature. Do not stop after providing an implementation plan.

---

# 3. MENU AND NAVIGATION

Create or activate this navigation hierarchy:

- Report
  - Final Reports
    - Sale/Pur Details
      - Sale/Pur Bill Base

The Sale/Pur Bill Base entry must open the new report configuration page.

Do not activate unrelated report options just because they appear in the reference menu.

Other Chandni options, such as:

- Credit / Debit Note Report.
- Purchase V/S Sale Bill.
- Sale Vs Purchase.

must remain separate future report features.

Use a clear BMS route, for example:

`/reports/sales-purchase/bill-base`

Preserve existing dashboard and top navigation behaviour.

---

# 4. REPORT CONFIGURATION SCREEN

Recreate the report configuration structure from the screenshots.

Use a desktop-first ERP layout.

### Layout

**Left side:** Report Name selection panel.

**Right side:** Report filters and configuration.

**Bottom:** Preview (Page Down Key) and any genuinely supported share/export action.

Use compact field labels and dropdowns.

Keep the screen easy to operate using a keyboard.

## A. REPORT NAME LIST

The screenshot displays these report formats:

1. Bill No Wise
2. Date Wise
3. Party Wise
4. Group + Party Wise
5. Quality Wise
6. Party + Quality Wise
7. Book Wise
8. City Wise
9. Area Wise
A. Broker + Party Wise
B. Transporter Wise
M. Month Wise
N. Month Wise All Report
O. Month + Quality Wise
P. Quality + Month Wise
Q. Salesman + Party Wise
R. Salesman + Party Wise
S. Expense Wise
T. Vehicle Wise
U. Purchase Serial Wise

Preserve the visible labels.

The supplied screenshot appears to show Q and R with the same Salesman + Party Wise label. Do not invent an alternative name or pretend the two are different. Inspect the reference/code if possible; otherwise preserve the visible names and document the ambiguity.

Implement the report formats using reusable grouping and aggregation logic.

Do not build each report as an unrelated hardcoded page.

### Report behaviour

**Bill No Wise**
- One parent row per actual bill.
- Expandable item details.
- Original invoice data.

**Date Wise**
- Group or sort by bill date.

**Party Wise**
- Group by customer/supplier.

**Group + Party Wise**
- Group by Party Group, then Party.

**Quality Wise**
- Group using actual Yarn Quality or configured product quality.

**Party + Quality Wise**
- Group by Party, then Quality.

**Book Wise**
- Group by actual transaction book.

**City Wise**
- Group by Party City.

**Area Wise**
- Group by Party Area.

**Broker + Party Wise**
- Group by Broker, then Party, where actual source data exists.

**Transporter Wise**
- Group by Transporter.

**Month Wise**
- Group by transaction month.

**Month Wise All Report**
- Provide the supported monthly report view across the selected document sources.

**Month + Quality Wise**
- Group by Month, then Quality.

**Quality + Month Wise**
- Group by Quality, then Month.

**Salesman + Party Wise**
- Group by Salesperson, then Party.

**Expense Wise**
- Group by real expense head/category for supported expense transactions.

**Vehicle Wise**
- Group by actual vehicle reference.

**Purchase Serial Wise**
- Use the actual source purchase serial/document sequence if it exists.

If a report format depends on a missing master or transaction field, do not manufacture values. Show the format only when supported or disable it with a clear explanation.

---

# 5. DATE RANGE FILTER

At the top of the configuration screen, add:

**Select Bill Date**

- From Bill.
- To.

Use real date-picker controls.

Default values:

- From = active financial-year start date.
- To = current date, capped at the active financial-year end date.

The user must be able to change both dates.

Backend must validate:

- From date is not later than To date.
- Selected dates are valid.
- Report date scope is consistent with active company/FY context.

Do not hardcode the example dates in the screenshots.

---

# 6. MAIN FILTER CONFIGURATION

Reproduce the visible filter fields and order from the screenshot.

| No. | Filter | Expected behaviour |
|---|---|---|
| 1 | Sales / Purchase | Sales, Purchase, Expense, Selected |
| 2 | Company Selection | Default Current |
| 3 | Book | All or actual available books |
| 4 | Schedule | All or actual configured schedules |
| 5 | Party Group | All or actual Party Groups |
| 6 | Party | All or selected Party |
| 7 | Delivery Party | All or actual delivery parties |
| 8 | Item | All or selected item |
| 8.1 | Item Group | All or actual Item Groups |
| 9 | Broker | All or configured brokers |
| 10 | Detail / Summary | Detail or Summary |
| 11 | Sales Person | All or selected salesperson |
| 13 | Print Item Details? | Checkbox |
| 14 | Rate Column | Basic Rate, Avg Rate, Net Rate, All |
| 14.1 | Rate Filter | From/To range |
| 15 | Wise Type | Actual configured choices only |
| 16 | Quantity Columns | Actual supported quantity option |
| 17 | Column Selection | Standard, Selected, New, Edit |
| 18 | Transporter | All or actual transporter |

Preserve the visible field labels as closely as practical.

Do not fill missing filter choices with fake master data.

## Company Selection

Default:

`1. Current`

Use the currently validated company context.

If the application supports authorised multi-company reporting, allow only companies the authenticated user is permitted to access.

Never use a frontend-supplied arbitrary company ID to bypass tenant isolation.

## Book

Load actual relevant books from existing book masters or transaction source records.

Do not reuse Production Books as Sales/Purchase Books unless the source implementation genuinely relates them.

## Party Group / Party

Use the actual Party Master.

Support searchable selection.

Party results must be scoped to the active company.

## Delivery Party

Use an existing delivery-party relation or valid Party Master relation if available.

If unsupported by a source, omit the filter for that source rather than showing fake options.

## Item / Item Group

Use Phase 13 Item Master and existing grouping fields.

Support searching by:

- Item Code.
- Item Name.
- Yarn Quality.
- Item Group.

Use actual item records only.

## Broker / Transporter / Salesperson

Inspect whether these fields and masters exist.

Expose them only where real data is supported.

Do not invent brokers, transporters or salespeople.

## Detail / Summary

**Detail:**
- Show each bill/document.
- Allow expansion to actual item lines.
- Display the selected columns.

**Summary:**
- Aggregate using the selected report format.
- Display grouped totals and counts.
- Never duplicate line totals when grouping.

---

# 7. SALES / PURCHASE SOURCE SELECTION

The screenshot shows these options in the Sales/Purchase dropdown:

1. Sales
2. Purchase
3. Expense
4. Selected

Implement the same behaviour.

### Sales

Load genuine sales bills if the Sales Invoice/Sales Bill module exists.

### Purchase

Load genuine Purchase Bills.

### Expense

Load supported General Purchase transactions if the module exists.

### Selected

Opening this option must open a selection popup with checkboxes.

The popup should show these visible source labels:

- Sales
- Purchase
- General Purchase
- Sales Return
- Purchase Return
- Sales Debit Note
- Purchase Debit Note
- Sales Credit Note
- Purchase Credit Note

The popup must:

- Display only actual implemented source types.
- Clearly show unavailable types only if there is an explanatory disabled state.
- Allow multiple selections.
- Display Total Selected.
- Save the selection for the current report run.
- Support Select All / Clear All where appropriate.

The initial selection must not silently select all transaction types.

Use the screenshot's behaviour: Sales and Purchase are initially checked in its example; other listed types are unchecked.

### Financial signs

Do not add all amounts together blindly.

Returns, credit notes and debit notes may have different accounting effects.

Use the actual source transaction and accounting mappings to determine the reporting sign.

Display gross document amounts separately where needed.

If a transaction type's financial sign cannot be verified, report it in its own document-type subtotal and do not include it in a misleading net total.

Cancelled documents and reversed postings must be treated according to the existing source status and journal logic.

---

# 8. RATE COLUMN AND RATE FILTER

The screenshot explicitly displays:

**14. Rate Column**

Options:

1. Basic Rate
2. Avg Rate
3. Net Rate
4. All

Implement those four labels.

Use the source bill/item data to determine which rates are available.

Do not invent Avg Rate or Net Rate when those values cannot be calculated or do not exist in source data.

**Rate Filter**

Provide:

- From Rate.
- To Rate.

Apply a numeric inclusive filter to the selected rate definition.

When Rate Column = All, allow the appropriate rate information to be displayed without applying an ambiguous filter.

Validate numeric inputs.

Do not silently convert invalid text into zero.

---

# 9. WISE TYPE AND ATTRIBUTE FILTERS

The screenshot shows:

- 15. Wise Type dropdown.
- Attrib 1 checkbox.
- Attrib 2 checkbox.
- Attrib 3 checkbox.

The available Wise Type values are not legible in the screenshots.

Therefore:

- Inspect existing application configuration and source data.
- Load actual supported choices.
- Do not invent values.
- If no real configuration exists, show a safe empty/unconfigured state or omit the control.

For Attrib 1/2/3:

- Use existing Item Master custom attributes if present.
- Display actual configured attribute names.
- Allow the report to group/filter by selected attributes.
- Do not invent textile attributes or data values.

Textile-related attributes may include Quality, Count, Denier, Grade, Lot or similar fields only if they exist in the actual schema.

---

# 10. QUANTITY COLUMNS

The screenshot shows:

`16. Quantity Columns: 1. Quantity`

Use the project's real quantity and unit data.

Support the existing quantity conventions.

For textile/yarn reports, display relevant quantities and their UOM correctly.

Do not add metres, kilograms, cartons or pieces together into one meaningless grand quantity.

Group quantities by compatible unit.

Where reports contain multiple UOMs:

- Show separate unit totals.
- Do not sum incompatible units.
- Label the unit beside each quantity.

Use Decimal-safe calculations.

---

# 11. COLUMN SELECTION SYSTEM

This is a major feature visible in screenshots 5, 6 and 7.

The screenshot shows:

`17. Column Selection`

Options:

1. Standard
2. Selected
3. New
4. Edit

Implement the dropdown and working column-selection dialog.

## A. Standard

Load the system's default column layout.

## B. Selected

Open the user's selected/custom column layout where configured.

## C. New

Allow the user to create a new custom report-column layout.

## D. Edit

Allow the user to modify an existing custom layout.

## E. Column Selection Dialog

Reproduce the two-panel dialog.

Left panel:

**All Columns**

Right panel:

**Selected Columns**

Controls:

- Search.
- Add.
- Remove.
- Remove All.
- Move Up.
- Move Down.

Support checkbox selection.

Allow multiple fields to be added at once.

Allow moving selected fields up/down to control column order.

Allow a selected layout to be saved and reused.

Prefer existing user-preference infrastructure.

If none exists, use a company-scoped saved preference mechanism. Avoid creating a large new settings subsystem solely for this feature.

## F. Available Column Fields

The screenshot visibly contains fields resembling:

- Sr No
- Bill Date
- Bill No
- Due Days
- HSN/SAC Code
- Quality Name
- Item Group
- Item Description
- Fld1
- Fld2
- Fld3
- Fld4
- Tax Rate
- Basic Rate
- Average Rate
- Net Rate
- Basic Amount
- Discount Percent
- Discount Amount
- Freight Amount
- Taxable Amount
- SGST Amount
- CGST Amount

Additional tax fields such as IGST and other configured charges should be available where the real source model supports them.

Important:

- Do not show fields that do not exist for the selected source.
- Do not create fake Fld1-Fld4 values.
- Label custom fields using actual Item/transaction configuration where available.
- Use the exact source values.
- Store column order and visibility.

The Standard layout should be populated with a useful set of bill-level fields.

---

# 12. PRINT ITEM DETAILS OPTION

Implement the checkbox:

`13. Print Item details?`

Behaviour:

Unchecked:
- Print bill-level summary rows only.

Checked:
- Include actual item-line information beneath each bill.
- Include item description, quantity, rate, quality and other selected fields where available.

This setting should affect the final print/preview and appropriate exports.

Do not create placeholder item details.

---

# 13. REPORT GENERATION BUTTON

At the bottom of the filter configuration screen, implement:

**Preview (Page Down Key)**

The button must:

1. Validate filters.
2. Submit the report query to the backend.
3. Load actual matching records.
4. Open the interactive report result screen.
5. Preserve the filter settings.
6. Display a useful loading state.
7. Show a clear empty state when there are no results.

Implement Page Down as the same action where safe and compatible with existing keyboard handling.

Do not confuse this action with the later Print Preview button.

There are two separate stages:

- Filter screen → Preview (Page Down) → Interactive Results Grid.
- Results Grid → Preview → Final Print Preview.

The screenshot demonstrates these as separate screens.

---

# 14. INTERACTIVE REPORT RESULT GRID

Create a dedicated result page or full-width report view.

Suggested route:

`/reports/sales-purchase/bill-base/results`

The screenshot shows:

- Report title.
- Selected report type.
- Sales/Purchase type.
- Date range.
- Print Landscape checkbox.
- Drag a column to group.
- Interactive data grid.
- Column filters.
- Sorting.
- Expandable bill rows.
- Totals row.

Recreate these behaviours.

## A. Header

Display:

- Report Title.
- Report Name.
- Sales/Purchase selection.
- Company.
- Date range.
- Detail/Summary mode.

Example structure:

`Report Title: BillNo Wise 1. Sales Detail`

Do not hardcode Chandni's demo company name or data.

## B. Grouping Area

Show:

`Drag a column to group`

Support:

- Drag any eligible column into grouping area.
- Group by Party Name.
- Group by Date.
- Group by Item Group.
- Group by Quality.
- Group by Book.
- Group by other displayed fields.
- Remove a grouping field.
- Support nested grouping where practical.
- Expand/collapse groups.
- Display group item count.
- Display group subtotal.

The screenshot demonstrates grouping by Party Name and displaying:

`Party Name: [Actual Party] - [Item Count]`

Follow it with a subtotal row.

Do not calculate totals based only on the current visible page.

Grouped totals must represent the complete filtered dataset.

## C. Grid Columns

The screenshot's example displays columns:

- Sr No.
- Bill Date.
- Bill No.
- Party Name.
- GST No.
- Meter.
- Basic Rate.
- Taxable Amount.
- SGST Amount.
- CGST Amount.
- IGST Amount.
- Bill Amount.

Support the user-selected column layout.

The actual visible columns must follow the saved configuration.

## D. Expandable Rows

The screenshot shows a plus icon beside a bill row.

Clicking it should show the actual associated item details.

Examples of item fields:

- Item Name.
- Quality.
- Quantity.
- Unit.
- Rate.
- Taxable value.

Load real item lines using the source transaction.

Do not duplicate bill totals when expanding line details.

## E. Table Functionality

Support:

- Sorting.
- Column filtering.
- Grouping.
- Expand/collapse.
- Scroll.
- Column visibility.
- Correct numeric alignment.
- Sticky or clearly visible headers.
- Subtotals.
- Grand total.
- Row count.
- Loading/error/empty states.

Use an existing table/grid library if already installed.

Do not introduce a large dependency unnecessarily.

If no suitable library exists, implement the required functionality with the smallest maintainable solution.

## F. Example Report Calculations

The screenshot's example shows:

- Total Meter: 4,950.
- Taxable Amount: ₹77,625.
- SGST: ₹1,940.63.
- CGST: ₹1,940.63.
- IGST: ₹0.
- Bill Amount: ₹81,507.

These are demonstration values only.

Never hardcode them.

All report rows and totals must come from real database records.

---

# 15. FINAL PRINT PREVIEW

When the user clicks **Preview** in the results grid, open a separate print preview screen.

Suggested route:

`/reports/sales-purchase/bill-base/print`

The print preview must display the same report and filters as the interactive grid.

## A. Print Header

Include:

- Company Name.
- Company Address.
- Phone.
- GSTIN.
- Financial Year.
- Report Title.
- From Date.
- To Date.
- Page Number.

Use active Company Master data.

Do not hardcode Chandni's company information.

## B. Report Table

Print:

- Selected report columns.
- Actual transaction rows.
- Optional expanded item details.
- Group headings.
- Group subtotals.
- Grand totals.

## C. Page Layout

- A4 paper.
- Portrait by default.
- Landscape checkbox.
- Proper margins.
- Repeated table headers on multiple pages.
- Page-break control.
- No clipped columns.
- Readable text.
- Proper currency alignment.
- Correct Indian number formatting.

The screenshot's preview shows a compact table near the top of the A4 page. Preserve the professional, compact report appearance rather than printing a large dashboard layout.

## D. Print Preview Actions

Support:

- Print.
- PDF.
- Excel.
- Save, where supported.
- Close.

Use the existing BMS printing/export infrastructure if it is working.

PDF and Excel must contain the same filtered data as the result grid.

---

# 16. EXPORT AND SHARING

The reference screenshots show:

- Print.
- Preview.
- Email.
- Export.
- WhatsApp.
- PDF.
- Excel.

Implement:

### Print

Use the report print stylesheet and current report data.

### PDF

Generate a genuine PDF or provide a print-ready view compatible with Save as PDF.

Do not label an HTML page as a generated PDF.

### Excel

Generate a valid `.xlsx` file using an existing installed library or a suitable minimal dependency.

Preserve:

- Column names.
- Data types.
- Numeric values.
- Dates.
- Group totals.
- Grand totals.
- Selected columns.

Do not export JSON or CSV and label it Excel.

### Email

Enable only if an actual email-sharing workflow exists.

A simple `mailto:` draft may be offered, but disclose clearly that it does not attach an exported file automatically.

### WhatsApp

If implementing the WhatsApp action, make it genuinely functional.

It may open a WhatsApp share draft containing the report title, period and accurate report summary, subject to the existing share capabilities.

Do not claim to attach a PDF if it is not attached.

Do not display nonfunctional decorative buttons.

---

# 17. BACKEND REPORT API

Build a reusable reporting service.

Suggested endpoints:

### Filter options

`GET /api/reports/sales-purchase/bill-base/options`

Return real values for:

- Books.
- Party Groups.
- Parties.
- Delivery Parties.
- Items.
- Item Groups.
- Brokers.
- Salespersons.
- Transporters.
- Supported transaction types.
- Custom attribute options.
- Wise Type options, if configured.
- Company selection options permitted for this user.

### Run report

`POST /api/reports/sales-purchase/bill-base/run`

Request should contain:

- Date From.
- Date To.
- Sales/Purchase mode.
- Selected transaction types.
- Company selection.
- Book.
- Schedule.
- Party Group.
- Party.
- Delivery Party.
- Item.
- Item Group.
- Broker.
- Detail/Summary mode.
- Salesperson.
- Print Item Details.
- Rate Column.
- Rate Filter.
- Wise Type.
- Attribute filters.
- Quantity Columns.
- Column layout.
- Transporter.
- Report Name.
- Page and sort options.

Return:

- Report metadata.
- Actual rows.
- Column definitions.
- Source type.
- Row count.
- Grand totals.
- Group totals if applicable.
- Pagination information.

### Item details

Provide a drill-down endpoint for a real source bill's item rows if they are not returned with the parent result.

### Export

Provide a backend export endpoint or reuse the existing export pipeline.

The export must reuse the same validated report query, not a separate inconsistent calculation.

Use:

Routes → Controllers → Services → Repositories → Prisma.

Keep reporting queries in a dedicated service.

---

# 18. QUERY PERFORMANCE AND DATA INTEGRITY

The report may contain many transactions.

Requirements:

1. Filter in PostgreSQL, not by downloading every company's data.
2. Use indexed filter fields.
3. Avoid N+1 queries.
4. Use Prisma `select` for only required fields.
5. Apply server-side pagination for large results.
6. Compute filtered grand totals across the entire matching dataset.
7. Keep calculations in Decimal-safe arithmetic or exact database numeric aggregation.
8. Do not calculate totals only from the current visible page.
9. Reuse existing date and currency formatting utilities.
10. Prevent cross-company access.
11. Prevent cross-FY access unless a validated permitted report scope exists.
12. Exclude cancelled transactions by default, with a deliberate status filter if appropriate.
13. Ensure reversed/cancelled transactions are not double-counted.
14. Do not count bank payments as purchase invoices.
15. Do not count Sales Orders or Purchase Orders as completed bills.

### Transaction signs

Returns and debit/credit notes may have different accounting directions.

Use existing accounting source mappings.

Keep original document amounts available.

Use separate transaction-type subtotals when the financial effect cannot safely be normalised.

Never calculate misleading net sales or net purchases.

---

# 19. COMPANY AND FINANCIAL YEAR SAFETY

Use existing validated company and FY middleware.

Never trust companyId from the report request body.

Default to the currently active company.

If multi-company reporting is supported, use only explicitly authorised company IDs and existing access rules.

Use the active financial year as the default scope.

Do not expose records belonging to another company.

Do not bypass the existing tenant-isolation system.

---

# 20. UI AND KEYBOARD BEHAVIOUR

Follow the existing BMS design system.

Use a compact desktop ERP layout inspired by the screenshots:

- Left report selector panel.
- Right filter configuration.
- Dense but readable field layout.
- Dropdown selectors.
- A clear preview action.
- Full-width interactive report grid.
- Separate print preview.

Make the UI responsive.

Do not redesign the entire Reports menu.

Keyboard support:

- Page Down: Preview report configuration.
- Escape: Close popup or return.
- Enter: Select focused report/filter value where appropriate.

Avoid conflicts with existing keyboard shortcuts.

Do not let Enter accidentally submit a report while selecting values.

Preserve the report filters when navigating back from results.

---

# 21. TESTING REQUIREMENTS

Create a dedicated Sales/Purchase Bill Base report test suite.

### Filter tests

- Default date range.
- Custom date range.
- Invalid date ranges.
- Sales selection.
- Purchase selection.
- Expense selection.
- Selected transaction-type selection.
- Party filter.
- Party Group filter.
- Book filter.
- Item filter.
- Item Group filter.
- Detail/Summary.
- Rate Column options.
- Rate From/To filter.
- Column Selection Standard.
- Column Selection Selected.
- Custom layout New.
- Custom layout Edit.
- Attribute filters.

### Report tests

- BillNo Wise.
- Date Wise.
- Party Wise.
- Group + Party Wise.
- Quality Wise where supported.
- Party + Quality Wise where supported.
- Book Wise where supported.
- City Wise where supported.
- Area Wise where supported.
- Broker + Party Wise where supported.
- Transporter Wise where supported.
- Month Wise.
- Month Wise All Report where supported.
- Month + Quality Wise where supported.
- Quality + Month Wise where supported.
- Salesman + Party Wise where supported.
- Expense Wise where supported.
- Vehicle Wise where supported.
- Purchase Serial Wise where supported.

Unsupported report configurations must return a clear error or unavailable state, not dummy data.

### Grid tests

- Correct report title.
- Correct source rows.
- Correct column values.
- Correct row count.
- Correct totals.
- Correct grouping.
- Correct group subtotals.
- Correct expansion into item details.
- Correct sorting and filters.
- Correct pagination.
- No duplicate totals.

### Print/export tests

- Correct company header.
- Correct date period.
- Correct title.
- Correct columns.
- Correct detail rows.
- Correct subtotals.
- Correct grand total.
- Portrait and landscape.
- PDF output.
- Valid XLSX output.
- Export follows the same filters as the grid.

### Security tests

- Cross-company report blocked.
- Cross-FY access follows the active context rules.
- Unsupported transaction type rejected.
- Invalid filter values rejected.
- No unauthorised party or source bill exposed.

### Regression tests

Ensure the following are untouched and continue working:

- Bank Receipt.
- Bank Payment.
- Ledger Account Master.
- Item Master.
- Sales Order.
- Purchase Order.
- Purchase Bill.
- Debit Note, if currently implemented.
- GSTINAPI integration.
- Production Receive.
- Production Challan.
- Packing Slip printing.
- Existing navigation and reports.

Do not modify old tests simply to make them pass.

---

# 22. PERFORMANCE AND FAST IMPLEMENTATION INSTRUCTIONS

This feature should be implemented efficiently.

1. Reuse existing BMS components and services.
2. Do not rebuild Party Master, Item Master or Ledger Account Master.
3. Do not create new transaction models solely for reporting.
4. Do not seed demo invoices.
5. Do not install multiple overlapping grid/export libraries.
6. Do not create a separate page for every report type.
7. Use one reusable configuration screen and report engine.
8. Keep report-source adapters separate so future transaction types can be added safely.
9. Keep the scope to Sales/Purchase Bill Base only.
10. Avoid changing unrelated files.
11. Run targeted tests first, then regression tests.
12. Do not spend time building report types that have no valid source data.

The report engine should be reusable for future Item Base reports, but do not implement the Item Base report in this task.

Do not stop at a UI mockup. Complete the backend query, report results, grouping, print preview and exports.

---

# 23. FINAL ACCEPTANCE CRITERIA

The feature is complete only when this end-to-end workflow works:

1. Open Report.
2. Open Final Reports.
3. Open Sale/Pur Details.
4. Select Sale/Pur Bill Base.
5. Select BillNo Wise.
6. Choose the From/To date range.
7. Select Sales or Purchase.
8. Select Party/Item/Book filters where available.
9. Select Detail or Summary.
10. Select Standard or custom columns.
11. Click Preview (Page Down).
12. See actual database report records.
13. Expand a bill row and view actual item details.
14. Drag Party Name into the grouping area.
15. See correct grouped totals.
16. Click Preview.
17. See the separate A4 print preview.
18. Print the report.
19. Export the same filtered report to PDF.
20. Export the same filtered report to a valid XLSX file.
21. Return to filters and change the date range.
22. Generate a new accurate report.
23. Verify that no underlying transaction was modified.

# 24. FINAL REPORT

After completion, report:

1. Features implemented.
2. Report navigation path.
3. Report formats implemented.
4. Transaction source types supported.
5. Filters implemented.
6. Column-selection system.
7. Custom column persistence.
8. Grouping and drill-down.
9. API routes.
10. Database changes, if any.
11. Query performance approach.
12. Printing and export behaviour.
13. Files created.
14. Files modified.
15. Backend TypeScript result.
16. Frontend build result.
17. Automated tests.
18. Browser verification.
19. Regression results.
20. Unsupported source types and reasons.

Report only actually executed test results.

Do not claim a report type works if its source transaction is missing.

Do not commit or push.

Stop after giving the final completion report for manual review.

---

# FINAL REQUIREMENT

Build a real, accurate and professional Sales & Purchase Bill Base Report for SHIVAM ENTERPRISE.

Use the supplied Chandni screenshots as the workflow and layout reference.

The report must be generated from actual BMS database records, support configurable columns and interactive grouping, calculate correct totals and provide a print preview that matches the generated report.

No dummy data. No fake calculations. No decorative buttons. No broken exports.

Preserve all previously completed BMS modules.