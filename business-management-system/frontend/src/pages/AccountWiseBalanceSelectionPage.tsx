import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Eye,
  Loader2,
  Plus,
  Printer,
  Settings2,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getAccountWiseBalanceOptions } from '../services/api';
import type {
  AccountWiseBalanceOptions,
  AccountWiseBalanceQueryRequest,
  AccountWiseReportType,
} from '../types/accountWiseBalance';
import {
  buildDefaultRequest,
  readDraft,
  validateRequest,
  writeDraft,
  writePreviewState,
  ReportList,
} from './accountWiseBalanceShared';
import { blocksPageKey, displayDate, readError } from './ledgerReportShared';

const BASE = '/reports/final-reports/account-wise-balance';

/**
 * Phase 19 - report selection screen.
 * Both report entries are live: "1. Account Wise Balance" and
 * "2. Account + Month Wise Balance". The selected entry travels inside the
 * request, so the shared Phase 1 filters drive both reports unchanged.
 */
export const AccountWiseBalanceSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeFinancialYear } = useCompany();

  const [options, setOptions] = useState<AccountWiseBalanceOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAccountWiseBalanceOptions();
        if (cancelled) return;
        setOptions(data);
      } catch (err) {
        if (cancelled) return;
        setOptions(null);
        setError(readError(err, 'Failed to load the Account Wise Balance options.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const draft = useMemo(() => (options ? readDraft(options) : null), [options]);
  const [reportType, setReportType] = useState<AccountWiseReportType | null>(null);
  const selectedReportType: AccountWiseReportType =
    reportType ?? draft?.reportType ?? 'ACCOUNT_WISE_BALANCE';

  const openPreview = useCallback(
    (request: Parameters<typeof validateRequest>[0]) => {
      if (!options) {
        setError('The report options are still loading.');
        return;
      }
      const typed: typeof request = { ...request, reportType: selectedReportType };
      const problem = validateRequest(typed, options);
      if (problem) {
        setError(problem);
        return;
      }
      writePreviewState(typed);
      navigate(BASE + '/preview');
    },
    [options, navigate, selectedReportType]
  );

  const previewDefault = useCallback(() => {
    if (!options) return;
    openPreview(draft ?? buildDefaultRequest(options));
  }, [options, draft, openPreview]);

  const startNewReport = useCallback(() => {
    if (!options) return;
    const request: AccountWiseBalanceQueryRequest = {
      ...buildDefaultRequest(options),
      reportType: selectedReportType,
    };
    writeDraft(request);
    setError(null);
    navigate(BASE + '/config');
  }, [options, navigate, selectedReportType]);

  const customize = useCallback(() => {
    if (!options) return;
    const base = draft ?? buildDefaultRequest(options);
    writeDraft({ ...base, reportType: selectedReportType });
    setError(null);
    navigate(BASE + '/config');
  }, [options, draft, navigate, selectedReportType]);

  const openPrint = useCallback(() => {
    if (!options) return;
    const base = draft ?? buildDefaultRequest(options);
    const typed: AccountWiseBalanceQueryRequest = { ...base, reportType: selectedReportType };
    const problem = validateRequest(typed, options);
    if (problem) {
      setError(problem);
      return;
    }
    writePreviewState(typed);
    navigate(BASE + '/print');
  }, [options, draft, navigate, selectedReportType]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate('/reports');
        return;
      }
      if (event.key === 'PageDown' && !blocksPageKey(event.target)) {
        event.preventDefault();
        previewDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, previewDefault]);

  const accountTypeLabel = useMemo(() => {
    if (!options) return '';
    const request = draft ?? buildDefaultRequest(options);
    return options.accountTypes.find((entry) => entry.value === request.accountType)?.label ?? '';
  }, [options, draft]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">
            Account Wise Balance
          </span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {activeFinancialYear?.yearName ?? options?.financialYearName ?? 'FY'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reports')}
          title="Close (Esc)"
          className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report options...
        </div>
      ) : !options ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded border border-red-300 bg-white p-4 text-center">
            <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-600" />
            <p className="font-bold text-red-700">Report options could not be loaded.</p>
            <p className="mt-1 text-[11px] text-slate-600">{error ?? 'Unknown error.'}</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-2 lg:grid-cols-[190px_1fr]">
          <ReportList active={selectedReportType} onSelect={setReportType} />

          <section className="flex min-h-0 flex-col gap-2">
            <div className="rounded border border-[#789d93] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#789d93] bg-[#eef5f2] px-2 py-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  {selectedReportType === 'ACCOUNT_MONTH_WISE_BALANCE'
                    ? '2. Account + Month Wise Balance'
                    : '1. Account Wise Balance'}
                </h2>
                <span className="rounded bg-emerald-100 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                  Phase 2
                </span>
              </div>
              <div className="grid gap-3 p-3 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    What this report does
                  </h3>
                  <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-slate-700">
                    <li>Reads real ledger openings and posted journal lines only.</li>
                    <li>Shows opening, period Debit/Credit and closing per account.</li>
                    <li>Filters by Account Type, Party, Party Group and Schedule.</li>
                    <li>
                      {selectedReportType === 'ACCOUNT_MONTH_WISE_BALANCE'
                        ? 'Adds one Debit/Credit pair per real month plus an explicit closing balance.'
                        : 'Result grid and A4 print preview share one backend page document.'}
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Current configuration
                  </h3>
                  <dl className="space-y-0.5 text-[11px]">
                    <SummaryRow label="Account Type" value={accountTypeLabel} />
                    <SummaryRow
                      label="Period"
                      value={
                        draft
                          ? displayDate(draft.fromDate) + ' to ' + displayDate(draft.toDate)
                          : displayDate(options.defaultFromDate) + ' to ' + displayDate(options.defaultToDate)
                      }
                    />
                    <SummaryRow label="Financial Year" value={options.financialYearName} />
                    <SummaryRow
                      label="Balance Columns"
                      value={
                        options.balanceColumns.find(
                          (entry) => entry.value === (draft?.balanceColumns ?? 'BOTH')
                        )?.label ?? '1. Both'
                      }
                    />
                  </dl>
                </div>
              </div>
            </div>

            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] leading-snug text-amber-900">
              <p className="mb-0.5 flex items-center gap-1 font-bold uppercase tracking-wide">
                <AlertTriangle className="h-3 w-3" /> Data-model limitations
              </p>
              <p>{options.limitations.depositors}</p>
              <p className="mt-1">{options.limitations.scheduleSource}</p>
            </div>

            <div className="rounded border border-[#789d93] bg-white p-2 text-[11px] text-slate-600">
              <p className="font-semibold text-slate-700">A4 print preview and PDF are available.</p>
              <p className="mt-0.5 text-[10px]">
                Preview opens the result grid; Print opens the A4 document with page numbering and
                a genuine PDF download. WhatsApp delivery is not part of this phase.
              </p>
            </div>
          </section>
        </div>
      )}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5">
        <span className="text-[10px] text-slate-500">
          PageDown = preview | Esc = close | Customize opens the configuration screen
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={startNewReport}
            disabled={!options}
            className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> New Report
          </button>
          <button
            type="button"
            onClick={customize}
            disabled={!options}
            className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <Settings2 className="h-3 w-3" /> Customize
          </button>
          <button
            type="button"
            onClick={previewDefault}
            disabled={!options}
            className="flex h-7 items-center gap-1 rounded bg-[#2c5f57] px-2 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:opacity-40"
          >
            <Eye className="h-3 w-3" /> Preview (Page Down Key)
          </button>
          <button
            type="button"
            onClick={openPrint}
            disabled={!options}
            className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <Printer className="h-3 w-3" /> Print
          </button>
        </div>
      </footer>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex gap-2 border-b border-slate-100 py-[2px]">
    <dt className="w-[96px] shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-500">
      {label}
    </dt>
    <dd className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-800">{value}</dd>
  </div>
);

export default AccountWiseBalanceSelectionPage;