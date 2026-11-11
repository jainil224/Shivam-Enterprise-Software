// Phase 16 - Bank Reconciliation service.
// The only financial effect of this module is recording whether and when the
// bank cleared an existing book transaction. It never posts a journal entry and
// never changes a ledger balance.

import { Prisma } from '@prisma/client';
import {
  bankReconciliationRepository,
  type BankPostingLine,
} from '../repositories/bankReconciliationRepository.js';
import {
  AppError,
  conflictError,
  notFoundError,
  validationError,
} from '../utils/appError.js';
import { formatIndianMoney, moneyToFixed, parseSignedMoney, toMoney } from '../utils/money.js';
import {
  buildStatementPdf,
  type StatementBlock,
  type StatementCell,
} from '../utils/pdfWriter.js';

export type ReconciliationViewType = 'ALL' | 'PAYMENTS' | 'RECEIPTS' | 'PENDING';

export interface BankBookOption {
  id: string;
  accountCode: string;
  accountName: string;
  bankName: string | null;
  branchName: string | null;
  bankAccountNumber: string | null;
  openingBalance: string;
  debitTotal: string;
  creditTotal: string;
  currentBalance: string;
  balanceAmount: string;
  balanceNature: 'Dr' | 'Cr';
  transactionCount: number;
}

export interface ReconciliationTransaction {
  journalLineId: string;
  sourceType: 'RECEIPT' | 'PAYMENT' | 'DEBIT_NOTE';
  sourceId: string;
  sourceNumber: string;
  transactionDate: string;
  chequeDate: string | null;
  clearingDate: string | null;
  chequeNumber: string | null;
  referenceNumber: string | null;
  accountName: string;
  narration: string | null;
  receiptAmount: string;
  paymentAmount: string;
  isCleared: boolean;
  isPending: boolean;
}

export interface ReconciliationSummary {
  openingBookBalance: string;
  totalReceipts: string;
  totalPayments: string;
  closingBookBalance: string;
  unclearedPayments: string;
  unclearedReceipts: string;
  calculatedBankBalance: string;
  statementBalance: string | null;
  difference: string | null;
  differenceIsZero: boolean;
  hasStatementBalance: boolean;
  transactionCount: number;
  pendingCount: number;
}

export interface ReconciliationOpeningInfo {
  openingDate: string;
  openingBookBalance: string;
  openingStatementBalance: string | null;
  difference: string | null;
  isAcknowledged: boolean;
  requiresSetup: boolean;
  requiresAcknowledgement: boolean;
}

export interface ReconciliationContext {
  company: { id: string; companyName: string; address: string | null; city: string | null; state: string | null; pincode: string | null; gstin: string | null };
  financialYear: { id: string; yearName: string; startDate: string; endDate: string; isLocked: boolean };
  bank: BankBookOption;
  fromDate: string;
  toDate: string;
  opening: ReconciliationOpeningInfo;
  summary: ReconciliationSummary;
  transactions: ReconciliationTransaction[];
}

interface ComputedReconciliation {
  openingBookBalance: Prisma.Decimal;
  totalReceipts: Prisma.Decimal;
  totalPayments: Prisma.Decimal;
  closingBookBalance: Prisma.Decimal;
  unclearedPayments: Prisma.Decimal;
  unclearedReceiptsTotal: Prisma.Decimal;
  calculatedBankBalance: Prisma.Decimal;
  transactions: ReconciliationTransaction[];
  unclearedPaymentLines: BankPostingLine[];
  unclearedReceiptLines: BankPostingLine[];
  pendingCount: number;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: unknown, label: string): Date {
  const text = String(value ?? '').trim();
  if (!ISO_DATE_PATTERN.test(text)) {
    throw new AppError(400, label + ' must be a valid date in YYYY-MM-DD format.');
  }
  const date = new Date(text + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new AppError(400, label + ' is not a valid calendar date.');
  }
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDisplayDate(date: Date): string {
  const parts = toIsoDate(date).split('-');
  return parts[2] + '-' + parts[1] + '-' + parts[0];
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function signedBalance(value: Prisma.Decimal): { currentBalance: string; balanceAmount: string; balanceNature: 'Dr' | 'Cr' } {
  const rounded = value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const nature: 'Dr' | 'Cr' = rounded.isNegative() ? 'Cr' : 'Dr';
  return {
    currentBalance: moneyToFixed(rounded),
    balanceAmount: moneyToFixed(rounded.abs()),
    balanceNature: nature,
  };
}

function requireText(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (text.length === 0) {
    throw new AppError(400, label + ' is required.');
  }
  return text;
}

function isEligiblePosting(line: BankPostingLine): boolean {
  if (line.isReversal) return false;
  if (line.voucher) {
    return line.voucher.status === 'POSTED' && line.voucher.revision === line.revision;
  }
  if (line.debitNote) {
    return line.debitNote.status === 'POSTED' && line.debitNote.revision === line.revision;
  }
  return false;
}

function transactionDisplayDate(line: BankPostingLine): Date {
  if (line.voucher) {
    return startOfDay(line.voucher.chequeDate ?? line.voucher.voucherDate);
  }
  if (line.debitNote) {
    return startOfDay(line.debitNote.noteDate);
  }
  return startOfDay(line.postingDate);
}

function transactionAccountName(line: BankPostingLine): string {
  if (line.voucher) {
    return line.voucher.party?.partyName ?? line.voucher.counterpartyLedger.accountName;
  }
  if (line.debitNote) {
    return line.debitNote.party?.partyName ?? line.debitNote.creditAccount.accountName;
  }
  return line.narration ?? 'Bank transaction';
}

function toTransaction(line: BankPostingLine, toDate: Date): ReconciliationTransaction {
  const chequeDate = line.voucher?.chequeDate ? toIsoDate(line.voucher.chequeDate) : null;
  const displayDate = transactionDisplayDate(line);
  const clearingDate = line.bankReconciliationMark
    ? toIsoDate(line.bankReconciliationMark.clearingDate)
    : null;
  const isCleared =
    line.bankReconciliationMark !== null &&
    startOfDay(line.bankReconciliationMark.clearingDate).getTime() <= toDate.getTime();

  const sourceType: ReconciliationTransaction['sourceType'] = line.voucher
    ? line.voucher.voucherType === 'RECEIPT'
      ? 'RECEIPT'
      : 'PAYMENT'
    : 'DEBIT_NOTE';

  return {
    journalLineId: line.id,
    sourceType,
    sourceId: line.voucher?.id ?? line.debitNote?.id ?? line.id,
    sourceNumber: line.voucher?.voucherNumber ?? line.debitNote?.noteNumber ?? '',
    transactionDate: toIsoDate(displayDate),
    chequeDate,
    clearingDate,
    chequeNumber: line.voucher?.chequeNumber ?? null,
    referenceNumber: line.voucher?.referenceNumber ?? null,
    accountName: transactionAccountName(line),
    narration: line.narration,
    receiptAmount: moneyToFixed(line.debitAmount),
    paymentAmount: moneyToFixed(line.creditAmount),
    isCleared,
    isPending: !isCleared,
  };
}

function buildBankOption(
  account: {
    id: string;
    accountCode: string;
    accountName: string;
    bankName: string | null;
    branchName: string | null;
    bankAccountNumber: string | null;
    openingBalance: Prisma.Decimal;
  },
  totals?: { debitTotal: Prisma.Decimal; creditTotal: Prisma.Decimal; transactionCount: number }
): BankBookOption {
  const debitTotal = totals?.debitTotal ?? new Prisma.Decimal(0);
  const creditTotal = totals?.creditTotal ?? new Prisma.Decimal(0);
  const current = toMoney(account.openingBalance).plus(debitTotal).minus(creditTotal);
  const balance = signedBalance(current);
  return {
    id: account.id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    bankName: account.bankName,
    branchName: account.branchName,
    bankAccountNumber: account.bankAccountNumber,
    openingBalance: moneyToFixed(account.openingBalance),
    debitTotal: moneyToFixed(debitTotal),
    creditTotal: moneyToFixed(creditTotal),
    currentBalance: balance.currentBalance,
    balanceAmount: balance.balanceAmount,
    balanceNature: balance.balanceNature,
    transactionCount: totals?.transactionCount ?? 0,
  };
}
function parseSignedInput(raw: unknown, label: string): Prisma.Decimal {
  try {
    return parseSignedMoney(raw, label);
  } catch (err) {
    const message = err instanceof Error ? err.message : label + ' is invalid.';
    throw new AppError(400, message);
  }
}

export class BankReconciliationService {
  private async loadScope(companyId: string, financialYearId: string) {
    const [company, financialYear] = await Promise.all([
      bankReconciliationRepository.getCompany(companyId),
      bankReconciliationRepository.getFinancialYear(companyId, financialYearId),
    ]);
    if (!company) throw new AppError(404, 'Company not found.');
    if (!financialYear) {
      throw new AppError(404, 'Financial year not found for the active company.');
    }
    return { company, financialYear };
  }

  private async requireBank(companyId: string, rawId: unknown) {
    const bankLedgerAccountId = requireText(rawId, 'Bank ledger account');
    const account = await bankReconciliationRepository.getBankAccount(companyId, bankLedgerAccountId);
    if (!account) {
      throw new AppError(
        404,
        'The selected bank ledger account was not found for the active company.'
      );
    }
    if (!account.isActive) {
      throw new AppError(409, 'The selected bank ledger account is inactive.');
    }
    return account;
  }

  private resolvePeriod(
    financialYear: { startDate: Date; endDate: Date },
    fromRaw: unknown,
    toRaw: unknown
  ): { fromDate: Date; toDate: Date } {
    const fromDate = parseIsoDate(fromRaw, 'From date');
    const toDate = parseIsoDate(toRaw, 'To date');
    const fyStart = startOfDay(financialYear.startDate);
    const fyEnd = startOfDay(financialYear.endDate);

    if (fromDate.getTime() > toDate.getTime()) {
      validationError([{ field: 'fromDate', message: 'From date cannot be after To date.' }]);
    }
    if (fromDate.getTime() < fyStart.getTime()) {
      validationError([
        { field: 'fromDate', message: 'From date cannot be before the financial year start.' },
      ]);
    }
    if (toDate.getTime() > fyEnd.getTime()) {
      validationError([
        { field: 'toDate', message: 'To date cannot be after the financial year end.' },
      ]);
    }
    return { fromDate, toDate };
  }

  private async compute(
    companyId: string,
    financialYearId: string,
    account: { id: string; openingBalance: Prisma.Decimal },
    fromDate: Date,
    toDate: Date
  ): Promise<ComputedReconciliation> {
    const lines = await bankReconciliationRepository.listPostingsThrough(
      companyId,
      financialYearId,
      account.id,
      toDate
    );
    const eligible = lines.filter(isEligiblePosting);

    let openingBookBalance = toMoney(account.openingBalance);
    let closingBookBalance = toMoney(account.openingBalance);
    let totalReceipts = new Prisma.Decimal(0);
    let totalPayments = new Prisma.Decimal(0);
    let unclearedPayments = new Prisma.Decimal(0);
    let unclearedReceiptsTotal = new Prisma.Decimal(0);
    let pendingCount = 0;

    const transactions: ReconciliationTransaction[] = [];
    const unclearedPaymentLines: BankPostingLine[] = [];
    const unclearedReceiptLines: BankPostingLine[] = [];

    for (const line of eligible) {
      const postingDay = startOfDay(line.postingDate);
      const signedAmount = line.debitAmount.minus(line.creditAmount);
      closingBookBalance = closingBookBalance.plus(signedAmount);

      if (postingDay.getTime() < fromDate.getTime()) {
        openingBookBalance = openingBookBalance.plus(signedAmount);
      }

      if (postingDay.getTime() >= fromDate.getTime() && postingDay.getTime() <= toDate.getTime()) {
        totalReceipts = totalReceipts.plus(line.debitAmount);
        totalPayments = totalPayments.plus(line.creditAmount);
        transactions.push(toTransaction(line, toDate));
      }

      const mark = line.bankReconciliationMark;
      const clearedAsOfToDate =
        mark !== null && startOfDay(mark.clearingDate).getTime() <= toDate.getTime();

      if (!clearedAsOfToDate) {
        pendingCount += 1;
        if (line.creditAmount.gt(0)) {
          unclearedPayments = unclearedPayments.plus(line.creditAmount);
          unclearedPaymentLines.push(line);
        }
        if (line.debitAmount.gt(0)) {
          unclearedReceiptsTotal = unclearedReceiptsTotal.plus(line.debitAmount);
          unclearedReceiptLines.push(line);
        }
      }
    }

    const calculatedBankBalance = closingBookBalance
      .plus(unclearedPayments)
      .minus(unclearedReceiptsTotal);

    return {
      openingBookBalance,
      totalReceipts,
      totalPayments,
      closingBookBalance,
      unclearedPayments,
      unclearedReceiptsTotal,
      calculatedBankBalance,
      transactions,
      unclearedPaymentLines,
      unclearedReceiptLines,
      pendingCount,
    };
  }

  private toSummary(
    computed: ComputedReconciliation,
    statementBalance: Prisma.Decimal | null
  ): ReconciliationSummary {
    const difference = statementBalance
      ? statementBalance.minus(computed.calculatedBankBalance)
      : null;

    return {
      openingBookBalance: moneyToFixed(computed.openingBookBalance),
      totalReceipts: moneyToFixed(computed.totalReceipts),
      totalPayments: moneyToFixed(computed.totalPayments),
      closingBookBalance: moneyToFixed(computed.closingBookBalance),
      unclearedPayments: moneyToFixed(computed.unclearedPayments),
      unclearedReceipts: moneyToFixed(computed.unclearedReceiptsTotal.negated()),
      calculatedBankBalance: moneyToFixed(computed.calculatedBankBalance),
      statementBalance: statementBalance ? moneyToFixed(statementBalance) : null,
      difference: difference ? moneyToFixed(difference) : null,
      differenceIsZero: difference ? difference.isZero() : false,
      hasStatementBalance: statementBalance !== null,
      transactionCount: computed.transactions.length,
      pendingCount: computed.pendingCount,
    };
  }

  private async loadStatementBalance(
    companyId: string,
    financialYearId: string,
    bankLedgerAccountId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<Prisma.Decimal | null> {
    const saved = await bankReconciliationRepository.latestStatement(
      companyId,
      financialYearId,
      bankLedgerAccountId,
      fromDate,
      toDate
    );
    return saved ? toMoney(saved.closingStatementBalance) : null;
  }

  async listBanks(companyId: string, financialYearId: string): Promise<BankBookOption[]> {
    await this.loadScope(companyId, financialYearId);
    const accounts = await bankReconciliationRepository.listBankAccounts(companyId);
    const totals = await bankReconciliationRepository.balanceTotals(
      companyId,
      financialYearId,
      accounts.map((account) => account.id)
    );
    const totalsById = new Map(totals.map((entry) => [entry.ledgerAccountId, entry]));
    return accounts.map((account) => buildBankOption(account, totalsById.get(account.id)));
  }
  private async bookBalanceAsOf(
    companyId: string,
    financialYearId: string,
    account: { id: string; openingBalance: Prisma.Decimal },
    asOf: Date
  ): Promise<Prisma.Decimal> {
    const lines = await bankReconciliationRepository.listPostingsThrough(
      companyId,
      financialYearId,
      account.id,
      asOf
    );
    let balance = toMoney(account.openingBalance);
    for (const line of lines) {
      if (!isEligiblePosting(line)) continue;
      if (startOfDay(line.postingDate).getTime() >= asOf.getTime()) continue;
      balance = balance.plus(line.debitAmount).minus(line.creditAmount);
    }
    return balance;
  }

  private async buildData(companyId: string, financialYearId: string, query: Record<string, unknown>) {
    const { company, financialYear } = await this.loadScope(companyId, financialYearId);
    const account = await this.requireBank(companyId, query.bankLedgerAccountId);
    const { fromDate, toDate } = this.resolvePeriod(financialYear, query.fromDate, query.toDate);
    const computed = await this.compute(companyId, financialYearId, account, fromDate, toDate);
    const statementBalance = await this.loadStatementBalance(
      companyId,
      financialYearId,
      account.id,
      fromDate,
      toDate
    );
    const openingRecord = await bankReconciliationRepository.getOpening(
      companyId,
      financialYearId,
      account.id
    );
    const openingDate = openingRecord
      ? startOfDay(openingRecord.openingDate)
      : startOfDay(financialYear.startDate);
    const openingBookBalance = await this.bookBalanceAsOf(
      companyId,
      financialYearId,
      account,
      openingDate
    );
    const totals = await bankReconciliationRepository.balanceTotals(companyId, financialYearId, [
      account.id,
    ]);
    const bank = buildBankOption(account, totals[0]);

    return {
      company,
      financialYear,
      account,
      bank,
      fromDate,
      toDate,
      computed,
      statementBalance,
      openingRecord,
      openingDate,
      openingBookBalance,
    };
  }

  private toOpeningInfo(
    openingRecord: { openingDate: Date; openingStatementBalance: Prisma.Decimal; isAcknowledged: boolean } | null,
    openingDate: Date,
    openingBookBalance: Prisma.Decimal
  ): ReconciliationOpeningInfo {
    const openingStatementBalance = openingRecord
      ? toMoney(openingRecord.openingStatementBalance)
      : null;
    const difference = openingStatementBalance
      ? openingStatementBalance.minus(openingBookBalance)
      : null;

    return {
      openingDate: toIsoDate(openingDate),
      openingBookBalance: moneyToFixed(openingBookBalance),
      openingStatementBalance: openingStatementBalance ? moneyToFixed(openingStatementBalance) : null,
      difference: difference ? moneyToFixed(difference) : null,
      isAcknowledged: openingRecord?.isAcknowledged ?? false,
      requiresSetup: openingRecord === null,
      requiresAcknowledgement: Boolean(
        openingRecord &&
          !openingRecord.isAcknowledged &&
          difference !== null &&
          !difference.isZero()
      ),
    };
  }

  async load(
    companyId: string,
    financialYearId: string,
    query: Record<string, unknown>
  ): Promise<ReconciliationContext> {
    const data = await this.buildData(companyId, financialYearId, query);
    return {
      company: {
        id: data.company.id,
        companyName: data.company.companyName,
        address: data.company.address,
        city: data.company.city,
        state: data.company.state,
        pincode: data.company.pincode,
        gstin: data.company.gstin,
      },
      financialYear: {
        id: data.financialYear.id,
        yearName: data.financialYear.yearName,
        startDate: toIsoDate(data.financialYear.startDate),
        endDate: toIsoDate(data.financialYear.endDate),
        isLocked: data.financialYear.isLocked,
      },
      bank: data.bank,
      fromDate: toIsoDate(data.fromDate),
      toDate: toIsoDate(data.toDate),
      opening: this.toOpeningInfo(
        data.openingRecord,
        data.openingDate,
        data.openingBookBalance
      ),
      summary: this.toSummary(data.computed, data.statementBalance),
      transactions: data.computed.transactions,
    };
  }

  async saveOpeningBalance(
    companyId: string,
    financialYearId: string,
    payload: Record<string, unknown>
  ) {
    const { financialYear } = await this.loadScope(companyId, financialYearId);
    const account = await this.requireBank(companyId, payload.bankLedgerAccountId);
    if (financialYear.isLocked) {
      throw new AppError(
        409,
        'Financial year ' + financialYear.yearName + ' is locked. Reconciliation changes are blocked.'
      );
    }

    const openingDate = payload.openingDate
      ? parseIsoDate(payload.openingDate, 'Opening date')
      : startOfDay(financialYear.startDate);
    const fyStart = startOfDay(financialYear.startDate);
    const fyEnd = startOfDay(financialYear.endDate);
    if (openingDate.getTime() < fyStart.getTime() || openingDate.getTime() > fyEnd.getTime()) {
      validationError([
        { field: 'openingDate', message: 'Opening date must fall inside the financial year.' },
      ]);
    }

    const openingStatementBalance = parseSignedInput(
      payload.openingStatementBalance,
      'Opening balance as per bank statement'
    );
    const openingBookBalance = await this.bookBalanceAsOf(
      companyId,
      financialYearId,
      account,
      openingDate
    );
    const difference = openingStatementBalance.minus(openingBookBalance);
    const acknowledge = payload.acknowledgeDifference === true;
    const now = new Date();

    await bankReconciliationRepository.transaction(async (tx) => {
      await tx.bankReconciliationOpening.upsert({
        where: {
          companyId_financialYearId_bankLedgerAccountId: {
            companyId,
            financialYearId,
            bankLedgerAccountId: account.id,
          },
        },
        create: {
          companyId,
          financialYearId,
          bankLedgerAccountId: account.id,
          openingDate,
          openingStatementBalance,
          openingBookBalance,
          difference,
          isAcknowledged: acknowledge,
          acknowledgedAt: acknowledge ? now : null,
        },
        update: {
          openingDate,
          openingStatementBalance,
          openingBookBalance,
          difference,
          isAcknowledged: acknowledge,
          acknowledgedAt: acknowledge ? now : null,
        },
      });

      await tx.bankReconciliationAudit.create({
        data: {
          companyId,
          financialYearId,
          bankLedgerAccountId: account.id,
          action: 'OPENING_BALANCE_SET',
          reason:
            'Opening statement balance set to ' +
            moneyToFixed(openingStatementBalance) +
            ' (book ' +
            moneyToFixed(openingBookBalance) +
            ', difference ' +
            moneyToFixed(difference) +
            ').',
        },
      });

      if (acknowledge) {
        await tx.bankReconciliationAudit.create({
          data: {
            companyId,
            financialYearId,
            bankLedgerAccountId: account.id,
            action: 'OPENING_BALANCE_ACKNOWLEDGED',
            reason: 'Opening difference ' + moneyToFixed(difference) + ' acknowledged by the user.',
          },
        });
      }
    });

    return {
      opening: {
        openingDate: toIsoDate(openingDate),
        openingBookBalance: moneyToFixed(openingBookBalance),
        openingStatementBalance: moneyToFixed(openingStatementBalance),
        difference: moneyToFixed(difference),
        isAcknowledged: acknowledge,
        requiresSetup: false,
        requiresAcknowledgement: !acknowledge && !difference.isZero(),
      },
      warning: difference.isZero()
        ? null
        : {
            difference: moneyToFixed(difference),
            requiresAcknowledgement: !acknowledge,
            message:
              'Software Bank Book Opening Balance and Opening Reconciliation Entry Difference: ' +
              moneyToFixed(difference) +
              '. Please verify the opening balance entered as per the bank statement.',
          },
    };
  }

  async saveStatementBalance(
    companyId: string,
    financialYearId: string,
    payload: Record<string, unknown>
  ) {
    const data = await this.buildData(companyId, financialYearId, payload);
    if (data.financialYear.isLocked) {
      throw new AppError(
        409,
        'Financial year ' + data.financialYear.yearName + ' is locked. Reconciliation changes are blocked.'
      );
    }

    const statementBalance = parseSignedInput(payload.statementBalance, 'Balance as statement');
    const difference = statementBalance.minus(data.computed.calculatedBankBalance);
    const status: 'BALANCED' | 'UNBALANCED' = difference.isZero() ? 'BALANCED' : 'UNBALANCED';
    const now = new Date();

    const saved = await bankReconciliationRepository.transaction(async (tx) => {
      const snapshot = await tx.bankReconciliationStatement.create({
        data: {
          companyId,
          financialYearId,
          bankLedgerAccountId: data.account.id,
          fromDate: data.fromDate,
          toDate: data.toDate,
          openingStatementBalance: data.openingRecord
            ? data.openingRecord.openingStatementBalance
            : new Prisma.Decimal(0),
          closingStatementBalance: statementBalance,
          bookOpeningBalance: data.computed.openingBookBalance,
          bookClosingBalance: data.computed.closingBookBalance,
          unclearedPayments: data.computed.unclearedPayments,
          unclearedReceipts: data.computed.unclearedReceiptsTotal,
          calculatedBankBalance: data.computed.calculatedBankBalance,
          difference,
          status,
        },
      });

      await tx.bankReconciliationAudit.create({
        data: {
          companyId,
          financialYearId,
          bankLedgerAccountId: data.account.id,
          action: 'STATEMENT_SAVED',
          reason:
            'Closing statement balance ' +
            moneyToFixed(statementBalance) +
            ' saved for ' +
            toIsoDate(data.fromDate) +
            ' to ' +
            toIsoDate(data.toDate) +
            ' (difference ' +
            moneyToFixed(difference) +
            ').',
        },
      });

      return snapshot;
    });

    return {
      statementId: saved.id,
      savedAt: saved.createdAt.toISOString(),
      status,
      summary: this.toSummary(data.computed, statementBalance),
    };
  }
  async markReconciled(
    companyId: string,
    financialYearId: string,
    journalLineId: string,
    payload: Record<string, unknown>
  ) {
    const { financialYear } = await this.loadScope(companyId, financialYearId);
    if (financialYear.isLocked) {
      throw new AppError(
        409,
        'Financial year ' + financialYear.yearName + ' is locked. Reconciliation changes are blocked.'
      );
    }

    const line = await bankReconciliationRepository.getPostingLine(
      companyId,
      financialYearId,
      journalLineId
    );
    if (!line) {
      notFoundError('Bank transaction not found for the active company and financial year.');
    }
    if (!isEligiblePosting(line)) {
      conflictError(
        'Only current, posted bank transactions can be reconciled. Draft, cancelled or reversed postings are excluded.'
      );
    }

    const account = await this.requireBank(companyId, line.ledgerAccountId);
    const clearingDate = parseIsoDate(payload.clearingDate, 'Clearing date');
    const sourceDate = transactionDisplayDate(line);
    if (clearingDate.getTime() < sourceDate.getTime()) {
      validationError([
        {
          field: 'clearingDate',
          message:
            'Clearing date cannot precede the transaction/cheque date (' +
            toIsoDate(sourceDate) +
            ').',
        },
      ]);
    }

    const existing = await bankReconciliationRepository.findMark(companyId, line.id);
    if (existing) {
      conflictError('This bank transaction already has a clearing date.');
    }

    try {
      await bankReconciliationRepository.transaction(async (tx) => {
        const mark = await tx.bankReconciliationMark.create({
          data: {
            companyId,
            financialYearId,
            bankLedgerAccountId: account.id,
            bankJournalLineId: line.id,
            clearingDate,
          },
        });

        await tx.bankReconciliationAudit.create({
          data: {
            companyId,
            financialYearId,
            bankLedgerAccountId: account.id,
            reconciliationMarkId: mark.id,
            bankJournalLineId: line.id,
            action: 'SET_CLEARING_DATE',
            newClearingDate: clearingDate,
            reason: 'Clearing date assigned from the bank reconciliation screen.',
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        conflictError('This bank transaction already has a clearing date.');
      }
      throw err;
    }

    return {
      journalLineId: line.id,
      bankLedgerAccountId: account.id,
      clearingDate: toIsoDate(clearingDate),
      isCleared: true,
    };
  }

  async removeClearing(
    companyId: string,
    financialYearId: string,
    journalLineId: string,
    payload: Record<string, unknown>
  ) {
    const { financialYear } = await this.loadScope(companyId, financialYearId);
    if (financialYear.isLocked) {
      throw new AppError(
        409,
        'Financial year ' + financialYear.yearName + ' is locked. Reconciliation changes are blocked.'
      );
    }

    const line = await bankReconciliationRepository.getPostingLine(
      companyId,
      financialYearId,
      journalLineId
    );
    if (!line) {
      notFoundError('Bank transaction not found for the active company and financial year.');
    }

    const mark = await bankReconciliationRepository.findMark(companyId, journalLineId);
    if (!mark) {
      notFoundError('This bank transaction does not have a clearing date to remove.');
    }

    const reason = String(payload.reason ?? '').trim();

    await bankReconciliationRepository.transaction(async (tx) => {
      await tx.bankReconciliationAudit.create({
        data: {
          companyId,
          financialYearId,
          bankLedgerAccountId: mark.bankLedgerAccountId,
          bankJournalLineId: journalLineId,
          action: 'REMOVE_CLEARING_DATE',
          previousClearingDate: mark.clearingDate,
          reason: reason.length > 0 ? reason : 'Clearing date removed from the bank reconciliation screen.',
        },
      });

      await tx.bankReconciliationMark.delete({ where: { id: mark.id } });
    });

    return {
      journalLineId,
      bankLedgerAccountId: mark.bankLedgerAccountId,
      clearingDate: null,
      isCleared: false,
    };
  }

  private filterTransactions(
    transactions: ReconciliationTransaction[],
    viewType: ReconciliationViewType
  ): ReconciliationTransaction[] {
    if (viewType === 'PAYMENTS') {
      return transactions.filter((row) => row.paymentAmount !== '0.00');
    }
    if (viewType === 'RECEIPTS') {
      return transactions.filter((row) => row.receiptAmount !== '0.00');
    }
    if (viewType === 'PENDING') {
      return transactions.filter((row) => row.isPending);
    }
    return transactions;
  }

  async listTransactions(
    companyId: string,
    financialYearId: string,
    query: Record<string, unknown>
  ) {
    const rawView = String(query.viewType ?? 'ALL').toUpperCase();
    if (rawView !== 'ALL' && rawView !== 'PAYMENTS' && rawView !== 'RECEIPTS' && rawView !== 'PENDING') {
      throw new AppError(400, 'viewType must be one of PAYMENTS, RECEIPTS, ALL or PENDING.');
    }
    const viewType = rawView as ReconciliationViewType;
    const context = await this.load(companyId, financialYearId, query);
    return {
      viewType,
      bankLedgerAccountId: context.bank.id,
      fromDate: context.fromDate,
      toDate: context.toDate,
      summary: context.summary,
      transactions: this.filterTransactions(context.transactions, viewType),
    };
  }

  async getSummary(companyId: string, financialYearId: string, query: Record<string, unknown>) {
    const data = await this.buildData(companyId, financialYearId, query);
    return {
      bank: data.bank,
      fromDate: toIsoDate(data.fromDate),
      toDate: toIsoDate(data.toDate),
      opening: this.toOpeningInfo(data.openingRecord, data.openingDate, data.openingBookBalance),
      summary: this.toSummary(data.computed, data.statementBalance),
    };
  }

  async getStatement(companyId: string, financialYearId: string, query: Record<string, unknown>) {
    const data = await this.buildData(companyId, financialYearId, query);
    const summary = this.toSummary(data.computed, data.statementBalance);

    const paymentRows = data.computed.unclearedPaymentLines.map((line) => ({
      journalLineId: line.id,
      date: toIsoDate(transactionDisplayDate(line)),
      chequeNo: line.voucher?.chequeNumber ?? line.voucher?.referenceNumber ?? '',
      favouring: transactionAccountName(line),
      amount: moneyToFixed(line.creditAmount),
      clearingDate: line.bankReconciliationMark
        ? toIsoDate(line.bankReconciliationMark.clearingDate)
        : '',
    }));

    const receiptRows = data.computed.unclearedReceiptLines.map((line) => ({
      journalLineId: line.id,
      date: toIsoDate(transactionDisplayDate(line)),
      chequeNo: line.voucher?.chequeNumber ?? line.voucher?.referenceNumber ?? '',
      receivedFrom: transactionAccountName(line),
      amount: moneyToFixed(line.debitAmount),
    }));

    const history = await bankReconciliationRepository.listStatements(
      companyId,
      financialYearId,
      data.account.id
    );

    return {
      bank: data.bank,
      company: {
        id: data.company.id,
        companyName: data.company.companyName,
        address: data.company.address,
        city: data.company.city,
        state: data.company.state,
        pincode: data.company.pincode,
        gstin: data.company.gstin,
      },
      financialYear: {
        id: data.financialYear.id,
        yearName: data.financialYear.yearName,
        startDate: toIsoDate(data.financialYear.startDate),
        endDate: toIsoDate(data.financialYear.endDate),
        isLocked: data.financialYear.isLocked,
      },
      fromDate: toIsoDate(data.fromDate),
      toDate: toIsoDate(data.toDate),
      summary,
      paymentRows,
      receiptRows,
      history: history.map((entry) => ({
        id: entry.id,
        fromDate: toIsoDate(entry.fromDate),
        toDate: toIsoDate(entry.toDate),
        openingStatementBalance: moneyToFixed(entry.openingStatementBalance),
        closingStatementBalance: moneyToFixed(entry.closingStatementBalance),
        bookOpeningBalance: moneyToFixed(entry.bookOpeningBalance),
        bookClosingBalance: moneyToFixed(entry.bookClosingBalance),
        unclearedPayments: moneyToFixed(entry.unclearedPayments),
        unclearedReceipts: moneyToFixed(entry.unclearedReceipts),
        calculatedBankBalance: moneyToFixed(entry.calculatedBankBalance),
        difference: moneyToFixed(entry.difference),
        status: entry.status,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }
  async exportPdf(
    companyId: string,
    financialYearId: string,
    payload: Record<string, unknown>
  ): Promise<{ buffer: Buffer; filename: string; pageCount: number }> {
    const data = await this.buildData(companyId, financialYearId, payload);
    const summary = this.toSummary(data.computed, data.statementBalance);
    const orientation = payload.orientation === 'landscape' ? 'landscape' : 'portrait';

    const paymentRows = data.computed.unclearedPaymentLines.map((line) => [
      toDisplayDate(transactionDisplayDate(line)),
      line.voucher?.chequeNumber ?? line.voucher?.referenceNumber ?? '',
      transactionAccountName(line),
      formatIndianMoney(line.creditAmount),
      line.bankReconciliationMark ? toDisplayDate(line.bankReconciliationMark.clearingDate) : '',
    ]);

    const receiptRows = data.computed.unclearedReceiptLines.map((line) => [
      toDisplayDate(transactionDisplayDate(line)),
      line.voucher?.chequeNumber ?? line.voucher?.referenceNumber ?? '',
      transactionAccountName(line),
      formatIndianMoney(line.debitAmount),
    ]);

    // Phase 16.1 - column set of the printed Chandni-style statement.
    const paymentColumns: StatementCell[] = [
      { text: 'Date', weight: 12, align: 'left' },
      { text: 'Chq. No.', weight: 15, align: 'left' },
      { text: 'Favouring', weight: 37, align: 'left' },
      { text: 'Amount (Rs.)', weight: 18, align: 'right' },
      { text: 'Cl. Date', weight: 13, align: 'left' },
    ];

    const receiptColumns: StatementCell[] = [
      { text: 'Date', weight: 12, align: 'left' },
      { text: 'Chq. No.', weight: 15, align: 'left' },
      { text: 'Received From', weight: 45, align: 'left' },
      { text: 'Amount (Rs.)', weight: 18, align: 'right' },
    ];

    const headingCell = (text: string): StatementCell => ({
      text,
      weight: 100,
      align: 'left',
      bold: true,
      italic: true,
    });

    const amountRow = (label: string, amount: string): StatementBlock => ({
      type: 'row',
      cells: [
        { text: label, weight: 74, align: 'left', bold: true, italic: true },
        { text: amount, weight: 26, align: 'right', bold: true },
      ],
    });

    const statementBalanceText =
      summary.statementBalance === null
        ? 'Not entered'
        : 'Rs. ' + formatIndianMoney(summary.statementBalance);

    // Sections 1-5 print in the fixed reference order. Every figure comes from
    // the existing reconciliation summary; nothing is recalculated here.
    const blocks: StatementBlock[] = [
      amountRow(
        '1. Balance as per our Bank Book :-',
        'Rs. ' + formatIndianMoney(data.computed.closingBookBalance)
      ),
      {
        type: 'row',
        cells: [headingCell('2. Add : Cheques issued but not presented for payment :-')],
      },
      {
        type: 'table',
        columns: paymentColumns,
        rows: paymentRows,
        emptyText: 'All Clear',
        total: {
          label: 'Total',
          amount: formatIndianMoney(data.computed.unclearedPayments),
          amountColumn: 3,
        },
      },
      {
        type: 'row',
        cells: [headingCell('3. Less : Cheque deposited but not credited :-')],
      },
      {
        type: 'table',
        columns: receiptColumns,
        rows: receiptRows,
        emptyText: 'All Clear',
        total: {
          label: 'Total',
          amount: formatIndianMoney(data.computed.unclearedReceiptsTotal),
          amountColumn: 3,
        },
      },
      amountRow('4. Balance as per Bank Statement :-', statementBalanceText),
      amountRow(
        '5. Cl. Bal :-',
        'Rs. ' + formatIndianMoney(data.computed.calculatedBankBalance)
      ),
    ];

    // A genuine difference is surfaced, never hidden and never adjusted away.
    if (summary.difference !== null && !summary.differenceIsZero) {
      blocks.push({
        type: 'note',
        text: 'Unreconciled Difference: Rs. ' + formatIndianMoney(summary.difference),
        size: 8.5,
        bold: true,
      });
    }

    const addressParts = [
      data.company.address,
      data.company.city,
      data.company.state,
      data.company.pincode,
    ].filter((part): part is string => Boolean(part && part.trim().length > 0));

    const result = buildStatementPdf({
      orientation,
      header: {
        companyName: data.company.companyName,
        companyAddress: addressParts.join(', '),
        companyGstin: data.company.gstin ?? '',
        financialYear: data.financialYear.yearName,
        title: 'BANK RECONCILIATION REPORT',
        bankName: data.account.accountName,
        period: 'FROM: ' + toDisplayDate(data.fromDate) + ' TO: ' + toDisplayDate(data.toDate),
      },
      blocks,
    });

    const safeName =
      data.account.accountName
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'Bank';
    const filename =
      'BankReco_' +
      safeName +
      '_' +
      toDisplayDate(data.fromDate) +
      '_' +
      toDisplayDate(data.toDate) +
      '.pdf';

    return { buffer: result.buffer, filename, pageCount: result.pageCount };
  }
}

export const bankReconciliationService = new BankReconciliationService();