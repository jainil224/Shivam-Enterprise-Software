import axios from 'axios';
import {
  HealthStatus,
  DbHealthStatus,
  Company,
  FinancialYear,
  ApiResponse,
  Party,
  PartyType,
  Machine,
  Operator,
  Location,
  YarnQuality,
  YarnGrade,
  ProductionBook,
  LedgerAccount,
  LedgerAccountPayload,
  BankVoucher,
  BankVoucherLookups,
  BankVoucherListParams,
  BankVoucherListResult,
  BankVoucherPayload,
  BankVoucherType,
  PaymentMode,
  AreaRecord,
  BrokerRecord,
  ItemGroupRecord,
  MasterListParams,
  PartyGroupRecord,
  PurchaseBookRecord,
  SalespersonRecord,
  TransporterRecord,
} from '../types';

import type {
  Item,
  ItemLookups,
  ItemPayload,
  OrderDocumentType,
  OrderListParams,
  OrderListResult,
  OrderLookups,
  OrderPayload,
  OrderReportDefinition,
  OrderReportResult,
  OrderStatusHistoryEntry,
  OrderSummary,
  PurchaseOrder,
  SalesOrder,
} from '../types/orders';

import type {
  ReportItemDetailsResponse,
  ReportOptionsResponse,
  ReportRunRequest,
  ReportRunResponse,
  ReportSavedLayout,
} from '../types/reports';

import type {
  BankBookOption,
  ReconciliationContext,
  ReconciliationMarkResult,
  ReconciliationOpeningPayload,
  ReconciliationOpeningSaveResult,
  ReconciliationPdfPayload,
  ReconciliationScopeRequest,
  ReconciliationStatementBalancePayload,
  ReconciliationStatementResponse,
  ReconciliationStatementSaveResult,
  ReconciliationSummaryResponse,
  ReconciliationTransactionsResponse,
  ReconciliationViewType,
} from '../types/bankReconciliation';

import type {
  AccountLedgerOptions,
  AccountLedgerReportResult,
  AccountLedgerRunRequest,
  BankBookOptions,
  BankBookReportResult,
  BankBookRunRequest,
  BankBookSavedReportRecord,
} from '../types/ledgerReports';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to automatically attach active company & financial year context
apiClient.interceptors.request.use((config) => {
  const companyId = localStorage.getItem('bms_active_company_id');
  const fyId = localStorage.getItem('bms_active_fy_id');
  if (companyId && !config.headers['x-company-id']) {
    config.headers['x-company-id'] = companyId;
  }
  if (fyId && !config.headers['x-financial-year-id']) {
    config.headers['x-financial-year-id'] = fyId;
  }
  return config;
});

// Response interceptor to extract error message cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred. Please try again.';
    let errors: Array<{ field: string; message: string }> | undefined = undefined;

    if (error.response && error.response.data) {
      if (error.response.data.error) {
        message = error.response.data.error.message || message;
        errors = error.response.data.error.errors;
      } else if (error.response.data.message) {
        message = error.response.data.message;
      }
    } else if (error.message) {
      message = error.message;
    }

    const customError = new Error(message);
    (customError as any).errors = errors;
    (customError as any).status = error.response?.status;
    return Promise.reject(customError);
  }
);

// -------------------------------------------------------------
// System Health
// -------------------------------------------------------------
export const checkServerHealth = async (): Promise<HealthStatus> => {
  const response = await apiClient.get<HealthStatus>('/health');
  return response.data;
};

export const checkDbHealth = async (): Promise<DbHealthStatus> => {
  const response = await apiClient.get<DbHealthStatus>('/health/db');
  return response.data;
};

// -------------------------------------------------------------
// Company APIs
// -------------------------------------------------------------
export const getCompanies = async (search?: string, includeInactive = false): Promise<Company[]> => {
  const response = await apiClient.get<ApiResponse<Company[]>>('/companies', {
    params: { search, includeInactive },
  });
  return response.data.data;
};

export const getCompany = async (id: string): Promise<Company> => {
  const response = await apiClient.get<ApiResponse<Company>>(`/companies/${id}`);
  return response.data.data;
};

export const createCompany = async (data: Partial<Company>): Promise<Company> => {
  const response = await apiClient.post<ApiResponse<Company>>('/companies', data);
  return response.data.data;
};

export const updateCompany = async (id: string, data: Partial<Company>): Promise<Company> => {
  const response = await apiClient.patch<ApiResponse<Company>>(`/companies/${id}`, data);
  return response.data.data;
};

export const deactivateCompany = async (id: string): Promise<Company> => {
  const response = await apiClient.patch<ApiResponse<Company>>(`/companies/${id}/deactivate`);
  return response.data.data;
};

export const validateSessionContext = async (companyId: string, financialYearId: string) => {
  const response = await apiClient.post<ApiResponse<{ company: Company; financialYear: FinancialYear }>>(
    '/companies/validate-context',
    { companyId, financialYearId }
  );
  return response.data.data;
};

// -------------------------------------------------------------
// Financial Year APIs
// -------------------------------------------------------------
export const getFinancialYears = async (companyId: string): Promise<FinancialYear[]> => {
  const response = await apiClient.get<ApiResponse<FinancialYear[]>>(`/companies/${companyId}/financial-years`);
  return response.data.data;
};

export const createFinancialYear = async (
  companyId: string,
  data: {
    yearName: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  }
): Promise<FinancialYear> => {
  const response = await apiClient.post<ApiResponse<FinancialYear>>(`/companies/${companyId}/financial-years`, data);
  return response.data.data;
};

export const updateFinancialYear = async (id: string, data: Partial<FinancialYear>): Promise<FinancialYear> => {
  const response = await apiClient.patch<ApiResponse<FinancialYear>>(`/financial-years/${id}`, data);
  return response.data.data;
};

export const lockFinancialYear = async (id: string): Promise<FinancialYear> => {
  const response = await apiClient.patch<ApiResponse<FinancialYear>>(`/financial-years/${id}/lock`);
  return response.data.data;
};

export const unlockFinancialYear = async (id: string): Promise<FinancialYear> => {
  const response = await apiClient.patch<ApiResponse<FinancialYear>>(`/financial-years/${id}/unlock`);
  return response.data.data;
};

// =============================================================
// Phase 5: Master APIs
// =============================================================

// --- 1. Party / Account Master ---
export const getParties = async (params?: {
  search?: string;
  partyType?: PartyType;
  includeInactive?: boolean;
}): Promise<Party[]> => {
  const response = await apiClient.get<ApiResponse<Party[]>>('/masters/parties', { params });
  return response.data.data;
};

export const getParty = async (id: string): Promise<Party> => {
  const response = await apiClient.get<ApiResponse<Party>>(`/masters/parties/${id}`);
  return response.data.data;
};

export const createParty = async (data: Partial<Party>): Promise<Party> => {
  const response = await apiClient.post<ApiResponse<Party>>('/masters/parties', data);
  return response.data.data;
};

export const updateParty = async (id: string, data: Partial<Party>): Promise<Party> => {
  const response = await apiClient.patch<ApiResponse<Party>>(`/masters/parties/${id}`, data);
  return response.data.data;
};

export const setPartyStatus = async (id: string, isActive: boolean): Promise<Party> => {
  const response = await apiClient.patch<ApiResponse<Party>>(`/masters/parties/${id}/status`, { isActive });
  return response.data.data;
};

// --- 2. Machine Master ---
export const getMachines = async (params?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<Machine[]> => {
  const response = await apiClient.get<ApiResponse<Machine[]>>('/masters/machines', { params });
  return response.data.data;
};

export const createMachine = async (data: Partial<Machine>): Promise<Machine> => {
  const response = await apiClient.post<ApiResponse<Machine>>('/masters/machines', data);
  return response.data.data;
};

export const updateMachine = async (id: string, data: Partial<Machine>): Promise<Machine> => {
  const response = await apiClient.patch<ApiResponse<Machine>>(`/masters/machines/${id}`, data);
  return response.data.data;
};

export const setMachineStatus = async (id: string, isActive: boolean): Promise<Machine> => {
  const response = await apiClient.patch<ApiResponse<Machine>>(`/masters/machines/${id}/status`, { isActive });
  return response.data.data;
};

// --- 3. Operator Master ---
export const getOperators = async (params?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<Operator[]> => {
  const response = await apiClient.get<ApiResponse<Operator[]>>('/masters/operators', { params });
  return response.data.data;
};

export const createOperator = async (data: Partial<Operator>): Promise<Operator> => {
  const response = await apiClient.post<ApiResponse<Operator>>('/masters/operators', data);
  return response.data.data;
};

export const updateOperator = async (id: string, data: Partial<Operator>): Promise<Operator> => {
  const response = await apiClient.patch<ApiResponse<Operator>>(`/masters/operators/${id}`, data);
  return response.data.data;
};

export const setOperatorStatus = async (id: string, isActive: boolean): Promise<Operator> => {
  const response = await apiClient.patch<ApiResponse<Operator>>(`/masters/operators/${id}/status`, { isActive });
  return response.data.data;
};

// --- 4. Location / Godown Master ---
export const getLocations = async (params?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<Location[]> => {
  const response = await apiClient.get<ApiResponse<Location[]>>('/masters/locations', { params });
  return response.data.data;
};

export const createLocation = async (data: Partial<Location>): Promise<Location> => {
  const response = await apiClient.post<ApiResponse<Location>>('/masters/locations', data);
  return response.data.data;
};

export const updateLocation = async (id: string, data: Partial<Location>): Promise<Location> => {
  const response = await apiClient.patch<ApiResponse<Location>>(`/masters/locations/${id}`, data);
  return response.data.data;
};

export const setLocationStatus = async (id: string, isActive: boolean): Promise<Location> => {
  const response = await apiClient.patch<ApiResponse<Location>>(`/masters/locations/${id}/status`, { isActive });
  return response.data.data;
};

// --- 5. Yarn Quality Master ---
export const getYarnQualities = async (params?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<YarnQuality[]> => {
  const response = await apiClient.get<ApiResponse<YarnQuality[]>>('/masters/yarn-qualities', { params });
  return response.data.data;
};

export const createYarnQuality = async (data: Partial<YarnQuality>): Promise<YarnQuality> => {
  const response = await apiClient.post<ApiResponse<YarnQuality>>('/masters/yarn-qualities', data);
  return response.data.data;
};

export const updateYarnQuality = async (id: string, data: Partial<YarnQuality>): Promise<YarnQuality> => {
  const response = await apiClient.patch<ApiResponse<YarnQuality>>(`/masters/yarn-qualities/${id}`, data);
  return response.data.data;
};

export const setYarnQualityStatus = async (id: string, isActive: boolean): Promise<YarnQuality> => {
  const response = await apiClient.patch<ApiResponse<YarnQuality>>(`/masters/yarn-qualities/${id}/status`, { isActive });
  return response.data.data;
};

// --- 6. Yarn Grade Master ---
export const getYarnGrades = async (params?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<YarnGrade[]> => {
  const response = await apiClient.get<ApiResponse<YarnGrade[]>>('/masters/yarn-grades', { params });
  return response.data.data;
};

export const createYarnGrade = async (data: Partial<YarnGrade>): Promise<YarnGrade> => {
  const response = await apiClient.post<ApiResponse<YarnGrade>>('/masters/yarn-grades', data);
  return response.data.data;
};

export const updateYarnGrade = async (id: string, data: Partial<YarnGrade>): Promise<YarnGrade> => {
  const response = await apiClient.patch<ApiResponse<YarnGrade>>(`/masters/yarn-grades/${id}`, data);
  return response.data.data;
};

export const setYarnGradeStatus = async (id: string, isActive: boolean): Promise<YarnGrade> => {
  const response = await apiClient.patch<ApiResponse<YarnGrade>>(`/masters/yarn-grades/${id}/status`, { isActive });
  return response.data.data;
};

// --- 7. Production Book Master ---
export const getProductionBooks = async (params?: {
  search?: string;
  includeInactive?: boolean;
  financialYearId?: string;
}): Promise<ProductionBook[]> => {
  const response = await apiClient.get<ApiResponse<ProductionBook[]>>('/masters/production-books', { params });
  return response.data.data;
};

export const createProductionBook = async (data: Partial<ProductionBook>): Promise<ProductionBook> => {
  const response = await apiClient.post<ApiResponse<ProductionBook>>('/masters/production-books', data);
  return response.data.data;
};

export const updateProductionBook = async (id: string, data: Partial<ProductionBook>): Promise<ProductionBook> => {
  const response = await apiClient.patch<ApiResponse<ProductionBook>>(`/masters/production-books/${id}`, data);
  return response.data.data;
};

export const setProductionBookStatus = async (id: string, isActive: boolean): Promise<ProductionBook> => {
  const response = await apiClient.patch<ApiResponse<ProductionBook>>(`/masters/production-books/${id}/status`, { isActive });
  return response.data.data;
};

// =============================================================
// Phase 7: Production Receive APIs
// =============================================================

export interface ValidateContextResponse {
  company: Company;
  financialYear: FinancialYear;
  productionBook: ProductionBook;
}

export interface NextNumbersResponse {
  nextChallanNumber: string;
  nextCartonNumber: string;
}

export const validateProductionReceiveContext = async (
  productionBookId: string
): Promise<ValidateContextResponse> => {
  const response = await apiClient.get<ApiResponse<ValidateContextResponse>>(
    '/manufacturing/production-receive/validate-context',
    { params: { productionBookId } }
  );
  return response.data.data;
};

export const getNextProductionReceiveNumbers = async (
  productionBookId: string
): Promise<NextNumbersResponse> => {
  const response = await apiClient.get<ApiResponse<NextNumbersResponse>>(
    '/manufacturing/production-receive/next-number',
    { params: { productionBookId } }
  );
  return response.data.data;
};

export const createProductionReceive = async (
  payload: any
): Promise<{ challan: any; totals: any }> => {
  const response = await apiClient.post<ApiResponse<any>>(
    '/manufacturing/production-receive',
    payload
  );
  return {
    challan: response.data.data,
    totals: (response.data as any).totals,
  };
};

export const getProductionReceiveById = async (id: string): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(
    `/manufacturing/production-receive/${id}`
  );
  return response.data.data;
};

export const lookupProductionReceiveByChallanNumber = async (
  productionBookId: string,
  challanNumber: string
): Promise<any | null> => {
  const response = await apiClient.get<ApiResponse<any | null>>(
    '/manufacturing/production-receive/lookup',
    { params: { productionBookId, challanNumber } }
  );
  return response.data.data ?? null;
};

export const listProductionReceives = async (productionBookId?: string): Promise<any[]> => {
  const response = await apiClient.get<ApiResponse<any[]>>(
    '/manufacturing/production-receive',
    { params: { productionBookId } }
  );
  return response.data.data;
};

// =============================================================
// Phase 8: Production Record Management APIs
// =============================================================

export interface ListProductionReceivesParams {
  productionBookId?: string;
  search?: string;
  challanNumber?: string;
  partyId?: string;
  machineId?: string;
  lotNumber?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductionReceiveListResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const listProductionReceivesPaginated = async (
  params: ListProductionReceivesParams
): Promise<ProductionReceiveListResponse> => {
  const response = await apiClient.get<any>(
    '/manufacturing/production-receive',
    { params }
  );
  return response.data;
};

export const updateProductionReceive = async (
  id: string,
  payload: any
): Promise<any> => {
  const response = await apiClient.patch<ApiResponse<any>>(
    `/manufacturing/production-receive/${id}`,
    payload
  );
  return response.data.data;
};

export const cancelProductionReceive = async (
  id: string,
  reason: string
): Promise<any> => {
  const response = await apiClient.patch<ApiResponse<any>>(
    `/manufacturing/production-receive/${id}/cancel`,
    { cancellationReason: reason }
  );
  return response.data.data;
};

export const getProductionReceiveNavigation = async (
  id: string,
  productionBookId: string
): Promise<{ prevId: string | null; nextId: string | null }> => {
  const response = await apiClient.get<ApiResponse<any>>(
    `/manufacturing/production-receive/${id}/navigation`,
    { params: { productionBookId } }
  );
  return response.data.data;
};

// =============================================================
// Phase 11: GSTIN Verification & Purchase Bill APIs
// =============================================================

export interface GSTINVerificationResult {
  gstin: string;
  legalName: string;
  tradeName?: string;
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'INACTIVE';
  registrationDate?: string;
  cancellationDate?: string;
  taxpayerType?: string;
  blockStatus?: string;
  constitutionOfBusiness?: string;
  principalPlaceOfBusiness?: string;
  address?: string;
  state: string;
  stateCode: string;
  city?: string;
  pincode?: string;
  natureOfBusiness?: string;
  source: 'LOCAL_PARTY_MASTER' | 'EXTERNAL_API' | 'MANUAL_UNVERIFIED' | 'CACHED';
  isVerified: boolean;
  verifiedAt: string;
  providerName: string;
  partyId?: string;
  creditsRemaining?: number | null;
  cachedAt?: string;
}

export interface GSTINProviderStatus {
  provider: string;
  isConfigured: boolean;
  message: string;
  portalUrl: string;
  /** Last credits_remaining reported by the provider (null when unknown) */
  creditsRemaining?: number | null;
}

export const verifyGSTIN = async (gstin: string, forceRefresh = false): Promise<GSTINVerificationResult> => {
  const url = `/gstin/verify/${encodeURIComponent(gstin.trim())}${forceRefresh ? '?refresh=true' : ''}`;
  const response = await apiClient.get<ApiResponse<GSTINVerificationResult>>(url);
  return response.data.data;
};

export const getGSTINProviderStatus = async (): Promise<GSTINProviderStatus> => {
  const response = await apiClient.get<ApiResponse<GSTINProviderStatus>>('/gstin/status');
  return response.data.data;
};

export const saveSupplierToPartyMaster = async (data: {
  partyName: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
}): Promise<{ party: Party; isNew: boolean; message: string }> => {
  const response = await apiClient.post<ApiResponse<any>>('/gstin/save-to-party-master', data);
  return response.data.data;
};

export interface CreatePurchaseBillPayload {
  billDate?: string;
  sourceChallanId?: string | null;
  partyId?: string | null;
  supplierGstin?: string | null;
  supplierLegalName: string;
  supplierTradeName?: string | null;
  supplierAddress?: string | null;
  supplierState?: string | null;
  supplierStateCode?: string | null;
  supplierPincode?: string | null;
  supplierCity?: string | null;
  verificationSource?: string;
  verificationTimestamp?: string | null;
  isVerifiedSupplier?: boolean;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  placeOfSupply?: string | null;
  gstRate?: number;
  items: Array<{
    itemDescription: string;
    hsnCode?: string | null;
    quantity: number;
    unit?: string;
    rate: number;
    discount?: number;
    cartonNumber?: string | null;
    lotNumber?: string | null;
    grade?: string | null;
    cops?: number | null;
  }>;
  remarks?: string | null;
}

export const createPurchaseBill = async (payload: CreatePurchaseBillPayload): Promise<any> => {
  const response = await apiClient.post<ApiResponse<any>>('/transactions/purchase-bills', payload);
  return response.data.data;
};

export const getPurchaseBillById = async (id: string): Promise<any> => {
  const response = await apiClient.get<ApiResponse<any>>(`/transactions/purchase-bills/${id}`);
  return response.data.data;
};

export const getPurchaseBillByChallanId = async (challanId: string): Promise<any | null> => {
  const response = await apiClient.get<ApiResponse<any>>(`/transactions/purchase-bills/by-challan/${challanId}`);
  return response.data.data;
};

export const listPurchaseBills = async (params?: {
  financialYearId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> => {
  const response = await apiClient.get<any>('/transactions/purchase-bills', { params });
  return response.data;
};



// =============================================================
// Phase 12: Ledger Accounts & Bank Vouchers
// =============================================================

export interface LedgerAccountListParams {
  search?: string;
  accountGroup?: string;
  isBankAccount?: boolean;
  includeInactive?: boolean;
}

export const getLedgerAccounts = async (
  params?: LedgerAccountListParams
): Promise<LedgerAccount[]> => {
  const response = await apiClient.get<ApiResponse<LedgerAccount[]>>('/ledger-accounts', { params });
  return response.data.data;
};

export const getLedgerAccount = async (id: string): Promise<LedgerAccount> => {
  const response = await apiClient.get<ApiResponse<LedgerAccount>>(`/ledger-accounts/${id}`);
  return response.data.data;
};

export const createLedgerAccount = async (data: LedgerAccountPayload): Promise<LedgerAccount> => {
  const response = await apiClient.post<ApiResponse<LedgerAccount>>('/ledger-accounts', data);
  return response.data.data;
};

export const updateLedgerAccount = async (
  id: string,
  data: LedgerAccountPayload
): Promise<LedgerAccount> => {
  const response = await apiClient.put<ApiResponse<LedgerAccount>>(`/ledger-accounts/${id}`, data);
  return response.data.data;
};

export const setLedgerAccountStatus = async (
  id: string,
  isActive: boolean
): Promise<LedgerAccount> => {
  const response = await apiClient.patch<ApiResponse<LedgerAccount>>(
    `/ledger-accounts/${id}/status`,
    { isActive }
  );
  return response.data.data;
};

const bankVoucherBase = (voucherType: BankVoucherType): string =>
  voucherType === 'RECEIPT' ? '/bank-receipts' : '/bank-payments';

export const getBankVoucherLookups = async (
  voucherType: BankVoucherType
): Promise<BankVoucherLookups> => {
  const response = await apiClient.get<ApiResponse<BankVoucherLookups>>(
    `${bankVoucherBase(voucherType)}/lookups`
  );
  return response.data.data;
};

export const getNextBankVoucherNumber = async (
  voucherType: BankVoucherType
): Promise<{ voucherNumber: string }> => {
  const response = await apiClient.get<ApiResponse<{ voucherNumber: string }>>(
    `${bankVoucherBase(voucherType)}/next-number`
  );
  return response.data.data;
};

export const getBankVoucherSummary = async (
  voucherType: BankVoucherType
): Promise<{ posted: number; cancelled: number }> => {
  const response = await apiClient.get<ApiResponse<{ posted: number; cancelled: number }>>(
    `${bankVoucherBase(voucherType)}/summary`
  );
  return response.data.data;
};

export const listBankVouchers = async (
  voucherType: BankVoucherType,
  params?: BankVoucherListParams
): Promise<BankVoucherListResult> => {
  const response = await apiClient.get<any>(bankVoucherBase(voucherType), { params });
  return {
    items: (response.data.data ?? []) as BankVoucher[],
    total: Number(response.data.total ?? 0),
    page: Number(response.data.page ?? 1),
    limit: Number(response.data.limit ?? 20),
    totalPages: Number(response.data.totalPages ?? 1),
    totalAmount: String(response.data.totalAmount ?? '0.00'),
  };
};

export const getBankVoucherById = async (
  voucherType: BankVoucherType,
  id: string
): Promise<BankVoucher> => {
  const response = await apiClient.get<ApiResponse<BankVoucher>>(
    `${bankVoucherBase(voucherType)}/${id}`
  );
  return response.data.data;
};

export const createBankVoucher = async (
  voucherType: BankVoucherType,
  payload: BankVoucherPayload
): Promise<BankVoucher> => {
  const response = await apiClient.post<ApiResponse<BankVoucher>>(
    bankVoucherBase(voucherType),
    payload
  );
  return response.data.data;
};

export const updateBankVoucher = async (
  voucherType: BankVoucherType,
  id: string,
  payload: BankVoucherPayload
): Promise<BankVoucher> => {
  const response = await apiClient.put<ApiResponse<BankVoucher>>(
    `${bankVoucherBase(voucherType)}/${id}`,
    payload
  );
  return response.data.data;
};

export const cancelBankVoucher = async (
  voucherType: BankVoucherType,
  id: string,
  reason: string
): Promise<BankVoucher> => {
  const response = await apiClient.post<ApiResponse<BankVoucher>>(
    `${bankVoucherBase(voucherType)}/${id}/cancel`,
    { reason }
  );
  return response.data.data;
};

export type BankPaymentMode = PaymentMode;


export const getItemLookups = async (): Promise<ItemLookups> => {
  const response = await apiClient.get<ApiResponse<ItemLookups>>('/items/lookups');
  return response.data.data;
};

export const getItems = async (params?: {
  search?: string;
  itemType?: string;
  includeInactive?: boolean;
}): Promise<Item[]> => {
  const response = await apiClient.get<ApiResponse<Item[]>>('/items', { params });
  return response.data.data;
};

export const getItem = async (id: string): Promise<Item> => {
  const response = await apiClient.get<ApiResponse<Item>>(`/items/${id}`);
  return response.data.data;
};

export const createItem = async (payload: ItemPayload): Promise<Item> => {
  const response = await apiClient.post<ApiResponse<Item>>('/items', payload);
  return response.data.data;
};

export const updateItem = async (id: string, payload: ItemPayload): Promise<Item> => {
  const response = await apiClient.put<ApiResponse<Item>>(`/items/${id}`, payload);
  return response.data.data;
};

export const setItemStatus = async (id: string, isActive: boolean): Promise<Item> => {
  const response = await apiClient.patch<ApiResponse<Item>>(`/items/${id}/status`, { isActive });
  return response.data.data;
};

const orderBase = (documentType: OrderDocumentType): string =>
  documentType === 'SALES_ORDER' ? '/sales-orders' : '/purchase-orders';

export const getOrderLookups = async (documentType: OrderDocumentType): Promise<OrderLookups> => {
  const response = await apiClient.get<ApiResponse<OrderLookups>>(
    `${orderBase(documentType)}/lookups`
  );
  return response.data.data;
};

export const getNextOrderNumber = async (
  documentType: OrderDocumentType
): Promise<{ orderNumber: string }> => {
  const response = await apiClient.get<ApiResponse<{ orderNumber: string }>>(
    `${orderBase(documentType)}/next-number`
  );
  return response.data.data;
};

export const getOrderSummary = async (
  documentType: OrderDocumentType
): Promise<OrderSummary> => {
  const response = await apiClient.get<ApiResponse<OrderSummary>>(
    `${orderBase(documentType)}/summary`
  );
  return response.data.data;
};

export const listSalesOrders = async (
  params?: OrderListParams
): Promise<OrderListResult<SalesOrder>> => {
  const response = await apiClient.get<any>('/sales-orders', { params });
  return {
    items: (response.data.items ?? response.data.data ?? []) as SalesOrder[],
    total: Number(response.data.total ?? 0),
    page: Number(response.data.page ?? 1),
    limit: Number(response.data.limit ?? 20),
    totalPages: Number(response.data.totalPages ?? 1),
    totalAmount: String(response.data.totalAmount ?? '0.00'),
    totalQuantity: String(response.data.totalQuantity ?? '0.000'),
  };
};

export const listPurchaseOrders = async (
  params?: OrderListParams
): Promise<OrderListResult<PurchaseOrder>> => {
  const response = await apiClient.get<any>('/purchase-orders', { params });
  return {
    items: (response.data.items ?? response.data.data ?? []) as PurchaseOrder[],
    total: Number(response.data.total ?? 0),
    page: Number(response.data.page ?? 1),
    limit: Number(response.data.limit ?? 20),
    totalPages: Number(response.data.totalPages ?? 1),
    totalAmount: String(response.data.totalAmount ?? '0.00'),
    totalQuantity: String(response.data.totalQuantity ?? '0.000'),
  };
};

export const getSalesOrder = async (id: string): Promise<SalesOrder> => {
  const response = await apiClient.get<ApiResponse<SalesOrder>>(`/sales-orders/${id}`);
  return response.data.data;
};

export const getPurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
  const response = await apiClient.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`);
  return response.data.data;
};

export const createOrder = async (
  documentType: OrderDocumentType,
  payload: OrderPayload
): Promise<SalesOrder | PurchaseOrder> => {
  const response = await apiClient.post<ApiResponse<SalesOrder | PurchaseOrder>>(
    orderBase(documentType),
    payload
  );
  return response.data.data;
};

export const updateOrder = async (
  documentType: OrderDocumentType,
  id: string,
  payload: OrderPayload
): Promise<SalesOrder | PurchaseOrder> => {
  const response = await apiClient.put<ApiResponse<SalesOrder | PurchaseOrder>>(
    `${orderBase(documentType)}/${id}`,
    payload
  );
  return response.data.data;
};

export const confirmSalesOrder = async (id: string): Promise<SalesOrder> => {
  const response = await apiClient.post<ApiResponse<SalesOrder>>(`/sales-orders/${id}/confirm`);
  return response.data.data;
};

export const approvePurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
  const response = await apiClient.post<ApiResponse<PurchaseOrder>>(
    `/purchase-orders/${id}/approve`
  );
  return response.data.data;
};

export const sendPurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
  const response = await apiClient.post<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}/send`);
  return response.data.data;
};

export const acknowledgePurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
  const response = await apiClient.post<ApiResponse<PurchaseOrder>>(
    `/purchase-orders/${id}/acknowledge`
  );
  return response.data.data;
};

export const cancelOrder = async (
  documentType: OrderDocumentType,
  id: string,
  reason: string
): Promise<SalesOrder | PurchaseOrder> => {
  const response = await apiClient.post<ApiResponse<SalesOrder | PurchaseOrder>>(
    `${orderBase(documentType)}/${id}/cancel`,
    { reason }
  );
  return response.data.data;
};

export const copyOrder = async (
  documentType: OrderDocumentType,
  id: string
): Promise<SalesOrder | PurchaseOrder> => {
  const response = await apiClient.post<ApiResponse<SalesOrder | PurchaseOrder>>(
    `${orderBase(documentType)}/${id}/copy`
  );
  return response.data.data;
};

export const getOrderHistory = async (
  documentType: OrderDocumentType,
  id: string
): Promise<OrderStatusHistoryEntry[]> => {
  const response = await apiClient.get<ApiResponse<OrderStatusHistoryEntry[]>>(
    `${orderBase(documentType)}/${id}/history`
  );
  return response.data.data;
};

export const getOrderReports = async (
  documentType: OrderDocumentType
): Promise<OrderReportDefinition[]> => {
  const response = await apiClient.get<ApiResponse<OrderReportDefinition[]>>(
    `${orderBase(documentType)}/reports`
  );
  return response.data.data;
};

export const runOrderReport = async (
  documentType: OrderDocumentType,
  reportKey: string,
  params?: {
    fromDate?: string;
    toDate?: string;
    partyId?: string;
    itemId?: string;
    status?: string;
    search?: string;
    overdue?: boolean;
  }
): Promise<OrderReportResult> => {
  const response = await apiClient.get<ApiResponse<OrderReportResult>>(
    `${orderBase(documentType)}/reports/${reportKey}`,
    { params }
  );
  return response.data.data;
};

// =============================================================
// Phase 14: Debit Note APIs
// =============================================================

export interface DebitNoteBook {
  id: string;
  prefix: string;
  bookName: string;
  openingBalance: string;
  balance: string;
  balanceType: 'Dr' | 'Cr';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DebitNoteBillLine {
  id?: string;
  lineNumber: number;
  billNo: string;
  billDate: string;
  totalDays: number;
  dharaDays: number;
  interestDays: number;
  paidAmount: number;
  paidDate?: string | null;
  itemDescription?: string | null;
  quantity: number;
  billTaxable: number;
  billAmount: number;
  unpaidAmount: number;
  sgstRate: number;
  cgstRate: number;
  igstRate: number;
  rate: number;
  basicAmount: number;
  sourceBillId?: string | null;
  sourceBillType?: string | null;
}

export interface DebitNote {
  id: string;
  companyId: string;
  financialYearId: string;
  bookId: string;
  voucherNumber: number;
  noteNumber: string;
  noteDate: string;
  partyNoteNo?: string | null;
  noteType: 'SALES' | 'PURCHASE' | 'BOTH';
  partyId: string;
  dueDays: number;
  creditAccountId: string;
  osEffect: string;
  reason: 'CASH_DISCOUNT' | 'QUANTITY_DISCOUNT' | 'RATE_DIFFERENCE' | 'INTEREST' | 'TCS';
  calculationBasis: 'BILL_AMOUNT' | 'TAXABLE_AMOUNT' | 'BASIC_AMOUNT';
  gstRate: string | number;
  tdsRate: string | number;
  tdsAmount: string | number;
  tdsSection?: string | null;
  tdsAccount?: string | null;
  remark?: string | null;
  brokerId?: string | null;
  transporterId?: string | null;
  salespersonId?: string | null;
  vehicleNumber?: string | null;
  basicAmount: string | number;
  taxableValue: string | number;
  cgstRate: string | number;
  cgstAmount: string | number;
  sgstRate: string | number;
  sgstAmount: string | number;
  igstRate: string | number;
  igstAmount: string | number;
  tcsAmount: string | number;
  roundOff: string | number;
  totalAmount: string | number;
  status: 'DRAFT' | 'CONFIRMED' | 'POSTED' | 'CANCELLED';
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  book?: DebitNoteBook;
  party?: {
    id: string;
    partyName: string;
    partyCode: string;
    partyType: string;
    gstin?: string | null;
    panNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    openingBalance?: string | number;
    balanceType?: string;
  };
  creditAccount?: {
    id: string;
    accountCode: string;
    accountName: string;
    accountGroup: string;
  };
  billLines: DebitNoteBillLine[];
  journalLines?: any[];
}

export interface CreateDebitNotePayload {
  bookId: string;
  noteDate: string;
  partyNoteNo?: string | null;
  noteType: 'SALES' | 'PURCHASE' | 'BOTH';
  partyId: string;
  dueDays?: number;
  creditAccountId: string;
  osEffect?: string;
  reason: 'CASH_DISCOUNT' | 'QUANTITY_DISCOUNT' | 'RATE_DIFFERENCE' | 'INTEREST' | 'TCS';
  calculationBasis: 'BILL_AMOUNT' | 'TAXABLE_AMOUNT' | 'BASIC_AMOUNT';
  gstRate?: number;
  tcsAmount?: number;
  tdsRate?: number;
  tdsAmount?: number;
  tdsSection?: string | null;
  tdsAccount?: string | null;
  remark?: string | null;
  brokerId?: string | null;
  transporterId?: string | null;
  salespersonId?: string | null;
  vehicleNumber?: string | null;
  billLines: Array<{
    billNo: string;
    billDate: string;
    totalDays?: number;
    dharaDays?: number;
    interestDays?: number;
    paidAmount?: number;
    paidDate?: string | null;
    itemDescription?: string | null;
    quantity?: number;
    billTaxable?: number;
    billAmount?: number;
    unpaidAmount?: number;
    sgstRate?: number;
    cgstRate?: number;
    igstRate?: number;
    rate?: number;
    basicAmount?: number;
    sourceBillId?: string | null;
    sourceBillType?: string | null;
  }>;
}

export const getDebitNoteBooks = async (options?: { includeInactive?: boolean }): Promise<DebitNoteBook[]> => {
  const response = await apiClient.get<ApiResponse<DebitNoteBook[]>>('/transactions/debit-note-books', {
    params: options,
  });
  return response.data.data;
};

export const getDebitNoteBookById = async (id: string): Promise<DebitNoteBook> => {
  const response = await apiClient.get<ApiResponse<DebitNoteBook>>(`/transactions/debit-note-books/${id}`);
  return response.data.data;
};

export const createDebitNoteBook = async (payload: {
  prefix: string;
  bookName: string;
  openingBalance?: number;
  balanceType?: 'DEBIT' | 'CREDIT';
}): Promise<DebitNoteBook> => {
  const response = await apiClient.post<ApiResponse<DebitNoteBook>>('/transactions/debit-note-books', payload);
  return response.data.data;
};

export const listDebitNotes = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  bookId?: string;
  partyId?: string;
  noteType?: string;
  reason?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ data: DebitNote[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const response = await apiClient.get<any>('/transactions/debit-notes', { params });
  return response.data;
};

export const getDebitNoteById = async (id: string): Promise<DebitNote> => {
  const response = await apiClient.get<ApiResponse<DebitNote>>(`/transactions/debit-notes/${id}`);
  return response.data.data;
};

export const createDebitNote = async (payload: CreateDebitNotePayload): Promise<DebitNote> => {
  const response = await apiClient.post<ApiResponse<DebitNote>>('/transactions/debit-notes', payload);
  return response.data.data;
};

export const updateDebitNote = async (id: string, payload: CreateDebitNotePayload): Promise<DebitNote> => {
  const response = await apiClient.put<ApiResponse<DebitNote>>(`/transactions/debit-notes/${id}`, payload);
  return response.data.data;
};

export const cancelDebitNote = async (id: string, cancellationReason: string): Promise<DebitNote> => {
  const response = await apiClient.post<ApiResponse<DebitNote>>(`/transactions/debit-notes/${id}/cancel`, {
    cancellationReason,
  });
  return response.data.data;
};

export const getEligibleDebitNoteBills = async (partyId: string, noteType: string): Promise<any[]> => {
  const response = await apiClient.get<ApiResponse<any[]>>('/transactions/debit-notes/eligible-bills', {
    params: { partyId, noteType },
  });
  return response.data.data;
};

export const getDebitNoteNavigation = async (
  id: string
): Promise<{ previous: { id: string; noteNumber: string } | null; next: { id: string; noteNumber: string } | null }> => {
  const response = await apiClient.get<ApiResponse<any>>(`/transactions/debit-notes/${id}/navigation`);
  return response.data.data;
};

export interface DebitNoteSummary {
  active: {
    _count: { _all: number };
    _sum: {
      totalAmount: string | null;
      taxableValue: string | null;
      cgstAmount: string | null;
      sgstAmount: string | null;
      igstAmount: string | null;
    };
  };
  cancelled: {
    _count: { _all: number };
    _sum: { totalAmount: string | null };
  };
  byType: Array<{
    noteType: 'SALES' | 'PURCHASE' | 'BOTH';
    _count: { _all: number };
    _sum: { totalAmount: string | null };
  }>;
}

export interface DebitNoteNextNumber {
  bookId: string;
  bookName: string;
  prefix: string;
  voucherNumber: number;
  noteNumber: string;
}

export const getDebitNoteNextNumber = async (bookId: string): Promise<DebitNoteNextNumber> => {
  const response = await apiClient.get<ApiResponse<DebitNoteNextNumber>>('/transactions/debit-notes/next-number', {
    params: { bookId },
  });
  return response.data.data;
};

export const getDebitNoteSummary = async (): Promise<DebitNoteSummary> => {
  const response = await apiClient.get<ApiResponse<DebitNoteSummary>>('/transactions/debit-notes/summary');
  return response.data.data;
};

export const getDebitNotePartyBalance = async (
  partyId: string
): Promise<{ partyId: string; ledgerId: string | null; balance: string; balanceType: 'Dr' | 'Cr'; source: string }> => {
  const response = await apiClient.get<ApiResponse<any>>('/transactions/debit-notes/party-balance', {
    params: { partyId },
  });
  return response.data.data;
};

export const getDebitNotePrintRange = async (params: {
  bookId?: string;
  from: number;
  to: number;
  partyId?: string;
}): Promise<DebitNote[]> => {
  const response = await apiClient.get<ApiResponse<DebitNote[]>>('/transactions/debit-notes/print-range', {
    params,
  });
  return response.data.data;
};

// -------------------------------------------------------------
// Sales & Purchase Report - Bill Base (Phase 15)
// -------------------------------------------------------------
export const getReportBillBaseOptions = async (): Promise<ReportOptionsResponse> => {
  const response = await apiClient.get<ApiResponse<ReportOptionsResponse>>('/reports/bill-base/options');
  return response.data.data;
};

export const runReportBillBase = async (payload: ReportRunRequest): Promise<ReportRunResponse> => {
  const response = await apiClient.post<ApiResponse<ReportRunResponse>>('/reports/bill-base/run', payload, {
    timeout: 60000,
  });
  return response.data.data;
};

export const exportReportBillBaseXlsx = async (
  payload: ReportRunRequest
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.post('/reports/bill-base/export', payload, {
    responseType: 'blob',
    timeout: 120000,
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return { blob: response.data as Blob, filename: match ? match[1] : 'bill-base-report.xlsx' };
};

export const getReportBillBaseItemDetails = async (
  sourceType: string,
  sourceId: string
): Promise<ReportItemDetailsResponse> => {
  const response = await apiClient.get<ApiResponse<ReportItemDetailsResponse>>('/reports/bill-base/item-details', {
    params: { sourceType, sourceId },
  });
  return response.data.data;
};

export const exportReportBillBasePdf = async (
  payload: ReportRunRequest
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.post('/reports/bill-base/export/pdf', payload, {
    responseType: 'blob',
    timeout: 180000,
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return { blob: response.data as Blob, filename: match ? match[1] : 'bill-base-report.pdf' };
};

// -------------------------------------------------------------
// Phase 15.1 - persistent column layouts (company scoped)
// -------------------------------------------------------------
export const getReportColumnLayouts = async (reportType = 'BILL_BASE'): Promise<ReportSavedLayout[]> => {
  const response = await apiClient.get<ApiResponse<ReportSavedLayout[]>>('/reports/column-layouts', {
    params: { reportType },
  });
  return response.data.data;
};

export const createReportColumnLayout = async (payload: {
  name: string;
  columns: string[];
  reportType?: string;
  isDefault?: boolean;
}): Promise<ReportSavedLayout> => {
  const response = await apiClient.post<ApiResponse<ReportSavedLayout>>('/reports/column-layouts', payload);
  return response.data.data;
};

export const updateReportColumnLayout = async (
  id: string,
  payload: { name?: string; columns?: string[]; reportType?: string; isDefault?: boolean }
): Promise<ReportSavedLayout> => {
  const response = await apiClient.put<ApiResponse<ReportSavedLayout>>('/reports/column-layouts/' + id, payload);
  return response.data.data;
};

export const deleteReportColumnLayout = async (id: string, reportType = 'BILL_BASE'): Promise<void> => {
  await apiClient.delete('/reports/column-layouts/' + id, { params: { reportType } });
};

export const setDefaultReportColumnLayout = async (
  id: string,
  reportType = 'BILL_BASE'
): Promise<ReportSavedLayout> => {
  const response = await apiClient.post<ApiResponse<ReportSavedLayout>>(
    '/reports/column-layouts/' + id + '/default',
    {},
    { params: { reportType } }
  );
  return response.data.data;
};

// =============================================================
// Phase 15.2 - report master data (company scoped)
// =============================================================

export const getPartyGroups = async (params?: MasterListParams): Promise<PartyGroupRecord[]> => {
  const response = await apiClient.get<ApiResponse<PartyGroupRecord[]>>('/masters/party-groups', { params });
  return response.data.data;
};

export const createPartyGroup = async (data: Partial<PartyGroupRecord>): Promise<PartyGroupRecord> => {
  const response = await apiClient.post<ApiResponse<PartyGroupRecord>>('/masters/party-groups', data);
  return response.data.data;
};

export const updatePartyGroup = async (
  id: string,
  data: Partial<PartyGroupRecord>
): Promise<PartyGroupRecord> => {
  const response = await apiClient.patch<ApiResponse<PartyGroupRecord>>('/masters/party-groups/' + id, data);
  return response.data.data;
};

export const setPartyGroupStatus = async (id: string, isActive: boolean): Promise<PartyGroupRecord> => {
  const response = await apiClient.patch<ApiResponse<PartyGroupRecord>>('/masters/party-groups/' + id + '/status', {
    isActive,
  });
  return response.data.data;
};

export const getAreas = async (params?: MasterListParams): Promise<AreaRecord[]> => {
  const response = await apiClient.get<ApiResponse<AreaRecord[]>>('/masters/areas', { params });
  return response.data.data;
};

export const createArea = async (data: Partial<AreaRecord>): Promise<AreaRecord> => {
  const response = await apiClient.post<ApiResponse<AreaRecord>>('/masters/areas', data);
  return response.data.data;
};

export const updateArea = async (id: string, data: Partial<AreaRecord>): Promise<AreaRecord> => {
  const response = await apiClient.patch<ApiResponse<AreaRecord>>('/masters/areas/' + id, data);
  return response.data.data;
};

export const setAreaStatus = async (id: string, isActive: boolean): Promise<AreaRecord> => {
  const response = await apiClient.patch<ApiResponse<AreaRecord>>('/masters/areas/' + id + '/status', { isActive });
  return response.data.data;
};

export const getBrokers = async (params?: MasterListParams): Promise<BrokerRecord[]> => {
  const response = await apiClient.get<ApiResponse<BrokerRecord[]>>('/masters/brokers', { params });
  return response.data.data;
};

export const createBroker = async (data: Partial<BrokerRecord>): Promise<BrokerRecord> => {
  const response = await apiClient.post<ApiResponse<BrokerRecord>>('/masters/brokers', data);
  return response.data.data;
};

export const updateBroker = async (id: string, data: Partial<BrokerRecord>): Promise<BrokerRecord> => {
  const response = await apiClient.patch<ApiResponse<BrokerRecord>>('/masters/brokers/' + id, data);
  return response.data.data;
};

export const setBrokerStatus = async (id: string, isActive: boolean): Promise<BrokerRecord> => {
  const response = await apiClient.patch<ApiResponse<BrokerRecord>>('/masters/brokers/' + id + '/status', { isActive });
  return response.data.data;
};

export const getTransporters = async (params?: MasterListParams): Promise<TransporterRecord[]> => {
  const response = await apiClient.get<ApiResponse<TransporterRecord[]>>('/masters/transporters', { params });
  return response.data.data;
};

export const createTransporter = async (data: Partial<TransporterRecord>): Promise<TransporterRecord> => {
  const response = await apiClient.post<ApiResponse<TransporterRecord>>('/masters/transporters', data);
  return response.data.data;
};

export const updateTransporter = async (
  id: string,
  data: Partial<TransporterRecord>
): Promise<TransporterRecord> => {
  const response = await apiClient.patch<ApiResponse<TransporterRecord>>('/masters/transporters/' + id, data);
  return response.data.data;
};

export const setTransporterStatus = async (id: string, isActive: boolean): Promise<TransporterRecord> => {
  const response = await apiClient.patch<ApiResponse<TransporterRecord>>(
    '/masters/transporters/' + id + '/status',
    { isActive }
  );
  return response.data.data;
};

export const getSalespersons = async (params?: MasterListParams): Promise<SalespersonRecord[]> => {
  const response = await apiClient.get<ApiResponse<SalespersonRecord[]>>('/masters/salespersons', { params });
  return response.data.data;
};

export const createSalesperson = async (data: Partial<SalespersonRecord>): Promise<SalespersonRecord> => {
  const response = await apiClient.post<ApiResponse<SalespersonRecord>>('/masters/salespersons', data);
  return response.data.data;
};

export const updateSalesperson = async (
  id: string,
  data: Partial<SalespersonRecord>
): Promise<SalespersonRecord> => {
  const response = await apiClient.patch<ApiResponse<SalespersonRecord>>('/masters/salespersons/' + id, data);
  return response.data.data;
};

export const setSalespersonStatus = async (id: string, isActive: boolean): Promise<SalespersonRecord> => {
  const response = await apiClient.patch<ApiResponse<SalespersonRecord>>(
    '/masters/salespersons/' + id + '/status',
    { isActive }
  );
  return response.data.data;
};

export const getItemGroups = async (params?: MasterListParams): Promise<ItemGroupRecord[]> => {
  const response = await apiClient.get<ApiResponse<ItemGroupRecord[]>>('/masters/item-groups', { params });
  return response.data.data;
};

export const createItemGroup = async (data: Partial<ItemGroupRecord>): Promise<ItemGroupRecord> => {
  const response = await apiClient.post<ApiResponse<ItemGroupRecord>>('/masters/item-groups', data);
  return response.data.data;
};

export const updateItemGroup = async (id: string, data: Partial<ItemGroupRecord>): Promise<ItemGroupRecord> => {
  const response = await apiClient.patch<ApiResponse<ItemGroupRecord>>('/masters/item-groups/' + id, data);
  return response.data.data;
};

export const setItemGroupStatus = async (id: string, isActive: boolean): Promise<ItemGroupRecord> => {
  const response = await apiClient.patch<ApiResponse<ItemGroupRecord>>('/masters/item-groups/' + id + '/status', {
    isActive,
  });
  return response.data.data;
};

export const getPurchaseBooks = async (params?: {
  financialYearId?: string;
  includeInactive?: boolean;
}): Promise<PurchaseBookRecord[]> => {
  const response = await apiClient.get<ApiResponse<PurchaseBookRecord[]>>('/masters/purchase-books', { params });
  return response.data.data;
};

export const createPurchaseBook = async (data: Partial<PurchaseBookRecord>): Promise<PurchaseBookRecord> => {
  const response = await apiClient.post<ApiResponse<PurchaseBookRecord>>('/masters/purchase-books', data);
  return response.data.data;
};

export const updatePurchaseBook = async (
  id: string,
  data: Partial<PurchaseBookRecord>
): Promise<PurchaseBookRecord> => {
  const response = await apiClient.patch<ApiResponse<PurchaseBookRecord>>('/masters/purchase-books/' + id, data);
  return response.data.data;
};

export const setPurchaseBookStatus = async (id: string, isActive: boolean): Promise<PurchaseBookRecord> => {
  const response = await apiClient.patch<ApiResponse<PurchaseBookRecord>>(
    '/masters/purchase-books/' + id + '/status',
    { isActive }
  );
  return response.data.data;
};


// -------------------------------------------------------------
// Phase 16 - Bank Reconciliation
// -------------------------------------------------------------
export const getBankReconciliationBanks = async (): Promise<BankBookOption[]> => {
  const response = await apiClient.get<ApiResponse<BankBookOption[]>>('/reports/bank-reconciliation/banks');
  return response.data.data;
};

export const getBankReconciliation = async (
  params: ReconciliationScopeRequest
): Promise<ReconciliationContext> => {
  const response = await apiClient.get<ApiResponse<ReconciliationContext>>('/reports/bank-reconciliation', {
    params,
  });
  return response.data.data;
};

export const saveBankReconciliationOpeningBalance = async (
  payload: ReconciliationOpeningPayload
): Promise<ReconciliationOpeningSaveResult> => {
  const response = await apiClient.post<ApiResponse<ReconciliationOpeningSaveResult>>(
    '/reports/bank-reconciliation/opening-balance',
    payload
  );
  return response.data.data;
};

export const saveBankReconciliationStatementBalance = async (
  payload: ReconciliationStatementBalancePayload
): Promise<ReconciliationStatementSaveResult> => {
  const response = await apiClient.post<ApiResponse<ReconciliationStatementSaveResult>>(
    '/reports/bank-reconciliation/statement-balance',
    payload
  );
  return response.data.data;
};

export const markBankReconciliationLine = async (
  journalLineId: string,
  clearingDate: string
): Promise<ReconciliationMarkResult> => {
  const response = await apiClient.post<ApiResponse<ReconciliationMarkResult>>(
    '/reports/bank-reconciliation/' + journalLineId + '/reconcile',
    { clearingDate }
  );
  return response.data.data;
};

export const removeBankReconciliationLine = async (
  journalLineId: string,
  reason?: string
): Promise<ReconciliationMarkResult> => {
  const response = await apiClient.delete<ApiResponse<ReconciliationMarkResult>>(
    '/reports/bank-reconciliation/' + journalLineId + '/reconcile',
    { data: { reason } }
  );
  return response.data.data;
};

export const getBankReconciliationTransactions = async (
  params: ReconciliationScopeRequest & { viewType?: ReconciliationViewType }
): Promise<ReconciliationTransactionsResponse> => {
  const response = await apiClient.get<ApiResponse<ReconciliationTransactionsResponse>>(
    '/reports/bank-reconciliation/transactions',
    { params }
  );
  return response.data.data;
};

export const getBankReconciliationSummary = async (
  params: ReconciliationScopeRequest
): Promise<ReconciliationSummaryResponse> => {
  const response = await apiClient.get<ApiResponse<ReconciliationSummaryResponse>>(
    '/reports/bank-reconciliation/summary',
    { params }
  );
  return response.data.data;
};

export const getBankReconciliationStatement = async (
  params: ReconciliationScopeRequest
): Promise<ReconciliationStatementResponse> => {
  const response = await apiClient.get<ApiResponse<ReconciliationStatementResponse>>(
    '/reports/bank-reconciliation/statement',
    { params }
  );
  return response.data.data;
};

export const exportBankReconciliationPdf = async (
  payload: ReconciliationPdfPayload
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.post('/reports/bank-reconciliation/export/pdf', payload, {
    responseType: 'blob',
    timeout: 180000,
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/.exec(disposition);
  return { blob: response.data as Blob, filename: match ? match[1] : 'bank-reconciliation.pdf' };
};


// -------------------------------------------------------------
// Phase 17 - Bank Book & Account Ledger reports
// -------------------------------------------------------------
const readDownloadName = (disposition: unknown, fallback: string): string => {
  const match = /filename="?([^";]+)"?/.exec(String(disposition ?? ''));
  return match ? match[1] : fallback;
};

export const getBankBookOptions = async (): Promise<BankBookOptions> => {
  const response = await apiClient.get<ApiResponse<BankBookOptions>>('/reports/bank-book/options');
  return response.data.data;
};

export const runBankBook = async (payload: BankBookRunRequest): Promise<BankBookReportResult> => {
  const response = await apiClient.post<ApiResponse<BankBookReportResult>>(
    '/reports/bank-book/run',
    payload,
    { timeout: 60000 }
  );
  return response.data.data;
};

export const exportBankBookPdf = async (
  payload: BankBookRunRequest & { pdfOrientation?: 'portrait' | 'landscape' }
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.post('/reports/bank-book/export/pdf', payload, {
    responseType: 'blob',
    timeout: 180000,
  });
  return {
    blob: response.data as Blob,
    filename: readDownloadName(response.headers['content-disposition'], 'bank-book.pdf'),
  };
};

export const exportBankBookXlsx = async (
  payload: BankBookRunRequest
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.post('/reports/bank-book/export', payload, {
    responseType: 'blob',
    timeout: 180000,
  });
  return {
    blob: response.data as Blob,
    filename: readDownloadName(response.headers['content-disposition'], 'bank-book.xlsx'),
  };
};

export const getBankBookSavedReports = async (): Promise<BankBookSavedReportRecord[]> => {
  const response = await apiClient.get<ApiResponse<BankBookSavedReportRecord[]>>(
    '/reports/bank-book/saved'
  );
  return response.data.data;
};

export const createBankBookSavedReport = async (
  payload: Record<string, unknown>
): Promise<BankBookSavedReportRecord> => {
  const response = await apiClient.post<ApiResponse<BankBookSavedReportRecord>>(
    '/reports/bank-book/saved',
    payload
  );
  return response.data.data;
};

export const updateBankBookSavedReport = async (
  id: string,
  payload: Record<string, unknown>
): Promise<BankBookSavedReportRecord> => {
  const response = await apiClient.put<ApiResponse<BankBookSavedReportRecord>>(
    '/reports/bank-book/saved/' + id,
    payload
  );
  return response.data.data;
};

export const deleteBankBookSavedReport = async (id: string): Promise<void> => {
  await apiClient.delete('/reports/bank-book/saved/' + id);
};

export const getAccountLedgerOptions = async (): Promise<AccountLedgerOptions> => {
  const response = await apiClient.get<ApiResponse<AccountLedgerOptions>>(
    '/reports/account-ledger/options'
  );
  return response.data.data;
};

export const runAccountLedger = async (
  payload: AccountLedgerRunRequest
): Promise<AccountLedgerReportResult> => {
  const response = await apiClient.post<ApiResponse<AccountLedgerReportResult>>(
    '/reports/account-ledger/run',
    payload,
    { timeout: 60000 }
  );
  return response.data.data;
};

export const exportAccountLedgerPdf = async (
  payload: AccountLedgerRunRequest
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.post('/reports/account-ledger/export/pdf', payload, {
    responseType: 'blob',
    timeout: 180000,
  });
  return {
    blob: response.data as Blob,
    filename: readDownloadName(response.headers['content-disposition'], 'account-ledger.pdf'),
  };
};

export const exportAccountLedgerXlsx = async (
  payload: AccountLedgerRunRequest
): Promise<{ blob: Blob; filename: string }> => {
  const response = await apiClient.post('/reports/account-ledger/export', payload, {
    responseType: 'blob',
    timeout: 180000,
  });
  return {
    blob: response.data as Blob,
    filename: readDownloadName(response.headers['content-disposition'], 'account-ledger.xlsx'),
  };
};
