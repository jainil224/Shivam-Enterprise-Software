export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  application: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

export interface DbHealthStatus {
  status: 'connected' | 'disconnected' | 'error';
  database: string;
  message: string;
  timestamp: string;
  latencyMs?: number;
}

export interface FinancialYear {
  id: string;
  companyId: string;
  yearName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  companyCode: string;
  companyName: string;
  gstin?: string | null;
  panNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  logoPath?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  financialYears?: FinancialYear[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  count?: number;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  totalAmount?: string;
  error?: {
    message: string;
    errors?: Array<{ field: string; message: string }>;
  };
}

// =============================================================
// Phase 5: Master Entities
// =============================================================

export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
export type BalanceType = 'DEBIT' | 'CREDIT';

export interface Party {
  id: string;
  companyId: string;
  partyCode: string;
  partyName: string;
  partyType: PartyType;
  gstin?: string | null;
  panNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  partyGroupId?: string | null;
  areaId?: string | null;
  openingBalance: string | number;
  balanceType: BalanceType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Phase 15.2 - report master data (company scoped)
// -------------------------------------------------------------

export interface PartyGroupRecord {
  id: string;
  companyId: string;
  groupName: string;
  description: string | null;
  isActive: boolean;
}

export interface AreaRecord {
  id: string;
  companyId: string;
  areaName: string;
  description: string | null;
  isActive: boolean;
}

export interface BrokerRecord {
  id: string;
  companyId: string;
  brokerCode: string;
  brokerName: string;
  phone: string | null;
  isActive: boolean;
}

export interface TransporterRecord {
  id: string;
  companyId: string;
  transporterCode: string;
  transporterName: string;
  phone: string | null;
  isActive: boolean;
}

export interface SalespersonRecord {
  id: string;
  companyId: string;
  salespersonCode: string;
  salespersonName: string;
  phone: string | null;
  isActive: boolean;
}

export interface ItemGroupRecord {
  id: string;
  companyId: string;
  groupName: string;
  description: string | null;
  isActive: boolean;
}

export interface PurchaseBookRecord {
  id: string;
  companyId: string;
  financialYearId: string;
  prefix: string;
  bookName: string;
  isActive: boolean;
}

export interface MasterListParams {
  search?: string;
  includeInactive?: boolean;
}

export interface Machine {
  id: string;
  companyId: string;
  machineCode: string;
  machineName: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Operator {
  id: string;
  companyId: string;
  operatorCode: string;
  operatorName: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  companyId: string;
  locationName: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface YarnQuality {
  id: string;
  companyId: string;
  qualityName: string;
  denier?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface YarnGrade {
  id: string;
  companyId: string;
  gradeName: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionBook {
  id: string;
  companyId: string;
  financialYearId: string;
  prefix: string;
  bookName: string;
  openingBalance: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  financialYear?: {
    yearName: string;
    isLocked: boolean;
  };
}

// =============================================================
// Phase 7: Production Receive Entities
// =============================================================

export type ProductionReceiveStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface ProductionReceiveItem {
  id: string;
  productionReceiveId: string;
  cartonNumber: string;
  cartonWeight: number | string;
  cops: number;
  grossWeight: number | string;
  copsWeight: number | string;
  tareWeight: number | string;
  netWeight: number | string;
  averageWeight: number | string;
  twist?: string | null;
  lotNumber?: string | null;
  grade?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionReceive {
  id: string;
  companyId: string;
  financialYearId: string;
  productionBookId: string;
  challanNumber: string;
  challanDate: string;
  partyId?: string | null;
  machineId?: string | null;
  operatorId?: string | null;
  yarnQualityId?: string | null;
  yarnGradeId?: string | null;
  lotNumber?: string | null;
  twist?: string | null;
  emptyCopsWeight: number | string;
  locationId?: string | null;
  remarks?: string | null;
  status: ProductionReceiveStatus;
  createdAt: string;
  updatedAt: string;
  items?: ProductionReceiveItem[];
  productionBook?: ProductionBook;
  party?: Party | null;
  machine?: Machine | null;
  operator?: Operator | null;
  yarnQuality?: YarnQuality | null;
  yarnGrade?: YarnGrade | null;
  location?: Location | null;
}

// =============================================================
// Phase 12: Ledger Accounts & Bank Vouchers
// =============================================================

export type LedgerAccountGroup =
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

export type LedgerAccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export type BankVoucherType = 'RECEIPT' | 'PAYMENT';
export type BankVoucherStatus = 'POSTED' | 'CANCELLED';

export type PaymentMode =
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'CHEQUE'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'OTHER';

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  IMPS: 'IMPS',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
};

export const LEDGER_ACCOUNT_GROUP_LABELS: Record<LedgerAccountGroup, string> = {
  BANK: 'Bank',
  SUNDRY_DEBTORS: 'Sundry Debtors',
  SUNDRY_CREDITORS: 'Sundry Creditors',
  DIRECT_EXPENSES: 'Direct Expenses',
  INDIRECT_EXPENSES: 'Indirect Expenses',
  DIRECT_INCOME: 'Direct Income',
  INDIRECT_INCOME: 'Indirect Income',
  ASSETS: 'Assets',
  LIABILITIES: 'Liabilities',
  CAPITAL: 'Capital',
  OTHERS: 'Others',
};

export interface LedgerAccount {
  id: string;
  companyId: string;
  accountCode: string;
  accountName: string;
  accountGroup: LedgerAccountGroup;
  accountType: LedgerAccountType;
  balanceType: BalanceType;
  openingBalance: string;
  isBankAccount: boolean;
  bankName: string | null;
  branchName: string | null;
  accountHolderName: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
  partyId: string | null;
  partyName: string | null;
  isAutoCreated: boolean;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  debitTotal: string;
  creditTotal: string;
  netBalance: string;
  currentBalance: string;
  transactionCount: number;
}

export interface LedgerAccountPayload {
  accountCode?: string;
  accountName?: string;
  accountGroup?: LedgerAccountGroup;
  accountType?: LedgerAccountType;
  balanceType?: BalanceType;
  openingBalance?: string | number | null;
  bankName?: string | null;
  branchName?: string | null;
  accountHolderName?: string | null;
  ifscCode?: string | null;
  bankAccountNumber?: string | null;
  partyId?: string | null;
  description?: string | null;
}

export interface VoucherAccountRef {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
}

export interface BankVoucherJournalLine {
  id: string;
  revision: number;
  lineNumber: number;
  isReversal: boolean;
  debitAmount: string;
  creditAmount: string;
  postingDate: string;
  narration: string | null;
  ledgerAccount: VoucherAccountRef;
}

export interface BankVoucher {
  id: string;
  companyId: string;
  financialYearId: string;
  voucherType: BankVoucherType;
  voucherNumber: string;
  voucherDate: string;
  status: BankVoucherStatus;
  paymentMode: PaymentMode;
  amount: string;
  referenceNumber: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  bankName: string | null;
  branchName: string | null;
  narration: string | null;
  remarks: string | null;
  revision: number;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  party: { id: string; partyName: string; partyCode: string; partyType: string } | null;
  counterparty: VoucherAccountRef;
  bankAccount: VoucherAccountRef;
  bankAccountDisplayName: string;
  debitAccount: VoucherAccountRef;
  creditAccount: VoucherAccountRef;
  journalLines?: BankVoucherJournalLine[];
  /** Phase 18 (additive): receipt book that produced this voucher, if any. */
  receiptBook?: { id: string; bookName: string; prefix: string } | null;
  /** Phase 18 (additive): number of party rows in the newest revision. */
  receiptRowCount?: number;
  /** Phase 18 (additive): every party on the newest revision (register view). */
  receiptParties?: Array<{ id: string; partyName: string; partyCode: string }>;
  /** Phase 18 (additive): multi-row cheque receipt detail (detail view only). */
  receiptLines?: ReceiptVoucherLine[];
}

export interface BankVoucherLookupBankAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
  bankName: string | null;
  branchName: string | null;
}

export interface BankVoucherLookupLedger {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
}

export interface BankVoucherLookupParty {
  id: string;
  partyName: string;
  partyCode: string;
  partyType: string;
  ledgerAccountId: string | null;
  ledgerAccountName: string | null;
}

export interface BankVoucherLookups {
  company: {
    id: string;
    companyName: string;
    companyCode: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
  };
  financialYear: {
    id: string;
    yearName: string;
    startDate: string;
    endDate: string;
    isLocked: boolean;
  };
  bankAccounts: BankVoucherLookupBankAccount[];
  ledgers: BankVoucherLookupLedger[];
  parties: BankVoucherLookupParty[];
  paymentModes: PaymentMode[];
  nextVoucherNumber: string;
}

export interface BankVoucherPayload {
  voucherDate?: string;
  partyId?: string | null;
  counterpartyLedgerId?: string | null;
  bankAccountLedgerId?: string;
  paymentMode?: PaymentMode;
  amount?: string | number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  narration?: string | null;
  remarks?: string | null;
}

export interface BankVoucherListResult {
  items: BankVoucher[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAmount: string;
}

export interface BankVoucherListParams {
  search?: string;
  bankAccountLedgerId?: string;
  paymentMode?: PaymentMode;
  status?: BankVoucherStatus;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'date' | 'number';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
// =============================================================
// Phase 18: Bank Receipt Entry (Cheque Receipt)
// =============================================================

export type BankReceiptAdjustmentMode = 'NO_ADJUSTMENT' | 'AGAINST_BILL' | 'SKIP_IN_OS';
export type BankReceiptDrCr = 'DR' | 'CR';
export type BankReceiptCalculationType = 'AMT' | 'INT' | 'TDS';
export type BankReceiptAllocationStatus = 'ACTIVE' | 'REVERSED';

export const RECEIPT_ADJUSTMENT_MODE_LABELS: Record<BankReceiptAdjustmentMode, string> = {
  NO_ADJUSTMENT: 'No Adjustment',
  AGAINST_BILL: 'Against Bill',
  SKIP_IN_OS: 'Skip in O/S',
};

export const RECEIPT_ADJUSTMENT_MODE_ORDER: BankReceiptAdjustmentMode[] = [
  'NO_ADJUSTMENT',
  'AGAINST_BILL',
  'SKIP_IN_OS',
];

export const CALCULATION_TYPE_LABELS: Record<BankReceiptCalculationType, string> = {
  AMT: 'Amt',
  INT: 'Int',
  TDS: 'Tds',
};

export interface SignedLedgerBalance {
  amount: string;
  nature: 'Dr' | 'Cr';
  signed: string;
}

export interface BankReceiptBookAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
  bankName: string | null;
  branchName: string | null;
  bankAccountNumber: string | null;
  isActive: boolean;
}

export interface BankReceiptBook {
  id: string;
  prefix: string;
  bookName: string;
  bankAccountLedgerId: string;
  isActive: boolean;
  bankAccount: BankReceiptBookAccount;
  balance: SignedLedgerBalance;
}

export interface BankReceiptBookPayload {
  prefix?: string | null;
  bookName?: string;
  bankAccountLedgerId?: string;
  isActive?: boolean;
}

export interface BankInstrument {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
}

export interface BankInstrumentPayload {
  code?: string;
  description?: string;
  isActive?: boolean;
}

export interface ReceiptPartyLookup {
  id: string;
  partyName: string;
  partyCode: string;
  partyType: string;
  gstin: string | null;
  panNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  partyGroupName: string | null;
  ledgerAccountId: string | null;
  brokerName: string | null;
  salespersonName: string | null;
  collectionName: string | null;
  personName: string | null;
  balance: SignedLedgerBalance;
}

export interface ReceiptAdjustmentAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
  partyName: string | null;
  address: string | null;
  balance: SignedLedgerBalance;
}

export interface OutstandingBillRow {
  id: string;
  sourceDocumentType: string;
  typeCode: string;
  bookName: string | null;
  billNumber: string;
  billDate: string;
  dueValue: number | null;
  billAmount: string;
  billTds: string;
  previousReceived: string;
  currentReceived: string;
  balance: string;
  jvRequired: boolean;
}

export interface OutstandingBillsResponse {
  party: {
    id: string;
    partyName: string;
    partyCode: string;
    address: string | null;
    city: string | null;
    state: string | null;
    gstin: string | null;
    phone: string | null;
  };
  bills: OutstandingBillRow[];
  totals: {
    billAmount: string;
    billTds: string;
    previousReceived: string;
    currentReceived: string;
    balance: string;
  };
}

export interface ReceiptAllocationPayload {
  purchaseBillId: string;
  allocatedAmount: string | number;
}

export interface ReceiptAdjustmentPayload {
  purchaseBillId?: string | null;
  adjustmentLedgerAccountId: string;
  calculationType?: BankReceiptCalculationType;
  interestPercent?: string | number | null;
  dueValue?: number | string | null;
  tdsPercent?: string | number | null;
  adjustmentAmount: string | number;
  drCr: BankReceiptDrCr;
  note?: string | null;
}

export interface ReceiptLinePayload {
  partyId: string;
  bankInstrumentId?: string | null;
  bankNameCode?: string | null;
  chequeNumber?: string | null;
  description?: string | null;
  amount: string | number;
  adjustmentMode: BankReceiptAdjustmentMode;
  allocations?: ReceiptAllocationPayload[];
  adjustments?: ReceiptAdjustmentPayload[];
}

export interface ChequeReceiptPayload {
  bookId: string;
  voucherDate: string;
  narration?: string | null;
  remarks?: string | null;
  lines: ReceiptLinePayload[];
}

export interface ReceiptAllocationValidation {
  allocations: Array<{
    purchaseBillId: string;
    billNumber: string;
    allocatedAmount: string;
    balanceAfter: string;
  }>;
  allocatedTotal: string;
  chequeBalance: string;
}

export interface ReceiptAdjustmentPreview {
  lines: Array<{
    accountName: string;
    accountCode: string;
    drCr: BankReceiptDrCr;
    amount: string;
  }>;
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  partyEffect: { drCr: BankReceiptDrCr; amount: string };
}

export interface ReceiptVoucherLineAllocation {
  id: string;
  purchaseBillId: string;
  sourceDocumentNumber: string;
  billDate: string;
  billAmount: string;
  billTds: string;
  previousReceived: string;
  allocatedAmount: string;
  balanceAfter: string;
  status: BankReceiptAllocationStatus;
  adjustments: Array<{
    id: string;
    adjustmentLedgerAccount: { id: string; accountCode: string; accountName: string };
    calculationType: BankReceiptCalculationType;
    interestPercent: string | null;
    dueValue: number | null;
    tdsPercent: string | null;
    adjustmentAmount: string;
    drCr: BankReceiptDrCr;
    note: string | null;
    status: BankReceiptAllocationStatus;
  }>;
}

export interface ReceiptVoucherLine {
  id: string;
  rowNumber: number;
  party: { id: string; partyName: string; partyCode: string } | null;
  bankNameCode: string | null;
  bankInstrument: { id: string; code: string; description: string } | null;
  chequeNumber: string | null;
  description: string | null;
  amount: string;
  adjustmentMode: BankReceiptAdjustmentMode;
  allocations: ReceiptVoucherLineAllocation[];
}

export interface ReceiptBookSummary {
  id: string;
  bookName: string;
  prefix: string;
}

export interface ReceiptNextNumber {
  voucherNumber: string;
  bookId: string;
  bookName: string;
}

export interface ReceiptNeighbours {
  previous: { id: string; voucherNumber: string } | null;
  next: { id: string; voucherNumber: string } | null;
}