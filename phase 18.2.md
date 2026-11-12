# PHASE 18.2 — FIX JOURNAL VOUCHER AUTO BILL BALANCE & DESCRIPTION

## STRICT SCOPE

Fix only these two problems in the existing Bank Receipt Entry workflow:

1. Add/Less adjustment is entered, but Bill Balance does not recalculate correctly.
2. Description must automatically show the actual allocated bill number after successful confirmation and allocation.

Do not analyse or modify unrelated modules.

## 1. FIX BILL BALANCE CALCULATION

### Current problem

In Journal Voucher Auto, the following values are displayed:

```text
Bill Amount       : ₹32,550.00
Bill Balance      : ₹14,550.00
Cheque Balance    : ₹0.00
Cur Received      : ₹18,000.00

Adjustment Account: OT-CASH-DISC
Type              : Amt
Add/Less          : ₹14,550.00
Dr/Cr             : Dr
```

The Journal Voucher Auto preview already shows:

```text
DR  OT-CASH-DISC                 ₹14,550
CR  Rajkot Cotton Traders        ₹14,550

Total Debit                      ₹14,550
Total Credit                     ₹14,550
Status                           BALANCED
```

However, the Bill Balance header still displays ₹14,550 instead of ₹0 after the adjustment amount has been entered.

### Expected calculation

```text
Original Bill Amount             ₹32,550
Previous Receipts                     ₹0
Current Cash Receipt             ₹18,000
Remaining Before Adjustment      ₹14,550
Approved Discount Adjustment     ₹14,550
Remaining Bill Balance                ₹0
```

Formula:

`Remaining Bill Balance = Bill Amount - Bill TDS - Previous Allocations - Current Cash Allocation - Approved Settlement Adjustments`

Use the actual Dr/Cr and adjustment-account rules to determine whether an adjustment reduces or increases the party's outstanding balance.

Do not blindly subtract every Add/Less value. Only adjustments that genuinely settle the selected bill should affect its outstanding balance.

### Required live behaviour

When the user enters or changes the Add/Less amount:

1. Recalculate the Journal Voucher Auto header.
2. Update Bill Balance immediately.
3. Update the displayed current settlement amount.
4. Update the debit/credit preview.
5. Validate that the adjustment does not exceed the eligible remaining bill balance unless an existing supported rule permits it.

For the example above, the expected preview is:

```text
Bill Amount       : ₹32,550.00
Bill Balance      : ₹0.00
Cheque Balance    : ₹0.00
Cur Received      : ₹32,550.00
```

Keep these two values separate:

- Actual cash received: ₹18,000.
- Total bill settlement: ₹32,550.

**Never increase the actual bank receipt amount because of a discount adjustment.**

## 2. CONFIRM NEW — SAVE THE ADJUSTMENT INTO THE CURRENT DRAFT

When the user clicks Confirm New and selects (+) Yes:

- Validate the adjustment account.
- Validate the Add/Less amount.
- Validate Dr/Cr direction.
- Validate the journal preview is balanced.
- Attach the adjustment to the exact selected PurchaseBill allocation using its actual `purchaseBillId`.
- Preserve the current receipt row ID.
- Preserve the actual cash allocation.
- Return the accepted adjustment to Outstanding Adjustment.
- Recalculate the bill's remaining balance.
- Do not independently post JournalLine records when closing the popup.

The adjustment must remain part of the unsaved Bank Receipt draft until the main Bank Receipt is saved.

When the main receipt is saved, the complete accounting transaction and bill allocation must persist atomically using the existing Phase 18 accounting architecture.

## 3. OUTSTANDING ADJUSTMENT — EXPECTED RESULT

After confirming the ₹14,550 discount adjustment:

```text
Bill Amt       ₹32,550.00
Bill Tds            ₹0.00
PreRec              ₹0.00
Cash Allocation ₹18,000.00
JV Adjustment  ₹14,550.00
Balance              ₹0.00
```

The bill should be considered settled and must not continue appearing as outstanding.

Do not save an incorrect balance merely because the Journal Voucher Auto popup was closed.

Ensure the accepted adjustment is included exactly once.

## 4. AUTOMATIC DESCRIPTION FIELD

After the user successfully confirms the adjustment and applies the Outstanding Adjustment, update the Description field of the exact same receipt row.

Example:

```text
Allocated Bill: PB-OT-003

Description:
Bill No: PB-OT-003
```

For multiple allocated bills:

```text
Description:
Bill No: PB-OT-003, PB-OT-004
```

Requirements:

- Use actual bill numbers from the selected allocation records.
- Do not hardcode Bill No: 1.
- Update only the receipt row that initiated the allocation.
- Do not modify other receipt rows.
- Do not include bills that were displayed but never allocated.
- Do not auto-fill before a successful allocation.
- Preserve a manually entered Description.
- Update a system-generated Description when allocations change.
- Clear the generated Description if all allocations are removed, but never erase manually entered text.

Persist the generated Description in the actual receipt detail record when the main voucher is saved.

It must remain correct when the saved Bank Receipt is reopened.

## 5. CRITICAL ROW-SPECIFIC PROTECTION

Use the existing stable receipt row key and exact bill allocation ID.

Do not use a globally active row or Party ID alone.

Example:

```text
Receipt Row 1
  Party: Rajkot Cotton Traders
  Cash: ₹18,000
  Bill: PB-OT-003
  Discount: ₹14,550
  Bill Balance: ₹0
  Description: Bill No: PB-OT-003

Receipt Row 2
  Party: Mumbai Fashions Pvt Ltd
  Its own independent allocation
  Its own description
```

Changing one row must never modify another row's allocation, adjustment or Description.

## 6. STRICT FILE SCOPE

Inspect and modify only the code directly responsible for these two issues.

Likely files:

Frontend:
- `JournalVoucherAutoDialog.tsx`
- `OutstandingAdjustmentDialog.tsx`
- `ChequeReceiptEntryPage.tsx`
- Relevant receipt allocation types.

Backend, only when required:
- `bankReceiptService.ts`
- `bankReceiptRepository.ts`

Do not scan the entire repository.

Do not redesign the Bank Receipt interface.

Do not change Bank Payment.

Do not change Bank Reconciliation.

Do not change Bank Book or Account Ledger.

Do not change unrelated accounting modules.

Do not introduce another accounting engine.

Do not add a migration unless absolutely necessary.

## 7. REQUIRED TEST CASES

Use isolated test data.

### Test A — ₹14,550 discount settlement

```text
Bill Amount:       ₹32,550
Cash Receipt:      ₹18,000
Discount:          ₹14,550
Expected Balance:       ₹0
```

Verify the balance updates immediately after the adjustment is entered.

### Test B — Different adjustment amount

```text
Bill Amount:       ₹32,550
Cash Receipt:      ₹18,000
Discount:           ₹5,000
Expected Balance:   ₹9,550
```

### Test C — No adjustment

```text
Bill Amount:       ₹32,550
Cash Receipt:      ₹18,000
Discount:               ₹0
Expected Balance:  ₹14,550
```

### Test D — Description

- One bill allocation generates the correct bill number.
- Multiple allocations generate all allocated bill numbers.
- Unallocated bills are excluded.
- Manual Description is preserved.
- Removing allocations clears only system-generated text.
- Save and reopen preserves the Description.

### Test E — Accounting

- Actual bank debit remains ₹18,000.
- Party settlement is ₹32,550.
- Discount ledger receives its correct ₹14,550 debit.
- Total debit equals total credit.
- The discount is posted exactly once.
- The outstanding bill closes at ₹0.

Run only the directly relevant Phase 18 and Phase 18.1 tests, plus the required TypeScript/build checks.

## 8. FINAL ACCEPTANCE CRITERIA

The task is complete only when:

1. Entering ₹14,550 in Add/Less immediately updates Bill Balance to ₹0 in the Journal Voucher Auto preview.
2. Confirm New → (+) Yes preserves the accepted adjustment.
3. Returning to Outstanding Adjustment shows Bill Balance ₹0.
4. Apply Allocation updates the same receipt row.
5. Description automatically displays the actual bill number.
6. Actual bank receipt remains ₹18,000.
7. Saving produces balanced accounting entries.
8. Reopening the voucher preserves the allocation and Description.

Report the root cause, exact files changed, focused test results and browser verification.

Do not claim success without testing the actual browser workflow.

Do not commit or push.

Stop after this specific fix for manual review.

---

**FINAL INSTRUCTION: Fix only the ₹14,550 Bill Balance recalculation issue and the bill-number Description update. Do not touch any other feature or module.**