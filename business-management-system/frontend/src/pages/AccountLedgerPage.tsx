import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCcw,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  exportAccountLedgerPdf,
  exportAccountLedgerXlsx,
  getAccountLedgerOptions,
  runAccountLedger,
} from '../services/api';
import type {
  AccountLedgerPageState,
  AccountLedgerReportResult,
  AccountLedgerRow,
  LedgerReportColumnDef,
} from '../types/ledgerReports';
import { ACCOUNT_LEDGER_STATE_KEY } from '../types/ledgerReports';
import {
  balanceText,
  displayDate,
  downloadBlob,
  formatMoney,
  blocksPageKey,
  isTypingTarget,
  readError,
  readPageState,
  writePageState,
} from './ledgerReportShared';

const alignClass = (column: LedgerReportColumnDef): string => {
  if (column.align === 'right') return 'text-right';
  if (column.align === 'center') return 'text-center';
  return 'text-left';
};

const cellValue = (column: LedgerReportColumnDef, row: AccountLedgerRow): string => {
  switch (column.key) {
    case 'date':
      return displayDate(row.date);
    case 'voucherNo':
      return row.voucherNo;
    case 'chequeNo':
      return row.chequeNo;
    case 'type':
      return row.type;
    case 'bookName':
      return row.bookName;
    case 'debit':
      return formatMoney(row.debit);
    case 'credit':
      return formatMoney(row.credit);
    case 'balance':
      return formatMoney(row.balance);
    case 'sign':
      return row.sign;
    default:
      return '';
  }
};

const totalValue = (column: LedgerReportColumnDef, result: AccountLedgerReportResult): string => {
  switch (column.key) {
    case 'voucherNo':
    case 'chequeNo':
    case 'bookName':
      return 'Total';
    case 'debit':
      return formatMoney(result.totals.debitTotal);
    case 'credit':
      return formatMoney(result.totals.creditTotal);
    case 'balance':
      return formatMoney(result.totals.closingBalance);
    case 'sign':
      return result.totals.closingNature;
    default:
      return '';
  }
};

export const AccountLedgerPage: React.FC = () => {
  const navigate = useNavigate();
  const { ledgerId } = useParams<{ ledgerId: string }>();
  const { activeFinancialYear } = useCompany();

  const [state, setState] = useState<AccountLedgerPageState | null>(() => {
    const stored = readPageState<AccountLedgerPageState>(ACCOUNT_LEDGER_STATE_KEY);
    if (!stored || !ledgerId) return stored;
    if (stored.request.ledgerAccountId === ledgerId) return stored;
    return { ...stored, request: { ...stored.request, ledgerAccountId: ledgerId, page: 1 } };
  });
  const [result, setResult] = useState<AccountLedgerReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  useEffect(() => {
    if (state || !ledgerId) return;
    let cancelled = false;
    const build = async () => {
      try {
        const options = await getAccountLedgerOptions();
        if (cancelled) return;
        const account = options.accounts.find((entry) => entry.id === ledgerId);
        if (!account) {
          setError('The selected ledger account is not available for this company.');
          setLoading(false);
          return;
        }
        setState({
          request: {
            ledgerAccountId: account.id,
            fromDate: options.defaultFromDate,
            toDate: options.defaultToDate,
            columns: options.defaultColumns,
            page: 1,
            pageSize: 200,
          },
          layoutName: 'Standard',
        });
      } catch (err) {
        if (cancelled) return;
        setError(readError(err, 'Failed to load the ledger account.'));
        setLoading(false);
      }
    };
    void build();
    return () => {
      cancelled = true;
    };
  }, [state, ledgerId]);

  useEffect(() => {
    if (!state && !ledgerId) navigate('/reports/account-ledger', { replace: true });
  }, [state, ledgerId, navigate]);

  const request = state?.request ?? null;

  const run = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError(null);
    setSelectedIndex(-1);
    try {
      const data = await runAccountLedger(request);
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(readError(err, 'Failed to generate the Account Ledger.'));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void run();
  }, [run]);

  const columns = result?.columns ?? [];
  const rows = result?.rows ?? [];
  const totalPages = result ? Math.max(1, Math.ceil(result.totalRows / result.pageSize)) : 1;
  const currentPage = result?.page ?? 1;

  const goToPage = useCallback(
    (page: number) => {
      if (!state) return;
      const next: AccountLedgerPageState = { ...state, request: { ...state.request, page } };
      writePageState(ACCOUNT_LEDGER_STATE_KEY, next);
      setState(next);
    },
    [state]
  );

  const openPrintPreview = useCallback(() => {
    if (!state || !result) return;
    navigate('/reports/account-ledger/' + result.meta.ledgerAccountId + '/print');
  }, [state, result, navigate]);

  const downloadPdf = useCallback(async () => {
    if (!request || busy) return;
    setBusy('pdf');
    setError(null);
    try {
      const file = await exportAccountLedgerPdf(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Account Ledger PDF.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy]);

  const downloadXlsx = useCallback(async () => {
    if (!request || busy) return;
    setBusy('xlsx');
    setError(null);
    try {
      const file = await exportAccountLedgerXlsx(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Account Ledger Excel file.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate('/reports/account-ledger');
        return;
      }
      if (event.key === 'PageDown' && !blocksPageKey(event.target)) {
        event.preventDefault();
        openPrintPreview();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(rows.length - 1, prev + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rows.length, openPrintPreview, navigate]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const element = rowRefs.current[selectedIndex];
    if (element) element.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const openingSigned = useMemo(() => {
    if (!result) return '0.00';
    return balanceText(result.opening.amount, result.opening.nature);
  }, [result]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">Account Ledger</span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {activeFinancialYear?.yearName ?? result?.meta.financialYear ?? 'FY'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reports/account-ledger')}
          title="Close (Esc)"
          className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#789d93] bg-[#eef5f2] px-2 py-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          <span className="font-bold text-slate-800">
            {result?.meta.accountName ?? 'Account Ledger'}
            <span className="ml-1 font-mono text-[10px] font-normal text-slate-500">
              {result?.meta.accountCode ?? ''}
            </span>
          </span>
          {result && (
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
              {result.meta.accountGroup.replace(/_/g, ' ')}
            </span>
          )}
          <span className="font-mono text-[10px] text-slate-600">
            {displayDate(result?.meta.fromDate ?? state?.request.fromDate)} -{' '}
            {displayDate(result?.meta.toDate ?? state?.request.toDate)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
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
            <Loader2 className="h-4 w-4 animate-spin" /> Generating Account Ledger...
          </div>
        ) : !result ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded border border-red-300 bg-white p-4 text-center">
              <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-600" />
              <p className="font-bold text-red-700">The Account Ledger could not be generated.</p>
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
                <p className="font-mono text-[12px] font-bold text-slate-900">{openingSigned}</p>
              </div>
              <div className="rounded border border-[#789d93] bg-white px-2 py-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Total Debit
                </p>
                <p className="font-mono text-[12px] font-bold text-slate-900">
                  {formatMoney(result.totals.debitTotal)}
                </p>
              </div>
              <div className="rounded border border-[#789d93] bg-white px-2 py-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Total Credit
                </p>
                <p className="font-mono text-[12px] font-bold text-slate-900">
                  {formatMoney(result.totals.creditTotal)}
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
              <table className="w-full min-w-[900px] border-collapse text-[11px]">
                <thead className="bg-[#e8f1ed] text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        style={{ width: column.weight + '%' }}
                        className={'whitespace-nowrap border-b border-[#789d93] px-2 py-1 ' + alignClass(column)}
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
                        className={'px-2 py-1 font-semibold text-slate-700 ' + alignClass(column)}
                      >
                        {index === 0 ? (
                          <span className="flex items-center gap-1">
                            Opening Balance
                            <span className="font-mono text-[9px] font-normal text-slate-500">
                              {displayDate(result.opening.date)}
                            </span>
                          </span>
                        ) : column.key === 'balance' ? (
                          <span className="font-mono">{formatMoney(result.opening.amount)}</span>
                        ) : column.key === 'sign' ? (
                          result.opening.nature
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
                        No posted transaction matches this report period.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr
                        key={row.journalLineId}
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
                              alignClass(column) +
                              (column.type === 'currency'
                                ? ' whitespace-nowrap font-mono'
                                : column.key === 'date'
                                  ? ' whitespace-nowrap font-mono text-[10px]'
                                  : '')
                            }
                          >
                            {cellValue(column, row)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#2c5f57] bg-[#e8f1ed] font-bold text-slate-900">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={'px-2 py-1 ' + alignClass(column) + ' whitespace-nowrap'}
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
                {result.totalRows} row(s) across the full period. Debit and credit totals cover every
                row, not only this page.
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
        <span>Arrow Up/Down = select row | PageDown = print preview | Esc = close</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('/reports/account-ledger')}
            className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Close
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
    </div>
  );
};

export default AccountLedgerPage;