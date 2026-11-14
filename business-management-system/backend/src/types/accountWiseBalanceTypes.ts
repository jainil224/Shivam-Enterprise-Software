// Phase 19 - Account Wise Balance report contracts (Phase 1).
// Read-only: every monetary value is derived from the stored LedgerAccount
// opening balance plus the same eligible JournalLine rows that the Bank Book
// and Account Ledger reports use. Nothing here stores a duplicated balance.

import type { LedgerAccountGroup } from '@prisma/client';
import type { LedgerBalanceNature } from './ledgerReportTypes.js';

/** Every real LedgerAccountGroup value, in schema order. */
export const ACCOUNT_WISE_ACCOUNT_GROUPS: LedgerAccountGroup[] = [
  'BANK',
  'SUNDRY_DEBTORS',
  'SUNDRY_CREDITORS',
  'DIRECT_EXPENSES',
  'INDIRECT_EXPENSES',
  'DIRECT_INCOME',
  'INDIRECT_INCOME',
  'ASSETS',
  'LIABILITIES',
  'CAPITAL',
  'OTHERS',
];

export type AccountWiseAccountType = 'DEBTORS' | 'CREDITORS' | 'CAPITAL' | 'DEPOSITORS' | 'ALL';
export type AccountWiseScheduleMode = 'ALL' | 'SELECT';
export type AccountWiseBalanceColumnMode = 'BOTH' | 'CREDIT' | 'DEBIT';
export type AccountWiseReportType = 'ACCOUNT_WISE_BALANCE' | 'ACCOUNT_MONTH_WISE_BALANCE';

export interface AccountWiseAccountTypeOption {
  value: AccountWiseAccountType;
  label: string;
  /** Real LedgerAccountGroup values this classification resolves to. */
  accountGroups: LedgerAccountGroup[];
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
  /** Distinct groups of the party's active ledger accounts. */
  accountGroups: LedgerAccountGroup[];
}

export interface AccountWisePartyGroupOption {
  id: string;
  groupName: string;
  isActive: boolean;
}

export interface AccountWiseScheduleOption {
  /** Stable key: the real LedgerAccountGroup value present on active accounts. */
  id: LedgerAccountGroup;
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

/** Validated, normalised query. Company and FY never appear here. */
export interface AccountWiseBalanceQuery {
  reportType: AccountWiseReportType;
  accountType: AccountWiseAccountType;
  partyId: string | null;
  partyGroupId: string | null;
  scheduleMode: AccountWiseScheduleMode;
  scheduleIds: LedgerAccountGroup[];
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
  accountGroup: LedgerAccountGroup;
  accountType: string;
  partyGroupId: string | null;
  partyGroupName: string | null;
  /** Only filled when includePartyAddress was requested. */
  partyAddress: string | null;
  /** Stored LedgerAccount.description; null when Do not Print Description is set. */
  description: string | null;
  /** Only filled when includePartyMobile was requested. */
  mobile: string | null;
  /** Only filled when includePan was requested. */
  panNumber: string | null;
  openingBalance: string;
  openingNature: LedgerBalanceNature;
  openingSignedAmount: string;
  periodDebit: string;
  periodCredit: string;
  closingBalance: string;
  closingNature: LedgerBalanceNature;
  closingSignedAmount: string;
  debitBalance: string;
  creditBalance: string;
  sign: LedgerBalanceNature;
}

export interface AccountWiseBalanceTotals {
  /** Sum of period debit movements of the returned rows. */
  totalDebit: string;
  /** Sum of period credit movements of the returned rows. */
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
  scheduleIds: LedgerAccountGroup[];
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
  /** Shared page document: the screen preview and the PDF both render this. */
  print: AccountWisePrintDocument;
}

/** Human label for a real LedgerAccountGroup enum value. */
export function accountGroupLabel(group: LedgerAccountGroup): string {
  return group
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
// ---------------------------------------------------------------------------
// Phase 19.1 (Phase 2) - print document and Account + Month Wise Balance.
// The print document is built once by the service and consumed unchanged by
// the A4 preview page and the PDF writer, so page breaks and totals cannot
// differ between the two output paths.
// ---------------------------------------------------------------------------

/** Real Company Master values printed in the document header. */
export interface AccountWiseCompanyHeader {
  companyName: string;
  /** Address, city/state/pincode lines, already split for printing. */
  addressLines: string[];
  panNumber: string | null;
  /**
   * This schema stores no TAN column, so the value is null and the header omits
   * the TAN label instead of inventing a number.
   */
  tanNumber: string | null;
  gstin: string | null;
  phone: string | null;
}

/** Page geometry in points, shared by the A4 preview and the PDF writer. */
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
  /** First usable row below the repeated table header. */
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
  /** Pre-wrapped name lines, identical in the preview and the PDF. */
  nameLines: string[];
  /** Address / mobile / PAN / description lines, already selected by the options. */
  detailLines: string[];
  /** Empty when the account has no debit balance. */
  debit: string;
  /** Empty when the account has no credit balance. */
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
  /** Documented interpretation notes; never printed as fabricated business data. */
  notes: string[];
}

/** One dynamic month bucket of the selected period. */
export interface AccountWiseMonthGroup {
  /** Stable key, `YYYY-MM`. */
  key: string;
  /** `APRIL 2026`. */
  label: string;
  /** `APR 2026`. */
  shortLabel: string;
  /** First day actually included (clipped to the report From date). */
  startDate: string;
  /** Last day actually included (clipped to the report To date). */
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
  accountGroup: LedgerAccountGroup;
  accountType: string;
  partyGroupId: string | null;
  partyGroupName: string | null;
  partyAddress: string | null;
  /** Stored LedgerAccount.description; null when Do not Print Description is set. */
  description: string | null;
  mobile: string | null;
  panNumber: string | null;
  openingBalance: string;
  openingNature: LedgerBalanceNature;
  openingSignedAmount: string;
  /** One entry per dynamic month group, in chronological order. */
  months: AccountWiseMonthAmounts[];
  closingBalance: string;
  closingNature: LedgerBalanceNature;
  closingSignedAmount: string;
  debitBalance: string;
  creditBalance: string;
  sign: LedgerBalanceNature;
}

export interface AccountWiseMonthWiseTotals {
  /** Monthly movement totals over the whole returned dataset. */
  months: AccountWiseMonthAmounts[];
  totalOpeningDebit: string;
  totalOpeningCredit: string;
  totalClosingDebit: string;
  totalClosingCredit: string;
  accountCount: number;
}

export interface AccountWiseMonthPrintBlock {
  accountName: string;
  /** Pre-wrapped name lines, identical in the preview and the PDF. */
  nameLines: string[];
  detailLines: string[];
  /** `12,000.00 Dr`. */
  opening: string;
  /** Debit/credit movement pair for each month shown on this page. */
  cells: Array<{ debit: string; credit: string }>;
  /** `9,000.00 Dr`. */
  closing: string;
  heightPt: number;
}

export interface AccountWiseMonthPrintPage {
  pageNumber: number;
  /** Exact column widths in points for this month band. */
  columnWidthsPt: number[];
  /** Months displayed by this page band, in chronological order. */
  months: AccountWiseMonthGroup[];
  /** `APR 2026 - JUL 2026`. */
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
  /** Months rendered per column band (wide reports split into bands). */
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