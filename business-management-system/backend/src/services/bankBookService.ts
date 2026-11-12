// Phase 17 - Bank Book report service.
// Read-only: the only writes in this module are saved report preferences.
// Every amount comes from posted JournalLine rows for the selected bank ledger.

import { Prisma } from '@prisma/client';
import { ledgerReportRepository } from '../repositories/ledgerReportRepository.js';
import { AppError } from '../utils/appError.js';
import {
  accountNameOf,
  chequeReferenceOf,
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
  buildStatementPdf,
  type StatementBlock,
  type StatementCell,
} from '../utils/pdfWriter.js';
import { buildXlsx, type XlsxColumn } from '../utils/xlsxWriter.js';
import {
  BANK_BOOK_DETAIL_COLUMNS,
  BANK_BOOK_DETAIL_MODES,
  BANK_BOOK_FILTER_FIELDS,
  BANK_BOOK_REPORT_TYPES,
  BANK_BOOK_SUMMARY_COLUMNS,
  columnsForReportType,
  type BankBookBankOption,
  type BankBookDetailMode,
  type BankBookFilterField,
  type BankBookOptions,
  type BankBookReportMeta,
  type BankBookReportResult,
  type BankBookRow,
  type BankBookSavedReportRecord,
  type BankBookSummaryRow,
  type BankBookTotals,
  type LedgerReportColumnDef,
  type PartyGroupOption,
} from '../types/ledgerReportTypes.js';

const UNASSIGNED_GROUP = 'UNASSIGNED';

interface ReportScope {
  company: { id: string; companyName: string; gstin: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null; panNumber: string | null };
  financialYear: { id: string; yearName: string; startDate: Date; endDate: Date; isLocked: boolean };
}

function requireText(value: unknown, label: string): string {
  const text = String(value ?? '').trim();
  if (text.length === 0) throw new AppError(400, label + ' is required.');
  return text;
}

function parseDateInput(value: unknown, label: string): Date {
  const text = requireText(value, label);
  return new Date(text + 'T00:00:00.000Z');
}

function isIsoDate(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text);
}

export class BankBookService {
  private async loadScope(companyId: string, financialYearId: string): Promise<ReportScope> {
    const company = await ledgerReportRepository.getCompany(companyId);
    if (!company) throw new AppError(404, 'Company was not found.');
    const financialYear = await ledgerReportRepository.getFinancialYear(companyId, financialYearId);
    if (!financialYear) throw new AppError(404, 'Financial year was not found for this company.');
    return { company, financialYear };
  }

  private defaultRange(scope: ReportScope): { fromDate: string; toDate: string } {
    const start = toIsoDate(startOfDay(scope.financialYear.startDate));
    const end = toIsoDate(startOfDay(scope.financialYear.endDate));
    const today = toIsoDate(new Date());
    const capped = today > end ? end : today < start ? start : today;
    return { fromDate: start, toDate: capped };
  }

  private resolveRange(scope: ReportScope, fromDate: unknown, toDate: unknown): { from: Date; to: Date } {
    const fyStart = startOfDay(scope.financialYear.startDate);
    const fyEnd = startOfDay(scope.financialYear.endDate);
    const from = isIsoDate(fromDate) ? parseDateInput(fromDate, 'From date') : fyStart;
    const to = isIsoDate(toDate) ? parseDateInput(toDate, 'To date') : fyEnd;
    if (Number.isNaN(from.getTime())) throw new AppError(400, 'From date is not a valid calendar date.');
    if (Number.isNaN(to.getTime())) throw new AppError(400, 'To date is not a valid calendar date.');
    if (from.getTime() > to.getTime()) {
      throw new AppError(400, 'From date cannot be after the To date.');
    }
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

  private resolveColumns(
    definitions: LedgerReportColumnDef[],
    requested: unknown
  ): LedgerReportColumnDef[] {
    const available = new Set(definitions.map((column) => column.key));
    const required = definitions.filter((column) => column.required).map((column) => column.key);
    const wanted = Array.isArray(requested)
      ? requested.map((entry) => String(entry)).filter((key) => available.has(key))
      : definitions.map((column) => column.key);
    const merged = new Set<string>([...wanted, ...required]);
    return definitions.filter((column) => merged.has(column.key));
  }

  private partyGroupIdOf(line: LedgerPostingLine): string | null {
    return line.voucher?.party?.partyGroupId ?? line.debitNote?.party?.partyGroupId ?? null;
  }

  private matchesFilter(
    line: LedgerPostingLine,
    field: BankBookFilterField | null,
    text: string | null
  ): boolean {
    if (!field || !text) return true;
    const needle = text.trim().toLowerCase();
    if (needle.length === 0) return true;
    let haystack = '';
    switch (field) {
      case 'voucherNo':
        haystack = documentNumberOf(line);
        break;
      case 'accountName':
        haystack = accountNameOf(line);
        break;
      case 'particulars':
        haystack = particularsOf(line);
        break;
      case 'chequeRef':
        haystack = chequeReferenceOf(line);
        break;
      case 'sourceType':
        haystack = sourceTypeOf(line) + ' ' + voucherTypeLabel(line);
        break;
      default:
        haystack = '';
    }
    return haystack.toLowerCase().includes(needle);
  }

  private async loadBankAccount(companyId: string, bankLedgerAccountId: string) {
    const account = await ledgerReportRepository.getLedgerAccount(companyId, bankLedgerAccountId);
    if (!account) throw new AppError(404, 'The selected bank account was not found.');
    if (!account.isBankAccount) {
      throw new AppError(400, 'The selected ledger account is not a bank account.');
    }
    return account;
  }

  async getOptions(companyId: string, financialYearId: string): Promise<BankBookOptions> {
    const scope = await this.loadScope(companyId, financialYearId);
    const [accounts, groups, totals, saved] = await Promise.all([
      ledgerReportRepository.listBankAccounts(companyId),
      ledgerReportRepository.listPartyGroups(companyId),
      ledgerReportRepository.postingTotals(companyId, financialYearId),
      ledgerReportRepository.listSavedReports(companyId, financialYearId),
    ]);

    const totalsById = new Map(totals.map((row) => [row.ledgerAccountId, row]));
    const banks: BankBookBankOption[] = accounts.map((account) => {
      const row = totalsById.get(account.id);
      const opening = signedOpening(account.openingBalance, account.balanceType);
      const current = opening
        .plus(row?.debitTotal ?? new Prisma.Decimal(0))
        .minus(row?.creditTotal ?? new Prisma.Decimal(0));
      const openingSigned = signedBalance(opening);
      const currentSigned = signedBalance(current);
      return {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        bankName: account.bankName,
        branchName: account.branchName,
        bankAccountNumber: account.bankAccountNumber,
        openingBalance: openingSigned.amount,
        openingNature: openingSigned.nature,
        currentBalance: currentSigned.amount,
        currentNature: currentSigned.nature,
      };
    });

    const partyGroups: PartyGroupOption[] = groups.map((group) => ({
      id: group.id,
      groupName: group.groupName,
      isActive: group.isActive,
    }));

    const range = this.defaultRange(scope);
    return {
      banks,
      reportTypes: BANK_BOOK_REPORT_TYPES,
      detailModes: BANK_BOOK_DETAIL_MODES,
      filterFields: BANK_BOOK_FILTER_FIELDS,
      partyGroups,
      columns: BANK_BOOK_DETAIL_COLUMNS,
      summaryColumns: BANK_BOOK_SUMMARY_COLUMNS,
      defaultColumns: BANK_BOOK_DETAIL_COLUMNS.map((column) => column.key),
      requiredColumns: BANK_BOOK_DETAIL_COLUMNS.filter((column) => column.required).map(
        (column) => column.key
      ),
      defaultFromDate: range.fromDate,
      defaultToDate: range.toDate,
      financialYearStart: toIsoDate(startOfDay(scope.financialYear.startDate)),
      financialYearEnd: toIsoDate(startOfDay(scope.financialYear.endDate)),
      savedReports: saved.map((row) => this.toSavedRecord(row)),
    };
  }

  private toSavedRecord(row: {
    id: string;
    reportName: string;
    bankLedgerAccountId: string;
    bankLedgerAccount: { accountName: string };
    detailMode: BankBookDetailMode;
    reportType: string;
    filterField: string | null;
    filterText: string | null;
    partyGroupId: string | null;
    fromDate: Date | null;
    toDate: Date | null;
    columns: Prisma.JsonValue;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): BankBookSavedReportRecord {
    const columns = Array.isArray(row.columns)
      ? row.columns.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return {
      id: row.id,
      reportName: row.reportName,
      bankLedgerAccountId: row.bankLedgerAccountId,
      bankAccountName: row.bankLedgerAccount?.accountName ?? null,
      detailMode: row.detailMode,
      reportType: row.reportType,
      filterField: (row.filterField as BankBookFilterField | null) ?? null,
      filterText: row.filterText,
      partyGroupId: row.partyGroupId,
      fromDate: row.fromDate ? toIsoDate(row.fromDate) : null,
      toDate: row.toDate ? toIsoDate(row.toDate) : null,
      columns,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async run(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<BankBookReportResult> {
    const scope = await this.loadScope(companyId, financialYearId);
    const bankLedgerAccountId = requireText(request.bankLedgerAccountId, 'Bank account');
    const account = await this.loadBankAccount(companyId, bankLedgerAccountId);
    const detailMode: BankBookDetailMode = request.detailMode === 'SUMMARY' ? 'SUMMARY' : 'DETAIL';
    const reportType = String(request.reportType ?? 'DAILY').trim() || 'DAILY';
    if (!BANK_BOOK_REPORT_TYPES.some((entry) => entry.value === reportType)) {
      throw new AppError(400, 'Unsupported Bank Book report type.');
    }
    const { from, to } = this.resolveRange(scope, request.fromDate, request.toDate);

    const filterFieldRaw = String(request.filterField ?? '').trim();
    const filterField: BankBookFilterField | null = filterFieldRaw
      ? (filterFieldRaw as BankBookFilterField)
      : null;
    if (filterField && !BANK_BOOK_FILTER_FIELDS.some((entry) => entry.value === filterField)) {
      throw new AppError(400, 'Unsupported filter field.');
    }
    const filterText = request.filterText === undefined || request.filterText === null
      ? null
      : String(request.filterText).trim() || null;

    const partyGroupIdRaw = String(request.partyGroupId ?? '').trim();
    const partyGroupId = partyGroupIdRaw && partyGroupIdRaw !== UNASSIGNED_GROUP ? partyGroupIdRaw : null;
    let partyGroupName: string | null = null;
    if (partyGroupIdRaw === UNASSIGNED_GROUP) {
      // The results header must state the filter the user actually applied.
      partyGroupName = 'Unassigned';
    } else if (partyGroupId) {
      const group = (await ledgerReportRepository.listPartyGroups(companyId)).find(
        (entry) => entry.id === partyGroupId
      );
      if (!group) throw new AppError(404, 'The selected party group was not found.');
      partyGroupName = group.groupName;
    }

    const definitions = columnsForReportType('BANK_BOOK', detailMode);
    const columns = this.resolveColumns(definitions, request.columns);

    const allPostings = sortPostings(
      (await ledgerReportRepository.listPostingsThrough(companyId, financialYearId, bankLedgerAccountId, to)).filter(
        isEligiblePosting
      )
    );

    // Opening balance is always the true ledger opening before the From date:
    // filtering rows must never change the opening figure.
    let openingSigned = signedOpening(account.openingBalance, account.balanceType);
    for (const line of allPostings) {
      const postingDay = startOfDay(line.postingDate).getTime();
      if (postingDay < from.getTime()) {
        openingSigned = openingSigned.plus(line.debitAmount).minus(line.creditAmount);
      }
    }
    const opening = signedBalance(openingSigned);

    const inPeriod = allPostings.filter((line) => {
      const postingDay = startOfDay(line.postingDate).getTime();
      return postingDay >= from.getTime() && postingDay <= to.getTime();
    });

    const filtered = inPeriod.filter((line) => {
      if (!this.matchesFilter(line, filterField, filterText)) return false;
      if (!partyGroupId && partyGroupIdRaw !== UNASSIGNED_GROUP) return true;
      const lineGroupId = this.partyGroupIdOf(line);
      if (partyGroupIdRaw === UNASSIGNED_GROUP) return lineGroupId === null;
      return lineGroupId === partyGroupId;
    });

    let running = openingSigned;
    const rows: BankBookRow[] = [];
    const summaryByDate = new Map<string, { withdraw: Prisma.Decimal; deposit: Prisma.Decimal; count: number }>();
    let totalWithdraw = new Prisma.Decimal(0);
    let totalDeposit = new Prisma.Decimal(0);

    for (const line of filtered) {
      running = running.plus(line.debitAmount).minus(line.creditAmount);
      const balance = signedBalance(running);
      const date = toIsoDate(startOfDay(line.postingDate));
      rows.push({
        journalLineId: line.id,
        sourceType: sourceTypeOf(line),
        sourceId: line.voucher?.id ?? line.debitNote?.id ?? line.id,
        voucherDate: date,
        voucherNo: documentNumberOf(line),
        accountName: accountNameOf(line),
        particulars: particularsOf(line),
        chequeRefNo: chequeReferenceOf(line),
        withdraw: line.creditAmount.isZero() ? '' : moneyText(line.creditAmount),
        deposit: line.debitAmount.isZero() ? '' : moneyText(line.debitAmount),
        balance: balance.amount,
        balanceNature: balance.nature,
      });
      totalWithdraw = totalWithdraw.plus(line.creditAmount);
      totalDeposit = totalDeposit.plus(line.debitAmount);

      const bucket = summaryByDate.get(date) ?? {
        withdraw: new Prisma.Decimal(0),
        deposit: new Prisma.Decimal(0),
        count: 0,
      };
      bucket.withdraw = bucket.withdraw.plus(line.creditAmount);
      bucket.deposit = bucket.deposit.plus(line.debitAmount);
      bucket.count += 1;
      summaryByDate.set(date, bucket);
    }

    const summaryRows: BankBookSummaryRow[] = [];
    let summaryRunning = openingSigned;
    for (const date of Array.from(summaryByDate.keys()).sort()) {
      const bucket = summaryByDate.get(date)!;
      summaryRunning = summaryRunning.plus(bucket.deposit).minus(bucket.withdraw);
      const balance = signedBalance(summaryRunning);
      const net = bucket.deposit.minus(bucket.withdraw);
      summaryRows.push({
        date,
        totalWithdraw: moneyText(bucket.withdraw),
        totalDeposit: moneyText(bucket.deposit),
        netMovement: moneyText(net),
        closingBalance: balance.amount,
        closingNature: balance.nature,
        transactionCount: bucket.count,
      });
    }

    const closing = signedBalance(running);
    const totals: BankBookTotals = {
      totalWithdraw: moneyText(totalWithdraw),
      totalDeposit: moneyText(totalDeposit),
      closingBalance: closing.amount,
      closingNature: closing.nature,
      transactionCount: filtered.length,
    };

    const page = Math.max(1, Number(request.page ?? 1) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(request.pageSize ?? 100) || 100));
    const source = detailMode === 'SUMMARY' ? summaryRows : rows;
    const startIndex = (page - 1) * pageSize;
    const pagedRows = source.slice(startIndex, startIndex + pageSize);

    const meta: BankBookReportMeta = {
      companyName: scope.company.companyName,
      companyGstin: scope.company.gstin ?? null,
      companyAddress:
        [scope.company.address, scope.company.city, scope.company.state, scope.company.pincode]
          .filter((part) => Boolean(part && String(part).trim()))
          .join(', ') || null,
      financialYear: scope.financialYear.yearName,
      bankLedgerAccountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      bankName: account.bankName,
      branchName: account.branchName,
      bankAccountNumber: account.bankAccountNumber,
      fromDate: toIsoDate(from),
      toDate: toIsoDate(to),
      detailMode,
      reportType,
      filterField,
      filterText,
      partyGroupId: partyGroupIdRaw || null,
      partyGroupName,
    };

    if (detailMode === 'SUMMARY') {
      return {
        meta,
        columns,
        opening: {
          date: toIsoDate(from),
          amount: opening.amount,
          nature: opening.nature,
          signedAmount: opening.signed,
        },
        rows: [],
        summaryRows: pagedRows as BankBookSummaryRow[],
        totals,
        totalRows: summaryRows.length,
        page,
        pageSize,
        generatedAt: new Date().toISOString(),
      };
    }

    return {
      meta,
      columns,
      opening: {
        date: toIsoDate(from),
        amount: opening.amount,
        nature: opening.nature,
        signedAmount: opening.signed,
      },
      rows: pagedRows as BankBookRow[],
      summaryRows: [],
      totals,
      totalRows: rows.length,
      page,
      pageSize,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Full (unpaginated) dataset used by the PDF and Excel exports. */
  private async runFull(companyId: string, financialYearId: string, request: Record<string, unknown>) {
    const result = await this.run(companyId, financialYearId, {
      ...request,
      page: 1,
      pageSize: 500000,
    });
    return result;
  }

  private formatCell(value: string, column: LedgerReportColumnDef): string {
    if (column.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return toDisplayDate(new Date(value + 'T00:00:00.000Z'));
    }
    return value;
  }

  async exportXlsx(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<{ buffer: Buffer; filename: string }> {
    const result = await this.runFull(companyId, financialYearId, request);
    const detail = result.meta.detailMode === 'DETAIL';
    const columns: XlsxColumn[] = result.columns.map((column) => ({
      key: column.key,
      label: column.label,
      type: column.type === 'date' ? 'date' : column.type === 'currency' ? 'currency' : 'text',
      width: Math.max(10, Math.round(column.weight * 1.1)),
    }));
    const balanceKey = detail ? 'balance' : 'closingBalance';
    const toArray = (row: Record<string, string>, balance: string, nature: string) =>
      result.columns.map((column) => {
        if (column.key === balanceKey) {
          return Number(balance) * (nature === 'Cr' ? -1 : 1);
        }
        const raw = String(row[column.key] ?? '');
        return column.type === 'currency' && raw !== '' ? Number(raw) : raw;
      });

    const dataRows: Array<Array<string | number>> = detail
      ? result.rows.map((row) =>
          toArray(row as unknown as Record<string, string>, row.balance, row.balanceNature)
        )
      : result.summaryRows.map((row) =>
          toArray(row as unknown as Record<string, string>, row.closingBalance, row.closingNature)
        );

    const openingRow = result.columns.map((column, index) => {
      if (index === 0) return 'Opening Balance';
      if (column.key === balanceKey) return Number(result.opening.signedAmount);
      return '';
    });

    const buffer = buildXlsx({
      sheetName: detail ? 'Bank Book' : 'Bank Book Summary',
      columns,
      rows: [openingRow, ...dataRows],
    });
    return {
      buffer,
      filename: 'bank-book-' + result.meta.fromDate + '-to-' + result.meta.toDate + '.xlsx',
    };
  }

  async exportPdf(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>
  ): Promise<{ buffer: Buffer; filename: string; pageCount: number }> {
    const result = await this.runFull(companyId, financialYearId, request);
    const scope = await this.loadScope(companyId, financialYearId);
    const detail = result.meta.detailMode === 'DETAIL';

    const tableColumns: StatementCell[] = result.columns.map((column) => ({
      text: column.label,
      weight: column.weight,
      align: column.align,
    }));

    const rows: string[][] = detail
      ? result.rows.map((row) =>
          result.columns.map((column) => this.formatCell(String((row as unknown as Record<string, string>)[column.key] ?? ''), column))
        )
      : result.summaryRows.map((row) =>
          result.columns.map((column) => this.formatCell(String((row as unknown as Record<string, string>)[column.key] ?? ''), column))
        );

    // Balance columns carry their nature in the printed statement.
    const balanceIndex = result.columns.findIndex((column) => column.key === (detail ? 'balance' : 'closingBalance'));
    if (balanceIndex >= 0) {
      const natureSource = detail ? result.rows : result.summaryRows;
      rows.forEach((cells, index) => {
        const nature = detail
          ? (natureSource as BankBookRow[])[index]?.balanceNature
          : (natureSource as BankBookSummaryRow[])[index]?.closingNature;
        if (cells[balanceIndex] && nature) cells[balanceIndex] = cells[balanceIndex] + ' ' + nature;
      });
    }

    const totalRow: StatementCell[] = result.columns.map((column) => ({
      text: '',
      weight: column.weight,
      align: column.align,
    }));
    const withdrawIndex = result.columns.findIndex((column) => column.key === (detail ? 'withdraw' : 'totalWithdraw'));
    const depositIndex = result.columns.findIndex((column) => column.key === (detail ? 'deposit' : 'totalDeposit'));
    if (withdrawIndex >= 0) totalRow[withdrawIndex].text = result.totals.totalWithdraw;
    if (depositIndex >= 0) totalRow[depositIndex].text = result.totals.totalDeposit;
    if (balanceIndex >= 0) {
      totalRow[balanceIndex].text = result.totals.closingBalance + ' ' + result.totals.closingNature;
    }
    totalRow[0].text = 'Total';

    const blocks: StatementBlock[] = [
      {
        type: 'row',
        cells: [
          { text: 'Opening Balance as on ' + toDisplayDate(new Date(result.meta.fromDate + 'T00:00:00.000Z')), weight: 6, align: 'left', bold: true },
          { text: result.opening.amount + ' ' + result.opening.nature, weight: 2, align: 'right', bold: true },
        ],
        size: 9,
      },
      {
        type: 'table',
        columns: tableColumns,
        rows,
        emptyText: 'No transactions in the selected period',
        totalRow,
      },
      {
        type: 'note',
        text:
          'Total Withdraw: ' +
          result.totals.totalWithdraw +
          '    Total Deposit: ' +
          result.totals.totalDeposit +
          '    Closing Balance: ' +
          result.totals.closingBalance +
          ' ' +
          result.totals.closingNature +
          '    Transactions: ' +
          String(result.totals.transactionCount),
        size: 8,
        bold: true,
      },
    ];

    const orientation = request.pdfOrientation === 'landscape' ? 'landscape' : 'portrait';
    const { buffer, pageCount } = buildStatementPdf({
      orientation,
      header: {
        companyName: scope.company.companyName,
        companyAddress: [scope.company.address, scope.company.city, scope.company.state, scope.company.pincode]
          .filter((part) => Boolean(part && String(part).trim()))
          .join(', '),
        companyGstin: scope.company.gstin ?? '',
        financialYear: scope.financialYear.yearName,
        title: 'BANK BOOK',
        bankName: result.meta.accountName,
        period:
          'From ' +
          toDisplayDate(new Date(result.meta.fromDate + 'T00:00:00.000Z')) +
          ' To ' +
          toDisplayDate(new Date(result.meta.toDate + 'T00:00:00.000Z')),
      },
      blocks,
    });

    return {
      buffer,
      pageCount,
      filename: 'bank-book-' + result.meta.fromDate + '-to-' + result.meta.toDate + '.pdf',
    };
  }

  async listSavedReports(companyId: string, financialYearId: string): Promise<BankBookSavedReportRecord[]> {
    const saved = await ledgerReportRepository.listSavedReports(companyId, financialYearId);
    return saved.map((row) => this.toSavedRecord(row));
  }

  async saveReport(
    companyId: string,
    financialYearId: string,
    request: Record<string, unknown>,
    savedReportId: string | null
  ): Promise<BankBookSavedReportRecord> {
    const scope = await this.loadScope(companyId, financialYearId);
    const reportName = requireText(request.reportName, 'Report name');
    if (reportName.length > 60) throw new AppError(400, 'Report name must be 60 characters or fewer.');
    const bankLedgerAccountId = requireText(request.bankLedgerAccountId, 'Bank account');
    await this.loadBankAccount(companyId, bankLedgerAccountId);
    const detailMode: BankBookDetailMode = request.detailMode === 'SUMMARY' ? 'SUMMARY' : 'DETAIL';
    const reportType = String(request.reportType ?? 'DAILY').trim() || 'DAILY';
    if (!BANK_BOOK_REPORT_TYPES.some((entry) => entry.value === reportType)) {
      throw new AppError(400, 'Unsupported Bank Book report type.');
    }
    const { from, to } = this.resolveRange(scope, request.fromDate, request.toDate);

    const filterFieldRaw = String(request.filterField ?? '').trim();
    const filterField = filterFieldRaw || null;
    if (filterField && !BANK_BOOK_FILTER_FIELDS.some((entry) => entry.value === filterField)) {
      throw new AppError(400, 'Unsupported filter field.');
    }
    const partyGroupIdRaw = String(request.partyGroupId ?? '').trim();
    const partyGroupId = partyGroupIdRaw && partyGroupIdRaw !== UNASSIGNED_GROUP ? partyGroupIdRaw : null;
    if (partyGroupId) {
      const group = (await ledgerReportRepository.listPartyGroups(companyId)).find(
        (entry) => entry.id === partyGroupId
      );
      if (!group) throw new AppError(404, 'The selected party group was not found.');
    }

    const columns = Array.isArray(request.columns)
      ? request.columns.map((entry) => String(entry))
      : null;

    const duplicate = await ledgerReportRepository.findSavedReportByName(
      companyId,
      reportName,
      savedReportId ?? undefined
    );
    if (duplicate) throw new AppError(409, 'A saved report with this name already exists.');

    if (savedReportId) {
      const existing = await ledgerReportRepository.getSavedReport(companyId, savedReportId);
      if (!existing) throw new AppError(404, 'The saved report was not found.');
    }

    const isDefault = request.isDefault === true;
    if (isDefault) {
      await ledgerReportRepository.clearDefaultSavedReports(
        companyId,
        financialYearId,
        savedReportId ?? undefined
      );
    }

    const payload = {
      companyId,
      financialYearId,
      reportName,
      bankLedgerAccountId,
      detailMode,
      reportType,
      filterField,
      filterText:
        request.filterText === undefined || request.filterText === null
          ? null
          : String(request.filterText).trim() || null,
      partyGroupId,
      fromDate: from,
      toDate: to,
      columns,
      isDefault,
      createdBy: null,
    };

    const row = savedReportId
      ? await ledgerReportRepository.updateSavedReport(savedReportId, payload, columns)
      : await ledgerReportRepository.createSavedReport(payload);
    return this.toSavedRecord(row);
  }

  async deleteSavedReport(companyId: string, id: string): Promise<void> {
    const existing = await ledgerReportRepository.getSavedReport(companyId, id);
    if (!existing) throw new AppError(404, 'The saved report was not found.');
    await ledgerReportRepository.deleteSavedReport(id);
  }
}

export const bankBookService = new BankBookService();
