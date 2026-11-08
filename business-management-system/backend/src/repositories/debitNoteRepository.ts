import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type DebitNoteReasonValue =
  | 'CASH_DISCOUNT'
  | 'QUANTITY_DISCOUNT'
  | 'RATE_DIFFERENCE'
  | 'INTEREST'
  | 'TCS';

export interface DebitNoteFilters {
  page?: number;
  limit?: number;
  search?: string;
  bookId?: string;
  partyId?: string;
  noteType?: 'SALES' | 'PURCHASE' | 'BOTH';
  reason?: DebitNoteReasonValue;
  status?: 'DRAFT' | 'CONFIRMED' | 'POSTED' | 'CANCELLED';
  creditAccountId?: string;
  startDate?: string;
  endDate?: string;
}

export interface DebitNoteBillLineData {
  lineNumber: number;
  billNo: string;
  billDate: Date;
  totalDays: number;
  dharaDays: number;
  interestDays: number;
  paidAmount: Prisma.Decimal;
  paidDate?: Date | null;
  itemDescription?: string | null;
  quantity: Prisma.Decimal;
  billTaxable: Prisma.Decimal;
  billAmount: Prisma.Decimal;
  unpaidAmount: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  rate: Prisma.Decimal;
  basicAmount: Prisma.Decimal;
  sourceBillId?: string | null;
  sourceBillType?: string | null;
}

export interface DebitNoteHeaderData {
  companyId: string;
  financialYearId: string;
  bookId: string;
  voucherNumber: number;
  noteNumber: string;
  noteDate: Date;
  partyNoteNo?: string | null;
  noteType: 'SALES' | 'PURCHASE' | 'BOTH';
  partyId: string;
  dueDays: number;
  creditAccountId: string;
  osEffect: string;
  reason: DebitNoteReasonValue;
  calculationBasis: 'BILL_AMOUNT' | 'TAXABLE_AMOUNT' | 'BASIC_AMOUNT';
  gstRate: Prisma.Decimal;
  tdsRate: Prisma.Decimal;
  tdsAmount: Prisma.Decimal;
  tdsSection?: string | null;
  tdsAccount?: string | null;
  remark?: string | null;
  basicAmount: Prisma.Decimal;
  taxableValue: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  tcsAmount: Prisma.Decimal;
  roundOff: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  revision?: number;
  postedAt?: Date | null;
}

const NOTE_INCLUDE = {
  book: true,
  party: true,
  creditAccount: true,
  billLines: {
    orderBy: { lineNumber: 'asc' as const },
  },
};

export class DebitNoteRepository {
  /**
   * Concurrency-safe book-scoped voucher number.
   * The book row is locked for the duration of the transaction so two concurrent
   * saves can never read the same maximum voucher number.
   */
  async getNextVoucherNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    bookId: string
  ): Promise<number> {
    await tx.$queryRaw`SELECT "id" FROM "debit_note_books" WHERE "id" = ${bookId} FOR UPDATE`;

    const highest = await tx.debitNote.findFirst({
      where: { companyId, financialYearId, bookId },
      orderBy: { voucherNumber: 'desc' },
      select: { voucherNumber: true },
    });

    return (highest?.voucherNumber || 0) + 1;
  }

  async peekVoucherNumber(companyId: string, financialYearId: string, bookId: string): Promise<number> {
    const highest = await prisma.debitNote.findFirst({
      where: { companyId, financialYearId, bookId },
      orderBy: { voucherNumber: 'desc' },
      select: { voucherNumber: true },
    });
    return (highest?.voucherNumber || 0) + 1;
  }

  async create(tx: Prisma.TransactionClient, data: DebitNoteHeaderData & { billLines: DebitNoteBillLineData[] }) {
    const { billLines, ...headerData } = data;

    return tx.debitNote.create({
      data: {
        ...headerData,
        status: 'CONFIRMED',
        billLines: {
          create: billLines.map((line) => ({ ...line })),
        },
      },
      include: NOTE_INCLUDE,
    });
  }

  async update(
    tx: Prisma.TransactionClient,
    id: string,
    data: Omit<DebitNoteHeaderData, 'companyId' | 'financialYearId' | 'bookId' | 'voucherNumber' | 'noteNumber'> & {
      billLines: DebitNoteBillLineData[];
    }
  ) {
    const { billLines, ...headerData } = data;

    await tx.debitNoteBillLine.deleteMany({ where: { debitNoteId: id } });

    return tx.debitNote.update({
      where: { id },
      data: {
        ...headerData,
        billLines: {
          create: billLines.map((line) => ({ ...line })),
        },
      },
      include: NOTE_INCLUDE,
    });
  }

  async findById(companyId: string, financialYearId: string, id: string) {
    return prisma.debitNote.findFirst({
      where: { id, companyId, financialYearId },
      include: {
        ...NOTE_INCLUDE,
        journalLines: {
          include: { ledgerAccount: true },
          orderBy: [{ revision: 'asc' }, { lineNumber: 'asc' }],
        },
      },
    });
  }

  async findByNoteNumber(companyId: string, financialYearId: string, noteNumber: string) {
    return prisma.debitNote.findFirst({
      where: { companyId, financialYearId, noteNumber: noteNumber.trim().toUpperCase() },
      include: NOTE_INCLUDE,
    });
  }

  async findPaginated(companyId: string, financialYearId: string, filters: DebitNoteFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.DebitNoteWhereInput = { companyId, financialYearId };

    if (filters.bookId) where.bookId = filters.bookId;
    if (filters.partyId) where.partyId = filters.partyId;
    if (filters.noteType) where.noteType = filters.noteType;
    if (filters.reason) where.reason = filters.reason;
    if (filters.status) where.status = filters.status;
    if (filters.creditAccountId) where.creditAccountId = filters.creditAccountId;
    if (filters.startDate || filters.endDate) {
      where.noteDate = {};
      if (filters.startDate) where.noteDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.noteDate.lte = new Date(filters.endDate);
    }
    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { noteNumber: { contains: s, mode: 'insensitive' } },
        { partyNoteNo: { contains: s, mode: 'insensitive' } },
        { party: { partyName: { contains: s, mode: 'insensitive' } } },
        { party: { partyCode: { contains: s, mode: 'insensitive' } } },
        { remark: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.debitNote.count({ where }),
      prisma.debitNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ noteDate: 'desc' }, { voucherNumber: 'desc' }],
        include: {
          book: true,
          party: {
            select: {
              id: true,
              partyName: true,
              partyCode: true,
              partyType: true,
              gstin: true,
              city: true,
            },
          },
          creditAccount: {
            select: { id: true, accountName: true, accountCode: true },
          },
          _count: { select: { billLines: true } },
        },
      }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findPreviousAndNext(
    companyId: string,
    financialYearId: string,
    bookId: string,
    currentVoucherNumber: number
  ) {
    const [previous, next] = await Promise.all([
      prisma.debitNote.findFirst({
        where: { companyId, financialYearId, bookId, voucherNumber: { lt: currentVoucherNumber } },
        orderBy: { voucherNumber: 'desc' },
        select: { id: true, noteNumber: true, voucherNumber: true },
      }),
      prisma.debitNote.findFirst({
        where: { companyId, financialYearId, bookId, voucherNumber: { gt: currentVoucherNumber } },
        orderBy: { voucherNumber: 'asc' },
        select: { id: true, noteNumber: true, voucherNumber: true },
      }),
    ]);

    return { previous: previous || null, next: next || null };
  }

  async findPrintRange(
    companyId: string,
    financialYearId: string,
    options: { bookId?: string; from: number; to: number; partyId?: string }
  ) {
    return prisma.debitNote.findMany({
      where: {
        companyId,
        financialYearId,
        status: { not: 'CANCELLED' },
        voucherNumber: { gte: options.from, lte: options.to },
        ...(options.bookId ? { bookId: options.bookId } : {}),
        ...(options.partyId ? { partyId: options.partyId } : {}),
      },
      orderBy: { voucherNumber: 'asc' },
      include: NOTE_INCLUDE,
    });
  }

  async getSummary(companyId: string, financialYearId: string) {
    const [agg, cancelled, byType] = await Promise.all([
      prisma.debitNote.aggregate({
        where: { companyId, financialYearId, status: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { totalAmount: true, taxableValue: true, cgstAmount: true, sgstAmount: true, igstAmount: true },
      }),
      prisma.debitNote.aggregate({
        where: { companyId, financialYearId, status: 'CANCELLED' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.debitNote.groupBy({
        by: ['noteType'],
        where: { companyId, financialYearId, status: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
    ]);

    return { active: agg, cancelled, byType };
  }

  async cancel(tx: Prisma.TransactionClient, id: string, cancellationReason: string) {
    return tx.debitNote.update({
      where: { id },
      data: { status: 'CANCELLED', cancellationReason, cancelledAt: new Date() },
    });
  }

  async insertJournalLines(tx: Prisma.TransactionClient, lines: Prisma.JournalLineCreateManyInput[]) {
    if (lines.length === 0) return;
    return tx.journalLine.createMany({ data: lines });
  }

  async getLatestRevision(tx: Prisma.TransactionClient, debitNoteId: string): Promise<number> {
    const line = await tx.journalLine.findFirst({
      where: { debitNoteId },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });
    return line?.revision || 0;
  }

  async getNetPostingsByLedger(
    tx: Prisma.TransactionClient,
    debitNoteId: string
  ): Promise<Array<{ ledgerAccountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal }>> {
    const lines = await tx.journalLine.findMany({ where: { debitNoteId } });

    const map = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    for (const l of lines) {
      const entry = map.get(l.ledgerAccountId) || {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      entry.debit = entry.debit.plus(l.debitAmount);
      entry.credit = entry.credit.plus(l.creditAmount);
      map.set(l.ledgerAccountId, entry);
    }

    return Array.from(map.entries()).map(([ledgerAccountId, amounts]) => ({
      ledgerAccountId,
      debit: amounts.debit,
      credit: amounts.credit,
    }));
  }

  /** Sum of every non-cancelled note amount already taken against a source bill. */
  async sumAdjustedForSourceBill(
    companyId: string,
    sourceBillId: string,
    excludeDebitNoteId?: string
  ): Promise<Prisma.Decimal> {
    const rows = await prisma.debitNoteBillLine.findMany({
      where: {
        sourceBillId,
        debitNote: {
          companyId,
          status: { not: 'CANCELLED' },
          ...(excludeDebitNoteId ? { id: { not: excludeDebitNoteId } } : {}),
        },
      },
      select: { basicAmount: true },
    });

    return rows.reduce((sum, row) => sum.plus(row.basicAmount), new Prisma.Decimal(0));
  }

  async getPartyLedgerBalance(companyId: string, partyId: string) {
    const ledger = await prisma.ledgerAccount.findFirst({ where: { companyId, partyId } });
    if (!ledger) {
      return { ledgerId: null, balance: '0.00', balanceType: 'Dr' as const };
    }

    const agg = await prisma.journalLine.aggregate({
      where: { companyId, ledgerAccountId: ledger.id },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const opening = new Prisma.Decimal(ledger.openingBalance);
    const openingSigned = ledger.balanceType === 'DEBIT' ? opening : opening.negated();
    const net = openingSigned
      .plus(agg._sum.debitAmount || new Prisma.Decimal(0))
      .minus(agg._sum.creditAmount || new Prisma.Decimal(0));

    return {
      ledgerId: ledger.id,
      balance: net.abs().toFixed(2),
      balanceType: net.greaterThanOrEqualTo(0) ? ('Dr' as const) : ('Cr' as const),
    };
  }
}

export const debitNoteRepository = new DebitNoteRepository();