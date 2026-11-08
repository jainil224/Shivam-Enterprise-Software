import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DebitNoteBookRepository {
  async findAll(
    companyId: string,
    financialYearId: string,
    options?: { includeInactive?: boolean }
  ) {
    const where: Prisma.DebitNoteBookWhereInput = {
      companyId,
      financialYearId,
    };

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    return prisma.debitNoteBook.findMany({
      where,
      orderBy: { bookName: 'asc' },
    });
  }

  async findById(companyId: string, financialYearId: string, id: string) {
    return prisma.debitNoteBook.findFirst({
      where: {
        id,
        companyId,
        financialYearId,
      },
    });
  }

  async findByPrefix(companyId: string, financialYearId: string, prefix: string) {
    return prisma.debitNoteBook.findFirst({
      where: {
        companyId,
        financialYearId,
        prefix: prefix.trim().toUpperCase(),
      },
    });
  }

  async findByName(companyId: string, financialYearId: string, bookName: string) {
    return prisma.debitNoteBook.findFirst({
      where: {
        companyId,
        financialYearId,
        bookName: bookName.trim().toUpperCase(),
      },
    });
  }

  async create(
    companyId: string,
    financialYearId: string,
    data: {
      prefix: string;
      bookName: string;
      openingBalance?: number | string;
      balanceType?: 'DEBIT' | 'CREDIT';
      isActive?: boolean;
    }
  ) {
    return prisma.debitNoteBook.create({
      data: {
        companyId,
        financialYearId,
        prefix: data.prefix.trim().toUpperCase(),
        bookName: data.bookName.trim().toUpperCase(),
        openingBalance: new Prisma.Decimal(data.openingBalance || 0),
        balanceType: data.balanceType || 'CREDIT',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async ensureDefaultBook(companyId: string, financialYearId: string) {
    const existing = await prisma.debitNoteBook.findFirst({
      where: { companyId, financialYearId },
    });

    if (existing) {
      return existing;
    }

    return prisma.debitNoteBook.create({
      data: {
        companyId,
        financialYearId,
        prefix: 'DN-',
        bookName: 'DEBIT NOTE',
        openingBalance: new Prisma.Decimal(0),
        balanceType: 'CREDIT',
        isActive: true,
      },
    });
  }

  async getBookBalance(companyId: string, financialYearId: string, bookId: string) {
    const book = await this.findById(companyId, financialYearId, bookId);
    if (!book) return { balance: '0.00', balanceType: 'Cr' };

    // Aggregate confirmed debit notes in this book
    const agg = await prisma.debitNote.aggregate({
      where: {
        companyId,
        financialYearId,
        bookId,
        status: 'CONFIRMED',
      },
      _sum: {
        totalAmount: true,
      },
    });

    const notesTotal = agg._sum.totalAmount || new Prisma.Decimal(0);
    const opening = book.openingBalance || new Prisma.Decimal(0);

    // Book balance calculation: opening balance + notes created in this book
    const total = opening.plus(notesTotal);
    const balanceType = book.balanceType === 'DEBIT' ? 'Dr' : 'Cr';

    return {
      balance: total.toFixed(2),
      balanceType,
    };
  }
}

export const debitNoteBookRepository = new DebitNoteBookRepository();

