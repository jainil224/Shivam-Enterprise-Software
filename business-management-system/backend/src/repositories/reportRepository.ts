// Phase 15 - read-only report data access. All queries are scoped to one company + financial year.

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const partySelect = {
  id: true,
  partyName: true,
  partyCode: true,
  gstin: true,
  city: true,
  state: true,
  partyType: true,
} satisfies Prisma.PartySelect;

const purchaseBillInclude = {
  party: { select: partySelect },
  items: true,
} satisfies Prisma.PurchaseBillInclude;

const debitNoteInclude = {
  party: { select: partySelect },
  book: { select: { id: true, bookName: true, prefix: true } },
  itemLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemName: true, itemCategory: true } },
    },
  },
} satisfies Prisma.DebitNoteInclude;

export type PurchaseBillReportRecord = Prisma.PurchaseBillGetPayload<{ include: typeof purchaseBillInclude }>;
export type DebitNoteReportRecord = Prisma.DebitNoteGetPayload<{ include: typeof debitNoteInclude }>;

export class ReportRepository {
  async getFinancialYear(companyId: string, financialYearId: string) {
    return prisma.financialYear.findFirst({ where: { companyId, id: financialYearId } });
  }

  async getCompany(companyId: string) {
    return prisma.company.findUnique({ where: { id: companyId } });
  }

  async getBooks(companyId: string, financialYearId: string) {
    return prisma.debitNoteBook.findMany({
      where: { companyId, financialYearId, isActive: true },
      select: { id: true, bookName: true, prefix: true },
      orderBy: { bookName: 'asc' },
    });
  }

  async getParties(companyId: string) {
    return prisma.party.findMany({
      where: { companyId, isActive: true },
      select: partySelect,
      orderBy: { partyName: 'asc' },
    });
  }

  async getItems(companyId: string) {
    return prisma.item.findMany({
      where: { companyId },
      select: {
        id: true,
        itemCode: true,
        itemName: true,
        itemCategory: true,
        unit: true,
        hsnCode: true,
        gstRate: true,
      },
      orderBy: { itemName: 'asc' },
    });
  }

  async getYarnQualities(companyId: string) {
    return prisma.yarnQuality.findMany({
      where: { companyId, isActive: true },
      select: { id: true, qualityName: true },
      orderBy: { qualityName: 'asc' },
    });
  }

  async getPurchaseBills(
    companyId: string,
    financialYearId: string,
    dateFrom: Date,
    dateTo: Date,
    includeCancelled: boolean
  ): Promise<PurchaseBillReportRecord[]> {
    return prisma.purchaseBill.findMany({
      where: {
        companyId,
        financialYearId,
        billDate: { gte: dateFrom, lte: dateTo },
        ...(includeCancelled ? {} : { status: { not: 'CANCELLED' } }),
      },
      include: purchaseBillInclude,
      orderBy: [{ billDate: 'asc' }, { billNumber: 'asc' }],
    });
  }

  async getDebitNotes(
    companyId: string,
    financialYearId: string,
    dateFrom: Date,
    dateTo: Date,
    noteTypes: Array<'SALES' | 'PURCHASE' | 'BOTH'>,
    includeCancelled: boolean
  ): Promise<DebitNoteReportRecord[]> {
    if (noteTypes.length === 0) return [];
    return prisma.debitNote.findMany({
      where: {
        companyId,
        financialYearId,
        noteDate: { gte: dateFrom, lte: dateTo },
        noteType: { in: noteTypes },
        ...(includeCancelled ? {} : { status: { not: 'CANCELLED' } }),
      },
      include: debitNoteInclude,
      orderBy: [{ noteDate: 'asc' }, { noteNumber: 'asc' }],
    });
  }

  async getPurchaseBillById(companyId: string, id: string) {
    return prisma.purchaseBill.findFirst({ where: { id, companyId }, include: purchaseBillInclude });
  }

  async getDebitNoteById(companyId: string, id: string) {
    return prisma.debitNote.findFirst({ where: { id, companyId }, include: debitNoteInclude });
  }
}

export const reportRepository = new ReportRepository();
