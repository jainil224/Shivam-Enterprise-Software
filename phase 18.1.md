# PHASE 18.1 — BANK RECEIPT ENTRY UI AND OUTSTANDING ADJUSTMENT CORRECTIONS

## Project
SHIVAM ENTERPRISE Business Management System

## Existing implementation
Phase 18 — Bank Receipt Entry / Cheque Receipt

## Task
Fix the current Bank Receipt Entry interface and Outstanding Adjustment workflow to match the supplied Chandni Software reference more closely.

**This is a corrective enhancement to Phase 18, NOT a rebuild of the Bank Receipt module.**

---

# 1. CURRENT PROBLEMS TO FIX

I have supplied screenshots showing two interfaces:

### Existing SHIVAM ENTERPRISE interface

- Bank Receipt Entry screen.
- Outstanding Adjustment popup.
- Current allocation display.
- Current validation warning.

### Desired Chandni reference

- Traditional compact Bank Receipt grid.
- Adjustment dropdown.
- Traditional Outstanding Adjustment window.
- Inline CurRec input.
- J.V Req? checkbox.
- Journal Voucher Auto popup.
- Discount/adjustment calculation and confirmation.

Your job is to correct the existing BMS implementation so the actual functionality and visual layout are much closer to the Chandni reference.

Do not just change CSS.

Fix the underlying UI state management and allocation workflow.

# 2. INSPECT PHASE 18 BEFORE MODIFYING

Inspect the existing files:

Backend:
- bankReceiptRepository.ts
- bankReceiptService.ts
- bankReceiptController.ts
- bankReceiptRoutes.ts
- schema.prisma
- BankVoucher
- BankVoucherLine
- BankReceiptBillAllocation
- BankReceiptAdjustmentLine
- JournalLine
- PurchaseBill
- Phase 12 bankVoucherService.ts
- Phase 12 bankVoucherRepository.ts

Frontend:
- ChequeReceiptEntryPage.tsx
- OutstandingAdjustmentDialog.tsx
- JournalVoucherAutoDialog.tsx
- ReceiptPartyLookupDialog.tsx
- BankNameLookupDialog.tsx
- Bank Receipt types.
- Bank Receipt API functions.

Read the existing Phase 18 report and inspect actual running code.

Preserve all working Phase 18 behaviour.

Do not create duplicate models or another accounting engine.

# 3. FIX THE MAIN BANK RECEIPT ENTRY SCREEN

The current interface contains:

- Voucher No.
- Date.
- Bank A/C No.
- A/C Name / Balance.
- Bank Receipt Book selector.
- Narration.
- Receipt detail grid.
- Total Receipt.
- Party footer.
- Action toolbar.

Preserve every required field.

However, redesign the header and grid to more closely match the supplied Chandni reference.

## Target header layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Bank Receipt > Cheque Receipt                [Books] [Go To Payment]│
├────────────────────────────────────────────────────────────────────┤
│ Voucher No. : [AUTO NUMBER]                                       │
│ Date        : [DATE]                                               │
│ Bank A/C No.: [BANK ACCOUNT NUMBER]                                │
│ A/C Name    : [SELECTED BANK]    Balance: [REAL BALANCE]           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                   RECEIPT DETAIL GRID                              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

The selected Bank Receipt Book may remain visible as compact context, but do not let it unnecessarily consume the space required by the main entry grid.

Keep optional Narration available without making the form unnecessarily tall.

## Target grid

```text
┌────┬──────────────┬───────────┬────────────┬────────────────┬─────────┬─────────────┐
│ Sr │ Account Name │ Bank Name │ Chq No     │ Description    │ Amount  │ Adjustment  │
├────┼──────────────┼───────────┼────────────┼────────────────┼─────────┼─────────────┤
│ 1  │ [Party]      │ [Code]    │ [Cheque]   │ [Description]  │ [18000] │ Against Bill│
│ 2  │ [Party]      │ [Code]    │ [Cheque]   │ [Description]  │ [30000] │ Against Bill│
│ 3  │              │           │            │                │         │ No Adjustment│
└────┴──────────────┴───────────┴────────────┴────────────────┴─────────┴─────────────┘
```

Requirements:

- Keep approximately 30 initial rows.
- Preserve the full-width grid.
- Use compact accounting-style rows.
- Make the active row clear.
- Allow the grid to scroll independently.
- Keep the bottom toolbar visible.
- Amounts must remain right-aligned.
- Preserve leading zeros in cheque numbers.
- Do not save empty rows.

# 4. FIX ADJUSTMENT DROPDOWN BEHAVIOUR

The Adjustment field must expose these exact choices:

1. No Adjustment
2. Against Bill
3. Skip in O/S

## No Adjustment

- Do not open Outstanding Adjustment.
- Post the actual party ledger receipt.
- Do not create bill allocation rows.
- Keep the amount on account according to existing rules.

## Against Bill

When selected:

1. Validate that the row has a party.
2. Validate that the row amount is greater than zero.
3. Open Outstanding Adjustment for that exact grid row.
4. Load actual eligible outstanding bills for that party.
5. Display the correct cheque balance.
6. Allow the user to allocate the amount.

Provide an explicit `Adjust` action if needed, but selecting Against Bill must not leave the user confused about what to do next.

Use the actual selected row ID to identify the allocation state.

## Skip in O/S

- Do not open the bill allocation popup.
- Post the real party ledger impact.
- Preserve the existing Skip in O/S meaning.
- Do not create bill allocation records.

Never silently change an adjustment mode.

# 5. FIX THE RED VALIDATION WARNING

The current screenshot shows:

`Row 1: allocate the amount against a bill or change the adjustment mode.`

This occurs because Row 1 has Against Bill selected but no current allocation.

Do not simply delete or hide this validation.

Correct the workflow:

### When the user selects Against Bill

Allow the user to open the outstanding popup and allocate the receipt.

### When the user attempts to save without allocation

Show a precise error linked to the actual row.

Example:

`Row 1 — No bill allocation has been entered. Allocate this receipt against a bill or select No Adjustment / Skip in O/S.`

### When a popup is open

Do not display a blocking page-level warning that covers or interferes with the popup.

### When allocation is successfully applied

Remove that row's warning immediately.

### Multi-row handling

If Row 1 has no allocation and Row 2 has a valid allocation:

- Only Row 1 should show an error.
- Row 2 must remain valid.
- Row 2's allocation must not disappear.
- Opening Row 1's popup must not overwrite Row 2's state.

This is critical.

# 6. CORRECT ROW-SPECIFIC ALLOCATION STATE

The current form has multiple receipt rows.

Each row has its own:

- Party.
- Amount.
- Adjustment Mode.
- Outstanding Bills.
- Current Receipt allocations.
- Journal Voucher Auto adjustments.
- Allocation status.

Keep this data completely independent.

Use a stable frontend receipt row ID.

Never key all allocations only by Party ID because the same party may appear in multiple rows.

Required behaviour:

```text
Receipt Row 1
  Party: Mumbai Fashions Pvt Ltd
  Amount: ₹18,000
  Adjustment: Against Bill
  Allocation: Row 1's own allocation records

Receipt Row 2
  Party: Rajkot Cotton Traders
  Amount: ₹30,000
  Adjustment: Against Bill
  Allocation: ₹5,000
  Cheque Balance: ₹25,000
```

These are examples based on the supplied current screenshot.

Opening or saving an allocation for one row must never modify the other row.

When a party or amount changes, safely invalidate or revalidate only that row's affected allocations.

Never silently retain stale allocations against the wrong party or amount.

# 7. REDESIGN OUTSTANDING ADJUSTMENT POPUP

This is the main UI redesign.

Current popup appearance is different from the traditional Chandni layout.

Rebuild its visual structure to match the reference more closely.

## A. Dialog title

```text
┌───────────────────────────────────────────────────────────────────┐
│ Outstanding Adjustment                                      [X]   │
└───────────────────────────────────────────────────────────────────┘
```

Use a compact traditional ERP popup with a green/teal title bar and thin borders.

Avoid unnecessary large modern cards.

## B. Party header

```text
Party Name : [SELECTED PARTY]
Address    : [ACTUAL PARTY ADDRESS]

                                      Cheque Balance : ₹18,000.00
```

All information must come from real data.

## C. Outstanding bill grid

Reproduce the reference columns:

```text
┌──────┬────────────┬────────┬────────────┬─────┬──────────┬─────────┬────────┬────────┬─────────┬───────────┐
│ Type │ Book       │ Bill No│ Date       │ Due │ Bill Amt │ Bill Tds│ PreRec │ CurRec │ Balance │ J.V Req?  │
├──────┼────────────┼────────┼────────────┼─────┼──────────┼─────────┼────────┼────────┼─────────┼───────────┤
│ SAL  │ Actual     │ Actual │ Actual     │ 1   │ 18703.00 │ 0.00    │ 0.00   │ 0.00   │ 18703.00│ [ ]       │
│ BPT  │ Actual     │ Actual │ Actual     │ 0   │ 17700.00 │ 0.00    │ 17724  │ 0.00   │ -24.00  │ [ ]       │
└──────┴────────────┴────────┴────────────┴─────┴──────────┴─────────┴────────┴────────┴─────────┴───────────┘
```

This table is a layout illustration using the screenshot's sample figures.

Never seed these records as real data.

Use the actual source type, book, bill number, date, TDS, previous receipts and outstanding balance from the database.

## D. Grid alignment

- Compact header row.
- Fixed column headings.
- Editable CurRec cells.
- Right-aligned monetary fields.
- Checkbox in J.V Req?.
- Alternating row backgrounds.
- Selected row highlight.
- Scrollable body.
- Fixed totals/footer row.

The J.V Req? field must be a genuine checkbox, not a decorative Yes/No button.

The Bill Amt, Bill Tds, PreRec and Balance are read-only calculated values unless the existing business rules explicitly permit editing.

Only CurRec is editable for manual allocation.

## E. Totals row

Show:

- Total Bill Amt.
- Total Bill Tds.
- Total PreRec.
- Total CurRec.
- Total Balance.

Use actual loaded rows and Decimal calculations.

Do not include irrelevant placeholder rows in totals.

## F. Popup footer

Match the reference's compact structure.

Display:

`Item Name : [Actual item names], Nos = [Actual quantity], Qty = [Actual quantity]`

Only show this information when the selected bills actually have item details.

Use real PurchaseBillItem records.

Do not show fabricated item names or quantities.

Keep optional actions such as Auto Allocate only if they are useful and do not distort the Chandni-style layout.

The main operation must remain direct inline CurRec entry with visible J.V Req checkboxes.

# 8. FIX CHEQUE BALANCE CALCULATION

The Cheque Balance shown in the popup must represent the actual cash amount from the current receipt row that remains available.

Example:

```text
Receipt Row Amount:          ₹30,000
Current Cash Allocation:     ₹5,000

Cheque Balance:              ₹25,000
```

Formula:

`Cheque Balance = Receipt Row Amount − Cash Amount Allocated`

Do not calculate it using another row's allocation.

Do not include another party's receipt amount.

Do not change the bank receipt voucher total.

All calculations use Decimal values.

# 9. FIX BILL-WISE ALLOCATION CALCULATION

Required fields:

- Bill Amt.
- Bill Tds.
- PreRec.
- CurRec.
- Balance.

Use:

`Available Bill Balance = Bill Amount − Applicable TDS − Previous Received − Current Settlement`

The current settlement must correctly include:

- Cash receipt allocated to this bill.
- Any explicitly approved adjustment that settles the remaining bill amount.

Preserve real negative outstanding balances.

Do not clamp negative balances to zero.

A bill that has been over-received by ₹24 should still show `-24.00` when that is what the actual records produce.

Revalidate every allocation in the backend transaction before saving.

Do not trust the frontend calculation.

Do not over-allocate bills.

# 10. REQUIRED J.V REQ? WORKFLOW

This is particularly important.

The reference shows:

1. User allocates ₹18,000 against a bill of ₹18,703.
2. Outstanding balance becomes ₹703.
3. User checks J.V Req?.
4. Journal Voucher Auto opens.
5. User creates a discount/adjustment of ₹703.
6. User confirms.
7. Bill balance becomes zero.
8. Current settlement amount becomes ₹18,703.
9. Actual cheque/bank receipt remains ₹18,000.

Reproduce this workflow using actual accounting entries.

## Example from the reference

Before the adjustment:

```text
Bill Amount        = ₹18,703
Bill TDS           = ₹0
Previous Received  = ₹0
Cash Receipt       = ₹18,000
Bill Balance       = ₹703
Cheque Balance     = ₹0
```

After Journal Voucher Auto:

```text
Adjustment Account = DISCOUNT ON SALE
Type               = AMT
Add/Less           = ₹703
Dr/Cr              = Dr

Current Settlement = ₹18,703
Remaining Balance  = ₹0
Cheque Balance     = ₹0
```

The settlement is complete, but the bank only received ₹18,000.

The additional ₹703 is a real approved adjustment, not extra cash.

## Critical accounting distinction

Keep these values separate:

1. Actual cash received.
2. Cash allocated against the bill.
3. Journal adjustment.
4. Total bill settlement.

Example:

```text
Actual Bank Receipt       ₹18,000
Approved Discount         ₹703
Total Bill Settlement     ₹18,703
Remaining Bill Balance    ₹0
```

Do not change the actual Bank Receipt amount to ₹18,703.

Do not debit the bank for the discount.

Do not create another receipt voucher.

# 11. JOURNAL VOUCHER AUTO DIALOG

Ensure the existing JournalVoucherAutoDialog works exactly with the reference workflow.

Required header:

```text
┌───────────────────────────────────────────────────────────────────┐
│ Journal Voucher Auto                                         [X]  │
├───────────────────────────────────────────────────────────────────┤
│ Bill Date       : [REAL BILL DATE]                                 │
│ Bill Amount     : [REAL BILL AMOUNT]                               │
│ Bill Balance    : [CURRENT REMAINING BALANCE]                      │
│ Cheque Balance  : [REMAINING CASH]                                 │
│ Cur Received    : [CURRENT CASH RECEIVED / SETTLEMENT DETAILS]     │
└───────────────────────────────────────────────────────────────────┘
```

Required grid:

```text
┌──────────────────┬──────┬───────┬─────┬───────┬─────────┬───────┬────────────┐
│ Account Name     │ Type │ Int % │ Due │ Tds % │ Add/Less│ Dr/Cr │ Note       │
├──────────────────┼──────┼───────┼─────┼───────┼─────────┼───────┼────────────┤
│ DISCOUNT ON SALE │ Amt  │ 0.00  │     │       │ 703.00  │ Dr    │ Settlement │
└──────────────────┴──────┴───────┴─────┴───────┴─────────┴───────┴────────────┘
```

The example is for layout and calculation testing only.

## Account Name

Use actual eligible LedgerAccount lookup.

## Type

Support the existing documented calculation types:

- AMT.
- INT.
- TDS.

Do not invent interest or TDS formulas.

Only calculate percentage-based adjustments when the real formula and applicable rate are defined.

## Add/Less and Dr/Cr

Display the real adjustment amount and direction.

Validate:

- Valid account.
- Active ledger.
- Company ownership.
- Positive adjustment amount.
- Valid Dr/Cr.
- Balanced accounting preview.

## Confirmation

Preserve:

`Confirm New!!`

`Are you sure to close?`

Buttons:

- (+) Yes
- (-) No

Yes:

- Validate all adjustments.
- Return accepted adjustment data to Outstanding Adjustment.
- Recalculate the bill.
- Preserve the row's cash receipt amount.

No:

- Return to the Journal Voucher Auto dialog.
- Preserve all entered values.

Do not independently post the journal when closing the dialog.

The actual accounting entry posts only with the main Bank Receipt save.

# 12. FIX SOURCE BILL SUPPORT

The Phase 18 report currently states that outstanding allocation uses confirmed PurchaseBill records only.

The Chandni reference displays more than one type of outstanding bill, including `SAL` and `BPT`.

Inspect the actual BMS schema for all genuine bill sources.

Create or improve a source adapter architecture so the Outstanding Adjustment popup can display all existing supported source documents.

Requirements:

- Include only real posted source bills.
- Do not use Sales Orders as Sales Invoices.
- Do not use Purchase Orders as Purchase Bills.
- Do not fabricate SAL or BPT rows.
- Do not count cancelled or reversed documents.
- Do not count unrelated vouchers as outstanding invoices.
- Do not double-count Debit Notes or other adjustments.
- Calculate previous receipts from actual saved allocations.

If Sales Invoice does not exist in the current BMS, do not pretend that the Sales source is available.

Instead, retain the real supported purchase sources and report the exact missing dependency.

If a source model exists, implement its actual bill outstanding adapter with correct debit/credit and settlement direction.

Do not create an unrelated Sales Invoice module in this corrective phase.

# 13. FIX DUE AND TDS FIELDS

Phase 18 reports:

- PurchaseBill has no due-date field.
- Due value is currently null.
- Bill TDS is currently zero because a source field is not implemented.

Inspect actual Party payment terms and bill models.

### Due

If real due days/payment terms exist, derive the actual value using the established business rule.

Otherwise show `—`.

Do not display an invented due-day value.

### Bill TDS

Use actual stored TDS where supported.

If not supported, clearly display `—` or the established zero value only where appropriate.

Do not invent an amount or percentage.

Do not deduct TDS twice.

# 14. FIX APPLY ALLOCATION AND STATE MANAGEMENT

When the user modifies CurRec values:

1. Recalculate remaining bill balance immediately.
2. Recalculate total CurRec.
3. Recalculate Cheque Balance.
4. Update the J.V Req indicator.
5. Preserve the row's pending allocation in the parent entry form.

Apply Allocation should commit the current popup state into the unsaved receipt draft only.

It must not yet write permanent JournalLine or allocation records.

The final saved Bank Receipt performs the atomic persistence.

When the popup is reopened:

- Restore the current draft allocation values.
- Restore accepted Journal Voucher Auto data.
- Show the correct remaining cheque balance.
- Do not duplicate amounts.

If the user cancels the popup, preserve the previous valid draft allocation rather than corrupting it.

# 15. CURRENT SCREEN TEST CASES

Use isolated fixtures.

### Case A — Row 1 unallocated

```text
Party: Mumbai Fashions Pvt Ltd
Receipt Amount: ₹18,000
Adjustment: Against Bill
Allocated: ₹0
```

Expected:

- Row-specific validation appears on Save.
- Adjust action opens the correct popup.
- The popup searches bills belonging only to Mumbai Fashions.
- If no eligible bills exist, show a genuine empty state.
- The user may select No Adjustment or Skip in O/S if appropriate.
- Do not show Rajkot bills in Mumbai's popup.

### Case B — Row 2 partially allocated

```text
Party: Rajkot Cotton Traders
Receipt Amount: ₹30,000
Current Allocation: ₹5,000
Cheque Balance: ₹25,000
```

Expected:

- Popup shows only Rajkot's real eligible bills.
- Existing ₹5,000 allocation remains visible.
- Other rows are unaffected.
- Totals remain accurate.

### Case C — Bill settlement with discount

```text
Bill Amount: ₹18,703
Cash Receipt: ₹18,000
Discount Adjustment: ₹703
```

Expected before JV:

```text
CurRec: ₹18,000
Bill Balance: ₹703
Cheque Balance: ₹0
```

Expected after approved JV:

```text
CurRec / Total Settlement: ₹18,703
Bill Balance: ₹0
Cheque Balance: ₹0
```

The bank receipt remains ₹18,000.

### Case D — Existing prior receipt

```text
Bill Amount: ₹17,700
Previous Received: ₹17,724
```

Expected:

```text
Remaining Balance: -₹24
```

Do not clamp this to zero.

### Case E — Multiple parties

- Open Row 1 allocation.
- Enter a CurRec.
- Close/apply.
- Open Row 2.
- Enter a different CurRec.
- Return to Row 1.

Both allocations must remain independent.

# 16. VISUAL ACCEPTANCE REQUIREMENTS

The final UI must resemble the Chandni workflow more closely than the current implementation.

### Main screen

- Compact voucher header.
- Full-width grid.
- Traditional table alignment.
- Clear adjustment dropdown.
- Visible row actions.
- Fixed footer.
- No unnecessary large warning banner.

### Outstanding Adjustment popup

- Green/teal title bar.
- Party Name and Address on the left.
- Cheque Balance on the right.
- Compact full-width table.
- Editable CurRec.
- Genuine J.V Req checkboxes.
- Totals row at the bottom.
- Item Name / quantity footer when actual bill details exist.
- Clear close/cancel action.

### Journal Voucher Auto

- Header details aligned in a compact block.
- Grid with Account Name, Type, Int %, Due, Tds %, Add/Less, Dr/Cr and Note.
- Traditional ERP popup proportions.
- Confirmation Yes/No.

Keep BMS branding, but use the reference's layout and density.

Do not create a screenshot or static mockup.

Every displayed field must work.

# 17. ACCOUNTING SAFETY

Preserve the Phase 18 posting logic and the Phase 12 append-only journal architecture.

Do not:

- Duplicate bank receipt vouchers.
- Double count allocations.
- Change the actual cash receipt amount.
- Post J.V adjustments independently.
- Modify historical JournalLine entries.
- Delete bill records.
- Allow over-allocation.
- Allow unbalanced journals.
- Mix one receipt row's allocation with another.
- Fabricate outstanding invoices.

Before final save:

- Revalidate all allocations under database locks.
- Validate accepted adjustments.
- Recalculate net party credit.
- Check total debits equal total credits.
- Save the header, rows, allocations, adjustment rows and JournalLine records atomically.
- Roll back the entire operation if any part fails.

Use Prisma.Decimal end-to-end.

# 18. TESTING

Extend the existing Phase 18 suite. Add a Phase 18.1 test suite if appropriate.

Test:

1. Against Bill opens the correct row's popup.
2. No Adjustment does not open it.
3. Skip in O/S does not open it.
4. Unallocated Against Bill row produces a clear row-level error.
5. Allocation for one party never loads another party's bills.
6. Multiple receipt rows preserve separate allocations.
7. Cheque Balance is correct.
8. CurRec recalculates Balance.
9. Existing PreRec is correct.
10. Negative bill balance is preserved.
11. J.V Req is a real checkbox.
12. J.V Auto loads correct bill values.
13. Discount settlement calculation works.
14. Cash receipt amount remains unchanged after a discount.
15. Yes accepts adjustment into draft.
16. No preserves the dialog values.
17. Saving posts balanced multi-line journal records.
18. Edit reverses the prior revision correctly.
19. Cancellation releases allocations.
20. No duplicate receipt or allocation.
21. Cross-company and cross-FY access is rejected.
22. Locked FY rejects writes.
23. Desktop 1440x900 works.
24. Mobile 390x844 remains usable.
25. No page errors or failed API requests.

Run all existing regression suites:

- Phase 12.
- Phase 13.
- Phase 14.
- Phase 15.
- Phase 15.1.
- Phase 15.2.
- Phase 16.
- Phase 17.
- Phase 18.

Do not weaken existing assertions to achieve passing tests.

# 19. SCOPE RESTRICTIONS

This is a targeted Phase 18 corrective enhancement.

Do not rebuild Bank Receipt.

Do not rebuild Bank Payment.

Do not rebuild Bank Reconciliation.

Do not redesign Bank Book or Account Ledger.

Do not create fake Sales Invoice records.

Do not introduce unrelated masters.

Do not modify historical migrations.

Use an additive migration only if absolutely necessary.

Do not reset PostgreSQL.

Do not delete existing user data.

Do not commit or push.

Preserve existing uncommitted work.

# 20. FINAL IMPLEMENTATION REPORT

Report:

1. Root causes found.
2. Main Bank Receipt UI corrections.
3. Adjustment dropdown corrections.
4. Row-specific allocation state fixes.
5. Outstanding popup redesign.
6. Cheque Balance calculation.
7. CurRec and Balance calculation.
8. J.V Req checkbox behaviour.
9. Journal Voucher Auto changes.
10. Discount settlement calculation.
11. Bill source types supported.
12. Remaining unsupported sources.
13. Files modified.
14. Database changes, if any.
15. Backend TypeScript result.
16. Frontend build result.
17. Phase 18.1 test results.
18. Phase 12–18 regression results.
19. Browser verification.
20. Remaining limitations.

Do not claim a feature works unless it has been tested.

Stop after the final report for manual review.

---

# FINAL INSTRUCTION

Fix the current SHIVAM ENTERPRISE Bank Receipt Entry workflow so it behaves like the Chandni reference.

The highest priorities are:

1. Correct Against Bill interaction.
2. Remove confusing validation behaviour without hiding real errors.
3. Keep allocations independent for every receipt row.
4. Reproduce the Outstanding Adjustment popup layout.
5. Correctly handle CurRec, PreRec and remaining Balance.
6. Implement the J.V Req checkbox workflow.
7. Make the ₹703 discount example work correctly.
8. Preserve the real ₹18,000 bank receipt.
9. Ensure all saved accounting entries remain balanced.

Do not just make the screen look similar. Make the complete allocation and adjustment workflow function correctly.