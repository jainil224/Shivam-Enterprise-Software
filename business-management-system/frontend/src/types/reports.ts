// Phase 15 - Sales & Purchase Report (Bill Base): frontend contracts.
// Mirrors backend/src/types/reportTypes.ts exactly.

export type ReportSourceType =
  | 'PURCHASE'
  | 'SALES'
  | 'GENERAL_PURCHASE'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN'
  | 'SALES_DEBIT_NOTE'
  | 'PURCHASE_DEBIT_NOTE'
  | 'SALES_CREDIT_NOTE'
  | 'PURCHASE_CREDIT_NOTE';

export type ReportMode = 'SALES' | 'PURCHASE' | 'EXPENSE' | 'SELECTED';
export type ReportDetailMode = 'DETAIL' | 'SUMMARY';
export type ReportRateColumn = 'BASIC' | 'AVG' | 'NET' | 'ALL';
export type ReportColumnType = 'text' | 'number' | 'date' | 'currency';
export type ReportColumnAlign = 'left' | 'right' | 'center';
export type ReportFormatSupport = 'FULL' | 'PARTIAL' | 'UNAVAILABLE';

export interface ReportColumnDef {
  key: string;
  label: string;
  type: ReportColumnType;
  align: ReportColumnAlign;
  width: number;
}

export interface ReportUnitTotal {
  unit: string;
  quantity: number;
}

export interface ReportItemLine {
  lineNumber: number;
  itemName: string;
  itemCode: string;
  quality: string;
  grade: string;
  lotNumber: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  taxableAmount: number;
}

export interface ReportRow {
  key: string;
  sourceType: ReportSourceType;
  sourceLabel: string;
  sourceId: string;
  documentNo: string;
  documentDate: string;
  partyId: string | null;
  partyName: string;
  partyGstin: string;
  partyCity: string;
  partyState: string;
  bookId: string | null;
  bookName: string;
  quality: string;
  hsnCode: string;
  itemGroup: string;
  itemDescription: string;
  quantity: number | null;
  unit: string;
  unitTotals: ReportUnitTotal[];
  taxRate: number | null;
  basicRate: number | null;
  avgRate: number | null;
  netRate: number | null;
  discountAmount: number;
  taxableAmount: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  roundOff: number;
  billAmount: number;
  status: string;
  itemCount: number;
  monthKey: string;
  itemLines: ReportItemLine[];
  groupValues: Record<string, string>;
  values: Record<string, string | number | null>;
}

export interface ReportTotals {
  quantity: number | null;
  unitTotals: ReportUnitTotal[];
  taxableAmount: number;
  sgstAmount: number;
  cgstAmount: number;
  igstAmount: number;
  roundOff: number;
  billAmount: number;
  documentCount: number;
  itemCount: number;
}

export interface ReportSourceSubtotal extends ReportTotals {
  sourceType: ReportSourceType;
  sourceLabel: string;
  direction: string;
}

export interface ReportGroupSummary {
  key: string;
  label: string;
  field: string;
  level: number;
  count: number;
  totals: ReportTotals;
  children?: ReportGroupSummary[];
}

export interface ReportFormatDef {
  key: string;
  label: string;
  groupBy: string[];
  support: ReportFormatSupport;
  reason?: string;
}

export interface ReportSourceDef {
  key: ReportSourceType;
  label: string;
  supported: boolean;
  reason?: string;
  direction?: string;
}

export interface ReportFilterOption {
  value: string;
  label: string;
  meta?: string;
}

export interface ReportOptionsResponse {
  company: { id: string; name: string; gstin: string; address: string; city: string; state: string; phone: string };
  financialYear: { id: string; yearName: string; startDate: string; endDate: string };
  defaultDateFrom: string;
  defaultDateTo: string;
  formats: ReportFormatDef[];
  sources: ReportSourceDef[];
  books: ReportFilterOption[];
  parties: ReportFilterOption[];
  items: ReportFilterOption[];
  itemGroups: ReportFilterOption[];
  cities: ReportFilterOption[];
  qualities: ReportFilterOption[];
  unavailableFilters: Array<{ key: string; label: string; reason: string }>;
  columns: ReportColumnDef[];
  standardColumns: string[];
  rateColumns: Array<{ value: ReportRateColumn; label: string }>;
  detailModes: Array<{ value: ReportDetailMode; label: string }>;
  modes: Array<{ value: ReportMode; label: string; available: boolean; reason?: string }>;
}

export interface ReportRunRequest {
  dateFrom: string;
  dateTo: string;
  mode: ReportMode;
  sources?: ReportSourceType[];
  format: string;
  bookId?: string | null;
  partyId?: string | null;
  itemId?: string | null;
  itemGroup?: string | null;
  quality?: string | null;
  partyCity?: string | null;
  rateColumn?: ReportRateColumn;
  rateFrom?: number | null;
  rateTo?: number | null;
  detailMode?: ReportDetailMode;
  printItemDetails?: boolean;
  columns?: string[];
  groupBy?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: string | null;
  sortDir?: 'asc' | 'desc';
  includeCancelled?: boolean;
}

export interface ReportRunResponse {
  meta: {
    reportTitle: string;
    reportName: string;
    formatLabel: string;
    mode: ReportMode;
    modeLabel: string;
    detailMode: ReportDetailMode;
    companyName: string;
    dateFrom: string;
    dateTo: string;
    financialYear: string;
    sourceLabels: string[];
    printItemDetails: boolean;
    rateColumn: ReportRateColumn;
  };
  columns: ReportColumnDef[];
  rows: ReportRow[];
  groups: ReportGroupSummary[];
  groupBy: string[];
  totals: {
    bySource: ReportSourceSubtotal[];
    grandTotal: number | null;
    grandTotalAllowed: boolean;
    grandTotalReason: string;
    all: ReportTotals;
  };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  rowCount: number;
  warnings: string[];
  unavailable: { reason: string } | null;
}

export interface ReportItemDetailsResponse {
  sourceType: ReportSourceType;
  sourceId: string;
  documentNo: string;
  documentDate: string;
  itemLines: ReportItemLine[];
}

// Client-side state carried from the configuration screen to the results
// screen and the print preview (sessionStorage, same tab only).
export interface ReportSavedLayout {
  id: string;
  name: string;
  columns: string[];
}

export interface ReportPageState {
  request: ReportRunRequest;
  response: ReportRunResponse;
  layoutName: string;
  landscape: boolean;
}
