import { Prisma, PrismaClient, SalesOrderStatus } from '@prisma/client';
import { OrderRepository, SalesOrderWithDetail } from '../repositories/orderRepository.js';
import { FieldError, conflictError, notFoundError, validationError } from '../utils/appError.js';
import { moneyFixed, percentFixed, quantityFixed, rateFixed } from '../utils/orderMath.js';
import {
  OrderLinePayload,
  OrderSchedulePayload,
  assertDateInsideFy,
  captureDate,
  captureRequiredDate,
  cleanText,
  loadOrderContext,
  orderNumberFor,
  parsePriority,
  resolveCharges,
  resolveLines,
  resolveParty,
  resolveSchedules,
  serializeHistoryEntry,
  taxTypeFor,
  toDateKey,
  toIso,
  totalsFor,
} from './orderShared.js';

const prisma = new PrismaClient();
const repo = new OrderRepository();

export const SALES_ORDER_STATUSES: SalesOrderStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CLOSED',
  'CANCELLED',
];

export interface SalesOrderPayload {
  orderDate?: string;
  partyId?: string;
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
  priority?: string;
  placeOfSupplyState?: string | null;
  taxType?: string | null;
  freightAmount?: string | number | null;
  packingAmount?: string | number | null;
  otherCharges?: string | number | null;
  narration?: string | null;
  remarks?: string | null;
  termsAndConditions?: string | null;
  scheduleIsPartial?: boolean;
  lines?: OrderLinePayload[];
  schedules?: OrderSchedulePayload[];
}

export interface SalesOrderLineView {
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
  unit: string;
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

export interface SalesOrderView {
  id: string;
  companyId: string;
  financialYearId: string;
  orderNumber: string;
  orderDate: string;
  status: SalesOrderStatus;
  priority: string;
  taxType: string;
  placeOfSupplyState: string | null;
  party: {
    id: string;
    partyName: string;
    partyCode: string;
    partyType: string;
    gstin: string | null;
    panNumber: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
  };
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
  totals: {
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
  };
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
  lines: SalesOrderLineView[];
  schedules: Array<{
    id: string;
    lineNumber: number;
    scheduleDate: string;
    quantity: string;
    note: string | null;
  }>;
}

function nonNegative(value: Prisma.Decimal): Prisma.Decimal {
  return value.lt(0) ? new Prisma.Decimal(0) : value;
}

function addressSnapshot(party: { address: string | null; city: string | null; state: string | null; pincode: string | null } | null): string | null {
  if (!party) return null;
  const parts = [party.address, party.city, party.state, party.pincode].filter(
    (part): part is string => Boolean(part && part.trim() !== '')
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

export class SalesOrderService {
  private serialize(
    order: SalesOrderWithDetail,
    fulfilledByLine: Map<string, Prisma.Decimal>,
    totalFulfilled: Prisma.Decimal
  ): SalesOrderView {
    const totalPending = nonNegative(new Prisma.Decimal(order.totalQuantity).minus(totalFulfilled));

    return {
      id: order.id,
      companyId: order.companyId,
      financialYearId: order.financialYearId,
      orderNumber: order.orderNumber,
      orderDate: toDateKey(order.orderDate) as string,
      status: order.status,
      priority: order.priority,
      taxType: order.taxType,
      placeOfSupplyState: order.placeOfSupplyState,
      party: {
        id: order.party.id,
        partyName: order.party.partyName,
        partyCode: order.party.partyCode,
        partyType: order.party.partyType,
        gstin: order.party.gstin,
        panNumber: order.party.panNumber,
        address: order.party.address,
        city: order.party.city,
        state: order.party.state,
        pincode: order.party.pincode,
        phone: order.party.phone,
        email: order.party.email,
      },
      customerReferenceNumber: order.customerReferenceNumber,
      customerReferenceDate: toDateKey(order.customerReferenceDate),
      billingAddress: order.billingAddress,
      deliveryAddress: order.deliveryAddress,
      expectedDeliveryDate: toDateKey(order.expectedDeliveryDate),
      salesperson: order.salesperson,
      paymentTerms: order.paymentTerms,
      deliveryTerms: order.deliveryTerms,
      freightTerms: order.freightTerms,
      orderValidUntil: toDateKey(order.orderValidUntil),
      totals: {
        totalQuantity: quantityFixed(order.totalQuantity),
        subtotal: moneyFixed(order.subtotal),
        discountAmount: moneyFixed(order.discountAmount),
        taxableAmount: moneyFixed(order.taxableAmount),
        cgstAmount: moneyFixed(order.cgstAmount),
        sgstAmount: moneyFixed(order.sgstAmount),
        igstAmount: moneyFixed(order.igstAmount),
        freightAmount: moneyFixed(order.freightAmount),
        packingAmount: moneyFixed(order.packingAmount),
        otherCharges: moneyFixed(order.otherCharges),
        roundOffAmount: moneyFixed(order.roundOffAmount),
        grandTotal: moneyFixed(order.grandTotal),
      },
      totalFulfilledQuantity: quantityFixed(totalFulfilled),
      totalPendingQuantity: quantityFixed(totalPending),
      scheduleIsPartial: order.scheduleIsPartial,
      narration: order.narration,
      remarks: order.remarks,
      termsAndConditions: order.termsAndConditions,
      confirmedAt: toIso(order.confirmedAt),
      cancellationReason: order.cancellationReason,
      cancelledAt: toIso(order.cancelledAt),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lines: order.lines.map((line) => {
        const fulfilled = fulfilledByLine.get(line.id) ?? new Prisma.Decimal(0);
        return {
          id: line.id,
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
          quantity: quantityFixed(line.quantity),
          rate: rateFixed(line.rate),
          discountPercent: percentFixed(line.discountPercent),
          discountAmount: moneyFixed(line.discountAmount),
          taxableAmount: moneyFixed(line.taxableAmount),
          gstRate: percentFixed(line.gstRate),
          cgstAmount: moneyFixed(line.cgstAmount),
          sgstAmount: moneyFixed(line.sgstAmount),
          igstAmount: moneyFixed(line.igstAmount),
          lineTotal: moneyFixed(line.lineTotal),
          expectedDeliveryDate: toDateKey(line.expectedDeliveryDate),
          remarks: line.remarks,
          fulfilledQuantity: quantityFixed(fulfilled),
          pendingQuantity: quantityFixed(
            nonNegative(new Prisma.Decimal(line.quantity).minus(fulfilled))
          ),
        };
      }),
      schedules: order.schedules.map((schedule) => {
        const line = order.lines.find((entry) => entry.id === schedule.salesOrderLineId);
        return {
          id: schedule.id,
          lineNumber: line?.lineNumber ?? 0,
          scheduleDate: toDateKey(schedule.scheduleDate) as string,
          quantity: quantityFixed(schedule.quantity),
          note: schedule.note,
        };
      }),
    };
  }

  private async serializeMany(orders: SalesOrderWithDetail[]): Promise<SalesOrderView[]> {
    if (orders.length === 0) return [];
    const companyId = orders[0].companyId;
    const orderIds = orders.map((order) => order.id);
    const lineIds = orders.flatMap((order) => order.lines.map((line) => line.id));

    const [byOrder, byLine] = await Promise.all([
      repo.fulfilledByOrder(companyId, 'SALES_ORDER', orderIds),
      repo.fulfilledByLine(companyId, 'SALES_ORDER', lineIds),
    ]);

    return orders.map((order) =>
      this.serialize(order, byLine, byOrder.get(order.id) ?? new Prisma.Decimal(0))
    );
  }

  private async findScoped(companyId: string, financialYearId: string, id: string) {
    const order = await repo.findSalesOrder(companyId, financialYearId, id);
    if (!order) {
      notFoundError('Sales order not found for the active company and financial year.');
    }
    return order;
  }
  async getLookups(companyId: string, financialYearId: string) {
    const context = await loadOrderContext(prisma, companyId, financialYearId, false);

    const [parties, items, sequence] = await Promise.all([
      prisma.party.findMany({
        where: { companyId, isActive: true, partyType: { in: ['CUSTOMER', 'BOTH'] } },
        select: {
          id: true,
          partyName: true,
          partyCode: true,
          partyType: true,
          gstin: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          phone: true,
          email: true,
        },
        orderBy: { partyName: 'asc' },
      }),
      prisma.item.findMany({
        where: { companyId, isActive: true },
        include: {
          yarnQuality: { select: { id: true, qualityName: true } },
          yarnGrade: { select: { id: true, gradeName: true } },
        },
        orderBy: { itemName: 'asc' },
      }),
      repo.peekSequence(companyId, financialYearId, 'SALES_ORDER'),
    ]);

    return {
      company: context.company,
      financialYear: {
        id: context.financialYear.id,
        yearName: context.financialYear.yearName,
        startDate: toDateKey(context.financialYear.startDate),
        endDate: toDateKey(context.financialYear.endDate),
        isLocked: context.financialYear.isLocked,
      },
      nextOrderNumber: orderNumberFor('SO', context.financialYear, sequence),
      parties,
      items: items.map((item) => ({
        id: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemCategory: item.itemCategory,
        itemType: item.itemType,
        unit: item.unit,
        hsnCode: item.hsnCode,
        gstRate: percentFixed(item.gstRate),
        defaultSalesRate: rateFixed(item.defaultSalesRate),
        defaultPurchaseRate: rateFixed(item.defaultPurchaseRate),
        description: item.description,
        yarnQualityId: item.yarnQualityId,
        yarnQualityName: item.yarnQuality?.qualityName ?? null,
        yarnGradeId: item.yarnGradeId,
        yarnGradeName: item.yarnGrade?.gradeName ?? null,
        yarnCount: item.yarnCount,
        denier: item.denier,
        lotNumber: item.lotNumber,
        fabricType: item.fabricType,
        fabricDesign: item.fabricDesign,
        colour: item.colour,
        sizeSpecification: item.sizeSpecification,
      })),
      statuses: SALES_ORDER_STATUSES,
      priorities: ['NORMAL', 'URGENT'],
      taxTypes: ['INTRA_STATE', 'INTER_STATE'],
      terms: {
        paymentTerms: ['100% Advance', '30 Days Credit', '45 Days Credit', 'Against Delivery'],
        deliveryTerms: ['Ex-Godown', 'Door Delivery', 'Ex-Works'],
        freightTerms: ['To Pay', 'Paid', 'Included in Rate'],
      },
    };
  }

  async nextNumber(companyId: string, financialYearId: string) {
    const context = await loadOrderContext(prisma, companyId, financialYearId, false);
    const sequence = await repo.peekSequence(companyId, financialYearId, 'SALES_ORDER');
    return { orderNumber: orderNumberFor('SO', context.financialYear, sequence) };
  }

  async list(companyId: string, financialYearId: string, query: Record<string, unknown>) {
    const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(query.limit ?? '20'), 10) || 20)
    );

    const status =
      typeof query.status === 'string' &&
      SALES_ORDER_STATUSES.includes(query.status as SalesOrderStatus)
        ? (query.status as SalesOrderStatus)
        : undefined;

    const parseFilterDate = (raw: unknown, field: string): Date | undefined => {
      if (raw === null || raw === undefined || String(raw).trim() === '') return undefined;
      return captureDate([], raw, field, field) ?? undefined;
    };

    const result = await repo.listSalesOrders(companyId, financialYearId, {
      search: typeof query.search === 'string' ? query.search : undefined,
      partyId: typeof query.partyId === 'string' ? query.partyId : undefined,
      itemId: typeof query.itemId === 'string' ? query.itemId : undefined,
      status,
      fromDate: parseFilterDate(query.fromDate, 'fromDate'),
      toDate: parseFilterDate(query.toDate, 'toDate'),
      expectedFrom: parseFilterDate(query.expectedFrom, 'expectedFrom'),
      expectedTo: parseFilterDate(query.expectedTo, 'expectedTo'),
      overdue: query.overdue === 'true' || query.overdue === true,
      sortBy:
        query.sortBy === 'number' || query.sortBy === 'amount' || query.sortBy === 'party'
          ? query.sortBy
          : 'date',
      sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
      page,
      limit,
    });

    return {
      items: await this.serializeMany(result.items),
      total: result.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
      totalAmount: moneyFixed(result.totalAmount),
      totalQuantity: quantityFixed(result.totalQuantity),
    };
  }

  async getById(companyId: string, financialYearId: string, id: string) {
    const order = await this.findScoped(companyId, financialYearId, id);
    const [byLine, byOrder] = await Promise.all([
      repo.fulfilledByLine(
        companyId,
        'SALES_ORDER',
        order.lines.map((line) => line.id)
      ),
      repo.fulfilledByOrder(companyId, 'SALES_ORDER', [order.id]),
    ]);
    return this.serialize(order, byLine, byOrder.get(order.id) ?? new Prisma.Decimal(0));
  }

  async history(companyId: string, financialYearId: string, id: string) {
    await this.findScoped(companyId, financialYearId, id);
    const entries = await repo.findHistory(companyId, financialYearId, 'SALES_ORDER', id);
    return entries.map(serializeHistoryEntry);
  }

  async create(companyId: string, financialYearId: string, payload: SalesOrderPayload) {
    const context = await loadOrderContext(prisma, companyId, financialYearId, true);
    const errors: FieldError[] = [];

    const orderDate = captureRequiredDate(errors, payload.orderDate, 'orderDate', 'Order date');
    assertDateInsideFy(errors, orderDate, context.financialYear, 'orderDate', 'Order date');

    const priority = parsePriority(errors, payload.priority);
    const party = await resolveParty(prisma, companyId, payload.partyId, ['CUSTOMER', 'BOTH'], errors);
    const { taxType, placeOfSupplyState } = taxTypeFor(
      context.company.state,
      party?.state,
      payload.taxType,
      errors
    );

    const customerReferenceDate = captureDate(
      errors,
      payload.customerReferenceDate,
      'customerReferenceDate',
      'Customer reference date'
    );
    const expectedDeliveryDate = captureDate(
      errors,
      payload.expectedDeliveryDate,
      'expectedDeliveryDate',
      'Expected delivery date'
    );
    const orderValidUntil = captureDate(
      errors,
      payload.orderValidUntil,
      'orderValidUntil',
      'Order valid until'
    );

    const charges = resolveCharges(errors, payload);
    const { lines, computed } = await resolveLines(
      prisma,
      companyId,
      payload.lines,
      taxType,
      { sales: true },
      errors
    );
    const { schedules, scheduleIsPartial } = await resolveSchedules(
      prisma,
      companyId,
      payload.schedules,
      lines,
      payload.scheduleIsPartial === true,
      errors
    );
    const totals = totalsFor(computed, charges);

    if (errors.length > 0) {
      validationError(errors);
    }

    const billingAddress =
      cleanText(payload.billingAddress, 500) ?? addressSnapshot(party);
    const deliveryAddress = cleanText(payload.deliveryAddress, 500) ?? billingAddress;

    const createdId = await prisma.$transaction(async (tx) => {
      const sequence = await repo.nextSequence(tx, companyId, financialYearId, 'SALES_ORDER');
      const orderNumber = orderNumberFor('SO', context.financialYear, sequence);

      const id = await repo.createSalesOrder(
        tx,
        {
          companyId,
          financialYearId,
          orderNumber,
          orderDate: orderDate as Date,
          partyId: (party as NonNullable<typeof party>).id,
          customerReferenceNumber: cleanText(payload.customerReferenceNumber, 100),
          customerReferenceDate,
          billingAddress,
          deliveryAddress,
          expectedDeliveryDate,
          salesperson: cleanText(payload.salesperson, 120),
          paymentTerms: cleanText(payload.paymentTerms, 120),
          deliveryTerms: cleanText(payload.deliveryTerms, 120),
          freightTerms: cleanText(payload.freightTerms, 120),
          orderValidUntil,
          priority,
          status: 'DRAFT',
          placeOfSupplyState,
          taxType,
          totalQuantity: totals.totalQuantity,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          freightAmount: totals.freightAmount,
          packingAmount: totals.packingAmount,
          otherCharges: totals.otherCharges,
          roundOffAmount: totals.roundOffAmount,
          grandTotal: totals.grandTotal,
          scheduleIsPartial,
          narration: cleanText(payload.narration, 500),
          remarks: cleanText(payload.remarks, 500),
          termsAndConditions: cleanText(payload.termsAndConditions, 2000),
        },
        lines,
        schedules
      );

      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'SALES_ORDER',
        salesOrderId: id,
        purchaseOrderId: null,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        note: `Sales order ${orderNumber} created.`,
        reason: null,
      });

      return id;
    });

    return this.getById(companyId, financialYearId, createdId);
  }

  async update(
    companyId: string,
    financialYearId: string,
    id: string,
    payload: SalesOrderPayload
  ) {
    const context = await loadOrderContext(prisma, companyId, financialYearId, true);
    const existing = await this.findScoped(companyId, financialYearId, id);

    if (existing.status !== 'DRAFT') {
      conflictError(
        `Sales order ${existing.orderNumber} is ${existing.status}. Only draft orders can be edited.`
      );
    }

    const errors: FieldError[] = [];
    const orderDate = captureRequiredDate(errors, payload.orderDate, 'orderDate', 'Order date');
    assertDateInsideFy(errors, orderDate, context.financialYear, 'orderDate', 'Order date');

    const priority = parsePriority(errors, payload.priority);
    const party = await resolveParty(prisma, companyId, payload.partyId, ['CUSTOMER', 'BOTH'], errors);
    const { taxType, placeOfSupplyState } = taxTypeFor(
      context.company.state,
      party?.state,
      payload.taxType,
      errors
    );

    const customerReferenceDate = captureDate(
      errors,
      payload.customerReferenceDate,
      'customerReferenceDate',
      'Customer reference date'
    );
    const expectedDeliveryDate = captureDate(
      errors,
      payload.expectedDeliveryDate,
      'expectedDeliveryDate',
      'Expected delivery date'
    );
    const orderValidUntil = captureDate(
      errors,
      payload.orderValidUntil,
      'orderValidUntil',
      'Order valid until'
    );

    const charges = resolveCharges(errors, payload);
    const { lines, computed } = await resolveLines(
      prisma,
      companyId,
      payload.lines,
      taxType,
      { sales: true },
      errors
    );
    const { schedules, scheduleIsPartial } = await resolveSchedules(
      prisma,
      companyId,
      payload.schedules,
      lines,
      payload.scheduleIsPartial === true,
      errors
    );
    const totals = totalsFor(computed, charges);

    if (errors.length > 0) {
      validationError(errors);
    }

    const billingAddress = cleanText(payload.billingAddress, 500) ?? addressSnapshot(party);
    const deliveryAddress = cleanText(payload.deliveryAddress, 500) ?? billingAddress;

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockSalesOrder(tx, companyId, financialYearId, id);
      } catch {
        notFoundError('Sales order not found for the active company and financial year.');
      }

      const locked = await tx.salesOrder.findFirst({ where: { id, companyId, financialYearId } });
      if (!locked) {
        notFoundError('Sales order not found for the active company and financial year.');
      }
      if (locked.status !== 'DRAFT') {
        conflictError(
          `Sales order ${locked.orderNumber} is ${locked.status} and can no longer be edited.`
        );
      }

      await repo.updateSalesOrderHeader(tx, id, {
        companyId,
        financialYearId,
        orderNumber: locked.orderNumber,
        orderDate: orderDate as Date,
        partyId: (party as NonNullable<typeof party>).id,
        customerReferenceNumber: cleanText(payload.customerReferenceNumber, 100),
        customerReferenceDate,
        billingAddress,
        deliveryAddress,
        expectedDeliveryDate,
        salesperson: cleanText(payload.salesperson, 120),
        paymentTerms: cleanText(payload.paymentTerms, 120),
        deliveryTerms: cleanText(payload.deliveryTerms, 120),
        freightTerms: cleanText(payload.freightTerms, 120),
        orderValidUntil,
        priority,
        status: 'DRAFT',
        placeOfSupplyState,
        taxType,
        totalQuantity: totals.totalQuantity,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        freightAmount: totals.freightAmount,
        packingAmount: totals.packingAmount,
        otherCharges: totals.otherCharges,
        roundOffAmount: totals.roundOffAmount,
        grandTotal: totals.grandTotal,
        scheduleIsPartial,
        narration: cleanText(payload.narration, 500),
        remarks: cleanText(payload.remarks, 500),
        termsAndConditions: cleanText(payload.termsAndConditions, 2000),
      });

      await repo.replaceSalesOrderLines(tx, id, companyId, lines, schedules);

      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'SALES_ORDER',
        salesOrderId: id,
        purchaseOrderId: null,
        action: 'UPDATED',
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        note: `Draft sales order ${locked.orderNumber} updated.`,
        reason: null,
      });
    });

    return this.getById(companyId, financialYearId, id);
  }
  async confirm(companyId: string, financialYearId: string, id: string) {
    await loadOrderContext(prisma, companyId, financialYearId, true);
    const existing = await this.findScoped(companyId, financialYearId, id);
    if (existing.status !== 'DRAFT') {
      conflictError(
        `Sales order ${existing.orderNumber} is ${existing.status}. Only a draft order can be confirmed.`
      );
    }

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockSalesOrder(tx, companyId, financialYearId, id);
      } catch {
        notFoundError('Sales order not found for the active company and financial year.');
      }
      const locked = await tx.salesOrder.findFirst({ where: { id, companyId, financialYearId } });
      if (!locked) {
        notFoundError('Sales order not found for the active company and financial year.');
      }
      if (locked.status !== 'DRAFT') {
        conflictError(`Sales order ${locked.orderNumber} is already ${locked.status}.`);
      }

      await repo.updateSalesOrderStatus(tx, id, { status: 'CONFIRMED', confirmedAt: new Date() });
      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'SALES_ORDER',
        salesOrderId: id,
        purchaseOrderId: null,
        action: 'CONFIRMED',
        fromStatus: 'DRAFT',
        toStatus: 'CONFIRMED',
        note: `Sales order ${locked.orderNumber} confirmed.`,
        reason: null,
      });
    });

    return this.getById(companyId, financialYearId, id);
  }

  async cancel(companyId: string, financialYearId: string, id: string, reasonRaw: unknown) {
    await loadOrderContext(prisma, companyId, financialYearId, true);
    const existing = await this.findScoped(companyId, financialYearId, id);

    if (existing.status === 'CANCELLED') {
      conflictError(`Sales order ${existing.orderNumber} is already cancelled.`);
    }
    if (existing.status === 'FULFILLED' || existing.status === 'CLOSED') {
      conflictError(
        `Sales order ${existing.orderNumber} is ${existing.status} and cannot be cancelled.`
      );
    }

    const reason = String(reasonRaw ?? '').trim();
    if (reason.length < 3) {
      validationError([
        { field: 'reason', message: 'A cancellation reason of at least 3 characters is required.' },
      ]);
    }
    if (reason.length > 250) {
      validationError([
        { field: 'reason', message: 'Cancellation reason cannot exceed 250 characters.' },
      ]);
    }

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockSalesOrder(tx, companyId, financialYearId, id);
      } catch {
        notFoundError('Sales order not found for the active company and financial year.');
      }

      const links = await tx.orderFulfilmentLink.count({
        where: { companyId, orderType: 'SALES_ORDER', orderId: id },
      });
      if (links > 0) {
        conflictError(
          'This sales order already has linked dispatch documents. Cancelling it would remove valid fulfilment history.'
        );
      }

      const locked = await tx.salesOrder.findFirst({ where: { id, companyId, financialYearId } });
      if (!locked) {
        notFoundError('Sales order not found for the active company and financial year.');
      }
      if (locked.status === 'CANCELLED') {
        conflictError(`Sales order ${locked.orderNumber} is already cancelled.`);
      }

      await repo.updateSalesOrderStatus(tx, id, {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
      });
      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'SALES_ORDER',
        salesOrderId: id,
        purchaseOrderId: null,
        action: 'CANCELLED',
        fromStatus: locked.status,
        toStatus: 'CANCELLED',
        note: `Sales order ${locked.orderNumber} cancelled.`,
        reason,
      });
    });

    return this.getById(companyId, financialYearId, id);
  }

  async copy(companyId: string, financialYearId: string, id: string) {
    await loadOrderContext(prisma, companyId, financialYearId, true);
    const source = await this.findScoped(companyId, financialYearId, id);
    const today = new Date();

    const payload: SalesOrderPayload = {
      orderDate: new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      ).toISOString(),
      partyId: source.partyId,
      customerReferenceNumber: source.customerReferenceNumber,
      customerReferenceDate: toDateKey(source.customerReferenceDate),
      billingAddress: source.billingAddress,
      deliveryAddress: source.deliveryAddress,
      expectedDeliveryDate: null,
      salesperson: source.salesperson,
      paymentTerms: source.paymentTerms,
      deliveryTerms: source.deliveryTerms,
      freightTerms: source.freightTerms,
      orderValidUntil: null,
      priority: source.priority,
      placeOfSupplyState: source.placeOfSupplyState,
      taxType: source.taxType,
      freightAmount: moneyFixed(source.freightAmount),
      packingAmount: moneyFixed(source.packingAmount),
      otherCharges: moneyFixed(source.otherCharges),
      narration: source.narration,
      remarks: source.remarks,
      termsAndConditions: source.termsAndConditions,
      scheduleIsPartial: source.scheduleIsPartial,
      lines: source.lines.map((line) => ({
        itemId: line.itemId ?? undefined,
        description: line.description,
        yarnQualityName: line.yarnQualityName,
        yarnGradeName: line.yarnGradeName,
        yarnCount: line.yarnCount,
        denier: line.denier,
        colour: line.colour,
        design: line.design,
        specification: line.specification,
        unit: line.unit,
        quantity: quantityFixed(line.quantity),
        rate: rateFixed(line.rate),
        discountPercent: percentFixed(line.discountPercent),
        gstRate: percentFixed(line.gstRate),
        expectedDeliveryDate: null,
        remarks: line.remarks,
      })),
      schedules: [],
    };

    const created = await this.create(companyId, financialYearId, payload);

    await prisma.$transaction(async (tx) => {
      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'SALES_ORDER',
        salesOrderId: created.id,
        purchaseOrderId: null,
        action: 'COPIED',
        fromStatus: null,
        toStatus: 'DRAFT',
        note: `Copied from sales order ${source.orderNumber}.`,
        reason: null,
      });
    });

    return created;
  }

  async summary(companyId: string, financialYearId: string) {
    await loadOrderContext(prisma, companyId, financialYearId, false);
    const today = new Date(new Date().toISOString().slice(0, 10));

    const [counts, pending, overdue, overdueAmount] = await Promise.all([
      repo.salesStatusCounts(companyId, financialYearId),
      repo.salesPendingTotals(companyId, financialYearId),
      prisma.salesOrder.count({
        where: {
          companyId,
          financialYearId,
          expectedDeliveryDate: { lt: today },
          status: { notIn: ['FULFILLED', 'CLOSED', 'CANCELLED'] },
        },
      }),
      prisma.salesOrder.aggregate({
        where: {
          companyId,
          financialYearId,
          expectedDeliveryDate: { lt: today },
          status: { notIn: ['FULFILLED', 'CLOSED', 'CANCELLED'] },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    const statusCounts: Record<string, { count: number; amount: string }> = {};
    for (const status of SALES_ORDER_STATUSES) {
      statusCounts[status] = { count: 0, amount: '0.00' };
    }
    for (const row of counts) {
      statusCounts[row.status] = {
        count: row._count._all,
        amount: moneyFixed(row._sum.grandTotal),
      };
    }

    return {
      statuses: statusCounts,
      pending: {
        count: pending._count._all,
        amount: moneyFixed(pending._sum.grandTotal),
        quantity: quantityFixed(pending._sum.totalQuantity),
      },
      overdue: {
        count: overdue,
        amount: moneyFixed(overdueAmount._sum.grandTotal),
      },
    };
  }
}