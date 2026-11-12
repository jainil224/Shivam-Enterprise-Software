import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Columns3,
  Eye,
  FileText,
  Loader2,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getAccountLedgerOptions } from '../services/api';
import type {
  AccountLedgerOptions,
  AccountLedgerPageState,
  LedgerReportColumnDef,
} from '../types/ledgerReports';
import { ACCOUNT_LEDGER_STATE_KEY } from '../types/ledgerReports';
import type { ReportColumnDef } from '../types/reports';
import { ReportColumnSelector } from '../components/ReportColumnSelector';
import {
  balanceText,
  displayDate,
  blocksPageKey,
  isTypingTarget,
  normalizeSearchTerm,
  readError,
  writePageState,
} from './ledgerReportShared';

const fieldClass =
  'w-full h-7 px-1.5 bg-white border border-[#789d93] rounded text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]';

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5';

const toReportColumnDefs = (columns: LedgerReportColumnDef[]): ReportColumnDef[] =>
  columns.map((column) => ({
    key: column.key,
    label: column.label,
    type: column.type,
    align: column.align,
    width: Math.max(70, Math.round(column.weight * 9)),
  }));

const groupLabel = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const AccountLedgerSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeFinancialYear } = useCompany();

  const [options, setOptions] = useState<AccountLedgerOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAccountLedgerOptions();
        if (cancelled) return;
        setOptions(data);
        setFromDate(data.defaultFromDate);
        setToDate(data.defaultToDate);
        setColumns(data.defaultColumns);
        setSelectedId(data.accounts.length > 0 ? data.accounts[0].id : null);
      } catch (err) {
        if (cancelled) return;
        setOptions(null);
        setError(readError(err, 'Failed to load the ledger accounts.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const accounts = useMemo(() => {
    const list = options?.accounts ?? [];
    const term = normalizeSearchTerm(query);
    if (term.length === 0) return list;
    return list.filter((account) => {
      const haystack = normalizeSearchTerm(
        [
          account.accountName,
          account.accountCode,
          account.accountGroup,
          account.partyName ?? '',
          account.partyMobile ?? '',
          account.partyGstin ?? '',
          account.partyPan ?? '',
          account.partyCity ?? '',
          account.partyArea ?? '',
          account.partyGroupName ?? '',
        ].join(' ')
      );
      return haystack.includes(term);
    });
  }, [options, query]);

  const selected = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  /**
   * The selected ledger must always be a ledger the user can actually see.
   * When the search filter hides the current selection, the highlight and the
   * selection move to the first visible row instead of silently keeping a
   * hidden account that "Show Ledger" would then open.
   */
  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null);
      setHighlight(0);
      return;
    }
    const currentIndex = accounts.findIndex((account) => account.id === selectedId);
    if (currentIndex >= 0) {
      setHighlight(currentIndex);
      return;
    }
    const nextIndex = Math.min(highlight, accounts.length - 1);
    setSelectedId(accounts[nextIndex].id);
    setHighlight(nextIndex);
  }, [accounts, selectedId, highlight]);

  const selectedVisible = useMemo(
    () => accounts.some((account) => account.id === selectedId),
    [accounts, selectedId]
  );

  const validate = useCallback((): string | null => {
    if (!selectedId || !selectedVisible) return 'Select a ledger account from the list.';
    if (!options) return 'Ledger accounts are still loading.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return 'Select both a valid From and To date.';
    }
    if (fromDate > toDate) return 'From date cannot be after the To date.';
    if (fromDate < options.financialYearStart || toDate > options.financialYearEnd) {
      return (
        'The report period must stay inside the financial year (' +
        options.financialYearStart +
        ' to ' +
        options.financialYearEnd +
        ').'
      );
    }
    if (columns.length === 0) return 'Select at least one report column.';
    return null;
  }, [selectedId, selectedVisible, options, fromDate, toDate, columns]);

  const openReport = useCallback(
    (destination: 'results' | 'print') => {
      const problem = validate();
      if (problem) {
        setError(problem);
        return;
      }
      if (!selectedId) return;
      const state: AccountLedgerPageState = {
        request: {
          ledgerAccountId: selectedId,
          fromDate,
          toDate,
          columns,
          page: 1,
          pageSize: 200,
        },
        layoutName: 'Standard',
      };
      writePageState(ACCOUNT_LEDGER_STATE_KEY, state);
      navigate(
        destination === 'print'
          ? '/reports/account-ledger/' + selectedId + '/print'
          : '/reports/account-ledger/' + selectedId
      );
    },
    [validate, selectedId, fromDate, toDate, columns, navigate]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectorOpen) {
          setSelectorOpen(false);
          return;
        }
        navigate('/reports');
        return;
      }
      const target = event.target as HTMLElement | null;
      const insideSearch = target?.dataset?.role === 'ledger-search';
      if (event.key === 'PageDown' && !blocksPageKey(event.target)) {
        event.preventDefault();
        openReport('results');
        return;
      }
      if (event.key === 'Enter' && (insideSearch || !isTypingTarget(event.target))) {
        event.preventDefault();
        openReport('results');
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((prev) => {
          const next = Math.min(accounts.length - 1, prev + 1);
          const account = accounts[next];
          if (account) setSelectedId(account.id);
          return next;
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((prev) => {
          const next = Math.max(0, prev - 1);
          const account = accounts[next];
          if (account) setSelectedId(account.id);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [accounts, selectorOpen, openReport, navigate]);

  const requiredColumns = options?.requiredColumns ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">Account Ledger</span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {activeFinancialYear?.yearName ?? 'FY'}
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
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger accounts...
        </div>
      ) : !options ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded border border-red-300 bg-white p-4 text-center">
            <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-600" />
            <p className="font-bold text-red-700">Ledger accounts could not be loaded.</p>
            <p className="mt-1 text-slate-600">{error ?? 'Unknown error.'}</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-2 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <section className="flex min-h-0 flex-col rounded border border-[#789d93] bg-white">
            <div className="flex items-center justify-between gap-1 border-b border-[#789d93] bg-[#eef5f2] px-2 py-1">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                1. Ledger Account
              </h2>
              <span className="font-mono text-[10px] text-slate-500">{accounts.length} account(s)</span>
            </div>
            <div className="border-b border-slate-200 bg-[#f7fbf9] px-2 py-1.5">
              <div className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5">
                <Search className="h-3 w-3 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlight(0);
                  }}
                  data-role="ledger-search"
                  placeholder="Search party name, code, group, mobile, GSTIN..."
                  className="w-full bg-transparent text-[11px] text-slate-800 focus:outline-none"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-10 bg-[#e8f1ed] text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-2 py-1 text-left">Party Name</th>
                    <th className="px-2 py-1 text-left">Group</th>
                    <th className="px-2 py-1 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                        {options.accounts.length === 0
                          ? 'No ledger account exists for this company.'
                          : 'No ledger account matches the search.'}
                      </td>
                    </tr>
                  ) : (
                    accounts.map((account, index) => (
                      <tr
                        key={account.id}
                        onClick={() => {
                          setSelectedId(account.id);
                          setHighlight(index);
                        }}
                        onDoubleClick={() => {
                          setSelectedId(account.id);
                          openReport('results');
                        }}
                        onMouseEnter={() => setHighlight(index)}
                        className={
                          'cursor-pointer border-b border-slate-100 ' +
                          (account.id === selectedId
                            ? 'bg-[#dceee8]'
                            : index === highlight
                              ? 'bg-slate-50'
                              : '')
                        }
                      >
                        <td className="px-2 py-1">
                          <span className="font-semibold text-slate-900">{account.accountName}</span>
                          <span className="ml-1 font-mono text-[9px] text-slate-500">
                            {account.accountCode}
                          </span>
                          {account.partyName && (
                            <span className="block text-[9px] text-slate-500">
                              Party: {account.partyName}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-[10px] text-slate-600">
                          {groupLabel(account.accountGroup)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-right font-mono font-semibold">
                          {balanceText(account.balanceAmount, account.balanceNature)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-2">
            <div className="rounded border border-[#789d93] bg-white p-2">
              <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                2. Report Period & Columns
              </h2>
              <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass}>From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    min={options.financialYearStart}
                    max={options.financialYearEnd}
                    onChange={(event) => setFromDate(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    min={options.financialYearStart}
                    max={options.financialYearEnd}
                    onChange={(event) => setToDate(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Columns</label>
                  <div className="flex items-center gap-1">
                    <span className="flex h-7 flex-1 items-center rounded border border-[#789d93] bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-700">
                      {columns.length} of {options.columns.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectorOpen(true)}
                      className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Columns3 className="h-3 w-3" /> Select
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-[9px] text-slate-500">
                Financial year {options.financialYearStart} to {options.financialYearEnd}. The opening
                balance is the real ledger opening before the From date.
              </p>
            </div>

            <div className="min-h-0 flex-1 rounded border border-[#789d93] bg-white p-2">
              <h2 className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <FileText className="h-3 w-3" /> 3. Selected Account
              </h2>
              {!selected ? (
                <p className="py-6 text-center text-[11px] text-slate-500">
                  Select a ledger account from the list.
                </p>
              ) : (
                <div className="grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-2">
                  <DetailRow label="Party Name" value={selected.accountName} />
                  <DetailRow label="Account Code" value={selected.accountCode} />
                  <DetailRow label="Account Group" value={groupLabel(selected.accountGroup)} />
                  <DetailRow label="Account Type" value={groupLabel(selected.accountType)} />
                  <DetailRow
                    label="Balance"
                    value={balanceText(selected.balanceAmount, selected.balanceNature)}
                  />
                  <DetailRow label="Book" value={selected.isBankAccount ? 'Bank' : 'Ledger'} />
                  {selected.partyName && <DetailRow label="Party" value={selected.partyName} />}
                  {selected.partyGroupName && (
                    <DetailRow label="Party Group" value={selected.partyGroupName} />
                  )}
                  {selected.partyMobile && <DetailRow label="Mobile" value={selected.partyMobile} />}
                  {selected.partyGstin && <DetailRow label="GSTIN" value={selected.partyGstin} />}
                  {selected.partyPan && <DetailRow label="PAN" value={selected.partyPan} />}
                  {selected.partyCity && <DetailRow label="City" value={selected.partyCity} />}
                  {selected.partyArea && <DetailRow label="Area" value={selected.partyArea} />}
                  {selected.partyAddress && (
                    <DetailRow label="Address" value={selected.partyAddress} />
                  )}
                </div>
              )}
              <p className="mt-2 text-[9px] text-slate-500">
                Period: {displayDate(fromDate)} to {displayDate(toDate)}
              </p>
            </div>
          </section>
        </div>
      )}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5">
        <span className="text-[10px] text-slate-500">
          Arrow Up/Down = select account | Enter or double-click = show | PageDown = preview | Esc = close
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => openReport('print')}
            disabled={!selectedVisible}
            className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <Printer className="h-3 w-3" /> Print Preview
          </button>
          <button
            type="button"
            onClick={() => openReport('results')}
            disabled={!selectedVisible}
            className="flex h-7 items-center gap-1 rounded bg-[#2c5f57] px-2 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:opacity-40"
          >
            <Eye className="h-3 w-3" /> Show Ledger
          </button>
        </div>
      </footer>

      <ReportColumnSelector
        open={selectorOpen}
        title="Column Selection - Account Ledger"
        allColumns={toReportColumnDefs(options?.columns ?? [])}
        selected={columns}
        layoutName="Standard"
        allowSave={false}
        requiredColumns={requiredColumns}
        onCancel={() => setSelectorOpen(false)}
        onApply={(nextColumns) => {
          const merged = [
            ...requiredColumns,
            ...nextColumns.filter((key) => !requiredColumns.includes(key)),
          ];
          setColumns(merged);
          setSelectorOpen(false);
        }}
      />
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string | null }> =
  ({ label, value }) => (
    <div className="flex gap-2 border-b border-slate-100 py-[2px]">
      <span className="w-[86px] shrink-0 text-[9px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-[11px] text-slate-800">
        {value && value.trim().length > 0 ? value : '-'}
      </span>
    </div>
  );

export default AccountLedgerSelectionPage;