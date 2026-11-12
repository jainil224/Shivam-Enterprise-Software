# PHASE 17.1 — ACCOUNT LEDGER PDF PRINT FORMAT REDESIGN
## Match Chandni Software Reference — Print Layout Only

**Project:** SHIVAM ENTERPRISE BMS  
**Module:** Account Ledger  
**Task:** Redesign Account Ledger print preview and PDF format  
**Reference:** First supplied image (Chandni Software Account Ledger print preview)  
**Current implementation:** Second supplied image

## 1. OBJECTIVE

The existing Account Ledger PDF works, but its layout does not match the desired Chandni Software reference.

I want to redesign the Account Ledger print document to reproduce the first reference image's:

- Company header.
- Financial-year information.
- Phone and GSTIN fields.
- Account Ledger title positioning.
- Selected ledger name.
- GST Number, PAN Number and Schedule row.
- Traditional accounting table.
- Combined Voucher Number / Cheque Number column.
- Debit and Credit columns.
- Running Balance and Dr/Cr sign.
- Totals row.
- Full-page outer border.

The first screenshot is the target.

The second screenshot is the current implementation that must be improved.

**This is a PRINT FORMAT task only. Do not change accounting logic, database transactions, ledger calculations, balances or source data.**

## 2. FIRST INSPECT EXISTING IMPLEMENTATION

Inspect:

- `AccountLedgerPrintPage.tsx`, if present.
- Account Ledger result page.
- Account Ledger API and types.
- Existing PDF generation implementation.
- `backend/src/utils/pdfWriter.ts`.
- Existing print CSS.
- Existing company details and ledger lookup data.
- Existing Bank Book and Account Ledger routes.

Find the exact code responsible for the current second-image output.

Reuse the current saved report data and actual selected ledger information.

Do not create a second Account Ledger PDF implementation unnecessarily.

## 3. TARGET PRINT DOCUMENT STRUCTURE

Rebuild the document using this layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ COMPANY NAME                                      FINANCIAL YEAR    │
│ Company Address                                      Page X of Y    │
│ Phone Number                                      From: DD-MM-YYYY  │
│ GSTIN                ACCOUNT LEDGER                 To: DD-MM-YYYY  │
├────────────────────────────────────────────────────────────────────┤
│ SELECTED ACCOUNT / LEDGER NAME                                    │
├────────────────────────────────────────────────────────────────────┤
│ GST No.                 PAN No.                Schedule             │
├────────────────────────────────────────────────────────────────────┤
│ Date │ Vch No / Chq No │ Type │ Book Name │ Debit │ Credit │ Balance│Sign│
├──────┼─────────────────┼──────┼───────────┼───────┼────────┼────────┼────┤
│ Opening Balance       │                               0.00 │ Dr   │
├──────┼─────────────────┼──────┼───────────┼───────┼────────┼────────┼────┤
│ REAL TRANSACTION ROWS                                               │
│                                                                    │
│                                                                    │
├──────┴─────────────────┴──────┴───────────┴───────┴────────┼────────┤
│ TOTAL DEBIT                         TOTAL CREDIT            CLOSING  │
│                                                        BALANCE      │
└────────────────────────────────────────────────────────────────────┘
```

This is a structural diagram. Implement the actual layout in HTML/CSS and the existing PDF generation system.

## 4. COMPANY HEADER — EXACT POSITIONING

Create a full-width bordered header inside the A4 page.

### Top row

**Left:**
- Company Name.
- Large, bold text.

**Right:**
- Financial Year.
- Large, bold text.

### Second row

- Full company address.
- Left aligned.

### Third row

**Left:**
- Phone number.

**Right:**
- Page X of Y.
- From Date.
- To Date.

### Fourth row

**Left:**
- GSTIN.

**Center:**
- ACCOUNT LEDGER.

**Right:**
- Maintain alignment with the date/page information above.

Use these values from the actual Company Master.

Do not use Chandni's company name, address, phone or GSTIN.

If the phone number is missing, leave that field blank or omit it cleanly.

Never print fake company information.

## 5. SELECTED LEDGER NAME

Directly below the company header, create a separate full-width bordered row.

Display the selected ledger name on the left in bold.

Examples:

- STATE BANK OF INDIA.
- HDFC Bank Current A/c.
- CASH ON HAND.
- Actual customer ledger name.

The selected ledger must come from the current Account Ledger selection.

Do not hardcode STATE BANK OF INDIA.

Do not print an unrelated customer or test ledger.

If the user selected a customer ledger, display that customer.

If the user selected a bank ledger, display that bank.

## 6. LEDGER INFORMATION ROW

Below the selected account name, create a metadata row with three aligned sections.

**Left:**
- GST No.

**Center:**
- PAN No.

**Right:**
- Schedule / Account Group.

Example:

```text
GST No. : [Actual GSTIN]

PAN No. : [Actual PAN]

Schedule : [Actual Account Group]
```

Requirements:

- Use actual linked Party data when available.
- Use actual LedgerAccount classification.
- Do not fabricate missing GSTIN/PAN information.
- If a field does not exist for the selected ledger, display it blank or omit its value.

## 7. MAIN TABLE — REQUIRED COLUMN STRUCTURE

The first reference uses this structure:

| Column | Description |
|---|---|
| Date | Voucher date |
| Vch No / Chq No | Voucher number and cheque/reference number |
| Type | Payment, Receipt, Journal, etc. |
| Book Name | Counterparty/particulars or actual book description |
| Debit | Ledger debit |
| Credit | Ledger credit |
| Balance | Running balance |
| Sign | Dr / Cr |

### Important column change

The current implementation shows separate columns for:

- VCH NO
- CHQ NO

The target reference displays the voucher number and cheque number together in one compact column.

Implement a combined column headed:

`Vch No / Chq No`

Inside each row, display:

- Voucher number on the first line.
- Cheque/reference number on the second line, when available.

If no cheque/reference number exists, do not add a fake second value.

### Book Name / Particulars column

This should be one of the widest columns.

Display:

- Opening Balance.
- Counterparty or account name.
- Actual transaction particulars/narration.
- Original bill number/reference as a secondary line when available.

Example:

```text
CHANDNI SOFT SERVICES
Bill No: 1
```

Use actual source document information.

Do not add text that does not exist in the source data.

## 8. OPENING BALANCE ROW

Display the opening balance as the first table entry.

Label:

`Opening Balance`

The amount must be calculated using the existing Account Ledger calculation logic as of the day before From Date.

Display its correct Dr/Cr nature.

Do not automatically show zero when a genuine opening balance or historical journal exists.

## 9. TRANSACTION ROW DESIGN

For each actual posted ledger transaction, render:

- Voucher Date.
- Voucher Number.
- Cheque Number/reference.
- Transaction Type.
- Book Name/Particulars.
- Debit.
- Credit.
- Running Balance.
- Dr/Cr.

### Row formatting

- Compact row height.
- Proper vertical alignment.
- Date left aligned.
- Numeric values right aligned.
- Debit/Credit amounts correctly aligned.
- Long particulars wrap to the next line.
- Voucher and cheque references may appear on separate lines inside their single column.

Support entries with multiple lines of particulars without overlapping adjacent rows.

Do not omit real transaction entries.

## 10. TOTAL ROW

At the bottom of the transaction table, show:

- Total Debit.
- Total Credit.
- Final Closing Balance.
- Final Dr/Cr sign.

Totals must include the complete date-filtered ledger dataset.

Do not calculate totals from only the visible screen page.

Preserve the existing financial calculations exactly.

## 11. PAGE DESIGN AND ALIGNMENT

The target is a traditional accounting document, not a modern web dashboard.

### Paper

- A4 portrait by default.
- White background.
- Thin black outer border.
- Consistent internal borders.
- Comfortable but compact margins.

### Outer border

Create a full-page rectangular border enclosing:

- Company header.
- Selected account information.
- Ledger metadata.
- Transaction table.
- Totals.

The border should extend towards the bottom of the printable page, as in the first reference image.

### Typography

Suggested styling:

- Company Name: approximately 16–19 pt, bold.
- Financial Year: approximately 15–18 pt, bold.
- ACCOUNT LEDGER: approximately 12–14 pt, bold.
- Ledger Name: approximately 11–12 pt, bold.
- Table headers: approximately 9–10 pt, bold.
- Transaction rows: approximately 9–11 pt.
- Metadata: approximately 9–10 pt.

Adjust based on actual paper width and column count.

### Colours

- Primarily black text.
- White background.
- Blue/dark-blue ACCOUNT LEDGER title if appropriate.
- No coloured dashboard cards.
- No unnecessary decorative elements.

### Column widths

Use percentage-based or measured widths.

Suggested proportions:

- Date: 8%.
- Vch No / Chq No: 10%.
- Type: 7%.
- Book Name / Particulars: 32%.
- Debit: 13%.
- Credit: 13%.
- Balance: 12%.
- Sign: 5%.

Adjust these values so the table fits the A4 printable width without clipping.

## 12. MULTI-PAGE PRINTING

When transaction rows exceed one page:

- Repeat the company header where appropriate.
- Repeat selected ledger name and report information.
- Repeat ledger metadata when practical.
- Repeat table column headers.
- Continue the transaction rows.
- Preserve running balances across pages.
- Print Page X of Y.
- Print the final totals only at the appropriate final position.

Do not split a single multi-line transaction row across pages if it can be avoided.

Do not produce unexpected blank pages.

Do not omit transaction rows.

## 13. PRINT PREVIEW AND PDF EXPORT

The existing print preview should show the redesigned document.

Preserve the current preview toolbar and functionality.

Support:

- Print.
- Save as PDF.
- Genuine PDF download.
- Page count.
- Page navigation.
- Portrait orientation.
- Landscape orientation if already supported.

The actual downloaded PDF must match the visible print preview.

Do not generate an image and rename it `.pdf`.

Use the existing PDF writer if possible.

If browser print is the active Save as PDF mechanism, preserve that behaviour and clearly label it.

## 14. IMPORTANT — DATA AND ACCOUNTING PROTECTION

Do not change:

- Opening ledger balance.
- JournalLine.
- LedgerAccount.
- BankVoucher.
- Voucher revisions.
- Debit/Credit amounts.
- Running balance calculations.
- Transaction ordering.
- Company/FY isolation.
- Bank Reconciliation.
- Bank Book.
- Bank Receipt.
- Bank Payment.

Do not seed sample ledger records.

Do not change the selected account to make the output resemble the screenshot.

The example in the first reference uses STATE BANK OF INDIA. The second supplied image uses a temporary customer ledger. These are different data selections.

**Preserve whichever real ledger the user selected. Only change the presentation format.**

## 15. TESTING

Verify:

1. Bank account ledger PDF.
2. Customer ledger PDF.
3. Supplier ledger PDF.
4. Cash ledger PDF.
5. Ledger with no GSTIN.
6. Ledger with GSTIN and PAN.
7. Ledger with long company name.
8. Ledger with long transaction particulars.
9. Ledger with multiple cheque/reference numbers.
10. Multi-page ledger.
11. Correct opening balance.
12. Correct debit/credit totals.
13. Correct running balance.
14. Correct Dr/Cr sign.
15. Correct closing balance.
16. Correct page numbering.
17. Preview and PDF output consistency.

Run:

- Backend TypeScript check.
- Frontend TypeScript check.
- Frontend production build.
- Existing Phase 17 report tests.
- Relevant Phase 12 and Phase 16 regression tests.

Do not weaken existing assertions.

## 16. FINAL ACCEPTANCE CRITERIA

The new Account Ledger PDF must visibly resemble the first supplied reference:

- Structured company header.
- Large company name and financial year.
- Phone and GSTIN lines.
- Centered ACCOUNT LEDGER title.
- Selected account displayed in its own row.
- GST No, PAN No and Schedule row.
- Combined Vch No / Chq No column.
- Wide Book Name/Particulars column.
- Debit, Credit, Balance and Sign columns.
- Opening Balance row.
- Actual transaction records.
- Correct totals row.
- Full-page outer border.
- A4 printable layout.

The current second-image layout must be replaced with this design.

## 17. FINAL IMPLEMENTATION REPORT

Report:

1. Files modified.
2. Header changes.
3. Table changes.
4. Column width/alignment changes.
5. Multi-page changes.
6. PDF generation changes.
7. Backend checks.
8. Frontend build.
9. Test results.
10. Confirmation that financial calculations and database records were not modified.

Do not claim success unless the actual PDF was generated and inspected.

Do not commit or push.

Stop after the completion report for manual review.

---

# FINAL INSTRUCTION

I want the Account Ledger print output to follow the first Chandni Software image as closely as reasonably possible.

The second image is the current BMS output and must be redesigned.

Change the print presentation only.

Preserve the existing real ledger data, accounting values, calculations and transaction references.