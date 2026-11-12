import {
  BankVoucherStatus,
  BankVoucherType,
  PaymentMode,
  Prisma,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

export const VOUCHER_INCLUDE = {
  party: {
    select: { id: true, partyName: true, partyCode: true, partyType: true },
  },
  counterpartyLedger: {
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountGroup: true,
      isBankAccount: true,
    },
  },
  bankAccountLedger: {
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountGroup: true,
      bankName: true,
      branchName: true,
      isBankAccount: true,
    },
  },
  // Phase 18 (additive): the receipt book that produced a cheque receipt.
  bankReceiptBook: {
    select: { id: true, bookName: true, prefix: true },
  },
} satisfies Prisma.BankVoucherInclude;

export const VOUCHER_DETAIL_INCLUDE = {
  ...VOUCHER_INCLUDE,
  journalLines: {
    include: {
      ledgerAccount: {
        select: { id: true, accountCode: true, accountName: true, accountGroup: true },
      },
    },
    orderBy: [{ revision: 'asc' as const }, { lineNumber: 'asc' as const }],
  },
  // Phase 18 (additive): multi-row cheque receipt detail. Every revision is
  // returned so the service can show the latest revision while keeping history.
  lines: {
    include: {
      party: { select: { id: true, partyName: true, partyCode: true } },
      partyLedgerAccount: {
        select: { id: true, accountCode: true, accountName: true },
      },
      bankInstrument: { select: { id: true, code: true, description: true } },
      allocations: {
        include: {
          adjustments: {
            include: {
              adjustmentLedgerAccount: {
                select: { id: true, accountCode: true, accountName: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ revision: 'asc' as const }, { rowNumber: 'asc' as const }],
  },
} satisfies Prisma.BankVoucherInclude;

export type BankVoucherWithRelations = Prisma.BankVoucherGetPayload<{
  include: typeof VOUCHER_INCLUDE;
}>;

export type BankVoucherWithDetail = Prisma.BankVoucherGetPayload<{
  include: typeof VOUCHER_DETAIL_INCLUDE;
}>;

export interface VoucherListFilters {
  search?: string;
  bankAccountLedgerId?: string;
  paymentMode?: PaymentMode;
  status?: BankVoucherStatus;
  fromDate?: Date;
  toDate?: Date;
  sortBy?: 'date' | 'number';
  sortOrder?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface VoucherListResult {
  items: BankVoucherWithRelations[];
  total: number;
  totalAmount: Prisma.Decimal;
}

export interface NetLedgerAmount {
  ledgerAccountId: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

export class BankVoucherRepository {
  private buildWhere(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    filters: Omit<VoucherListFilters, 'page' | 'limit' | 'sortBy' | 'sortOrder'>
  ): Prisma.BankVoucherWhereInput {
    const where: Prisma.BankVoucherWhereInput = {
      companyId,
      financialYearId,
      voucherType,
    };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.bankAccountLedgerId) {
      where.bankAccountLedgerId = filters.bankAccountLedgerId;
    }
    if (filters.paymentMode) {
      where.paymentMode = filters.paymentMode;
    }
    if (filters.fromDate || filters.toDate) {
      where.voucherDate = {};
      if (filters.fromDate) {
        where.voucherDate.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.voucherDate.lte = filters.toDate;
      }
    }
    if (filters.search && filters.search.trim() !== '') {
      const search = filters.search.trim();
      where.OR = [
        { voucherNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { chequeNumber: { contains: search, mode: 'insensitive' } },
        { narration: { contains: search, mode: 'insensitive' } },
        { party: { is: { partyName: { contains: search, mode: 'insensitive' } } } },
        {
          counterpartyLedger: {
            is: { accountName: { contains: search, mode: 'insensitive' } },
          },
        },
      ];
    }

    return where;
  }

  async list(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    filters: VoucherListFilters
  ): Promise<VoucherListResult> {
    const where = this.buildWhere(companyId, financialYearId, voucherType, filters);
    const orderBy: Prisma.BankVoucherOrderByWithRelationInput[] =
      filters.sortBy === 'number'
        ? [{ voucherNumber: filters.sortOrder ?? 'desc' }]
        : [{ voucherDate: filters.sortOrder ?? 'desc' }, { voucherNumber: filters.sortOrder ?? 'desc' }];

    const skip = (filters.page - 1) * filters.limit;

    const [items, total, aggregate] = await Promise.all([
      prisma.bankVoucher.findMany({
        where,
        include: VOUCHER_INCLUDE,
        orderBy,
        skip,
        take: filters.limit,
      }),
      prisma.bankVoucher.count({ where }),
      prisma.bankVoucher.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      items,
      total,
      totalAmount: aggregate._sum.amount ?? new Prisma.Decimal(0),
    };
  }

  async findById(
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    id: string
  ): Promise<BankVoucherWithDetail | null> {
    return prisma.bankVoucher.findFirst({
      where: { id, companyId, financialYearId, voucherType },
      include: VOUCHER_DETAIL_INCLUDE,
    });
  }

  async findByIdLoose(id: string): Promise<BankVoucherWithDetail | null> {
    return prisma.bankVoucher.findUnique({
      where: { id },
      include: VOUCHER_DETAIL_INCLUDE,
    });
  }

  /**
   * Locks the voucher row for the duration of the transaction so that two
   * concurrent edits/cancellations serialize instead of double posting.
   */
  async lockVoucher(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType,
    id: string
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "bank_vouchers"
      WHERE "id" = ${id}
        AND "company_id" = ${companyId}
        AND "financial_year_id" = ${financialYearId}
        AND "voucher_type" = ${voucherType}::"BankVoucherType"
      FOR UPDATE
    `);

    if (rows.length === 0) {
      throw new Error('Voucher not found for the active company and financial year.');
    }
  }

  /**
   * Atomically increments and returns the next voucher sequence number for a
   * company + financial year + voucher type. Uses a single UPSERT so that
   * concurrent saves can never receive the same number.
   */
  async nextSequence(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    voucherType: BankVoucherType
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ last_number: number }>>(Prisma.sql`
      INSERT INTO "voucher_sequences"
        ("id", "company_id", "financial_year_id", "voucher_type", "last_number", "updated_at")
      VALUES
        (gen_random_uuid()::text, ${companyId}, ${financialYearId}, ${voucherType}::"BankVoucherType", 1, NOW())
      ON CONFLICT ("company_id", "financial_year_id", "voucher_type")
      DO UPDATE SET
        "last_number" = "voucher_sequences"."last_number" + 1,
        "updated_at" = NOW()
      RETURNING "last_number"
    `);

    return rows[0].last_number;
  }

  async createVoucher(
    tx: Prisma.TransactionClient,
    data: Prisma.BankVoucherUncheckedCreateInput
  ): Promise<BankVoucherWithRelations> {
    return tx.bankVoucher.create({ data, include: VOUCHER_INCLUDE });
  }

  async updateVoucher(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.BankVoucherUncheckedUpdateInput
  ): Promise<void> {
    await tx.bankVoucher.update({ where: { id }, data });
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

  async netByLedger(tx: Prisma.TransactionClient, voucherId: string): Promise<NetLedgerAmount[]> {
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

  async voucherDebitCredit(
    voucherId: string
  ): Promise<{ debit: Prisma.Decimal; credit: Prisma.Decimal }> {
    const aggregate = await prisma.journalLine.aggregate({
      where: { voucherId },
      _sum: { debitAmount: true, creditAmount: true },
    });

    return {
      debit: aggregate._sum.debitAmount ?? new Prisma.Decimal(0),
      credit: aggregate._sum.creditAmount ?? new Prisma.Decimal(0),
    };
  }

  async findDuplicateReference(
    companyId: string,
    voucherType: BankVoucherType,
    paymentMode: PaymentMode,
    referenceNumber: string,
    excludeId?: string
  ) {
    return prisma.bankVoucher.findFirst({
      where: {
        companyId,
        voucherType,
        paymentMode,
        status: 'POSTED',
        referenceNumber: { equals: referenceNumber, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, voucherNumber: true, voucherDate: true },
    });
  }

  async findDuplicateCheque(
    companyId: string,
    voucherType: BankVoucherType,
    bankAccountLedgerId: string,
    chequeNumber: string,
    excludeId?: string
  ) {
    return prisma.bankVoucher.findFirst({
      where: {
        companyId,
        voucherType,
        bankAccountLedgerId,
        status: 'POSTED',
        chequeNumber: { equals: chequeNumber, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, voucherNumber: true, voucherDate: true },
    });
  }

  async ledgerBalance(
    companyId: string,
    financialYearId: string,
    ledgerAccountId: string
  ): Promise<Prisma.Decimal> {
    const aggregate = await prisma.journalLine.aggregate({
      where: { companyId, financialYearId, ledgerAccountId },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const debit = aggregate._sum.debitAmount ?? new Prisma.Decimal(0);
    const credit = aggregate._sum.creditAmount ?? new Prisma.Decimal(0);
    return debit.minus(credit);
  }

  /**
   * Phase 18: row count of the newest receipt revision for each voucher.
   * Used by the register so a multi-row cheque receipt reports how many party
   * rows it actually carries instead of always showing one.
   */
  async latestReceiptRowCounts(voucherIds: string[]): Promise<Map<string, number>> {
    if (voucherIds.length === 0) return new Map<string, number>();
    const grouped = await prisma.bankVoucherLine.groupBy({
      by: ['bankVoucherId', 'revision'],
      where: { bankVoucherId: { in: voucherIds } },
      _count: { _all: true },
    });

    const newest = new Map<string, { revision: number; count: number }>();
    for (const row of grouped) {
      const current = newest.get(row.bankVoucherId);
      if (!current || row.revision > current.revision) {
        newest.set(row.bankVoucherId, {
          revision: row.revision,
          count: row._count._all,
        });
      }
    }
    return new Map(Array.from(newest.entries()).map(([id, value]) => [id, value.count]));
  }

  /**
   * Phase 18: distinct parties of the newest revision for each voucher, so the
   * register can show every party on a multi-row cheque receipt without loading
   * the full allocation tree.
   */
  async latestReceiptParties(
    voucherIds: string[]
  ): Promise<Map<string, Array<{ id: string; partyName: string; partyCode: string }>>> {
    if (voucherIds.length === 0) return new Map();

    const rows = await prisma.bankVoucherLine.findMany({
      where: { bankVoucherId: { in: voucherIds } },
      select: {
        bankVoucherId: true,
        revision: true,
        rowNumber: true,
        party: { select: { id: true, partyName: true, partyCode: true } },
      },
      orderBy: [{ revision: 'asc' }, { rowNumber: 'asc' }],
    });

    const latestRevision = new Map<string, number>();
    for (const row of rows) {
      const current = latestRevision.get(row.bankVoucherId) ?? 0;
      if (row.revision > current) latestRevision.set(row.bankVoucherId, row.revision);
    }

    const parties = new Map<string, Array<{ id: string; partyName: string; partyCode: string }>>();
    for (const row of rows) {
      if (row.revision !== latestRevision.get(row.bankVoucherId)) continue;
      if (!row.party) continue;
      const list = parties.get(row.bankVoucherId) ?? [];
      if (!list.some((party) => party.id === row.party?.id)) list.push(row.party);
      parties.set(row.bankVoucherId, list);
    }
    return parties;
  }

  /**
   * Phase 18: number of rows in a specific revision. Phase 12 update must not
   * rewrite a multi-row cheque receipt through the single-line payload.
   */
  async rowCountForRevision(voucherId: string, revision: number): Promise<number> {
    return prisma.bankVoucherLine.count({ where: { bankVoucherId: voucherId, revision } });
  }

  /**
   * Phase 18: release every ACTIVE bill allocation / journal adjustment when a
   * receipt is cancelled, so the bills become outstanding again.
   */
  async releaseReceiptAllocations(
    tx: Prisma.TransactionClient,
    voucherId: string
  ): Promise<void> {
    await tx.bankReceiptBillAllocation.updateMany({
      where: { bankVoucherLine: { bankVoucherId: voucherId }, status: 'ACTIVE' },
      data: { status: 'REVERSED' },
    });
    await tx.bankReceiptAdjustmentLine.updateMany({
      where: { bankVoucherLine: { bankVoucherId: voucherId }, status: 'ACTIVE' },
      data: { status: 'REVERSED' },
    });
  }

  async countByCompany(companyId: string): Promise<number> {
    return prisma.bankVoucher.count({ where: { companyId } });
  }
}