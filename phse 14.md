# PHASE 13 — SALES ORDER & PURCHASE ORDER MODULES

## Complete Full-Stack Implementation Specification

### SHIVAM ENTERPRISE — Chandni Software-Inspired ERP

**Project:** Business Management System (BMS)
**Business:** SHIVAM ENTERPRISE
**Reference:** Chandni Software — Textile ERP & Accounting Software
**Phase:** 13
**Modules:** Sales Order and Purchase Order
**Database:** PostgreSQL 18
**ORM:** Prisma
**Backend:** Node.js + Express + TypeScript
**Frontend:** React + TypeScript + Vite

---

# PART 1 — PROJECT OBJECTIVE

I want to implement two complete ERP modules:

1. Sales Order
2. Purchase Order

Both dashboard shortcuts already exist.

Their current descriptions are:

**Sales Order**

"Advance sales bookings, buyer order confirmations and yarn delivery commitments."

**Purchase Order**

"Raw material procurement orders and yarn purchase contracts."

The goal is to replace the existing Coming Soon behaviour with fully functional modules inspired by the publicly documented workflows of Chandni Software.

Use Chandni Software as a business-process reference, especially:

- Customer order booking and delivery scheduling.
- Sales order fulfilment tracking.
- Purchase orders for yarn and raw materials.
- Supplier tracking.
- Pending purchase orders.
- Goods-receipt and quality-inspection workflows.
- Converting eligible confirmed orders into invoices.
- Order-wise reporting.
- Barcode support where existing infrastructure allows it.

Do not copy Chandni's proprietary code, branding, artwork or exact private interface. Implement our own BMS interface using the same general ERP workflow principles.

# PART 2 — FIRST INSPECT THE CURRENT BMS

Before implementation, examine the current repository carefully.

Phase 12 has already introduced the following accounting architecture:

- LedgerAccount
- JournalLine
- VoucherSequence
- BankVoucher
- Accounting services and repositories
- Ledger Account Master
- Bank Receipt
- Bank Payment

Do not duplicate or damage these models.

The latest Phase 12 report also indicates that its files remain uncommitted. This is important.

## Git and project protection

1. Inspect `git status`.
2. Identify existing modified, untracked and newly created files.
3. Preserve all existing Phase 12 work.
4. Do not run `git reset`, `git clean`, destructive checkout commands or database resets.
5. Do not discard or overwrite existing user modifications.
6. Do not commit or push without my approval.

## Frontend inspection

Inspect:

- `frontend/src/App.tsx`
- `frontend/src/config/navigation.ts`
- `frontend/src/layouts/RootLayout.tsx`
- `frontend/src/components/TopNavigationBar.tsx`
- Existing dashboard page and order cards.
- Existing Purchase Bill pages and components.
- Existing Delivery Challan pages, if implemented.
- Existing transaction registers and detail pages.
- Existing API services.
- Existing shared form controls and notification components.
- Company and financial-year context.

## Backend inspection

Inspect:

- Prisma schema.
- All existing migration files.
- Phase 12 LedgerAccount, JournalLine and VoucherSequence models.
- Existing Party model and Party Master.
- Existing Item or Product Master, if present.
- Existing unit-of-measure master, if present.
- Purchase Bill implementation.
- Delivery Challan implementation.
- Sales Invoice implementation, if present.
- Existing repositories, services, controllers and routes.
- Existing company/FY middleware.
- Existing audit and cancellation patterns.
- Existing PDF/printing infrastructure.

## Critical inspection questions

Determine:

1. Do we already have an Item Master?
2. Which textile attributes are stored on existing items?
3. Are yarn quality and yarn grade masters available?
4. Does the project have a working Sales Invoice module?
5. Does the project have a working Purchase Bill module?
6. Does it have a real Delivery Challan module?
7. Does the application have an actual Goods Receipt or stock-infrastructure module?
8. Can existing transaction records support partial delivery and receipt tracking?
9. Can the existing PDF system print an order document?
10. Can the existing VoucherSequence safely support new document types?

Reuse existing working implementations.

Do not create a duplicate Party Master, Item Master, numbering system or PDF engine.

If an essential master does not exist, implement only the minimum additional master functionality necessary for these two modules.

After inspection, proceed with implementation. Do not stop after creating a plan.

# PART 3 — SHARED ORDER ARCHITECTURE

Create two independent order types with common reusable components where practical.

Suggested database models:

- SalesOrder
- SalesOrderLine
- PurchaseOrder
- PurchaseOrderLine
- OrderStatusHistory, if a common audit model does not already exist.
- OrderFulfilmentLink, if required to link existing downstream documents safely.

These are suggested names. Adapt them to the existing Prisma conventions.

## Core database requirements

Every order header must contain:

- ID.
- Company ID.
- Financial Year ID.
- Order number.
- Order date.
- Party ID.
- Order status.
- Reference information.
- Financial totals.
- Narration/remarks.
- Created timestamp.
- Updated timestamp.
- Created/updated user, if user audit infrastructure exists.

Every order line must contain:

- Order ID.
- Item ID, when an item master exists.
- Item code snapshot.
- Item name/description snapshot.
- Quantity.
- Unit.
- Rate.
- Discount.
- Taxable amount.
- Tax rate.
- GST amounts.
- Line total.
- Delivery or expected receipt details.
- Fulfilled/received quantity derived from valid linked documents where supported.

Use proper database relations and company/FY isolation.

Monetary calculations must use Prisma.Decimal and PostgreSQL Decimal fields. Never store financial values using JavaScript floating-point arithmetic.

Suggested precision:

- Money: Decimal(15,2).
- Quantity: appropriate precision based on the unit, preferably Decimal(15,3) or greater where necessary.
- Unit price: Decimal(15,4), if required by the existing pricing conventions.

Keep all original order references and snapshots so that changing a Party Master or Item Master later does not silently rewrite historical order documents.

# PART 4 — ITEM AND PRODUCT INTEGRATION

Both modules need item selection.

First reuse the current Item Master.

Do not create a duplicate if it already exists.

If no suitable Item Master exists, add the smallest reusable textile/trading Item Master necessary.

Potential item fields:

- Item code.
- Item name.
- Item category.
- Item type.
- Unit of measure.
- HSN code.
- GST rate.
- Default sales rate.
- Default purchase rate.
- Barcode, if supported.
- Description.
- Active/inactive status.

Support textile-related item attributes when applicable:

- Yarn count.
- Denier.
- Yarn quality.
- Yarn grade.
- Lot number.
- Fabric design.
- Fabric type.
- Colour.
- Size or specification.
- Weight or length unit.

Do not force every attribute to be mandatory for every item.

Use existing YarnQuality and YarnGrade masters wherever possible.

Allow textile-specific attributes to be optional and item-type dependent.

Suggested units:

- KG
- GRAM
- METER
- YARD
- PIECE
- ROLL
- BOX
- CARTON
- PACKET
- NOS

Use existing UOM master if available. Do not introduce conflicting unit definitions.

# PART 5 — SALES ORDER MODULE

Suggested routes:

- `/transactions/sales-orders`
- `/transactions/sales-orders/new`
- `/transactions/sales-orders/:id`
- `/transactions/sales-orders/:id/edit`
- `/transactions/sales-orders/:id/print`

Create a complete Sales Order Entry page.

## A. Sales Order Header

Fields:

| Field                   |   |   |   | Requirement                                        |
| ----------------------- | - | - | - | -------------------------------------------------- |
| Sales Order No.         |   |   |   | Automatically generated                            |
| Order Date              |   |   |   | Required                                           |
| Customer                |   |   |   | Required Party selection                           |
| Customer Reference No.  |   |   |   | Optional                                           |
| Customer Reference Date |   |   |   | Optional                                           |
| Billing Address         |   |   |   | From Party Master, editable snapshot where allowed |
| Delivery Address        |   |   |   | Required or selectable                             |
| Expected Delivery Date  |   |   |   | Required where applicable                          |
| Salesperson             |   |   |   | Optional; reuse master if available                |
| Payment Terms           |   |   |   | Optional                                           |
| Delivery Terms          |   |   |   | Optional                                           |
| Freight Terms           |   |   |   | Optional                                           |
| Order Valid Until       |   |   |   | Optional                                           |
| Priority                |   |   |   | Normal / Urgent                                    |
| Status                  |   |   |   | System-controlled                                  |
| Narration               |   |   |   | Optional                                           |
| Remarks                 |   |   |   | Optional                                           |

Display the customer GSTIN and contact details when they exist in Party Master.

Do not fabricate missing customer data.

## B. Sales Order Item Grid

Create a keyboard-friendly, editable grid.

Suggested columns:

1. Sr. No.
2. Item Code.
3. Item Name.
4. Description.
5. Quality/Grade.
6. Count/Denier, when applicable.
7. Design/Colour, when applicable.
8. Unit.
9. Quantity.
10. Rate.
11. Discount %.
12. Discount Amount.
13. Taxable Amount.
14. GST Rate.
15. CGST.
16. SGST.
17. IGST.
18. Line Total.
19. Expected Delivery Date.
20. Remarks.
21. Delete.

Use dynamic columns where some textile-specific fields do not apply.

### Item selection behaviour

- Search by item name.
- Search by item code.
- Search by barcode, if available.
- Search by relevant textile attributes.
- Show active items only by default.
- Auto-fill available item details.
- Auto-fill the configured default selling rate.
- Allow authorised users to change the rate.
- Validate quantity and unit.
- Do not allow duplicate or invalid item references.

Use real backend data.

## C. Multiple Delivery Scheduling

Allow customers to receive ordered items in multiple deliveries.

For example:

Customer orders 1,000 KG of yarn.

| Schedule   | Date        | Quantity |
| ---------- | ----------- | -------: |
| Delivery 1 | 10 November |   400 KG |
| Delivery 2 | 20 November |   300 KG |
| Delivery 3 | 30 November |   300 KG |

Scheduled quantities must add up to the ordered quantity unless the user explicitly saves a partial schedule.

Track:

- Ordered quantity.
- Scheduled quantity.
- Dispatched/fulfilled quantity.
- Pending quantity.

Only count actual dispatches from valid linked documents.

Do not mark the order fulfilled simply because a delivery date has passed.

## D. Sales Order Price Calculation

Calculate:

Line Gross = Quantity × Rate

Line Discount = Gross × Discount Percentage / 100

Taxable Value = Gross − Discount

GST must use the configured Item Master tax rate and the applicable transaction location.

For intra-state supplies:

- CGST.
- SGST.

For inter-state supplies:

- IGST.

Order-level summary:

- Total Quantity.
- Subtotal.
- Item Discounts.
- Additional Discount, if supported.
- Taxable Value.
- CGST.
- SGST.
- IGST.
- Freight.
- Packing Charges.
- Other Charges.
- Round Off.
- Grand Total.

Use existing GST calculation utilities if available.

Do not hardcode tax rates.

Clearly display that an order's tax amount is an estimate for the proposed commercial transaction. Creating or confirming an order must not create a GST invoice or automatically enter a GST return.

## E. Sales Order Actions

Support:

- Save Draft.
- Confirm Order.
- Edit.
- View.
- Print.
- Export PDF.
- Copy Order.
- Cancel Order.
- View History.
- Search Register.

Require confirmation for important status changes.

# PART 6 — PURCHASE ORDER MODULE

Suggested routes:

- `/transactions/purchase-orders`
- `/transactions/purchase-orders/new`
- `/transactions/purchase-orders/:id`
- `/transactions/purchase-orders/:id/edit`
- `/transactions/purchase-orders/:id/print`

This feature is especially important for SHIVAM ENTERPRISE because it should support yarn, raw-material and other sewing/textile procurement.

## A. Purchase Order Header

Fields:

| Field                    | Requirement               |
| ------------------------ | ------------------------- |
| Purchase Order No.       | Automatically generated   |
| PO Date                  | Required                  |
| Supplier                 | Required Party selection  |
| Supplier Quotation No.   | Optional                  |
| Supplier Quotation Date  | Optional                  |
| Supplier Reference       | Optional                  |
| Supplier GSTIN           | From Party Master         |
| Billing Address          | Supplier address          |
| Delivery/Godown Location | Required where applicable |
| Expected Delivery Date   | Required where applicable |
| Buyer/Purchaser          | Optional                  |
| Payment Terms            | Optional                  |
| Delivery Terms           | Optional                  |
| Freight Terms            | Optional                  |
| Transport Details        | Optional                  |
| Priority                 | Normal / Urgent           |
| Status                   | System-controlled         |
| Narration                | Optional                  |
| Remarks                  | Optional                  |

Allow a supplier GSTIN and other supplier details to be displayed from the existing verified Party/GSTIN information where available.

Do not trigger new GSTIN API calls merely by opening an existing Party record.

## B. Purchase Order Item Grid

Suggested columns:

1. Sr. No.
2. Item Code.
3. Item Name.
4. Description.
5. Yarn Quality.
6. Yarn Count.
7. Denier.
8. Yarn Grade.
9. Lot/Specification.
10. Unit.
11. Ordered Quantity.
12. Purchase Rate.
13. Discount %.
14. Discount Amount.
15. Taxable Amount.
16. GST Rate.
17. CGST.
18. SGST.
19. IGST.
20. Line Total.
21. Expected Receipt Date.
22. Delivery/Godown Location.
23. Remarks.
24. Delete.

Apply columns dynamically based on the selected item's type.

For example:

**Yarn item:**

- Yarn quality.
- Count.
- Denier.
- Grade.
- Lot/specification.
- KG quantity.

**Other raw material:**

- Item specification.
- Unit.
- Quantity.
- Rate.
- GST.

Do not force yarn-specific fields onto non-yarn items.

## C. Purchase Order Summary

Display:

- Total items.
- Total ordered quantity.
- Subtotal.
- Discount.
- Taxable value.
- CGST.
- SGST.
- IGST.
- Freight.
- Packing/other charges.
- Round off.
- Grand total.

Provide a clear estimated purchase amount.

## D. Supplier Delivery Tracking

Support:

- Expected delivery date.
- Revised delivery date.
- Supplier confirmation date.
- Received quantity.
- Pending quantity.
- Overdue order indicator.
- Partial delivery status.
- Supplier remarks.

The actual received quantity must be derived from valid receipt documents or properly audited receipt records.

Do not increase inventory merely because a Purchase Order was created or approved.

## E. Purchase Order Actions

Support:

- Save Draft.
- Submit for Approval, if approval infrastructure exists.
- Approve.
- Mark as Sent.
- Record Supplier Acknowledgement.
- Edit.
- View.
- Print.
- Export PDF.
- Copy Purchase Order.
- Cancel.
- View History.

Approval must respect existing permissions if a user/role system exists.

Do not introduce an unnecessary new role-management system.

# PART 7 — ORDER STATUS AND WORKFLOW

Use backend-controlled status transitions.

## Sales Order statuses

Suggested lifecycle:

`DRAFT → CONFIRMED → PARTIALLY_FULFILLED → FULFILLED → CLOSED`

Additional status:

- CANCELLED

Rules:

- A draft can be edited.
- A confirmed order can be edited only under defined restrictions.
- A partially fulfilled order must retain its delivered quantity history.
- A fulfilled order cannot accept additional dispatches beyond its eligible quantity.
- A cancelled order cannot be dispatched.
- Cancellation requires a reason.
- Do not allow an order to become fulfilled while eligible quantity is still pending.

## Purchase Order statuses

Suggested lifecycle:

`DRAFT → APPROVED → SENT → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED → CLOSED`

Additional status:

- CANCELLED

Rules:

- A draft is editable.
- Approval changes must be auditable.
- Supplier acknowledgement should record the actual date.
- Partial receipts must not mark the entire order received.
- Full receipt requires all applicable quantities to be received or explicitly resolved.
- A cancelled PO cannot accept further receipts.
- Cancellation requires a reason.
- Preserve supplier and item details in historical records.

Do not permit arbitrary status changes from the frontend.

Use a backend state-transition service.

# PART 8 — EXISTING MODULE INTEGRATION

Inspect actual current implementation before adding links.

## A. Sales Order integration

If a real Delivery Challan module exists:

- Allow eligible confirmed Sales Orders to be selected when creating a Delivery Challan.
- Carry over customer, address and eligible item details.
- Support partial dispatch.
- Link the saved Delivery Challan back to the original Sales Order.
- Recalculate fulfilled and pending quantities from actual linked records.

If a working Sales Invoice module exists:

- Allow eligible Sales Order quantities to be converted into an invoice.
- Support partial invoice conversion if supported by the existing model.
- Prevent duplicate conversion of the same quantity.
- Preserve source order references.
- Use existing GST and financial posting logic.

If those modules are not implemented or cannot correctly link order lines:

- Do not expose fake conversion actions.
- Do not create fabricated invoice or dispatch records.
- Keep the order fully usable as an order.
- Document the missing integration explicitly for a future phase.

## B. Purchase Order integration

If a real Goods Receipt or compatible purchase receipt feature exists:

- Allow users to receive goods against a Purchase Order.
- Support partial receipt.
- Record actual received quantity.
- Record shortage, excess and rejected quantity.
- Link each receipt to the source PO and PO line.
- Recalculate pending quantities.
- Use the actual inventory posting service where available.

If a working Purchase Bill module exists:

- Allow creation of eligible Purchase Bills from Purchase Orders.
- Carry over supplier and eligible line information.
- Support partial billing only where the Purchase Bill model supports it.
- Prevent duplicate billing of the same quantity.
- Preserve PO references.
- Reuse existing GSTIN integration and purchase calculations.

Do not misuse Production Receive or Production Challan as a Goods Receipt.

Do not automatically create a Purchase Bill just because a PO is approved or received.

If no actual receiving module exists, do not claim stock has been received or updated.

# PART 9 — STOCK AND ACCOUNTING PROTECTION

This is critical.

A Sales Order or Purchase Order is a business commitment, not a financial voucher.

Creating, saving or confirming an order must not:

- Create BankVoucher records.
- Create JournalLine entries.
- Change bank balances.
- Post customer or supplier ledger transactions.
- Create a Purchase Bill or Sales Invoice automatically.
- Increase or decrease physical inventory.
- Update GST returns.

Stock reservation may be supported only when a genuine stock-reservation service already exists.

If there is no stock-reservation infrastructure:

- Do not invent stock reservations.
- Show stock availability information only if real stock data exists.
- Clearly distinguish current available stock from ordered quantity.
- Do not claim a stock reservation has taken place.

An actual receipt, dispatch, bill or invoice may affect inventory and accounting only through its own implemented transaction workflow.

# PART 10 — ORDER NUMBER GENERATION

Use independent numbering sequences.

Suggested formats:

- Sales Order: `SO-YYYY-0001`
- Purchase Order: `PO-YYYY-0001`

Use existing Phase 12 VoucherSequence infrastructure if it can safely support additional document types.

Requirements:

- Separate SO and PO sequences.
- Company-specific sequences.
- Financial-year-specific sequences.
- Atomic/concurrency-safe generation.
- Database unique constraints.
- No duplicate numbers under concurrent requests.
- Cancelled order numbers must not be reused.
- Do not use production challan numbering.
- Do not use bank voucher numbering interchangeably.

If the existing sequence design must be extended, use an additive migration.

# PART 11 — ORDER REGISTERS

Create two distinct registers.

## A. Sales Order Register

Route:

`/transactions/sales-orders`

Columns:

- Order No.
- Order Date.
- Customer.
- Customer Reference.
- Total Quantity.
- Grand Total.
- Expected Delivery.
- Fulfilled Quantity.
- Pending Quantity.
- Status.
- Actions.

Filters:

- Date range.
- Customer.
- Order number.
- Item.
- Status.
- Expected delivery date.
- Overdue orders.

Search by:

- SO number.
- Customer name.
- Customer reference.
- Item name.
- Item code.

## B. Purchase Order Register

Route:

`/transactions/purchase-orders`

Columns:

- PO No.
- PO Date.
- Supplier.
- Supplier Reference.
- Total Quantity.
- Grand Total.
- Expected Delivery.
- Received Quantity.
- Pending Quantity.
- Status.
- Actions.

Filters:

- Date range.
- Supplier.
- PO number.
- Item.
- Status.
- Expected delivery.
- Overdue orders.

Search by:

- PO number.
- Supplier name.
- Supplier quotation/reference number.
- Item name.
- Item code.

## C. Common Register Functionality

Both registers must support:

- Pagination.
- Sorting.
- Search.
- Date filters.
- Status filters.
- Clear filters.
- Filtered total.
- Loading state.
- Empty state.
- Error state.
- View.
- Edit.
- Print.
- Cancel.
- Copy/duplicate.

Filtered totals must be calculated from actual backend results.

Do not use hardcoded totals or mock records.

# PART 12 — PENDING ORDER REPORTS

Create useful order reports using actual order records.

### Sales Order reports

- Pending Sales Orders.
- Customer-wise Orders.
- Item-wise Orders.
- Delivery Schedule Report.
- Overdue Sales Orders.
- Partially Fulfilled Orders.
- Fully Fulfilled Orders.
- Order Fulfilment Summary.

### Purchase Order reports

- Pending Purchase Orders.
- Supplier-wise Orders.
- Item-wise Purchase Orders.
- Expected Delivery Report.
- Overdue Purchase Orders.
- Partially Received Orders.
- Fully Received Orders.
- Purchase Order Pending Quantity Report.

All reports must reflect real order and linked fulfilment records.

Provide date ranges, search and export to Excel/PDF if an existing export utility is available.

Do not modify existing Trial Balance or GST reports unnecessarily.

# PART 13 — PRINTING AND PDF

Implement a clean ERP order print view.

## Sales Order printout

Include:

- Company logo, if configured.
- Company name.
- Address.
- GSTIN.
- Sales Order number.
- Order date.
- Customer details.
- Billing address.
- Delivery address.
- Customer reference.
- Item table.
- Item specifications.
- Ordered quantities.
- Units.
- Rates.
- Discounts.
- GST breakup.
- Grand total.
- Amount in words.
- Expected delivery schedule.
- Terms and conditions.
- Narration.
- Prepared by.
- Authorised signature.
- Customer acknowledgement/signature area.

## Purchase Order printout

Include:

- Company branding.
- Supplier name.
- Supplier address.
- Supplier GSTIN.
- Purchase Order number.
- PO date.
- Supplier quotation reference.
- Delivery location.
- Item specifications.
- Yarn quality/count/denier where relevant.
- Ordered quantity.
- Unit.
- Rate.
- Tax.
- Total.
- Expected delivery.
- Freight terms.
- Payment terms.
- Terms and conditions.
- Prepared by.
- Authorised signature.
- Supplier acceptance/signature area.

Support:

- Print.
- Save as PDF.
- A4 portrait/landscape as practical.
- Multi-page order printing.
- Repeated table headings.
- Proper page breaks.
- Consistent number and date formatting.

Reuse existing Phase 10/10.1 PDF infrastructure where appropriate.

Do not break existing packing slip or bank voucher printing.

# PART 14 — USER EXPERIENCE AND KEYBOARD NAVIGATION

Follow the existing BMS design language and desktop-first ERP workflow.

Use the uploaded screenshot as the dashboard-card reference.

Preserve:

- The light green/grey dashboard background.
- White cards.
- Existing typography.
- Existing border radius.
- Existing card icons.
- Favourite star behaviour.
- Existing navigation structure.

Do not redesign the dashboard.

## Entry page design

Both pages should have:

1. Compact title/header.
2. Voucher/document number.
3. Date and party information.
4. Item entry grid.
5. Delivery/receipt schedule.
6. Calculation summary.
7. Narration and remarks.
8. Action buttons.

The forms must be easy to operate using a keyboard.

Suggested shortcuts:

- F10: Save.
- F5: Open Register.
- F2: Clear New Entry.
- F3: Search Party or Item.
- Escape: Go Back or close modal.

Before implementing shortcuts, inspect existing global handlers and prevent collisions.

Enter should move focus appropriately between inputs.

Enter must never accidentally submit the entire document.

Use the existing custom form submission approach and prevent duplicate saves.

Use a proper saving/loading state.

Prevent double-click duplicate order creation.

# PART 15 — FISCAL YEAR MANAGEMENT

Every Sales Order and Purchase Order must belong to the active company and financial year.

Validate:

- Order date is within the active FY.
- Active FY belongs to the active company.
- Locked FY cannot create, edit, approve or cancel orders.
- Another company's records cannot be read or linked.

Chandni's public help portal lists a topic for transferring previous-year pending orders.

Therefore, inspect whether BMS already has a financial-year rollover/transfer architecture.

If it exists and can safely support pending orders, implement an explicit carry-forward action:

- Transfer only pending quantities.
- Do not transfer completed or cancelled orders.
- Preserve the original order reference.
- Generate the correct new-FY order reference.
- Prevent duplicate transfers.
- Preserve source-order traceability.
- Do not alter the original FY order history.

If no safe rollover architecture exists, leave this as a documented future extension. Do not add a risky automatic FY transfer process.

# PART 16 — SECURITY AND DATA INTEGRITY

All backend operations must use validated company and FY context.

Never trust companyId or financialYearId provided by the client.

Use existing context middleware.

Validate ownership of:

- Party.
- Item.
- Unit.
- Godown/location.
- Linked documents.
- Original order references.

Prevent cross-company data access.

Use composite constraints where consistent with the existing schema.

Add audit information for:

- Creation.
- Confirmation/approval.
- Important edits.
- Status transitions.
- Cancellation.
- Fulfilment/receipt links.

Do not hard-delete confirmed orders.

Cancellation requires a reason.

Do not allow cancellation to remove valid linked dispatch/receipt history.

Use safe transactions for order changes and fulfilment linking.

# PART 17 — BACKEND STRUCTURE

Follow the existing backend architecture.

Suggested endpoint patterns:

## Sales Orders

- `GET /api/sales-orders`
- `GET /api/sales-orders/:id`
- `POST /api/sales-orders`
- `PUT /api/sales-orders/:id`
- `POST /api/sales-orders/:id/confirm`
- `POST /api/sales-orders/:id/cancel`
- `GET /api/sales-orders/next-number`
- `GET /api/sales-orders/summary`
- `GET /api/sales-orders/:id/history`

## Purchase Orders

- `GET /api/purchase-orders`
- `GET /api/purchase-orders/:id`
- `POST /api/purchase-orders`
- `PUT /api/purchase-orders/:id`
- `POST /api/purchase-orders/:id/approve`
- `POST /api/purchase-orders/:id/acknowledge`
- `POST /api/purchase-orders/:id/cancel`
- `GET /api/purchase-orders/next-number`
- `GET /api/purchase-orders/summary`
- `GET /api/purchase-orders/:id/history`

Add endpoints for downstream integration only when the actual source module exists.

These are suggested endpoint names. Follow existing project naming conventions.

Use:

Routes → Controllers → Services → Repositories → Prisma.

Keep calculations and status transitions in services.

Validate all input on the backend.

Return stable error codes and helpful messages.

Do not expose Prisma stack traces.

# PART 18 — DATABASE MIGRATION

Create an additive Prisma migration.

Before migration:

1. Inspect existing tables and indexes.
2. Check existing Item/Party models.
3. Check Phase 12 models.
4. Check existing FY relations.
5. Check current migration status.

Requirements:

- No destructive migration.
- No historical migration modification.
- No database reset.
- No dropped tables.
- No deletion of existing transactions.
- Correct unique constraints.
- Correct company/FY foreign keys.
- Correct monetary precision.
- Safe indexes for common register filters.
- Proper referential actions.

Run Prisma validation and migration status checks.

# PART 19 — AUTOMATED TESTING

Create a Phase 13 automated test suite.

## A. Sales Order tests

1. Create valid Sales Order.
2. Generate correct SO number.
3. Select valid customer.
4. Add multiple items.
5. Save line quantities.
6. Validate item ownership.
7. Calculate subtotal.
8. Calculate discount.
9. Calculate taxable value.
10. Calculate CGST/SGST correctly.
11. Calculate IGST correctly.
12. Calculate total.
13. Save delivery schedules.
14. Retrieve complete order.
15. Update draft order.
16. Confirm order.
17. Prevent invalid status transitions.
18. Cancel with reason.
19. Reject locked FY modification.
20. Reject cross-company access.
21. Search/register filters.
22. Print actual saved order details.

## B. Purchase Order tests

1. Create valid Purchase Order.
2. Generate correct PO number.
3. Select valid supplier.
4. Add multiple items.
5. Save yarn-specific attributes.
6. Validate quantity and rates.
7. Calculate discounts.
8. Calculate GST.
9. Calculate total.
10. Save delivery location.
11. Save expected delivery date.
12. Retrieve full PO.
13. Edit draft.
14. Approve order.
15. Record supplier acknowledgement.
16. Prevent invalid status transitions.
17. Cancel with reason.
18. Reject locked FY changes.
19. Reject cross-company supplier/item access.
20. Search/register filters.
21. Print actual PO details.

## C. Order integrity tests

- Two independent order number sequences.
- No number duplication under concurrent saves.
- Company isolation.
- FY isolation.
- Locked-year restrictions.
- Decimal precision.
- No duplicate item/link data.
- No duplicate invoice or receipt conversion.
- No duplicate fulfilment quantity.
- No over-fulfilment beyond eligible quantity.
- Cancellation preserves historical traceability.
- Audit history is retained.

## D. Accounting regression tests

Verify that creating or confirming either order:

- Creates no BankVoucher.
- Creates no JournalLine.
- Does not change bank account balance.
- Does not change Party ledger balance.
- Does not generate a GST return transaction.

This is mandatory.

## E. Frontend/browser tests

Verify:

- Sales Order card opens the correct page.
- Purchase Order card opens the correct page.
- Both forms load real data.
- Party selection works.
- Item search works.
- Item rows can be added and removed.
- Calculations update correctly.
- Status changes work.
- Registers load.
- Filters work.
- View/Edit/Print actions work.
- F10 works once.
- Enter does not accidentally submit.
- No broken navigation.
- No console errors.
- No cross-company records are visible.

Do not report success based on mocked backend data alone.

# PART 20 — REGRESSION PROTECTION

Preserve all existing features.

Especially:

- Company Management.
- Financial Year Management.
- Party Master.
- GSTINAPI Integration (Phase 11).
- Ledger Account Master.
- Bank Receipt (Phase 12).
- Bank Payment (Phase 12).
- JournalLine and VoucherSequence.
- Production Receive.
- Production Receive Entry.
- Production Challan Edit.
- Production Challan Register.
- Packing Slip printing.
- Purchase Bill.
- Existing navigation and favourites.
- Existing PDF generation.

Do not change production weight calculations.

Do not change GSTIN provider behaviour.

Do not duplicate accounting postings.

Do not refactor unrelated modules.

Do not reset PostgreSQL.

# PART 21 — FINAL VERIFICATION AND REPORT

Run the actual project build and test commands.

### Backend

- Prisma validation.
- Prisma migration status.
- Backend TypeScript compilation.
- Phase 13 tests.
- Existing backend regression suites.

### Frontend

- TypeScript compilation.
- Vite production build.
- Browser navigation.
- Sales Order form verification.
- Purchase Order form verification.
- Register verification.
- Print/PDF verification.

### Integration

Verify these actual workflows:

**Workflow A — Sales**

1. Open Dashboard.
2. Click Sales Order.
3. Create an order for a real customer.
4. Add multiple items.
5. Enter delivery dates.
6. Save Draft.
7. Reopen it.
8. Confirm it.
9. Verify the register.
10. Verify that no journal or bank balance changed.

**Workflow B — Purchase**

1. Open Dashboard.
2. Click Purchase Order.
3. Select a real supplier.
4. Add yarn/raw-material items.
5. Enter expected delivery dates.
6. Save.
7. Approve.
8. Verify the pending order register.
9. Verify the amount and quantity calculations.
10. Verify that no stock or accounting posting was created merely by saving the PO.

**Workflow C — Regression**

Verify that Phase 12 Bank Receipt and Bank Payment continue working correctly and their original accounting tests remain passing.

## Final report format

Provide:

1. Phase 13 implementation summary.
2. Features delivered.
3. Sales Order workflow.
4. Purchase Order workflow.
5. Screens and routes implemented.
6. Database models created/reused.
7. Migration name and status.
8. Backend endpoints.
9. Numbering approach.
10. GST calculation approach.
11. Order fulfilment integration.
12. Stock/accounting behaviour.
13. Files created.
14. Files modified.
15. Backend TypeScript results.
16. Frontend build results.
17. Phase 13 test results.
18. Existing regression results.
19. Browser verification results.
20. Remaining issues and intentionally excluded functionality.

Report actual test counts and executed commands. Do not invent passing results.

Clearly distinguish between implemented features, integrations that were verified, and future extensions.

Do not commit or push.

Stop after providing the completion report so I can manually review the implementation before approving the next phase.

---

# FINAL DEVELOPMENT PRIORITY

Build both modules as genuine ERP order-management workflows.

The most important priorities are:

1. Accurate customer and supplier order entry.
2. Fast textile/raw-material item entry.
3. Correct order quantities, rates, discounts and GST estimates.
4. Delivery scheduling.
5. Pending order and fulfilment tracking.
6. Real links to existing transaction modules where available.
7. Reliable order registers and printing.
8. Company and financial-year data isolation.
9. No fake stock movements or accounting postings.
10. Complete regression safety.

The final application should feel like a professional desktop ERP inspired by Chandni Software, while remaining consistent with SHIVAM ENTERPRISE's existing BMS architecture.
