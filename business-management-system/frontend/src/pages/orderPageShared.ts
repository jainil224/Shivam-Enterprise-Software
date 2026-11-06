import type { OrderDocumentType, OrderTaxType } from '../types/orders';

export type OrderKind = OrderDocumentType;

export interface OrderPageLabels {
  noun: string;
  plural: string;
  partyLabel: string;
  partyPlaceholder: string;
  referenceLabel: string;
  expectedDateLabel: string;
  rateLabel: string;
  shortCode: string;
}

export const orderLabels = (kind: OrderKind): OrderPageLabels =>
  kind === 'SALES_ORDER'
    ? {
        noun: 'Sales Order',
        plural: 'Sales Orders',
        partyLabel: 'Customer',
        partyPlaceholder: 'Search customer by name, code, GSTIN or city…',
        referenceLabel: 'Customer Reference',
        expectedDateLabel: 'Expected Delivery Date',
        rateLabel: 'Sales Rate',
        shortCode: 'SO',
      }
    : {
        noun: 'Purchase Order',
        plural: 'Purchase Orders',
        partyLabel: 'Supplier',
        partyPlaceholder: 'Search supplier by name, code, GSTIN or city…',
        referenceLabel: 'Supplier Reference',
        expectedDateLabel: 'Expected Delivery Date',
        rateLabel: 'Purchase Rate',
        shortCode: 'PO',
      };

export const orderPaths = (kind: OrderKind) => {
  const base = kind === 'SALES_ORDER' ? '/transactions/sales-orders' : '/transactions/purchase-orders';
  return {
    base,
    create: `${base}/new`,
    reports: `${base}/reports`,
    detail: (id: string) => `${base}/${id}`,
    edit: (id: string) => `${base}/${id}/edit`,
    print: (id: string) => `${base}/${id}/print`,
  };
};

export const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const qty = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.000';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const todayKey = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10);
};

/** Display-only rounding helper. Persisted totals are always recomputed on the server. */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export interface LineDraftTotals {
  quantity: number;
  rate: number;
  discountPercent: number;
  gstRate: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

/**
 * Mirrors backend `computeLine` exactly so the on-screen preview matches the
 * persisted document. The server still recomputes every value with Prisma
 * Decimal arithmetic before writing.
 */
export const computeLineDraft = (
  line: { quantity: string; rate: string; discountPercent: string; gstRate: string },
  taxType: OrderTaxType
): LineDraftTotals => {
  const quantity = Number(line.quantity || 0) || 0;
  const rate = Number(line.rate || 0) || 0;
  const discountPercent = Number(line.discountPercent || 0) || 0;
  const gstRate = Number(line.gstRate || 0) || 0;

  const gross = round2(quantity * rate);
  const discountAmount = round2((gross * discountPercent) / 100);
  const taxableAmount = round2(gross - discountAmount);

  const cgstAmount = taxType === 'INTRA_STATE' ? round2((taxableAmount * (gstRate / 2)) / 100) : 0;
  const sgstAmount = taxType === 'INTRA_STATE' ? round2((taxableAmount * (gstRate / 2)) / 100) : 0;
  const igstAmount = taxType === 'INTER_STATE' ? round2((taxableAmount * gstRate) / 100) : 0;

  return {
    quantity,
    rate,
    discountPercent,
    gstRate,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineTotal: round2(taxableAmount + cgstAmount + sgstAmount + igstAmount),
  };
};

export const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-300',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-300',
  SENT: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  ACKNOWLEDGED: 'bg-violet-50 text-violet-700 border-violet-300',
  PARTIALLY_FULFILLED: 'bg-amber-50 text-amber-800 border-amber-300',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-800 border-amber-300',
  FULFILLED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  CLOSED: 'bg-teal-50 text-teal-700 border-teal-300',
  CANCELLED: 'bg-red-50 text-red-700 border-red-300',
};

export const statusTone = (status: string): string =>
  STATUS_TONE[status] ?? 'bg-slate-100 text-slate-700 border-slate-300';