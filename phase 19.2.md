
# PHASE 19.2 — ACCOUNT WISE BALANCE PRINT PREVIEW REDESIGN
## CHANGE CURRENT PRINT FORMAT TO CHANDNI WEAVING STYLE

Project: SHIVAM ENTERPRISE BMS  
Module: Account Wise Balance  
Reference: Supplied Chandni Software Account Balance Report screenshot  
Development Tool: OpenCode

---

# 1. EXACT OBJECTIVE

I have already implemented Phase 19 Account Wise Balance, including:

- Account Wise Balance configuration.
- Account Wise Balance calculations.
- Account + Month Wise Balance.
- Report result grid.
- A4 portrait PDF generation.
- A4 landscape PDF generation.
- Multi-page pagination.

However, the current Account Wise Balance print output does not match the Chandni Software reference.

I want to change ONLY the print-preview interface and the actual printed document design.

The second supplied screenshot is the desired reference.

The first supplied screenshot is my current implementation.

## Visual difference

CURRENT FORMAT:

```text
┌──────────────────────────────────────────────────────────────┐
│ ACCOUNT WISE BALANCE       Date        Refresh Save PDF Print │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ACCOUNT NAME             DEBIT              CREDIT             │
│                                                              │
│ Supplier                 18,500.00                              │
│ Party                                                            │
│                                                              │
│ TOTAL                    18,500.00         25,000.00           │
│                                                              │
│ TOTALS explanatory card                                      │
└──────────────────────────────────────────────────────────────┘
```

TARGET FORMAT:

```text
                 PRINT PREVIEW WINDOW

┌────────────────────────────────────────────────────────────────┐
│ Print | Save | Previous | PAGE 1 OF 1 | Next | Close            │
├───────┬────────────────────────────────────────────────────────┤
│       │                                                        │
│ WAP   │             GREY PREVIEW BACKGROUND                    │
│       │                                                        │
│ PDF   │        ┌────────────────────────────────┐              │
│       │        │                                │              │
│ SAVE  │        │       COMPANY NAME             │              │
│       │        │       COMPANY ADDRESS          │              │
│       │        │       PAN NO / TAN NO          │              │
│       │        │       ACCOUNT BALANCE REPORT   │              │
│       │        │       GSTIN / PERIOD / PAGE    │              │
│       │        ├────────────────────────────────┤              │
│       │        │ ACCOUNT NAME | DEBIT | CREDIT  │              │
│       │        ├────────────────────────────────┤              │
│       │        │ PARTY NAME                    │              │
│       │        │ Party details                 │              │
│       │        │                   62,786.00   │              │
│       │        ├────────────────────────────────┤              │
│       │        │ TOTAL              62,786.00   │              │
│       │        └────────────────────────────────┘              │
│       │                                                        │
└───────┴────────────────────────────────────────────────────────┘
```

The target should look like traditional accounting software, NOT like a modern dashboard report.

# 2. STRICT SCOPE

Modify only the Account Wise Balance print-preview and document-generation workflow.

Likely relevant files:

Frontend:
- AccountWiseBalancePreviewPage.tsx
- AccountWiseBalancePrintPage.tsx
- Account Wise Balance print CSS
- Existing PDF download functionality.

Backend:
- accountWiseBalancePrint.ts
- accountWiseBalancePrintPdf.ts
- accountWiseBalanceService.ts, only if the print payload needs a correction.

Inspect the actual repository before selecting files.

Do not scan the entire project.

Do not rebuild the Account Wise Balance module.

Do not modify the configuration screen.

Do not modify the report result calculation.

Do not modify account classifications.

Do not modify monthly report calculations.

Do not modify the database schema.

Do not modify Bank Receipt, Bank Payment, Bank Reconciliation, Purchase, Manufacturing or other reports.

Preserve every existing report filter and financial calculation.

# 3. PRINT PREVIEW WINDOW DESIGN

Recreate the outer Chandni-style print preview interface.

## 3.1 Window layout

The screen should contain:

1. Top toolbar.
2. Left-side vertical toolbar.
3. Grey preview background.
4. Centered white A4 paper.
5. Page navigation.
6. Close action.

Visual structure:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ PRINT PREVIEW                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Print | Save | Previous | [1] OF [1] | Next | Last | Close           │
├──────┬──────────────────────────────────────────────────────────────┤
│      │                                                              │
│ Wap  │                                                              │
│      │                 GREY BACKGROUND                               │
│ PDF  │                                                              │
│      │          ┌───────────────────────────────┐                    │
│ Save │          │                               │                    │
│      │          │       WHITE A4 PAGE           │                    │
│      │          │                               │                    │
│      │          │       ACCOUNT BALANCE         │                    │
│      │          │          REPORT               │                    │
│      │          │                               │                    │
│      │          └───────────────────────────────┘                    │
│      │                                                              │
└──────┴──────────────────────────────────────────────────────────────┘
```

## 3.2 Colours

Outside the paper:
- Neutral grey background similar to the reference.
- No large green cards.
- No modern gradient backgrounds.

Paper:
- Pure white background.
- Thin neutral/yellow page-edge outline.
- Thin black document borders.

Toolbar:
- Compact traditional print toolbar.
- Small practical buttons.
- Clear icons and labels.
- No large dashboard buttons.

## 3.3 Toolbar functions

Implement these functional actions:

| Action | Required behaviour |
|---|---|
| Print | Open browser print dialog |
| Save | Download the genuine PDF |
| Previous | Show previous page |
| Next | Show next page |
| First | Navigate to first page |
| Last | Navigate to final page |
| Page counter | Show current page and total pages |
| Close | Return to the report result page |
| PDF | Download the genuine PDF |

If the existing system has a real WhatsApp/Wap export integration, preserve it. Otherwise omit it or show a clearly disabled state. Never create a fake sharing action.

Do not implement decorative or nonfunctional buttons.

# 4. A4 DOCUMENT FORMAT — MOST IMPORTANT

The printed white page must closely reproduce the second Chandni screenshot.

Use:

- A4 portrait.
- Width: 210 mm.
- Height: 297 mm.
- Consistent print margins.
- Compact document width.
- Black text.
- Thin black borders.
- Traditional accounting report alignment.

The document should start near the top of the page.

Do not vertically center the report.

Do not stretch the table to fill the page height.

The majority of the lower page should remain blank when the number of accounts is small, as shown in the reference.

## 4.1 Company header

Use this structure:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│               ACTUAL COMPANY NAME                  FY 2026-27 │
│                                                              │
│                ACTUAL COMPANY ADDRESS                        │
│                                                              │
│ PAN NO: ACTUAL PAN                      TAN NO: ACTUAL TAN   │
│                                                              │
│                ACCOUNT BALANCE REPORT                         │
│                                                              │
│ GSTIN: ACTUAL GSTIN        PERIOD FROM: DD-MM-YYYY            │
│                            TO: DD-MM-YYYY     PAGE 1 OF 1     │
└──────────────────────────────────────────────────────────────┘
```

### Required alignment

Company name:
- Bold.
- Centered.
- Larger than normal body text.
- Financial Year aligned to the right on the same header line.

Address:
- Centered.
- Smaller font.

PAN:
- Left aligned.

TAN:
- Right aligned only when the actual Company Master contains a TAN value.

Report title:
- Centered.
- Bold.
- Must display `ACCOUNT BALANCE REPORT`.

GSTIN:
- Left aligned.

Reporting period:
- Right or center aligned based on available width.

Page:
- Right aligned.

Use actual company information from the active Company Master and financial year.

Never hardcode Chandni company details.

If the company has no TAN field/value, hide the TAN label and value. Do not invent or add a fake value.

# 5. ACCOUNT TABLE DESIGN

The document must contain exactly these three primary columns:

```text
┌──────────────────────────────────────────────────────────────┐
│ ACCOUNT NAME                         DEBIT            CREDIT │
├──────────────────────────────────────────────────────────────┤
│ ACTUAL PARTY / ACCOUNT NAME                                 │
│ Actual address / optional details                            │
│                                      62,786.00               │
├──────────────────────────────────────────────────────────────┤
│ ANOTHER ACCOUNT                                               │
│ Actual address / optional details                            │
│                                                      25,000.00│
├──────────────────────────────────────────────────────────────┤
│ TOTAL                                  62,786.00      25,000.00│
└──────────────────────────────────────────────────────────────┘
```

The figures are illustrative, not actual production data.

## Column widths

Use approximately:

- Account Name: 55%.
- Debit: 22.5%.
- Credit: 22.5%.

Adjust proportionally to the actual printable width.

## Column alignment

- Account Name: left.
- Debit: right.
- Credit: right.

## Table styling

- Thin black borders.
- Compact rows.
- No rounded corners.
- No coloured table cards.
- No modern dashboard shadows.
- Bold column headings.
- Bold account names.
- Bold total row.

# 6. ACCOUNT ROW FORMAT

Each actual account should appear as a compact block.

Example:

```text
ACCOUNT NAME

Party address
Mobile No: actual mobile number
PAN No: actual PAN number

                                       62,786.00
```

Use actual available values.

Follow the Phase 1 checkbox selections:

- Party Address Required?
- Party Mobile No Required?
- PAN No Required?
- Do not Print Description?
- Skip 0 (Zero) Transaction?
- Page Break on Every Party?

Never show optional party information when its corresponding checkbox is disabled.

Never replace missing data with invented values.

Never remove existing account records to make the format look cleaner.

Do not hardcode party names, addresses, PANs or balances.

# 7. DEBIT AND CREDIT PRESENTATION

Follow the existing canonical account balance calculation.

For a debit closing balance:

- Show the amount in Debit.
- Leave Credit blank.

For a credit closing balance:

- Show the amount in Credit.
- Leave Debit blank.

For a zero balance:

- Follow the Skip 0 setting.

Preserve negative balances and existing accounting sign rules.

The Total row must show:

- Total Debit.
- Total Credit.

Do not force the two totals to match.

Do not add an artificial adjustment to make the report balance.

# 8. FONT AND TYPOGRAPHY

The supplied Chandni printout uses compact traditional accounting typography.

Use:

- Arial or Helvetica-compatible sans-serif for the print document.
- Company name approximately 13–15 pt, bold.
- Report title approximately 10–12 pt, bold.
- Column headings approximately 8–9 pt, bold.
- Account names approximately 9–10 pt, bold.
- Supporting party details approximately 7–8 pt.
- Amounts approximately 9 pt.
- Total approximately 9–10 pt, bold.

Use consistent line spacing.

Do not use the current large monospace heading/table appearance from the result screen.

Amounts must be right aligned and formatted using the existing Indian currency formatting convention.

# 9. DOCUMENT BORDER AND ALIGNMENT

Reproduce the reference's bordered document:

```text
┌────────────────────────────────────────────┐
│                COMPANY HEADER              │
├────────────────────────────────────────────┤
│           REPORT TITLE AND PERIOD          │
├────────────────────────────────────────────┤
│ ACCOUNT NAME       DEBIT           CREDIT  │
├────────────────────────────────────────────┤
│ Account 1                                 │
│ Supporting information                   │
├────────────────────────────────────────────┤
│ Account 2                                 │
│ Supporting information                   │
├────────────────────────────────────────────┤
│ TOTAL                                    │
└────────────────────────────────────────────┘
```

Requirements:

- Consistent document border.
- Table columns aligned.
- No overlapping text.
- No clipped amounts.
- No text extending beyond the page.
- Consistent row height.
- Borders should remain visible when printed.
- Header and table must remain aligned on every page.

# 10. PAGINATION

Support one or multiple pages.

When there are many account records:

- Split records between pages.
- Keep account blocks together where possible.
- Never cut an account's name from its supporting address/PAN/mobile lines.
- Repeat the company header when necessary.
- Repeat the report title and table header on subsequent pages.
- Show correct Page X of Y.
- Print TOTAL only where appropriate, normally at the final page.

### Page Break on Every Party

If enabled:

- Each account/party starts on a new page.
- Do not accidentally place multiple accounts together.
- Do not create unnecessary blank pages.
- The Total row appears at the correct final location.

If disabled:

- Allow multiple account blocks per page.
- Use available page space efficiently.

Use the actual selected option from Phase 1.

# 11. PRINT AND PDF MUST MATCH

The on-screen preview and downloaded PDF must display exactly the same report content and layout.

Important:

- Do not create separate calculation logic for HTML and PDF.
- Do not independently calculate page numbers in the frontend.
- Do not create different account rows in the PDF.
- Reuse the existing Phase 19 shared print document/page model.

The backend-generated print document should remain the single source of truth for:

- Account rows.
- Layout geometry.
- Page dimensions.
- Page breaks.
- Page numbering.
- Totals.

The React print preview and the PDF renderer should render this shared structure consistently.

# 12. PDF GENERATION

Reuse the existing PDF generation infrastructure.

Inspect:

- `accountWiseBalancePrint.ts`
- `accountWiseBalancePrintPdf.ts`
- `pdfWriter.ts`
- Existing Phase 19 PDF endpoints.

Modify the existing renderer rather than building an unnecessary second PDF generator.

The PDF must:

- Be genuine PDF content.
- Use A4 portrait.
- Use real text, not a screenshot.
- Preserve company information.
- Preserve table borders and alignment.
- Preserve all selected account rows.
- Preserve totals.
- Preserve multi-page output.
- Preserve page numbering.
- Be searchable/selectable where supported.

Use dynamic filenames:

`Account_Wise_Balance_2026-2027.pdf`

Do not hardcode the year.

# 13. ACCOUNT + MONTH WISE BALANCE

This task is primarily about the Account Wise Balance print format.

Preserve the existing Account + Month Wise Balance implementation.

Do not rebuild its calculation logic.

If the same print-preview component is shared, ensure the redesign does not break the existing landscape format.

- Account Wise Balance remains A4 portrait.
- Account + Month Wise Balance remains A4 landscape.
- Monthly bands and month grouping must remain unchanged.
- Monthly PDF must remain functional.
- Existing page numbering and page bands must remain correct.

Do not regress the monthly report for the sake of redesigning the account-wise format.

# 14. EXISTING RESULT SCREEN MUST REMAIN UNCHANGED

The first screenshot contains the current report result screen.

Do not redesign the result grid as part of this task.

Keep:

- Account Name.
- Debit.
- Credit.
- Refresh.
- Save as PDF.
- Print.
- Close.
- Existing totals.
- Existing report rows.

The required modification is the actual print-preview window and printed document format.

When the user clicks Print, open the redesigned Chandni-style print preview.

When the user clicks Save as PDF, download the redesigned genuine PDF.

Do not change the report's business data or calculations.

# 15. RESPONSIVE BEHAVIOUR

Desktop:
- Grey full-size canvas.
- Centered A4 page.
- Compact toolbar.
- Correct zoom and page controls.

Mobile:
- Toolbar remains accessible.
- A4 paper scales to fit the viewport.
- Allow horizontal viewing of the fixed document if necessary.
- Keep document proportions.
- No accidental horizontal overflow of the entire application.

The printable page must always remain true A4 dimensions even when visually scaled on mobile.

# 16. REQUIRED TESTING

Create focused Phase 19.2 print tests.

Test:

1. Company name placement.
2. Actual company address.
3. Actual PAN display.
4. TAN omission when unavailable.
5. GSTIN.
6. Report title.
7. Financial year.
8. From and To dates.
9. Page X of Y.
10. Account Name column.
11. Debit amount alignment.
12. Credit amount alignment.
13. Correct party address behaviour.
14. Correct mobile display behaviour.
15. Correct PAN display behaviour.
16. Description checkbox.
17. Skip zero checkbox.
18. Page Break on Every Party.
19. Total row.
20. Multi-page output.
21. PDF signature.
22. PDF text content.
23. PDF downloaded through the browser.
24. PDF matches the preview.
25. Existing month-wise portrait/landscape regression.
26. Existing Account Wise Balance values remain identical.

Use real isolated data.

Never replace real accounts with fake test data in production.

# 17. BUILD VERIFICATION

Run:

```bash
# Backend
npx tsc --noEmit

# Frontend
npx tsc --noEmit

# Production build
npm run build

# Phase 19.2 focused tests
npm run test:phase19.2
```

Follow existing project test-script naming conventions.

Use Playwright/browser verification if available.

Verify the final result at:

- Desktop: 1440 × 900.
- Mobile: 390 × 844.

Download the actual PDF through the UI and inspect it, rather than only testing a backend buffer.

# 18. STRICT RESTRICTIONS

This is a print-format-only enhancement.

Do not:

- Change ledger calculations.
- Change opening balances.
- Change debit or credit values.
- Change party classification.
- Change schedule filtering.
- Change account type filtering.
- Change monthly calculations.
- Change existing accounting transactions.
- Change database schema.
- Create new accounting tables.
- Create another PDF generator unnecessarily.
- Rebuild Phase 19.
- Modify unrelated modules.
- Reset PostgreSQL.
- Delete any user data.
- Commit or push.

Preserve pre-existing uncommitted changes.

# 19. FINAL ACCEPTANCE CRITERIA

The work is complete only when:

1. The current result grid remains unchanged.
2. Print opens the new Chandni-style preview window.
3. The preview shows a grey background.
4. The preview shows one centered white A4 portrait sheet.
5. The company header uses real Company Master values.
6. The Account Balance Report title appears centered.
7. The GSTIN and period appear in the header.
8. The Page X of Y appears correctly.
9. The table has Account Name, Debit and Credit.
10. Every actual account is printed.
11. Optional party fields obey the configuration.
12. The table uses thin black borders.
13. Typography matches the traditional reference.
14. The total row is correctly aligned.
15. Multiple pages work correctly.
16. Page Break Every Party works correctly.
17. Save as PDF downloads a genuine PDF.
18. PDF output visually matches the on-screen preview.
19. Account + Month Wise Balance remains functional.
20. All focused tests and regression checks pass.

# 20. FINAL REPORT

After implementation, report:

- Root cause of the current print-format mismatch.
- Files created.
- Files modified.
- Exact design changes.
- Header layout.
- Font and typography.
- Table and border layout.
- Pagination behaviour.
- PDF generator changes.
- Browser verification.
- Actual PDF verification.
- Focused test results.
- Existing Phase 19 regression results.
- Remaining limitations.

Do not claim that the format exactly matches unless the rendered preview and downloaded PDF have both been visually inspected.

Do not commit or push.

Stop after the completion report for manual review.

---

# FINAL INSTRUCTION

Change ONLY the Account Wise Balance print-preview interface and printed document format.

Target the traditional Chandni Weaving print-preview appearance:

- Grey preview background.
- Centered white A4 sheet.
- Compact toolbar.
- Traditional company header.
- Centered Account Balance Report title.
- PAN, GSTIN, Financial Year and period.
- Page numbering.
- Account Name / Debit / Credit table.
- Thin black borders.
- Traditional compact font.
- Bold total row.
- Correct multi-page printing.

Preserve all actual SHIVAM ENTERPRISE accounting data, existing calculations, report filters and Phase 19 functionality.

Do not introduce fake data or modify unrelated modules.

Implement, test and STOP for manual review.