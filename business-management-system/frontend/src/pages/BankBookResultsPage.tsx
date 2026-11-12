import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Printer,
  RefreshCcw,
  Settings2,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  exportBankBookPdf,
  exportBankBookXlsx,
  getAccountLedgerOptions,
  runBankBook,
} from '../services/api';
import type {
  AccountLedgerOptions,
  AccountLedgerPageState,
  BankBookPageState,
  BankBookReportResult,
  BankBookRow,
  BankBookSummaryRow,
  LedgerReportColumnDef,
} from '../types/ledgerReports';
import {
  ACCOUNT_LEDGER_STATE_KEY,
  BANK_BOOK_STATE_KEY,
} from '../types/ledgerReports';
import { LedgerLookupDialog } from '../components/LedgerLookupDialog';
import {
  balanceText,
  displayDate,
  downloadBlob,
  formatMoney,
  formatSignedMoney,
  blocksPageKey,
  isTypingTarget,
  readError,
  readPageState,
  writePageState,
} from './ledgerReportShared';

const EMPTY_LEDGER_OPTIONS: AccountLedgerOptions | null = null;

const columnAlignClass = (column: LedgerReportColumnDef): string => {
  if (column.align === 'right') return 'text-right';
  if (column.align === 'center') return 'text-center';
  return 'text-left';
};

const cellValue = (
  column: LedgerReportColumnDef,
  row: BankBookRow | BankBookSummaryRow,
  isSummary: boolean
): string => {
  if (isSummary) {
    const summary = row as BankBookSummaryRow;
    switch (column.key) {
      case 'date':
        return displayDate(summary.date);
      case 'totalWithdraw':
        return formatMoney(summary.totalWithdraw);
      case 'totalDeposit':
        return formatMoney(summary.totalDeposit);
      case 'netMovement':
        return formatSignedMoney(summary.netMovement);
      case 'closingBalance':
        return balanceText(summary.closingBalance, summary.closingNature);
      default:
        return '';
    }
  }
  const detail = row as BankBookRow;
  switch (column.key) {
    case 'voucherDate':
      return displayDate(detail.voucherDate);
    case 'voucherNo':
      return detail.voucherNo;
    case 'accountName':
      return detail.accountName;
    case 'particulars':
      return detail.particulars;
    case 'chequeRefNo':
      return detail.chequeRefNo;
    case 'withdraw':
      return formatMoney(detail.withdraw);
    case 'deposit':
      return formatMoney(detail.deposit);
    case 'balance':
      return balanceText(detail.balance, detail.balanceNature);
    default:
      return '';
  }
};

const totalValue = (column: LedgerReportColumnDef, result: BankBookReportResult): string => {
  switch (column.key) {
    case 'voucherNo':
    case 'particulars':
      return 'Total';
    case 'withdraw':
    case 'totalWithdraw':
      return formatMoney(result.totals.totalWithdraw);
    case 'deposit':
    case 'totalDeposit':
      return formatMoney(result.totals.totalDeposit);
    case 'netMovement':
      return formatSignedMoney(
        Number(result.totals.totalDeposit) - Number(result.totals.totalWithdraw)
      );
    case 'balance':
    case 'closingBalance':
      return balanceText(result.totals.closingBalance, result.totals.closingNature);
    default:
      return '';
  }
};

export const BankBookResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const { ledgerId } = useParams<{ ledgerId: string }>();
  const { activeFinancialYear } = useCompany();

  const [state, setState] = useState<BankBookPageState | null>(() => {
    const stored = readPageState<BankBookPageState>(BANK_BOOK_STATE_KEY);
    if (!stored || !ledgerId) return stored;
    if (stored.request.bankLedgerAccountId === ledgerId) return stored;
    return {
      ...stored,
      request: { ...stored.request, bankLedgerAccountId: ledgerId, page: 1 },
    };
  });
  const [result, setResult] = useState<BankBookReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [landscape, setLandscape] = useState<boolean>(state?.landscape ?? false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [ledgerOptions, setLedgerOptions] = useState<AccountLedgerOptions | null>(
    EMPTY_LEDGER_OPTIONS
  );
  const [lookupFrom, setLookupFrom] = useState(state?.request.fromDate ?? '');
  const [lookupTo, setLookupTo] = useState(state?.request.toDate ?? '');
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  useEffect(() => {
    if (!state) navigate('/reports/bank-book', { replace: true });
  }, [state, navigate]);

  const request = state?.request ?? null;

  const run = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError(null);
    setSelectedIndex(-1);
    try {
      const data = await runBankBook(request);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(readError(err, 'Failed to generate the Bank Book.'));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void run();
  }, [run]);

  const isSummary = result?.meta.detailMode === 'SUMMARY';
  const columns = result?.columns ?? [];

  const goToPage = useCallback(
    (page: number) => {
      if (!state) return;
      const next: BankBookPageState = {
        ...state,
        request: { ...state.request, page },
      };
      writePageState(BANK_BOOK_STATE_KEY, next);
      setState(next);
    },
    [state]
  );

  const totalPages = result ? Math.max(1, Math.ceil(result.totalRows / result.pageSize)) : 1;
  const currentPage = result?.page ?? 1;

  const openLookup = useCallback(async () => {
    if (lookupOpen) return;
    setLookupOpen(true);
    if (ledgerOptions) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const data = await getAccountLedgerOptions();
      setLedgerOptions(data);
    } catch (err) {
      setLookupError(readError(err, 'Failed to load the ledger accounts.'));
    } finally {
      setLookupLoading(false);
    }
  }, [lookupOpen, ledgerOptions]);

  const handleShowLedger = useCallback(
    (accountId: string) => {
      if (!ledgerOptions) return;
      const fromDate = lookupFrom || ledgerOptions.defaultFromDate;
      const toDate = lookupTo || ledgerOptions.defaultToDate;
      const pageState: AccountLedgerPageState = {
        request: {
          ledgerAccountId: accountId,
          fromDate,
          toDate,
          columns: ledgerOptions.defaultColumns,
          page: 1,
          pageSize: 200,
        },
        layoutName: 'Standard',
      };
      writePageState(ACCOUNT_LEDGER_STATE_KEY, pageState);
      setLookupOpen(false);
      navigate('/reports/account-ledger/' + accountId);
    },
    [ledgerOptions, lookupFrom, lookupTo, navigate]
  );

  const downloadPdf = useCallback(async () => {
    if (!request || busy) return;
    setBusy('pdf');
    setError(null);
    try {
      const file = await exportBankBookPdf({
        ...request,
        pdfOrientation: landscape ? 'landscape' : 'portrait',
      });
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Bank Book PDF.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy, landscape]);

  const downloadXlsx = useCallback(async () => {
    if (!request || busy) return;
    setBusy('xlsx');
    setError(null);
    try {
      const file = await exportBankBookXlsx(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Bank Book Excel file.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy]);

  const openPrintPreview = useCallback(() => {
    if (!state || !result) return;
    const next: BankBookPageState = { ...state, landscape };
    writePageState(BANK_BOOK_STATE_KEY, next);
    navigate('/reports/bank-book/' + result.meta.bankLedgerAccountId + '/print');
  }, [state, result, landscape, navigate]);

  const rows = isSummary ? result?.summaryRows ?? [] : result?.rows ?? [];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (lookupOpen) {
          setLookupOpen(false);
          return;
        }
        navigate('/reports/bank-book');
        return;
      }
      if (event.key === 'PageDown' && !blocksPageKey(event.target)) {
        event.preventDefault();
        openPrintPreview();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
        event.preventDefault();
        void openLookup();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(rows.length - 1, prev + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rows.length, lookupOpen, openLookup, openPrintPreview, navigate]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const element = rowRefs.current[selectedIndex];
    if (element) element.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const filterSummary = useMemo(() => {
    if (!result) return null;
    const parts: string[] = [];
    if (result.meta.filterField && result.meta.filterText) {
      parts.push(result.meta.filterField + ': ' + result.meta.filterText);
    }
    if (result.meta.partyGroupName) parts.push('Party Group: ' + result.meta.partyGroupName);
    return parts.length > 0 ? parts.join(' | ') : null;
  }, [result]);

  if (!state) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">Bank Book</span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {activeFinancialYear?.yearName ?? result?.meta.financialYear ?? 'FY'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('/reports/bank-book/config')}
            className="flex h-6 items-center gap-1 rounded border border-emerald-300/60 px-1.5 text-[10px] font-bold text-emerald-100 hover:bg-[#356e65]"
          >
            <Settings2 className="h-3 w-3" /> Customize
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports/bank-book')}
            title="Close (Esc)"
            className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#789d93] bg-[#eef5f2] px-2 py-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          <span className="flex items-center gap-1 font-bold text-slate-800">
            <Landmark className="h-3 w-3 text-[#2c5f57]" />
            {result?.meta.accountName ?? 'Bank Book'}
            <span className="font-mono text-[10px] font-normal text-slate-500">
              {result?.meta.accountCode ?? ''}
            </span>
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            {displayDate(result?.meta.fromDate ?? state.request.fromDate)} -{' '}
            {displayDate(result?.meta.toDate ?? state.request.toDate)}
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
            {isSummary ? 'Summary' : 'Detail'}
          </span>
          {filterSummary && (
            <span className="truncate text-[10px] font-semibold text-[#2c5f57]">{filterSummary}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setLandscape((prev) => !prev)}
            title="Toggle A4 orientation for the print preview and PDF"
            className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeftRight className="h-3 w-3" /> {landscape ? 'Landscape' : 'Portrait'}
          </button>
          <button
            type="button"
            onClick={() => void openLookup()}
            title="Account Ledger lookup (Ctrl+L)"
            className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
          >
            <Landmark className="h-3 w-3" /> Ledger (Ctrl+L)
          </button>
          <button
            type="button"
            onClick={() => void downloadXlsx()}
            disabled={busy !== null || !result}
            className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            {busy === 'xlsx' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3 w-3" />
            )}
            Excel
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={busy !== null || !result}
            className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            {busy === 'pdf' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            PDF
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            title="Re-run the report"
            className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <RefreshCcw className={'h-3 w-3 ' + (loading ? 'animate-spin' : '')} /> Refresh
          </button>
          <button
            type="button"
            onClick={openPrintPreview}
            disabled={!result}
            className="flex h-6 items-center gap-1 rounded bg-[#2c5f57] px-1.5 text-[10px] font-bold text-white hover:bg-[#244d47] disabled:opacity-40"
          >
            <Printer className="h-3 w-3" /> Print Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating Bank Book...
          </div>
        ) : !result ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded border border-red-300 bg-white p-4 text-center">
              <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-600" />
              <p className="font-bold text-red-700">The Bank Book could not be generated.</p>
              <p className="mt-1 text-slate-600">{error ?? 'Unknown error.'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <div className="rounded border border-[#789d93] bg-white px-2 py-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Opening Balance
                </p>
                <p className="font-mono text-[12px] font-bold text-slate-900">
                  {balanceText(result.opening.amount, result.opening.nature)}
                </p>
              </div>
              <div className="rounded border border-[#789d93] bg-white px-2 py-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Total Withdraw
                </p>
                <p className="font-mono text-[12px] font-bold text-rose-700">
                  {formatMoney(result.totals.totalWithdraw)}
                </p>
              </div>
              <div className="rounded border border-[#789d93] bg-white px-2 py-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Total Deposit
                </p>
                <p className="font-mono text-[12px] font-bold text-emerald-700">
                  {formatMoney(result.totals.totalDeposit)}
                </p>
              </div>
              <div className="rounded border border-[#789d93] bg-white px-2 py-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Closing Balance
                </p>
                <p className="font-mono text-[12px] font-bold text-slate-900">
                  {balanceText(result.totals.closingBalance, result.totals.closingNature)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded border border-[#789d93] bg-white">
              <table className="w-full min-w-[820px] border-collapse text-[11px]">
                <thead className="bg-[#e8f1ed] text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        style={{ width: column.weight + '%' }}
                        className={'whitespace-nowrap border-b border-[#789d93] px-2 py-1 ' + columnAlignClass(column)}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200 bg-[#f7fbf9]">
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={
                          'px-2 py-1 font-semibold text-slate-700 ' + columnAlignClass(column)
                        }
                      >
                        {index === 0 ? (
                          <span className="flex items-center gap-1">
                            Opening Balance
                            <span className="font-mono text-[9px] font-normal text-slate-500">
                              {displayDate(result.opening.date)}
                            </span>
                          </span>
                        ) : column.key === 'balance' || column.key === 'closingBalance' ? (
                          <span className="font-mono">
                            {balanceText(result.opening.amount, result.opening.nature)}
                          </span>
                        ) : column.key === 'voucherNo' || column.key === 'date' ? (
                          ''
                        ) : null}
                      </td>
                    ))}
                  </tr>

                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, columns.length)}
                        className="px-2 py-6 text-center text-[11px] text-slate-500"
                      >
                        No posted transaction matches this report period and filter.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => {
                      const rowKey =
                        isSummary
                          ? 'summary-' + (row as BankBookSummaryRow).date
                          : (row as BankBookRow).journalLineId;
                      return (
                        <tr
                          key={rowKey}
                          ref={(element) => {
                            rowRefs.current[index] = element;
                          }}
                          onClick={() => setSelectedIndex(index)}
                          className={
                            'cursor-pointer border-b border-slate-100 ' +
                            (index === selectedIndex
                              ? 'bg-[#dceee8] ring-1 ring-inset ring-[#2c5f57]'
                              : index % 2 === 1
                                ? 'bg-slate-50/60 hover:bg-[#f1f8f5]'
                                : 'hover:bg-[#f1f8f5]')
                          }
                        >
                          {columns.map((column) => (
                            <td
                              key={column.key}
                              className={
                                'px-2 py-1 ' +
                                columnAlignClass(column) +
                                (column.type === 'currency'
                                  ? ' whitespace-nowrap font-mono'
                                  : column.key === 'voucherDate' || column.key === 'date'
                                    ? ' whitespace-nowrap font-mono text-[10px]'
                                    : '')
                              }
                            >
                              {cellValue(column, row, isSummary === true)}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#2c5f57] bg-[#e8f1ed] font-bold text-slate-900">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={'px-2 py-1 ' + columnAlignClass(column) + ' whitespace-nowrap'}
                      >
                        {totalValue(column, result)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#789d93] bg-white px-2 py-1 text-[10px] text-slate-600">
              <span>
                {result.totalRows} row(s) across the full filtered period. Totals cover every row, not
                only this page.
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className="flex h-6 items-center gap-0.5 rounded border border-[#789d93] bg-white px-1.5 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" /> Prev
                </button>
                <span className="font-mono">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                  className="flex h-6 items-center gap-0.5 rounded border border-[#789d93] bg-white px-1.5 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5 text-[10px] text-slate-500">
        <span>Ctrl+L = Account Ledger | Arrow Up/Down = select row | PageDown = print preview | Esc = close</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('/reports/bank-book')}
            className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports/bank-book/config')}
            className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Customize
          </button>
          <button
            type="button"
            onClick={openPrintPreview}
            disabled={!result}
            className="flex h-7 items-center gap-1 rounded bg-[#2c5f57] px-2 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:opacity-50"
          >
            <Printer className="h-3 w-3" /> Print Preview
          </button>
        </div>
      </footer>

      <LedgerLookupDialog
        open={lookupOpen}
        accounts={ledgerOptions?.accounts ?? []}
        loading={lookupLoading}
        error={lookupError}
        fromDate={lookupFrom}
        toDate={lookupTo}
        financialYearStart={ledgerOptions?.financialYearStart ?? state.request.fromDate}
        financialYearEnd={ledgerOptions?.financialYearEnd ?? state.request.toDate}
        onFromDateChange={setLookupFrom}
        onToDateChange={setLookupTo}
        onClose={() => setLookupOpen(false)}
        onShow={(account) => handleShowLedger(account.id)}
      />
    </div>
  );
};

export default BankBookResultsPage;