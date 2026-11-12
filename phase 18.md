# PHASE 18 — BANK RECEIPT ENTRY (CHEQUE RECEIPT)
## Complete Full-Stack Implementation Prompt
### SHIVAM ENTERPRISE — Chandni Software-Inspired Accounting ERP

**Project:** SHIVAM ENTERPRISE Business Management System  
**Feature:** Bank Receipt Entry / Cheque Receipt  
**Phase:** 18  
**Reference Software:** Chandni Weaving Software  
**Frontend:** React + TypeScript + Vite  
**Backend:** Node.js + Express + TypeScript  
**Database:** PostgreSQL 18  
**ORM:** Prisma

---

# 1. MAIN OBJECTIVE

Implement a complete Bank Receipt Entry module in the existing SHIVAM ENTERPRISE BMS.

The module must reproduce the business workflow demonstrated in the 12 supplied Chandni Software screenshots.

This is a cheque/bank receipt entry workflow in which:

- The user selects a Bank Receipt Book.
- The software generates a receipt voucher number.
- The selected bank account is displayed.
- The user enters one or more receipt rows.
- Each receipt row can belong to a different customer, supplier or eligible ledger party.
- The user enters the bank name, cheque/reference number, description and amount.
- The user chooses an Adjustment option.
- The user can allocate the received amount against real outstanding bills.
- The user can optionally create additional accounting adjustments through Journal Voucher Auto.
- The user saves the complete Bank Receipt voucher.

The finished feature must be real and fully integrated with:

- Existing Party Master.
- Existing Ledger Account Master.
- Existing Bank Receipt functionality.
- Existing Bank Payment functionality.
- Existing BankVoucher accounting models.
- Existing JournalLine accounting architecture.
- Existing bill records and outstanding calculations.
- Existing Bank Book.
- Existing Account Ledger.
- Existing Bank Reconciliation.
- Existing voucher numbering.
- Existing PDF/print infrastructure.

**IMPORTANT: This is not a UI-only implementation.**

Build the frontend, backend, database relationships, outstanding allocation, accounting posting and testing.

# 2. FIRST INSPECT THE EXISTING PROJECT

Before making changes, inspect the latest repository.

Do not assume previous implementation reports describe the current code perfectly.

Inspect:

## Backend

- `schema.prisma`
- BankVoucher model.
- JournalLine model.
- VoucherSequence model.
- LedgerAccount model.
- Party model.
- Bank Receipt service and repository.
- Bank Payment service and repository.
- Voucher posting and reversal utilities.
- Account/party balance utilities.
- PurchaseBill and PurchaseBillItem.
- DebitNote and DebitNoteLine.
- DebitNoteBillLine.
- Existing payment allocation or outstanding models, if any.
- Existing PDF generation utilities.
- Existing print templates.
- Existing company/FY middleware.

## Frontend

- Existing Bank Receipt entry page.
- Bank Receipt register.
- Bank Receipt detail page.
- Bank Receipt print page.
- Bank Payment entry page.
- Party lookup components.
- Ledger Account lookup components.
- Existing bank selection controls.
- Existing transaction grid components.
- Existing voucher keyboard shortcut handling.
- Existing API services and types.
- Existing navigation/menu configuration.

## Current Phase 12 architecture

The application already contains a basic double-entry Bank Receipt and Bank Payment implementation.

The current accounting design must be preserved.

The new Bank Receipt interface requires multiple receipt rows under one voucher. Inspect whether the existing BankVoucher implementation supports multiple counterparties.

If it currently supports only one receiving party and two JournalLine records, extend the architecture safely to support multiple receipt detail rows and their balanced accounting postings.

Do not bypass the existing accounting system.

Do not create a duplicate receipt transaction model that makes the same transaction appear twice in Bank Book or Account Ledger.

# 3. NAVIGATION

Reproduce this reference navigation:

```text
TRANSACTION
   |
   └── 4. BANK SLIP / RECEIPT
           |
           ├── 1. CHEQUE RECEIPT
           ├── 2. RETURN CHEQUE
           └── 3. REPORTS
```

Implement the Cheque Receipt entry in this task.

Preserve Return Cheque functionality if it already exists. Do not implement a separate Return Cheque module in this phase unless it is already available.

The Reports entry should link to the existing compatible Bank Receipt register/report functionality. Do not create a dead menu item.

Suggested route:

`/transactions/bank-receipts/cheque-entry`

Adapt it to existing route conventions.

If the current Bank Receipt dashboard shortcut already exists, preserve its compatibility.

Do not accidentally remove or break the Phase 12 Bank Receipt route.

# 4. BANK RECEIPT BOOK SELECTION SCREEN

The second screenshot shows the initial screen titled:

**Bank Receipt Books**

Before creating a voucher, the user selects a Bank Receipt Book.

## Layout

Display a compact, centered selection grid.

Columns:

| Column | Description |
|---|---|
| PREFIX | Receipt voucher prefix |
| Book Name | Bank Receipt Book / mapped bank account name |
| Balance | Current actual balance with Dr/Cr nature |

Example shown in the reference:

- Prefix: blank or configured prefix.
- Book Name: STATE BANK OF INDIA.
- Balance: 22,700.00 Cr.

This is illustrative only.

Do not hardcode STATE BANK OF INDIA or the example balance.

## Required behaviour

1. Load actual active Bank Receipt Books.
2. Display the configured prefix.
3. Display the configured book name.
4. Display the linked bank ledger balance.
5. Display correct Dr/Cr nature.
6. Allow keyboard selection.
7. Allow mouse selection.
8. Enter or double-click opens the selected book.
9. Cross-company books must never appear.
10. Inactive books must not appear by default.
11. If no Bank Receipt Book is configured, display a useful empty state with a link to the relevant configuration.

## Important distinction

A Bank Receipt Book and a Bank Ledger may be related but are not automatically the same concept.

Inspect the current schema.

Prefer a reusable existing voucher/book master.

If no suitable Bank Receipt Book structure exists, create the minimum necessary model that maps:

- Receipt book.
- Company.
- Financial year applicability.
- Prefix.
- Linked Bank Ledger Account.
- Active status.
- Voucher sequence.

Do not reuse Production Books or unrelated Bank Payment configuration incorrectly.

Use the actual linked LedgerAccount balance. Never store another editable bank balance.

# 5. BANK RECEIPT ENTRY SCREEN — MAIN HEADER

After selecting the Bank Receipt Book, open the main Bank Receipt entry form.

The reference screen is a full-width, desktop-first accounting voucher form.

Recreate the following header fields.

## A. Voucher No.

Display:

`Voucher No. : [AUTO NUMBER]`

Requirements:

- Automatically generate the next number.
- Use the selected Bank Receipt Book prefix.
- Support company and FY isolation.
- Use concurrency-safe sequence generation.
- Add database uniqueness.
- Never reuse a saved/cancelled voucher number.

Use the existing VoucherSequence architecture where suitable.

Do not generate voucher numbers using a frontend counter.

## B. Date

Display:

`Date : [DATE PICKER]`

Requirements:

- Default to the appropriate current/working date.
- Use the active financial year.
- Validate date boundaries.
- Respect locked financial years.
- Do not use hardcoded reference dates.

## C. Bank A/C No.

Display:

`Bank A/C No. : [BANK ACCOUNT NUMBER]`

Use the actual bank account information linked to the selected book.

If the account number is not configured, leave it blank or display a helpful missing-information state.

Do not invent bank account numbers.

## D. A/C Name

Display:

`A/C Name : [SELECTED BANK NAME]    Balance : [ACTUAL BALANCE]`

Example reference:

`STATE BANK OF INDIA`

Requirements:

- Load the actual linked bank LedgerAccount.
- Show its current signed balance.
- Display Dr/Cr.
- Do not maintain a second editable bank balance.
- Changing the selected book must update the linked bank account information.

## E. Go To Payment

At the top-right of the entry screen, implement:

`Go To Payment`

When clicked:

- Open the existing Bank Payment entry workflow.
- Carry over the selected bank book/account where compatible.
- Preserve the selected company's context and FY.
- Do not create a payment.
- Do not modify the current unsaved receipt automatically.
- Warn about unsaved receipt data before navigation.

# 6. MAIN RECEIPT DETAIL GRID

This is the central part of the screenshot.

Create a full-width editable transaction grid.

The reference contains approximately 30 visible rows numbered 1–30.

Show at least 30 rows in the initial viewport where desktop height permits. Allow scrolling or adding more rows when needed.

Blank rows are only temporary input rows. Never save empty rows as business data.

## Required columns

| Column | Description |
|---|---|
| Sr | Row number |
| Account Name | Customer/Supplier/Party ledger |
| Bank Name | Bank/instrument name or configured code |
| Chq No | Cheque/UTR/reference number |
| Description | Receipt description/narration |
| Amount | Amount received in this row |
| Adjustment | No Adjustment / Against Bill / Skip in O/S |

Preserve these visible labels as closely as practical.

## Grid header details

Display:

- Account Name.
- Bank Name.
- Chq No (Insert Key To Save).
- Description (Insert Key To Save).
- Amount.
- Adjustment.

Maintain compact accounting-grid styling.

Use alternating row backgrounds.

Use clear column borders.

Align numeric amounts to the right.

Highlight the active row.

Support keyboard navigation.

# 7. ACCOUNT NAME — PARTY LOOKUP

When the user types in Account Name, open a searchable lookup popup.

Reproduce the fourth screenshot.

## Popup layout

Title/columns:

| Party | Address | Balance |
|---|---|---:|

The popup should be positioned near the active Account Name cell.

Below the list, display real party information.

Visible detail fields from the reference:

- Mobile.
- GST No.
- Person.
- Broker.
- City.
- Head.
- Collection.
- Sales Man.
- Address.

## Behaviour

1. User starts typing the party name.
2. Search actual Party Master records.
3. Display matching parties.
4. Display actual address.
5. Display actual signed ledger balance.
6. Allow keyboard and mouse selection.
7. On selection, populate the Account Name cell.
8. Display the selected party's details in the footer.

The footer should show:

`Party : [PARTY NAME]`

`[ACTUAL ADDRESS]`

`Balance : [ACTUAL BALANCE + DR/CR]`

Do not hardcode CHANDNI SOFT SERVICES.

Do not fabricate GSTIN, mobile number, address, broker or salesperson.

If optional fields do not exist, display them blank.

Only permit accounts that are valid for a receipt counterparty based on the existing accounting configuration.

# 8. BANK NAME LOOKUP

The fifth screenshot shows a Bank Name popup.

Its visible columns are:

| CODE | DESC |
|---|---|
| BOB | BANK OF BARODA / configured description |
| HDFC | HDFC |
| ICICI | ICICI |
| RTGS | RTGS |
| SUTEX | SUTEX |
| kotak | kotak |

The values above are examples from the screenshot. They are NOT hardcoded master records.

## Required behaviour

When the user focuses the Bank Name cell:

- Open a searchable lookup.
- Show CODE.
- Show DESC.
- Allow keyboard and mouse selection.
- Populate the selected code/description in the row.

Inspect the existing application for a suitable bank-name, bank-code or payment-instrument master.

If a suitable master does not exist, create a minimal company-configurable master, for example:

`BankInstrumentMaster`

Possible fields:

- id
- companyId
- code
- description
- instrumentCategory, if genuinely needed
- isActive
- createdAt
- updatedAt

Use real user-configured records.

Do not seed the screenshot examples into production.

If there is no master data, show a clear empty state and a way to configure it.

Keep the visible field label `Bank Name`.

Do not confuse this field with the selected Bank Receipt Book or bank ledger. It identifies the row's bank/instrument code as represented by the reference.

# 9. CHEQUE NUMBER AND DESCRIPTION INPUT

The screenshot shows:

`Chq No (Insert Key To Save)`

`Description (Insert Key To Save)`

Implement these as editable grid cells.

## Cheque / Reference Number

- Optional or required according to selected bank/instrument type and configuration.
- Preserve leading zeros.
- Do not convert references to numbers.
- Support cheque numbers, UTR references and other configured instrument references.
- Do not generate fake references.

## Description

Allow a short narration/description.

Examples of genuine descriptions could include:

- Bill No: 1.
- Customer receipt.
- Advance receipt.

The description must be user-entered or generated from an actual selected bill allocation.

Do not generate a Bill No unless an actual bill has been allocated.

## Insert / Enter behaviour

The reference says Insert Key To Save.

Implement:

- Insert key: commit the active grid cell/row.
- Enter: commit the current value and move to the next logical cell.
- Tab: move to the next editable field.
- Do not submit the whole voucher when Enter is used inside the grid.
- Validate the row before accepting it.

# 10. ADJUSTMENT DROPDOWN

The sixth screenshot shows exactly these choices:

1. No Adjustment
2. Against Bill
3. Skip in O/S

Use these display labels.

Do not replace them with generic alternatives.

## A. No Adjustment

Meaning:

- Do not allocate this receipt row against a specific invoice.
- Credit the selected Party ledger.
- Keep the amount as an unapplied/on-account receipt.
- Preserve the actual party ledger impact.
- Keep it available in unadjusted-receipt/outstanding reporting according to the project's bill-wise outstanding conventions.

## B. Against Bill

When selected:

- Open the Outstanding Adjustment popup.
- Load genuine eligible outstanding bills for the selected party.
- Allow allocation of the current receipt amount against those bills.
- Recalculate remaining cheque balance.
- Allow optional Journal Voucher Auto adjustments using J.V Req.

## C. Skip in O/S

Interpret this as a receipt that is posted to the actual Party Ledger but is not applied to bill-wise outstanding allocation.

Preserve the actual ledger effect.

Do not silently exclude the receipt from the general ledger.

Maintain an explicit classification flag so outstanding reports can consistently distinguish it.

If the existing BMS already has a different established meaning for Skip in O/S, use the existing meaning and document it.

Never invent a financial side effect for this option.

# 11. OUTSTANDING ADJUSTMENT POPUP

This is a major feature shown in the seventh screenshot.

When the user selects:

`2. Against Bill`

open a popup titled:

**Outstanding Adjustment**

## Popup header

Display:

- Party Name.
- Address.
- Cheque Balance.

Example reference:

`Cheque Balance : 18,000.00`

The amount must be the actual available amount in the currently selected receipt row.

## Grid columns

Recreate these columns:

| Column | Description |
|---|---|
| Type | Original source document type |
| Book | Original bill book |
| Bill No | Original bill number |
| Date | Original bill date |
| Due | Actual configured due value/days |
| Bill Amt | Original bill amount |
| Bill Tds | Actual TDS amount, where supported |
| PreRec | Previously received/allocated amount |
| CurRec | Amount allocated from the current receipt |
| Balance | Remaining amount |
| J.V Req? | Journal Voucher Auto required checkbox |

Preserve the label `J.V Req?`.

## Top summary

Display:

`Party Name : [SELECTED PARTY]`

`Address : [ACTUAL PARTY ADDRESS]`

`Cheque Balance : [CURRENT AVAILABLE RECEIPT AMOUNT]`

## Data requirements

Only show genuine source bills.

For each eligible source bill, retrieve:

- Actual document type.
- Book.
- Bill number.
- Bill date.
- Due days or due value.
- Bill amount.
- TDS amount, if configured.
- Prior payment/receipt allocations.
- Current allocation.
- Current outstanding balance.

The screenshot includes example source type labels such as SAL and BPT.

These codes should come from the actual source transaction adapter and not from hardcoded assumptions.

## Important source-module limitation

Inspect the currently implemented BMS transaction models before exposing source types.

- PurchaseBill exists.
- Sales Orders and Purchase Orders are not invoices.
- Debit Notes are not ordinary invoices.
- Do not treat orders as outstanding bills.
- Do not fabricate Sales Invoice records.
- Only list actual posted bill sources that support valid party settlement.
- If no compatible bill source exists for a selected party, show a genuine empty state.

Do not create a false bill list just to populate the popup.

# 12. OUTSTANDING ALLOCATION CALCULATIONS

Use exact decimal arithmetic.

The meaning of the fields must be:

**Bill Amt:** Original source bill amount.

**Bill Tds:** Actual valid TDS amount applicable to the source bill.

**PreRec:** Sum of all previous valid receipts/payments/adjustments already allocated to this bill, according to its transaction direction.

**CurRec:** Amount being allocated from the current Bank Receipt row.

**Balance:** Remaining amount due after previous and current allocations and applicable posted adjustments.

Conceptually, for a normal receivable bill:

```text
Bill Balance
=
Bill Amount
- Applicable Bill TDS
- Previous Allocations
- Current Receipt Allocation
- Previously Posted Adjustments
```

Use the existing BMS outstanding calculation engine if available.

If a source module has a different valid sign convention, implement its actual correct rule.

Do not apply TDS twice.

Do not count cancelled/reversed allocations.

Do not calculate previous receipts from fake or manually entered values.

## Screenshot calculation example

Use this only as a test fixture:

```text
Bill Amount       = 18,703.00
Bill TDS          = 0.00
Previous Receipt  = 0.00
Current Receipt   = 18,000.00
Remaining Balance = 703.00
```

Expected Cheque Balance after allocating the complete receipt:

```text
18,000.00 - 18,000.00 = 0.00
```

Do not seed these values into live records.

## Allocation constraints

- CurRec cannot exceed the available cheque balance.
- CurRec cannot exceed eligible bill outstanding unless a validated adjustment/overpayment workflow explicitly supports it.
- A bill cannot be allocated twice within the same voucher beyond its remaining outstanding.
- Two concurrent receipts must not over-allocate the same bill.
- Validate allocations again inside the backend transaction during save.
- Update the bill outstanding view immediately from actual saved allocation data.
- Do not modify original invoice amount or invoice date.

## Grid totals

At the bottom, display the actual aggregate values:

- Bill Amt.
- Bill Tds.
- PreRec.
- CurRec.
- Balance.

Use the currently displayed/selected source bill rows.

Do not use the screenshot's example totals as fixed values.

# 13. J.V REQ? — JOURNAL VOUCHER AUTO

This is a separate and important screen shown in screenshots 8, 9, 10 and 11.

When the user checks:

`J.V Req?`

on a bill row, open the Journal Voucher Auto dialog associated with that bill and current receipt.

The selection must be reversible.

## A. Journal Voucher Auto dialog layout

Title:

**Journal Voucher Auto**

Display these bill/receipt summary fields at the top:

| Field | Description |
|---|---|
| Bill Date | Actual selected bill date |
| Bill Amount | Original bill amount |
| Bill Balance | Remaining bill balance |
| Cheque Balance | Remaining amount of the current receipt |
| Cur Received | Current amount allocated to the selected bill |

Use actual selected bill and receipt data.

Do not hardcode the screenshot's values.

## B. Adjustment grid

Recreate these columns:

| Column | Description |
|---|---|
| Account Name | Adjustment ledger account |
| Type | Amount or supported calculation type |
| Int % | Configured interest percentage, where applicable |
| Due | Relevant due value |
| Tds % | Actual/configured TDS percentage, where applicable |
| Add/Less | Adjustment amount |
| Dr/Cr | Debit or Credit |
| Note | Adjustment narration |

The screenshot shows the example account:

`DISCOUNT ON SALE`

with Type:

`Amt`

and a sample entered Add/Less amount:

`70`

with Dr selected.

These are UI examples only.

Never hardcode the account or amount.

## C. Adjustment Ledger lookup

When the user types in Account Name, show a searchable account lookup.

The reference shows a popup with:

- Party.
- Address.
- Party/Account.
- Balance.

Use actual eligible LedgerAccount records and their linked Party details when available.

Reject:

- Inactive accounts.
- Other-company accounts.
- Invalid account groups.
- Bank accounts used incorrectly as discount/adjustment heads.

Use the existing account classification rules.

## D. Amount and calculation types

Support the visible amount-based entry:

`Type = Amt`

Support percentage/interest/TDS calculations only when actual configuration exists and the business formula is established.

Do not invent interest formulas, TDS rates or due-day calculations.

If a calculation cannot be derived from real configuration, require an explicit entered amount.

Show the final amount and Dr/Cr effect transparently.

## E. Journal Voucher Auto accounting

This must be a real accounting adjustment.

It must not simply display a popup and discard its values.

Use the existing accounting posting framework.

The journal adjustments must:

- Reference the selected Bank Receipt.
- Reference the selected receipt detail row.
- Reference the selected bill allocation.
- Use the selected adjustment LedgerAccount.
- Store exact entered values.
- Preserve Dr/Cr.
- Preserve notes.
- Be included in the final voucher's accounting effect.
- Keep the complete posting balanced.

Where a selected adjustment account requires an offset to the Party ledger, create the corresponding counter-entry using the existing accounting rules.

Display a complete Debit/Credit preview before accepting the adjustment.

Reject the auto journal adjustment if it does not balance.

Do not make the bank receipt amount larger or smaller just because a journal adjustment exists.

Do not silently change the received bank amount.

## F. Confirm New dialog

Screenshot 11 shows:

`Confirm New!!`

`Are you sure to close?`

Buttons:

- (+) Yes
- (-) No

Implement the same confirmation behaviour.

Yes:

- Validate the adjustment lines.
- Accept the Journal Voucher Auto details into the current unsaved Bank Receipt draft.
- Return to Outstanding Adjustment.
- Recalculate bill allocation balances.
- Preserve the J.V Req state.

No:

- Return to the Journal Voucher Auto dialog.
- Preserve the user's entered values.

Closing the dialog must not post accounting entries independently.

The actual financial posting must occur atomically when the main Bank Receipt voucher is saved.

## G. Return to the receipt grid

After accepting the adjustment and returning through the dialogs:

- Preserve the selected Party.
- Preserve Bank Name.
- Preserve Cheque Number.
- Preserve Amount.
- Preserve Adjustment mode.
- Display the selected bill reference in Description.

Example:

`Bill No: 1`

Only show the actual bill number when a bill was genuinely allocated.

# 14. MAIN RECEIPT FOOTER

The reference shows:

`Party : [SELECTED PARTY]`

`Balance : [ACTUAL LEDGER BALANCE]`

And a blue total near the right side.

Implement:

- Currently focused/selected party name.
- Actual party address.
- Current party balance and Dr/Cr.
- Total amount of all receipt rows.

The total must update as the user enters, changes or removes amounts.

Do not confuse:

- Current row receipt amount.
- Total voucher receipt amount.
- Current party outstanding.
- Bank account balance.

Keep these values distinct.

# 15. SAVE, CLEAR AND NAVIGATION BUTTONS

Reproduce the bottom toolbar:

```text
1 - Save
2 - Clear
3 - Go Back
4 - Print
5 - Exit
7 - Previous
8 - Next
9 - Pmt.Advice
```

Keep the action labels visible.

## Save

On Save:

1. Validate voucher header.
2. Validate selected Bank Receipt Book.
3. Validate all non-empty rows.
4. Validate selected parties.
5. Validate Bank Name codes.
6. Validate cheque/reference fields according to instrument configuration.
7. Validate positive amounts.
8. Validate adjustment mode.
9. Validate outstanding allocations.
10. Validate journal adjustment entries.
11. Verify total bank receipt amount.
12. Verify company/FY context.
13. Verify current account/party balances as required.
14. Ensure the journal posting balances.
15. Save the voucher and all detail records atomically.

Prevent duplicate submission.

Do not save empty rows.

## Clear

Clear unsaved form values after appropriate confirmation.

Do not delete a previously saved voucher.

## Go Back

Navigate back to Bank Receipt Book selection after checking for unsaved changes.

## Print

Print the actual saved Bank Receipt voucher using the current BMS voucher print system.

Use actual:

- Company details.
- Bank details.
- Voucher number.
- Voucher date.
- Party details.
- Cheque/reference numbers.
- Amounts.
- Bill allocations.
- Narration.

Do not create a fake print document.

## Exit

Exit the voucher page safely.

## Previous / Next

Navigate through actual saved Bank Receipt vouchers within the selected book, company and FY.

## Pmt.Advice

Preserve the visible `9 - Pmt.Advice` action.

Inspect existing code and the reference workflow.

Provide a real advice/receipt allocation document using the saved receipt and bill allocation data if the feature semantics support it.

Do not claim to send a payment or WhatsApp message unless a real sending mechanism exists.

If the intended reference behaviour cannot be established, document it clearly instead of inventing an action.

# 16. VOUCHER EDITING AND CANCELLATION

Reuse existing Phase 12 voucher lifecycle.

Editing:

- Use a controlled edit mechanism.
- Reverse previous journal lines using the existing append-only reversal pattern.
- Append the corrected journal posting.
- Preserve bill allocation history.
- Correct the active allocation view atomically.
- Do not stack the original and corrected accounting impact.

Cancellation:

- Require a cancellation reason.
- Reverse the complete multi-line voucher posting.
- Reverse/remove active bill allocations safely while retaining audit history.
- Preserve cheque/reference information.
- Preserve original voucher details.
- Prevent duplicate cancellation.
- Do not physically delete financial history.

The voucher number must not be reused.

Locked financial years must reject edits and cancellation according to current BMS rules.

# 17. ACCOUNTING POSTING ARCHITECTURE

This is the most important technical section.

Reuse Phase 12 double-entry accounting.

For a normal Bank Receipt:

```text
DR  Selected Bank Ledger
CR  Party Ledger
```

For multiple receipt rows:

```text
BANK LEDGER (DR)
    = SUM of all valid receipt row amounts

PARTY LEDGER (CR)
    = Each actual receipt row amount
```

Example:

```text
Receipt Row 1:
Party A = ₹10,000

Receipt Row 2:
Party B = ₹5,000

Receipt Row 3:
Party C = ₹3,000

TOTAL BANK RECEIPT = ₹18,000
```

Expected accounting structure:

```text
DR  Selected Bank Ledger       ₹18,000

CR  Party A Ledger             ₹10,000
CR  Party B Ledger              ₹5,000
CR  Party C Ledger              ₹3,000

TOTAL DEBIT = TOTAL CREDIT     ₹18,000
```

This is an isolated illustration, not data to seed.

## Multi-line posting requirement

The current Phase 12 architecture may assume exactly two JournalLine entries for a BankVoucher revision.

This new workflow requires multiple party lines, and optional additional adjustment lines.

Extend the posting architecture safely so one receipt voucher can contain:

- One bank debit for the total receipt amount.
- Multiple party credit lines.
- Any configured balanced journal adjustment lines.

Do not create one unrelated voucher per grid row just to bypass multi-line support.

The user expects one voucher number for the complete grid.

Use Prisma.Decimal.

Use an atomic database transaction.

Ensure the voucher is visible in:

- Existing Bank Receipt register.
- Bank Book.
- Account Ledger.
- Bank Reconciliation.
- Relevant outstanding reports.

Do not duplicate the same Bank Receipt in two source systems.

## Reversal architecture

For edits:

- Reverse every active journal line in the prior revision.
- Append all corrected journal lines under the new revision.
- Keep old lines immutable.

For cancellation:

- Append reversal lines for every active line.
- Preserve the original voucher and audit information.

Every revision must balance:

`Total Debit = Total Credit`

Do not update/delete old JournalLine records.

# 18. BILL-WISE OUTSTANDING DATA ARCHITECTURE

Inspect existing bill-wise outstanding functionality before adding new tables.

Phase 12 originally supported on-account receipt/payment behaviour, so bill allocation may need new persistence.

If there is no suitable existing model, add the minimum required structure.

Possible models:

### BankVoucherLine

Fields may include:

- id
- bankVoucherId
- partyId
- partyLedgerAccountId
- bankInstrumentMasterId or bankNameCode
- chequeNumber
- description
- amount
- adjustmentMode
- rowNumber
- createdAt
- updatedAt

### BankReceiptBillAllocation

Fields may include:

- id
- bankVoucherLineId
- sourceDocumentType
- sourceDocumentId or explicit source relation
- sourceDocumentNumber
- allocatedAmount
- allocationStatus
- createdAt
- updatedAt

### BankReceiptAdjustmentLine

Fields may include:

- id
- bankVoucherLineId
- allocationId, where appropriate
- adjustmentLedgerAccountId
- calculationType
- interestPercent
- dueValue
- tdsPercent
- adjustmentAmount
- drCr
- note

These are suggested structures, not a requirement to copy blindly.

Use the existing source-bill relations where available.

Prefer real foreign keys for supported bill sources.

Do not create fragile references that silently point to nonexistent records.

## Concurrency

Bill allocation must be protected against concurrent over-allocation.

On save:

- Re-read current source outstanding inside the transaction.
- Recalculate available balance.
- Verify current allocations.
- Reject allocations exceeding available bill balances.
- Use appropriate locks or serializable transaction strategy where needed.
- Prevent duplicate allocation of the same amount.

Do not trust the amount displayed in an old browser popup as the final outstanding value.

# 19. BANK RECEIPT REGISTER INTEGRATION

The saved voucher must appear in the existing Bank Receipt register.

Display:

- Voucher No.
- Date.
- Bank Book.
- Total Amount.
- Number of Receipt Rows.
- Status.
- Actions.

Actions:

- View.
- Edit.
- Print.
- Cancel.

Opening View should show the complete receipt grid and any outstanding allocations.

Do not display only the first party of a multi-party receipt.

# 20. API IMPLEMENTATION

Follow the existing architecture:

Routes → Controllers → Services → Repositories → Prisma.

Suggested endpoints:

## Bank Receipt Books

- `GET /api/bank-receipt-books`
- `GET /api/bank-receipt-books/:id`

Add CRUD only if the required book master does not exist.

## Bank Name / Instrument lookup

- `GET /api/bank-instruments`

## Bank Receipt

- `GET /api/bank-receipts`
- `GET /api/bank-receipts/next-number`
- `GET /api/bank-receipts/:id`
- `POST /api/bank-receipts`
- `PUT /api/bank-receipts/:id`
- `POST /api/bank-receipts/:id/cancel`

## Party lookup

- `GET /api/bank-receipts/lookups/parties`

## Outstanding Bills

- `GET /api/bank-receipts/outstanding-bills`
- `POST /api/bank-receipts/validate-allocation`

## Adjustment Ledger lookup

- `GET /api/bank-receipts/lookups/adjustment-accounts`

## Journal Voucher Auto

- `POST /api/bank-receipts/validate-adjustment`
- `POST /api/bank-receipts/adjustment-preview`

Use appropriate request schemas.

Do not trust companyId or financialYearId from frontend request bodies.

Read validated tenant context from existing middleware.

The front end should send only the necessary identifiers and entered values.

# 21. UI AND INTERACTION DETAILS

Recreate the visual hierarchy shown in the reference.

## Header

```text
--------------------------------------------------------------
| Bank Receipt > [Selected Bank Account]                     |
--------------------------------------------------------------
| Voucher No : [AUTO]                                         |
| Date       : [DATE]                                         |
| Bank A/C No: [ACTUAL ACCOUNT NUMBER]                        |
| A/C Name   : [BANK NAME]   Balance: [SIGNED BALANCE]        |
|                                      [Go To Payment]        |
--------------------------------------------------------------
```

## Receipt grid

```text
--------------------------------------------------------------------------------
| Sr | Account Name | Bank Name | Chq No | Description | Amount | Adjustment  |
--------------------------------------------------------------------------------
| 1  | [Party]      | [Code]    | [Ref]  | [Text]      | [Amt]  | [Dropdown]  |
| 2  | [Party]      | [Code]    | [Ref]  | [Text]      | [Amt]  | [Dropdown]  |
| 3  |              |           |        |             |        |             |
| 4  |              |           |        |             |        |             |
--------------------------------------------------------------------------------
```

Use a practical desktop ERP style.

- Wide grid.
- Compact rows.
- Scrollable table.
- Fixed footer.
- Searchable popups.
- Keyboard-first data entry.
- Clear active-cell focus.
- Avoid oversized dashboard cards.

## Footer

```text
Party   : [SELECTED PARTY]
Address : [ACTUAL ADDRESS]
Balance : [CURRENT PARTY BALANCE]

                                     TOTAL: ₹[RECEIPT TOTAL]

---------------------------------------------------------------------------
| 1 Save | 2 Clear | 3 Go Back | 4 Print | 5 Exit | 7 Previous | 8 Next  |
| 9 Pmt.Advice                                                            |
---------------------------------------------------------------------------
```

## Responsive design

Desktop is the priority because this is a high-volume accounting entry screen.

For mobile:

- Keep the voucher header readable.
- Allow grid horizontal scrolling within its own container.
- Keep Save accessible.
- Ensure popups fit the viewport.
- Avoid page-level horizontal overflow.

Do not shrink all grid fields into unreadable narrow columns.

# 22. KEYBOARD SHORTCUTS

Implement safe page-scoped shortcuts.

- `F10` / `1`: Save.
- `2`: Clear after safe confirmation.
- `3`: Go Back.
- `4`: Print.
- `5`: Exit.
- `7`: Previous.
- `8`: Next.
- `9`: Payment Advice.
- `Enter`: Accept lookup or commit the active grid cell where appropriate.
- `Insert`: Commit the active cheque number/description cell.
- `Arrow Up/Down`: Move between grid rows.
- `Escape`: Close active popup or return safely.
- `Ctrl+L`: Party/account lookup if this shortcut does not conflict with an existing BMS convention.

The screenshot shows the shortcut labels. Preserve equivalent visible actions.

Do not let Enter submit the whole voucher while the user is editing a grid field.

Do not let shortcuts trigger while the user types into an unrelated text input.

# 23. VALIDATION AND ACCOUNTING SAFETY

Mandatory rules:

1. Valid selected Bank Receipt Book.
2. Selected bank ledger belongs to active company.
3. Valid voucher number.
4. Date inside permitted FY.
5. At least one complete receipt detail row.
6. Selected party must be valid.
7. Selected bank code must exist and be active.
8. Cheque/reference number must follow the configured instrument requirement.
9. Receipt amount must be positive.
10. Adjustment mode must be valid.
11. Bill allocation must be valid and unique.
12. CurRec cannot exceed available receipt amount.
13. No allocation can exceed the current real outstanding balance unless a valid configured adjustment permits it.
14. Auto journal adjustment must balance.
15. Total bank debit must equal all party and adjustment credits/debits.
16. No inactive or cross-company ledger.
17. No duplicate voucher submission.
18. No saving empty grid rows.
19. No settlement against cancelled source invoices.
20. No order treated as an invoice.
21. No fake bill, payment, bank code or party information.
22. Correct Dr/Cr accounting direction.
23. All data saved atomically.
24. No partial save if bill allocations or journal adjustments fail.

Do not automatically force balances to zero.

Do not silently adjust the party's outstanding.

Do not allow an unbalanced voucher.

# 24. TRANSACTION AND JOURNAL INTEGRITY

The following must all be inside one atomic transaction:

- BankVoucher header.
- BankVoucherLine rows.
- Bill allocation rows.
- Journal Voucher Auto adjustment rows.
- JournalLine posting.
- Voucher revision.
- Audit history.

If any part fails:

- Roll back all related writes.
- Preserve the previous saved voucher.
- Return a clear validation error.

Do not allow a receipt voucher to save while its corresponding allocations are partially saved.

Do not create an independent journal adjustment that is not linked to the receipt.

# 25. TESTING REQUIREMENTS

Create a dedicated Phase 18 test suite.

## A. Navigation and Book Selection

- Cheque Receipt menu opens.
- Bank Receipt Book selector loads.
- Correct prefix.
- Correct bank name.
- Correct current balance.
- Multiple books.
- Keyboard selection.
- Empty state.
- Cross-company books rejected.

## B. Voucher Header

- Auto voucher number.
- Date selection.
- Active FY validation.
- Bank Account No.
- Bank Account name.
- Signed balance.
- Go To Payment navigation.

## C. Party Lookup

- Search by party name.
- Actual address.
- Actual balance.
- GSTIN.
- Optional party details.
- Select and populate.
- Invalid party rejected.

## D. Bank Name Lookup

- Real configured codes.
- CODE/DESC columns.
- Search.
- Selection.
- Inactive code rejection.
- Empty master state.

## E. Receipt Grid

- 30 initial visible rows.
- Add additional rows.
- Delete unsaved row.
- Enter navigation.
- Insert key commits.
- Multiple parties.
- Different bank name codes.
- Cheque/reference values preserve leading zeros.
- Description saved correctly.
- Correct amount total.
- Empty rows are not persisted.

## F. Adjustment Modes

**No Adjustment**
- Actual party credit.
- No bill allocation.
- Correct on-account outstanding classification.

**Against Bill**
- Real outstanding bills load.
- Bill details correct.
- Previous receipts correct.
- Current allocation correct.
- Balance correct.
- Cheque balance updates.
- Multiple bills supported.
- Over-allocation rejected.
- Concurrent allocation rejected.

**Skip in O/S**
- Actual party ledger posting.
- Correct bill-wise outstanding classification.
- No fake or omitted ledger entry.

## G. Journal Voucher Auto

- J.V Req checkbox opens dialog.
- Actual bill information.
- Correct cheque balance.
- Correct current received.
- Search real adjustment ledger.
- Amount entry.
- Dr/Cr handling.
- Add/Less handling.
- TDS/interest only when supported.
- Correct preview.
- Valid confirmation.
- No confirmation returns to editing.
- J.V adjustment remains linked to the receipt.
- Unbalanced entries rejected.

## H. Save and Reversal

- One voucher with multiple parties.
- One selected bank book.
- Correct bank debit total.
- Correct party credits.
- Balanced journal.
- Correct allocations.
- No duplicate voucher.
- Edit reverses previous revision.
- Cancellation reverses the entire voucher.
- No hard delete.
- Voucher history retained.

## I. Downstream Integration

Verify saved receipt appears correctly in:

- Bank Receipt register.
- Bank Book.
- Account Ledger.
- Party Ledger.
- Outstanding reports.
- Bank Reconciliation.
- Print output.

Ensure the transaction appears once, not twice.

## J. Regression Tests

Run:

- Phase 12.
- Phase 13.
- Phase 14.
- Phase 15.
- Phase 15.1.
- Phase 15.2.
- Phase 16.
- Phase 17.

Also re-test existing Bank Payment and basic Bank Receipt entry functionality.

Do not weaken earlier test assertions.

Use isolated test fixtures.

Remove fixtures after testing.

Never insert sample data into a live company.

# 26. PERFORMANCE REQUIREMENTS

- Search parties on the backend.
- Search bank codes efficiently.
- Load outstanding bills using server-side filters.
- Avoid N+1 queries.
- Use Prisma select/include carefully.
- Use Decimal arithmetic.
- Avoid loading every invoice of every party.
- Revalidate outstanding values inside the save transaction.
- Keep UI responsive during lookups.
- Prevent duplicate requests from keyboard interactions.
- Preserve data when an API request fails.

# 27. IMPLEMENTATION PRIORITY

Work in this order:

1. Inspect current Phase 12 architecture.
2. Design compatible multi-line Bank Receipt structure.
3. Create additive database migration if required.
4. Implement Bank Receipt Book selection.
5. Implement voucher header.
6. Implement editable receipt grid.
7. Implement party lookup.
8. Implement Bank Name lookup.
9. Implement Adjustment dropdown.
10. Implement real bill-wise allocation.
11. Implement J.V Req and Journal Voucher Auto.
12. Implement balanced multi-line accounting posting.
13. Implement Save/Edit/Cancel.
14. Integrate register, Bank Book, Account Ledger and Bank Reconciliation.
15. Implement Print and Payment Advice where supported.
16. Run automated tests.
17. Run browser verification.
18. Run all regressions.

Do not spend time refactoring unrelated modules.

# 28. STRICT SCOPE PROTECTION

This task is Bank Receipt Entry / Cheque Receipt only.

Do not implement:

- Return Cheque.
- A new Bank Payment engine.
- General Purchase.
- Credit Note.
- Sales Invoice.
- Bank Reconciliation redesign.
- Account Ledger redesign.
- New reporting modules.
- Unrelated master redesign.

Do not remove existing Phase 12 Bank Receipt routes or functionality.

Do not modify existing historical migrations.

Do not reset PostgreSQL.

Do not delete any user's existing data.

Do not commit or push.

# 29. FINAL ACCEPTANCE WORKFLOW

The following complete user workflow must work:

```text
TRANSACTION
    |
    v
BANK SLIP / RECEIPT
    |
    v
CHEQUE RECEIPT
    |
    v
BANK RECEIPT BOOK SELECTOR
    |
    v
SELECT BANK RECEIPT BOOK
    |
    v
BANK RECEIPT VOUCHER OPENS
    |
    +-- Auto Voucher Number
    +-- Date
    +-- Bank Account Number
    +-- Bank Account Name
    +-- Current Balance
    |
    v
ENTER RECEIPT DETAIL ROW
    |
    +-- Select Account Name
    |       |
    |       v
    |   PARTY LOOKUP
    |       |
    |       v
    |   Select Real Party
    |
    +-- Select Bank Name
    |       |
    |       v
    |   CODE / DESC LOOKUP
    |
    +-- Enter Cheque Number
    |
    +-- Enter Description
    |
    +-- Enter Amount
    |
    v
SELECT ADJUSTMENT
    |
    +-- NO ADJUSTMENT
    |       |
    |       v
    |   On-account receipt
    |
    +-- AGAINST BILL
    |       |
    |       v
    |   OUTSTANDING ADJUSTMENT
    |       |
    |       +-- Select real bills
    |       +-- Enter CurRec
    |       +-- Recalculate Balance
    |       +-- Update Cheque Balance
    |       +-- Optional J.V Req?
    |                |
    |                v
    |          JOURNAL VOUCHER AUTO
    |                |
    |                +-- Select adjustment account
    |                +-- Enter amount/type
    |                +-- Select Dr/Cr
    |                +-- Add/Less
    |                +-- Preview accounting
    |                +-- Confirm Yes/No
    |
    +-- SKIP IN O/S
            |
            v
        Post without bill-wise allocation
    |
    v
RETURN TO MAIN RECEIPT GRID
    |
    v
ADD MORE RECEIPT ROWS IF REQUIRED
    |
    v
VERIFY TOTAL RECEIPT AMOUNT
    |
    v
SAVE
    |
    v
POST BALANCED JOURNAL ENTRIES
    |
    v
UPDATE BILL ALLOCATION HISTORY
    |
    v
VOUCHER SAVED
    |
    +-- Print
    +-- Previous
    +-- Next
    +-- Payment Advice
    +-- Exit
```

# 30. FINAL IMPLEMENTATION REPORT

After completing the work, report:

1. Phase 18 implementation summary.
2. Navigation path.
3. Bank Receipt Book selection.
4. Voucher header.
5. Multi-row receipt grid.
6. Party lookup.
7. Bank Name lookup.
8. Adjustment options.
9. Outstanding Adjustment popup.
10. Bill-wise allocation calculations.
11. Journal Voucher Auto.
12. Accounting posting design.
13. Multi-line journal support.
14. Edit and cancellation behaviour.
15. Downstream accounting integration.
16. API endpoints.
17. Prisma models created/reused.
18. Migration name and status.
19. Files created.
20. Files modified.
21. Backend TypeScript results.
22. Frontend build results.
23. Automated Phase 18 test results.
24. Browser verification.
25. Regression results.
26. Remaining limitations and unsupported source types.

Only report tests that were actually executed.

Do not claim fake data or unimplemented functionality as complete.

Do not commit or push.

Stop after presenting the completion report so I can manually inspect the Bank Receipt Entry module.

---

# FINAL DEVELOPMENT INSTRUCTION

Build the Bank Receipt Entry workflow for SHIVAM ENTERPRISE based on the supplied Chandni Software screenshots.

The most important requirements are:

1. Bank Receipt Book selection.
2. Automatic voucher numbering.
3. Actual bank account information.
4. Multiple receipt rows under one voucher.
5. Searchable Party selection with party details.
6. Configured Bank Name CODE/DESC lookup.
7. Cheque/reference number and description.
8. No Adjustment / Against Bill / Skip in O/S.
9. Real Outstanding Adjustment popup.
10. Bill Amount, Bill TDS, PreRec, CurRec and Balance.
11. J.V Req checkbox.
12. Working Journal Voucher Auto with Account Name, Type, Int %, Due, TDS %, Add/Less, Dr/Cr and Note.
13. Correct cheque balance.
14. Balanced multi-line accounting entries.
15. Atomic save.
16. Accurate outstanding allocations.
17. Correct Bank Book, Account Ledger and Bank Reconciliation integration.
18. Existing Bank Receipt and Bank Payment compatibility.

No fake parties.

No fake bills.

No fabricated outstanding amounts.

No duplicate vouchers.

No unbalanced journal entries.

No duplicate accounting engine.

Implement the actual business workflow and verify it end-to-end.