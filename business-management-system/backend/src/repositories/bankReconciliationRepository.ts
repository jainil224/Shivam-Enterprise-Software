// Phase 16 - Bank Reconciliation data access.
// This repository only reads the real bank-side JournalLine rows produced by
// Phase 12 bank vouchers and Phase 14 debit notes. It never writes accounting
// data: reconciliation marks, opening balances and statement snapshots are
// separate metadata tables.

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export const bankPostingInclude = Prisma.validator<Prisma.JournalLineInclude>()({
  bankReconciliationMark: true,
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
      status: true,
      revision: true,
      party: { select: { id: true, partyName: true } },
      counterpartyLedger: { select: { id: true, accountName: true } },
    },
  },
  debitNote: {
    select: {
      id: true,
      noteNumber: true,
      noteDate: true,
      status: true,
      revision: true,
      party: { select: { id: true, partyName: true } },
      creditAccount: { select: { id: true, accountName: true } },
    },
  },
});

export type BankPostingLine = Prisma.JournalLineGetPayload<{ include: typeof bankPostingInclude }>;

export interface LedgerPostingTotals {
  ledgerAccountId: string;
  debitTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  transactionCount: number;
}

export class BankReconciliationRepository {
  getCompany(companyId: string) {
    return prisma.company.findUnique({ where: { id: companyId } });
  }

  getFinancialYear(companyId: string, financialYearId: string) {
    return prisma.financialYear.findFirst({ where: { id: financialYearId, companyId } });
  }

  getBankAccount(companyId: string, bankLedgerAccountId: string) {
    return prisma.ledgerAccount.findFirst({
      where: { id: bankLedgerAccountId, companyId, isBankAccount: true },
    });
  }

  listBankAccounts(companyId: string) {
    return prisma.ledgerAccount.findMany({
      where: { companyId, isBankAccount: true, isActive: true },
      orderBy: [{ accountCode: 'asc' }],
    });
  }

  async balanceTotals(
    companyId: string,
    financialYearId: string,
    ledgerAccountIds: string[]
  ): Promise<LedgerPostingTotals[]> {
    if (ledgerAccountIds.length === 0) return [];
    const grouped = await prisma.journalLine.groupBy({
      by: ['ledgerAccountId'],
      where: { companyId, financialYearId, ledgerAccountId: { in: ledgerAccountIds } },
      _sum: { debitAmount: true, creditAmount: true },
      _count: { _all: true },
    });
    return grouped.map((row) => ({
      ledgerAccountId: row.ledgerAccountId,
      debitTotal: row._sum.debitAmount ?? new Prisma.Decimal(0),
      creditTotal: row._sum.creditAmount ?? new Prisma.Decimal(0),
      transactionCount: row._count._all,
    }));
  }

  /**
   * Every journal line that touches the bank ledger up to and including `toDate`.
   * The service filters revisions and document status so that one source of truth
   * (current, non-reversal, posted lines) drives both the grid and the balances.
   */
  listPostingsThrough(
    companyId: string,
    financialYearId: string,
    bankLedgerAccountId: string,
    toDate: Date
  ): Promise<BankPostingLine[]> {
    return prisma.journalLine.findMany({
      where: {
        companyId,
        financialYearId,
        ledgerAccountId: bankLedgerAccountId,
        postingDate: { lte: toDate },
        OR: [{ voucherId: { not: null } }, { debitNoteId: { not: null } }],
      },
      include: bankPostingInclude,
      orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }],
    });
  }

  getPostingLine(
    companyId: string,
    financialYearId: string,
    journalLineId: string
  ): Promise<BankPostingLine | null> {
    return prisma.journalLine.findFirst({
      where: { id: journalLineId, companyId, financialYearId },
      include: bankPostingInclude,
    });
  }

  getOpening(companyId: string, financialYearId: string, bankLedgerAccountId: string) {
    return prisma.bankReconciliationOpening.findUnique({
      where: {
        companyId_financialYearId_bankLedgerAccountId: {
          companyId,
          financialYearId,
          bankLedgerAccountId,
        },
      },
    });
  }

  findMark(companyId: string, bankJournalLineId: string) {
    return prisma.bankReconciliationMark.findUnique({
      where: { companyId_bankJournalLineId: { companyId, bankJournalLineId } },
    });
  }

  latestStatement(
    companyId: string,
    financialYearId: string,
    bankLedgerAccountId: string,
    fromDate: Date,
    toDate: Date
  ) {
    return prisma.bankReconciliationStatement.findFirst({
      where: { companyId, financialYearId, bankLedgerAccountId, fromDate, toDate },
      orderBy: { createdAt: 'desc' },
    });
  }

  listStatements(
    companyId: string,
    financialYearId: string,
    bankLedgerAccountId: string,
    take = 20
  ) {
    return prisma.bankReconciliationStatement.findMany({
      where: { companyId, financialYearId, bankLedgerAccountId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(work);
  }
}

export const bankReconciliationRepository = new BankReconciliationRepository();