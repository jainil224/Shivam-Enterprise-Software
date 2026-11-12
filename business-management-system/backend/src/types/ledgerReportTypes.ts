// Phase 17 - Bank Book & Account Ledger report contracts.
// Both reports are read-only: every value is derived from the existing posted
// JournalLine rows. Nothing here stores or duplicates an accounting balance.

import type { ReportColumnAlign, ReportColumnType } from './reportTypes.js';

export type LedgerReportType = 'BANK_BOOK' | 'ACCOUNT_LEDGER';
export type BankBookDetailMode = 'DETAIL' | 'SUMMARY';
export type BankBookFilterField =
  | 'voucherNo'
  | 'accountName'
  | 'particulars'
  | 'chequeRef'
  | 'sourceType';
export type LedgerBalanceNature = 'Dr' | 'Cr';
export type LedgerSourceType = 'RECEIPT' | 'PAYMENT' | 'DEBIT_NOTE';

export interface LedgerReportColumnDef {
  key: string;
  label: string;
  type: ReportColumnType;
  align: ReportColumnAlign;
  /** Relative width hint used by the grid and the PDF table. */
  weight: number;
  /** Columns a saved layout may never drop. */
  required?: boolean;
}

export const BANK_BOOK_DETAIL_COLUMNS: LedgerReportColumnDef[] = [
  { key: 'voucherDate', label: 'Voucher Date', type: 'date', align: 'left', weight: 11, required: true },
  { key: 'voucherNo', label: 'Vch No', type: 'text', align: 'left', weight: 12 },
  { key: 'accountName', label: 'Account Name', type: 'text', align: 'left', weight: 20 },
  { key: 'particulars', label: 'Particulars', type: 'text', align: 'left', weight: 22 },
  { key: 'chequeRefNo', label: 'Chq/Ref. No', type: 'text', align: 'left', weight: 12 },
  { key: 'withdraw', label: 'Withdraw', type: 'currency', align: 'right', weight: 11 },
  { key: 'deposit', label: 'Deposit', type: 'currency', align: 'right', weight: 11 },
  { key: 'balance', label: 'Balance', type: 'currency', align: 'right', weight: 13, required: true },
];

export const BANK_BOOK_SUMMARY_COLUMNS: LedgerReportColumnDef[] = [
  { key: 'date', label: 'Date', type: 'date', align: 'left', weight: 14, required: true },
  { key: 'totalWithdraw', label: 'Total Withdraw', type: 'currency', align: 'right', weight: 18 },
  { key: 'totalDeposit', label: 'Total Deposit', type: 'currency', align: 'right', weight: 18 },
  { key: 'netMovement', label: 'Net Movement', type: 'currency', align: 'right', weight: 18 },
  { key: 'closingBalance', label: 'Closing Balance', type: 'currency', align: 'right', weight: 20, required: true },
];

export const ACCOUNT_LEDGER_COLUMNS: LedgerReportColumnDef[] = [
  { key: 'date', label: 'Date', type: 'date', align: 'left', weight: 11, required: true },
  { key: 'voucherNo', label: 'Vch No', type: 'text', align: 'left', weight: 12 },
  { key: 'chequeNo', label: 'Chq No', type: 'text', align: 'left', weight: 10 },
  { key: 'type', label: 'Type', type: 'text', align: 'left', weight: 12 },
  { key: 'bookName', label: 'Book Name', type: 'text', align: 'left', weight: 14 },
  { key: 'debit', label: 'Debit', type: 'currency', align: 'right', weight: 12 },
  { key: 'credit', label: 'Credit', type: 'currency', align: 'right', weight: 12 },
  { key: 'balance', label: 'Balance', type: 'currency', align: 'right', weight: 13, required: true },
  { key: 'sign', label: 'Sign', type: 'text', align: 'center', weight: 7, required: true },
];

export const BANK_BOOK_DETAIL_KEYS = BANK_BOOK_DETAIL_COLUMNS.map((column) => column.key);
export const BANK_BOOK_SUMMARY_KEYS = BANK_BOOK_SUMMARY_COLUMNS.map((column) => column.key);
export const ACCOUNT_LEDGER_KEYS = ACCOUNT_LEDGER_COLUMNS.map((column) => column.key);

export function columnsForReportType(
  reportType: LedgerReportType,
  detailMode: BankBookDetailMode
): LedgerReportColumnDef[] {
  if (reportType === 'ACCOUNT_LEDGER') return ACCOUNT_LEDGER_COLUMNS;
  return detailMode === 'SUMMARY' ? BANK_BOOK_SUMMARY_COLUMNS : BANK_BOOK_DETAIL_COLUMNS;
}

export const BANK_BOOK_FILTER_FIELDS: Array<{ value: BankBookFilterField; label: string }> = [
  { value: 'voucherNo', label: 'Voucher No' },
  { value: 'accountName', label: 'Account Name' },
  { value: 'particulars', label: 'Particulars' },
  { value: 'chequeRef', label: 'Cheque / Reference No' },
  { value: 'sourceType', label: 'Source Type' },
];

export const BANK_BOOK_REPORT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'DAILY', label: '1. DAILY' },
];

export const BANK_BOOK_DETAIL_MODES: Array<{ value: BankBookDetailMode; label: string }> = [
  { value: 'DETAIL', label: '1. Detail' },
  { value: 'SUMMARY', label: '2. Summary' },
];

export interface LedgerOpeningBalance {
  /** Opening date of the reporting period. */
  date: string;
  /** Absolute opening amount. */
  amount: string;
  nature: LedgerBalanceNature;
  /** Signed opening amount: positive Dr, negative Cr. */
  signedAmount: string;
}

export interface BankBookRow {
  journalLineId: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  voucherDate: string;
  voucherNo: string;
  accountName: string;
  particulars: string;
  chequeRefNo: string;
  withdraw: string;
  deposit: string;
  balance: string;
  balanceNature: LedgerBalanceNature;
}

export interface BankBookSummaryRow {
  date: string;
  totalWithdraw: string;
  totalDeposit: string;
  netMovement: string;
  closingBalance: string;
  closingNature: LedgerBalanceNature;
  transactionCount: number;
}

export interface BankBookTotals {
  totalWithdraw: string;
  totalDeposit: string;
  closingBalance: string;
  closingNature: LedgerBalanceNature;
  transactionCount: number;
}

export interface BankBookReportMeta {
  companyName: string;
  companyGstin: string | null;
  companyAddress: string | null;
  financialYear: string;
  bankLedgerAccountId: string;
  accountCode: string;
  accountName: string;
  bankName: string | null;
  branchName: string | null;
  bankAccountNumber: string | null;
  fromDate: string;
  toDate: string;
  detailMode: BankBookDetailMode;
  reportType: string;
  filterField: BankBookFilterField | null;
  filterText: string | null;
  partyGroupId: string | null;
  partyGroupName: string | null;
}

export interface BankBookReportResult {
  meta: BankBookReportMeta;
  columns: LedgerReportColumnDef[];
  opening: LedgerOpeningBalance;
  rows: BankBookRow[];
  summaryRows: BankBookSummaryRow[];
  totals: BankBookTotals;
  totalRows: number;
  page: number;
  pageSize: number;
  generatedAt: string;
}

export interface BankBookBankOption {
  id: string;
  accountCode: string;
  accountName: string;
  bankName: string | null;
  branchName: string | null;
  bankAccountNumber: string | null;
  openingBalance: string;
  openingNature: LedgerBalanceNature;
  currentBalance: string;
  currentNature: LedgerBalanceNature;
}

export interface PartyGroupOption {
  id: string;
  groupName: string;
  isActive: boolean;
}

export interface BankBookSavedReportRecord {
  id: string;
  reportName: string;
  bankLedgerAccountId: string;
  bankAccountName: string | null;
  detailMode: BankBookDetailMode;
  reportType: string;
  filterField: BankBookFilterField | null;
  filterText: string | null;
  partyGroupId: string | null;
  fromDate: string | null;
  toDate: string | null;
  columns: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankBookOptions {
  banks: BankBookBankOption[];
  reportTypes: Array<{ value: string; label: string }>;
  detailModes: Array<{ value: BankBookDetailMode; label: string }>;
  filterFields: Array<{ value: BankBookFilterField; label: string }>;
  partyGroups: PartyGroupOption[];
  columns: LedgerReportColumnDef[];
  summaryColumns: LedgerReportColumnDef[];
  defaultColumns: string[];
  requiredColumns: string[];
  defaultFromDate: string;
  defaultToDate: string;
  financialYearStart: string;
  financialYearEnd: string;
  savedReports: BankBookSavedReportRecord[];
}

export interface AccountLedgerRow {
  journalLineId: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  date: string;
  voucherNo: string;
  chequeNo: string;
  type: string;
  bookName: string;
  /** Counterparty / account name shown under the book line. */
  accountName: string;
  /** Stored narration or remark for the posting. */
  particulars: string;
  /** Voucher reference number, printed under the voucher number when present. */
  referenceNo: string;
  debit: string;
  credit: string;
  balance: string;
  sign: LedgerBalanceNature;
}

export interface AccountLedgerTotals {
  debitTotal: string;
  creditTotal: string;
  closingBalance: string;
  closingNature: LedgerBalanceNature;
  transactionCount: number;
}

export interface AccountLedgerMeta {
  companyName: string;
  companyGstin: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  financialYear: string;
  ledgerAccountId: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
  accountType: string;
  /** GSTIN of the linked party, blank when the ledger has no party. */
  ledgerGstin: string | null;
  /** PAN of the linked party, blank when the ledger has no party. */
  ledgerPan: string | null;
  /** Readable ledger group printed as the print document Schedule. */
  schedule: string | null;
  fromDate: string;
  toDate: string;
}

export interface AccountLedgerReportResult {
  meta: AccountLedgerMeta;
  columns: LedgerReportColumnDef[];
  opening: LedgerOpeningBalance;
  rows: AccountLedgerRow[];
  totals: AccountLedgerTotals;
  totalRows: number;
  page: number;
  pageSize: number;
  generatedAt: string;
}

export interface LedgerLookupAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
  accountType: string;
  isBankAccount: boolean;
  isActive: boolean;
  balanceAmount: string;
  balanceNature: LedgerBalanceNature;
  partyId: string | null;
  partyName: string | null;
  partyMobile: string | null;
  partyGstin: string | null;
  partyPan: string | null;
  partyCity: string | null;
  partyAddress: string | null;
  partyArea: string | null;
  partyGroupName: string | null;
}

export interface AccountLedgerOptions {
  accounts: LedgerLookupAccount[];
  columns: LedgerReportColumnDef[];
  defaultColumns: string[];
  requiredColumns: string[];
  defaultFromDate: string;
  defaultToDate: string;
  financialYearStart: string;
  financialYearEnd: string;
}

export interface BankBookRunRequest {
  bankLedgerAccountId: string;
  detailMode: BankBookDetailMode;
  reportType: string;
  fromDate: string;
  toDate: string;
  filterField: BankBookFilterField | null;
  filterText: string | null;
  partyGroupId: string | null;
  columns?: string[];
  page: number;
  pageSize: number;
}

export interface AccountLedgerRunRequest {
  ledgerAccountId: string;
  fromDate: string;
  toDate: string;
  columns?: string[];
  page: number;
  pageSize: number;
}