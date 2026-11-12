import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import type { LedgerLookupAccount } from '../types/ledgerReports';
import { balanceText, normalizeSearchTerm } from '../pages/ledgerReportShared';

interface LedgerLookupDialogProps {
  open: boolean;
  accounts: LedgerLookupAccount[];
  loading?: boolean;
  error?: string | null;
  fromDate: string;
  toDate: string;
  financialYearStart: string;
  financialYearEnd: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClose: () => void;
  onShow: (account: LedgerLookupAccount) => void;
}

const fieldClass =
  'w-full h-7 px-1.5 bg-white border border-[#789d93] rounded text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]';

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5';

const accountGroupLabel = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const DetailRow: React.FC<{ label: string; value: string | null }> = ({ label, value }) =>
  value && value.trim().length > 0 ? (
    <div className="flex gap-2 border-b border-slate-100 py-[3px] last:border-b-0">
      <span className="w-[92px] shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words text-[11px] text-slate-800">{value}</span>
    </div>
  ) : null;

/**
 * Phase 17 - Ctrl+L lookup. Lists the real ledger accounts of the active
 * company (bank, cash, debtors, creditors, expenses, income, others) and shows
 * only details that are actually stored on the ledger or its party record.
 */
export const LedgerLookupDialog: React.FC<LedgerLookupDialogProps> = ({
  open,
  accounts,
  loading = false,
  error = null,
  fromDate,
  toDate,
  financialYearStart,
  financialYearEnd,
  onFromDateChange,
  onToDateChange,
  onClose,
  onShow,
}) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return accounts;
    const normalizedTerm = normalizeSearchTerm(query);
    return accounts.filter((account) => {
      const haystack = normalizeSearchTerm(
        [
          account.accountName,
          account.accountCode,
          account.partyName ?? '',
          account.partyGroupName ?? '',
          account.accountGroup,
        ].join(' ')
      );
      return haystack.includes(normalizedTerm);
    });
  }, [accounts, query]);

  const selectedIndex = useMemo(() => {
    const index = filtered.findIndex((account) => account.id === selectedId);
    return index >= 0 ? index : filtered.length > 0 ? 0 : -1;
  }, [filtered, selectedId]);

  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedId(null);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (open) rowRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, selectedIndex]);

  const dateProblem = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return 'Select both a valid From and To date.';
    }
    if (fromDate > toDate) return 'From date cannot be after the To date.';
    if (fromDate < financialYearStart || toDate > financialYearEnd) {
      return 'The period must stay inside the financial year.';
    }
    return null;
  }, [fromDate, toDate, financialYearStart, financialYearEnd]);

  const show = () => {
    if (!selected || dateProblem) return;
    onShow(selected);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (filtered.length === 0) return;
        const next = Math.min(filtered.length - 1, selectedIndex + 1);
        setSelectedId(filtered[next].id);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (filtered.length === 0) return;
        const next = Math.max(0, selectedIndex - 1);
        setSelectedId(filtered[next].id);
        return;
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target && target.tagName === 'INPUT' && target.getAttribute('type') === 'date') return;
        event.preventDefault();
        if (selected && !dateProblem) onShow(selected);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selectedIndex, selected, dateProblem, onClose, onShow]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-900/45 p-2 sm:p-6 print:hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Party Ledger"
        className="w-full max-w-4xl overflow-hidden rounded-lg border border-[#2c5f57] bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 bg-[#2c5f57] px-3 py-1.5 text-white">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-emerald-200" />
            <h2 className="text-[12px] font-bold uppercase tracking-wide">Party Ledger</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="grid gap-2 border-b border-slate-200 bg-[#f4faf7] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
          <div>
            <label className={labelClass} htmlFor="ledger-lookup-search">
              Party Name
            </label>
            <div className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5">
              <Search className="h-3 w-3 shrink-0 text-slate-400" />
              <input
                id="ledger-lookup-search"
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedId(null);
                }}
                placeholder="Search party or account name..."
                className="w-full bg-transparent text-[11px] text-slate-800 focus:outline-none"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  title="Clear search"
                  className="shrink-0 text-slate-400 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="ledger-lookup-from">
              From
            </label>
            <input
              id="ledger-lookup-from"
              type="date"
              value={fromDate}
              min={financialYearStart}
              max={financialYearEnd}
              onChange={(event) => onFromDateChange(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ledger-lookup-to">
              To
            </label>
            <input
              id="ledger-lookup-to"
              type="date"
              value={toDate}
              min={financialYearStart}
              max={financialYearEnd}
              onChange={(event) => onToDateChange(event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {(error || dateProblem) && (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
            {error ?? dateProblem}
          </div>
        )}

        <div className="grid min-h-0 gap-2 p-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="max-h-[52vh] min-h-[220px] overflow-auto rounded border border-slate-300">
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-[#e8f1ed] text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-2 py-1 text-left">Party Name</th>
                  <th className="px-2 py-1 text-left">Account Group</th>
                  <th className="px-2 py-1 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading ledger accounts...
                      </span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                      {accounts.length === 0
                        ? 'No ledger accounts exist for this company yet.'
                        : 'No ledger account matches "' + query + '".'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((account, index) => {
                    const active = index === selectedIndex;
                    return (
                      <tr
                        key={account.id}
                        ref={(node) => {
                          rowRefs.current[index] = node;
                        }}
                        onClick={() => setSelectedId(account.id)}
                        onDoubleClick={() => {
                          if (!dateProblem) onShow(account);
                        }}
                        onMouseEnter={() => setSelectedId(account.id)}
                        className={
                          'cursor-pointer border-b border-slate-100 ' +
                          (active ? 'bg-[#dceee8]' : 'hover:bg-slate-50')
                        }
                        aria-selected={active}
                      >
                        <td className="px-2 py-1">
                          <span className="font-semibold text-slate-900">
                            {account.partyName ?? account.accountName}
                          </span>
                          <span className="ml-1 font-mono text-[9px] text-slate-500">
                            {account.accountCode}
                          </span>
                          {!account.isActive && (
                            <span className="ml-1 rounded bg-slate-200 px-1 text-[8px] font-bold uppercase text-slate-600">
                              inactive
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-slate-600">
                          {accountGroupLabel(account.accountGroup)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-[11px] font-semibold">
                          {balanceText(account.balanceAmount, account.balanceNature)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-slate-300 bg-[#fbfdfc] p-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Stored Account Details
            </p>
            {!selected ? (
              <p className="py-4 text-center text-[11px] text-slate-500">
                Select an account to see the stored details.
              </p>
            ) : (
              <div>
                <p className="mb-1 text-[12px] font-bold text-slate-900">
                  {selected.partyName ?? selected.accountName}
                </p>
                <DetailRow label="Account" value={selected.accountName} />
                <DetailRow label="Group" value={accountGroupLabel(selected.accountGroup)} />
                <DetailRow
                  label="Type"
                  value={
                    selected.isBankAccount
                      ? 'Bank account'
                      : accountGroupLabel(selected.accountType)
                  }
                />
                <DetailRow label="Mobile" value={selected.partyMobile} />
                <DetailRow label="GSTIN" value={selected.partyGstin} />
                <DetailRow label="PAN" value={selected.partyPan} />
                <DetailRow label="City" value={selected.partyCity} />
                <DetailRow label="Area" value={selected.partyArea} />
                <DetailRow label="Address" value={selected.partyAddress} />
                <DetailRow label="Party Group" value={selected.partyGroupName} />
                <DetailRow
                  label="Balance"
                  value={balanceText(selected.balanceAmount, selected.balanceNature)}
                />
                <p className="mt-1 text-[9px] leading-tight text-slate-500">
                  Only values stored on the ledger or its party master are shown. Blank fields are not
                  recorded.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-[10px] text-slate-500">
            {filtered.length} account(s) | Up/Down moves, Enter opens, Esc closes.
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="h-7 rounded border border-[#789d93] bg-white px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={show}
              disabled={!selected || Boolean(dateProblem)}
              title={dateProblem ?? 'Open the Account Ledger for the selected account'}
              className="h-7 rounded bg-[#2c5f57] px-3 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Show
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LedgerLookupDialog;