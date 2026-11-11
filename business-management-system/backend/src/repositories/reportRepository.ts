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
  partyGroupId: true,
  areaId: true,
  partyGroup: { select: { id: true, groupName: true } },
  area: { select: { id: true, areaName: true } },
} satisfies Prisma.PartySelect;

const purchaseBillInclude = {
  party: { select: partySelect },
  deliveryParty: { select: { id: true, partyName: true } },
  book: { select: { id: true, bookName: true, prefix: true } },
  broker: { select: { id: true, brokerName: true } },
  transporter: { select: { id: true, transporterName: true } },
  salesperson: { select: { id: true, salespersonName: true } },
  items: {
    include: {
      item: {
        select: {
          id: true,
          itemCode: true,
          itemName: true,
          itemCategory: true,
          itemGroup: { select: { id: true, groupName: true } },
        },
      },
      yarnQuality: { select: { id: true, qualityName: true } },
      yarnGrade: { select: { id: true, gradeName: true } },
    },
  },
} satisfies Prisma.PurchaseBillInclude;

const debitNoteInclude = {
  party: { select: partySelect },
  book: { select: { id: true, bookName: true, prefix: true } },
  broker: { select: { id: true, brokerName: true } },
  transporter: { select: { id: true, transporterName: true } },
  salesperson: { select: { id: true, salespersonName: true } },
  itemLines: {
    include: {
      item: {
        select: {
          id: true,
          itemCode: true,
          itemName: true,
          itemCategory: true,
          itemGroup: { select: { id: true, groupName: true } },
        },
      },
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
    // Phase 15.2 - a Book filter must cover every book type that can own a
    // report row: Purchase Book for bills, Debit Note Book for notes.
    const [purchaseBooks, noteBooks] = await Promise.all([
      prisma.purchaseBook.findMany({
        where: { companyId, financialYearId, isActive: true },
        select: { id: true, bookName: true, prefix: true },
        orderBy: { bookName: 'asc' },
      }),
      prisma.debitNoteBook.findMany({
        where: { companyId, financialYearId, isActive: true },
        select: { id: true, bookName: true, prefix: true },
        orderBy: { bookName: 'asc' },
      }),
    ]);
    return [
      ...purchaseBooks.map((book) => ({ ...book, bookType: 'Purchase Book' as const })),
      ...noteBooks.map((book) => ({ ...book, bookType: 'Debit Note Book' as const })),
    ];
  }

  async getPartyGroups(companyId: string) {
    return prisma.partyGroup.findMany({
      where: { companyId, isActive: true },
      select: { id: true, groupName: true },
      orderBy: { groupName: 'asc' },
    });
  }

  async getAreas(companyId: string) {
    return prisma.area.findMany({
      where: { companyId, isActive: true },
      select: { id: true, areaName: true },
      orderBy: { areaName: 'asc' },
    });
  }

  async getBrokers(companyId: string) {
    return prisma.broker.findMany({
      where: { companyId, isActive: true },
      select: { id: true, brokerCode: true, brokerName: true },
      orderBy: { brokerName: 'asc' },
    });
  }

  async getTransporters(companyId: string) {
    return prisma.transporter.findMany({
      where: { companyId, isActive: true },
      select: { id: true, transporterCode: true, transporterName: true },
      orderBy: { transporterName: 'asc' },
    });
  }

  async getSalespersons(companyId: string) {
    return prisma.salesperson.findMany({
      where: { companyId, isActive: true },
      select: { id: true, salespersonCode: true, salespersonName: true },
      orderBy: { salespersonName: 'asc' },
    });
  }

  async getItemGroupOptions(companyId: string) {
    const [groups, categories] = await Promise.all([
      prisma.itemGroup.findMany({
        where: { companyId, isActive: true },
        select: { id: true, groupName: true },
        orderBy: { groupName: 'asc' },
      }),
      prisma.item.findMany({
        where: { companyId, itemCategory: { not: null } },
        select: { itemCategory: true },
        distinct: ['itemCategory'],
        orderBy: { itemCategory: 'asc' },
      }),
    ]);
    const names = new Set(groups.map((group) => group.groupName.trim().toLowerCase()));
    return [
      ...groups.map((group) => ({ value: group.groupName, label: group.groupName, meta: 'Item Group master' })),
      ...categories
        .map((entry) => (entry.itemCategory ?? '').trim())
        .filter((value) => value.length > 0 && !names.has(value.toLowerCase()))
        .map((value) => ({ value, label: value, meta: 'Item category' })),
    ].sort((a, b) => a.label.localeCompare(b.label));
  }

  async getVehicleOptions(companyId: string, financialYearId: string): Promise<string[]> {
    const [billVehicles, noteVehicles] = await Promise.all([
      prisma.purchaseBill.findMany({
        where: { companyId, financialYearId, vehicleNumber: { not: null } },
        select: { vehicleNumber: true },
        distinct: ['vehicleNumber'],
      }),
      prisma.debitNote.findMany({
        where: { companyId, financialYearId, vehicleNumber: { not: null } },
        select: { vehicleNumber: true },
        distinct: ['vehicleNumber'],
      }),
    ]);
    return Array.from(
      new Set(
        [...billVehicles, ...noteVehicles]
          .map((entry) => (entry.vehicleNumber ?? '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));
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

  // Phase 15.1 - genuine item descriptions stored on purchase bill lines.
  // The Item Master is optional, so the filter must not depend on it.
  async getPurchaseBillItemDescriptions(
    companyId: string,
    financialYearId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<string[]> {
    // Only values that the report can actually return are offered: inside the
    // active financial year (id and date window), and never a cancelled
    // document, which the report excludes by default.
    const rows = await prisma.purchaseBillItem.findMany({
      where: {
        purchaseBill: {
          companyId,
          ...(financialYearId ? { financialYearId } : {}),
          ...(dateFrom && dateTo ? { billDate: { gte: dateFrom, lte: dateTo } } : {}),
          status: { not: 'CANCELLED' },
        },
        itemDescription: { not: '' },
      },
      select: { itemDescription: true },
      distinct: ['itemDescription'],
      orderBy: { itemDescription: 'asc' },
    });
    return rows.map((row) => row.itemDescription.trim()).filter((value) => value.length > 0);
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
    includeCancelled: boolean,
    itemName?: string | null
  ): Promise<PurchaseBillReportRecord[]> {
    const item = (itemName ?? '').trim();
    return prisma.purchaseBill.findMany({
      where: {
        companyId,
        financialYearId,
        billDate: { gte: dateFrom, lte: dateTo },
        ...(includeCancelled ? {} : { status: { not: 'CANCELLED' } }),
        ...(item.length > 0
          ? { items: { some: { itemDescription: { equals: item, mode: 'insensitive' as const } } } }
          : {}),
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
    includeCancelled: boolean,
    itemName?: string | null
  ): Promise<DebitNoteReportRecord[]> {
    if (noteTypes.length === 0) return [];
    const item = (itemName ?? '').trim();
    return prisma.debitNote.findMany({
      where: {
        companyId,
        financialYearId,
        noteDate: { gte: dateFrom, lte: dateTo },
        noteType: { in: noteTypes },
        ...(includeCancelled ? {} : { status: { not: 'CANCELLED' } }),
        ...(item.length > 0
          ? { itemLines: { some: { itemName: { equals: item, mode: 'insensitive' as const } } } }
          : {}),
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
