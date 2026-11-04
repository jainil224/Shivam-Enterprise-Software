import {
  BalanceType,
  LedgerAccount,
  LedgerAccountGroup,
  LedgerAccountType,
  Prisma,
} from '@prisma/client';
import {
  LedgerAccountFilters,
  LedgerAccountRepository,
} from '../repositories/ledgerAccountRepository.js';
import { parseOpeningBalance, toMoney } from '../utils/money.js';
import { AppError, conflictError, notFoundError, validationError } from '../utils/appError.js';

const repo = new LedgerAccountRepository();

const ACCOUNT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9\-_/]{1,19}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const GROUP_DEFAULTS: Record<
  LedgerAccountGroup,
  { accountType: LedgerAccountType; balanceType: BalanceType }
> = {
  BANK: { accountType: 'ASSET', balanceType: 'DEBIT' },
  SUNDRY_DEBTORS: { accountType: 'ASSET', balanceType: 'DEBIT' },
  SUNDRY_CREDITORS: { accountType: 'LIABILITY', balanceType: 'CREDIT' },
  DIRECT_EXPENSES: { accountType: 'EXPENSE', balanceType: 'DEBIT' },
  INDIRECT_EXPENSES: { accountType: 'EXPENSE', balanceType: 'DEBIT' },
  DIRECT_INCOME: { accountType: 'INCOME', balanceType: 'CREDIT' },
  INDIRECT_INCOME: { accountType: 'INCOME', balanceType: 'CREDIT' },
  ASSETS: { accountType: 'ASSET', balanceType: 'DEBIT' },
  LIABILITIES: { accountType: 'LIABILITY', balanceType: 'CREDIT' },
  CAPITAL: { accountType: 'EQUITY', balanceType: 'CREDIT' },
  OTHERS: { accountType: 'ASSET', balanceType: 'DEBIT' },
};

const VALID_GROUPS = Object.keys(GROUP_DEFAULTS) as LedgerAccountGroup[];
const VALID_TYPES: LedgerAccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
const VALID_BALANCE_TYPES: BalanceType[] = ['DEBIT', 'CREDIT'];

export interface LedgerAccountPayload {
  accountCode?: string;
  accountName?: string;
  accountGroup?: LedgerAccountGroup;
  accountType?: LedgerAccountType;
  balanceType?: BalanceType;
  openingBalance?: string | number | null;
  bankName?: string | null;
  branchName?: string | null;
  accountHolderName?: string | null;
  ifscCode?: string | null;
  bankAccountNumber?: string | null;
  partyId?: string | null;
  description?: string | null;
}

interface NormalizedLedgerAccount {
  accountCode: string;
  accountName: string;
  accountGroup: LedgerAccountGroup;
  accountType: LedgerAccountType;
  balanceType: BalanceType;
  openingBalance: Prisma.Decimal;
  isBankAccount: boolean;
  bankName: string | null;
  branchName: string | null;
  accountHolderName: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
  partyId: string | null;
  description: string | null;
}

function cleanOptional(value: string | null | undefined, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, maxLength);
}

function normalizePayload(payload: LedgerAccountPayload): NormalizedLedgerAccount {
  const errors: Array<{ field: string; message: string }> = [];

  const accountCode = String(payload.accountCode ?? '').trim().toUpperCase();
  if (!accountCode) {
    errors.push({ field: 'accountCode', message: 'Account code is required.' });
  } else if (!ACCOUNT_CODE_PATTERN.test(accountCode)) {
    errors.push({
      field: 'accountCode',
      message:
        'Account code must be 2-20 characters using letters, numbers, hyphen, underscore or slash.',
    });
  }

  const accountName = String(payload.accountName ?? '').trim();
  if (!accountName) {
    errors.push({ field: 'accountName', message: 'Account name is required.' });
  } else if (accountName.length > 120) {
    errors.push({ field: 'accountName', message: 'Account name cannot exceed 120 characters.' });
  }

  const accountGroup = payload.accountGroup;
  if (!accountGroup || !VALID_GROUPS.includes(accountGroup)) {
    errors.push({ field: 'accountGroup', message: 'A valid account group is required.' });
  }

  const defaults = accountGroup && VALID_GROUPS.includes(accountGroup)
    ? GROUP_DEFAULTS[accountGroup]
    : GROUP_DEFAULTS.OTHERS;

  const accountType = payload.accountType ?? defaults.accountType;
  if (!VALID_TYPES.includes(accountType)) {
    errors.push({ field: 'accountType', message: 'A valid account type is required.' });
  }

  const balanceType = payload.balanceType ?? defaults.balanceType;
  if (!VALID_BALANCE_TYPES.includes(balanceType)) {
    errors.push({ field: 'balanceType', message: 'Balance nature must be DEBIT or CREDIT.' });
  }

  let openingBalance = new Prisma.Decimal(0);
  try {
    openingBalance = parseOpeningBalance(payload.openingBalance);
  } catch (error) {
    errors.push({
      field: 'openingBalance',
      message: error instanceof Error ? error.message : 'Opening balance is invalid.',
    });
  }

  const ifscCode = cleanOptional(payload.ifscCode, 11)?.toUpperCase() ?? null;
  if (ifscCode && !IFSC_PATTERN.test(ifscCode)) {
    errors.push({
      field: 'ifscCode',
      message: 'IFSC code must be 11 characters, for example HDFC0001234.',
    });
  }

  if (errors.length > 0) {
    validationError(errors);
  }

  return {
    accountCode,
    accountName,
    accountGroup: accountGroup as LedgerAccountGroup,
    accountType,
    balanceType,
    openingBalance,
    isBankAccount: accountGroup === 'BANK',
    bankName: cleanOptional(payload.bankName, 120),
    branchName: cleanOptional(payload.branchName, 120),
    accountHolderName: cleanOptional(payload.accountHolderName, 120),
    ifscCode,
    bankAccountNumber: cleanOptional(payload.bankAccountNumber, 40),
    partyId: payload.partyId ? String(payload.partyId) : null,
    description: cleanOptional(payload.description, 250),
  };
}

export interface LedgerAccountView {
  id: string;
  companyId: string;
  accountCode: string;
  accountName: string;
  accountGroup: LedgerAccountGroup;
  accountType: LedgerAccountType;
  balanceType: BalanceType;
  openingBalance: string;
  isBankAccount: boolean;
  bankName: string | null;
  branchName: string | null;
  accountHolderName: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
  partyId: string | null;
  partyName: string | null;
  isAutoCreated: boolean;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  debitTotal: string;
  creditTotal: string;
  netBalance: string;
  currentBalance: string;
  transactionCount: number;
}

function serializeAccount(
  account: LedgerAccount & { party?: { partyName: string } | null },
  totals?: { debitTotal: Prisma.Decimal; creditTotal: Prisma.Decimal; transactionCount: number }
): LedgerAccountView {
  const debitTotal = totals?.debitTotal ?? new Prisma.Decimal(0);
  const creditTotal = totals?.creditTotal ?? new Prisma.Decimal(0);
  const opening = toMoney(account.openingBalance);
  const net = debitTotal.minus(creditTotal);
  const current =
    account.balanceType === 'DEBIT' ? opening.plus(net) : opening.plus(creditTotal).minus(debitTotal);

  return {
    id: account.id,
    companyId: account.companyId,
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountGroup: account.accountGroup,
    accountType: account.accountType,
    balanceType: account.balanceType,
    openingBalance: opening.toFixed(2),
    isBankAccount: account.isBankAccount,
    bankName: account.bankName,
    branchName: account.branchName,
    accountHolderName: account.accountHolderName,
    ifscCode: account.ifscCode,
    bankAccountNumber: account.bankAccountNumber,
    partyId: account.partyId,
    partyName: account.party?.partyName ?? null,
    isAutoCreated: account.isAutoCreated,
    description: account.description,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    debitTotal: debitTotal.toFixed(2),
    creditTotal: creditTotal.toFixed(2),
    netBalance: net.toFixed(2),
    currentBalance: current.toFixed(2),
    transactionCount: totals?.transactionCount ?? 0,
  };
}

export class LedgerAccountService {
  async list(
    companyId: string,
    financialYearId: string,
    filters: LedgerAccountFilters = {}
  ): Promise<LedgerAccountView[]> {
    const accounts = await repo.list(companyId, filters);
    const totals = await repo.balanceTotals(
      companyId,
      financialYearId,
      accounts.map((account) => account.id)
    );
    const totalsMap = new Map(totals.map((row) => [row.ledgerAccountId, row]));

    return accounts.map((account) => serializeAccount(account, totalsMap.get(account.id)));
  }

  async getById(companyId: string, financialYearId: string, id: string): Promise<LedgerAccountView> {
    const account = await repo.findById(companyId, id);
    if (!account) {
      notFoundError('Ledger account not found for the active company.');
    }

    const totals = await repo.balanceTotals(companyId, financialYearId, [id]);
    return serializeAccount(account, totals[0]);
  }

  async create(companyId: string, payload: LedgerAccountPayload): Promise<LedgerAccountView> {
    const normalized = normalizePayload(payload);

    const existingCode = await repo.findByCode(companyId, normalized.accountCode);
    if (existingCode) {
      conflictError(`Ledger account code ${normalized.accountCode} already exists for this company.`);
    }

    if (normalized.partyId) {
      const party = await repo.findParty(companyId, normalized.partyId);
      if (!party) {
        validationError([
          { field: 'partyId', message: 'Selected party does not belong to the active company.' },
        ]);
      }
      if (!party.isActive) {
        validationError([{ field: 'partyId', message: 'Selected party is inactive.' }]);
      }
      const linked = await repo.findByParty(companyId, normalized.partyId);
      if (linked) {
        conflictError(
          `This party is already linked to ledger account ${linked.accountCode} - ${linked.accountName}.`
        );
      }
    }

    if (normalized.isBankAccount && !normalized.bankName) {
      validationError([
        { field: 'bankName', message: 'Bank name is required for a bank account ledger.' },
      ]);
    }

    const created = await repo.create({
      companyId,
      ...normalized,
      isAutoCreated: false,
    });

    return serializeAccount(created);
  }

  async update(
    companyId: string,
    financialYearId: string,
    id: string,
    payload: LedgerAccountPayload
  ): Promise<LedgerAccountView> {
    const existing = await repo.findById(companyId, id);
    if (!existing) {
      notFoundError('Ledger account not found for the active company.');
    }

    const normalized = normalizePayload(payload);

    if (normalized.accountCode !== existing.accountCode) {
      const duplicate = await repo.findByCode(companyId, normalized.accountCode);
      if (duplicate && duplicate.id !== id) {
        conflictError(
          `Ledger account code ${normalized.accountCode} already exists for this company.`
        );
      }
    }

    const postingCount = await repo.countPostings(companyId, id);
    if (postingCount > 0) {
      if (existing.isBankAccount !== normalized.isBankAccount) {
        conflictError('Bank classification cannot be changed after vouchers have been posted.');
      }
      if (existing.accountGroup !== normalized.accountGroup) {
        conflictError('Account group cannot be changed after vouchers have been posted.');
      }
      if ((existing.partyId ?? null) !== (normalized.partyId ?? null)) {
        conflictError('Linked party cannot be changed after vouchers have been posted.');
      }
    }

    if (normalized.partyId) {
      const party = await repo.findParty(companyId, normalized.partyId);
      if (!party) {
        validationError([
          { field: 'partyId', message: 'Selected party does not belong to the active company.' },
        ]);
      }
      if (!party.isActive) {
        validationError([{ field: 'partyId', message: 'Selected party is inactive.' }]);
      }
      const linked = await repo.findByParty(companyId, normalized.partyId);
      if (linked && linked.id !== id) {
        conflictError(
          `This party is already linked to ledger account ${linked.accountCode} - ${linked.accountName}.`
        );
      }
    }

    if (normalized.isBankAccount && !normalized.bankName) {
      validationError([
        { field: 'bankName', message: 'Bank name is required for a bank account ledger.' },
      ]);
    }

    await repo.update(companyId, id, normalized);
    return this.getById(companyId, financialYearId, id);
  }

  async setActive(
    companyId: string,
    financialYearId: string,
    id: string,
    isActive: boolean
  ): Promise<LedgerAccountView> {
    const existing = await repo.findById(companyId, id);
    if (!existing) {
      notFoundError('Ledger account not found for the active company.');
    }

    if (!isActive && existing.isAutoCreated) {
      const postingCount = await repo.countPostings(companyId, id);
      if (postingCount === 0) {
        throw new AppError(
          409,
          'Auto-created party ledgers without postings cannot be deactivated manually.',
          undefined,
          'CONFLICT'
        );
      }
    }

    await repo.setActive(companyId, id, isActive);
    return this.getById(companyId, financialYearId, id);
  }
}