import { OrderTaxType, Prisma } from '@prisma/client';

/**
 * Decimal-safe arithmetic for Sales Order / Purchase Order documents.
 * Every persisted financial value passes through here so that no Javascript
 * floating point arithmetic can reach PostgreSQL.
 */

export class OrderInputError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'OrderInputError';
    this.field = field;
  }
}

const QUANTITY_PATTERN = /^\d+(\.\d{1,3})?$/;
const RATE_PATTERN = /^\d+(\.\d{1,4})?$/;
const PERCENT_PATTERN = /^\d+(\.\d{1,2})?$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

const DECIMAL_ZERO = new Prisma.Decimal(0);
const DECIMAL_HUNDRED = new Prisma.Decimal(100);

export function zero(): Prisma.Decimal {
  return new Prisma.Decimal(DECIMAL_ZERO);
}

export function money(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function isBlank(raw: unknown): boolean {
  return raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
}

function toText(raw: unknown): string {
  return typeof raw === 'number' ? String(raw) : String(raw).trim();
}

/** Parses a required positive quantity (up to 3 decimals). */
export function parseQuantity(raw: unknown, field: string, label: string): Prisma.Decimal {
  if (isBlank(raw)) {
    throw new OrderInputError(field, `${label} is required.`);
  }
  const text = toText(raw);
  if (!QUANTITY_PATTERN.test(text)) {
    throw new OrderInputError(field, `${label} must be a positive number with at most 3 decimal places.`);
  }
  const value = new Prisma.Decimal(text);
  if (value.lte(0)) {
    throw new OrderInputError(field, `${label} must be greater than zero.`);
  }
  return value.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

/** Parses a required non-negative rate (up to 4 decimals). */
export function parseRate(raw: unknown, field: string, label: string): Prisma.Decimal {
  if (isBlank(raw)) {
    throw new OrderInputError(field, `${label} is required.`);
  }
  const text = toText(raw);
  if (!RATE_PATTERN.test(text)) {
    throw new OrderInputError(field, `${label} must be zero or greater with at most 4 decimal places.`);
  }
  return new Prisma.Decimal(text).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
}

/** Parses an optional percentage (0-100, up to 2 decimals). */
export function parsePercent(
  raw: unknown,
  field: string,
  label: string,
  fallback = '0'
): Prisma.Decimal {
  if (isBlank(raw)) {
    return new Prisma.Decimal(fallback).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
  const text = toText(raw);
  if (!PERCENT_PATTERN.test(text)) {
    throw new OrderInputError(field, `${label} must be between 0 and 100 with at most 2 decimal places.`);
  }
  const value = new Prisma.Decimal(text);
  if (value.lt(0) || value.gt(DECIMAL_HUNDRED)) {
    throw new OrderInputError(field, `${label} must be between 0 and 100.`);
  }
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Parses an optional non-negative money amount (2 decimals). */
export function parseOptionalMoney(
  raw: unknown,
  field: string,
  label: string
): Prisma.Decimal {
  if (isBlank(raw)) {
    return zero();
  }
  const text = toText(raw);
  if (!MONEY_PATTERN.test(text)) {
    throw new OrderInputError(field, `${label} must be zero or greater with at most 2 decimal places.`);
  }
  return new Prisma.Decimal(text).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export interface ComputedLine {
  quantity: Prisma.Decimal;
  rate: Prisma.Decimal;
  discountPercent: Prisma.Decimal;
  gstRate: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

/**
 * Line calculation:
 *   gross = quantity x rate
 *   discount = gross x percentage / 100
 *   taxable = gross - discount
 *   intra-state -> CGST + SGST (half the GST rate each)
 *   inter-state -> IGST (full GST rate)
 */
export function computeLine(
  quantity: Prisma.Decimal,
  rate: Prisma.Decimal,
  discountPercent: Prisma.Decimal,
  gstRate: Prisma.Decimal,
  taxType: OrderTaxType
): ComputedLine {
  const gross = money(quantity.mul(rate));
  const discountAmount = money(gross.mul(discountPercent).div(DECIMAL_HUNDRED));
  const taxableAmount = money(gross.minus(discountAmount));

  let cgstAmount = zero();
  let sgstAmount = zero();
  let igstAmount = zero();

  if (taxType === 'INTER_STATE') {
    igstAmount = money(taxableAmount.mul(gstRate).div(DECIMAL_HUNDRED));
  } else {
    const halfRate = gstRate.div(2);
    cgstAmount = money(taxableAmount.mul(halfRate).div(DECIMAL_HUNDRED));
    sgstAmount = money(taxableAmount.mul(halfRate).div(DECIMAL_HUNDRED));
  }

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
    lineTotal: money(taxableAmount.plus(cgstAmount).plus(sgstAmount).plus(igstAmount)),
  };
}

export interface ComputedTotals {
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
}

export interface ChargeInput {
  freightAmount: Prisma.Decimal;
  packingAmount: Prisma.Decimal;
  otherCharges: Prisma.Decimal;
}

/** Aggregates computed lines and applies freight, packing, other charges and round off. */
export function computeTotals(lines: ComputedLine[], charges: ChargeInput): ComputedTotals {
  let totalQuantity = zero();
  let subtotal = zero();
  let discountAmount = zero();
  let taxableAmount = zero();
  let cgstAmount = zero();
  let sgstAmount = zero();
  let igstAmount = zero();

  for (const line of lines) {
    totalQuantity = totalQuantity.plus(line.quantity);
    subtotal = subtotal.plus(money(line.quantity.mul(line.rate)));
    discountAmount = discountAmount.plus(line.discountAmount);
    taxableAmount = taxableAmount.plus(line.taxableAmount);
    cgstAmount = cgstAmount.plus(line.cgstAmount);
    sgstAmount = sgstAmount.plus(line.sgstAmount);
    igstAmount = igstAmount.plus(line.igstAmount);
  }

  const chargesTotal = charges.freightAmount.plus(charges.packingAmount).plus(charges.otherCharges);
  const beforeRounding = taxableAmount.plus(cgstAmount).plus(sgstAmount).plus(igstAmount).plus(chargesTotal);
  // The grand total is rounded to the nearest rupee (like the purchase bill module);
  // the difference is posted as the Round Off line so the document is payable in whole rupees.
  const grandTotal = beforeRounding.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const roundOffAmount = money(grandTotal.minus(beforeRounding));

  return {
    totalQuantity: totalQuantity.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    subtotal: money(subtotal),
    discountAmount: money(discountAmount),
    taxableAmount: money(taxableAmount),
    cgstAmount: money(cgstAmount),
    sgstAmount: money(sgstAmount),
    igstAmount: money(igstAmount),
    freightAmount: money(charges.freightAmount),
    packingAmount: money(charges.packingAmount),
    otherCharges: money(charges.otherCharges),
    roundOffAmount,
    grandTotal,
  };
}

function normaliseState(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Determines the GST treatment from the company state and the counterparty state.
 * When either state is missing the transaction is treated as intra-state, which
 * matches how the existing purchase module treats unclassified parties.
 */
export function resolveTaxType(
  companyState: string | null | undefined,
  partyState: string | null | undefined
): OrderTaxType {
  const company = normaliseState(companyState);
  const party = normaliseState(partyState);
  if (company === '' || party === '') {
    return 'INTRA_STATE';
  }
  return company === party ? 'INTRA_STATE' : 'INTER_STATE';
}

/** Sum of a decimal list, always rounded to 2 decimals. */
export function sumMoney(values: Array<Prisma.Decimal | null | undefined>): Prisma.Decimal {
  return money(
    values.reduce<Prisma.Decimal>((total, value) => total.plus(value ?? DECIMAL_ZERO), zero())
  );
}

/** Fixed 3-decimal quantity string for API responses and prints. */
export function quantityFixed(value: Prisma.Decimal | null | undefined): string {
  return (value ?? DECIMAL_ZERO).toFixed(3);
}

/** Fixed 2-decimal money string for API responses and prints. */
export function moneyFixed(value: Prisma.Decimal | null | undefined): string {
  return (value ?? DECIMAL_ZERO).toFixed(2);
}

/** Fixed 4-decimal rate string for API responses and prints. */
export function rateFixed(value: Prisma.Decimal | null | undefined): string {
  return (value ?? DECIMAL_ZERO).toFixed(4);
}

/** Percentage as a plain string (trailing zeros preserved to 2 decimals). */
export function percentFixed(value: Prisma.Decimal | null | undefined): string {
  return (value ?? DECIMAL_ZERO).toFixed(2);
}