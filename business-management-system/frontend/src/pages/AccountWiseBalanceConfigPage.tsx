import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, Loader2, Plus, Printer, X } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getAccountWiseBalanceOptions } from '../services/api';
import type {
  AccountWiseBalanceColumnMode,
  AccountWiseBalanceOptions,
  AccountWiseBalanceQueryRequest,
  AccountWiseLedgerGroup,
  AccountWiseScheduleMode,
} from '../types/accountWiseBalance';
import { SearchSelect } from '../components/SearchSelect';
import { ScheduleSelectionModal } from '../components/ScheduleSelectionModal';
import {
  buildDefaultRequest,
  checkClass,
  checkLabelClass,
  fieldClass,
  labelClass,
  partiesForAccountType,
  readDraft,
  ReportList,
  scheduleSummary,
  schedulesForAccountType,
  validateRequest,
  writeDraft,
  writePreviewState,
} from './accountWiseBalanceShared';
import { blocksPageKey, displayDate, readError } from './ledgerReportShared';

const BASE = '/reports/final-reports/account-wise-balance';

const CHECKBOXES: Array<{
  key: keyof Pick<
    AccountWiseBalanceQueryRequest,
    | 'includePartyAddress'
    | 'includePartyMobile'
    | 'includePan'
    | 'pageBreakEveryParty'
    | 'doNotPrintDescription'
    | 'skipZeroBalances'
  >;
  label: string;
  hint: string;
}> = [
  {
    key: 'includePartyAddress',
    label: 'Party Address Required?',
    hint: 'Adds the stored party address to every row. Missing addresses stay blank.',
  },
  {
    key: 'includePartyMobile',
    label: 'Party Mobile No Required?',
    hint: 'Adds the stored mobile number of the party. No substitute number is used.',
  },
  {
    key: 'includePan',
    label: 'PAN No Required?',
    hint: 'Adds the stored PAN of the party. Missing PAN stays blank.',
  },
  {
    key: 'pageBreakEveryParty',
    label: 'Page Break on Every Party?',
    hint: 'Starts every account on its own A4 page in the print preview and the PDF.',
  },
  {
    key: 'doNotPrintDescription',
    label: 'Do not Print Description',
    hint: 'Hides the stored account description in the result grid and the A4 document. Nothing is deleted.',
  },
  {
    key: 'skipZeroBalances',
    label: 'Skip 0 (Zero) Transaction?',
    hint: 'Hides accounts whose computed closing balance is exactly zero. Negative balances are kept.',
  },
];

/**
 * Phase 19 - Account Wise Balance configuration screen.
 * Every control is a controlled value that reaches the query API. Account Type
 * narrows the Party, Party Group and Schedule lookups to the real stored
 * classification; nothing is inferred from a balance.
 */
export const AccountWiseBalanceConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeFinancialYear } = useCompany();

  const [options, setOptions] = useState<AccountWiseBalanceOptions | null>(null);
  const [request, setRequest] = useState<AccountWiseBalanceQueryRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const requestRef = useRef<AccountWiseBalanceQueryRequest | null>(null);

  requestRef.current = request;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAccountWiseBalanceOptions();
        if (cancelled) return;
        setOptions(data);
        const stored = readDraft(data);
        setRequest(stored ?? buildDefaultRequest(data));
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

  const update = useCallback((patch: Partial<AccountWiseBalanceQueryRequest>) => {
    setRequest((previous) => (previous ? { ...previous, ...patch } : previous));
  }, []);

  /** Keeps every dependent filter inside the newly selected classification. */
  const changeAccountType = useCallback(
    (value: AccountWiseBalanceQueryRequest['accountType']) => {
      if (!options) return;
      const definition = options.accountTypes.find((entry) => entry.value === value);
      if (!definition || !definition.supported) return;
      const parties = partiesForAccountType(options, value);
      const schedules = schedulesForAccountType(options, value);
      setRequest((previous) => {
        if (!previous) return previous;
        const partyId =
          previous.partyId && parties.some((party) => party.id === previous.partyId)
            ? previous.partyId
            : null;
        const scheduleIds = previous.scheduleIds.filter((id) =>
          schedules.some((schedule) => schedule.id === id)
        );
        return {
          ...previous,
          accountType: value,
          partyId,
          scheduleMode: previous.scheduleMode === 'SELECT' && scheduleIds.length > 0 ? 'SELECT' : 'ALL',
          scheduleIds: scheduleIds.length > 0 && previous.scheduleMode === 'SELECT' ? scheduleIds : [],
        };
      });
      setError(null);
    },
    [options]
  );

  const changeScheduleMode = useCallback(
    (mode: AccountWiseScheduleMode) => {
      if (!request) return;
      if (mode === 'ALL') {
        update({ scheduleMode: 'ALL', scheduleIds: [] });
        setScheduleOpen(false);
        return;
      }
      if (request.scheduleIds.length === 0) {
        setScheduleOpen(true);
        return;
      }
      update({ scheduleMode: 'SELECT' });
    },
    [request, update]
  );

  const preview = useCallback(() => {
    if (!options || !request) return;
    const problem = validateRequest(request, options);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    writeDraft(request);
    writePreviewState(request);
    navigate(BASE + '/preview');
  }, [options, request, navigate]);

  const openPrint = useCallback(() => {
    if (!options || !request) return;
    const problem = validateRequest(request, options);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    writeDraft(request);
    writePreviewState(request);
    navigate(BASE + '/print');
  }, [options, request, navigate]);

  const startNewReport = useCallback(() => {
    if (!options) return;
    const fresh = buildDefaultRequest(options);
    setRequest(fresh);
    writeDraft(fresh);
    setError(null);
    navigate(BASE);
  }, [options, navigate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (scheduleOpen) return;
      if (event.key === 'Escape') {
        navigate(BASE);
        return;
      }
      if (event.key === 'PageDown' && !blocksPageKey(event.target)) {
        event.preventDefault();
        preview();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, preview, scheduleOpen]);

  const partyOptions = useMemo(() => {
    if (!options || !request) return [];
    return partiesForAccountType(options, request.accountType).map((party) => ({
      value: party.id,
      label: party.partyName,
      meta: [party.partyCode, party.partyGroupName].filter(Boolean).join(' | '),
    }));
  }, [options, request]);

  const scheduleOptions = useMemo(() => {
    if (!options || !request) return [];
    return schedulesForAccountType(options, request.accountType);
  }, [options, request]);

  const groupOptions = useMemo(() => {
    if (!options) return [];
    return options.partyGroups.map((group) => ({ value: group.id, label: group.groupName }));
  }, [options]);

  const accountTypeNote = useMemo(() => {
    if (!options || !request) return null;
    const definition = options.accountTypes.find((entry) => entry.value === request.accountType);
    return definition?.note ?? null;
  }, [options, request]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-bold uppercase tracking-wide">
            Account Wise Balance
          </span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {activeFinancialYear?.yearName ?? options?.financialYearName ?? 'FY'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate(BASE)}
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
      ) : !options || !request ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded border border-red-300 bg-white p-4 text-center">
            <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-600" />
            <p className="font-bold text-red-700">The configuration could not be loaded.</p>
            <p className="mt-1 text-[11px] text-slate-600">{error ?? 'Unknown error.'}</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-2 lg:grid-cols-[190px_1fr]">
          <ReportList
            active={request.reportType}
            onSelect={(type) => update({ reportType: type })}
          />

          <section className="min-h-0 rounded border border-[#789d93] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#789d93] bg-[#eef5f2] px-2 py-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {request.reportType === 'ACCOUNT_MONTH_WISE_BALANCE'
                  ? '2. Account + Month Wise Balance'
                  : '1. Account Wise Balance'}
              </h2>
              <span className="rounded bg-emerald-100 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                Phase 2
              </span>
            </div>

            <div className="grid gap-x-4 gap-y-2 p-2 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="awb-account-type">
                  Account Type
                </label>
                <select
                  id="awb-account-type"
                  value={request.accountType}
                  onChange={(event) =>
                    changeAccountType(event.target.value as AccountWiseBalanceQueryRequest['accountType'])
                  }
                  className={fieldClass}
                >
                  {options.accountTypes.map((entry) => (
                    <option key={entry.value} value={entry.value} disabled={!entry.supported}>
                      {entry.label}
                      {entry.supported ? '' : ' (not supported)'}
                    </option>
                  ))}
                </select>
                {accountTypeNote && (
                  <p className="mt-0.5 text-[9px] leading-tight text-amber-700">{accountTypeNote}</p>
                )}
              </div>

              <div>
                <span className={labelClass}>Party</span>
                <SearchSelect
                  value={request.partyId ?? ''}
                  options={partyOptions}
                  onChange={(value) => update({ partyId: value === '' ? null : value })}
                  allLabel="1. All"
                  emptyLabel="No active party has a ledger in this classification."
                  title="Party"
                />
              </div>

              <div>
                <span className={labelClass}>Party Group</span>
                <SearchSelect
                  value={request.partyGroupId ?? ''}
                  options={groupOptions}
                  onChange={(value) => update({ partyGroupId: value === '' ? null : value })}
                  allLabel="1. All"
                  emptyLabel="1. All"
                  title="Party Group"
                />
                {groupOptions.length === 0 && (
                  <p className="mt-0.5 text-[9px] leading-tight text-amber-700">
                    No active Party Group is stored for this company, so only All is available.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass} htmlFor="awb-schedule">
                  Schedule
                </label>
                <select
                  id="awb-schedule"
                  value={request.scheduleMode}
                  onChange={(event) => changeScheduleMode(event.target.value as AccountWiseScheduleMode)}
                  className={fieldClass}
                >
                  {options.scheduleModes.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <div className="mt-0.5 flex items-center gap-1">
                  <p className="min-w-0 flex-1 truncate text-[9px] leading-tight text-slate-500" title={scheduleSummary(request, options)}>
                    {request.scheduleMode === 'SELECT'
                      ? 'Selected: ' + scheduleSummary(request, options)
                      : 'All schedules of the selected Account Type'}
                  </p>
                  {request.scheduleMode === 'SELECT' && request.scheduleIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setScheduleOpen(true)}
                      title="Change the selected schedules"
                      className="shrink-0 rounded border border-[#789d93] bg-white px-1 py-[1px] text-[9px] font-bold text-[#1f4842] hover:bg-emerald-50"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="awb-balance-columns">
                  Balance Columns
                </label>
                <select
                  id="awb-balance-columns"
                  value={request.balanceColumns}
                  onChange={(event) =>
                    update({ balanceColumns: event.target.value as AccountWiseBalanceColumnMode })
                  }
                  className={fieldClass}
                >
                  {options.balanceColumns.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-[9px] leading-tight text-slate-500">
                  Filters on the computed closing balance, never on the account name.
                </p>
              </div>

              <div className="sm:row-span-2">
                <span className={labelClass}>Report Options</span>
                <div className="grid gap-1">
                  {CHECKBOXES.map((entry) => (
                    <label key={entry.key} className={checkLabelClass} title={entry.hint}>
                      <input
                        type="checkbox"
                        className={checkClass}
                        checked={request[entry.key]}
                        onChange={(event) => update({ [entry.key]: event.target.checked })}
                      />
                      <span>{entry.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-[150px]">
                    <label className={labelClass} htmlFor="awb-from-date">
                      From Date
                    </label>
                    <input
                      id="awb-from-date"
                      type="date"
                      value={request.fromDate}
                      min={options.financialYearStart}
                      max={request.toDate}
                      onChange={(event) => update({ fromDate: event.target.value })}
                      className={fieldClass}
                    />
                    <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                      {displayDate(request.fromDate)}
                    </p>
                  </div>
                  <div className="w-[150px]">
                    <label className={labelClass} htmlFor="awb-to-date">
                      To Date
                    </label>
                    <input
                      id="awb-to-date"
                      type="date"
                      value={request.toDate}
                      min={request.fromDate}
                      max={options.financialYearEnd}
                      onChange={(event) => update({ toDate: event.target.value })}
                      className={fieldClass}
                    />
                    <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                      {displayDate(request.toDate)}
                    </p>
                  </div>
                  <p className="text-[9px] leading-tight text-slate-500">
                    Allowed range: {displayDate(options.financialYearStart)} to{' '}
                    {displayDate(options.financialYearEnd)} ({options.financialYearName})
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-[#f7fbf9] px-2 py-1 text-[10px] leading-snug text-slate-600">
              <p className="font-semibold text-slate-700">
                Balances are read from the stored ledger opening plus eligible posted journal lines.
              </p>
              <p className="mt-0.5">
                Preview opens the result grid; Print opens the A4 document with page numbering and a
                genuine PDF download. WhatsApp delivery is not part of this phase.
              </p>
            </div>
          </section>
        </div>
      )}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5">
        <span className="text-[10px] text-slate-500">
          PageDown = preview | Esc = back to report selection
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={startNewReport}
            disabled={!options || loading}
            className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> New Report
          </button>
          <button
            type="button"
            onClick={preview}
            disabled={!options || !request || loading}
            className="flex h-7 items-center gap-1 rounded bg-[#2c5f57] px-2 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:opacity-40"
          >
            <Eye className="h-3 w-3" /> Preview (Page Down Key)
          </button>
          <button
            type="button"
            onClick={openPrint}
            disabled={!options || !request || loading}
            className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <Printer className="h-3 w-3" /> Print
          </button>
        </div>
      </footer>

      {options && request && (
        <ScheduleSelectionModal
          open={scheduleOpen}
          schedules={scheduleOptions}
          selectedIds={request.scheduleIds}
          onCancel={() => {
            setScheduleOpen(false);
            if (requestRef.current?.scheduleIds.length === 0) {
              update({ scheduleMode: 'ALL', scheduleIds: [] });
            }
          }}
          onApply={(ids: AccountWiseLedgerGroup[]) => {
            update({ scheduleMode: 'SELECT', scheduleIds: ids });
            setScheduleOpen(false);
            setError(null);
          }}
        />
      )}
    </div>
  );
};

export default AccountWiseBalanceConfigPage;