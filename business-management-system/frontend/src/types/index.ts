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
  openingBalance: string | number;
  balanceType: BalanceType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
