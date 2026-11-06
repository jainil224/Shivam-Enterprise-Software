import { Prisma, PrismaClient, PurchaseOrderStatus } from '@prisma/client';
import { OrderRepository, PurchaseOrderWithDetail } from '../repositories/orderRepository.js';
import { FieldError, conflictError, notFoundError, validationError } from '../utils/appError.js';
import { moneyFixed, percentFixed, quantityFixed, rateFixed } from '../utils/orderMath.js';
import {
  OrderLinePayload,
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
  serializeHistoryEntry,
  taxTypeFor,
  toDateKey,
  toIso,
  totalsFor,
} from './orderShared.js';

const prisma = new PrismaClient();
const repo = new OrderRepository();

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'DRAFT',
  'APPROVED',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
];

export interface PurchaseOrderPayload {
  orderDate?: string;
  partyId?: string;
  supplierQuotationNumber?: string | null;
  supplierQuotationDate?: string | null;
  supplierReference?: string | null;
  supplierGstin?: string | null;
  billingAddress?: string | null;
  deliveryLocationId?: string | null;
  expectedDeliveryDate?: string | null;
  buyerName?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  freightTerms?: string | null;
  transportDetails?: string | null;
  priority?: string;
  placeOfSupplyState?: string | null;
  taxType?: string | null;
  freightAmount?: string | number | null;
  packingAmount?: string | number | null;
  otherCharges?: string | number | null;
  narration?: string | null;
  remarks?: string | null;
  termsAndConditions?: string | null;
  lines?: OrderLinePayload[];
}

export interface PurchaseOrderLineView {
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
  expectedReceiptDate: string | null;
  revisedDeliveryDate: string | null;
  deliveryLocationId: string | null;
  deliveryLocationName: string | null;
  remarks: string | null;
  receivedQuantity: string;
  pendingQuantity: string;
}

export interface PurchaseOrderView {
  id: string;
  companyId: string;
  financialYearId: string;
  orderNumber: string;
  orderDate: string;
  status: PurchaseOrderStatus;
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
  lines: PurchaseOrderLineView[];
}

function nonNegative(value: Prisma.Decimal): Prisma.Decimal {
  return value.lt(0) ? new Prisma.Decimal(0) : value;
}

function addressSnapshot(
  party: {
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  } | null
): string | null {
  if (!party) return null;
  const parts = [party.address, party.city, party.state, party.pincode].filter(
    (part): part is string => Boolean(part && part.trim() !== '')
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

export class PurchaseOrderService {
  private serialize(
    order: PurchaseOrderWithDetail,
    receivedByLine: Map<string, Prisma.Decimal>,
    totalReceived: Prisma.Decimal
  ): PurchaseOrderView {
    const totalPending = nonNegative(new Prisma.Decimal(order.totalQuantity).minus(totalReceived));

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
      supplierQuotationNumber: order.supplierQuotationNumber,
      supplierQuotationDate: toDateKey(order.supplierQuotationDate),
      supplierReference: order.supplierReference,
      supplierGstin: order.supplierGstin,
      billingAddress: order.billingAddress,
      deliveryLocationId: order.deliveryLocationId,
      deliveryLocationName: order.deliveryLocation?.locationName ?? null,
      expectedDeliveryDate: toDateKey(order.expectedDeliveryDate),
      buyerName: order.buyerName,
      paymentTerms: order.paymentTerms,
      deliveryTerms: order.deliveryTerms,
      freightTerms: order.freightTerms,
      transportDetails: order.transportDetails,
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
      totalReceivedQuantity: quantityFixed(totalReceived),
      totalPendingQuantity: quantityFixed(totalPending),
      narration: order.narration,
      remarks: order.remarks,
      termsAndConditions: order.termsAndConditions,
      supplierConfirmationDate: toDateKey(order.supplierConfirmationDate),
      approvedAt: toIso(order.approvedAt),
      sentAt: toIso(order.sentAt),
      cancellationReason: order.cancellationReason,
      cancelledAt: toIso(order.cancelledAt),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lines: order.lines.map((line) => {
        const received = receivedByLine.get(line.id) ?? new Prisma.Decimal(0);
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
          lotNumber: line.lotNumber,
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
          expectedReceiptDate: toDateKey(line.expectedReceiptDate),
          revisedDeliveryDate: toDateKey(line.revisedDeliveryDate),
          deliveryLocationId: line.deliveryLocationId,
          deliveryLocationName: line.deliveryLocation?.locationName ?? null,
          remarks: line.remarks,
          receivedQuantity: quantityFixed(received),
          pendingQuantity: quantityFixed(
            nonNegative(new Prisma.Decimal(line.quantity).minus(received))
          ),
        };
      }),
    };
  }

  private async serializeMany(orders: PurchaseOrderWithDetail[]): Promise<PurchaseOrderView[]> {
    if (orders.length === 0) return [];
    const companyId = orders[0].companyId;
    const orderIds = orders.map((order) => order.id);
    const lineIds = orders.flatMap((order) => order.lines.map((line) => line.id));

    const [byOrder, byLine] = await Promise.all([
      repo.fulfilledByOrder(companyId, 'PURCHASE_ORDER', orderIds),
      repo.fulfilledByLine(companyId, 'PURCHASE_ORDER', lineIds),
    ]);

    return orders.map((order) =>
      this.serialize(order, byLine, byOrder.get(order.id) ?? new Prisma.Decimal(0))
    );
  }

  private async findScoped(companyId: string, financialYearId: string, id: string) {
    const order = await repo.findPurchaseOrder(companyId, financialYearId, id);
    if (!order) {
      notFoundError('Purchase order not found for the active company and financial year.');
    }
    return order;
  }
  private async resolveDeliveryLocation(
    companyId: string,
    raw: unknown,
    errors: FieldError[],
    field: string
  ): Promise<string | null> {
    const id = cleanText(raw, 64);
    if (!id) return null;
    const location = await prisma.location.findFirst({
      where: { id, companyId },
      select: { id: true, isActive: true },
    });
    if (!location) {
      errors.push({
        field,
        message: 'Selected delivery location does not belong to the active company.',
      });
      return null;
    }
    if (!location.isActive) {
      errors.push({ field, message: 'Selected delivery location is inactive.' });
      return null;
    }
    return location.id;
  }

  async getLookups(companyId: string, financialYearId: string) {
    const context = await loadOrderContext(prisma, companyId, financialYearId, false);

    const [parties, items, locations, sequence] = await Promise.all([
      prisma.party.findMany({
        where: { companyId, isActive: true, partyType: { in: ['SUPPLIER', 'BOTH'] } },
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
      prisma.location.findMany({
        where: { companyId, isActive: true },
        select: { id: true, locationName: true },
        orderBy: { locationName: 'asc' },
      }),
      repo.peekSequence(companyId, financialYearId, 'PURCHASE_ORDER'),
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
      nextOrderNumber: orderNumberFor('PO', context.financialYear, sequence),
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
      locations,
      statuses: PURCHASE_ORDER_STATUSES,
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
    const sequence = await repo.peekSequence(companyId, financialYearId, 'PURCHASE_ORDER');
    return { orderNumber: orderNumberFor('PO', context.financialYear, sequence) };
  }

  async list(companyId: string, financialYearId: string, query: Record<string, unknown>) {
    const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(query.limit ?? '20'), 10) || 20)
    );

    const status =
      typeof query.status === 'string' &&
      PURCHASE_ORDER_STATUSES.includes(query.status as PurchaseOrderStatus)
        ? (query.status as PurchaseOrderStatus)
        : undefined;

    const parseFilterDate = (raw: unknown, field: string): Date | undefined => {
      if (raw === null || raw === undefined || String(raw).trim() === '') return undefined;
      return captureDate([], raw, field, field) ?? undefined;
    };

    const result = await repo.listPurchaseOrders(companyId, financialYearId, {
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
        'PURCHASE_ORDER',
        order.lines.map((line) => line.id)
      ),
      repo.fulfilledByOrder(companyId, 'PURCHASE_ORDER', [order.id]),
    ]);
    return this.serialize(order, byLine, byOrder.get(order.id) ?? new Prisma.Decimal(0));
  }

  async history(companyId: string, financialYearId: string, id: string) {
    await this.findScoped(companyId, financialYearId, id);
    const entries = await repo.findHistory(companyId, financialYearId, 'PURCHASE_ORDER', id);
    return entries.map(serializeHistoryEntry);
  }

  async create(companyId: string, financialYearId: string, payload: PurchaseOrderPayload) {
    const context = await loadOrderContext(prisma, companyId, financialYearId, true);
    const errors: FieldError[] = [];

    const orderDate = captureRequiredDate(errors, payload.orderDate, 'orderDate', 'Order date');
    assertDateInsideFy(errors, orderDate, context.financialYear, 'orderDate', 'Order date');

    const priority = parsePriority(errors, payload.priority);
    const party = await resolveParty(prisma, companyId, payload.partyId, ['SUPPLIER', 'BOTH'], errors);
    const { taxType, placeOfSupplyState } = taxTypeFor(
      context.company.state,
      party?.state,
      payload.taxType,
      errors
    );

    const supplierQuotationDate = captureDate(
      errors,
      payload.supplierQuotationDate,
      'supplierQuotationDate',
      'Supplier quotation date'
    );
    const expectedDeliveryDate = captureDate(
      errors,
      payload.expectedDeliveryDate,
      'expectedDeliveryDate',
      'Expected delivery date'
    );

    const headerLocationId = await this.resolveDeliveryLocation(
      companyId,
      payload.deliveryLocationId,
      errors,
      'deliveryLocationId'
    );

    const charges = resolveCharges(errors, payload);
    const { lines, computed } = await resolveLines(
      prisma,
      companyId,
      payload.lines,
      taxType,
      { sales: false },
      errors
    );

    for (const line of lines) {
      const resolvedLocation = await this.resolveDeliveryLocation(
        companyId,
        line.deliveryLocationId,
        errors,
        `lines[${line.lineNumber - 1}].deliveryLocationId`
      );
      line.deliveryLocationId = resolvedLocation;
    }

    const totals = totalsFor(computed, charges);

    if (errors.length > 0) {
      validationError(errors);
    }

    const billingAddress = cleanText(payload.billingAddress, 500) ?? addressSnapshot(party);
    const supplierGstin = cleanText(payload.supplierGstin, 20) ?? party?.gstin ?? null;

    const createdId = await prisma.$transaction(async (tx) => {
      const sequence = await repo.nextSequence(tx, companyId, financialYearId, 'PURCHASE_ORDER');
      const orderNumber = orderNumberFor('PO', context.financialYear, sequence);

      const id = await repo.createPurchaseOrder(
        tx,
        {
          companyId,
          financialYearId,
          orderNumber,
          orderDate: orderDate as Date,
          partyId: (party as NonNullable<typeof party>).id,
          supplierQuotationNumber: cleanText(payload.supplierQuotationNumber, 100),
          supplierQuotationDate,
          supplierReference: cleanText(payload.supplierReference, 120),
          supplierGstin,
          billingAddress,
          deliveryLocationId: headerLocationId,
          expectedDeliveryDate,
          buyerName: cleanText(payload.buyerName, 120),
          paymentTerms: cleanText(payload.paymentTerms, 120),
          deliveryTerms: cleanText(payload.deliveryTerms, 120),
          freightTerms: cleanText(payload.freightTerms, 120),
          transportDetails: cleanText(payload.transportDetails, 200),
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
          narration: cleanText(payload.narration, 500),
          remarks: cleanText(payload.remarks, 500),
          termsAndConditions: cleanText(payload.termsAndConditions, 2000),
        },
        lines
      );

      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'PURCHASE_ORDER',
        salesOrderId: null,
        purchaseOrderId: id,
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        note: `Purchase order ${orderNumber} created.`,
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
    payload: PurchaseOrderPayload
  ) {
    const context = await loadOrderContext(prisma, companyId, financialYearId, true);
    const existing = await this.findScoped(companyId, financialYearId, id);

    if (existing.status !== 'DRAFT') {
      conflictError(
        `Purchase order ${existing.orderNumber} is ${existing.status}. Only draft orders can be edited.`
      );
    }

    const errors: FieldError[] = [];
    const orderDate = captureRequiredDate(errors, payload.orderDate, 'orderDate', 'Order date');
    assertDateInsideFy(errors, orderDate, context.financialYear, 'orderDate', 'Order date');

    const priority = parsePriority(errors, payload.priority);
    const party = await resolveParty(prisma, companyId, payload.partyId, ['SUPPLIER', 'BOTH'], errors);
    const { taxType, placeOfSupplyState } = taxTypeFor(
      context.company.state,
      party?.state,
      payload.taxType,
      errors
    );

    const supplierQuotationDate = captureDate(
      errors,
      payload.supplierQuotationDate,
      'supplierQuotationDate',
      'Supplier quotation date'
    );
    const expectedDeliveryDate = captureDate(
      errors,
      payload.expectedDeliveryDate,
      'expectedDeliveryDate',
      'Expected delivery date'
    );

    const headerLocationId = await this.resolveDeliveryLocation(
      companyId,
      payload.deliveryLocationId,
      errors,
      'deliveryLocationId'
    );

    const charges = resolveCharges(errors, payload);
    const { lines, computed } = await resolveLines(
      prisma,
      companyId,
      payload.lines,
      taxType,
      { sales: false },
      errors
    );

    for (const line of lines) {
      const resolvedLocation = await this.resolveDeliveryLocation(
        companyId,
        line.deliveryLocationId,
        errors,
        `lines[${line.lineNumber - 1}].deliveryLocationId`
      );
      line.deliveryLocationId = resolvedLocation;
    }

    const totals = totalsFor(computed, charges);

    if (errors.length > 0) {
      validationError(errors);
    }

    const billingAddress = cleanText(payload.billingAddress, 500) ?? addressSnapshot(party);
    const supplierGstin = cleanText(payload.supplierGstin, 20) ?? party?.gstin ?? null;

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockPurchaseOrder(tx, companyId, financialYearId, id);
      } catch {
        notFoundError('Purchase order not found for the active company and financial year.');
      }

      const locked = await tx.purchaseOrder.findFirst({ where: { id, companyId, financialYearId } });
      if (!locked) {
        notFoundError('Purchase order not found for the active company and financial year.');
      }
      if (locked.status !== 'DRAFT') {
        conflictError(
          `Purchase order ${locked.orderNumber} is ${locked.status} and can no longer be edited.`
        );
      }

      await repo.updatePurchaseOrderHeader(tx, id, {
        companyId,
        financialYearId,
        orderNumber: locked.orderNumber,
        orderDate: orderDate as Date,
        partyId: (party as NonNullable<typeof party>).id,
        supplierQuotationNumber: cleanText(payload.supplierQuotationNumber, 100),
        supplierQuotationDate,
        supplierReference: cleanText(payload.supplierReference, 120),
        supplierGstin,
        billingAddress,
        deliveryLocationId: headerLocationId,
        expectedDeliveryDate,
        buyerName: cleanText(payload.buyerName, 120),
        paymentTerms: cleanText(payload.paymentTerms, 120),
        deliveryTerms: cleanText(payload.deliveryTerms, 120),
        freightTerms: cleanText(payload.freightTerms, 120),
        transportDetails: cleanText(payload.transportDetails, 200),
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
        narration: cleanText(payload.narration, 500),
        remarks: cleanText(payload.remarks, 500),
        termsAndConditions: cleanText(payload.termsAndConditions, 2000),
      });

      await repo.replacePurchaseOrderLines(tx, id, companyId, lines);

      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'PURCHASE_ORDER',
        salesOrderId: null,
        purchaseOrderId: id,
        action: 'UPDATED',
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        note: `Draft purchase order ${locked.orderNumber} updated.`,
        reason: null,
      });
    });

    return this.getById(companyId, financialYearId, id);
  }

  private async transition(
    companyId: string,
    financialYearId: string,
    id: string,
    options: {
      from: PurchaseOrderStatus[];
      to: PurchaseOrderStatus;
      action: 'APPROVED' | 'SENT' | 'ACKNOWLEDGED';
      stamp?:
        | { field: 'approvedAt' | 'sentAt' | 'supplierConfirmationDate' }
        | undefined;
      describe: (orderNumber: string) => string;
    }
  ) {
    await loadOrderContext(prisma, companyId, financialYearId, true);
    const existing = await this.findScoped(companyId, financialYearId, id);

    if (!options.from.includes(existing.status)) {
      conflictError(
        `Purchase order ${existing.orderNumber} is ${existing.status} and cannot move to ${options.to}.`
      );
    }

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockPurchaseOrder(tx, companyId, financialYearId, id);
      } catch {
        notFoundError('Purchase order not found for the active company and financial year.');
      }

      const locked = await tx.purchaseOrder.findFirst({ where: { id, companyId, financialYearId } });
      if (!locked) {
        notFoundError('Purchase order not found for the active company and financial year.');
      }
      if (!options.from.includes(locked.status)) {
        conflictError(
          `Purchase order ${locked.orderNumber} is already ${locked.status} and cannot move to ${options.to}.`
        );
      }

      const stamp = new Date();
      const data: Prisma.PurchaseOrderUncheckedUpdateInput = { status: options.to };
      if (options.stamp?.field === 'approvedAt') data.approvedAt = stamp;
      if (options.stamp?.field === 'sentAt') data.sentAt = stamp;
      if (options.stamp?.field === 'supplierConfirmationDate') data.supplierConfirmationDate = stamp;

      await repo.updatePurchaseOrderStatus(tx, id, data);
      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'PURCHASE_ORDER',
        salesOrderId: null,
        purchaseOrderId: id,
        action: options.action,
        fromStatus: locked.status,
        toStatus: options.to,
        note: options.describe(locked.orderNumber),
        reason: null,
      });
    });

    return this.getById(companyId, financialYearId, id);
  }

  async approve(companyId: string, financialYearId: string, id: string) {
    return this.transition(companyId, financialYearId, id, {
      from: ['DRAFT'],
      to: 'APPROVED',
      action: 'APPROVED',
      stamp: { field: 'approvedAt' },
      describe: (orderNumber) => `Purchase order ${orderNumber} approved.`,
    });
  }

  async send(companyId: string, financialYearId: string, id: string) {
    return this.transition(companyId, financialYearId, id, {
      from: ['APPROVED'],
      to: 'SENT',
      action: 'SENT',
      stamp: { field: 'sentAt' },
      describe: (orderNumber) => `Purchase order ${orderNumber} marked as sent to supplier.`,
    });
  }

  async acknowledge(companyId: string, financialYearId: string, id: string) {
    return this.transition(companyId, financialYearId, id, {
      from: ['SENT'],
      to: 'ACKNOWLEDGED',
      action: 'ACKNOWLEDGED',
      stamp: { field: 'supplierConfirmationDate' },
      describe: (orderNumber) => `Purchase order ${orderNumber} acknowledged by the supplier.`,
    });
  }

  async cancel(companyId: string, financialYearId: string, id: string, reasonRaw: unknown) {
    await loadOrderContext(prisma, companyId, financialYearId, true);
    const existing = await this.findScoped(companyId, financialYearId, id);

    if (existing.status === 'CANCELLED') {
      conflictError(`Purchase order ${existing.orderNumber} is already cancelled.`);
    }
    if (existing.status === 'RECEIVED' || existing.status === 'CLOSED') {
      conflictError(
        `Purchase order ${existing.orderNumber} is ${existing.status} and cannot be cancelled.`
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
        await repo.lockPurchaseOrder(tx, companyId, financialYearId, id);
      } catch {
        notFoundError('Purchase order not found for the active company and financial year.');
      }

      const links = await tx.orderFulfilmentLink.count({
        where: { companyId, orderType: 'PURCHASE_ORDER', orderId: id },
      });
      if (links > 0) {
        conflictError(
          'This purchase order already has linked receipt documents. Cancelling it would remove valid fulfilment history.'
        );
      }

      const locked = await tx.purchaseOrder.findFirst({ where: { id, companyId, financialYearId } });
      if (!locked) {
        notFoundError('Purchase order not found for the active company and financial year.');
      }
      if (locked.status === 'CANCELLED') {
        conflictError(`Purchase order ${locked.orderNumber} is already cancelled.`);
      }

      await repo.updatePurchaseOrderStatus(tx, id, {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
      });
      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'PURCHASE_ORDER',
        salesOrderId: null,
        purchaseOrderId: id,
        action: 'CANCELLED',
        fromStatus: locked.status,
        toStatus: 'CANCELLED',
        note: `Purchase order ${locked.orderNumber} cancelled.`,
        reason,
      });
    });

    return this.getById(companyId, financialYearId, id);
  }

  async copy(companyId: string, financialYearId: string, id: string) {
    await loadOrderContext(prisma, companyId, financialYearId, true);
    const source = await this.findScoped(companyId, financialYearId, id);
    const today = new Date();

    const payload: PurchaseOrderPayload = {
      orderDate: new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      ).toISOString(),
      partyId: source.partyId,
      supplierQuotationNumber: null,
      supplierQuotationDate: null,
      supplierReference: source.supplierReference,
      supplierGstin: source.supplierGstin,
      billingAddress: source.billingAddress,
      deliveryLocationId: source.deliveryLocationId,
      expectedDeliveryDate: null,
      buyerName: source.buyerName,
      paymentTerms: source.paymentTerms,
      deliveryTerms: source.deliveryTerms,
      freightTerms: source.freightTerms,
      transportDetails: source.transportDetails,
      priority: source.priority,
      placeOfSupplyState: source.placeOfSupplyState,
      taxType: source.taxType,
      freightAmount: moneyFixed(source.freightAmount),
      packingAmount: moneyFixed(source.packingAmount),
      otherCharges: moneyFixed(source.otherCharges),
      narration: source.narration,
      remarks: source.remarks,
      termsAndConditions: source.termsAndConditions,
      lines: source.lines.map((line) => ({
        itemId: line.itemId ?? undefined,
        description: line.description,
        yarnQualityName: line.yarnQualityName,
        yarnGradeName: line.yarnGradeName,
        yarnCount: line.yarnCount,
        denier: line.denier,
        lotNumber: line.lotNumber,
        specification: line.specification,
        unit: line.unit,
        quantity: quantityFixed(line.quantity),
        rate: rateFixed(line.rate),
        discountPercent: percentFixed(line.discountPercent),
        gstRate: percentFixed(line.gstRate),
        expectedReceiptDate: null,
        revisedDeliveryDate: null,
        deliveryLocationId: line.deliveryLocationId,
        remarks: line.remarks,
      })),
    };

    const created = await this.create(companyId, financialYearId, payload);

    await prisma.$transaction(async (tx) => {
      await repo.addHistory(tx, {
        companyId,
        financialYearId,
        orderType: 'PURCHASE_ORDER',
        salesOrderId: null,
        purchaseOrderId: created.id,
        action: 'COPIED',
        fromStatus: null,
        toStatus: 'DRAFT',
        note: `Copied from purchase order ${source.orderNumber}.`,
        reason: null,
      });
    });

    return created;
  }

  async summary(companyId: string, financialYearId: string) {
    await loadOrderContext(prisma, companyId, financialYearId, false);
    const today = new Date(new Date().toISOString().slice(0, 10));

    const [counts, pending, overdue, overdueAmount] = await Promise.all([
      repo.purchaseStatusCounts(companyId, financialYearId),
      repo.purchasePendingTotals(companyId, financialYearId),
      prisma.purchaseOrder.count({
        where: {
          companyId,
          financialYearId,
          expectedDeliveryDate: { lt: today },
          status: { notIn: ['RECEIVED', 'CLOSED', 'CANCELLED'] },
        },
      }),
      prisma.purchaseOrder.aggregate({
        where: {
          companyId,
          financialYearId,
          expectedDeliveryDate: { lt: today },
          status: { notIn: ['RECEIVED', 'CLOSED', 'CANCELLED'] },
        },
        _sum: { grandTotal: true },
      }),
    ]);

    const statusCounts: Record<string, { count: number; amount: string }> = {};
    for (const status of PURCHASE_ORDER_STATUSES) {
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