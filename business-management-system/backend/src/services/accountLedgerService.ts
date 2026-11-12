// Phase 17 - Account Ledger report service.
// Read-only: opening balance plus every eligible posted JournalLine row for the
// selected ledger, with a running balance. Works for any ledger group.

import { Prisma } from '@prisma/client';
import { ledgerReportRepository } from '../repositories/ledgerReportRepository.js';
import { AppError } from '../utils/appError.js';
import {
  accountNameOf,
  bookNameOf,
  chequeNumberOf,
  documentNumberOf,
  isEligiblePosting,
  moneyText,
  particularsOf,
  signedBalance,
  signedOpening,
  sortPostings,
  sourceTypeOf,
  startOfDay,
  toDisplayDate,
  toIsoDate,
  voucherTypeLabel,
  type LedgerPostingLine,
} from '../utils/ledgerPosting.js';
import {
  buildAccountLedgerPrintPdf,
  type LedgerPrintColumn,
  type LedgerPrintRow,
} from '../utils/ledgerPrintPdf.js';
import { buildXlsx, type XlsxColumn } from '../utils/xlsxWriter.js';
import {
  ACCOUNT_LEDGER_COLUMNS,
  type AccountLedgerMeta,
  type AccountLedgerOptions,
  type AccountLedgerReportResult,
  type AccountLedgerRow,
  type AccountLedgerTotals,
  type LedgerLookupAccount,
  type LedgerReportColumnDef,
} from '../types/ledgerReportTypes.js';

/**
 * Traditional accounting print layout. The on-screen preview and the PDF share
 * this exact column order, so the combined voucher/cheque column and the wide
 * Book Name column cannot drift apart.
 */
const LEDGER_PRINT_COLUMNS: LedgerPrintColumn[] = [
  { key: 'date', label: 'Date', width: 11, align: 'left' },
  { key: 'voucherRef', label: 'Vch No / Chq No', width: 13, align: 'left' },
  { key: 'type', label: 'Type', width: 7, align: 'left' },
  { key: 'bookName', label: 'Book Name', width: 26, align: 'left' },
  { key: 'debit', label: 'Debit', width: 13, align: 'right' },
  { key: 'credit', label: 'Credit', width: 13, align: 'right' },
  { key: 'balance', label: 'Balance', width: 12, align: 'right' },
  { key: 'sign', label: 'Sign', width: 5, align: 'center' },
];

/**
 * Indian-grouped, two-decimal print amount. Empty input stays empty so a blank
 * debit cell never becomes a fabricated 0.00.
 */
function printAmount(value: string | null | undefined): string {
  const text = String(value ?? '').trim();
  if (text === '') return '';
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return text;
  const [whole, fraction] = Math.abs(numeric).toFixed(2).split('.');
  const grouped =
    whole.length > 3
      ? whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + whole.slice(-3)
      : whole;
  return grouped + '.' + fraction;
}

function requireText(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (text.length === 0) throw new AppError(400, label + ' is required.');
  return text;
}

function isIsoDate(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim());
}

interface LedgerScope {
  company: {
    id: string;
    companyName: string;
    gstin: string | null;
    panNumber: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
  };
  financialYear: { id: string; yearName: string; startDate: Date; endDate: Date };
}

export class AccountLedgerService {
  private async loadScope(companyId: string, financialYearId: string): Promise<LedgerScope> {
    const company = await ledgerReportRepository.getCompany(companyId);
    if (!company) throw new AppError(404, 'Company was not found.');
    const financialYear = await ledgerReportRepository.getFinancialYear(companyId, financialYearId);
    if (!financialYear) throw new AppError(404, 'Financial year was not found for this company.');
    return { company, financialYear };
  }

  private defaultRange(scope: LedgerScope): { fromDate: string; toDate: string } {
    const start = toIsoDate(startOfDay(scope.financialYear.startDate));
    const end = toIsoDate(startOfDay(scope.financialYear.endDate));
    const today = toIsoDate(new Date());
    const capped = today > end ? end : today < start ? start : today;
    return { fromDate: start, toDate: capped };
  }

  private resolveRange(scope: LedgerScope, fromDate: unknown, toDate: unknown): { from: Date; to: Date } {
    const fyStart = startOfDay(scope.financialYear.startDate);
    const fyEnd = startOfDay(scope.financialYear.endDate);
    const from = isIsoDate(fromDate) ? new Date(String(fromDate) + 'T00:00:00.000Z') : fyStart;
    const to = isIsoDate(toDate) ? new Date(String(toDate) + 'T00:00:00.000Z') : fyEnd;
    if (Number.isNaN(from.getTime())) throw new AppError(400, 'From date is not a valid calendar date.');
    if (Number.isNaN(to.getTime())) throw new AppError(400, 'To date is not a valid calendar date.');
    if (from.getTime() > to.getTime()) throw new AppError(400, 'From date cannot be after the To date.');
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
    return { from, to };
  }

  private resolveColumns(requested: unknown): LedgerReportColumnDef[] {
    const available = new Set(ACCOUNT_LEDGER_COLUMNS.map((column) => column.key));
    const required = ACCOUNT_LEDGER_COLUMNS.filter((column) => column.required).map((column) => column.key);
    const wanted = Array.isArray(requested)
      ? requested.map((entry) => String(entry)).filter((key) => available.has(key))
      : ACCOUNT_LEDGER_COLUMNS.map((column) => column.key);
    const merged = new Set<string>([...wanted, ...required]);
    return ACCOUNT_LEDGER_COLUMNS.filter((column) => merged.has(column.key));
  }

  async getOptions(companyId: string, financialYearId: string): Promise<AccountLedgerOptions> {
    const scope = await this.loadScope(companyId, financialYearId);
    const [accounts, totals] = await Promise.all([
      ledgerReportRepository.listLedgerAccounts(companyId),
      ledgerReportRepository.postingTotals(companyId, financialYearId),
    ]);
    const totalsById = new Map(totals.map((row) => [row.ledgerAccountId, row]));

    const mapped: LedgerLookupAccount[] = accounts.map((account) => {
      const row = totalsById.get(account.id);
      const signed = signedOpening(account.openingBalance, account.balanceType)
        .plus(row?.debitTotal ?? new Prisma.Decimal(0))
        .minus(row?.creditTotal ?? new Prisma.Decimal(0));
      const balance = signedBalance(signed);
      return {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountGroup: account.accountGroup,
        accountType: account.accountType,
        isBankAccount: account.isBankAccount,
        isActive: account.isActive,
        balanceAmount: balance.amount,
        balanceNature: balance.nature,
        partyId: account.partyId,
        partyName: account.party?.partyName ?? null,
        partyMobile: account.party?.phone ?? null,
        partyGstin: account.party?.gstin ?? null,
        partyPan: account.party?.panNumber ?? null,
        partyCity: account.party?.city ?? null,
        partyAddress: account.party?.address ?? null,
        partyArea: account.party?.area?.areaName ?? null,
        partyGroupName: account.party?.partyGroup?.groupName ?? null,
      };
    });

    const range = this.defaultRange(scope);
    return {
      accounts: mapped,
      columns: ACCOUNT_LEDGER_COLUMNS,
      defaultColumns: ACCOUNT_LEDGER_COLUMNS.map((column) => column.key),
      requiredColumns: ACCOUNT_LEDGER_COLUMNS.filter((column) => column.required).map(
        (column) => column.key
      ),
      defaultFromDate: range.fromDate,
      defaultToDate: range.toDate,
      financialYearStart: toIsoDate(startOfDay(scope.financialYear.startDate)),
      financialYearEnd: toIsoDate(startOfDay(scope.financialYear.endDate)),
    };
  }

  private async loadAccount(companyId: string, ledgerAccountId: string) {
    const account = await ledgerReportRepository.getLedgerAccountProfile(
      companyId,
      ledgerAccountId
    );
    if (!account) throw new AppError(404, 'The selected ledger account was not found.');
    return account;
  }

  private buildRows(
    postings: LedgerPostingLine[],
    openingSigned: Prisma.Decimal
  ): { rows: AccountLedgerRow[]; totals: AccountLedgerTotals; closing: Prisma.Decimal } {
    let running = openingSigned;
    let debitTotal = new Prisma.Decimal(0);
    let creditTotal = new Prisma.Decimal(0);
    const rows: AccountLedgerRow[] = postings.map((line) => {
      running = running.plus(line.debitAmount).minus(line.creditAmount);
      debitTotal = debitTotal.plus(line.debitAmount);
      creditTotal = creditTotal.plus(line.creditAmount);
      const balance = signedBalance(running);
      return {
        journalLineId: line.id,
        sourceType: sourceTypeOf(line),
        sourceId: line.voucher?.id ?? line.debitNote?.id ?? line.id,
        date: toIsoDate(startOfDay(line.postingDate)),
        voucherNo: documentNumberOf(line),
        chequeNo: chequeNumberOf(line),
        type: voucherTypeLabel(line),
        bookName: bookNameOf(line),
        accountName: accountNameOf(line),
        particulars: particularsOf(line),
        referenceNo: line.voucher?.referenceNumber ?? '',
        debit: line.debitAmount.isZero() ? '' : moneyText(line.debitAmount),
        credit: line.creditAmount.isZero() ? '' : moneyText(line.creditAmount),
        balance: balance.amount,
        sign: balance.nature,
      };
    });
    const closing = signedBalance(running);
    return {
      rows,
      closing: running,
      totals: {
        debitTotal: moneyText(debitTotal),
        creditTotal: moneyText(creditTotal),
        closingBalance: closing.amount,
        closingNature: closing.nature,
        transactionCount: postings.length,
      },
    };
  }

  async run(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<AccountLedgerReportResult> {
    const scope = await this.loadScope(companyId, financialYearId);
    const ledgerAccountId = requireText(request.ledgerAccountId, 'Ledger account');
    const account = await this.loadAccount(companyId, ledgerAccountId);
    const { from, to } = this.resolveRange(scope, request.fromDate, request.toDate);
    const columns = this.resolveColumns(request.columns);

    const postings = sortPostings(
      (await ledgerReportRepository.listPostingsThrough(companyId, financialYearId, ledgerAccountId, to)).filter(
        isEligiblePosting
      )
    );

    let openingSigned = signedOpening(account.openingBalance, account.balanceType);
    for (const line of postings) {
      if (startOfDay(line.postingDate).getTime() < from.getTime()) {
        openingSigned = openingSigned.plus(line.debitAmount).minus(line.creditAmount);
      }
    }
    const opening = signedBalance(openingSigned);

    const inPeriod = postings.filter((line) => {
      const day = startOfDay(line.postingDate).getTime();
      return day >= from.getTime() && day <= to.getTime();
    });

    const { rows, totals } = this.buildRows(inPeriod, openingSigned);

    const page = Math.max(1, Number(request.page ?? 1) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(request.pageSize ?? 100) || 100));
    const startIndex = (page - 1) * pageSize;

    const meta: AccountLedgerMeta = {
      companyName: scope.company.companyName,
      companyGstin: scope.company.gstin ?? null,
      companyAddress:
        [scope.company.address, scope.company.city, scope.company.state, scope.company.pincode]
          .filter((part) => Boolean(part && String(part).trim()))
          .join(', ') || null,
      companyPhone: scope.company.phone ?? null,
      financialYear: scope.financialYear.yearName,
      ledgerAccountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountGroup: account.accountGroup,
      accountType: account.accountType,
      ledgerGstin: account.party?.gstin ?? null,
      ledgerPan: account.party?.panNumber ?? null,
      schedule: account.accountGroup.replace(/_/g, ' '),
      fromDate: toIsoDate(from),
      toDate: toIsoDate(to),
    };

    return {
      meta,
      columns,
      opening: {
        date: toIsoDate(from),
        amount: opening.amount,
        nature: opening.nature,
        signedAmount: opening.signed,
      },
      rows: rows.slice(startIndex, startIndex + pageSize),
      totals,
      totalRows: rows.length,
      page,
      pageSize,
      generatedAt: new Date().toISOString(),
    };
  }

  private async runFull(companyId: string, financialYearId: string, request: Record<string, unknown>) {
    return this.run(companyId, financialYearId, { ...request, page: 1, pageSize: 500000 });
  }

  async exportXlsx(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<{ buffer: Buffer; filename: string }> {
    const result = await this.runFull(companyId, financialYearId, request);
    const columns: XlsxColumn[] = result.columns.map((column) => ({
      key: column.key,
      label: column.label,
      type: column.type === 'date' ? 'date' : column.type === 'currency' ? 'currency' : 'text',
      width: Math.max(10, Math.round(column.weight * 1.1)),
    }));
    const rows: Array<Array<string | number>> = result.rows.map((row) =>
      result.columns.map((column) => {
        if (column.key === 'balance') return Number(row.balance) * (row.sign === 'Cr' ? -1 : 1);
        const raw = String((row as unknown as Record<string, string>)[column.key] ?? '');
        return column.type === 'currency' && raw !== '' ? Number(raw) : raw;
      })
    );
    const openingRow = result.columns.map((column, index) => {
      if (index === 0) return 'Opening Balance';
      if (column.key === 'balance') return Number(result.opening.signedAmount);
      if (column.key === 'sign') return result.opening.nature;
      return '';
    });

    const buffer = buildXlsx({
      sheetName: 'Account Ledger',
      columns,
      rows: [openingRow, ...rows],
    });
    return {
      buffer,
      filename: 'account-ledger-' + result.meta.fromDate + '-to-' + result.meta.toDate + '.xlsx',
    };
  }

  async exportPdf(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<{ buffer: Buffer; filename: string; pageCount: number }> {
    const result = await this.runFull(companyId, financialYearId, request);

    const rows: LedgerPrintRow[] = result.rows.map((row) => ({
      date: toDisplayDate(new Date(row.date + 'T00:00:00.000Z')),
      voucherLines: [row.voucherNo, row.chequeNo || row.referenceNo].filter(
        (value) => value.trim().length > 0
      ),
      type: row.type,
      bookLines: [row.bookName, row.accountName, row.particulars].filter(
        (value) => value.trim().length > 0
      ),
      debit: printAmount(row.debit),
      credit: printAmount(row.credit),
      balance: printAmount(row.balance),
      sign: row.sign,
    }));

    const { buffer, pageCount } = buildAccountLedgerPrintPdf({
      companyName: result.meta.companyName,
      companyAddress: result.meta.companyAddress,
      companyPhone: result.meta.companyPhone,
      companyGstin: result.meta.companyGstin,
      financialYear: result.meta.financialYear,
      fromDate: toDisplayDate(new Date(result.meta.fromDate + 'T00:00:00.000Z')),
      toDate: toDisplayDate(new Date(result.meta.toDate + 'T00:00:00.000Z')),
      ledgerName: result.meta.accountName,
      ledgerCode: result.meta.accountCode,
      ledgerGstin: result.meta.ledgerGstin,
      ledgerPan: result.meta.ledgerPan,
      schedule: result.meta.schedule,
      columns: LEDGER_PRINT_COLUMNS,
      opening: {
        date: '',
        amount: printAmount(result.opening.amount),
        nature: result.opening.nature,
      },
      rows,
      totals: {
        debit: printAmount(result.totals.debitTotal),
        credit: printAmount(result.totals.creditTotal),
        balance: printAmount(result.totals.closingBalance),
        nature: result.totals.closingNature,
      },
    });

    return {
      buffer,
      pageCount,
      filename: 'account-ledger-' + result.meta.fromDate + '-to-' + result.meta.toDate + '.pdf',
    };
  }
}

export const accountLedgerService = new AccountLedgerService();