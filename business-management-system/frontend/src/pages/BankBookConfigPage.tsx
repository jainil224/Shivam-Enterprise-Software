import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Columns3,
  Eye,
  Landmark,
  Loader2,
  Printer,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  createBankBookSavedReport,
  deleteBankBookSavedReport,
  getBankBookOptions,
  runBankBook,
  updateBankBookSavedReport,
} from '../services/api';
import type {
  BankBookBankOption,
  BankBookDetailMode,
  BankBookFilterField,
  BankBookOptions,
  BankBookPageState,
  BankBookRunRequest,
  LedgerReportColumnDef,
} from '../types/ledgerReports';
import { BANK_BOOK_STATE_KEY } from '../types/ledgerReports';
import type { ReportColumnDef } from '../types/reports';
import { ReportColumnSelector } from '../components/ReportColumnSelector';
import { blocksPageKey, displayDate, formatMoney, readError, writePageState } from './ledgerReportShared';

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5';
const fieldClass =
  'w-full h-7 px-1.5 bg-white border border-[#789d93] rounded text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2c5f57] disabled:bg-slate-100 disabled:text-slate-400';

const toReportColumnDefs = (columns: LedgerReportColumnDef[]): ReportColumnDef[] =>
  columns.map((column) => ({
    key: column.key,
    label: column.label,
    type: column.type,
    align: column.align,
    width: Math.max(70, Math.round(column.weight * 9)),
  }));

interface FormState {
  bankLedgerAccountId: string;
  detailMode: BankBookDetailMode;
  reportType: string;
  filterField: BankBookFilterField | '';
  filterText: string;
  partyGroupId: string;
  fromDate: string;
  toDate: string;
}

const emptyForm = (): FormState => ({
  bankLedgerAccountId: '',
  detailMode: 'DETAIL',
  reportType: 'DAILY',
  filterField: '',
  filterText: '',
  partyGroupId: '',
  fromDate: '',
  toDate: '',
});

const Field: React.FC<{ label: string; hint?: string; className?: string; children: React.ReactNode }> = ({
  label,
  hint,
  className,
  children,
}) => (
  <div className={className}>
    <label className={labelClass}>{label}</label>
    {children}
    {hint && <p className="mt-0.5 text-[9px] leading-tight text-slate-500">{hint}</p>}
  </div>
);

/** Searchable Book Name popup: real bank ledgers of the active company only. */
const BookNameDialog: React.FC<{
  open: boolean;
  banks: BankBookBankOption[];
  selectedId: string;
  onPick: (bank: BankBookBankOption) => void;
  onClose: () => void;
}> = ({ open, banks, selectedId, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length === 0) return banks;
    return banks.filter((bank) =>
      [bank.accountName, bank.accountCode, bank.bankName ?? '', bank.bankAccountNumber ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [banks, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const index = banks.findIndex((bank) => bank.id === selectedId);
    setHighlight(index >= 0 ? index : 0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, banks, selectedId]);

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
        setHighlight((prev) => Math.min(filtered.length - 1, prev + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((prev) => Math.max(0, prev - 1));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const bank = filtered[highlight];
        if (bank) onPick(bank);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, highlight, onPick, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-900/45 p-3 print:hidden">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-[#2c5f57] bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-2 bg-[#2c5f57] px-3 py-1.5 text-white">
          <div className="flex items-center gap-2">
            <Landmark className="h-3.5 w-3.5 text-emerald-200" />
            <h2 className="text-[12px] font-bold uppercase tracking-wide">Book Name</h2>
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
        <div className="border-b border-slate-200 bg-[#f4faf7] px-2 py-1.5">
          <div className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5">
            <Search className="h-3 w-3 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              placeholder="Search book name..."
              className="w-full bg-transparent text-[11px] text-slate-800 focus:outline-none"
            />
          </div>
        </div>
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#e8f1ed] text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-2 py-1 text-left">Book Name</th>
                <th className="px-2 py-1 text-right">Balance</th>
                <th className="w-10 px-2 py-1 text-center">Dr/Cr</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                    {banks.length === 0
                      ? 'No active bank ledger exists for this company.'
                      : 'No bank book matches "' + query + '".'}
                  </td>
                </tr>
              ) : (
                filtered.map((bank, index) => (
                  <tr
                    key={bank.id}
                    onClick={() => setHighlight(index)}
                    onDoubleClick={() => onPick(bank)}
                    onMouseEnter={() => setHighlight(index)}
                    className={
                      'cursor-pointer border-b border-slate-100 ' +
                      (index === highlight ? 'bg-[#dceee8]' : 'hover:bg-slate-50')
                    }
                  >
                    <td className="px-2 py-1">
                      <span className="font-semibold text-slate-900">{bank.accountName}</span>
                      <span className="ml-1 font-mono text-[9px] text-slate-500">{bank.accountCode}</span>
                      <span className="block text-[9px] text-slate-500">
                        {[bank.bankName, bank.branchName, bank.bankAccountNumber]
                          .filter((part): part is string => Boolean(part && part.trim()))
                          .join(' | ') || 'No bank details recorded'}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right font-mono font-semibold">
                      {formatMoney(bank.currentBalance)}
                    </td>
                    <td className="px-2 py-1 text-center font-bold text-slate-600">{bank.currentNature}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-2 py-1.5">
          <span className="text-[10px] text-slate-500">Enter or double-click selects the bank book.</span>
          <button
            type="button"
            onClick={onClose}
            className="h-7 rounded border border-[#789d93] bg-white px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};
export const BankBookConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeFinancialYear } = useCompany();

  const [options, setOptions] = useState<BankBookOptions | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detailColumns, setDetailColumns] = useState<string[]>([]);
  const [summaryColumns, setSummaryColumns] = useState<string[]>([]);
  const [layoutName, setLayoutName] = useState('Standard');
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'preview' | 'print' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const patch = useCallback((changes: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  }, []);

  const applySaved = useCallback((data: BankBookOptions, savedId: string | null) => {
    const saved = savedId ? data.savedReports.find((entry) => entry.id === savedId) ?? null : null;
    const detailKeys = data.defaultColumns;
    const summaryKeys = data.summaryColumns.map((column) => column.key);
    if (!saved) {
      setForm({
        ...emptyForm(),
        fromDate: data.defaultFromDate,
        toDate: data.defaultToDate,
        bankLedgerAccountId: data.banks.length === 1 ? data.banks[0].id : '',
      });
      setDetailColumns(detailKeys);
      setSummaryColumns(summaryKeys);
      setLayoutName('Standard');
      setActiveSavedId(null);
      return;
    }
    setForm({
      bankLedgerAccountId: saved.bankLedgerAccountId,
      detailMode: saved.detailMode,
      reportType: saved.reportType || 'DAILY',
      filterField: saved.filterField ?? '',
      filterText: saved.filterText ?? '',
      partyGroupId: saved.partyGroupId ?? '',
      fromDate: saved.fromDate ?? data.defaultFromDate,
      toDate: saved.toDate ?? data.defaultToDate,
    });
    if (saved.detailMode === 'SUMMARY') {
      setSummaryColumns(saved.columns.length > 0 ? saved.columns : summaryKeys);
      setDetailColumns(detailKeys);
    } else {
      setDetailColumns(saved.columns.length > 0 ? saved.columns : detailKeys);
      setSummaryColumns(summaryKeys);
    }
    setLayoutName(saved.reportName);
    setActiveSavedId(saved.id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const data = await getBankBookOptions();
        if (cancelled) return;
        setOptions(data);
        applySaved(data, searchParams.get('reportId'));
      } catch (err) {
        if (cancelled) return;
        setError(readError(err, 'Failed to load the Bank Book configuration.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [applySaved, searchParams]);

  const selectedBank = useMemo(
    () => options?.banks.find((bank) => bank.id === form.bankLedgerAccountId) ?? null,
    [options, form.bankLedgerAccountId]
  );

  const columns = form.detailMode === 'SUMMARY' ? summaryColumns : detailColumns;
  const catalogue = form.detailMode === 'SUMMARY' ? options?.summaryColumns ?? [] : options?.columns ?? [];
  const requiredColumns = useMemo(
    () => catalogue.filter((column) => column.required).map((column) => column.key),
    [catalogue]
  );

  const setColumnsForMode = useCallback(
    (next: string[]) => {
      if (form.detailMode === 'SUMMARY') setSummaryColumns(next);
      else setDetailColumns(next);
    },
    [form.detailMode]
  );

  const validate = useCallback((): string | null => {
    if (!options) return 'Configuration is still loading.';
    if (!form.bankLedgerAccountId) return 'Select a Book Name.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(form.toDate)) {
      return 'Select both a valid From and To date.';
    }
    if (form.fromDate > form.toDate) return 'From date cannot be after the To date.';
    if (form.fromDate < options.financialYearStart || form.toDate > options.financialYearEnd) {
      return (
        'The report period must stay inside the financial year (' +
        options.financialYearStart +
        ' to ' +
        options.financialYearEnd +
        ').'
      );
    }
    if (form.filterField && form.filterText.trim().length === 0) {
      return 'Enter a value for the selected filter, or set Filter Field to No filter.';
    }
    if (columns.length === 0) return 'Select at least one report column.';
    return null;
  }, [options, form, columns]);

  const buildRequest = useCallback(
    (): BankBookRunRequest => ({
      bankLedgerAccountId: form.bankLedgerAccountId,
      detailMode: form.detailMode,
      reportType: form.reportType,
      fromDate: form.fromDate,
      toDate: form.toDate,
      filterField: form.filterField || null,
      filterText: form.filterField ? form.filterText.trim() || null : null,
      partyGroupId: form.partyGroupId || null,
      columns,
      page: 1,
      pageSize: 100,
    }),
    [form, columns]
  );

  const run = useCallback(
    async (destination: 'preview' | 'print') => {
      if (busy) return;
      const problem = validate();
      if (problem) {
        setError(problem);
        return;
      }
      setBusy(destination);
      setError(null);
      setNotice(null);
      try {
        const request = buildRequest();
        const result = await runBankBook(request);
        const state: BankBookPageState = { request, layoutName, landscape: false };
        writePageState(BANK_BOOK_STATE_KEY, state);
        if (destination === 'print') {
          navigate('/reports/bank-book/' + result.meta.bankLedgerAccountId + '/print');
        } else {
          navigate('/reports/bank-book/results');
        }
      } catch (err) {
        setError(readError(err, 'Failed to generate the Bank Book.'));
      } finally {
        setBusy(null);
      }
    },
    [busy, validate, buildRequest, layoutName, navigate]
  );

  const saveReport = useCallback(
    async (mode: 'save' | 'saveAs') => {
      if (busy) return;
      const problem = validate();
      if (problem) {
        setError(problem);
        return;
      }
      const current = activeSavedId
        ? options?.savedReports.find((entry) => entry.id === activeSavedId) ?? null
        : null;
      const suggested =
        mode === 'save' && current ? current.reportName : layoutName === 'Standard' ? '' : layoutName;
      const entered = window.prompt('Save this Bank Book configuration as', suggested);
      if (entered === null) return;
      const reportName = entered.trim();
      if (reportName.length === 0) {
        setError('A report name is required.');
        return;
      }
      setBusy('save');
      setError(null);
      try {
        const payload = {
          reportName,
          bankLedgerAccountId: form.bankLedgerAccountId,
          detailMode: form.detailMode,
          reportType: form.reportType,
          filterField: form.filterField || null,
          filterText: form.filterField ? form.filterText.trim() || null : null,
          partyGroupId: form.partyGroupId || null,
          fromDate: form.fromDate,
          toDate: form.toDate,
          columns,
          isDefault: current?.isDefault === true,
        };
        const saved =
          mode === 'save' && activeSavedId
            ? await updateBankBookSavedReport(activeSavedId, payload)
            : await createBankBookSavedReport(payload);
        const data = await getBankBookOptions();
        setOptions(data);
        setLayoutName(saved.reportName);
        setActiveSavedId(saved.id);
        setNotice('Configuration "' + saved.reportName + '" saved.');
      } catch (err) {
        setError(readError(err, 'Failed to save the Bank Book configuration.'));
      } finally {
        setBusy(null);
      }
    },
    [busy, validate, activeSavedId, options, layoutName, form, columns]
  );

  const removeReport = useCallback(async () => {
    if (!activeSavedId) return;
    const current = options?.savedReports.find((entry) => entry.id === activeSavedId);
    if (!window.confirm('Delete the saved report "' + (current?.reportName ?? '') + '"?')) return;
    setBusy('save');
    setError(null);
    try {
      await deleteBankBookSavedReport(activeSavedId);
      const data = await getBankBookOptions();
      setOptions(data);
      applySaved(data, null);
      setNotice('Saved report deleted.');
    } catch (err) {
      setError(readError(err, 'Failed to delete the saved report.'));
    } finally {
      setBusy(null);
    }
  }, [activeSavedId, options, applySaved]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'PageDown' && !blocksPageKey(event.target) && !bookDialogOpen && !selectorOpen) {
        event.preventDefault();
        void run('preview');
        return;
      }
      if (event.key === 'Escape') {
        if (bookDialogOpen) {
          setBookDialogOpen(false);
          return;
        }
        if (selectorOpen) {
          setSelectorOpen(false);
          return;
        }
        navigate('/reports/bank-book');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [run, bookDialogOpen, selectorOpen, navigate]);

  const partyGroupOptions = useMemo(() => {
    const groups = (options?.partyGroups ?? []).map((group) => ({
      value: group.id,
      label: group.groupName + (group.isActive ? '' : ' (inactive)'),
    }));
    return [
      { value: '', label: '1. All' },
      ...groups,
      { value: 'UNASSIGNED', label: 'Unassigned (no party group)' },
    ];
  }, [options]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">
            Bank Book - Report Configuration
          </span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {activeFinancialYear?.yearName ?? 'FY'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reports/bank-book')}
          title="Close (Esc)"
          className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs font-semibold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration...
        </div>
      ) : !options ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded border border-red-300 bg-white p-4 text-center">
            <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-600" />
            <p className="font-bold text-red-700">Bank Book configuration could not be loaded.</p>
            <p className="mt-1 text-slate-600">{error ?? 'Unknown error.'}</p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="space-y-1.5">
              {error && (
                <div className="flex items-start gap-2 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                  {notice}
                </div>
              )}

              <section className="rounded border border-[#789d93] bg-white p-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Report Setup
                  </h2>
                  <button
                    type="button"
                    onClick={() => setBookDialogOpen(true)}
                    disabled={options.banks.length === 0}
                    className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Search className="h-3 w-3" /> Book Name Lookup
                  </button>
                </div>

                <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="1. Book Name" className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => setBookDialogOpen(true)}
                      disabled={options.banks.length === 0}
                      className={fieldClass + ' flex items-center gap-1 text-left'}
                      title={
                        options.banks.length === 0
                          ? 'No active bank ledger exists for this company.'
                          : 'Choose the bank book'
                      }
                    >
                      <span className="flex-1 truncate font-semibold">
                        {selectedBank ? selectedBank.accountName : 'Select a bank book'}
                      </span>
                      {selectedBank && (
                        <span className="shrink-0 font-mono text-[10px] text-slate-500">
                          {formatMoney(selectedBank.currentBalance)} {selectedBank.currentNature}
                        </span>
                      )}
                    </button>
                  </Field>

                  <Field label="2. Detail / Summary">
                    <select
                      value={form.detailMode}
                      onChange={(event) => patch({ detailMode: event.target.value as BankBookDetailMode })}
                      className={fieldClass}
                    >
                      {options.detailModes.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="3. Report">
                    <select
                      value={form.reportType}
                      onChange={(event) => patch({ reportType: event.target.value })}
                      className={fieldClass}
                    >
                      {options.reportTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="4. Filter Field">
                    <select
                      value={form.filterField}
                      onChange={(event) =>
                        patch({ filterField: event.target.value as BankBookFilterField | '' })
                      }
                      className={fieldClass}
                    >
                      <option value="">No filter</option>
                      {options.filterFields.map((filter) => (
                        <option key={filter.value} value={filter.value}>
                          {filter.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="4.1 Filter Value">
                    <input
                      type="text"
                      value={form.filterText}
                      onChange={(event) => patch({ filterText: event.target.value })}
                      disabled={!form.filterField}
                      placeholder={form.filterField ? 'Text to match...' : 'Choose a filter field'}
                      className={fieldClass}
                    />
                  </Field>

                  <Field label="5. Party Group">
                    <select
                      value={form.partyGroupId}
                      onChange={(event) => patch({ partyGroupId: event.target.value })}
                      className={fieldClass}
                    >
                      {partyGroupOptions.map((group) => (
                        <option key={group.value} value={group.value}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="From Date">
                    <input
                      type="date"
                      value={form.fromDate}
                      min={options.financialYearStart}
                      max={options.financialYearEnd}
                      onChange={(event) => patch({ fromDate: event.target.value })}
                      className={fieldClass}
                    />
                  </Field>

                  <Field label="To Date">
                    <input
                      type="date"
                      value={form.toDate}
                      min={options.financialYearStart}
                      max={options.financialYearEnd}
                      onChange={(event) => patch({ toDate: event.target.value })}
                      className={fieldClass}
                    />
                  </Field>

                  <Field
                    label="Columns"
                    hint={'Selected for ' + (form.detailMode === 'SUMMARY' ? 'Summary' : 'Detail') + ' mode.'}
                  >
                    <div className="flex items-center gap-1">
                      <span className="flex h-7 flex-1 items-center rounded border border-[#789d93] bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-700">
                        {columns.length} of {catalogue.length} columns
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectorOpen(true)}
                        className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Columns3 className="h-3 w-3" /> Select
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-slate-500">
                  <span>
                    Financial year: {options.financialYearStart} to {options.financialYearEnd}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>
                    Opening balance is always the real ledger opening before the From date. Filters change
                    the rows, never the opening figure.
                  </span>
                </div>
              </section>

              <section className="rounded border border-[#789d93] bg-white p-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Saved Configurations
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void saveReport(activeSavedId ? 'save' : 'saveAs')}
                      disabled={busy !== null}
                      className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Save className="h-3 w-3" /> {activeSavedId ? 'Save' : 'Save As'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveReport('saveAs')}
                      disabled={busy !== null}
                      className="flex h-6 items-center gap-1 rounded border border-[#789d93] bg-white px-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      Save As
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeReport()}
                      disabled={!activeSavedId || busy !== null}
                      className="flex h-6 items-center gap-1 rounded border border-red-300 bg-red-50 px-1.5 text-[10px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
                {options.savedReports.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-slate-500">
                    No saved Bank Book configuration yet.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead className="sticky top-0 bg-[#f4faf7] text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="px-2 py-1 text-left">Report Name</th>
                          <th className="px-2 py-1 text-left">Bank</th>
                          <th className="px-2 py-1 text-left">Mode</th>
                          <th className="px-2 py-1 text-left">Period</th>
                          <th className="w-16 px-2 py-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {options.savedReports.map((report) => (
                          <tr
                            key={report.id}
                            className={
                              'border-b border-slate-100 ' +
                              (report.id === activeSavedId ? 'bg-[#dceee8]' : 'hover:bg-slate-50')
                            }
                          >
                            <td className="px-2 py-1 font-semibold text-slate-900">{report.reportName}</td>
                            <td className="px-2 py-1 text-slate-600">{report.bankAccountName ?? '-'}</td>
                            <td className="px-2 py-1 text-slate-600">
                              {report.detailMode === 'SUMMARY' ? 'Summary' : 'Detail'}
                            </td>
                            <td className="px-2 py-1 font-mono text-[10px] text-slate-600">
                              {report.fromDate ? displayDate(report.fromDate) : 'FY start'} -{' '}
                              {report.toDate ? displayDate(report.toDate) : 'FY end'}
                            </td>
                            <td className="px-2 py-1 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  applySaved(options, report.id);
                                  setNotice('Loaded "' + report.reportName + '".');
                                  setError(null);
                                }}
                                className="rounded border border-[#789d93] bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100"
                              >
                                Load
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5">
            <span className="text-[10px] text-slate-500">
              PageDown = Preview | Esc = close | Opening balance always shown
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => navigate('/reports/bank-book')}
                className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void run('print')}
                disabled={busy !== null}
                className="flex h-7 items-center gap-1 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {busy === 'print' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                Print Preview
              </button>
              <button
                type="button"
                onClick={() => void run('preview')}
                disabled={busy !== null}
                className="flex h-7 items-center gap-1 rounded bg-[#2c5f57] px-2 text-[11px] font-bold text-white hover:bg-[#244d47] disabled:opacity-50"
              >
                {busy === 'preview' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                Preview
              </button>
            </div>
          </footer>
        </div>
      )}

      <BookNameDialog
        open={bookDialogOpen}
        banks={options?.banks ?? []}
        selectedId={form.bankLedgerAccountId}
        onPick={(bank) => {
          patch({ bankLedgerAccountId: bank.id });
          setBookDialogOpen(false);
          setError(null);
        }}
        onClose={() => setBookDialogOpen(false)}
      />

      <ReportColumnSelector
        open={selectorOpen}
        title={'Column Selection - ' + (form.detailMode === 'SUMMARY' ? 'Bank Book Summary' : 'Bank Book Detail')}
        allColumns={toReportColumnDefs(catalogue)}
        selected={columns}
        layoutName={layoutName}
        allowSave={false}
        requiredColumns={requiredColumns}
        onCancel={() => setSelectorOpen(false)}
        onApply={(nextColumns) => {
          const merged = [
            ...requiredColumns,
            ...nextColumns.filter((key) => !requiredColumns.includes(key)),
          ];
          setColumnsForMode(merged);
          setSelectorOpen(false);
        }}
      />
    </div>
  );
};

export default BankBookConfigPage;