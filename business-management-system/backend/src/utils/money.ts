import { Prisma } from '@prisma/client';

/**
 * Raised when a monetary input is missing, malformed or outside the accepted range.
 * The message is safe to surface directly to the user.
 */
export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyInputError';
  }
}

// Positive amounts only, no sign, no exponent, max two decimal places.
const POSITIVE_MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const NON_NEGATIVE_MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Converts any stored/incoming value into a 2-decimal Prisma Decimal. */
export function toMoney(
  value: Prisma.Decimal | string | number | null | undefined
): Prisma.Decimal {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(value as string | number).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP
  );
}

/** Parses a required, strictly positive monetary input (voucher amount). */
export function parsePositiveMoney(raw: unknown, label: string): Prisma.Decimal {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    throw new MoneyInputError(`${label} is required.`);
  }

  const text = typeof raw === 'number' ? String(raw) : String(raw).trim();
  if (!POSITIVE_MONEY_PATTERN.test(text)) {
    throw new MoneyInputError(
      `${label} must be a number greater than zero with at most 2 decimal places.`
    );
  }

  const amount = new Prisma.Decimal(text);
  if (amount.lte(0)) {
    throw new MoneyInputError(`${label} must be greater than zero.`);
  }

  return amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/** Parses an optional, non-negative opening balance (ledger master). */
export function parseOpeningBalance(raw: unknown): Prisma.Decimal {
  if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
    return new Prisma.Decimal(0);
  }

  const text = typeof raw === 'number' ? String(raw) : String(raw).trim();
  if (!NON_NEGATIVE_MONEY_PATTERN.test(text)) {
    throw new MoneyInputError('Opening balance must be zero or greater with at most 2 decimal places.');
  }

  return new Prisma.Decimal(text).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneyIsZero(value: Prisma.Decimal): boolean {
  return value.isZero();
}

export function moneyEquals(left: Prisma.Decimal, right: Prisma.Decimal): boolean {
  return left.minus(right).abs().lt(new Prisma.Decimal('0.005'));
}

/** Fixed 2-decimal string for API responses and prints. */
export function moneyToFixed(value: Prisma.Decimal | string | number | null | undefined): string {
  return toMoney(value).toFixed(2);
}

/** Indian grouping format, e.g. 1234567.5 -> "12,34,567.50". */
export function formatIndianMoney(value: Prisma.Decimal | string | number | null | undefined): string {
  const fixed = moneyToFixed(value);
  const [wholePart, decimalPart] = fixed.split('.');
  const negative = wholePart.startsWith('-');
  const digits = negative ? wholePart.slice(1) : wholePart;

  let grouped = digits;
  if (digits.length > 3) {
    const lastThree = digits.slice(-3);
    const rest = digits.slice(0, -3);
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${restGrouped},${lastThree}`;
  }

  return `${negative ? '-' : ''}${grouped}.${decimalPart}`;
}