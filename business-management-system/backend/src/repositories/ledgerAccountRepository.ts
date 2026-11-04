import { LedgerAccount, LedgerAccountGroup, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LedgerAccountFilters {
  search?: string;
  accountGroup?: LedgerAccountGroup;
  isBankAccount?: boolean;
  includeInactive?: boolean;
}

export interface LedgerPostingTotals {
  ledgerAccountId: string;
  debitTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  transactionCount: number;
}

export class LedgerAccountRepository {
  async list(companyId: string, filters: LedgerAccountFilters = {}): Promise<LedgerAccount[]> {
    const where: Prisma.LedgerAccountWhereInput = { companyId };

    if (!filters.includeInactive) {
      where.isActive = true;
    }
    if (typeof filters.isBankAccount === 'boolean') {
      where.isBankAccount = filters.isBankAccount;
    }
    if (filters.accountGroup) {
      where.accountGroup = filters.accountGroup;
    }
    if (filters.search && filters.search.trim() !== '') {
      const search = filters.search.trim();
      where.OR = [
        { accountCode: { contains: search, mode: 'insensitive' } },
        { accountName: { contains: search, mode: 'insensitive' } },
        { bankName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.ledgerAccount.findMany({
      where,
      orderBy: [{ isBankAccount: 'desc' }, { accountCode: 'asc' }],
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.ledgerAccount.findFirst({
      where: { id, companyId },
      include: {
        party: { select: { id: true, partyName: true, partyCode: true, partyType: true } },
      },
    });
  }

  async findByCode(companyId: string, accountCode: string) {
    return prisma.ledgerAccount.findFirst({
      where: { companyId, accountCode },
    });
  }

  async findByParty(companyId: string, partyId: string) {
    return prisma.ledgerAccount.findFirst({
      where: { companyId, partyId },
    });
  }

  async create(data: Prisma.LedgerAccountUncheckedCreateInput): Promise<LedgerAccount> {
    return prisma.ledgerAccount.create({ data });
  }

  async update(
    companyId: string,
    id: string,
    data: Prisma.LedgerAccountUncheckedUpdateInput
  ): Promise<LedgerAccount> {
    return prisma.ledgerAccount.update({
      where: { id },
      data: { ...data, companyId },
    });
  }

  async setActive(companyId: string, id: string, isActive: boolean): Promise<LedgerAccount> {
    const result = await prisma.ledgerAccount.updateMany({
      where: { id, companyId },
      data: { isActive },
    });

    if (result.count === 0) {
      throw new Error('Ledger account not found for the active company.');
    }

    const account = await prisma.ledgerAccount.findFirst({ where: { id, companyId } });
    if (!account) {
      throw new Error('Ledger account not found for the active company.');
    }
    return account;
  }

  async findParty(companyId: string, partyId: string) {
    return prisma.party.findFirst({
      where: { id: partyId, companyId },
      select: {
        id: true,
        partyName: true,
        partyCode: true,
        partyType: true,
        balanceType: true,
        isActive: true,
      },
    });
  }

  async listActiveParties(companyId: string) {
    return prisma.party.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        partyName: true,
        partyCode: true,
        partyType: true,
        balanceType: true,
        gstin: true,
      },
      orderBy: { partyName: 'asc' },
    });
  }

  async countPostings(companyId: string, ledgerAccountId: string): Promise<number> {
    return prisma.journalLine.count({ where: { companyId, ledgerAccountId } });
  }

  async balanceTotals(
    companyId: string,
    financialYearId: string,
    ledgerAccountIds?: string[]
  ): Promise<LedgerPostingTotals[]> {
    const where: Prisma.JournalLineWhereInput = { companyId, financialYearId };
    if (ledgerAccountIds && ledgerAccountIds.length > 0) {
      where.ledgerAccountId = { in: ledgerAccountIds };
    }

    const grouped = await prisma.journalLine.groupBy({
      by: ['ledgerAccountId'],
      where,
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
}