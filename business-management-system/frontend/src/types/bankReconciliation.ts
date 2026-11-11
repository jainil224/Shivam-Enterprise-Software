// Phase 16 - Bank Reconciliation types.
// Mirrors the backend contract exactly; money always travels as a decimal string.

export type ReconciliationViewType = 'ALL' | 'PAYMENTS' | 'RECEIPTS' | 'PENDING';
export type ReconciliationSourceType = 'RECEIPT' | 'PAYMENT' | 'DEBIT_NOTE';
export type ReconciliationStatementStatus = 'BALANCED' | 'UNBALANCED';
export type BalanceNature = 'Dr' | 'Cr';

export interface BankBookOption {
  id: string;
  accountCode: string;
  accountName: string;
  bankName: string | null;
  branchName: string | null;
  bankAccountNumber: string | null;
  openingBalance: string;
  debitTotal: string;
  creditTotal: string;
  currentBalance: string;
  balanceAmount: string;
  balanceNature: BalanceNature;
  transactionCount: number;
}

export interface ReconciliationTransaction {
  journalLineId: string;
  sourceType: ReconciliationSourceType;
  sourceId: string;
  sourceNumber: string;
  transactionDate: string;
  chequeDate: string | null;
  clearingDate: string | null;
  chequeNumber: string | null;
  referenceNumber: string | null;
  accountName: string;
  narration: string | null;
  receiptAmount: string;
  paymentAmount: string;
  isCleared: boolean;
  isPending: boolean;
}

export interface ReconciliationSummary {
  openingBookBalance: string;
  totalReceipts: string;
  totalPayments: string;
  closingBookBalance: string;
  unclearedPayments: string;
  unclearedReceipts: string;
  calculatedBankBalance: string;
  statementBalance: string | null;
  difference: string | null;
  differenceIsZero: boolean;
  hasStatementBalance: boolean;
  transactionCount: number;
  pendingCount: number;
}

export interface ReconciliationOpeningInfo {
  openingDate: string;
  openingBookBalance: string;
  openingStatementBalance: string | null;
  difference: string | null;
  isAcknowledged: boolean;
  requiresSetup: boolean;
  requiresAcknowledgement: boolean;
}

export interface ReconciliationCompanyInfo {
  id: string;
  companyName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
}

export interface ReconciliationFinancialYearInfo {
  id: string;
  yearName: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
}

export interface ReconciliationContext {
  company: ReconciliationCompanyInfo;
  financialYear: ReconciliationFinancialYearInfo;
  bank: BankBookOption;
  fromDate: string;
  toDate: string;
  opening: ReconciliationOpeningInfo;
  summary: ReconciliationSummary;
  transactions: ReconciliationTransaction[];
}

export interface ReconciliationScopeRequest {
  bankLedgerAccountId: string;
  fromDate: string;
  toDate: string;
}

export interface ReconciliationOpeningPayload {
  bankLedgerAccountId: string;
  openingDate?: string;
  openingStatementBalance: string;
  acknowledgeDifference?: boolean;
}

export interface ReconciliationOpeningSaveResult {
  opening: ReconciliationOpeningInfo;
  warning: {
    difference: string;
    requiresAcknowledgement: boolean;
    message: string;
  } | null;
}

export interface ReconciliationStatementBalancePayload extends ReconciliationScopeRequest {
  statementBalance: string;
}

export interface ReconciliationStatementSaveResult {
  statementId: string;
  savedAt: string;
  status: ReconciliationStatementStatus;
  summary: ReconciliationSummary;
}

export interface ReconciliationMarkResult {
  journalLineId: string;
  bankLedgerAccountId: string;
  clearingDate: string | null;
  isCleared: boolean;
}

export interface ReconciliationTransactionsResponse {
  viewType: ReconciliationViewType;
  bankLedgerAccountId: string;
  fromDate: string;
  toDate: string;
  summary: ReconciliationSummary;
  transactions: ReconciliationTransaction[];
}

export interface ReconciliationSummaryResponse {
  bank: BankBookOption;
  fromDate: string;
  toDate: string;
  opening: ReconciliationOpeningInfo;
  summary: ReconciliationSummary;
}

export interface ReconciliationStatementPaymentRow {
  journalLineId: string;
  date: string;
  chequeNo: string;
  favouring: string;
  amount: string;
  clearingDate: string;
}

export interface ReconciliationStatementReceiptRow {
  journalLineId: string;
  date: string;
  chequeNo: string;
  receivedFrom: string;
  amount: string;
}

export interface ReconciliationStatementHistoryEntry {
  id: string;
  fromDate: string;
  toDate: string;
  openingStatementBalance: string;
  closingStatementBalance: string;
  bookOpeningBalance: string;
  bookClosingBalance: string;
  unclearedPayments: string;
  unclearedReceipts: string;
  calculatedBankBalance: string;
  difference: string;
  status: ReconciliationStatementStatus;
  createdAt: string;
}

export interface ReconciliationStatementResponse {
  bank: BankBookOption;
  company: ReconciliationCompanyInfo;
  financialYear: ReconciliationFinancialYearInfo;
  fromDate: string;
  toDate: string;
  summary: ReconciliationSummary;
  paymentRows: ReconciliationStatementPaymentRow[];
  receiptRows: ReconciliationStatementReceiptRow[];
  history: ReconciliationStatementHistoryEntry[];
}

export interface ReconciliationPdfPayload extends ReconciliationScopeRequest {
  orientation?: 'portrait' | 'landscape';
}