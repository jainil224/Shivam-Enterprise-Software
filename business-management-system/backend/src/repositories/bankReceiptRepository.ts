// Phase 18 - data access for Bank Receipt Entry (Cheque Receipt).
// Read queries never mutate accounting data. Writes are only executed inside a
// service-owned transaction so the header, rows, allocations, adjustments and
// JournalLine postings commit atomically.

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export const BOOK_INCLUDE = {
  bankAccountLedger: {
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountGroup: true,
      bankName: true,
      branchName: true,
      bankAccountNumber: true,
      isBankAccount: true,
      isActive: true,
      openingBalance: true,
      balanceType: true,
    },
  },
} satisfies Prisma.BankReceiptBookInclude;

export type BookWithLedger = Prisma.BankReceiptBookGetPayload<{ include: typeof BOOK_INCLUDE }>;

export const LINE_INCLUDE = {
  party: {
    select: {
      id: true,
      partyName: true,
      partyCode: true,
      partyType: true,
      address: true,
      city: true,
      state: true,
      gstin: true,
      phone: true,
    },
  },
  bankInstrument: { select: { id: true, code: true, description: true, isActive: true } },
  partyLedgerAccount: {
    select: { id: true, accountCode: true, accountName: true, accountGroup: true },
  },
  allocations: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      purchaseBill: {
        select: { id: true, billNumber: true, billDate: true, totalAmount: true, status: true },
      },
      adjustments: { orderBy: { createdAt: 'asc' as const } },
    },
  },
  adjustments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.BankVoucherLineInclude;

export type LineWithDetail = Prisma.BankVoucherLineGetPayload<{ include: typeof LINE_INCLUDE }>;

export interface BillAllocationRow {
  purchaseBillId: string;
  billNumber: string;
  billDate: Date;
  bookName: string | null;
  billAmount: Prisma.Decimal;
  billTds: Prisma.Decimal;
  previousReceived: Prisma.Decimal;
  allocatedAmount: Prisma.Decimal;
  balance: Prisma.Decimal;
}

export class BankReceiptRepository {
  // ---------------------------------------------------------------- books ---
  async listBooks(companyId: string, financialYearId: string): Promise<BookWithLedger[]> {
    return prisma.bankReceiptBook.findMany({
      where: { companyId, financialYearId },
      include: BOOK_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { bookName: 'asc' }],
    });
  }

  async findBook(
    companyId: string,
    financialYearId: string,
    id: string
  ): Promise<BookWithLedger | null> {
    return prisma.bankReceiptBook.findFirst({
      where: { id, companyId, financialYearId },
      include: BOOK_INCLUDE,
    });
  }

  async findBookByName(
    companyId: string,
    financialYearId: string,
    bookName: string,
    excludeId?: string
  ) {
    return prisma.bankReceiptBook.findFirst({
      where: {
        companyId,
        financialYearId,
        bookName: { equals: bookName, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, bookName: true },
    });
  }

  async findBookByPrefix(
    companyId: string,
    financialYearId: string,
    prefix: string,
    excludeId?: string
  ) {
    return prisma.bankReceiptBook.findFirst({
      where: {
        companyId,
        financialYearId,
        prefix: { equals: prefix, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, prefix: true },
    });
  }

  async createBook(data: Prisma.BankReceiptBookUncheckedCreateInput): Promise<BookWithLedger> {
    return prisma.bankReceiptBook.create({ data, include: BOOK_INCLUDE });
  }

  async updateBook(
    id: string,
    data: Prisma.BankReceiptBookUncheckedUpdateInput
  ): Promise<BookWithLedger> {
    return prisma.bankReceiptBook.update({ where: { id }, data, include: BOOK_INCLUDE });
  }

  async countVouchersInBook(companyId: string, bookId: string): Promise<number> {
    return prisma.bankVoucher.count({ where: { companyId, bankReceiptBookId: bookId } });
  }

  // ------------------------------------------------------------ instruments ---
  async listInstruments(companyId: string, search?: string, includeInactive = false) {
    const where: Prisma.BankInstrumentMasterWhereInput = { companyId };
    if (!includeInactive) where.isActive = true;
    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.bankInstrumentMaster.findMany({
      where,
      orderBy: [{ code: 'asc' }],
    });
  }

  async findInstrument(companyId: string, id: string) {
    return prisma.bankInstrumentMaster.findFirst({ where: { id, companyId } });
  }

  async findInstrumentByCode(companyId: string, code: string) {
    return prisma.bankInstrumentMaster.findFirst({
      where: { companyId, code: { equals: code, mode: 'insensitive' } },
    });
  }

  async createInstrument(data: Prisma.BankInstrumentMasterUncheckedCreateInput) {
    return prisma.bankInstrumentMaster.create({ data });
  }

  // ----------------------------------------------------------------- parties ---
  async findParty(companyId: string, partyId: string) {
    return prisma.party.findFirst({
      where: { id: partyId, companyId },
      include: {
        partyGroup: { select: { id: true, groupName: true } },
        area: { select: { id: true, areaName: true } },
      },
    });
  }

  async searchParties(companyId: string, search: string, limit: number) {
    const where: Prisma.PartyWhereInput = { companyId, isActive: true };
    if (search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { partyName: { contains: term, mode: 'insensitive' } },
        { partyCode: { contains: term, mode: 'insensitive' } },
        { gstin: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.party.findMany({
      where,
      take: limit,
      orderBy: { partyName: 'asc' },
      select: {
        id: true,
        partyName: true,
        partyCode: true,
        partyType: true,
        gstin: true,
        panNumber: true,
        address: true,
        city: true,
        state: true,
        phone: true,
        partyGroup: { select: { id: true, groupName: true } },
      },
    });
  }

  async partyLedgerMap(companyId: string, partyIds: string[]) {
    if (partyIds.length === 0) return new Map<string, string>();
    const rows = await prisma.ledgerAccount.findMany({
      where: { companyId, partyId: { in: partyIds } },
      select: { id: true, partyId: true },
    });
    return new Map(rows.map((row) => [row.partyId as string, row.id]));
  }

  // -------------------------------------------------------- adjustment heads ---
  async searchAdjustmentAccounts(companyId: string, search: string, limit: number) {
    const where: Prisma.LedgerAccountWhereInput = {
      companyId,
      isActive: true,
      isBankAccount: false,
      accountGroup: {
        in: ['DIRECT_EXPENSES', 'INDIRECT_EXPENSES', 'DIRECT_INCOME', 'INDIRECT_INCOME', 'OTHERS'],
      },
    };
    if (search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { accountName: { contains: term, mode: 'insensitive' } },
        { accountCode: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.ledgerAccount.findMany({
      where,
      take: limit,
      orderBy: { accountName: 'asc' },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountGroup: true,
        openingBalance: true,
        balanceType: true,
        party: { select: { id: true, partyName: true, address: true } },
      },
    });
  }

  async findAdjustmentAccount(companyId: string, id: string) {
    return prisma.ledgerAccount.findFirst({ where: { id, companyId } });
  }

  // ------------------------------------------------------------ outstanding ---
  async purchaseBillsForParty(companyId: string, partyId: string, search?: string) {
    const where: Prisma.PurchaseBillWhereInput = {
      companyId,
      partyId,
      status: 'CONFIRMED',
    };
    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { billNumber: { contains: term, mode: 'insensitive' } },
        { supplierInvoiceNumber: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.purchaseBill.findMany({
      where,
      orderBy: [{ billDate: 'asc' }, { billNumber: 'asc' }],
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        totalAmount: true,
        status: true,
        book: { select: { id: true, bookName: true } },
        items: { select: { id: true } },
      },
    });
  }

  /**
   * Sums every ACTIVE allocation for the given bills, excluding the voucher
   * being edited so its own previous revision is never counted twice.
   */
  async allocationTotals(
    client: Prisma.TransactionClient | PrismaClient,
    companyId: string,
    billIds: string[],
    excludeVoucherId?: string
  ) {
    if (billIds.length === 0) return new Map<string, Prisma.Decimal>();
    const rows = await client.bankReceiptBillAllocation.groupBy({
      by: ['purchaseBillId'],
      where: {
        companyId,
        purchaseBillId: { in: billIds },
        status: 'ACTIVE',
        ...(excludeVoucherId
          ? { bankVoucherLine: { bankVoucherId: { not: excludeVoucherId } } }
          : {}),
      },
      _sum: { allocatedAmount: true },
    });
    return new Map(rows.map((row) => [row.purchaseBillId, row._sum.allocatedAmount ?? new Prisma.Decimal(0)]));
  }

  /**
   * Net reduction already posted by Journal Voucher Auto adjustments linked to
   * the given bills. A DR adjustment (discount) reduces the bill, a CR
   * adjustment (interest) increases it, so the returned value is DR - CR.
   */
  async adjustmentReductionTotals(
    client: Prisma.TransactionClient | PrismaClient,
    companyId: string,
    billIds: string[],
    excludeVoucherId?: string
  ) {
    if (billIds.length === 0) return new Map<string, Prisma.Decimal>();
    const rows = await client.bankReceiptAdjustmentLine.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        allocation: { is: { purchaseBillId: { in: billIds }, status: 'ACTIVE' } },
        ...(excludeVoucherId
          ? { bankVoucherLine: { bankVoucherId: { not: excludeVoucherId } } }
          : {}),
      },
      select: {
        adjustmentAmount: true,
        drCr: true,
        allocation: { select: { purchaseBillId: true } },
      },
    });
    const totals = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const billId = row.allocation?.purchaseBillId;
      if (!billId) continue;
      const current = totals.get(billId) ?? new Prisma.Decimal(0);
      const delta =
        row.drCr === 'DR' ? row.adjustmentAmount : row.adjustmentAmount.negated();
      totals.set(billId, current.plus(delta));
    }
    return totals;
  }

  async lockPurchaseBills(tx: Prisma.TransactionClient, billIds: string[]): Promise<void> {
    if (billIds.length === 0) return;
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "purchase_bills"
      WHERE "id" IN (${Prisma.join(billIds)})
      FOR UPDATE
    `);
  }

  // -------------------------------------------------------------- vouchers ---
  async nextSequence(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ last_number: number }>>(Prisma.sql`
      INSERT INTO "voucher_sequences"
        ("id", "company_id", "financial_year_id", "voucher_type", "last_number", "updated_at")
      VALUES
        (gen_random_uuid()::text, ${companyId}, ${financialYearId}, 'RECEIPT'::"BankVoucherType", 1, NOW())
      ON CONFLICT ("company_id", "financial_year_id", "voucher_type")
      DO UPDATE SET
        "last_number" = "voucher_sequences"."last_number" + 1,
        "updated_at" = NOW()
      RETURNING "last_number"
    `);
    return rows[0].last_number;
  }

  async lockVoucher(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    id: string
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "bank_vouchers"
      WHERE "id" = ${id}
        AND "company_id" = ${companyId}
        AND "financial_year_id" = ${financialYearId}
        AND "voucher_type" = 'RECEIPT'::"BankVoucherType"
      FOR UPDATE
    `);
    if (rows.length === 0) {
      throw new Error('Receipt voucher not found for the active company and financial year.');
    }
  }

  async findVoucherHeader(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    id: string
  ) {
    return tx.bankVoucher.findFirst({
      where: { id, companyId, financialYearId, voucherType: 'RECEIPT' },
    });
  }

  async activeLines(
    tx: Prisma.TransactionClient,
    voucherId: string,
    revision: number
  ): Promise<LineWithDetail[]> {
    return tx.bankVoucherLine.findMany({
      where: { bankVoucherId: voucherId, revision },
      include: LINE_INCLUDE,
      orderBy: { rowNumber: 'asc' },
    });
  }

  async currentLineCount(tx: Prisma.TransactionClient, voucherId: string, revision: number) {
    return tx.bankVoucherLine.count({ where: { bankVoucherId: voucherId, revision } });
  }

  async hasLines(client: Prisma.TransactionClient | PrismaClient, voucherId: string) {
    return client.bankVoucherLine.count({ where: { bankVoucherId: voucherId } });
  }

  async createLine(
    tx: Prisma.TransactionClient,
    data: Prisma.BankVoucherLineUncheckedCreateInput
  ): Promise<{ id: string }> {
    return tx.bankVoucherLine.create({ data, select: { id: true } });
  }

  async createAllocation(
    tx: Prisma.TransactionClient,
    data: Prisma.BankReceiptBillAllocationUncheckedCreateInput
  ): Promise<{ id: string }> {
    return tx.bankReceiptBillAllocation.create({ data, select: { id: true } });
  }

  async createAdjustment(
    tx: Prisma.TransactionClient,
    data: Prisma.BankReceiptAdjustmentLineUncheckedCreateInput
  ): Promise<void> {
    await tx.bankReceiptAdjustmentLine.create({ data });
  }

  /** Marks every ACTIVE allocation/adjustment of a voucher as REVERSED. */
  async reverseActiveAllocations(
    tx: Prisma.TransactionClient,
    voucherId: string,
    reason: string
  ): Promise<void> {
    const lines = await tx.bankVoucherLine.findMany({
      where: { bankVoucherId: voucherId },
      select: { id: true },
    });
    if (lines.length === 0) return;
    const lineIds = lines.map((line) => line.id);

    await tx.bankReceiptAdjustmentLine.updateMany({
      where: { bankVoucherLineId: { in: lineIds }, status: 'ACTIVE' },
      data: { status: 'REVERSED', note: reason },
    });
    await tx.bankReceiptBillAllocation.updateMany({
      where: { bankVoucherLineId: { in: lineIds }, status: 'ACTIVE' },
      data: { status: 'REVERSED' },
    });
  }

  async insertJournalLines(
    tx: Prisma.TransactionClient,
    lines: Prisma.JournalLineCreateManyInput[]
  ): Promise<void> {
    if (lines.length === 0) return;
    await tx.journalLine.createMany({ data: lines });
  }

  async maxLineNumber(tx: Prisma.TransactionClient, voucherId: string): Promise<number> {
    const result = await tx.journalLine.aggregate({
      where: { voucherId },
      _max: { lineNumber: true },
    });
    return result._max.lineNumber ?? 0;
  }

  async netByLedger(tx: Prisma.TransactionClient, voucherId: string) {
    const grouped = await tx.journalLine.groupBy({
      by: ['ledgerAccountId'],
      where: { voucherId },
      _sum: { debitAmount: true, creditAmount: true },
    });
    return grouped.map((row) => ({
      ledgerAccountId: row.ledgerAccountId,
      debit: row._sum.debitAmount ?? new Prisma.Decimal(0),
      credit: row._sum.creditAmount ?? new Prisma.Decimal(0),
    }));
  }

  async voucherTotals(client: Prisma.TransactionClient | PrismaClient, voucherId: string) {
    const aggregate = await client.journalLine.aggregate({
      where: { voucherId },
      _sum: { debitAmount: true, creditAmount: true },
    });
    return {
      debit: aggregate._sum.debitAmount ?? new Prisma.Decimal(0),
      credit: aggregate._sum.creditAmount ?? new Prisma.Decimal(0),
    };
  }

  // ---------------------------------------------------------- balances etc. ---
  async ledgerSignedBalances(
    companyId: string,
    financialYearId: string,
    ledgerIds: string[]
  ): Promise<Map<string, Prisma.Decimal>> {
    if (ledgerIds.length === 0) return new Map();
    const [accounts, grouped] = await Promise.all([
      prisma.ledgerAccount.findMany({
        where: { companyId, id: { in: ledgerIds } },
        select: { id: true, openingBalance: true, balanceType: true },
      }),
      prisma.journalLine.groupBy({
        by: ['ledgerAccountId'],
        where: { companyId, financialYearId, ledgerAccountId: { in: ledgerIds } },
        _sum: { debitAmount: true, creditAmount: true },
      }),
    ]);

    const postings = new Map(
      grouped.map((row) => [
        row.ledgerAccountId,
        (row._sum.debitAmount ?? new Prisma.Decimal(0)).minus(
          row._sum.creditAmount ?? new Prisma.Decimal(0)
        ),
      ])
    );

    const result = new Map<string, Prisma.Decimal>();
    for (const account of accounts) {
      const opening = account.openingBalance.abs();
      const signedOpening = account.balanceType === 'DEBIT' ? opening : opening.negated();
      result.set(account.id, signedOpening.plus(postings.get(account.id) ?? new Prisma.Decimal(0)));
    }
    return result;
  }

  async neighbours(
    companyId: string,
    financialYearId: string,
    bookId: string,
    voucherDate: Date,
    voucherNumber: string
  ) {
    const base = {
      companyId,
      financialYearId,
      voucherType: 'RECEIPT' as const,
      bankReceiptBookId: bookId,
    };

    const [previous, next] = await Promise.all([
      prisma.bankVoucher.findFirst({
        where: {
          ...base,
          OR: [
            { voucherDate: { lt: voucherDate } },
            { voucherDate, voucherNumber: { lt: voucherNumber } },
          ],
        },
        orderBy: [{ voucherDate: 'desc' }, { voucherNumber: 'desc' }],
        select: { id: true, voucherNumber: true },
      }),
      prisma.bankVoucher.findFirst({
        where: {
          ...base,
          OR: [
            { voucherDate: { gt: voucherDate } },
            { voucherDate, voucherNumber: { gt: voucherNumber } },
          ],
        },
        orderBy: [{ voucherDate: 'asc' }, { voucherNumber: 'asc' }],
        select: { id: true, voucherNumber: true },
      }),
    ]);

    return { previous, next };
  }
}