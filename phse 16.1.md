# PHASE 16.1 — BANK RECONCILIATION PDF FORMAT REDESIGN
## Match Chandni Software Bank Reconciliation Statement

**Project:** SHIVAM ENTERPRISE BMS  
**Module:** Bank Reconciliation  
**Task:** Print Format / PDF Layout Only

## 1. OBJECTIVE

Redesign the existing Bank Reconciliation Statement PDF to closely match the supplied Chandni Software reference.

This task is STRICTLY about the printed document format.

Do not redesign the Bank Reconciliation screen.

Do not change the accounting calculation engine, bank balances, clearing dates, journal entries or reconciliation workflow.

Modify only the PDF/print rendering and its styling.

## 2. EXACT PRINT LAYOUT

Create a clean A4 portrait statement with a white background, thin black borders and compact accounting-style typography.

Follow this structure:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                  SHIVAM ENTERPRISE                           │
│                 [FINANCIAL YEAR]                             │
├──────────────────────────────────────────────────────────────┤
│                  Company Address                             │
├──────────────────────────────────────────────────────────────┤
│ GSTIN: [ACTUAL COMPANY GSTIN]                                │
├──────────────────────────────────────────────────────────────┤
│                  BANK: [BANK NAME]                           │
├──────────────────────────────────────────────────────────────┤
│          BANK RECONCILIATION REPORT                          │
│           FROM: [FROM DATE] TO [TO DATE]                     │
├──────────────────────────────────────────────┬───────────────┤
│ 1. Balance as per our Bank Book :-            │ [AMOUNT]     │
├──────────────────────────────────────────────┴───────────────┤
│ 2. Add: Cheques issued but not presented for payment :-      │
├──────────────┬────────────┬───────────────┬─────────┬────────┤
│ Date         │ Chq. No.   │ Favouring     │ Amount  │ Cl.Date│
├──────────────┴────────────┴───────────────┴─────────┴────────┤
│               ACTUAL UNCLEARED PAYMENT ROWS                  │
│                                                              │
│                         All Clear                            │
├──────────────────────────────────────────────────────────────┤
│                         Total                                │
├──────────────────────────────────────────────────────────────┤
│ 3. Less: Cheque deposited but not credited :-                │
├──────────────┬────────────┬───────────────────┬───────────────┤
│ Date         │ Chq. No.   │ Received From     │ Amount (Rs.)  │
├──────────────┴────────────┴───────────────────┴───────────────┤
│               ACTUAL UNCLEARED RECEIPT ROWS                  │
│                                                              │
│                         All Clear                            │
├──────────────────────────────────────────────────────────────┤
│                         Total                                │
├──────────────────────────────────────────────┬───────────────┤
│ 4. Balance as per Bank Statement :-          │ [AMOUNT]     │
├──────────────────────────────────────────────┼───────────────┤
│ 5. Cl. Bal :-                                │ [AMOUNT]     │
└──────────────────────────────────────────────┴───────────────┘
```

The diagram represents the required layout and hierarchy, not literal fixed content.

## 3. COMPANY HEADER

Display real Company Master information:

- Company name — centered, bold and italic.
- Financial year — centered alongside or beneath the company name.
- Company address — centered.
- GSTIN — left aligned.
- Bank name — centered and bold.

Never hardcode Chandni's company details.

## 4. REPORT TITLE

Display:

**BANK RECONCILIATION REPORT FROM: [FROM DATE] TO [TO DATE]**

Use actual selected dates and bank name.

## 5. SECTION 1 — BALANCE AS PER BANK BOOK

Display:

`1. Balance as per our Bank Book :-`

Show the actual calculated closing book balance on the right side.

## 6. SECTION 2 — UNCLEARED PAYMENTS

Heading:

`2. Add : Cheques issued but not presented for payment :-`

Columns:

- Date
- Chq. No.
- Favouring
- Amount (Rs.)
- Cl. Date

Display only genuine uncleared payment transactions.

Use actual cheque/reference details and counterparty names.

If no uncleared payments exist, display:

**All Clear**

Show the correct total below the table.

## 7. SECTION 3 — UNCLEARED RECEIPTS

Heading:

`3. Less : Cheque deposited but not credited :-`

Columns:

- Date
- Chq. No.
- Received From
- Amount (Rs.)

Display only genuine uncleared receipt transactions.

If no uncleared receipts exist, display:

**All Clear**

Show the correct total below the table.

## 8. SECTION 4 — BALANCE AS PER BANK STATEMENT

Display:

`4. Balance as per Bank Statement :-`

Show the actual statement closing balance entered by the user.

## 9. SECTION 5 — CLOSING BALANCE

Display:

`5. Cl. Bal :-`

Show the calculated closing balance as per the existing reconciliation engine.

If the difference is non-zero, display a separate small warning below the main statement:

`Unreconciled Difference: [ACTUAL AMOUNT]`

Do not hide a real difference.

Do not add an accounting adjustment.

Keep this main five-section format close to the supplied reference.

## 10. VISUAL DESIGN REQUIREMENTS

Match the reference document:

- A4 portrait.
- White paper.
- Thin black table borders.
- Centered company heading.
- Bold italic section headings.
- Compact accounting-style fonts.
- Amounts right-aligned.
- Consistent column widths.
- Proper horizontal separators.
- Clear spacing between sections.
- No modern dashboard cards.
- No coloured backgrounds.
- No unnecessary decorative elements.

Use the available paper width efficiently.

The finished document should resemble a traditional printed accounting reconciliation statement.

## 11. DYNAMIC DATA REQUIREMENTS

Every field must use actual saved data:

- Company details.
- GSTIN.
- Financial year.
- Bank account name.
- From and To dates.
- Book balance.
- Uncleared payments.
- Uncleared receipts.
- Cheque numbers.
- Clearing dates.
- Account names.
- Statement balance.
- Closing balance.

Do not use reference screenshot values as hardcoded data.

When the table has no records, use the All Clear row rather than dummy transactions.

## 12. PDF AND PRINT REQUIREMENTS

Update the existing `BankReconciliationPrintPage.tsx` and `buildStatementPdf` implementation.

Requirements:

- PDF must be genuine and downloadable.
- A4 portrait.
- Correct page margins.
- Correct border rendering.
- No clipped text.
- No missing rows.
- Correct Indian currency formatting.
- Correct multi-page behaviour when necessary.
- All table headers repeat on subsequent pages.
- The PDF must contain the same data as the screen.
- Print preview and downloaded PDF must match.

Use the existing PDF infrastructure.

Do not create a second PDF engine unnecessarily.

## 13. STRICT SCOPE PROTECTION

Do not modify:

- Bank Reconciliation calculations.
- Opening statement balances.
- Closing statement balances.
- Clearing dates.
- BankReconciliationMark.
- JournalLine.
- BankVoucher.
- Bank Receipt.
- Bank Payment.
- Accounting balances.
- Company/FY isolation.
- Existing API contracts unless strictly necessary for print data.

Do not add a database migration unless genuinely required for the layout.

Do not reset PostgreSQL.

Do not commit or push.

## 14. VERIFICATION

Test the following:

1. PDF with uncleared payments.
2. PDF with uncleared receipts.
3. PDF with both types.
4. PDF with All Clear payments.
5. PDF with All Clear receipts.
6. PDF with a zero difference.
7. PDF with a non-zero difference.
8. PDF with long company and bank names.
9. Multi-page PDF.
10. Actual downloaded PDF compared with the print preview.

Verify the five sections appear in the correct order.

Confirm that all financial figures remain unchanged from the existing reconciliation summary.

Run backend TypeScript checks, frontend TypeScript checks, frontend production build and the Phase 16 regression test suite.

## 15. FINAL REPORT

Report:

- Print layout changes.
- PDF generation changes.
- Files modified.
- Build results.
- Test results.
- Print-preview verification.
- Confirmation that no accounting calculations or journal entries were changed.

Do not claim successful PDF verification unless the downloaded file was actually opened or structurally validated.

Stop after the final report for manual review.

---

**FINAL INSTRUCTION:** Reproduce the supplied Chandni Software Bank Reconciliation Statement format as closely as possible. Change only the document presentation, keeping all existing BMS accounting data and calculations untouched.