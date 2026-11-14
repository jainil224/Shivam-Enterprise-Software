// Phase 19 - read-only data access for the Account Wise Balance report.
// Only SELECT statements touch accounting tables. No balance is stored,
// cached or duplicated: the service derives every figure from these rows.

import { Prisma } from '@prisma/client';
import type { LedgerAccountGroup } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

const postingMovementSelect = Prisma.validator<Prisma.JournalLineSelect>()({
  ledgerAccountId: true,
  postingDate: true,
  debitAmount: true,
  creditAmount: true,
  isReversal: true,
  revision: true,
  voucher: { select: { status: true, revision: true } },
  debitNote: { select: { status: true, revision: true } },
});

export type PostingMovementRow = Prisma.JournalLineGetPayload<{
  select: typeof postingMovementSelect;
}>;

export interface AccountWiseAccountFilter {
  accountGroups: LedgerAccountGroup[];
  partyId: string | null;
  partyGroupId: string | null;
}

export class AccountWiseBalanceRepository {
  getCompany(companyId: string) {
    return prisma.company.findUnique({ where: { id: companyId } });
  }

  getFinancialYear(companyId: string, financialYearId: string) {
    return prisma.financialYear.findFirst({ where: { id: financialYearId, companyId } });
  }

  getParty(companyId: string, partyId: string) {
    return prisma.party.findFirst({
      where: { id: partyId, companyId },
      select: { id: true, partyName: true, isActive: true, partyGroupId: true },
    });
  }

  getPartyGroup(companyId: string, partyGroupId: string) {
    return prisma.partyGroup.findFirst({
      where: { id: partyGroupId, companyId },
      select: { id: true, groupName: true, isActive: true },
    });
  }

  /** Active parties of the company with the groups of their active ledgers. */
  listActiveParties(companyId: string) {
    return prisma.party.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        partyName: true,
        partyCode: true,
        partyType: true,
        partyGroupId: true,
        partyGroup: { select: { groupName: true, isActive: true } },
        ledgerAccounts: {
          where: { isActive: true },
          select: { accountGroup: true },
        },
      },
      orderBy: [{ partyName: 'asc' }, { partyCode: 'asc' }],
    });
  }

  listPartyGroups(companyId: string) {
    return prisma.partyGroup.findMany({
      where: { companyId },
      select: { id: true, groupName: true, isActive: true },
      orderBy: [{ groupName: 'asc' }],
    });
  }

  /**
   * Real schedule source: the LedgerAccountGroup values that actually exist on
   * active ledger accounts of this company. There is no separate Schedule
   * Master table in this schema, so the enum value is the stable key.
   */
  async countActiveAccountsByGroup(
    companyId: string
  ): Promise<Array<{ accountGroup: LedgerAccountGroup; accountCount: number }>> {
    const rows = await prisma.ledgerAccount.groupBy({
      by: ['accountGroup'],
      where: { companyId, isActive: true },
      _count: { _all: true },
    });
    return rows
      .map((row) => ({ accountGroup: row.accountGroup, accountCount: row._count._all }))
      .sort((left, right) => left.accountGroup.localeCompare(right.accountGroup));
  }

  /** Active ledger accounts of the company that match the account filters. */
  listAccounts(companyId: string, filter: AccountWiseAccountFilter) {
    return prisma.ledgerAccount.findMany({
      where: {
        companyId,
        isActive: true,
        accountGroup: { in: filter.accountGroups },
        ...(filter.partyId ? { partyId: filter.partyId } : {}),
        ...(filter.partyGroupId ? { party: { is: { partyGroupId: filter.partyGroupId } } } : {}),
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        description: true,
        accountGroup: true,
        accountType: true,
        balanceType: true,
        openingBalance: true,
        partyId: true,
        party: {
          select: {
            id: true,
            partyName: true,
            partyGroupId: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            panNumber: true,
            partyGroup: { select: { id: true, groupName: true } },
          },
        },
      },
      orderBy: [{ accountGroup: 'asc' }, { accountName: 'asc' }, { accountCode: 'asc' }],
    });
  }

  /**
   * Every journal line of the financial year up to `toDate` for the resolved
   * accounts, with only the fields the eligibility rule needs. One query, no
   * per-account round trip.
   */
  listPostingMovements(
    companyId: string,
    financialYearId: string,
    ledgerAccountIds: string[],
    toDate: Date
  ): Promise<PostingMovementRow[]> {
    if (ledgerAccountIds.length === 0) return Promise.resolve([]);
    return prisma.journalLine.findMany({
      where: {
        companyId,
        financialYearId,
        ledgerAccountId: { in: ledgerAccountIds },
        postingDate: { lte: toDate },
        OR: [{ voucherId: { not: null } }, { debitNoteId: { not: null } }],
      },
      select: postingMovementSelect,
    });
  }
}

export const accountWiseBalanceRepository = new AccountWiseBalanceRepository();