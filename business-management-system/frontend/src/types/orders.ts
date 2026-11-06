// =============================================================
// Phase 13 — Item Master, Sales Orders & Purchase Orders
// =============================================================

export type OrderDocumentType = 'SALES_ORDER' | 'PURCHASE_ORDER';
export type OrderTaxType = 'INTRA_STATE' | 'INTER_STATE';
export type OrderPriority = 'NORMAL' | 'URGENT';

export type SalesOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CLOSED'
  | 'CANCELLED';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'APPROVED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export type UnitOfMeasure =
  | 'KG'
  | 'GRAM'
  | 'METER'
  | 'YARD'
  | 'PIECE'
  | 'ROLL'
  | 'BOX'
  | 'CARTON'
  | 'PACKET'
  | 'NOS';

export type ItemType = 'YARN' | 'RAW_MATERIAL' | 'FABRIC' | 'OTHER';

export const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  KG: 'KG',
  GRAM: 'Gram',
  METER: 'Meter',
  YARD: 'Yard',
  PIECE: 'Piece',
  ROLL: 'Roll',
  BOX: 'Box',
  CARTON: 'Carton',
  PACKET: 'Packet',
  NOS: 'Nos',
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  YARN: 'Yarn',
  RAW_MATERIAL: 'Raw Material',
  FABRIC: 'Fabric',
  OTHER: 'Other',
};

export const TAX_TYPE_LABELS: Record<OrderTaxType, string> = {
  INTRA_STATE: 'Intra-State (CGST + SGST)',
  INTER_STATE: 'Inter-State (IGST)',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  APPROVED: 'Approved',
  SENT: 'Sent',
  ACKNOWLEDGED: 'Acknowledged',
  PARTIALLY_FULFILLED: 'Partially Fulfilled',
  FULFILLED: 'Fulfilled',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

// -------------------------------------------------------------
// Item Master
// -------------------------------------------------------------

export interface Item {
  id: string;
  companyId: string;
  itemCode: string;
  itemName: string;
  itemCategory: string | null;
  itemType: ItemType;
  unit: UnitOfMeasure;
  hsnCode: string | null;
  gstRate: string;
  defaultSalesRate: string;
  defaultPurchaseRate: string;
  barcode: string | null;
  description: string | null;
  yarnQualityId: string | null;
  yarnQualityName: string | null;
  yarnGradeId: string | null;
  yarnGradeName: string | null;
  yarnCount: string | null;
  denier: string | null;
  lotNumber: string | null;
  fabricType: string | null;
  fabricDesign: string | null;
  colour: string | null;
  sizeSpecification: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemPayload {
  itemCode?: string;
  itemName?: string;
  itemCategory?: string | null;
  itemType?: ItemType;
  unit?: UnitOfMeasure;
  hsnCode?: string | null;
  gstRate?: string | number | null;
  defaultSalesRate?: string | number | null;
  defaultPurchaseRate?: string | number | null;
  barcode?: string | null;
  description?: string | null;
  yarnQualityId?: string | null;
  yarnGradeId?: string | null;
  yarnCount?: string | null;
  denier?: string | null;
  lotNumber?: string | null;
  fabricType?: string | null;
  fabricDesign?: string | null;
  colour?: string | null;
  sizeSpecification?: string | null;
}

export interface ItemLookups {
  itemTypes: ItemType[];
  units: UnitOfMeasure[];
  gstRates: string[];
  yarnQualities: Array<{ id: string; qualityName: string; denier: string | null }>;
  yarnGrades: Array<{ id: string; gradeName: string }>;
}

// -------------------------------------------------------------
// Order lookups
// -------------------------------------------------------------

export interface OrderPartyLookup {
  id: string;
  partyName: string;
  partyCode: string;
  partyType: string;
  gstin: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
}

export interface OrderItemLookup {
  id: string;
  itemCode: string;
  itemName: string;
  itemCategory: string | null;
  itemType: string;
  unit: UnitOfMeasure;
  hsnCode: string | null;
  gstRate: string;
  defaultSalesRate: string;
  defaultPurchaseRate: string;
  description: string | null;
  yarnQualityId: string | null;
  yarnQualityName: string | null;
  yarnGradeId: string | null;
  yarnGradeName: string | null;
  yarnCount: string | null;
  denier: string | null;
  lotNumber: string | null;
  fabricType: string | null;
  fabricDesign: string | null;
  colour: string | null;
  sizeSpecification: string | null;
}

export interface OrderLookups {
  company: {
    id: string;
    companyName: string;
    companyCode: string;
    gstin: string | null;
    panNumber: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    logoPath: string | null;
  };
  financialYear: {
    id: string;
    yearName: string;
    startDate: string;
    endDate: string;
    isLocked: boolean;
  };
  nextOrderNumber: string;
  parties: OrderPartyLookup[];
  items: OrderItemLookup[];
  locations?: Array<{ id: string; locationName: string }>;
  statuses: string[];
  priorities: OrderPriority[];
  taxTypes: OrderTaxType[];
  terms: {
    paymentTerms: string[];
    deliveryTerms: string[];
    freightTerms: string[];
  };
}

export interface OrderTotals {
  totalQuantity: string;
  subtotal: string;
  discountAmount: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  freightAmount: string;
  packingAmount: string;
  otherCharges: string;
  roundOffAmount: string;
  grandTotal: string;
}

export interface OrderPartySummary extends OrderPartyLookup {
  panNumber: string | null;
  partyType: string;
}

export interface SalesOrderLine {
  id: string;
  lineNumber: number;
  itemId: string | null;
  itemCode: string;
  itemName: string;
  description: string | null;
  yarnQualityName: string | null;
  yarnGradeName: string | null;
  yarnCount: string | null;
  denier: string | null;
  colour: string | null;
  design: string | null;
  specification: string | null;
  unit: UnitOfMeasure;
  quantity: string;
  rate: string;
  discountPercent: string;
  discountAmount: string;
  taxableAmount: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  lineTotal: string;
  expectedDeliveryDate: string | null;
  remarks: string | null;
  fulfilledQuantity: string;
  pendingQuantity: string;
}

export interface PurchaseOrderLine {
  id: string;
  lineNumber: number;
  itemId: string | null;
  itemCode: string;
  itemName: string;
  description: string | null;
  yarnQualityName: string | null;
  yarnGradeName: string | null;
  yarnCount: string | null;
  denier: string | null;
  lotNumber: string | null;
  specification: string | null;
  unit: UnitOfMeasure;
  quantity: string;
  rate: string;
  discountPercent: string;
  discountAmount: string;
  taxableAmount: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  lineTotal: string;
  expectedReceiptDate: string | null;
  revisedDeliveryDate: string | null;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  remarks: string | null;
  receivedQuantity: string;
  pendingQuantity: string;
}

export interface SalesOrderSchedule {
  id: string;
  lineNumber: number;
  scheduleDate: string;
  quantity: string;
  note: string | null;
}

export interface SalesOrder {
  id: string;
  companyId: string;
  financialYearId: string;
  orderNumber: string;
  orderDate: string;
  status: SalesOrderStatus;
  priority: OrderPriority;
  taxType: OrderTaxType;
  placeOfSupplyState: string | null;
  party: OrderPartySummary;
  customerReferenceNumber: string | null;
  customerReferenceDate: string | null;
  billingAddress: string | null;
  deliveryAddress: string | null;
  expectedDeliveryDate: string | null;
  salesperson: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  freightTerms: string | null;
  orderValidUntil: string | null;
  totals: OrderTotals;
  totalFulfilledQuantity: string;
  totalPendingQuantity: string;
  scheduleIsPartial: boolean;
  narration: string | null;
  remarks: string | null;
  termsAndConditions: string | null;
  confirmedAt: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SalesOrderLine[];
  schedules: SalesOrderSchedule[];
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  financialYearId: string;
  orderNumber: string;
  orderDate: string;
  status: PurchaseOrderStatus;
  priority: OrderPriority;
  taxType: OrderTaxType;
  placeOfSupplyState: string | null;
  party: OrderPartySummary;
  supplierQuotationNumber: string | null;
  supplierQuotationDate: string | null;
  supplierReference: string | null;
  supplierGstin: string | null;
  billingAddress: string | null;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  expectedDeliveryDate: string | null;
  buyerName: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  freightTerms: string | null;
  transportDetails: string | null;
  totals: OrderTotals;
  totalReceivedQuantity: string;
  totalPendingQuantity: string;
  narration: string | null;
  remarks: string | null;
  termsAndConditions: string | null;
  supplierConfirmationDate: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
}

export type OrderRecord = SalesOrder | PurchaseOrder;

export interface OrderLinePayload {
  lineNumber?: number;
  itemId: string;
  description?: string | null;
  unit?: UnitOfMeasure;
  quantity: string | number;
  rate?: string | number | null;
  discountPercent?: string | number | null;
  gstRate?: string | number | null;
  expectedDeliveryDate?: string | null;
  expectedReceiptDate?: string | null;
  revisedDeliveryDate?: string | null;
  deliveryLocationId?: string | null;
  remarks?: string | null;
}

export interface OrderSchedulePayload {
  lineNumber: number;
  scheduleDate: string;
  quantity: string | number;
  note?: string | null;
}

export interface OrderPayload {
  orderDate?: string;
  partyId?: string;
  priority?: OrderPriority;
  taxType?: OrderTaxType;
  freightAmount?: string;
  packingAmount?: string;
  otherCharges?: string;
  narration?: string | null;
  remarks?: string | null;
  termsAndConditions?: string | null;
  lines?: OrderLinePayload[];
  // Sales order only
  customerReferenceNumber?: string | null;
  customerReferenceDate?: string | null;
  billingAddress?: string | null;
  deliveryAddress?: string | null;
  expectedDeliveryDate?: string | null;
  salesperson?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  freightTerms?: string | null;
  orderValidUntil?: string | null;
  scheduleIsPartial?: boolean;
  schedules?: OrderSchedulePayload[];
  // Purchase order only
  supplierQuotationNumber?: string | null;
  supplierQuotationDate?: string | null;
  supplierReference?: string | null;
  supplierGstin?: string | null;
  deliveryLocationId?: string | null;
  buyerName?: string | null;
  transportDetails?: string | null;
}

export interface OrderListParams {
  search?: string;
  partyId?: string;
  itemId?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  expectedFrom?: string;
  expectedTo?: string;
  overdue?: boolean;
  sortBy?: 'date' | 'number' | 'amount' | 'party';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface OrderListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAmount: string;
  totalQuantity: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OrderSummary {
  statuses: Record<string, { count: number; amount: string }>;
  pending: { count: number; amount: string; quantity: string };
  overdue: { count: number; amount: string };
}

export interface OrderReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface OrderReportDefinition {
  key: string;
  title: string;
  description: string;
  columns: OrderReportColumn[];
}

export interface OrderReportResult extends OrderReportDefinition {
  rows: Array<Record<string, string | number | null>>;
  totals: Record<string, string>;
  generatedAt: string;
}