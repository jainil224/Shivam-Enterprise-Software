// Phase 17 - read-only data access for the Bank Book and Account Ledger.
// Only SELECT statements touch accounting tables. The single writable table is
// the additive saved-report preference table.

import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import {
  ledgerPostingInclude,
  type LedgerPostingLine,
} from '../utils/ledgerPosting.js';

const postingStatusInclude = Prisma.validator<Prisma.JournalLineSelect>()({
  ledgerAccountId: true,
  debitAmount: true,
  creditAmount: true,
  isReversal: true,
  revision: true,
  voucher: { select: { status: true, revision: true } },
  debitNote: { select: { status: true, revision: true } },
});

type PostingStatusRow = Prisma.JournalLineGetPayload<{ select: typeof postingStatusInclude }>;

export interface LedgerTotalsRow {
  ledgerAccountId: string;
  debitTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  transactionCount: number;
}

export interface SavedReportInput {
  companyId: string;
  financialYearId: string;
  reportName: string;
  bankLedgerAccountId: string;
  detailMode: 'DETAIL' | 'SUMMARY';
  reportType: string;
  filterField: string | null;
  filterText: string | null;
  partyGroupId: string | null;
  fromDate: Date | null;
  toDate: Date | null;
  columns: string[] | null;
  isDefault: boolean;
  createdBy: string | null;
}

export class LedgerReportRepository {
  getCompany(companyId: string) {
    return prisma.company.findUnique({ where: { id: companyId } });
  }

  getFinancialYear(companyId: string, financialYearId: string) {
    return prisma.financialYear.findFirst({ where: { id: financialYearId, companyId } });
  }

  getLedgerAccount(companyId: string, ledgerAccountId: string) {
    return prisma.ledgerAccount.findFirst({ where: { id: ledgerAccountId, companyId } });
  }
  /**
   * Selected ledger plus its linked party master. The print document reads the
   * GSTIN / PAN / phone / address straight from the stored party record; when a
   * ledger has no party (bank, cash, expense) those fields stay blank.
   */
  getLedgerAccountProfile(companyId: string, ledgerAccountId: string) {
    return prisma.ledgerAccount.findFirst({
      where: { id: ledgerAccountId, companyId },
      include: {
        party: {
          select: {
            partyName: true,
            phone: true,
            gstin: true,
            panNumber: true,
            city: true,
            state: true,
            pincode: true,
            address: true,
            partyGroup: { select: { groupName: true } },
          },
        },
      },
    });
  }

  listBankAccounts(companyId: string) {
    return prisma.ledgerAccount.findMany({
      where: { companyId, isBankAccount: true, isActive: true },
      orderBy: [{ accountCode: 'asc' }, { accountName: 'asc' }],
    });
  }

  /** All ledger accounts plus their party master record, for the lookup dialog. */
  listLedgerAccounts(companyId: string) {
    return prisma.ledgerAccount.findMany({
      where: { companyId },
      orderBy: [{ accountGroup: 'asc' }, { accountName: 'asc' }],
      include: {
        party: {
          select: {
            id: true,
            partyName: true,
            phone: true,
            gstin: true,
            panNumber: true,
            city: true,
            address: true,
            partyGroup: { select: { groupName: true } },
            area: { select: { areaName: true } },
          },
        },
      },
    });
  }

  listPartyGroups(companyId: string) {
    return prisma.partyGroup.findMany({
      where: { companyId },
      orderBy: [{ groupName: 'asc' }],
    });
  }

  /**
   * Every journal line touching the ledger up to `toDate`. Document status and
   * revision are filtered in the service so that exactly one source of truth
   * drives both the grid and every balance.
   */
  listPostingsThrough(
    companyId: string,
    financialYearId: string,
    ledgerAccountId: string,
    toDate: Date
  ): Promise<LedgerPostingLine[]> {
    return prisma.journalLine.findMany({
      where: {
        companyId,
        financialYearId,
        ledgerAccountId,
        postingDate: { lte: toDate },
        OR: [{ voucherId: { not: null } }, { debitNoteId: { not: null } }],
      },
      include: ledgerPostingInclude,
      orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }, { id: 'asc' }],
    });
  }

  /** Company-wide eligible posting totals, used for the ledger lookup balances. */
  async postingTotals(companyId: string, financialYearId: string): Promise<LedgerTotalsRow[]> {
    const rows: PostingStatusRow[] = await prisma.journalLine.findMany({
      where: {
        companyId,
        financialYearId,
        OR: [{ voucherId: { not: null } }, { debitNoteId: { not: null } }],
      },
      select: postingStatusInclude,
    });

    const totals = new Map<string, LedgerTotalsRow>();
    for (const row of rows) {
      if (row.isReversal) continue;
      const eligible = row.voucher
        ? row.voucher.status === 'POSTED' && row.voucher.revision === row.revision
        : row.debitNote
          ? row.debitNote.status === 'POSTED' && row.debitNote.revision === row.revision
          : false;
      if (!eligible) continue;
      const existing = totals.get(row.ledgerAccountId) ?? {
        ledgerAccountId: row.ledgerAccountId,
        debitTotal: new Prisma.Decimal(0),
        creditTotal: new Prisma.Decimal(0),
        transactionCount: 0,
      };
      existing.debitTotal = existing.debitTotal.plus(row.debitAmount);
      existing.creditTotal = existing.creditTotal.plus(row.creditAmount);
      existing.transactionCount += 1;
      totals.set(row.ledgerAccountId, existing);
    }
    return Array.from(totals.values());
  }

  listSavedReports(companyId: string, financialYearId: string) {
    return prisma.bankBookSavedReport.findMany({
      where: { companyId, financialYearId },
      orderBy: [{ isDefault: 'desc' }, { reportName: 'asc' }],
      include: { bankLedgerAccount: { select: { accountName: true } } },
    });
  }

  getSavedReport(companyId: string, id: string) {
    return prisma.bankBookSavedReport.findFirst({
      where: { id, companyId },
      include: { bankLedgerAccount: { select: { accountName: true } } },
    });
  }

  findSavedReportByName(companyId: string, reportName: string, excludeId?: string) {
    return prisma.bankBookSavedReport.findFirst({
      where: {
        companyId,
        reportName,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  createSavedReport(data: SavedReportInput) {
    return prisma.bankBookSavedReport.create({
      data: {
        companyId: data.companyId,
        financialYearId: data.financialYearId,
        reportName: data.reportName,
        bankLedgerAccountId: data.bankLedgerAccountId,
        detailMode: data.detailMode,
        reportType: data.reportType,
        filterField: data.filterField,
        filterText: data.filterText,
        partyGroupId: data.partyGroupId,
        fromDate: data.fromDate,
        toDate: data.toDate,
        columns: data.columns === null ? Prisma.JsonNull : data.columns,
        isDefault: data.isDefault,
        createdBy: data.createdBy,
      },
      include: { bankLedgerAccount: { select: { accountName: true } } },
    });
  }

  updateSavedReport(
    id: string,
    data: Partial<Omit<SavedReportInput, 'companyId' | 'financialYearId'>>,
    columns?: string[] | null
  ) {
    return prisma.bankBookSavedReport.update({
      where: { id },
      data: {
        ...(data.reportName === undefined ? {} : { reportName: data.reportName }),
        ...(data.bankLedgerAccountId === undefined
          ? {}
          : { bankLedgerAccountId: data.bankLedgerAccountId }),
        ...(data.detailMode === undefined ? {} : { detailMode: data.detailMode }),
        ...(data.reportType === undefined ? {} : { reportType: data.reportType }),
        ...(data.filterField === undefined ? {} : { filterField: data.filterField }),
        ...(data.filterText === undefined ? {} : { filterText: data.filterText }),
        ...(data.partyGroupId === undefined ? {} : { partyGroupId: data.partyGroupId }),
        ...(data.fromDate === undefined ? {} : { fromDate: data.fromDate }),
        ...(data.toDate === undefined ? {} : { toDate: data.toDate }),
        ...(columns === undefined
          ? {}
          : { columns: columns === null ? Prisma.JsonNull : columns }),
        ...(data.isDefault === undefined ? {} : { isDefault: data.isDefault }),
      },
      include: { bankLedgerAccount: { select: { accountName: true } } },
    });
  }

  deleteSavedReport(id: string) {
    return prisma.bankBookSavedReport.delete({ where: { id } });
  }

  clearDefaultSavedReports(companyId: string, financialYearId: string, exceptId?: string) {
    return prisma.bankBookSavedReport.updateMany({
      where: {
        companyId,
        financialYearId,
        isDefault: true,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(work);
  }
}

export const ledgerReportRepository = new LedgerReportRepository();