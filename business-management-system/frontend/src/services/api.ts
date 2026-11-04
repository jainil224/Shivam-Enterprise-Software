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
} from '../types';

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