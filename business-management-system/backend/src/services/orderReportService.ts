import { Prisma, PrismaClient, PurchaseOrderStatus, SalesOrderStatus } from '@prisma/client';
import { OrderRepository } from '../repositories/orderRepository.js';
import { FieldError, validationError } from '../utils/appError.js';
import { moneyFixed, quantityFixed } from '../utils/orderMath.js';
import { captureDate, toDateKey } from './orderShared.js';

const prisma = new PrismaClient();
const repo = new OrderRepository();

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  columns: ReportColumn[];
}

export interface ReportFilters {
  fromDate?: unknown;
  toDate?: unknown;
  partyId?: unknown;
  itemId?: unknown;
  status?: unknown;
  search?: unknown;
  overdue?: unknown;
}

export interface ReportResult {
  key: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  totals: Record<string, string>;
  generatedAt: string;
}

const SALES_FINAL: SalesOrderStatus[] = ['FULFILLED', 'CLOSED', 'CANCELLED'];
const SALES_PENDING: SalesOrderStatus[] = ['DRAFT', 'CONFIRMED', 'PARTIALLY_FULFILLED'];
const PURCHASE_FINAL: PurchaseOrderStatus[] = ['RECEIVED', 'CLOSED', 'CANCELLED'];
const PURCHASE_PENDING: PurchaseOrderStatus[] = [
  'DRAFT',
  'APPROVED',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
];

export const SALES_REPORTS: ReportDefinition[] = [
  {
    key: 'pending-sales-orders',
    title: 'Pending Sales Orders',
    description: 'Draft, confirmed and partially fulfilled sales orders that still need action.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'expectedDeliveryDate', label: 'Expected Delivery' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'customer-wise-orders',
    title: 'Customer-wise Orders',
    description: 'Sales order count, ordered quantity and value grouped by customer.',
    columns: [
      { key: 'partyName', label: 'Customer' },
      { key: 'partyCode', label: 'Code' },
      { key: 'orderCount', label: 'Orders', align: 'right' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'item-wise-orders',
    title: 'Item-wise Orders',
    description: 'Sales order lines grouped by item, showing quantity and taxable value.',
    columns: [
      { key: 'itemCode', label: 'Item Code' },
      { key: 'itemName', label: 'Item' },
      { key: 'unit', label: 'Unit' },
      { key: 'lineCount', label: 'Order Lines', align: 'right' },
      { key: 'quantity', label: 'Quantity', align: 'right' },
      { key: 'taxableAmount', label: 'Taxable Value', align: 'right' },
    ],
  },
  {
    key: 'delivery-schedule',
    title: 'Delivery Schedule Report',
    description: 'Delivery schedule lines with their parent sales order and customer.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'lineNumber', label: 'Line', align: 'right' },
      { key: 'itemName', label: 'Item' },
      { key: 'scheduleDate', label: 'Schedule Date' },
      { key: 'quantity', label: 'Scheduled Qty', align: 'right' },
      { key: 'partyName', label: 'Customer' },
      { key: 'note', label: 'Note' },
    ],
  },
  {
    key: 'overdue-sales-orders',
    title: 'Overdue Sales Orders',
    description: 'Open sales orders whose expected delivery date has already passed.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Customer' },
      { key: 'expectedDeliveryDate', label: 'Expected Delivery' },
      { key: 'daysOverdue', label: 'Days Overdue', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'partially-fulfilled-orders',
    title: 'Partially Fulfilled Orders',
    description: 'Sales orders that have recorded partial fulfilment.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Customer' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'fulfilledQuantity', label: 'Fulfilled Qty', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'fully-fulfilled-orders',
    title: 'Fully Fulfilled Orders',
    description: 'Sales orders that are fully fulfilled or closed.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'fulfilment-summary',
    title: 'Order Fulfilment Summary',
    description: 'Per-order ordered, fulfilled and pending quantities from linked records.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'fulfilledQuantity', label: 'Fulfilled Qty', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
      { key: 'fulfilmentPercent', label: 'Fulfilment %', align: 'right' },
    ],
  },
];

export const PURCHASE_REPORTS: ReportDefinition[] = [
  {
    key: 'pending-purchase-orders',
    title: 'Pending Purchase Orders',
    description: 'Purchase orders that are not yet fully received, closed or cancelled.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Supplier' },
      { key: 'status', label: 'Status' },
      { key: 'expectedDeliveryDate', label: 'Expected Delivery' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'supplier-wise-orders',
    title: 'Supplier-wise Orders',
    description: 'Purchase order count, ordered quantity and value grouped by supplier.',
    columns: [
      { key: 'partyName', label: 'Supplier' },
      { key: 'partyCode', label: 'Code' },
      { key: 'orderCount', label: 'Orders', align: 'right' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'item-wise-purchase-orders',
    title: 'Item-wise Purchase Orders',
    description: 'Purchase order lines grouped by item, showing quantity and taxable value.',
    columns: [
      { key: 'itemCode', label: 'Item Code' },
      { key: 'itemName', label: 'Item' },
      { key: 'unit', label: 'Unit' },
      { key: 'lineCount', label: 'Order Lines', align: 'right' },
      { key: 'quantity', label: 'Quantity', align: 'right' },
      { key: 'taxableAmount', label: 'Taxable Value', align: 'right' },
    ],
  },
  {
    key: 'expected-delivery',
    title: 'Expected Delivery Report',
    description: 'Purchase order lines with expected and revised receipt dates.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'lineNumber', label: 'Line', align: 'right' },
      { key: 'itemName', label: 'Item' },
      { key: 'partyName', label: 'Supplier' },
      { key: 'expectedReceiptDate', label: 'Expected Receipt' },
      { key: 'revisedDeliveryDate', label: 'Revised Date' },
      { key: 'quantity', label: 'Quantity', align: 'right' },
    ],
  },
  {
    key: 'overdue-purchase-orders',
    title: 'Overdue Purchase Orders',
    description: 'Open purchase orders whose expected delivery date has already passed.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Supplier' },
      { key: 'expectedDeliveryDate', label: 'Expected Delivery' },
      { key: 'daysOverdue', label: 'Days Overdue', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'partially-received-orders',
    title: 'Partially Received Orders',
    description: 'Purchase orders that have recorded partial receipts.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Supplier' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'receivedQuantity', label: 'Received Qty', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'fully-received-orders',
    title: 'Fully Received Orders',
    description: 'Purchase orders that are fully received or closed.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'orderDate', label: 'Date' },
      { key: 'partyName', label: 'Supplier' },
      { key: 'status', label: 'Status' },
      { key: 'totalQuantity', label: 'Ordered Qty', align: 'right' },
      { key: 'grandTotal', label: 'Order Value', align: 'right' },
    ],
  },
  {
    key: 'pending-quantity',
    title: 'Purchase Order Pending Quantity Report',
    description: 'Per-line ordered, received and pending quantities from linked receipt records.',
    columns: [
      { key: 'orderNumber', label: 'Order No.' },
      { key: 'lineNumber', label: 'Line', align: 'right' },
      { key: 'itemCode', label: 'Item Code' },
      { key: 'itemName', label: 'Item' },
      { key: 'unit', label: 'Unit' },
      { key: 'quantity', label: 'Ordered Qty', align: 'right' },
      { key: 'receivedQuantity', label: 'Received Qty', align: 'right' },
      { key: 'pendingQuantity', label: 'Pending Qty', align: 'right' },
    ],
  },
];
interface ParsedFilters {
  fromDate?: Date;
  toDate?: Date;
  partyId?: string;
  itemId?: string;
  status?: string;
  search?: string;
  overdue: boolean;
}

function parseFilters(raw: ReportFilters, statuses: string[]): ParsedFilters {
  const errors: FieldError[] = [];
  const fromDate = captureDate(errors, raw.fromDate, 'fromDate', 'From date') ?? undefined;
  const toDate = captureDate(errors, raw.toDate, 'toDate', 'To date') ?? undefined;

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    errors.push({ field: 'toDate', message: 'To date cannot be earlier than the from date.' });
  }

  const status =
    typeof raw.status === 'string' && raw.status.trim() !== ''
      ? raw.status.trim().toUpperCase()
      : undefined;
  if (status && !statuses.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of ${statuses.join(', ')}.` });
  }

  if (errors.length > 0) {
    validationError(errors);
  }

  return {
    fromDate,
    toDate,
    partyId:
      typeof raw.partyId === 'string' && raw.partyId.trim() !== '' ? raw.partyId.trim() : undefined,
    itemId:
      typeof raw.itemId === 'string' && raw.itemId.trim() !== '' ? raw.itemId.trim() : undefined,
    status,
    search:
      typeof raw.search === 'string' && raw.search.trim() !== '' ? raw.search.trim() : undefined,
    overdue: raw.overdue === true || raw.overdue === 'true',
  };
}

function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfDay(value: Date): Date {
  const start = startOfDay(value);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function todayUtc(): Date {
  const now = new Date();
  return startOfDay(now);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function sumOrZero(value: Prisma.Decimal | null): Prisma.Decimal {
  return value ?? new Prisma.Decimal(0);
}

function pendingQty(ordered: Prisma.Decimal, fulfilled: Prisma.Decimal): Prisma.Decimal {
  const difference = new Prisma.Decimal(ordered).minus(fulfilled);
  return difference.lt(0) ? new Prisma.Decimal(0) : difference;
}

function percentOf(part: Prisma.Decimal, whole: Prisma.Decimal): string {
  if (whole.lte(0)) return '0.00';
  return part.dividedBy(whole).times(100).toFixed(2);
}

interface ReportGroup {
  label: string;
  code: string;
  unit: string;
  count: number;
  quantity: Prisma.Decimal;
  amount: Prisma.Decimal;
}

function groupInto(
  map: Map<string, ReportGroup>,
  id: string,
  seed: { label: string; code: string; unit?: string },
  quantity: Prisma.Decimal,
  amount: Prisma.Decimal
): void {
  const current = map.get(id);
  if (current) {
    current.count += 1;
    current.quantity = current.quantity.plus(quantity);
    current.amount = current.amount.plus(amount);
    return;
  }
  map.set(id, {
    label: seed.label,
    code: seed.code,
    unit: seed.unit ?? '',
    count: 1,
    quantity,
    amount,
  });
}

function totalsFor(rows: Array<Record<string, string | number | null>>): Record<string, string> {
  const totals: Record<string, string> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== 'string') continue;
      if (!/^-?\d+(\.\d{1,3})?$/.test(value)) continue;
      totals[key] = new Prisma.Decimal(totals[key] ?? '0').plus(new Prisma.Decimal(value)).toFixed(2);
    }
  }
  return totals;
}

export class OrderReportService {
  salesList(): ReportDefinition[] {
    return SALES_REPORTS;
  }

  purchaseList(): ReportDefinition[] {
    return PURCHASE_REPORTS;
  }

  async runSales(
    companyId: string,
    financialYearId: string,
    reportKey: string,
    rawFilters: ReportFilters
  ): Promise<ReportResult> {
    const definition = SALES_REPORTS.find((entry) => entry.key === reportKey);
    if (!definition) {
      validationError([{ field: 'report', message: `Unknown sales order report "${reportKey}".` }]);
    }
    const resolved = definition as ReportDefinition;
    const filters = parseFilters(rawFilters, [
      'DRAFT',
      'CONFIRMED',
      'PARTIALLY_FULFILLED',
      'FULFILLED',
      'CLOSED',
      'CANCELLED',
    ]);

    const where: Prisma.SalesOrderWhereInput = {};

    if (filters.fromDate || filters.toDate) {
      where.orderDate = {};
      if (filters.fromDate) where.orderDate.gte = startOfDay(filters.fromDate);
      if (filters.toDate) where.orderDate.lte = endOfDay(filters.toDate);
    }
    if (filters.partyId) where.partyId = filters.partyId;
    if (filters.itemId) where.lines = { some: { itemId: filters.itemId } };
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { customerReferenceNumber: { contains: filters.search, mode: 'insensitive' } },
        { party: { is: { partyName: { contains: filters.search, mode: 'insensitive' } } } },
        { lines: { some: { itemName: { contains: filters.search, mode: 'insensitive' } } } },
        { lines: { some: { itemCode: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    if (filters.status) {
      where.status = filters.status as SalesOrderStatus;
    } else if (resolved.key === 'pending-sales-orders' || resolved.key === 'overdue-sales-orders') {
      where.status = { in: SALES_PENDING };
    } else if (resolved.key === 'partially-fulfilled-orders') {
      where.status = 'PARTIALLY_FULFILLED';
    } else if (resolved.key === 'fully-fulfilled-orders') {
      where.status = { in: ['FULFILLED', 'CLOSED'] };
    }

    if (resolved.key === 'overdue-sales-orders') {
      where.expectedDeliveryDate = { lt: todayUtc() };
    }

    if (filters.overdue && resolved.key !== 'overdue-sales-orders') {
      where.expectedDeliveryDate = { lt: todayUtc() };
    }

    const orders = await repo.salesReportRows(companyId, financialYearId, where);
    const orderIds = orders.map((order) => order.id);
    const fulfilledMap = await repo.fulfilledByOrder(companyId, 'SALES_ORDER', orderIds);
    const today = todayUtc();

    const rows: Array<Record<string, string | number | null>> = [];

    if (resolved.key === 'customer-wise-orders') {
      const grouped = new Map<string, ReportGroup>();
      for (const order of orders) {
        groupInto(
          grouped,
          order.partyId,
          { label: order.party.partyName, code: order.party.partyCode },
          order.totalQuantity,
          order.grandTotal
        );
      }
      for (const entry of grouped.values()) {
        rows.push({
          partyName: entry.label,
          partyCode: entry.code,
          orderCount: entry.count,
          totalQuantity: quantityFixed(entry.quantity),
          grandTotal: moneyFixed(entry.amount),
        });
      }
    } else if (resolved.key === 'item-wise-orders') {
      const grouped = new Map<string, ReportGroup>();
      for (const order of orders) {
        for (const line of order.lines) {
          groupInto(
            grouped,
            line.itemId ?? line.itemCode,
            { label: line.itemName, code: line.itemCode, unit: line.unit },
            line.quantity,
            line.taxableAmount
          );
        }
      }
      for (const entry of grouped.values()) {
        rows.push({
          itemCode: entry.code,
          itemName: entry.label,
          unit: entry.unit,
          lineCount: entry.count,
          quantity: quantityFixed(entry.quantity),
          taxableAmount: moneyFixed(entry.amount),
        });
      }
    } else if (resolved.key === 'delivery-schedule') {
      for (const order of orders) {
        for (const schedule of order.schedules) {
          const line = order.lines.find((entry) => entry.id === schedule.salesOrderLineId);
          rows.push({
            orderNumber: order.orderNumber,
            lineNumber: line?.lineNumber ?? 0,
            itemName: line?.itemName ?? '',
            scheduleDate: toDateKey(schedule.scheduleDate),
            quantity: quantityFixed(schedule.quantity),
            partyName: order.party.partyName,
            note: schedule.note,
          });
        }
      }
    } else if (resolved.key === 'fulfilment-summary') {
      for (const order of orders) {
        const fulfilled = fulfilledMap.get(order.id) ?? new Prisma.Decimal(0);
        rows.push({
          orderNumber: order.orderNumber,
          orderDate: toDateKey(order.orderDate),
          partyName: order.party.partyName,
          status: order.status,
          totalQuantity: quantityFixed(order.totalQuantity),
          fulfilledQuantity: quantityFixed(fulfilled),
          pendingQuantity: quantityFixed(pendingQty(order.totalQuantity, fulfilled)),
          fulfilmentPercent: percentOf(fulfilled, order.totalQuantity),
        });
      }
    } else {
      const overdueOnly = resolved.key === 'overdue-sales-orders';
      for (const order of orders) {
        const fulfilled = fulfilledMap.get(order.id) ?? new Prisma.Decimal(0);
        rows.push({
          orderNumber: order.orderNumber,
          orderDate: toDateKey(order.orderDate),
          partyName: order.party.partyName,
          status: order.status,
          expectedDeliveryDate: toDateKey(order.expectedDeliveryDate),
          daysOverdue:
            overdueOnly && order.expectedDeliveryDate
              ? Math.max(0, daysBetween(order.expectedDeliveryDate, today))
              : null,
          totalQuantity: quantityFixed(order.totalQuantity),
          fulfilledQuantity: quantityFixed(fulfilled),
          pendingQuantity: quantityFixed(pendingQty(order.totalQuantity, fulfilled)),
          grandTotal: moneyFixed(order.grandTotal),
        });
      }
    }

    return {
      key: resolved.key,
      title: resolved.title,
      description: resolved.description,
      columns: resolved.columns,
      rows,
      totals: totalsFor(rows),
      generatedAt: new Date().toISOString(),
    };
  }
  async runPurchase(
    companyId: string,
    financialYearId: string,
    reportKey: string,
    rawFilters: ReportFilters
  ): Promise<ReportResult> {
    const definition = PURCHASE_REPORTS.find((entry) => entry.key === reportKey);
    if (!definition) {
      validationError([
        { field: 'report', message: `Unknown purchase order report "${reportKey}".` },
      ]);
    }
    const resolved = definition as ReportDefinition;
    const filters = parseFilters(rawFilters, [
      'DRAFT',
      'APPROVED',
      'SENT',
      'ACKNOWLEDGED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CLOSED',
      'CANCELLED',
    ]);

    const where: Prisma.PurchaseOrderWhereInput = {};

    if (filters.fromDate || filters.toDate) {
      where.orderDate = {};
      if (filters.fromDate) where.orderDate.gte = startOfDay(filters.fromDate);
      if (filters.toDate) where.orderDate.lte = endOfDay(filters.toDate);
    }
    if (filters.partyId) where.partyId = filters.partyId;
    if (filters.itemId) where.lines = { some: { itemId: filters.itemId } };
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { supplierQuotationNumber: { contains: filters.search, mode: 'insensitive' } },
        { supplierReference: { contains: filters.search, mode: 'insensitive' } },
        { party: { is: { partyName: { contains: filters.search, mode: 'insensitive' } } } },
        { lines: { some: { itemName: { contains: filters.search, mode: 'insensitive' } } } },
        { lines: { some: { itemCode: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    if (filters.status) {
      where.status = filters.status as PurchaseOrderStatus;
    } else if (resolved.key === 'pending-purchase-orders' || resolved.key === 'overdue-purchase-orders') {
      where.status = { in: PURCHASE_PENDING };
    } else if (resolved.key === 'partially-received-orders') {
      where.status = 'PARTIALLY_RECEIVED';
    } else if (resolved.key === 'fully-received-orders') {
      where.status = { in: ['RECEIVED', 'CLOSED'] };
    }

    if (resolved.key === 'overdue-purchase-orders') {
      where.expectedDeliveryDate = { lt: todayUtc() };
    }

    if (filters.overdue && resolved.key !== 'overdue-purchase-orders') {
      where.expectedDeliveryDate = { lt: todayUtc() };
    }

    const orders = await repo.purchaseReportRows(companyId, financialYearId, where);
    const orderIds = orders.map((order) => order.id);
    const receivedMap = await repo.fulfilledByOrder(companyId, 'PURCHASE_ORDER', orderIds);
    const receivedByLine = await repo.fulfilledByLine(
      companyId,
      'PURCHASE_ORDER',
      orders.flatMap((order) => order.lines.map((line) => line.id))
    );
    const today = todayUtc();

    const rows: Array<Record<string, string | number | null>> = [];

    if (resolved.key === 'supplier-wise-orders') {
      const grouped = new Map<string, ReportGroup>();
      for (const order of orders) {
        groupInto(
          grouped,
          order.partyId,
          { label: order.party.partyName, code: order.party.partyCode },
          order.totalQuantity,
          order.grandTotal
        );
      }
      for (const entry of grouped.values()) {
        rows.push({
          partyName: entry.label,
          partyCode: entry.code,
          orderCount: entry.count,
          totalQuantity: quantityFixed(entry.quantity),
          grandTotal: moneyFixed(entry.amount),
        });
      }
    } else if (resolved.key === 'item-wise-purchase-orders') {
      const grouped = new Map<string, ReportGroup>();
      for (const order of orders) {
        for (const line of order.lines) {
          groupInto(
            grouped,
            line.itemId ?? line.itemCode,
            { label: line.itemName, code: line.itemCode, unit: line.unit },
            line.quantity,
            line.taxableAmount
          );
        }
      }
      for (const entry of grouped.values()) {
        rows.push({
          itemCode: entry.code,
          itemName: entry.label,
          unit: entry.unit,
          lineCount: entry.count,
          quantity: quantityFixed(entry.quantity),
          taxableAmount: moneyFixed(entry.amount),
        });
      }
    } else if (resolved.key === 'expected-delivery') {
      for (const order of orders) {
        for (const line of order.lines) {
          rows.push({
            orderNumber: order.orderNumber,
            lineNumber: line.lineNumber,
            itemName: line.itemName,
            partyName: order.party.partyName,
            expectedReceiptDate: toDateKey(line.expectedReceiptDate),
            revisedDeliveryDate: toDateKey(line.revisedDeliveryDate),
            quantity: quantityFixed(line.quantity),
          });
        }
      }
    } else if (resolved.key === 'pending-quantity') {
      for (const order of orders) {
        for (const line of order.lines) {
          const received = receivedByLine.get(line.id) ?? new Prisma.Decimal(0);
          rows.push({
            orderNumber: order.orderNumber,
            lineNumber: line.lineNumber,
            itemCode: line.itemCode,
            itemName: line.itemName,
            unit: line.unit,
            quantity: quantityFixed(line.quantity),
            receivedQuantity: quantityFixed(received),
            pendingQuantity: quantityFixed(pendingQty(line.quantity, received)),
          });
        }
      }
    } else {
      const overdueOnly = resolved.key === 'overdue-purchase-orders';
      for (const order of orders) {
        const received = receivedMap.get(order.id) ?? new Prisma.Decimal(0);
        rows.push({
          orderNumber: order.orderNumber,
          orderDate: toDateKey(order.orderDate),
          partyName: order.party.partyName,
          status: order.status,
          expectedDeliveryDate: toDateKey(order.expectedDeliveryDate),
          daysOverdue:
            overdueOnly && order.expectedDeliveryDate
              ? Math.max(0, daysBetween(order.expectedDeliveryDate, today))
              : null,
          totalQuantity: quantityFixed(order.totalQuantity),
          receivedQuantity: quantityFixed(received),
          pendingQuantity: quantityFixed(pendingQty(order.totalQuantity, received)),
          grandTotal: moneyFixed(order.grandTotal),
        });
      }
    }

    return {
      key: resolved.key,
      title: resolved.title,
      description: resolved.description,
      columns: resolved.columns,
      rows,
      totals: totalsFor(rows),
      generatedAt: new Date().toISOString(),
    };
  }
}