# Phase 19 - Account Wise Balance (Phase 1)

Status: **Phase 1 implemented and verified.** Phase 2 (final A4 print layout, PDF,
WhatsApp delivery, Account + Month Wise Balance, monthly grouping) is intentionally
not implemented.

## 1. Scope delivered

| Area | Result |
|---|---|
| Navigation | `Report -> Final Reports -> Account Wise Balance` (`/reports/final-reports/account-wise-balance`) |
| Report selection screen | Two entries, the month-wise report disabled and labelled Phase 2 |
| Configuration screen | Account Type, Party, Party Group, Schedule, Balance Columns, six checkboxes, FY From/To |
| Schedule popup | Total Selected counter, search, multi-select, Cancel/Apply, restore on reopen, real group ids |
| Backend options API | `GET /api/reports/account-wise-balance/options` |
| Backend query API | `POST /api/reports/account-wise-balance/query` |
| Balance engine | Read-only, reuses `utils/ledgerPosting.ts` and `Prisma.Decimal` |
| Preview | Real-data verification grid (not the Phase 2 print output) |

## 2. Files

### Backend

- `backend/src/types/accountWiseBalanceTypes.ts` - contracts, account group list, labels.
- `backend/src/repositories/accountWiseBalanceRepository.ts` - read-only SELECT access.
- `backend/src/services/accountWiseBalanceService.ts` - validation, options, balance engine.
- `backend/src/controllers/accountWiseBalanceController.ts` - HTTP layer (headers only).
- `backend/src/routes/reportRoutes.ts` - both routes registered.
- `backend/src/utils/ledgerPosting.ts` - shared `isEligiblePostingFields()` eligibility rule.
- `backend/scripts/phase19-account-wise-balance-test.ts` - 111 assertions.
- `backend/package.json` - `test:phase19`.

### Frontend

- `frontend/src/types/accountWiseBalance.ts`
- `frontend/src/pages/accountWiseBalanceShared.tsx` - defaults, sanitising, validation, storage.
- `frontend/src/pages/AccountWiseBalanceSelectionPage.tsx`
- `frontend/src/pages/AccountWiseBalanceConfigPage.tsx`
- `frontend/src/pages/AccountWiseBalancePreviewPage.tsx`
- `frontend/src/components/ScheduleSelectionModal.tsx`
- `frontend/src/services/api.ts` - `getAccountWiseBalanceOptions`, `queryAccountWiseBalance`.
- `frontend/src/App.tsx` - three routes behind `RequireCompanyContext`.
- `frontend/src/config/navigation.ts` - Final Reports child entry.

## 3. Account Type classification

Classification is read from the stored `LedgerAccount.accountGroup`. A debtor is
never inferred from a debit balance.

| Option | Ledger groups |
|---|---|
| 1. Debtors | `SUNDRY_DEBTORS` |
| 2. Creditors | `SUNDRY_CREDITORS` |
| 3. Capital | `CAPITAL` |
| 4. Depositors | Not supported - no reliable classification field exists |
| 5. All Accounts | Every `LedgerAccountGroup` value |

`DEPOSITORS` is returned by the options API with `supported: false` and a note; the
query API rejects it with HTTP 400 instead of returning fake rows.

## 4. Schedules

There is no Schedule Master table in this schema. The schedules offered are the
real `LedgerAccountGroup` enum values that are present on at least one active
ledger account of the company. The enum value is the selection key, so an applied
schedule always maps to stored accounts. This limitation is documented in the
options payload (`limitations.scheduleSource`) and shown on the screens.

## 5. Balance engine

```
Opening at From = stored LedgerAccount.openingBalance (signed by balanceType)
                + eligible postings before From
Period Debit    = eligible postings From..To (debit)
Period Credit   = eligible postings From..To (credit)
Closing         = Opening + Period Debit - Period Credit
```

All arithmetic uses `Prisma.Decimal`. The eligibility rule is the single shared
`isEligiblePostingFields()` helper already used by the Bank Book and Account
Ledger reports: correct company, correct financial year, posted source document,
current revision, not a reversal line, `postingDate <= To`. No second accounting
engine, no summing of vouchers plus journal lines, no stored balance.

`Skip 0 (Zero) Transaction` compares the computed closing balance with
`Prisma.Decimal` equality, so zero is exact and negative balances are kept.

## 6. Request contract

```ts
{
  reportType: 'ACCOUNT_WISE_BALANCE',
  accountType: 'CREDITORS',
  partyId: null,
  partyGroupId: null,
  scheduleMode: 'ALL',
  scheduleIds: [],
  balanceColumns: 'BOTH',
  includePartyAddress: false,
  includePartyMobile: false,
  includePan: false,
  pageBreakEveryParty: false,
  doNotPrintDescription: false,
  skipZeroBalances: false,
  fromDate: '2026-04-01',
  toDate: '2027-03-31'
}
```

Company and financial year always come from the `x-company-id` /
`x-financial-year-id` headers. A body-supplied tenant is ignored.

## 7. Verification

- `npm run test:phase19` - 111/111 assertions.
- Regression: `test:phase12`, `13`, `14`, `15`, `15.1`, `15.2`, `16`, `17`,
  `17.1`, `18`, `18.1`, `18.2`, `18.3` - all green.
- `npx tsc --noEmit` (backend and frontend) - clean.
- `npm run build` (frontend) - success.
- Browser verification (Chrome, Playwright): 55/55 checks on desktop 1440x900 and
  mobile 390x844, zero console errors, zero page errors, no unexpected failed API
  calls. Screenshots in `documentation/screenshots/phase19/`.

## 8. Known limitations (documented, not fabricated)

1. **Depositors** - no classification field exists; option disabled and rejected.
2. **Schedules** - derived from `LedgerAccountGroup`; there is no schedule master.
3. **Party Group** - only stored `PartyGroup` records are offered; when a company
   has none, the control stays at `1. All` with an explanation.
4. **Print / PDF / WhatsApp** - Phase 2. The Print button is disabled with a note.
5. **Account + Month Wise Balance** - Phase 2; listed but disabled.

## 9. Phase 2 reserved scope

Final A4 layout, page break on every party, description suppression in the
rendered output, PDF generation, WhatsApp delivery, monthly grouping and the
Account + Month Wise Balance report.
---

# Phase 19.1 - Account Wise Balance (Phase 2)

Phase 2 adds the result page, the Chandni-style A4 print document, genuine PDF
output, page numbering, multi-page pagination and the second report entry
`2. Account + Month Wise Balance`. Phase 1 content above is unchanged: the
selection screen, the configuration screen, the filter contract and the
account-wise calculation engine were not rebuilt or redesigned.

## 10. Scope delivered in Phase 2

1. `1. Account Wise Balance` and `2. Account + Month Wise Balance` are both
   enabled and selectable. The Report -> Final Reports -> Account Wise Balance
   menu entry still lands on
   `/reports/final-reports/account-wise-balance`.
2. Result page: three-column grid `Account Name | Debit | Credit` driven only by
   real backend rows. The total row is the sum of the whole filtered dataset and
   Debit/Credit are never forced to agree.
3. Print document: A4 portrait, thin black borders, traditional accounting
   layout - company name and financial year, address, `PAN NO:`, `TAN NO:` (only
   when a TAN is stored), centred `ACCOUNT BALANCE REPORT`, `GSTIN:`,
   `PERIOD: FROM DD-MM-YYYY TO DD-MM-YYYY`, `PAGE X OF Y`, the
   `ACCOUNT NAME / DEBIT / CREDIT` header, one block per account with optional
   address / mobile / PAN detail lines, and a bold total row.
4. Print preview: grey canvas, centred white A4 page, thin page outline, compact
   toolbar (Print, Save as PDF, Previous, Next, page counter, Close), real
   selectable text. No screenshot is ever turned into a PDF.
5. Genuine PDF: A4, real text, produced by the existing `pdfWriter` utility, and
   derived from the same document object the preview renders.
6. `2. Account + Month Wise Balance`: dynamic month groups from the From date to
   the To date (partial months clipped), per-account opening balance, one
   Debit/Credit pair per month, closing balance, A4 landscape, repeated headers,
   monthly movement totals plus opening/closing totals.
7. Excel export was evaluated and deliberately not shipped - see section 20.

## 11. Single pagination source (the core Phase 2 decision)

Pagination is computed exactly once, on the backend, inside
`backend/src/utils/accountWiseBalancePrint.ts`. The query payload carries the
complete print document:

- `layout` - page width/height in points, margins, content width, header and
  row metrics, all in typographic points (A4 portrait 595.28 x 841.89,
  A4 landscape 841.89 x 595.28).
- `columnWidthsPt` - the exact column widths; they sum to the content width.
- `pages[]` - one entry per printed page with `pageNumber`, the `blocks` that
  belong to it (each with its measured `heightPt` and wrapped
  `nameLines`/`detailLines`), `showTotals`, and - for the month-wise document -
  the month band for that page.
- `totals` - the document totals.

The React preview (`AccountWiseBalancePrintPage.tsx`) converts points to CSS
pixels (`96 / 72`) and renders that structure. The PDF writer
(`accountWiseBalancePrintPdf.ts`) walks the same `pages` array. Neither side
re-measures, re-splits or re-orders anything, so page count, page order, row
placement and totals cannot drift between the preview, the browser print and the
downloaded PDF. Phase 19 Phase 1's rule that `accountWiseBalanceService.run()`
is the only calculation path still holds: Phase 2 added `runMonthWise()` beside
it in the same service and the same repository helpers, not a second engine.

## 12. Print document contract

`AccountWisePrintDocument` (mirrored in the frontend types) carries:

- `company` - `companyName`, `addressLines` (the real stored address split for
  printing), `panNumber`, `tanNumber`, `gstin`, `phone`.
- `financialYear`, `periodFrom`, `periodTo` (both DD-MM-YYYY), `reportTitle`.
- `orientation` - `portrait` for account-wise, `landscape` for month-wise.
- `layout`, `columnWidthsPt`, `pages`, `totals`, and `notes`.

Nothing in the document is hardcoded company data: every header value is read
from the Company Master and the Financial Year record of the active company.

Month-wise blocks carry `opening`, `closing`, `cells[]` (one
`{ key, label, debit, credit }` per month in the band) and the page carries
`months[]`, `monthRangeLabel` and `columnWidthsPt` for the identity columns plus
the month pairs. `monthColumnsPerPage` is `5` for A4 landscape, so a full
financial year renders as bands of 5, 5 and 2 months.
## 13. The six print options

Every option is applied once in the service, before the print document is
built, so the result page, the preview and the PDF always agree:

| Option | Effect | Where it is applied |
|---|---|---|
| Party Address Required? | Fills `partyAddress` from the linked party and prints an address line | `accountWiseBalanceService` row mapping + print builder detail lines |
| Party Mobile No Required? | Fills `mobile` and prints `Mobile No: ...` | same |
| PAN No Required? | Fills `panNumber` and prints `PAN No: ...` | same |
| Page Break on Every Party | One account per page; the total row only on the last page | print builder page packing |
| Do not Print Description | Nulls the description in the response and drops the description line | service row mapping |
| Skip 0 | Removes accounts whose closing balance is zero | service row filter |

The description toggled by `Do not Print Description` is
`LedgerAccount.description`. The option only nulls it in the response payload -
the stored column is never erased, and the Phase 2 suite asserts that.

## 14. Account + Month Wise Balance - explicit interpretation

This report is intentionally not a second ledger engine. It is the same balance
engine with a month dimension, and the interpretation is stated on screen and in
the document notes:

1. **Month buckets** come from the selected From and To dates. The first and
   last month are clipped to the range; a full month keeps its whole date range.
   Month labels are the uppercase `MMM YYYY` form (e.g. `MAY 2026`).
2. **Opening balance** is the account balance immediately before the From date -
   stored ledger opening plus every posted line before From. It is identical to
   the account-wise opening for the same filters.
3. **Monthly figures** are the account's net Debit and net Credit movement inside
   that month of the range. A month with no posting prints `0.00`, not a blank.
4. **Closing balance** is the opening plus every period movement, and is
   identical to the account-wise closing for the same filters.
5. **Totals** are computed over the whole filtered dataset, not over one page:
   one Debit/Credit pair per month plus opening and closing totals.
6. **Layout** is A4 landscape. Because twelve month pairs do not fit on one A4
   landscape page, the months are split into bands of five
   (`monthColumnsPerPage = 5`), and the account identity columns plus its
   opening and closing values are repeated on every band so each page reads on
   its own.

The Phase 2 suite asserts these rules against fixtures with a partial first
month, an empty middle month and a partial last month, and asserts that the
month-wise opening and closing equal the account-wise opening and closing.

## 15. PDF generation

Both exports reuse the existing `backend/src/utils/pdfWriter.ts`:

- `POST /api/reports/account-wise-balance/pdf` -> A4 portrait,
  `Account_Wise_Balance_<FY>.pdf`.
- `POST /api/reports/account-wise-balance/month-wise/pdf` -> A4 landscape,
  `Account_Month_Wise_Balance_<FY>.pdf`.

The writer emits real, searchable text (`%PDF-1.4`, uncompressed content
streams, `/MediaBox` per page, `/Count` matching the shared page array). The
filename is derived from the financial year name, so
`2026 - 2027` becomes `Account_Wise_Balance_2026-2027.pdf`. Parentheses in text
are escaped; no page is rendered from a screenshot or an image.

## 16. Frontend routes and screens

- `/reports/final-reports/account-wise-balance` - report selection (Phase 1
  screen, both entries enabled, Print now enabled).
- `/reports/final-reports/account-wise-balance/config` - configuration
  (Phase 1 screen; the active report type is carried through).
- `/reports/final-reports/account-wise-balance/preview` - result page. Branches
  on `request.reportType`: three-column account grid, or the month grid with one
  Debit/Credit pair per month plus Opening and Closing columns and the
  interpretation notes.
- `/reports/final-reports/account-wise-balance/print` - A4 document preview for
  both reports. Orientation comes from the payload, so one route serves the
  portrait account-wise sheet and the landscape month-wise sheet.

The print preview toolbar exposes Print (browser print with the `awb-print-*`
`@page` rules), Save as PDF (downloads the backend PDF), Previous/Next, a
`Page N of M` counter and Close. Keyboard: `PageUp`/`PageDown` or the arrow keys
page through the document, `Ctrl+P` prints, `Esc` returns to the result page.
## 17. API surface added in Phase 2

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/reports/account-wise-balance/options` | unchanged; now returns both report entries as enabled |
| `POST` | `/api/reports/account-wise-balance/query` | account-wise result + print document (rejects `ACCOUNT_MONTH_WISE_BALANCE`) |
| `POST` | `/api/reports/account-wise-balance/pdf` | account-wise PDF (portrait) |
| `POST` | `/api/reports/account-wise-balance/month-wise/query` | month-wise result + print document (rejects `ACCOUNT_WISE_BALANCE`) |
| `POST` | `/api/reports/account-wise-balance/month-wise/pdf` | month-wise PDF (landscape) |

Both query endpoints validate the request with the Phase 1 rules (financial year
boundary, account type, schedule selection, balance columns, boolean options)
and resolve the company and financial year from the request headers, so another
company's data is never reachable. The account-wise and month-wise endpoints
each reject the other's report type with a `400`; unknown or foreign companies
and financial years return `404` before any query runs.

## 18. Files changed in Phase 2

### Backend

- `backend/src/types/accountWiseBalanceTypes.ts` - print document, page, block,
  month band and month-wise result contracts.
- `backend/src/utils/accountWiseBalancePrint.ts` - new; pagination, column
  widths, detail-line wrapping, month bands.
- `backend/src/utils/accountWiseBalancePrintPdf.ts` - new; portrait and
  landscape renderers over the shared page array.
- `backend/src/services/accountWiseBalanceService.ts` - `runMonthWise()`,
  `exportPdf()`, `exportMonthWisePdf()`, month bucketing and validation modes.
- `backend/src/controllers/accountWiseBalanceController.ts` - five handlers.
- `backend/src/routes/accountWiseBalanceRoutes.ts` - three new routes.
- `backend/package.json` - `test:phase19:phase2` script.

### Frontend

- `frontend/src/types/accountWiseBalance.ts` - mirrored print/month contracts.
- `frontend/src/services/api.ts` - month-wise query and both PDF exports.
- `frontend/src/pages/accountWiseBalanceShared.tsx` - `ReportList` with both
  entries selectable, defaults and request sanitising.
- `frontend/src/pages/AccountWiseBalanceSelectionPage.tsx` - report-type state,
  Print enabled for both entries.
- `frontend/src/pages/AccountWiseBalanceConfigPage.tsx` - carries the selected
  report type into preview and print.
- `frontend/src/pages/AccountWiseBalancePreviewPage.tsx` - result page for both
  reports.
- `frontend/src/pages/AccountWiseBalancePrintPage.tsx` - new; A4 sheet renderer,
  pager, PDF download.
- `frontend/src/App.tsx` - print route.
- `frontend/src/styles/index.css` - `@page awb-print-portrait`,
  `@page awb-print-landscape` and the sheet rules.

### Tests

- `backend/scripts/phase19.1-account-wise-balance-phase2-test.ts` - new Phase 2
  suite.
- `backend/scripts/phase19-account-wise-balance-test.ts` - the Phase 1 assertion
  that report entry 2 was disabled was updated to expect it enabled, and the
  note assertion now checks for `Opening balance` instead of `Phase 2`. No other
  Phase 1 assertion was weakened; `run()` still rejects the month-wise type.

## 19. Verification (Phase 2)

- `npm run test:phase19:phase2` - **156/156 assertions passed**. Covers report
  entries, account-wise result data, A4 portrait geometry and content, all six
  options (result + preview + PDF), genuine PDF structure and text, month
  bucketing and clipping, month-wise totals, landscape bands, month-wise PDF,
  endpoint mode guards, company isolation and the read-only guarantee.
- Phase 19 Phase 1 regression - 111/111.
- Regressions: Phase 12 85/85, Phase 13 135/135, Phase 14 191/191, Phase 15
  164/164, Phase 15.1 135/135, Phase 16 58/58, Phase 17 70/70, Phase 17.1 33/33,
  Phase 18 125/125, Phase 18.1 56/56.
- `npx tsc --noEmit` - backend exit 0, frontend exit 0.
- `npm run build` - frontend exit 0 (only the pre-existing chunk-size warning).
- Browser verification (Chrome via Playwright) against live data: **48/48 checks
  passed**, 0 console errors, 0 page errors, 0 failed API calls. Desktop
  1440x900 and mobile 390x844. Downloaded and re-opened both PDFs:
  `Account_Wise_Balance_2026-2027.pdf` (7,409 bytes, `%PDF-1.4`,
  `/MediaBox [0 0 595.28 841.89]`, `PAGE 1 OF 1`) and
  `Account_Month_Wise_Balance_2026-2027.pdf` (57,125 bytes, `%PDF-1.4`,
  `/MediaBox [0 0 841.89 595.28]`, `PAGE 1 OF 6` .. `PAGE 6 OF 6`). Both contain
  the company name, PAN, GSTIN, the DD-MM-YYYY period, the column headers, the
  bold total row and the real totals; neither contains a `TAN NO:` label.
  Screenshots and the machine-readable harness result are stored in
  `documentation/screenshots/phase19/` (p19p2-01 to p19p2-10 and
  p19p2-verify.json).

## 20. Known limitations (documented, not fabricated)

1. **TAN** - the Company Master stores no TAN field. `tanNumber` is `null` and
   the `TAN NO:` label is omitted from the preview and the PDF. No value is
   invented. Adding TAN requires a schema change, which Phase 2 did not make.
2. **Excel export** - not shipped. The repository has XLSX writers for other
   reports (Phase 15/15.1), but none is a generic exporter that can be reused for
   this document without writing a new one; Phase 2 therefore ships Print and
   PDF only, and this is the documented limitation.
3. **WhatsApp delivery** - not in Phase 2 scope.
4. **Depositors** - still unavailable; no classification field exists.
5. **Month-wise bands** - a period longer than five months repeats the account
   identity columns on each band by design, so the same account name appears
   once per band. This is the documented interpretation, not a duplicate row.
6. **Browser print** uses the same A4 geometry via `@page` rules, but the final
   fidelity of a physical print depends on the browser's print dialog settings
   (margins and headers/footers must be off). The PDF download is the
   pixel-independent output.

## 21. Preserved Phase 1 behaviour

- The Report -> Final Reports -> Account Wise Balance navigation and route are
  unchanged.
- Account Type classification, the derived schedules, the party and party-group
  filters, the balance-column switch and the financial-year boundary validation
  are unchanged.
- `accountWiseBalanceService.run()` remains the single account-wise calculation
  path; Phase 2 added the print document to its response and a sibling
  `runMonthWise()` method, not a second engine.
- No journal, voucher, ledger, party or financial-year write was added. The
  Phase 2 suite asserts that journal lines, vouchers, ledgers and parties are
  byte-identical before and after every report run and export.