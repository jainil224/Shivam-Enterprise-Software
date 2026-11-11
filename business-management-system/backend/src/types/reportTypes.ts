// Phase 15 - Sales & Purchase Report (Bill Base): shared report contracts.
// Every field maps to a real Prisma column; nothing is fabricated.

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

// Phase 15.1 - dataset-wide column filters. Only operators valid for the
// column data type are accepted; anything else is a validation error.
export type ReportFilterOperator =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'before'
  | 'after'
  | 'empty'
  | 'notEmpty';

export interface ReportColumnFilter {
  key: string;
  operator: ReportFilterOperator;
  value?: string | null;
  valueTo?: string | null;
}

export interface ReportFilterOperatorDef {
  value: ReportFilterOperator;
  label: string;
  types: ReportColumnType[];
}

// Phase 15.1 - a saved column layout persisted in PostgreSQL, company scoped.
export interface ReportColumnLayout {
  id: string;
  reportType: string;
  name: string;
  columns: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  unavailableColumns: string[];
}

export interface ReportColumnLayoutInput {
  reportType?: string;
  name: string;
  columns: string[];
  isDefault?: boolean;
}

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
  partyGroupId: string | null;
  partyGroup: string;
  areaId: string | null;
  partyArea: string;
  deliveryPartyId: string | null;
  deliveryParty: string;
  brokerId: string | null;
  broker: string;
  transporterId: string | null;
  transporter: string;
  salespersonId: string | null;
  salesperson: string;
  vehicle: string;
  dueDays: number | null;
  bookId: string | null;
  bookName: string;
  quality: string;
  grade: string;
  lotNumber: string;
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
  basicAmount: number;
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
  note?: string;
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
  /** Phase 15.2 - keys used to refresh dependent filters (e.g. a party's group/area). */
  partyGroupId?: string | null;
  areaId?: string | null;
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
  partyGroups: ReportFilterOption[];
  areas: ReportFilterOption[];
  brokers: ReportFilterOption[];
  transporters: ReportFilterOption[];
  salespersons: ReportFilterOption[];
  vehicles: ReportFilterOption[];
  items: ReportFilterOption[];
  itemFilter: { masterItemCount: number; billItemCount: number; note: string };
  itemGroups: ReportFilterOption[];
  cities: ReportFilterOption[];
  qualities: ReportFilterOption[];
  unavailableFilters: Array<{ key: string; label: string; reason: string }>;
  filterOperators: ReportFilterOperatorDef[];
  requiredColumns: string[];
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
  partyGroupId?: string | null;
  areaId?: string | null;
  deliveryPartyId?: string | null;
  brokerId?: string | null;
  transporterId?: string | null;
  salespersonId?: string | null;
  vehicle?: string | null;
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
  columnFilters?: ReportColumnFilter[];
  pdfOrientation?: 'portrait' | 'landscape';
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
    columnFilters: ReportColumnFilter[];
    activeFilters: string[];
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
