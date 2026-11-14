// Phase 19 - Account Wise Balance report contracts (Phase 1).
// Mirrors the backend payload exactly. Company and financial year are never
// part of a request: the API client sends them as headers from the active
// company context.

export type AccountWiseAccountType = 'DEBTORS' | 'CREDITORS' | 'CAPITAL' | 'DEPOSITORS' | 'ALL';
export type AccountWiseScheduleMode = 'ALL' | 'SELECT';
export type AccountWiseBalanceColumnMode = 'BOTH' | 'CREDIT' | 'DEBIT';
export type AccountWiseReportType = 'ACCOUNT_WISE_BALANCE' | 'ACCOUNT_MONTH_WISE_BALANCE';
export type AccountWiseBalanceNature = 'Dr' | 'Cr';

/** Every real LedgerAccountGroup value, in schema order. */
export type AccountWiseLedgerGroup =
  | 'BANK'
  | 'SUNDRY_DEBTORS'
  | 'SUNDRY_CREDITORS'
  | 'DIRECT_EXPENSES'
  | 'INDIRECT_EXPENSES'
  | 'DIRECT_INCOME'
  | 'INDIRECT_INCOME'
  | 'ASSETS'
  | 'LIABILITIES'
  | 'CAPITAL'
  | 'OTHERS';

export interface AccountWiseAccountTypeOption {
  value: AccountWiseAccountType;
  label: string;
  accountGroups: AccountWiseLedgerGroup[];
  supported: boolean;
  note: string | null;
}

export interface AccountWisePartyOption {
  id: string;
  partyName: string;
  partyCode: string;
  partyType: string;
  partyGroupId: string | null;
  partyGroupName: string | null;
  accountGroups: AccountWiseLedgerGroup[];
}

export interface AccountWisePartyGroupOption {
  id: string;
  groupName: string;
  isActive: boolean;
}

export interface AccountWiseScheduleOption {
  /** Stable key: the real LedgerAccountGroup value present on active accounts. */
  id: AccountWiseLedgerGroup;
  label: string;
  accountCount: number;
  /** Account Type choices whose classification includes this schedule. */
  accountTypes: AccountWiseAccountType[];
}

export interface AccountWiseSelectOption<T extends string> {
  value: T;
  label: string;
}

export interface AccountWiseReportTypeOption {
  value: string;
  label: string;
  enabled: boolean;
  note: string | null;
}

export interface AccountWiseLimitations {
  depositors: string;
  scheduleSource: string;
}

export interface AccountWiseBalanceOptions {
  reportTypes: AccountWiseReportTypeOption[];
  accountTypes: AccountWiseAccountTypeOption[];
  parties: AccountWisePartyOption[];
  partyGroups: AccountWisePartyGroupOption[];
  schedules: AccountWiseScheduleOption[];
  balanceColumns: Array<AccountWiseSelectOption<AccountWiseBalanceColumnMode>>;
  scheduleModes: Array<AccountWiseSelectOption<AccountWiseScheduleMode>>;
  defaultAccountType: AccountWiseAccountType;
  defaultFromDate: string;
  defaultToDate: string;
  financialYearName: string;
  financialYearStart: string;
  financialYearEnd: string;
  limitations: AccountWiseLimitations;
}

/** Exact POST /reports/account-wise-balance/query body. */
export interface AccountWiseBalanceQueryRequest {
  reportType: AccountWiseReportType;
  accountType: AccountWiseAccountType;
  partyId: string | null;
  partyGroupId: string | null;
  scheduleMode: AccountWiseScheduleMode;
  scheduleIds: AccountWiseLedgerGroup[];
  balanceColumns: AccountWiseBalanceColumnMode;
  includePartyAddress: boolean;
  includePartyMobile: boolean;
  includePan: boolean;
  pageBreakEveryParty: boolean;
  doNotPrintDescription: boolean;
  skipZeroBalances: boolean;
  fromDate: string;
  toDate: string;
}

export interface AccountWiseBalanceRow {
  ledgerAccountId: string;
  partyId: string | null;
  accountCode: string;
  accountName: string;
  partyName: string | null;
  accountGroup: AccountWiseLedgerGroup;
  accountType: string;
  partyGroupId: string | null;
  partyGroupName: string | null;
  partyAddress: string | null;
  /** Stored LedgerAccount.description; null when Do not Print Description is set. */
  description: string | null;
  mobile: string | null;
  panNumber: string | null;
  openingBalance: string;
  openingNature: AccountWiseBalanceNature;
  openingSignedAmount: string;
  periodDebit: string;
  periodCredit: string;
  closingBalance: string;
  closingNature: AccountWiseBalanceNature;
  closingSignedAmount: string;
  debitBalance: string;
  creditBalance: string;
  sign: AccountWiseBalanceNature;
}

export interface AccountWiseBalanceTotals {
  totalDebit: string;
  totalCredit: string;
  totalOpeningDebit: string;
  totalOpeningCredit: string;
  totalClosingDebit: string;
  totalClosingCredit: string;
  accountCount: number;
}

export interface AccountWiseAppliedFilters {
  reportType: AccountWiseReportType;
  accountType: AccountWiseAccountType;
  accountTypeLabel: string;
  partyId: string | null;
  partyName: string | null;
  partyGroupId: string | null;
  partyGroupName: string | null;
  scheduleMode: AccountWiseScheduleMode;
  scheduleIds: AccountWiseLedgerGroup[];
  scheduleLabels: string[];
  balanceColumns: AccountWiseBalanceColumnMode;
  includePartyAddress: boolean;
  includePartyMobile: boolean;
  includePan: boolean;
  pageBreakEveryParty: boolean;
  doNotPrintDescription: boolean;
  skipZeroBalances: boolean;
  fromDate: string;
  toDate: string;
}

export interface AccountWiseBalanceMeta {
  companyName: string;
  /** Real Company Master values used by the print document header. */
  company: AccountWiseCompanyHeader;
  financialYearName: string;
  financialYearStart: string;
  financialYearEnd: string;
  generatedAt: string;
  limitations: AccountWiseLimitations;
}

export interface AccountWiseBalanceResult {
  rows: AccountWiseBalanceRow[];
  totals: AccountWiseBalanceTotals;
  appliedFilters: AccountWiseAppliedFilters;
  meta: AccountWiseBalanceMeta;
  /** Shared page document rendered unchanged by the preview and the PDF. */
  print: AccountWisePrintDocument;
}

/** Session state handed from the configuration screen to the preview screen. */
export interface AccountWiseBalancePageState {
  request: AccountWiseBalanceQueryRequest;
}

export const ACCOUNT_WISE_BALANCE_STATE_KEY = 'bms_account_wise_balance_state';
export const ACCOUNT_WISE_BALANCE_DRAFT_KEY = 'bms_account_wise_balance_draft';

/** Human label for a real LedgerAccountGroup value. */
export const accountGroupLabel = (group: string): string =>
  group
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
// ---------------------------------------------------------------------------
// Phase 19.1 (Phase 2) - print document and Account + Month Wise Balance.
// The backend builds the print document once; this screen renders it as-is so
// the A4 preview, the page count and the PDF cannot disagree.
// ---------------------------------------------------------------------------

/** Real Company Master values printed in the document header. */
export interface AccountWiseCompanyHeader {
  companyName: string;
  addressLines: string[];
  panNumber: string | null;
  /** No TAN column exists in this schema, so the header omits the label. */
  tanNumber: string | null;
  gstin: string | null;
  phone: string | null;
}

/** Every font size of the document, so the preview and the PDF agree exactly. */
export interface AccountWisePrintTypography {
  companyNamePt: number;
  financialYearPt: number;
  addressPt: number;
  titlePt: number;
  metaPt: number;
  tableHeadPt: number;
  accountNamePt: number;
  detailPt: number;
  amountPt: number;
  totalPt: number;
}

/** Page geometry in points; converted to CSS pixels by the preview. */
export interface AccountWisePrintLayout {
  orientation: 'portrait' | 'landscape';
  pageWidthPt: number;
  pageHeightPt: number;
  outerPt: number;
  padPt: number;
  contentLeftPt: number;
  contentWidthPt: number;
  contentTopPt: number;
  contentBottomPt: number;
  headerHeightPt: number;
  tableHeadHeightPt: number;
  totalsHeightPt: number;
  bodyTopPt: number;
  bodyBottomPt: number;
  /** Company name already wrapped with the real font metrics. */
  companyNameLines: string[];
  /** Width reserved for the company name, so the financial year fits beside it. */
  companyNameWidthPt: number;
  typography: AccountWisePrintTypography;
  nameHeightPt: number;
  addressHeightPt: number;
  panHeightPt: number;
  titleHeightPt: number;
  metaHeightPt: number;
}

export interface AccountWisePrintBlock {
  accountName: string;
  nameLines: string[];
  detailLines: string[];
  debit: string;
  credit: string;
  heightPt: number;
}

export interface AccountWisePrintPage {
  pageNumber: number;
  blocks: AccountWisePrintBlock[];
  showTotals: boolean;
}

export interface AccountWisePrintTotals {
  debit: string;
  credit: string;
  accountCount: number;
}

export interface AccountWisePrintDocument {
  reportTitle: string;
  orientation: 'portrait';
  company: AccountWiseCompanyHeader;
  financialYear: string;
  periodFrom: string;
  periodTo: string;
  layout: AccountWisePrintLayout;
  /** Exact column widths in points, shared by the preview and the PDF. */
  columnWidthsPt: number[];
  pages: AccountWisePrintPage[];
  totals: AccountWisePrintTotals;
  notes: string[];
}

export interface AccountWiseMonthGroup {
  key: string;
  label: string;
  shortLabel: string;
  startDate: string;
  endDate: string;
}

export interface AccountWiseMonthAmounts {
  key: string;
  debit: string;
  credit: string;
}

export interface AccountWiseMonthWiseRow {
  ledgerAccountId: string;
  partyId: string | null;
  accountCode: string;
  accountName: string;
  partyName: string | null;
  accountGroup: AccountWiseLedgerGroup;
  accountType: string;
  partyGroupId: string | null;
  partyGroupName: string | null;
  partyAddress: string | null;
  description: string | null;
  mobile: string | null;
  panNumber: string | null;
  openingBalance: string;
  openingNature: AccountWiseBalanceNature;
  openingSignedAmount: string;
  months: AccountWiseMonthAmounts[];
  closingBalance: string;
  closingNature: AccountWiseBalanceNature;
  closingSignedAmount: string;
  debitBalance: string;
  creditBalance: string;
  sign: AccountWiseBalanceNature;
}

export interface AccountWiseMonthWiseTotals {
  months: AccountWiseMonthAmounts[];
  totalOpeningDebit: string;
  totalOpeningCredit: string;
  totalClosingDebit: string;
  totalClosingCredit: string;
  accountCount: number;
}

export interface AccountWiseMonthPrintBlock {
  accountName: string;
  nameLines: string[];
  detailLines: string[];
  opening: string;
  cells: Array<{ debit: string; credit: string }>;
  closing: string;
  heightPt: number;
}

export interface AccountWiseMonthPrintPage {
  pageNumber: number;
  /** Exact column widths in points for this month band. */
  columnWidthsPt: number[];
  months: AccountWiseMonthGroup[];
  monthRangeLabel: string;
  blocks: AccountWiseMonthPrintBlock[];
  showTotals: boolean;
  totals: {
    cells: Array<{ debit: string; credit: string }>;
    openingDebit: string;
    openingCredit: string;
    closingDebit: string;
    closingCredit: string;
  };
}

export interface AccountWiseMonthPrintDocument {
  reportTitle: string;
  orientation: 'landscape';
  company: AccountWiseCompanyHeader;
  financialYear: string;
  periodFrom: string;
  periodTo: string;
  layout: AccountWisePrintLayout;
  monthColumnsPerPage: number;
  pages: AccountWiseMonthPrintPage[];
  totals: AccountWiseMonthWiseTotals;
  notes: string[];
}

export interface AccountWiseMonthWiseResult {
  rows: AccountWiseMonthWiseRow[];
  months: AccountWiseMonthGroup[];
  totals: AccountWiseMonthWiseTotals;
  appliedFilters: AccountWiseAppliedFilters;
  meta: AccountWiseBalanceMeta;
  print: AccountWiseMonthPrintDocument;
}