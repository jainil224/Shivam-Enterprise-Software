# PHASE 12 — BANK RECEIPT & BANK PAYMENT MODULE
## Complete Implementation Prompt — SHIVAM ENTERPRISE BMS

**Project:** Business Management System (BMS)  
**Business:** SHIVAM ENTERPRISE  
**Reference Software:** CHANDNI SOFTWARE  
**Phase:** 12  
**Modules:** Bank Receipt and Bank Payment  
**Priority:** High  
**Implementation:** Full-stack feature — React + TypeScript + Vite, Node.js + Express + TypeScript, Prisma, PostgreSQL 18.

---

# 1. OBJECTIVE

Build two fully functional accounting voucher modules:

1. **Bank Receipt**
2. **Bank Payment**

Both modules already appear on the BMS dashboard. They must become actual working features rather than Coming Soon placeholders.

Follow the Chandni Software-inspired ERP workflow and the existing BMS UI patterns.

The modules must support:

- Creating vouchers.
- Automatically generating voucher numbers.
- Selecting bank accounts and parties/ledger accounts.
- Recording RTGS, NEFT, cheque and other bank transactions.
- Saving and viewing vouchers.
- Editing and cancelling vouchers safely.
- Searching and filtering voucher records.
- Correct double-entry accounting.
- Updating bank and ledger balances through actual accounting postings.
- Printing saved vouchers.
- Strict company and financial-year isolation.

**Important:** These are accounting-recording modules. They do not initiate real bank transfers or send payments to banks.

# 2. FIRST: INSPECT THE EXISTING PROJECT

Before changing any files, inspect the actual current repository.

Do not rely only on previous completion reports.

Inspect:

### Frontend
- `frontend/src/App.tsx`
- `frontend/src/config/navigation.ts`
- Existing dashboard shortcut implementation.
- `frontend/src/layouts/RootLayout.tsx`
- Existing transaction pages and form components.
- Existing register/list pages.
- Existing API service patterns.
- Company context and financial-year context.
- Existing modal, notification, validation and loading components.

### Backend
- Prisma schema.
- Existing migrations.
- Express application and route registration.
- Controllers.
- Services.
- Repositories.
- Middleware for company and financial-year validation.
- Existing Party Master APIs.
- Existing account, bank or ledger models, if any.
- Existing transaction numbering patterns.
- Existing cancellation and audit patterns.

### Database
Determine whether the latest implementation already has:

- Chart of Accounts.
- Ledger Account Master.
- Bank Account Master.
- General Ledger.
- Journal Entries.
- Debit/Credit posting infrastructure.
- Party-to-ledger mapping.
- Financial-year opening balances.

**Do not create duplicate accounting models if equivalent functionality already exists.**

If a reusable ledger/accounting foundation does not exist, implement only the minimum reusable accounting infrastructure required for these vouchers. Do not store bank transactions as unstructured text records or pretend that accounting has been completed without ledger postings.

Prepare a short internal implementation plan, then proceed with implementation. Do not stop after only producing the plan.

# 3. ACCOUNTING RULES — CRITICAL

Implement genuine double-entry bookkeeping.

## A. Bank Receipt

Example:

A customer pays ₹25,000 through NEFT into the company's HDFC Bank account.

Accounting entry:

| Account | Debit | Credit |
|---|---:|---:|
| HDFC Bank A/c | ₹25,000 | — |
| Customer A/c | — | ₹25,000 |
| Total | ₹25,000 | ₹25,000 |

**Rule:**
- Debit: Selected Bank Account.
- Credit: Customer, Supplier, Income or other permitted receiving ledger.

A receipt increases the bank asset balance.

## B. Bank Payment

Example:

The company pays ₹15,000 to a supplier through RTGS from its HDFC Bank account.

Accounting entry:

| Account | Debit | Credit |
|---|---:|---:|
| Supplier A/c | ₹15,000 | — |
| HDFC Bank A/c | — | ₹15,000 |
| Total | ₹15,000 | ₹15,000 |

**Rule:**
- Debit: Supplier, Expense or other permitted payment ledger.
- Credit: Selected Bank Account.

A payment decreases the bank asset balance.

Never reverse these accounting rules.

All journal postings must balance:

`Total Debit = Total Credit`

Use Prisma Decimal and PostgreSQL `Decimal(15,2)` for monetary values. Never use JavaScript floating-point arithmetic for persisted financial calculations.

# 4. ACCOUNT AND BANK MASTER INTEGRATION

The user must be able to select an actual bank account and a valid counterparty ledger.

First reuse existing master/account functionality, if available.

If it does not exist, introduce the smallest reusable ledger foundation needed for the new modules.

It should support:

- Ledger/account code.
- Account name.
- Account group or account category.
- Account type.
- Optional linked Party Master record.
- Opening balance and debit/credit nature, where supported.
- Active/inactive status.
- Bank account classification.
- Bank name.
- Branch name.
- Account holder name, if required.
- IFSC, if required.
- Optional bank account reference/details.

Suggested account classifications:

- Bank Accounts
- Sundry Debtors
- Sundry Creditors
- Direct Expenses
- Indirect Expenses
- Direct Income
- Indirect Income
- Assets
- Liabilities
- Capital
- Others

These are suggested classifications, not instructions to duplicate an existing account-group system.

Important rules:

1. Do not create fictitious bank accounts or parties.
2. Do not automatically create a Party Master entry when saving a voucher.
3. Reuse existing Party Master records wherever possible.
4. Allow appropriate ledger selection for direct expenses and other non-party transactions.
5. Prevent selecting inactive or cross-company accounts.
6. Do not duplicate party opening balances in a second model unless there is a clearly defined single source of truth.
7. If no bank account is configured, display a clear instruction to create one through the appropriate master screen.

# 5. BANK RECEIPT MODULE

Create a dedicated entry page.

Suggested route:

`/transactions/bank-receipts`

## A. Voucher Header

Fields:

| Field | Requirement |
|---|---|
| Voucher Number | Automatically generated |
| Voucher Date | Required |
| Received From | Party or permitted ledger selection |
| Bank Account | Required; select bank ledger |
| Payment Mode | Required |
| Amount | Required |
| Reference Number | Conditional based on payment mode |
| Cheque Number | Required for cheque mode |
| Cheque Date | Applicable to cheque mode |
| Bank/Branch Details | Optional where appropriate |
| Narration | Optional |
| Remarks | Optional |

## B. Payment Modes

Support:

- NEFT
- RTGS
- IMPS
- CHEQUE
- UPI
- BANK TRANSFER
- OTHER

Display reference fields according to the selected mode.

For example:

**Cheque selected:**
- Cheque Number.
- Cheque Date.
- Drawer/Bank details, if required.

**NEFT/RTGS/IMPS/UPI selected:**
- UTR or Transaction Reference.
- Transaction Date, where applicable.

Do not display irrelevant cheque fields for electronic transfers.

## C. Voucher Summary

Display:

- Voucher Number.
- Voucher Date.
- Received From.
- Bank Account.
- Payment Mode.
- Reference Number.
- Amount.
- Narration.
- Debit Account.
- Credit Account.

Show the accounting impact before saving so that users can verify the transaction.

## D. Save Behaviour

When the user saves:

1. Validate all required fields.
2. Verify that the selected bank account belongs to the active company.
3. Verify that the selected receiving ledger belongs to the active company.
4. Verify the financial year and voucher date.
5. Validate the amount.
6. Generate the voucher number safely.
7. Create the voucher and its debit/credit postings atomically.
8. Return the saved voucher details.

Do not allow a partially saved voucher.

# 6. BANK PAYMENT MODULE

Create a separate entry page.

Suggested route:

`/transactions/bank-payments`

## A. Voucher Header

Fields:

| Field | Requirement |
|---|---|
| Voucher Number | Automatically generated |
| Voucher Date | Required |
| Paid To | Supplier, Party or permitted payment ledger |
| Bank Account | Required; select bank ledger |
| Payment Mode | Required |
| Amount | Required |
| Reference Number | Conditional based on payment mode |
| Cheque Number | Required for cheque mode |
| Cheque Date | Applicable to cheque mode |
| Bank/Branch Details | Optional where appropriate |
| Narration | Optional |
| Remarks | Optional |

## B. Payment Modes

Support:

- NEFT
- RTGS
- IMPS
- CHEQUE
- UPI
- BANK TRANSFER
- OTHER

Apply the same conditional reference and cheque-field behaviour as Bank Receipt.

## C. Voucher Summary

Display:

- Voucher Number.
- Voucher Date.
- Paid To.
- Bank Account.
- Payment Mode.
- Reference Number.
- Amount.
- Narration.
- Debit Account.
- Credit Account.

Before saving, show the exact accounting impact.

## D. Save Behaviour

When the user saves:

1. Validate required fields.
2. Verify the bank account.
3. Verify the payment ledger.
4. Validate company and financial-year ownership.
5. Validate amount and voucher date.
6. Generate a unique voucher number.
7. Save the voucher and accounting postings atomically.
8. Return the complete voucher.

# 7. VOUCHER NUMBERING

Implement separate numbering sequences:

- Bank Receipt: BR-YYYY-0001
- Bank Payment: BP-YYYY-0001

These are suggested formats. Follow existing BMS numbering conventions if a consistent format already exists.

Rules:

- Separate sequences for Bank Receipt and Bank Payment.
- Sequence scoped by company and financial year.
- Concurrency-safe generation.
- Unique database constraint.
- No duplicate numbers when multiple users save simultaneously.
- Cancelled voucher numbers must not be reused.
- Do not reuse Production Book numbering for bank vouchers.

# 8. BANK VOUCHER REGISTER

Create two separate register pages.

Bank Receipt Register:

`/transactions/bank-receipts`

Bank Payment Register:

`/transactions/bank-payments`

Each register should show:

| Column | Description |
|---|---|
| Voucher No. | Generated voucher number |
| Date | Voucher date |
| Party / Ledger | Receiving or paying account |
| Bank Account | Selected bank |
| Payment Mode | NEFT, RTGS, Cheque, etc. |
| Reference No. | UTR/Cheque reference |
| Amount | Transaction amount |
| Status | Posted / Cancelled |
| Actions | View / Edit / Print / Cancel |

Features:

- Search by voucher number.
- Search by party or ledger.
- Filter by bank account.
- Filter by payment mode.
- Date range filter.
- Filter by status.
- Sort by date and voucher number.
- Pagination.
- Total displayed amount for the filtered result.
- Clear filters.
- Open voucher details.
- Edit permitted vouchers.
- Cancel permitted vouchers.
- Print saved vouchers.

All register data must come from the backend and active company context. Do not use demo records or fake totals.

# 9. EDIT, CANCEL AND ACCOUNTING SAFETY

## Edit

When editing a saved voucher:

- Load the existing voucher.
- Preserve its original company and financial-year ownership.
- Validate the latest data on the backend.
- Update the voucher and accounting impact in one database transaction.
- Never create duplicate ledger postings.
- Preserve an audit trail of financial changes.

If an existing posted voucher is edited, reverse its prior accounting posting and create the corrected posting atomically. Do not simply append another set of debit/credit entries.

## Cancel

Provide a confirmation dialog.

Require a cancellation reason.

On cancellation:

- Do not hard-delete the voucher.
- Record cancellation date, time and reason.
- Preserve the original voucher.
- Reverse its financial posting.
- Exclude its net effect from current bank balances and active transaction totals.
- Prevent a second cancellation from creating another reversal.
- Preserve the audit trail.

Do not allow modification or cancellation when the financial year is locked.

# 10. GENERAL LEDGER AND BANK BALANCE INTEGRATION

This is a critical requirement.

The saved voucher must affect real ledger balances.

Bank Receipt:

`New Bank Balance = Previous Bank Balance + Receipt Amount`

Bank Payment:

`New Bank Balance = Previous Bank Balance - Payment Amount`

Use actual ledger postings to calculate balances.

Do not maintain a second independently editable bank balance that can become inconsistent with the journal.

If a reusable General Ledger already exists, integrate with it.

If a reusable General Ledger does not exist, implement a minimal reusable journal structure that supports:

- Journal header.
- Journal lines.
- Ledger account reference.
- Debit amount.
- Credit amount.
- Voucher source/type.
- Voucher ID/reference.
- Company and financial-year context.
- Posting date.
- Reversal reference.
- Audit timestamps.

Journal posting must always balance.

Use transactions to ensure voucher and journal consistency.

If existing Trial Balance, Day Book, Bank Book or related reporting functionality is implemented, make sure these vouchers flow into it correctly. Do not fabricate reports or modify unrelated report modules unnecessarily.

# 11. OPTIONAL INVOICE REFERENCES

Inspect whether the current project already has working:

- Sales Invoice.
- Purchase Bill.
- Outstanding Balance.
- Invoice Settlement/Adjustment.

If these are implemented and their data models support settlements, allow users to optionally allocate:

**Bank Receipt:** Customer payment against outstanding sales invoices.

**Bank Payment:** Supplier payment against outstanding purchase bills.

Rules:

- Do not allocate more than the outstanding balance.
- Support partial payment.
- Update settlement records atomically.
- Prevent duplicate settlement.
- Recalculate outstanding balance correctly.

If these modules are not genuinely implemented, do not invent invoice data or fake settlement functionality. Support the transaction as an on-account receipt/payment against the selected ledger instead.

# 12. UI / UX — CHANDNI SOFTWARE-INSPIRED ERP

Follow the existing BMS desktop-first ERP design.

Reference screenshot:
- Bank Receipt card.
- Bank Payment card.
- Existing white card surface.
- Rounded corners.
- Light green/grey dashboard background.
- Existing typography.
- Existing navigation icons.
- Existing star/favourite functionality.

Do not redesign the dashboard.

## Dashboard Behaviour

Bank Receipt card should open the actual Bank Receipt module.

Bank Payment card should open the actual Bank Payment module.

Keep the current descriptions:

**Bank Receipt:** Customer RTGS, NEFT, cheque receipts and bank account ledger credits.

**Bank Payment:** Supplier RTGS/cheque payouts, expenses and bank disbursements.

Keep both in the VOUCHERS category.

Preserve existing favourite state and star toggling.

Do not display Coming Soon when these cards are clicked.

## Entry Form Design

Use a practical desktop ERP form layout:

- Compact, structured fields.
- Clear field labels.
- Logical keyboard navigation.
- Fast data entry.
- Responsive layout for smaller screens.
- Consistent BMS button styling.
- Clear validation messages.
- Loading state while saving.
- Confirmation before destructive actions.

Use existing shared form components wherever appropriate.

## Keyboard Shortcuts

Implement safe, page-scoped shortcuts:

- F10: Save Voucher.
- F5: Open Voucher Register.
- F2: Clear New Entry.
- F3: Search/Select Party or Ledger.
- Escape: Go Back or close a modal.

Enter should move to the next field when appropriate. It must not accidentally submit the entire form or create duplicate vouchers.

Respect existing global keyboard shortcuts and do not introduce conflicts.

# 13. VOUCHER PRINTING

Implement a clean printable voucher view using real saved data.

Include:

- Company name.
- Company address and GSTIN if configured.
- Voucher title.
- Voucher number.
- Voucher date.
- Party/ledger.
- Bank account.
- Payment mode.
- Reference/cheque number.
- Amount.
- Amount in words.
- Narration.
- Debit and credit accounts.
- Prepared/Authorised signature areas.

Provide Print and PDF options if compatible with the project's existing print/PDF infrastructure.

Do not print fabricated company details or transaction data.

# 14. BACKEND API STRUCTURE

Follow the existing Express route conventions.

Possible endpoints:

### Bank Receipt
- `GET /api/bank-receipts`
- `GET /api/bank-receipts/:id`
- `POST /api/bank-receipts`
- `PUT /api/bank-receipts/:id`
- `POST /api/bank-receipts/:id/cancel`

### Bank Payment
- `GET /api/bank-payments`
- `GET /api/bank-payments/:id`
- `POST /api/bank-payments`
- `PUT /api/bank-payments/:id`
- `POST /api/bank-payments/:id/cancel`

### Supporting Data
Use existing Party/Ledger/Bank Account APIs where possible.

Only introduce new supporting endpoints when genuinely necessary.

Use the existing project structure:

Routes → Controllers → Services → Repositories → Prisma.

Keep business logic in the service layer.

Validate all request payloads.

Never trust companyId or financialYearId supplied by the frontend. Derive them from validated active request context, using the existing context middleware and headers.

Reject requests involving cross-company or cross-financial-year records.

# 15. DATABASE MIGRATION AND DATA INTEGRITY

Use a new Prisma migration.

Do not modify or delete historical migrations.

Requirements:

- Company isolation.
- Financial-year isolation.
- Composite relational constraints where supported by the existing schema design.
- Monetary precision: `Decimal(15,2)`.
- Unique voucher numbers per company, financial year and voucher type.
- Referential integrity.
- Safe deletion rules.
- No nullable company ID on financial records.
- No nullable financial-year ID on financial records.
- Database-level protection against duplicate voucher numbers.
- Atomic voucher and ledger posting.

Before applying the migration, inspect existing migration history and verify that it is additive and backward-compatible.

Do not reset the database.

Do not drop existing tables or delete existing records.

# 16. VALIDATION AND ERROR HANDLING

Validate:

- Voucher date is required.
- Voucher date is inside the active financial year.
- Financial year is not locked.
- Active company context is valid.
- Bank account is required.
- Selected bank ledger is actually classified as a bank account.
- Counterparty/ledger is required.
- Amount must be greater than zero.
- Monetary precision must not exceed two decimal places.
- Debit and credit must balance.
- Bank ledger and counterparty ledger cannot be the same.
- Selected ledgers must belong to the active company.
- Inactive accounts cannot be used.
- Cheque number is required for cheque payments/receipts.
- UTR/reference should be validated according to the selected payment mode.
- Duplicate references should be detected and handled safely.
- Cancelled vouchers cannot be edited or cancelled again.
- Locked financial years cannot be modified.

Show friendly, specific errors.

Do not expose raw Prisma errors or internal stack traces to the frontend.

# 17. TESTING REQUIREMENTS

Create dedicated Phase 12 automated tests.

### A. Bank Receipt Tests

1. Create valid Bank Receipt.
2. Auto-generate voucher number.
3. Debit Bank ledger correctly.
4. Credit receiving ledger correctly.
5. Reject zero amount.
6. Reject negative amount.
7. Reject invalid bank account.
8. Reject cross-company ledger.
9. Reject voucher date outside financial year.
10. Reject posting into locked financial year.
11. Validate cheque details.
12. Validate electronic reference fields.
13. Retrieve voucher details.
14. Update voucher without duplicate posting.
15. Cancel voucher with reason.
16. Verify reversal posting.
17. Prevent double cancellation.

### B. Bank Payment Tests

1. Create valid Bank Payment.
2. Auto-generate separate voucher number.
3. Debit payment ledger correctly.
4. Credit Bank ledger correctly.
5. Reject zero amount.
6. Reject negative amount.
7. Reject invalid bank account.
8. Reject cross-company ledger.
9. Reject voucher date outside financial year.
10. Reject posting into locked financial year.
11. Validate cheque details.
12. Validate electronic reference fields.
13. Retrieve voucher details.
14. Update voucher without duplicate posting.
15. Cancel voucher with reason.
16. Verify reversal posting.
17. Prevent double cancellation.

### C. Financial Integrity Tests

- Total debit equals total credit.
- Receipt increases bank ledger balance.
- Payment decreases bank ledger balance.
- Cancelled voucher has zero net accounting impact after reversal.
- Edited voucher does not duplicate financial impact.
- Voucher numbers are unique.
- Company A cannot access Company B's vouchers.
- Company A cannot access Company B's ledger accounts.
- Financial-year separation remains intact.
- Concurrent saves cannot produce duplicate voucher numbers.

### D. Frontend Tests

- Both dashboard cards navigate to correct modules.
- Both forms load.
- Required-field validation works.
- Payment-mode conditional fields work.
- Save button works.
- F10 saves only once.
- F5 opens the correct register.
- Search and filters work.
- View/edit/cancel actions work.
- Print uses actual saved details.
- No console errors or broken navigation.

Use the existing testing conventions and scripts.

Do not use fake database results as proof of backend functionality.

Clean up temporary test records after testing.

# 18. REGRESSION AND SCOPE PROTECTION

This phase must not break previous functionality.

Preserve:

- Company Management.
- Financial Year Management.
- Party Master.
- Production Receive.
- Production Receive Entry.
- Production Challan Edit.
- Production Challan Register.
- Packing Slip.
- Printing and PDF generation.
- Purchase Bill.
- GSTINAPI integration.
- Existing company and financial-year context.
- Dashboard favourites.
- Existing keyboard shortcuts.

Do not refactor unrelated modules.

Do not change existing production weight calculations.

Do not alter existing GSTIN verification.

Do not modify the Phase 11 provider integration.

Do not change company or financial-year isolation logic.

Do not reset PostgreSQL.

# 19. BUILD AND FINAL VERIFICATION

Run:

### Backend
- TypeScript compilation.
- Prisma validation.
- Prisma migration status.
- Phase 12 automated tests.
- Existing backend regression tests.

### Frontend
- TypeScript compilation.
- Vite production build.
- Browser navigation verification.
- Both entry forms.
- Both registers.

### Integration
Verify:

1. Dashboard → Bank Receipt → Save → Register → View.
2. Dashboard → Bank Payment → Save → Register → View.
3. Bank balances change correctly after each saved voucher.
4. Editing a voucher does not duplicate postings.
5. Cancelling a voucher reverses its accounting impact.
6. Locked financial-year restrictions work.
7. Company isolation works.

All existing regression suites must remain passing.

If an old unrelated test fails, identify whether it was already failing before Phase 12. Do not hide or rewrite the failure to report a successful build.

# 20. FINAL IMPLEMENTATION REPORT

After implementation, provide a detailed report containing:

1. Phase 12 implementation summary.
2. Features completed.
3. Actual UI routes.
4. Database models added or reused.
5. Migration name and status.
6. Backend API endpoints.
7. Accounting posting logic.
8. Bank balance calculation.
9. Files created.
10. Files modified.
11. Backend TypeScript results.
12. Frontend build results.
13. Phase 12 test results.
14. Previous regression results.
15. Remaining issues.
16. Any functionality intentionally excluded because its prerequisite module does not exist.

Clearly distinguish implemented functionality from placeholders.

Do not claim a test passed unless it was actually executed.

Do not commit or push changes without my approval.

---

# FINAL INSTRUCTION

Build Phase 12 as a complete, reliable accounting feature for SHIVAM ENTERPRISE.

The main priority is financial correctness, data integrity, Chandni Software-inspired usability, and compatibility with the existing BMS architecture.

Do not create decorative screens with nonfunctional buttons.

Do not create fake ledger balances.

Do not store transactions without accounting postings.

Do not sacrifice existing working modules to finish this feature.

Implement, test, verify, and then provide the final completion report. Stop after reporting the completed work so I can manually review the result before the next phase.