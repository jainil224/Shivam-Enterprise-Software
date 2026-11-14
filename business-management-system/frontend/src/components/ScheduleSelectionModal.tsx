import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { AccountWiseLedgerGroup, AccountWiseScheduleOption } from '../types/accountWiseBalance';

interface ScheduleSelectionModalProps {
  open: boolean;
  /** Schedules compatible with the selected Account Type only. */
  schedules: AccountWiseScheduleOption[];
  /** Applied selection; restored every time the popup is reopened. */
  selectedIds: AccountWiseLedgerGroup[];
  onCancel: () => void;
  onApply: (ids: AccountWiseLedgerGroup[]) => void;
}

/**
 * Phase 19 - Schedule Selection popup.
 * Keys are the real LedgerAccountGroup enum values offered by the backend, so a
 * selection always maps to stored ledger accounts. An empty selection can never
 * be applied: Select mode requires at least one schedule.
 */
export const ScheduleSelectionModal: React.FC<ScheduleSelectionModalProps> = ({
  open,
  schedules,
  selectedIds,
  onCancel,
  onApply,
}) => {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<AccountWiseLedgerGroup[]>(selectedIds);

  useEffect(() => {
    if (!open) return;
    setDraft(selectedIds);
    setQuery('');
  }, [open, selectedIds]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, onCancel]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length === 0) return schedules;
    return schedules.filter((schedule) => schedule.label.toLowerCase().includes(term));
  }, [schedules, query]);

  if (!open) return null;

  const toggle = (id: AccountWiseLedgerGroup) => {
    setDraft((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]
    );
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Schedule Selection"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded border border-[#1f4842] bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-2 py-1.5 text-white">
          <span className="min-w-[130px] font-mono text-[11px] font-bold text-emerald-200">
            TOTAL SELECTED: {draft.length}
          </span>
          <span className="text-center text-xs font-bold uppercase tracking-wider">
            Schedule Selection
          </span>
          <button
            type="button"
            onClick={onCancel}
            title="Close (Esc)"
            className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="shrink-0 border-b border-slate-200 bg-[#f7fbf9] px-2 py-1.5">
          <div className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5">
            <Search className="h-3 w-3 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Type to search on selected column..."
              className="w-full bg-transparent text-[11px] text-slate-800 focus:outline-none"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#e8f1ed] text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="w-12 px-2 py-1 text-center">Tick</th>
                <th className="px-2 py-1 text-left">Values</th>
                <th className="w-20 px-2 py-1 text-right">Accounts</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                    {schedules.length === 0
                      ? 'No schedule exists for the selected Account Type.'
                      : 'No schedule matches "' + query + '".'}
                  </td>
                </tr>
              ) : (
                filtered.map((schedule) => {
                  const checked = draft.includes(schedule.id);
                  return (
                    <tr
                      key={schedule.id}
                      onClick={() => toggle(schedule.id)}
                      className={
                        'cursor-pointer border-b border-slate-100 hover:bg-emerald-50 ' +
                        (checked ? 'bg-[#dceee8]' : '')
                      }
                    >
                      <td className="px-2 py-1 text-center">
                        <span
                          className={
                            'inline-flex h-4 w-4 items-center justify-center rounded border ' +
                            (checked
                              ? 'border-[#2c5f57] bg-[#2c5f57] text-white'
                              : 'border-[#789d93] bg-white text-transparent')
                          }
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(schedule.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="sr-only"
                          aria-label={'Select ' + schedule.label}
                        />
                      </td>
                      <td className="px-2 py-1 font-semibold text-slate-800">{schedule.label}</td>
                      <td className="px-2 py-1 text-right font-mono text-[10px] text-slate-500">
                        {schedule.accountCount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5">
          <span className="text-[10px] text-slate-500">
            {draft.length === 0
              ? 'Select at least one schedule, or cancel and keep Schedule = All.'
              : draft.length + ' schedule(s) selected.'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              disabled={draft.length === 0}
              className="h-7 rounded bg-[#2c5f57] px-2 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ScheduleSelectionModal;