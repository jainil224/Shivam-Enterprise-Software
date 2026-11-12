import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Eye,
  Loader2,
  Plus,
  Printer,
  RefreshCcw,
  Settings2,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getBankBookOptions, runBankBook } from '../services/api';
import type {
  BankBookOptions,
  BankBookPageState,
  BankBookRunRequest,
  BankBookSavedReportRecord,
} from '../types/ledgerReports';
import { BANK_BOOK_STATE_KEY } from '../types/ledgerReports';
import { displayDate, formatMoney, readError, writePageState } from './ledgerReportShared';

const REPORT_LIST = [
  {
    key: 'DAILY',
    title: '1. Daily Total',
    description: 'Bank receipts, payments and the running balance for one bank account.',
  },
];

export const BankBookSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeFinancialYear } = useCompany();

  const [options, setOptions] = useState<BankBookOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<'results' | 'print' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportKey, setReportKey] = useState('DAILY');
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBankBookOptions();
      setOptions(data);
      const preferred = data.savedReports.find((entry) => entry.isDefault) ?? data.savedReports[0];
      setSavedId(preferred ? preferred.id : null);
    } catch (err) {
      setOptions(null);
      setError(readError(err, 'Unable to load the Bank Book reports for the active company.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savedReports = options?.savedReports ?? [];
  const selected = useMemo(
    () => savedReports.find((entry) => entry.id === savedId) ?? null,
    [savedReports, savedId]
  );

  const buildRequest = useCallback(
    (report: BankBookSavedReportRecord): BankBookRunRequest => ({
      bankLedgerAccountId: report.bankLedgerAccountId,
      detailMode: report.detailMode,
      reportType: report.reportType || 'DAILY',
      fromDate: report.fromDate ?? options?.defaultFromDate ?? '',
      toDate: report.toDate ?? options?.defaultToDate ?? '',
      filterField: report.filterField,
      filterText: report.filterText,
      partyGroupId: report.partyGroupId,
      columns: report.columns.length > 0 ? report.columns : undefined,
      page: 1,
      pageSize: 100,
    }),
    [options]
  );

  const runReport = useCallback(
    async (destination: 'results' | 'print') => {
      if (!selected || running) {
        // No saved configuration yet: the configuration screen is the real
        // next step, so the button still does something useful.
        navigate('/reports/bank-book/config');
        return;
      }
      setRunning(destination);
      setError(null);
      try {
        const request = buildRequest(selected);
        await runBankBook({ ...request, page: 1, pageSize: 1 });
        const state: BankBookPageState = { request, layoutName: selected.reportName, landscape: false };
        writePageState(BANK_BOOK_STATE_KEY, state);
        if (destination === 'print') {
          navigate('/reports/bank-book/' + request.bankLedgerAccountId + '/print');
        } else {
          navigate('/reports/bank-book/results');
        }
      } catch (err) {
        setError(readError(err, 'Failed to generate the selected Bank Book report.'));
      } finally {
        setRunning(null);
      }
    },
    [selected, running, buildRequest, navigate]
  );

  const openConfig = useCallback(() => {
    navigate('/reports/bank-book/config');
  }, [navigate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'PageDown') {
        event.preventDefault();
        void runReport('results');
        return;
      }
      if (event.key === 'ArrowDown' && savedReports.length > 0) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
        event.preventDefault();
        const index = savedReports.findIndex((entry) => entry.id === savedId);
        const next = Math.min(savedReports.length - 1, index + 1);
        setSavedId(savedReports[next].id);
        return;
      }
      if (event.key === 'ArrowUp' && savedReports.length > 0) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
        event.preventDefault();
        const index = savedReports.findIndex((entry) => entry.id === savedId);
        const next = Math.max(0, index - 1);
        setSavedId(savedReports[next].id);
        return;
      }
      if (event.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [runReport, savedReports, savedId, navigate]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">Bank Book</span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {options?.financialYearStart?.slice(0, 4) ?? ''} - {options?.financialYearEnd?.slice(0, 4) ?? activeFinancialYear?.yearName ?? 'FY'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          title="Close (Esc)"
          className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#789d93] bg-[#eef5f2] px-3 py-1 text-[11px] text-slate-600">
        <button type="button" onClick={() => navigate('/')} className="hover:text-slate-900">
          Dashboard
        </button>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span>Report</span>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span>Day Book Register</span>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="font-semibold text-slate-800">Bank Book</span>
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#789d93] bg-[#f4faf7]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#789d93] bg-[#d7e8e2] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            <span>Report Name</span>
            <span className="font-mono">{REPORT_LIST.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {REPORT_LIST.map((report, index) => {
              const active = report.key === reportKey;
              return (
                <button
                  key={report.key}
                  type="button"
                  onClick={() => setReportKey(report.key)}
                  title={report.description}
                  className={
                    'flex w-full items-start gap-1.5 border-b border-[#dbeae4] px-1.5 py-1 text-left ' +
                    (active ? 'bg-[#2c5f57] font-bold text-white' : 'text-slate-700 hover:bg-white')
                  }
                >
                  <span
                    className={
                      'w-3.5 shrink-0 font-mono text-[9px] ' +
                      (active ? 'text-emerald-200' : 'text-slate-400')
                    }
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 text-[10px] leading-tight">{report.title.replace(/^\d+\.\s*/, '')}</span>
                </button>
              );
            })}
          </div>
          <div className="shrink-0 border-t border-[#789d93] px-1.5 py-1 text-[9px] leading-tight text-slate-600">
            Bank Book reads posted journal lines only. No accounting data is created here.
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading Bank Book reports...
              </div>
            ) : (
              <div className="space-y-2">
                <section className="rounded border border-[#789d93] bg-white p-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h1 className="text-[13px] font-bold text-slate-900">1. Daily Total</h1>
                      <p className="text-[10px] text-slate-500">
                        Voucher date, voucher number, party, cheque / reference, withdraw, deposit and the
                        running balance of one bank ledger.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void load()}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded border border-[#789d93] bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3 w-3" /> Refresh
                    </button>
                  </div>
                </section>

                <section className="overflow-hidden rounded border border-[#789d93] bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-[#789d93] bg-[#e8f1ed] px-2 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Saved Report Configurations
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{savedReports.length}</span>
                  </div>
                  {savedReports.length === 0 ? (
                    <div className="px-2 py-6 text-center text-[11px] text-slate-500">
                      No saved Bank Book report yet. Choose <span className="font-bold">New Report</span> to
                      select a bank account, period and filters, then save the configuration.
                    </div>
                  ) : (
                    <div className="max-h-[42vh] overflow-auto">
                      <table className="w-full border-collapse text-[11px]">
                        <thead className="sticky top-0 z-10 bg-[#f4faf7] text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          <tr>
                            <th className="px-2 py-1 text-left">Report Name</th>
                            <th className="px-2 py-1 text-left">Bank Account</th>
                            <th className="px-2 py-1 text-left">Detail</th>
                            <th className="px-2 py-1 text-left">Period</th>
                          </tr>
                        </thead>
                        <tbody>
                          {savedReports.map((report) => {
                            const active = report.id === savedId;
                            return (
                              <tr
                                key={report.id}
                                onClick={() => setSavedId(report.id)}
                                onDoubleClick={() => void runReport('results')}
                                onMouseEnter={() => setSavedId(report.id)}
                                className={
                                  'cursor-pointer border-b border-slate-100 ' +
                                  (active ? 'bg-[#dceee8]' : 'hover:bg-slate-50')
                                }
                                aria-selected={active}
                              >
                                <td className="px-2 py-1 font-semibold text-slate-900">
                                  {report.reportName}
                                  {report.isDefault && (
                                    <span className="ml-1 rounded bg-emerald-100 px-1 text-[8px] font-bold uppercase text-emerald-800">
                                      default
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1 text-slate-600">
                                  {report.bankAccountName ?? '-'}
                                </td>
                                <td className="px-2 py-1 text-slate-600">
                                  {report.detailMode === 'SUMMARY' ? 'Summary' : 'Detail'}
                                </td>
                                <td className="px-2 py-1 font-mono text-[10px] text-slate-600">
                                  {report.fromDate ? displayDate(report.fromDate) : 'FY start'} -{' '}
                                  {report.toDate ? displayDate(report.toDate) : 'FY end'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {selected && (
                  <section className="rounded border border-[#789d93] bg-white p-2 text-[11px]">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Selected Configuration
                    </p>
                    <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                      <p><span className="font-bold text-slate-600">Report:</span> {selected.reportName}</p>
                      <p><span className="font-bold text-slate-600">Bank:</span> {selected.bankAccountName ?? '-'}</p>
                      <p><span className="font-bold text-slate-600">Mode:</span> {selected.detailMode === 'SUMMARY' ? '2. Summary' : '1. Detail'}</p>
                      <p><span className="font-bold text-slate-600">Filter:</span> {selected.filterField ? selected.filterField + ' = ' + (selected.filterText ?? '') : 'None'}</p>
                      <p><span className="font-bold text-slate-600">Columns:</span> {selected.columns.length > 0 ? selected.columns.length + ' selected' : 'Standard'}</p>
                      <p><span className="font-bold text-slate-600">From:</span> {selected.fromDate ? displayDate(selected.fromDate) : 'FY start'}</p>
                      <p><span className="font-bold text-slate-600">To:</span> {selected.toDate ? displayDate(selected.toDate) : 'FY end'}</p>
                    </div>
                  </section>
                )}

                {options && options.banks.length === 0 && (
                  <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
                    No active bank ledger exists for this company. Create or activate a ledger account with the
                    BANK group and the bank-account flag in Ledger Account Master.
                  </div>
                )}
                {options && options.banks.length > 0 && savedReports.length === 0 && (
                  <div className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600">
                    {options.banks.length} active bank account(s) available:{' '}
                    {options.banks
                      .slice(0, 4)
                      .map((bank) => bank.accountName + ' (' + formatMoney(bank.currentBalance) + ' ' + bank.currentNature + ')')
                      .join(', ')}
                    {options.banks.length > 4 ? ' ...' : ''}
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5">
            <span className="text-[10px] text-slate-500">
              PageDown = Preview | Enter / double-click = open | Esc = close
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={openConfig}
                className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                <Plus className="h-3 w-3" /> New Report
              </button>
              <button
                type="button"
                onClick={() => navigate('/reports/bank-book/config')}
                className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                <Settings2 className="h-3 w-3" /> Customize
              </button>
              <button
                type="button"
                onClick={() => void runReport('results')}
                disabled={running !== null}
                className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {running === 'results' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                Preview
              </button>
              <button
                type="button"
                onClick={() => void runReport('print')}
                disabled={running !== null}
                className="flex h-7 items-center gap-1 rounded bg-[#2c5f57] px-2 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:opacity-50"
              >
                {running === 'print' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                Print
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default BankBookSelectionPage;