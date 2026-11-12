// Phase 17 - shared ledger posting helpers for the Bank Book and the Account
// Ledger. Both reports read the same posted JournalLine rows, so the
// eligibility rules, ordering and display labels live in one place instead of
// being re-implemented per report.

import { Prisma } from '@prisma/client';
import type { LedgerBalanceNature, LedgerSourceType } from '../types/ledgerReportTypes.js';

export const ledgerPostingInclude = Prisma.validator<Prisma.JournalLineInclude>()({
  ledgerAccount: {
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountGroup: true,
      accountType: true,
      balanceType: true,
      openingBalance: true,
      isBankAccount: true,
    },
  },
  voucher: {
    select: {
      id: true,
      voucherType: true,
      voucherNumber: true,
      voucherDate: true,
      paymentMode: true,
      referenceNumber: true,
      chequeNumber: true,
      chequeDate: true,
      narration: true,
      remarks: true,
      status: true,
      revision: true,
      party: { select: { id: true, partyName: true, partyGroupId: true } },
      counterpartyLedger: { select: { id: true, accountName: true } },
    },
  },
  debitNote: {
    select: {
      id: true,
      noteNumber: true,
      noteDate: true,
      noteType: true,
      remark: true,
      adjustmentReason: true,
      status: true,
      revision: true,
      book: { select: { id: true, bookName: true } },
      party: { select: { id: true, partyName: true, partyGroupId: true } },
      creditAccount: { select: { id: true, accountName: true } },
    },
  },
});

export type LedgerPostingLine = Prisma.JournalLineGetPayload<{
  include: typeof ledgerPostingInclude;
}>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Accounting display format: DD-MM-YYYY. */
export function toDisplayDate(date: Date): string {
  const parts = toIsoDate(date).split('-');
  return parts[2] + '-' + parts[1] + '-' + parts[0];
}

export function parseIsoDate(value: unknown, label: string): Date {
  const text = String(value ?? '').trim();
  if (!ISO_DATE_PATTERN.test(text)) {
    throw new Error(label + ' must be a valid date in YYYY-MM-DD format.');
  }
  const date = new Date(text + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(label + ' is not a valid calendar date.');
  }
  return date;
}

/**
 * A line is reportable only when it is a real, current, posted posting:
 * never a reversal, never a draft/cancelled document, never a superseded
 * revision.
 */
export function isEligiblePosting(line: LedgerPostingLine): boolean {
  if (line.isReversal) return false;
  if (line.voucher) {
    return line.voucher.status === 'POSTED' && line.voucher.revision === line.revision;
  }
  if (line.debitNote) {
    return line.debitNote.status === 'POSTED' && line.debitNote.revision === line.revision;
  }
  return false;
}

export function sourceTypeOf(line: LedgerPostingLine): LedgerSourceType {
  if (line.voucher) return line.voucher.voucherType === 'RECEIPT' ? 'RECEIPT' : 'PAYMENT';
  return 'DEBIT_NOTE';
}

/** Document number used for the Vch No column and for stable ordering. */
export function documentNumberOf(line: LedgerPostingLine): string {
  if (line.voucher) return line.voucher.voucherNumber;
  if (line.debitNote) return line.debitNote.noteNumber;
  return '';
}

/**
 * Deterministic accounting order: posting date, then document number, then the
 * line position inside the document. Never depends on database row order.
 */
export function sortPostings(lines: LedgerPostingLine[]): LedgerPostingLine[] {
  return lines.slice().sort((left, right) => {
    const dateDiff = startOfDay(left.postingDate).getTime() - startOfDay(right.postingDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    const leftNumber = documentNumberOf(left);
    const rightNumber = documentNumberOf(right);
    if (leftNumber !== rightNumber) return leftNumber < rightNumber ? -1 : 1;
    if (left.lineNumber !== right.lineNumber) return left.lineNumber - right.lineNumber;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

/** Counterparty account shown for a bank transaction. */
export function accountNameOf(line: LedgerPostingLine): string {
  if (line.voucher) {
    return line.voucher.party?.partyName ?? line.voucher.counterpartyLedger.accountName;
  }
  if (line.debitNote) {
    return line.debitNote.party?.partyName ?? line.debitNote.creditAccount.accountName;
  }
  return '';
}

/** Free-text particulars: the stored narration/remark, never generated text. */
export function particularsOf(line: LedgerPostingLine): string {
  if (line.narration) return line.narration;
  if (line.voucher) return line.voucher.remarks ?? '';
  if (line.debitNote) return line.debitNote.remark ?? line.debitNote.adjustmentReason ?? '';
  return '';
}

/** Cheque number first, then the stored reference number. */
export function chequeReferenceOf(line: LedgerPostingLine): string {
  if (!line.voucher) return '';
  return line.voucher.chequeNumber ?? line.voucher.referenceNumber ?? '';
}

export function chequeNumberOf(line: LedgerPostingLine): string {
  return line.voucher?.chequeNumber ?? '';
}

/** Human label for the voucher type shown in the Account Ledger Type column. */
export function voucherTypeLabel(line: LedgerPostingLine): string {
  if (line.voucher) {
    return line.voucher.voucherType === 'RECEIPT' ? 'Bank Receipt' : 'Bank Payment';
  }
  if (line.debitNote) {
    return line.debitNote.noteType === 'SALES' ? 'Sales Debit Note' : 'Purchase Debit Note';
  }
  return 'Journal';
}

/**
 * Real book the posting belongs to. Bank vouchers are not kept in a book
 * master, so their voucher type is the book; debit notes use the stored
 * DebitNoteBook name.
 */
export function bookNameOf(line: LedgerPostingLine): string {
  if (line.voucher) {
    return line.voucher.voucherType === 'RECEIPT' ? 'Bank Receipt' : 'Bank Payment';
  }
  if (line.debitNote) return line.debitNote.book.bookName;
  return '';
}

/** Signed balance convention: positive = Dr, negative = Cr. */
export function signedBalance(value: Prisma.Decimal): {
  amount: string;
  nature: LedgerBalanceNature;
  signed: string;
} {
  const rounded = value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const nature: LedgerBalanceNature = rounded.isNegative() ? 'Cr' : 'Dr';
  return {
    amount: rounded.abs().toFixed(2),
    nature,
    signed: rounded.toFixed(2),
  };
}

/** Opening balance of a ledger as a signed value (Dr positive, Cr negative). */
export function signedOpening(
  openingBalance: Prisma.Decimal,
  balanceType: 'DEBIT' | 'CREDIT'
): Prisma.Decimal {
  const amount = openingBalance.abs();
  return balanceType === 'DEBIT' ? amount : amount.negated();
}

export function moneyText(value: Prisma.Decimal): string {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}