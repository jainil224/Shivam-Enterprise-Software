import {
  OrderPriority,
  OrderTaxType,
  Prisma,
  PrismaClient,
  UnitOfMeasure,
} from '@prisma/client';
import { FieldError, AppError } from '../utils/appError.js';
import {
  ComputedLine,
  ComputedTotals,
  OrderInputError,
  computeLine,
  computeTotals,
  parseOptionalMoney,
  parsePercent,
  parseQuantity,
  parseRate,
  resolveTaxType,
} from '../utils/orderMath.js';

export interface OrderContext {
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
    startDate: Date;
    endDate: Date;
    isLocked: boolean;
  };
}

export interface OrderLinePayload {
  lineNumber?: number;
  itemId?: string;
  description?: string | null;
  yarnQualityName?: string | null;
  yarnGradeName?: string | null;
  yarnCount?: string | null;
  denier?: string | null;
  colour?: string | null;
  design?: string | null;
  lotNumber?: string | null;
  specification?: string | null;
  unit?: string;
  quantity?: string | number | null;
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
  lineNumber?: number;
  scheduleDate?: string | null;
  quantity?: string | number | null;
  note?: string | null;
}

export interface ResolvedLine {
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

export interface ResolvedSchedule {
  lineNumber: number;
  scheduleDate: Date;
  quantity: Prisma.Decimal;
  note: string | null;
}

export interface ChargeTotals {
  freightAmount: Prisma.Decimal;
  packingAmount: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
}

export function toDateKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function cleanText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, maxLength);
}

export function parseDateRequired(raw: unknown, field: string, label: string): Date {
  const text = String(raw ?? '').trim();
  if (text === '') {
    throw new OrderInputError(field, `${label} is required.`);
  }
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = new Date(dateOnly ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(parsed.getTime())) {
    throw new OrderInputError(field, `${label} is not a valid date.`);
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0)
  );
}

export function parseDateOptional(raw: unknown, field: string, label: string): Date | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return null;
  }
  try {
    return parseDateRequired(raw, field, label);
  } catch (error) {
    if (error instanceof OrderInputError) {
      throw error;
    }
    throw new OrderInputError(field, `${label} is not a valid date.`);
  }
}

export function captureDate(
  errors: FieldError[],
  raw: unknown,
  field: string,
  label: string
): Date | null {
  try {
    return parseDateOptional(raw, field, label);
  } catch (error) {
    errors.push({
      field,
      message: error instanceof Error ? error.message : `${label} is invalid.`,
    });
    return null;
  }
}

export function captureRequiredDate(
  errors: FieldError[],
  raw: unknown,
  field: string,
  label: string
): Date | null {
  try {
    return parseDateRequired(raw, field, label);
  } catch (error) {
    errors.push({
      field,
      message: error instanceof Error ? error.message : `${label} is required.`,
    });
    return null;
  }
}

export function captureMoney(
  errors: FieldError[],
  raw: unknown,
  field: string,
  label: string
): Prisma.Decimal {
  try {
    return parseOptionalMoney(raw, field, label);
  } catch (error) {
    errors.push({
      field,
      message: error instanceof Error ? error.message : `${label} is invalid.`,
    });
    return new Prisma.Decimal(0);
  }
}

export async function loadOrderContext(
  prisma: PrismaClient,
  companyId: string,
  financialYearId: string,
  enforceUnlocked: boolean
): Promise<OrderContext> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      companyName: true,
      companyCode: true,
      gstin: true,
      panNumber: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      email: true,
      logoPath: true,
      isActive: true,
    },
  });

  if (!company || !company.isActive) {
    throw new AppError(400, 'Active company context is invalid or the company is inactive.');
  }

  const financialYear = await prisma.financialYear.findFirst({
    where: { id: financialYearId, companyId },
    select: {
      id: true,
      yearName: true,
      startDate: true,
      endDate: true,
      isLocked: true,
      isActive: true,
    },
  });

  if (!financialYear || !financialYear.isActive) {
    throw new AppError(400, 'Active financial year context is invalid for the selected company.');
  }

  if (enforceUnlocked && financialYear.isLocked) {
    throw new AppError(
      409,
      `Financial year ${financialYear.yearName} is locked. Creating, editing, approving and cancelling orders is blocked.`
    );
  }

  return {
    company: {
      id: company.id,
      companyName: company.companyName,
      companyCode: company.companyCode,
      gstin: company.gstin,
      panNumber: company.panNumber,
      address: company.address,
      city: company.city,
      state: company.state,
      pincode: company.pincode,
      phone: company.phone,
      email: company.email,
      logoPath: company.logoPath,
    },
    financialYear: {
      id: financialYear.id,
      yearName: financialYear.yearName,
      startDate: financialYear.startDate,
      endDate: financialYear.endDate,
      isLocked: financialYear.isLocked,
    },
  };
}

export function orderNumberFor(
  prefix: string,
  financialYear: { startDate: Date },
  sequence: number
): string {
  return `${prefix}-${financialYear.startDate.getUTCFullYear()}-${String(sequence).padStart(4, '0')}`;
}

export function assertDateInsideFy(
  errors: FieldError[],
  date: Date | null,
  financialYear: OrderContext['financialYear'],
  field: string,
  label: string
): void {
  if (!date) return;
  const key = date.toISOString().slice(0, 10);
  const start = financialYear.startDate.toISOString().slice(0, 10);
  const end = financialYear.endDate.toISOString().slice(0, 10);
  if (key < start || key > end) {
    errors.push({
      field,
      message: `${label} must fall inside financial year ${financialYear.yearName} (${start} to ${end}).`,
    });
  }
}

export function parsePriority(
  errors: FieldError[],
  raw: unknown
): OrderPriority {
  if (raw === null || raw === undefined || raw === '') return 'NORMAL';
  if (raw === 'NORMAL' || raw === 'URGENT') return raw;
  errors.push({ field: 'priority', message: 'Priority must be Normal or Urgent.' });
  return 'NORMAL';
}

const UNITS: UnitOfMeasure[] = [
  'KG',
  'GRAM',
  'METER',
  'YARD',
  'PIECE',
  'ROLL',
  'BOX',
  'CARTON',
  'PACKET',
  'NOS',
];

export function parseUnit(errors: FieldError[], raw: unknown, fallback: UnitOfMeasure): UnitOfMeasure {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (UNITS.includes(raw as UnitOfMeasure)) return raw as UnitOfMeasure;
  errors.push({ field: 'unit', message: `Unit must be one of ${UNITS.join(', ')}.` });
  return fallback;
}

export interface ResolvedParty {
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
}

interface OrderedItem {
  id: string;
  companyId: string;
  itemCode: string;
  itemName: string;
  description: string | null;
  itemType: string;
  unit: UnitOfMeasure;
  gstRate: Prisma.Decimal;
  defaultSalesRate: Prisma.Decimal;
  defaultPurchaseRate: Prisma.Decimal;
  yarnCount: string | null;
  denier: string | null;
  lotNumber: string | null;
  fabricDesign: string | null;
  sizeSpecification: string | null;
  colour: string | null;
  isActive: boolean;
  yarnQuality: { qualityName: string } | null;
  yarnGrade: { gradeName: string } | null;
}

export async function resolveParty(
  prisma: PrismaClient,
  companyId: string,
  rawPartyId: unknown,
  allowedTypes: string[],
  errors: FieldError[],
  options?: { required?: boolean }
): Promise<ResolvedParty | null> {
  const required = options?.required !== false;
  const partyId = cleanText(rawPartyId, 64);
  if (!partyId) {
    if (required) {
      errors.push({ field: 'partyId', message: 'Party selection is required.' });
    }
    return null;
  }

  const party = await prisma.party.findFirst({
    where: { id: partyId, companyId },
    select: {
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
    },
  });

  if (!party) {
    errors.push({
      field: 'partyId',
      message: 'Selected party does not belong to the active company.',
    });
    return null;
  }
  if (!party.isActive) {
    errors.push({ field: 'partyId', message: 'Selected party is inactive.' });
    return null;
  }
  if (!allowedTypes.includes(party.partyType)) {
    errors.push({
      field: 'partyId',
      message: `Selected party is not a ${allowedTypes.includes('CUSTOMER') ? 'customer' : 'supplier'}. Update the Party Master if this is intentional.`,
    });
    return null;
  }

  return {
    id: party.id,
    partyName: party.partyName,
    partyCode: party.partyCode,
    partyType: party.partyType,
    gstin: party.gstin,
    panNumber: party.panNumber,
    address: party.address,
    city: party.city,
    state: party.state,
    pincode: party.pincode,
    phone: party.phone,
    email: party.email,
  };
}

export async function resolveLines(
  prisma: PrismaClient,
  companyId: string,
  rawLines: unknown,
  taxType: OrderTaxType,
  defaults: { sales: boolean },
  errors: FieldError[]
): Promise<{ lines: ResolvedLine[]; computed: ComputedLine[] }> {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    errors.push({ field: 'lines', message: 'At least one order line is required.' });
    return { lines: [], computed: [] };
  }
  if (rawLines.length > 200) {
    errors.push({ field: 'lines', message: 'An order cannot contain more than 200 lines.' });
    return { lines: [], computed: [] };
  }

  const payloads = rawLines as OrderLinePayload[];
  const seenItems = new Set<string>();
  const resolved: ResolvedLine[] = [];
  const computed: ComputedLine[] = [];

  const ids = payloads
    .map((line) => cleanText(line.itemId, 64))
    .filter((id): id is string => Boolean(id));

  const items = await prisma.item.findMany({
    where: { companyId, id: { in: ids } },
    include: {
      yarnQuality: { select: { qualityName: true } },
      yarnGrade: { select: { gradeName: true } },
    },
  });
  const itemById = new Map<string, OrderedItem>();
  for (const item of items) {
    itemById.set(item.id, item as OrderedItem);
  }

  payloads.forEach((payload, index) => {
    const lineNumber = index + 1;
    const prefix = `lines[${index}]`;
    const itemId = cleanText(payload.itemId, 64);

    if (!itemId) {
      errors.push({ field: `${prefix}.itemId`, message: `Line ${lineNumber}: item selection is required.` });
      return;
    }
    if (seenItems.has(itemId)) {
      errors.push({
        field: `${prefix}.itemId`,
        message: `Line ${lineNumber}: this item is already used in the order. Combine the quantities into one line.`,
      });
      return;
    }
    seenItems.add(itemId);

    const item = itemById.get(itemId);
    if (!item) {
      errors.push({
        field: `${prefix}.itemId`,
        message: `Line ${lineNumber}: selected item does not belong to the active company.`,
      });
      return;
    }
    if (!item.isActive) {
      errors.push({
        field: `${prefix}.itemId`,
        message: `Line ${lineNumber}: ${item.itemCode} - ${item.itemName} is inactive.`,
      });
      return;
    }

    const unit = parseUnit(errors, payload.unit, item.unit);
    if (unit !== item.unit) {
      errors.push({
        field: `${prefix}.unit`,
        message: `Line ${lineNumber}: unit must match the item master unit (${item.unit}).`,
      });
    }

    let quantity = new Prisma.Decimal(0);
    try {
      quantity = parseQuantity(payload.quantity, `${prefix}.quantity`, `Line ${lineNumber} quantity`);
    } catch (error) {
      errors.push({
        field: `${prefix}.quantity`,
        message: error instanceof Error ? error.message : 'Quantity is invalid.',
      });
      return;
    }

    let rate = new Prisma.Decimal(0);
    try {
      const defaultRate = defaults.sales ? item.defaultSalesRate : item.defaultPurchaseRate;
      const rawRate =
        payload.rate === null || payload.rate === undefined || String(payload.rate).trim() === ''
          ? defaultRate.toFixed(4)
          : payload.rate;
      rate = parseRate(rawRate, `${prefix}.rate`, `Line ${lineNumber} rate`);
    } catch (error) {
      errors.push({
        field: `${prefix}.rate`,
        message: error instanceof Error ? error.message : 'Rate is invalid.',
      });
      return;
    }

    let discountPercent = new Prisma.Decimal(0);
    try {
      discountPercent = parsePercent(
        payload.discountPercent,
        `${prefix}.discountPercent`,
        `Line ${lineNumber} discount %`
      );
    } catch (error) {
      errors.push({
        field: `${prefix}.discountPercent`,
        message: error instanceof Error ? error.message : 'Discount percentage is invalid.',
      });
      return;
    }

    let gstRate = new Prisma.Decimal(0);
    try {
      gstRate = parsePercent(
        payload.gstRate === null || payload.gstRate === undefined || String(payload.gstRate).trim() === ''
          ? item.gstRate.toFixed(2)
          : payload.gstRate,
        `${prefix}.gstRate`,
        `Line ${lineNumber} GST rate`
      );
    } catch (error) {
      errors.push({
        field: `${prefix}.gstRate`,
        message: error instanceof Error ? error.message : 'GST rate is invalid.',
      });
      return;
    }

    let expectedDeliveryDate: Date | null = null;
    let expectedReceiptDate: Date | null = null;
    let revisedDeliveryDate: Date | null = null;
    try {
      expectedDeliveryDate = parseDateOptional(
        payload.expectedDeliveryDate,
        `${prefix}.expectedDeliveryDate`,
        `Line ${lineNumber} expected delivery date`
      );
      expectedReceiptDate = parseDateOptional(
        payload.expectedReceiptDate,
        `${prefix}.expectedReceiptDate`,
        `Line ${lineNumber} expected receipt date`
      );
      revisedDeliveryDate = parseDateOptional(
        payload.revisedDeliveryDate,
        `${prefix}.revisedDeliveryDate`,
        `Line ${lineNumber} revised delivery date`
      );
    } catch (error) {
      errors.push({
        field: `${prefix}.expectedDeliveryDate`,
        message: error instanceof Error ? error.message : 'Line date is invalid.',
      });
      return;
    }

    const lineComputed = computeLine(quantity, rate, discountPercent, gstRate, taxType);
    computed.push(lineComputed);

    resolved.push({
      lineNumber,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: cleanText(payload.description, 500) ?? item.description,
      yarnQualityName: cleanText(payload.yarnQualityName, 120) ?? item.yarnQuality?.qualityName ?? null,
      yarnGradeName: cleanText(payload.yarnGradeName, 120) ?? item.yarnGrade?.gradeName ?? null,
      yarnCount: cleanText(payload.yarnCount, 30) ?? item.yarnCount,
      denier: cleanText(payload.denier, 30) ?? item.denier,
      colour: cleanText(payload.colour, 100) ?? item.colour,
      design: cleanText(payload.design, 100) ?? item.fabricDesign,
      lotNumber: cleanText(payload.lotNumber, 100) ?? item.lotNumber,
      specification: cleanText(payload.specification, 200) ?? item.sizeSpecification,
      unit,
      quantity,
      rate,
      discountPercent,
      discountAmount: lineComputed.discountAmount,
      taxableAmount: lineComputed.taxableAmount,
      gstRate,
      cgstAmount: lineComputed.cgstAmount,
      sgstAmount: lineComputed.sgstAmount,
      igstAmount: lineComputed.igstAmount,
      lineTotal: lineComputed.lineTotal,
      expectedDeliveryDate,
      expectedReceiptDate,
      revisedDeliveryDate,
      deliveryLocationId: cleanText(payload.deliveryLocationId, 64),
      remarks: cleanText(payload.remarks, 500),
    });
  });

  return { lines: resolved, computed };
}

export async function resolveSchedules(
  prisma: PrismaClient,
  companyId: string,
  rawSchedules: unknown,
  lines: ResolvedLine[],
  allowPartial: boolean,
  errors: FieldError[]
): Promise<{ schedules: ResolvedSchedule[]; scheduleIsPartial: boolean }> {
  if (!Array.isArray(rawSchedules) || rawSchedules.length === 0) {
    return { schedules: [], scheduleIsPartial: false };
  }

  const lineNumbers = new Set(lines.map((line) => line.lineNumber));
  const totalsByLine = new Map<number, Prisma.Decimal>();
  const schedules: ResolvedSchedule[] = [];
  let partial = false;

  const payloads = rawSchedules as OrderSchedulePayload[];

  payloads.forEach((payload, index) => {
    const prefix = `schedules[${index}]`;
    const lineNumber = Number(payload.lineNumber);
    if (!Number.isInteger(lineNumber) || !lineNumbers.has(lineNumber)) {
      errors.push({
        field: `${prefix}.lineNumber`,
        message: `Schedule ${index + 1}: select a valid order line.`,
      });
      return;
    }

    let scheduleDate: Date;
    try {
      scheduleDate = parseDateRequired(
        payload.scheduleDate,
        `${prefix}.scheduleDate`,
        `Schedule ${index + 1} date`
      );
    } catch (error) {
      errors.push({
        field: `${prefix}.scheduleDate`,
        message: error instanceof Error ? error.message : 'Schedule date is required.',
      });
      return;
    }

    let quantity: Prisma.Decimal;
    try {
      quantity = parseQuantity(
        payload.quantity,
        `${prefix}.quantity`,
        `Schedule ${index + 1} quantity`
      );
    } catch (error) {
      errors.push({
        field: `${prefix}.quantity`,
        message: error instanceof Error ? error.message : 'Schedule quantity is invalid.',
      });
      return;
    }

    const current = totalsByLine.get(lineNumber) ?? new Prisma.Decimal(0);
    totalsByLine.set(lineNumber, current.plus(quantity));
    schedules.push({
      lineNumber,
      scheduleDate,
      quantity,
      note: cleanText(payload.note, 200),
    });
  });

  for (const line of lines) {
    const scheduled = totalsByLine.get(line.lineNumber) ?? new Prisma.Decimal(0);
    if (scheduled.isZero()) continue;
    const difference = scheduled.minus(line.quantity);
    if (!difference.isZero()) {
      if (difference.gt(0)) {
        errors.push({
          field: 'schedules',
          message: `Line ${line.lineNumber}: scheduled quantity (${scheduled.toFixed(
            3
          )}) cannot exceed the ordered quantity (${line.quantity.toFixed(3)}).`,
        });
      } else if (!allowPartial) {
        errors.push({
          field: 'schedules',
          message: `Line ${line.lineNumber}: scheduled quantity (${scheduled.toFixed(
            3
          )}) must equal the ordered quantity (${line.quantity.toFixed(
            3
          )}) unless a partial schedule is explicitly saved.`,
        });
      } else {
        partial = true;
      }
    }
  }

  return { schedules, scheduleIsPartial: partial };
}

export function resolveCharges(
  errors: FieldError[],
  payload: { freightAmount?: unknown; packingAmount?: unknown; otherCharges?: unknown }
): ChargeTotals {
  return {
    freightAmount: captureMoney(errors, payload.freightAmount, 'freightAmount', 'Freight amount'),
    packingAmount: captureMoney(errors, payload.packingAmount, 'packingAmount', 'Packing amount'),
    otherCharges: captureMoney(errors, payload.otherCharges, 'otherCharges', 'Other charges'),
  };
}

export function totalsFor(lines: ComputedLine[], charges: ChargeTotals): ComputedTotals {
  return computeTotals(lines, charges);
}

export function taxTypeFor(
  companyState: string | null | undefined,
  partyState: string | null | undefined,
  requested: unknown,
  errors: FieldError[]
): { taxType: OrderTaxType; placeOfSupplyState: string | null } {
  if (requested !== undefined && requested !== null && requested !== '') {
    if (requested !== 'INTRA_STATE' && requested !== 'INTER_STATE') {
      errors.push({ field: 'taxType', message: 'Tax type must be INTRA_STATE or INTER_STATE.' });
    }
  }
  const derived = resolveTaxType(companyState, partyState);
  if (requested === 'INTRA_STATE' || requested === 'INTER_STATE') {
    // A user override is accepted only when it matches the derived treatment,
    // otherwise the stored documents could contradict the GSTIN states.
    if (requested !== derived) {
      errors.push({
        field: 'taxType',
        message: `Tax type ${requested} contradicts the company/party state combination (${derived}).`,
      });
    }
  }
  return {
    taxType: derived,
    placeOfSupplyState: cleanText(partyState, 100),
  };
}

export function serializeHistoryEntry(entry: {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  reason: string | null;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    action: entry.action,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    note: entry.note,
    reason: entry.reason,
    createdAt: entry.createdAt.toISOString(),
  };
}