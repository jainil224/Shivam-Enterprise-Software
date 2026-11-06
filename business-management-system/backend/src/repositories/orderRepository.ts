import {
  OrderDocumentType,
  OrderPriority,
  OrderTaxType,
  Prisma,
  PrismaClient,
  PurchaseOrderStatus,
  SalesOrderStatus,
  UnitOfMeasure,
} from '@prisma/client';

const prisma = new PrismaClient();

export const ORDER_PARTY_SELECT = {
  id: true,
  partyName: true,
  partyCode: true,
  partyType: true,
  gstin: true,
  panNumber: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  phone: true,
  email: true,
  isActive: true,
} satisfies Prisma.PartySelect;

export const SALES_ORDER_INCLUDE = {
  party: { select: ORDER_PARTY_SELECT },
  lines: { orderBy: { lineNumber: 'asc' as const } },
  schedules: {
    orderBy: [{ scheduleDate: 'asc' as const }, { createdAt: 'asc' as const }],
  },
} satisfies Prisma.SalesOrderInclude;

export const PURCHASE_ORDER_INCLUDE = {
  party: { select: ORDER_PARTY_SELECT },
  deliveryLocation: { select: { id: true, locationName: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: { deliveryLocation: { select: { id: true, locationName: true } } },
  },
} satisfies Prisma.PurchaseOrderInclude;

export type SalesOrderWithDetail = Prisma.SalesOrderGetPayload<{
  include: typeof SALES_ORDER_INCLUDE;
}>;

export type PurchaseOrderWithDetail = Prisma.PurchaseOrderGetPayload<{
  include: typeof PURCHASE_ORDER_INCLUDE;
}>;

export interface OrderListFilters {
  search?: string;
  partyId?: string;
  itemId?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  expectedFrom?: Date;
  expectedTo?: Date;
  overdue?: boolean;
  sortBy?: 'date' | 'number' | 'amount' | 'party';
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface OrderListResult<T> {
  items: T[];
  total: number;
  totalAmount: Prisma.Decimal;
  totalQuantity: Prisma.Decimal;
}

export interface OrderLineWrite {
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  description: string | null;
  yarnQualityName: string | null;
  yarnGradeName: string | null;
  yarnCount: string | null;
  denier: string | null;
  colour: string | null;
  design: string | null;
  lotNumber: string | null;
  specification: string | null;
  unit: UnitOfMeasure;
  quantity: Prisma.Decimal;
  rate: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  gstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  expectedDeliveryDate: Date | null;
  expectedReceiptDate: Date | null;
  revisedDeliveryDate: Date | null;
  deliveryLocationId: string | null;
  remarks: string | null;
}

export interface OrderScheduleWrite {
  lineNumber: number;
  scheduleDate: Date;
  quantity: Prisma.Decimal;
  note: string | null;
}

export interface SalesOrderHeaderWrite {
  companyId: string;
  financialYearId: string;
  orderNumber: string;
  orderDate: Date;
  partyId: string;
  customerReferenceNumber: string | null;
  customerReferenceDate: Date | null;
  billingAddress: string | null;
  deliveryAddress: string | null;
  expectedDeliveryDate: Date | null;
  salesperson: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  freightTerms: string | null;
  orderValidUntil: Date | null;
  priority: OrderPriority;
  status: SalesOrderStatus;
  placeOfSupplyState: string | null;
  taxType: OrderTaxType;
  totalQuantity: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  freightAmount: Prisma.Decimal;
  packingAmount: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
  roundOffAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  scheduleIsPartial: boolean;
  narration: string | null;
  remarks: string | null;
  termsAndConditions: string | null;
}

export interface PurchaseOrderHeaderWrite {
  companyId: string;
  financialYearId: string;
  orderNumber: string;
  orderDate: Date;
  partyId: string;
  supplierQuotationNumber: string | null;
  supplierQuotationDate: Date | null;
  supplierReference: string | null;
  supplierGstin: string | null;
  billingAddress: string | null;
  deliveryLocationId: string | null;
  expectedDeliveryDate: Date | null;
  buyerName: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  freightTerms: string | null;
  transportDetails: string | null;
  priority: OrderPriority;
  status: PurchaseOrderStatus;
  placeOfSupplyState: string | null;
  taxType: OrderTaxType;
  totalQuantity: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  freightAmount: Prisma.Decimal;
  packingAmount: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
  roundOffAmount: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  narration: string | null;
  remarks: string | null;
  termsAndConditions: string | null;
}

export interface OrderHistoryWrite {
  companyId: string;
  financialYearId: string;
  orderType: OrderDocumentType;
  salesOrderId: string | null;
  purchaseOrderId: string | null;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'CONFIRMED'
    | 'APPROVED'
    | 'SENT'
    | 'ACKNOWLEDGED'
    | 'COPIED'
    | 'CANCELLED'
    | 'STATUS_CHANGED'
    | 'FULFILMENT_RECORDED';
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  reason: string | null;
}

function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfDay(value: Date): Date {
  return new Date(startOfDay(value).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function utcToday(): Date {
  const now = new Date();
  return startOfDay(now);
}

function salesOrderWhere(
  companyId: string,
  financialYearId: string,
  filters: Omit<OrderListFilters, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
): Prisma.SalesOrderWhereInput {
  const where: Prisma.SalesOrderWhereInput = { companyId, financialYearId };

  if (filters.status) where.status = filters.status as SalesOrderStatus;
  if (filters.partyId) where.partyId = filters.partyId;
  if (filters.itemId) where.lines = { some: { itemId: filters.itemId } };
  if (filters.fromDate || filters.toDate) {
    where.orderDate = {};
    if (filters.fromDate) where.orderDate.gte = startOfDay(filters.fromDate);
    if (filters.toDate) where.orderDate.lte = endOfDay(filters.toDate);
  }
  if (filters.expectedFrom || filters.expectedTo) {
    where.expectedDeliveryDate = {};
    if (filters.expectedFrom) where.expectedDeliveryDate.gte = startOfDay(filters.expectedFrom);
    if (filters.expectedTo) where.expectedDeliveryDate.lte = endOfDay(filters.expectedTo);
  }
  if (filters.overdue) {
    where.expectedDeliveryDate = { lt: utcToday() };
    where.status = { notIn: ['FULFILLED', 'CLOSED', 'CANCELLED'] };
  }
  if (filters.search && filters.search.trim() !== '') {
    const term = filters.search.trim();
    where.OR = [
      { orderNumber: { contains: term, mode: 'insensitive' } },
      { customerReferenceNumber: { contains: term, mode: 'insensitive' } },
      { narration: { contains: term, mode: 'insensitive' } },
      { party: { is: { partyName: { contains: term, mode: 'insensitive' } } } },
      { lines: { some: { itemName: { contains: term, mode: 'insensitive' } } } },
      { lines: { some: { itemCode: { contains: term, mode: 'insensitive' } } } },
    ];
  }

  return where;
}

function purchaseOrderWhere(
  companyId: string,
  financialYearId: string,
  filters: Omit<OrderListFilters, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
): Prisma.PurchaseOrderWhereInput {
  const where: Prisma.PurchaseOrderWhereInput = { companyId, financialYearId };

  if (filters.status) where.status = filters.status as PurchaseOrderStatus;
  if (filters.partyId) where.partyId = filters.partyId;
  if (filters.itemId) where.lines = { some: { itemId: filters.itemId } };
  if (filters.fromDate || filters.toDate) {
    where.orderDate = {};
    if (filters.fromDate) where.orderDate.gte = startOfDay(filters.fromDate);
    if (filters.toDate) where.orderDate.lte = endOfDay(filters.toDate);
  }
  if (filters.expectedFrom || filters.expectedTo) {
    where.expectedDeliveryDate = {};
    if (filters.expectedFrom) where.expectedDeliveryDate.gte = startOfDay(filters.expectedFrom);
    if (filters.expectedTo) where.expectedDeliveryDate.lte = endOfDay(filters.expectedTo);
  }
  if (filters.overdue) {
    where.expectedDeliveryDate = { lt: utcToday() };
    where.status = { notIn: ['RECEIVED', 'CLOSED', 'CANCELLED'] };
  }
  if (filters.search && filters.search.trim() !== '') {
    const term = filters.search.trim();
    where.OR = [
      { orderNumber: { contains: term, mode: 'insensitive' } },
      { supplierReference: { contains: term, mode: 'insensitive' } },
      { supplierQuotationNumber: { contains: term, mode: 'insensitive' } },
      { narration: { contains: term, mode: 'insensitive' } },
      { party: { is: { partyName: { contains: term, mode: 'insensitive' } } } },
      { lines: { some: { itemName: { contains: term, mode: 'insensitive' } } } },
      { lines: { some: { itemCode: { contains: term, mode: 'insensitive' } } } },
    ];
  }

  return where;
}

function salesOrderOrderBy(
  filters: OrderListFilters
): Prisma.SalesOrderOrderByWithRelationInput[] {
  const direction = filters.sortOrder ?? 'desc';
  switch (filters.sortBy) {
    case 'number':
      return [{ orderNumber: direction }];
    case 'amount':
      return [{ grandTotal: direction }, { orderDate: 'desc' }];
    case 'party':
      return [{ party: { partyName: direction } }, { orderDate: 'desc' }];
    default:
      return [{ orderDate: direction }, { orderNumber: direction }];
  }
}

function purchaseOrderOrderBy(
  filters: OrderListFilters
): Prisma.PurchaseOrderOrderByWithRelationInput[] {
  const direction = filters.sortOrder ?? 'desc';
  switch (filters.sortBy) {
    case 'number':
      return [{ orderNumber: direction }];
    case 'amount':
      return [{ grandTotal: direction }, { orderDate: 'desc' }];
    case 'party':
      return [{ party: { partyName: direction } }, { orderDate: 'desc' }];
    default:
      return [{ orderDate: direction }, { orderNumber: direction }];
  }
}

export type FulfilledQuantityMap = Map<string, Prisma.Decimal>;

export class OrderRepository {
  // ---------------------------------------------------------------- shared

  async nextSequence(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    orderType: OrderDocumentType
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ last_number: number }>>(Prisma.sql`
      INSERT INTO "order_sequences"
        ("id", "company_id", "financial_year_id", "order_type", "last_number", "updated_at")
      VALUES
        (gen_random_uuid()::text, ${companyId}, ${financialYearId}, ${orderType}::"OrderDocumentType", 1, NOW())
      ON CONFLICT ("company_id", "financial_year_id", "order_type")
      DO UPDATE SET
        "last_number" = "order_sequences"."last_number" + 1,
        "updated_at" = NOW()
      RETURNING "last_number"
    `);

    return rows[0].last_number;
  }

  async peekSequence(
    companyId: string,
    financialYearId: string,
    orderType: OrderDocumentType
  ): Promise<number> {
    const row = await prisma.orderSequence.findUnique({
      where: {
        companyId_financialYearId_orderType: { companyId, financialYearId, orderType },
      },
    });
    return (row?.lastNumber ?? 0) + 1;
  }

  async lockSalesOrder(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    id: string
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "sales_orders"
      WHERE "id" = ${id} AND "company_id" = ${companyId} AND "financial_year_id" = ${financialYearId}
      FOR UPDATE
    `);
    if (rows.length === 0) {
      throw new Error('Sales order not found for the active company and financial year.');
    }
  }

  async lockPurchaseOrder(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    id: string
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "purchase_orders"
      WHERE "id" = ${id} AND "company_id" = ${companyId} AND "financial_year_id" = ${financialYearId}
      FOR UPDATE
    `);
    if (rows.length === 0) {
      throw new Error('Purchase order not found for the active company and financial year.');
    }
  }

  async addHistory(tx: Prisma.TransactionClient, entry: OrderHistoryWrite): Promise<void> {
    await tx.orderStatusHistory.create({ data: entry });
  }

  async findHistory(
    companyId: string,
    financialYearId: string,
    orderType: OrderDocumentType,
    orderId: string
  ) {
    return prisma.orderStatusHistory.findMany({
      where: {
        companyId,
        financialYearId,
        orderType,
        ...(orderType === 'SALES_ORDER'
          ? { salesOrderId: orderId }
          : { purchaseOrderId: orderId }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async fulfilledByOrder(
    companyId: string,
    orderType: OrderDocumentType,
    orderIds: string[]
  ): Promise<Map<string, Prisma.Decimal>> {
    const map = new Map<string, Prisma.Decimal>();
    if (orderIds.length === 0) return map;

    const grouped = await prisma.orderFulfilmentLink.groupBy({
      by: ['orderId'],
      where: { companyId, orderType, orderId: { in: orderIds } },
      _sum: { quantity: true },
    });

    for (const row of grouped) {
      map.set(row.orderId, row._sum.quantity ?? new Prisma.Decimal(0));
    }
    return map;
  }

  async fulfilledByLine(
    companyId: string,
    orderType: OrderDocumentType,
    orderLineIds: string[]
  ): Promise<Map<string, Prisma.Decimal>> {
    const map = new Map<string, Prisma.Decimal>();
    if (orderLineIds.length === 0) return map;

    const grouped = await prisma.orderFulfilmentLink.groupBy({
      by: ['orderLineId'],
      where: { companyId, orderType, orderLineId: { in: orderLineIds } },
      _sum: { quantity: true },
    });

    for (const row of grouped) {
      map.set(row.orderLineId, row._sum.quantity ?? new Prisma.Decimal(0));
    }
    return map;
  }

  async countLinksForSalesOrder(companyId: string, orderId: string): Promise<number> {
    return prisma.orderFulfilmentLink.count({
      where: { companyId, orderType: 'SALES_ORDER', orderId },
    });
  }

  async countLinksForPurchaseOrder(companyId: string, orderId: string): Promise<number> {
    return prisma.orderFulfilmentLink.count({
      where: { companyId, orderType: 'PURCHASE_ORDER', orderId },
    });
  }

  // ----------------------------------------------------------- sales orders

  async listSalesOrders(
    companyId: string,
    financialYearId: string,
    filters: OrderListFilters
  ): Promise<OrderListResult<SalesOrderWithDetail>> {
    const where = salesOrderWhere(companyId, financialYearId, filters);
    const skip = (filters.page - 1) * filters.limit;

    const [items, total, aggregate] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: SALES_ORDER_INCLUDE,
        orderBy: salesOrderOrderBy(filters),
        skip,
        take: filters.limit,
      }),
      prisma.salesOrder.count({ where }),
      prisma.salesOrder.aggregate({ where, _sum: { grandTotal: true, totalQuantity: true } }),
    ]);

    return {
      items,
      total,
      totalAmount: aggregate._sum.grandTotal ?? new Prisma.Decimal(0),
      totalQuantity: aggregate._sum.totalQuantity ?? new Prisma.Decimal(0),
    };
  }

  async findSalesOrder(
    companyId: string,
    financialYearId: string,
    id: string
  ): Promise<SalesOrderWithDetail | null> {
    return prisma.salesOrder.findFirst({
      where: { id, companyId, financialYearId },
      include: SALES_ORDER_INCLUDE,
    });
  }

  async findSalesOrdersByIds(
    companyId: string,
    financialYearId: string,
    ids: string[]
  ): Promise<SalesOrderWithDetail[]> {
    if (ids.length === 0) return [];
    return prisma.salesOrder.findMany({
      where: { id: { in: ids }, companyId, financialYearId },
      include: SALES_ORDER_INCLUDE,
    });
  }

  async createSalesOrder(
    tx: Prisma.TransactionClient,
    header: SalesOrderHeaderWrite,
    lines: OrderLineWrite[],
    schedules: OrderScheduleWrite[]
  ): Promise<string> {
    const created = await tx.salesOrder.create({
      data: {
        ...header,
        lines: {
          create: lines.map((line) => ({
            companyId: header.companyId,
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            description: line.description,
            yarnQualityName: line.yarnQualityName,
            yarnGradeName: line.yarnGradeName,
            yarnCount: line.yarnCount,
            denier: line.denier,
            colour: line.colour,
            design: line.design,
            specification: line.specification,
            unit: line.unit,
            quantity: line.quantity,
            rate: line.rate,
            discountPercent: line.discountPercent,
            discountAmount: line.discountAmount,
            taxableAmount: line.taxableAmount,
            gstRate: line.gstRate,
            cgstAmount: line.cgstAmount,
            sgstAmount: line.sgstAmount,
            igstAmount: line.igstAmount,
            lineTotal: line.lineTotal,
            expectedDeliveryDate: line.expectedDeliveryDate,
            remarks: line.remarks,
          })),
        },
      },
      select: { id: true },
    });

    await this.insertSalesSchedules(tx, created.id, schedules);
    return created.id;
  }

  async updateSalesOrderHeader(
    tx: Prisma.TransactionClient,
    id: string,
    header: SalesOrderHeaderWrite
  ): Promise<void> {
    await tx.salesOrder.update({
      where: { id },
      data: {
        orderDate: header.orderDate,
        partyId: header.partyId,
        customerReferenceNumber: header.customerReferenceNumber,
        customerReferenceDate: header.customerReferenceDate,
        billingAddress: header.billingAddress,
        deliveryAddress: header.deliveryAddress,
        expectedDeliveryDate: header.expectedDeliveryDate,
        salesperson: header.salesperson,
        paymentTerms: header.paymentTerms,
        deliveryTerms: header.deliveryTerms,
        freightTerms: header.freightTerms,
        orderValidUntil: header.orderValidUntil,
        priority: header.priority,
        placeOfSupplyState: header.placeOfSupplyState,
        taxType: header.taxType,
        totalQuantity: header.totalQuantity,
        subtotal: header.subtotal,
        discountAmount: header.discountAmount,
        taxableAmount: header.taxableAmount,
        cgstAmount: header.cgstAmount,
        sgstAmount: header.sgstAmount,
        igstAmount: header.igstAmount,
        freightAmount: header.freightAmount,
        packingAmount: header.packingAmount,
        otherCharges: header.otherCharges,
        roundOffAmount: header.roundOffAmount,
        grandTotal: header.grandTotal,
        scheduleIsPartial: header.scheduleIsPartial,
        narration: header.narration,
        remarks: header.remarks,
        termsAndConditions: header.termsAndConditions,
      },
    });
  }

  async replaceSalesOrderLines(
    tx: Prisma.TransactionClient,
    orderId: string,
    companyId: string,
    lines: OrderLineWrite[],
    schedules: OrderScheduleWrite[]
  ): Promise<void> {
    await tx.salesOrderLine.deleteMany({ where: { salesOrderId: orderId } });
    await tx.salesOrderLine.createMany({
      data: lines.map((line) => ({
        companyId,
        salesOrderId: orderId,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        description: line.description,
        yarnQualityName: line.yarnQualityName,
        yarnGradeName: line.yarnGradeName,
        yarnCount: line.yarnCount,
        denier: line.denier,
        colour: line.colour,
        design: line.design,
        specification: line.specification,
        unit: line.unit,
        quantity: line.quantity,
        rate: line.rate,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        taxableAmount: line.taxableAmount,
        gstRate: line.gstRate,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        igstAmount: line.igstAmount,
        lineTotal: line.lineTotal,
        expectedDeliveryDate: line.expectedDeliveryDate,
        remarks: line.remarks,
      })),
    });
    await this.insertSalesSchedules(tx, orderId, schedules);
  }

  private async insertSalesSchedules(
    tx: Prisma.TransactionClient,
    orderId: string,
    schedules: OrderScheduleWrite[]
  ): Promise<void> {
    if (schedules.length === 0) return;
    const lines = await tx.salesOrderLine.findMany({
      where: { salesOrderId: orderId },
      select: { id: true, lineNumber: true },
    });
    const byLineNumber = new Map(lines.map((line) => [line.lineNumber, line.id]));

    const data = schedules
      .map((schedule) => {
        const lineId = byLineNumber.get(schedule.lineNumber);
        if (!lineId) return null;
        return {
          salesOrderId: orderId,
          salesOrderLineId: lineId,
          scheduleDate: schedule.scheduleDate,
          quantity: schedule.quantity,
          note: schedule.note,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (data.length > 0) {
      await tx.salesOrderSchedule.createMany({ data });
    }
  }

  async updateSalesOrderStatus(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.SalesOrderUncheckedUpdateInput
  ): Promise<void> {
    await tx.salesOrder.update({ where: { id }, data });
  }

  async salesStatusCounts(companyId: string, financialYearId: string) {
    const grouped = await prisma.salesOrder.groupBy({
      by: ['status'],
      where: { companyId, financialYearId },
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
    return grouped;
  }

  async salesPendingTotals(companyId: string, financialYearId: string) {
    const aggregate = await prisma.salesOrder.aggregate({
      where: {
        companyId,
        financialYearId,
        status: { in: ['DRAFT', 'CONFIRMED', 'PARTIALLY_FULFILLED'] },
      },
      _sum: { grandTotal: true, totalQuantity: true },
      _count: { _all: true },
    });
    return aggregate;
  }

  async purchaseStatusCounts(companyId: string, financialYearId: string) {
    return prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: { companyId, financialYearId },
      _count: { _all: true },
      _sum: { grandTotal: true },
    });
  }

  async purchasePendingTotals(companyId: string, financialYearId: string) {
    return prisma.purchaseOrder.aggregate({
      where: {
        companyId,
        financialYearId,
        status: { in: ['DRAFT', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] },
      },
      _sum: { grandTotal: true, totalQuantity: true },
      _count: { _all: true },
    });
  }

  // -------------------------------------------------------- purchase orders

  async listPurchaseOrders(
    companyId: string,
    financialYearId: string,
    filters: OrderListFilters
  ): Promise<OrderListResult<PurchaseOrderWithDetail>> {
    const where = purchaseOrderWhere(companyId, financialYearId, filters);
    const skip = (filters.page - 1) * filters.limit;

    const [items, total, aggregate] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: PURCHASE_ORDER_INCLUDE,
        orderBy: purchaseOrderOrderBy(filters),
        skip,
        take: filters.limit,
      }),
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.aggregate({ where, _sum: { grandTotal: true, totalQuantity: true } }),
    ]);

    return {
      items,
      total,
      totalAmount: aggregate._sum.grandTotal ?? new Prisma.Decimal(0),
      totalQuantity: aggregate._sum.totalQuantity ?? new Prisma.Decimal(0),
    };
  }

  async findPurchaseOrder(
    companyId: string,
    financialYearId: string,
    id: string
  ): Promise<PurchaseOrderWithDetail | null> {
    return prisma.purchaseOrder.findFirst({
      where: { id, companyId, financialYearId },
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

  async createPurchaseOrder(
    tx: Prisma.TransactionClient,
    header: PurchaseOrderHeaderWrite,
    lines: OrderLineWrite[]
  ): Promise<string> {
    const created = await tx.purchaseOrder.create({
      data: {
        ...header,
        lines: {
          create: lines.map((line) => ({
            companyId: header.companyId,
            lineNumber: line.lineNumber,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            description: line.description,
            yarnQualityName: line.yarnQualityName,
            yarnCount: line.yarnCount,
            denier: line.denier,
            yarnGradeName: line.yarnGradeName,
            lotNumber: line.lotNumber,
            specification: line.specification,
            unit: line.unit,
            quantity: line.quantity,
            rate: line.rate,
            discountPercent: line.discountPercent,
            discountAmount: line.discountAmount,
            taxableAmount: line.taxableAmount,
            gstRate: line.gstRate,
            cgstAmount: line.cgstAmount,
            sgstAmount: line.sgstAmount,
            igstAmount: line.igstAmount,
            lineTotal: line.lineTotal,
            expectedReceiptDate: line.expectedReceiptDate,
            revisedDeliveryDate: line.revisedDeliveryDate,
            deliveryLocationId: line.deliveryLocationId,
            remarks: line.remarks,
          })),
        },
      },
      select: { id: true },
    });
    return created.id;
  }

  async updatePurchaseOrderHeader(
    tx: Prisma.TransactionClient,
    id: string,
    header: PurchaseOrderHeaderWrite
  ): Promise<void> {
    await tx.purchaseOrder.update({
      where: { id },
      data: {
        orderDate: header.orderDate,
        partyId: header.partyId,
        supplierQuotationNumber: header.supplierQuotationNumber,
        supplierQuotationDate: header.supplierQuotationDate,
        supplierReference: header.supplierReference,
        supplierGstin: header.supplierGstin,
        billingAddress: header.billingAddress,
        deliveryLocationId: header.deliveryLocationId,
        expectedDeliveryDate: header.expectedDeliveryDate,
        buyerName: header.buyerName,
        paymentTerms: header.paymentTerms,
        deliveryTerms: header.deliveryTerms,
        freightTerms: header.freightTerms,
        transportDetails: header.transportDetails,
        priority: header.priority,
        placeOfSupplyState: header.placeOfSupplyState,
        taxType: header.taxType,
        totalQuantity: header.totalQuantity,
        subtotal: header.subtotal,
        discountAmount: header.discountAmount,
        taxableAmount: header.taxableAmount,
        cgstAmount: header.cgstAmount,
        sgstAmount: header.sgstAmount,
        igstAmount: header.igstAmount,
        freightAmount: header.freightAmount,
        packingAmount: header.packingAmount,
        otherCharges: header.otherCharges,
        roundOffAmount: header.roundOffAmount,
        grandTotal: header.grandTotal,
        narration: header.narration,
        remarks: header.remarks,
        termsAndConditions: header.termsAndConditions,
      },
    });
  }

  async replacePurchaseOrderLines(
    tx: Prisma.TransactionClient,
    orderId: string,
    companyId: string,
    lines: OrderLineWrite[]
  ): Promise<void> {
    await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: orderId } });
    await tx.purchaseOrderLine.createMany({
      data: lines.map((line) => ({
        companyId,
        purchaseOrderId: orderId,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        description: line.description,
        yarnQualityName: line.yarnQualityName,
        yarnCount: line.yarnCount,
        denier: line.denier,
        yarnGradeName: line.yarnGradeName,
        lotNumber: line.lotNumber,
        specification: line.specification,
        unit: line.unit,
        quantity: line.quantity,
        rate: line.rate,
        discountPercent: line.discountPercent,
        discountAmount: line.discountAmount,
        taxableAmount: line.taxableAmount,
        gstRate: line.gstRate,
        cgstAmount: line.cgstAmount,
        sgstAmount: line.sgstAmount,
        igstAmount: line.igstAmount,
        lineTotal: line.lineTotal,
        expectedReceiptDate: line.expectedReceiptDate,
        revisedDeliveryDate: line.revisedDeliveryDate,
        deliveryLocationId: line.deliveryLocationId,
        remarks: line.remarks,
      })),
    });
  }

  async updatePurchaseOrderStatus(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.PurchaseOrderUncheckedUpdateInput
  ): Promise<void> {
    await tx.purchaseOrder.update({ where: { id }, data });
  }

  // -------------------------------------------------------------- reports

  async salesReportRows(
    companyId: string,
    financialYearId: string,
    where: Prisma.SalesOrderWhereInput
  ): Promise<SalesOrderWithDetail[]> {
    return prisma.salesOrder.findMany({
      where: { companyId, financialYearId, ...where },
      include: SALES_ORDER_INCLUDE,
      orderBy: [{ orderDate: 'asc' }, { orderNumber: 'asc' }],
      take: 2000,
    });
  }

  async purchaseReportRows(
    companyId: string,
    financialYearId: string,
    where: Prisma.PurchaseOrderWhereInput
  ): Promise<PurchaseOrderWithDetail[]> {
    return prisma.purchaseOrder.findMany({
      where: { companyId, financialYearId, ...where },
      include: PURCHASE_ORDER_INCLUDE,
      orderBy: [{ orderDate: 'asc' }, { orderNumber: 'asc' }],
      take: 2000,
    });
  }
}

export { prisma as orderPrisma };