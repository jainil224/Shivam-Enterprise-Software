// Phase 17 - Bank Book & Account Ledger report contracts (mirrors the backend).

export type LedgerBalanceNature = 'Dr' | 'Cr';
export type LedgerSourceType = 'RECEIPT' | 'PAYMENT' | 'DEBIT_NOTE';
export type BankBookDetailMode = 'DETAIL' | 'SUMMARY';
export type BankBookFilterField =
  | 'voucherNo'
  | 'accountName'
  | 'particulars'
  | 'chequeRef'
  | 'sourceType';

export interface LedgerReportColumnDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency';
  align: 'left' | 'right' | 'center';
  weight: number;
  required?: boolean;
}

export interface LedgerOpeningBalance {
  date: string;
  amount: string;
  nature: LedgerBalanceNature;
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

/** sessionStorage key shared by the Bank Book config, results and print pages. */
export const BANK_BOOK_STATE_KEY = 'bms_bank_book_state';
export const ACCOUNT_LEDGER_STATE_KEY = 'bms_account_ledger_state';

export interface BankBookPageState {
  request: BankBookRunRequest;
  layoutName: string;
  landscape: boolean;
}

export interface AccountLedgerPageState {
  request: AccountLedgerRunRequest;
  layoutName: string;
}