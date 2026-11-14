// Phase 19 - Account Wise Balance report service (Phase 1).
// Read-only. Opening = stored ledger opening + eligible postings before the
// From date. Period movement and closing use the same posted JournalLine rows
// and the same eligibility rule as the Bank Book and Account Ledger reports,
// so no second accounting engine and no double counting exist.

import { Prisma } from '@prisma/client';
import type { LedgerAccountGroup } from '@prisma/client';
import {
  accountWiseBalanceRepository,
  type PostingMovementRow,
} from '../repositories/accountWiseBalanceRepository.js';
import { AppError } from '../utils/appError.js';
import {
  isEligiblePostingFields,
  moneyText,
  signedBalance,
  signedOpening,
  startOfDay,
  toIsoDate,
} from '../utils/ledgerPosting.js';
import {
  buildAccountMonthPrintDocument,
  buildAccountWisePrintDocument,
  buildCompanyHeader,
} from '../utils/accountWiseBalancePrint.js';
import {
  buildAccountMonthPrintPdf,
  buildAccountWisePrintPdf,
} from '../utils/accountWiseBalancePrintPdf.js';
import {
  ACCOUNT_WISE_ACCOUNT_GROUPS,
  accountGroupLabel,
  type AccountWiseAccountType,
  type AccountWiseAccountTypeOption,
  type AccountWiseAppliedFilters,
  type AccountWiseBalanceColumnMode,
  type AccountWiseBalanceOptions,
  type AccountWiseBalanceQuery,
  type AccountWiseBalanceResult,
  type AccountWiseBalanceRow,
  type AccountWiseBalanceTotals,
  type AccountWiseCompanyHeader,
  type AccountWiseLimitations,
  type AccountWiseMonthAmounts,
  type AccountWiseMonthGroup,
  type AccountWiseMonthWiseResult,
  type AccountWiseMonthWiseRow,
  type AccountWiseMonthWiseTotals,
  type AccountWisePartyOption,
  type AccountWiseReportType,
  type AccountWiseScheduleMode,
  type AccountWiseScheduleOption,
  type AccountWiseSelectOption,
} from '../types/accountWiseBalanceTypes.js';

const REPORT_TYPE: AccountWiseReportType = 'ACCOUNT_WISE_BALANCE';
const MONTH_REPORT_TYPE: AccountWiseReportType = 'ACCOUNT_MONTH_WISE_BALANCE';

const DEPOSITORS_LIMITATION =
  'Depositors is not selectable: this schema has no deposit classification on Party or LedgerAccount. ' +
  'No account is guessed into this category.';

const SCHEDULE_LIMITATION =
  'Schedules are the real LedgerAccountGroup values present on active ledger accounts. ' +
  'This build has no separate Schedule Master table, so the enum value is the stored selection key.';

const LIMITATIONS: AccountWiseLimitations = {
  depositors: DEPOSITORS_LIMITATION,
  scheduleSource: SCHEDULE_LIMITATION,
};

/**
 * Real classification mapping. Debtors and Creditors are ledger groups, not
 * balance directions: a creditor ledger carrying a debit balance is still a
 * creditor. Depositors has no reliable classification and stays unsupported.
 */
const ACCOUNT_TYPE_DEFS: AccountWiseAccountTypeOption[] = [
  {
    value: 'DEBTORS',
    label: '1. Debtors',
    accountGroups: ['SUNDRY_DEBTORS'],
    supported: true,
    note: null,
  },
  {
    value: 'CREDITORS',
    label: '2. Creditors',
    accountGroups: ['SUNDRY_CREDITORS'],
    supported: true,
    note: null,
  },
  {
    value: 'CAPITAL',
    label: '3. Capital',
    accountGroups: ['CAPITAL'],
    supported: true,
    note: null,
  },
  {
    value: 'DEPOSITORS',
    label: '4. Depositors',
    accountGroups: [],
    supported: false,
    note: DEPOSITORS_LIMITATION,
  },
  {
    value: 'ALL',
    label: '5. All Accounts',
    accountGroups: ACCOUNT_WISE_ACCOUNT_GROUPS,
    supported: true,
    note: null,
  },
];

const BALANCE_COLUMNS: Array<AccountWiseSelectOption<AccountWiseBalanceColumnMode>> = [
  { value: 'BOTH', label: '1. Both' },
  { value: 'CREDIT', label: '2. Credit Balance' },
  { value: 'DEBIT', label: '3. Debit Balance' },
];

const SCHEDULE_MODES: Array<AccountWiseSelectOption<AccountWiseScheduleMode>> = [
  { value: 'ALL', label: '1. All' },
  { value: 'SELECT', label: '2. Select' },
];

const ACCOUNT_TYPE_VALUES = ACCOUNT_TYPE_DEFS.map((definition) => definition.value);
const BALANCE_COLUMN_VALUES = BALANCE_COLUMNS.map((option) => option.value);
const SCHEDULE_MODE_VALUES = SCHEDULE_MODES.map((option) => option.value);

interface ReportScope {
  company: {
    id: string;
    companyName: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    panNumber: string | null;
    gstin: string | null;
    phone: string | null;
  };
  financialYear: { id: string; yearName: string; startDate: Date; endDate: Date };
}

interface MovementSums {
  beforeDebit: Prisma.Decimal;
  beforeCredit: Prisma.Decimal;
  periodDebit: Prisma.Decimal;
  periodCredit: Prisma.Decimal;
}

interface MonthAmountSums {
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
}

interface MonthMovementSums {
  beforeDebit: Prisma.Decimal;
  beforeCredit: Prisma.Decimal;
  byMonth: Map<string, MonthAmountSums>;
}

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

const MONTH_SHORT_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

/** 2026 - 2027 -> 2026-2027, the documented PDF filename token. */
function financialYearFileToken(yearName: string): string {
  const cleaned = String(yearName ?? '').replace(/[^0-9A-Za-z-]+/g, '');
  return cleaned.length > 0 ? cleaned : 'FY';
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalId(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new AppError(400, label + ' must be a text id or empty.');
  const text = value.trim();
  return text.length === 0 ? null : text;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  fallback: T
): T {
  const text = readText(value);
  if (text.length === 0) return fallback;
  const upper = text.toUpperCase();
  if (!(allowed as readonly string[]).includes(upper)) {
    throw new AppError(400, label + ' must be one of ' + allowed.join(', ') + '.');
  }
  return upper as T;
}

function readBoolean(value: unknown, label: string): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') throw new AppError(400, label + ' must be true or false.');
  return value;
}

function parseReportDate(value: unknown, label: string): Date {
  const text = readText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AppError(400, label + ' must be a valid date in YYYY-MM-DD format.');
  }
  const date = new Date(text + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new AppError(400, label + ' is not a valid calendar date.');
  }
  return date;
}

function readScheduleIds(value: unknown): LedgerAccountGroup[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new AppError(400, 'Schedule selection must be a list of schedule ids.');
  const ids: LedgerAccountGroup[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') throw new AppError(400, 'Every schedule id must be text.');
    const upper = entry.trim().toUpperCase();
    if (!ACCOUNT_WISE_ACCOUNT_GROUPS.includes(upper as LedgerAccountGroup)) {
      throw new AppError(400, 'Unknown schedule "' + entry + '".');
    }
    const group = upper as LedgerAccountGroup;
    if (!ids.includes(group)) ids.push(group);
  }
  return ids;
}

/** Stored party address parts, joined only when at least one part exists. */
function partyAddressOf(party: {
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
} | null): string | null {
  if (!party) return null;
  const parts = [party.address, party.city, party.state, party.pincode]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .map((part) => part.trim());
  return parts.length === 0 ? null : parts.join(', ');
}

export class AccountWiseBalanceService {
  private async loadScope(companyId: string, financialYearId: string): Promise<ReportScope> {
    const company = await accountWiseBalanceRepository.getCompany(companyId);
    if (!company) throw new AppError(404, 'Company was not found.');
    const financialYear = await accountWiseBalanceRepository.getFinancialYear(
      companyId,
      financialYearId
    );
    if (!financialYear) throw new AppError(404, 'Financial year was not found for this company.');
    return {
      company: {
        id: company.id,
        companyName: company.companyName,
        address: company.address,
        city: company.city,
        state: company.state,
        pincode: company.pincode,
        panNumber: company.panNumber,
        gstin: company.gstin,
        phone: company.phone,
      },
      financialYear: {
        id: financialYear.id,
        yearName: financialYear.yearName,
        startDate: financialYear.startDate,
        endDate: financialYear.endDate,
      },
    };
  }

  private financialYearRange(scope: ReportScope): { start: string; end: string } {
    return {
      start: toIsoDate(startOfDay(scope.financialYear.startDate)),
      end: toIsoDate(startOfDay(scope.financialYear.endDate)),
    };
  }

  async getOptions(companyId: string, financialYearId: string): Promise<AccountWiseBalanceOptions> {
    const scope = await this.loadScope(companyId, financialYearId);
    const [parties, partyGroups, groupCounts] = await Promise.all([
      accountWiseBalanceRepository.listActiveParties(companyId),
      accountWiseBalanceRepository.listPartyGroups(companyId),
      accountWiseBalanceRepository.countActiveAccountsByGroup(companyId),
    ]);

    const partyOptions: AccountWisePartyOption[] = parties
      .filter((party) => party.ledgerAccounts.length > 0)
      .map((party) => ({
        id: party.id,
        partyName: party.partyName,
        partyCode: party.partyCode,
        partyType: party.partyType,
        partyGroupId: party.partyGroupId,
        partyGroupName: party.partyGroup?.groupName ?? null,
        accountGroups: Array.from(
          new Set(party.ledgerAccounts.map((account) => account.accountGroup))
        ),
      }));

    const schedules: AccountWiseScheduleOption[] = groupCounts.map((row) => ({
      id: row.accountGroup,
      label: accountGroupLabel(row.accountGroup),
      accountCount: row.accountCount,
      accountTypes: ACCOUNT_TYPE_DEFS.filter((definition) =>
        definition.accountGroups.includes(row.accountGroup)
      ).map((definition) => definition.value),
    }));

    const range = this.financialYearRange(scope);
    return {
      reportTypes: [
        {
          value: REPORT_TYPE,
          label: '1. Account Wise Balance',
          enabled: true,
          note: null,
        },
        {
          value: 'ACCOUNT_MONTH_WISE_BALANCE',
          label: '2. Account + Month Wise Balance',
          enabled: true,
          note: 'Opening balance, monthly Debit/Credit movement and closing balance per account.',
        },
      ],
      accountTypes: ACCOUNT_TYPE_DEFS.map((definition) => ({ ...definition })),
      parties: partyOptions,
      partyGroups: partyGroups
        .filter((group) => group.isActive)
        .map((group) => ({ id: group.id, groupName: group.groupName, isActive: group.isActive })),
      schedules,
      balanceColumns: BALANCE_COLUMNS.map((option) => ({ ...option })),
      scheduleModes: SCHEDULE_MODES.map((option) => ({ ...option })),
      defaultAccountType: 'CREDITORS',
      defaultFromDate: range.start,
      defaultToDate: range.end,
      financialYearName: scope.financialYear.yearName,
      financialYearStart: range.start,
      financialYearEnd: range.end,
      limitations: LIMITATIONS,
    };
  }

  private async validateQuery(
    companyId: string,
    scope: ReportScope,
    request: Record<string, unknown>,
    mode: AccountWiseReportType
  ): Promise<{
    query: AccountWiseBalanceQuery;
    accountTypeLabel: string;
    partyName: string | null;
    partyGroupName: string | null;
  }> {
    const requestedType = readText(request.reportType).toUpperCase();
    if (requestedType.length > 0 && requestedType !== mode) {
      throw new AppError(
        400,
        mode === REPORT_TYPE
          ? 'This endpoint only runs the Account Wise Balance report. Use the month-wise endpoint for Account + Month Wise Balance.'
          : 'This endpoint only runs the Account + Month Wise Balance report.'
      );
    }

    const accountType = readEnum<AccountWiseAccountType>(
      request.accountType,
      ACCOUNT_TYPE_VALUES,
      'Account Type',
      'CREDITORS'
    );
    const accountTypeDef = ACCOUNT_TYPE_DEFS.find((definition) => definition.value === accountType);
    if (!accountTypeDef) throw new AppError(400, 'Unknown Account Type.');
    if (!accountTypeDef.supported) {
      throw new AppError(400, accountTypeDef.note ?? 'This account type is not supported.');
    }

    const balanceColumns = readEnum<AccountWiseBalanceColumnMode>(
      request.balanceColumns,
      BALANCE_COLUMN_VALUES,
      'Balance Columns',
      'BOTH'
    );
    const scheduleMode = readEnum<AccountWiseScheduleMode>(
      request.scheduleMode,
      SCHEDULE_MODE_VALUES,
      'Schedule',
      'ALL'
    );

    let scheduleIds: LedgerAccountGroup[] = [];
    if (scheduleMode === 'SELECT') {
      scheduleIds = readScheduleIds(request.scheduleIds);
      if (scheduleIds.length === 0) {
        throw new AppError(400, 'Select at least one schedule, or set Schedule to All.');
      }
      const outside = scheduleIds.filter(
        (scheduleId) => !accountTypeDef.accountGroups.includes(scheduleId)
      );
      if (outside.length > 0) {
        throw new AppError(
          400,
          'The selected schedule is not part of the ' +
            accountTypeDef.label.replace(/^\d+\.\s*/, '') +
            ' classification.'
        );
      }
    }

    const partyId = readOptionalId(request.partyId, 'Party');
    let partyName: string | null = null;
    if (partyId) {
      const party = await accountWiseBalanceRepository.getParty(companyId, partyId);
      if (!party) throw new AppError(404, 'The selected party was not found for this company.');
      if (!party.isActive) throw new AppError(400, 'The selected party is inactive.');
      partyName = party.partyName;
    }

    const partyGroupId = readOptionalId(request.partyGroupId, 'Party Group');
    let partyGroupName: string | null = null;
    if (partyGroupId) {
      const group = await accountWiseBalanceRepository.getPartyGroup(companyId, partyGroupId);
      if (!group) throw new AppError(404, 'The selected party group was not found for this company.');
      partyGroupName = group.groupName;
    }

    const fromDate = readText(request.fromDate);
    const toDate = readText(request.toDate);
    const from = parseReportDate(fromDate, 'From date');
    const to = parseReportDate(toDate, 'To date');
    if (from.getTime() > to.getTime()) {
      throw new AppError(400, 'From date cannot be after the To date.');
    }
    const fyStart = startOfDay(scope.financialYear.startDate);
    const fyEnd = startOfDay(scope.financialYear.endDate);
    if (from.getTime() < fyStart.getTime() || to.getTime() > fyEnd.getTime()) {
      throw new AppError(
        400,
        'The report period must stay inside the financial year ' +
          toIsoDate(fyStart) +
          ' to ' +
          toIsoDate(fyEnd) +
          '.'
      );
    }

    const query: AccountWiseBalanceQuery = {
      reportType: mode,
      accountType,
      partyId,
      partyGroupId,
      scheduleMode,
      scheduleIds,
      balanceColumns,
      includePartyAddress: readBoolean(request.includePartyAddress, 'Party Address Required'),
      includePartyMobile: readBoolean(request.includePartyMobile, 'Party Mobile No Required'),
      includePan: readBoolean(request.includePan, 'PAN No Required'),
      pageBreakEveryParty: readBoolean(request.pageBreakEveryParty, 'Page Break on Every Party'),
      doNotPrintDescription: readBoolean(
        request.doNotPrintDescription,
        'Do not Print Description'
      ),
      skipZeroBalances: readBoolean(request.skipZeroBalances, 'Skip 0 (Zero) Transaction'),
      fromDate,
      toDate,
    };

    return { query, accountTypeLabel: accountTypeDef.label, partyName, partyGroupName };
  }

  /** Groups eligible postings per account, split before/in the report period. */
  private sumMovements(lines: PostingMovementRow[], from: Date): Map<string, MovementSums> {
    const totals = new Map<string, MovementSums>();
    const fromTime = from.getTime();
    for (const line of lines) {
      if (!isEligiblePostingFields(line)) continue;
      const existing = totals.get(line.ledgerAccountId) ?? {
        beforeDebit: new Prisma.Decimal(0),
        beforeCredit: new Prisma.Decimal(0),
        periodDebit: new Prisma.Decimal(0),
        periodCredit: new Prisma.Decimal(0),
      };
      if (startOfDay(line.postingDate).getTime() < fromTime) {
        existing.beforeDebit = existing.beforeDebit.plus(line.debitAmount);
        existing.beforeCredit = existing.beforeCredit.plus(line.creditAmount);
      } else {
        existing.periodDebit = existing.periodDebit.plus(line.debitAmount);
        existing.periodCredit = existing.periodCredit.plus(line.creditAmount);
      }
      totals.set(line.ledgerAccountId, existing);
    }
    return totals;
  }

  async run(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<AccountWiseBalanceResult> {
    const scope = await this.loadScope(companyId, financialYearId);
    const { query, accountTypeLabel, partyName, partyGroupName } = await this.validateQuery(
      companyId,
      scope,
      request,
      REPORT_TYPE
    );

    const accountTypeDef = ACCOUNT_TYPE_DEFS.find(
      (definition) => definition.value === query.accountType
    );
    if (!accountTypeDef) throw new AppError(400, 'Unknown Account Type.');

    const effectiveGroups =
      query.scheduleMode === 'SELECT'
        ? accountTypeDef.accountGroups.filter((group) => query.scheduleIds.includes(group))
        : accountTypeDef.accountGroups;

    const accounts = await accountWiseBalanceRepository.listAccounts(companyId, {
      accountGroups: effectiveGroups,
      partyId: query.partyId,
      partyGroupId: query.partyGroupId,
    });

    const from = parseReportDate(query.fromDate, 'From date');
    const to = parseReportDate(query.toDate, 'To date');
    const movements = await accountWiseBalanceRepository.listPostingMovements(
      companyId,
      financialYearId,
      accounts.map((account) => account.id),
      to
    );
    const movementByAccount = this.sumMovements(movements, from);

    const rows: AccountWiseBalanceRow[] = [];
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    let totalOpeningDebit = new Prisma.Decimal(0);
    let totalOpeningCredit = new Prisma.Decimal(0);
    let totalClosingDebit = new Prisma.Decimal(0);
    let totalClosingCredit = new Prisma.Decimal(0);

    for (const account of accounts) {
      const movement = movementByAccount.get(account.id) ?? {
        beforeDebit: new Prisma.Decimal(0),
        beforeCredit: new Prisma.Decimal(0),
        periodDebit: new Prisma.Decimal(0),
        periodCredit: new Prisma.Decimal(0),
      };

      const openingSigned = signedOpening(account.openingBalance, account.balanceType)
        .plus(movement.beforeDebit)
        .minus(movement.beforeCredit);
      const closingSigned = openingSigned
        .plus(movement.periodDebit)
        .minus(movement.periodCredit);

      if (query.balanceColumns === 'DEBIT' && !closingSigned.gt(0)) continue;
      if (query.balanceColumns === 'CREDIT' && !closingSigned.lt(0)) continue;
      if (query.skipZeroBalances && closingSigned.isZero()) continue;

      const opening = signedBalance(openingSigned);
      const closing = signedBalance(closingSigned);

      rows.push({
        ledgerAccountId: account.id,
        partyId: account.partyId,
        accountCode: account.accountCode,
        accountName: account.accountName,
        partyName: account.party?.partyName ?? null,
        accountGroup: account.accountGroup,
        accountType: account.accountType,
        partyGroupId: account.party?.partyGroupId ?? null,
        partyGroupName: account.party?.partyGroup?.groupName ?? null,
        partyAddress: query.includePartyAddress ? partyAddressOf(account.party) : null,
        description: query.doNotPrintDescription ? null : account.description ?? null,
        mobile: query.includePartyMobile ? account.party?.phone ?? null : null,
        panNumber: query.includePan ? account.party?.panNumber ?? null : null,
        openingBalance: opening.amount,
        openingNature: opening.nature,
        openingSignedAmount: opening.signed,
        periodDebit: moneyText(movement.periodDebit),
        periodCredit: moneyText(movement.periodCredit),
        closingBalance: closing.amount,
        closingNature: closing.nature,
        closingSignedAmount: closing.signed,
        debitBalance: closingSigned.gt(0) ? moneyText(closingSigned) : '0.00',
        creditBalance: closingSigned.lt(0) ? moneyText(closingSigned.abs()) : '0.00',
        sign: closing.nature,
      });

      totalDebit = totalDebit.plus(movement.periodDebit);
      totalCredit = totalCredit.plus(movement.periodCredit);
      if (openingSigned.gt(0)) totalOpeningDebit = totalOpeningDebit.plus(openingSigned);
      if (openingSigned.lt(0)) totalOpeningCredit = totalOpeningCredit.plus(openingSigned.abs());
      if (closingSigned.gt(0)) totalClosingDebit = totalClosingDebit.plus(closingSigned);
      if (closingSigned.lt(0)) totalClosingCredit = totalClosingCredit.plus(closingSigned.abs());
    }

    const totals: AccountWiseBalanceTotals = {
      totalDebit: moneyText(totalDebit),
      totalCredit: moneyText(totalCredit),
      totalOpeningDebit: moneyText(totalOpeningDebit),
      totalOpeningCredit: moneyText(totalOpeningCredit),
      totalClosingDebit: moneyText(totalClosingDebit),
      totalClosingCredit: moneyText(totalClosingCredit),
      accountCount: rows.length,
    };

    const appliedFilters: AccountWiseAppliedFilters = {
      reportType: REPORT_TYPE,
      accountType: query.accountType,
      accountTypeLabel,
      partyId: query.partyId,
      partyName,
      partyGroupId: query.partyGroupId,
      partyGroupName,
      scheduleMode: query.scheduleMode,
      scheduleIds: query.scheduleIds,
      scheduleLabels: query.scheduleIds.map((scheduleId) => accountGroupLabel(scheduleId)),
      balanceColumns: query.balanceColumns,
      includePartyAddress: query.includePartyAddress,
      includePartyMobile: query.includePartyMobile,
      includePan: query.includePan,
      pageBreakEveryParty: query.pageBreakEveryParty,
      doNotPrintDescription: query.doNotPrintDescription,
      skipZeroBalances: query.skipZeroBalances,
      fromDate: query.fromDate,
      toDate: query.toDate,
    };

    const range = this.financialYearRange(scope);
    const base = {
      rows,
      totals,
      appliedFilters,
      meta: {
        companyName: scope.company.companyName,
        company: this.companyHeader(scope),
        financialYearName: scope.financialYear.yearName,
        financialYearStart: range.start,
        financialYearEnd: range.end,
        generatedAt: new Date().toISOString(),
        limitations: LIMITATIONS,
      },
    };
    return { ...base, print: buildAccountWisePrintDocument(base) };
  }

  /** Real Company Master header used by both print documents. */
  private companyHeader(scope: ReportScope): AccountWiseCompanyHeader {
    return buildCompanyHeader(scope.company, 95);
  }

  /**
   * Dynamic month buckets from the actual From/To dates. A partial first or
   * last month keeps only the days inside the selected range.
   */
  private buildMonthGroups(from: Date, to: Date): AccountWiseMonthGroup[] {
    const groups: AccountWiseMonthGroup[] = [];
    const start = startOfDay(from);
    const end = startOfDay(to);
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor.getTime() <= end.getTime()) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const monthStart = new Date(Date.UTC(year, month, 1));
      const monthEnd = new Date(Date.UTC(year, month + 1, 0));
      const segmentStart = monthStart.getTime() < start.getTime() ? start : monthStart;
      const segmentEnd = monthEnd.getTime() > end.getTime() ? end : monthEnd;
      groups.push({
        key: year + '-' + String(month + 1).padStart(2, '0'),
        label: MONTH_NAMES[month] + ' ' + year,
        shortLabel: MONTH_SHORT_NAMES[month] + ' ' + year,
        startDate: toIsoDate(segmentStart),
        endDate: toIsoDate(segmentEnd),
      });
      cursor = new Date(Date.UTC(year, month + 1, 1));
    }
    return groups;
  }

  /**
   * Account + Month Wise Balance.
   * Opening = stored opening + eligible postings before From date. Each month
   * bucket holds that month's eligible Debit/Credit movement inside the range.
   * Closing = opening + every period movement, so it always agrees with the
   * Account Wise Balance closing balance for the same period.
   */
  async runMonthWise(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<AccountWiseMonthWiseResult> {
    const scope = await this.loadScope(companyId, financialYearId);
    const { query, accountTypeLabel, partyName, partyGroupName } = await this.validateQuery(
      companyId,
      scope,
      request,
      MONTH_REPORT_TYPE
    );

    const accountTypeDef = ACCOUNT_TYPE_DEFS.find(
      (definition) => definition.value === query.accountType
    );
    if (!accountTypeDef) throw new AppError(400, 'Unknown Account Type.');

    const effectiveGroups =
      query.scheduleMode === 'SELECT'
        ? accountTypeDef.accountGroups.filter((group) => query.scheduleIds.includes(group))
        : accountTypeDef.accountGroups;

    const accounts = await accountWiseBalanceRepository.listAccounts(companyId, {
      accountGroups: effectiveGroups,
      partyId: query.partyId,
      partyGroupId: query.partyGroupId,
    });

    const from = parseReportDate(query.fromDate, 'From date');
    const to = parseReportDate(query.toDate, 'To date');
    const months = this.buildMonthGroups(from, to);
    const movements = await accountWiseBalanceRepository.listPostingMovements(
      companyId,
      financialYearId,
      accounts.map((account) => account.id),
      to
    );

    const fromTime = startOfDay(from).getTime();
    const byAccount = new Map<string, MonthMovementSums>();
    for (const line of movements) {
      if (!isEligiblePostingFields(line)) continue;
      const entry = byAccount.get(line.ledgerAccountId) ?? {
        beforeDebit: new Prisma.Decimal(0),
        beforeCredit: new Prisma.Decimal(0),
        byMonth: new Map<string, MonthAmountSums>(),
      };
      if (startOfDay(line.postingDate).getTime() < fromTime) {
        entry.beforeDebit = entry.beforeDebit.plus(line.debitAmount);
        entry.beforeCredit = entry.beforeCredit.plus(line.creditAmount);
      } else {
        const key = toIsoDate(startOfDay(line.postingDate)).slice(0, 7);
        const bucket = entry.byMonth.get(key) ?? {
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(0),
        };
        bucket.debit = bucket.debit.plus(line.debitAmount);
        bucket.credit = bucket.credit.plus(line.creditAmount);
        entry.byMonth.set(key, bucket);
      }
      byAccount.set(line.ledgerAccountId, entry);
    }

    const rows: AccountWiseMonthWiseRow[] = [];
    const totalByMonth = new Map<string, MonthAmountSums>(
      months.map((month) => [
        month.key,
        { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) },
      ])
    );
    let totalOpeningDebit = new Prisma.Decimal(0);
    let totalOpeningCredit = new Prisma.Decimal(0);
    let totalClosingDebit = new Prisma.Decimal(0);
    let totalClosingCredit = new Prisma.Decimal(0);

    for (const account of accounts) {
      const movement = byAccount.get(account.id) ?? {
        beforeDebit: new Prisma.Decimal(0),
        beforeCredit: new Prisma.Decimal(0),
        byMonth: new Map<string, MonthAmountSums>(),
      };

      const openingSigned = signedOpening(account.openingBalance, account.balanceType)
        .plus(movement.beforeDebit)
        .minus(movement.beforeCredit);
      let closingSigned = openingSigned;
      const monthAmounts: AccountWiseMonthAmounts[] = months.map((month) => {
        const bucket = movement.byMonth.get(month.key);
        const debit = bucket?.debit ?? new Prisma.Decimal(0);
        const credit = bucket?.credit ?? new Prisma.Decimal(0);
        closingSigned = closingSigned.plus(debit).minus(credit);
        return { key: month.key, debit: moneyText(debit), credit: moneyText(credit) };
      });

      if (query.balanceColumns === 'DEBIT' && !closingSigned.gt(0)) continue;
      if (query.balanceColumns === 'CREDIT' && !closingSigned.lt(0)) continue;
      if (query.skipZeroBalances && closingSigned.isZero()) continue;

      const opening = signedBalance(openingSigned);
      const closing = signedBalance(closingSigned);

      rows.push({
        ledgerAccountId: account.id,
        partyId: account.partyId,
        accountCode: account.accountCode,
        accountName: account.accountName,
        partyName: account.party?.partyName ?? null,
        accountGroup: account.accountGroup,
        accountType: account.accountType,
        partyGroupId: account.party?.partyGroupId ?? null,
        partyGroupName: account.party?.partyGroup?.groupName ?? null,
        partyAddress: query.includePartyAddress ? partyAddressOf(account.party) : null,
        description: query.doNotPrintDescription ? null : account.description ?? null,
        mobile: query.includePartyMobile ? account.party?.phone ?? null : null,
        panNumber: query.includePan ? account.party?.panNumber ?? null : null,
        openingBalance: opening.amount,
        openingNature: opening.nature,
        openingSignedAmount: opening.signed,
        months: monthAmounts,
        closingBalance: closing.amount,
        closingNature: closing.nature,
        closingSignedAmount: closing.signed,
        debitBalance: closingSigned.gt(0) ? moneyText(closingSigned) : '0.00',
        creditBalance: closingSigned.lt(0) ? moneyText(closingSigned.abs()) : '0.00',
        sign: closing.nature,
      });

      for (const month of monthAmounts) {
        const total = totalByMonth.get(month.key);
        if (!total) continue;
        total.debit = total.debit.plus(month.debit);
        total.credit = total.credit.plus(month.credit);
      }
      if (openingSigned.gt(0)) totalOpeningDebit = totalOpeningDebit.plus(openingSigned);
      if (openingSigned.lt(0)) totalOpeningCredit = totalOpeningCredit.plus(openingSigned.abs());
      if (closingSigned.gt(0)) totalClosingDebit = totalClosingDebit.plus(closingSigned);
      if (closingSigned.lt(0)) totalClosingCredit = totalClosingCredit.plus(closingSigned.abs());
    }

    const totals: AccountWiseMonthWiseTotals = {
      months: months.map((month) => {
        const total = totalByMonth.get(month.key);
        return {
          key: month.key,
          debit: moneyText(total?.debit ?? new Prisma.Decimal(0)),
          credit: moneyText(total?.credit ?? new Prisma.Decimal(0)),
        };
      }),
      totalOpeningDebit: moneyText(totalOpeningDebit),
      totalOpeningCredit: moneyText(totalOpeningCredit),
      totalClosingDebit: moneyText(totalClosingDebit),
      totalClosingCredit: moneyText(totalClosingCredit),
      accountCount: rows.length,
    };

    const appliedFilters: AccountWiseAppliedFilters = {
      reportType: MONTH_REPORT_TYPE,
      accountType: query.accountType,
      accountTypeLabel,
      partyId: query.partyId,
      partyName,
      partyGroupId: query.partyGroupId,
      partyGroupName,
      scheduleMode: query.scheduleMode,
      scheduleIds: query.scheduleIds,
      scheduleLabels: query.scheduleIds.map((scheduleId) => accountGroupLabel(scheduleId)),
      balanceColumns: query.balanceColumns,
      includePartyAddress: query.includePartyAddress,
      includePartyMobile: query.includePartyMobile,
      includePan: query.includePan,
      pageBreakEveryParty: query.pageBreakEveryParty,
      doNotPrintDescription: query.doNotPrintDescription,
      skipZeroBalances: query.skipZeroBalances,
      fromDate: query.fromDate,
      toDate: query.toDate,
    };

    const range = this.financialYearRange(scope);
    const base = {
      rows,
      months,
      totals,
      appliedFilters,
      meta: {
        companyName: scope.company.companyName,
        company: this.companyHeader(scope),
        financialYearName: scope.financialYear.yearName,
        financialYearStart: range.start,
        financialYearEnd: range.end,
        generatedAt: new Date().toISOString(),
        limitations: LIMITATIONS,
      },
    };
    return { ...base, print: buildAccountMonthPrintDocument(base) };
  }

  /** Genuine A4 PDF of the Account Wise Balance document. */
  async exportPdf(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<{ buffer: Buffer; filename: string; pageCount: number }> {
    const result = await this.run(companyId, financialYearId, request);
    const pdf = buildAccountWisePrintPdf(result.print);
    return {
      buffer: pdf.buffer,
      filename: 'Account_Wise_Balance_' + financialYearFileToken(result.meta.financialYearName) + '.pdf',
      pageCount: pdf.pageCount,
    };
  }

  /** Genuine A4 landscape PDF of the Account + Month Wise Balance document. */
  async exportMonthWisePdf(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<{ buffer: Buffer; filename: string; pageCount: number }> {
    const result = await this.runMonthWise(companyId, financialYearId, request);
    const pdf = buildAccountMonthPrintPdf(result.print);
    return {
      buffer: pdf.buffer,
      filename:
        'Account_Month_Wise_Balance_' +
        financialYearFileToken(result.meta.financialYearName) +
        '.pdf',
      pageCount: pdf.pageCount,
    };
  }
}

export const accountWiseBalanceService = new AccountWiseBalanceService();