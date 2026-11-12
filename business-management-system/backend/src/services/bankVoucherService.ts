import {
  BankVoucherStatus,
  BankVoucherType,
  LedgerAccount,
  PaymentMode,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  BankVoucherRepository,
  BankVoucherWithDetail,
  BankVoucherWithRelations,
} from '../repositories/bankVoucherRepository.js';
import { MoneyInputError, parsePositiveMoney } from '../utils/money.js';
import { AppError, FieldError, conflictError, notFoundError, validationError } from '../utils/appError.js';

const prisma = new PrismaClient();
const repo = new BankVoucherRepository();

export const PAYMENT_MODES: PaymentMode[] = [
  'NEFT',
  'RTGS',
  'IMPS',
  'CHEQUE',
  'UPI',
  'BANK_TRANSFER',
  'OTHER',
];

const ELECTRONIC_REFERENCE_MODES: PaymentMode[] = ['NEFT', 'RTGS', 'IMPS', 'UPI'];
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/_]{5,39}$/;
const CHEQUE_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/]{0,19}$/;

export interface BankVoucherPayload {
  voucherDate?: string;
  partyId?: string | null;
  counterpartyLedgerId?: string | null;
  bankAccountLedgerId?: string;
  paymentMode?: PaymentMode;
  amount?: string | number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  narration?: string | null;
  remarks?: string | null;
}

interface VoucherContext {
  company: {
    id: string;
    companyName: string;
    companyCode: string;
    gstin: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
  };
  financialYear: {
    id: string;
    yearName: string;
    startDate: Date;
    endDate: Date;
    isLocked: boolean;
  };
}

interface ResolvedVoucher {
  voucherDate: Date;
  amount: Prisma.Decimal;
  paymentMode: PaymentMode;
  bankAccount: LedgerAccount;
  counterparty: LedgerAccount;
  partyId: string | null;
  referenceNumber: string | null;
  chequeNumber: string | null;
  chequeDate: Date | null;
  bankName: string | null;
  branchName: string | null;
  narration: string | null;
  remarks: string | null;
}

export interface VoucherAccountRef {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
}

export interface BankVoucherView {
  id: string;
  companyId: string;
  financialYearId: string;
  voucherType: BankVoucherType;
  voucherNumber: string;
  voucherDate: string;
  status: BankVoucherStatus;
  paymentMode: PaymentMode;
  amount: string;
  referenceNumber: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  bankName: string | null;
  branchName: string | null;
  narration: string | null;
  remarks: string | null;
  revision: number;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  party: { id: string; partyName: string; partyCode: string; partyType: string } | null;
  counterparty: VoucherAccountRef;
  bankAccount: VoucherAccountRef;
  bankAccountDisplayName: string;
  debitAccount: VoucherAccountRef;
  creditAccount: VoucherAccountRef;
  journalLines?: Array<{
    id: string;
    revision: number;
    lineNumber: number;
    isReversal: boolean;
    debitAmount: string;
    creditAmount: string;
    postingDate: string;
    narration: string | null;
    ledgerAccount: VoucherAccountRef;
  }>;
  /** Phase 18 (additive): receipt book that produced this voucher, if any. */
  receiptBook?: { id: string; bookName: string; prefix: string } | null;
  /** Phase 18 (additive): number of party rows in the newest revision. */
  receiptRowCount?: number;
  /** Phase 18 (additive): every party on the newest revision (register view). */
  receiptParties?: Array<{ id: string; partyName: string; partyCode: string }>;
  /** Phase 18 (additive): multi-row cheque receipt detail (detail view only). */
  receiptLines?: Array<{
    id: string;
    rowNumber: number;
    party: { id: string; partyName: string; partyCode: string } | null;
    bankNameCode: string | null;
    bankInstrument: { id: string; code: string; description: string } | null;
    chequeNumber: string | null;
    description: string | null;
    amount: string;
    adjustmentMode: string;
    allocations: Array<{
      id: string;
      purchaseBillId: string;
      sourceDocumentNumber: string;
      billDate: string;
      billAmount: string;
      billTds: string;
      previousReceived: string;
      allocatedAmount: string;
      balanceAfter: string;
      status: string;
      adjustments: Array<{
        id: string;
        adjustmentLedgerAccount: { id: string; accountCode: string; accountName: string };
        calculationType: string;
        interestPercent: string | null;
        dueValue: number | null;
        tdsPercent: string | null;
        adjustmentAmount: string;
        drCr: string;
        note: string | null;
        status: string;
      }>;
    }>;
  }>;
}

export interface BankVoucherListResponse {
  items: BankVoucherView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAmount: string;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: unknown, fieldLabel: string): Date {
  const text = String(value ?? '').trim();
  if (text === '') {
    throw new MoneyInputError(`${fieldLabel} is required.`);
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = new Date(dateOnly ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(parsed.getTime())) {
    throw new MoneyInputError(`${fieldLabel} is not a valid date.`);
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0)
  );
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, maxLength);
}

function decimalFixed(value: Prisma.Decimal | null | undefined): string {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
}

function accountRef(account: {
  id: string;
  accountCode: string;
  accountName: string;
  accountGroup: string;
}): VoucherAccountRef {
  return {
    id: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountGroup: account.accountGroup,
  };
}

export class BankVoucherService {
  private prefixFor(voucherType: BankVoucherType): string {
    return voucherType === 'RECEIPT' ? 'BR' : 'BP';
  }

  private formatNumber(
    voucherType: BankVoucherType,
    financialYearStart: Date,
    sequence: number
  ): string {
    const prefix = this.prefixFor(voucherType);
    return `${prefix}-${financialYearStart.getUTCFullYear()}-${String(sequence).padStart(4, '0')}`;
  }

  private async loadContext(companyId: string, financialYearId: string): Promise<VoucherContext> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        companyCode: true,
        gstin: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
        email: true,
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

    return {
      company: {
        id: company.id,
        companyName: company.companyName,
        companyCode: company.companyCode,
        gstin: company.gstin,
        address: company.address,
        city: company.city,
        state: company.state,
        pincode: company.pincode,
        phone: company.phone,
        email: company.email,
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

  private async ensurePartyLedger(
    tx: Prisma.TransactionClient,
    companyId: string,
    party: {
      id: string;
      partyName: string;
      partyCode: string;
      partyType: string;
      balanceType: 'DEBIT' | 'CREDIT';
    }
  ): Promise<LedgerAccount> {
    const existing = await tx.ledgerAccount.findFirst({
      where: { companyId, partyId: party.id },
    });
    if (existing) {
      return existing;
    }

    const isSupplier = party.partyType === 'SUPPLIER';
    const baseCode =
      `PL-${party.partyCode}`
        .toUpperCase()
        .replace(/[^A-Z0-9\-_/]/g, '-')
        .slice(0, 20) || 'PL-PARTY';

    let accountCode = baseCode;
    let suffix = 1;
    while (await tx.ledgerAccount.findFirst({ where: { companyId, accountCode } })) {
      const suffixText = `-${suffix}`;
      accountCode = `${baseCode.slice(0, 20 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    try {
      return await tx.ledgerAccount.create({
        data: {
          companyId,
          accountCode,
          accountName: party.partyName,
          accountGroup: isSupplier ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS',
          accountType: isSupplier ? 'LIABILITY' : 'ASSET',
          balanceType: party.balanceType,
          openingBalance: new Prisma.Decimal(0),
          partyId: party.id,
          isAutoCreated: true,
          isBankAccount: false,
          description:
            'Auto-created ledger link for Party Master. Opening balance remains on the Party Master record.',
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await tx.ledgerAccount.findFirst({
          where: { companyId, partyId: party.id },
        });
        if (raced) return raced;
      }
      throw error;
    }
  }
  private async resolvePayload(
    tx: Prisma.TransactionClient,
    context: VoucherContext,
    voucherType: BankVoucherType,
    payload: BankVoucherPayload,
    excludeVoucherId?: string
  ): Promise<ResolvedVoucher> {
    const companyId = context.company.id;
    const financialYear = context.financialYear;
    const errors: FieldError[] = [];

    let voucherDate: Date | null = null;
    try {
      voucherDate = parseDateInput(payload.voucherDate, 'Voucher date');
    } catch (error) {
      errors.push({
        field: 'voucherDate',
        message: error instanceof Error ? error.message : 'Voucher date is required.',
      });
    }

    if (voucherDate) {
      const key = toDateKey(voucherDate);
      if (key < toDateKey(financialYear.startDate) || key > toDateKey(financialYear.endDate)) {
        errors.push({
          field: 'voucherDate',
          message: `Voucher date must fall inside financial year ${financialYear.yearName} (${toDateKey(
            financialYear.startDate
          )} to ${toDateKey(financialYear.endDate)}).`,
        });
      }
    }

    if (financialYear.isLocked) {
      errors.push({
        field: 'financialYear',
        message: `Financial year ${financialYear.yearName} is locked. Posting, editing and cancellation are blocked.`,
      });
    }

    const paymentMode = payload.paymentMode;
    if (!paymentMode || !PAYMENT_MODES.includes(paymentMode)) {
      errors.push({ field: 'paymentMode', message: 'A valid payment mode is required.' });
    }

    let amount = new Prisma.Decimal(0);
    try {
      amount = parsePositiveMoney(payload.amount, 'Amount');
    } catch (error) {
      errors.push({
        field: 'amount',
        message: error instanceof Error ? error.message : 'Amount is invalid.',
      });
    }

    let bankAccount: LedgerAccount | null = null;
    if (!payload.bankAccountLedgerId) {
      errors.push({ field: 'bankAccountLedgerId', message: 'Bank account is required.' });
    } else {
      const ledger = await tx.ledgerAccount.findFirst({
        where: { id: payload.bankAccountLedgerId, companyId },
      });
      if (!ledger) {
        errors.push({
          field: 'bankAccountLedgerId',
          message: 'Selected bank account does not belong to the active company.',
        });
      } else if (!ledger.isBankAccount || ledger.accountGroup !== 'BANK') {
        errors.push({
          field: 'bankAccountLedgerId',
          message: `${ledger.accountCode} - ${ledger.accountName} is not classified as a bank account.`,
        });
      } else if (!ledger.isActive) {
        errors.push({
          field: 'bankAccountLedgerId',
          message: 'Selected bank account is inactive and cannot be used.',
        });
      } else {
        bankAccount = ledger;
      }
    }

    let counterparty: LedgerAccount | null = null;
    let resolvedPartyId: string | null = null;

    if (payload.partyId) {
      const party = await tx.party.findFirst({
        where: { id: payload.partyId, companyId },
        select: {
          id: true,
          partyName: true,
          partyCode: true,
          partyType: true,
          balanceType: true,
          isActive: true,
        },
      });

      if (!party) {
        errors.push({
          field: 'partyId',
          message: 'Selected party does not belong to the active company.',
        });
      } else if (!party.isActive) {
        errors.push({ field: 'partyId', message: 'Selected party is inactive.' });
      } else {
        counterparty = await this.ensurePartyLedger(tx, companyId, {
          id: party.id,
          partyName: party.partyName,
          partyCode: party.partyCode,
          partyType: party.partyType,
          balanceType: party.balanceType,
        });
        resolvedPartyId = party.id;
      }
    } else if (payload.counterpartyLedgerId) {
      const ledger = await tx.ledgerAccount.findFirst({
        where: { id: payload.counterpartyLedgerId, companyId },
      });

      if (!ledger) {
        errors.push({
          field: 'counterpartyLedgerId',
          message: 'Selected ledger account does not belong to the active company.',
        });
      } else if (ledger.isBankAccount || ledger.accountGroup === 'BANK') {
        errors.push({
          field: 'counterpartyLedgerId',
          message: 'The counterparty cannot be a bank account ledger.',
        });
      } else if (!ledger.isActive) {
        errors.push({
          field: 'counterpartyLedgerId',
          message: 'Selected ledger account is inactive and cannot be used.',
        });
      } else {
        counterparty = ledger;
        resolvedPartyId = ledger.partyId;
      }
    } else {
      errors.push({
        field: 'counterparty',
        message:
          voucherType === 'RECEIPT'
            ? 'Received From (party or ledger) is required.'
            : 'Paid To (party or ledger) is required.',
      });
    }

    if (bankAccount && counterparty && bankAccount.id === counterparty.id) {
      errors.push({
        field: 'counterpartyLedgerId',
        message: 'Bank account and counterparty ledger cannot be the same account.',
      });
    }

    const referenceNumber = cleanText(payload.referenceNumber, 40);
    const rawChequeNumber = cleanText(payload.chequeNumber, 20);
    let chequeNumber: string | null = null;
    let chequeDate: Date | null = null;

    if (paymentMode === 'CHEQUE') {
      if (!rawChequeNumber) {
        errors.push({
          field: 'chequeNumber',
          message: 'Cheque number is required when the payment mode is Cheque.',
        });
      } else if (!CHEQUE_NUMBER_PATTERN.test(rawChequeNumber)) {
        errors.push({
          field: 'chequeNumber',
          message: 'Cheque number must be 1-20 characters using letters, numbers, hyphen or slash.',
        });
      } else {
        chequeNumber = rawChequeNumber;
      }

      if (!payload.chequeDate) {
        errors.push({
          field: 'chequeDate',
          message: 'Cheque date is required when the payment mode is Cheque.',
        });
      } else {
        try {
          chequeDate = parseDateInput(payload.chequeDate, 'Cheque date');
        } catch (error) {
          errors.push({
            field: 'chequeDate',
            message: error instanceof Error ? error.message : 'Cheque date is invalid.',
          });
        }
      }
    } else if (referenceNumber && !REFERENCE_PATTERN.test(referenceNumber)) {
      errors.push({
        field: 'referenceNumber',
        message:
          'Reference number must be 6-40 characters using letters, numbers, hyphen, slash or underscore.',
      });
    }

    if (paymentMode && ELECTRONIC_REFERENCE_MODES.includes(paymentMode) && !referenceNumber) {
      errors.push({
        field: 'referenceNumber',
        message: `UTR / transaction reference is required for ${paymentMode} transfers.`,
      });
    }

    const narration = cleanText(payload.narration, 500);
    const remarks = cleanText(payload.remarks, 500);

    if (errors.length === 0) {
      if (referenceNumber) {
        const duplicateReference = await repo.findDuplicateReference(
          companyId,
          voucherType,
          paymentMode as PaymentMode,
          referenceNumber,
          excludeVoucherId
        );
        if (duplicateReference) {
          errors.push({
            field: 'referenceNumber',
            message: `Reference ${referenceNumber} is already used by posted voucher ${duplicateReference.voucherNumber}.`,
          });
        }
      }

      if (chequeNumber && bankAccount) {
        const duplicateCheque = await repo.findDuplicateCheque(
          companyId,
          voucherType,
          bankAccount.id,
          chequeNumber,
          excludeVoucherId
        );
        if (duplicateCheque) {
          errors.push({
            field: 'chequeNumber',
            message: `Cheque ${chequeNumber} is already recorded against this bank account in voucher ${duplicateCheque.voucherNumber}.`,
          });
        }
      }
    }

    if (errors.length > 0) {
      validationError(errors);
    }

    return {
      voucherDate: voucherDate as Date,
      amount,
      paymentMode: paymentMode as PaymentMode,
      bankAccount: bankAccount as LedgerAccount,
      counterparty: counterparty as LedgerAccount,
      partyId: resolvedPartyId,
      referenceNumber,
      chequeNumber,
      chequeDate,
      bankName: cleanText(payload.bankName, 120),
      branchName: cleanText(payload.branchName, 120),
      narration,
      remarks,
    };
  }

  private buildPostedLines(
    resolved: ResolvedVoucher,
    voucherType: BankVoucherType,
    companyId: string,
    financialYearId: string,
    voucherId: string,
    revision: number,
    startLineNumber: number
  ): Prisma.JournalLineCreateManyInput[] {
    const postingDate = resolved.voucherDate;
    const narration =
      resolved.narration ??
      (voucherType === 'RECEIPT'
        ? `Bank receipt from ${resolved.counterparty.accountName}`
        : `Bank payment to ${resolved.counterparty.accountName}`);

    const debitAccountId =
      voucherType === 'RECEIPT' ? resolved.bankAccount.id : resolved.counterparty.id;
    const creditAccountId =
      voucherType === 'RECEIPT' ? resolved.counterparty.id : resolved.bankAccount.id;

    return [
      {
        companyId,
        financialYearId,
        voucherId,
        ledgerAccountId: debitAccountId,
        revision,
        lineNumber: startLineNumber,
        debitAmount: resolved.amount,
        creditAmount: new Prisma.Decimal(0),
        isReversal: false,
        postingDate,
        narration,
      },
      {
        companyId,
        financialYearId,
        voucherId,
        ledgerAccountId: creditAccountId,
        revision,
        lineNumber: startLineNumber + 1,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: resolved.amount,
        isReversal: false,
        postingDate,
        narration,
      },
    ];
  }

  private serialize(voucher: BankVoucherWithRelations | BankVoucherWithDetail): BankVoucherView {
    const isReceipt = voucher.voucherType === 'RECEIPT';
    const debitAccount = isReceipt ? voucher.bankAccountLedger : voucher.counterpartyLedger;
    const creditAccount = isReceipt ? voucher.counterpartyLedger : voucher.bankAccountLedger;

    const view: BankVoucherView = {
      id: voucher.id,
      companyId: voucher.companyId,
      financialYearId: voucher.financialYearId,
      voucherType: voucher.voucherType,
      voucherNumber: voucher.voucherNumber,
      voucherDate: toDateKey(voucher.voucherDate),
      status: voucher.status,
      paymentMode: voucher.paymentMode,
      amount: decimalFixed(voucher.amount),
      referenceNumber: voucher.referenceNumber,
      chequeNumber: voucher.chequeNumber,
      chequeDate: voucher.chequeDate ? toDateKey(voucher.chequeDate) : null,
      bankName: voucher.bankName,
      branchName: voucher.branchName,
      narration: voucher.narration,
      remarks: voucher.remarks,
      revision: voucher.revision,
      cancellationReason: voucher.cancellationReason,
      cancelledAt: voucher.cancelledAt ? voucher.cancelledAt.toISOString() : null,
      createdAt: voucher.createdAt.toISOString(),
      updatedAt: voucher.updatedAt.toISOString(),
      party: voucher.party
        ? {
            id: voucher.party.id,
            partyName: voucher.party.partyName,
            partyCode: voucher.party.partyCode,
            partyType: voucher.party.partyType,
          }
        : null,
      counterparty: accountRef(voucher.counterpartyLedger),
      bankAccount: accountRef(voucher.bankAccountLedger),
      bankAccountDisplayName:
        voucher.bankAccountLedger.bankName || voucher.bankAccountLedger.accountName,
      debitAccount: accountRef(debitAccount),
      creditAccount: accountRef(creditAccount),
    };

    if ('journalLines' in voucher && Array.isArray(voucher.journalLines)) {
      view.journalLines = voucher.journalLines.map((line) => ({
        id: line.id,
        revision: line.revision,
        lineNumber: line.lineNumber,
        isReversal: line.isReversal,
        debitAmount: decimalFixed(line.debitAmount),
        creditAmount: decimalFixed(line.creditAmount),
        postingDate: toDateKey(line.postingDate),
        narration: line.narration,
        ledgerAccount: accountRef(line.ledgerAccount),
      }));
    }

    // Phase 18 (additive): receipt book + multi-row detail.
    view.receiptBook = voucher.bankReceiptBook
      ? {
          id: voucher.bankReceiptBook.id,
          bookName: voucher.bankReceiptBook.bookName,
          prefix: voucher.bankReceiptBook.prefix,
        }
      : null;

    if ('lines' in voucher && Array.isArray(voucher.lines)) {
      const lines = voucher.lines;
      if (lines.length > 0) {
        const latestRevision = lines.reduce((max, line) => Math.max(max, line.revision), 0);
        const current = lines.filter((line) => line.revision === latestRevision);
        view.receiptRowCount = current.length;
        view.receiptLines = current.map((line) => ({
          id: line.id,
          rowNumber: line.rowNumber,
          party: line.party
            ? {
                id: line.party.id,
                partyName: line.party.partyName,
                partyCode: line.party.partyCode,
              }
            : null,
          bankNameCode: line.bankNameCode,
          bankInstrument: line.bankInstrument
            ? {
                id: line.bankInstrument.id,
                code: line.bankInstrument.code,
                description: line.bankInstrument.description,
              }
            : null,
          chequeNumber: line.chequeNumber,
          description: line.description,
          amount: decimalFixed(line.amount),
          adjustmentMode: line.adjustmentMode,
          allocations: line.allocations.map((allocation) => ({
            id: allocation.id,
            purchaseBillId: allocation.purchaseBillId,
            sourceDocumentNumber: allocation.sourceDocumentNumber,
            billDate: toDateKey(allocation.billDate),
            billAmount: decimalFixed(allocation.billAmount),
            billTds: decimalFixed(allocation.billTds),
            previousReceived: decimalFixed(allocation.previousReceived),
            allocatedAmount: decimalFixed(allocation.allocatedAmount),
            balanceAfter: decimalFixed(allocation.balanceAfter),
            status: allocation.status,
            adjustments: allocation.adjustments.map((adjustment) => ({
              id: adjustment.id,
              adjustmentLedgerAccount: {
                id: adjustment.adjustmentLedgerAccount.id,
                accountCode: adjustment.adjustmentLedgerAccount.accountCode,
                accountName: adjustment.adjustmentLedgerAccount.accountName,
              },
              calculationType: adjustment.calculationType,
              interestPercent:
                adjustment.interestPercent === null
                  ? null
                  : decimalFixed(adjustment.interestPercent),
              dueValue: adjustment.dueValue,
              tdsPercent:
                adjustment.tdsPercent === null ? null : decimalFixed(adjustment.tdsPercent),
              adjustmentAmount: decimalFixed(adjustment.adjustmentAmount),
              drCr: adjustment.drCr,
              note: adjustment.note,
              status: adjustment.status,
            })),
          })),
        }));
      }
    }

    return view;
  }
  async getLookups(companyId: string, financialYearId: string, voucherType: BankVoucherType) {
    const context = await this.loadContext(companyId, financialYearId);

    const [bankAccounts, ledgers, parties, partyLedgers, sequence] = await Promise.all([
      prisma.ledgerAccount.findMany({
        where: { companyId, isActive: true, isBankAccount: true },
        orderBy: { accountName: 'asc' },
      }),
      prisma.ledgerAccount.findMany({
        where: { companyId, isActive: true, isBankAccount: false, partyId: null },
        orderBy: { accountName: 'asc' },
      }),
      prisma.party.findMany({
        where: { companyId, isActive: true },
        select: { id: true, partyName: true, partyCode: true, partyType: true },
        orderBy: { partyName: 'asc' },
      }),
      prisma.ledgerAccount.findMany({
        where: { companyId, partyId: { not: null } },
        select: { id: true, accountCode: true, accountName: true, partyId: true },
      }),
      prisma.voucherSequence.findUnique({
        where: {
          companyId_financialYearId_voucherType: {
            companyId,
            financialYearId,
            voucherType,
          },
        },
      }),
    ]);

    const ledgerByParty = new Map(partyLedgers.map((ledger) => [ledger.partyId, ledger]));

    return {
      company: context.company,
      financialYear: {
        id: context.financialYear.id,
        yearName: context.financialYear.yearName,
        startDate: toDateKey(context.financialYear.startDate),
        endDate: toDateKey(context.financialYear.endDate),
        isLocked: context.financialYear.isLocked,
      },
      bankAccounts: bankAccounts.map((account) => ({
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountGroup: account.accountGroup,
        bankName: account.bankName,
        branchName: account.branchName,
      })),
      ledgers: ledgers.map((account) => ({
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountGroup: account.accountGroup,
      })),
      parties: parties.map((party) => ({
        id: party.id,
        partyName: party.partyName,
        partyCode: party.partyCode,
        partyType: party.partyType,
        ledgerAccountId: ledgerByParty.get(party.id)?.id ?? null,
        ledgerAccountName: ledgerByParty.get(party.id)?.accountName ?? null,
      })),
      paymentModes: PAYMENT_MODES,
      nextVoucherNumber: this.formatNumber(
        voucherType,
        context.financialYear.startDate,
        (sequence?.lastNumber ?? 0) + 1
      ),
    };
  }

  async nextNumber(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType
  ): Promise<{ voucherNumber: string }> {
    const context = await this.loadContext(companyId, financialYearId);
    const sequence = await prisma.voucherSequence.findUnique({
      where: {
        companyId_financialYearId_voucherType: { companyId, financialYearId, voucherType },
      },
    });

    return {
      voucherNumber: this.formatNumber(
        voucherType,
        context.financialYear.startDate,
        (sequence?.lastNumber ?? 0) + 1
      ),
    };
  }

  async list(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    query: Record<string, unknown>
  ): Promise<BankVoucherListResponse> {
    await this.loadContext(companyId, financialYearId);

    const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
    const limitRaw = Number.parseInt(String(query.limit ?? '20'), 10) || 20;
    const limit = Math.min(100, Math.max(1, limitRaw));

    const status =
      typeof query.status === 'string' && ['POSTED', 'CANCELLED'].includes(query.status)
        ? (query.status as BankVoucherStatus)
        : undefined;

    const paymentMode =
      typeof query.paymentMode === 'string' &&
      PAYMENT_MODES.includes(query.paymentMode as PaymentMode)
        ? (query.paymentMode as PaymentMode)
        : undefined;

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (typeof query.fromDate === 'string' && query.fromDate.trim() !== '') {
      fromDate = parseDateInput(query.fromDate, 'From date');
    }
    if (typeof query.toDate === 'string' && query.toDate.trim() !== '') {
      const end = parseDateInput(query.toDate, 'To date');
      toDate = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    const sortBy = query.sortBy === 'number' ? 'number' : 'date';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const result = await repo.list(companyId, financialYearId, voucherType, {
      search: typeof query.search === 'string' ? query.search : undefined,
      bankAccountLedgerId:
        typeof query.bankAccountLedgerId === 'string' ? query.bankAccountLedgerId : undefined,
      paymentMode,
      status,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
      page,
      limit,
    });

    const receiptIds = result.items
      .filter((voucher) => voucher.voucherType === 'RECEIPT')
      .map((voucher) => voucher.id);
    const [rowCounts, partyMap] = await Promise.all([
      repo.latestReceiptRowCounts(receiptIds),
      repo.latestReceiptParties(receiptIds),
    ]);

    return {
      items: result.items.map((voucher) => {
        const view = this.serialize(voucher);
        if (voucher.voucherType === 'RECEIPT') {
          view.receiptRowCount = rowCounts.get(voucher.id) ?? 1;
          view.receiptParties = partyMap.get(voucher.id) ?? [];
        }
        return view;
      }),
      total: result.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
      totalAmount: decimalFixed(result.totalAmount),
    };
  }

  async getById(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    id: string
  ): Promise<BankVoucherView> {
    const voucher = await repo.findById(companyId, financialYearId, voucherType, id);
    if (!voucher) {
      notFoundError('Bank voucher not found for the active company and financial year.');
    }
    return this.serialize(voucher);
  }

  async create(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    payload: BankVoucherPayload
  ): Promise<BankVoucherView> {
    const context = await this.loadContext(companyId, financialYearId);

    const voucherId = await prisma.$transaction(async (tx) => {
      const resolved = await this.resolvePayload(tx, context, voucherType, payload);

      const sequence = await repo.nextSequence(tx, companyId, financialYearId, voucherType);
      const voucherNumber = this.formatNumber(
        voucherType,
        context.financialYear.startDate,
        sequence
      );

      const created = await repo.createVoucher(tx, {
        companyId,
        financialYearId,
        voucherType,
        voucherNumber,
        voucherDate: resolved.voucherDate,
        partyId: resolved.partyId,
        counterpartyLedgerId: resolved.counterparty.id,
        bankAccountLedgerId: resolved.bankAccount.id,
        paymentMode: resolved.paymentMode,
        amount: resolved.amount,
        referenceNumber: resolved.referenceNumber,
        chequeNumber: resolved.chequeNumber,
        chequeDate: resolved.chequeDate,
        bankName: resolved.bankName,
        branchName: resolved.branchName,
        narration: resolved.narration,
        remarks: resolved.remarks,
        status: 'POSTED',
        revision: 1,
      });

      const lines = this.buildPostedLines(
        resolved,
        voucherType,
        companyId,
        financialYearId,
        created.id,
        1,
        1
      );
      await repo.insertJournalLines(tx, lines);

      const totals = await repo.voucherDebitCredit(created.id);
      if (!totals.debit.equals(totals.credit)) {
        throw new AppError(
          500,
          'Accounting posting failed the debit/credit balance check.',
          undefined,
          'UNBALANCED_POSTING'
        );
      }

      return created.id;
    });

    return this.getById(companyId, financialYearId, voucherType, voucherId);
  }
  async update(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    id: string,
    payload: BankVoucherPayload
  ): Promise<BankVoucherView> {
    const context = await this.loadContext(companyId, financialYearId);

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockVoucher(tx, companyId, financialYearId, voucherType, id);
      } catch {
        notFoundError('Bank voucher not found for the active company and financial year.');
      }

      const existing = await tx.bankVoucher.findFirst({
        where: { id, companyId, financialYearId, voucherType },
      });
      if (!existing) {
        notFoundError('Bank voucher not found for the active company and financial year.');
      }
      if (existing.status === 'CANCELLED') {
        conflictError('A cancelled voucher cannot be edited.');
      }

      // Phase 18: a multi-row cheque receipt must be edited through its own
      // screen so allocations and adjustments stay consistent.
      if (voucherType === 'RECEIPT') {
        const rowCount = await repo.rowCountForRevision(id, existing.revision);
        if (rowCount > 1) {
          conflictError(
            'This cheque receipt contains multiple party rows. Edit it from the Cheque Receipt screen.'
          );
        }
      }

      const resolved = await this.resolvePayload(tx, context, voucherType, payload, id);
      const nextRevision = existing.revision + 1;
      const startLine = (await repo.maxLineNumber(tx, id)) + 1;

      const existingNet = await repo.netByLedger(tx, id);
      const reversalLines: Prisma.JournalLineCreateManyInput[] = existingNet
        .filter((entry) => !entry.debit.isZero() || !entry.credit.isZero())
        .map((entry, index) => ({
          companyId,
          financialYearId,
          voucherId: id,
          ledgerAccountId: entry.ledgerAccountId,
          revision: nextRevision,
          lineNumber: startLine + index,
          debitAmount: entry.credit,
          creditAmount: entry.debit,
          isReversal: true,
          postingDate: resolved.voucherDate,
          narration: `Reversal of revision ${existing.revision} before edit`,
        }));

      const correctedLines = this.buildPostedLines(
        resolved,
        voucherType,
        companyId,
        financialYearId,
        id,
        nextRevision,
        startLine + reversalLines.length
      );

      await repo.insertJournalLines(tx, [...reversalLines, ...correctedLines]);

      await repo.updateVoucher(tx, id, {
        voucherDate: resolved.voucherDate,
        partyId: resolved.partyId,
        counterpartyLedgerId: resolved.counterparty.id,
        bankAccountLedgerId: resolved.bankAccount.id,
        paymentMode: resolved.paymentMode,
        amount: resolved.amount,
        referenceNumber: resolved.referenceNumber,
        chequeNumber: resolved.chequeNumber,
        chequeDate: resolved.chequeDate,
        bankName: resolved.bankName,
        branchName: resolved.branchName,
        narration: resolved.narration,
        remarks: resolved.remarks,
        revision: nextRevision,
      });

      const totals = await repo.voucherDebitCredit(id);
      if (!totals.debit.equals(totals.credit)) {
        throw new AppError(
          500,
          'Edited voucher failed the debit/credit balance check.',
          undefined,
          'UNBALANCED_POSTING'
        );
      }
    });

    return this.getById(companyId, financialYearId, voucherType, id);
  }

  async cancel(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    id: string,
    reasonRaw: unknown
  ): Promise<BankVoucherView> {
    const context = await this.loadContext(companyId, financialYearId);

    if (context.financialYear.isLocked) {
      throw new AppError(
        409,
        `Financial year ${context.financialYear.yearName} is locked. Cancellation is blocked.`
      );
    }

    const reason = String(reasonRaw ?? '').trim();
    if (reason.length < 3) {
      validationError([
        {
          field: 'reason',
          message: 'A cancellation reason of at least 3 characters is required.',
        },
      ]);
    }
    if (reason.length > 250) {
      validationError([
        { field: 'reason', message: 'Cancellation reason cannot exceed 250 characters.' },
      ]);
    }

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockVoucher(tx, companyId, financialYearId, voucherType, id);
      } catch {
        notFoundError('Bank voucher not found for the active company and financial year.');
      }

      const existing = await tx.bankVoucher.findFirst({
        where: { id, companyId, financialYearId, voucherType },
      });
      if (!existing) {
        notFoundError('Bank voucher not found for the active company and financial year.');
      }
      if (existing.status === 'CANCELLED') {
        conflictError('This voucher has already been cancelled.');
      }

      const nextRevision = existing.revision + 1;
      const startLine = (await repo.maxLineNumber(tx, id)) + 1;
      const net = await repo.netByLedger(tx, id);

      const reversalLines: Prisma.JournalLineCreateManyInput[] = net
        .filter((entry) => !entry.debit.isZero() || !entry.credit.isZero())
        .map((entry, index) => ({
          companyId,
          financialYearId,
          voucherId: id,
          ledgerAccountId: entry.ledgerAccountId,
          revision: nextRevision,
          lineNumber: startLine + index,
          debitAmount: entry.credit,
          creditAmount: entry.debit,
          isReversal: true,
          postingDate: existing.voucherDate,
          narration: `Cancellation reversal: ${reason}`,
        }));

      await repo.insertJournalLines(tx, reversalLines);

      // Phase 18: cancelled receipt releases its bill allocations so the
      // outstanding bills become collectable again.
      if (voucherType === 'RECEIPT') {
        await repo.releaseReceiptAllocations(tx, id);
      }

      await repo.updateVoucher(tx, id, {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
        revision: nextRevision,
      });

      const remaining = await repo.netByLedger(tx, id);
      const residual = remaining.reduce(
        (total, entry) => total.plus(entry.debit).minus(entry.credit),
        new Prisma.Decimal(0)
      );
      if (!residual.isZero()) {
        throw new AppError(
          500,
          'Cancellation reversal failed to zero the voucher posting.',
          undefined,
          'UNBALANCED_REVERSAL'
        );
      }
    });

    return this.getById(companyId, financialYearId, voucherType, id);
  }

  async statusSummary(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType
  ): Promise<{ posted: number; cancelled: number }> {
    const [posted, cancelled] = await Promise.all([
      prisma.bankVoucher.count({
        where: { companyId, financialYearId, voucherType, status: 'POSTED' },
      }),
      prisma.bankVoucher.count({
        where: { companyId, financialYearId, voucherType, status: 'CANCELLED' },
      }),
    ]);
    return { posted, cancelled };
  }
}